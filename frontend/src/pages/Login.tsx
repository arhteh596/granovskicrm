import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
// @ts-ignore - компоненты импортируются для будущего использования
import { Input } from '../components/ui/Input';
// @ts-ignore - компоненты импортируются для будущего использования
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login: setAuth } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            toast.error('Введите логин и пароль');
            return;
        }

        setIsLoading(true);

        try {
            const response = await authService.login({ username, password });

            if (response.success) {
                // Backend возвращает { success, token, user }, а не { success, data: { token, user } }
                const token = response.data?.token || response.token;
                const user = response.data?.user || response.user;

                if (token && user) {
                    setAuth(user, token);
                    toast.success('Добро пожаловать!');

                    // Редирект в зависимости от роли
                    if (user.role === 'admin') {
                        navigate('/admin/users');
                    } else {
                        navigate('/profile');
                    }
                } else {
                    toast.error('Ошибка получения данных пользователя');
                }
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка входа');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated Background */}
            <div style={{
                position: 'absolute',
                top: '10%',
                left: '10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
                opacity: 0.05,
                borderRadius: '50%',
                filter: 'blur(80px)',
                pointerEvents: 'none'
            }}></div>
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '10%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
                opacity: 0.08,
                borderRadius: '50%',
                filter: 'blur(100px)',
                pointerEvents: 'none'
            }}></div>

            {/* Theme Toggle */}
            <button
                onClick={toggleTheme}
                style={{
                    position: 'fixed',
                    top: '30px',
                    right: '30px',
                    background: 'var(--color-bg-card)',
                    border: 'var(--border)',
                    padding: '12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-card)',
                    zIndex: 10
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-main)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
            >
                {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
            </button>

            <div style={{
                width: '100%',
                maxWidth: '650px',
                padding: '0 var(--space-lg)',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Login Form */}
                <div style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 'var(--border-radius-card)',
                    padding: '60px',
                    boxShadow: 'var(--shadow-main)',
                    border: 'var(--border)',
                    backdropFilter: 'blur(10px)'
                }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                        <img
                            src="/assets/logo.png"
                            alt="GRANOVSKY Logo"
                            style={{
                                maxWidth: '350px',
                                height: 'auto',
                                filter: theme === 'dark' ? 'brightness(1.1)' : 'brightness(1)',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: 'var(--color-text-second)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                <User size={14} style={{
                                    display: 'inline-block',
                                    marginRight: '6px',
                                    verticalAlign: 'middle'
                                }} />
                                Логин
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Введите ваш логин"
                                autoComplete="username"
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    background: 'var(--color-bg-light)',
                                    border: 'var(--border)',
                                    borderRadius: '12px',
                                    color: 'var(--color-text-main)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.3s ease',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 215, 0, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: 'var(--color-text-second)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                <Lock size={14} style={{
                                    display: 'inline-block',
                                    marginRight: '6px',
                                    verticalAlign: 'middle'
                                }} />
                                Пароль
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Введите ваш пароль"
                                autoComplete="current-password"
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    background: 'var(--color-bg-light)',
                                    border: 'var(--border)',
                                    borderRadius: '12px',
                                    color: 'var(--color-text-main)',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.3s ease',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 215, 0, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '16px',
                                background: isLoading ? 'var(--color-text-second)' : 'var(--color-accent)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'var(--color-bg)',
                                fontSize: '1rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-heading)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: isLoading ? 'none' : '0 6px 20px rgba(255, 215, 0, 0.3)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 215, 0, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.3)';
                                }
                            }}
                        >
                            {isLoading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '3px solid rgba(255,255,255,0.3)',
                                        borderTop: '3px solid var(--color-bg)',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }}></div>
                                    Вход...
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <LogIn size={20} />
                                    Войти
                                </span>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: '30px',
                    textAlign: 'center'
                }}>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-text-second)',
                        opacity: 0.7
                    }}>
                        © 2025 GRANOVSKY. Все права защищены.
                    </p>
                </div>
            </div>
        </div>
    );
};
