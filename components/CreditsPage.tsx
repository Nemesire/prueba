import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { Credit, ToxicityReport, CreditSubcategory, Transaction, TransactionType } from '../types.ts';
import { analyzeCreditToxicity, getDebtAdvice } from '../services/geminiService.ts';
import { Card, Modal, Input, Button, ProgressBar, ConfirmationModal, Textarea } from './common/UIComponents.tsx';
import { IconPlus, IconArrowUp, IconArrowDown, CREDIT_SUBCATEGORIES, IconPencil, IconTrash, IconSparkles, IconRefresh, IconScale } from '../constants.tsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
};

const calculateRemainingAmount = (credit: Credit): number => {
    const startDate = new Date(credit.startDate);
    const today = new Date();

    const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    
    if (monthsPassed <= 0) {
        return credit.totalAmount;
    }

    const monthlyInterestRate = credit.tin / 100 / 12;
    let remainingBalance = credit.totalAmount;

    for (let i = 0; i < monthsPassed; i++) {
        const interestForMonth = remainingBalance * monthlyInterestRate;
        const principalPaid = credit.monthlyPayment - interestForMonth;
        
        remainingBalance -= principalPaid;
        
        if (remainingBalance < 0) {
            remainingBalance = 0;
            break;
        }
    }

    const endDate = new Date(credit.endDate);
    if (today > endDate) {
        return 0;
    }

    return remainingBalance > 0 ? remainingBalance : 0;
};

// --- TYPES FOR SORTING ---
type SortKeyType = 'quota' | 'capital';
type MethodType = 'snowball' | 'avalanche' | 'cashflow' | null;

// --- COMPONENT: SORT CONTROLS ---
const SortControls: React.FC<{
    sortKey: SortKeyType;
    sortDir: 'asc' | 'desc';
    onSortChange: (key: SortKeyType, dir: 'asc' | 'desc') => void;
    activeMethod: MethodType;
    onMethodChange: (method: MethodType) => void;
}> = ({ sortKey, sortDir, onSortChange, activeMethod, onMethodChange }) => {
    return (
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
            <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
                <span className="text-[9px] font-black text-slate-500 uppercase ml-1">Ordenar:</span>
                <button 
                    onClick={() => { onMethodChange(null); onSortChange('quota', sortDir === 'asc' ? 'desc' : 'asc'); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${!activeMethod && sortKey === 'quota' ? 'bg-primary text-black' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    Cuota {!activeMethod && sortKey === 'quota' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                    onClick={() => { onMethodChange(null); onSortChange('capital', sortDir === 'asc' ? 'desc' : 'asc'); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${!activeMethod && sortKey === 'capital' ? 'bg-primary text-black' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    Capital {!activeMethod && sortKey === 'capital' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
            </div>
            
            <div className="flex items-center gap-1">
                <span className="text-[9px] font-black text-slate-500 uppercase ml-1">Método:</span>
                <button 
                    onClick={() => onMethodChange(activeMethod === 'snowball' ? null : 'snowball')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${activeMethod === 'snowball' ? 'bg-secondary text-black' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Prioriza deudas más pequeñas"
                >
                    Bola Nieve
                </button>
                <button 
                    onClick={() => onMethodChange(activeMethod === 'avalanche' ? null : 'avalanche')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${activeMethod === 'avalanche' ? 'bg-secondary text-black' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Prioriza interés más alto"
                >
                    Avalancha
                </button>
                <button 
                    onClick={() => onMethodChange(activeMethod === 'cashflow' ? null : 'cashflow')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${activeMethod === 'cashflow' ? 'bg-secondary text-black' : 'text-slate-400 hover:text-slate-200'}`}
                    title="Libera flujo de caja rápido"
                >
                    Flujo Caja
                </button>
            </div>
        </div>
    );
};

// --- HELPER FOR SHARED SORTING LOGIC ---
const sortCredits = (list: Credit[], sortKey: SortKeyType, sortDir: 'asc' | 'desc', activeMethod: MethodType): Credit[] => {
    return [...list].sort((a, b) => {
        if (activeMethod === 'snowball') {
            return calculateRemainingAmount(a) - calculateRemainingAmount(b);
        }
        if (activeMethod === 'avalanche') {
            return b.tae - a.tae;
        }
        if (activeMethod === 'cashflow') {
            const remA = calculateRemainingAmount(a);
            const remB = calculateRemainingAmount(b);
            const idxA = a.monthlyPayment > 0 ? remA / a.monthlyPayment : Infinity;
            const idxB = b.monthlyPayment > 0 ? remB / b.monthlyPayment : Infinity;
            return idxA - idxB;
        }
        
        const valA = sortKey === 'quota' ? a.monthlyPayment : calculateRemainingAmount(a);
        const valB = sortKey === 'quota' ? b.monthlyPayment : calculateRemainingAmount(b);
        return sortDir === 'asc' ? valA - valB : valB - valA;
    });
};

// --- COMPONENT: DEBT LIQUIDATION SIMULATOR ---
const DebtLiquidationView: React.FC<{ 
    credits: Credit[];
    sortKey: SortKeyType;
    sortDir: 'asc' | 'desc';
    onSortChange: (key: SortKeyType, dir: 'asc' | 'desc') => void;
    activeMethod: MethodType;
    onMethodChange: (method: MethodType) => void;
    liquidationSimulationIds: Set<string>;
    toggleLiquidationSimulation: (id: string) => void;
    simulatedLiquidationIds: Set<string>;
    toggleSimulatedLiquidation: (id: string) => void;
}> = ({ credits, sortKey, sortDir, onSortChange, activeMethod, onMethodChange, liquidationSimulationIds, toggleLiquidationSimulation, simulatedLiquidationIds, toggleSimulatedLiquidation }) => {
    
    const [showLiquidated, setShowLiquidated] = useState(false);

    const activeCredits = useMemo(() => {
        const list = showLiquidated ? credits : credits.filter(c => calculateRemainingAmount(c) > 0);
        return sortCredits(list, sortKey, sortDir, activeMethod);
    }, [credits, sortKey, sortDir, activeMethod, showLiquidated]);

    const totals = useMemo(() => {
        // Baseline: exclude globally liquidated credits
        const baselineCredits = activeCredits.filter(c => !simulatedLiquidationIds.has(c.id));
        
        const totalQuota = baselineCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);
        const totalRemaining = baselineCredits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);

        const selectedList = activeCredits.filter(c => liquidationSimulationIds.has(c.id));
        const releasedQuota = selectedList.reduce((sum, c) => sum + c.monthlyPayment, 0);
        const liquidationCost = selectedList.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);

        // If a globally liquidated credit is locally selected, we add its quota to the baseline 
        // so that the futureQuota calculation (totalQuota - releasedQuota) remains accurate.
        const locallySelectedGloballyLiquidated = selectedList.filter(c => simulatedLiquidationIds.has(c.id));
        const adjustedTotalQuota = totalQuota + locallySelectedGloballyLiquidated.reduce((sum, c) => sum + c.monthlyPayment, 0);
        const adjustedTotalRemaining = totalRemaining + locallySelectedGloballyLiquidated.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);

        return {
            totalQuota: adjustedTotalQuota,
            totalRemaining: adjustedTotalRemaining,
            releasedQuota,
            liquidationCost,
            futureQuota: adjustedTotalQuota - releasedQuota,
            futureRemaining: adjustedTotalRemaining - liquidationCost
        };
    }, [activeCredits, liquidationSimulationIds, simulatedLiquidationIds]);

    const handleClearSelection = () => {
        liquidationSimulationIds.forEach(id => toggleLiquidationSimulation(id));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="!p-4 border-l-4 border-danger bg-slate-800/40">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Cuotas Actuales</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totals.totalQuota)}<span className="text-sm font-normal text-slate-500 ml-1">/mes</span></p>
                </Card>
                <Card className="!p-4 border-l-4 border-danger bg-slate-800/40">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Capital Pendiente</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(totals.totalRemaining)}</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-1 gap-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase">Simulación de Liquidación</h3>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={showLiquidated} 
                                    onChange={(e) => setShowLiquidated(e.target.checked)}
                                    className="form-checkbox h-3 w-3 text-primary rounded border-slate-600 bg-slate-700 focus:ring-primary focus:ring-offset-slate-800"
                                />
                                Mostrar liquidados
                            </label>
                            <SortControls 
                                sortKey={sortKey} 
                                sortDir={sortDir} 
                                onSortChange={onSortChange} 
                                activeMethod={activeMethod}
                                onMethodChange={onMethodChange}
                            />
                        </div>
                    </div>
                    
                    {activeCredits.map((credit, index) => {
                        const isLocallySelected = liquidationSimulationIds.has(credit.id);
                        const isGloballyLiquidated = simulatedLiquidationIds.has(credit.id);
                        const remaining = calculateRemainingAmount(credit);
                        return (
                            <div 
                                key={credit.id}
                                onClick={() => toggleLiquidationSimulation(credit.id)}
                                className={`group cursor-pointer p-3 rounded-lg border-2 transition-all flex items-center gap-4 ${
                                    isLocallySelected 
                                    ? 'bg-secondary/10 border-secondary/50 shadow-[0_0_15px_rgba(74,222,128,0.1)] opacity-100' 
                                    : isGloballyLiquidated
                                    ? 'bg-slate-900/40 border-slate-700/50 opacity-50'
                                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                        isLocallySelected ? 'bg-secondary border-secondary text-black' : 'border-slate-600 group-hover:border-slate-400'
                                    }`}>
                                        {isLocallySelected && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    {!isLocallySelected && <span className="text-[10px] font-black text-slate-500">{index + 1}º</span>}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`font-bold text-sm truncate transition-all ${isGloballyLiquidated && !isLocallySelected ? 'text-slate-500 line-through decoration-slate-500 decoration-2' : 'text-slate-200'}`}>{credit.name}</p>
                                        {isGloballyLiquidated && (
                                            <span className="text-[8px] uppercase font-black bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">Liquidado</span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] transition-all ${isGloballyLiquidated && !isLocallySelected ? 'text-slate-600 line-through' : 'text-slate-500'}`}>{credit.subcategory} {activeMethod && <span className="text-secondary font-bold ml-1">· Prioridad #{index + 1}</span>}</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <p className={`text-xs font-bold transition-all ${isGloballyLiquidated && !isLocallySelected ? 'text-slate-500 line-through' : 'text-white'}`}>{formatCurrency(remaining)}</p>
                                        <p className={`text-[10px] font-mono transition-all ${isGloballyLiquidated && !isLocallySelected ? 'text-slate-600 line-through' : 'text-danger'}`}>{formatCurrency(credit.monthlyPayment)}/mes</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleSimulatedLiquidation(credit.id); }}
                                        className={`p-2 rounded-full transition-colors border ${isGloballyLiquidated ? 'bg-secondary/20 text-secondary border-secondary/50 hover:bg-secondary/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-secondary/20 hover:text-secondary hover:border-secondary/50'}`}
                                        title={isGloballyLiquidated ? "Revertir liquidación global" : "Marcar como liquidado globalmente"}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="sticky top-4 space-y-4">
                    <Card className="border-2 border-primary/30 bg-slate-900/80 backdrop-blur shadow-2xl">
                        <h3 className="text-center text-primary font-black text-sm uppercase tracking-tighter mb-4">Impacto de Liquidación</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase text-center">Capital a Desembolsar</p>
                                <p className="text-3xl font-black text-white text-center">{formatCurrency(totals.liquidationCost)}</p>
                            </div>

                            <div className="bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                                <p className="text-[10px] text-secondary font-bold uppercase text-center">Cuota Mensual Liberada</p>
                                <p className="text-2xl font-black text-secondary text-center">+{formatCurrency(totals.releasedQuota)}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-700 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Restante en Cuota:</span>
                                    <span className="text-white font-bold">{formatCurrency(totals.futureQuota)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Total Pendiente:</span>
                                    <span className="text-white font-bold">{formatCurrency(totals.futureRemaining)}</span>
                                </div>
                            </div>
                            
                            {liquidationSimulationIds.size > 0 && (
                                <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/10 text-[10px] text-slate-400 italic text-center">
                                    "Liberarías {((totals.releasedQuota / totals.totalQuota) * 100).toFixed(0)}% de tu carga financiera mensual inmediata."
                                </div>
                            )}
                        </div>
                    </Card>

                    <Button 
                        onClick={handleClearSelection} 
                        variant="ghost" 
                        className="w-full text-xs uppercase font-bold text-slate-500"
                        disabled={liquidationSimulationIds.size === 0}
                    >
                        Limpiar Selección
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- ULTRA-COMPACT NEON DEBT PROGRESS CHART ---
const DebtBarChart: React.FC<{ 
    sortKey: SortKeyType;
    sortDir: 'asc' | 'desc';
    onSortChange: (key: SortKeyType, dir: 'asc' | 'desc') => void;
    activeMethod: MethodType;
    onMethodChange: (method: MethodType) => void;
}> = ({ sortKey, sortDir, onSortChange, activeMethod, onMethodChange }) => {
    const { credits, simulatedLiquidationIds, toggleSimulatedLiquidation } = useApp();
    const [showLiquidated, setShowLiquidated] = useState(false);

    const activeCredits = useMemo(() => {
        const list = showLiquidated ? credits : credits.filter(c => calculateRemainingAmount(c) > 0);
        return sortCredits(list, sortKey, sortDir, activeMethod);
    }, [credits, sortKey, sortDir, activeMethod, showLiquidated]);

    if (activeCredits.length === 0 && !showLiquidated) return null;

    return (
        <Card className="mb-6 !p-4 bg-slate-800/30 border border-slate-700/50 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 px-1 gap-4">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-tighter flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-danger rounded-full animate-pulse"></span>
                    Estado de Deudas y Cuotas
                </h2>
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={showLiquidated} 
                            onChange={(e) => setShowLiquidated(e.target.checked)}
                            className="form-checkbox h-3 w-3 text-primary rounded border-slate-600 bg-slate-700 focus:ring-primary focus:ring-offset-slate-800"
                        />
                        Mostrar liquidados
                    </label>
                    <SortControls 
                        sortKey={sortKey} 
                        sortDir={sortDir} 
                        onSortChange={onSortChange} 
                        activeMethod={activeMethod}
                        onMethodChange={onMethodChange}
                    />
                    <div className="hidden sm:flex gap-2 text-[10px] font-bold text-slate-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-danger rounded-sm"></span> DEUDA</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-700 rounded-sm"></span> TOTAL</span>
                    </div>
                </div>
            </div>
            
            <div className="space-y-3">
                {activeCredits.map((credit, index) => {
                    const remaining = calculateRemainingAmount(credit);
                    const paid = credit.totalAmount - remaining;
                    const progress = (paid / credit.totalAmount) * 100;
                    const isSelected = simulatedLiquidationIds.has(credit.id);

                    return (
                        <div 
                            key={credit.id} 
                            onClick={() => toggleSimulatedLiquidation(credit.id)}
                            className={`relative bg-slate-900/40 rounded-lg p-3 border cursor-pointer transition-all group ${
                                isSelected 
                                ? 'border-secondary shadow-[0_0_15px_rgba(74,222,128,0.2)] ring-1 ring-secondary/50 opacity-60' 
                                : 'border-slate-700/30 hover:border-danger/30'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="min-w-0 flex gap-3 items-start">
                                    <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] border transition-colors ${isSelected ? 'bg-secondary text-black border-secondary' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                        {isSelected ? '✓' : index + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-sm truncate transition-all ${isSelected ? 'text-slate-500 line-through decoration-slate-500' : 'text-white group-hover:text-danger'}`}>{credit.name}</h3>
                                        <p className="text-[10px] text-slate-500 font-medium">{credit.subcategory} {activeMethod && !isSelected && <span className="text-secondary font-black ml-1">#{index + 1}</span>}</p>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Cuota</span>
                                            <span className={`font-black text-lg transition-all ${isSelected ? 'text-slate-600 line-through' : 'text-danger'}`}>€{credit.monthlyPayment.toFixed(2)}</span>
                                        </div>
                                        <p className={`text-[10px] font-mono transition-all ${isSelected ? 'text-slate-600 line-through' : 'text-slate-500'}`}>Pendiente: {formatCurrency(remaining)}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleSimulatedLiquidation(credit.id); }}
                                        className={`p-2 rounded-full transition-colors border ${isSelected ? 'bg-secondary/20 text-secondary border-secondary/50 hover:bg-secondary/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-secondary/20 hover:text-secondary hover:border-secondary/50'}`}
                                        title={isSelected ? "Revertir liquidación" : "Simular liquidación"}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className={`relative transition-opacity ${isSelected ? 'opacity-40' : 'opacity-100'}`}>
                                <div className="w-full bg-slate-700 rounded-full h-3.5 overflow-hidden shadow-inner">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(217,70,239,0.4)] relative ${isSelected ? 'bg-slate-500' : 'bg-danger'}`}
                                        style={{ width: `${Math.max(progress, 2)}%` }}
                                    >
                                        {!isSelected && <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 blur-[1px]"></div>}
                                    </div>
                                </div>
                                <span className={`absolute -top-1.5 right-0 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full border border-slate-900 shadow-lg transition-colors ${isSelected ? 'bg-slate-500' : 'bg-danger'}`}>
                                    {progress.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const DebtAnalysisView: React.FC<{ credits: Credit[] }> = ({ credits }) => {
    const { users, activeView } = useApp();
    const [selections, setSelections] = useState<Record<string, string[]>>({
        snowball: [],
        avalanche: [],
        cashflow: [],
    });

    const handleToggleSelection = (strategy: string, creditId: string) => {
        setSelections(prev => {
            const currentSelection = prev[strategy] || [];
            const newSelection = currentSelection.includes(creditId)
                ? currentSelection.filter(id => id !== creditId)
                : [...currentSelection, creditId];
            return { ...prev, [strategy]: newSelection };
        });
    };

    // Helper component for each strategy card
    const StrategyCard: React.FC<{
        title: string;
        description: React.ReactNode;
        sortedCredits: Credit[];
        metricRenderer: (credit: Credit) => React.ReactNode;
        selectedCreditIds: string[];
        onToggleSelection: (creditId: string) => void;
    }> = ({ title, description, sortedCredits, metricRenderer, selectedCreditIds, onToggleSelection }) => {
         const summary = useMemo(() => {
            if (selectedCreditIds.length === 0) return null;
            
            const selectedCredits = sortedCredits.filter(c => selectedCreditIds.includes(c.id));
            
            const totalCost = selectedCredits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);
            const freedUpQuota = selectedCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);
            
            return { totalCost, freedUpQuota };
        }, [selectedCreditIds, sortedCredits]);

        return (
            <Card>
                <h3 className="text-xl font-bold text-primary">{title}</h3>
                <div className="text-sm text-slate-400 mt-1 mb-4 h-16">{description}</div>
                
                {summary && (
                    <div className="bg-slate-900/50 p-3 rounded-md mb-4 text-sm border border-primary/30">
                        <div className="flex justify-between">
                            <span className="text-slate-300">Costo Liquidar Total:</span>
                            <span className="font-bold text-white">{formatCurrency(summary.totalCost)}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-slate-300">Cuota Liberada:</span>
                            <span className="font-bold text-secondary">{formatCurrency(summary.freedUpQuota)}</span>
                        </div>
                    </div>
                )}

                <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                    {sortedCredits.map((credit, index) => {
                        const isSelected = selectedCreditIds.includes(credit.id);
                        const owner = activeView.type === 'group' && credit.ownerId ? users.find(u => u.id === credit.ownerId) : null;
                        return (
                             <div
                                key={credit.id}
                                className={`relative p-3 rounded-md transition-all cursor-pointer border ${isSelected ? 'bg-primary/10 border-primary' : 'bg-slate-700/50 border-transparent hover:border-slate-600'}`}
                                onClick={() => onToggleSelection(credit.id)}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-black">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <span className="flex-shrink-0 mt-3 flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 font-bold text-lg text-white">{index + 1}</span>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 pr-4">
                                                <p className="font-bold text-white truncate">{credit.name}</p>
                                                {owner && (
                                                    <div className="flex items-center gap-1.5 mt-1" title={`Propiedad de ${owner.name}`}>
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: owner.color }}></span>
                                                        <span className="text-xs text-slate-400 truncate">{owner.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-semibold text-primary text-right flex-shrink-0">{metricRenderer(credit)}</span>
                                        </div>
                                        <div className="flex justify-between items-baseline text-sm mt-1 text-slate-400">
                                            <span>Pendiente: <span className="font-mono text-slate-200">{formatCurrency(calculateRemainingAmount(credit))}</span></span>
                                            <span>Cuota: <span className="font-mono text-slate-200">{formatCurrency(credit.monthlyPayment)}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        );
    };

    const snowballOrder = useMemo(() => 
        [...credits].filter(c => calculateRemainingAmount(c) > 0).sort((a, b) => calculateRemainingAmount(a) - calculateRemainingAmount(b)), 
    [credits]);
    
    const avalancheOrder = useMemo(() => 
        [...credits].filter(c => calculateRemainingAmount(c) > 0).sort((a, b) => b.tae - a.tae), 
    [credits]);

    const cashflowOrder = useMemo(() => 
        [...credits].filter(c => calculateRemainingAmount(c) > 0).sort((a, b) => {
            const remainingA = calculateRemainingAmount(a);
            const remainingB = calculateRemainingAmount(b);
            const indexA = a.monthlyPayment > 0 ? remainingA / a.monthlyPayment : Infinity;
            const indexB = b.monthlyPayment > 0 ? remainingB / b.monthlyPayment : Infinity;
            return indexA - indexB;
        }),
    [credits]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StrategyCard
                title="Método Bola de Nieve"
                description={<>Prioriza pagar primero las deudas más <strong>pequeñas</strong> (saldo pendiente). Ideal para conseguir victorias rápidas y motivación.</>}
                sortedCredits={snowballOrder}
                metricRenderer={(credit) => (
                    <span className="font-bold">Saldo: {formatCurrency(calculateRemainingAmount(credit))}</span>
                )}
                selectedCreditIds={selections.snowball}
                onToggleSelection={(creditId) => handleToggleSelection('snowball', creditId)}
            />
            <StrategyCard
                title="Método Avalancha"
                description={<>Prioriza pagar las deudas con el <strong>mayor interés (TAE)</strong>. Matemáticamente, es la forma más rápida y económica de pagar la deuda.</>}
                sortedCredits={avalancheOrder}
                metricRenderer={(credit) => (
                    <span className="font-bold">TAE: {credit.tae.toFixed(2)}%</span>
                )}
                selectedCreditIds={selections.avalanche}
                onToggleSelection={(creditId) => handleToggleSelection('avalanche', creditId)}
            />
            <StrategyCard
                title="Liberación de Flujo de Caja"
                description={<>Ataca las deudas con el <strong>índice más bajo</strong> (saldo pendiente / cuota mensual) para liberar efectivo mensual más rápido.</>}
                sortedCredits={cashflowOrder}
                metricRenderer={(credit) => {
                    const remaining = calculateRemainingAmount(credit);
                    const index = credit.monthlyPayment > 0 ? remaining / credit.monthlyPayment : Infinity;
                    return <span className="font-bold">Índice: {isFinite(index) ? index.toFixed(2) : 'N/A'}</span>
                }}
                selectedCreditIds={selections.cashflow}
                onToggleSelection={(creditId) => handleToggleSelection('cashflow', creditId)}
            />
        </div>
    );
};


const DebtAdvisorModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { credits } = useApp();
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResponse('');
            setError('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleAskAdvisor = async (prompt?: string) => {
        const currentQuery = prompt || query;
        if (!currentQuery.trim()) {
            setError('Por favor, introduce una pregunta.');
            return;
        }
        
        setIsLoading(true);
        setResponse('');
        setError('');

        try {
            const result = await getDebtAdvice(currentQuery, credits);
            setResponse(result);
        } catch (err) {
            setError('Ocurrió un error al contactar con el asistente. Por favor, inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const promptStarters = [
        "¿Qué préstamo me recomiendas amortizar primero y por qué?",
        "Explícame los métodos 'bola de nieve' y 'avalancha' con mis datos.",
        "¿Cuál es el crédito con el tipo de interés (TAE) más alto?",
        "Resume mi situación de deuda actual en un párrafo.",
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Asistente de Deuda IA" size="lg">
            <div className="space-y-4">
                <p className="text-slate-400">Haz una pregunta sobre tu cartera de créditos y la IA te ofrecerá un análisis y recomendaciones personalizadas. Aquí tienes algunas ideas:</p>
                <div className="flex flex-wrap gap-2">
                    {promptStarters.map(prompt => (
                        <Button key={prompt} variant="ghost" size="sm" onClick={() => { setQuery(prompt); handleAskAdvisor(prompt); }} disabled={isLoading}>
                            {prompt}
                        </Button>
                    ))}
                </div>
                
                <Textarea
                    label="Tu pregunta"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ej: ¿Qué estrategia debo seguir para pagar mis deudas más rápido?"
                    rows={3}
                    disabled={isLoading}
                />
                 <div className="text-right">
                    <Button onClick={() => handleAskAdvisor()} disabled={isLoading}>
                        {isLoading ? 'Analizando...' : 'Preguntar al Asistente'}
                    </Button>
                </div>
                
                {isLoading && (
                    <div className="text-center py-8">
                        <p className="text-slate-400 animate-pulse">El asesor está analizando tus créditos...</p>
                    </div>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}
                
                {response && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-2">Respuesta del Asistente:</h3>
                        <div className="prose prose-sm prose-invert max-w-none bg-slate-700/50 p-4 rounded-md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const DebtRatioSummary: React.FC<{ simulatedPaidIds?: Set<string> }> = ({ simulatedPaidIds }) => {
    const { credits, getExpandedTransactionsForYear } = useApp();
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExpensesDetailOpen, setIsExpensesDetailOpen] = useState(false);

    const summaryData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        const allCurrentYearTransactions = getExpandedTransactionsForYear(currentYear);
        const currentMonthTransactions = allCurrentYearTransactions.filter(t => {
            if (t.isExcluded) return false;
            const tDate = new Date(t.date + 'T00:00:00Z');
            return tDate.getUTCFullYear() === currentYear && tDate.getUTCMonth() === currentMonth;
        });
        const totalMonthlyIncome = currentMonthTransactions
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);

        const otherExpensesTransactions = currentMonthTransactions
            .filter(t => t.type === TransactionType.EXPENSE && !t.creditId && t.category !== 'Créditos');

        const totalOtherExpenses = otherExpensesTransactions
            .reduce((sum, t) => sum + t.amount, 0);

        // Filter credits that are not simulated as paid
        const activeCredits = credits.filter(c => !simulatedPaidIds?.has(c.id));
        const totalMonthlyDebt = activeCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);
        
        const debtToIncomeRatio = totalMonthlyIncome > 0 ? (totalMonthlyDebt / totalMonthlyIncome) * 100 : null;

        let financialHealth = { status: 'Desconocido', advice: 'No hay ingresos registrados este mes para calcular el ratio de endeudamiento.', color: 'text-slate-500' };
        if (debtToIncomeRatio !== null) {
            if (debtToIncomeRatio <= 20) {
                financialHealth = { status: 'Saludable', advice: 'Tu nivel de deuda es bajo en comparación con tus ingresos. ¡Excelente trabajo!', color: 'text-secondary' };
            } else if (debtToIncomeRatio <= 36) {
                financialHealth = { status: 'Bueno', advice: 'Tu nivel de deuda es manejable. Sigue así y evita contraer nuevas deudas innecesarias.', color: 'text-green-400' };
            } else if (debtToIncomeRatio <= 43) {
                financialHealth = { status: 'Moderado', advice: 'Tu nivel de deuda es algo elevado. Es un buen momento para crear un plan y reducirlo.', color: 'text-accent' };
            } else {
                financialHealth = { status: 'De Riesgo', advice: 'Tu nivel de deuda es muy alto. Es crucial priorizar su reducción para mejorar tu salud financiera.', color: 'text-danger' };
            }
        }
        return { debtToIncomeRatio, financialHealth, totalMonthlyIncome, totalMonthlyDebt, totalOtherExpenses, otherExpensesTransactions };
    }, [credits, getExpandedTransactionsForYear, refreshKey, simulatedPaidIds]);

    const idealRatioText = "Un ratio ideal se sitúa por debajo del 35-40%. Esto indica que tienes un margen saludable para ahorrar, invertir y afrontar imprevistos sin que la deuda sea una carga excesiva.";

    const handleRefresh = () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setIsRefreshing(false), 750);
    };

    return (
        <>
            <Card className="mb-6 bg-slate-800/50 border border-slate-700/50">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <div className="flex items-center gap-4 justify-center md:justify-start">
                            <h2 className="text-xl font-bold text-slate-200 flex flex-col xl:flex-row xl:items-center gap-2">
                                Ratio de Endeudamiento Actual
                                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                    <span className="text-xs font-normal text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600 whitespace-nowrap">
                                        Ingresos: <span className="text-secondary font-bold">{formatCurrency(summaryData.totalMonthlyIncome)}</span>
                                    </span>
                                    <span className="text-xs font-normal text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600 whitespace-nowrap">
                                        Gastos Créditos: <span className="text-danger font-bold">{formatCurrency(summaryData.totalMonthlyDebt)}</span>
                                    </span>
                                    <span 
                                        className="text-xs font-normal text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md border border-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-700 transition-colors"
                                        onClick={() => setIsExpensesDetailOpen(true)}
                                        title="Ver desglose"
                                    >
                                        Otros Gastos: <span className="text-orange-400 font-bold">{formatCurrency(summaryData.totalOtherExpenses)}</span>
                                    </span>
                                </div>
                            </h2>
                            <Button 
                                onClick={handleRefresh} 
                                variant="ghost" 
                                size="sm" 
                                className="!p-2" 
                                disabled={isRefreshing} 
                                title="Actualizar ratio"
                            >
                                <IconRefresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                        {summaryData.debtToIncomeRatio !== null ? (
                            <p className={`text-5xl font-extrabold my-1 transition-colors duration-500 ${summaryData.financialHealth.color}`}>
                                {summaryData.debtToIncomeRatio.toFixed(1)}%
                            </p>
                        ) : (
                            <p className="text-3xl font-bold my-1 text-slate-500">N/A</p>
                        )}
                        <p className={`font-semibold transition-colors duration-500 ${summaryData.financialHealth.color}`}>
                            Nivel: {summaryData.financialHealth.status}
                        </p>
                    </div>
                    <div className="flex-1 text-sm text-slate-300 space-y-2 text-center md:text-left">
                        <p><span className="font-bold text-slate-100">Consejo:</span> {summaryData.financialHealth.advice}</p>
                        <p><span className="font-bold text-slate-100">Recomendación:</span> {idealRatioText}</p>
                        {simulatedPaidIds && simulatedPaidIds.size > 0 && (
                            <p className="text-xs text-primary italic mt-2 animate-pulse">
                                * Vista simulada: Excluyendo {simulatedPaidIds.size} {simulatedPaidIds.size === 1 ? 'crédito marcado' : 'créditos marcados'} como liquidados.
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            <Modal isOpen={isExpensesDetailOpen} onClose={() => setIsExpensesDetailOpen(false)} title="Desglose de Otros Gastos (Mes Actual)">
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {summaryData.otherExpensesTransactions.length > 0 ? (
                        summaryData.otherExpensesTransactions.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                                <div>
                                    <p className="font-bold text-white text-sm">{t.description || t.category}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{t.category}</span>
                                        <span className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <span className="font-mono text-orange-400 font-bold">{formatCurrency(t.amount)}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-slate-500">No hay otros gastos registrados este mes.</p>
                        </div>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-slate-300">Total Otros Gastos</span>
                    <span className="font-bold text-xl text-orange-400">{formatCurrency(summaryData.totalOtherExpenses)}</span>
                </div>
            </Modal>
        </>
    );
};


const CreditsSummary: React.FC<{ simulatedPaidIds?: Set<string> }> = ({ simulatedPaidIds }) => {
    const { credits } = useApp();

    const summaryData = useMemo(() => {
        const activeCredits = credits.filter(c => !simulatedPaidIds?.has(c.id));
        const cardCredits = activeCredits.filter(c => c.subcategory === 'Tarjeta');
        const loanCredits = activeCredits.filter(c => c.subcategory === 'Préstamo' || c.subcategory === 'Financiación');
        const mortgageCredits = activeCredits.filter(c => c.subcategory === 'Hipoteca');

        const totalCardDebt = cardCredits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);
        const totalCardMonthly = cardCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);

        const totalLoanDebt = loanCredits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);
        const totalLoanMonthly = loanCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);

        const totalMortgageDebt = mortgageCredits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);
        const totalMortgageMonthly = mortgageCredits.reduce((sum, c) => sum + c.monthlyPayment, 0);

        return {
            totalCount: activeCredits.length, cardCount: cardCredits.length, loanCount: loanCredits.length, mortgageCount: mortgageCredits.length,
            totalCardDebt, totalCardMonthly, totalLoanDebt, totalLoanMonthly, totalMortgageDebt, totalMortgageMonthly,
        };
    }, [credits, simulatedPaidIds]);

    const StatCard: React.FC<{title: string; value: number}> = ({ title, value }) => (
        <div className="bg-slate-700/50 p-3 rounded-lg">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );

    const DetailCard: React.FC<{title: string; totalDebt: number; monthlyPayment: number}> = ({ title, totalDebt, monthlyPayment }) => (
        <div className="bg-slate-700 p-4 rounded-lg">
            <h3 className="font-bold text-lg text-primary mb-2">{title}</h3>
            <div className="flex justify-between">
                <span className="text-slate-400">Deuda Total</span>
                <span className="font-semibold text-white">{formatCurrency(totalDebt)}</span>
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-slate-400">Cuota Mensual</span>
                <span className="font-semibold text-white">{formatCurrency(monthlyPayment)}</span>
            </div>
        </div>
    );

    return (
        <Card className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Resumen de Deudas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                <StatCard title="Créditos Totales" value={summaryData.totalCount} />
                <StatCard title="Tarjetas" value={summaryData.cardCount} />
                <StatCard title="Préstamos" value={summaryData.loanCount} />
                <StatCard title="Hipotecas" value={summaryData.mortgageCount} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <DetailCard title="Tarjetas de Crédito" totalDebt={summaryData.totalCardDebt} monthlyPayment={summaryData.totalCardMonthly} />
                <DetailCard title="Préstamos" totalDebt={summaryData.totalLoanDebt} monthlyPayment={summaryData.totalLoanMonthly} />
                <DetailCard title="Hipotecas" totalDebt={summaryData.totalMortgageDebt} monthlyPayment={summaryData.totalMortgageMonthly} />
            </div>
        </Card>
    );
};


const InteractiveToxicityReport: React.FC<{ 
    report: ToxicityReport;
    onReanalyze: () => void;
    onDelete: () => void;
}> = ({ report, onReanalyze, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const getColor = (score: number) => {
        if (score <= 3) return 'bg-secondary';
        if (score <= 7) return 'bg-accent';
        return 'bg-danger';
    };

    return (
        <div>
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-300">Nivel de Toxicidad: {report.score}/10</h4>
                <div className="flex gap-1">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors" title={isExpanded ? "Ocultar consejo" : "Ver consejo"}>
                        {isExpanded ? <IconArrowUp className="w-5 h-5"/> : <IconArrowDown className="w-5 h-5"/>}
                    </button>
                    <button onClick={onReanalyze} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors" title="Re-analizar">
                        <IconSparkles className="w-5 h-5"/>
                    </button>
                    <button onClick={onDelete} className="text-slate-400 hover:text-danger p-1.5 rounded-full hover:bg-slate-700 transition-colors" title="Eliminar análisis">
                        <IconTrash className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            <ProgressBar value={report.score * 10} colorClass={getColor(report.score)} />
            
            {isExpanded && (
                <div className="mt-2 text-sm text-slate-300 bg-slate-900/50 p-3 rounded-md transition-all ease-in-out duration-300">
                    <p className="font-semibold mb-1">Consejo de la IA:</p>
                    <p>{report.explanation}</p>
                </div>
            )}
        </div>
    );
};

const CreditRatio: React.FC<{ credit: Credit }> = ({ credit }) => {
    const { updateCreditToxicity } = useApp();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        const termInMonths = (new Date(credit.endDate).getFullYear() - new Date(credit.startDate).getFullYear()) * 12 +
                             (new Date(credit.endDate).getMonth() - new Date(credit.startDate).getMonth());
        
        const report = await analyzeCreditToxicity(credit.totalAmount, credit.monthlyPayment, credit.tin, credit.tae, termInMonths);
        updateCreditToxicity(credit.id, report);
        setIsAnalyzing(false);
    };

    if (isAnalyzing) {
        return <span className="text-xs text-slate-400">Analizando...</span>;
    }

    if (!credit.toxicityReport || credit.toxicityReport.score === 0) {
        return (
            <button onClick={handleAnalyze} className="p-1 px-2 text-xs bg-slate-600 hover:bg-slate-500 rounded text-slate-200 whitespace-nowrap flex items-center gap-1 transition-colors">
                <IconSparkles className="w-4 h-4 text-primary" />
                <span>Analizar</span>
            </button>
        );
    }
    
    const score = credit.toxicityReport.score;
    const ratio = Math.ceil(score / 2);

    const getRatioStyles = (r: number): {bgColor: string, textColor: string, label: string} => {
        switch (r) {
            case 1: return { bgColor: 'bg-secondary', textColor: 'text-black', label: 'Sano' };
            case 2: return { bgColor: 'bg-green-400', textColor: 'text-black', label: 'Bajo' };
            case 3: return { bgColor: 'bg-accent', textColor: 'text-black', label: 'Moderado' };
            case 4: return { bgColor: 'bg-orange-500', textColor: 'text-white', label: 'Elevado' };
            case 5: return { bgColor: 'bg-danger', textColor: 'text-white', label: 'Tóxico' };
            default: return { bgColor: 'bg-slate-500', textColor: 'text-white', label: 'N/A' };
        }
    };
    
    const styles = getRatioStyles(ratio);

    return (
         <div className="flex flex-col items-center" title={`${credit.toxicityReport.explanation} (Puntuación: ${score}/10)`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${styles.bgColor} ${styles.textColor}`}>
                {ratio}
            </div>
             <span className="text-xs mt-1 text-slate-400">{styles.label}</span>
        </div>
    );
};

const CreditCard: React.FC<{ credit: Credit; onEdit: (credit: Credit) => void; onDelete: (credit: Credit) => void; }> = ({ credit, onEdit, onDelete }) => {
    const { updateCreditToxicity, deleteCreditToxicity, activeView, users } = useApp();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const owner = activeView.type === 'group' && credit.ownerId ? users.find(u => u.id === credit.ownerId) : null;

    const handleAnalyze = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        const termInMonths = (new Date(credit.endDate).getFullYear() - new Date(credit.startDate).getFullYear()) * 12 +
                             (new Date(credit.endDate).getMonth() - new Date(credit.startDate).getMonth());
        
        const report = await analyzeCreditToxicity(credit.totalAmount, credit.monthlyPayment, credit.tin, credit.tae, termInMonths);
        updateCreditToxicity(credit.id, report);
        setIsAnalyzing(false);
    };
    
    const handleDeleteAnalysis = () => {
        deleteCreditToxicity(credit.id);
    };

    const remainingAmount = calculateRemainingAmount(credit);
    const progress = credit.totalAmount > 0 ? ((credit.totalAmount - remainingAmount) / credit.totalAmount) * 100 : 0;

    return (
        <Card className="flex flex-col justify-between">
            <div>
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2">
                        <h3 className="text-xl font-bold text-white">{credit.name}</h3>
                        {owner && (
                            <div className="flex items-center gap-2 mt-1" title={`Propiedad de ${owner.name}`}>
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: owner.color }}></span>
                                <span className="text-xs text-slate-400 truncate">{owner.name}</span>
                            </div>
                        )}
                        <p className="text-slate-400 text-sm mt-1">{credit.subcategory} · TAE: {credit.tae}%</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <button onClick={() => onEdit(credit)} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors"><IconPencil className="w-5 h-5"/></button>
                        <button onClick={() => onDelete(credit)} className="text-slate-400 hover:text-danger p-1.5 rounded-full hover:bg-slate-700 transition-colors"><IconTrash className="w-5 h-5"/></button>
                    </div>
                </div>

                <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-baseline">
                        <div>
                            <p className="text-sm text-slate-400">Cuota mensual</p>
                            <p className="text-2xl font-bold text-primary">€{credit.monthlyPayment.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-400">Restante</p>
                            <p className="text-lg font-semibold text-white">€{remainingAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    <ProgressBar value={progress} colorClass="bg-primary" />
                    <p className="text-xs text-slate-500 text-right">de €{credit.totalAmount.toFixed(2)}</p>
                </div>
                 {credit.notes && (
                    <div className="mt-3 text-xs text-slate-400 bg-slate-700/50 p-3 rounded-md">
                        <p className="font-semibold text-slate-300 mb-1">Notas:</p>
                        <p className="whitespace-pre-wrap">{credit.notes}</p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50 min-h-[90px] flex flex-col justify-center">
                 {isAnalyzing ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400 animate-pulse">Analizando...</p>
                    </div>
                ) : credit.toxicityReport ? (
                    <InteractiveToxicityReport 
                        report={credit.toxicityReport}
                        onReanalyze={handleAnalyze}
                        onDelete={handleDeleteAnalysis}
                    />
                ) : (
                    <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full" variant="ghost">
                        <div className="flex items-center justify-center gap-2">
                           <IconSparkles className="w-5 h-5 text-primary"/> 
                           {'Analizar Toxicidad (IA)'}
                        </div>
                    </Button>
                )}
            </div>
        </Card>
    );
};

const AddCreditModal: React.FC<{ isOpen: boolean; onClose: () => void; creditToEdit: Credit | null; }> = ({ isOpen, onClose, creditToEdit }) => {
    const { addCredit, updateCredit, activeView, users, groupMembers } = useApp();
    
    const getInitialState = () => ({
        name: '', totalAmount: '', monthlyPayment: '', tin: '', tae: '', startDate: '', endDate: '',
        subcategory: CREDIT_SUBCATEGORIES[0] as CreditSubcategory,
        notes: '',
        ownerId: '',
    });

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if (!isOpen) return;

        if (creditToEdit) {
            setFormData({
                name: creditToEdit.name,
                totalAmount: String(creditToEdit.totalAmount),
                monthlyPayment: String(creditToEdit.monthlyPayment),
                tin: String(creditToEdit.tin),
                tae: String(creditToEdit.tae),
                startDate: creditToEdit.startDate.split('T')[0],
                endDate: creditToEdit.endDate.split('T')[0],
                subcategory: creditToEdit.subcategory,
                notes: creditToEdit.notes || '',
                ownerId: creditToEdit.ownerId || '', // Editing doesn't change owner
            });
        } else {
            const initialState = getInitialState();
            if (activeView.type === 'user') {
                initialState.ownerId = activeView.id;
            } else if (activeView.type === 'group' && groupMembers.length > 0) {
                initialState.ownerId = groupMembers[0].id;
            } else if (users.length > 0) {
                initialState.ownerId = users[0].id;
            }
            setFormData(initialState);
        }
    }, [creditToEdit, isOpen, activeView, users, groupMembers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const creditData = {
            name: formData.name,
            totalAmount: parseFloat(formData.totalAmount),
            monthlyPayment: parseFloat(formData.monthlyPayment),
            tin: parseFloat(formData.tin),
            tae: parseFloat(formData.tae),
            startDate: formData.startDate,
            endDate: formData.endDate,
            subcategory: formData.subcategory as CreditSubcategory,
            notes: formData.notes || undefined,
        };

        if(creditToEdit){
            updateCredit({ ...creditData, id: creditToEdit.id, ownerId: creditToEdit.ownerId });
        } else {
            addCredit(creditData, formData.ownerId || users[0].id);
        }
        
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={creditToEdit ? 'Editar Crédito' : 'Añadir Nuevo Crédito'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!creditToEdit && activeView.type === 'group' && (
                    <div>
                        <label htmlFor="ownerId" className="block text-sm font-medium text-slate-400 mb-1">Propietario</label>
                        <select
                            id="ownerId"
                            name="ownerId"
                            value={formData.ownerId}
                            onChange={handleChange}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                            required
                        >
                            {groupMembers.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <Input label="Nombre del crédito" name="name" value={formData.name} onChange={handleChange} required />
                
                <div>
                    <label htmlFor="subcategory" className="block text-sm font-medium text-slate-400 mb-1">Subcategoría</label>
                    <select
                        id="subcategory"
                        name="subcategory"
                        value={formData.subcategory}
                        onChange={handleChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                        required
                    >
                        {CREDIT_SUBCATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                </div>

                <Input label="Importe total (€)" name="totalAmount" type="number" value={formData.totalAmount} onChange={handleChange} required />
                <Input label="Cuota mensual (€)" name="monthlyPayment" type="number" value={formData.monthlyPayment} onChange={handleChange} required />
                <Input label="TIN (%)" name="tin" type="number" step="0.01" value={formData.tin} onChange={handleChange} required />
                <Input label="TAE (%)" name="tae" type="number" step="0.01" value={formData.tae} onChange={handleChange} required />
                <Input label="Fecha de inicio" name="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
                <Input label="Fecha de finalización" name="endDate" type="date" value={formData.endDate} onChange={handleChange} required />
                <Textarea label="Notas (Opcional)" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
                <div className="flex justify-end pt-4">
                    <Button type="submit">{creditToEdit ? 'Guardar Cambios' : 'Añadir Crédito'}</Button>
                </div>
            </form>
        </Modal>
    );
};

type SortKey = keyof Credit | 'remainingAmount' | 'ratio';

const CreditsPage: React.FC = () => {
    const { credits, deleteCredit, users, activeView, simulatedLiquidationIds, toggleSimulatedLiquidation } = useApp();
    const location = useLocation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creditToEdit, setCreditToEdit] = useState<Credit | null>(null);
    const [creditToDelete, setCreditToDelete] = useState<Credit | null>(null);
    const [view, setView] = useState<'cards' | 'loans' | 'list' | 'analysis' | 'liquidate'>('cards');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'ratio', direction: 'descending' });
    const [isAdvisorModalOpen, setIsAdvisorModalOpen] = useState(false);

    // Global sorting and method state
    const [globalSortKey, setGlobalSortKey] = useState<SortKeyType>('capital');
    const [globalSortDir, setGlobalSortDir] = useState<'asc' | 'desc'>('desc');
    const [globalMethod, setGlobalMethod] = useState<MethodType>(null);

    // Local state for the Liquidar tab simulation
    const [liquidationSimulationIds, setLiquidationSimulationIds] = useState<Set<string>>(new Set());

    const toggleLiquidationSimulation = (id: string) => {
        setLiquidationSimulationIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam === 'loans' || viewParam === 'list' || viewParam === 'cards' || viewParam === 'analysis' || viewParam === 'liquidate') {
            setView(viewParam as any);
        }
    }, [location.search]);

    const handleOpenAddModal = () => {
        setCreditToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (credit: Credit) => {
        setCreditToEdit(credit);
        setIsModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (creditToDelete) {
            deleteCredit(creditToDelete.id);
            setCreditToDelete(null);
        }
    };

    const sortedCreditsData = useMemo(() => {
        let sortableItems = [...credits];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let valA: any;
                let valB: any;

                switch (sortConfig.key) {
                    case 'ratio':
                        valA = a.toxicityReport?.score && a.toxicityReport.score > 0 ? a.toxicityReport.score : -1;
                        valB = b.toxicityReport?.score && b.toxicityReport.score > 0 ? b.toxicityReport.score : -1;
                        break;
                    case 'remainingAmount':
                        valA = calculateRemainingAmount(a);
                        valB = calculateRemainingAmount(b);
                        break;
                    default:
                        const key = sortConfig.key as keyof Credit;
                        valA = a[key];
                        valB = b[key];
                        break;
                }

                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        if (sortConfig?.key === 'ratio' && sortConfig?.direction === 'descending') {
            return sortableItems.reverse();
        }
        return sortableItems;
    }, [credits, sortConfig]);
    
    const cardViewCredits = useMemo(() => credits.filter(c => c.subcategory === 'Tarjeta'), [credits]);
    const loanViewCredits = useMemo(() => credits.filter(c => c.subcategory !== 'Tarjeta'), [credits]);


    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        if (sortConfig.direction === 'ascending') return <IconArrowUp className="w-4 h-4 ml-1 inline-block" />;
        return <IconArrowDown className="w-4 h-4 ml-1 inline-block" />;
    };

    const renderListView = () => (
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="p-3 cursor-pointer w-24 text-center" onClick={() => requestSort('ratio')}>Ratio {getSortIcon('ratio')}</th>
                            <th className="p-3 cursor-pointer" onClick={() => requestSort('name')}>Nombre {getSortIcon('name')}</th>
                            {activeView.type === 'group' && <th className="p-3">Propietario</th>}
                            <th className="p-3 cursor-pointer" onClick={() => requestSort('subcategory')}>Subcategoría {getSortIcon('subcategory')}</th>
                            <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('monthlyPayment')}>Cuota Mensual {getSortIcon('monthlyPayment')}</th>
                            <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('tin')}>TIN {getSortIcon('tin')}</th>
                            <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('tae')}>TAE {getSortIcon('tae')}</th>
                            <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('totalAmount')}>Total {getSortIcon('totalAmount')}</th>
                            <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('remainingAmount')}>Restante {getSortIcon('remainingAmount')}</th>
                            <th className="p-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCreditsData.map(credit => (
                            <tr key={credit.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-3">
                                    <div className="flex justify-center">
                                       <CreditRatio credit={credit} />
                                    </div>
                                </td>
                                <td className="p-3 font-semibold">{credit.name}</td>
                                {activeView.type === 'group' && (
                                    <td className="p-3">
                                        {(() => {
                                            const owner = users.find(u => u.id === credit.ownerId);
                                            if (!owner) return '-';
                                            return (
                                                <div className="flex items-center gap-2" title={owner.name}>
                                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: owner.color }}></span>
                                                    <span className="text-sm truncate">{owner.name}</span>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                )}
                                <td className="p-3">{credit.subcategory}</td>
                                <td className="p-3 text-right">€{credit.monthlyPayment.toFixed(2)}</td>
                                <td className="p-3 text-right">{credit.tin.toFixed(2)}%</td>
                                <td className="p-3 text-right">{credit.tae.toFixed(2)}%</td>
                                <td className="p-3 text-right">€{credit.totalAmount.toFixed(2)}</td>
                                <td className="p-3 text-right font-bold">€{calculateRemainingAmount(credit).toFixed(2)}</td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => handleOpenEditModal(credit)} className="text-slate-400 hover:text-white"><IconPencil className="w-5 h-5"/></button>
                                        <button onClick={() => setCreditToDelete(credit)} className="text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <h1 className="text-3xl font-bold text-white">Gestión de Créditos</h1>
                <div className="flex gap-2">
                    <Button onClick={() => setIsAdvisorModalOpen(true)} variant="secondary">
                        <IconSparkles className="w-5 h-5 mr-2" /> Consultar al Asistente IA
                    </Button>
                    <Button onClick={handleOpenAddModal}><IconPlus className="w-5 h-5 mr-2" /> Añadir Crédito</Button>
                </div>
            </div>

            {/* Using the global simulatedLiquidationIds directly inside DebtRatioSummary now */}
            <DebtRatioSummary simulatedPaidIds={simulatedLiquidationIds} />
            
            <CreditsSummary simulatedPaidIds={simulatedLiquidationIds} />

            {/* DebtBarChart connects to global context internally via useApp hook updates in its implementation, 
                but for clarity we pass the global toggle. The component implementation was updated to use context.
            */}
            <DebtBarChart 
                sortKey={globalSortKey}
                sortDir={globalSortDir}
                onSortChange={(k, d) => { setGlobalSortKey(k); setGlobalSortDir(d); }}
                activeMethod={globalMethod}
                onMethodChange={setGlobalMethod}
            />

             <div className="border-b border-slate-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto no-scrollbar">
                    <button onClick={() => setView('cards')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'cards' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Tarjetas</button>
                    <button onClick={() => setView('loans')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'loans' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Préstamos</button>
                    <button onClick={() => setView('list')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Lista</button>
                    <button onClick={() => setView('analysis')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'analysis' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Análisis de Deuda</button>
                    <button onClick={() => setView('liquidate')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'liquidate' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'} flex items-center gap-2`}><IconScale className="w-4 h-4"/> Liquidar</button>
                </nav>
            </div>
            {credits.length > 0 ? (
                <>
                    {view === 'list' && renderListView()}
                    {view === 'cards' && (
                        cardViewCredits.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {cardViewCredits.map(credit => <CreditCard key={credit.id} credit={credit} onEdit={handleOpenEditModal} onDelete={setCreditToDelete} />)}
                            </div>
                        ) : (
                            <Card className="text-center py-12">
                                <p className="text-slate-400">No tienes tarjetas de crédito registradas.</p>
                                <Button onClick={handleOpenAddModal} className="mt-4">Añadir Tarjeta</Button>
                            </Card>
                        )
                    )}
                    {view === 'loans' && (
                        loanViewCredits.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {loanViewCredits.map(credit => <CreditCard key={credit.id} credit={credit} onEdit={handleOpenEditModal} onDelete={setCreditToDelete} />)}
                            </div>
                        ) : (
                            <Card className="text-center py-12">
                                <p className="text-slate-400">No tienes préstamos registrados.</p>
                                <Button onClick={handleOpenAddModal} className="mt-4">Añadir Préstamo</Button>
                            </Card>
                        )
                    )}
                    {view === 'analysis' && (
                        credits.length > 0 ? (
                            <DebtAnalysisView credits={credits} />
                        ) : (
                            <Card className="text-center py-12">
                                <p className="text-slate-400">No tienes créditos registrados para analizar.</p>
                                <Button onClick={handleOpenAddModal} className="mt-4">Añadir tu primer crédito</Button>
                            </Card>
                        )
                    )}
                    {view === 'liquidate' && (
                        credits.length > 0 ? (
                            <DebtLiquidationView 
                                credits={credits} 
                                sortKey={globalSortKey}
                                sortDir={globalSortDir}
                                onSortChange={(k, d) => { setGlobalSortKey(k); setGlobalSortDir(d); }}
                                activeMethod={globalMethod}
                                onMethodChange={setGlobalMethod}
                                liquidationSimulationIds={liquidationSimulationIds}
                                toggleLiquidationSimulation={toggleLiquidationSimulation}
                                simulatedLiquidationIds={simulatedLiquidationIds}
                                toggleSimulatedLiquidation={toggleSimulatedLiquidation}
                            />
                        ) : (
                            <Card className="text-center py-12">
                                <p className="text-slate-400">No tienes créditos activos para liquidar.</p>
                            </Card>
                        )
                    )}
                </>
            ) : (
                <Card className="text-center py-12">
                    <p className="text-slate-400">No tienes créditos registrados.</p>
                    <Button onClick={handleOpenAddModal} className="mt-4">Añadir tu primer crédito</Button>
                </Card>
            )}
            <AddCreditModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} creditToEdit={creditToEdit} />
            <DebtAdvisorModal isOpen={isAdvisorModalOpen} onClose={() => setIsAdvisorModalOpen(false)} />
            <ConfirmationModal
                isOpen={!!creditToDelete}
                onClose={() => setCreditToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar el crédito <span className="font-bold">{creditToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción también eliminará la transacción de gasto mensual asociada. Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
};

export default CreditsPage;