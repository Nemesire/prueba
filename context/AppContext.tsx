
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { 
    AppContextType, AppState, Transaction, Credit, Receipt, Goal, ToxicityReport, 
    User, UserData, Group, ActiveView, Alert, TransactionType, InsurancePolicy, Budget,
    InsurancePolicyType, SavedTaxReturn, EducationProgress, WidgetType, PropertyInvestment, GoalContribution,
    Category, BudgetContribution, FinancialSimulation, Achievement, SavedInsight, ManualAsset, InvestmentTransaction,
    TaxSimulation, TaxConfig
} from '../types.ts';
import { useLocalStorage } from '../hooks/useLocalStorage.ts';
import { INSURANCE_POLICY_TYPES, PROFILE_COLORS } from '../constants.tsx';
import { saveFile, deleteFile } from '../services/geminiService.ts';

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SHORTCUTS: string[] = ['/accounting', '/receipts?view=invoice', '/credits', '/insurance', '/goals'];
const DEFAULT_WIDGETS: WidgetType[] = [
    WidgetType.FINANCIAL_SUMMARY,
    WidgetType.EXPENSE_DISTRIBUTION,
    WidgetType.AI_SUMMARY,
    WidgetType.ALERTS,
    WidgetType.MONTHLY_SUMMARY,
    WidgetType.ANNUAL_PAYMENTS,
    WidgetType.GOALS,
    WidgetType.SAVINGS_SUMMARY,
    WidgetType.FIRE_TRACKER,
    WidgetType.HACIENDA_SUMMARY,
];
const DEFAULT_BOTTOM_NAV_SHORTCUTS: string[] = ['/', '/accounting', '/credits', '/settings'];

const DEFAULT_TAX_CONFIG: TaxConfig = {
    irpfScalesGeneral: [
        { limit: 12450, rate: 0.19 },
        { limit: 20200, rate: 0.24 },
        { limit: 35200, rate: 0.30 },
        { limit: 60000, rate: 0.37 },
        { limit: 300000, rate: 0.45 },
        { limit: Infinity, rate: 0.47 }
    ],
    irpfScalesSavings: [
        { limit: 6000, rate: 0.19 },
        { limit: 50000, rate: 0.21 },
        { limit: 200000, rate: 0.23 },
        { limit: 300000, rate: 0.27 },
        { limit: Infinity, rate: 0.28 }
    ],
    igicRate: 0.07,
    igicThreshold: 30000,
    region: 'Canarias'
};

const defaultUser: User = { id: 'default-user', name: 'Usuario Principal', color: PROFILE_COLORS[0] };
const initialUserData: UserData = { 
    transactions: [], 
    credits: [], 
    receipts: [], 
    insurancePolicies: [],
    goals: [],
    budgets: [],
    dashboardShortcuts: DEFAULT_SHORTCUTS,
    dashboardWidgets: DEFAULT_WIDGETS,
    bottomNavShortcuts: DEFAULT_BOTTOM_NAV_SHORTCUTS,
    incomeCategories: [],
    expenseCategories: [],
    hiddenDefaultIncomeCategories: [],
    hiddenDefaultExpenseCategories: [],
    expenseSubcategories: {},
    invoiceCategories: [],
    insuranceSubcategories: {},
    savedTaxReturns: [],
    educationProgress: {
        completedLevel: 0,
        checklistStates: {},
        milestones: [],
    },
    excludedInstances: {},
    propertyInvestments: [],
    manualAssets: [],
    financialSimulations: [],
    investmentTransactions: [],
    achievements: [],
    savedInsights: [],
    taxSimulations: [],
    taxConfig: DEFAULT_TAX_CONFIG,
};

const initialAppState: AppState = {
    users: [defaultUser],
    groups: [],
    activeView: { type: 'user', id: defaultUser.id },
    userData: {
        [defaultUser.id]: initialUserData
    }
};

const DEFAULT_INCOME_CATEGORIES = ['Nómina', 'Freelance', 'Regalos', 'Retiro de Ahorros', 'Otros'];
const DEFAULT_EXPENSE_CATEGORIES = ['Vivienda', 'Transporte', 'Alimentación', 'Compras', 'Ocio', 'Salud', 'Cuidado Personal', 'Familia y Niños', 'Mascotas', 'Créditos', 'Finanzas', 'Seguros', 'Regalos y Donaciones', 'Otros'];
const DEFAULT_INVOICE_CATEGORIES = ['Trabajo', 'Material Oficina', 'Viajes', 'Otros'];

export const DEFAULT_EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
    'Vivienda': ['Alquiler', 'Luz', 'Agua', 'Gas', 'Internet y Teléfono', 'Comunidad', 'IBI', 'Seguro de Hogar', 'Reparaciones', 'Mobiliario y Decoración', 'Alarma', 'Derrama'],
    'Transporte': ['Combustible', 'Transporte Público', 'Mantenimiento Vehículo', 'Parking', 'Peajes', 'Seguro de Vehículo', 'ITV', 'Impuesto de Circulación', 'Taxis/VTC'],
    'Alimentación': ['Supermercado', 'Restaurantes', 'Cafeterías y Bares', 'Comida a Domicilio'],
    'Compras': ['Ropa y Calzado', 'Tecnología', 'Hogar y Decoración', 'Libros y Papelería'],
    'Ocio': ['Suscripciones (Streaming, etc.)', 'Cine y Espectáculos', 'Gimnasio y Deporte', 'Vacaciones y Viajes', 'Hobbies', 'Salidas y Eventos'],
    'Salud': ['Farmacia', 'Médico', 'Seguro de Salud', 'Dentista', 'Óptica', 'Fisioterapia'],
    'Cuidado Personal': ['Peluquería y Estética', 'Productos de Higiene y Cosmética'],
    'Familia y Niños': ['Guardería/Colegio', 'Universidad', 'Actividades extraescolares', 'Juguetes y Ropa', 'Material escolar', 'Canguro'],
    'Mascotas': ['Comida', 'Veterinario', 'Accesorios', 'Peluquería canina'],
    'Créditos': ['Financiación', 'Tarjeta', 'Hipoteca', 'Préstamo'],
    'Finanzas': ['Comisiones', 'Asesoría', 'Impuestos'],
    'Seguros': ['Coche', 'Hogar', 'Vida', 'Salud', 'Otros'],
    'Regalos y Donaciones': ['Regalos', 'Donaciones ONG', 'Celebraciones'],
    'Otros': [],
};

type UserDataArrayKey = 'transactions' | 'credits' | 'receipts' | 'goals' | 'insurancePolicies' | 'budgets' | 'savedTaxReturns' | 'propertyInvestments' | 'incomeCategories' | 'expenseCategories' | 'financialSimulations' | 'investmentTransactions' | 'achievements' | 'savedInsights' | 'manualAssets' | 'taxSimulations';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useLocalStorage<AppState>('finanzen-app-state-v3', initialAppState);
  const [simulatedLiquidationIds, setSimulatedLiquidationIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Migration: ensure taxConfig exists
    const newState = { ...state };
    let hasChanges = false;
    
    Object.keys(newState.userData).forEach(userId => {
        if (!newState.userData[userId].taxConfig) {
            newState.userData[userId].taxConfig = DEFAULT_TAX_CONFIG;
            hasChanges = true;
        }
        if (!newState.userData[userId].taxSimulations) {
            newState.userData[userId].taxSimulations = [];
            hasChanges = true;
        }
    });

    if (hasChanges) {
        setState(newState);
    }
  }, []);

  const activeViewTarget = useMemo(() => {
    if (state.activeView.type === 'user') {
        return state.users.find(u => u.id === state.activeView.id) ?? null;
    }
    return state.groups.find(g => g.id === state.activeView.id) ?? null;
  }, [state.users, state.groups, state.activeView]);
  
  const groupMembers = useMemo(() => {
    if (state.activeView.type === 'group') {
        const group = state.groups.find(g => g.id === state.activeView.id);
        if (group) {
            return state.users.filter(u => group.userIds.includes(u.id));
        }
    }
    return [];
  }, [state.activeView, state.groups, state.users]);

  const getDataForView = <T extends Exclude<UserDataArrayKey, 'incomeCategories' | 'expenseCategories'>>(dataType: T): UserData[T] => {
    if (state.activeView.type === 'user') {
        return (state.userData[state.activeView.id]?.[dataType] ?? []) as UserData[T];
    }
    const group = state.groups.find(g => g.id === state.activeView.id);
    if (!group) return [] as UserData[T];
    
    return group.userIds.flatMap(userId => {
        const items = (state.userData[userId]?.[dataType] ?? []) as any[];
        return items.map(item => ({ ...item, ownerId: userId }));
    }) as UserData[T];
  };
  
    const getObjectCategoriesForView = (categoryType: 'incomeCategories' | 'expenseCategories', defaultCategories: readonly string[]): Category[] => {
      let userIds: string[];
      if (state.activeView.type === 'user') {
          userIds = [state.activeView.id];
      } else {
          const group = state.groups.find(g => g.id === state.activeView.id);
          userIds = group ? group.userIds : [];
      }

      let hiddenDefaults: string[] = [];
        if (categoryType === 'expenseCategories') {
           hiddenDefaults = userIds.flatMap(id => state.userData[id]?.hiddenDefaultExpenseCategories ?? []);
      } else if (categoryType === 'incomeCategories') {
           hiddenDefaults = userIds.flatMap(id => state.userData[id]?.hiddenDefaultIncomeCategories ?? []);
      }

      const customCategories: Category[] = userIds.flatMap(id => state.userData[id]?.[categoryType] ?? []).filter(Boolean);

      const visibleDefaults: Category[] = defaultCategories
          .filter(catName => !hiddenDefaults.includes(catName))
          .map(catName => ({ id: catName, name: catName, icon: '💰' }));

      const combined = [...visibleDefaults, ...customCategories];
      const uniqueCategories = Array.from(new Map(combined.map(cat => [cat.name, cat])).values());

      return uniqueCategories.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
    };

    const getStringCategoriesForView = (categoryType: 'invoiceCategories', defaultCategories: readonly string[]): string[] => {
        let userIds: string[];
        if (state.activeView.type === 'user') {
            userIds = [state.activeView.id];
        } else {
            const group = state.groups.find(g => g.id === state.activeView.id);
            userIds = group ? group.userIds : [];
        }

        const customCategories: string[] = userIds.flatMap(id => state.userData[id]?.[categoryType] ?? []);
        return [...new Set([...defaultCategories, ...customCategories])].sort();
    };
  
  const getExpenseSubcategoriesForView = (): Record<string, string[]> => {
    let userIds: string[];
    if (state.activeView.type === 'user') {
        userIds = [state.activeView.id];
    } else {
        const group = state.groups.find(g => g.id === state.activeView.id);
        userIds = group ? group.userIds : [];
    }

    const combined: Record<string, string[]> = JSON.parse(JSON.stringify(DEFAULT_EXPENSE_SUBCATEGORIES));
    
    userIds.forEach(id => {
        const userSubcategories = state.userData[id]?.expenseSubcategories;
        if (userSubcategories) {
            for (const category in userSubcategories) {
                if (!combined[category]) {
                    combined[category] = [];
                }
                combined[category] = [...new Set([...combined[category], ...userSubcategories[category]])];
            }
        }
    });

    return combined;
  };

  const getInsuranceSubcategoriesForView = (): Record<string, string[]> => {
    let userIds: string[];
    if (state.activeView.type === 'user') {
        userIds = [state.activeView.id];
    } else {
        const group = state.groups.find(g => g.id === state.activeView.id);
        userIds = group ? group.userIds : [];
    }

    const combined: Record<string, string[]> = {};
    INSURANCE_POLICY_TYPES.forEach(type => combined[type] = []);
    
    userIds.forEach(id => {
        const userSubcategories = state.userData[id]?.insuranceSubcategories;
        if (userSubcategories) {
            for (const category in userSubcategories) {
                if (!combined[category]) {
                    combined[category] = [];
                }
                combined[category] = [...new Set([...combined[category], ...userSubcategories[category]])];
            }
        }
    });

    return combined;
    };


  const transactions = useMemo(() => getDataForView('transactions'), [state.activeView, state.userData, state.groups]);
  const credits = useMemo(() => getDataForView('credits'), [state.activeView, state.userData, state.groups]);
  const receipts = useMemo(() => getDataForView('receipts'), [state.activeView, state.userData, state.groups]);
  const insurancePolicies = useMemo(() => getDataForView('insurancePolicies'), [state.activeView, state.userData, state.groups]);
  const goals = useMemo(() => getDataForView('goals'), [state.activeView, state.userData, state.groups]);
  const budgets = useMemo(() => getDataForView('budgets'), [state.activeView, state.userData, state.groups]);
  const savedTaxReturns = useMemo(() => getDataForView('savedTaxReturns'), [state.activeView, state.userData, state.groups]);
  const propertyInvestments = useMemo(() => getDataForView('propertyInvestments'), [state.activeView, state.userData, state.groups]);
  const manualAssets = useMemo(() => getDataForView('manualAssets'), [state.activeView, state.userData, state.groups]);
  const financialSimulations = useMemo(() => getDataForView('financialSimulations'), [state.activeView, state.userData, state.groups]);
  const investmentTransactions = useMemo(() => getDataForView('investmentTransactions'), [state.activeView, state.userData, state.groups]);
  const achievements = useMemo(() => getDataForView('achievements'), [state.activeView, state.userData, state.groups]);
  const savedInsights = useMemo(() => getDataForView('savedInsights'), [state.activeView, state.userData, state.groups]);
  const taxSimulations = useMemo(() => getDataForView('taxSimulations'), [state.activeView, state.userData, state.groups]);
  
  const taxConfig = useMemo(() => {
        if (state.activeView.type === 'user') {
            return state.userData[state.activeView.id]?.taxConfig ?? DEFAULT_TAX_CONFIG;
        }
        // Use active user config for group view fallback or specific user if available
        return state.userData[state.users[0].id]?.taxConfig ?? DEFAULT_TAX_CONFIG;
  }, [state.activeView, state.userData, state.users]);

  const incomeCategories = useMemo(() => getObjectCategoriesForView('incomeCategories', DEFAULT_INCOME_CATEGORIES), [state.activeView, state.userData, state.groups]);
  const expenseCategories = useMemo(() => getObjectCategoriesForView('expenseCategories', DEFAULT_EXPENSE_CATEGORIES), [state.activeView, state.userData, state.groups]);
  const invoiceCategories = useMemo(() => getStringCategoriesForView('invoiceCategories', DEFAULT_INVOICE_CATEGORIES), [state.activeView, state.userData, state.groups]);
  const expenseSubcategories = useMemo(() => getExpenseSubcategoriesForView(), [state.activeView, state.userData, state.groups]);
  const insuranceSubcategories = useMemo(() => getInsuranceSubcategoriesForView(), [state.activeView, state.userData, state.groups]);

  const dashboardShortcuts = useMemo(() => {
    if (state.activeView.type === 'user') {
        const userData = state.userData[state.activeView.id];
        if (userData && Array.isArray(userData.dashboardShortcuts)) {
            return userData.dashboardShortcuts;
        }
        return DEFAULT_SHORTCUTS;
    }
    return DEFAULT_SHORTCUTS;
  }, [state.activeView, state.userData]);

  const dashboardWidgets = useMemo(() => {
    const ALL_WIDGET_VALUES = new Set(Object.values(WidgetType));
    if (state.activeView.type === 'user') {
        const userData = state.userData[state.activeView.id];
        if (userData && Array.isArray(userData.dashboardWidgets)) {
            return userData.dashboardWidgets.filter(widget => ALL_WIDGET_VALUES.has(widget));
        }
        return DEFAULT_WIDGETS;
    }
    return DEFAULT_WIDGETS;
  }, [state.activeView, state.userData]);

  const bottomNavShortcuts = useMemo(() => {
    if (state.activeView.type === 'user') {
        const userData = state.userData[state.activeView.id];
        if (userData && Array.isArray(userData.bottomNavShortcuts) && userData.bottomNavShortcuts.length > 0) {
            return userData.bottomNavShortcuts;
        }
        return DEFAULT_BOTTOM_NAV_SHORTCUTS;
    }
    return DEFAULT_BOTTOM_NAV_SHORTCUTS;
  }, [state.activeView, state.userData]);


  const educationProgress = useMemo(() => {
    if (state.activeView.type === 'user') {
        const userData = state.userData[state.activeView.id];
        return userData?.educationProgress ?? initialUserData.educationProgress!;
    }
    return initialUserData.educationProgress!;
  }, [state.activeView, state.userData]);

  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = [];
    
    receipts.forEach(receipt => {
        if (receipt.cancellationReminder && receipt.cancellationNoticeMonths && receipt.autoRenews) {
            const dueDate = new Date(receipt.date);
            const reminderDate = new Date(dueDate);
            reminderDate.setMonth(dueDate.getMonth() - receipt.cancellationNoticeMonths);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (today >= reminderDate && today < dueDate) {
                generatedAlerts.push({
                    id: `alert-receipt-${receipt.id}`,
                    type: 'cancellation_reminder',
                    message: `Recordatorio para cancelar tu recibo '${receipt.title}'.`,
                    date: receipt.date,
                    sourceId: receipt.id,
                    title: receipt.title,
                });
            }
        }
    });

    insurancePolicies.forEach(policy => {
        if (policy.cancellationReminder && policy.cancellationNoticeMonths) {
            const renewalDate = new Date(policy.renewalDate);
            const reminderDate = new Date(renewalDate);
            reminderDate.setMonth(renewalDate.getMonth() - policy.cancellationNoticeMonths);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (today >= reminderDate && today < renewalDate) {
                generatedAlerts.push({
                    id: `alert-policy-${policy.id}`,
                    type: 'cancellation_reminder',
                    message: `Recordatorio de renovación para el seguro '${policy.name}'.`,
                    date: policy.renewalDate,
                    sourceId: policy.id,
                    title: policy.name,
                });
            }
        }
    });

    return generatedAlerts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [receipts, insurancePolicies]);

  const excludedInstances = useMemo(() => {
      if (state.activeView.type === 'user') {
          return state.userData[state.activeView.id]?.excludedInstances ?? {};
      }
      return {};
  }, [state.activeView, state.userData]);

  const getOwnerId = (explicitOwnerId?: string): string => {
      if (explicitOwnerId) return explicitOwnerId;
      if (state.activeView.type === 'user') return state.activeView.id;
      if (state.groups.length > 0) {
          const group = state.groups.find(g => g.id === state.activeView.id);
          if (group && group.userIds.length > 0) return group.userIds[0];
      }
      return state.users[0].id;
  };

  const updateStateData = (ownerId: string, key: UserDataArrayKey, item: any, action: 'add' | 'update' | 'delete', itemId?: string) => {
      setState(prev => {
          const userData = prev.userData[ownerId] || { ...initialUserData };
          let list = userData[key] as any[];
          
          if (action === 'add') {
              list = [...list, item];
          } else if (action === 'update') {
              list = list.map(i => i.id === item.id ? item : i);
          } else if (action === 'delete' && itemId) {
              list = list.filter(i => i.id !== itemId);
          }
          
          return {
              ...prev,
              userData: {
                  ...prev.userData,
                  [ownerId]: {
                      ...userData,
                      [key]: list
                  }
              }
          };
      });
  };

  // --- Actions ---

  const addTransaction = (t: Omit<Transaction, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'transactions', { ...t, id }, 'add');
  };

  const updateTransaction = (t: Transaction) => {
      const targetOwner = getOwnerId(t.ownerId);
      updateStateData(targetOwner, 'transactions', t, 'update');
  };

  const deleteTransaction = (id: string) => {
      // Need to find owner first
      for (const uid in state.userData) {
          const tx = state.userData[uid].transactions.find(t => t.id === id);
          if (tx) {
              updateStateData(uid, 'transactions', null, 'delete', id);
              break;
          }
      }
  };

  const addCredit = (c: Omit<Credit, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'credits', { ...c, id }, 'add');
      
      // Auto-add monthly transaction
      addTransaction({
          type: TransactionType.EXPENSE,
          category: 'Créditos',
          subcategory: c.subcategory,
          amount: c.monthlyPayment,
          description: `Cuota ${c.name}`,
          date: new Date().toISOString().split('T')[0],
          frequency: 'monthly',
          creditId: id
      }, targetOwner);
  };

  const updateCredit = (c: Credit) => {
      const targetOwner = getOwnerId(c.ownerId);
      updateStateData(targetOwner, 'credits', c, 'update');
  };

  const deleteCredit = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].credits.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'credits', null, 'delete', id);
              // Also remove associated transactions
              const userTx = state.userData[uid].transactions.filter(t => t.creditId !== id);
              setState(prev => ({
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [uid]: { ...prev.userData[uid], transactions: userTx }
                  }
              }));
              break;
          }
      }
  };

  const addReceipt = async (r: Omit<Receipt, 'id'> & { contractFileData?: string }, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      
      let contractFileId = undefined;
      if (r.contractFileData) {
          contractFileId = `receipt-${id}`;
          await saveFile(contractFileId, r.contractFileData);
      }
      
      const { contractFileData, ...receiptData } = r;
      const newReceipt = { ...receiptData, id, contractFileId };
      
      updateStateData(targetOwner, 'receipts', newReceipt, 'add');

      // Auto-add transaction if it's a recurring receipt
      if (newReceipt.type === 'receipt') {
          addTransaction({
              type: TransactionType.EXPENSE,
              category: 'Otros', // Default, user should organize
              amount: newReceipt.amount,
              description: newReceipt.title,
              date: newReceipt.date,
              frequency: newReceipt.frequency,
          }, targetOwner);
      }
  };

  const updateReceipt = async (r: Receipt, newFile?: string) => {
      const targetOwner = getOwnerId(r.ownerId);
      let updatedReceipt = { ...r };
      
      if (newFile) {
          const fileId = `receipt-${r.id}`;
          await saveFile(fileId, newFile);
          updatedReceipt.contractFileId = fileId;
      }
      
      updateStateData(targetOwner, 'receipts', updatedReceipt, 'update');
  };

  const deleteReceipt = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].receipts.find(i => i.id === id);
          if (item) {
              if (item.contractFileId) deleteFile(item.contractFileId);
              updateStateData(uid, 'receipts', null, 'delete', id);
              break;
          }
      }
  };

  const addInsurancePolicy = async (p: Omit<InsurancePolicy, 'id'> & { contractFileData?: string }, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      
      let contractFileId = undefined;
      if (p.contractFileData) {
          contractFileId = `policy-${id}`;
          await saveFile(contractFileId, p.contractFileData);
      }

      const { contractFileData, ...policyData } = p;
      const newPolicy = { ...policyData, id, contractFileId };

      updateStateData(targetOwner, 'insurancePolicies', newPolicy, 'add');

      addTransaction({
          type: TransactionType.EXPENSE,
          category: 'Seguros',
          subcategory: p.policyType,
          amount: p.premium,
          description: p.name,
          date: p.renewalDate,
          frequency: p.paymentFrequency,
          insuranceId: id,
      }, targetOwner);
  };

  const updateInsurancePolicy = async (p: InsurancePolicy, newFile?: string) => {
      const targetOwner = getOwnerId(p.ownerId);
      let updatedPolicy = { ...p };

      if (newFile) {
          const fileId = `policy-${p.id}`;
          await saveFile(fileId, newFile);
          updatedPolicy.contractFileId = fileId;
      }

      updateStateData(targetOwner, 'insurancePolicies', updatedPolicy, 'update');
  };

  const deleteInsurancePolicy = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].insurancePolicies.find(i => i.id === id);
          if (item) {
              if (item.contractFileId) deleteFile(item.contractFileId);
              updateStateData(uid, 'insurancePolicies', null, 'delete', id);
              // Clean up transactions
              const userTx = state.userData[uid].transactions.filter(t => t.insuranceId !== id);
              setState(prev => ({
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [uid]: { ...prev.userData[uid], transactions: userTx }
                  }
              }));
              break;
          }
      }
  };

  const addGoal = (g: Omit<Goal, 'id' | 'contributionHistory'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'goals', { ...g, id, contributionHistory: [] }, 'add');
  };

  const updateGoal = (g: Goal) => {
      const targetOwner = getOwnerId(g.ownerId);
      updateStateData(targetOwner, 'goals', g, 'update');
  };

  const deleteGoal = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].goals.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'goals', null, 'delete', id);
              // Clean up transactions
              const userTx = state.userData[uid].transactions.filter(t => t.goalId !== id);
              setState(prev => ({
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [uid]: { ...prev.userData[uid], transactions: userTx }
                  }
              }));
              break;
          }
      }
  };

  const addFundsToGoal = (goalId: string, amount: number, description?: string) => {
      // Find goal owner
      let ownerId = '';
      let goal: Goal | undefined;
      for (const uid in state.userData) {
          goal = state.userData[uid].goals.find(g => g.id === goalId);
          if (goal) {
              ownerId = uid;
              break;
          }
      }
      if (!goal || !ownerId) return;

      const contributionId = crypto.randomUUID();
      const newContribution: GoalContribution = {
          id: contributionId,
          date: new Date().toISOString(),
          amount,
          description
      };

      const updatedGoal = {
          ...goal,
          currentAmount: goal.currentAmount + amount,
          contributionHistory: [...(goal.contributionHistory || []), newContribution]
      };
      
      updateStateData(ownerId, 'goals', updatedGoal, 'update');

      if (goal.createTransactions) {
          addTransaction({
              type: TransactionType.SAVING,
              category: 'Ahorro',
              amount,
              description: `Aportación a meta: ${goal.name}`,
              date: new Date().toISOString().split('T')[0],
              goalId: goal.id,
              goalContributionId: contributionId
          }, ownerId);
      }
  };

  const updateGoalContribution = (goalId: string, contribution: GoalContribution) => {
      let ownerId = '';
      let goal: Goal | undefined;
      for (const uid in state.userData) {
          goal = state.userData[uid].goals.find(g => g.id === goalId);
          if (goal) {
              ownerId = uid;
              break;
          }
      }
      if (!goal || !ownerId) return;

      const oldContribution = goal.contributionHistory?.find(c => c.id === contribution.id);
      if (!oldContribution) return;

      // Calculate diff if not excluded
      let amountDiff = 0;
      if (!contribution.isExcluded && !oldContribution.isExcluded) {
          amountDiff = contribution.amount - oldContribution.amount;
      } else if (contribution.isExcluded && !oldContribution.isExcluded) {
          amountDiff = -oldContribution.amount;
      } else if (!contribution.isExcluded && oldContribution.isExcluded) {
          amountDiff = contribution.amount;
      }

      const updatedHistory = goal.contributionHistory?.map(c => c.id === contribution.id ? contribution : c) || [];
      const updatedGoal = {
          ...goal,
          currentAmount: goal.currentAmount + amountDiff,
          contributionHistory: updatedHistory
      };

      updateStateData(ownerId, 'goals', updatedGoal, 'update');

      // Update related transaction
      const transaction = state.userData[ownerId].transactions.find(t => t.goalContributionId === contribution.id);
      if (transaction) {
          if (contribution.isExcluded) {
              // Delete transaction if excluded
              deleteTransaction(transaction.id);
          } else {
              // Update transaction
              updateTransaction({
                  ...transaction,
                  amount: contribution.amount,
                  date: contribution.date,
                  description: `Aportación a meta: ${goal.name}` + (contribution.description ? ` (${contribution.description})` : '')
              });
          }
      } else if (!contribution.isExcluded && goal.createTransactions) {
          // Re-create transaction if included and missing
           addTransaction({
              type: TransactionType.SAVING,
              category: 'Ahorro',
              amount: contribution.amount,
              description: `Aportación a meta: ${goal.name}` + (contribution.description ? ` (${contribution.description})` : ''),
              date: new Date(contribution.date).toISOString().split('T')[0],
              goalId: goal.id,
              goalContributionId: contribution.id
          }, ownerId);
      }
  };

  const deleteGoalContribution = (goalId: string, contributionId: string) => {
      let ownerId = '';
      let goal: Goal | undefined;
      for (const uid in state.userData) {
          goal = state.userData[uid].goals.find(g => g.id === goalId);
          if (goal) {
              ownerId = uid;
              break;
          }
      }
      if (!goal || !ownerId) return;

      const contribution = goal.contributionHistory?.find(c => c.id === contributionId);
      if (!contribution) return;

      const updatedHistory = goal.contributionHistory?.filter(c => c.id !== contributionId) || [];
      const amountToSubtract = contribution.isExcluded ? 0 : contribution.amount;

      const updatedGoal = {
          ...goal,
          currentAmount: goal.currentAmount - amountToSubtract,
          contributionHistory: updatedHistory
      };

      updateStateData(ownerId, 'goals', updatedGoal, 'update');

      // Remove transaction
      const transaction = state.userData[ownerId].transactions.find(t => t.goalContributionId === contributionId);
      if (transaction) {
          deleteTransaction(transaction.id);
      }
  };

  const addBudget = (b: Omit<Budget, 'id' | 'contributionHistory'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'budgets', { ...b, id, contributionHistory: [] }, 'add');
  };

  const updateBudget = (b: Budget) => {
      const targetOwner = getOwnerId(b.ownerId);
      updateStateData(targetOwner, 'budgets', b, 'update');
  };

  const deleteBudget = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].budgets.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'budgets', null, 'delete', id);
              // Clean up transactions
              const userTx = state.userData[uid].transactions.filter(t => t.budgetId !== id);
              setState(prev => ({
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [uid]: { ...prev.userData[uid], transactions: userTx }
                  }
              }));
              break;
          }
      }
  };

  const addFundsToBudget = (budgetId: string, amount: number, description?: string) => {
      let ownerId = '';
      let budget: Budget | undefined;
      for (const uid in state.userData) {
          budget = state.userData[uid].budgets.find(b => b.id === budgetId);
          if (budget) {
              ownerId = uid;
              break;
          }
      }
      if (!budget || !ownerId) return;

      const contributionId = crypto.randomUUID();
      const newContribution: BudgetContribution = {
          id: contributionId,
          date: new Date().toISOString(),
          amount,
          description
      };

      const updatedBudget = {
          ...budget,
          currentAmount: budget.currentAmount + amount,
          contributionHistory: [...(budget.contributionHistory || []), newContribution]
      };
      
      updateStateData(ownerId, 'budgets', updatedBudget, 'update');

      if (budget.createTransactions) {
          addTransaction({
              type: TransactionType.SAVING,
              category: 'Ahorro',
              amount,
              description: `Aportación a fondo: ${budget.name}`,
              date: new Date().toISOString().split('T')[0],
              budgetId: budget.id,
              budgetContributionId: contributionId
          }, ownerId);
      }
  };

  const updateBudgetContribution = (budgetId: string, contribution: BudgetContribution) => {
      let ownerId = '';
      let budget: Budget | undefined;
      for (const uid in state.userData) {
          budget = state.userData[uid].budgets.find(b => b.id === budgetId);
          if (budget) {
              ownerId = uid;
              break;
          }
      }
      if (!budget || !ownerId) return;

      const oldContribution = budget.contributionHistory?.find(c => c.id === contribution.id);
      if (!oldContribution) return;

      let amountDiff = 0;
      if (!contribution.isExcluded && !oldContribution.isExcluded) {
          amountDiff = contribution.amount - oldContribution.amount;
      } else if (contribution.isExcluded && !oldContribution.isExcluded) {
          amountDiff = -oldContribution.amount;
      } else if (!contribution.isExcluded && oldContribution.isExcluded) {
          amountDiff = contribution.amount;
      }

      const updatedHistory = budget.contributionHistory?.map(c => c.id === contribution.id ? contribution : c) || [];
      const updatedBudget = {
          ...budget,
          currentAmount: budget.currentAmount + amountDiff,
          contributionHistory: updatedHistory
      };

      updateStateData(ownerId, 'budgets', updatedBudget, 'update');

      const transaction = state.userData[ownerId].transactions.find(t => t.budgetContributionId === contribution.id);
      if (transaction) {
          if (contribution.isExcluded) {
              deleteTransaction(transaction.id);
          } else {
              updateTransaction({
                  ...transaction,
                  amount: contribution.amount,
                  date: contribution.date,
                  description: `Aportación a fondo: ${budget.name}` + (contribution.description ? ` (${contribution.description})` : '')
              });
          }
      } else if (!contribution.isExcluded && budget.createTransactions) {
           addTransaction({
              type: TransactionType.SAVING,
              category: 'Ahorro',
              amount: contribution.amount,
              description: `Aportación a fondo: ${budget.name}` + (contribution.description ? ` (${contribution.description})` : ''),
              date: new Date(contribution.date).toISOString().split('T')[0],
              budgetId: budget.id,
              budgetContributionId: contribution.id
          }, ownerId);
      }
  };

  const deleteBudgetContribution = (budgetId: string, contributionId: string) => {
      let ownerId = '';
      let budget: Budget | undefined;
      for (const uid in state.userData) {
          budget = state.userData[uid].budgets.find(b => b.id === budgetId);
          if (budget) {
              ownerId = uid;
              break;
          }
      }
      if (!budget || !ownerId) return;

      const contribution = budget.contributionHistory?.find(c => c.id === contributionId);
      if (!contribution) return;

      const updatedHistory = budget.contributionHistory?.filter(c => c.id !== contributionId) || [];
      const amountToSubtract = contribution.isExcluded ? 0 : contribution.amount;

      const updatedBudget = {
          ...budget,
          currentAmount: budget.currentAmount - amountToSubtract,
          contributionHistory: updatedHistory
      };

      updateStateData(ownerId, 'budgets', updatedBudget, 'update');

      const transaction = state.userData[ownerId].transactions.find(t => t.budgetContributionId === contributionId);
      if (transaction) {
          deleteTransaction(transaction.id);
      }
  };

  const addPropertyInvestment = (p: Omit<PropertyInvestment, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'propertyInvestments', { ...p, id }, 'add');
  };

  const updatePropertyInvestment = (p: PropertyInvestment) => {
      const targetOwner = getOwnerId(p.ownerId);
      updateStateData(targetOwner, 'propertyInvestments', p, 'update');
  };

  const deletePropertyInvestment = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].propertyInvestments.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'propertyInvestments', null, 'delete', id);
              break;
          }
      }
  };

  const addManualAsset = (a: Omit<ManualAsset, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'manualAssets', { ...a, id }, 'add');
  };

  const updateManualAsset = (a: ManualAsset) => {
      const targetOwner = getOwnerId(a.ownerId);
      updateStateData(targetOwner, 'manualAssets', a, 'update');
  };

  const deleteManualAsset = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].manualAssets.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'manualAssets', null, 'delete', id);
              break;
          }
      }
  };

  const addFinancialSimulation = (s: Omit<FinancialSimulation, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'financialSimulations', { ...s, id }, 'add');
  };

  const updateFinancialSimulation = (s: FinancialSimulation) => {
      const targetOwner = getOwnerId(s.ownerId);
      updateStateData(targetOwner, 'financialSimulations', s, 'update');
  };

  const deleteFinancialSimulation = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].financialSimulations.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'financialSimulations', null, 'delete', id);
              break;
          }
      }
  };

  const addInvestmentTransaction = (i: Omit<InvestmentTransaction, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'investmentTransactions', { ...i, id }, 'add');
  };

  const updateInvestmentTransaction = (i: InvestmentTransaction) => {
      const targetOwner = getOwnerId(i.ownerId);
      updateStateData(targetOwner, 'investmentTransactions', i, 'update');
  };

  const deleteInvestmentTransaction = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].investmentTransactions.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'investmentTransactions', null, 'delete', id);
              break;
          }
      }
  };

  const updateDashboardShortcuts = (shortcuts: string[]) => {
      if (state.activeView.type === 'user') {
          setState(prev => ({
              ...prev,
              userData: {
                  ...prev.userData,
                  [state.activeView.id]: {
                      ...prev.userData[state.activeView.id],
                      dashboardShortcuts: shortcuts
                  }
              }
          }));
      }
  };

  const updateDashboardWidgets = (widgets: WidgetType[]) => {
      if (state.activeView.type === 'user') {
          setState(prev => ({
              ...prev,
              userData: {
                  ...prev.userData,
                  [state.activeView.id]: {
                      ...prev.userData[state.activeView.id],
                      dashboardWidgets: widgets
                  }
              }
          }));
      }
  };

  const updateBottomNavShortcuts = (shortcuts: string[]) => {
      if (state.activeView.type === 'user') {
          setState(prev => ({
              ...prev,
              userData: {
                  ...prev.userData,
                  [state.activeView.id]: {
                      ...prev.userData[state.activeView.id],
                      bottomNavShortcuts: shortcuts
                  }
              }
          }));
      }
  };

  const updateCreditToxicity = (id: string, report: ToxicityReport) => {
      for (const uid in state.userData) {
          const credit = state.userData[uid].credits.find(c => c.id === id);
          if (credit) {
              updateCredit({ ...credit, toxicityReport: report });
              break;
          }
      }
  };

  const deleteCreditToxicity = (id: string) => {
      for (const uid in state.userData) {
          const credit = state.userData[uid].credits.find(c => c.id === id);
          if (credit) {
              const { toxicityReport, ...rest } = credit;
              updateCredit(rest);
              break;
          }
      }
  };

  const addUser = (name: string) => {
      const newUser: User = { id: crypto.randomUUID(), name, color: PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)] };
      setState(prev => ({
          ...prev,
          users: [...prev.users, newUser],
          userData: {
              ...prev.userData,
              [newUser.id]: { ...initialUserData }
          }
      }));
  };

  const updateUser = (id: string, updates: Partial<Omit<User, 'id'>>) => {
      setState(prev => ({
          ...prev,
          users: prev.users.map(u => u.id === id ? { ...u, ...updates } : u)
      }));
  };

  const deleteUser = (id: string) => {
      setState(prev => {
          if (prev.users.length <= 1) return prev; // Cannot delete the last user
          
          const newUsers = prev.users.filter(u => u.id !== id);
          const newUserData = { ...prev.userData };
          delete newUserData[id];
          
          const newGroups = prev.groups.map(g => ({
              ...g,
              userIds: g.userIds.filter(uid => uid !== id)
          }));
          
          let newActiveView = prev.activeView;
          if (prev.activeView.type === 'user' && prev.activeView.id === id) {
              newActiveView = { type: 'user', id: newUsers[0].id };
          }
          
          return {
              ...prev,
              users: newUsers,
              userData: newUserData,
              groups: newGroups,
              activeView: newActiveView
          };
      });
  };

  const switchView = (view: ActiveView) => {
      setState(prev => ({ ...prev, activeView: view }));
  };

  const addGroup = (name: string, userIds: string[]) => {
      const newGroup: Group = { id: crypto.randomUUID(), name, userIds };
      setState(prev => ({
          ...prev,
          groups: [...prev.groups, newGroup]
      }));
  };

  const updateGroup = (id: string, name: string, userIds: string[]) => {
      setState(prev => ({
          ...prev,
          groups: prev.groups.map(g => g.id === id ? { ...g, name, userIds } : g)
      }));
  };

  const deleteGroup = (id: string) => {
      setState(prev => {
          let nextActiveView = prev.activeView;
          if (prev.activeView.type === 'group' && prev.activeView.id === id) {
              nextActiveView = { type: 'user', id: prev.users[0].id };
          }
          return {
              ...prev,
              groups: prev.groups.filter(g => g.id !== id),
              activeView: nextActiveView
          };
      });
  };

  const addIncomeCategory = (c: Omit<Category, 'id'>) => {
      const id = c.name; // Use name as ID for simple deduplication logic in this app
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'incomeCategories', { ...c, id }, 'add');
      }
  };

  const updateIncomeCategory = (id: string, updates: Partial<Omit<Category, 'id'>>) => {
      if (state.activeView.type === 'user') {
          const current = state.userData[state.activeView.id].incomeCategories.find(c => c.id === id);
          if (current) {
              updateStateData(state.activeView.id, 'incomeCategories', { ...current, ...updates }, 'update');
          }
      }
  };

  const deleteIncomeCategory = (id: string) => {
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'incomeCategories', null, 'delete', id);
      }
  };

  const addExpenseCategory = (c: Omit<Category, 'id'>) => {
      const id = c.name;
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'expenseCategories', { ...c, id }, 'add');
      }
  };

  const updateExpenseCategory = (id: string, updates: Partial<Omit<Category, 'id'>>) => {
      if (state.activeView.type === 'user') {
          const current = state.userData[state.activeView.id].expenseCategories.find(c => c.id === id);
          if (current) {
              updateStateData(state.activeView.id, 'expenseCategories', { ...current, ...updates }, 'update');
          }
      }
  };

  const deleteExpenseCategory = (id: string) => {
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'expenseCategories', null, 'delete', id);
      }
  };

  const addExpenseSubcategory = (category: string, subcategory: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.expenseSubcategories[category] || [];
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          expenseSubcategories: {
                              ...userData.expenseSubcategories,
                              [category]: [...currentSubs, subcategory]
                          }
                      }
                  }
              };
          });
      }
  };

  const updateExpenseSubcategory = (category: string, oldName: string, newName: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.expenseSubcategories[category] || [];
              const updatedSubs = currentSubs.map(s => s === oldName ? newName : s);
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          expenseSubcategories: {
                              ...userData.expenseSubcategories,
                              [category]: updatedSubs
                          }
                      }
                  }
              };
          });
      }
  };

  const deleteExpenseSubcategory = (category: string, subcategory: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.expenseSubcategories[category] || [];
              const updatedSubs = currentSubs.filter(s => s !== subcategory);
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          expenseSubcategories: {
                              ...userData.expenseSubcategories,
                              [category]: updatedSubs
                          }
                      }
                  }
              };
          });
      }
  };

  const addInvoiceCategory = (category: string, ownerId: string) => {
      setState(prev => {
          const userData = prev.userData[ownerId];
          const currentCats = userData.invoiceCategories || [];
          if (!currentCats.includes(category)) {
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [ownerId]: {
                          ...userData,
                          invoiceCategories: [...currentCats, category]
                      }
                  }
              };
          }
          return prev;
      });
  };

  const addInsuranceSubcategory = (type: InsurancePolicyType, subcategory: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.insuranceSubcategories[type] || [];
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          insuranceSubcategories: {
                              ...userData.insuranceSubcategories,
                              [type]: [...currentSubs, subcategory]
                          }
                      }
                  }
              };
          });
      }
  };

  const updateInsuranceSubcategory = (type: InsurancePolicyType, oldName: string, newName: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.insuranceSubcategories[type] || [];
              const updatedSubs = currentSubs.map(s => s === oldName ? newName : s);
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          insuranceSubcategories: {
                              ...userData.insuranceSubcategories,
                              [type]: updatedSubs
                          }
                      }
                  }
              };
          });
      }
  };

  const deleteInsuranceSubcategory = (type: InsurancePolicyType, subcategory: string) => {
      if (state.activeView.type === 'user') {
          setState(prev => {
              const userData = prev.userData[state.activeView.id];
              const currentSubs = userData.insuranceSubcategories[type] || [];
              const updatedSubs = currentSubs.filter(s => s !== subcategory);
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [state.activeView.id]: {
                          ...userData,
                          insuranceSubcategories: {
                              ...userData.insuranceSubcategories,
                              [type]: updatedSubs
                          }
                      }
                  }
              };
          });
      }
  };

  const addSavedTaxReturn = (r: Omit<SavedTaxReturn, 'id' | 'dateSaved'>) => {
      if (state.activeView.type === 'user') {
          const id = crypto.randomUUID();
          updateStateData(state.activeView.id, 'savedTaxReturns', { ...r, id, dateSaved: new Date().toISOString() }, 'add');
      }
  };

  const deleteSavedTaxReturn = (id: string) => {
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'savedTaxReturns', null, 'delete', id);
      }
  };

  const updateEducationProgress = (p: Partial<EducationProgress>) => {
      if (state.activeView.type === 'user') {
          const ownerId = state.activeView.id;
          setState(prev => {
              const userData = prev.userData[ownerId];
              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [ownerId]: {
                          ...userData,
                          educationProgress: {
                              ...userData.educationProgress,
                              ...p
                          }
                      }
                  }
              };
          });
      }
  };

  const toggleTransactionInstanceExclusion = (instanceId: string) => {
      if (state.activeView.type === 'user') {
          const ownerId = state.activeView.id;
          setState(prev => {
              const userData = prev.userData[ownerId];
              const currentExclusions = userData.excludedInstances || {};
              const newExclusions = { ...currentExclusions };
              
              if (newExclusions[instanceId]) {
                  delete newExclusions[instanceId];
              } else {
                  newExclusions[instanceId] = true;
              }

              return {
                  ...prev,
                  userData: {
                      ...prev.userData,
                      [ownerId]: {
                          ...userData,
                          excludedInstances: newExclusions
                      }
                  }
              };
          });
      }
  };

  const getExpandedTransactionsForYear = (year: number) => {
      const activeTransactions = transactions;
      const activeReceipts = receipts;
      const expanded: (Transaction & { instanceId: string, isExcluded?: boolean })[] = [];
      const excluded = (state.activeView.type === 'user' ? state.userData[state.activeView.id]?.excludedInstances : {}) || {};

      activeTransactions.forEach(t => {
          if (!t.frequency || t.frequency === 'one-time') {
              // Regular transaction
              const tDate = new Date(t.date + 'T00:00:00Z');
              if (tDate.getUTCFullYear() === year) {
                  const instanceId = `tx-${t.id}`;
                  expanded.push({ ...t, instanceId, isExcluded: !!excluded[instanceId] });
              }
          } else {
              // Recurring transaction
              const startDate = new Date(t.date + 'T00:00:00Z');
              let currentDate = new Date(startDate);
              
              // Only generate for the requested year
              // Fast forward to start of year if needed
              if (currentDate.getUTCFullYear() < year) {
                  // Rough jump to year start, logic could be refined for precise dates
                  while(currentDate.getUTCFullYear() < year) {
                      switch (t.frequency) {
                          case 'monthly': currentDate.setUTCMonth(currentDate.getUTCMonth() + 1); break;
                          case 'quarterly': currentDate.setUTCMonth(currentDate.getUTCMonth() + 3); break;
                          case 'semiannually': currentDate.setUTCMonth(currentDate.getUTCMonth() + 6); break;
                          case 'annually': currentDate.setUTCFullYear(currentDate.getUTCFullYear() + 1); break;
                      }
                  }
              }

              while (currentDate.getUTCFullYear() <= year) {
                  if (currentDate.getUTCFullYear() === year) {
                      const dateStr = currentDate.toISOString().split('T')[0];
                      const instanceId = `tx-${t.id}-${dateStr}`;
                      expanded.push({
                          ...t,
                          date: dateStr,
                          instanceId,
                          isExcluded: !!excluded[instanceId]
                      });
                  }
                  
                  // Increment date
                  switch (t.frequency) {
                      case 'monthly': currentDate.setUTCMonth(currentDate.getUTCMonth() + 1); break;
                      case 'quarterly': currentDate.setUTCMonth(currentDate.getUTCMonth() + 3); break;
                      case 'semiannually': currentDate.setUTCMonth(currentDate.getUTCMonth() + 6); break;
                      case 'annually': currentDate.setUTCFullYear(currentDate.getUTCFullYear() + 1); break;
                  }
              }
          }
      });
      
      // Expand Receipts that are not linked to transactions (if any legacy ones exist, though we create txs on addReceipt now)
      // NOTE: Current logic adds a transaction for each receipt/credit/insurance, so we don't need to double count.
      // However, if we wanted to view 'projected' expenses from receipts alone, we would iterate receipts here.
      // Since addReceipt creates a transaction, we rely on the transaction list for accounting.

      return expanded.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const grantAchievement = (id: string) => {
      if (state.activeView.type === 'user') {
          const userData = state.userData[state.activeView.id];
          if (!userData.achievements.some(a => a.id === id)) {
              updateStateData(state.activeView.id, 'achievements', { id, unlockedDate: new Date().toISOString() }, 'add');
              // Could trigger a toast notification here
          }
      }
  };

  const addSavedInsight = (i: Omit<SavedInsight, 'id'>) => {
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'savedInsights', { ...i, id: crypto.randomUUID() }, 'add');
      }
  };

  const deleteSavedInsight = (id: string) => {
      if (state.activeView.type === 'user') {
          updateStateData(state.activeView.id, 'savedInsights', null, 'delete', id);
      }
  };

  const toggleSimulatedLiquidation = (creditId: string) => {
      setSimulatedLiquidationIds(prev => {
          const next = new Set(prev);
          if (next.has(creditId)) {
              next.delete(creditId);
          } else {
              next.add(creditId);
          }
          return next;
      });
  };

  const addTaxSimulation = (s: Omit<TaxSimulation, 'id'>, ownerId?: string) => {
      const id = crypto.randomUUID();
      const targetOwner = getOwnerId(ownerId);
      updateStateData(targetOwner, 'taxSimulations', { ...s, id }, 'add');
  };

  const updateTaxSimulation = (s: TaxSimulation) => {
      const targetOwner = getOwnerId(s.ownerId);
      updateStateData(targetOwner, 'taxSimulations', s, 'update');
  };

  const deleteTaxSimulation = (id: string) => {
      for (const uid in state.userData) {
          const item = state.userData[uid].taxSimulations.find(i => i.id === id);
          if (item) {
              updateStateData(uid, 'taxSimulations', null, 'delete', id);
              break;
          }
      }
  };

  const updateTaxConfig = (config: TaxConfig, ownerId?: string) => {
      const targetOwner = getOwnerId(ownerId);
      setState(prev => ({
          ...prev,
          userData: {
              ...prev.userData,
              [targetOwner]: {
                  ...prev.userData[targetOwner],
                  taxConfig: config
              }
          }
      }));
  };

  const value: AppContextType = {
    users: state.users,
    groups: state.groups,
    activeView: state.activeView,
    activeViewTarget,
    groupMembers,
    transactions,
    credits,
    receipts,
    insurancePolicies,
    goals,
    budgets,
    dashboardShortcuts,
    dashboardWidgets,
    bottomNavShortcuts,
    alerts,
    incomeCategories,
    expenseCategories,
    expenseSubcategories,
    invoiceCategories,
    insuranceSubcategories,
    savedTaxReturns,
    educationProgress,
    excludedInstances,
    propertyInvestments,
    manualAssets,
    financialSimulations,
    investmentTransactions,
    achievements,
    savedInsights,
    simulatedLiquidationIds,
    taxSimulations,
    taxConfig,

    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCredit,
    updateCredit,
    deleteCredit,
    addReceipt,
    updateReceipt,
    deleteReceipt,
    addInsurancePolicy,
    updateInsurancePolicy,
    deleteInsurancePolicy,
    addGoal,
    updateGoal,
    deleteGoal,
    addFundsToGoal,
    updateGoalContribution,
    deleteGoalContribution,
    addBudget,
    updateBudget,
    deleteBudget,
    addFundsToBudget,
    updateBudgetContribution,
    deleteBudgetContribution,
    addPropertyInvestment,
    updatePropertyInvestment,
    deletePropertyInvestment,
    addManualAsset,
    updateManualAsset,
    deleteManualAsset,
    addFinancialSimulation,
    updateFinancialSimulation,
    deleteFinancialSimulation,
    addInvestmentTransaction,
    updateInvestmentTransaction,
    deleteInvestmentTransaction,
    updateDashboardShortcuts,
    updateDashboardWidgets,
    updateBottomNavShortcuts,
    updateCreditToxicity,
    deleteCreditToxicity,
    addUser,
    updateUser,
    deleteUser,
    switchView,
    addGroup,
    updateGroup,
    deleteGroup,
    addIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    addExpenseSubcategory,
    updateExpenseSubcategory,
    deleteExpenseSubcategory,
    addInvoiceCategory,
    addInsuranceSubcategory,
    updateInsuranceSubcategory,
    deleteInsuranceSubcategory,
    addSavedTaxReturn,
    deleteSavedTaxReturn,
    updateEducationProgress,
    toggleTransactionInstanceExclusion,
    getExpandedTransactionsForYear,
    grantAchievement,
    addSavedInsight,
    deleteSavedInsight,
    toggleSimulatedLiquidation,
    addTaxSimulation,
    updateTaxSimulation,
    deleteTaxSimulation,
    updateTaxConfig,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
