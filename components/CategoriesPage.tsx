import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { Card, Button, Input, ConfirmationModal, Modal } from './common/UIComponents.tsx';
import { IconPencil, IconTrash, IconPlus, IconArrowLeft } from '../constants.tsx';
import { Category } from '../types.ts';
import { SUGGESTED_ICONS } from '../constants.tsx';


const IconPickerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (icon: string) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Icono">
            <div className="grid grid-cols-6 gap-2">
                {SUGGESTED_ICONS.map(icon => (
                    <button
                        key={icon}
                        onClick={() => {
                            onSelect(icon);
                            onClose();
                        }}
                        className="text-3xl p-3 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        {icon}
                    </button>
                ))}
            </div>
        </Modal>
    );
};


const AddEditCategoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    categoryToEdit: Category | null;
    type: 'income' | 'expense';
}> = ({ isOpen, onClose, categoryToEdit, type }) => {
    const { addIncomeCategory, addExpenseCategory, updateExpenseCategory, updateIncomeCategory } = useApp();
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('💰');
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            if (categoryToEdit) {
                setName(categoryToEdit.name);
                setIcon(categoryToEdit.icon);
            } else {
                setName('');
                setIcon('💰');
            }
        }
    }, [isOpen, categoryToEdit]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (categoryToEdit) {
            if (type === 'income') {
                updateIncomeCategory(categoryToEdit.id, { name: name.trim(), icon });
            } else {
                updateExpenseCategory(categoryToEdit.id, { name: name.trim(), icon });
            }
        } else {
            if (type === 'income') {
                addIncomeCategory({ name: name.trim(), icon });
            } else {
                addExpenseCategory({ name: name.trim(), icon });
            }
        }
        onClose();
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={categoryToEdit ? 'Editar Categoría' : `Añadir Categoría de ${type === 'income' ? 'Ingreso' : 'Gasto'}`}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-end gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Icono</label>
                            <button
                                type="button"
                                onClick={() => setIsIconPickerOpen(true)}
                                className="text-3xl p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                            >
                                {icon}
                            </button>
                        </div>
                        <Input
                            label="Nombre de la Categoría"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="flex-grow"
                        />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
            </Modal>
            <IconPickerModal isOpen={isIconPickerOpen} onClose={() => setIsIconPickerOpen(false)} onSelect={setIcon} />
        </>
    );
};

const CategoriesPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        expenseCategories,
        incomeCategories,
        deleteExpenseCategory,
        deleteIncomeCategory,
    } = useApp();

    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: 'income' | 'expense' | null;
        category: Category | null;
    }>({ isOpen: false, type: null, category: null });
    
    const [deletingItem, setDeletingItem] = useState<(Category & { type: 'income' | 'expense' }) | null>(null);

    const openModal = (type: 'income' | 'expense', category: Category | null = null) => {
        setModalState({ isOpen: true, type, category });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, type: null, category: null });
    };

    const confirmDelete = () => {
        if (deletingItem) {
            if (deletingItem.type === 'expense') {
                deleteExpenseCategory(deletingItem.id);
            } else {
                deleteIncomeCategory(deletingItem.id);
            }
        }
        setDeletingItem(null);
    };

    const isDefaultCategory = (category: Category) => {
        return category.id === category.name;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => navigate(-1)} 
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                    aria-label="Volver"
                >
                    <IconArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-white">Gestión de Categorías</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expense Categories */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Categorías de Gastos</h2>
                        <Button onClick={() => openModal('expense')}><IconPlus className="w-5 h-5"/> Añadir</Button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {expenseCategories.map(cat => (
                            <div key={cat.id} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                                <span className="font-semibold text-slate-200 flex items-center gap-3">
                                    <span className="text-2xl">{cat.icon}</span>
                                    {cat.name}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => openModal('expense', cat)} className="p-1 text-slate-400 hover:text-white" title="Editar categoría"><IconPencil className="w-5 h-5"/></button>
                                    {!isDefaultCategory(cat) && cat.name !== 'Otros' && (
                                        <button onClick={() => setDeletingItem({ ...cat, type: 'expense' })} className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Income Categories */}
                <Card>
                     <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Categorías de Ingresos</h2>
                        <Button onClick={() => openModal('income')}><IconPlus className="w-5 h-5"/> Añadir</Button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {incomeCategories.map(cat => {
                            const isDefault = isDefaultCategory(cat);
                            return (
                                <div key={cat.id} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                                    <span className="font-semibold text-slate-200 flex items-center gap-3">
                                        <span className="text-2xl">{cat.icon}</span>
                                        {cat.name}
                                    </span>
                                    <div className="flex gap-2">
                                        {cat.name !== 'Otros' && (
                                            <button onClick={() => openModal('income', cat)} className="p-1 text-slate-400 hover:text-white" title="Editar categoría"><IconPencil className="w-5 h-5"/></button>
                                        )}
                                        {!isDefault && cat.name !== 'Otros' && (
                                            <button onClick={() => setDeletingItem({ ...cat, type: 'income' })} className="p-1 text-slate-400 hover:text-danger" title="Eliminar categoría"><IconTrash className="w-5 h-5"/></button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {modalState.isOpen && modalState.type && (
                 <AddEditCategoryModal
                    isOpen={modalState.isOpen}
                    onClose={closeModal}
                    categoryToEdit={modalState.category}
                    type={modalState.type}
                />
            )}

            <ConfirmationModal
                isOpen={!!deletingItem}
                onClose={() => setDeletingItem(null)}
                onConfirm={confirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar la categoría <span className="font-bold">{deletingItem?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">
                    {deletingItem?.type === 'expense' 
                        ? 'Todas las subcategorías y transacciones asociadas se moverán a "Otros".' 
                        : 'Todas las transacciones asociadas se moverán a la categoría "Otros".'}
                     Esta acción no se puede deshacer.
                </p>
            </ConfirmationModal>
        </div>
    );
};

export default CategoriesPage;