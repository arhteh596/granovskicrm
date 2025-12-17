import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
    Users,
    Database,
    Phone,
    User,
    BarChart3,
    LogOut,
    Bell,
    Settings,
    Sun,
    Moon,
    UsersRound,
    Shield,
    BookOpen,
    LayoutDashboard,
    Megaphone,
    X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationsStore, NotificationItem } from '../store/notificationsStore.ts';
import { clientService } from '../services';
import { getAvatarSrc, avatarOnError } from '../utils/avatar';
import { Announcement } from '../types';
import { useUiStore } from '../store/uiStore';

export const Layout: React.FC = () => {
    const { user, logout, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const { notifications, unreadCount, markAsRead, removeNotification } = useNotificationsStore();
    const { visibility, fetchVisibility, fetchAnnouncements, announcements } = useUiStore();
    const [activePopup, setActivePopup] = useState<Announcement | null>(null);
    const [popupCounts, setPopupCounts] = useState<Record<number, number>>({});
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [didGlobalTransferCheck, setDidGlobalTransferCheck] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !user?.role) return;
        fetchVisibility(user.role);
        fetchAnnouncements();
        const interval = setInterval(fetchAnnouncements, 60000);
        return () => clearInterval(interval);
    }, [isAuthenticated, user?.role]);

    // Глобальная проверка переданных клиентов (независимо от активной страницы)
    useEffect(() => {
        let timer: any;
        const checkTransfers = async () => {
            try {
                const res = await clientService.getByStatus('передать');
                if (res?.success && Array.isArray(res.data)) {
                    res.data.forEach((c: any) => {
                        const key = `notif_transfer_${c.id}`;
                        if (!localStorage.getItem(key)) {
                            localStorage.setItem(key, '1');
                            // Отправляем уведомление сразу, вне зависимости от страницы
                            useNotificationsStore.getState().addNotification({
                                title: 'Переданный клиент',
                                message: `${c?.ceo_name || c?.company_name || 'Клиент'}`
                            });
                        }
                    });
                }
            } catch {}
        };

        // Первый запуск один раз
        if (!didGlobalTransferCheck) {
            checkTransfers();
            setDidGlobalTransferCheck(true);
        }
        // Периодическая проверка
        timer = setInterval(checkTransfers, 60000);
        return () => clearInterval(timer);
    }, [didGlobalTransferCheck]);

    useEffect(() => {
        const popup = announcements.find(
            (item) => item.type === 'popup' && item.is_active && (popupCounts[item.id] || 0) < (item.repeat_count || 1)
        );
        if (popup) {
            setActivePopup(popup);
        }
    }, [announcements, popupCounts]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleClosePopup = () => {
        if (!activePopup) return;
        setPopupCounts((prev) => ({ ...prev, [activePopup.id]: (prev[activePopup.id] || 0) + 1 }));
        setActivePopup(null);
    };

    useEffect(() => {
        if (!activePopup) return;
        const timer = setTimeout(handleClosePopup, activePopup.display_duration_ms || 8000);
        return () => clearTimeout(timer);
    }, [activePopup]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    // Навигация для администратора
    const adminNav = [
        { path: '/call', icon: Phone, label: 'Звонить', key: 'call' },
        { path: '/wiki', icon: BookOpen, label: 'Wiki', key: 'wiki' },
        { path: '/admin/panel', icon: LayoutDashboard, label: 'Админка', key: 'admin-panel' },
        { path: '/admin/users', icon: Users, label: 'Пользователи', key: 'admin-users' },
        { path: '/admin/databases', icon: Database, label: 'Базы данных', key: 'admin-db' },
        { path: '/admin/databases-wiki', icon: Database, label: 'Базы Wiki', key: 'admin-db-wiki' },
        { path: '/katka', icon: Shield, label: 'Катка', key: 'katka' },
        { path: '/statistics', icon: BarChart3, label: 'Статистика', key: 'statistics' },
        { path: '/profile', icon: User, label: 'Профиль', key: 'profile' }
    ];

    // Навигация для менеджера
    const managerNav = [
        { path: '/call', icon: Phone, label: 'Обзвон', key: 'call' },
        { path: '/wiki', icon: BookOpen, label: 'Wiki', key: 'wiki' },
        { path: '/statistics', icon: BarChart3, label: 'Статистика', key: 'statistics' },
        { path: '/profile', icon: User, label: 'Профиль', key: 'profile' }
    ];

    // Навигация для закрыв
    const zakryvNav = [
        { path: '/call', icon: Phone, label: 'Обзвон', key: 'call' },
        { path: '/wiki', icon: BookOpen, label: 'Wiki', key: 'wiki' },
        { path: '/mamonty', icon: UsersRound, label: 'Мамонты', key: 'mamonty' },
        { path: '/katka', icon: Shield, label: 'Катка', key: 'katka' },
        { path: '/statistics', icon: BarChart3, label: 'Статистика', key: 'statistics' },
        { path: '/profile', icon: User, label: 'Профиль', key: 'profile' }
    ];

    const rawNav = user?.role === 'admin' ? adminNav : user?.role === 'zakryv' ? zakryvNav : managerNav;
    const navigation = rawNav.filter((item) => {
        if (user?.role === 'admin') return true;
        const role = user?.role || 'manager';
        return visibility[role]?.[item.key] !== false;
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--color-bg)',
            color: 'var(--color-text-main)'
        }}>
            {/* Header */}
            <header style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 999,
                width: 'calc(100% - 40px)',
                maxWidth: '1400px',
                pointerEvents: 'none'
            }}>
                <div style={{
                    pointerEvents: 'auto',
                    padding: '10px',
                    background: 'var(--color-bg-card)',
                    borderRadius: 'var(--border-radius-card)',
                    border: 'var(--border)',
                    boxShadow: 'var(--shadow-main)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    {/* Logo */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <img
                            src="/assets/logo-header.png"
                            alt="GRANOVSKY Logo"
                            style={{
                                height: '40px',
                                width: 'auto',
                                filter: theme === 'dark' ? 'brightness(1.1)' : 'brightness(1)',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    </div>

                    {/* Navigation */}
                    <nav style={{
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center'
                        }}>
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        style={{
                                            color: active ? 'var(--color-text-main)' : 'var(--color-text-second)',
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            transition: 'background-color 0.2s, color 0.2s',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.95rem',
                                            background: active ? 'rgba(255,255,255,0.05)' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!active) {
                                                e.currentTarget.style.color = 'var(--color-text-main)';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!active) {
                                                e.currentTarget.style.color = 'var(--color-text-second)';
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        <Icon size={16} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Right Actions */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <button
                            onClick={toggleTheme}
                            style={{
                                background: 'var(--color-bg-card)',
                                border: 'var(--border)',
                                padding: '8px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                color: 'var(--color-text-second)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.color = 'var(--color-accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.color = 'var(--color-text-second)';
                            }}
                            title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        {/* Notifications bell with badge and dropdown */}
                        <div style={{ position: 'relative' }} ref={dropdownRef}>
                            <button
                                aria-label="Уведомления"
                                onClick={() => setShowDropdown(s => !s)}
                                style={{
                                    background: 'var(--color-bg-card)',
                                    border: 'var(--border)',
                                    padding: '8px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    color: 'var(--color-text-second)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.color = 'var(--color-accent)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.color = 'var(--color-text-second)';
                                }}
                                title="Уведомления"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '-6px',
                                        minWidth: '18px',
                                        height: '18px',
                                        padding: '0 4px',
                                        background: '#dc2626',
                                        color: 'white',
                                        borderRadius: '999px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 0 0 2px var(--color-bg-card)'
                                    }}>{unreadCount}</span>
                                )}
                            </button>
                            {showDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '44px',
                                    width: '360px',
                                    maxHeight: '60vh',
                                    overflowY: 'auto',
                                    background: 'var(--color-bg-card)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                                    zIndex: 1000,
                                    backdropFilter: 'blur(6px)',
                                    // Modern entry animation
                                    animation: 'notifDropdownIn 200ms ease-out',
                                }}>
                                    {/* lightweight inline keyframes for dropdown */}
                                    <style>{`
                                        @keyframes notifDropdownIn {
                                            from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                                            to { opacity: 1; transform: translateY(0) scale(1); }
                                        }
                                    `}</style>
                                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>Уведомления</span>
                                        {notifications.length > 0 && (
                                            <button onClick={() => notifications.forEach((n: NotificationItem) => markAsRead(n.id))} className="btn" style={{ fontSize: '12px' }}>Отметить прочитанными</button>
                                        )}
                                    </div>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '16px', color: 'var(--color-text-second)', textAlign: 'center' }}>Нет уведомлений</div>
                                    ) : (
                                        notifications.map((n: NotificationItem) => (
                                            <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', padding: '12px', borderBottom: '1px solid var(--color-border)', transition: 'background 180ms ease' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{n.title}</span>
                                                        {!n.read && <span style={{ fontSize: '10px', color: 'var(--color-accent)' }}>новое</span>}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--color-text-second)', marginTop: '4px' }}>{n.message}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--color-text-second)', marginTop: '6px' }}>{new Date(n.createdAt).toLocaleString('ru-RU')}</div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {!n.read && (
                                                        <button className="btn btn-primary" style={{ fontSize: '11px', padding: '6px 8px' }} onClick={() => markAsRead(n.id)}>Прочитать</button>
                                                    )}
                                                    <button className="btn btn-danger" style={{ fontSize: '11px', padding: '6px 8px' }} onClick={() => removeNotification(n.id)}>Удалить</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Кнопка Админка только для администраторов */}
                        {user?.role === 'admin' && (
                            <button
                                style={{
                                    background: 'var(--color-bg-card)',
                                    border: 'var(--border)',
                                    padding: '8px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    color: 'var(--color-text-second)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px'
                                }}
                                onClick={() => navigate('/admin/panel')}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.color = 'var(--color-accent)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.color = 'var(--color-text-second)';
                                }}
                                title="Панель администратора"
                            >
                                <LayoutDashboard size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/profile')}
                            style={{
                                background: 'var(--color-bg-card)',
                                border: 'var(--border)',
                                padding: '8px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                color: 'var(--color-text-second)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.color = 'var(--color-accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.color = 'var(--color-text-second)';
                            }}
                            title="Настройки профиля"
                        >
                            <Settings size={18} />
                        </button>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '4px 20px',
                            borderRadius: '999px',
                            border: 'var(--border)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}>
                            {user?.avatar_url ? (
                                <img
                                    src={getAvatarSrc(user.avatar_url, user.updated_at || Date.now())}
                                    onError={avatarOnError}
                                    alt={user.username}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '2px solid var(--color-accent)'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: 'var(--color-text-second)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.9rem'
                                }}>
                                    {user?.username.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                lineHeight: 1
                            }}>
                                <span style={{
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-main)'
                                }}>{user?.full_name}</span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--color-text-second)',
                                    textTransform: 'uppercase'
                                }}>
                                    {user?.role === 'admin' ? 'ADMIN' : user?.role === 'zakryv' ? 'ЗАКРЫВ' : 'MANAGER'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'var(--color-bg-card)',
                                border: 'var(--border)',
                                padding: '8px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                color: 'var(--color-text-second)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                                e.currentTarget.style.background = 'rgba(255,0,0,0.1)';
                                e.currentTarget.style.color = '#ff5555';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.background = 'var(--color-bg-card)';
                                e.currentTarget.style.color = 'var(--color-text-second)';
                            }}
                            title="Выйти"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Spacer */}
            <div style={{ height: '100px' }}></div>

            {/* Main Content */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden'
            }}>
                <div style={{
                    padding: '0 var(--space-xl)',
                    maxWidth: '1400px',
                    margin: '0 auto'
                }}>
                    <Outlet />
                </div>
            </main>

            {announcements.some((a) => a.type === 'marquee' && a.is_active) && (
                <div style={{
                    position: 'fixed',
                    top: '0',
                    left: 0,
                    right: 0,
                    zIndex: 900,
                    pointerEvents: 'none'
                }}>
                    <style>{`
                        @keyframes tickerFlow { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
                    `}</style>
                    <div style={{
                        background: 'rgba(0,0,0,0.6)',
                        color: 'var(--color-text-main)',
                        padding: '6px 0',
                        overflow: 'hidden',
                        backdropFilter: 'blur(6px)',
                        borderBottom: '1px solid var(--color-border)'
                    }}>
                        <div style={{
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                            animation: 'tickerFlow 16s linear infinite',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'var(--color-accent)'
                        }}>
                            {announcements.filter((a) => a.type === 'marquee' && a.is_active).map((a) => `${a.title}: ${a.message}`).join(' • ')}
                        </div>
                    </div>
                </div>
            )}

            {activePopup && (
                <div style={{
                    position: 'fixed',
                    right: '20px',
                    bottom: '20px',
                    zIndex: 1100,
                    maxWidth: '360px'
                }}>
                    <div style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '16px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        padding: '16px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '10px',
                        animation: 'notifDropdownIn 180ms ease-out'
                    }}>
                        <style>{`
                            @keyframes notifDropdownIn { from { opacity: 0; transform: translateY(10px) scale(0.97);} to { opacity: 1; transform: translateY(0) scale(1);} }
                        `}</style>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <Megaphone size={16} color="var(--color-accent)" />
                                <strong>{activePopup.title}</strong>
                            </div>
                            <div style={{ color: 'var(--color-text-second)', fontSize: '0.95rem' }}>{activePopup.message}</div>
                        </div>
                        <button
                            onClick={handleClosePopup}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-text-second)',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
