import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.tsx';
import { InsurancePolicy, InsurancePolicyType, ReceiptFrequency } from '../types.ts';
import { Card, Modal, Input, Button, ConfirmationModal, Textarea } from './common/UIComponents.tsx';
import { IconPlus, IconBell, INSURANCE_POLICY_TYPES, IconShield, IconPencil, IconTrash, IconEye, IconArrowUp, IconArrowDown } from '../constants.tsx';
import { getFile } from '../services/geminiService.ts';

const frequencyMap: Record<ReceiptFrequency, string> = {
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    semiannually: 'Semestral',
    annually: 'Anual',
    'one-time': 'Puntual',
};

const InsuranceCard: React.FC<{ policy: InsurancePolicy; onEdit: (policy: InsurancePolicy) => void; onDelete: (policy: InsurancePolicy) => void; onViewFile: (fileData: string) => void; }> = ({ policy, onEdit, onDelete, onViewFile }) => {
    
    const handleViewFile = async () => {
        if (policy.contractFileId) {
            const fileData = await getFile(policy.contractFileId);
            if (fileData) {
                onViewFile(fileData);
            }
        }
    };

    return (
        <Card className="border-l-4 border-info flex flex-col justify-between relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                {policy.cancellationReminder && (
                    <div className="flex-shrink-0" title="Recordatorio de cancelación activado">
                        <IconBell className="w-6 h-6 text-accent" />
                    </div>
                )}
                <button onClick={() => onEdit(policy)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors"><IconPencil className="w-5 h-5"/></button>
                <button onClick={() => onDelete(policy)} className="text-slate-400 hover:text-danger p-1 rounded-full hover:bg-slate-700 transition-colors"><IconTrash className="w-5 h-5"/></button>
            </div>
            <div>
                <h3 className="font-bold text-lg text-white pr-28">{policy.name}</h3>
                <p className="text-sm text-slate-400">{policy.policyType}{policy.subcategory && ` - ${policy.subcategory}`}</p>
                <p className="text-2xl font-bold my-2 text-white">{`€${policy.premium.toFixed(2)}`} <span className="text-base font-normal text-slate-400">/ {frequencyMap[policy.paymentFrequency].toLowerCase().replace('mente', '')}</span></p>
            </div>
            {policy.paymentFrequency === 'annually' && policy.prorateOverMonths && policy.prorateOverMonths > 1 && (
                 <p className="text-sm text-slate-400 mb-2">
                    Fraccionado: <span className="font-semibold text-slate-300">€{(policy.premium / policy.prorateOverMonths).toFixed(2)}</span> / mes
                </p>
            )}
            <div className="text-sm text-slate-400 mt-4 space-y-2">
                 <p>
                    <span className="font-semibold text-slate-300">Próxima renovación: </span>
                    {new Date(policy.renewalDate).toLocaleDateString()}
                </p>
                {policy.notes && (
                    <div className="text-xs text-slate-400 bg-slate-700/50 p-2 rounded-md">
                        <p className="font-semibold text-slate-300 mb-1">Notas:</p>
                        <p className="whitespace-pre-wrap">{policy.notes}</p>
                    </div>
                )}
                {policy.cancellationReminder && policy.cancellationNoticeMonths && (
                    <p className="p-2 bg-accent/10 rounded-md text-accent text-xs">
                        <span className="font-semibold">Aviso activado {policy.cancellationNoticeMonths} {policy.cancellationNoticeMonths > 1 ? 'meses' : 'mes'} antes.</span>
                    </p>
                )}
                 {policy.contractFile && (
                    <button 
                        onClick={handleViewFile}
                        className="flex items-center gap-2 text-sm text-blue-400 mt-2 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!policy.contractFileId}
                        aria-label={`Ver archivo ${policy.contractFile}`}
                    >
                        <IconEye className="w-5 h-5 flex-shrink-0"/>
                        <span className="truncate">{policy.contractFile}</span>
                    </button>
                )}
            </div>
        </Card>
    );
};

const AddInsuranceModal: React.FC<{ isOpen: boolean, onClose: () => void, policyToEdit: (InsurancePolicy & { contractFileData?: string | undefined }) | null }> = ({ isOpen, onClose, policyToEdit }) => {
    const { addInsurancePolicy, updateInsurancePolicy, activeView, users, groupMembers, insuranceSubcategories, addInsuranceSubcategory } = useApp();
    
    const getInitialFormState = () => ({
        name: '',
        policyType: 'Hogar' as InsurancePolicyType,
        subcategory: '',
        newSubcategory: '',
        premium: '',
        paymentFrequency: 'annually' as ReceiptFrequency,
        renewalDate: '',
        cancellationReminder: false,
        cancellationNoticeMonths: '2',
        notes: '',
        ownerId: '',
        contractFile: '',
        contractFileData: '',
        prorateOverMonths: '',
    });
    
    const [formData, setFormData] = useState(getInitialFormState());
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    useEffect(() => {
        if(!isOpen) {
            setIsPreviewModalOpen(false);
            return;
        }

        if (policyToEdit) {
            setFormData({
                name: policyToEdit.name,
                policyType: policyToEdit.policyType,
                subcategory: policyToEdit.subcategory || '',
                newSubcategory: '',
                premium: String(policyToEdit.premium),
                paymentFrequency: policyToEdit.paymentFrequency,
                renewalDate: policyToEdit.renewalDate.split('T')[0],
                cancellationReminder: policyToEdit.cancellationReminder,
                cancellationNoticeMonths: String(policyToEdit.cancellationNoticeMonths ?? '2'),
                notes: policyToEdit.notes || '',
                ownerId: '', // Editing doesn't change owner
                contractFile: policyToEdit.contractFile || '',
                contractFileData: policyToEdit.contractFileData || '',
                prorateOverMonths: String(policyToEdit.prorateOverMonths ?? ''),
            });
        } else {
            const initialState = getInitialFormState();
            if (activeView.type === 'user') {
                initialState.ownerId = activeView.id;
            } else if (activeView.type === 'group' && groupMembers.length > 0) {
                initialState.ownerId = groupMembers[0].id;
            } else if (users.length > 0) {
                initialState.ownerId = users[0].id;
            }
            setFormData(initialState);
        }
    }, [isOpen, policyToEdit, activeView, users, groupMembers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData({ ...formData, [name]: checked });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setFormData(prev => ({ 
                    ...prev, 
                    contractFile: file.name,
                    contractFileData: dataUrl,
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalSubcategory = formData.subcategory;
        if (formData.policyType && formData.subcategory === 'add-new' && formData.newSubcategory.trim()) {
            finalSubcategory = formData.newSubcategory.trim();
            addInsuranceSubcategory(formData.policyType, finalSubcategory);
        }

        const commonPolicyData = {
            name: formData.name,
            policyType: formData.policyType,
            subcategory: finalSubcategory && finalSubcategory !== 'add-new' ? finalSubcategory : undefined,
            premium: parseFloat(formData.premium),
            paymentFrequency: formData.paymentFrequency,
            renewalDate: formData.renewalDate,
            cancellationReminder: formData.cancellationReminder,
            cancellationNoticeMonths: formData.cancellationReminder ? parseInt(formData.cancellationNoticeMonths) : undefined,
            notes: formData.notes || undefined,
            contractFile: formData.contractFile || undefined,
            prorateOverMonths: formData.paymentFrequency === 'annually' && formData.prorateOverMonths ? parseInt(formData.prorateOverMonths) : undefined,
        };
        
        if (policyToEdit) {
            const policyToUpdate: InsurancePolicy = {
                ...commonPolicyData,
                id: policyToEdit.id,
                contractFileId: policyToEdit.contractFileId,
            };
            updateInsurancePolicy(policyToUpdate, formData.contractFileData || undefined);
        } else {
            const policyToAdd: Omit<InsurancePolicy, 'id'> & { contractFileData?: string } = {
                ...commonPolicyData,
                contractFileData: formData.contractFileData || undefined,
            };
            addInsurancePolicy(policyToAdd, formData.ownerId || users[0].id);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={policyToEdit ? "Editar Seguro" : "Añadir Nuevo Seguro"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {!policyToEdit && users.length > 1 && (
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
                <Input label="Nombre del seguro (Ej: Seguro Coche - Mapfre)" name="name" value={formData.name} onChange={handleChange} required />
                <div>
                    <label htmlFor="policyType" className="block text-sm font-medium text-slate-400 mb-1">Tipo de seguro</label>
                    <select id="policyType" name="policyType" value={formData.policyType} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                        {INSURANCE_POLICY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="subcategory" className="block text-sm font-medium text-slate-400 mb-1">Subcategoría (Opcional)</label>
                    <select 
                        id="subcategory" 
                        name="subcategory" 
                        value={formData.subcategory} 
                        onChange={handleChange}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100"
                    >
                        <option value="">-- Sin subcategoría --</option>
                        {(insuranceSubcategories[formData.policyType] || []).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))}
                        <option value="add-new">Añadir nueva...</option>
                    </select>
                </div>
                {formData.subcategory === 'add-new' && (
                    <Input 
                        label="Nombre de la nueva subcategoría" 
                        name="newSubcategory" 
                        value={formData.newSubcategory} 
                        onChange={handleChange}
                        required 
                    />
                )}

                <Input label="Prima (€)" name="premium" type="number" step="0.01" value={formData.premium} onChange={handleChange} required />
                
                <div>
                    <label htmlFor="paymentFrequency" className="block text-sm font-medium text-slate-400 mb-1">Frecuencia de pago</label>
                    <select id="paymentFrequency" name="paymentFrequency" value={formData.paymentFrequency} onChange={handleChange} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary">
                        {Object.entries(frequencyMap).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                    </select>
                </div>
                
                {formData.paymentFrequency === 'annually' && (
                     <Input label="Fraccionar gasto en (meses)" name="prorateOverMonths" type="number" placeholder="Ej: 12" value={formData.prorateOverMonths} onChange={handleChange} helperText="Divide el coste anual en cuotas mensuales en los resúmenes."/>
                )}
                
                <Input label="Próxima fecha de renovación/pago" name="renewalDate" type="date" value={formData.renewalDate} onChange={handleChange} required />
                
                <Textarea label="Notas (Opcional)" name="notes" value={formData.notes} onChange={handleChange} rows={3} />
                
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Adjuntar Contrato (Opcional)</label>
                    <input type="file" onChange={handleFileChange} accept="application/pdf,image/*" className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-black hover:file:bg-primary-hover" />
                    {formData.contractFile && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                            <span className="truncate">{formData.contractFile}</span>
                            {formData.contractFileData && (
                                <button type="button" onClick={() => setIsPreviewModalOpen(true)} className="text-blue-400 hover:text-blue-300" title="Previsualizar">
                                    <IconEye className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-700 pt-4">
                    <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-md hover:bg-slate-700">
                        <input
                            type="checkbox"
                            name="cancellationReminder"
                            checked={formData.cancellationReminder}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"
                        />
                        <span className="text-slate-300">Activar aviso para cancelación/renovación</span>
                    </label>
                    {formData.cancellationReminder && (
                         <div className="pl-6 mt-2 pt-3 border-l-2 border-slate-700">
                            <Input 
                                label="Avisar con (meses) de antelación" 
                                name="cancellationNoticeMonths" 
                                type="number" 
                                min="1" 
                                max="12"
                                value={formData.cancellationNoticeMonths} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 gap-4">
                     <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                     <Button type="submit">{policyToEdit ? "Guardar Cambios" : "Añadir Seguro"}</Button>
                </div>
            </form>
            <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="Previsualización">
               {formData.contractFileData && formData.contractFileData.startsWith('data:image') && <img src={formData.contractFileData} alt="Previsualización" className="max-w-full max-h-[80vh] mx-auto rounded-md" />}
               {formData.contractFileData && formData.contractFileData.startsWith('data:application/pdf') && <iframe src={formData.contractFileData} title="Previsualización PDF" className="w-full h-[80vh]"/>}
            </Modal>
        </Modal>
    );
};

const InsuranceSubcategoryManager: React.FC = () => {
    const { insuranceSubcategories, updateInsuranceSubcategory, deleteInsuranceSubcategory } = useApp();
    const [selectedType, setSelectedType] = useState<InsurancePolicyType>('Hogar');
    const [isEditing, setIsEditing] = useState<string | null>(null); // Stores the original name of the subcategory being edited
    const [editValue, setEditValue] = useState('');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const subcategoriesForType = insuranceSubcategories[selectedType] || [];

    const handleStartEdit = (name: string) => {
        setIsEditing(name);
        setEditValue(name);
    };

    const handleCancelEdit = () => {
        setIsEditing(null);
        setEditValue('');
    };

    const handleSaveEdit = () => {
        if (isEditing && editValue.trim() && editValue.trim() !== isEditing) {
            updateInsuranceSubcategory(selectedType, isEditing, editValue.trim());
        }
        handleCancelEdit();
    };

    const handleConfirmDelete = () => {
        if (isDeleting) {
            deleteInsuranceSubcategory(selectedType, isDeleting);
        }
        setIsDeleting(null);
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="policy-type-selector" className="block text-sm font-medium text-slate-400 mb-1">
                    Selecciona un tipo de seguro para gestionar sus subcategorías:
                </label>
                <select
                    id="policy-type-selector"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as InsurancePolicyType)}
                    className="w-full max-w-xs bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                >
                    {INSURANCE_POLICY_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-md border border-slate-700 min-h-[150px]">
                {subcategoriesForType.length > 0 ? (
                    <ul className="space-y-2">
                        {subcategoriesForType.map(sub => (
                            <li key={sub} className="flex items-center justify-between p-2 bg-slate-700 rounded-md">
                                {isEditing === sub ? (
                                    <>
                                        <Input
                                            label=""
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            className="!mb-0 flex-grow"
                                        />
                                        <div className="flex gap-2 ml-2">
                                            <Button size="sm" onClick={handleSaveEdit}>Guardar</Button>
                                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-slate-300">{sub}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleStartEdit(sub)} className="text-slate-400 hover:text-white" title="Editar"><IconPencil className="w-4 h-4" /></button>
                                            <button onClick={() => setIsDeleting(sub)} className="text-slate-400 hover:text-danger" title="Eliminar"><IconTrash className="w-4 h-4" /></button>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex items-center justify-center h-full pt-10">
                        <p className="text-slate-500">No hay subcategorías personalizadas para '{selectedType}'.</p>
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={!!isDeleting}
                onClose={() => setIsDeleting(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar la subcategoría <span className="font-bold">{isDeleting}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción la eliminará de la lista y la quitará de todas las pólizas de seguro que la estén usando.</p>
            </ConfirmationModal>
        </div>
    );
};

const InsurancePage: React.FC = () => {
    const { insurancePolicies, deleteInsurancePolicy, insuranceSubcategories } = useApp();
    const location = useLocation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [policyToEdit, setPolicyToEdit] = useState<(InsurancePolicy & { contractFileData?: string | undefined }) | null>(null);
    const [policyToDelete, setPolicyToDelete] = useState<InsurancePolicy | null>(null);
    const [fileToView, setFileToView] = useState<string | null>(null);
    const [view, setView] = useState<'cards' | 'list' | 'manage'>('cards');
    const [policyTypeFilter, setPolicyTypeFilter] = useState<string>('all');
    const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');
    
    type SortKey = keyof InsurancePolicy;
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'renewalDate', direction: 'ascending' });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam === 'list' || viewParam === 'manage' || viewParam === 'cards') {
            setView(viewParam);
        }
    }, [location.search]);
    
    useEffect(() => {
        // Reset subcategory filter when policy type changes
        setSubcategoryFilter('all');
    }, [policyTypeFilter]);

    const handleOpenAddModal = () => {
        setPolicyToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = async (policy: InsurancePolicy) => {
        let fileData: string | undefined;
        if (policy.contractFileId) {
            fileData = (await getFile(policy.contractFileId)) || undefined;
        }
        const dataToEdit = { ...policy, contractFileData: fileData };
        setPolicyToEdit(dataToEdit as (InsurancePolicy & { contractFileData?: string | undefined }));
        setIsModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (policyToDelete) {
            deleteInsurancePolicy(policyToDelete.id);
            setPolicyToDelete(null);
        }
    };

    const sortedPoliciesForCards = [...insurancePolicies].sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());

    const filteredAndSortedPolicies = useMemo(() => {
        let items = [...insurancePolicies];
        
        if (policyTypeFilter !== 'all') {
            items = items.filter(p => p.policyType === policyTypeFilter);
        }
        
        if (policyTypeFilter !== 'all' && subcategoryFilter !== 'all') {
            items = items.filter(p => p.subcategory === subcategoryFilter);
        }

        if (sortConfig !== null) {
            items.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return items;
    }, [insurancePolicies, sortConfig, policyTypeFilter, subcategoryFilter]);

    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        if (sortConfig.direction === 'ascending') return <IconArrowUp className="w-4 h-4 ml-1 inline-block" />;
        return <IconArrowDown className="w-4 h-4 ml-1 inline-block" />;
    };
    
    const renderListView = () => {
        const subcategoriesForType = insuranceSubcategories[policyTypeFilter] || [];
        return (
            <Card>
                <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                        <label htmlFor="policy-type-filter" className="block text-sm font-medium text-slate-400 mb-1">Filtrar por tipo de póliza</label>
                        <select 
                            id="policy-type-filter"
                            value={policyTypeFilter}
                            onChange={(e) => setPolicyTypeFilter(e.target.value)}
                            className="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 focus:ring-primary focus:border-primary"
                        >
                            <option value="all">Todas</option>
                            {INSURANCE_POLICY_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    {policyTypeFilter !== 'all' && subcategoriesForType.length > 0 && (
                        <div>
                            <label htmlFor="subcategory-filter" className="block text-sm font-medium text-slate-400 mb-1">Filtrar por subcategoría</label>
                            <select 
                                id="subcategory-filter"
                                value={subcategoryFilter}
                                onChange={(e) => setSubcategoryFilter(e.target.value)}
                                className="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100"
                            >
                                <option value="all">Todas</option>
                                {subcategoriesForType.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('name')}>Nombre {getSortIcon('name')}</th>
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('subcategory')}>Subcategoría {getSortIcon('subcategory')}</th>
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('policyType')}>Tipo {getSortIcon('policyType')}</th>
                                <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('premium')}>Prima {getSortIcon('premium')}</th>
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('paymentFrequency')}>Frecuencia {getSortIcon('paymentFrequency')}</th>
                                <th className="p-3 cursor-pointer text-right" onClick={() => requestSort('renewalDate')}>Renovación {getSortIcon('renewalDate')}</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedPolicies.map(policy => (
                                <tr key={policy.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                    <td className="p-3 font-semibold">{policy.name}</td>
                                    <td className="p-3">{policy.subcategory || '-'}</td>
                                    <td className="p-3">{policy.policyType}</td>
                                    <td className="p-3 text-right font-mono">€{policy.premium.toFixed(2)}</td>
                                    <td className="p-3">{frequencyMap[policy.paymentFrequency]}</td>
                                    <td className="p-3 text-right font-mono">{new Date(policy.renewalDate).toLocaleDateString()}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleOpenEditModal(policy)} className="text-slate-400 hover:text-white"><IconPencil className="w-5 h-5"/></button>
                                            <button onClick={() => setPolicyToDelete(policy)} className="text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        );
    }
    
    const renderCardView = () => (
        sortedPoliciesForCards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedPoliciesForCards.map(policy => <InsuranceCard key={policy.id} policy={policy} onEdit={handleOpenEditModal} onDelete={setPolicyToDelete} onViewFile={setFileToView}/>)}
            </div>
        ) : (
            <Card className="text-center py-12">
                <IconShield className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <h2 className="text-xl font-bold text-white">Gestiona tus pólizas de seguro</h2>
                <p className="text-slate-400 mt-2 max-w-md mx-auto">Registra tus seguros de coche, hogar, vida, etc. para llevar un control de sus pagos y recibir alertas antes de su renovación.</p>
                <Button className="mt-6" onClick={handleOpenAddModal}>Añadir tu primer seguro</Button>
            </Card>
        )
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Gestión de Seguros</h1>
                <Button onClick={handleOpenAddModal}><IconPlus className="w-5 h-5 mr-2" /> Añadir Seguro</Button>
            </div>
            
             <div className="border-b border-slate-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setView('cards')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'cards' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Tarjetas</button>
                    <button onClick={() => setView('list')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Lista</button>
                    <button onClick={() => setView('manage')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'manage' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>Subcategorías</button>
                </nav>
            </div>

            {view === 'cards' && renderCardView()}
            {view === 'list' && renderListView()}
            {view === 'manage' && (
                 <Card>
                    <h2 className="text-xl font-bold text-white mb-4">Gestionar Subcategorías de Seguros</h2>
                    <InsuranceSubcategoryManager />
                </Card>
            )}

            <AddInsuranceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} policyToEdit={policyToEdit} />
             <ConfirmationModal
                isOpen={!!policyToDelete}
                onClose={() => setPolicyToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Confirmar Eliminación"
            >
                <p>¿Estás seguro de que quieres eliminar el seguro <span className="font-bold">{policyToDelete?.name}</span>?</p>
                <p className="mt-2 text-sm text-slate-400">Esta acción también eliminará la transacción de gasto asociada. Esta acción no se puede deshacer.</p>
            </ConfirmationModal>
            
            <Modal isOpen={!!fileToView} onClose={() => setFileToView(null)} title="Visor de Documentos">
                {fileToView && fileToView.startsWith('data:image') ? (
                    <img src={fileToView} alt="Vista previa del documento" className="max-w-full max-h-[80vh] mx-auto rounded-md" />
                ) : fileToView && fileToView.startsWith('data:application/pdf') ? (
                    <iframe src={fileToView} title="Vista previa del PDF" className="w-full h-[80vh]" />
                ) : fileToView ? (
                    <div className="text-center p-8">
                        <p className="text-slate-400 mb-6">No se puede previsualizar este tipo de archivo. Puedes descargarlo.</p>
                         <a 
                            href={fileToView} 
                            download="documento_adjunto"
                            className="inline-block bg-primary hover:bg-primary-hover text-black focus:ring-primary rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 px-4 py-2"
                        >
                            Descargar Archivo
                        </a>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

export default InsurancePage;