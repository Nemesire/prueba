import React, { useMemo, ReactNode, useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card, ProgressBar, Input, Button, ConfirmationModal } from './common/UIComponents.tsx';
import { IconAcademicCap, IconInformationCircle, IconPlus, IconTrash, IconPencil, IconSparkles } from '../constants.tsx';
import { Credit, TransactionType, FinancialSimulation, ChatMessage } from '../types.ts';
import { getInvestmentAdvice } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


// Helper function to format currency
const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

// Helper function to calculate remaining credit amount
const calculateRemainingAmount = (credit: Credit): number => {
    const startDate = new Date(credit.startDate);
    const today = new Date();
    const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    if (monthsPassed <= 0) return credit.totalAmount;

    const monthlyInterestRate = credit.tin / 100 / 12;
    let remainingBalance = credit.totalAmount;
    for (let i = 0; i < monthsPassed; i++) {
        const interestForMonth = remainingBalance * monthlyInterestRate;
        const principalPaid = credit.monthlyPayment - remainingBalance * monthlyInterestRate;
        remainingBalance -= principalPaid;
        if (remainingBalance < 0) {
            remainingBalance = 0;
            break;
        }
    }
    const endDate = new Date(credit.endDate);
    if (today > endDate) return 0;
    return remainingBalance > 0 ? remainingBalance : 0;
};

const InfoTooltip: React.FC<{ children: ReactNode }> = ({ children }) => (
    <div className="group relative flex items-center">
        <IconInformationCircle className="w-5 h-5 text-slate-500 cursor-help" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
            {children}
        </div>
    </div>
);

const InvestmentCoach: React.FC = () => {
    const { transactions, credits, goals, receipts, insurancePolicies, propertyInvestments } = useApp();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: crypto.randomUUID(), role: 'model', text: '¡Hola! Soy tu coach de inversión. Estoy aquí para ayudarte a entender conceptos clave y guiarte en tus primeros pasos. ¿Sobre qué te gustaría aprender hoy?' }
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
            const result = await getInvestmentAdvice(currentQuery, financialData, chatHistory);
            setMessages(prev => prev.slice(0, -1).concat({ id: crypto.randomUUID(), role: 'model', text: result }));
        } catch (error) {
            console.error("Error communicating with Investment Coach AI:", error);
            const errorMessage = "Lo siento, ha ocurrido un error al generar la respuesta. Por favor, inténtalo de nuevo.";
            setMessages(prev => prev.slice(0, -1).concat({ id: crypto.randomUUID(), role: 'model', text: errorMessage }));
        } finally {
            setIsLoading(false);
        }
    };
    
    const promptStarters = [
        "¿Qué es un fondo indexado?",
        "Explícame qué son los ETFs.",
        "¿Por dónde debería empezar a invertir si soy principiante?",
        "¿Qué es la diversificación y por qué es importante?",
    ];

    return (
        <Card>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <IconSparkles className="w-7 h-7 text-secondary"/>
                Coach de Inversión IA
            </h2>
            <p className="text-slate-400 mb-4">Haz preguntas sobre inversión para principiantes. El coach usará tus datos financieros para darte consejos educativos y personalizados.</p>
            
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
                            {msg.role === 'model' && <IconAcademicCap className="w-6 h-6 text-secondary flex-shrink-0 mt-1" />}
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
                            id="investment-coach-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ej: ¿Qué es el interés compuesto?"
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


const FinancialFreedomPage: React.FC = () => {
    const {
        transactions,
        credits,
        propertyInvestments,
        financialSimulations,
        addFinancialSimulation,
        updateFinancialSimulation,
        deleteFinancialSimulation,
    } = useApp();
    
    const [activeSimulation, setActiveSimulation] = useState<FinancialSimulation | null>(null);
    const [simulationToDelete, setSimulationToDelete] = useState<FinancialSimulation | null>(null);


    useEffect(() => {
        if (!activeSimulation && financialSimulations.length > 0) {
            setActiveSimulation(financialSimulations[0]);
        }
    }, [financialSimulations, activeSimulation]);

    const handleNewSimulation = () => {
        const newSim: FinancialSimulation = {
            id: `new-${crypto.randomUUID()}`,
            name: `Nueva Simulación ${financialSimulations.length + 1}`,
            monthlyIncome: 3000,
            inflationRate: 3,
            projectionYears: 10,
            currentAmount: 0,
        };
        setActiveSimulation(newSim);
    };

    const handleSaveSimulation = () => {
        if (!activeSimulation) return;

        if (activeSimulation.id.startsWith('new-')) {
            const { id, ...newSimData } = activeSimulation;
            addFinancialSimulation(newSimData);
        } else {
            updateFinancialSimulation(activeSimulation);
        }
    };
    
    const handleDeleteClick = (sim: FinancialSimulation) => {
        if (!sim.id.startsWith('new-')) {
            setSimulationToDelete(sim);
        }
    }

    const handleConfirmDelete = () => {
        if (simulationToDelete) {
            deleteFinancialSimulation(simulationToDelete.id);
            if(activeSimulation?.id === simulationToDelete.id) {
                setActiveSimulation(financialSimulations.length > 1 ? financialSimulations.find(s => s.id !== simulationToDelete.id) || null : null);
            }
            setSimulationToDelete(null);
        }
    };

    const financialData = useMemo(() => {
        const savings = transactions
            .filter(t => t.type === TransactionType.SAVING)
            .reduce((sum, t) => sum + t.amount, 0);
        const savingsWithdrawals = transactions
            .filter(t => t.category === 'Retiro de Ahorros')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalSavings = savings - savingsWithdrawals;

        const investments = 0; // Placeholder for future investment tracking
        const assets = totalSavings + investments;
        const liabilities = credits.reduce((sum, c) => sum + calculateRemainingAmount(c), 0);
        const netWorth = assets - liabilities;

        const passiveIncome = (propertyInvestments || [])
            .reduce((sum, p) => {
                const annualRent = p.monthlyRent * (12 - p.vacancyMonths);
                const annualExpenses = p.communityExpenses + p.maintenance + p.homeInsurance + p.mortgageLifeInsurance + p.nonPaymentInsurance + p.ibi;
                const mortgageAmount = p.purchasePrice * (p.financingPercentage / 100);
                const monthlyInterestRate = (p.interestRate / 100) / 12;
                const numberOfPayments = p.loanTermYears * 12;
                let monthlyMortgagePayment = 0;
                if (monthlyInterestRate > 0 && numberOfPayments > 0) {
                    monthlyMortgagePayment = mortgageAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
                }
                const annualMortgage = monthlyMortgagePayment * 12;
                return sum + (annualRent - annualExpenses - annualMortgage);
            }, 0);
        const monthlyPassiveIncome = passiveIncome / 12;
        
        // Use active simulation to calculate FIRE data
        let fireNumber = 0;
        let fireProgress = 0;

        if (activeSimulation) {
            const monthlyLifestyleCost = activeSimulation.monthlyIncome * 0.80; // Needs + Wants
            const annualLifestyleCost = monthlyLifestyleCost * 12;
            const futureAnnualCost = annualLifestyleCost * Math.pow(1 + (activeSimulation.inflationRate / 100), activeSimulation.projectionYears);
            fireNumber = futureAnnualCost * 25; // 4% rule
            fireProgress = fireNumber > 0 ? (netWorth / fireNumber) * 100 : 0;
        }

        return { netWorth, monthlyPassiveIncome, fireNumber, fireProgress };
    }, [transactions, credits, propertyInvestments, activeSimulation]);

    const budget = useMemo(() => {
        if (!activeSimulation) return { needs: 0, wants: 0, savings: 0 };
        const income = activeSimulation.monthlyIncome;
        return {
            needs: income * 0.5,
            wants: income * 0.3,
            savings: income * 0.2,
        };
    }, [activeSimulation]);

    const fireCalculation = useMemo(() => {
        if (!activeSimulation) return { monthlyLifestyleCost: 0, annualLifestyleCost: 0, futureAnnualCost: 0, fireNumber: 0 };
        const monthlyLifestyleCost = activeSimulation.monthlyIncome * 0.80; // Needs (50%) + Wants (30%)
        const annualLifestyleCost = monthlyLifestyleCost * 12;
        const futureAnnualCost = annualLifestyleCost * Math.pow(1 + (activeSimulation.inflationRate / 100), activeSimulation.projectionYears);
        const fireNumber = futureAnnualCost * 25;

        return { monthlyLifestyleCost, annualLifestyleCost, futureAnnualCost, fireNumber };
    }, [activeSimulation]);

    const isDirty = useMemo(() => {
        if (!activeSimulation || activeSimulation.id.startsWith('new-')) return false;
        const originalSim = financialSimulations.find(s => s.id === activeSimulation.id);
        if (!originalSim) return false;
        return JSON.stringify(originalSim) !== JSON.stringify(activeSimulation);
    }, [activeSimulation, financialSimulations]);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <IconAcademicCap className="w-8 h-8"/>
                    Libertad Financiera
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-300">Patrimonio Neto</h3>
                        <InfoTooltip>Suma de tus ahorros e inversiones menos tus deudas. Es tu foto financiera actual.</InfoTooltip>
                    </div>
                    <p className="text-3xl font-bold text-white mt-2">{formatCurrency(financialData.netWorth)}</p>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-300">Regla del 4% (Tu Objetivo FIRE)</h3>
                        <InfoTooltip>
                            Esta es la cantidad total que necesitas tener <strong>invertida</strong> para poder retirarte. La regla dice que puedes retirar el 4% de este capital cada año y, gracias al rendimiento promedio del mercado (ej. 10% en el S&P 500), tu dinero no solo no se acabará, sino que seguirá creciendo para combatir la inflación. Es el dinero que necesitas para vivir de tus inversiones.
                        </InfoTooltip>
                    </div>
                    <p className="text-3xl font-bold text-primary mt-2">{formatCurrency(financialData.fireNumber)}</p>
                </Card>
                <Card className="md:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-300">Progreso FIRE</h3>
                        <InfoTooltip>El porcentaje de tu Número FIRE que has alcanzado con tu patrimonio neto actual.</InfoTooltip>
                    </div>
                    <ProgressBar value={financialData.fireProgress} colorClass="bg-primary" />
                    <p className="text-right font-semibold text-white mt-1">{financialData.fireProgress.toFixed(2)}%</p>
                </Card>
            </div>

            <Card>
                 <h2 className="text-2xl font-bold text-white mb-4">Simulador de Estilo de Vida y FIRE</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="font-semibold text-slate-200">Mis Simulaciones</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                           {financialSimulations.map(sim => (
                            <div key={sim.id} className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${activeSimulation?.id === sim.id ? 'bg-primary/20 ring-1 ring-primary' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                <button className="flex-grow text-left" onClick={() => setActiveSimulation(sim)}>
                                    <p className="font-medium text-slate-100">{sim.name}</p>
                                </button>
                                <button onClick={() => handleDeleteClick(sim)} className="p-2 text-slate-400 hover:text-danger flex-shrink-0"><IconTrash className="w-4 h-4" /></button>
                            </div>
                           ))}
                        </div>
                        <Button variant="ghost" className="w-full" onClick={handleNewSimulation}><IconPlus className="w-5 h-5 mr-2"/> Nueva Simulación</Button>
                    </div>
                    
                    {activeSimulation ? (
                        <div className="lg:col-span-2 bg-slate-900/50 p-4 rounded-lg space-y-6">
                            <div>
                                <h3 className="font-semibold text-slate-200 mb-3 text-lg">Editor de Simulación</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Nombre de la Simulación" value={activeSimulation.name} onChange={e => setActiveSimulation(s => s ? {...s, name: e.target.value} : null)} />
                                    <Input label="Ingresos Mensuales Totales" type="number" helperText="Suma tus ingresos y los de tu pareja si aplica." value={activeSimulation.monthlyIncome} onChange={e => setActiveSimulation(s => s ? {...s, monthlyIncome: Number(e.target.value)} : null)}/>
                                    <Input label="Inflación Anual Estimada (%)" type="number" step="0.1" value={activeSimulation.inflationRate} onChange={e => setActiveSimulation(s => s ? {...s, inflationRate: Number(e.target.value)} : null)}/>
                                    <Input label="Años a Proyectar" type="number" value={activeSimulation.projectionYears} onChange={e => setActiveSimulation(s => s ? {...s, projectionYears: Number(e.target.value)} : null)}/>
                                </div>
                                <div className="text-right mt-4">
                                    <Button onClick={handleSaveSimulation} disabled={!isDirty && !activeSimulation.id.startsWith('new-')}>
                                        {activeSimulation.id.startsWith('new-') ? 'Guardar Simulación' : 'Actualizar Simulación'}
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-700 pt-6">
                                <h3 className="font-semibold text-slate-200 mb-3 text-lg">Resultados de la Simulación</h3>
                                
                                <div className="mb-6">
                                    <h4 className="font-medium text-slate-300 mb-2">Presupuesto Mensual (Regla 50/30/20)</h4>
                                    <div className="w-full bg-slate-700 rounded-full flex h-4 overflow-hidden mb-2">
                                        <div className="bg-info" style={{ width: '50%' }}></div>
                                        <div className="bg-danger" style={{ width: '30%' }}></div>
                                        <div className="bg-secondary" style={{ width: '20%' }}></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                                        <div className="bg-info/20 p-2 rounded">
                                            <div className="flex items-center justify-center gap-2">
                                                <p className="text-sm font-semibold text-info">50% Necesidades</p>
                                                <InfoTooltip>Gastos esenciales para vivir: alquiler/hipoteca, facturas (luz, agua, gas), comida, seguro médico, transporte básico, etc.</InfoTooltip>
                                            </div>
                                            <p className="font-bold text-white">{formatCurrency(budget.needs)}</p>
                                        </div>
                                        <div className="bg-danger/20 p-2 rounded">
                                             <div className="flex items-center justify-center gap-2">
                                                <p className="text-sm font-semibold text-danger">30% Deseos</p>
                                                <InfoTooltip>Gastos relacionados con tu estilo de vida y disfrute: viajes, ropa nueva, hobbies, salir a cenar, suscripciones, etc.</InfoTooltip>
                                            </div>
                                            <p className="font-bold text-white">{formatCurrency(budget.wants)}</p>
                                        </div>
                                        <div className="bg-secondary/20 p-2 rounded">
                                            <div className="flex items-center justify-center gap-2">
                                                <p className="text-sm font-semibold text-secondary">20% Ahorro</p>
                                                <InfoTooltip>Dinero destinado a tu futuro: fondo de emergencia, amortización de deudas, ahorro para metas e inversión.</InfoTooltip>
                                            </div>
                                            <p className="font-bold text-white">{formatCurrency(budget.savings)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium text-slate-300 mb-2">Cálculo de Número FIRE</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between p-2 bg-slate-800 rounded"><span>Coste de Vida Mensual (Necesidades + Deseos)</span><span className="font-bold">{formatCurrency(fireCalculation.monthlyLifestyleCost)}</span></div>
                                        <div className="flex justify-between p-2 bg-slate-800 rounded"><span>Coste de Vida Anual (Valor Actual)</span><span className="font-bold">{formatCurrency(fireCalculation.annualLifestyleCost)}</span></div>
                                        <div className="flex justify-between p-2 bg-slate-800 rounded"><span>Coste de Vida Anual (en {activeSimulation.projectionYears} años con {activeSimulation.inflationRate}% inflación)</span><span className="font-bold">{formatCurrency(fireCalculation.futureAnnualCost)}</span></div>
                                        <div className="flex justify-between p-3 bg-primary/20 rounded mt-2 text-lg">
                                            <span className="font-bold text-primary">Regla del 4% (Tu Objetivo FIRE)</span>
                                            <span className="font-bold text-primary">{formatCurrency(fireCalculation.fireNumber)}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 text-right">Esta es la cantidad que necesitas tener invertida para que el 4% de rendimiento anual cubra tu estilo de vida futuro.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-900/50 p-4 rounded-lg text-center">
                             <p className="text-slate-400">Selecciona una simulación para ver los detalles o crea una nueva para empezar a planificar.</p>
                        </div>
                    )}
                </div>
            </Card>

            <InvestmentCoach />

            <ConfirmationModal
                isOpen={!!simulationToDelete}
                onClose={() => setSimulationToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar la simulación <span className="font-bold">{simulationToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
};

export default FinancialFreedomPage;