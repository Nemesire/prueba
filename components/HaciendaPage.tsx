import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card, Button, Input, Modal, ConfirmationModal, ProgressBar } from './common/UIComponents.tsx';
import { IconBuildingBank, IconPlus, IconTrash, IconPencil, IconRefresh, IconArrowLeft, IconSparkles, IconPiggyBank, IconSettings, IconScale, IconCalendar, IconInformationCircle, IconShield, IconEye, IconEyeSlash } from '../constants.tsx';
import { TaxSimulation, TaxConfig, TaxActivity, TaxActivityType, TaxDeductionItem, TaxSimulationResult, TaxBracketDetail, TaxPaymentContribution, TaxExpenseItem } from '../types.ts';
import { getSpecificTaxAdvice } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Constants ---
const ACTIVITY_TYPES: { id: TaxActivityType, label: string }[] = [
    { id: 'Trabajo', label: 'Rendimientos del Trabajo (Nómina)' },
    { id: 'Trading', label: 'Trading / Inversiones' },
    { id: 'AlquilerTuristico', label: 'Alquiler Turístico (Airbnb/Booking)' },
    { id: 'AlquilerHabitaciones', label: 'Alquiler por Habitaciones' },
    { id: 'AlquilerTradicional', label: 'Alquiler Tradicional (Vivienda)' },
    { id: 'AutonomoServicios', label: 'Autónomo (Servicios Profesionales)' },
    { id: 'AutonomoComercio', label: 'Autónomo (Comercio/Hostelería)' },
    { id: 'IngresosOnline', label: 'Ingresos Online / Adsense' },
    { id: 'Dividendos', label: 'Dividendos' },
    { id: 'Intereses', label: 'Intereses Bancarios' },
    { id: 'Criptomonedas', label: 'Criptomonedas' },
    { id: 'VentaActivos', label: 'Venta de Activos (Inmuebles/Otros)' },
    { id: 'Otros', label: 'Otros' },
];

const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

// --- Helper Functions ---

const getDeadlineStatus = (simulationYear: number) => {
    const today = new Date();
    const deadline = new Date(simulationYear + 1, 5, 30); // 30 de Junio
    
    const diffTime = deadline.getTime() - today.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));

    if (diffTime < 0) {
        return { 
            label: 'Plazo Vencido', 
            color: 'text-danger', 
            bg: 'bg-danger/10', 
            border: 'border-danger/30',
            months: 0,
            icon: '⚠️'
        };
    }
    
    if (diffMonths <= 2) {
        return { 
            label: `¡Solo ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}!`, 
            color: 'text-danger', 
            bg: 'bg-danger/20', 
            border: 'border-danger/50',
            months: diffMonths,
            icon: '🔥'
        };
    }
    if (diffMonths <= 4) {
        return { 
            label: `${diffMonths} meses restantes`, 
            color: 'text-orange-500', 
            bg: 'bg-orange-500/10', 
            border: 'border-orange-500/30',
            months: diffMonths,
            icon: '⏳'
        };
    }
    if (diffMonths <= 6) {
        return { 
            label: `${diffMonths} meses restantes`, 
            color: 'text-yellow-400', 
            bg: 'bg-yellow-400/10', 
            border: 'border-yellow-400/30',
            months: diffMonths,
            icon: '🗓️'
        };
    }
    
    return { 
        label: `${diffMonths} meses para el plazo`, 
        color: 'text-secondary', 
        bg: 'bg-secondary/10', 
        border: 'border-secondary/30',
        months: diffMonths,
        icon: '✅'
    };
};

const calculateTaxResult = (simulation: TaxSimulation, config: TaxConfig): TaxSimulationResult => {
    let baseGeneral = 0;
    let baseSavings = 0;
    let totalRetentions = 0;
    let baseIGIC = 0;
    let igicWarning = '';

    simulation.activities.forEach(act => {
        totalRetentions += act.retentionsApplied;
        const netIncome = act.grossIncome - act.deductibleExpenses;

        if (['Trading', 'Dividendos', 'Intereses', 'Criptomonedas', 'VentaActivos'].includes(act.type)) {
            baseSavings += netIncome;
        } else {
            baseGeneral += netIncome;
        }

        if (act.type === 'AlquilerTuristico') {
            if (act.grossIncome > config.igicThreshold) {
                baseIGIC += act.grossIncome;
                if (!igicWarning) igicWarning = `Se aplica IGIC (${config.igicRate * 100}%) automáticamente porque la actividad supera los ${formatCurrency(config.igicThreshold)} anuales.`;
            } else if (act.isIGICApplicable) {
                baseIGIC += act.grossIncome;
            }
        }
    });

    let totalDeductionsAmount = (simulation.deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const generalDeductions = Math.min(baseGeneral, totalDeductionsAmount);
    baseGeneral -= generalDeductions;

    const calculateBreakdown = (amount: number, scales: { limit: number; rate: number }[]): { tax: number, breakdown: TaxBracketDetail[], marginalRate: number } => {
        let tax = 0;
        let remaining = amount;
        let prevLimit = 0;
        const breakdown: TaxBracketDetail[] = [];
        let marginalRate = 0;

        for (const scale of scales) {
            const upperLimit = scale.limit === Infinity ? amount + 1 : scale.limit; 
            const width = upperLimit - prevLimit;
            
            let baseInBracket = 0;
            if (remaining > 0) {
                baseInBracket = Math.min(remaining, width);
                if (scale.limit === Infinity) baseInBracket = remaining;
            }

            if (amount > prevLimit) {
                 const taxInBracket = baseInBracket * scale.rate;
                 tax += taxInBracket;
                 remaining -= baseInBracket;
                 marginalRate = scale.rate;
                 
                 breakdown.push({
                     label: scale.limit === Infinity ? `> ${formatCurrency(prevLimit)}` : `${formatCurrency(prevLimit)} - ${formatCurrency(scale.limit)}`,
                     rate: scale.rate,
                     baseInBracket: baseInBracket,
                     taxAmount: taxInBracket,
                     isMarginal: remaining <= 0 && baseInBracket > 0
                 });
            }
            prevLimit = scale.limit;
        }
        return { tax, breakdown, marginalRate };
    };

    const generalCalc = calculateBreakdown(baseGeneral, config.irpfScalesGeneral);
    const savingsCalc = calculateBreakdown(baseSavings, config.irpfScalesSavings);
    
    const quotaIntegra = generalCalc.tax + savingsCalc.tax;
    const quotaLiquida = quotaIntegra - totalRetentions - simulation.paymentsOnAccount;
    const quotaIGIC = baseIGIC * config.igicRate;
    const totalToPay = quotaLiquida + quotaIGIC;

    const totalBase = baseGeneral + baseSavings;
    const effectiveRateGeneral = totalBase > 0 ? (quotaIntegra / totalBase) : 0;

    return {
        baseGeneral,
        baseSavings,
        breakdownGeneral: generalCalc.breakdown,
        breakdownSavings: savingsCalc.breakdown,
        marginalRateGeneral: generalCalc.marginalRate,
        effectiveRateGeneral,
        quotaIntegra,
        quotaLiquida,
        totalRetentions,
        finalResultIRPF: quotaLiquida,
        baseIGIC,
        quotaIGIC,
        totalIGIC: quotaIGIC,
        igicWarning,
        totalToPay,
        monthlySavingRecommendation: totalToPay > 0 ? totalToPay / 12 : 0
    };
};

// --- Sub-Components ---

const IRPFBracketsTable: React.FC<{ breakdown: TaxBracketDetail[], title: string, marginalRate: number }> = ({ breakdown, title, marginalRate }) => {
    if (breakdown.length === 0) return null;
    return (
        <Card className="mt-4 border border-slate-700">
            <h4 className="font-bold text-white mb-3 flex justify-between items-center text-sm md:text-base">
                <span>{title}</span>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded text-primary">Marginal: {(marginalRate * 100).toFixed(0)}%</span>
            </h4>
            <div className="overflow-x-auto">
                <table className="w-full text-[10px] md:text-xs text-left">
                    <thead className="bg-slate-800 text-slate-400">
                        <tr>
                            <th className="p-2">Tramo</th>
                            <th className="p-2 text-right">Tipo</th>
                            <th className="p-2 text-right">Tu Base</th>
                            <th className="p-2 text-right">Cuota</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {breakdown.map((row, idx) => (
                            <tr key={idx} className={row.isMarginal ? "bg-primary/10" : ""}>
                                <td className="p-2 text-slate-300 font-medium">{row.label}</td>
                                <td className="p-2 text-right text-slate-400">{(row.rate * 100).toFixed(0)}%</td>
                                <td className="p-2 text-right font-mono text-white">{formatCurrency(row.baseInBracket)}</td>
                                <td className="p-2 text-right font-mono text-danger">{formatCurrency(row.taxAmount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const TaxPaymentPlanner: React.FC<{ simulation: TaxSimulation, onUpdate: (sim: TaxSimulation) => void }> = ({ simulation, onUpdate }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionDate, setContributionDate] = useState(new Date().toISOString().split('T')[0]);
    const [contributionNote, setContributionNote] = useState('');
    const [initialSavings, setInitialSavings] = useState('');
    
    // AI Strategy State
    const [strategyAdvice, setStrategyAdvice] = useState('');
    const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
    const [showLiquidityHelp, setShowLiquidityHelp] = useState(false);

    const totalToPay = simulation.result.totalToPay;
    const totalContributed = (simulation.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
    const remainingToPay = Math.max(0, totalToPay - totalContributed);
    const progress = totalToPay > 0 ? (totalContributed / totalToPay) * 100 : 0;
    const timeStatus = useMemo(() => getDeadlineStatus(simulation.year), [simulation.year]);

    const handleAddContribution = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(contributionAmount);
        if (isNaN(amount) || amount <= 0) return;
        const newPayment: TaxPaymentContribution = { id: crypto.randomUUID(), date: contributionDate, amount, note: contributionNote };
        const updatedHistory = [...(simulation.paymentHistory || []), newPayment];
        onUpdate({ ...simulation, paymentHistory: updatedHistory });
        setContributionAmount(''); setContributionNote(''); setIsModalOpen(false);
    };

    const handleGetStrategy = async () => {
        setIsGeneratingStrategy(true);
        try {
            const context = `El usuario tiene que pagar un total de ${formatCurrency(totalToPay)} de IRPF/IGIC. 
            Actualmente ha ahorrado ${formatCurrency(totalContributed)}. 
            Quedan aproximadamente ${timeStatus.months} meses para el plazo final. 
            Dame consejos específicos sobre cómo prorratear este pago si el importe es elevado, 
            ventajas de fraccionar en el Modelo 100 (60/40), aplazamientos con intereses y qué hacer si no tiene liquidez.`;
            
            const advice = await getSpecificTaxAdvice(JSON.stringify(simulation), context);
            setStrategyAdvice(advice);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGeneratingStrategy(false);
        }
    };

    const calculatePlan = useMemo(() => {
        if (totalToPay <= 0) return null;
        const declarationYear = simulation.year + 1;
        const savings = parseFloat(initialSavings) || 0;
        const firstPaymentDeadline = new Date(declarationYear, 5, 30);
        const today = new Date();
        const firstPaymentAmount = totalToPay * 0.60;
        const secondPaymentAmount = totalToPay * 0.40;
        const monthsUntilJune = Math.max(0, (firstPaymentDeadline.getFullYear() - today.getFullYear()) * 12 + (firstPaymentDeadline.getMonth() - today.getMonth()));
        const amountCoveredSoFar = totalContributed + savings;
        const remainingForFirstPayment = Math.max(0, firstPaymentAmount - amountCoveredSoFar);
        const monthlySavingForJune = monthsUntilJune > 0 ? remainingForFirstPayment / monthsUntilJune : remainingForFirstPayment;

        let strategyTitle = ""; let strategyText = ""; let strategyColor = "";
        if (today > firstPaymentDeadline) {
            strategyTitle = "¡Pago Urgente!"; strategyText = "La fecha límite del primer pago (30 de Junio) ya ha pasado."; strategyColor = "text-danger";
        } else if (monthsUntilJune <= 2) {
            strategyTitle = "¡Recta Final!"; strategyText = `Quedan ${monthsUntilJune} meses. Necesitas ${formatCurrency(firstPaymentAmount)} (60%) para Junio.`; strategyColor = "text-danger";
        } else {
            strategyTitle = "Planificación Cómoda"; strategyText = `Tienes ${monthsUntilJune} meses. Ahorra ${formatCurrency(monthlySavingForJune)} al mes para el pago de Junio.`; strategyColor = "text-secondary";
        }

        return { firstPaymentDeadline, firstPaymentAmount, secondPaymentAmount, remainingForFirstPayment, monthlySavingForJune, strategyTitle, strategyText, strategyColor, monthsUntilJune };
    }, [totalToPay, totalContributed, initialSavings, simulation.year]);

    return (
        <div className="space-y-6">
            {/* Widget de Tiempo Restante */}
            <div className={`p-4 md:p-6 rounded-xl border-2 shadow-lg transition-all ${timeStatus.bg} ${timeStatus.border} ${timeStatus.color}`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mb-1 opacity-80">Tiempo para Declaración</h4>
                        <p className="text-xl md:text-2xl font-black">Límite: 30 Junio {simulation.year + 1}</p>
                    </div>
                    <div className="px-4 py-2 bg-slate-900/40 rounded-full border border-current/20 backdrop-blur-sm">
                        <p className="text-lg md:text-xl font-black flex items-center gap-2">
                             <IconCalendar className="w-5 h-5 md:w-6 md:h-6" />
                             {timeStatus.label}
                        </p>
                    </div>
                </div>
            </div>

            <Card className="border-l-4 border-info">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <IconPiggyBank className="w-6 h-6 text-info"/>
                        Fondo de Reserva Fiscal
                    </h3>
                    <Button size="sm" onClick={() => setIsModalOpen(true)}><IconPlus className="w-4 h-4 mr-2"/> Aportar</Button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div><p className="text-[10px] text-slate-400 uppercase">A pagar</p><p className="text-lg font-bold text-white">{formatCurrency(totalToPay)}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase">Reservado</p><p className="text-lg font-bold text-info">{formatCurrency(totalContributed)}</p></div>
                    <div><p className="text-[10px] text-slate-400 uppercase">Falta</p><p className={`text-lg font-bold ${remainingToPay > 0 ? 'text-danger' : 'text-secondary'}`}>{formatCurrency(remainingToPay)}</p></div>
                </div>
                <ProgressBar value={Math.min(progress, 100)} colorClass="bg-info" />
            </Card>

            {totalToPay > 0 && (
                <Card className="border-l-4 border-accent bg-slate-800/40">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <IconInformationCircle className="w-5 h-5 text-accent"/>
                            ¿No puedes pagar el total ahora?
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setShowLiquidityHelp(!showLiquidityHelp)}>
                            {showLiquidityHelp ? 'Cerrar opciones' : 'Ver soluciones'}
                        </Button>
                    </div>
                    
                    {showLiquidityHelp && (
                        <div className="mt-4 space-y-4 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                                    <p className="font-bold text-primary text-xs uppercase mb-1">1. Fraccionamiento 60/40</p>
                                    <p className="text-[11px] text-slate-300">Opción por defecto y **sin intereses**. Pagas el 60% en junio y el 40% en noviembre.</p>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                                    <p className="font-bold text-primary text-xs uppercase mb-1">2. Aplazamiento AEAT</p>
                                    <p className="text-[11px] text-slate-300">Si el 60% inicial es inasumible, puedes pedir un aplazamiento con cuotas mensuales. Tiene un interés de demora (aprox 4%).</p>
                                </div>
                                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                                    <p className="font-bold text-primary text-xs uppercase mb-1">3. Préstamo Renta</p>
                                    <p className="text-[11px] text-slate-300">Muchos bancos ofrecen créditos al 0% o interés bajo para pagar impuestos. A veces sale más barato que Hacienda.</p>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic text-center">**Nota:** Estas opciones se seleccionan al momento de presentar la declaración de la renta (Modelo 100).</p>
                        </div>
                    )}
                </Card>
            )}

            <Card className="border-l-4 border-primary/60 bg-slate-900/50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <IconSparkles className="w-6 h-6 text-primary"/>
                        Estrategia de Pagos Elevados
                    </h3>
                    <Button variant="ghost" size="sm" onClick={handleGetStrategy} disabled={isGeneratingStrategy}>
                        <IconRefresh className={`w-4 h-4 mr-2 ${isGeneratingStrategy ? 'animate-spin' : ''}`} />
                        {strategyAdvice ? 'Actualizar' : 'Consultar Asistente IA'}
                    </Button>
                </div>

                {strategyAdvice ? (
                    <div className="prose prose-sm prose-invert max-w-none bg-slate-800/40 p-4 rounded-lg border border-slate-700 mb-6">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{strategyAdvice}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700 mb-6 text-sm text-slate-400 italic">
                        Pulsa el botón superior para que la IA analice tu caso y te de tips personalizados sobre prorrateos y gestión de liquidez.
                    </div>
                )}

                {totalToPay > 0 && calculatePlan && (
                    <div className="space-y-4 pt-4 border-t border-slate-700">
                        <h4 className={`text-lg font-bold ${calculatePlan.strategyColor}`}>{calculatePlan.strategyTitle}</h4>
                        <p className="text-slate-300 text-sm">{calculatePlan.strategyText}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-white uppercase text-xs">60% - Junio</span>
                                </div>
                                <p className="text-2xl font-black text-white mb-2">{formatCurrency(calculatePlan.firstPaymentAmount)}</p>
                                {calculatePlan.monthsUntilJune > 0 && calculatePlan.remainingForFirstPayment > 0 && (
                                    <div className="p-2 bg-primary/10 rounded border border-primary/20 text-center">
                                        <p className="text-[10px] text-primary font-bold uppercase mb-1">Ahorro mensual necesario</p>
                                        <p className="text-xl font-black text-white">{formatCurrency(calculatePlan.monthlySavingForJune)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 opacity-80">
                                <span className="font-bold text-slate-300 uppercase text-xs">40% - Noviembre</span>
                                <p className="text-2xl font-black text-slate-300 mb-2">{formatCurrency(calculatePlan.secondPaymentAmount)}</p>
                                <p className="text-[10px] text-slate-500 italic">Aplazamiento sin intereses disponible al presentar la declaración.</p>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Ahorro para Impuestos">
                <form onSubmit={handleAddContribution} className="space-y-4">
                    <Input label="Fecha" type="date" value={contributionDate} onChange={(e) => setContributionDate(e.target.value)} required />
                    <Input label="Importe (€)" type="number" step="0.01" value={contributionAmount} onChange={(e) => setContributionAmount(e.target.value)} required />
                    <Input label="Nota" placeholder="Ej: Ahorro mensual, Extra dividendos..." value={contributionNote} onChange={(e) => setContributionNote(e.target.value)} />
                    <div className="flex justify-end pt-4 gap-4"><Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Añadir</Button></div>
                </form>
            </Modal>
        </div>
    );
};

// --- ActivityForm for Simulation Editor ---
const ActivityForm: React.FC<{
    activity: TaxActivity;
    onChange: (activity: TaxActivity) => void;
    onDelete: () => void;
}> = ({ activity, onChange, onDelete }) => {
    const [isAddingExpense, setIsAddingExpense] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<TaxExpenseItem>>({ name: '', amount: 0, date: new Date().toISOString().split('T')[0] });
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
    const [editExpenseData, setEditExpenseData] = useState<Partial<TaxExpenseItem>>({});
    const [hiddenVerifications, setHiddenVerifications] = useState<Record<string, boolean>>({});

    const toggleVerificationVisibility = (id: string) => {
        setHiddenVerifications(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddExpense = () => {
        if (!newExpense.name || !newExpense.amount) return;
        const item: TaxExpenseItem = {
            id: crypto.randomUUID(),
            name: newExpense.name,
            amount: Number(newExpense.amount),
            date: newExpense.date || new Date().toISOString().split('T')[0]
        };
        const updatedItems = [...(activity.expenseItems || []), item];
        const totalExpenses = updatedItems.reduce((sum, e) => sum + e.amount, 0);
        onChange({ ...activity, expenseItems: updatedItems, deductibleExpenses: totalExpenses });
        setNewExpense({ name: '', amount: 0, date: new Date().toISOString().split('T')[0] });
        setIsAddingExpense(false);
    };

    const handleSaveEditExpense = () => {
        if (!editExpenseData.name || !editExpenseData.amount || !editingExpenseId) return;
        const updatedItems = (activity.expenseItems || []).map(e => 
            e.id === editingExpenseId ? { ...e, name: editExpenseData.name!, amount: Number(editExpenseData.amount), date: editExpenseData.date || e.date } : e
        );
        const totalExpenses = updatedItems.reduce((sum, e) => sum + e.amount, 0);
        onChange({ ...activity, expenseItems: updatedItems, deductibleExpenses: totalExpenses });
        setEditingExpenseId(null);
    };

    const startEditingExpense = (expense: TaxExpenseItem) => {
        setEditingExpenseId(expense.id);
        setEditExpenseData({ name: expense.name, amount: expense.amount, date: expense.date });
    };

    const handleDeleteExpense = (id: string) => {
        const updatedItems = (activity.expenseItems || []).filter(e => e.id !== id);
        const totalExpenses = updatedItems.reduce((sum, e) => sum + e.amount, 0);
        onChange({ ...activity, expenseItems: updatedItems, deductibleExpenses: totalExpenses });
    };

    const handleVerifyExpense = async (expense: TaxExpenseItem) => {
        setVerifyingId(expense.id);
        try {
            const context = `El usuario quiere deducir un gasto llamado "${expense.name}" por valor de ${expense.amount}€ con fecha ${expense.date} en la actividad "${activity.type}" ("${activity.name}"). ¿Es este gasto deducible según la normativa fiscal española? Responde brevemente si es válido o no y por qué.`;
            const advice = await getSpecificTaxAdvice(JSON.stringify(activity), context);
            
            const updatedItems = (activity.expenseItems || []).map(e => 
                e.id === expense.id ? { ...e, verificationResult: advice, isValid: !advice.toLowerCase().includes('no es deducible') && !advice.toLowerCase().includes('no suele ser deducible') } : e
            );
            onChange({ ...activity, expenseItems: updatedItems });
        } catch (error) {
            console.error(error);
        } finally {
            setVerifyingId(null);
        }
    };

    return (
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
                <select
                    value={activity.type}
                    onChange={(e) => onChange({ ...activity, type: e.target.value as TaxActivityType })}
                    className="bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 text-sm"
                >
                    {ACTIVITY_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                </select>
                <button type="button" onClick={onDelete} className="text-slate-500 hover:text-danger p-1">
                    <IconTrash className="w-5 h-5" />
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nombre de la Actividad" value={activity.name} onChange={(e) => onChange({ ...activity, name: e.target.value })} />
                <Input label="Ingresos Brutos (€)" type="number" value={activity.grossIncome} onChange={(e) => onChange({ ...activity, grossIncome: parseFloat(e.target.value) || 0 })} />
                <Input 
                    label="Retenciones Aplicadas (€)" 
                    type="number" 
                    value={activity.retentionsApplied} 
                    onChange={(e) => onChange({ ...activity, retentionsApplied: parseFloat(e.target.value) || 0 })} 
                    helperText="Dinero ya pagado por adelantado (ej. el IRPF de tu nómina o retenciones en facturas)."
                />
            </div>
            
            {/* Gastos Deducibles Section */}
            <div className="mt-4 border-t border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-white">Gastos Deducibles</h4>
                    <span className="text-sm font-mono text-danger font-bold">{formatCurrency(activity.deductibleExpenses)}</span>
                </div>
                
                {(activity.expenseItems || []).length > 0 && (
                    <div className="space-y-2 mb-4">
                        {(activity.expenseItems || []).map(expense => (
                            <div key={expense.id} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                {editingExpenseId === expense.id ? (
                                    <div className="space-y-3">
                                        <Input label="Concepto" value={editExpenseData.name || ''} onChange={e => setEditExpenseData({...editExpenseData, name: e.target.value})} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input label="Importe (€)" type="number" value={editExpenseData.amount || ''} onChange={e => setEditExpenseData({...editExpenseData, amount: parseFloat(e.target.value) || 0})} />
                                            <Input label="Fecha" type="date" value={editExpenseData.date || ''} onChange={e => setEditExpenseData({...editExpenseData, date: e.target.value})} />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingExpenseId(null)}>Cancelar</Button>
                                            <Button size="sm" onClick={handleSaveEditExpense} disabled={!editExpenseData.name || !editExpenseData.amount}>Guardar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-bold text-white">{expense.name}</p>
                                                <p className="text-xs text-slate-400">{expense.date}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-sm text-danger">{formatCurrency(expense.amount)}</span>
                                                <button onClick={() => startEditingExpense(expense)} className="text-slate-500 hover:text-primary"><IconPencil className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteExpense(expense.id)} className="text-slate-500 hover:text-danger"><IconTrash className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        
                                        {expense.verificationResult ? (
                                            <div className="mt-2">
                                                {hiddenVerifications[expense.id] ? (
                                                    <div className="flex justify-end">
                                                        <Button variant="ghost" size="sm" onClick={() => toggleVerificationVisibility(expense.id)}>
                                                            <IconEye className="w-3 h-3 mr-1" /> Ver resultado IA
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className={`p-2 rounded text-xs border relative ${expense.isValid ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-accent/10 border-accent/30 text-accent'}`}>
                                                        <button 
                                                            onClick={() => toggleVerificationVisibility(expense.id)}
                                                            className="absolute top-2 right-2 text-slate-400 hover:text-white"
                                                            title="Ocultar verificación"
                                                        >
                                                            <IconEyeSlash className="w-4 h-4" />
                                                        </button>
                                                        <div className="flex items-start gap-1 pr-6">
                                                            <IconShield className="w-4 h-4 shrink-0 mt-0.5" />
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm prose-invert max-w-none">{expense.verificationResult}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-2 flex justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => handleVerifyExpense(expense)} disabled={verifyingId === expense.id}>
                                                    <IconSparkles className={`w-3 h-3 mr-1 ${verifyingId === expense.id ? 'animate-spin' : ''}`} />
                                                    {verifyingId === expense.id ? 'Verificando...' : 'Verificar con IA'}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                
                {isAddingExpense ? (
                    <div className="bg-slate-700/30 p-3 rounded border border-slate-600 space-y-3">
                        <Input label="Concepto" value={newExpense.name || ''} onChange={e => setNewExpense({...newExpense, name: e.target.value})} placeholder="Ej: Cuota autónomos, Material oficina..." />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Importe (€)" type="number" value={newExpense.amount || ''} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})} />
                            <Input label="Fecha" type="date" value={newExpense.date || ''} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setIsAddingExpense(false)}>Cancelar</Button>
                            <Button size="sm" onClick={handleAddExpense} disabled={!newExpense.name || !newExpense.amount}>Guardar Gasto</Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="ghost" size="sm" className="w-full border border-dashed border-slate-600" onClick={() => setIsAddingExpense(true)}>
                        <IconPlus className="w-4 h-4 mr-2" /> Añadir Gasto Deducible
                    </Button>
                )}
            </div>

            {activity.type === 'AlquilerTuristico' && (
                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700/50 mt-4">
                    <input
                        type="checkbox"
                        checked={activity.isIGICApplicable}
                        onChange={(e) => onChange({ ...activity, isIGICApplicable: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-300">Actividad sujeta a IGIC/IVA</span>
                </label>
            )}
        </div>
    );
};

// --- TaxResultsView for Simulation Editor ---
const TaxResultsView: React.FC<{ result: TaxSimulationResult, simulationName: string }> = ({ result, simulationName }) => {
    return (
        <div className="space-y-6">
            <Card className="bg-slate-800 border border-slate-700">
                <div className="text-center py-4">
                    <h3 className="text-lg text-slate-400 uppercase tracking-wider mb-2">Simulación: {simulationName}</h3>
                    <p className={`text-5xl font-black ${result.totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>
                        {formatCurrency(Math.abs(result.totalToPay))}
                    </p>
                    <p className={`text-xl font-bold mt-2 ${result.totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>
                        {result.totalToPay > 0 ? 'RESULTADO A PAGAR' : 'RESULTADO A DEVOLVER'}
                    </p>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2"><IconScale className="w-5 h-5 text-slate-400"/> Bases Imponibles</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Base General</span>
                            <span className="font-bold text-white">{formatCurrency(result.baseGeneral)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Base Ahorro</span>
                            <span className="font-bold text-white">{formatCurrency(result.baseSavings)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Tipo Efectivo</span>
                            <span className="font-bold text-white">{(result.effectiveRateGeneral * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                </Card>
                <Card>
                    <h4 className="font-bold text-white mb-4 flex items-center gap-2"><IconBuildingBank className="w-5 h-5 text-slate-400"/> Liquidación</h4>
                    <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Cuota Íntegra</span>
                            <span className="font-bold text-white">{formatCurrency(result.quotaIntegra)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Retenciones/Pagos</span>
                            <span className="font-bold text-secondary">-{formatCurrency(result.totalRetentions)}</span>
                        </div>
                         {result.totalIGIC > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Cuota IGIC/IVA</span>
                                <span className="font-bold text-danger">{formatCurrency(result.totalIGIC)}</span>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <IRPFBracketsTable breakdown={result.breakdownGeneral} title="Detalle IRPF General" marginalRate={result.marginalRateGeneral} />
                <IRPFBracketsTable breakdown={result.breakdownSavings} title="Detalle IRPF Ahorro" marginalRate={result.breakdownSavings[result.breakdownSavings.length - 1]?.rate || 0} />
            </div>
        </div>
    );
};

// --- Simulation Editor Component ---
const SimulationEditor: React.FC<{ simulation: TaxSimulation | null, config: TaxConfig, onSave: (sim: TaxSimulation) => void, onCancel: () => void }> = ({ simulation, config, onSave, onCancel }) => {
    const getInitialState = (): TaxSimulation => {
        if (simulation) return simulation;
        return {
            id: crypto.randomUUID(), name: 'Nueva Simulación', year: new Date().getFullYear(), region: config.region, dateCreated: new Date().toISOString(),
            activities: [], deductions: [], paymentsOnAccount: 0, paymentHistory: [],
            result: { baseGeneral:0, baseSavings:0, breakdownGeneral:[], breakdownSavings:[], marginalRateGeneral:0, effectiveRateGeneral:0, quotaIntegra:0, quotaLiquida:0, totalRetentions:0, finalResultIRPF:0, baseIGIC:0, quotaIGIC:0, totalIGIC:0, totalToPay:0, monthlySavingRecommendation:0, igicWarning: '' },
        };
    };

    const [currentSim, setCurrentSim] = useState<TaxSimulation>(getInitialState());
    const [activeTab, setActiveTab] = useState<'data' | 'results' | 'planning'>('data');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAdvice, setAiAdvice] = useState<string>('');

    const handleCalculate = () => {
        const result = calculateTaxResult(currentSim, config);
        setCurrentSim(prev => ({ ...prev, result }));
        setActiveTab('results');
        if (!aiAdvice) handleGetAdvice(result);
    };

    const handleGetAdvice = async (resultContext: TaxSimulationResult) => {
        setIsAnalyzing(true);
        try {
            const simulationData = JSON.stringify({ activities: currentSim.activities, deductions: currentSim.deductions, result: resultContext }, null, 2);
            const advice = await getSpecificTaxAdvice(simulationData);
            setAiAdvice(advice);
        } catch (error) {
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={onCancel}><IconArrowLeft className="w-5 h-5 mr-2" /> Salir</Button>
                <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                    <button onClick={() => setActiveTab('data')} className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-primary text-black' : 'text-slate-400 hover:text-white'}`}>Datos</button>
                    <button onClick={() => { handleCalculate(); setActiveTab('results'); }} className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'results' ? 'bg-primary text-black' : 'text-slate-400 hover:text-white'}`}>Resultados</button>
                    <button onClick={() => setActiveTab('planning')} className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-primary text-black' : 'text-slate-400 hover:text-white'}`}>Planificación</button>
                </div>
                <Button onClick={() => onSave(currentSim)}>Guardar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nombre de la Simulación" value={currentSim.name} onChange={(e) => setCurrentSim({...currentSim, name: e.target.value})} />
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Año Fiscal</label>
                    <select value={currentSim.year} onChange={(e) => setCurrentSim({...currentSim, year: Number(e.target.value)})} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100">
                        {[0, 1, 2].map(offset => { const year = new Date().getFullYear() - 1 + offset; return <option key={year} value={year}>{year}</option> })}
                    </select>
                </div>
            </div>

            {activeTab === 'data' && (
                <>
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Ingresos y Gastos</h3>
                            <Button size="sm" onClick={() => setCurrentSim(prev => ({ ...prev, activities: [...prev.activities, { id: crypto.randomUUID(), type: 'Otros', name: 'Nueva Actividad', grossIncome: 0, deductibleExpenses: 0, retentionsApplied: 0, isIGICApplicable: false }] }))}><IconPlus className="w-4 h-4 mr-2"/> Añadir</Button>
                        </div>
                        <div className="space-y-4">
                            {currentSim.activities.map(act => (
                                <ActivityForm key={act.id} activity={act} onChange={(updated) => setCurrentSim(prev => ({ ...prev, activities: prev.activities.map(a => a.id === updated.id ? updated : a) }))} onDelete={() => setCurrentSim(prev => ({ ...prev, activities: prev.activities.filter(a => a.id !== act.id) }))} />
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="text-lg font-bold text-white mb-4">Pagos Fraccionados (Modelo 130)</h3>
                        <Input label="Pagos ya realizados (€)" type="number" value={currentSim.paymentsOnAccount} onChange={(e) => setCurrentSim({...currentSim, paymentsOnAccount: parseFloat(e.target.value) || 0})} />
                    </Card>
                </>
            )}

            {activeTab === 'results' && (
                <>
                    <TaxResultsView result={currentSim.result} simulationName={currentSim.name} />
                    <Card className="mt-6 border-l-4 border-primary/50">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><IconSparkles className="w-6 h-6 text-primary"/>Análisis Fiscal IA</h3><Button variant="ghost" size="sm" onClick={() => handleGetAdvice(currentSim.result)} disabled={isAnalyzing}><IconRefresh className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /></Button></div>
                        {aiAdvice ? <div className="prose prose-sm prose-invert max-w-none text-slate-300"><ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAdvice}</ReactMarkdown></div> : <p className="text-slate-400 italic">Generando consejos...</p>}
                    </Card>
                </>
            )}

            {activeTab === 'planning' && (
                <TaxPaymentPlanner simulation={currentSim} onUpdate={(updatedSim) => { setCurrentSim(updatedSim); onSave(updatedSim); }} />
            )}
        </div>
    );
};

const HaciendaPage: React.FC = () => {
    const { taxSimulations, taxConfig, addTaxSimulation, updateTaxSimulation, deleteTaxSimulation } = useApp();
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [selectedSim, setSelectedSim] = useState<TaxSimulation | null>(null);
    const [simulationToDelete, setSimulationToDelete] = useState<TaxSimulation | null>(null);

    const handleSave = (sim: TaxSimulation) => {
        if (selectedSim) updateTaxSimulation(sim);
        else addTaxSimulation(sim);
        setView('list');
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3"><IconBuildingBank className="w-8 h-8"/>Hacienda y Fiscalidad</h1>

            {view === 'list' && (
                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Mis Simulaciones Fiscales</h2>
                        <Button onClick={() => { setSelectedSim(null); setView('editor'); }}><IconPlus className="w-5 h-5 mr-2"/> Nueva Simulación</Button>
                    </div>
                    {taxSimulations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {taxSimulations.map(sim => {
                                const totalToPay = sim.result.totalToPay;
                                const totalContributed = (sim.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
                                const progress = totalToPay > 0 ? (totalContributed / totalToPay) * 100 : 0;
                                const status = getDeadlineStatus(sim.year);

                                return (
                                <div key={sim.id} className="bg-slate-700/50 p-4 rounded-lg border border-slate-700 hover:border-primary transition-all cursor-pointer group" onClick={() => { setSelectedSim(sim); setView('editor'); }}>
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors truncate">{sim.name}</h3>
                                            <p className="text-xs text-slate-400 uppercase font-bold">Ejercicio {sim.year}</p>
                                        </div>
                                        <span className={`flex-shrink-0 px-2 py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase shadow-sm border border-current/10 ${status.bg} ${status.color}`}>
                                            {status.icon} {status.label}
                                        </span>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-end">
                                        <div><p className="text-[10px] text-slate-400 uppercase">Estimación</p><p className={`text-lg font-bold ${totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>{totalToPay > 0 ? 'A PAGAR' : 'A DEVOLVER'}</p></div>
                                        <p className={`text-xl md:text-2xl font-mono font-black ${totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>{formatCurrency(Math.abs(totalToPay))}</p>
                                    </div>
                                    {totalToPay > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                                <span className="flex items-center gap-1"><IconPiggyBank className="w-3 h-3 text-info"/> Reserva</span>
                                                <span>{progress.toFixed(0)}%</span>
                                            </div>
                                            <ProgressBar value={Math.min(progress, 100)} colorClass={status.months <= 2 && progress < 100 ? "bg-danger" : "bg-info"} />
                                        </div>
                                    )}
                                    <div className="mt-3 text-right">
                                        <button onClick={(e) => { e.stopPropagation(); setSimulationToDelete(sim); }} className="text-slate-500 hover:text-danger p-1"><IconTrash className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400">No tienes simulaciones guardadas.</div>
                    )}
                </Card>
            )}

            {view === 'editor' && <SimulationEditor simulation={selectedSim} config={taxConfig} onSave={handleSave} onCancel={() => setView('list')} />}

            <ConfirmationModal isOpen={!!simulationToDelete} onClose={() => setSimulationToDelete(null)} onConfirm={() => { deleteTaxSimulation(simulationToDelete!.id); setSimulationToDelete(null); }} title="Eliminar Simulación">
                <p>¿Seguro que quieres eliminar <span className="font-bold">{simulationToDelete?.name}</span>?</p>
            </ConfirmationModal>
        </div>
    );
};

export default HaciendaPage;
