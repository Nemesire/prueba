import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Budget, TransactionType, BudgetContribution } from '../types.ts';
import { Card, Modal, Input, Button, ProgressBar, ConfirmationModal, Textarea } from './common/UIComponents.tsx';
import { IconPlus, IconPencil, IconTrash, IconPiggyBank, IconArrowUp, IconArrowDown, IconEye, IconEyeSlash, IconSparkles } from '../constants.tsx';
import { getAIBudgetSuggestion } from '../services/geminiService.ts';

// Type for AI Budget Suggestion
type AIBudgetSuggestion = {
    summary: string;
    suggestedBudgets: {
        category: string;
        targetAmount: number;
        priority: 'essential' | 'secondary';
    }[];
};


const AIBudgetSuggestionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    suggestion: AIBudgetSuggestion | null;
    onAccept: (selectedBudgets: AIBudgetSuggestion['suggestedBudgets']) => void;
}> = ({ isOpen, onClose, suggestion, onAccept }) => {
    const { expenseCategories } = useApp();
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (suggestion) {
            // Pre-select all suggested budgets by default
            const allCategoryNames = new Set(suggestion.suggestedBudgets.map(b => b.category));
            setSelectedCategories(allCategoryNames);
        }
    }, [suggestion]);

    const handleToggleCategory = (category: string) => {
        setSelectedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    const handleAccept = () => {
        if (!suggestion) return;
        const selected = suggestion.suggestedBudgets.filter(b => selectedCategories.has(b.category));
        onAccept(selected);
        onClose();
    };
    
    const categoryIconMap = useMemo(() => 
        new Map(expenseCategories.map(c => [c.name, c.icon])),
    [expenseCategories]);

    if (!suggestion) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sugerencia de Presupuesto IA" size="lg">
            <div className="space-y-4">
                <div className="prose prose-sm prose-invert max-w-none bg-slate-700/50 p-4 rounded-md">
                    <p>{suggestion.summary}</p>
                </div>
                <h3 className="text-lg font-bold text-white">Presupuestos Sugeridos</h3>
                <p className="text-sm text-slate-400">Selecciona los presupuestos que quieres crear. Puedes editarlos más tarde.</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    {suggestion.suggestedBudgets.map(budget => (
                        <label
                            key={budget.category}
                            className="flex items-center gap-4 p-3 bg-slate-700 rounded-md cursor-pointer hover:bg-slate-600 transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={selectedCategories.has(budget.category)}
                                onChange={() => handleToggleCategory(budget.category)}
                                className="h-5 w-5 rounded bg-slate-800 text-primary focus:ring-primary"
                            />
                            <span className="text-2xl">{categoryIconMap.get(budget.category) || '💸'}</span>
                            <div className="flex-grow">
                                <p className="font-semibold text-white">{budget.category}</p>
                                <p className={`text-xs ${budget.priority === 'essential' ? 'text-amber-400' : 'text-sky-400'}`}>
                                    {budget.priority === 'essential' ? 'Necesidad' : 'Deseo'}
                                </p>
                            </div>
                            <p className="font-mono font-bold text-lg text-primary">€{budget.targetAmount.toFixed(0)}</p>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleAccept} disabled={selectedCategories.size === 0}>
                        Añadir {selectedCategories.size} Presupuestos
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


const AddFundsToBudgetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    budget: Budget;
}> = ({ isOpen, onClose, budget }) => {
    const { addFundsToBudget } = useApp();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setAmount('');
            setDescription('');
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return;

        addFundsToBudget(budget.id, numericAmount, description);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Añadir Fondos a: ${budget.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Cantidad a añadir (€)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <Input label="Descripción (Opcional)" placeholder="Ej: Ahorro extra este mes" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Confirmar Aportación</Button>
                </div>
            </form>
        </Modal>
    );
};

const EditBudgetContributionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    budget: Budget;
    contribution: BudgetContribution;
}> = ({ isOpen, onClose, budget, contribution }) => {
    const { updateBudgetContribution } = useApp();
    const [formData, setFormData] = useState({ amount: '', date: '', description: '' });

    useEffect(() => {
        if (isOpen && contribution) {
            setFormData({
                amount: String(contribution.amount),
                date: new Date(contribution.date).toISOString().split('T')[0],
                description: contribution.description || ''
            });
        }
    }, [isOpen, contribution]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(formData.amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return;

        const updatedContribution: BudgetContribution = {
            ...contribution,
            amount: numericAmount,
            date: new Date(formData.date + 'T00:00:00Z').toISOString(),
            description: formData.description || undefined
        };
        updateBudgetContribution(budget.id, updatedContribution);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Aportación">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Cantidad (€)" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
                <Input label="Fecha" name="date" type="date" value={formData.date} onChange={handleChange} required />
                <Input label="Descripción (Opcional)" name="description" value={formData.description} onChange={handleChange} />
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar Cambios</Button>
                </div>
            </form>
        </Modal>
    );
};

const BudgetCard: React.FC<{ budget: Budget; onEdit: (budget: Budget) => void; onDelete: (budget: Budget) => void; }> = ({ budget, onEdit, onDelete }) => {
    const { transactions, deleteBudgetContribution, updateBudgetContribution } = useApp();
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
    const [contributionToEdit, setContributionToEdit] = useState<BudgetContribution | null>(null);
    const [contributionToDelete, setContributionToDelete] = useState<BudgetContribution | null>(null);

    const { spentAmount, progress, remainingAmount } = useMemo(() => {
        if (budget.type === 'spending-limit') {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            
            const spent = transactions
                .filter(t => 
                    t.type === TransactionType.EXPENSE &&
                    t.category === budget.category &&
                    t.date >= firstDayOfMonth &&
                    t.date <= lastDayOfMonth
                )
                .reduce((sum, t) => sum + t.amount, 0);

            const prog = budget.targetAmount > 0 ? (spent / budget.targetAmount) * 100 : 0;
            const remaining = budget.targetAmount - spent;
            return { spentAmount: spent, progress: prog, remainingAmount: remaining };
        } else { // saving-fund
            const prog = budget.targetAmount > 0 ? (budget.currentAmount / budget.targetAmount) * 100 : 0;
            return { spentAmount: 0, progress: prog, remainingAmount: budget.targetAmount - budget.currentAmount };
        }
    }, [budget, transactions]);

    const getProgressBarColor = () => {
        if (progress > 100) return 'bg-danger';
        if (progress > 85) return 'bg-accent';
        if (budget.type === 'saving-fund') return 'bg-info';
        return 'bg-secondary';
    };

    const sortedHistory = useMemo(() => 
        [...(budget.contributionHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [budget.contributionHistory]);

    const handleConfirmDeleteContribution = () => {
        if (contributionToDelete) {
            deleteBudgetContribution(budget.id, contributionToDelete.id);
            setContributionToDelete(null);
        }
    };
    
    const MonthsRemaining: React.FC = () => {
        if (budget.type !== 'saving-fund' || !budget.deadline) return null;

        const deadline = new Date(budget.deadline);
        const today = new Date();
        deadline.setUTCHours(0, 0, 0, 0);
        today.setUTCHours(0, 0, 0, 0);

        if (deadline < today) {
            return <p className="text-sm text-danger">Plazo finalizado</p>;
        }

        const months = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
        
        if (months < 0) return <p className="text-sm text-danger">Plazo finalizado</p>;
        
        return <p className="text-sm text-slate-400">Faltan {months} {months === 1 ? 'mes' : 'meses'}</p>;
    };

    return (
        <>
            <Card className="flex flex-col relative">
                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => onEdit(budget)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors"><IconPencil className="w-5 h-5"/></button>
                    <button onClick={() => onDelete(budget)} className="text-slate-400 hover:text-danger p-1 rounded-full hover:bg-slate-700 transition-colors"><IconTrash className="w-5 h-5"/></button>
                </div>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white pr-10">{budget.name}</h3>
                         <div className="flex justify-between items-baseline">
                            <p className="text-sm text-slate-400">{budget.category || (budget.type === 'saving-fund' ? 'Fondo de ahorro' : 'Sin categoría')}</p>
                        </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${budget.priority === 'essential' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'}`}>
                        {budget.priority === 'essential' ? 'Esencial' : 'Secundario'}
                    </span>
                </div>
                <div className="text-right -mt-4"><MonthsRemaining /></div>
                
                <div className="my-4 flex-grow flex flex-col justify-center">
                    {budget.type === 'spending-limit' ? (
                        <>
                            <div className="flex justify-between items-baseline mb-1">
                                <p className="font-semibold text-white">Progreso</p>
                                <p className={`text-lg font-bold font-mono ${progress > 100 ? 'text-danger' : 'text-white'}`}>{progress.toFixed(0)}%</p>
                            </div>
                            <ProgressBar value={Math.min(progress, 100)} colorClass={getProgressBarColor()} />
                            <div className="flex justify-between items-end mt-2">
                                <div>
                                    <p className="text-sm text-slate-400">Gastado</p>
                                    <p className="text-2xl font-bold text-white">€{spentAmount.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-400">{remainingAmount >= 0 ? 'Restante' : 'Excedido'}</p>
                                    <p className={`text-lg font-semibold ${remainingAmount >= 0 ? 'text-secondary' : 'text-danger'}`}>€{Math.abs(remainingAmount).toFixed(2)}</p>
                                </div>
                            </div>
                             <p className="text-xs text-slate-500 text-right mt-1">
                                Límite: €{budget.targetAmount.toFixed(2)}
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between items-baseline mb-1">
                                <p className="font-semibold text-white">Progreso</p>
                                <p className="text-lg font-bold font-mono text-info">{progress.toFixed(0)}%</p>
                            </div>
                            <ProgressBar value={Math.min(progress, 100)} colorClass={getProgressBarColor()} />
                            <div className="flex justify-between items-end mt-2">
                                <div>
                                    <p className="text-sm text-slate-400">Aportado</p>
                                    <p className="text-2xl font-bold text-white">€{budget.currentAmount.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-400">Restante</p>
                                    <p className="text-lg font-semibold text-info">€{remainingAmount.toFixed(2)}</p>
                                </div>
                            </div>
                             <p className="text-xs text-slate-500 text-right mt-1">
                                Objetivo: €{budget.targetAmount.toFixed(2)}
                            </p>
                        </>
                    )}
                </div>
                
                {budget.notes && <p className="text-xs text-slate-400 bg-slate-700/50 p-2 rounded-md mb-4">{budget.notes}</p>}

                <div className="mt-auto space-y-2">
                    {budget.type === 'saving-fund' && <Button onClick={() => setIsAddFundsModalOpen(true)} className="w-full">Añadir Fondos</Button>}
                    {budget.type === 'saving-fund' && sortedHistory.length > 0 && (
                        <Button onClick={() => setIsHistoryVisible(p => !p)} variant="ghost" className="w-full">
                            {isHistoryVisible ? 'Ocultar Historial' : 'Ver Historial'}
                            {isHistoryVisible ? <IconArrowUp className="w-4 h-4 ml-2"/> : <IconArrowDown className="w-4 h-4 ml-2"/>}
                        </Button>
                    )}
                </div>
                
                {isHistoryVisible && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="font-semibold text-slate-300 mb-2">Historial de Aportaciones</h4>
                        <ul className="space-y-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                            {sortedHistory.map(c => {
                                const isExcluded = c.isExcluded;

                                const handleToggleExclusion = () => {
                                    const updatedContribution = { ...c, isExcluded: !isExcluded };
                                    updateBudgetContribution(budget.id, updatedContribution);
                                };

                                return (
                                <li key={c.id} className={`text-sm p-2 bg-slate-700/50 rounded-md transition-all ${isExcluded ? 'opacity-50' : ''}`}>
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold ${isExcluded ? 'line-through text-slate-500' : 'text-info'}`}>+€{c.amount.toFixed(2)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-slate-400 text-xs ${isExcluded ? 'line-through' : ''}`}>{new Date(c.date).toLocaleDateString()}</span>
                                            <button onClick={handleToggleExclusion} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors" title={isExcluded ? 'Incluir en el cálculo' : 'Excluir del cálculo'}>
                                                {isExcluded ? <IconEyeSlash className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => setContributionToEdit(c)} className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-4 h-4"/></button>
                                            <button onClick={() => setContributionToDelete(c)} className="p-1 text-danger"><IconTrash className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    {c.description && <p className={`text-xs text-slate-400 mt-1 italic ${isExcluded ? 'line-through' : ''}`}>"{c.description}"</p>}
                                </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </Card>

            {budget.type === 'saving-fund' && <AddFundsToBudgetModal isOpen={isAddFundsModalOpen} onClose={() => setIsAddFundsModalOpen(false)} budget={budget} />}
            {contributionToEdit && <EditBudgetContributionModal isOpen={!!contributionToEdit} onClose={() => setContributionToEdit(null)} budget={budget} contribution={contributionToEdit} />}
            <ConfirmationModal isOpen={!!contributionToDelete} onClose={() => setContributionToDelete(null)} onConfirm={handleConfirmDeleteContribution} title="Confirmar Eliminación">
                <p>¿Seguro que quieres eliminar esta aportación de <span className="font-bold">€{contributionToDelete?.amount.toFixed(2)}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">También se eliminará la transacción de ahorro asociada.</p>
            </ConfirmationModal>
        </>
    );
};

const AddBudgetModal: React.FC<{ isOpen: boolean, onClose: () => void, budgetToEdit: Budget | null, onOpenSuggestion: () => void }> = ({ isOpen, onClose, budgetToEdit, onOpenSuggestion }) => {
    const { addBudget, updateBudget, expenseCategories, activeView, users, groupMembers } = useApp();
    
    const getInitialState = () => ({ 
        name: '', category: '', targetAmount: '', currentAmount: '0', notes: '', ownerId: '',
        type: 'spending-limit' as 'spending-limit' | 'saving-fund', priority: 'secondary' as 'essential' | 'secondary', deadline: '',
        createTransactions: true
    });

    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if(!isOpen) return;

        if (budgetToEdit) {
            setFormData({
                name: budgetToEdit.name,
                category: budgetToEdit.category || '',
                targetAmount: String(budgetToEdit.targetAmount),
                currentAmount: String(budgetToEdit.currentAmount),
                notes: budgetToEdit.notes || '',
                ownerId: '',
                type: budgetToEdit.type,
                priority: budgetToEdit.priority,
                deadline: budgetToEdit.deadline?.split('T')[0] || '',
                createTransactions: budgetToEdit.createTransactions ?? (budgetToEdit.type === 'saving-fund'),
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
    }, [isOpen, budgetToEdit, activeView, users, groupMembers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const budgetData: Omit<Budget, 'id' | 'contributionHistory'> = {
            name: formData.name,
            category: formData.category || undefined,
            targetAmount: parseFloat(formData.targetAmount),
            currentAmount: parseFloat(formData.currentAmount),
            type: formData.type,
            priority: formData.priority,
            deadline: formData.type === 'saving-fund' ? formData.deadline : undefined,
            notes: formData.notes || undefined,
            createTransactions: formData.type === 'saving-fund' ? formData.createTransactions : undefined,
        };
        
        if (budgetToEdit) {
            updateBudget({ ...budgetData, id: budgetToEdit.id, contributionHistory: budgetToEdit.contributionHistory || [] });
        } else {
            addBudget(budgetData, formData.ownerId || users[0].id);
        }
        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={budgetToEdit ? "Editar Presupuesto" : "Crear Nuevo Presupuesto"}>
             {!budgetToEdit && (
                <div className="mb-4">
                    <Button
                        variant="ghost"
                        onClick={onOpenSuggestion}
                        className="w-full border-2 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                    >
                        <IconSparkles className="w-5 h-5 mr-2" />
                        Obtener Sugerencia IA
                    </Button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nombre del Presupuesto" name="name" value={formData.name} onChange={handleChange} required />
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Presupuesto</label>
                    <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2">
                        <option value="spending-limit">Límite de Gasto Mensual</option>
                        <option value="saving-fund">Fondo de Ahorro</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Categoría de Gasto Asociada</label>
                    <select 
                        name="category" 
                        value={formData.category} 
                        onChange={handleChange} 
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2" 
                        required={formData.type === 'spending-limit'}
                    >
                        {formData.type === 'spending-limit' 
                            ? <option value="">-- Selecciona una categoría --</option>
                            : <option value="">-- Opcional (solo ahorro) --</option>
                        }
                        {expenseCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>)}
                    </select>
                </div>
                <Input label={formData.type === 'spending-limit' ? "Límite Mensual (€)" : "Importe Objetivo (€)"} name="targetAmount" type="number" step="0.01" value={formData.targetAmount} onChange={handleChange} required />
                
                {formData.type === 'saving-fund' && (
                    <>
                        {!budgetToEdit && <Input label="Aportación Inicial (€)" name="currentAmount" type="number" step="0.01" value={formData.currentAmount} onChange={handleChange} />}
                        
                        <div className="pt-2">
                            <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700/50">
                                <input
                                    type="checkbox"
                                    name="createTransactions"
                                    checked={formData.createTransactions}
                                    onChange={handleChange}
                                    className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"
                                />
                                <div>
                                    <span className="text-slate-300">Contabilizar aportaciones a este fondo</span>
                                    <p className="text-xs text-slate-500">
                                        {formData.createTransactions
                                            ? "Cada aportación creará una transacción de 'Ahorro a Fondo'." 
                                            : "Las aportaciones solo se reflejarán aquí, sin afectar a Contabilidad."}
                                    </p>
                                </div>
                            </label>
                        </div>
                    </>
                )}

                {formData.type === 'saving-fund' && (
                    <Input label="Fecha Límite (Opcional)" name="deadline" type="date" value={formData.deadline} onChange={handleChange} />
                )}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Prioridad</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2">
                        <option value="secondary">Secundario (Capricho/Ahorro)</option>
                        <option value="essential">Esencial (Necesidad)</option>
                    </select>
                </div>
                <Textarea label="Notas (Opcional)" name="notes" value={formData.notes} onChange={handleChange} rows={2} />
                <div className="flex justify-end pt-4"><Button type="submit">{budgetToEdit ? "Guardar Cambios" : "Crear Presupuesto"}</Button></div>
            </form>
        </Modal>
    );
};

const BudgetsPage: React.FC = () => {
    const { budgets, deleteBudget, transactions, addBudget } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null);
    const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
    
    // AI Suggestion State
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<AIBudgetSuggestion | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const handleOpenAddModal = () => {
        setBudgetToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (budget: Budget) => {
        setBudgetToEdit(budget);
        setIsModalOpen(true);
    }

    const handleConfirmDelete = () => {
        if (budgetToDelete) {
            deleteBudget(budgetToDelete.id);
            setBudgetToDelete(null);
        }
    };

    const handleGetAiSuggestion = async () => {
        setIsAiLoading(true);
        // We close the main modal to show the loading state more clearly, then open the suggestion modal.
        setIsModalOpen(false); 
        try {
            const today = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(today.getMonth() - 3);
            const recentTransactions = transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
            
            const suggestion = await getAIBudgetSuggestion(recentTransactions);
            setAiSuggestion(suggestion);
            setIsSuggestionModalOpen(true);
        } catch (error) {
            console.error("Error getting AI budget suggestion:", error);
            // Re-open the main modal if there's an error
            setIsModalOpen(true);
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleAcceptSuggestion = (selectedBudgets: AIBudgetSuggestion['suggestedBudgets']) => {
        selectedBudgets.forEach(budget => {
            const newBudget: Omit<Budget, 'id' | 'contributionHistory'> = {
                name: `Límite para ${budget.category}`,
                category: budget.category,
                targetAmount: budget.targetAmount,
                currentAmount: 0,
                type: 'spending-limit',
                priority: budget.priority,
            };
            addBudget(newBudget); // Assuming addBudget can handle ownerId internally
        });
        setIsSuggestionModalOpen(false);
    };


    const sortedBudgets = [...budgets].sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    return (
        <div>
            {isAiLoading && (
                <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex flex-col justify-center items-center z-50">
                    <p className="text-white text-xl mt-4 animate-pulse">Analizando tus finanzas para crear un presupuesto inteligente...</p>
                </div>
            )}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Presupuestos</h1>
                <Button onClick={handleOpenAddModal}><IconPlus className="w-5 h-5 mr-2" /> Nuevo Presupuesto</Button>
            </div>
            {sortedBudgets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedBudgets.map(budget => <BudgetCard key={budget.id} budget={budget} onEdit={handleOpenEditModal} onDelete={setBudgetToDelete} />)}
                </div>
            ) : (
                <Card className="text-center py-12">
                     <IconPiggyBank className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                    <h2 className="text-xl font-bold text-white">Toma el control de tus finanzas</h2>
                    <p className="text-slate-400 mt-2 max-w-md mx-auto">Crea presupuestos para limitar tus gastos mensuales o crea fondos de ahorro para alcanzar tus metas.</p>
                    <Button onClick={handleOpenAddModal} className="mt-6">Crea tu primer presupuesto</Button>
                </Card>
            )}
            <AddBudgetModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                budgetToEdit={budgetToEdit}
                onOpenSuggestion={handleGetAiSuggestion}
            />
            <AIBudgetSuggestionModal
                isOpen={isSuggestionModalOpen}
                onClose={() => setIsSuggestionModalOpen(false)}
                suggestion={aiSuggestion}
                onAccept={handleAcceptSuggestion}
            />
            <ConfirmationModal isOpen={!!budgetToDelete} onClose={() => setBudgetToDelete(null)} onConfirm={handleConfirmDelete} title="Confirmar Eliminación">
                <p>¿Estás seguro de que quieres eliminar el presupuesto <span className="font-bold">{budgetToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
};

export default BudgetsPage;
