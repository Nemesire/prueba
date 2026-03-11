import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { Modal, Button, Card, ProgressBar, Input } from './common/UIComponents.tsx';
import { IconLayout, NAV_ITEMS, IconSparkles, IconPiggyBank, IconTrophy, ACHIEVEMENT_DEFINITIONS, IconArrowUp, IconArrowDown, IconPlus, IconTrash, IconX, IconAcademicCap, IconBuildingBank, IconCalendar } from '../constants.tsx';
import { Alert, WidgetType, Transaction, TransactionType } from '../types.ts';
import { getAIFinancialSummary } from '../services/geminiService.ts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, ReferenceLine } from 'recharts';


// --- WIDGET DEFINITIONS ---

const ComprehensiveFinancialSummaryWidget: React.FC = () => {
    const { getExpandedTransactionsForYear } = useApp();
    
    const getInitialDates = () => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    };

    const [dateRange, setDateRange] = useState(getInitialDates());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const summaryData = useMemo(() => {
        const now = new Date();
        const currentUTCYear = now.getUTCFullYear();
        const lastYear = currentUTCYear - 1;

        const allTransactions = [
            ...getExpandedTransactionsForYear(currentUTCYear),
            ...getExpandedTransactionsForYear(lastYear)
        ];

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const data: any[] = [];
        const currentUTCMonth = now.getUTCMonth();

        // Last 5 months for bar/line charts
        for (let i = 4; i >= 0; i--) {
            const targetMonth = currentUTCMonth - i;
            const date = new Date(Date.UTC(currentUTCYear, targetMonth, 1));
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();

            const monthlyTransactions = allTransactions.filter(t => {
                if (t.isExcluded) return false;
                const tDate = new Date(t.date + 'T00:00:00Z');
                return tDate.getUTCFullYear() === year && tDate.getUTCMonth() === month;
            });

            const income = monthlyTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
            const expenses = monthlyTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);

            data.push({
                name: monthNames[month],
                Ingresos: income,
                Gastos: expenses,
                Ahorro: income - expenses,
            });
        }

        let accumulatedSavings = 0;
        const lineChartData = data.map(monthData => {
            accumulatedSavings += monthData.Ahorro;
            return { ...monthData, "Ahorro acumulado": accumulatedSavings };
        });

        // Expense distribution for selected date range
        const startDate = new Date(dateRange.start + 'T00:00:00Z');
        const endDate = new Date(dateRange.end + 'T23:59:59Z');

        const expenseDistribution = allTransactions
            .filter(t => {
                if (t.isExcluded || t.type !== TransactionType.EXPENSE) return false;
                const tDate = new Date(t.date + 'T00:00:00Z');
                return tDate >= startDate && tDate <= endDate;
            })
            .reduce((acc, t) => {
                const category = t.category || 'Sin categoría';
                acc[category] = (acc[category] || 0) + t.amount;
                return acc;
            }, {} as Record<string, number>);

        const pieChartData = Object.entries(expenseDistribution).map(([name, value]) => ({
            name,
            value,
        }));

        return { barChartData: data, lineChartData, pieChartData };
    }, [getExpandedTransactionsForYear, dateRange]);

    const PIE_COLORS = ['#F59E0B', '#3B82F6', '#22C55E', '#f87171', '#9CA3AF'];

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent * 100 < 5) return null;

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold text-sm">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <Card>
            <div className="mb-8">
                <h3 className="text-xl font-bold text-center mb-2 text-slate-200">Distribución de gastos</h3>
                <div className="flex flex-wrap justify-center items-center mb-4 gap-4 text-sm">
                    <label htmlFor="summaryStartDate" className="text-slate-400">Desde:</label>
                    <input type="date" id="summaryStartDate" name="start" value={dateRange.start} onChange={handleDateChange} className="bg-slate-700 border border-slate-600 rounded-md p-1 text-slate-100 text-xs focus:ring-primary focus:border-primary" />
                    <label htmlFor="summaryEndDate" className="text-slate-400">Hasta:</label>
                    <input type="date" id="summaryEndDate" name="end" value={dateRange.end} onChange={handleDateChange} className="bg-slate-700 border border-slate-600 rounded-md p-1 text-slate-100 text-xs focus:ring-primary focus:border-primary" />
                </div>
                 {summaryData.pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={summaryData.pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {summaryData.pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155' }} labelStyle={{ color: '#F1F5F9' }}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="text-center py-10 text-slate-500">No hay datos de gastos para mostrar en el periodo seleccionado.</div>
                 )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold text-center mb-4 text-slate-200">Ingresos vs Gastos</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={summaryData.barChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94A3B8" />
                            <YAxis stroke="#94A3B8" tickFormatter={(value: any) => `€${(Number(value)/1000).toFixed(0)}k`}/>
                            <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155' }} labelStyle={{ color: '#F1F5F9' }}/>
                            <Legend />
                            <Bar dataKey="Ingresos" fill="#4ade80" />
                            <Bar dataKey="Gastos" fill="#f87171" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-center mb-4 text-slate-200">Ahorro Acumulado</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={summaryData.lineChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                            <XAxis dataKey="name" stroke="#94A3B8"/>
                            <YAxis stroke="#94A3B8" tickFormatter={(value: any) => `€${(Number(value)/1000).toFixed(0)}k`}/>
                            <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155' }} labelStyle={{ color: '#F1F5F9' }}/>
                            <Legend />
                            <Line type="monotone" dataKey="Ahorro acumulado" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }}/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </Card>
    );
};

const CurrentMonthTrendsWidget: React.FC = () => {
    const { getExpandedTransactionsForYear } = useApp();

    const getInitialDates = () => {
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth();

        const defaultEndDate = new Date(Date.UTC(year, month, 25));
        const defaultStartDate = new Date(Date.UTC(year, month - 1, 26));
        
        return {
            start: defaultStartDate.toISOString().split('T')[0],
            end: defaultEndDate.toISOString().split('T')[0],
        };
    };

    const [dateRange, setDateRange] = useState(getInitialDates());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const trendsData = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];

        const startDateStr = dateRange.start;
        const endDateStr = dateRange.end;
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return [];

        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        let allExpandedTransactions: Transaction[] = [];
        
        for (let y = startYear; y <= endYear; y++) {
            allExpandedTransactions.push(...getExpandedTransactionsForYear(y));
        }

        const dailyNet: Record<string, number> = {};
        allExpandedTransactions.forEach(t => {
            if (t.isExcluded) return;
            if (t.date >= startDateStr && t.date <= endDateStr) {
                if (!dailyNet[t.date]) dailyNet[t.date] = 0;
                if (t.type === TransactionType.INCOME) {
                    dailyNet[t.date] += t.amount;
                } else if (t.type === TransactionType.EXPENSE) {
                    dailyNet[t.date] -= t.amount;
                }
            }
        });

        const data = [];
        const currentDate = new Date(startDate);
        const finalDate = new Date(endDate);
        let runningBalance = 0; 
        
        while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const netChange = dailyNet[dateStr] || 0;
            
            runningBalance += netChange;

            data.push({
                date: dateStr,
                day: `${currentDate.getDate()}/${currentDate.getMonth() + 1}`,
                balance: runningBalance,
                dailyChange: netChange
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return data;
    }, [dateRange, getExpandedTransactionsForYear]);

    const formatYAxis = (value: number) => {
        if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
        return String(Math.round(value));
    };

    const gradientOffset = () => {
        if (trendsData.length === 0) return 0;
        const dataMax = Math.max(...trendsData.map((i) => i.balance));
        const dataMin = Math.min(...trendsData.map((i) => i.balance));
        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;
        return dataMax / (dataMax - dataMin);
    };
      
    const off = gradientOffset();

    return (
        <Card className="overflow-hidden">
            <div className="flex flex-wrap justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="bg-primary/20 p-2 rounded-lg text-primary"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg></span>
                    Evolución del Saldo (Periodo)
                </h3>
                <div className="flex items-center gap-2 text-sm flex-wrap bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                    <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="bg-transparent border-none text-slate-300 text-xs focus:ring-0 cursor-pointer" />
                    <span className="text-slate-500">-</span>
                    <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="bg-transparent border-none text-slate-300 text-xs focus:ring-0 cursor-pointer" />
                </div>
            </div>
            
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={off} stopColor="#4ade80" stopOpacity={0.2}/>
                                <stop offset={off} stopColor="#d946ef" stopOpacity={0.2}/>
                            </linearGradient>
                            <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={off} stopColor="#4ade80" stopOpacity={1}/>
                                <stop offset={off} stopColor="#d946ef" stopOpacity={1}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                        <YAxis stroke="#64748B" fontSize={11} tickFormatter={formatYAxis} tickLine={false} axisLine={false} width={45} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#94A3B8' }} formatter={(value: number) => [`€${value.toFixed(2)}`, "Acumulado"]} />
                        <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="balance" stroke="url(#splitStroke)" strokeWidth={3} fill="url(#splitColor)" animationDuration={1500} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};


const AIFinancialSummaryWidget: React.FC = () => {
    const { transactions } = useApp();
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateSummary = async () => {
        setIsLoading(true);
        const result = await getAIFinancialSummary(transactions);
        setSummary(result);
        setIsLoading(false);
    };

    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <IconSparkles className="w-6 h-6 text-primary" />
                Resumen IA del Último Mes
            </h3>
            {summary ? (
                <div className="prose prose-sm prose-invert text-slate-300">{summary}</div>
            ) : (
                <p className="text-slate-400 text-sm">Obtén un resumen rápido de tus ingresos y gastos de los últimos 30 días.</p>
            )}
            <div className="mt-4 text-right">
                <Button variant="ghost" onClick={handleGenerateSummary} disabled={isLoading}>
                    {isLoading ? 'Analizando...' : 'Actualizar Resumen'}
                </Button>
            </div>
        </Card>
    );
};

const AlertsWidget: React.FC = () => {
    const { alerts } = useApp();
    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-4">Alertas Próximas</h3>
            {alerts.length > 0 ? (
                <ul className="space-y-3">
                    {alerts.slice(0, 3).map(alert => (
                        <li key={alert.id} className="p-2 bg-slate-700/50 rounded-md">
                            <p className="font-semibold text-amber-400 text-sm">{alert.title}</p>
                            <p className="text-xs text-slate-400">Vence: {new Date(alert.date).toLocaleDateString()}</p>
                        </li>
                    ))}
                    {alerts.length > 3 && (
                        <NavLink to="/alerts" className="text-sm text-primary hover:underline block text-center mt-3">
                            Ver todas ({alerts.length})
                        </NavLink>
                    )}
                </ul>
            ) : (
                <p className="text-slate-500 text-sm text-center py-4">No tienes alertas pendientes.</p>
            )}
        </Card>
    );
}

const AnnualPaymentsWidget: React.FC = () => {
    const { receipts, insurancePolicies } = useApp();

    const upcomingPayments = useMemo(() => {
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(today.getFullYear() + 1);

        const annualReceipts = receipts
            .filter(r => r.frequency === 'annually' && new Date(r.date) >= today && new Date(r.date) <= nextYear)
            .map(r => ({ id: r.id, name: r.title, date: r.date, amount: r.amount, type: 'Recibo' }));

        const annualPolicies = insurancePolicies
            .filter(p => p.paymentFrequency === 'annually' && new Date(p.renewalDate) >= today && new Date(p.renewalDate) <= nextYear)
            .map(p => ({ id: p.id, name: p.name, date: p.renewalDate, amount: p.premium, type: 'Seguro' }));

        return [...annualReceipts, ...annualPolicies].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [receipts, insurancePolicies]);

    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-4">Próximos Pagos Anuales</h3>
            {upcomingPayments.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                             <tr className="border-b border-slate-700">
                                <th className="p-2">Concepto</th>
                                <th className="p-2 text-right">Importe</th>
                                <th className="p-2 text-right">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {upcomingPayments.slice(0, 5).map(p => (
                                <tr key={`${p.type}-${p.id}`} className="border-b border-slate-800">
                                    <td className="p-2 font-semibold">{p.name} <span className="text-xs text-slate-400">({p.type})</span></td>
                                    <td className="p-2 text-right font-mono text-danger">-€{p.amount.toFixed(2)}</td>
                                    <td className="p-2 text-right text-slate-400">{new Date(p.date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-slate-500 text-sm text-center py-4">No hay pagos anuales programados para los próximos 12 meses.</p>
            )}
        </Card>
    );
};

const MonthlySummaryWidget: React.FC = () => {
    const { getExpandedTransactionsForYear } = useApp();

    const summary = useMemo(() => {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        const allCurrentYearTransactions = getExpandedTransactionsForYear(currentYear);
        const currentMonthTransactions = allCurrentYearTransactions.filter(t => {
            if(t.isExcluded) return false;
            const tDate = new Date(t.date + 'T00:00:00Z');
            return tDate.getUTCFullYear() === currentYear && tDate.getUTCMonth() === currentMonth;
        });

        let income = 0;
        let expense = 0;

        currentMonthTransactions.forEach(t => {
            if (t.type === TransactionType.INCOME) income += t.amount;
            if (t.type === TransactionType.EXPENSE || t.type === TransactionType.SAVING) expense += t.amount;
        });
        
        return { income, expense, balance: income - expense };
    }, [getExpandedTransactionsForYear]);
    
     return (
        <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 sm:divide-x sm:divide-slate-700 text-center">
                <div className="p-4">
                    <h4 className="font-semibold text-slate-400">Ingresos (Mes)</h4>
                    <p className="text-3xl font-bold text-secondary mt-2">€{summary.income.toFixed(2)}</p>
                </div>
                <div className="p-4">
                     <h4 className="font-semibold text-slate-400">Gastos (Mes)</h4>
                    <p className="text-3xl font-bold text-danger mt-2">€{summary.expense.toFixed(2)}</p>
                </div>
                <div className="p-4">
                    <h4 className="font-semibold text-slate-400">Balance (Mes)</h4>
                    <p className={`text-3xl font-bold mt-2 ${summary.balance >= 0 ? 'text-white' : 'text-danger'}`}>
                        €{summary.balance.toFixed(2)}
                    </p>
                </div>
            </div>
        </Card>
    );
};

const GoalsWidget: React.FC = () => {
    const { goals } = useApp();
    const sortedGoals = useMemo(() => {
        return [...goals].sort((a, b) => {
            const progressA = a.targetAmount > 0 ? (a.currentAmount / a.targetAmount) : 0;
            const progressB = b.targetAmount > 0 ? (b.currentAmount / b.targetAmount) : 0;
            return progressB - progressA;
        });
    }, [goals]);

    return (
        <Card className="overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-4">Metas Financieras</h3>
            {sortedGoals.length > 0 ? (
                <ul className="space-y-4">
                    {sortedGoals.slice(0, 3).map(goal => {
                        const rawProgress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                        return (
                            <li key={goal.id} className="w-full">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="font-semibold text-white truncate flex-1 mr-2">{goal.name}</p>
                                    <p className="text-sm text-slate-400 font-mono">{rawProgress.toFixed(0)}%</p>
                                </div>
                                <ProgressBar value={Math.min(rawProgress, 100)} colorClass="bg-secondary" />
                            </li>
                        );
                    })}
                    {sortedGoals.length > 3 && (
                        <NavLink to="/goals" className="text-sm text-primary hover:underline block text-center mt-4">
                            Ver todas las metas ({sortedGoals.length})
                        </NavLink>
                    )}
                </ul>
            ) : (
                <p className="text-slate-500 text-sm text-center py-4">No tienes metas definidas.</p>
            )}
        </Card>
    );
};

const SavingsSummaryWidget: React.FC = () => {
    const { transactions } = useApp();

    const savingsData = useMemo(() => {
        const savingsTransactions = transactions
            .filter(t => t.type === TransactionType.SAVING || t.category === 'Retiro de Ahorros')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        let balance = 0;
        savingsTransactions.forEach(t => {
            if (t.type === TransactionType.SAVING) balance += t.amount;
            else balance -= t.amount;
        });

        return { balance, history: savingsTransactions.slice(0, 3) };
    }, [transactions]);

    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <IconPiggyBank className="w-6 h-6 text-info" />
                Resumen de Ahorro
            </h3>
            <div>
                <p className="text-sm text-slate-400">Balance Total</p>
                <p className="text-3xl font-bold text-info mb-4">€{savingsData.balance.toFixed(2)}</p>
                <NavLink to="/goals?view=savings" className="text-sm text-primary hover:underline block text-center">
                    Gestionar Ahorros
                </NavLink>
            </div>
        </Card>
    );
};

const AchievementsWidget: React.FC = () => {
    const { achievements } = useApp();
    const unlockedCount = achievements.length;
    const totalCount = ACHIEVEMENT_DEFINITIONS.length;
    const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-4">Logros</h3>
            <div className="text-center">
                <IconTrophy className="w-12 h-12 mx-auto text-primary" />
                <p className="mt-2 font-bold text-xl">{unlockedCount} / {totalCount}</p>
                <div className="mt-3">
                    <ProgressBar value={progress} colorClass="bg-primary" />
                </div>
                <NavLink to="/achievements" className="text-sm text-primary hover:underline block text-center mt-3">
                    Ver todos
                </NavLink>
            </div>
        </Card>
    );
};


const ExpenseDistributionWidget: React.FC = () => {
    const { getExpandedTransactionsForYear, budgets, expenseCategories } = useApp();

    const distributionData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentUTCMonth = now.getUTCMonth();
        const allCurrentYearTransactions = getExpandedTransactionsForYear(currentYear);

        const currentMonthExpenses = allCurrentYearTransactions.filter(t => {
            if (t.isExcluded || t.type !== TransactionType.EXPENSE) return false;
            const tDate = new Date(t.date + 'T00:00:00Z');
            return tDate.getUTCFullYear() === currentYear && tDate.getUTCMonth() === currentUTCMonth;
        });

        const totalMonthlyExpenses = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
        const totalMonthlyBudget = budgets
            .filter(b => b.type === 'spending-limit')
            .reduce((sum, b) => sum + b.targetAmount, 0);

        const expensesByCategory = currentMonthExpenses.reduce((acc, t) => {
            const category = t.category || 'Otros';
            acc[category] = (acc[category] || 0) + t.amount;
            return acc;
        }, {} as Record<string, number>);

        const categoryIconMap = new Map(expenseCategories.map(c => [c.name, c.icon]));

        const topCategories = Object.entries(expensesByCategory)
            .map(([name, value]) => ({
                name,
                value,
                icon: categoryIconMap.get(name) || '🛒',
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        return { totalMonthlyExpenses, totalMonthlyBudget, topCategories };
    }, [getExpandedTransactionsForYear, budgets, expenseCategories]);

    const categoryColors = [
        'bg-blue-500/20 text-blue-300 border-blue-400',
        'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400',
        'bg-pink-500/20 text-pink-300 border-pink-400',
        'bg-yellow-500/20 text-yellow-300 border-yellow-400',
        'bg-teal-500/20 text-teal-300 border-teal-400',
        'bg-red-500/20 text-red-300 border-red-400',
        'bg-purple-500/20 text-purple-300 border-purple-400',
        'bg-green-500/20 text-green-300 border-green-400',
    ];

    const leftCategories = distributionData.topCategories.slice(0, 4);
    const rightCategories = distributionData.topCategories.slice(4, 8);
    
    return (
        <Card>
            <h3 className="text-lg font-bold text-white mb-4 text-center">Gastos por Categoría (Mes)</h3>
            <div className="flex flex-wrap justify-around items-center gap-4">
                <div className="space-y-4">
                    {leftCategories.map((cat, index) => (
                        <div key={cat.name} className="flex flex-col items-center text-center w-24">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl my-1 border-2 ${categoryColors[index]}`}>
                                {cat.icon}
                            </div>
                            <p className="text-xs font-bold truncate w-full">{cat.name}</p>
                            <p className="text-sm font-bold">€{cat.value.toFixed(0)}</p>
                        </div>
                    ))}
                </div>

                <div className="flex-shrink-0 w-40 h-40 rounded-full border-8 border-slate-700 flex flex-col items-center justify-center p-4">
                    <p className="text-slate-400 text-sm font-semibold">Total</p>
                    <p className="text-xl font-bold text-danger">€{distributionData.totalMonthlyExpenses.toFixed(0)}</p>
                </div>

                <div className="space-y-4">
                     {rightCategories.map((cat, index) => (
                        <div key={cat.name} className="flex flex-col items-center text-center w-24">
                             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl my-1 border-2 ${categoryColors[index + 4]}`}>
                                {cat.icon}
                            </div>
                            <p className="text-xs font-bold truncate w-full">{cat.name}</p>
                            <p className="text-sm font-bold">€{cat.value.toFixed(0)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

const FIRETrackerWidget: React.FC = () => {
    const navigate = useNavigate();
    const { financialSimulations, updateFinancialSimulation } = useApp();
    const [selectedSimId, setSelectedSimId] = useState<string>('');

    useEffect(() => {
        if (financialSimulations.length > 0 && !selectedSimId) {
            setSelectedSimId(financialSimulations[0].id);
        }
    }, [financialSimulations, selectedSimId]);

    const activeSimulation = useMemo(() => financialSimulations.find(s => s.id === selectedSimId), [financialSimulations, selectedSimId]);

    const fireData = useMemo(() => {
        // Guard to ensure activeSimulation is defined
        if (!activeSimulation) return { current: 0, target: 0, progress: 0 };

        // Ensure we are working with numeric values for all calculations to avoid TS errors
        // Added explicit type annotations to satisfy the compiler and ensure numeric operations
        const monthlyIncomeVal: number = Number(activeSimulation.monthlyIncome || 0);
        const inflationRateVal: number = Number(activeSimulation.inflationRate || 0);
        const projectionYearsVal: number = Number(activeSimulation.projectionYears || 0);
        const currentAmountVal: number = Number(activeSimulation.currentAmount || 0);

        const monthlyLifestyleCost: number = monthlyIncomeVal * 0.80;
        const futureAnnualCost: number = (monthlyLifestyleCost * 12) * Math.pow(1 + (inflationRateVal / 100), projectionYearsVal);
        const targetVal: number = futureAnnualCost * 25;
        
        // Final progress calculation
        // Fix: Explicitly ensure currentAmountVal and targetVal are numbers for the division operation to satisfy TS arithmetic rules on line 611.
        // Redundant Number() calls removed and replaced with explicit casts to ensure the compiler treats operands as numbers.
        const fireProgress: number = targetVal > 0 ? ((currentAmountVal as number) / (targetVal as number)) * 100 : 0;
        
        return { 
            current: currentAmountVal, 
            target: targetVal, 
            progress: fireProgress 
        };
    }, [activeSimulation]);

    if (financialSimulations.length === 0) return null;

    return (
        <Card>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <IconAcademicCap className="w-6 h-6 text-primary" />
                Objetivo FIRE (4%)
            </h3>
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs text-slate-400 uppercase">Portfolio</p>
                        <p className="text-2xl font-bold text-secondary">€{fireData.current.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase">Meta</p>
                        <p className="text-lg font-semibold text-white">€{fireData.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                </div>
                <ProgressBar value={Math.min(fireData.progress, 100)} colorClass="bg-gradient-to-r from-secondary to-primary" />
                <p className="text-xs text-slate-500 text-center">{fireData.progress.toFixed(2)}% del camino recorrido</p>
            </div>
        </Card>
    );
};

const HaciendaSummaryWidget: React.FC = () => {
    const { taxSimulations } = useApp();
    
    const latestSimulation = useMemo(() => {
        if (taxSimulations.length === 0) return null;
        return [...taxSimulations].sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())[0];
    }, [taxSimulations]);

    const getDeadlineInfo = (year: number) => {
        const today = new Date();
        const deadline = new Date(year + 1, 5, 30);
        const diffTime = deadline.getTime() - today.getTime();
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        return { diffMonths, isPast: diffTime < 0 };
    };

    if (!latestSimulation) {
        return (
            <Card className="flex flex-col h-full justify-between border border-dashed border-slate-700">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                        <IconBuildingBank className="w-6 h-6 text-primary" />
                        Hacienda
                    </h3>
                    <p className="text-sm text-slate-400">Aún no tienes simulaciones fiscales guardadas.</p>
                </div>
                <NavLink to="/hacienda" className="mt-4">
                    <Button variant="ghost" size="sm" className="w-full">Ir a Hacienda</Button>
                </NavLink>
            </Card>
        );
    }

    const { diffMonths, isPast } = getDeadlineInfo(latestSimulation.year);
    const totalToPay = latestSimulation.result.totalToPay;
    const totalContributed = (latestSimulation.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);
    const progress = totalToPay > 0 ? (totalContributed / totalToPay) * 100 : 0;

    const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

    return (
        <Card className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <IconBuildingBank className="w-6 h-6 text-primary" />
                    Hacienda: {latestSimulation.name}
                </h3>
                {/* FIX: Avoid shorthand slash in template literal expressions to prevent arithmetic operation errors in some environments */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPast ? 'bg-danger bg-opacity-20 text-danger' : 'bg-secondary bg-opacity-20 text-secondary'}`}>
                    Ejercicio {latestSimulation.year}
                </span>
            </div>

            <div className="flex-grow space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs text-slate-400 uppercase">Resultado Estimado</p>
                        <p className={`text-2xl font-black ${totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>
                            {totalToPay > 0 ? 'A PAGAR' : 'A DEVOLVER'}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={`text-2xl font-mono font-black ${totalToPay > 0 ? 'text-danger' : 'text-secondary'}`}>
                            {formatCurrency(Math.abs(totalToPay))}
                        </p>
                    </div>
                </div>

                {totalToPay > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                            <span>Reserva Fiscal</span>
                            <span>{progress.toFixed(0)}%</span>
                        </div>
                        <ProgressBar value={Math.min(progress, 100)} colorClass={diffMonths <= 2 && !isPast ? "bg-danger" : "bg-info"} />
                    </div>
                )}

                <div className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-md border border-slate-700/50">
                    <IconCalendar className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-300">
                        {isPast ? 'Plazo de declaración vencido' : `Faltan ${diffMonths} meses para el plazo`}
                    </span>
                </div>
            </div>

            <NavLink to="/hacienda" className="mt-4">
                <Button variant="ghost" size="sm" className="w-full">Ir a Hacienda</Button>
            </NavLink>
        </Card>
    );
};


// Map widget types to components and metadata
const WIDGET_DEFINITIONS: Record<WidgetType, { component: React.FC, name: string, defaultCols: number }> = {
    [WidgetType.FINANCIAL_SUMMARY]: { component: ComprehensiveFinancialSummaryWidget, name: "Resumen Financiero", defaultCols: 3 },
    [WidgetType.EXPENSE_DISTRIBUTION]: { component: ExpenseDistributionWidget, name: "Distribución de Gastos", defaultCols: 3 },
    [WidgetType.AI_SUMMARY]: { component: AIFinancialSummaryWidget, name: "Resumen IA", defaultCols: 2 },
    [WidgetType.ALERTS]: { component: AlertsWidget, name: "Alertas", defaultCols: 1 },
    [WidgetType.GOALS]: { component: GoalsWidget, name: "Metas", defaultCols: 1 },
    [WidgetType.SAVINGS_SUMMARY]: { component: SavingsSummaryWidget, name: "Ahorros", defaultCols: 1 },
    [WidgetType.MONTHLY_SUMMARY]: { component: MonthlySummaryWidget, name: "Mes Actual", defaultCols: 3 },
    [WidgetType.ANNUAL_PAYMENTS]: { component: AnnualPaymentsWidget, name: "Pagos Anuales", defaultCols: 3 },
    [WidgetType.ACHIEVEMENTS]: { component: AchievementsWidget, name: "Logros", defaultCols: 1 },
    [WidgetType.FIRE_TRACKER]: { component: FIRETrackerWidget, name: "Rastreador FIRE", defaultCols: 1 },
    [WidgetType.HACIENDA_SUMMARY]: { component: HaciendaSummaryWidget, name: "Resumen Hacienda", defaultCols: 1 },
};

const ALL_WIDGET_TYPES = Object.keys(WIDGET_DEFINITIONS) as WidgetType[];

// --- MAIN DASHBOARD PAGE ---
const DashboardPage: React.FC = () => {
    const { activeView, activeViewTarget, dashboardShortcuts, dashboardWidgets, updateDashboardWidgets } = useApp();
    const [isWidgetsModalOpen, setIsWidgetsModalOpen] = useState(false);

    const title = `Dashboard de ${activeViewTarget?.name || 'Usuario'}`;
    const canConfigure = activeView.type === 'user';
    
    const shortcutItems = useMemo(() => dashboardShortcuts
        .map(href => {
            const found = NAV_ITEMS.find(item => item.href === href);
            return found || null;
        })
        .filter(Boolean), [dashboardShortcuts]);

    const renderWidgets = () => {
        const widgetsToRender = dashboardWidgets
            .map(type => WIDGET_DEFINITIONS[type])
            .filter(Boolean);

        if (widgetsToRender.length === 0) return null;
        
        return widgetsToRender.map((widgetDef, idx) => {
             const WidgetComponent = widgetDef.component;
             const spanMap: Record<number, string> = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' };
             const colSpanClass = spanMap[widgetDef.defaultCols] || 'lg:col-span-3';
             return <div key={`${widgetDef.name}-${idx}`} className={colSpanClass}><WidgetComponent /></div>;
        });
    }

    const handleToggleWidget = (type: WidgetType) => {
        const currentWidgets = [...dashboardWidgets];
        if (currentWidgets.includes(type)) {
            updateDashboardWidgets(currentWidgets.filter(w => w !== type));
        } else {
            updateDashboardWidgets([...currentWidgets, type]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                {canConfigure && (
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setIsWidgetsModalOpen(true)}>
                            <IconLayout className="w-5 h-5 mr-2"/>
                            Personalizar
                        </Button>
                    </div>
                )}
            </div>
            
            {shortcutItems.length > 0 && (
                 <div className="flex flex-wrap gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    {shortcutItems.map((item: any) => item && (
                        <NavLink key={item.href} to={item.href!} className="flex items-center gap-2 bg-slate-700 hover:bg-primary hover:text-black text-sm font-semibold px-4 py-2 rounded-full transition-colors">
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            )}
            
            <div className="my-6">
                 <CurrentMonthTrendsWidget />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderWidgets()}
            </div>

            <Modal isOpen={isWidgetsModalOpen} onClose={() => setIsWidgetsModalOpen(false)} title="Personalizar Widgets" size="lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_WIDGET_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => handleToggleWidget(type)}
                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                                dashboardWidgets.includes(type)
                                ? 'bg-primary/10 border-primary text-white'
                                : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-bold">{WIDGET_DEFINITIONS[type].name}</span>
                                {dashboardWidgets.includes(type) && <IconX className="w-4 h-4 text-primary" />}
                            </div>
                        </button>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button onClick={() => setIsWidgetsModalOpen(false)}>Listo</Button>
                </div>
            </Modal>
        </div>
    );
};

export default DashboardPage;
