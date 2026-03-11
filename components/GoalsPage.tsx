import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { Goal, Transaction, TransactionType, GoalContribution } from '../types.ts';
import { Card, Modal, Input, Button, ProgressBar, ConfirmationModal, Textarea } from './common/UIComponents.tsx';
import { IconPlus, IconPencil, IconTrash, IconArrowDown, IconArrowUp, IconEye, IconEyeSlash } from '../constants.tsx';

// --- GOALS COMPONENTS (EXISTING LOGIC, MOVED INTO A VIEW) ---

const getProgressColor = (p: number) => {
    if (p < 25) return 'text-danger'; // Fuchsia for low progress
    if (p < 75) return 'text-accent'; // Yellow for medium progress
    return 'text-secondary'; // Green for high progress
};

const getProgressBarColor = (p: number) => {
    if (p < 25) return 'bg-danger';
    if (p < 75) return 'bg-accent';
    return 'bg-secondary';
};


const AddFundsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    goal: Goal;
}> = ({ isOpen, onClose, goal }) => {
    const { addFundsToGoal } = useApp();
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

        addFundsToGoal(goal.id, numericAmount, description);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Añadir Fondos a: ${goal.name}`}>
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

const EditContributionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    goal: Goal;
    contribution: GoalContribution;
}> = ({ isOpen, onClose, goal, contribution }) => {
    const { updateGoalContribution } = useApp();
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

        const updatedContribution: GoalContribution = {
            ...contribution,
            amount: numericAmount,
            date: new Date(formData.date + 'T00:00:00Z').toISOString(),
            description: formData.description || undefined
        };
        updateGoalContribution(goal.id, updatedContribution);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Aportación`}>
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


const GoalCard: React.FC<{ goal: Goal; onEdit: (goal: Goal) => void; onDelete: (goal: Goal) => void; }> = ({ goal, onEdit, onDelete }) => {
    const { deleteGoalContribution, updateGoalContribution } = useApp();
    const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [contributionToEdit, setContributionToEdit] = useState<GoalContribution | null>(null);
    const [contributionToDelete, setContributionToDelete] = useState<GoalContribution | null>(null);
    
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    const sortedHistory = useMemo(() => {
        return [...(goal.contributionHistory || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [goal.contributionHistory]);

    const handleConfirmDelete = () => {
        if(contributionToDelete) {
            deleteGoalContribution(goal.id, contributionToDelete.id);
            setContributionToDelete(null);
        }
    };

    return (
        <>
            <Card className="flex flex-col relative">
                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => onEdit(goal)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors"><IconPencil className="w-5 h-5"/></button>
                    <button onClick={() => onDelete(goal)} className="text-slate-400 hover:text-danger p-1 rounded-full hover:bg-slate-700 transition-colors"><IconTrash className="w-5 h-5"/></button>
                </div>
                
                <h3 className="text-xl font-bold text-white truncate pr-16">{goal.name}</h3>
                <div className="flex justify-between items-baseline mt-1 text-sm">
                    <p className="text-slate-400">Inicio: {new Date(goal.startDate).toLocaleDateString()}</p>
                    <p className="text-slate-400">Objetivo: {new Date(goal.deadline).toLocaleDateString()}</p>
                </div>
                
                 <div className="my-4">
                    <div className="flex justify-between items-baseline mb-1">
                        <p className={`text-lg font-bold font-mono ${getProgressColor(progress)}`}>{progress.toFixed(0)}%</p>
                    </div>
                    <ProgressBar value={progress} colorClass={getProgressBarColor(progress)} />
                    <div className="flex justify-between items-end mt-1">
                        <span className={`text-2xl font-bold ${getProgressColor(progress)}`}>€{goal.currentAmount.toFixed(2)}</span>
                        <span className="text-slate-400">de €{goal.targetAmount.toFixed(2)}</span>
                    </div>
                </div>

                {goal.notes && (
                    <div className="mb-3 text-xs text-slate-400 bg-slate-700/50 p-2 rounded-md">
                        <p className="font-semibold text-slate-300 mb-1">Notas:</p>
                        <p className="whitespace-pre-wrap">{goal.notes}</p>
                    </div>
                )}
                
                <div className="mt-auto pt-4 space-y-3">
                    <Button onClick={() => setIsAddFundsModalOpen(true)} variant="secondary" className="w-full">Añadir Fondos</Button>
                    
                    {goal.contributionHistory && goal.contributionHistory.length > 0 && (
                         <Button onClick={() => setIsHistoryVisible(p => !p)} variant="ghost" className="w-full">
                            {isHistoryVisible ? 'Ocultar Historial' : 'Ver Historial'}
                            {isHistoryVisible ? <IconArrowUp className="w-4 h-4 ml-2"/> : <IconArrowDown className="w-4 h-4 ml-2"/>}
                        </Button>
                    )}
                </div>

                {isHistoryVisible && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="font-semibold text-slate-300 mb-2">Historial de Aportaciones</h4>
                        {sortedHistory.length > 0 ? (
                            <ul className="space-y-2 max-h-40 overflow-y-auto no-scrollbar p-1">
                                {sortedHistory.map(c => {
                                    const isExcluded = c.isExcluded;

                                    const handleToggleExclusion = () => {
                                        const updatedContribution = { ...c, isExcluded: !isExcluded };
                                        updateGoalContribution(goal.id, updatedContribution);
                                    };

                                    return (
                                        <li key={c.id} className={`text-sm p-2 bg-slate-700/50 rounded-md transition-all ${isExcluded ? 'opacity-50' : ''}`}>
                                            <div className="flex justify-between items-center">
                                                <span className={`font-bold ${isExcluded ? 'line-through text-slate-500' : 'text-secondary'}`}>+€{c.amount.toFixed(2)}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-slate-400 text-xs ${isExcluded ? 'line-through' : ''}`}>{new Date(c.date).toLocaleDateString()}</span>
                                                    <button onClick={handleToggleExclusion} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors" title={isExcluded ? 'Incluir en el cálculo' : 'Excluir del cálculo'}>
                                                        {isExcluded ? <IconEyeSlash className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                                                    </button>
                                                    <button onClick={() => setContributionToEdit(c)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-900 transition-colors"><IconPencil className="w-4 h-4"/></button>
                                                    <button onClick={() => setContributionToDelete(c)} className="text-slate-400 hover:text-danger p-1 rounded-full hover:bg-slate-900 transition-colors"><IconTrash className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                            {c.description && <p className={`text-xs text-slate-400 mt-1 italic ${isExcluded ? 'line-through' : ''}`}>"{c.description}"</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-2">No hay aportaciones todavía.</p>
                        )}
                    </div>
                )}
            </Card>
            <AddFundsModal isOpen={isAddFundsModalOpen} onClose={() => setIsAddFundsModalOpen(false)} goal={goal}/>
            {contributionToEdit &&
                <EditContributionModal 
                    isOpen={!!contributionToEdit} 
                    onClose={() => setContributionToEdit(null)} 
                    goal={goal} 
                    contribution={contributionToEdit}
                />
            }
            <ConfirmationModal
                isOpen={!!contributionToDelete}
                onClose={() => setContributionToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar esta aportación de <span className="font-bold">€{contributionToDelete?.amount.toFixed(2)}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción también eliminará la transacción de ahorro asociada. Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </>
    );
};

const AddGoalModal: React.FC<{ isOpen: boolean, onClose: () => void, goalToEdit: Goal | null }> = ({ isOpen, onClose, goalToEdit }) => {
    const { addGoal, updateGoal, activeView, users, groupMembers } = useApp();
    
    const getInitialState = () => ({ name: '', targetAmount: '', currentAmount: '0', startDate: new Date().toISOString().split('T')[0], deadline: '', notes: '', ownerId: '', createTransactions: true });
    const [formData, setFormData] = useState(getInitialState());

    useEffect(() => {
        if(!isOpen) return;

        if (goalToEdit) {
            setFormData({
                name: goalToEdit.name,
                targetAmount: String(goalToEdit.targetAmount),
                currentAmount: String(goalToEdit.currentAmount),
                startDate: goalToEdit.startDate.split('T')[0],
                deadline: goalToEdit.deadline.split('T')[0],
                notes: goalToEdit.notes || '',
                ownerId: '',
                createTransactions: goalToEdit.createTransactions ?? true,
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
    }, [isOpen, goalToEdit, activeView, users, groupMembers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        const goalData: Omit<Goal, 'id' | 'contributionHistory'> = {
            name: formData.name,
            targetAmount: parseFloat(formData.targetAmount),
            currentAmount: parseFloat(formData.currentAmount),
            startDate: formData.startDate,
            deadline: formData.deadline,
            notes: formData.notes || undefined,
            createTransactions: formData.createTransactions,
        };
        
        if (goalToEdit) {
            updateGoal({ ...goalData, id: goalToEdit.id, contributionHistory: goalToEdit.contributionHistory || [] });
        } else {
            addGoal(goalData, formData.ownerId || users[0].id);
        }

        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={goalToEdit ? "Editar Meta Financiera" : "Crear Nueva Meta Financiera"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!goalToEdit && users.length > 1 && (
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
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <Input label="Nombre de la meta" name="name" value={formData.name} onChange={handleChange} required />
                <Input label="Objetivo (€)" name="targetAmount" type="number" value={formData.targetAmount} onChange={handleChange} required />
                <Input label="Cantidad actual (€)" name="currentAmount" type="number" value={formData.currentAmount} onChange={handleChange} required disabled={!!goalToEdit} />
                <Input label="Fecha de Inicio" name="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
                <Input label="Fecha límite" name="deadline" type="date" value={formData.deadline} onChange={handleChange} required />
                
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
                            <span className="text-slate-300">Contabilizar aportaciones a esta meta</span>
                            <p className="text-xs text-slate-500">
                                {formData.createTransactions
                                    ? "Cada aportación creará una transacción de 'Ahorro'." 
                                    : "Las aportaciones solo se reflejarán aquí, sin afectar a Contabilidad."}
                            </p>
                        </div>
                    </label>
                </div>

                <Textarea label="Notas (Opcional)" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
                <div className="flex justify-end pt-4">
                    <Button type="submit">{goalToEdit ? "Guardar Cambios" : "Crear Meta"}</Button>
                </div>
            </form>
        </Modal>
    );
};

const GoalsView: React.FC = () => {
    const { goals, deleteGoal } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [goalToEdit, setGoalToEdit] = useState<Goal | null>(null);
    const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

    const handleOpenAddModal = () => {
        setGoalToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (goal: Goal) => {
        setGoalToEdit(goal);
        setIsModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (goalToDelete) {
            deleteGoal(goalToDelete.id);
            setGoalToDelete(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Mis Metas</h2>
                <Button onClick={handleOpenAddModal}><IconPlus className="w-5 h-5 mr-2" /> Nueva Meta</Button>
            </div>
            {goals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals.map(goal => <GoalCard key={goal.id} goal={goal} onEdit={handleOpenEditModal} onDelete={setGoalToDelete} />)}
                </div>
            ) : (
                <Card className="text-center py-12">
                    <p className="text-slate-400">Aún no has definido ninguna meta.</p>
                    <Button onClick={handleOpenAddModal} className="mt-4">Crea tu primera meta</Button>
                </Card>
            )}
            <AddGoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} goalToEdit={goalToEdit} />
            <ConfirmationModal
                isOpen={!!goalToDelete}
                onClose={() => setGoalToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar la meta <span className="font-bold">{goalToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Las aportaciones a esta meta se conservarán como movimientos de ahorro general. Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
}

// --- SAVINGS COMPONENTS (NEW LOGIC) ---

const WithdrawModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { addTransaction } = useApp();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return;

        addTransaction({
            type: TransactionType.INCOME,
            category: 'Retiro de Ahorros',
            amount: numericAmount,
            date: new Date().toISOString().split('T')[0],
            description: description || 'Retiro de ahorros',
        });
        
        setAmount('');
        setDescription('');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Retirar de Ahorros">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-400">El dinero retirado se registrará como un ingreso en tu contabilidad general.</p>
                <Input label="Cantidad a retirar (€)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <Input label="Descripción" placeholder="Ej: Para vacaciones" value={description} onChange={(e) => setDescription(e.target.value)} required />
                <div className="flex justify-end pt-4">
                    <Button type="submit">Confirmar Retiro</Button>
                </div>
            </form>
        </Modal>
    );
};

const EditSavingTransactionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
}> = ({ isOpen, onClose, transaction }) => {
    const { updateTransaction } = useApp();
    const [formData, setFormData] = useState({ date: '', amount: '', description: '', category: '' });

    useEffect(() => {
        if (transaction) {
            setFormData({
                date: transaction.date.split('T')[0],
                amount: String(transaction.amount),
                description: transaction.description || '',
                category: transaction.category || '',
            });
        }
    }, [transaction]);

    if (!transaction) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(formData.amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return;

        updateTransaction({
            ...transaction,
            date: formData.date,
            amount: numericAmount,
            description: formData.description,
            // Only update category if it's a SAVING type, otherwise it's fixed
            category: transaction.type === TransactionType.SAVING ? formData.category : transaction.category,
        });
        onClose();
    };
    
    const isSavingType = transaction.type === TransactionType.SAVING;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Movimiento de Ahorro">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Fecha" type="date" name="date" value={formData.date} onChange={handleChange} required />
                <Input label="Cantidad (€)" type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required />
                
                {isSavingType ? (
                    <>
                        <Input label="Origen del Ahorro" name="category" value={formData.category} onChange={handleChange} required />
                        <Input label="Descripción (Opcional)" name="description" value={formData.description} onChange={handleChange} />
                    </>
                ) : (
                     <Input label="Descripción" name="description" value={formData.description} onChange={handleChange} required />
                )}

                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar Cambios</Button>
                </div>
            </form>
        </Modal>
    );
};


const SavingsView: React.FC = () => {
    const { transactions, deleteTransaction } = useApp();
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

    const savingsData = useMemo(() => {
        const savingsTransactions = transactions.filter(t => t.type === TransactionType.SAVING || t.category === 'Retiro de Ahorros');
        
        let balance = 0;
        savingsTransactions.forEach(t => {
            if (t.type === TransactionType.SAVING) {
                balance += t.amount;
            } else { // Retiro de Ahorros (Income)
                balance -= t.amount;
            }
        });

        const history = savingsTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return { balance, history };
    }, [transactions]);

    const handleConfirmDelete = () => {
        if (transactionToDelete) {
            deleteTransaction(transactionToDelete.id);
            setTransactionToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-300">Balance Total de Ahorro</h2>
                        <p className="text-4xl font-bold text-info">€{savingsData.balance.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => setIsWithdrawModalOpen(true)}>Retirar Ahorro</Button>
                </div>
            </Card>

            <Card>
                <h2 className="text-2xl font-bold text-white mb-4">Historial de Ahorro</h2>
                {savingsData.history.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Descripción</th>
                                    <th className="p-3 text-right">Importe</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savingsData.history.map(t => (
                                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-700/50">
                                        <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="p-3">{t.description || t.category}</td>
                                        <td className={`p-3 text-right font-bold ${t.type === TransactionType.SAVING ? 'text-info' : 'text-danger'}`}>
                                            {t.type === TransactionType.SAVING ? '+' : '-'}€{t.amount.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => setTransactionToEdit(t)} title="Editar" className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-5 h-5"/></button>
                                                <button onClick={() => setTransactionToDelete(t)} title="Eliminar" className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-400 text-center py-8">No hay movimientos de ahorro. Añade una transacción de tipo "Ahorro" en la sección de Contabilidad para empezar.</p>
                )}
            </Card>
            <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} />
            <EditSavingTransactionModal 
                isOpen={!!transactionToEdit} 
                onClose={() => setTransactionToEdit(null)} 
                transaction={transactionToEdit} 
            />
            <ConfirmationModal
                isOpen={!!transactionToDelete}
                onClose={() => setTransactionToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar este movimiento de ahorro?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const GoalsPage: React.FC = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<'goals' | 'savings'>('goals');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('view') === 'savings') {
            setActiveTab('savings');
        } else {
            setActiveTab('goals');
        }
    }, [location.search]);


    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Metas y Ahorro</h1>
            </div>
             <div className="border-b border-slate-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('goals')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'goals' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Metas</button>
                    <button onClick={() => setActiveTab('savings')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'savings' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Ahorro</button>
                </nav>
            </div>
            
            {activeTab === 'goals' ? <GoalsView /> : <SavingsView />}
        </div>
    );
};

export default GoalsPage;