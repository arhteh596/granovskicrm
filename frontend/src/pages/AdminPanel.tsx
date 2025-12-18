import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Megaphone, Sparkles, SlidersHorizontal, Clock3, Users, Target, Repeat, Play, Pause, Palette, Grid3x3, Plus, Trash2, Columns, Eraser, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Textarea } from '../components/ui';
import { Announcement, AnnouncementTargetType, AnnouncementType, PageVisibilityRule, StatusAction, StatusButton, User } from '../types';
import { statisticsService, uiService, userService } from '../services';
import { useUiStore } from '../store/uiStore';
import { STATUS_BUTTON_ICON_OPTIONS, resolveStatusButtonIcon } from '../utils/statusButtonIcons';

const pageOptions = [
    { key: 'call', label: 'Звонить' },
    { key: 'wiki', label: 'Wiki' },
    { key: 'statistics', label: 'Статистика' },
    { key: 'profile', label: 'Профиль' },
    { key: 'mamonty', label: 'Мамонты' },
    { key: 'katka', label: 'Катка' }
];

const roleOptions = [
    { key: 'manager', label: 'Менеджеры' },
    { key: 'zakryv', label: 'Закрывающие' }
];

const defaultVisibilityMatrix: Record<string, Record<string, boolean>> = {
    manager: {
        call: true,
        wiki: true,
        statistics: true,
        profile: true,
        mamonty: false,
        katka: false
    },
    zakryv: {
        call: true,
        wiki: true,
        statistics: true,
        profile: true,
        mamonty: true,
        katka: true
    }
};

const defaultAnnouncement = {
    title: '',
    message: '',
    type: 'marquee' as AnnouncementType,
    target_type: 'all' as AnnouncementTargetType,
    target_role: 'manager',
    target_user_id: null as number | null,
    repeat_count: 3,
    display_duration_ms: 8000,
    start_at: '',
    end_at: '',
    is_active: true
};

export const AdminPanel: React.FC = () => {
    const [visibilityMatrix, setVisibilityMatrix] = useState<Record<string, Record<string, boolean>>>(defaultVisibilityMatrix);
    const [isLoadingVisibility, setIsLoadingVisibility] = useState(false);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(defaultAnnouncement);
    const [users, setUsers] = useState<User[]>([]);
    const [statusPage, setStatusPage] = useState<'call' | 'wiki'>('call');
    const [newButton, setNewButton] = useState<{
        label: string;
        color: string;
        color_active: string;
        icon: string;
        icon_color: string;
        icon_color_hover: string;
        border_color: string;
        border_color_hover: string;
        action: StatusAction;
    }>({
        label: '',
        color: '#2563eb',
        color_active: '#1d4ed8',
        icon: 'check-circle-2',
        icon_color: '#ffffff',
        icon_color_hover: '#ffffff',
        border_color: 'transparent',
        border_color_hover: 'transparent',
        action: 'set-status'
    });
    const [resetScope, setResetScope] = useState<'day' | 'period' | 'all'>('day');
    const [resetDate, setResetDate] = useState('');
    const [resetStart, setResetStart] = useState('');
    const [resetEnd, setResetEnd] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const {
        statusButtons,
        statusColumns,
        fetchStatusButtons,
        createStatusButton,
        updateStatusButton,
        deleteStatusButton,
        updateStatusColumns
    } = useUiStore();

    useEffect(() => {
        loadVisibility();
        loadAnnouncements();
        loadUsers();
        fetchStatusButtons('call');
        fetchStatusButtons('wiki');
    }, []);

    const loadUsers = async () => {
        try {
            const list = await userService.getAll();
            setUsers(list || []);
        } catch (error) {
            console.error('loadUsers error', error);
        }
    };

    const loadVisibility = async () => {
        try {
            setIsLoadingVisibility(true);
            const response = await uiService.getAllVisibility();
            const rules: PageVisibilityRule[] = response?.rules || [];
            const next: Record<string, Record<string, boolean>> = {
                manager: { ...defaultVisibilityMatrix.manager },
                zakryv: { ...defaultVisibilityMatrix.zakryv }
            };
            rules.forEach((rule) => {
                next[rule.role] = next[rule.role] || {};
                next[rule.role][rule.page_key] = rule.visible;
            });
            setVisibilityMatrix(next);
        } catch (error) {
            console.error('loadVisibility error', error);
            toast.error('Не удалось загрузить правила видимости');
        } finally {
            setIsLoadingVisibility(false);
        }
    };

    const loadAnnouncements = async () => {
        try {
            setIsLoadingAnnouncements(true);
            const response = await uiService.listAnnouncements();
            setAnnouncements(response?.items || []);
        } catch (error) {
            console.error('loadAnnouncements error', error);
            toast.error('Не удалось загрузить объявления');
        } finally {
            setIsLoadingAnnouncements(false);
        }
    };

    const handleToggle = async (role: string, pageKey: string, current: boolean) => {
        const nextVisible = !current;
        setVisibilityMatrix((prev) => ({
            ...prev,
            [role]: { ...(prev[role] || {}), [pageKey]: nextVisible }
        }));
        try {
            await uiService.upsertVisibility({ role, page_key: pageKey, visible: nextVisible });
            toast.success('Сохранено');
        } catch (error) {
            toast.error('Не удалось сохранить');
            // rollback
            setVisibilityMatrix((prev) => ({
                ...prev,
                [role]: { ...(prev[role] || {}), [pageKey]: current }
            }));
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        setForm(defaultAnnouncement);
        setIsModalOpen(true);
    };

    const openEditModal = (item: Announcement) => {
        setEditingId(item.id);
        setForm({
            title: item.title,
            message: item.message,
            type: item.type,
            target_type: item.target_type,
            target_role: item.target_role || 'manager',
            target_user_id: item.target_user_id || null,
            repeat_count: item.repeat_count,
            display_duration_ms: item.display_duration_ms,
            start_at: item.start_at ? item.start_at.slice(0, 16) : '',
            end_at: item.end_at ? item.end_at.slice(0, 16) : '',
            is_active: item.is_active
        });
        setIsModalOpen(true);
    };

    const handleSaveAnnouncement = async () => {
        if (!form.title.trim() || !form.message.trim()) {
            toast.error('Заполните заголовок и текст');
            return;
        }

        const payload = {
            ...form,
            target_user_id: form.target_type === 'user' ? form.target_user_id : null,
            target_role: form.target_type === 'role' ? form.target_role : null,
            start_at: form.start_at ? new Date(form.start_at) : undefined,
            end_at: form.end_at ? new Date(form.end_at) : null
        };

        try {
            if (editingId) {
                await uiService.updateAnnouncement(editingId, payload);
                toast.success('Объявление обновлено');
            } else {
                await uiService.createAnnouncement(payload);
                toast.success('Объявление создано');
            }
            setIsModalOpen(false);
            setEditingId(null);
            setForm(defaultAnnouncement);
            loadAnnouncements();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Не удалось сохранить');
        }
    };

    const handleStatusToggle = async (id: number, isActive: boolean) => {
        try {
            await uiService.setAnnouncementStatus(id, !isActive);
            loadAnnouncements();
        } catch (error) {
            toast.error('Не удалось обновить статус');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить объявление?')) return;
        try {
            await uiService.deleteAnnouncement(id);
            loadAnnouncements();
            toast.success('Удалено');
        } catch (error) {
            toast.error('Не удалось удалить');
        }
    };

    const handleStatusUpdate = async (id: number, patch: Partial<StatusButton>) => {
        try {
            await updateStatusButton(id, patch);
            await fetchStatusButtons(statusPage);
            toast.success('Кнопка сохранена');
        } catch (error: any) {
            console.error('handleStatusUpdate error', error);
            toast.error(error?.response?.data?.message || 'Не удалось сохранить кнопку');
        }
    };

    const handleAddStatusButton = async () => {
        if (!newButton.label.trim()) {
            toast.error('Введите название статуса');
            return;
        }
        try {
            await createStatusButton({ page: statusPage, ...newButton });
            await fetchStatusButtons(statusPage);
            setNewButton({
                label: '',
                color: '#2563eb',
                color_active: '#1d4ed8',
                icon: 'check-circle-2',
                icon_color: '#ffffff',
                icon_color_hover: '#ffffff',
                border_color: 'transparent',
                border_color_hover: 'transparent',
                action: 'set-status'
            });
            toast.success('Кнопка добавлена');
        } catch (error: any) {
            console.error('handleAddStatusButton error', error);
            toast.error(error?.response?.data?.message || 'Не удалось добавить кнопку');
        }
    };

    const handleDeleteStatusButton = async (id: number) => {
        if (!confirm('Удалить кнопку?')) return;
        try {
            await deleteStatusButton(id, statusPage);
            await fetchStatusButtons(statusPage);
            toast.success('Кнопка удалена');
        } catch (error: any) {
            console.error('handleDeleteStatusButton error', error);
            toast.error(error?.response?.data?.message || 'Не удалось удалить кнопку');
        }
    };

    const handleColumnsChange = async (page: 'call' | 'wiki', columns: number) => {
        try {
            await updateStatusColumns(page, columns);
            await fetchStatusButtons(page);
            toast.success('Сетка обновлена');
        } catch (error: any) {
            console.error('handleColumnsChange error', error);
            toast.error(error?.response?.data?.message || 'Не удалось обновить сетку');
        }
    };

    const handleResetStats = async () => {
        if (resetScope === 'day' && !resetDate) {
            toast.error('Укажите дату');
            return;
        }

        if (resetScope === 'period' && (!resetStart || !resetEnd)) {
            toast.error('Укажите период');
            return;
        }

        const confirmText = resetScope === 'all'
            ? 'Удалить всю статистику звонков?'
            : resetScope === 'day'
                ? `Удалить статистику за ${resetDate}?`
                : `Удалить статистику с ${resetStart} по ${resetEnd}?`;

        if (!confirm(confirmText)) return;

        setIsResetting(true);
        try {
            const payload: any = { scope: resetScope };
            if (resetScope === 'day') payload.date = resetDate;
            if (resetScope === 'period') {
                payload.start_date = resetStart;
                payload.end_date = resetEnd;
            }

            const response = await statisticsService.resetStatistics(payload);
            const deleted = response?.deleted ?? 0;
            toast.success(`Удалено записей: ${deleted}`);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Не удалось обнулить статистику');
        } finally {
            setIsResetting(false);
        }
    };

    const activeTickerPreview = useMemo(
        () => announcements.filter((a) => a.type === 'marquee' && a.is_active),
        [announcements]
    );

    const actionOptions: { value: StatusAction; label: string }[] = [
        { value: 'set-status', label: 'Простой статус' },
        { value: 'callback', label: 'Открывает перезвон' },
        { value: 'transfer', label: 'Открывает передачу' }
    ];

    const IconPicker: React.FC<{ value: string; onChange: (next: string) => void }> = ({ value, onChange }) => {
        const [open, setOpen] = useState(false);
        const rootRef = useRef<HTMLDivElement | null>(null);

        useEffect(() => {
            const handler = (e: MouseEvent) => {
                if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                    setOpen(false);
                }
            };
            document.addEventListener('click', handler);
            return () => document.removeEventListener('click', handler);
        }, []);

        const current = STATUS_BUTTON_ICON_OPTIONS.find((o) => o.value === (value as any));
        const CurrentIcon = resolveStatusButtonIcon({ iconKey: value, fallbackIconKey: 'check-circle-2' });
        const currentLabel = current?.label || value || 'Иконка';

        return (
            <div ref={rootRef} style={{ position: 'relative' }}>
                <button
                    type="button"
                    className="input-field"
                    onClick={() => setOpen((v) => !v)}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <CurrentIcon size={16} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentLabel}</span>
                    </span>
                    <ChevronDown size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
                </button>

                {open && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            border: '1px solid var(--color-border)',
                            borderRadius: '14px',
                            background: 'var(--color-bg-card)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '10px',
                            maxHeight: '260px',
                            overflow: 'auto'
                        }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {STATUS_BUTTON_ICON_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    style={{
                                        border: opt.value === value ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                                        background: opt.value === value ? 'rgba(37, 99, 235, 0.10)' : 'transparent',
                                        color: 'var(--color-text-main)',
                                        borderRadius: '12px',
                                        padding: '10px 8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    title={opt.label}
                                >
                                    <opt.Icon size={18} />
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-second)', lineHeight: 1.1, textAlign: 'center' }}>
                                        {opt.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const currentButtons: StatusButton[] = statusButtons[statusPage] || [];
    const currentColumns = statusColumns[statusPage] || 4;

    return (
        <div className="main-container">
            <div className="card page-header" style={{ alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <SlidersHorizontal size={22} />
                    <h2 style={{ margin: 0 }}>Админка</h2>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant="secondary" onClick={loadVisibility} disabled={isLoadingVisibility}>Обновить правила</Button>
                    <Button variant="secondary" onClick={loadAnnouncements} disabled={isLoadingAnnouncements}>Обновить объявления</Button>
                    <Button onClick={openCreateModal} variant="primary"><Megaphone size={18} style={{ marginRight: 6 }} /> Новое объявление</Button>
                </div>
            </div>

            {/* Reset statistics */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Eraser size={18} />
                        <h3 style={{ margin: 0 }}>Обнулить статистику</h3>
                    </div>
                    {isResetting && <span style={{ color: 'var(--color-text-second)' }}>Выполняем...</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { value: 'day', label: 'День' },
                            { value: 'period', label: 'Период' },
                            { value: 'all', label: 'Всё время' }
                        ].map((opt) => (
                            <label
                                key={opt.value}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 10px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    background: resetScope === opt.value ? 'rgba(37, 99, 235, 0.08)' : 'var(--color-bg-card)'
                                }}
                            >
                                <input
                                    type="radio"
                                    checked={resetScope === opt.value}
                                    onChange={() => setResetScope(opt.value as 'day' | 'period' | 'all')}
                                />
                                <span>{opt.label}</span>
                            </label>
                        ))}
                    </div>

                    {resetScope === 'day' && (
                        <Input
                            label="Дата"
                            type="date"
                            value={resetDate}
                            onChange={(e) => setResetDate(e.target.value)}
                        />
                    )}

                    {resetScope === 'period' && (
                        <>
                            <Input
                                label="Дата от"
                                type="date"
                                value={resetStart}
                                onChange={(e) => setResetStart(e.target.value)}
                            />
                            <Input
                                label="Дата до"
                                type="date"
                                value={resetEnd}
                                onChange={(e) => setResetEnd(e.target.value)}
                            />
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-second)', fontSize: '12px' }}>Удаляются записи из журнала звонков за выбранный диапазон.</span>
                    <Button variant="danger" onClick={handleResetStats} disabled={isResetting}>Обнулить</Button>
                </div>
            </div>

            {/* Visibility block */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Eye size={18} />
                        <h3 style={{ margin: 0 }}>Видимость страниц для ролей</h3>
                    </div>
                    {isLoadingVisibility && <span style={{ color: 'var(--color-text-second)' }}>Загрузка...</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {roleOptions.map((role) => (
                        <div key={role.key} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '16px', background: 'var(--color-bg-card)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Users size={18} />
                                <strong>{role.label}</strong>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                {pageOptions.map((page) => {
                                    const visible = visibilityMatrix[role.key]?.[page.key] ?? true;
                                    return (
                                        <button
                                            key={`${role.key}-${page.key}`}
                                            onClick={() => handleToggle(role.key, page.key, visible)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px 14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--color-border)',
                                                background: visible ? 'rgba(72, 187, 120, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                                color: 'var(--color-text-main)',
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                        >
                                            <span style={{ fontWeight: 600 }}>{page.label}</span>
                                            {visible ? <Eye size={18} /> : <EyeOff size={18} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Status buttons */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Palette size={18} />
                        <h3 style={{ margin: 0 }}>Кнопки статусов</h3>
                        <span style={{ color: 'var(--color-text-second)', fontSize: '12px' }}>Отдельные настройки для «Звонить» и «Wiki»</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(['call', 'wiki'] as const).map((pageKey) => (
                            <Button
                                key={pageKey}
                                variant={statusPage === pageKey ? 'primary' : 'secondary'}
                                onClick={() => setStatusPage(pageKey)}
                            >
                                <Grid3x3 size={16} style={{ marginRight: 6 }} />
                                {pageKey === 'call' ? 'Звонить' : 'Wiki'}
                            </Button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Columns size={16} />
                    <span style={{ color: 'var(--color-text-second)' }}>Столбцов</span>
                    <select
                        className="input-field"
                        style={{ maxWidth: '140px' }}
                        value={currentColumns}
                        onChange={(e) => handleColumnsChange(statusPage, Number(e.target.value))}
                    >
                        {[2, 3, 4].map((col) => (
                            <option key={col} value={col}>{col}</option>
                        ))}
                    </select>
                </div>

                {currentButtons.length === 0 ? (
                    <div style={{ color: 'var(--color-text-second)', padding: '10px' }}>Нет кнопок для этой страницы</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        {currentButtons.map((btn) => (
                            <div
                                key={btn.id}
                                style={{
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '14px',
                                    padding: '14px',
                                    background: 'var(--color-bg-card)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 700, lineHeight: 1 }}>{btn.label}</span>
                                        <span style={{ color: 'var(--color-text-second)', fontSize: '12px' }}>{btn.status_value}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: 'var(--color-text-second)', fontSize: '12px' }}>Порядок</span>
                                            <input
                                                type="number"
                                                min={1}
                                                className="input-field"
                                                style={{ width: '70px', textAlign: 'center' }}
                                                defaultValue={btn.position}
                                                key={`pos-${btn.id}-${btn.position}`}
                                                onBlur={(e) => {
                                                    const val = Number(e.target.value);
                                                    if (val !== btn.position && val >= 1) {
                                                        handleStatusUpdate(btn.id, { position: val });
                                                    }
                                                }}
                                            />
                                        </div>
                                        <Button size="sm" variant="danger" className="btn-icon" onClick={() => handleDeleteStatusButton(btn.id)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>

                                <Input
                                    key={`label-${btn.id}-${btn.label}`}
                                    label="Название"
                                    defaultValue={btn.label}
                                    onBlur={(e) => {
                                        const value = e.target.value.trim();
                                        if (value && value !== btn.label) {
                                            handleStatusUpdate(btn.id, { label: value, status_value: value });
                                        }
                                    }}
                                />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="color"
                                                defaultValue={btn.color}
                                                key={`color-${btn.id}-${btn.color}`}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value && value !== btn.color) {
                                                        handleStatusUpdate(btn.id, { color: value });
                                                    }
                                                }}
                                                style={{ width: '52px', height: '36px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                                            />
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-second)' }}>{btn.color}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет при наведении (hover)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="color"
                                                defaultValue={btn.color_active || btn.color}
                                                key={`color-active-${btn.id}-${btn.color_active || btn.color}`}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value && value !== btn.color_active) {
                                                        handleStatusUpdate(btn.id, { color_active: value });
                                                    }
                                                }}
                                                style={{ width: '52px', height: '36px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                                            />
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-second)' }}>{btn.color_active || btn.color}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет иконки</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="color"
                                                defaultValue={btn.icon_color || '#ffffff'}
                                                key={`icon-color-${btn.id}-${btn.icon_color || '#ffffff'}`}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value && value !== btn.icon_color) {
                                                        handleStatusUpdate(btn.id, { icon_color: value });
                                                    }
                                                }}
                                                style={{ width: '52px', height: '36px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                                            />
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-second)' }}>{btn.icon_color || '#ffffff'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет иконки (hover)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="color"
                                                defaultValue={btn.icon_color_hover || btn.icon_color || '#ffffff'}
                                                key={`icon-color-hover-${btn.id}-${btn.icon_color_hover || btn.icon_color || '#ffffff'}`}
                                                onBlur={(e) => {
                                                    const value = e.target.value;
                                                    if (value && value !== btn.icon_color_hover) {
                                                        handleStatusUpdate(btn.id, { icon_color_hover: value });
                                                    }
                                                }}
                                                style={{ width: '52px', height: '36px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                                            />
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-second)' }}>{btn.icon_color_hover || btn.icon_color || '#ffffff'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Рамка</label>
                                        <input
                                            className="input-field"
                                            defaultValue={btn.border_color || 'transparent'}
                                            key={`border-${btn.id}-${btn.border_color || 'transparent'}`}
                                            onBlur={(e) => {
                                                const value = e.target.value.trim() || 'transparent';
                                                if (value !== (btn.border_color || 'transparent')) {
                                                    handleStatusUpdate(btn.id, { border_color: value });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Рамка (hover)</label>
                                        <input
                                            className="input-field"
                                            defaultValue={btn.border_color_hover || btn.border_color || 'transparent'}
                                            key={`border-hover-${btn.id}-${btn.border_color_hover || btn.border_color || 'transparent'}`}
                                            onBlur={(e) => {
                                                const value = e.target.value.trim() || 'transparent';
                                                if (value !== (btn.border_color_hover || btn.border_color || 'transparent')) {
                                                    handleStatusUpdate(btn.id, { border_color_hover: value });
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Иконка</label>
                                        <IconPicker value={btn.icon || 'check-circle-2'} onChange={(v) => handleStatusUpdate(btn.id, { icon: v })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Действие</label>
                                        <select
                                            className="input-field"
                                            defaultValue={btn.action}
                                            onChange={(e) => handleStatusUpdate(btn.id, { action: e.target.value as StatusAction })}
                                        >
                                            {actionOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', alignItems: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <Input
                        label="Новая кнопка"
                        placeholder="Название"
                        value={newButton.label}
                        onChange={(e) => setNewButton((prev) => ({ ...prev, label: e.target.value }))}
                    />
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет</label>
                        <input
                            type="color"
                            value={newButton.color}
                            onChange={(e) => setNewButton((prev) => ({ ...prev, color: e.target.value }))}
                            style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет при наведении (hover)</label>
                        <input
                            type="color"
                            value={newButton.color_active}
                            onChange={(e) => setNewButton((prev) => ({ ...prev, color_active: e.target.value }))}
                            style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Иконка</label>
                        <IconPicker value={newButton.icon} onChange={(v) => setNewButton((prev) => ({ ...prev, icon: v }))} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет иконки</label>
                        <input
                            type="color"
                            value={newButton.icon_color}
                            onChange={(e) => setNewButton((prev) => ({ ...prev, icon_color: e.target.value }))}
                            style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Цвет иконки (hover)</label>
                        <input
                            type="color"
                            value={newButton.icon_color_hover}
                            onChange={(e) => setNewButton((prev) => ({ ...prev, icon_color_hover: e.target.value }))}
                            style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
                        />
                    </div>
                    <Input
                        label="Рамка"
                        placeholder="transparent или #RRGGBB"
                        value={newButton.border_color}
                        onChange={(e) => setNewButton((prev) => ({ ...prev, border_color: e.target.value }))}
                    />
                    <Input
                        label="Рамка (hover)"
                        placeholder="transparent или #RRGGBB"
                        value={newButton.border_color_hover}
                        onChange={(e) => setNewButton((prev) => ({ ...prev, border_color_hover: e.target.value }))}
                    />
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Действие</label>
                        <select
                            className="input-field"
                            value={newButton.action}
                            onChange={(e) => setNewButton((prev) => ({ ...prev, action: e.target.value as StatusAction }))}
                        >
                            {actionOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={handleAddStatusButton}>
                        <Plus size={16} style={{ marginRight: 6 }} /> Добавить кнопку
                    </Button>
                </div>
            </div>

            {/* Announcements */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Megaphone size={18} />
                    <h3 style={{ margin: 0 }}>Объявления</h3>
                    {isLoadingAnnouncements && <span style={{ color: 'var(--color-text-second)' }}>Загрузка...</span>}
                </div>

                {activeTickerPreview.length > 0 && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px dashed var(--color-border)',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--color-text-second)' }}>
                            <Sparkles size={16} />
                            <span>Превью бегущей строки</span>
                        </div>
                        <div style={{ position: 'relative', height: '32px' }}>
                            <style>{`
                                @keyframes tickerFlow { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
                            `}</style>
                            <div style={{
                                position: 'absolute',
                                whiteSpace: 'nowrap',
                                animation: 'tickerFlow 18s linear infinite',
                                color: 'var(--color-accent)',
                                fontWeight: 600
                            }}>
                                {activeTickerPreview.map((item) => `${item.title}: ${item.message}`).join(' • ')}
                            </div>
                        </div>
                    </div>
                )}

                {announcements.length === 0 && !isLoadingAnnouncements ? (
                    <div style={{ padding: '12px', color: 'var(--color-text-second)' }}>Нет активных объявлений</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                        {announcements.map((item) => (
                            <div key={item.id} style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: '14px',
                                padding: '14px',
                                background: 'var(--color-bg-card)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                boxShadow: 'var(--shadow-main)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '10px', background: item.type === 'marquee' ? 'rgba(59,130,246,0.15)' : 'rgba(236,72,153,0.15)', color: item.type === 'marquee' ? '#3b82f6' : '#ec4899', fontSize: '12px' }}>
                                            {item.type === 'marquee' ? 'Бегущая строка' : 'Всплывающее'}
                                        </span>
                                        <span style={{ color: 'var(--color-text-second)', fontSize: '12px' }}>
                                            {item.target_type === 'all' ? 'Все' : item.target_type === 'role' ? `Роль: ${item.target_role}` : 'Конкретный пользователь'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button size="sm" variant="secondary" onClick={() => openEditModal(item)}>Ред.</Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleStatusToggle(item.id, item.is_active)}>
                                            {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDelete(item.id)}>Удалить</Button>
                                    </div>
                                </div>
                                <h4 style={{ margin: 0 }}>{item.title}</h4>
                                <p style={{ margin: 0, color: 'var(--color-text-second)' }}>{item.message}</p>
                                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: 'var(--color-text-second)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Repeat size={14} />{item.repeat_count}x</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock3 size={14} />{Math.round(item.display_duration_ms / 1000)}c</div>
                                    {item.start_at && <div>с {new Date(item.start_at).toLocaleString('ru-RU')}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Редактировать объявление' : 'Новое объявление'}
                size="lg"
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    <Input
                        label="Заголовок"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Тип</label>
                        <select
                            className="input-field"
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value as AnnouncementType })}
                        >
                            <option value="marquee">Бегущая строка</option>
                            <option value="popup">Всплывающее</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Назначение</label>
                        <select
                            className="input-field"
                            value={form.target_type}
                            onChange={(e) => setForm({ ...form, target_type: e.target.value as AnnouncementTargetType })}
                        >
                            <option value="all">Все пользователи</option>
                            <option value="role">Определённая роль</option>
                            <option value="user">Конкретный пользователь</option>
                        </select>
                    </div>
                    {form.target_type === 'role' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Роль</label>
                            <select
                                className="input-field"
                                value={form.target_role}
                                onChange={(e) => setForm({ ...form, target_role: e.target.value })}
                            >
                                {roleOptions.map((r) => (
                                    <option key={r.key} value={r.key}>{r.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {form.target_type === 'user' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-second)', fontSize: '12px' }}>Пользователь</label>
                            <select
                                className="input-field"
                                value={form.target_user_id || ''}
                                onChange={(e) => setForm({ ...form, target_user_id: Number(e.target.value) })}
                            >
                                <option value="">Выберите пользователя</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Input
                        label="Повторов"
                        type="number"
                        min={1}
                        value={form.repeat_count}
                        onChange={(e) => setForm({ ...form, repeat_count: Number(e.target.value) })}
                    />
                    <Input
                        label="Длительность, мс"
                        type="number"
                        min={1000}
                        value={form.display_duration_ms}
                        onChange={(e) => setForm({ ...form, display_duration_ms: Number(e.target.value) })}
                    />
                    <Input
                        label="Старт"
                        type="datetime-local"
                        value={form.start_at}
                        onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                    />
                    <Input
                        label="Завершение"
                        type="datetime-local"
                        value={form.end_at}
                        onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                            id="announcement-active"
                        />
                        <label htmlFor="announcement-active">Активно</label>
                    </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                    <Textarea
                        label="Текст"
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Отмена</Button>
                    <Button onClick={handleSaveAnnouncement}>{editingId ? 'Сохранить' : 'Создать'}</Button>
                </div>
            </Modal>
        </div>
    );
};
