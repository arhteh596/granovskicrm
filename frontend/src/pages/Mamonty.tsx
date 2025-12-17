import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, Loader, Plus, Calendar, User, Phone, MapPin, Activity, Trash2 } from 'lucide-react';
import { TelegramAuthForm } from '../components/TelegramAuth';
import { telegramService } from '../services/telegramService';
import { TelegramSession } from '../types';
import { Button } from '../components/ui';
import toast from 'react-hot-toast';

export const Mamonty: React.FC = () => {
    const [sessions, setSessions] = useState<TelegramSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAuthForm, setShowAuthForm] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setLoading(true);
            const data = await telegramService.getAllSessions();
            setSessions(data);
        } catch (error: any) {
            toast.error('Ошибка загрузки сессий');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSession = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить эту сессию?')) return;

        try {
            const success = await telegramService.deleteSession(id);
            if (success) {
                toast.success('Сессия удалена');
                loadSessions();
            } else {
                toast.error('Ошибка удаления сессии');
            }
        } catch (error) {
            toast.error('Ошибка удаления сессии');
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                color: 'var(--color-text-secondary)'
            }}>
                <Loader size={32} className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <UsersIcon size={28} style={{ color: 'var(--color-primary)' }} />
                    <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Мамонты</h1>
                </div>
                <Button onClick={() => setShowAuthForm(true)}>
                    <Plus size={18} />
                    Добавить сессию
                </Button>
            </div>

            {/* Table */}
            <div style={{
                background: 'var(--color-bg-card)',
                borderRadius: 'var(--border-radius-card)',
                border: 'var(--border)',
                overflow: 'hidden'
            }}>
                {sessions.length === 0 ? (
                    <div style={{
                        padding: '60px 20px',
                        textAlign: 'center',
                        color: 'var(--color-text-secondary)'
                    }}>
                        <UsersIcon size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <p>Нет сохраненных сессий</p>
                        <p style={{ fontSize: '0.9rem' }}>
                            Нажмите "Добавить сессию" для создания новой
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse'
                        }}>
                            <thead>
                                <tr style={{
                                    background: 'var(--color-bg)',
                                    borderBottom: 'var(--border)'
                                }}>
                                    <th style={headerCellStyle}>
                                        <Phone size={16} style={{ marginRight: '8px' }} />
                                        Номер телефона
                                    </th>
                                    <th style={headerCellStyle}>
                                        <User size={16} style={{ marginRight: '8px' }} />
                                        Менеджер
                                    </th>
                                    <th style={headerCellStyle}>
                                        <Calendar size={16} style={{ marginRight: '8px' }} />
                                        Дата создания
                                    </th>
                                    <th style={headerCellStyle}>
                                        <Activity size={16} style={{ marginRight: '8px' }} />
                                        Статус
                                    </th>
                                    <th style={headerCellStyle}>
                                        Данные клиента
                                    </th>
                                    <th style={headerCellStyle}>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => (
                                    <tr key={session.id} style={{
                                        borderBottom: 'var(--border)',
                                        transition: 'background 0.2s'
                                    }}>
                                        <td style={cellStyle}>
                                            <strong>{session.phone_number}</strong>
                                        </td>
                                        <td style={cellStyle}>
                                            {session.creator_full_name || 'Неизвестно'}
                                            <br />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                                @{session.creator_username || 'n/a'}
                                            </span>
                                        </td>
                                        <td style={cellStyle}>
                                            {formatDate(session.created_at)}
                                        </td>
                                        <td style={cellStyle}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                background: session.is_active
                                                    ? 'rgba(16, 185, 129, 0.1)'
                                                    : 'rgba(239, 68, 68, 0.1)',
                                                color: session.is_active ? '#10b981' : '#ef4444'
                                            }}>
                                                {session.is_active ? 'Активна' : 'Неактивна'}
                                            </span>
                                        </td>
                                        <td style={cellStyle}>
                                            {session.client_full_name ? (
                                                <div>
                                                    <div><strong>{session.client_full_name}</strong></div>
                                                    {session.client_birthdate && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                            {session.client_birthdate}
                                                        </div>
                                                    )}
                                                    {session.client_address && (
                                                        <div style={{
                                                            fontSize: '0.85rem',
                                                            color: 'var(--color-text-secondary)',
                                                            maxWidth: '200px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                            {session.client_address}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                                                    Нет данных
                                                </span>
                                            )}
                                        </td>
                                        <td style={cellStyle}>
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Trash2 size={14} />
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAuthForm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <TelegramAuthForm
                        onSuccess={() => {
                            setShowAuthForm(false);
                            loadSessions();
                        }}
                        onCancel={() => setShowAuthForm(false)}
                    />
                </div>
            )}
        </div>
    );
};

const headerCellStyle: React.CSSProperties = {
    padding: '16px',
    textAlign: 'left',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center'
};

const cellStyle: React.CSSProperties = {
    padding: '16px',
    fontSize: '0.95rem',
    color: 'var(--color-text-main)'
};
