
export interface User {
    id: string;
    name: string;
    color?: string;
}

export interface Group {
    id: string;
    name: string;
    userIds: string[];
}

export type ActiveView = { type: 'user'; id: string } | { type: 'group'; id: string };

export enum TransactionType {
    INCOME = 'income',
    EXPENSE = 'expense',
    SAVING = 'saving'
}

export type ReceiptFrequency = 'monthly' | 'quarterly' | 'semiannually' | 'annually' | 'one-time';

export interface Transaction {
    id: string;
    type: TransactionType;
    amount: number;
    date: string;
    category: string;
    subcategory?: string;
    description?: string;
    notes?: string;
    frequency?: ReceiptFrequency;
    creditId?: string;
    insuranceId?: string;
    goalId?: string;
    goalContributionId?: string;
    budgetId?: string;
    budgetContributionId?: string;
    isExcluded?: boolean;
    ownerId?: string;
    instanceId?: string; // For expanded occurrences
    prorateOverMonths?: number;
}

export type CreditSubcategory = 'Financiación' | 'Tarjeta' | 'Hipoteca' | 'Préstamo';

export interface ToxicityReport {
    score: number;
    explanation: string;
}

export interface Credit {
    id: string;
    name: string;
    subcategory: CreditSubcategory;
    totalAmount: number;
    monthlyPayment: number;
    tin: number;
    tae: number;
    startDate: string;
    endDate: string;
    notes?: string;
    ownerId?: string;
    toxicityReport?: ToxicityReport;
}

export enum ReceiptType {
    RECEIPT = 'receipt',
    INVOICE = 'invoice'
}

export interface Receipt {
    id: string;
    type: ReceiptType;
    title: string;
    amount: number;
    description?: string;
    date: string;
    notes?: string;
    frequency?: ReceiptFrequency;
    autoRenews?: boolean;
    prorateOverMonths?: number;
    cancellationReminder?: boolean;
    cancellationNoticeMonths?: number;
    invoiceCategory?: string;
    isTaxDeductible?: boolean;
    contractFile?: string;
    contractFileId?: string;
    ownerId?: string;
}

export interface ScannedReceiptData {
    amount?: number;
    date?: string;
    description?: string;
    category?: string;
    fileName?: string;
    fileData?: string;
}

export type InsurancePolicyType = 'Coche' | 'Hogar' | 'Vida' | 'Salud' | 'Otros';

export interface InsurancePolicy {
    id: string;
    name: string;
    policyType: InsurancePolicyType;
    subcategory?: string;
    premium: number;
    paymentFrequency: ReceiptFrequency;
    renewalDate: string;
    cancellationReminder?: boolean;
    cancellationNoticeMonths?: number;
    notes?: string;
    contractFile?: string;
    contractFileId?: string;
    prorateOverMonths?: number;
    ownerId?: string;
}

export interface GoalContribution {
    id: string;
    date: string;
    amount: number;
    description?: string;
    isExcluded?: boolean;
}

export interface Goal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    startDate: string;
    deadline: string;
    notes?: string;
    createTransactions?: boolean;
    contributionHistory?: GoalContribution[];
    ownerId?: string;
}

export interface BudgetContribution {
    id: string;
    date: string;
    amount: number;
    description?: string;
    isExcluded?: boolean;
}

export interface Budget {
    id: string;
    name: string;
    category?: string;
    targetAmount: number;
    currentAmount: number;
    type: 'spending-limit' | 'saving-fund';
    priority: 'essential' | 'secondary';
    deadline?: string;
    notes?: string;
    createTransactions?: boolean;
    contributionHistory?: BudgetContribution[];
    ownerId?: string;
}

export enum WidgetType {
    FINANCIAL_SUMMARY = 'FINANCIAL_SUMMARY',
    EXPENSE_DISTRIBUTION = 'EXPENSE_DISTRIBUTION',
    AI_SUMMARY = 'AI_SUMMARY',
    ALERTS = 'ALERTS',
    MONTHLY_SUMMARY = 'MONTHLY_SUMMARY',
    ANNUAL_PAYMENTS = 'ANNUAL_PAYMENTS',
    GOALS = 'GOALS',
    SAVINGS_SUMMARY = 'SAVINGS_SUMMARY',
    FIRE_TRACKER = 'FIRE_TRACKER',
    ACHIEVEMENTS = 'ACHIEVEMENTS',
    HACIENDA_SUMMARY = 'HACIENDA_SUMMARY'
}

export interface Alert {
    id: string;
    type: string;
    message: string;
    date: string;
    sourceId: string;
    title: string;
}

export interface Category {
    id: string;
    name: string;
    icon: string;
}

export interface TaxDeduction {
    description: string;
    amount: number;
    impactOnResult: number;
}

export interface TaxCalculationResult {
    draftResult: number;
    adjustedResult: number;
    advice: string;
    deductions: TaxDeduction[];
}

export interface SavedTaxReturn {
    id: string;
    year: number;
    dateSaved: string;
    fileName: string;
    pdfData: string;
    calculationResult: TaxCalculationResult;
    ownerId?: string;
}

export interface TaxDraftData {
    grossIncome: number;
    withholdings: number;
    socialSecurity: number;
    draftResult: number;
}

export interface TaxQuestionnaire {
    personal_civilStatus: string;
    personal_autonomousCommunity: string;
    personal_hasChildren: boolean;
    personal_childrenCount: number;
    personal_childrenDisability: boolean;
    personal_childrenDisabilityGrade: number;
    personal_isLargeFamily: 'none' | 'general' | 'special';
    personal_hasAscendants: boolean;
    personal_ascendantsDisability: boolean;
    personal_ascendantsDisabilityGrade: number;
    housing_isOwner: boolean;
    housing_isRenter: boolean;
    housing_mortgage_boughtBefore2013: boolean;
    housing_mortgage_paidAmount: number;
    housing_rent_contractDate: string;
    housing_rent_paidAmount: number;
    housing_efficiencyImprovements: boolean;
    housing_efficiencyAmount: number;
    rented_properties: any[];
    care_daycareExpenses: number;
    care_educationExpenses: number;
    work_isAutonomous: boolean;
    work_autonomousIncome: number;
    work_autonomousExpenses: number;
    work_pensionPlanContributions: number;
    work_investmentGainsLosses: number;
    donations_ngo: number;
    donations_unionDues: number;
    donations_privateHealthInsurance: number;
    regional_gymFee: number;
    regional_birthAdoption: number;
    regional_publicTransport: number;
}

export interface EducationMilestone {
    id: string;
    text: string;
    date: string;
}

export interface EducationProgress {
    completedLevel: number;
    checklistStates: Record<number, boolean[]>;
    milestones: EducationMilestone[];
}

export interface PropertyInvestment {
    id: string;
    name: string;
    purchasePrice: number;
    community: string;
    notaryFees: number;
    registryFees: number;
    reforms: number;
    agencyCommission: number;
    managementFees: number;
    appraisalFees: number;
    financingPercentage: number;
    interestRate: number;
    loanTermYears: number;
    monthlyRent: number;
    communityExpenses: number;
    maintenance: number;
    homeInsurance: number;
    mortgageLifeInsurance: number;
    nonPaymentInsurance: number;
    ibi: number;
    vacancyMonths: number;
    annualGrossSalary: number;
    aiVerdict?: string;
    ownerId?: string;
}

export interface ManualAsset {
    id: string;
    name: string;
    value: number;
    category: 'Real Estate' | 'Vehicle' | 'Valuables' | 'Cash' | 'Investment' | 'Other';
    notes?: string;
    ownerId?: string;
}

export interface FinancialSimulation {
    id: string;
    name: string;
    monthlyIncome: number;
    inflationRate: number;
    projectionYears: number;
    currentAmount: number;
    ownerId?: string;
}

export type InvestmentType = 'Stock' | 'ETF' | 'Crypto' | 'Fund' | 'RealEstate' | 'Other';

export interface InvestmentTransaction {
    id: string;
    type: InvestmentType;
    name: string;
    purchaseDate: string;
    purchaseAmount: number;
    isSold: boolean;
    saleDate?: string;
    saleAmount?: number;
    expenses?: number;
    ownerId?: string;
}

export interface Achievement {
    id: string;
    unlockedDate: string;
}

export interface SavedInsight {
    id: string;
    type: 'question' | 'forecast' | 'savings';
    content: string;
    date: string;
    ownerId?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    isLoading?: boolean;
}

export type TaxActivityType = 
    | 'Trading' | 'AlquilerTuristico' | 'AlquilerHabitaciones' | 'AlquilerTradicional' 
    | 'AutonomoServicios' | 'AutonomoComercio' | 'IngresosOnline' | 'Dividendos' 
    | 'Intereses' | 'Criptomonedas' | 'VentaActivos' | 'Trabajo' | 'Otros';

export interface TaxExpenseItem {
    id: string;
    name: string;
    amount: number;
    date: string;
    isValid?: boolean;
    verificationResult?: string;
}

export interface TaxActivity {
    id: string;
    type: TaxActivityType;
    name: string;
    grossIncome: number;
    deductibleExpenses: number;
    retentionsApplied: number;
    isIGICApplicable: boolean;
    expenseItems?: TaxExpenseItem[];
}

export interface TaxDeductionItem {
    id: string;
    name: string;
    amount: number;
    description?: string;
}

export interface TaxBracketDetail {
    label: string;
    rate: number;
    baseInBracket: number;
    taxAmount: number;
    isMarginal: boolean;
}

export interface TaxPaymentContribution {
    id: string;
    date: string;
    amount: number;
    note?: string;
}

export interface TaxSimulationResult {
    baseGeneral: number;
    baseSavings: number;
    breakdownGeneral: TaxBracketDetail[];
    breakdownSavings: TaxBracketDetail[];
    marginalRateGeneral: number;
    effectiveRateGeneral: number;
    quotaIntegra: number;
    quotaLiquida: number;
    totalRetentions: number;
    finalResultIRPF: number;
    baseIGIC: number;
    quotaIGIC: number;
    totalIGIC: number;
    igicWarning: string;
    totalToPay: number;
    monthlySavingRecommendation: number;
}

export interface TaxSimulation {
    id: string;
    name: string;
    year: number;
    region: string;
    dateCreated: string;
    activities: TaxActivity[];
    deductions: TaxDeductionItem[];
    paymentsOnAccount: number;
    paymentHistory: TaxPaymentContribution[];
    result: TaxSimulationResult;
    ownerId?: string;
}

export interface TaxConfig {
    irpfScalesGeneral: { limit: number; rate: number }[];
    irpfScalesSavings: { limit: number; rate: number }[];
    igicRate: number;
    igicThreshold: number;
    region: string;
}

export interface UserData {
    transactions: Transaction[];
    credits: Credit[];
    receipts: Receipt[];
    insurancePolicies: InsurancePolicy[];
    goals: Goal[];
    budgets: Budget[];
    dashboardShortcuts: string[];
    dashboardWidgets: WidgetType[];
    bottomNavShortcuts: string[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    hiddenDefaultIncomeCategories: string[];
    hiddenDefaultExpenseCategories: string[];
    expenseSubcategories: Record<string, string[]>;
    invoiceCategories: string[];
    insuranceSubcategories: Record<string, string[]>;
    savedTaxReturns: SavedTaxReturn[];
    educationProgress: EducationProgress;
    excludedInstances: Record<string, boolean>;
    propertyInvestments: PropertyInvestment[];
    manualAssets: ManualAsset[];
    financialSimulations: FinancialSimulation[];
    investmentTransactions: InvestmentTransaction[];
    achievements: Achievement[];
    savedInsights: SavedInsight[];
    taxSimulations: TaxSimulation[];
    taxConfig: TaxConfig;
}

export interface AppState {
    users: User[];
    groups: Group[];
    activeView: ActiveView;
    userData: Record<string, UserData>;
}

export interface AppContextType {
    users: User[];
    groups: Group[];
    activeView: ActiveView;
    activeViewTarget: User | Group | null;
    groupMembers: User[];
    
    transactions: Transaction[];
    credits: Credit[];
    receipts: Receipt[];
    insurancePolicies: InsurancePolicy[];
    goals: Goal[];
    budgets: Budget[];
    dashboardShortcuts: string[];
    dashboardWidgets: WidgetType[];
    bottomNavShortcuts: string[];
    alerts: Alert[];
    incomeCategories: Category[];
    expenseCategories: Category[];
    expenseSubcategories: Record<string, string[]>;
    invoiceCategories: string[];
    insuranceSubcategories: Record<string, string[]>;
    savedTaxReturns: SavedTaxReturn[];
    educationProgress: EducationProgress;
    excludedInstances: Record<string, boolean>;
    propertyInvestments: PropertyInvestment[];
    manualAssets: ManualAsset[];
    financialSimulations: FinancialSimulation[];
    investmentTransactions: InvestmentTransaction[];
    achievements: Achievement[];
    savedInsights: SavedInsight[];
    simulatedLiquidationIds: Set<string>;
    taxSimulations: TaxSimulation[];
    taxConfig: TaxConfig;

    addTransaction: (transaction: Omit<Transaction, 'id'>, ownerId?: string) => void;
    updateTransaction: (transaction: Transaction) => void;
    deleteTransaction: (transactionId: string) => void;
    
    addCredit: (credit: Omit<Credit, 'id'>, ownerId?: string) => void;
    updateCredit: (credit: Credit) => void;
    deleteCredit: (creditId: string) => void;
    
    addReceipt: (receipt: Omit<Receipt, 'id'> & { contractFileData?: string }, ownerId?: string) => void;
    updateReceipt: (receipt: Receipt, newContractFileData?: string) => void;
    deleteReceipt: (receiptId: string) => void;
    
    addInsurancePolicy: (policy: Omit<InsurancePolicy, 'id'> & { contractFileData?: string }, ownerId?: string) => void;
    updateInsurancePolicy: (policy: InsurancePolicy, newContractFileData?: string) => void;
    deleteInsurancePolicy: (policyId: string) => void;
    
    addGoal: (goal: Omit<Goal, 'id' | 'contributionHistory'>, ownerId?: string) => void;
    updateGoal: (goal: Goal) => void;
    deleteGoal: (goalId: string) => void;
    addFundsToGoal: (goalId: string, amount: number, description?: string) => void;
    updateGoalContribution: (goalId: string, contribution: GoalContribution) => void;
    deleteGoalContribution: (goalId: string, contributionId: string) => void;
    
    addBudget: (budget: Omit<Budget, 'id' | 'contributionHistory'>, ownerId?: string) => void;
    updateBudget: (budget: Budget) => void;
    deleteBudget: (budgetId: string) => void;
    addFundsToBudget: (budgetId: string, amount: number, description?: string) => void;
    updateBudgetContribution: (budgetId: string, contribution: BudgetContribution) => void;
    deleteBudgetContribution: (budgetId: string, contributionId: string) => void;
    
    addPropertyInvestment: (investment: Omit<PropertyInvestment, 'id'>, ownerId?: string) => void;
    updatePropertyInvestment: (investment: PropertyInvestment) => void;
    deletePropertyInvestment: (investmentId: string) => void;
    
    addManualAsset: (asset: Omit<ManualAsset, 'id'>, ownerId?: string) => void;
    updateManualAsset: (asset: ManualAsset) => void;
    deleteManualAsset: (assetId: string) => void;
    
    addFinancialSimulation: (simulation: Omit<FinancialSimulation, 'id'>, ownerId?: string) => void;
    updateFinancialSimulation: (simulation: FinancialSimulation) => void;
    deleteFinancialSimulation: (simulationId: string) => void;
    
    addInvestmentTransaction: (investment: Omit<InvestmentTransaction, 'id'>, ownerId?: string) => void;
    updateInvestmentTransaction: (investment: InvestmentTransaction) => void;
    deleteInvestmentTransaction: (investmentId: string) => void;
    
    updateDashboardShortcuts: (shortcuts: string[]) => void;
    updateDashboardWidgets: (widgets: WidgetType[]) => void;
    updateBottomNavShortcuts: (shortcuts: string[]) => void;
    
    updateCreditToxicity: (creditId: string, report: ToxicityReport) => void;
    deleteCreditToxicity: (creditId: string) => void;
    
    addUser: (name: string) => void;
    updateUser: (userId: string, updates: Partial<Omit<User, 'id'>>) => void;
    deleteUser: (userId: string) => void;
    switchView: (view: ActiveView) => void;
    addGroup: (name: string, userIds: string[]) => void;
    updateGroup: (groupId: string, name: string, userIds: string[]) => void;
    deleteGroup: (groupId: string) => void;
    
    addIncomeCategory: (category: Omit<Category, 'id'>) => void;
    updateIncomeCategory: (categoryId: string, updates: Partial<Omit<Category, 'id'>>) => void;
    deleteIncomeCategory: (categoryId: string) => void;
    
    addExpenseCategory: (category: Omit<Category, 'id'>) => void;
    updateExpenseCategory: (categoryId: string, updates: Partial<Omit<Category, 'id'>>) => void;
    deleteExpenseCategory: (categoryId: string) => void;
    
    addExpenseSubcategory: (category: string, subcategory: string) => void;
    updateExpenseSubcategory: (category: string, oldName: string, newName: string) => void;
    deleteExpenseSubcategory: (category: string, subcategory: string) => void;
    
    addInvoiceCategory: (category: string, ownerId: string) => void;
    addInsuranceSubcategory: (policyType: InsurancePolicyType, subcategory: string) => void;
    updateInsuranceSubcategory: (policyType: InsurancePolicyType, oldName: string, newName: string) => void;
    deleteInsuranceSubcategory: (policyType: InsurancePolicyType, subcategory: string) => void;
    
    addSavedTaxReturn: (returnData: Omit<SavedTaxReturn, 'id' | 'dateSaved'>) => void;
    deleteSavedTaxReturn: (returnId: string) => void;
    
    updateEducationProgress: (progress: Partial<EducationProgress>) => void;
    
    toggleTransactionInstanceExclusion: (instanceId: string) => void;
    getExpandedTransactionsForYear: (targetYear: number) => (Transaction & { instanceId: string, isExcluded?: boolean })[];
    
    grantAchievement: (achievementId: string) => void;
    
    addSavedInsight: (insight: Omit<SavedInsight, 'id'>) => void;
    deleteSavedInsight: (insightId: string) => void;
    
    toggleSimulatedLiquidation: (creditId: string) => void;
    
    addTaxSimulation: (simulation: Omit<TaxSimulation, 'id'>, ownerId?: string) => void;
    updateTaxSimulation: (simulation: TaxSimulation) => void;
    deleteTaxSimulation: (simulationId: string) => void;
    updateTaxConfig: (config: TaxConfig, ownerId?: string) => void;
}
