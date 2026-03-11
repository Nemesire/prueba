import React, { useState, useMemo, useEffect, ReactNode } from 'react';
import { Card, Input, Button, Modal, ConfirmationModal } from './common/UIComponents.tsx';
import { IconBuildingOffice, IconPlus, IconPencil, IconTrash, IconEye, IconInformationCircle, IconSparkles, IconRefresh, IconArrowDown, IconArrowUp } from '../constants.tsx';
import { PropertyInvestment } from '../types.ts';
import { useApp } from '../context/AppContext.tsx';
import { analyzePropertyInvestment } from '../services/geminiService.ts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types & Helpers ---
const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const ITP_RATES: Record<string, number> = {
    'País Vasco': 0.04, 'Madrid': 0.06, 'Cataluña': 0.10, 'Andalucía': 0.07,
    'Comunidad Valenciana': 0.10, 'Canarias': 0.07, 'Galicia': 0.10, 'Default': 0.08
};
const AUTONOMOUS_COMMUNITIES = Object.keys(ITP_RATES).filter(k => k !== 'Default');

const usePropertyCalculations = (inputs: PropertyInvestment | null, scenario: 'prudent' | 'optimistic') => {
    return useMemo(() => {
        if (!inputs) return null;

        const scenarioVacancyMonths = scenario === 'prudent' ? inputs.vacancyMonths : 0;
        const scenarioMaintenance = scenario === 'prudent' ? inputs.maintenance : inputs.maintenance * 0.5;

        const itpRate = ITP_RATES[inputs.community] || ITP_RATES['Default'];
        const itpAmount = inputs.purchasePrice * itpRate;
        const totalPurchaseExpenses = itpAmount + inputs.notaryFees + inputs.registryFees + inputs.reforms + inputs.agencyCommission;
        const totalMortgageExpenses = inputs.managementFees + inputs.appraisalFees;
        const totalUpfrontExpenses = totalPurchaseExpenses + totalMortgageExpenses;

        const mortgageAmount = inputs.purchasePrice * (inputs.financingPercentage / 100);
        const ownCapitalNeeded = (inputs.purchasePrice + totalUpfrontExpenses) - mortgageAmount;

        const monthlyInterestRate = (inputs.interestRate / 100) / 12;
        const numberOfPayments = inputs.loanTermYears * 12;
        let monthlyMortgagePayment = 0;
        if (monthlyInterestRate > 0 && numberOfPayments > 0) {
            monthlyMortgagePayment = mortgageAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
        } else if (numberOfPayments > 0) {
            monthlyMortgagePayment = mortgageAmount / numberOfPayments;
        }
        const annualMortgagePayment = monthlyMortgagePayment * 12;

        let firstYearInterest = 0;
        let balance = mortgageAmount;
        for (let i = 0; i < 12 && i < numberOfPayments; i++) {
            const interestPayment = balance * monthlyInterestRate;
            firstYearInterest += interestPayment;
            balance -= (monthlyMortgagePayment - interestPayment);
        }
        
        const annualGrossRent = inputs.monthlyRent * 12;
        const vacancyCost = inputs.monthlyRent * scenarioVacancyMonths;
        const annualOperatingExpenses = inputs.communityExpenses + scenarioMaintenance + inputs.homeInsurance + inputs.mortgageLifeInsurance + inputs.nonPaymentInsurance + inputs.ibi + vacancyCost;
        const totalAnnualExpenses = annualOperatingExpenses + firstYearInterest;

        const profitBeforeTax = annualGrossRent - totalAnnualExpenses;
        const annualCashFlow = annualGrossRent - annualOperatingExpenses - annualMortgagePayment;
        const monthlyCashFlow = annualCashFlow / 12;

        const buildingValueForAmortization = inputs.purchasePrice * 0.8; 
        const annualAmortization = buildingValueForAmortization * 0.03;
        const netProfitForTax = annualGrossRent - annualOperatingExpenses - firstYearInterest - annualAmortization;
        const taxReduction = netProfitForTax > 0 ? netProfitForTax * 0.60 : 0; 
        const taxableBase = netProfitForTax - taxReduction;
        const getIrpfRate = (salary: number) => {
            if (salary > 60000) return 0.45; if (salary > 35200) return 0.37;
            if (salary > 20200) return 0.30; return 0.19;
        };
        const irpfRate = getIrpfRate(inputs.annualGrossSalary);
        const taxOnProfit = taxableBase > 0 ? taxableBase * irpfRate : 0;
        const profitAfterTax = profitBeforeTax - taxOnProfit;

        const totalInvestment = inputs.purchasePrice + totalUpfrontExpenses;
        const grossYield = totalInvestment > 0 ? (annualGrossRent / totalInvestment) * 100 : 0;
        const netYield = totalInvestment > 0 ? (profitBeforeTax / totalInvestment) * 100 : 0;
        const roi = ownCapitalNeeded > 0 ? (annualCashFlow / ownCapitalNeeded) * 100 : 0;
        const recoveryYears = ownCapitalNeeded > 0 && annualCashFlow > 0 ? ownCapitalNeeded / annualCashFlow : Infinity;

        return {
            totalUpfrontExpenses, ownCapitalNeeded, monthlyMortgagePayment, annualCashFlow, monthlyCashFlow,
            grossYield, netYield, roi, profitBeforeTax, profitAfterTax, annualGrossRent, totalInvestment,
            recoveryYears,
        };
    }, [inputs, scenario]);
};

// --- Sub-Components ---

const PropertyCard: React.FC<{
    investment: PropertyInvestment;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ investment, onView, onEdit, onDelete }) => {
    const calculations = usePropertyCalculations(investment, 'prudent');

    if (!calculations) return null;

    return (
        <Card>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-white flex-1 pr-2">{investment.name}</h3>
                <div className="flex-shrink-0 flex items-center gap-1">
                    <button onClick={onView} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-700"><IconEye className="w-5 h-5"/></button>
                    <button onClick={onEdit} className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-700"><IconPencil className="w-5 h-5"/></button>
                    <button onClick={onDelete} className="text-slate-400 hover:text-danger p-1.5 rounded-full hover:bg-slate-700"><IconTrash className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-4 text-center">
                <div>
                    <p className="text-sm text-slate-400 truncate">Rentabilidad Neta</p>
                    <p className="text-2xl font-bold text-primary">{calculations.netYield.toFixed(2)}%</p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">Recuperación</p>
                    <p className="text-2xl font-bold text-white">
                        {isFinite(calculations.recoveryYears) ? `${calculations.recoveryYears.toFixed(1)} años` : 'N/A'}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">ROI (Prudente)</p>
                    <p className="text-2xl font-bold text-primary">{calculations.roi.toFixed(2)}%</p>
                </div>
                <div>
                    <p className="text-sm text-slate-400">Cash Flow Mensual</p>
                    <p className={`text-2xl font-bold ${calculations.monthlyCashFlow >= 0 ? 'text-secondary' : 'text-danger'}`}>{formatCurrency(calculations.monthlyCashFlow)}</p>
                </div>
            </div>
        </Card>
    );
};

const AddEditPropertyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    investmentToEdit: PropertyInvestment | null;
}> = ({ isOpen, onClose, investmentToEdit }) => {
    const { addPropertyInvestment, updatePropertyInvestment } = useApp();
    const [inputs, setInputs] = useState<Omit<PropertyInvestment, 'id'>>(getInitialState());

    const itpRate = useMemo(() => ITP_RATES[inputs.community] || ITP_RATES['Default'], [inputs.community]);
    const itpAmount = useMemo(() => inputs.purchasePrice * itpRate, [inputs.purchasePrice, itpRate]);
    
    const mortgageAmount = useMemo(() => inputs.purchasePrice * (inputs.financingPercentage / 100), [inputs.purchasePrice, inputs.financingPercentage]);
    const totalUpfrontExpenses = useMemo(() => {
        return itpAmount + inputs.notaryFees + inputs.registryFees + inputs.reforms + inputs.agencyCommission + inputs.managementFees + inputs.appraisalFees;
    }, [itpAmount, inputs.notaryFees, inputs.registryFees, inputs.reforms, inputs.agencyCommission, inputs.managementFees, inputs.appraisalFees]);
    const ownCapitalNeeded = useMemo(() => (inputs.purchasePrice + totalUpfrontExpenses) - mortgageAmount, [inputs.purchasePrice, totalUpfrontExpenses, mortgageAmount]);


    function getInitialState(): Omit<PropertyInvestment, 'id'> {
        return {
            name: '', purchasePrice: 86000, community: 'País Vasco', notaryFees: 500, registryFees: 250,
            reforms: 3000, agencyCommission: 0, managementFees: 300, appraisalFees: 200,
            financingPercentage: 90, interestRate: 3.5, loanTermYears: 30, monthlyRent: 775,
            communityExpenses: 600, maintenance: 930, homeInsurance: 100, mortgageLifeInsurance: 150,
            nonPaymentInsurance: 465, ibi: 160, vacancyMonths: 0.6, annualGrossSalary: 35200,
        };
    }

    useEffect(() => {
        if (isOpen) {
            setInputs(investmentToEdit ? { ...investmentToEdit } : getInitialState());
        }
    }, [isOpen, investmentToEdit]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setInputs(prev => ({ ...prev, [name]: e.target.type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const handleCalculateRent = () => {
        const purchasePrice = inputs.purchasePrice;
        if (purchasePrice > 0) {
            const monthlyRent = purchasePrice * 0.01;
            setInputs(prev => ({ ...prev, monthlyRent: parseFloat(monthlyRent.toFixed(2)) }));
        }
    };
    
    const handleCalculateFee = (percentage: number, field: keyof typeof inputs) => {
        const purchasePrice = inputs.purchasePrice;
        if (purchasePrice > 0) {
            const fee = purchasePrice * percentage;
            setInputs(prev => ({ ...prev, [field]: parseFloat(fee.toFixed(2)) }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (investmentToEdit) {
            updatePropertyInvestment({ ...inputs, id: investmentToEdit.id });
        } else {
            addPropertyInvestment(inputs);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={investmentToEdit ? "Editar Inversión" : "Añadir Nueva Inversión"} size="xl">
            <form onSubmit={handleSubmit} className="space-y-8">
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4 border-b border-slate-700 pb-2">Información General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input className="md:col-span-3" label="Nombre de la Propiedad" type="text" name="name" value={inputs.name} onChange={handleInputChange} required />
                        <Input label="Precio de Compraventa (€)" type="number" name="purchasePrice" value={inputs.purchasePrice} onChange={handleInputChange} />
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Comunidad (ITP)</label>
                            <select name="community" value={inputs.community} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100">
                                {AUTONOMOUS_COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4 border-b border-slate-700 pb-2">Gastos de Adquisición</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="ITP (Calculado)"
                            type="number"
                            name="itp"
                            value={itpAmount.toFixed(2)}
                            readOnly
                            helperText={`Tasa del ${(itpRate * 100).toFixed(1)}% para ${inputs.community}`}
                        />
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="notaryFees" className="block text-sm font-medium text-slate-400">Gastos Notaría (€)</label>
                                <button type="button" onClick={() => handleCalculateFee(0.005, 'notaryFees')} className="text-xs text-primary hover:text-primary-hover font-semibold">Calcular 0.5%</button>
                            </div>
                            <input id="notaryFees" name="notaryFees" type="number" value={inputs.notaryFees} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="registryFees" className="block text-sm font-medium text-slate-400">Gastos Registro (€)</label>
                                <button type="button" onClick={() => handleCalculateFee(0.002, 'registryFees')} className="text-xs text-primary hover:text-primary-hover font-semibold">Calcular 0.2%</button>
                            </div>
                            <input id="registryFees" name="registryFees" type="number" value={inputs.registryFees} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" />
                        </div>
                        <Input label="Coste Reforma (€)" type="number" name="reforms" value={inputs.reforms} onChange={handleInputChange} />
                        <Input label="Comisión Agencia (€)" type="number" name="agencyCommission" value={inputs.agencyCommission} onChange={handleInputChange} />
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="managementFees" className="block text-sm font-medium text-slate-400">Gastos Gestoría (€)</label>
                                <button type="button" onClick={() => handleCalculateFee(0.001, 'managementFees')} className="text-xs text-primary hover:text-primary-hover font-semibold">Calcular 0.1%</button>
                            </div>
                            <input id="managementFees" name="managementFees" type="number" value={inputs.managementFees} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="appraisalFees" className="block text-sm font-medium text-slate-400">Gastos Tasación (€)</label>
                                <button type="button" onClick={() => handleCalculateFee(0.001, 'appraisalFees')} className="text-xs text-primary hover:text-primary-hover font-semibold">Calcular 0.1%</button>
                            </div>
                            <input id="appraisalFees" name="appraisalFees" type="number" value={inputs.appraisalFees} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" />
                        </div>
                    </div>
                </section>

                <section>
                     <h3 className="text-lg font-semibold text-primary mb-4 border-b border-slate-700 pb-2">Detalles de la Financiación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                        <Input label="% Financiado" type="number" name="financingPercentage" value={inputs.financingPercentage} onChange={handleInputChange} />
                        <Input label="Interés Anual (%)" type="number" name="interestRate" step="0.01" value={inputs.interestRate} onChange={handleInputChange} />
                        <Input label="Plazo Hipoteca (Años)" type="number" name="loanTermYears" value={inputs.loanTermYears} onChange={handleInputChange} />
                         <div className="md:col-span-3 bg-slate-700/50 p-4 rounded-lg text-center">
                            <p className="text-sm text-slate-300">Capital Propio Necesario (Entrada + Gastos)</p>
                            <p className="text-3xl font-bold text-primary">{formatCurrency(ownCapitalNeeded)}</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4 border-b border-slate-700 pb-2">Ingresos y Gastos Operativos Anuales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="monthlyRent" className="block text-sm font-medium text-slate-400">Alquiler Mensual (€)</label>
                                <button
                                    type="button"
                                    onClick={handleCalculateRent}
                                    className="text-xs text-primary hover:text-primary-hover font-semibold"
                                    title="Calcula el alquiler mensual como el 1% del precio de compraventa (una métrica común)."
                                >
                                    Calcular 1%
                                </button>
                            </div>
                            <input
                                id="monthlyRent"
                                name="monthlyRent"
                                type="number"
                                value={inputs.monthlyRent}
                                onChange={handleInputChange}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <Input label="Gastos Comunidad (€)" type="number" name="communityExpenses" value={inputs.communityExpenses} onChange={handleInputChange} />
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="maintenance" className="block text-sm font-medium text-slate-400">Mantenimiento (€)</label>
                                <button
                                    type="button"
                                    onClick={() => handleCalculateFee(0.01, 'maintenance')}
                                    className="text-xs text-primary hover:text-primary-hover font-semibold"
                                    title="Calcula el mantenimiento anual como el 1% del precio de compraventa (una estimación común para imprevistos y reparaciones)."
                                >
                                    Calcular 1%
                                </button>
                            </div>
                            <input
                                id="maintenance"
                                name="maintenance"
                                type="number"
                                value={inputs.maintenance}
                                onChange={handleInputChange}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <Input label="Seguro Hogar (€)" type="number" name="homeInsurance" value={inputs.homeInsurance} onChange={handleInputChange} />
                        <Input label="Seguro Vida Hipoteca (€)" type="number" name="mortgageLifeInsurance" value={inputs.mortgageLifeInsurance} onChange={handleInputChange} />
                        <Input label="Seguro Impago (€)" type="number" name="nonPaymentInsurance" value={inputs.nonPaymentInsurance} onChange={handleInputChange} />
                        <Input label="IBI (€)" type="number" name="ibi" value={inputs.ibi} onChange={handleInputChange} />
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4 border-b border-slate-700 pb-2">Variables de Análisis</h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <Input label="Meses de Vacancia/Año" type="number" name="vacancyMonths" step="0.1" value={inputs.vacancyMonths} onChange={handleInputChange} />
                        <Input label="Salario Bruto Anual (para IRPF)" type="number" name="annualGrossSalary" value={inputs.annualGrossSalary} onChange={handleInputChange} />
                    </div>
                </section>
                
                <div className="flex justify-end pt-6 border-t border-slate-700">
                    <Button variant="ghost" type="button" onClick={onClose} className="mr-4">Cancelar</Button>
                    <Button type="submit">{investmentToEdit ? 'Guardar Cambios' : 'Añadir Propiedad'}</Button>
                </div>
            </form>
        </Modal>
    );
};

const PropertyDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    investment: PropertyInvestment | null;
}> = ({ isOpen, onClose, investment }) => {
    const { updatePropertyInvestment } = useApp();
    const prudentCalculations = usePropertyCalculations(investment, 'prudent');
    const optimisticCalculations = usePropertyCalculations(investment, 'optimistic');
    const [aiVerdict, setAiVerdict] = useState<string>('');
    const [isGeneratingVerdict, setIsGeneratingVerdict] = useState<boolean>(false);
    const [isVerdictCollapsed, setIsVerdictCollapsed] = useState<boolean>(true);

    useEffect(() => {
        if (isOpen && investment) {
            setAiVerdict(investment.aiVerdict || '');
            setIsVerdictCollapsed(!!investment.aiVerdict);
        }
    }, [isOpen, investment]);

    const handleGenerateVerdict = async () => {
        if (!prudentCalculations || !investment || isGeneratingVerdict) return;
        setIsGeneratingVerdict(true);
        setIsVerdictCollapsed(false);
        setAiVerdict('');

        try {
            const metrics = {
                roi: prudentCalculations.roi,
                netYield: prudentCalculations.netYield,
                monthlyCashFlow: prudentCalculations.monthlyCashFlow,
                ownCapitalNeeded: prudentCalculations.ownCapitalNeeded,
                recoveryYears: prudentCalculations.recoveryYears,
                purchasePrice: investment.purchasePrice,
            };
            const verdict = await analyzePropertyInvestment(metrics);
            setAiVerdict(verdict);
            updatePropertyInvestment({ ...investment, aiVerdict: verdict });
        } catch (error) {
            console.error("Error generating AI verdict:", error);
            setAiVerdict("Hubo un error al generar el veredicto. Por favor, inténtalo de nuevo.");
        } finally {
            setIsGeneratingVerdict(false);
        }
    };

    if (!isOpen || !investment || !prudentCalculations || !optimisticCalculations) return null;
    
    // Recalculate values needed for breakdown tooltip
    const itpRate = ITP_RATES[investment.community] || ITP_RATES['Default'];
    const itpAmount = investment.purchasePrice * itpRate;
    const totalPurchaseExpenses = itpAmount + investment.notaryFees + investment.registryFees + investment.reforms + investment.agencyCommission;
    const totalMortgageExpenses = investment.managementFees + investment.appraisalFees;
    const totalUpfrontExpenses = totalPurchaseExpenses + totalMortgageExpenses;
    const mortgageAmount = investment.purchasePrice * (investment.financingPercentage / 100);

    const CapitalHelp = (
        <div>
            <p className="font-bold mb-2">Aportación Inicial + Gastos Totales</p>
            <p className="mb-2">Es el desembolso total que debes realizar para la compra, sumando la parte que no te financia el banco (entrada) y todos los costes asociados a la adquisición.</p>
            <ul className="space-y-1 text-xs mt-2">
                <li className="flex justify-between"><span>Entrada:</span> <strong>{formatCurrency(investment.purchasePrice - mortgageAmount)}</strong></li>
                <li className="flex justify-between"><span>Gastos Totales:</span> <strong>{formatCurrency(totalUpfrontExpenses)}</strong></li>
                <ul className="pl-4 text-slate-400">
                    <li className="flex justify-between"><span>ITP:</span> <span>{formatCurrency(itpAmount)}</span></li>
                    <li className="flex justify-between"><span>Notaría:</span> <span>{formatCurrency(investment.notaryFees)}</span></li>
                    <li className="flex justify-between"><span>Registro:</span> <span>{formatCurrency(investment.registryFees)}</span></li>
                    <li className="flex justify-between"><span>Reforma:</span> <span>{formatCurrency(investment.reforms)}</span></li>
                    <li className="flex justify-between"><span>Agencia:</span> <span>{formatCurrency(investment.agencyCommission)}</span></li>
                    <li className="flex justify-between"><span>Gestoría:</span> <span>{formatCurrency(investment.managementFees)}</span></li>
                    <li className="flex justify-between"><span>Tasación:</span> <span>{formatCurrency(investment.appraisalFees)}</span></li>
                </ul>
            </ul>
        </div>
    );
    
    const CashflowHelp = (
         <div>
            <p className="font-bold mb-2">¿Qué es el Cash Flow?</p>
            <p className="mb-2">Es el dinero real que te queda en el bolsillo tras pagar TODOS los gastos (hipoteca completa, impuestos, seguros, mantenimiento, etc.). Es la métrica clave para saber si la inversión se mantiene por sí sola.</p>
             <p className="mt-2 text-xs font-mono bg-slate-800 p-2 rounded">
                Ingresos Brutos Anuales<br/>
                - Gastos Operativos Anuales<br/>
                - Pago Anual de la Hipoteca<br/>
                <span className="border-t block border-slate-600 my-1"></span>
                = Cash Flow Anual
            </p>
        </div>
    );
    
    const MonthlyCashflowHelp = (
        <div>
           <p className="font-bold mb-2">¿Qué es el Cash Flow Mensual?</p>
           <p className="mb-2">Es la cantidad de dinero real que te queda en el bolsillo **cada mes** después de pagar la cuota de la hipoteca y la parte proporcional de todos los gastos anuales (IBI, seguros, comunidad, etc.).</p>
            <p className="mt-2 text-xs font-mono bg-slate-800 p-2 rounded">
               Alquiler Mensual<br/>
               - Gastos Operativos Mensuales<br/>
               - Cuota Mensual Hipoteca<br/>
               <span className="border-t block border-slate-600 my-1"></span>
               = Cash Flow Mensual
           </p>
       </div>
    );

    const ROIHelp = (
        <div>
            <p className="font-bold mb-2">¿Qué es el ROI (Retorno sobre la Inversión)?</p>
            <p className="mb-2">Esta métrica mide la rentabilidad real de tu inversión, comparando el dinero que te queda en el bolsillo cada año (Cash Flow Anual) con la cantidad total de dinero que tú has aportado (Capital Propio Necesario).</p>
            <p className="mt-2 text-xs font-mono bg-slate-800 p-2 rounded">
                (Cash Flow Anual / Capital Propio Necesario) * 100
            </p>
        </div>
    );
    
    const ResultRow: React.FC<{label: string; value: string; help?: ReactNode}> = ({label, value, help}) => (
        <div className="flex justify-between items-center py-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
                <span className="text-slate-300">{label}</span>
                {help && (
                    <div className="group relative flex items-center">
                        <IconInformationCircle className="w-4 h-4 text-slate-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                            {help}
                        </div>
                    </div>
                )}
            </div>
            <span className="font-semibold text-white font-mono">{value}</span>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Análisis de ${investment.name}`} size="lg">
            <Card className="mb-6 bg-slate-900 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4 text-center">Factores Clave de Decisión</h3>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-600">
                            <th className="p-2 font-semibold text-slate-300">Métrica</th>
                            <th className="p-2 font-semibold text-slate-300 text-center">Escenario Prudente</th>
                            <th className="p-2 font-semibold text-slate-300 text-center">Escenario Optimista</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-700/50">
                            <td className="p-2 text-slate-300">
                                <div className="flex items-center gap-2">
                                    <span>Cash Flow Mensual</span>
                                    <div className="group relative flex items-center">
                                        <IconInformationCircle className="w-4 h-4 text-slate-500 cursor-help" />
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 p-3 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                                            {MonthlyCashflowHelp}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className={`p-2 text-center font-bold font-mono ${prudentCalculations.monthlyCashFlow >= 0 ? 'text-secondary' : 'text-danger'}`}>{formatCurrency(prudentCalculations.monthlyCashFlow)}</td>
                            <td className={`p-2 text-center font-bold font-mono ${optimisticCalculations.monthlyCashFlow >= 0 ? 'text-secondary' : 'text-danger'}`}>{formatCurrency(optimisticCalculations.monthlyCashFlow)}</td>
                        </tr>
                        <tr className="border-b border-slate-700/50">
                            <td className="p-2 text-slate-300">Cash Flow Anual</td>
                            <td className={`p-2 text-center font-bold font-mono ${prudentCalculations.annualCashFlow >= 0 ? 'text-secondary' : 'text-danger'}`}>{formatCurrency(prudentCalculations.annualCashFlow)}</td>
                            <td className={`p-2 text-center font-bold font-mono ${optimisticCalculations.annualCashFlow >= 0 ? 'text-secondary' : 'text-danger'}`}>{formatCurrency(optimisticCalculations.annualCashFlow)}</td>
                        </tr>
                        <tr>
                            <td className="p-2 text-slate-300">Rentabilidad Neta</td>
                            <td className="p-2 text-center font-bold font-mono text-primary">{`${prudentCalculations.netYield.toFixed(2)}%`}</td>
                            <td className="p-2 text-center font-bold font-mono text-primary">{`${optimisticCalculations.netYield.toFixed(2)}%`}</td>
                        </tr>
                    </tbody>
                </table>
            </Card>

            <h3 className="text-xl font-bold text-white mb-4">Desglose Detallado (Escenario Prudente)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <h4 className="text-lg font-bold text-primary col-span-full mt-2">Resumen de Inversión</h4>
                <ResultRow label="Capital Propio Necesario" value={formatCurrency(prudentCalculations.ownCapitalNeeded)} help={CapitalHelp} />
                <ResultRow label="Alquiler Mensual" value={formatCurrency(investment.monthlyRent)} />
                <ResultRow label="Hipoteca Mensual" value={formatCurrency(prudentCalculations.monthlyMortgagePayment)} />
                <ResultRow label="Coste Total Compra" value={formatCurrency(prudentCalculations.totalInvestment)} />
                <ResultRow label="Gastos Iniciales Totales" value={formatCurrency(prudentCalculations.totalUpfrontExpenses)} />

                <h4 className="text-lg font-bold text-primary col-span-full mt-4">Resultados Anuales</h4>
                <ResultRow label="Cash Flow Anual" value={formatCurrency(prudentCalculations.annualCashFlow)} help={CashflowHelp} />
                <ResultRow label="Beneficio (Antes Imp.)" value={formatCurrency(prudentCalculations.profitBeforeTax)} />
                <ResultRow label="Beneficio (Después Imp.)" value={formatCurrency(prudentCalculations.profitAfterTax)} />
                <ResultRow label="Ingresos Brutos Alquiler" value={formatCurrency(prudentCalculations.annualGrossRent)} />

                <h4 className="text-lg font-bold text-primary col-span-full mt-4">Métricas de Rentabilidad</h4>
                <ResultRow label="ROI (s/Capital Propio)" value={`${prudentCalculations.roi.toFixed(2)}%`} help={ROIHelp} />
                <ResultRow label="Rentabilidad Neta" value={`${prudentCalculations.netYield.toFixed(2)}%`} />
                <ResultRow label="Rentabilidad Bruta" value={`${prudentCalculations.grossYield.toFixed(2)}%`} />
            </div>

            <Card className="mt-6 bg-slate-900 border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <IconSparkles className="w-6 h-6 text-primary"/>
                        Veredicto IA
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleGenerateVerdict} disabled={isGeneratingVerdict}>
                            <IconRefresh className={`w-4 h-4 ${isGeneratingVerdict ? 'animate-spin' : ''}`} />
                            <span className="ml-2">{investment.aiVerdict ? 'Actualizar Veredicto' : 'Generar Veredicto'}</span>
                        </Button>
                        {aiVerdict && (
                            <button onClick={() => setIsVerdictCollapsed(prev => !prev)} className="p-2 text-slate-400 hover:text-white">
                                {isVerdictCollapsed ? <IconArrowDown className="w-5 h-5"/> : <IconArrowUp className="w-5 h-5"/>}
                            </button>
                        )}
                    </div>
                </div>
                {!isVerdictCollapsed && (
                    <div>
                        {isGeneratingVerdict && (
                            <div className="text-center py-8">
                                <p className="text-slate-400 animate-pulse">Analizando la inversión...</p>
                            </div>
                        )}
                        {aiVerdict && !isGeneratingVerdict && (
                            <div className="prose prose-sm prose-invert max-w-none text-slate-300 pt-3 border-t border-slate-700">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiVerdict}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            <div className="flex justify-end mt-6">
                <Button onClick={onClose}>Cerrar</Button>
            </div>
        </Modal>
    );
};


// --- Main Page Component ---
const PropertyProfitabilityPage: React.FC = () => {
    const { propertyInvestments, deletePropertyInvestment } = useApp();
    const [modalState, setModalState] = useState<{ mode: 'add' | 'edit' | 'details' | 'delete' | 'closed'; investment: PropertyInvestment | null }>({ mode: 'closed', investment: null });

    const openModal = (mode: 'add' | 'edit' | 'details' | 'delete', investment: PropertyInvestment | null = null) => {
        setModalState({ mode, investment });
    };
    const closeModal = () => setModalState({ mode: 'closed', investment: null });

    const handleConfirmDelete = () => {
        if (modalState.mode === 'delete' && modalState.investment) {
            deletePropertyInvestment(modalState.investment.id);
        }
        closeModal();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <IconBuildingOffice className="w-8 h-8"/>
                    Rentabilidad de Inmuebles
                </h1>
                <Button onClick={() => openModal('add')}><IconPlus className="w-5 h-5 mr-2" /> Añadir Propiedad</Button>
            </div>

            {propertyInvestments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {propertyInvestments.map(inv => (
                        <PropertyCard
                            key={inv.id}
                            investment={inv}
                            onView={() => openModal('details', inv)}
                            onEdit={() => openModal('edit', inv)}
                            onDelete={() => openModal('delete', inv)}
                        />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-20">
                    <IconBuildingOffice className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                    <h2 className="text-2xl font-bold text-white">Analiza y compara tus inversiones</h2>
                    <p className="text-slate-400 mt-2 max-w-md mx-auto">
                        Añade propiedades para calcular su rentabilidad, cash flow y ROI. Guarda tus análisis para tener un portfolio completo.
                    </p>
                    <Button className="mt-6" onClick={() => openModal('add')}>Añadir tu primera propiedad</Button>
                </Card>
            )}

            <AddEditPropertyModal
                isOpen={modalState.mode === 'add' || modalState.mode === 'edit'}
                onClose={closeModal}
                investmentToEdit={modalState.investment}
            />

            <PropertyDetailsModal
                isOpen={modalState.mode === 'details'}
                onClose={closeModal}
                investment={modalState.investment}
            />
            
            <ConfirmationModal
                isOpen={modalState.mode === 'delete'}
                onClose={closeModal}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar el análisis de <span className="font-bold">{modalState.investment?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
};

export default PropertyProfitabilityPage;