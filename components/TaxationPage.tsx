
import React, { useState, useRef, ReactNode, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card, Button, Input, ConfirmationModal, Modal } from './common/UIComponents.tsx';
import { TaxDraftData, TaxQuestionnaire, TaxCalculationResult, ReceiptType, SavedTaxReturn, ChatMessage, InvestmentTransaction, InvestmentType } from '../types.ts';
import { extractDataFromTaxPDF, getTaxAdvice, getTaxPlanningAdvice, getInvestmentTaxAdvice } from '../services/geminiService.ts';
import { IconScale, IconSparkles, IconUpload, IconArrowDown, IconArrowUp, IconTrash, IconEye, IconPencil, IconPlus, IconRefresh, IconPiggyBank, IconShield, IconInformationCircle, IconBriefcase } from '../constants.tsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AUTONOMOUS_COMMUNITIES = ["Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria", "Castilla-La Mancha", "Castilla y León", "Cataluña", "Comunidad Valenciana", "Extremadura", "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja", "Ceuta", "Melilla"];

const INVESTMENT_TYPES: Record<InvestmentType, string> = {
    'Stock': 'Acciones',
    'ETF': 'ETF',
    'Crypto': 'Criptomonedas',
    'Fund': 'Fondos de Inversión',
    'RealEstate': 'Inmobiliario',
    'Other': 'Otros'
};

// --- Helper Components ---

const AccordionSection: React.FC<{ title: string; children: ReactNode; isOpen: boolean; onToggle: () => void; }> = ({ title, children, isOpen, onToggle }) => (
    <div className="border-b border-slate-700">
        <h2>
            <button type="button" onClick={onToggle} className="flex items-center justify-between w-full p-4 font-medium text-left text-slate-300 hover:bg-slate-700/50">
                <span>{title}</span>
                {isOpen ? <IconArrowUp className="w-5 h-5"/> : <IconArrowDown className="w-5 h-5"/>}
            </button>
        </h2>
        {isOpen && <div className="p-4 border-t border-slate-700">{children}</div>}
    </div>
);

const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

// --- Tax Tips Component ---

const TaxTipsSection: React.FC = () => {
    const tips = [
        {
            title: "Transferencias y Límites de Vigilancia",
            icon: IconPiggyBank,
            content: "Hacienda vigila de cerca los movimientos de efectivo. Los bancos están obligados a notificar automáticamente:\n*   Transferencias superiores a **10.000€**.\n*   Préstamos o créditos superiores a **6.000€**.\n\n**Consejo:** Aunque el límite automático es alto, los movimientos recurrentes superiores a **3.000€** o el ingreso de billetes de 500€ suelen activar alarmas internas de 'sospecha' en los bancos."
        },
        {
            title: "Tributación: Solo por lo Retirado (Plusvalía)",
            icon: IconScale,
            content: "Es un mito común pensar que pagas impuestos por lo que *tienes*. En realidad, en la mayoría de inversiones financieras (acciones, cripto, fondos), solo tributas cuando **realizas** la ganancia (vendes).\n\n*   **Diferimiento:** Mientras no vendas, no pagas (interés compuesto bruto).\n*   **Excepción:** El Impuesto de Patrimonio (para patrimonios netos muy altos, >700k€ habitualmente)."
        },
        {
            title: "Ventaja Única de los Fondos de Inversión",
            icon: IconSparkles,
            content: "España tiene una ventaja fiscal única en Europa para los **Fondos de Inversión** (no aplica a ETFs ni Acciones): el **Traspaso**.\n\nPuedes mover tu dinero del Fondo A al Fondo B sin tributar por la plusvalía acumulada en el camino. Solo pagarás impuestos el día que decidas reembolsar el dinero a tu cuenta corriente. Esto permite maximizar el interés compuesto durante décadas."
        },
        {
            title: "EEUU y el Intercambio de Información (CRS vs FATCA)",
            icon: IconShield,
            content: "La mayoría de países comparten datos fiscales automáticamente bajo el estándar CRS (*Common Reporting Standard*). **EEUU NO firma el CRS**, sino que usa su propio tratado (FATCA).\n\n*   **¿Qué significa?** EEUU recibe información de todo el mundo, pero es más receloso enviando información automática de cuentas bancarias de no residentes a países como España, a menos que haya una investigación específica. \n*   **Ojo:** Esto no te exime de declarar tus bienes (Modelo 720) si superas los límites legales."
        },
        {
            title: "La Regla de los 2 Meses (Anti-aplicación)",
            icon: IconInformationCircle,
            content: "Si vendes una acción con pérdidas para compensar ganancias fiscales, **NO puedes volver a comprar** esas mismas acciones (o activos homogéneos) en los **2 meses anteriores o posteriores** a la venta.\n\nSi lo haces, Hacienda bloqueará esa pérdida y no podrás usarla para reducir tus impuestos hasta que vendas definitivamente las acciones recompradas."
        },
        {
            title: "Modelo 720: Bienes en el Extranjero",
            icon: IconBriefcase,
            content: "Si tienes bienes en el extranjero (Cuentas, Valores/Acciones/Cripto en exchanges extranjeros, o Inmuebles) y el valor conjunto de cualquiera de estos 3 grupos supera los **50.000€**, estás obligado a presentar el Modelo 720 (informativo) antes del 31 de marzo. Las sanciones por no hacerlo, aunque moderadas por la justicia europea recientemente, siguen existiendo."
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tips.map((tip, index) => (
                <Card key={index} className="border-l-4 border-primary/50 h-full">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-slate-700/50 rounded-lg flex-shrink-0 text-primary">
                            <tip.icon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">{tip.title}</h3>
                            <div className="text-slate-300 text-sm leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{tip.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

// --- Investment Components ---

const AddInvestmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    investmentToEdit: InvestmentTransaction | null;
}> = ({ isOpen, onClose, investmentToEdit }) => {
    const { addInvestmentTransaction, updateInvestmentTransaction, activeView, users, groupMembers } = useApp();
    const [mode, setMode] = useState<'detailed' | 'simple'>('detailed');
    const [formData, setFormData] = useState({
        type: 'Stock' as InvestmentType,
        name: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchaseAmount: '',
        isSold: false,
        saleDate: '',
        saleAmount: '',
        expenses: '',
        ownerId: '',
        manualProfit: '' // For simple mode
    });

    useEffect(() => {
        if (isOpen) {
            setMode('detailed'); // Default to detailed
            if (investmentToEdit) {
                // Detect if it was created via simple mode (heuristics: isSold true, expenses 0, and either purchase or sale is 0)
                const profit = (investmentToEdit.saleAmount || 0) - investmentToEdit.purchaseAmount - (investmentToEdit.expenses || 0);
                const isSimpleCandidate = investmentToEdit.isSold && (investmentToEdit.purchaseAmount === 0 || investmentToEdit.saleAmount === 0);
                
                if (isSimpleCandidate) {
                    setMode('simple');
                }

                setFormData({
                    type: investmentToEdit.type,
                    name: investmentToEdit.name,
                    purchaseDate: investmentToEdit.purchaseDate,
                    purchaseAmount: String(investmentToEdit.purchaseAmount),
                    isSold: investmentToEdit.isSold,
                    saleDate: investmentToEdit.saleDate || '',
                    saleAmount: investmentToEdit.saleAmount ? String(investmentToEdit.saleAmount) : '',
                    expenses: investmentToEdit.expenses ? String(investmentToEdit.expenses) : '',
                    ownerId: investmentToEdit.ownerId || '',
                    manualProfit: String(profit)
                });
            } else {
                let defaultOwner = '';
                if (activeView.type === 'user') defaultOwner = activeView.id;
                else if (activeView.type === 'group' && groupMembers.length > 0) defaultOwner = groupMembers[0].id;
                else if (users.length > 0) defaultOwner = users[0].id;

                setFormData({
                    type: 'Stock',
                    name: '',
                    purchaseDate: new Date().toISOString().split('T')[0],
                    purchaseAmount: '',
                    isSold: false,
                    saleDate: '',
                    saleAmount: '',
                    expenses: '',
                    ownerId: defaultOwner,
                    manualProfit: ''
                });
            }
        }
    }, [isOpen, investmentToEdit, activeView, users, groupMembers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let data;

        if (mode === 'simple') {
            const profit = parseFloat(formData.manualProfit);
            // Logic for simple mode:
            // If profit > 0: Sale = Profit, Purchase = 0
            // If profit < 0: Sale = 0, Purchase = |Profit|
            const isGain = profit >= 0;
            data = {
                type: formData.type,
                name: formData.name,
                // Use purchaseDate as the date of operation for simple mode
                purchaseDate: formData.purchaseDate, 
                saleDate: formData.purchaseDate,
                isSold: true,
                expenses: 0,
                purchaseAmount: isGain ? 0 : Math.abs(profit),
                saleAmount: isGain ? profit : 0,
            };
        } else {
            data = {
                type: formData.type,
                name: formData.name,
                purchaseDate: formData.purchaseDate,
                purchaseAmount: parseFloat(formData.purchaseAmount),
                isSold: formData.isSold,
                saleDate: formData.isSold ? formData.saleDate : undefined,
                saleAmount: formData.isSold ? parseFloat(formData.saleAmount) : undefined,
                expenses: formData.expenses ? parseFloat(formData.expenses) : 0,
            };
        }

        if (investmentToEdit) {
            updateInvestmentTransaction({ ...data, id: investmentToEdit.id, ownerId: investmentToEdit.ownerId });
        } else {
            addInvestmentTransaction(data, formData.ownerId);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={investmentToEdit ? "Editar Inversión" : "Declarar Inversión"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex mb-4 bg-slate-700 rounded-lg p-1">
                    <button 
                        type="button"
                        onClick={() => setMode('detailed')} 
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'detailed' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Detallado
                    </button>
                    <button 
                        type="button"
                        onClick={() => setMode('simple')} 
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'simple' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Simple (Solo Beneficio)
                    </button>
                </div>

                {!investmentToEdit && activeView.type === 'group' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Propietario</label>
                        <select
                            value={formData.ownerId}
                            onChange={(e) => setFormData({...formData, ownerId: e.target.value})}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100"
                            required
                        >
                            {groupMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Activo</label>
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value as InvestmentType})}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100"
                    >
                        {Object.entries(INVESTMENT_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
                <Input label="Nombre / Ticker (ej. BTC, S&P500)" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                
                {mode === 'simple' ? (
                    <>
                        <Input label="Fecha de la Operación" type="date" value={formData.purchaseDate} onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})} required />
                        <Input 
                            label="Beneficio/Pérdida Total (€)" 
                            type="number" 
                            step="0.01" 
                            value={formData.manualProfit} 
                            onChange={(e) => setFormData({...formData, manualProfit: e.target.value})} 
                            required 
                            helperText="Introduce el resultado final. Usa números negativos para pérdidas (ej: -50)."
                        />
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Fecha Compra" type="date" value={formData.purchaseDate} onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})} required />
                            <Input label="Inversión Inicial (€)" type="number" step="0.01" value={formData.purchaseAmount} onChange={(e) => setFormData({...formData, purchaseAmount: e.target.value})} required />
                        </div>
                        
                        <div className="border-t border-slate-700 pt-4">
                            <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    checked={formData.isSold}
                                    onChange={(e) => setFormData({...formData, isSold: e.target.checked})}
                                    className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"
                                />
                                <span className="text-slate-300 font-semibold">Activo Vendido / Liquidado</span>
                            </label>
                        </div>

                        {formData.isSold && (
                            <div className="grid grid-cols-2 gap-4 bg-slate-700/30 p-3 rounded-md border border-slate-600">
                                <Input label="Fecha Venta" type="date" value={formData.saleDate} onChange={(e) => setFormData({...formData, saleDate: e.target.value})} required />
                                <Input label="Valor de Venta (€)" type="number" step="0.01" value={formData.saleAmount} onChange={(e) => setFormData({...formData, saleAmount: e.target.value})} required />
                                <div className="col-span-2">
                                    <Input label="Gastos/Comisiones Totales (€)" type="number" step="0.01" value={formData.expenses} onChange={(e) => setFormData({...formData, expenses: e.target.value})} helperText="Sumar comisiones de compra y venta" />
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar</Button>
                </div>
            </form>
        </Modal>
    );
};

const InvestmentTaxManager: React.FC = () => {
    const { investmentTransactions, deleteInvestmentTransaction } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [investmentToEdit, setInvestmentToEdit] = useState<InvestmentTransaction | null>(null);
    const [investmentToDelete, setInvestmentToDelete] = useState<InvestmentTransaction | null>(null);
    
    // AI Advisor State
    const [aiAdvice, setAiAdvice] = useState('');
    const [isAdvising, setIsAdvising] = useState(false);

    // Calculations
    const summary = useMemo(() => {
        let totalInvested = 0;
        let totalSoldValue = 0;
        let totalRealizedProfit = 0;
        let realizedProfitsOnly = 0; // Only positive gains
        let realizedLossesOnly = 0;  // Only losses

        investmentTransactions.forEach(inv => {
            totalInvested += inv.purchaseAmount;
            if (inv.isSold && (inv.saleAmount !== undefined)) {
                totalSoldValue += inv.saleAmount;
                const profit = inv.saleAmount - inv.purchaseAmount - (inv.expenses || 0);
                totalRealizedProfit += profit;
                if (profit > 0) realizedProfitsOnly += profit;
                else realizedLossesOnly += Math.abs(profit);
            }
        });

        return { totalInvested, totalSoldValue, totalRealizedProfit, realizedProfitsOnly, realizedLossesOnly };
    }, [investmentTransactions]);

    const taxCalculation = useMemo(() => {
        // Spanish Savings Tax Brackets (Simplified for 2024/25 general regime)
        // Up to 6,000: 19%
        // 6,000 - 50,000: 21%
        // 50,000 - 200,000: 23%
        // 200,000 - 300,000: 27%
        // > 300,000: 28%

        let taxableBase = Math.max(0, summary.totalRealizedProfit);
        let remainingBase = taxableBase;
        let totalTax = 0;
        
        const brackets = [
            { limit: 6000, rate: 0.19 },
            { limit: 50000, rate: 0.21 }, // 50k - 6k = 44k width
            { limit: 200000, rate: 0.23 },
            { limit: 300000, rate: 0.27 },
            { limit: Infinity, rate: 0.28 }
        ];

        const breakdown = [];
        let previousLimit = 0;

        for (const bracket of brackets) {
            if (remainingBase <= 0) break;
            
            const width = bracket.limit - previousLimit;
            const taxableInBracket = Math.min(remainingBase, width);
            const taxInBracket = taxableInBracket * bracket.rate;
            
            breakdown.push({
                rate: bracket.rate * 100,
                base: taxableInBracket,
                tax: taxInBracket
            });

            totalTax += taxInBracket;
            remainingBase -= taxableInBracket;
            previousLimit = bracket.limit;
        }

        return { totalTax, breakdown, taxableBase };
    }, [summary]);

    const handleGetAdvice = async () => {
        setIsAdvising(true);
        try {
            const advice = await getInvestmentTaxAdvice(JSON.stringify(investmentTransactions), taxCalculation.totalTax);
            setAiAdvice(advice);
        } catch (error) {
            console.error(error);
        } finally {
            setIsAdvising(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-800/80 border border-slate-700 text-center">
                    <p className="text-sm text-slate-400">Total Invertido (Histórico)</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalInvested)}</p>
                </Card>
                <Card className="bg-slate-800/80 border border-slate-700 text-center">
                    <p className="text-sm text-slate-400">Valor Vendido / Retirado</p>
                    <p className="text-2xl font-bold text-info">{formatCurrency(summary.totalSoldValue)}</p>
                </Card>
                <Card className="bg-slate-800/80 border border-slate-700 text-center">
                    <p className="text-sm text-slate-400">Beneficio Neto Realizado</p>
                    <p className={`text-3xl font-bold ${summary.totalRealizedProfit >= 0 ? 'text-secondary' : 'text-danger'}`}>
                        {formatCurrency(summary.totalRealizedProfit)}
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tax Calculation Card */}
                <Card className="border-l-4 border-danger/50">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <IconScale className="w-6 h-6 text-slate-300" />
                        Estimación Impuestos Ahorro
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg">
                            <span className="text-slate-300">Base Imponible del Ahorro</span>
                            <span className="font-bold text-white text-lg">{formatCurrency(taxCalculation.taxableBase)}</span>
                        </div>
                        
                        {taxCalculation.breakdown.length > 0 ? (
                            <div className="space-y-1 text-sm">
                                <p className="text-xs text-slate-500 mb-2">Desglose por tramos:</p>
                                {taxCalculation.breakdown.map((b, i) => (
                                    <div key={i} className="flex justify-between border-b border-slate-700 pb-1">
                                        <span>Tramo {b.rate}% ({formatCurrency(b.base)})</span>
                                        <span className="font-mono text-danger">{formatCurrency(b.tax)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic text-center py-2">No hay beneficios sujetos a tributación.</p>
                        )}

                        <div className="pt-4 border-t border-slate-600 flex justify-between items-center">
                            <span className="text-lg font-bold text-slate-200">Total a Pagar (Estimado)</span>
                            <span className="text-2xl font-bold text-danger">{formatCurrency(taxCalculation.totalTax)}</span>
                        </div>
                    </div>
                </Card>

                {/* AI Optimization Card */}
                <Card className="border-l-4 border-primary/50 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <IconSparkles className="w-6 h-6 text-primary" />
                        Optimizador Fiscal IA
                    </h3>
                    <div className="flex-grow">
                        {aiAdvice ? (
                            <div className="prose prose-sm prose-invert max-w-none max-h-60 overflow-y-auto pr-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAdvice}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                                <p className="mb-4">Analiza tu cartera para encontrar formas legales de reducir tu factura fiscal (compensación de pérdidas, etc.).</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 text-right">
                        <Button onClick={handleGetAdvice} disabled={isAdvising} variant="ghost" className="w-full border border-primary/30 hover:bg-primary/10">
                            {isAdvising ? 'Analizando...' : (aiAdvice ? 'Actualizar Consejo' : 'Consultar Asesor IA')}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Investments List */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Mis Inversiones Declaradas</h3>
                    <Button size="sm" onClick={() => { setInvestmentToEdit(null); setIsModalOpen(true); }}>
                        <IconPlus className="w-4 h-4 mr-2"/> Añadir
                    </Button>
                </div>
                
                {investmentTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-700/50">
                                <tr>
                                    <th className="p-3">Activo</th>
                                    <th className="p-3">Tipo</th>
                                    <th className="p-3 text-right">Inversión</th>
                                    <th className="p-3 text-center">Estado</th>
                                    <th className="p-3 text-right">Resultado</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {investmentTransactions.map(inv => {
                                    const profit = inv.isSold ? (inv.saleAmount || 0) - inv.purchaseAmount - (inv.expenses || 0) : 0;
                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-700/30">
                                            <td className="p-3 font-medium text-white">{inv.name}</td>
                                            <td className="p-3 text-slate-300">{INVESTMENT_TYPES[inv.type]}</td>
                                            <td className="p-3 text-right font-mono text-slate-300">{formatCurrency(inv.purchaseAmount)}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs ${inv.isSold ? 'bg-slate-600 text-slate-300' : 'bg-secondary/20 text-secondary'}`}>
                                                    {inv.isSold ? 'Vendido' : 'Activo'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {inv.isSold ? (
                                                    <span className={profit >= 0 ? 'text-secondary' : 'text-danger'}>
                                                        {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => { setInvestmentToEdit(inv); setIsModalOpen(true); }} className="text-slate-400 hover:text-white"><IconPencil className="w-4 h-4"/></button>
                                                    <button onClick={() => setInvestmentToDelete(inv)} className="text-slate-400 hover:text-danger"><IconTrash className="w-4 h-4"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-8">No hay inversiones registradas.</p>
                )}
            </Card>

            <AddInvestmentModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                investmentToEdit={investmentToEdit} 
            />
            
            <ConfirmationModal
                isOpen={!!investmentToDelete}
                onClose={() => setInvestmentToDelete(null)}
                onConfirm={() => {
                    if (investmentToDelete) deleteInvestmentTransaction(investmentToDelete.id);
                    setInvestmentToDelete(null);
                }}
                title="Eliminar Inversión"
            >
                <p>¿Estás seguro de que deseas eliminar este registro? Esto afectará a los cálculos fiscales.</p>
            </ConfirmationModal>
        </div>
    );
};

// --- Original Components (Tax Planning Advisor, etc.) kept below ---

const TaxPlanningAdvisor: React.FC = () => {
    const { transactions, credits, goals, receipts, insurancePolicies, propertyInvestments } = useApp();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: crypto.randomUUID(), role: 'model', text: '¡Hola! Soy tu asesor de planificación fiscal. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre estrategias para optimizar tus impuestos, las ventajas de ser autónomo o crear una empresa, o cómo planificar tu futuro fiscal.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (prompt?: string) => {
        const currentQuery = prompt || input;
        if (!currentQuery.trim() || isLoading) return;

        const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: currentQuery };
        setMessages(prev => [...prev, userMessage, { id: crypto.randomUUID(), role: 'model', text: '', isLoading: true }]);
        setInput('');
        setIsLoading(true);

        const chatHistory = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const financialData = JSON.stringify({
            transactions,
            credits,
            goals,
            receipts,
            insurancePolicies,
            propertyInvestments
        }, null, 2);

        try {
            const result = await getTaxPlanningAdvice(currentQuery, financialData, chatHistory);
            setMessages(prev => prev.slice(0, -1).concat({ id: crypto.randomUUID(), role: 'model', text: result }));
        } catch (error) {
            console.error("Error communicating with Tax Planning AI:", error);
            const errorMessage = "Lo siento, ha ocurrido un error al generar la respuesta. Por favor, inténtalo de nuevo.";
            setMessages(prev => prev.slice(0, -1).concat({ id: crypto.randomUUID(), role: 'model', text: errorMessage }));
        } finally {
            setIsLoading(false);
        }
    };
    
    const promptStarters = [
        "¿Me conviene más ser autónomo o crear una S.L.?",
        "¿Cómo puedo optimizar el IRPF con mis inversiones actuales?",
        "Explícame las ventajas fiscales de un plan de pensiones.",
        "¿Qué deducciones puedo aplicar si trabajo desde casa?",
    ];

    return (
        <Card>
            <h2 className="text-2xl font-bold text-white mb-4">Asesor de Planificación Fiscal IA</h2>
            <p className="text-slate-400 mb-4">Usa este asistente para explorar estrategias fiscales, entender conceptos complejos y planificar tu futuro financiero. Proporciona un contexto claro en tus preguntas para obtener la mejor respuesta.</p>
            
            <div className="flex flex-wrap gap-2 mb-6">
                {promptStarters.map(prompt => (
                    <Button key={prompt} variant="ghost" size="sm" onClick={() => handleSendMessage(prompt)} disabled={isLoading}>
                        {prompt}
                    </Button>
                ))}
            </div>

            <div className="bg-slate-900/50 rounded-lg border border-slate-700 h-[50vh] flex flex-col">
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map(msg => (
                         <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <IconSparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />}
                            <div className={`max-w-xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-primary text-black' : 'bg-slate-700 text-slate-200'}`}>
                                {msg.isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                ) : (
                                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-0">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                     <div ref={messagesEndRef} />
                </div>
                 <div className="p-4 border-t border-slate-700">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-2">
                        <Input
                            label=""
                            id="tax-planning-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu consulta fiscal aquí..."
                            className="flex-grow !mb-0"
                            disabled={isLoading}
                        />
                        <Button type="submit" disabled={isLoading || !input.trim()}>Enviar</Button>
                    </form>
                </div>
            </div>
        </Card>
    );
};


const TaxationPage: React.FC = () => {
    const { receipts, savedTaxReturns, addSavedTaxReturn, deleteSavedTaxReturn } = useApp();
    
    // View management
    const [activeTab, setActiveTab] = useState<'simulator' | 'investments' | 'history' | 'planning' | 'tips'>('simulator');
    const [view, setView] = useState<'form' | 'results' | 'history_list' | 'history_detail'>('form');

    // Simulator state
    const [step, setStep] = useState(1); // 1: Upload, 2: Questionnaire
    const [draftData, setDraftData] = useState<TaxDraftData | null>(null);
    const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);
    const [pdfFile, setPdfFile] = useState<{name: string, data: string} | null>(null);

    // History state
    const [selectedReturn, setSelectedReturn] = useState<SavedTaxReturn | null>(null);
    const [returnToDelete, setReturnToDelete] = useState<SavedTaxReturn | null>(null);
    
    // Shared state
    const [openAccordion, setOpenAccordion] = useState('A');
    const [questionnaire, setQuestionnaire] = useState<TaxQuestionnaire>({
        personal_civilStatus: 'single', personal_autonomousCommunity: 'Madrid', personal_hasChildren: false,
        personal_childrenCount: 0, personal_childrenDisability: false, personal_childrenDisabilityGrade: 33,
        personal_isLargeFamily: 'none', personal_hasAscendants: false, personal_ascendantsDisability: false,
        personal_ascendantsDisabilityGrade: 33, housing_isOwner: false, housing_isRenter: false,
        housing_mortgage_boughtBefore2013: false, housing_mortgage_paidAmount: 0, housing_rent_contractDate: '',
        housing_rent_paidAmount: 0, housing_efficiencyImprovements: false, housing_efficiencyAmount: 0,
        rented_properties: [], care_daycareExpenses: 0, care_educationExpenses: 0,
        work_isAutonomous: false, work_autonomousIncome: 0, work_autonomousExpenses: 0,
        work_pensionPlanContributions: 0, work_investmentGainsLosses: 0, donations_ngo: 0,
        donations_unionDues: 0, donations_privateHealthInsurance: 0, regional_gymFee: 0,
        regional_birthAdoption: 0, regional_publicTransport: 0,
    });
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveYear, setSaveYear] = useState(new Date().getFullYear() - 1);


    useEffect(() => {
        if (step === 2 && receipts) {
            const deductibleExpenses = receipts
                .filter(r => r.type === ReceiptType.INVOICE && r.isTaxDeductible)
                .reduce((total, r) => total + r.amount, 0);
            
            setQuestionnaire(q => ({
                ...q,
                work_autonomousExpenses: deductibleExpenses,
            }));
        }
    }, [step, receipts]);
    
    const resetSimulator = () => {
        setStep(1);
        setDraftData(null);
        setCalculationResult(null);
        setPdfFile(null);
        setError('');
        setView('form');
    };
    
    const handleTabChange = (tab: 'simulator' | 'investments' | 'history' | 'planning' | 'tips') => {
        setActiveTab(tab);
        if (tab === 'simulator') {
            resetSimulator();
        } else if (tab === 'history') {
            setView('history_list');
            setSelectedReturn(null);
        }
    };

    // --- Simulator Logic ---

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setError('');
            setIsLoading(true);
            try {
                const reader = new FileReader();
                reader.readAsDataURL(selectedFile);
                reader.onloadend = async () => {
                    const base64StringWithMime = reader.result as string;
                    const base64String = base64StringWithMime.split(',')[1];
                    setPdfFile({ name: selectedFile.name, data: base64String });

                    const extractedData = await extractDataFromTaxPDF(base64String, selectedFile.type);
                    if (extractedData.grossIncome === 0 && extractedData.draftResult === 0) {
                         setError('No se pudieron extraer los datos del PDF. Asegúrate de que es un borrador de la renta válido y legible.');
                         setIsLoading(false);
                         setPdfFile(null);
                    } else {
                        setDraftData(extractedData);
                        setStep(2);
                        setIsLoading(false);
                    }
                };
                reader.onerror = () => {
                    setError('Error al leer el archivo.');
                    setIsLoading(false);
                };
            } catch (err) {
                console.error(err);
                setError('Error al procesar el PDF con la IA.');
                setIsLoading(false);
            }
        } else {
            setError('Por favor, selecciona un archivo PDF válido.');
        }
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleCalculate = async () => {
        if (!draftData) {
            setError("Los datos del borrador no se han podido cargar. Por favor, vuelve a subir el archivo.");
            return;
        }
        setIsLoading(true);
        const deductibleReceipts = receipts.filter(r => r.type === ReceiptType.INVOICE && r.isTaxDeductible);
        const result = await getTaxAdvice(draftData, questionnaire, deductibleReceipts);
        const totalImpact = result.deductions.reduce((acc, curr) => acc + curr.impactOnResult, 0);
        const adjustedResult = draftData.draftResult - totalImpact;

        setCalculationResult({
            draftResult: draftData.draftResult,
            adjustedResult: adjustedResult,
            advice: result.advice,
            deductions: result.deductions,
        });

        setIsLoading(false);
        setView('results');
    };
    
    const handleSaveReturn = () => {
        if (!calculationResult || !pdfFile) return;
        addSavedTaxReturn({
            year: saveYear,
            fileName: pdfFile.name,
            pdfData: pdfFile.data,
            calculationResult: calculationResult
        });
        setIsSaveModalOpen(false);
    };

    // --- History Logic ---

    const viewHistoryDetail = (savedReturn: SavedTaxReturn) => {
        setSelectedReturn(savedReturn);
        setView('history_detail');
    };

    const confirmDeleteReturn = (savedReturn: SavedTaxReturn) => {
        setReturnToDelete(savedReturn);
    };

    const handleDeleteReturn = () => {
        if (returnToDelete) {
            deleteSavedTaxReturn(returnToDelete.id);
            setReturnToDelete(null);
        }
    };
    
    // --- Shared Questionnaire Logic ---
    const handleQuestionnaireChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let processedValue: string | number | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : (type === 'number' ? parseFloat(value) || 0 : value);
        setQuestionnaire(q => ({ ...q, [name]: processedValue }));
    };

    // --- Render Functions ---

    const renderResultView = (result: TaxCalculationResult, isHistory: boolean = false) => {
        const { draftResult, adjustedResult, advice, deductions } = result;
        const improvement = draftResult - adjustedResult;

        const ResultBox: React.FC<{title: string; amount: number; isMain?: boolean}> = ({ title, amount, isMain = false }) => (
            <div className={`p-4 rounded-lg text-center ${isMain ? 'bg-primary/20' : 'bg-slate-700'}`}>
                <p className="text-sm text-slate-300">{title}</p>
                <p className={`text-3xl font-bold ${isMain ? 'text-primary' : 'text-white'}`}>{amount.toFixed(2)} €</p>
                <p className={`text-xs ${amount < 0 ? 'text-secondary' : 'text-danger'}`}>{amount < 0 ? 'A DEVOLVER' : amount > 0 ? 'A PAGAR' : 'NEUTRO'}</p>
            </div>
        );

        return (
            <div>
                <Card className="mb-6">
                    <h2 className="text-2xl font-bold text-white text-center mb-6">
                        {isHistory ? `Resultado de la Renta ${selectedReturn?.year}` : "¡Simulación Completada!"}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <ResultBox title="Resultado Original" amount={draftResult} />
                        <div className="text-center">
                            <p className="text-sm text-slate-300">Ahorro Estimado</p>
                            <p className={`text-4xl font-bold ${improvement >= 0 ? 'text-secondary' : 'text-danger'}`}>{improvement >= 0 ? `+${improvement.toFixed(2)}` : improvement.toFixed(2)} €</p>
                        </div>
                        <ResultBox title="Resultado Optimizado" amount={adjustedResult} isMain />
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><IconSparkles className="w-6 h-6 text-primary"/>Consejos del Asesor IA</h3>
                        <div className="prose prose-invert prose-slate max-w-none prose-headings:text-primary prose-strong:text-slate-100 prose-ul:list-disc"><ReactMarkdown remarkPlugins={[remarkGfm]}>{advice}</ReactMarkdown></div>
                    </Card>
                    <Card>
                        <h3 className="text-xl font-bold text-white mb-4">Deducciones Aplicadas</h3>
                        {deductions.length > 0 ? <ul className="space-y-2">{deductions.map((d, i) => <li key={i} className="p-2 bg-slate-700/50 rounded-md flex justify-between"><span>{d.description}</span><span className="font-semibold text-secondary">-{d.impactOnResult.toFixed(2)}€</span></li>)}</ul> : <p className="text-slate-400">No se han encontrado deducciones adicionales.</p>}
                    </Card>
                </div>

                <div className="text-center mt-8">
                    {isHistory ? <Button variant="ghost" onClick={() => handleTabChange('history')}>Volver al Historial</Button> : <Button variant="ghost" onClick={resetSimulator}>Realizar otra simulación</Button>}
                    {!isHistory && <Button onClick={() => setIsSaveModalOpen(true)} className="ml-4">Guardar en Historial</Button>}
                </div>
            </div>
        );
    };

    const renderSimulator = () => (
        <>
            {view === 'form' && step === 1 &&
                <Card className="text-center">
                    <IconUpload className="w-16 h-16 mx-auto text-primary mb-4" />
                    <h2 className="text-2xl font-bold text-white">Sube tu Borrador de la Renta</h2>
                    <p className="mt-4 text-slate-300 max-w-2xl mx-auto">Selecciona el borrador de tu declaración (Modelo 100) en formato PDF. Nuestra IA extraerá los datos clave.</p>
                    <div className="mt-8">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
                        <Button size="lg" onClick={handleUploadClick} disabled={isLoading}>{isLoading ? "Procesando PDF..." : "Seleccionar Archivo PDF"}</Button>
                        {pdfFile && !isLoading && <p className="text-sm text-slate-400 mt-4">Archivo seleccionado: {pdfFile.name}</p>}
                        {error && <p className="text-sm text-danger mt-4">{error}</p>}
                    </div>
                    <p className="mt-6 text-xs text-slate-500 max-w-2xl mx-auto">Recuerda: esto es una simulación. Tu documento se procesa de forma segura y no se almacena.</p>
                </Card>
            }
            {view === 'form' && step === 2 && draftData &&
                <Card>
                    <h2 className="text-xl font-bold text-white mb-2">Paso 2: Cuestionario Fiscal</h2>
                    <p className="text-slate-400 mb-6">Confirma los datos y responde para encontrar deducciones.</p>
                    {/* ... Questionnaire JSX ... */}
                    <div className="border border-slate-700 rounded-lg">
                        <AccordionSection title="A. Datos Personales y Familiares" isOpen={openAccordion === 'A'} onToggle={() => setOpenAccordion(openAccordion === 'A' ? '' : 'A')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="personal_civilStatus" className="block text-sm font-medium text-slate-400 mb-1">Estado Civil</label>
                                    <select
                                        id="personal_civilStatus"
                                        name="personal_civilStatus"
                                        value={questionnaire.personal_civilStatus}
                                        onChange={handleQuestionnaireChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                                    >
                                        <option value="single">Soltero/a</option>
                                        <option value="married">Casado/a</option>
                                        <option value="widowed">Viudo/a</option>
                                        <option value="divorced">Divorciado/a</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="personal_autonomousCommunity" className="block text-sm font-medium text-slate-400 mb-1">Comunidad Autónoma</label>
                                    <select
                                        id="personal_autonomousCommunity"
                                        name="personal_autonomousCommunity"
                                        value={questionnaire.personal_autonomousCommunity}
                                        onChange={handleQuestionnaireChange}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                                    >
                                        {AUTONOMOUS_COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </AccordionSection>
                        <AccordionSection title="E. Trabajo y Ahorro" isOpen={openAccordion === 'E'} onToggle={() => setOpenAccordion(openAccordion === 'E' ? '' : 'E')}>
                             <div className="space-y-4">
                                <Input label="Aportaciones a planes de pensiones" name="work_pensionPlanContributions" type="number" value={questionnaire.work_pensionPlanContributions} onChange={handleQuestionnaireChange} />
                             </div>
                         </AccordionSection>
                    </div>
                     <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-700">
                        <Button variant="ghost" onClick={resetSimulator}>Empezar de Nuevo</Button>
                        <Button size="lg" onClick={handleCalculate} disabled={isLoading}>{isLoading ? 'Analizando...' : 'Calcular Declaración'}</Button>
                    </div>
                </Card>
            }
            {view === 'results' && calculationResult && renderResultView(calculationResult, false)}
        </>
    );

    const renderHistory = () => (
         <>
            {view === 'history_list' &&
                <Card>
                    <h2 className="text-2xl font-bold text-white mb-4">Historial de Rentas</h2>
                    {savedTaxReturns.length > 0 ? (
                        <ul className="space-y-3">
                            {savedTaxReturns.sort((a,b)=>b.year - a.year).map(item => (
                                <li key={item.id} className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-lg text-white">Renta {item.year}</p>
                                        <p className="text-sm text-slate-400">Guardado: {new Date(item.dateSaved).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className={`text-xl font-bold ${item.calculationResult.adjustedResult < 0 ? 'text-secondary' : 'text-danger'}`}>
                                            {item.calculationResult.adjustedResult.toFixed(2)} €
                                        </p>
                                        <Button variant="ghost" size="sm" onClick={() => viewHistoryDetail(item)}><IconEye className="w-5 h-5 mr-2"/>Ver Detalles</Button>
                                        <button onClick={() => confirmDeleteReturn(item)} className="p-2 text-slate-400 hover:text-danger rounded-full hover:bg-slate-700" title="Eliminar"><IconTrash className="w-5 h-5"/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12">
                            <IconScale className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold">No hay rentas guardadas</h3>
                            <p className="text-slate-400 mt-2">Usa el simulador y guarda los resultados para verlos aquí.</p>
                        </div>
                    )}
                </Card>
            }
            {view === 'history_detail' && selectedReturn && renderResultView(selectedReturn.calculationResult, true)}
         </>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white mb-2">Fiscalidad</h1>
            <div className="border-b border-slate-700 mb-6">
                 <nav className="-mb-px flex space-x-8 overflow-x-auto no-scrollbar">
                    <button onClick={() => handleTabChange('simulator')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'simulator' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Simulador</button>
                    <button onClick={() => handleTabChange('investments')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'investments' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Inversiones</button>
                    <button onClick={() => handleTabChange('tips')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'tips' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Consejos</button>
                    <button onClick={() => handleTabChange('history')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Historial</button>
                    <button onClick={() => handleTabChange('planning')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'planning' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Planificación</button>
                </nav>
            </div>
            
            {activeTab === 'simulator' && renderSimulator()}
            {activeTab === 'investments' && <InvestmentTaxManager />}
            {activeTab === 'tips' && <TaxTipsSection />}
            {activeTab === 'history' && renderHistory()}
            {activeTab === 'planning' && <TaxPlanningAdvisor />}
            
            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Guardar Simulación">
                <div className="space-y-4">
                    <p className="text-slate-300">Introduce el año fiscal correspondiente a esta declaración para guardarla en tu historial.</p>
                    <Input 
                        label="Año Fiscal" 
                        type="number"
                        value={saveYear}
                        onChange={(e) => setSaveYear(parseInt(e.target.value))}
                        placeholder={`Ej: ${new Date().getFullYear() - 1}`}
                    />
                     <div className="flex justify-end gap-4 pt-4">
                        <Button variant="ghost" onClick={() => setIsSaveModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveReturn}>Guardar</Button>
                    </div>
                </div>
            </Modal>
            
            <ConfirmationModal
                isOpen={!!returnToDelete}
                onClose={() => setReturnToDelete(null)}
                onConfirm={handleDeleteReturn}
                title={`Eliminar Renta ${returnToDelete?.year}`}
            >
                <p>¿Estás seguro de que quieres eliminar permanentemente la declaración guardada del año <span className="font-bold">{returnToDelete?.year}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
            
            {isLoading && view === 'form' && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col justify-center items-center z-50">
                    <p className="text-white text-xl mt-4">Analizando con IA, un momento...</p>
                </div>
            )}
        </div>
    );
};

export default TaxationPage;
