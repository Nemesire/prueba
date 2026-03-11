import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card, Button, Input, ConfirmationModal, Modal } from './common/UIComponents.tsx';
import { IconBriefcase, IconPlus, IconTrash, IconPencil, IconBuildingOffice } from '../constants.tsx';
import { ManualAsset, Credit, TransactionType, PropertyInvestment, CreditSubcategory } from '../types.ts';
import { CREDIT_SUBCATEGORIES } from '../constants.tsx';

// Helper function to format currency
const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const ITP_RATES: Record<string, number> = {
    'País Vasco': 0.04, 'Madrid': 0.06, 'Cataluña': 0.10, 'Andalucía': 0.07,
    'Comunidad Valenciana': 0.10, 'Canarias': 0.07, 'Galicia': 0.10, 'Default': 0.08
};
const AUTONOMOUS_COMMUNITIES = Object.keys(ITP_RATES).filter(k => k !== 'Default');

// Helper to calculate remaining credit
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
    if (today > endDate) return 0;

    return remainingBalance > 0 ? remainingBalance : 0;
};

// --- MODALS ---

const AddManualAssetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    assetToEdit: ManualAsset | null;
}> = ({ isOpen, onClose, assetToEdit }) => {
    const { addManualAsset, updateManualAsset, activeView, users, groupMembers } = useApp();
    
    const [formData, setFormData] = useState({
        name: '',
        value: '',
        category: 'Other',
        notes: '',
        ownerId: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (assetToEdit) {
                setFormData({
                    name: assetToEdit.name,
                    value: String(assetToEdit.value),
                    category: assetToEdit.category,
                    notes: assetToEdit.notes || '',
                    ownerId: assetToEdit.ownerId || ''
                });
            } else {
                let defaultOwner = '';
                if (activeView.type === 'user') defaultOwner = activeView.id;
                else if (activeView.type === 'group' && groupMembers.length > 0) defaultOwner = groupMembers[0].id;
                else if (users.length > 0) defaultOwner = users[0].id;

                setFormData({ name: '', value: '', category: 'Other', notes: '', ownerId: defaultOwner });
            }
        }
    }, [isOpen, assetToEdit, activeView, users, groupMembers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const assetData = {
            name: formData.name,
            value: parseFloat(formData.value),
            category: formData.category as ManualAsset['category'],
            notes: formData.notes || undefined
        };

        if (assetToEdit) {
            updateManualAsset({ ...assetData, id: assetToEdit.id, ownerId: assetToEdit.ownerId });
        } else {
            addManualAsset(assetData, formData.ownerId);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={assetToEdit ? "Editar Activo" : "Añadir Activo Manual"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!assetToEdit && activeView.type === 'group' && (
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
                <Input label="Nombre del Activo" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input label="Valor Estimado (€)" type="number" value={formData.value} onChange={(e) => setFormData({...formData, value: e.target.value})} required />
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Categoría</label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100"
                    >
                        <option value="Real Estate">Inmobiliario (Adicional)</option>
                        <option value="Vehicle">Vehículo</option>
                        <option value="Valuables">Joyas/Arte/Coleccionismo</option>
                        <option value="Cash">Efectivo</option>
                        <option value="Investment">Inversión (Manual)</option>
                        <option value="Other">Otro</option>
                    </select>
                </div>
                <Input label="Notas" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar</Button>
                </div>
            </form>
        </Modal>
    );
};

const EditPropertyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    investmentToEdit: PropertyInvestment | null;
}> = ({ isOpen, onClose, investmentToEdit }) => {
    const { updatePropertyInvestment } = useApp();
    const [inputs, setInputs] = useState<PropertyInvestment | null>(null);

    useEffect(() => {
        if (isOpen && investmentToEdit) {
            setInputs({ ...investmentToEdit });
        }
    }, [isOpen, investmentToEdit]);

    if (!inputs) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setInputs(prev => prev ? ({ ...prev, [name]: e.target.type === 'number' ? parseFloat(value) || 0 : value }) : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputs) {
            updatePropertyInvestment(inputs);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Propiedad" size="xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Nombre" name="name" value={inputs.name} onChange={handleInputChange} required />
                    <Input label="Precio de Compra (€)" type="number" name="purchasePrice" value={inputs.purchasePrice} onChange={handleInputChange} />
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Comunidad</label>
                        <select name="community" value={inputs.community} onChange={handleInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100">
                            {AUTONOMOUS_COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <Input label="% Financiado" type="number" name="financingPercentage" value={inputs.financingPercentage} onChange={handleInputChange} />
                    <Input label="Interés (%)" type="number" step="0.01" name="interestRate" value={inputs.interestRate} onChange={handleInputChange} />
                    <Input label="Plazo (Años)" type="number" name="loanTermYears" value={inputs.loanTermYears} onChange={handleInputChange} />
                </div>
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar Cambios</Button>
                </div>
            </form>
        </Modal>
    );
};

const EditCreditModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    creditToEdit: Credit | null; 
}> = ({ isOpen, onClose, creditToEdit }) => {
    const { updateCredit } = useApp();
    const [formData, setFormData] = useState<Credit | null>(null);

    useEffect(() => {
        if (isOpen && creditToEdit) {
            setFormData({ ...creditToEdit });
        }
    }, [creditToEdit, isOpen]);

    if (!formData) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? ({ ...prev, [name]: value }) : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData) {
            updateCredit({
                ...formData,
                totalAmount: parseFloat(String(formData.totalAmount)),
                monthlyPayment: parseFloat(String(formData.monthlyPayment)),
                tin: parseFloat(String(formData.tin)),
                tae: parseFloat(String(formData.tae)),
            });
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title='Editar Crédito'>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nombre" name="name" value={formData.name} onChange={handleChange} required />
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Subcategoría</label>
                    <select name="subcategory" value={formData.subcategory} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100">
                        {CREDIT_SUBCATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                </div>
                <Input label="Total (€)" name="totalAmount" type="number" value={formData.totalAmount} onChange={handleChange} required />
                <Input label="Cuota (€)" name="monthlyPayment" type="number" value={formData.monthlyPayment} onChange={handleChange} required />
                <Input label="TIN (%)" name="tin" type="number" step="0.01" value={formData.tin} onChange={handleChange} required />
                <Input label="Fecha Fin" name="endDate" type="date" value={formData.endDate.split('T')[0]} onChange={handleChange} required />
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar Cambios</Button>
                </div>
            </form>
        </Modal>
    );
};


const WealthPage: React.FC = () => {
    const { transactions, credits, propertyInvestments, manualAssets, deleteManualAsset, deletePropertyInvestment, deleteCredit, simulatedLiquidationIds } = useApp();
    
    // Modal States
    const [manualAssetModalOpen, setManualAssetModalOpen] = useState(false);
    const [assetToEdit, setAssetToEdit] = useState<ManualAsset | null>(null);
    
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    const [propertyToEdit, setPropertyToEdit] = useState<PropertyInvestment | null>(null);

    const [creditModalOpen, setCreditModalOpen] = useState(false);
    const [creditToEdit, setCreditToEdit] = useState<Credit | null>(null);

    // Delete States
    const [itemToDelete, setItemToDelete] = useState<{ type: 'manual' | 'property' | 'credit', item: any } | null>(null);

    const wealthData = useMemo(() => {
        // 1. Liquid Assets (Savings)
        const savings = transactions
            .filter(t => t.type === TransactionType.SAVING)
            .reduce((sum, t) => sum + t.amount, 0);
        const withdrawals = transactions
            .filter(t => t.category === 'Retiro de Ahorros')
            .reduce((sum, t) => sum + t.amount, 0);
        const liquidAssets = savings - withdrawals;

        // 2. Property Investments (from Property Module)
        const realEstateValue = propertyInvestments.reduce((sum, p) => sum + p.purchasePrice, 0);

        // 3. Manual Assets
        const manualAssetsValue = manualAssets.reduce((sum, a) => sum + a.value, 0);

        const totalAssets = liquidAssets + realEstateValue + manualAssetsValue;

        // 4. Liabilities (Debts) - Updated to respect simulated liquidation
        const totalLiabilities = credits
            .filter(c => !simulatedLiquidationIds.has(c.id)) // Exclude simulated liquidations
            .reduce((sum, c) => sum + calculateRemainingAmount(c), 0);

        const netWorth = totalAssets - totalLiabilities;

        return {
            liquidAssets,
            realEstateValue,
            manualAssetsValue,
            totalAssets,
            totalLiabilities,
            netWorth
        };
    }, [transactions, credits, propertyInvestments, manualAssets, simulatedLiquidationIds]);

    // Handlers
    const handleEditManual = (asset: ManualAsset) => { setAssetToEdit(asset); setManualAssetModalOpen(true); };
    const handleAddManual = () => { setAssetToEdit(null); setManualAssetModalOpen(true); };
    
    const handleEditProperty = (prop: PropertyInvestment) => { setPropertyToEdit(prop); setPropertyModalOpen(true); };
    
    const handleEditCredit = (cred: Credit) => { setCreditToEdit(cred); setCreditModalOpen(true); };

    const handleDeleteClick = (type: 'manual' | 'property' | 'credit', item: any) => {
        setItemToDelete({ type, item });
    };

    const handleConfirmDelete = () => {
        if (itemToDelete) {
            if (itemToDelete.type === 'manual') deleteManualAsset(itemToDelete.item.id);
            else if (itemToDelete.type === 'property') deletePropertyInvestment(itemToDelete.item.id);
            else if (itemToDelete.type === 'credit') deleteCredit(itemToDelete.item.id);
            setItemToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <IconBriefcase className="w-8 h-8"/>
                    Patrimonio Neto
                </h1>
            </div>

            {/* Summary Card */}
            <Card className="bg-slate-800/80 border border-slate-700">
                <div className="text-center py-6">
                    <h2 className="text-xl text-slate-400 uppercase tracking-wide font-semibold mb-2">Patrimonio Neto Total</h2>
                    <p className={`text-5xl font-extrabold ${wealthData.netWorth >= 0 ? 'text-secondary' : 'text-danger'}`}>
                        {formatCurrency(wealthData.netWorth)}
                    </p>
                    <div className="flex justify-center gap-8 mt-6 text-sm">
                        <div>
                            <span className="block text-slate-400">Activos Totales</span>
                            <span className="block text-xl font-bold text-info">{formatCurrency(wealthData.totalAssets)}</span>
                        </div>
                        <div className="border-l border-slate-600"></div>
                        <div>
                            <span className="block text-slate-400">Pasivos Totales</span>
                            <span className="block text-xl font-bold text-danger">{formatCurrency(wealthData.totalLiabilities)}</span>
                        </div>
                    </div>
                    {simulatedLiquidationIds.size > 0 && (
                        <p className="mt-4 text-xs text-primary italic">
                            * Se están excluyendo deudas marcadas como liquidadas en la simulación.
                        </p>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Assets Column */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                        <span className="w-2 h-8 bg-info rounded-full"></span> Activos (Lo que tienes)
                    </h3>
                    
                    {/* Liquid Assets */}
                    <Card className="border-l-4 border-info/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-semibold text-white">Liquidez y Ahorros</h4>
                                <p className="text-sm text-slate-400">Calculado desde transacciones (Contabilidad)</p>
                            </div>
                            <p className="text-xl font-bold text-white">{formatCurrency(wealthData.liquidAssets)}</p>
                        </div>
                    </Card>

                    {/* Real Estate Module Assets */}
                    <Card className="border-l-4 border-info/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-semibold text-white flex items-center gap-2">
                                    <IconBuildingOffice className="w-4 h-4"/> Inversiones Inmobiliarias
                                </h4>
                                <p className="text-sm text-slate-400">Desde módulo de Inmuebles</p>
                            </div>
                            <p className="text-xl font-bold text-white">{formatCurrency(wealthData.realEstateValue)}</p>
                        </div>
                        {propertyInvestments.length > 0 ? (
                            <ul className="space-y-2 mt-2 border-t border-slate-700 pt-2">
                                {propertyInvestments.map(p => (
                                    <li key={p.id} className="flex justify-between items-center text-sm text-slate-300 p-2 hover:bg-slate-700/30 rounded group">
                                        <div className="flex flex-col">
                                            <span>{p.name}</span>
                                            <span className="text-xs text-slate-500">{formatCurrency(p.purchasePrice)}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditProperty(p)} className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteClick('property', p)} className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-4 h-4"/></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-xs text-slate-500 italic">No hay propiedades registradas.</p>}
                    </Card>

                    {/* Manual Assets */}
                    <Card className="border-l-4 border-info/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-semibold text-white">Otros Activos</h4>
                                <p className="text-sm text-slate-400">Vehículos, Joyas, Efectivo...</p>
                            </div>
                            <Button size="sm" onClick={handleAddManual}><IconPlus className="w-4 h-4 mr-1"/> Añadir</Button>
                        </div>
                        <p className="text-xl font-bold text-white text-right mb-4">{formatCurrency(wealthData.manualAssetsValue)}</p>
                        
                        {manualAssets.length > 0 ? (
                            <ul className="space-y-2 mt-2 border-t border-slate-700 pt-2">
                                {manualAssets.map(asset => (
                                    <li key={asset.id} className="flex justify-between items-center bg-slate-700/30 p-2 rounded text-sm group">
                                        <div>
                                            <span className="block text-slate-200 font-medium">{asset.name}</span>
                                            <span className="text-xs text-slate-500">{asset.category}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-200">{formatCurrency(asset.value)}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <button onClick={() => handleEditManual(asset)} className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-4 h-4"/></button>
                                                <button onClick={() => handleDeleteClick('manual', asset)} className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-slate-500 text-center py-2">No hay activos manuales añadidos.</p>}
                    </Card>
                </div>

                {/* Liabilities Column */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                        <span className="w-2 h-8 bg-danger rounded-full"></span> Pasivos (Lo que debes)
                    </h3>

                    {/* Credits / Debts */}
                    <Card className="border-l-4 border-danger/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-semibold text-white">Deudas y Créditos</h4>
                                <p className="text-sm text-slate-400">Préstamos, Hipotecas, Tarjetas...</p>
                            </div>
                            <p className="text-xl font-bold text-white">{formatCurrency(wealthData.totalLiabilities)}</p>
                        </div>
                        
                        {credits.length > 0 ? (
                            <ul className="space-y-2 mt-2 border-t border-slate-700 pt-2">
                                {credits.map(credit => {
                                    const remaining = calculateRemainingAmount(credit);
                                    if (remaining <= 0) return null;
                                    const isSimulatedPaid = simulatedLiquidationIds.has(credit.id);
                                    
                                    return (
                                        <li key={credit.id} className={`flex justify-between items-center text-sm p-2 rounded group ${isSimulatedPaid ? 'opacity-50 line-through bg-slate-800' : 'text-slate-300 hover:bg-slate-700/30'}`}>
                                            <div className="flex flex-col">
                                                <span>{credit.name}</span>
                                                <span className="text-xs text-slate-500">{credit.subcategory}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-200">{formatCurrency(remaining)}</span>
                                                <div className={`flex gap-1 ${isSimulatedPaid ? 'hidden' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                                                    <button onClick={() => handleEditCredit(credit)} className="p-1 text-slate-400 hover:text-white"><IconPencil className="w-4 h-4"/></button>
                                                    <button onClick={() => handleDeleteClick('credit', credit)} className="p-1 text-slate-400 hover:text-danger"><IconTrash className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : <p className="text-xs text-slate-500 italic">No hay deudas registradas.</p>}
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <AddManualAssetModal 
                isOpen={manualAssetModalOpen} 
                onClose={() => setManualAssetModalOpen(false)} 
                assetToEdit={assetToEdit}
            />
            
            <EditPropertyModal 
                isOpen={propertyModalOpen} 
                onClose={() => setPropertyModalOpen(false)} 
                investmentToEdit={propertyToEdit}
            />

            <EditCreditModal
                isOpen={creditModalOpen}
                onClose={() => setCreditModalOpen(false)}
                creditToEdit={creditToEdit}
            />

            <ConfirmationModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que deseas eliminar este elemento? Esta acción afectará a tu cálculo de patrimonio.</p>
            </ConfirmationModal>
        </div>
    );
};

export default WealthPage;