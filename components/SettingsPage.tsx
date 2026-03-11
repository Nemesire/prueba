import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card, Button, Input, ConfirmationModal, Modal } from './common/UIComponents.tsx';
import { User } from '../types.ts';
import { IconClipboard, NAV_ITEMS, IconPlus, IconArrowUp, IconArrowDown, IconTrash, IconEye, IconEyeSlash, IconSparkles, IconCamera, IconMicrophone, IconBell } from '../constants.tsx';

declare global {
    interface Window {
        Android?: {
            requestCameraPermission: () => void;
            requestMicrophonePermission: () => void;
            requestNotificationPermission: () => void;
            openAppSettings: () => void;
        }
    }
}

const PermissionsManager: React.FC = () => {
    const [cameraStatus, setCameraStatus] = useState<PermissionState | 'unsupported'>('prompt');
    const [microphoneStatus, setMicrophoneStatus] = useState<PermissionState | 'unsupported'>('prompt');
    const [notificationStatus, setNotificationStatus] = useState<PermissionState | 'unsupported'>('prompt');
    const isAndroid = typeof window.Android !== 'undefined';

    const checkPermissions = async () => {
        try {
            if (navigator.permissions) {
                const cameraPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
                setCameraStatus(cameraPerm.state);
                cameraPerm.onchange = () => setCameraStatus(cameraPerm.state);

                const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                setMicrophoneStatus(micPerm.state);
                micPerm.onchange = () => setMicrophoneStatus(micPerm.state);

                const notifPerm = await navigator.permissions.query({ name: 'notifications' as PermissionName });
                setNotificationStatus(notifPerm.state);
                notifPerm.onchange = () => setNotificationStatus(notifPerm.state);
            } else {
                 if ('Notification' in window) {
                    setNotificationStatus(Notification.permission as PermissionState);
                } else {
                    setNotificationStatus('unsupported');
                }
                setCameraStatus('unsupported');
                setMicrophoneStatus('unsupported');
            }
        } catch (error) {
            console.error("Error checking permissions:", error);
            setCameraStatus('unsupported');
            setMicrophoneStatus('unsupported');
            setNotificationStatus('unsupported');
        }
    };

    useEffect(() => {
        checkPermissions();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkPermissions();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const requestPermission = async (type: 'camera' | 'microphone' | 'notifications') => {
        try {
            if (isAndroid) {
                if (type === 'camera' && window.Android?.requestCameraPermission) window.Android.requestCameraPermission();
                else if (type === 'microphone' && window.Android?.requestMicrophonePermission) window.Android.requestMicrophonePermission();
                else if (type === 'notifications' && window.Android?.requestNotificationPermission) window.Android.requestNotificationPermission();
            } else {
                if ((type === 'camera' || type === 'microphone') && navigator.mediaDevices?.enumerateDevices) {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const hasDevice = devices.some(device => device.kind === (type === 'camera' ? 'videoinput' : 'audioinput'));
                    if (!hasDevice) {
                        alert(`No se ha encontrado ningún dispositivo de tipo '${type}' en este equipo.`);
                        checkPermissions();
                        return;
                    }
                }
                
                if (type === 'camera') {
                    await navigator.mediaDevices.getUserMedia({ video: true });
                } else if (type === 'microphone') {
                    await navigator.mediaDevices.getUserMedia({ audio: true });
                } else if (type === 'notifications') {
                    await Notification.requestPermission();
                }
            }
        } catch (error) {
            console.error(`Error requesting ${type} permission:`, error);
            if (error instanceof DOMException) {
                if (error.name === 'NotFoundError') {
                    alert(`No se encontró ningún dispositivo de tipo '${type}'. Asegúrate de que esté conectado y habilitado.`);
                } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    alert(`Permiso para '${type}' denegado. Debes cambiarlo en los ajustes de tu navegador o sistema operativo.`);
                } else if (error.name === 'NotReadableError') {
                    alert(`No se puede acceder al dispositivo '${type}'. Puede que esté siendo utilizado por otra aplicación o que haya un problema con el hardware.`);
                } else {
                    alert(`Ocurrió un error al solicitar permiso para '${type}': ${error.message}`);
                }
            } else if (error instanceof Error) {
                alert(`Ocurrió un error inesperado al solicitar permiso para '${type}': ${error.message}`);
            } else {
                alert(`Ocurrió un error inesperado al solicitar permiso para '${type}'.`);
            }
        } finally {
            setTimeout(checkPermissions, 1000);
        }
    };
    
    const openAppSettings = () => {
        if(isAndroid && window.Android?.openAppSettings) {
            window.Android.openAppSettings();
        } else {
            alert('Por favor, ve a los ajustes de tu dispositivo, busca la aplicación y activa los permisos manualmente.');
        }
    };
    
    const handleOpenSettings = (type: 'camera' | 'microphone' | 'notifications') => {
        if (isAndroid && type === 'notifications' && window.Android?.requestNotificationPermission) {
            window.Android.requestNotificationPermission();
            setTimeout(checkPermissions, 1500);
        } else {
            openAppSettings();
        }
    };

    const StatusBadge: React.FC<{ status: PermissionState | 'unsupported' }> = ({ status }) => {
        const styles = {
            granted: { text: 'Activado', color: 'bg-secondary/20 text-secondary' },
            prompt: { text: 'Preguntar', color: 'bg-accent/20 text-accent' },
            denied: { text: 'Denegado', color: 'bg-danger/20 text-danger' },
            unsupported: { text: 'No Soportado', color: 'bg-slate-600/20 text-slate-400' }
        };
        const currentStyle = styles[status];
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${currentStyle.color}`}>{currentStyle.text}</span>;
    };
    
    const PermissionRow: React.FC<{
        icon: React.FC<React.SVGProps<SVGSVGElement>>;
        name: string;
        status: PermissionState | 'unsupported';
        onRequest: () => void;
        onOpenSettings: () => void;
    }> = ({ icon: Icon, name, status, onRequest, onOpenSettings }) => (
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Icon className="w-6 h-6 text-slate-300" />
                <span className="font-semibold text-slate-200">{name}</span>
            </div>
            <div className="flex items-center gap-4">
                <StatusBadge status={status} />
                {status === 'prompt' && <Button size="sm" onClick={onRequest}>Activar</Button>}
                {status === 'denied' && <Button size="sm" variant="ghost" onClick={onOpenSettings}>Ajustes</Button>}
            </div>
        </div>
    );

    return (
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Permisos de la Aplicación</h2>
            <p className="text-slate-400 mb-4 text-sm">
                Gestiona los permisos que la aplicación necesita para ofrecerte todas sus funcionalidades, como escanear recibos con la cámara o enviar notificaciones.
            </p>
            <div className="space-y-3">
                <PermissionRow icon={IconCamera} name="Cámara" status={cameraStatus} onRequest={() => requestPermission('camera')} onOpenSettings={() => handleOpenSettings('camera')} />
                <PermissionRow icon={IconMicrophone} name="Micrófono" status={microphoneStatus} onRequest={() => requestPermission('microphone')} onOpenSettings={() => handleOpenSettings('microphone')} />
                <PermissionRow icon={IconBell} name="Notificaciones" status={notificationStatus} onRequest={() => requestPermission('notifications')} onOpenSettings={() => handleOpenSettings('notifications')} />
            </div>
            {isAndroid && (
                <p className="text-xs text-slate-500 mt-4">
                    Estás usando la app nativa. Los permisos se solicitarán a través del sistema operativo de tu dispositivo.
                </p>
            )}
        </Card>
    );
};


const BottomNavConfigModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { bottomNavShortcuts, updateBottomNavShortcuts } = useApp();
    const [selectedHrefs, setSelectedHrefs] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedHrefs(bottomNavShortcuts || []);
        }
    }, [isOpen, bottomNavShortcuts]);

    const availableShortcuts = useMemo(() =>
        NAV_ITEMS.filter(item => item.href && !item.type && !selectedHrefs.includes(item.href)),
        [selectedHrefs]
    );

    const selectedShortcuts = useMemo(() =>
        selectedHrefs.map(href => NAV_ITEMS.find(item => item.href === href)).filter(Boolean),
        [selectedHrefs]
    );

    const handleAdd = (href: string) => {
        if (selectedHrefs.length < 6) {
            setSelectedHrefs(prev => [...prev, href]);
        }
    };

    const handleRemove = (href: string) => {
        setSelectedHrefs(prev => prev.filter(h => h !== href));
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newHrefs = [...selectedHrefs];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newHrefs.length) {
            [newHrefs[index], newHrefs[targetIndex]] = [newHrefs[targetIndex], newHrefs[index]];
            setSelectedHrefs(newHrefs);
        }
    };

    const handleSave = () => {
        updateBottomNavShortcuts(selectedHrefs);
        onClose();
    };

    // Symmetrical distribution for preview
    const midPoint = Math.ceil(selectedShortcuts.length / 2);
    const leftItems = selectedShortcuts.slice(0, midPoint);
    const rightItems = selectedShortcuts.slice(midPoint);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar Navegación Inferior" size="lg">
            <h3 className="text-lg font-semibold text-white mb-2">Vista Previa</h3>
            <div className="bg-slate-900 rounded-lg p-2 flex items-center justify-between mb-6">
                <div className="flex justify-around items-center flex-1 min-h-[70px]">
                    {leftItems.map(item => (
                        <div key={item.href} className="flex flex-col items-center text-primary p-1 text-center w-20">
                            <item.icon className="w-6 h-6" />
                            <span className="text-xs mt-1 truncate max-w-full">{item.label}</span>
                        </div>
                    ))}
                </div>
                <div className="p-2 flex-shrink-0">
                    <div className="bg-primary text-black rounded-full w-12 h-12 flex items-center justify-center"><IconPlus className="w-6 h-6" /></div>
                </div>
                <div className="flex justify-around items-center flex-1 min-h-[70px]">
                    {rightItems.map(item => (
                        <div key={item.href} className="flex flex-col items-center text-primary p-1 text-center w-20">
                            <item.icon className="w-6 h-6" />
                            <span className="text-xs mt-1 truncate max-w-full">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Accesos Seleccionados ({selectedHrefs.length}/6)</h3>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-2 min-h-[200px] max-h-80 overflow-y-auto">
                        {selectedShortcuts.map((item, index) => (
                            <div key={item.href} className="bg-slate-700 p-2 rounded-md flex items-center gap-2">
                                <item.icon className="w-5 h-5 flex-shrink-0 text-slate-300" />
                                <span className="font-semibold text-sm text-slate-200 flex-grow truncate">{item.label}</span>
                                <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 disabled:opacity-30"><IconArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => handleMove(index, 'down')} disabled={index === selectedShortcuts.length - 1} className="p-1 disabled:opacity-30"><IconArrowDown className="w-4 h-4" /></button>
                                <button onClick={() => handleRemove(item.href!)} className="p-1 text-danger"><IconTrash className="w-4 h-4" /></button>
                            </div>
                        ))}
                        {selectedShortcuts.length === 0 && <p className="text-center text-slate-500 p-4">Añade accesos desde la lista de disponibles.</p>}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Accesos Disponibles</h3>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-2 min-h-[200px] max-h-80 overflow-y-auto">
                        {availableShortcuts.map(item => (
                            <div key={item.href} className="bg-slate-700 p-2 rounded-md flex items-center gap-2">
                                <item.icon className="w-5 h-5 flex-shrink-0 text-slate-300" />
                                <span className="font-semibold text-sm text-slate-200 flex-grow truncate">{item.label}</span>
                                <Button size="sm" variant="ghost" onClick={() => handleAdd(item.href!)} disabled={selectedHrefs.length >= 6} className="!px-2 !py-1 text-xs">Añadir</Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave}>Guardar Cambios</Button>
            </div>
        </Modal>
    );
};

const BottomNavCustomizer: React.FC = () => {
    const { bottomNavShortcuts } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const navItems = useMemo(() =>
        bottomNavShortcuts
            .map(href => NAV_ITEMS.find(item => item.href === href))
            .filter(Boolean),
        [bottomNavShortcuts]
    );

    const midPoint = Math.ceil(navItems.length / 2);
    const leftItems = navItems.slice(0, midPoint);
    const rightItems = navItems.slice(midPoint);

    return (
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Personalizar Navegación Inferior</h2>
            <p className="text-slate-400 mb-4">Selecciona hasta 6 accesos directos que se distribuirán automáticamente en la barra de navegación inferior.</p>

            <div className="bg-slate-900 rounded-lg p-2 flex items-center justify-between">
                <div className="flex justify-around items-center flex-1 min-h-[70px]">
                    {leftItems.map(item => <div key={item.href} title={item.label} className="flex flex-col items-center p-2 text-primary w-20"><item.icon className="w-6 h-6" /><span className="text-xs mt-1 truncate max-w-full">{item.label}</span></div>)}
                </div>
                <div className="p-2 flex-shrink-0">
                    <div className="bg-primary text-black rounded-full w-12 h-12 flex items-center justify-center"><IconPlus className="w-6 h-6" /></div>
                </div>
                <div className="flex justify-around items-center flex-1 min-h-[70px]">
                    {rightItems.map(item => <div key={item.href} title={item.label} className="flex flex-col items-center p-2 text-primary w-20"><item.icon className="w-6 h-6" /><span className="text-xs mt-1 truncate max-w-full">{item.label}</span></div>)}
                </div>
            </div>

            <div className="text-right mt-4">
                <Button onClick={() => setIsModalOpen(true)}>Configurar</Button>
            </div>

            <BottomNavConfigModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </Card>
    );
}

const SettingsPage: React.FC = () => {
    const { activeView, activeViewTarget, updateUser } = useApp();
    
    const activeUser = activeView.type === 'user' ? activeViewTarget as User : null;
    const [userName, setUserName] = useState(activeUser?.name || '');
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    const [fileToImport, setFileToImport] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [copyButtonText, setCopyButtonText] = useState('Copiar Datos al Portapapeles');
    
    // States for text import
    const [importText, setImportText] = useState('');
    const [isTextImportConfirmOpen, setIsTextImportConfirmOpen] = useState(false);
    const [importError, setImportError] = useState('');


    useEffect(() => {
        if (activeUser) {
            setUserName(activeUser.name);
        }
    }, [activeUser]);

    const handleSaveUserName = () => {
        if (activeUser && userName.trim()) {
            updateUser(activeUser.id, { name: userName.trim() });
        }
    };
    
    const handleExportData = () => {
        try {
            const appState = localStorage.getItem('finanzen-app-state-v3');
            if (!appState) {
                alert("No hay datos para exportar.");
                return;
            }
            
            const blob = new Blob([appState], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.download = `ecofinz_backup_${date}.json`;
            link.href = url;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error al exportar los datos:", error);
            alert("Ocurrió un error al intentar exportar los datos. Por favor, prueba la opción de copiar al portapapeles.");
        }
    };
    
    const handleCopyData = () => {
        const appState = localStorage.getItem('finanzen-app-state-v3');
        if (appState && navigator.clipboard) {
            navigator.clipboard.writeText(appState).then(() => {
                setCopyButtonText('¡Copiado!');
                setTimeout(() => setCopyButtonText('Copiar Datos al Portapapeles'), 3000);
            }).catch(err => {
                alert("No se pudo copiar al portapapeles. Por favor, inténtalo de nuevo.");
                console.error('Error al copiar:', err);
            });
        } else {
            alert('No se encontraron datos para copiar o tu navegador no es compatible con esta función.');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileToImport(file);
            setIsImportConfirmOpen(true);
        }
        event.target.value = ''; 
    };

    const handleConfirmImport = () => {
        if (!fileToImport) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("El archivo no es válido.");
                }
                JSON.parse(text); 
                localStorage.setItem('finanzen-app-state-v3', text);
                alert("Datos importados con éxito. La aplicación se recargará ahora.");
                window.location.reload();
            } catch (error) {
                console.error("Error al importar el archivo:", error);
                alert("Error: El archivo seleccionado no es un archivo de datos válido o está corrupto.");
            } finally {
                setIsImportConfirmOpen(false);
                setFileToImport(null);
            }
        };
        reader.readAsText(fileToImport);
    };
    
    const handleTextImport = () => {
        setImportError('');
        if (!importText.trim()) {
            setImportError("El cuadro de texto está vacío. Pega tus datos de respaldo.");
            return;
        }
        try {
            JSON.parse(importText);
            setIsTextImportConfirmOpen(true);
        } catch (error) {
            setImportError("Los datos pegados no son válidos. Asegúrate de copiar todo el contenido del archivo de respaldo.");
            console.error("Error parsing JSON from textarea:", error);
        }
    };
    
    const handleConfirmTextImport = () => {
        localStorage.setItem('finanzen-app-state-v3', importText);
        alert("Datos importados con éxito. La aplicación se recargará ahora.");
        window.location.reload();
    };

    const renderUserSection = () => (
        <>
            <Card>
                <h2 className="text-xl font-bold text-white mb-4">Ajustes del Perfil</h2>
                <div className="flex items-end gap-2">
                    <Input
                        label="Nombre de Usuario"
                        id="user-name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="flex-grow !mb-0"
                    />
                    <Button onClick={handleSaveUserName}>Guardar</Button>
                </div>
            </Card>
            <BottomNavCustomizer />
        </>
    );

    const renderDataSection = () => (
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Gestión de Datos</h2>
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-200">Exportar Datos</h3>
                    <p className="text-sm text-slate-400 mb-2">Guarda una copia de seguridad de todos tus datos en un archivo JSON.</p>
                    <div className="flex gap-2">
                        <Button onClick={handleExportData}>Descargar Archivo de Respaldo</Button>
                        <Button variant="ghost" onClick={handleCopyData}>
                           <IconClipboard className="w-5 h-5 mr-2" /> {copyButtonText}
                        </Button>
                    </div>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-slate-200">Importar desde Archivo</h3>
                    <p className="text-sm text-slate-400 mb-2">Restaura tus datos desde un archivo de respaldo. Esto sobreescribirá todos los datos actuales.</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".json" className="hidden" />
                    <Button onClick={handleImportClick} variant="secondary">Seleccionar Archivo</Button>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-slate-200">Importar desde Texto</h3>
                    <p className="text-sm text-slate-400 mb-2">Pega el contenido de tu archivo de respaldo en el siguiente cuadro de texto.</p>
                    <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Pega aquí el contenido de tu archivo .json..."
                        className="w-full h-32 bg-slate-700 border border-slate-600 rounded-md p-2 text-slate-100 font-mono text-xs"
                    />
                    {importError && <p className="text-sm text-danger mt-2">{importError}</p>}
                    <Button onClick={handleTextImport} variant="secondary" className="mt-2">Importar Texto</Button>
                </div>
            </div>
        </Card>
    );
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Ajustes</h1>
            {activeUser ? (
                <>
                    {renderUserSection()}
                    <PermissionsManager />
                    {/* Fixed: Removed GeminiApiManager component call as per coding guidelines */}
                    {renderDataSection()}
                </>
            ) : (
                <>
                    <Card>
                        <h2 className="text-xl font-bold text-white mb-4">Ajustes de Grupo</h2>
                        <p className="text-slate-400">Los ajustes de gestión de datos y API solo están disponibles en la vista de un perfil individual. Cambia a un perfil de usuario para realizar estas acciones.</p>
                    </Card>
                </>
            )}

            <ConfirmationModal
                isOpen={isImportConfirmOpen}
                onClose={() => setIsImportConfirmOpen(false)}
                onConfirm={handleConfirmImport}
                title="Confirmar Importación"
            >
                <p>¿Estás seguro de que quieres importar los datos desde <span className="font-bold">{fileToImport?.name}</span>?</p>
                <p className="mt-2 text-red-400 font-semibold">ADVERTENCIA: Esta acción sobreescribirá todos tus datos actuales de forma permanente.</p>
            </ConfirmationModal>
            
             <ConfirmationModal
                isOpen={isTextImportConfirmOpen}
                onClose={() => setIsTextImportConfirmOpen(false)}
                onConfirm={handleConfirmTextImport}
                title="Confirmar Importación desde Texto"
            >
                <p>¿Estás seguro de que quieres importar los datos desde el texto pegado?</p>
                <p className="mt-2 text-red-400 font-semibold">ADVERTENCIA: Esta acción sobreescribirá todos tus datos actuales de forma permanente.</p>
            </ConfirmationModal>
        </div>
    );
};

export default SettingsPage;
