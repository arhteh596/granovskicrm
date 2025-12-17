import React, { useState, useEffect } from 'react';
import { X, Filter, Database, Users, CheckCircle } from 'lucide-react';
import { filterService, databaseService, userService } from '../services';
import toast from 'react-hot-toast';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (filterId: number) => void;
    editFilterId?: number | null;
    onlyWiki?: boolean; // если true — показывать только Wiki-базы
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, onSave, editFilterId, onlyWiki }) => {
    const [filterName, setFilterName] = useState('');
    const [allDatabases, setAllDatabases] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [selectedDatabases, setSelectedDatabases] = useState<number[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [searchDatabase, setSearchDatabase] = useState('');
    const [searchUser, setSearchUser] = useState('');

    const availableStatuses = [
        'новый',
        'не дозвон',
        'автоответчик',
        'питон',
        'срез',
        'другой человек',
        'перезвон',
        'передать',
        'взял код'
    ];

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, editFilterId]);

    const loadData = async () => {
        try {
            const [databases, users] = await Promise.all([
                onlyWiki ? databaseService.getAllWiki() : databaseService.getAll(),
                userService.getAll()
            ]);
            const dbs = databases || [];
            setAllDatabases(dbs);
            setAllUsers(users);

            // Если редактируем фильтр, загружаем его данные
            if (editFilterId) {
                const filter = await filterService.getById(editFilterId);
                setFilterName(filter.name);
                setSelectedDatabases(filter.database_ids || []);
                setSelectedUsers(filter.user_ids || []);
                setSelectedStatuses(filter.statuses || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            toast.error('Не удалось загрузить данные');
        }
    };

    const handleSave = async () => {
        if (!filterName.trim()) {
            toast.error('Введите название фильтра');
            return;
        }

        if (selectedDatabases.length === 0) {
            toast.error('Выберите хотя бы одну базу');
            return;
        }

        try {
            const filterData = {
                name: filterName,
                database_ids: selectedDatabases,
                user_ids: selectedUsers.length > 0 ? selectedUsers : undefined,
                statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined
            };

            if (editFilterId) {
                await filterService.update(editFilterId, filterData);
                toast.success('Фильтр обновлен');
            } else {
                const newFilter = await filterService.create(filterData);
                toast.success('Фильтр создан');
                if (onSave) {
                    onSave(newFilter.id);
                }
            }

            handleClose();
        } catch (error: any) {
            console.error('Ошибка сохранения фильтра:', error);
            toast.error(error?.response?.data?.message || 'Не удалось сохранить фильтр');
        }
    };

    const handleDelete = async () => {
        if (!editFilterId) return;

        if (!confirm('Вы уверены, что хотите удалить этот фильтр?')) {
            return;
        }

        try {
            await filterService.delete(editFilterId);
            toast.success('Фильтр удален');
            handleClose();
        } catch (error) {
            console.error('Ошибка удаления фильтра:', error);
            toast.error('Не удалось удалить фильтр');
        }
    };

    const handleClose = () => {
        setFilterName('');
        setSelectedDatabases([]);
        setSelectedUsers([]);
        setSelectedStatuses([]);
        setSearchDatabase('');
        setSearchUser('');
        onClose();
    };

    const toggleDatabase = (id: number) => {
        console.log('Toggle database:', id);
        setSelectedDatabases(prev => {
            const newValue = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            console.log('New selected databases:', newValue);
            return newValue;
        });
    };

    const toggleUser = (id: number) => {
        console.log('Toggle user:', id);
        setSelectedUsers(prev => {
            const newValue = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            console.log('New selected users:', newValue);
            return newValue;
        });
    };

    const toggleStatus = (status: string) => {
        console.log('Toggle status:', status);
        setSelectedStatuses(prev => {
            const newValue = prev.includes(status) ? prev.filter(x => x !== status) : [...prev, status];
            console.log('New selected statuses:', newValue);
            return newValue;
        });
    };

    const selectAllUsers = () => {
        setSelectedUsers(allUsers.map(u => u.id));
    };

    const filteredDatabases = allDatabases.filter(db =>
        db.name.toLowerCase().includes(searchDatabase.toLowerCase())
    );

    const filteredUsers = allUsers.filter(u =>
        u.username.toLowerCase().includes(searchUser.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div
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
                opacity: isOpen ? 1 : 0,
                visibility: isOpen ? 'visible' : 'hidden',
                transition: 'opacity 0.3s, visibility 0.3s'
            }}
            onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
            <div
                style={{
                    background: 'var(--color-bg-card)',
                    padding: '30px',
                    borderRadius: 'var(--border-radius-card)',
                    border: '1px solid var(--color-border)',
                    width: '90%',
                    maxWidth: '1200px',
                    maxHeight: '90vh',
                    position: 'relative',
                    transform: isOpen ? 'scale(1)' : 'scale(0.9)',
                    transition: 'transform 0.3s',
                    boxShadow: 'var(--shadow-main)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-second)',
                        cursor: 'pointer',
                        padding: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-main)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-second)'}
                >
                    <X size={24} />
                </button>

                <h3 style={{
                    margin: '0 0 25px 0',
                    color: 'var(--color-accent)',
                    textAlign: 'center',
                    fontSize: '1.2rem',
                    fontFamily: 'var(--font-heading)',
                    textTransform: 'uppercase'
                }}>
                    <Filter size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {editFilterId ? 'Редактирование фильтра' : 'Создание фильтра'}
                </h3>

                <div style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="Название фильтра..."
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 15px',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--border-radius-element)',
                            color: 'var(--color-text-main)',
                            fontSize: '1rem',
                            fontFamily: 'var(--font-body)'
                        }}
                    />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '30px',
                    overflowY: 'auto',
                    paddingRight: '15px',
                    flex: 1
                }}>
                    {/* Левая колонка - Базы */}
                    <div>
                        <h4 style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-second)',
                            margin: '0 0 15px 0',
                            borderBottom: '1px solid var(--color-border)',
                            paddingBottom: '10px',
                            fontSize: '1rem'
                        }}>
                            <Database size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Выбор баз для работы
                        </h4>

                        <input
                            type="search"
                            placeholder="Поиск базы..."
                            value={searchDatabase}
                            onChange={(e) => setSearchDatabase(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 15px',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--border-radius-element)',
                                color: 'var(--color-text-main)',
                                fontSize: '0.9rem',
                                marginBottom: '15px'
                            }}
                        />

                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--border-radius-element)',
                            padding: '10px',
                            background: 'var(--color-bg)',
                            minHeight: '200px'
                        }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                                {filteredDatabases.map(db => (
                                    <span
                                        key={db.id}
                                        onClick={() => toggleDatabase(db.id)}
                                        style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            background: selectedDatabases.includes(db.id) ? 'var(--color-accent)' : 'var(--color-bg-light)',
                                            border: '1px solid var(--color-border-light)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'background-color 0.2s',
                                            color: selectedDatabases.includes(db.id) ? 'var(--color-bg)' : 'var(--color-text-main)',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {db.name}
                                    </span>
                                ))}
                            </div>

                            {selectedDatabases.length > 0 && (
                                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                                    <div style={{ color: 'var(--color-text-second)', fontSize: '0.85rem', marginBottom: '8px' }}>
                                        Выбрано ({selectedDatabases.length}):
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {selectedDatabases.map(id => {
                                            const db = allDatabases.find(d => d.id === id);
                                            return db ? (
                                                <span
                                                    key={id}
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '4px 8px',
                                                        background: 'var(--color-accent)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--color-bg)',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => toggleDatabase(id)}
                                                >
                                                    {db.name} ×
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Правая колонка - Пользователи и Статусы */}
                    <div>
                        <h4 style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-second)',
                            margin: '0 0 15px 0',
                            borderBottom: '1px solid var(--color-border)',
                            paddingBottom: '10px',
                            fontSize: '1rem'
                        }}>
                            <Users size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Выбор пользователей
                        </h4>

                        <input
                            type="search"
                            placeholder="Поиск пользователя..."
                            value={searchUser}
                            onChange={(e) => setSearchUser(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 15px',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--border-radius-element)',
                                color: 'var(--color-text-main)',
                                fontSize: '0.9rem',
                                marginBottom: '10px'
                            }}
                        />

                        <button
                            onClick={selectAllUsers}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'var(--color-bg-light)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 'var(--border-radius-element)',
                                color: 'var(--color-text-main)',
                                cursor: 'pointer',
                                marginBottom: '15px',
                                fontFamily: 'var(--font-heading)',
                                fontSize: '0.9rem',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#3c3c3c'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-bg-light)'}
                        >
                            Выбрать всех
                        </button>

                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--border-radius-element)',
                            padding: '10px',
                            background: 'var(--color-bg)',
                            marginBottom: '25px',
                            minHeight: '120px'
                        }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {filteredUsers.map(user => (
                                    <span
                                        key={user.id}
                                        onClick={() => toggleUser(user.id)}
                                        style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            background: selectedUsers.includes(user.id) ? 'var(--color-accent)' : 'var(--color-bg-light)',
                                            border: '1px solid var(--color-border-light)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'background-color 0.2s',
                                            color: selectedUsers.includes(user.id) ? 'var(--color-bg)' : 'var(--color-text-main)'
                                        }}
                                    >
                                        {user.username}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <h4 style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-second)',
                            margin: '0 0 15px 0',
                            borderBottom: '1px solid var(--color-border)',
                            paddingBottom: '10px',
                            fontSize: '1rem'
                        }}>
                            <CheckCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            Выбор статусов для работы
                        </h4>

                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--border-radius-element)',
                            padding: '10px',
                            background: 'var(--color-bg)',
                            minHeight: '100px'
                        }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {availableStatuses.map(status => (
                                    <span
                                        key={status}
                                        onClick={() => toggleStatus(status)}
                                        style={{
                                            display: 'inline-block',
                                            padding: '6px 12px',
                                            background: selectedStatuses.includes(status) ? 'var(--color-accent)' : 'var(--color-bg-light)',
                                            border: '1px solid var(--color-border-light)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'background-color 0.2s',
                                            color: selectedStatuses.includes(status) ? 'var(--color-bg)' : 'var(--color-text-main)',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {status}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '15px',
                    marginTop: '25px',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--color-border)'
                }}>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '12px 20px',
                            background: 'var(--color-accent)',
                            border: 'none',
                            borderRadius: 'var(--border-radius-element)',
                            color: 'var(--color-bg)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-heading)',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#e6c300'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
                    >
                        {editFilterId ? 'Обновить' : 'Создать'}
                    </button>

                    {editFilterId && (
                        <button
                            onClick={handleDelete}
                            style={{
                                padding: '12px 20px',
                                background: 'transparent',
                                border: '1px solid var(--color-danger)',
                                borderRadius: 'var(--border-radius-element)',
                                color: 'var(--color-danger)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-heading)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(229, 57, 53, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            Удалить фильтр
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
