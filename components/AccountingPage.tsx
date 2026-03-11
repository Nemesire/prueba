import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { Transaction, TransactionType, ReceiptFrequency, ScannedReceiptData, CreditSubcategory, InsurancePolicyType, Category, User } from '../types.ts';
import { Card, Modal, Input, Button, ConfirmationModal, Textarea } from './common/UIComponents.tsx';
import { IconPlus, IconPencil, IconTrash, IconArrowDown, IconArrowUp, IconCamera, CREDIT_SUBCATEGORIES, INSURANCE_POLICY_TYPES, IconEye, IconEyeSlash, IconList } from '../constants.tsx';
import { analyzeReceiptImage } from '../services/geminiService.ts';
import { DEFAULT_EXPENSE_SUBCATEGORIES } from '../context/AppContext.tsx';

const frequencyMap: Record<ReceiptFrequency | 'one-time', string> = {
    'one-time': 'Puntual',
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    semiannually: 'Semestral',
    annually: 'Anual',
};

const AddTransactionModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    initialData?: Transaction | ScannedReceiptData | null;
}> = ({ isOpen, onClose, initialData }) => {
    const { 
        users,
        groupMembers,
        addTransaction, 
        updateTransaction,
        addCredit,
        addInsurancePolicy,
        incomeCategories, 
        expenseCategories, 
        expenseSubcategories,
        addIncomeCategory, 
        addExpenseCategory,
        addExpenseSubcategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        updateExpenseSubcategory,
        deleteExpenseSubcategory,
        transactions,
        budgets,
        activeView
    } = useApp();
    
    // Form state
    const getInitialState = () => ({
        type: TransactionType.EXPENSE,
        category: '',
        newCategory: '',
        subcategory: '',
        newSubcategory: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
        frequency: 'one-time' as ReceiptFrequency | 'one-time',
        ownerId: '',
    });

    const getInitialCreditState = () => ({
        isCredit: false,
        totalAmount: '',
        tin: '',
        tae: '',
        endDate: '',
    });

    const getInitialInsuranceState = () => ({
        isInsurance: false,
        policyType: 'Otros' as InsurancePolicyType,
        paymentFrequency: 'annually' as ReceiptFrequency,
        cancellationReminder: false,
        cancellationNoticeMonths: '2',
        prorateOverMonths: '',
    });

    const [formData, setFormData] = useState(getInitialState());
    const [creditData, setCreditData] = useState(getInitialCreditState());
    const [insuranceData, setInsuranceData] = useState(getInitialInsuranceState());

    // Category management state
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [editedCategoryName, setEditedCategoryName] = useState('');
    const [isEditingSubcategory, setIsEditingSubcategory] = useState(false);
    const [editedSubcategoryName, setEditedSubcategoryName] = useState('');
    const [itemToDelete, setItemToDelete] = useState<{ type: 'category' | 'subcategory'; name: string; category?: string } | null>(null);
    const [isUsageInfoModalOpen, setIsUsageInfoModalOpen] = useState(false);


    const isCreditSubcategory = useMemo(() => 
        formData.type === TransactionType.EXPENSE &&
        formData.category === 'Finanzas' &&
        CREDIT_SUBCATEGORIES.includes(formData.subcategory as CreditSubcategory),
    [formData.type, formData.category, formData.subcategory]);

    const isInsuranceCategory = useMemo(() =>
        formData.type === TransactionType.EXPENSE && formData.category === 'Seguros',
    [formData.type, formData.category]);
    
    useEffect(() => {
        if (!isOpen) {
            setCreditData(getInitialCreditState());
            setInsuranceData(getInitialInsuranceState());
            return;
        };

        let owner = '';
        if (activeView.type === 'user') {
            owner = activeView.id;
        } else if (activeView.type === 'group' && groupMembers.length > 0) {
            owner = groupMembers[0].id;
        } else if (users.length > 0) {
            owner = users[0].id;
        }

        if (initialData) {
            const isFullTransaction = 'type' in initialData;
            setFormData({
                type: isFullTransaction ? (initialData as Transaction).type : TransactionType.EXPENSE,
                category: initialData.category || '',
                newCategory: '',
                subcategory: isFullTransaction ? (initialData as Transaction).subcategory || '' : '',
                newSubcategory: '',
                amount: initialData.amount ? String(initialData.amount) : '',
                date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                description: initialData.description || '',
                notes: isFullTransaction ? (initialData as Transaction).notes || '' : '',
                frequency: isFullTransaction ? (initialData as Transaction).frequency || 'one-time' : 'one-time',
                ownerId: (initialData as Transaction).ownerId || owner,
            });
        } else {
            const resetState = getInitialState();
            resetState.ownerId = owner;
            setFormData(resetState);
        }
    }, [isOpen, initialData, activeView, users, groupMembers]);

    const handleEditCategory = () => {
        setEditedCategoryName(formData.category);
        setIsEditingCategory(true);
    };

    const handleDeleteCategory = () => {
        setItemToDelete({ type: 'category', name: formData.category });
    };

    const handleEditSubcategory = () => {
        setEditedSubcategoryName(formData.subcategory);
        setIsEditingSubcategory(true);
    };

    const handleDeleteSubcategory = () => {
        const { category, subcategory } = formData;
        const isUsed = transactions.some(t => t.category === category && t.subcategory === subcategory);
        if (isUsed) {
            setIsUsageInfoModalOpen(true);
        } else {
            setItemToDelete({ type: 'subcategory', name: subcategory, category });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (name in creditData) {
            setCreditData(prev => ({...prev, [name]: value}));
            return;
        }

        if (name in insuranceData) {
            setInsuranceData(prev => ({...prev, [name]: value}));
            return;
        }

        if (type === 'checkbox') {
             const { checked } = e.target as HTMLInputElement;
             if (name === 'isCredit') setCreditData(prev => ({ ...prev, isCredit: checked }));
             if (name === 'isInsurance') setInsuranceData(prev => ({ ...prev, isInsurance: checked }));
             if (name === 'cancellationReminder') setInsuranceData(prev => ({...prev, cancellationReminder: checked}));
             return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'type' && { category: '', newCategory: '', subcategory: '', newSubcategory: '' }),
            ...(name === 'category' && { subcategory: '', newSubcategory: '' }),
            ...(name === 'category' && value !== 'add-new' && { newCategory: '' }),
            ...(name === 'subcategory' && value !== 'add-new' && { newSubcategory: '' })
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // If it's a new credit, call addCredit and return
        if (creditData.isCredit && isCreditSubcategory) {
            addCredit({
                name: formData.description,
                totalAmount: parseFloat(creditData.totalAmount),
                monthlyPayment: parseFloat(formData.amount),
                tin: parseFloat(creditData.tin),
                tae: parseFloat(creditData.tae),
                startDate: formData.date,
                endDate: creditData.endDate,
                subcategory: formData.subcategory as CreditSubcategory,
                notes: formData.notes,
            }, formData.ownerId || users[0].id);
            onClose();
            return;
        }

        // If it's a new insurance, call addInsurancePolicy and return
        if (insuranceData.isInsurance && isInsuranceCategory) {
            addInsurancePolicy({
                name: formData.description,
                policyType: insuranceData.policyType,
                subcategory: formData.subcategory,
                premium: parseFloat(formData.amount),
                paymentFrequency: insuranceData.paymentFrequency,
                renewalDate: formData.date,
                cancellationReminder: insuranceData.cancellationReminder,
                cancellationNoticeMonths: insuranceData.cancellationReminder ? parseInt(insuranceData.cancellationNoticeMonths) : undefined,
                notes: formData.notes,
                prorateOverMonths: insuranceData.paymentFrequency === 'annually' && insuranceData.prorateOverMonths ? parseInt(insuranceData.prorateOverMonths) : undefined,
            }, formData.ownerId || users[0].id);
            onClose();
            return;
        }
        
        // --- Standard Transaction Logic ---
        let finalCategory = formData.category;
        if (formData.category === 'add-new' && formData.newCategory.trim()) {
            finalCategory = formData.newCategory.trim();
            const newCategoryData: Omit<Category, 'id'> = { name: finalCategory, icon: '💰' };
            if (formData.type === TransactionType.INCOME) {
                addIncomeCategory(newCategoryData);
            } else if (formData.type === TransactionType.EXPENSE) {
                addExpenseCategory(newCategoryData);
            }
        }

        let finalSubcategory = formData.subcategory;
        if (formData.type === TransactionType.EXPENSE && finalCategory && formData.subcategory === 'add-new' && formData.newSubcategory.trim()) {
            finalSubcategory = formData.newSubcategory.trim();
            addExpenseSubcategory(finalCategory, finalSubcategory);
        }

        if (!finalCategory && formData.type !== TransactionType.SAVING) return;
        
        const transactionData: Omit<Transaction, 'id'> = {
            type: formData.type,
            category: finalCategory || 'Ahorro',
            subcategory: finalSubcategory && finalSubcategory !== 'add-new' ? finalSubcategory : undefined,
            amount: parseFloat(formData.amount),
            date: formData.date,
            description: formData.description,
            notes: formData.notes || undefined,
            frequency: formData.frequency === 'one-time' ? undefined : formData.frequency,
        };

        if (initialData && 'id' in initialData) {
            updateTransaction({ ...transactionData, id: (initialData as Transaction).id, ownerId: (initialData as Transaction).ownerId });
        } else {
            addTransaction(transactionData, formData.ownerId || users[0].id);
        }

        onClose();
    };
    
    // --- Category Management Logic ---

    const handleSaveCategory = () => {
        if (editedCategoryName.trim() && editedCategoryName.trim() !== formData.category) {
            const categoryToUpdate = expenseCategories.find(c => c.name === formData.category);
            if (categoryToUpdate) {
                updateExpenseCategory(categoryToUpdate.id, { name: editedCategoryName.trim() });
                setFormData(prev => ({ ...prev, category: editedCategoryName.trim() }));
            }
        }
        setIsEditingCategory(false);
    };
    
    const handleSaveSubcategory = () => {
        if (editedSubcategoryName.trim() && editedSubcategoryName.trim() !== formData.subcategory) {
            updateExpenseSubcategory(formData.category, formData.subcategory, editedSubcategoryName.trim());
            setFormData(prev => ({ ...prev, subcategory: editedSubcategoryName.trim() }));
        }
        setIsEditingSubcategory(false);
    };
    
    const handleConfirmDelete = () => {
        if (!itemToDelete) return;
        if (itemToDelete.type === 'category') {
            const categoryToDelete = expenseCategories.find(c => c.name === itemToDelete.name);
            if (categoryToDelete) {
                deleteExpenseCategory(categoryToDelete.id);
                setFormData(prev => ({ ...prev, category: '', subcategory: '' }));
            }
        } else if (itemToDelete.type === 'subcategory' && itemToDelete.category) {
            deleteExpenseSubcategory(itemToDelete.category, itemToDelete.name);
            setFormData(prev => ({ ...prev, subcategory: '' }));
        }
        setItemToDelete(null);
    };


    const categories = formData.type === TransactionType.INCOME ? incomeCategories : expenseCategories;
    const subcategories = (formData.type === TransactionType.EXPENSE && formData.category && expenseSubcategories[formData.category]) ? expenseSubcategories[formData.category] : [];
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData && 'id' in initialData ? "Editar Movimiento" : "Añadir Movimiento"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!(initialData && 'id' in initialData) && activeView.type === 'group' && (
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
                <div>
                    <label htmlFor="type" className="block text-sm font-medium text-slate-400 mb-1">Tipo</label>
                    <select id="type" name="type" value={formData.type} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" disabled={!!(initialData && 'id' in initialData)}>
                        <option value={TransactionType.EXPENSE}>Gasto</option>
                        <option value={TransactionType.INCOME}>Ingreso</option>
                        <option value={TransactionType.SAVING}>Ahorro</option>
                    </select>
                </div>
                
                {formData.type !== TransactionType.SAVING ? (
                    <>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <label htmlFor="category" className="block text-sm font-medium text-slate-400 mb-1">Categoría</label>
                                 {isEditingCategory ? (
                                    <Input label="" name="editedCategoryName" value={editedCategoryName} onChange={(e) => setEditedCategoryName(e.target.value)} className="!mb-0" />
                                ) : (
                                    <select id="category" name="category" value={formData.category} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" required>
                                        <option value="">-- Selecciona una categoría --</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>)}
                                        <option value="add-new">Añadir nueva categoría...</option>
                                    </select>
                                 )}
                            </div>
                            {isEditingCategory ? (
                                <>
                                    <Button type="button" size="sm" onClick={handleSaveCategory}>Guardar</Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingCategory(false)}>X</Button>
                                </>
                            ) : (formData.type === 'expense' && formData.category && formData.category !== 'add-new' && !expenseCategories.find(c => c.id === formData.category && c.name === formData.category)) && (
                                <>
                                    <button type="button" onClick={handleEditCategory} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700" title="Editar categoría">
                                        <IconPencil className="w-5 h-5" />
                                    </button>
                                    {formData.category !== 'Otros' && (
                                         <button type="button" onClick={handleDeleteCategory} className="p-2 text-slate-400 hover:text-danger rounded-full hover:bg-slate-700" title="Eliminar categoría">
                                            <IconTrash className="w-5 h-5" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        {formData.category === 'add-new' && (
                            <Input label="Nombre de la nueva categoría" name="newCategory" value={formData.newCategory} onChange={handleChange} required />
                        )}

                        {formData.type === TransactionType.EXPENSE && formData.category && formData.category !== 'add-new' && (
                             <div className="flex items-end gap-2">
                                <div className="flex-grow">
                                    <label htmlFor="subcategory" className="block text-sm font-medium text-slate-400 mb-1">Subcategoría</label>
                                    {isEditingSubcategory ? (
                                        <Input label="" name="editedSubcategoryName" value={editedSubcategoryName} onChange={(e) => setEditedSubcategoryName(e.target.value)} className="!mb-0" />
                                    ) : (
                                        <select id="subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                                            <option value="">-- Opcional --</option>
                                            {subcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                            <option value="add-new">Añadir nueva subcategoría...</option>
                                        </select>
                                    )}
                                </div>
                                {isEditingSubcategory ? (
                                    <>
                                        <Button type="button" size="sm" onClick={handleSaveSubcategory}>Guardar</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditingSubcategory(false)}>X</Button>
                                    </>
                                ) : (formData.subcategory && formData.subcategory !== 'add-new' && !DEFAULT_EXPENSE_SUBCATEGORIES[formData.category]?.includes(formData.subcategory)) && (
                                    <>
                                        <button type="button" onClick={handleEditSubcategory} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700" title="Editar subcategoría">
                                            <IconPencil className="w-5 h-5" />
                                        </button>
                                        <button type="button" onClick={handleDeleteSubcategory} className="p-2 text-slate-400 hover:text-danger rounded-full hover:bg-slate-700" title="Eliminar subcategoría">
                                            <IconTrash className="w-5 h-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                         {formData.subcategory === 'add-new' && (
                            <Input label="Nombre de la nueva subcategoría" name="newSubcategory" value={formData.newSubcategory} onChange={handleChange} required />
                        )}

                         <div>
                            <label htmlFor="frequency" className="block text-sm font-medium text-slate-400 mb-1">Frecuencia</label>
                            <select id="frequency" name="frequency" value={formData.frequency} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                                <option value="one-time">Puntual</option>
                                <option value="monthly">Mensual</option>
                                <option value="quarterly">Trimestral</option>
                                <option value="semiannually">Semestral</option>
                                <option value="annually">Anual</option>
                            </select>
                        </div>
                        <Input label="Descripción (será el nombre del crédito/seguro)" name="description" value={formData.description} onChange={handleChange} />
                    </>
                ) : (
                    <>
                        <Input label="Origen del Ahorro" name="category" value={formData.category} onChange={handleChange} placeholder="Ej: Fondo de emergencia" required />
                        <Input label="Descripción (Opcional)" name="description" value={formData.description} onChange={handleChange} />
                    </>
                )}
                
                <Input label={creditData.isCredit ? "Cuota Mensual (€)" : "Importe (€)"} name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required />
                <Input label={creditData.isCredit || insuranceData.isInsurance ? "Fecha de Inicio/Renovación" : "Fecha"} name="date" type="date" value={formData.date} onChange={handleChange} required />
                
                <Textarea label="Notas (Opcional)" name="notes" value={formData.notes} onChange={handleChange} rows={2} />

                {isCreditSubcategory && !(initialData && 'id' in initialData) && (
                    <div className="border-t border-slate-700 pt-4 mt-4 space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700/50">
                            <input type="checkbox" name="isCredit" checked={creditData.isCredit} onChange={handleChange} className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary" />
                            <span className="text-slate-300 font-semibold">Crear nuevo crédito asociado</span>
                        </label>
                        {creditData.isCredit && (
                            <div className="pl-4 border-l-2 border-primary/50 space-y-4">
                                <Input label="Importe Total del Crédito (€)" name="totalAmount" type="number" value={creditData.totalAmount} onChange={handleChange} required />
                                <Input label="Fecha de Finalización" name="endDate" type="date" value={creditData.endDate} onChange={handleChange} required />
                                <Input label="TIN (%)" name="tin" type="number" step="0.01" value={creditData.tin} onChange={handleChange} required />
                                <Input label="TAE (%)" name="tae" type="number" step="0.01" value={creditData.tae} onChange={handleChange} required />
                            </div>
                        )}
                    </div>
                )}

                {isInsuranceCategory && !(initialData && 'id' in initialData) && (
                    <div className="border-t border-slate-700 pt-4 mt-4 space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700/50">
                            <input type="checkbox" name="isInsurance" checked={insuranceData.isInsurance} onChange={handleChange} className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary" />
                            <span className="text-slate-300 font-semibold">Crear nuevo seguro asociado</span>
                        </label>
                        {insuranceData.isInsurance && (
                            <div className="pl-4 border-l-2 border-primary/50 space-y-4">
                                <div>
                                    <label htmlFor="policyType" className="block text-sm font-medium text-slate-400 mb-1">Tipo de seguro</label>
                                    <select id="policyType" name="policyType" value={insuranceData.policyType} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                                        {INSURANCE_POLICY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="paymentFrequency" className="block text-sm font-medium text-slate-400 mb-1">Frecuencia de pago</label>
                                    <select id="paymentFrequency" name="paymentFrequency" value={insuranceData.paymentFrequency} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                                        {Object.entries(frequencyMap).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                                    </select>
                                </div>
                                 {insuranceData.paymentFrequency === 'annually' && (
                                    <Input label="Fraccionar gasto en (meses)" name="prorateOverMonths" type="number" placeholder="Ej: 12" value={insuranceData.prorateOverMonths} onChange={handleChange} helperText="Divide el coste anual en cuotas mensuales en los resúmenes."/>
                                 )}
                                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700">
                                    <input type="checkbox" name="cancellationReminder" checked={insuranceData.cancellationReminder} onChange={handleChange} className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"/>
                                    <span className="text-slate-300">Activar aviso para renovación</span>
                                </label>
                                {insuranceData.cancellationReminder && (
                                    <Input label="Avisar con (meses) de antelación" name="cancellationNoticeMonths" type="number" min="1" value={insuranceData.cancellationNoticeMonths} onChange={handleChange}/>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex justify-end pt-4">
                    <Button type="submit">{initialData && 'id' in initialData ? "Guardar Cambios" : "Añadir"}</Button>
                </div>
            </form>

            <ConfirmationModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar la categoría <span className="font-bold">{itemToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Todos los movimientos asociados se moverán a la categoría "Otros". Esta acción no se puede deshacer.</p>
            </ConfirmationModal>

            <Modal
                isOpen={isUsageInfoModalOpen}
                onClose={() => setIsUsageInfoModalOpen(false)}
                title="No se puede eliminar"
            >
                <p className="text-slate-300 mb-6">Esta subcategoría está siendo utilizada en una o más transacciones y no se puede eliminar.</p>
                <div className="flex justify-end">
                    <Button onClick={() => setIsUsageInfoModalOpen(false)}>Entendido</Button>
                </div>
            </Modal>
        </Modal>
    );
};


// Main page component
const AccountingPage: React.FC = () => {
    const { 
        transactions, 
        deleteTransaction, 
        incomeCategories, 
        expenseCategories, 
        expenseSubcategories,
        excludedInstances,
        toggleTransactionInstanceExclusion,
        getExpandedTransactionsForYear,
        activeView,
        users
    } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [initialModalData, setInitialModalData] = useState<Transaction | ScannedReceiptData | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    
    // View and Date State
    const [view, setView] = useState<'list' | 'monthly' | 'annual'>('list');
    const [year, setYear] = useState(new Date().getFullYear());
    const [monthlyViewDate, setMonthlyViewDate] = useState(new Date());

    type TabId = 'list' | 'monthly' | 'annual' | 'categories';
    const [tabsOrder, setTabsOrder] = useLocalStorage<TabId[]>('accountingTabsOrder', ['list', 'monthly', 'annual', 'categories']);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('tabIndex', index.toString());
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        const draggedIndexStr = e.dataTransfer.getData('tabIndex');
        if (!draggedIndexStr) return;
        const draggedIndex = parseInt(draggedIndexStr, 10);
        if (draggedIndex === index) return;
        
        const newOrder = [...tabsOrder];
        const [draggedTab] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(index, 0, draggedTab);
        setTabsOrder(newOrder);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ income: true, expense: true, saving: true });
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');
    
    // New state for the info modal
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [infoModalContent, setInfoModalContent] = useState({ title: '', message: '', link: '', linkText: '' });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam === 'monthly' || viewParam === 'annual' || viewParam === 'list') {
            setView(viewParam);
        }
    }, [location.search]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        const yearParam = params.get('year');
        const monthParam = params.get('month');

        if (viewParam === 'monthly' && yearParam && monthParam) {
            setView('monthly');
            const newDate = new Date(Number(yearParam), Number(monthParam) - 1, 15);
            // Check if date is valid to prevent crash
            if (!isNaN(newDate.getTime())) {
                setMonthlyViewDate(newDate);
            }
        }
    }, [location.search]);

    useEffect(() => {
        if (categoryFilter === 'all') {
            setSubcategoryFilter('all');
        }
    }, [categoryFilter]);

    const handleScanClick = () => {
        fileInputRef.current?.click();
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const shouldScan = params.get('scan') === 'true';
        const shouldAdd = params.get('add') === 'true';

        if (shouldScan) {
            handleScanClick();
        }
        if (shouldAdd) {
            handleOpenAddModal();
        }
        
        // Clean up URL if we handled an action
        if(shouldScan || shouldAdd) {
            navigate(location.pathname, { replace: true });
        }
    }, [location, navigate]);

    const toggleRow = (key: string) => {
        setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleOpenAddModal = () => {
        setInitialModalData(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (transaction: Transaction) => {
        setInitialModalData(transaction);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setInitialModalData(null);
    };

    const handleConfirmDelete = () => {
        if (transactionToDelete) {
            deleteTransaction(transactionToDelete.id);
            setTransactionToDelete(null);
        }
    };
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setIsScanning(true);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                try {
                    const data = await analyzeReceiptImage(base64String, file.type);
                    setInitialModalData(data);
                    setIsModalOpen(true);
                } catch(e) {
                    console.error(e);
                    alert("Error al analizar la imagen.");
                } finally {
                    setIsScanning(false);
                }
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };

    const handleTransactionAction = (transaction: Transaction, action: 'edit' | 'delete') => {
        if (transaction.creditId) {
            setInfoModalContent({
                title: 'Movimiento Vinculado a Crédito',
                message: `Este movimiento es una cuota mensual de un crédito. Para ${action === 'edit' ? 'editarlo' : 'eliminarlo'}, debes gestionar el crédito directamente.`,
                link: '/credits',
                linkText: 'Ir a Créditos'
            });
            setIsInfoModalOpen(true);
        } else if (transaction.insuranceId) {
            setInfoModalContent({
                title: 'Movimiento Vinculado a Seguro',
                message: `Este movimiento es el pago de una prima de seguro. Para ${action === 'edit' ? 'editarlo' : 'eliminarlo'}, debes gestionar la póliza directamente.`,
                link: '/insurance',
                linkText: 'Ir a Seguros'
            });
            setIsInfoModalOpen(true);
        } else {
            if (action === 'edit') {
                handleOpenEditModal(transaction);
            } else {
                setTransactionToDelete(transaction);
            }
        }
    };
    
    const exportTransactionsToCSV = (targetYear: number) => {
        const transactionsForYear = getExpandedTransactionsForYear(targetYear);

        if (transactionsForYear.length === 0) {
            alert("No hay transacciones para exportar en el año seleccionado.");
            return;
        }
        
        const monthLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const headers = ["Categoría", ...monthLabels, "Total Anual"];

        const dataGrid: { [category: string]: number[] } = {};
        const incomeCategoriesSet = new Set(incomeCategories.map(c => c.name));
        const expenseCategoriesSet = new Set(expenseCategories.map(c => c.name));

        [...incomeCategories.map(c => c.name), ...expenseCategories.map(c => c.name), 'Ahorro'].forEach(cat => {
            if (!dataGrid[cat]) {
                dataGrid[cat] = Array(13).fill(0);
            }
        });

        transactionsForYear.forEach(t => {
            const transactionDate = new Date(t.date + 'T00:00:00Z');
            const monthIndex = transactionDate.getUTCMonth();
            if (isNaN(monthIndex)) return;
            
            if (!dataGrid[t.category]) {
                dataGrid[t.category] = Array(13).fill(0);
            }

            dataGrid[t.category][monthIndex] += t.amount;
            dataGrid[t.category][12] += t.amount;
        });
        
        const totalIncome = Array(13).fill(0);
        const totalExpense = Array(13).fill(0);
        const totalSaving = Array(13).fill(0);
        const balance = Array(13).fill(0);

        Object.keys(dataGrid).forEach(category => {
            if (incomeCategoriesSet.has(category)) {
                for(let i=0; i<13; i++) totalIncome[i] += dataGrid[category][i];
            } else if (expenseCategoriesSet.has(category)) {
                for(let i=0; i<13; i++) totalExpense[i] += dataGrid[category][i];
            } else if (category === 'Ahorro') {
                for(let i=0; i<13; i++) totalSaving[i] += dataGrid[category][i];
            }
        });

        for(let i=0; i<13; i++) {
            balance[i] = totalIncome[i] - totalExpense[i];
        }

        const toCsvRow = (row: (string | number)[]) => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');

        const csvRows: string[] = [headers.join(',')];

        csvRows.push(toCsvRow(['INGRESOS', ...totalIncome.map(v => v.toFixed(2))]));
        Object.keys(dataGrid)
            .filter(cat => incomeCategoriesSet.has(cat) && dataGrid[cat][12] > 0)
            .sort().forEach(category => {
                csvRows.push(toCsvRow([`  ${category}`, ...dataGrid[category].map(v => v.toFixed(2))]));
            });

        csvRows.push(toCsvRow(['GASTOS', ...totalExpense.map(v => v.toFixed(2))]));
        Object.keys(dataGrid)
            .filter(cat => expenseCategoriesSet.has(cat) && dataGrid[cat][12] > 0)
            .sort().forEach(category => {
                csvRows.push(toCsvRow([`  ${category}`, ...dataGrid[category].map(v => v.toFixed(2))]));
            });
            
        if (totalSaving[12] > 0) {
            csvRows.push(toCsvRow(['AHORRO', ...totalSaving.map(v => v.toFixed(2))]));
        }
        
        csvRows.push(toCsvRow(['BALANCE', ...balance.map(v => v.toFixed(2))]));

        const csvContent = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `informe_contable_${targetYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const filteredAndSortedTransactions = useMemo(() => {
        return [...transactions]
            .filter(t => {
                if (typeFilter !== 'all' && t.type !== typeFilter) {
                    return false;
                }
                if (categoryFilter !== 'all' && t.category !== categoryFilter) {
                    return false;
                }
                 if (categoryFilter !== 'all' && t.category === categoryFilter && subcategoryFilter !== 'all') {
                     if (t.subcategory !== subcategoryFilter) {
                         return false;
                     }
                }
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, typeFilter, categoryFilter, subcategoryFilter]);
    
    const renderListView = () => {
        const subcategoriesForFilter = categoryFilter !== 'all' ? expenseSubcategories[categoryFilter] || [] : [];
        return (
            <Card>
                <div className="flex flex-wrap gap-4 mb-4">
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                        <option value="all">Todos los Tipos</option>
                        <option value={TransactionType.INCOME}>Ingresos</option>
                        <option value={TransactionType.EXPENSE}>Gastos</option>
                        <option value={TransactionType.SAVING}>Ahorros</option>
                    </select>
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                        <option value="all">Todas las Categorías</option>
                        {[...incomeCategories, ...expenseCategories].sort((a, b) => (a?.name || '').localeCompare(b?.name || '')).map(c => c && <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                        <option value="Ahorro">💰 Ahorro</option>
                    </select>
                    <select value={subcategoryFilter} onChange={e => setSubcategoryFilter(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary" disabled={categoryFilter === 'all' || !expenseCategories.some(c => c.name === categoryFilter)}>
                        <option value="all">Todas las Subcategorías</option>
                        {subcategoriesForFilter.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-slate-700">
                            <tr>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Categoría</th>
                                <th className="p-3">Frecuencia</th>
                                <th className="p-3">Descripción</th>
                                {activeView.type === 'group' && <th className="p-3">Propietario</th>}
                                <th className="p-3 text-right">Importe</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedTransactions.map(t => (
                                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-700/50">
                                    <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${t.type === TransactionType.INCOME ? 'bg-secondary/20 text-secondary' : t.type === TransactionType.EXPENSE ? 'bg-danger/20 text-danger' : 'bg-info/20 text-info'}`}>{t.type}</span>
                                    </td>
                                    <td className="p-3">{t.category} {t.subcategory && <span className="text-xs text-slate-400">({t.subcategory})</span>}</td>
                                    <td className="p-3 text-sm text-slate-400">{t.frequency ? frequencyMap[t.frequency] : 'Puntual'}</td>
                                    <td className="p-3">
                                        <span className="text-sm text-slate-300">{t.description}</span>
                                        {t.notes && <p className="text-xs text-slate-500 italic mt-1 whitespace-pre-wrap">{t.notes}</p>}
                                    </td>
                                    {activeView.type === 'group' && (
                                        <td className="p-3">
                                            {(() => {
                                                const owner = users.find(u => u.id === t.ownerId);
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
                                    <td className={`p-3 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-secondary' : t.type === TransactionType.EXPENSE ? 'text-danger' : 'text-info'}`}>
                                        {t.type === TransactionType.EXPENSE ? '-' : ''}€{t.amount.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleTransactionAction(t, 'edit')} title="Editar" className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-5 h-5"/></button>
                                            <button onClick={() => handleTransactionAction(t, 'delete')} title="Eliminar" className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        )
    };
    
    const renderSummaryTable = (
        data: (Transaction & { instanceId: string })[],
        title: React.ReactNode,
        isAnnual: boolean
    ) => {
        const grid: {
            income: Record<string, { subcategories: Record<string, (Transaction & { instanceId: string })[]> }>;
            expense: Record<string, { subcategories: Record<string, (Transaction & { instanceId: string })[]> }>;
            saving: Record<string, { subcategories: Record<string, (Transaction & { instanceId: string })[]> }>;
        } = { income: {}, expense: {}, saving: {} };
        
        if (!data) return null;

        data.forEach(t => {
            const typeKey = t.type;
            if (typeKey !== TransactionType.INCOME && typeKey !== TransactionType.EXPENSE && typeKey !== TransactionType.SAVING) return;
            
            const categoryKey = t.category;
            if (!grid[typeKey][categoryKey]) grid[typeKey][categoryKey] = { subcategories: {} };

            const subcategoryKey = t.subcategory || '_Sin Subcategoría_';
            if (!grid[typeKey][categoryKey].subcategories[subcategoryKey]) grid[typeKey][categoryKey].subcategories[subcategoryKey] = [];

            grid[typeKey][categoryKey].subcategories[subcategoryKey].push(t);
        });

        const calculateTotals = (transactions: (Transaction & { instanceId: string })[]): number[] => {
            const includedTransactions = transactions.filter(t => !t.isExcluded);
            if (isAnnual) {
                const totals = Array(12).fill(0);
                includedTransactions.forEach(t => {
                    const monthIndex = new Date(t.date + 'T00:00:00Z').getUTCMonth();
                    if (!isNaN(monthIndex)) {
                       totals[monthIndex] += t.amount;
                    }
                });
                return totals;
            }
            return [includedTransactions.reduce((sum, t) => sum + t.amount, 0)];
        };

        const renderSummaryRow = (label: React.ReactNode, totals: number[], className: string = "", indent: number = 0, onClick?: () => void, isExpanded?: boolean) => {
            const totalSum = totals.reduce((a, b) => a + b, 0);
            return (
                <tr key={`${String(label)}-${indent}`} className={className}>
                    <td className={`p-2 sticky left-0 z-10 bg-slate-800`} style={{ paddingLeft: `${1 + indent * 1.5}rem` }}>
                        <div className="flex items-center gap-2">
                           {onClick && (isExpanded ? <IconArrowDown className="w-4 h-4 cursor-pointer" onClick={onClick}/> : <IconArrowUp className="w-4 h-4 cursor-pointer" onClick={onClick}/>)}
                           <span className={onClick ? 'cursor-pointer' : ''} onClick={onClick}>{label}</span>
                        </div>
                    </td>
                    {totals.map((total, i) => <td key={i} className="p-2 text-right">{total > 0 ? total.toFixed(2) : '-'}</td>)}
                    {isAnnual && <td className="p-2 text-right font-extrabold">{totalSum > 0 ? totalSum.toFixed(2) : '-'}</td>}
                </tr>
            );
        };
        
       const TransactionRow: React.FC<{
            transaction: Transaction & { instanceId: string };
            isAnnual: boolean;
            indent: number;
        }> = ({ transaction, isAnnual, indent }) => {
            const monthlyTotals = Array(12).fill(0);
            if(isAnnual) {
                const monthIndex = new Date(transaction.date + 'T00:00:00Z').getUTCMonth();
                if (!isNaN(monthIndex)) {
                    monthlyTotals[monthIndex] = transaction.amount;
                }
            }
            const annualTotal = transaction.amount;
            const canToggle = activeView.type === 'user';
            const owner = activeView.type === 'group' && transaction.ownerId ? users.find(u => u.id === transaction.ownerId) : null;

            const descriptionContent = (
                 <div>
                    <span>{transaction.description || 'Sin descripción'}</span>
                    {owner && <div className="flex items-center gap-1.5 mt-0.5" title={owner.name}><span className="w-2 h-2 rounded-full" style={{backgroundColor: owner.color}}></span><span className="text-xs text-slate-500">{owner.name}</span></div>}
                    {transaction.notes && <span className="text-xs text-slate-500 block italic">{transaction.notes}</span>}
                </div>
            )

            return (
                 <tr className={`text-xs hover:bg-slate-700/30 ${transaction.isExcluded ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    <td className={`p-2 sticky left-0 z-10 bg-slate-800`} style={{ paddingLeft: `${1 + indent * 1.5}rem` }}>
                        <div className="flex items-center gap-2">
                             <button
                                onClick={() => toggleTransactionInstanceExclusion(transaction.instanceId)}
                                disabled={!canToggle}
                                className={`text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={canToggle ? 'Excluir/Incluir en cálculos' : 'La exclusión solo está disponible en la vista de usuario.'}
                            >
                                {transaction.isExcluded ? <IconEyeSlash className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                            </button>
                            {descriptionContent}
                        </div>
                    </td>
                    {isAnnual ? monthlyTotals.map((total, i) => (
                        <td key={i} className="p-2 text-right">{total > 0 ? total.toFixed(2) : '-'}</td>
                    )) : (
                        <td className="p-2 text-right">{annualTotal > 0 ? annualTotal.toFixed(2) : '-'}</td>
                    )}
                    {isAnnual && <td className="p-2 text-right font-bold">{annualTotal > 0 ? annualTotal.toFixed(2) : '-'}</td>}
                </tr>
            )
        };
        
        const GroupedTransactionRow: React.FC<{
            description: string;
            instances: (Transaction & { instanceId: string })[];
            indent: number;
        }> = ({ description, instances, indent }) => {
            const monthlyTotals = Array(12).fill(0);
            instances.forEach(instance => {
                if (!instance.isExcluded) {
                    const monthIndex = new Date(instance.date + 'T00:00:00Z').getUTCMonth();
                    if (!isNaN(monthIndex)) {
                        monthlyTotals[monthIndex] += instance.amount;
                    }
                }
            });

            const allInstancesExcluded = instances.every(i => i.isExcluded);
            const canToggle = activeView.type === 'user';
            const owner = activeView.type === 'group' && instances.length > 0 ? users.find(u => u.id === instances[0].ownerId) : null;
            
            const handleToggleGroup = () => {
                if (!canToggle) return;
                instances.forEach(instance => {
                    // We toggle every instance to align them to the same state
                    // If all are excluded, we want to include all. If even one is included, we want to exclude all.
                    if (allInstancesExcluded) { // If all are excluded, we want to include them
                        if (instance.isExcluded) toggleTransactionInstanceExclusion(instance.instanceId);
                    } else { // If even one is included, we want to exclude them all
                         if (!instance.isExcluded) toggleTransactionInstanceExclusion(instance.instanceId);
                    }
                });
            };
            
            const notes = instances[0]?.notes;

            return (
                 <tr className={`text-xs hover:bg-slate-700/30 ${allInstancesExcluded ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    <td className={`p-2 sticky left-0 z-10 bg-slate-800`} style={{ paddingLeft: `${1 + indent * 1.5}rem` }}>
                         <div className="flex items-center gap-2">
                             <button
                                onClick={handleToggleGroup}
                                disabled={!canToggle}
                                className={`text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={canToggle ? 'Excluir/Incluir en cálculos' : 'La exclusión solo está disponible en la vista de usuario.'}
                            >
                                {allInstancesExcluded ? <IconEyeSlash className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                            </button>
                            <div>
                                <span>{description}</span>
                                {owner && <div className="flex items-center gap-1.5 mt-0.5" title={owner.name}><span className="w-2 h-2 rounded-full" style={{backgroundColor: owner.color}}></span><span className="text-xs text-slate-500">{owner.name}</span></div>}
                                {notes && <span className="text-xs text-slate-500 block italic">{notes}</span>}
                            </div>
                        </div>
                    </td>
                    {monthlyTotals.map((total, i) => (
                        <td key={i} className="p-2 text-right">{total > 0 ? total.toFixed(2) : '-'}</td>
                    ))}
                    <td className="p-2 text-right font-bold">{monthlyTotals.reduce((a,b) => a+b, 0).toFixed(2)}</td>
                </tr>
            )
        };

        const renderTypeBlock = (type: 'income' | 'expense' | 'saving') => {
            const typeData = grid[type];
            if (!typeData || Object.keys(typeData).length === 0) return null;
            const categories = Object.keys(typeData).sort();

            const allTransactionsInType = Object.values(typeData).flatMap(cat => Object.values(cat.subcategories).flat());
            const typeTotals = calculateTotals(allTransactionsInType);
            
            let rowClassName = '';
            let title = '';
            switch(type) {
                case 'income':
                    rowClassName = 'bg-secondary/10 font-bold';
                    title = 'INGRESOS';
                    break;
                case 'expense':
                    rowClassName = 'bg-danger/10 font-bold';
                    title = 'GASTOS';
                    break;
                case 'saving':
                    rowClassName = 'bg-info/10 font-bold';
                    title = 'AHORRO';
                    break;
            }

            return (
                <React.Fragment>
                    {renderSummaryRow(title, typeTotals, rowClassName, 0, () => toggleRow(type), expandedRows[type])}
                    
                    {expandedRows[type] && categories.map(category => {
                        const categoryData = typeData[category];
                        if (!categoryData?.subcategories) return null;
                        
                        const allTransactionsInCategory = Object.values(categoryData.subcategories).flat();
                        if (allTransactionsInCategory.length === 0) return null;
                        
                        const categoryTotals = calculateTotals(allTransactionsInCategory);
                        const categoryKey = `${type}|${category}`;

                        return (
                            <React.Fragment key={categoryKey}>
                                {renderSummaryRow(category, categoryTotals, 'hover:bg-slate-700/50 font-semibold', 1, () => toggleRow(categoryKey), expandedRows[categoryKey])}
                                
                                {expandedRows[categoryKey] && Object.keys(categoryData.subcategories).sort().map(subcategory => {
                                    const subcategoryKey = `${categoryKey}|${subcategory}`;
                                    const transactionsUnderSubcategory = categoryData.subcategories[subcategory];
                                    if (transactionsUnderSubcategory.length === 0) return null;
                                    
                                    const subcategoryTotals = calculateTotals(transactionsUnderSubcategory);

                                    return (
                                        <React.Fragment key={subcategoryKey}>
                                            { subcategory !== '_Sin Subcategoría_' && renderSummaryRow(subcategory, subcategoryTotals, 'hover:bg-slate-700/40 text-slate-200', 2, () => toggleRow(subcategoryKey), expandedRows[subcategoryKey])}
                                            
                                            {(expandedRows[subcategoryKey] || subcategory === '_Sin Subcategoría_') && (
                                                isAnnual 
                                                ? Object.entries(
                                                    transactionsUnderSubcategory.reduce((acc, t) => {
                                                        const key = t.description || 'Sin descripción';
                                                        if (!acc[key]) acc[key] = [];
                                                        acc[key].push(t);
                                                        return acc;
                                                    }, {} as Record<string, (Transaction & { instanceId: string })[]>)
                                                  ).map(([description, instances]) => (
                                                    <GroupedTransactionRow
                                                        key={description}
                                                        description={description}
                                                        instances={instances}
                                                        indent={subcategory === '_Sin Subcategoría_' ? 2 : 3}
                                                    />
                                                  ))
                                                : transactionsUnderSubcategory
                                                    .sort((a,b) => (a?.description || '').localeCompare(b?.description || ''))
                                                    .map(t => 
                                                        <TransactionRow 
                                                            key={t.instanceId} 
                                                            transaction={t} 
                                                            isAnnual={isAnnual} 
                                                            indent={subcategory === '_Sin Subcategoría_' ? 2 : 3} 
                                                        />)
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </React.Fragment>
                        );
                    })}
                </React.Fragment>
            );
        };
        
        const incomeTotals = calculateTotals(Object.values(grid.income).flatMap(cat => Object.values(cat.subcategories).flatMap(sub => sub.flat())));
        const expenseTotals = calculateTotals(Object.values(grid.expense).flatMap(cat => Object.values(cat.subcategories).flatMap(sub => sub.flat())));
        const savingTotals = calculateTotals(Object.values(grid.saving).flatMap(cat => Object.values(cat.subcategories).flatMap(sub => sub.flat())));
        const balanceTotals = incomeTotals.map((inc, i) => inc - expenseTotals[i] - savingTotals[i]);
        const monthLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        return (
            <Card>
                <div className="flex justify-between items-center mb-4">
                    {title}
                    {isAnnual && <Button onClick={() => exportTransactionsToCSV(year)}>Exportar CSV</Button>}
                </div>
                {!isAnnual && 
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-700/50 p-3 rounded-lg text-center">
                            <h4 className="text-sm text-slate-400">Ingresos del Mes</h4>
                            <p className="text-xl font-bold text-secondary">€{incomeTotals[0].toFixed(2)}</p>
                        </div>
                         <div className="bg-slate-700/50 p-3 rounded-lg text-center">
                            <h4 className="text-sm text-slate-400">Gastos del Mes</h4>
                            <p className="text-xl font-bold text-danger">€{expenseTotals[0].toFixed(2)}</p>
                        </div>
                         <div className="bg-slate-700/50 p-3 rounded-lg text-center">
                            <h4 className="text-sm text-slate-400">Ahorro del Mes</h4>
                            <p className="text-xl font-bold text-info">€{savingTotals[0].toFixed(2)}</p>
                        </div>
                         <div className="bg-slate-700/50 p-3 rounded-lg text-center">
                            <h4 className="text-sm text-slate-400">Balance del Mes</h4>
                            <p className={`text-xl font-bold ${balanceTotals[0] >= 0 ? 'text-white' : 'text-danger'}`}>€{balanceTotals[0].toFixed(2)}</p>
                        </div>
                    </div>
                }
                <div className="overflow-x-auto">
                     <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-2 text-left sticky left-0 z-10 bg-slate-800">Concepto</th>
                                {isAnnual ? 
                                    <>
                                        {monthLabels.map(m => <th key={m} className="p-2 text-right">{m}</th>)}
                                        <th className="p-2 text-right font-extrabold">Total</th>
                                    </>
                                 : <th className="p-2 text-right font-extrabold">Total</th>
                                }
                            </tr>
                        </thead>
                        <tbody>
                            {renderTypeBlock('income')}
                            {renderTypeBlock('expense')}
                            {renderTypeBlock('saving')}
                        </tbody>
                         <tfoot className="border-t-2 border-primary">
                            {renderSummaryRow(<span className="text-primary">BALANCE</span>, balanceTotals, 'font-bold text-lg', 0)}
                        </tfoot>
                    </table>
                </div>
            </Card>
        )
    };
    
    const renderMonthlyView = () => {
        const month = monthlyViewDate.getMonth();
        const year = monthlyViewDate.getFullYear();
        const allTransactions = getExpandedTransactionsForYear(year);
        const monthTransactions = allTransactions.filter(t => new Date(t.date + 'T00:00:00Z').getUTCMonth() === month);

        const handleMonthChange = (offset: number) => {
            const newDate = new Date(monthlyViewDate);
            newDate.setMonth(newDate.getMonth() + offset);
            setMonthlyViewDate(newDate);
        };
        
        const title = (
            <div className="flex items-center gap-4">
                <Button onClick={() => handleMonthChange(-1)}>&lt;</Button>
                <h2 className="text-xl font-bold text-white text-center w-48">{monthlyViewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <Button onClick={() => handleMonthChange(1)}>&gt;</Button>
            </div>
        );
        return renderSummaryTable(monthTransactions, title, false);
    };

    const renderAnnualView = () => {
        const transactionsForYear = getExpandedTransactionsForYear(year);
        const title = (
            <div className="flex items-center gap-4">
                <Button onClick={() => setYear(y => y - 1)}>&lt;</Button>
                <h2 className="text-xl font-bold text-white">{year}</h2>
                <Button onClick={() => setYear(y => y + 1)}>&gt;</Button>
            </div>
        );
        return renderSummaryTable(transactionsForYear, title, true);
    };


    return (
        <div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                capture="environment"
            />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Contabilidad</h1>
                <div className="flex gap-2">
                    <Button onClick={handleScanClick} variant="secondary" disabled={isScanning}>
                        <IconCamera className="w-5 h-5 mr-2" />
                        {isScanning ? 'Escaneando...' : 'Escanear Gasto'}
                    </Button>
                    <Button onClick={handleOpenAddModal}><IconPlus className="w-5 h-5 mr-2" /> Añadir Movimiento</Button>
                </div>
            </div>
            <div className="border-b border-slate-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {tabsOrder.map((tabId, index) => {
                        if (tabId === 'list') {
                            return (
                                <button 
                                    key="list"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    onClick={() => setView('list')} 
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-grab active:cursor-grabbing ${view === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}
                                >
                                    Lista
                                </button>
                            );
                        }
                        if (tabId === 'monthly') {
                            return (
                                <button 
                                    key="monthly"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    onClick={() => setView('monthly')} 
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-grab active:cursor-grabbing ${view === 'monthly' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}
                                >
                                    Vista Mensual
                                </button>
                            );
                        }
                        if (tabId === 'annual') {
                            return (
                                <button 
                                    key="annual"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    onClick={() => setView('annual')} 
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-grab active:cursor-grabbing ${view === 'annual' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}
                                >
                                    Vista Anual
                                </button>
                            );
                        }
                        if (tabId === 'categories') {
                            return (
                                <button 
                                    key="categories"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    onClick={() => navigate('/categories')} 
                                    className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500 flex items-center gap-2 cursor-grab active:cursor-grabbing"
                                >
                                    <IconList className="w-5 h-5"/>Categorías
                                </button>
                            );
                        }
                        return null;
                    })}
                </nav>
            </div>

            {view === 'list' && renderListView()}
            {view === 'monthly' && renderMonthlyView()}
            {view === 'annual' && renderAnnualView()}
            
            <AddTransactionModal isOpen={isModalOpen} onClose={handleCloseModal} initialData={initialModalData} />

            <ConfirmationModal
                isOpen={!!transactionToDelete}
                onClose={() => setTransactionToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar este movimiento?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
            
            <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title={infoModalContent.title}>
                 <div>
                    <p className="text-slate-300 mb-6">{infoModalContent.message}</p>
                    <div className="flex justify-end gap-4">
                        <Button variant="ghost" onClick={() => setIsInfoModalOpen(false)}>Cerrar</Button>
                        <Button onClick={() => { navigate(infoModalContent.link); setIsInfoModalOpen(false); }}>
                            {infoModalContent.linkText}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AccountingPage;