import React, { useEffect, useState } from 'react';
import { UserPlus, Users as UsersIcon, Search, Trash2, Key, Ban, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../services';
import { User, CreateUserDTO } from '../types';
import { getAvatarSrc, avatarOnError } from '../utils/avatar';

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'activity'>('profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRoleSelectOpen, setIsRoleSelectOpen] = useState(false);
    const [isDetailsRoleSelectOpen, setIsDetailsRoleSelectOpen] = useState(false);

    const [formData, setFormData] = useState<CreateUserDTO>({
        username: '',
        password: '',
        full_name: '',
        role: 'manager'
    });

    const [detailsFormData, setDetailsFormData] = useState({
        full_name: '',
        username: '',
        password: '',
        role: 'manager' as 'admin' | 'manager' | 'zakryv'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await userService.getAll();
            setUsers(data || []);
        } catch (error: any) {
            toast.error('Ошибка загрузки пользователей');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenRegisterModal = () => {
        setFormData({
            username: '',
            password: '',
            full_name: '',
            role: 'manager'
        });
        setIsRegisterModalOpen(true);
    };

    const handleCloseRegisterModal = () => {
        setIsRegisterModalOpen(false);
        setFormData({ username: '', password: '', full_name: '', role: 'manager' });
    };

    const handleOpenDetailsModal = (user: User) => {
        setSelectedUser(user);
        setDetailsFormData({
            full_name: user.full_name,
            username: user.username,
            password: '',
            role: user.role
        });
        setActiveTab('profile');
        setIsDetailsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedUser(null);
        setActiveTab('profile');
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.full_name || !formData.password) {
            toast.error('Заполните все поля');
            return;
        }

        if (formData.password.length < 6) {
            toast.error('Пароль должен содержать минимум 6 символов');
            return;
        }

        try {
            await userService.create(formData);
            toast.success('Пользователь создан');
            handleCloseRegisterModal();
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка создания');
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        if (!detailsFormData.full_name) {
            toast.error('Заполните имя');
            return;
        }

        if (detailsFormData.password && detailsFormData.password.length < 6) {
            toast.error('Пароль должен содержать минимум 6 символов');
            return;
        }

        try {
            await userService.update(selectedUser.id, detailsFormData);
            toast.success('Изменения сохранены');
            handleCloseDetailsModal();
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка сохранения');
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        if (!confirm('Вы уверены, что хотите удалить пользователя?')) {
            return;
        }

        try {
            await userService.delete(selectedUser.id);
            toast.success('Пользователь удалён');
            handleCloseDetailsModal();
            loadUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка удаления');
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.role === 'admin' ? 'администратор' : user.role === 'zakryv' ? 'закрыв' : 'менеджер').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleName = (role: string) => {
        if (role === 'admin') return 'Администратор';
        if (role === 'zakryv') return 'Закрыв';
        return 'Менеджер';
    };

    if (isLoading) {
        return (
            <div style={{
                textAlign: 'center',
                padding: 'var(--space-xl) 0',
                color: 'var(--color-text-second)'
            }}>Загрузка...</div>
        );
    }

    return (
        <div className="main-container">
            {/* Шапка */}
            <div className="card page-header">
                <div className="page-title">
                    <UsersIcon size={24} />
                    <h2>МЕНЕДЖЕРЫ</h2>
                </div>

                <div className="search-container">
                    <Search size={18} style={{
                        position: 'absolute',
                        left: '15px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-second)'
                    }} />
                    <input
                        type="search"
                        id="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по имени или роли..."
                        className="input-field"
                    />
                </div>

                <button
                    onClick={handleOpenRegisterModal}
                    className="btn btn-primary"
                >
                    <UserPlus size={20} /> Зарегистрировать
                </button>
            </div>

            {/* Сетка пользователей */}
            <div className="user-grid">
                {filteredUsers.length === 0 ? (
                    <p style={{ color: 'var(--color-text-second)' }}>Пользователи не найдены.</p>
                ) : (
                    filteredUsers.map(user => (
                        <div
                            key={user.id}
                            className="user-card"
                            onClick={() => handleOpenDetailsModal(user)}
                        >
                            <div className="user-avatar-container">
                                {user.avatar_url ? (
                                    <img
                                        src={getAvatarSrc(user.avatar_url, user.updated_at || user.created_at || Date.now())}
                                        onError={avatarOnError}
                                        alt={user.full_name}
                                        className="user-avatar"
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '50%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                ) : (
                                    <div className="user-avatar" style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        background: 'var(--color-text-second)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                        fontWeight: 700,
                                        color: '#fff'
                                    }}>
                                        {user.full_name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className={`status-indicator ${Math.random() > 0.5 ? 'online' : 'offline'}`}></div>
                            </div>

                            <div className="user-info">
                                <h4 className="user-name">{user.full_name}</h4>
                                <p className="user-login">@{user.username}</p>
                                <p className="user-role">{getRoleName(user.role)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Модальное окно регистрации */}
            {isRegisterModalOpen && (
                <div
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        opacity: 1,
                        visibility: 'visible'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleCloseRegisterModal();
                    }}
                >
                    <div style={{
                        background: 'var(--color-bg-card)',
                        padding: '30px',
                        borderRadius: '20px',
                        border: 'var(--border)',
                        width: '90%',
                        maxWidth: '500px',
                        position: 'relative',
                        boxShadow: 'var(--shadow-main)'
                    }}>
                        <button
                            onClick={handleCloseRegisterModal}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                fontSize: '1.5rem',
                                color: 'var(--color-text-second)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                                lineHeight: 1
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-main)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-second)'}
                        >
                            <X size={24} />
                        </button>

                        <h3 style={{
                            marginTop: 0,
                            marginBottom: '25px',
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-accent)',
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            textTransform: 'uppercase'
                        }}>РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ</h3>

                        <form onSubmit={handleRegisterSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-second)'
                                }}>Имя</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="input-field"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        background: 'var(--color-bg)',
                                        border: '1px solid #333',
                                        borderRadius: '15px',
                                        color: 'var(--color-text-main)',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-second)'
                                }}>Логин</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input-field"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        background: 'var(--color-bg)',
                                        border: '1px solid #333',
                                        borderRadius: '15px',
                                        color: 'var(--color-text-main)',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-second)'
                                }}>Пароль</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input-field"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        background: 'var(--color-bg)',
                                        border: '1px solid #333',
                                        borderRadius: '15px',
                                        color: 'var(--color-text-main)',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '8px',
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-second)'
                                }}>Роль</label>
                                <div style={{ position: 'relative' }} onClick={() => setIsRoleSelectOpen(!isRoleSelectOpen)}>
                                    <div style={{
                                        background: 'var(--color-bg)',
                                        border: '1px solid #333',
                                        borderRadius: isRoleSelectOpen ? '10px 10px 0 0' : '10px',
                                        padding: '12px 40px 12px 15px',
                                        color: 'var(--color-text-main)',
                                        fontSize: '1rem',
                                        cursor: 'pointer',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%238a8a8ad9' class='bi bi-chevron-down' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 15px center',
                                        backgroundSize: '1em'
                                    }}>
                                        {getRoleName(formData.role)}
                                    </div>
                                    {isRoleSelectOpen && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'var(--color-bg)',
                                            border: '1px solid #333',
                                            borderTop: 'none',
                                            borderRadius: '0 0 10px 10px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 1
                                        }}>
                                            <div
                                                onClick={() => setFormData({ ...formData, role: 'manager' })}
                                                style={{
                                                    padding: '12px 15px',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-text-main)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >Менеджер</div>
                                            <div
                                                onClick={() => setFormData({ ...formData, role: 'zakryv' })}
                                                style={{
                                                    padding: '12px 15px',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-text-main)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >Закрыв</div>
                                            <div
                                                onClick={() => setFormData({ ...formData, role: 'admin' })}
                                                style={{
                                                    padding: '12px 15px',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-text-main)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >Администратор</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '15px',
                                marginTop: '25px'
                            }}>
                                <button
                                    type="button"
                                    onClick={handleCloseRegisterModal}
                                    className="btn"
                                    style={{
                                        background: '#252525',
                                        fontFamily: 'var(--font-heading)',
                                        textTransform: 'uppercase'
                                    }}
                                >Отмена</button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{
                                        fontFamily: 'var(--font-heading)',
                                        textTransform: 'uppercase'
                                    }}
                                >Сохранить</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальное окно деталей */}
            {isDetailsModalOpen && selectedUser && (
                <div
                    className="modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        opacity: 1,
                        visibility: 'visible'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleCloseDetailsModal();
                    }}
                >
                    <div style={{
                        background: 'var(--color-bg-card)',
                        padding: '30px',
                        borderRadius: '20px',
                        border: 'var(--border)',
                        width: '90%',
                        maxWidth: '500px',
                        position: 'relative',
                        boxShadow: 'var(--shadow-main)'
                    }}>
                        <button
                            onClick={handleCloseDetailsModal}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                fontSize: '1.5rem',
                                color: 'var(--color-text-second)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                                lineHeight: 1
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-main)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-second)'}
                        >
                            <X size={24} />
                        </button>

                        <h3 style={{
                            marginTop: 0,
                            marginBottom: '25px',
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-accent)',
                            textAlign: 'center',
                            fontSize: '1.2rem',
                            textTransform: 'uppercase'
                        }}>{selectedUser.full_name}</h3>

                        {/* Вкладки */}
                        <div style={{
                            display: 'flex',
                            borderBottom: 'var(--border)',
                            marginBottom: '25px'
                        }}>
                            {['profile', 'security', 'activity'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    style={{
                                        padding: '10px 20px',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: 'none',
                                        color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-second)',
                                        fontSize: '1rem',
                                        position: 'relative',
                                        transition: 'color 0.2s',
                                        fontFamily: 'var(--font-heading)',
                                        textTransform: 'uppercase',
                                        fontWeight: activeTab === tab ? 600 : 400,
                                        borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : 'none'
                                    }}
                                >
                                    {tab === 'profile' ? 'Профиль' : tab === 'security' ? 'Безопасность' : 'Активность'}
                                </button>
                            ))}
                        </div>

                        {/* Вкладка Профиль */}
                        {activeTab === 'profile' && (
                            <div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-second)'
                                    }}>Имя</label>
                                    <input
                                        type="text"
                                        value={detailsFormData.full_name}
                                        onChange={(e) => setDetailsFormData({ ...detailsFormData, full_name: e.target.value })}
                                        className="input-field"
                                        style={{
                                            width: '100%',
                                            padding: '12px 15px',
                                            background: 'var(--color-bg)',
                                            border: '1px solid #333',
                                            borderRadius: '15px',
                                            color: 'var(--color-text-main)',
                                            fontSize: '1rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-second)'
                                    }}>Роль</label>
                                    <div style={{ position: 'relative' }} onClick={() => setIsDetailsRoleSelectOpen(!isDetailsRoleSelectOpen)}>
                                        <div style={{
                                            background: 'var(--color-bg)',
                                            border: '1px solid #333',
                                            borderRadius: isDetailsRoleSelectOpen ? '10px 10px 0 0' : '10px',
                                            padding: '12px 40px 12px 15px',
                                            color: 'var(--color-text-main)',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%238a8a8ad9' class='bi bi-chevron-down' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 15px center',
                                            backgroundSize: '1em'
                                        }}>
                                            {getRoleName(detailsFormData.role)}
                                        </div>
                                        {isDetailsRoleSelectOpen && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                background: 'var(--color-bg)',
                                                border: '1px solid #333',
                                                borderTop: 'none',
                                                borderRadius: '0 0 10px 10px',
                                                maxHeight: '200px',
                                                overflowY: 'auto',
                                                zIndex: 1
                                            }}>
                                                <div
                                                    onClick={() => setDetailsFormData({ ...detailsFormData, role: 'manager' })}
                                                    style={{
                                                        padding: '12px 15px',
                                                        cursor: 'pointer',
                                                        color: 'var(--color-text-main)',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >Менеджер</div>
                                                <div
                                                    onClick={() => setDetailsFormData({ ...detailsFormData, role: 'admin' })}
                                                    style={{
                                                        padding: '12px 15px',
                                                        cursor: 'pointer',
                                                        color: 'var(--color-text-main)',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >Администратор</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Вкладка Безопасность */}
                        {activeTab === 'security' && (
                            <div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-second)'
                                    }}>Логин</label>
                                    <input
                                        type="text"
                                        value={detailsFormData.username}
                                        onChange={(e) => setDetailsFormData({ ...detailsFormData, username: e.target.value })}
                                        className="input-field"
                                        style={{
                                            width: '100%',
                                            padding: '12px 15px',
                                            background: 'var(--color-bg)',
                                            border: '1px solid #333',
                                            borderRadius: '15px',
                                            color: 'var(--color-text-main)',
                                            fontSize: '1rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '8px',
                                        fontSize: '0.9rem',
                                        color: 'var(--color-text-second)'
                                    }}>Новый пароль (оставьте пустым, чтобы не менять)</label>
                                    <input
                                        type="password"
                                        value={detailsFormData.password}
                                        onChange={(e) => setDetailsFormData({ ...detailsFormData, password: e.target.value })}
                                        className="input-field"
                                        style={{
                                            width: '100%',
                                            padding: '12px 15px',
                                            background: 'var(--color-bg)',
                                            border: '1px solid #333',
                                            borderRadius: '15px',
                                            color: 'var(--color-text-main)',
                                            fontSize: '1rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '15px',
                                    marginTop: '25px'
                                }}>
                                    <button className="btn" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontFamily: 'var(--font-heading)',
                                        textTransform: 'uppercase'
                                    }}>
                                        <Key size={16} /> Ограничить доступ
                                    </button>
                                    <button className="btn btn-danger" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        fontFamily: 'var(--font-heading)',
                                        textTransform: 'uppercase',
                                        background: 'transparent',
                                        border: '1px solid var(--color-danger)',
                                        color: 'var(--color-danger)'
                                    }}>
                                        <Ban size={16} /> Заблокировать
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Вкладка Активность */}
                        {activeTab === 'activity' && (
                            <div style={{ fontSize: '0.95rem' }}>
                                <p style={{
                                    margin: '0 0 15px 0',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Дата регистрации:</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('ru-RU') : '-'}
                                    </span>
                                </p>
                                <p style={{
                                    margin: '0 0 15px 0',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Последний сеанс:</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleString('ru-RU') : '-'}
                                    </span>
                                </p>
                                <p style={{
                                    margin: '0 0 15px 0',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Длительность сеанса:</span>
                                    <span style={{ fontWeight: 500 }}>-</span>
                                </p>
                            </div>
                        )}

                        {/* Кнопки внизу */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '15px',
                            marginTop: '25px'
                        }}>
                            <button
                                onClick={handleDelete}
                                className="btn btn-danger"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    fontFamily: 'var(--font-heading)',
                                    textTransform: 'uppercase',
                                    background: 'transparent',
                                    border: '1px solid var(--color-danger)',
                                    color: 'var(--color-danger)'
                                }}
                            >
                                <Trash2 size={16} /> Удалить
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                className="btn btn-primary"
                                style={{
                                    fontFamily: 'var(--font-heading)',
                                    textTransform: 'uppercase'
                                }}
                            >Сохранить изменения</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
