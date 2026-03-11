import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { NAV_ITEMS, PROFILE_COLORS, IconBookOpen, IconUsers, IconPencil, IconTrash, IconChevronsLeft, IconDashboard, IconCredits, IconSettings, IconPlus, IconCamera, IconMenu, LogoIcon, IconMagicWand } from './constants.tsx';
import DashboardPage from './components/DashboardPage.tsx';
import AccountingPage from './components/AccountingPage.tsx';
import CreditsPage from './components/CreditsPage.tsx';
import InsurancePage from './components/InsurancePage.tsx';
import ReceiptsPage from './components/ReceiptsPage.tsx';
import GoalsPage from './components/GoalsPage.tsx';
import BudgetsPage from './components/BudgetsPage.tsx';
import SettingsPage from './components/SettingsPage.tsx';
import AlertsPage from './components/AlertsPage.tsx';
import AIInsightsPage from './components/AIInsightsPage.tsx';
import ReportsPage from './components/ReportsPage.tsx';
import TaxationPage from './components/TaxationPage.tsx';
import AIChatAssistant from './components/AIChatAssistant.tsx';
import Calculator from './components/Calculator.tsx';
import PropertyProfitabilityPage from './components/PropertyProfitabilityPage.tsx';
import EducationPage from './components/EducationPage.tsx';
import CategoriesPage from './components/CategoriesPage.tsx';
import FinancialFreedomPage from './components/FinancialFreedomPage.tsx';
import AchievementsPage from './components/AchievementsPage.tsx';
import WealthPage from './components/WealthPage.tsx';
import HaciendaPage from './components/HaciendaPage.tsx';
import { Modal, Input, Button } from './components/common/UIComponents.tsx';
import { Group, User, TransactionType } from './types.ts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getChatResponseWithTools } from './services/geminiService.ts';


const WELCOME_MODAL_CONTENT = `
### **MoneyGrowth: Tu Asesor Financiero Personal con Inteligencia Artificial**

Imagina tener el control total de tu dinero, tomar decisiones más inteligentes y alcanzar tus metas financieras sin esfuerzo. MoneyGrowth no es solo una app de finanzas; es tu copiloto financiero personal, diseñado para darte poder y claridad.

**¿Qué nos hace únicos?**

#### 1. **Ahorra Tiempo y Esfuerzo como Nunca Antes**

*   **Dile Adiós a la Entrada Manual:** ¿Una factura o un recibo en papel? **Sácale una foto y nuestra IA la registrará por ti**, rellenando automáticamente el importe, la fecha y la empresa. ¡Dedica tu tiempo a lo que de verdad importa!
*   **Todo en un Único Lugar:** Controla tus cuentas, tarjetas, préstamos, seguros y suscripciones desde un único panel intuitivo y moderno.

#### 2. **Toma Decisiones Financieras Más Inteligentes con IA**

*   **Analiza Préstamos Antes de Firmar:** Antes de comprometerte, nuestra IA analiza la "toxicidad" de cualquier crédito para decirte de forma clara y sencilla si es una buena opción para ti.
*   **Anticípate al Futuro:** Obtén una **previsión de tus finanzas** para los próximos meses. La IA analiza tus tendencias para que puedas planificar con total confianza.
*   **Descubre Dónde Ahorrar:** Recibe **recomendaciones de ahorro personalizadas** basadas en tus hábitos de gasto. La aplicación encuentra oportunidades que tú podrías haber pasado por alto.

#### 3. **Control Total y Visión Clara de Tu Dinero**

*   **Dashboard Interactivo y Visual:** De un solo vistazo, entiende tus ingresos, gastos y tendencias con gráficos dinámicos y un resumen inteligente en lenguaje natural.
*   **Alertas que te Cuidan:** Recibe **notificaciones push** antes de que un seguro se renueve o un recibo importante venza. ¡Nunca más pagarás de más por un despiste!
*   **Informes Profesionales a tu Alcance:** Exporta tus datos a **CSV** con un formato de tabla dinámica o genera informes financieros en **PDF** con un solo clic, perfectos para tu contabilidad o para presentar.

#### 4. **Una Experiencia Premium, Disponible para Ti**

*   **Funciona Donde y Cuando Quieras:** Instala la aplicación en tu móvil o escritorio (PWA) para un acceso instantáneo. Además, funciona **incluso sin conexión a internet**.
*   **Atajos Inteligentes en tu Móvil:** Accede a las funciones más importantes, como "Añadir Gasto" o "Escanear Recibo", directamente desde la pantalla de inicio de tu teléfono.
`;

const QuickAddModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { addTransaction, expenseCategories } = useApp();
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setAmount('');
            setDescription('');
        }
    }, [isOpen]);

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 1 && amount) {
            setStep(2);
        } else if (step === 2 && description) {
            setStep(3);
        }
    };

    const handleCategorySelect = (categoryName: string) => {
        addTransaction({
            type: TransactionType.EXPENSE,
            amount: parseFloat(amount),
            description,
            category: categoryName,
            date: new Date().toISOString().split('T')[0],
        });
        onClose();
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <form onSubmit={handleNextStep}>
                        <h3 className="text-xl font-bold text-center text-white mb-4">¿Cuánto gastaste?</h3>
                        <Input
                            label=""
                            id="quick-add-amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                            step="0.01"
                            className="text-center [&_input]:text-4xl [&_input]:h-20 [&_input]:text-center"
                        />
                        <Button type="submit" disabled={!amount || parseFloat(amount) <= 0} className="w-full mt-6">Siguiente</Button>
                    </form>
                );
            case 2:
                return (
                    <form onSubmit={handleNextStep}>
                        <h3 className="text-xl font-bold text-center text-white mb-4">¿En qué lo gastaste?</h3>
                        <Input
                            label=""
                            id="quick-add-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ej: Café con amigos"
                            autoFocus
                            className="text-center [&_input]:text-2xl [&_input]:h-16 [&_input]:text-center"
                        />
                        <Button type="submit" disabled={!description.trim()} className="w-full mt-6">Siguiente</Button>
                    </form>
                );
            case 3:
                return (
                    <div>
                        <h3 className="text-xl font-bold text-center text-white mb-4">Selecciona la categoría</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
                            {expenseCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategorySelect(cat.name)}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-700 rounded-lg hover:bg-primary hover:text-black transition-colors"
                                >
                                    <span className="text-3xl">{cat.icon}</span>
                                    <span className="text-sm font-semibold mt-2 text-center">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Asistente Rápido de Gastos">
            {renderStepContent()}
        </Modal>
    );
};


const AddActionModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenQuickAdd: () => void; }> = ({ isOpen, onClose, onOpenQuickAdd }) => {
    const navigate = useNavigate();
    const { addTransaction, incomeCategories, expenseCategories } = useApp();
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);
    const [speechError, setSpeechError] = useState('');

    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechError('Tu navegador no soporta el reconocimiento de voz.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "es-ES";
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onerror = (event: any) => {
            console.error("Error de reconocimiento de voz:", event.error, event.message);
            let errorMessage = `Error de voz: ${event.error}.`;
            if (event.error === 'network') {
                errorMessage = "Error de red. Por favor, comprueba tu conexión a internet e inténtalo de nuevo. El reconocimiento de voz necesita acceso a internet.";
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                errorMessage = "Permiso denegado. Por favor, asegúrate de haber dado permiso a la aplicación para usar el micrófono en los ajustes de tu navegador.";
            } else if (event.error === 'no-speech') {
                errorMessage = "No se ha detectado ninguna voz. Por favor, habla más claro o acércate al micrófono.";
            } else {
                errorMessage = `Hubo un problema con el reconocimiento de voz (${event.error}). Por favor, inténtalo de nuevo.`;
            }
            alert(errorMessage);
            setIsListening(false);
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            console.log("Texto dictado:", transcript);
            onClose(); 
            
            setTimeout(() => {
                handleVoiceCommand(transcript);
            }, 100);
        };

        recognitionRef.current = recognition;
    }, []);

    const handleVoiceCommand = async (command: string) => {
        alert(`Procesando: "${command}"...`);
        try {
            const response = await getChatResponseWithTools(command, [], { income: incomeCategories.map(c => c.name), expense: expenseCategories.map(c => c.name) });

            if (!response) {
                throw new Error("La API no devolvió una respuesta válida.");
            }

            // Fixed: Use simple functionCalls property from GenerateContentResponse
            const functionCalls = response.functionCalls;

            let transactionAdded = false;
            if (functionCalls && functionCalls.length > 0) {
                for (const call of functionCalls) {
                    if (call.name === 'addTransaction') {
                        const { type, amount, category, description } = call.args;
                        if (type && amount && category) {
                            addTransaction({
                                type: type as TransactionType,
                                amount: amount as number,
                                category: category as string,
                                description: (description as string) || command,
                                date: new Date().toISOString().split('T')[0],
                            });
                            transactionAdded = true;
                        }
                    }
                }
            }

            if(transactionAdded) {
                alert('¡Transacción añadida con éxito por voz!');
            } else {
                const modelResponseText = response.text;
                if (modelResponseText) {
                    alert(`Asistente: ${modelResponseText}`);
                } else {
                    alert('No he podido identificar una transacción en tu comando. Ejemplo: "Añade 25€ de gasolina".');
                }
            }
        } catch (error) {
            console.error("Error processing voice command:", error);
            alert("Hubo un problema al procesar tu comando. Por favor, inténtalo de nuevo.");
        }
    };

    const handleAction = (path: string) => {
        navigate(path);
        onClose();
    };

    const handleVoiceClick = () => {
        if (speechError) {
            alert(speechError);
            return;
        }
        if (recognitionRef.current && !isListening) {
            recognitionRef.current.start();
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-end" onClick={onClose}>
            <div className="bg-slate-800 rounded-t-lg w-full max-w-md p-4 space-y-3" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" className="w-full text-left !justify-start !p-4 !text-lg" onClick={() => handleAction('/accounting?add=true')}>
                    <IconPlus className="w-6 h-6 mr-3"/> Añadir Movimiento
                </Button>
                <Button variant="ghost" className="w-full text-left !justify-start !p-4 !text-lg" onClick={onOpenQuickAdd}>
                    <IconMagicWand className="w-6 h-6 mr-3"/> Asistente IA Rápido
                </Button>
                <Button variant="ghost" className="w-full text-left !justify-start !p-4 !text-lg" onClick={() => handleAction('/accounting?scan=true')}>
                    <IconCamera className="w-6 h-6 mr-3"/> Escanear Gasto
                </Button>
                <Button variant="ghost" className="w-full text-left !justify-start !p-4 !text-lg" onClick={() => handleAction('/receipts?scan=true')}>
                    <IconCamera className="w-6 h-6 mr-3"/> Escanear Factura
                </Button>
                <Button variant="ghost" className="w-full text-left !justify-start !p-4 !text-lg" onClick={handleVoiceClick} disabled={isListening}>
                    <span className="w-6 h-6 mr-3 text-2xl">{isListening ? '🎙️' : '🎤'}</span> {isListening ? 'Escuchando...' : 'Añadir por voz'}
                </Button>
            </div>
        </div>
    );
};

const BottomNavBar: React.FC<{ onOpenAddAction: () => void; }> = ({ onOpenAddAction }) => {
    const { bottomNavShortcuts } = useApp();
    
    const navItems = useMemo(() => 
        bottomNavShortcuts
            .map(href => NAV_ITEMS.find(item => item.href === href))
            .filter(Boolean),
        [bottomNavShortcuts]
    );

    const midPoint = Math.ceil(navItems.length / 2);
    const leftItems = navItems.slice(0, midPoint);
    const rightItems = navItems.slice(midPoint);

    const renderNavLink = (item: (typeof NAV_ITEMS)[0]) => (
        <NavLink 
            key={item.href} 
            to={item.href!}
            className={({ isActive }) => 
                `flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-primary'}`
            }
        >
            <item.icon className="w-6 h-6 mb-1"/>
            <span className="text-xs">{item.label}</span>
        </NavLink>
    );

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-between items-center h-16 z-40">
            <div className="flex justify-around items-center flex-1 h-full">
                {leftItems.map(renderNavLink)}
            </div>
            <div className="flex-shrink-0">
                <button onClick={onOpenAddAction} className="-mt-8 bg-primary text-black rounded-full w-16 h-16 flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-hover">
                    <IconPlus className="w-8 h-8"/>
                </button>
            </div>
            <div className="flex justify-around items-center flex-1 h-full">
                {rightItems.map(renderNavLink)}
            </div>
        </nav>
    );
};


const GroupEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    groupToEdit?: Group;
    users: User[];
    addGroup: (name: string, userIds: string[]) => void;
    updateGroup: (groupId: string, name: string, userIds: string[]) => void;
}> = ({ isOpen, onClose, groupToEdit, users, addGroup, updateGroup }) => {
    const [name, setName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (groupToEdit) {
            setName(groupToEdit.name);
            setSelectedUserIds(new Set(groupToEdit.userIds));
        } else {
            setName('');
            setSelectedUserIds(new Set());
        }
    }, [groupToEdit, isOpen]);

    const handleUserToggle = (userId: string) => {
        const newSelection = new Set(selectedUserIds);
        if (newSelection.has(userId)) {
            newSelection.delete(userId);
        } else {
            newSelection.add(userId);
        }
        setSelectedUserIds(newSelection);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (groupToEdit) {
            updateGroup(groupToEdit.id, name.trim(), Array.from(selectedUserIds));
        } else {
            addGroup(name.trim(), Array.from(selectedUserIds));
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={groupToEdit ? "Editar Grupo" : "Crear Nuevo Grupo"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Nombre del Grupo" value={name} onChange={e => setName(e.target.value)} required />
                <div>
                    <h3 className="block text-sm font-medium text-slate-300 mb-2">Miembros del Grupo</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-700 rounded-md">
                        {users.map(user => (
                            <label key={user.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-primary focus:ring-primary"
                                    checked={selectedUserIds.has(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                />
                                <span>{user.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <div className="flex justify-end pt-4">
                    <Button type="submit">{groupToEdit ? "Guardar Cambios" : "Crear Grupo"}</Button>
                </div>
            </form>
        </Modal>
    );
};

const UserEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    userToEdit: User | null;
}> = ({ isOpen, onClose, userToEdit }) => {
    const { updateUser } = useApp();
    const [name, setName] = useState('');
    const [color, setColor] = useState('');

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name);
            setColor(userToEdit.color || PROFILE_COLORS[0]);
        }
    }, [userToEdit, isOpen]);

    if (!userToEdit) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            updateUser(userToEdit.id, { name: name.trim(), color });
            onClose();
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil">
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input label="Nombre del Perfil" value={name} onChange={e => setName(e.target.value)} required />
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Color del Perfil</label>
                    <div className="flex flex-wrap gap-3">
                        {PROFILE_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 focus:outline-none ${color === c ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''}`}
                                style={{ backgroundColor: c }}
                                aria-label={`Seleccionar color ${c}`}
                            />
                        ))}
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-4">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit">Guardar Cambios</Button>
                </div>
            </form>
        </Modal>
    );
};


const Sidebar: React.FC<{ isSidebarCollapsed: boolean; onToggleCollapse: () => void; onOpenManageAccounts: () => void; onOpenAIChat: () => void; }> = ({ isSidebarCollapsed, onToggleCollapse, onOpenManageAccounts, onOpenAIChat }) => {
    const { activeView, activeViewTarget } = useApp();
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const location = useLocation();

    const displayName = activeViewTarget?.name || "Usuario";
    const avatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(displayName)}`;
    const displaySubtext = activeView.type === 'group' ? `${(activeViewTarget as Group)?.userIds?.length || 0} miembros` : "Premium";
    const userColor = activeView.type === 'user' ? (activeViewTarget as User)?.color : null;

    return (
        <>
            <div className={`bg-slate-800 h-full flex flex-col p-4 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                <div className={`flex items-center mb-4 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <button onClick={() => setIsWelcomeModalOpen(true)} className={`flex items-center gap-3 text-left rounded-lg hover:bg-slate-700/50 transition-colors p-2 -m-2`}>
                        <div className="flex-shrink-0">
                            <LogoIcon className="h-12 w-12"/>
                        </div>
                        {!isSidebarCollapsed && <h1 className="text-2xl font-bold text-white">MoneyGrowth</h1>}
                    </button>
                    {!isSidebarCollapsed && (
                        <button onClick={onOpenAIChat} className="p-2 text-slate-400 hover:text-primary rounded-full hover:bg-slate-700 transition-colors flex-shrink-0" aria-label="Abrir Asistente IA">
                            <IconMagicWand className="w-6 h-6" />
                        </button>
                    )}
                </div>

                <div className="px-2 mb-4">
                     <button onClick={onOpenManageAccounts} title={isSidebarCollapsed ? displayName : undefined} className={`w-full text-left p-2 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <IconUsers className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        {!isSidebarCollapsed && <span className="text-sm font-medium text-slate-300 truncate">{displayName}</span>}
                    </button>
                </div>

                <nav className="flex-grow overflow-y-auto overflow-x-hidden no-scrollbar">
                    <ul>
                        {NAV_ITEMS.map((item, index) => {
                            if (item.type === 'divider') {
                                return <div key={`divider-${index}`} className="my-2 border-t border-slate-700/50"></div>;
                            }
                            return (
                                <li key={item.href}>
                                    <NavLink 
                                        to={item.href} 
                                        title={isSidebarCollapsed ? item.label : undefined}
                                        className={({ isActive }) => 
                                        `flex items-center gap-3 px-3 py-2.5 my-1 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 ${location.pathname === item.href || (item.href === '/' && location.pathname ==='#') ? 'bg-primary text-black font-semibold' : ''} ${isSidebarCollapsed ? 'justify-center' : ''}`
                                    }>
                                        <item.icon className="w-6 h-6 flex-shrink-0"/>
                                        {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                                    </NavLink>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                <div className="flex-shrink-0 mt-2">
                     <button
                        onClick={onToggleCollapse}
                        className={`w-full flex items-center p-3 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white ${isSidebarCollapsed ? 'justify-center' : 'justify-center'}`}
                        title={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
                    >
                        <IconChevronsLeft className={`w-6 h-6 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                <div className="border-t border-slate-700 pt-4 flex-shrink-0">
                    <button onClick={onOpenManageAccounts} className={`flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-slate-700 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <img 
                          className="h-10 w-10 rounded-full bg-slate-600 flex-shrink-0 border-2" 
                          src={avatarUrl} 
                          alt="Avatar"
                          style={{ borderColor: userColor || 'transparent' }}
                        />
                        {!isSidebarCollapsed && (
                            <div className="overflow-hidden">
                                <p className="font-semibold text-white truncate">{displayName}</p>
                                <p className="text-sm text-slate-400 truncate">{displaySubtext}</p>
                            </div>
                        )}
                    </button>
                </div>
            </div>

            <Modal 
                isOpen={isWelcomeModalOpen} 
                onClose={() => setIsWelcomeModalOpen(false)} 
                title="Bienvenido a MoneyGrowth"
                size="lg"
            >
                <div className="prose prose-invert prose-slate max-w-none 
                    prose-headings:text-primary prose-a:text-primary 
                    prose-strong:text-slate-100 prose-ul:list-disc prose-ol:list-decimal">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{WELCOME_MODAL_CONTENT}</ReactMarkdown>
                </div>
            </Modal>
        </>
    );
}

const MainContent: React.FC<{ isSidebarCollapsed: boolean }> = ({ isSidebarCollapsed }) => {
    return (
        <main className={`flex-1 bg-slate-900 transition-all duration-300 pt-16 pb-24`}>
             <div className="p-4 md:p-8">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/accounting" element={<AccountingPage />} />
                    <Route path="/wealth" element={<WealthPage />} />
                    <Route path="/credits" element={<CreditsPage />} />
                    <Route path="/insurance" element={<InsurancePage />} />
                    <Route path="/receipts" element={<ReceiptsPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/budgets" element={<BudgetsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/ai-insights" element={<AIInsightsPage />} />
                    <Route path="/taxation" element={<TaxationPage />} />
                    <Route path="/hacienda" element={<HaciendaPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/calculator" element={<Calculator />} />
                    <Route path="/education" element={<EducationPage />} />
                    <Route path="/property-profitability" element={<PropertyProfitabilityPage />} />
                    <Route path="/financial-freedom" element={<FinancialFreedomPage />} />
                    <Route path="/achievements" element={<AchievementsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
             </div>
        </main>
    );
};

const MobileHeader: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const location = useLocation();
    const currentNavItem = NAV_ITEMS.find(item => item.href === location.pathname);
    const title = currentNavItem ? currentNavItem.label : 'MoneyGrowth';

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 flex items-center px-4 z-30">
            <button onClick={onMenuClick} className="p-2 text-slate-300 hover:text-white">
                <IconMenu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-white mx-auto">{title}</h1>
            <div className="w-8"></div> {/* Spacer to balance the title */}
        </header>
    );
};


const AppLayout: React.FC = () => {
    const { alerts, users, groups, switchView, addUser, deleteUser, deleteGroup, addGroup, updateGroup, updateUser } = useApp();
    const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(new Set());
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // State for managing accounts modal and its sub-modals
    const [isManageAccountsOpen, setIsManageAccountsOpen] = useState(false);
    const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<Group | undefined>(undefined);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [isUserEditorOpen, setIsUserEditorOpen] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    
    // State for action modals
    const [isAddActionModalOpen, setIsAddActionModalOpen] = useState(false);
    const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);


    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUserName.trim()) {
            addUser(newUserName.trim());
            setNewUserName('');
        }
    };

    const openGroupEditorForNew = () => {
        setGroupToEdit(undefined);
        setIsGroupEditorOpen(true);
    };

    const openGroupEditorForEdit = (group: Group) => {
        setGroupToEdit(group);
        setIsGroupEditorOpen(true);
    };

    const openUserEditor = (user: User) => {
        setUserToEdit(user);
        setIsUserEditorOpen(true);
    };


    useEffect(() => {
        if (!("Notification" in window) || alerts.length === 0) {
            return;
        }

        const unshownAlerts = alerts.filter(alert => !shownNotificationIds.has(alert.id));

        if (unshownAlerts.length > 0) {
            if (Notification.permission === "granted") {
                const newShownIds = new Set(shownNotificationIds);
                unshownAlerts.forEach(alert => {
                    new Notification(`Alerta de MoneyGrowth: ${alert.title}`, {
                        body: alert.message,
                        icon: '/icons/icon-192x192.png', // PWA icon
                        tag: alert.id, // Tag to prevent duplicate notifications
                    });
                    newShownIds.add(alert.id);
                });
                setShownNotificationIds(newShownIds);
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        // Call self to show notifications now that we have permission
                        // This might be better handled by re-triggering the effect
                    }
                });
            }
        }
    }, [alerts, shownNotificationIds]);


    return (
        <div className="flex min-h-screen">
            {/* Mobile Sidebar Overlay */}
             {isMobileSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}
            {/* Sidebar for Mobile and Desktop */}
            <div className={`fixed inset-y-0 left-0 z-50 h-screen transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                 <Sidebar 
                    isSidebarCollapsed={isSidebarCollapsed} 
                    onToggleCollapse={() => setIsSidebarCollapsed(v => !v)}
                    onOpenManageAccounts={() => setIsManageAccountsOpen(true)}
                    onOpenAIChat={() => setIsAIChatOpen(true)}
                 />
            </div>

            <div className="flex flex-col flex-1 w-full">
                <MobileHeader onMenuClick={() => setIsMobileSidebarOpen(true)} />
                <MainContent isSidebarCollapsed={isSidebarCollapsed} />
            </div>
            
            <AIChatAssistant isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
            
            <BottomNavBar onOpenAddAction={() => setIsAddActionModalOpen(true)} />

            <AddActionModal 
                isOpen={isAddActionModalOpen} 
                onClose={() => setIsAddActionModalOpen(false)}
                onOpenQuickAdd={() => {
                    setIsAddActionModalOpen(false);
                    setTimeout(() => setIsQuickAddModalOpen(true), 150);
                }}
            />
            
            <QuickAddModal 
                isOpen={isQuickAddModalOpen} 
                onClose={() => setIsQuickAddModalOpen(false)}
            />

            <Modal isOpen={isManageAccountsOpen} onClose={() => setIsManageAccountsOpen(false)} title="Gestionar Cuentas" size="xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Column 1: Profiles */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-slate-200 border-b border-slate-700 pb-2">Perfiles Individuales</h3>
                        <ul className="space-y-3 max-h-[60vh] md:max-h-96 overflow-y-auto pr-2">
                           {users.map(user => (
                                <li key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                                    <button onClick={() => { switchView({ type: 'user', id: user.id }); setIsManageAccountsOpen(false); }} className="flex items-center gap-4 flex-grow text-left">
                                        <img
                                            className="h-10 w-10 rounded-full bg-slate-600 border-2"
                                            src={`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                                            alt="Avatar"
                                            style={{ borderColor: user.color || 'transparent' }}
                                        />
                                        <span className="font-medium text-white text-lg">{user.name}</span>
                                    </button>
                                    <div className="flex items-center">
                                        <button onClick={() => openUserEditor(user)} className="p-2 text-slate-400 hover:text-white flex-shrink-0"><IconPencil className="w-5 h-5"/></button>
                                        {users.length > 1 && (
                                            <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-400 hover:text-danger flex-shrink-0"><IconTrash className="w-5 h-5"/></button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <form onSubmit={handleAddUser} className="flex gap-2 pt-4 border-t border-slate-700">
                            <Input label="" id="new-user" placeholder="Nombre del nuevo perfil..." value={newUserName} onChange={e => setNewUserName(e.target.value)} className="flex-grow !mb-0"/>
                            <Button type="submit">Añadir Perfil</Button>
                        </form>
                    </div>

                    {/* Column 2: Groups */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-slate-200 border-b border-slate-700 pb-2">Grupos</h3>
                         <ul className="space-y-3 max-h-[60vh] md:max-h-96 overflow-y-auto pr-2">
                             {groups.map(group => (
                                <li key={group.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                                    <button onClick={() => { switchView({ type: 'group', id: group.id }); setIsManageAccountsOpen(false); }} className="flex items-center gap-4 flex-grow text-left">
                                        <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                                            <IconUsers className="w-6 h-6 text-slate-300"/>
                                        </div>
                                        <div>
                                            <p className="font-medium text-white text-lg">{group.name}</p>
                                            <p className="text-sm text-slate-400">{group.userIds.length} miembros</p>
                                        </div>
                                    </button>
                                    <div className="flex items-center">
                                        <button onClick={() => openGroupEditorForEdit(group)} className="p-2 text-slate-400 hover:text-white"><IconPencil className="w-5 h-5"/></button>
                                        <button onClick={() => deleteGroup(group.id)} className="p-2 text-slate-400 hover:text-danger"><IconTrash className="w-5 h-5"/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                         <div className="pt-4 border-t border-slate-700">
                            <Button onClick={openGroupEditorForNew} variant="secondary" className="w-full">Crear Nuevo Grupo</Button>
                        </div>
                    </div>
                </div>
            </Modal>
            
            <GroupEditorModal 
                isOpen={isGroupEditorOpen} 
                onClose={() => setIsGroupEditorOpen(false)} 
                groupToEdit={groupToEdit}
                users={users}
                addGroup={addGroup}
                updateGroup={updateGroup}
            />

            <UserEditorModal
                isOpen={isUserEditorOpen}
                onClose={() => setIsUserEditorOpen(false)}
                userToEdit={userToEdit}
            />
        </div>
    );
};


const App: React.FC = () => {
  return (
    <AppProvider>
        <HashRouter>
            <AppLayout />
        </HashRouter>
  </AppProvider>
  );
};

export default App;