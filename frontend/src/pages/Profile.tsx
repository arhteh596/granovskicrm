import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, Bell, User as UserIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationsStore } from '../store/notificationsStore';
import { useAuthStore } from '../store/authStore';
import { clientService, userService } from '../services';
import { AvatarUploadModal } from '../components/AvatarUploadModal';
import { getAvatarSrc, avatarOnError } from '../utils/avatar';

interface CallbackClient {
    id: number;
    company_name: string;
    ceo_name?: string;
    phone: string;
    callback_datetime?: string;
    callback_notes?: string;
    transferred_to?: number;
    transferred_notes?: string;
    birthdate?: string;
    address?: string;
    passport?: string;
    snils?: string;
    inn?: string;
}

export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const { addNotification } = useNotificationsStore();
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [callbackClients, setCallbackClients] = useState<CallbackClient[]>([]);
    const [transferredClients, setTransferredClients] = useState<CallbackClient[]>([]);
    const [notifiedTransferIds, setNotifiedTransferIds] = useState<Set<number>>(new Set());
    // Информация о передаче для каждого клиента (для карточек списка и модалки)
    const [transferInfos, setTransferInfos] = useState<Record<number, { from_user_id: number; from_username: string; transfer_date: string }>>({});
    const [transferInfo, setTransferInfo] = useState<{ from_user_id: number; from_username: string; transfer_date: string } | null>(null);

    // Модальные окна
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<CallbackClient | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    // Guard to prevent duplicate notifications on repeated mounts (e.g. navigation/StrictMode)
    const [didInitialNotify, setDidInitialNotify] = useState(false);

    useEffect(() => {
        // Синхронизируем avatarUrl с user?.avatar_url при изменении
        if (user?.avatar_url) {
            setAvatarUrl(user.avatar_url);
        }
    }, [user?.avatar_url]);

    useEffect(() => {
        loadCallbackClients();
        loadTransferredClients();

        // Проверка времени перезвонов каждую минуту
        const interval = setInterval(() => {
            checkCallbackNotifications();
            loadTransferredClients();
        }, 60000);

        // Проверка при загрузке: выполнить только один раз за сессию страницы
        if (!didInitialNotify) {
            checkCallbackNotifications();
            setDidInitialNotify(true);
        }

        return () => clearInterval(interval);
    }, [didInitialNotify]);

    // Уведомление о переданных клиентах (один раз на клиента)
    useEffect(() => {
        if (transferredClients.length === 0) return;
        const newOnes = transferredClients.filter(c => !notifiedTransferIds.has(c.id));
        if (newOnes.length > 0) {
            newOnes.forEach(c => {
                // Персистентная защита от повторных уведомлений при заходе на страницу
                const key = `notif_transfer_${c.id}`;
                if (localStorage.getItem(key)) return; // уже уведомляли ранее
                localStorage.setItem(key, '1');

                addNotification({ title: 'Переданный клиент', message: `${(c as any).ceo_name || c.company_name}` });
                toast(`Новый переданный клиент: ${(c as any).ceo_name || c.company_name}`, {
                    duration: 6000,
                    icon: '📥',
                    style: {
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.06) 100%)',
                        color: 'var(--color-text-main)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '14px',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                        backdropFilter: 'blur(6px)'
                    }
                });
            });
            setNotifiedTransferIds(prev => new Set([...prev, ...newOnes.map(c => c.id)]));
        }
    }, [transferredClients]);

    const loadCallbackClients = async () => {
        try {
            const response = await clientService.getByStatus('перезвон');
            if (response.success) {
                setCallbackClients(response.data || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки клиентов на перезвон');
        }
    };

    const loadTransferredClients = async () => {
        try {
            const response = await clientService.getByStatus('передать');
            if (response.success) {
                const list: CallbackClient[] = response.data || [];
                setTransferredClients(list);

                // Параллельно подтянем информацию о передаче для карточек (от кого и когда)
                const idsToFetch = list
                    .filter(c => !!(c as any).transferred_to)
                    .map(c => c.id)
                    .filter(id => !(id in transferInfos));

                if (idsToFetch.length > 0) {
                    try {
                        const results = await Promise.all(idsToFetch.map(async (id) => {
                            try {
                                const info = await clientService.getTransferInfo(id);
                                if (info?.success && info.data) {
                                    return [id, {
                                        from_user_id: info.data.from_user_id,
                                        from_username: info.data.from_username,
                                        transfer_date: info.data.transfer_date
                                    }] as const;
                                }
                            } catch {}
                            return [id, undefined] as const;
                        }));

                        const mapUpdates: Record<number, { from_user_id: number; from_username: string; transfer_date: string }> = {};
                        for (const [id, data] of results) {
                            if (data) mapUpdates[id] = data;
                        }
                        if (Object.keys(mapUpdates).length) {
                            setTransferInfos(prev => ({ ...prev, ...mapUpdates }));
                        }
                    } catch {}
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки переданных клиентов');
        }
    };

    const checkCallbackNotifications = () => {
        const now = new Date();
        callbackClients.forEach(client => {
            if (client.callback_datetime) {
                const callbackTime = new Date(client.callback_datetime);
                const diffMinutes = Math.floor((callbackTime.getTime() - now.getTime()) / 60000);

                if (diffMinutes === 5) {
                    const key = `notif_callback_5_${client.id}_${callbackTime.toISOString()}`;
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, '1');
                        addNotification({ title: 'Перезвон через 5 минут', message: `${client.ceо_name || client.company_name}` });
                        showNotification(`Через 5 минут перезвон: ${client.ceо_name || client.company_name}`);
                    }
                }
                if (diffMinutes === 0) {
                    const key = `notif_callback_0_${client.id}_${callbackTime.toISOString()}`;
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, '1');
                        addNotification({ title: 'Время перезвона', message: `${client.ceо_name || client.company_name}` });
                        showNotification(`Время перезвона: ${client.ceо_name || client.company_name}`, true);
                    }
                }
            }
        });
    };

    const showNotification = (message: string, isUrgent = false) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('GRANOVSKY Перезвон', {
                body: message,
                icon: '/assets/logo.png',
                tag: 'callback-notification'
            });
        }

        toast(message, {
            icon: <Bell size={20} style={{ color: 'var(--color-accent)' }} />,
            duration: isUrgent ? 10000 : 6000,
            style: {
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.06) 100%)',
                color: 'var(--color-text-main)',
                border: '1px solid var(--color-border)',
                borderRadius: '14px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(6px)'
            }
        });
    };

    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                toast.success('Уведомления включены');
            }
        }
    };

    const handleUploadAvatar = async (file: File, _cropData?: any) => {
        if (!user?.id) return;

        try {
            console.log('[Profile] Uploading avatar for user:', user.id);
            const response = await userService.uploadAvatar(user.id, file);
            console.log('[Profile] Avatar upload response:', response);

            if (response.success && response.data.avatar_url) {
                const newAvatarUrl = response.data.avatar_url;
                console.log('[Profile] New avatar URL:', newAvatarUrl);

                // Обновляем состояние пользователя
                updateUser({ ...response.data });
                setAvatarUrl(newAvatarUrl);

                toast.success('Аватар успешно обновлён!');
            }
        } catch (error) {
            console.error('[Profile] Error uploading avatar:', error);
            toast.error('Ошибка при загрузке аватара');
            throw error;
        }
    };

    const handleDeleteAvatar = () => {
        if (user?.id) {
            updateUser({ avatar_url: '' });
            setAvatarUrl('');
            toast.success('Аватар удалён');
        }
    };

    const formatDateTime = (datetime?: string) => {
        if (!datetime) return '-';
        const date = new Date(datetime);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeUntilCallback = (datetime?: string) => {
        if (!datetime) return null;
        const now = new Date();
        const callbackTime = new Date(datetime);
        const diffMs = callbackTime.getTime() - now.getTime();

        if (diffMs < 0) return 'Просрочено';

        const diffMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        if (hours > 0) {
            return `Через ${hours}ч ${minutes}м`;
        }
        return `Через ${minutes}м`;
    };

    return (
        <div className="main-container">
            <div className="card page-header">
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                    margin: 0
                }}>Профиль</h1>
            </div>

            {/* Карточка пользователя */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-lg)' }}>
                    <div style={{
                        position: 'relative',
                        display: 'inline-block'
                    }}>
                        {user?.avatar_url ? (
                            <img
                                src={getAvatarSrc(user.avatar_url, user.updated_at || Date.now())}
                                onError={avatarOnError}
                                alt={user.username}
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '3px solid var(--color-accent)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: 'var(--color-text-second)',
                                border: '3px solid var(--color-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '3rem',
                                fontWeight: 700,
                                color: '#fff',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}>
                                {user?.username.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <h2 style={{
                            fontSize: '1.8rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                            marginBottom: '5px',
                            color: 'var(--color-accent)',
                            textTransform: 'uppercase'
                        }}>{user?.full_name || user?.username}</h2>
                        <p style={{
                            color: 'var(--color-text-second)',
                            fontSize: '1rem',
                            marginBottom: '5px'
                        }}>
                            @{user?.username}
                        </p>
                        <p style={{
                            color: 'var(--color-text-main)',
                            fontSize: '1rem',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                        }}>
                            {user?.role === 'admin' ? 'Администратор' : 'Менеджер'}
                        </p>

                        <div style={{
                            marginTop: 'var(--space-lg)',
                            display: 'flex',
                            gap: 'var(--space-sm)',
                            alignItems: 'center'
                        }}>
                            <button
                                onClick={() => setIsAvatarModalOpen(true)}
                                className="btn btn-primary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontFamily: 'var(--font-heading)',
                                    textTransform: 'uppercase'
                                }}
                            >
                                <Upload size={20} /> Загрузить аватар
                            </button>
                            {avatarUrl && (
                                <button
                                    onClick={handleDeleteAvatar}
                                    className="btn btn-danger"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Trash2 size={20} /> Удалить
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Кнопка включения уведомлений */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%)',
                border: '1px solid rgba(255, 215, 0, 0.2)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <Bell size={32} style={{ color: 'var(--color-accent)' }} />
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.2rem',
                                fontWeight: 600,
                                fontFamily: 'var(--font-heading)',
                                color: 'var(--color-accent)'
                            }}>УВЕДОМЛЕНИЯ О ПЕРЕЗВОНАХ</h3>
                            <p style={{
                                margin: '5px 0 0 0',
                                fontSize: '0.9rem',
                                color: 'var(--color-text-second)'
                            }}>
                                Получайте уведомления за 5 минут до назначенного времени
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={requestNotificationPermission}
                        className="btn btn-primary"
                        style={{
                            fontFamily: 'var(--font-heading)',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Включить
                    </button>
                </div>
            </div>

            {/* Клиенты на перезвон */}
            <>
                <div className="card">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '25px'
                    }}>
                        <Clock size={24} style={{ color: 'var(--color-accent)' }} />
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-accent)',
                            textTransform: 'uppercase'
                        }}>Клиенты на перезвон</h3>
                    </div>
                    {callbackClients.length === 0 ? (
                        <p style={{
                            color: 'var(--color-text-second)',
                            textAlign: 'center',
                            padding: '20px',
                            fontSize: '1rem'
                        }}>Нет клиентов на перезвон</p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px'
                        }}>
                            {callbackClients.map((client) => {
                                const timeUntil = getTimeUntilCallback(client.callback_datetime);
                                const isUrgent = timeUntil && (timeUntil.includes('Просрочено') || timeUntil.includes('Через') && !timeUntil.includes('ч'));

                                return (
                                    <div
                                        key={client.id}
                                        style={{
                                            padding: '20px',
                                            background: isUrgent ? 'rgba(255, 215, 0, 0.1)' : 'var(--color-bg)',
                                            borderRadius: '15px',
                                            border: isUrgent ? '2px solid var(--color-accent)' : 'var(--border)',
                                            position: 'relative',
                                            transition: 'all 0.3s ease'
                                        }}
                                        onClick={() => { setSelectedClient(client); setIsClientModalOpen(true); }}
                                    >
                                        {isUrgent && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '10px',
                                                right: '10px',
                                                animation: 'pulse 2s ease-in-out infinite'
                                            }}>
                                                <Bell size={20} style={{ color: 'var(--color-accent)' }} />
                                            </div>
                                        )}

                                        <h4 style={{
                                            margin: '0 0 8px 0',
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            color: 'var(--color-text-main)'
                                        }}>{client.ceo_name || client.company_name}</h4>

                                        <p style={{
                                            margin: '0 0 12px 0',
                                            fontSize: '0.9rem',
                                            color: 'var(--color-text-second)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            📞 {client.phone}
                                        </p>

                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '12px',
                                            background: 'var(--color-bg-card)',
                                            borderRadius: '10px',
                                            marginBottom: '12px'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.85rem'
                                            }}>
                                                <span style={{ color: 'var(--color-text-second)' }}>Время перезвона:</span>
                                                <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                                                    {formatDateTime(client.callback_datetime)}
                                                </span>
                                            </div>
                                            {timeUntil && (
                                                <div style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: isUrgent ? 'var(--color-accent)' : 'var(--color-text-second)',
                                                    textAlign: 'right'
                                                }}>
                                                    {timeUntil}
                                                </div>
                                            )}
                                        </div>

                                        {client.callback_notes && (
                                            <p style={{
                                                margin: '0',
                                                padding: '10px',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                borderRadius: '8px',
                                                fontSize: '0.85rem',
                                                color: 'var(--color-text-second)',
                                                fontStyle: 'italic',
                                                borderLeft: '3px solid var(--color-accent)'
                                            }}>
                                                💬 {client.callback_notes}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '25px'
                    }}>
                        <UserIcon size={24} style={{ color: 'var(--color-accent)' }} />
                        <h3 style={{
                            margin: 0,
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-accent)',
                            textTransform: 'uppercase'
                        }}>Переданные клиенты</h3>
                    </div>
                    {transferredClients.length === 0 ? (
                        <p style={{
                            color: 'var(--color-text-second)',
                            textAlign: 'center',
                            padding: '20px',
                            fontSize: '1rem'
                        }}>Нет переданных клиентов</p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px'
                        }}>
                            {transferredClients.map((client) => (
                                <div
                                    key={client.id}
                                    style={{
                                        padding: '20px',
                                        background: 'var(--color-bg)',
                                        borderRadius: '15px',
                                        border: 'var(--border)'
                                    }}
                                    onClick={async () => {
                                        setSelectedClient(client);
                                        setIsClientModalOpen(true);
                                        // Для модалки используем уже загруженную информацию, а при отсутствии — подтянем
                                        const cached = transferInfos[client.id];
                                        if (cached) {
                                            setTransferInfo(cached);
                                        } else if (client.transferred_to) {
                                            try {
                                                const info = await clientService.getTransferInfo(client.id);
                                                if (info.success && info.data) {
                                                    const data = {
                                                        from_user_id: info.data.from_user_id,
                                                        from_username: info.data.from_username,
                                                        transfer_date: info.data.transfer_date,
                                                    };
                                                    setTransferInfo(data);
                                                    setTransferInfos(prev => ({ ...prev, [client.id]: data }));
                                                } else {
                                                    setTransferInfo(null);
                                                }
                                            } catch {
                                                setTransferInfo(null);
                                            }
                                        } else {
                                            setTransferInfo(null);
                                        }
                                    }}
                                >
                                    <h4 style={{
                                        margin: '0 0 8px 0',
                                        fontSize: '1.1rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-main)'
                                    }}>{client.ceo_name || client.company_name}</h4>

                                    <p style={{
                                        margin: '0 0 12px 0',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-second)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        📞 {client.phone}
                                    </p>

                                    {/* От кого и когда передан (прямо в карточке списка) */}
                                    {client.transferred_to && transferInfos[client.id] && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'var(--color-bg-card)',
                                            borderRadius: '10px',
                                            padding: '8px 10px',
                                            marginBottom: '10px',
                                            fontSize: '0.85rem'
                                        }}>
                                            <span style={{ color: 'var(--color-text-second)' }}>
                                                От: <strong style={{ color: 'var(--color-text-main)' }}>{transferInfos[client.id].from_username || `ID ${transferInfos[client.id].from_user_id}`}</strong>
                                            </span>
                                            <span style={{ color: 'var(--color-text-second)' }}>
                                                {formatDateTime(transferInfos[client.id].transfer_date)}
                                            </span>
                                        </div>
                                    )}

                                    {client.transferred_notes && (
                                        <p style={{
                                            margin: '0',
                                            padding: '10px',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            color: 'var(--color-text-second)',
                                            fontStyle: 'italic',
                                            borderLeft: '3px solid var(--color-accent)'
                                        }}>
                                            💬 {client.transferred_notes}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </>

            {/* Модальное окно загрузки аватара */}
            <AvatarUploadModal
                isOpen={isAvatarModalOpen}
                onClose={() => setIsAvatarModalOpen(false)}
                onSave={handleUploadAvatar}
            />

            {isClientModalOpen && selectedClient && (
                <div
                    onClick={() => setIsClientModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '720px',
                            margin: '0 16px',
                            background: 'var(--color-bg)',
                            border: 'var(--border)',
                            borderRadius: '16px',
                            boxShadow: 'var(--shadow-main)',
                            padding: '20px'
                        }}
                    >
                        <h3 style={{ marginTop: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                            Информация о клиенте
                        </h3>
                        {/* Ссылка на википедию (source_url) */}
                        {Boolean((selectedClient as any).source_url) && (
                            <p style={{ margin: '4px 0 10px 0' }}>
                                <a href={(selectedClient as any).source_url} target="_blank" rel="noreferrer" className="link-with-icon" style={{ color: 'var(--color-accent)' }}>
                                    🔗 Википедия / источник
                                </a>
                            </p>
                        )}

                        {/* Основные поля: ФИО/Компания */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            {(selectedClient.ceo_name || selectedClient.company_name) && (
                                <div><strong>ФИО/Компания:</strong><br />{selectedClient.ceo_name || selectedClient.company_name}</div>
                            )}
                            {selectedClient.phone && (<div><strong>Телефон 1:</strong><br />{selectedClient.phone}</div>)}
                            {(selectedClient as any).phone1 && (<div><strong>Телефон 2:</strong><br />{(selectedClient as any).phone1}</div>)}
                            {(selectedClient as any).phone2 && (<div><strong>Телефон 3:</strong><br />{(selectedClient as any).phone2}</div>)}
                            {(selectedClient as any).phone3 && (<div><strong>Телефон 4:</strong><br />{(selectedClient as any).phone3}</div>)}
                            {(selectedClient as any).extra_phone1 && (<div><strong>Телефон 5:</strong><br />{(selectedClient as any).extra_phone1}</div>)}
                            {(selectedClient as any).extra_phone2 && (<div><strong>Телефон 6:</strong><br />{(selectedClient as any).extra_phone2}</div>)}
                            {(selectedClient as any).extra_phone3 && (<div><strong>Телефон 7:</strong><br />{(selectedClient as any).extra_phone3}</div>)}

                            {(selectedClient as any).birthdate && (<div><strong>Дата рождения:</strong><br />{(selectedClient as any).birthdate}</div>)}
                            {(selectedClient as any).birthplace && (<div><strong>Место рождения:</strong><br />{(selectedClient as any).birthplace}</div>)}

                            {(selectedClient as any).snils && (<div><strong>СНИЛС:</strong><br />{(selectedClient as any).snils}</div>)}
                            {(selectedClient as any).inn && (<div><strong>ИНН:</strong><br />{(selectedClient as any).inn}</div>)}
                            {(selectedClient as any).passport && (<div><strong>Паспорт:</strong><br />{(selectedClient as any).passport}</div>)}

                            {(selectedClient as any).address && (<div><strong>Адрес 1:</strong><br />{(selectedClient as any).address}</div>)}
                            {(selectedClient as any).address1 && (<div><strong>Адрес 2:</strong><br />{(selectedClient as any).address1}</div>)}
                            {(selectedClient as any).address2 && (<div><strong>Адрес 3:</strong><br />{(selectedClient as any).address2}</div>)}
                            {(selectedClient as any).address3 && (<div><strong>Адрес 4:</strong><br />{(selectedClient as any).address3}</div>)}
                            {(selectedClient as any).address4 && (<div><strong>Адрес 5:</strong><br />{(selectedClient as any).address4}</div>)}
                        </div>

                        {/* Сопроводительный текст */}
                        {selectedClient.callback_notes && (
                            <div className="card" style={{ padding: '10px', marginBottom: '10px' }}>
                                💬 {selectedClient.callback_notes}
                            </div>
                        )}
                        {selectedClient.transferred_notes && (
                            <div className="card" style={{ padding: '10px', marginBottom: '10px' }}>
                                💬 {selectedClient.transferred_notes}
                            </div>
                        )}

                        {/* Если переданный клиент — показать от кого и дату */}
                        {selectedClient.transferred_to && transferInfo && (
                            <p style={{ color: 'var(--color-text-second)' }}>
                                Передача: от {transferInfo.from_username || `менеджер ID ${transferInfo.from_user_id ?? '-'}`}, дата {formatDateTime(transferInfo.transfer_date)}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            <button className="btn btn-primary" onClick={async () => {
                                try {
                                    const resp = await clientService.returnToWork(selectedClient.id);
                                    if (resp.success) {
                                        toast.success('Клиент возвращён в работу');
                                        setIsClientModalOpen(false);
                                        // Обновить списки
                                        loadCallbackClients();
                                        loadTransferredClients();
                                        // Перейти на нужную страницу и открыть именно этого клиента первым
                                        const isWiki = Boolean(
                                            (selectedClient as any)?.source_url ||
                                            (selectedClient as any)?.snils ||
                                            (selectedClient as any)?.passport ||
                                            (selectedClient as any)?.inn ||
                                            (selectedClient as any)?.birthdate
                                        );
                                        navigate(`${isWiki ? '/wiki' : '/call'}?clientId=${selectedClient.id}`);
                                    }
                                } catch (e) {
                                    toast.error('Ошибка при возврате клиента в работу');
                                }
                            }}>В работу</button>

                            <button className="btn btn-danger" onClick={async () => {
                                try {
                                    const section = selectedClient.transferred_to ? 'передать' : 'перезвон';
                                    const resp = await clientService.removeFromProfile(selectedClient.id, section as any);
                                    if (resp.success) {
                                        toast.success('Клиент удалён из раздела');
                                        setIsClientModalOpen(false);
                                        loadCallbackClients();
                                        loadTransferredClients();
                                    }
                                } catch (e) {
                                    toast.error('Ошибка удаления клиента');
                                }
                            }}>Удалить</button>

                            <button className="btn" onClick={() => { setIsClientModalOpen(false); setTransferInfo(null); }}>Закрыть</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
