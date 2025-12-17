import React, { useEffect, useState } from 'react';
import { Upload, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { databaseService, userService, filterService } from '../services';
import { Database, User, CallFilter } from '../types';

export const AdminDatabases: React.FC = () => {
    const [databases, setDatabases] = useState<Database[]>([]);
    const [managers, setManagers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [databaseName, setDatabaseName] = useState('');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedDatabases, setSelectedDatabases] = useState<number[]>([]);
    const [selectedManagers, setSelectedManagers] = useState<number[]>([]);
    const [includeAdmin, setIncludeAdmin] = useState(false);

    // Состояния для фильтров
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState<CallFilter[]>([]);
    const [editFilterId, setEditFilterId] = useState<number | null>(null);

    // Состояния для модальных окон
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDatabaseModal, setShowDatabaseModal] = useState(false);
    const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [databaseNotes, setDatabaseNotes] = useState('');

    useEffect(() => {
        loadDatabases();
        loadManagers();
        loadFilters();
    }, []);

    useEffect(() => {
        console.log('Databases state updated:', databases);
        console.log('Databases count:', databases.length);
    }, [databases]);

    const loadManagers = async () => {
        try {
            const data = await userService.getAll();
            const managersList = (data || []).filter((u: User) => u.role === 'manager');
            setManagers(managersList);
        } catch (error: any) {
            console.error('Load managers error:', error);
        }
    };

    const loadDatabases = async () => {
        try {
            const data = await databaseService.getAll();
            console.log('Databases data:', data);
            console.log('Data type:', typeof data);
            console.log('Is array:', Array.isArray(data));
            console.log('Data length:', data?.length);

            setDatabases(data || []);
        } catch (error: any) {
            console.error('Load databases error:', error);
            toast.error('Ошибка загрузки баз данных');
        } finally {
            setIsLoading(false);
        }
    };

    const loadFilters = async () => {
        try {
            const data = await filterService.getAll();
            console.log('Loaded filters:', data);
            setFilters(data || []);
        } catch (error: any) {
            console.error('Load filters error:', error);
        }
    };

    // @ts-ignore - параметр используется в callback
    const handleFilterSave = async (filterId: number) => {
        setShowFilterModal(false);
        setEditFilterId(null);
        toast.success('Фильтр сохранён');
        loadFilters();
    };

    const handleEditFilter = (filterId: number) => {
        setEditFilterId(filterId);
        setShowFilterModal(true);
    };

    const handleDeleteFilter = async (filterId: number) => {
        if (!confirm('Удалить этот фильтр?')) return;

        try {
            await filterService.delete(filterId);
            toast.success('Фильтр удалён');
            loadFilters();
        } catch (error: any) {
            toast.error('Ошибка удаления фильтра');
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'text/csv') {
            setUploadingFile(file);
        } else {
            toast.error('Выберите CSV файл');
        }
    };

    const handleUpload = async () => {
        if (!uploadingFile) return;

        if (!databaseName.trim()) {
            toast.error('Введите название базы данных');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('csvFile', uploadingFile);
            formData.append('name', databaseName.trim());
            if (databaseNotes.trim()) {
                formData.append('notes', databaseNotes.trim());
            }

            await databaseService.upload(formData);
            toast.success('База успешно загружена');
            setUploadingFile(null);
            setDatabaseName('');
            setDatabaseNotes('');
            setShowUploadModal(false);
            loadDatabases();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка загрузки');
        }
    };

    const handleAssign = async (databaseId: number) => {
        setSelectedDatabases([databaseId]);
        setSelectedManagers([]);
        setIsAssignModalOpen(true);
    };

    const handleConfirmAssign = async () => {
        if (selectedDatabases.length === 0) {
            toast.error('Выберите хотя бы одну базу данных');
            return;
        }

        if (selectedManagers.length === 0 && !includeAdmin) {
            toast.error('Выберите хотя бы одного менеджера или включите администратора');
            return;
        }

        try {
            for (const dbId of selectedDatabases) {
                await databaseService.assignClients(dbId, selectedManagers, includeAdmin);
            }
            toast.success('Клиенты назначены');
            setIsAssignModalOpen(false);
            setSelectedDatabases([]);
            setSelectedManagers([]);
            setIncludeAdmin(false);
            loadDatabases();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Ошибка назначения');
        }
    };

    const toggleDatabase = (dbId: number) => {
        setSelectedDatabases(prev =>
            prev.includes(dbId) ? prev.filter(id => id !== dbId) : [...prev, dbId]
        );
    };

    const toggleManager = (managerId: number) => {
        setSelectedManagers(prev =>
            prev.includes(managerId) ? prev.filter(id => id !== managerId) : [...prev, managerId]
        );
    };

    const selectAllDatabases = () => {
        if (selectedDatabases.length === databases.length) {
            setSelectedDatabases([]);
        } else {
            setSelectedDatabases(databases.map(db => db.id));
        }
    };

    const selectAllManagers = () => {
        if (selectedManagers.length === managers.length) {
            setSelectedManagers([]);
        } else {
            setSelectedManagers(managers.map(m => m.id));
        }
    };

    const handleDatabaseClick = (db: Database) => {
        setSelectedDatabase(db);
        setDatabaseNotes(db.notes || '');
        setShowDatabaseModal(true);
    };

    const filteredDatabases = databases.filter(db =>
        db.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const columns = [
        {
            key: 'name',
            label: 'Название базы',
            render: (db: Database) => (
                <span style={{ cursor: 'pointer', color: 'var(--color-accent)', fontWeight: 600 }}>
                    {db.name}
                </span>
            )
        },
        {
            key: 'upload_date',
            label: 'Дата загрузки',
            render: (db: Database) => new Date(db.upload_date).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        },
        {
            key: 'total_clients',
            label: 'Контакты (Всего)',
            render: (db: Database) => db.total_clients || 0
        },
        {
            key: 'new_clients',
            label: 'Не прозвонено (новые)',
            render: (db: Database) => db.new_clients_count ?? 0
        },
        {
            key: 'notes',
            label: 'Пометки',
            render: (db: Database) => (
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-second)' }}>
                    {db.notes || '—'}
                </span>
            )
        }
    ];

    return (
        <>
            <div className="main-container">
                {/* Заголовок */}
                <div className="card page-header">
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-heading)',
                        textTransform: 'uppercase',
                        color: 'var(--color-accent)',
                        margin: 0
                    }}>Управление базами данных</h1>
                </div>

                {/* Блок фильтров */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                        <h2 style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-accent)'
                        }}>Фильтры для звонков</h2>
                        <Button onClick={() => { setEditFilterId(null); setShowFilterModal(true); }}>
                            <Filter size={16} style={{ marginRight: '8px' }} />
                            Создать фильтр
                        </Button>
                    </div>

                    {filters.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl)',
                            color: 'var(--color-text-second)'
                        }}>Нет созданных фильтров</div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                            gap: 'var(--space-md)'
                        }}>
                            {filters.map((filter) => (
                                <div
                                    key={filter.id}
                                    style={{
                                        padding: 'var(--space-lg)',
                                        border: filter.is_active ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        background: filter.is_active ? 'rgba(255, 215, 0, 0.1)' : 'var(--color-bg)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-md)'
                                    }}
                                >
                                    {/* Заголовок и переключатель */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{
                                            fontWeight: 600,
                                            margin: 0,
                                            fontSize: '1.1rem',
                                            color: filter.is_active ? 'var(--color-accent)' : 'var(--color-text-main)'
                                        }}>
                                            {filter.name}
                                        </h3>
                                        {/* Toggle переключатель */}
                                        <label style={{
                                            position: 'relative',
                                            display: 'inline-block',
                                            width: '52px',
                                            height: '28px',
                                            cursor: 'pointer'
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={filter.is_active}
                                                onChange={async (e) => {
                                                    try {
                                                        await filterService.toggle(filter.id, e.target.checked);
                                                        toast.success(e.target.checked ? 'Фильтр активирован' : 'Фильтр деактивирован');
                                                        loadFilters();
                                                    } catch (error) {
                                                        toast.error('Ошибка переключения фильтра');
                                                    }
                                                }}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: filter.is_active ? 'var(--color-accent)' : '#444',
                                                borderRadius: '28px',
                                                transition: 'background-color 0.3s',
                                                cursor: 'pointer'
                                            }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    height: '20px',
                                                    width: '20px',
                                                    left: filter.is_active ? '28px' : '4px',
                                                    bottom: '4px',
                                                    background: 'white',
                                                    borderRadius: '50%',
                                                    transition: 'left 0.3s'
                                                }} />
                                            </span>
                                        </label>
                                    </div>

                                    {/* Информация о выбранных базах */}
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-second)' }}>
                                        <div style={{ marginBottom: 'var(--space-xs)' }}>
                                            <strong style={{ color: 'var(--color-text-main)' }}>Базы данных:</strong>
                                            <div style={{ marginTop: '4px' }}>
                                                {filter.database_names && filter.database_names.length > 0
                                                    ? filter.database_names.join(', ')
                                                    : 'Не выбраны'}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 'var(--space-xs)' }}>
                                            <strong style={{ color: 'var(--color-text-main)' }}>Пользователи:</strong>
                                            <div style={{ marginTop: '4px' }}>
                                                {filter.usernames && filter.usernames.length > 0
                                                    ? filter.usernames.join(', ')
                                                    : 'Все пользователи'}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 'var(--space-xs)' }}>
                                            <strong style={{ color: 'var(--color-text-main)' }}>Статусы:</strong>
                                            <div style={{ marginTop: '4px' }}>
                                                {filter.statuses && filter.statuses.length > 0
                                                    ? filter.statuses.join(', ')
                                                    : 'Все статусы'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Статистика контактов */}
                                    <div style={{
                                        padding: 'var(--space-sm)',
                                        background: 'var(--color-bg-card)',
                                        borderRadius: 'var(--radius-sm)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 'var(--space-sm)'
                                    }}>
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>
                                                {filter.remaining_contacts ?? 0}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-second)', marginTop: '2px' }}>
                                                Осталось
                                            </div>
                                        </div>
                                        <div style={{ width: '1px', background: 'var(--color-border)' }} />
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#8a8a8ad9' }}>
                                                {filter.processed_contacts ?? 0}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-second)', marginTop: '2px' }}>
                                                Обработано
                                            </div>
                                        </div>
                                        <div style={{ width: '1px', background: 'var(--color-border)' }} />
                                        <div style={{ textAlign: 'center', flex: 1 }}>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                                                {filter.total_contacts ?? 0}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-second)', marginTop: '2px' }}>
                                                Всего
                                            </div>
                                        </div>
                                    </div>

                                    {/* Кнопки действий */}
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        <Button size="sm" variant="secondary" onClick={() => handleEditFilter(filter.id)} style={{ flex: 1 }}>
                                            Изменить
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteFilter(filter.id)} style={{ flex: 1 }}>
                                            Удалить
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Список баз данных */}
                <div className="card">
                    {/* Шапка с поиском и кнопкой загрузки */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', gap: 'var(--space-md)' }}>
                        <Input
                            placeholder="Поиск по названию базы..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ flex: 1, maxWidth: '400px' }}
                        />
                        <Button onClick={() => setShowUploadModal(true)}>
                            <Upload size={20} style={{ marginRight: '8px' }} />
                            Загрузить базу
                        </Button>
                    </div>

                    {/* Таблица баз */}
                    {isLoading ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl) 0',
                            color: 'var(--color-text-second)'
                        }}>Загрузка...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        {columns.map(col => (
                                            <th key={col.key} className="text-left p-3 text-sm font-medium text-gray-400">
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDatabases.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length} className="text-center p-8 text-gray-500">
                                                Нет загруженных баз
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDatabases.map(db => (
                                            <tr
                                                key={db.id}
                                                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                                                onClick={() => handleDatabaseClick(db)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {columns.map(col => (
                                                    <td key={col.key} className="p-3 text-sm">
                                                        {col.render ? col.render(db) : db[col.key as keyof Database]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Модальное окно назначения */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Назначить клиентов менеджерам"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)}>
                            Отмена
                        </Button>
                        <Button variant="primary" onClick={handleConfirmAssign}>
                            Назначить
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-main)' }}>
                    {/* Выбор баз данных */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                            <label style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 'var(--font-weight-medium)',
                                color: 'var(--color-text-second)'
                            }}>
                                Базы данных
                            </label>
                            <Button size="sm" variant="secondary" onClick={selectAllDatabases}>
                                {selectedDatabases.length === databases.length ? 'Снять все' : 'Выбрать все'}
                            </Button>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-sm)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: 'var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-sm)'
                        }}>
                            {databases.map((db) => (
                                <label
                                    key={db.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 'var(--space-sm)',
                                        padding: 'var(--space-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer'
                                    }}
                                    className="hover-item"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDatabases.includes(db.id)}
                                        onChange={() => toggleDatabase(db.id)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                                        {db.name} ({db.total_clients} клиентов)
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Выбор менеджеров */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                            <label style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 'var(--font-weight-medium)',
                                color: 'var(--color-text-second)'
                            }}>
                                Менеджеры
                            </label>
                            <Button size="sm" variant="secondary" onClick={selectAllManagers}>
                                {selectedManagers.length === managers.length ? 'Снять все' : 'Выбрать все'}
                            </Button>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-sm)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: 'var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-sm)'
                        }}>
                            {managers.length === 0 ? (
                                <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text-second)',
                                    textAlign: 'center',
                                    padding: 'var(--space-lg) 0'
                                }}>
                                    Нет активных менеджеров
                                </p>
                            ) : (
                                managers.map((manager) => (
                                    <label
                                        key={manager.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            padding: 'var(--space-xs)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                        className="hover-item"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedManagers.includes(manager.id)}
                                            onChange={() => toggleManager(manager.id)}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>
                                            {manager.full_name || manager.username}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Включить администратора */}
                    <div>
                        <label
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                border: 'var(--border)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                background: includeAdmin ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                                transition: 'all 0.2s ease'
                            }}
                            className="hover-item"
                        >
                            <input
                                type="checkbox"
                                checked={includeAdmin}
                                onChange={(e) => setIncludeAdmin(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <div>
                                <div style={{
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text-main)',
                                    marginBottom: '4px'
                                }}>
                                    Включить администратора в распределение
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text-second)'
                                }}>
                                    Админ также получит клиентов для обзвона
                                </div>
                            </div>
                        </label>
                    </div>

                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-second)'
                    }}>
                        Клиенты из выбранных баз будут распределены методом round-robin (по кругу)
                    </p>
                </div>
            </Modal>

            {/* Модальное окно загрузки базы данных */}
            <Modal
                isOpen={showUploadModal}
                onClose={() => {
                    setShowUploadModal(false);
                    setUploadingFile(null);
                    setDatabaseName('');
                    setDatabaseNotes('');
                }}
                title="Загрузка базы данных"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => {
                            setShowUploadModal(false);
                            setUploadingFile(null);
                            setDatabaseName('');
                            setDatabaseNotes('');
                        }}>
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleUpload}
                            disabled={!uploadingFile || !databaseName.trim()}
                        >
                            Загрузить
                        </Button>
                    </>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-main)' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--color-text)'
                        }}>
                            Файл CSV *
                        </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{
                                width: '100%',
                                padding: 'var(--space-sm)',
                                border: '2px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text)',
                                cursor: 'pointer'
                            }}
                        />
                        {uploadingFile && (
                            <div style={{
                                marginTop: 'var(--space-sm)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-accent)'
                            }}>
                                Выбран файл: {uploadingFile.name}
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--color-text)'
                        }}>
                            Название базы *
                        </label>
                        <Input
                            value={databaseName}
                            onChange={(e) => setDatabaseName(e.target.value)}
                            placeholder="Введите название базы"
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 'var(--font-weight-medium)',
                            marginBottom: 'var(--space-sm)',
                            color: 'var(--color-text)'
                        }}>
                            Пометки
                        </label>
                        <textarea
                            value={databaseNotes}
                            onChange={(e) => setDatabaseNotes(e.target.value)}
                            placeholder="Добавьте пометки к базе данных..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: 'var(--space-sm)',
                                border: '2px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text)',
                                fontSize: 'var(--font-size-base)',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
            </Modal>

            {/* Модальное окно статистики базы данных */}
            <Modal
                isOpen={showDatabaseModal}
                onClose={() => {
                    setShowDatabaseModal(false);
                    setSelectedDatabase(null);
                }}
                title={selectedDatabase ? `База данных: ${selectedDatabase.name}` : 'Статистика базы'}
                footer={
                    <>
                        <Button
                            variant="danger"
                            onClick={async () => {
                                if (!selectedDatabase || !confirm('Удалить эту базу данных?')) return;
                                try {
                                    await databaseService.delete(selectedDatabase.id);
                                    toast.success('База данных удалена');
                                    setShowDatabaseModal(false);
                                    setSelectedDatabase(null);
                                    loadDatabases();
                                } catch (error: any) {
                                    toast.error('Ошибка удаления базы данных');
                                }
                            }}
                        >
                            Удалить
                        </Button>
                        <Button variant="secondary" onClick={() => setShowDatabaseModal(false)}>
                            Закрыть
                        </Button>
                    </>
                }
            >
                {selectedDatabase && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-main)' }}>
                        {/* Основная информация */}
                        <div>
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-md)',
                                color: 'var(--color-accent)'
                            }}>
                                Основная информация
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Дата загрузки:</span>
                                    <span style={{ fontWeight: 600 }}>
                                        {new Date(selectedDatabase.upload_date).toLocaleDateString('ru-RU', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Загружено пользователем:</span>
                                    <span style={{ fontWeight: 600 }}>{selectedDatabase.uploaded_by_name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-second)' }}>Файл:</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedDatabase.file_name}</span>
                                </div>
                            </div>
                        </div>

                        {/* Статистика */}
                        <div>
                            <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-md)',
                                color: 'var(--color-accent)'
                            }}>
                                Статистика контактов
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: 'var(--space-md)'
                            }}>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--color-bg)',
                                    border: '2px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                                        {selectedDatabase.total_clients || 0}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-second)', marginTop: 'var(--space-xs)' }}>
                                        Всего контактов
                                    </div>
                                </div>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--color-bg)',
                                    border: '2px solid #10b981',
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                                        {selectedDatabase.new_clients_count ?? 0}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-second)', marginTop: 'var(--space-xs)' }}>
                                        Не прозвонено (новые)
                                    </div>
                                </div>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--color-bg)',
                                    border: '2px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {selectedDatabase.assigned_clients || 0}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-second)', marginTop: 'var(--space-xs)' }}>
                                        Назначено менеджерам
                                    </div>
                                </div>
                                <div style={{
                                    padding: 'var(--space-md)',
                                    background: 'var(--color-bg)',
                                    border: '2px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {((selectedDatabase.total_clients || 0) - (selectedDatabase.new_clients_count ?? 0))}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-second)', marginTop: 'var(--space-xs)' }}>
                                        В работе / обработано
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Пометки */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                marginBottom: 'var(--space-md)',
                                color: 'var(--color-accent)'
                            }}>
                                Пометки
                            </label>
                            <div style={{
                                padding: 'var(--space-md)',
                                background: 'var(--color-bg)',
                                border: '2px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                minHeight: '80px',
                                color: 'var(--color-text-second)',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {selectedDatabase.notes || 'Пометки отсутствуют'}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Модальное окно фильтра */}
            <FilterModal
                isOpen={showFilterModal}
                onClose={() => { setShowFilterModal(false); setEditFilterId(null); }}
                onSave={handleFilterSave}
                editFilterId={editFilterId}
            />
        </>
    );
};
