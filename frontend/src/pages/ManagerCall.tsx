import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Phone, Users as UsersIcon, Copy, ExternalLink, User as UserIcon, Globe, X, XCircle, Building,
    Calendar, Mail, ChevronDown, ChevronUp, Loader, ServerCrash, Car,
    Voicemail, Bot, Clock, UserPlus, ArrowRightCircle, Info, Briefcase, Wallet, Link as LinkIcon,
    PhoneMissed, AlertCircle, UserX, PhoneForwarded, CheckCircle2, Shield, CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotificationsStore } from '../store/notificationsStore';
import { Button, Textarea } from '../components/ui';
import { TelegramAuthForm } from '../components/TelegramAuth';
import { clientService, userService } from '../services';
import { Client, User } from '../types';
import { useUiStore } from '../store/uiStore';
import { resolveStatusButtonIcon } from '../utils/statusButtonIcons';
import './manager-call.css';

// Адаптивный хук
const useResponsive = () => {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const isMobile = windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1024;
    const isCompact = windowWidth < 1200; // Для 30-40% ширины экрана
    const isVerySmall = windowWidth < 480;
    
    return { isMobile, isTablet, isCompact, isVerySmall, windowWidth };
};

const DEFAULT_STATUS_BUTTONS = [
    { status: 'не дозвон', color: '#4b5563', icon: 'phone-missed', action: 'set-status' as const },
    { status: 'автоответчик', color: '#2563eb', icon: 'voicemail', action: 'set-status' as const },
    { status: 'питон', color: '#d97706', icon: 'bot', action: 'set-status' as const },
    { status: 'срез', color: '#dc2626', icon: 'alert-circle', action: 'set-status' as const },
    { status: 'другой человек', color: '#7c3aed', icon: 'user-x', action: 'set-status' as const },
    { status: 'перезвон', color: '#0ea5e9', icon: 'phone-forwarded', action: 'callback' as const },
    { status: 'передать', color: '#d4af37', icon: 'user-plus', action: 'transfer' as const },
    { status: 'взял код', color: '#059669', icon: 'check-circle-2', action: 'set-status' as const }
];

const STATUS_VALUE_FALLBACK_ICON_KEY: Record<string, string> = {
    'не дозвон': 'phone-missed',
    'автоответчик': 'voicemail',
    'питон': 'bot',
    'срез': 'alert-circle',
    'другой человек': 'user-x',
    'перезвон': 'phone-forwarded',
    'передать': 'user-plus',
    'взял код': 'check-circle-2'
};

// Извлекаем список источников из *_data полей разного формата
const parseSources = (raw?: string | null): string[] => {
    if (!raw) return [];
    const items = String(raw).split(/;\s*/).filter(Boolean);
    const set = new Set<string>();
    for (const part of items) {
        // patterns: "source:field" | "platform=vk|..." | "sources=a;b"
        const srcMatch = part.match(/sources=([^|]+)/i);
        if (srcMatch) {
            srcMatch[1].split(/[;,]/).map(s => s.trim()).filter(Boolean).forEach(s => set.add(s));
            continue;
        }
        const platformMatch = part.match(/platform=([a-z0-9_]+)/i);
        if (platformMatch) {
            set.add(platformMatch[1]);
            continue;
        }
        const beforeColon = part.split(':')[0]?.trim();
        if (beforeColon && beforeColon.length < 40) set.add(beforeColon);
    }
    return Array.from(set);
};

const Chip: React.FC<{ children: React.ReactNode; icon?: React.ElementType } & React.HTMLAttributes<HTMLSpanElement>> = ({ children, icon: Icon, className = '', ...rest }) => (
    <span className={`chip ${className}`} {...rest}>
        {Icon && <Icon size={12} style={{ marginRight: '4px', opacity: 0.7 }} />}
        {children}
    </span>
);

const SourceTags: React.FC<{ source?: string | string[] | null; className?: string; style?: React.CSSProperties }> = ({ source, className = '', style }) => {
    const [expanded, setExpanded] = useState(false);
    const tags = useMemo(() => {
        if (!source) return [] as string[];
        if (Array.isArray(source)) return source;
        return parseSources(source);
    }, [source]);
    if (!tags.length) return null;

    const allSources = tags.join(', ');

    return (
        <span
            className={`tags-inline ${expanded ? 'expanded' : ''} ${className}`}
            title={allSources}
            style={style}
        >
            {(expanded ? tags : tags).map((t) => (
                <Chip key={t} title={allSources}>{t}</Chip>
            ))}
            {tags.length > 1 && (
                <button
                    className="expand-button-inline"
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    title={expanded ? "Свернуть" : "Показать все источники"}
                >
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            )}
        </span>
    );
};

const FieldRow: React.FC<{
    label: string;
    value?: React.ReactNode;
    valueMono?: boolean;
    sources?: string | string[] | null;
    copy?: string | null;
    actionsRight?: React.ReactNode;
    icon?: React.ElementType;
    style?: React.CSSProperties;
    className?: string;
}> = ({ label, value, valueMono, sources, copy, actionsRight, icon: Icon, style, className }) => {
    if (!value && !copy) return null;
    return (
        <div className={`field-row ${className || ''}`} style={style}>
            <div className="field-label">
                {Icon && <Icon size={16} className="field-icon" style={{ color: 'var(--color-accent)' }} />}
                <span>{label}</span>
            </div>
            <div className="field-value-container">
                {value && (
                    <span className={`field-value ${valueMono ? 'mono' : ''}`}>{value}</span>
                )}
                <SourceTags source={sources} />
            </div>
            <div className="field-actions">
                {actionsRight}
                {copy && (
                    <button
                        className="copy-button"
                        onClick={() => navigator.clipboard.writeText(copy).then(() => toast.success('Скопировано'))}
                        title="Скопировать"
                    >
                        <Copy size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export const ManagerCall: React.FC<{ mode?: 'default' | 'wiki' }> = ({ mode = 'default' }) => {
    const { addNotification } = useNotificationsStore();
    const { isMobile, isTablet, isCompact, isVerySmall } = useResponsive();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState('');
    const [managers, setManagers] = useState<User[]>([]);
    const [selectedManager, setSelectedManager] = useState<number | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showCallbackModal, setShowCallbackModal] = useState(false);
    const [showVehicles, setShowVehicles] = useState(false);
    const [showSocial, setShowSocial] = useState(false);
    const [showRelatives, setShowRelatives] = useState(false);
    const [showTelegramAuth, setShowTelegramAuth] = useState(false);
    const location = useLocation();
    const [forcedClientId, setForcedClientId] = useState<number | null>(null);
    const { statusButtons, statusColumns, fetchStatusButtons } = useUiStore();
    const statusPage = mode === 'wiki' ? 'wiki' : 'call';

    // Состояния для перезвона
    const [callbackDate, setCallbackDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState('');
    const [callbackNotes, setCallbackNotes] = useState('');

    useEffect(() => {
        // Если передан clientId в query, загружаем именно этого клиента
        const params = new URLSearchParams(location.search);
        const idParam = params.get('clientId');
        if (idParam) {
            const id = Number(idParam);
            if (!Number.isNaN(id) && id > 0) {
                setForcedClientId(id);
                loadClientById(id);
            } else {
                loadNextClient();
            }
        } else {
            loadNextClient();
        }
        loadManagers();
        fetchStatusButtons(statusPage);
    }, [statusPage]);

    const loadClientById = async (id: number) => {
        setIsLoading(true);
        try {
            const data = await clientService.getById(id);
            setClient(data || null);
            setNotes('');
        } catch (error: any) {
            toast.error('Ошибка загрузки клиента по ID');
        } finally {
            setIsLoading(false);
        }
    };

    const loadNextClient = async () => {
        setIsLoading(true);
        try {
            const clientData = mode === 'wiki' ? (await clientService.getNextWiki())?.client : await clientService.getNext();
            setClient(clientData || null);
            setNotes('');
        } catch (error: any) {
            toast.error('Ошибка загрузки клиента');
        } finally {
            setIsLoading(false);
        }
    };

    const loadManagers = async () => {
        try {
            const users = await userService.getAll();
            setManagers((users || []).filter((u: User) => u.role === 'manager'));
        } catch (error: any) {
            console.error('Ошибка загрузки менеджеров:', error);
        }
    };

    const statusButtonList = useMemo(() => {
        const list = statusButtons[statusPage] || [];
        if (list.length) return [...list].sort((a, b) => (a.position || 0) - (b.position || 0));
        return DEFAULT_STATUS_BUTTONS.map((btn, idx) => ({
            id: idx + 1,
            page: statusPage,
            label: btn.status,
            status_value: btn.status,
            color: btn.color,
            icon: btn.icon,
            action: btn.action,
            position: idx + 1
        }));
    }, [statusButtons, statusPage]);

    const statusColumnsCount = useMemo(() => {
        const cols = statusColumns[statusPage] || 4;
        return Math.min(4, Math.max(2, cols));
    }, [statusColumns, statusPage]);

    const handleCallStatus = async (status: string) => {
        if (!client) return;

        console.log(`[ManagerCall] Setting status "${status}" for client ID: ${client.id}`);

        if (status === 'передать') {
            setShowTransferModal(true);
            return;
        }

        if (status === 'перезвон') {
            setShowCallbackModal(true);
            return;
        }

        try {
            console.log(`[ManagerCall] Calling updateStatus API...`);
            const response = await clientService.updateStatus(client.id, status, notes || undefined);
            console.log(`[ManagerCall] Status updated successfully:`, response);
            toast.success(`Статус "${status}" установлен`);
            if (status === 'перезвон') {
                addNotification({ title: 'Клиент на перезвон', message: `${client.ceo_name || client.company_name}` });
            }
            console.log(`[ManagerCall] Loading next client...`);
            // Если клиент был принудительно открыт (возвращён "в работу"), после действия сбрасываем принудительную привязку
            if (forcedClientId) {
                setForcedClientId(null);
            }
            loadNextClient();
        } catch (error: any) {
            console.error(`[ManagerCall] Error updating status:`, error);
            toast.error(error.response?.data?.message || 'Ошибка обновления статуса');
        }
    };

    const handleTransfer = async () => {
        if (!client || !selectedManager) return;
        try {
            console.log(`[ManagerCall] Transferring client ID: ${client.id} to manager ID: ${selectedManager}`);
            const response = await clientService.transferToUser(client.id, selectedManager, notes || undefined);
            console.log(`[ManagerCall] Client transferred successfully:`, response);
            toast.success('Клиент передан');
            setShowTransferModal(false);
            setSelectedManager(null);
            setNotes('');
            if (forcedClientId) setForcedClientId(null);
            loadNextClient();
        } catch (error: any) {
            console.error(`[ManagerCall] Error transferring client:`, error);
            toast.error(error.response?.data?.message || 'Ошибка передачи');
        }
    };

    const handleSaveCallback = async () => {
        if (!client || !selectedTime) {
            toast.error('Выберите время перезвона');
            return;
        }

        try {
            // Формируем дату и время
            const [hours, minutes] = selectedTime.split(':');
            const callbackDateTime = new Date(callbackDate);
            callbackDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            console.log(`[ManagerCall] Setting callback for client ID: ${client.id}`);
            const response = await clientService.setCallback(
                client.id,
                callbackDateTime.toISOString(),
                callbackNotes || undefined
            );

            console.log(`[ManagerCall] Callback set successfully:`, response);
            toast.success('Перезвон назначен');
            setShowCallbackModal(false);
            setSelectedTime('');
            setCallbackNotes('');
            setCallbackDate(new Date());
            if (forcedClientId) setForcedClientId(null);
            loadNextClient();
        } catch (error: any) {
            console.error(`[ManagerCall] Error setting callback:`, error);
            toast.error(error.response?.data?.message || 'Ошибка назначения перезвона');
        }
    };

    const handleMakeSipCall = (phoneOverride?: string) => {
        const number = phoneOverride || client?.phone;
        if (!client || !number) {
            toast.error('Нет номера телефона');
            return;
        }
        // Убираем все кроме цифр (без + и без @sip.domain.com)
        const cleanPhone = String(number).replace(/[^\d]/g, '');
        const sipUri = `sip:${cleanPhone}`;
        window.location.href = sipUri;
        toast.success(<>Звонок на <b>{cleanPhone}</b> отправлен в MicroSIP</>, { icon: <Phone size={16} /> });
    };

    // Специфичная для Wiki раскладка: карточка частного лица в структурированном виде
    if (!isLoading && mode === 'wiki' && client) {
        const tagsRaw = (client as any).tags as string | null | undefined;
        const extractTagValues = (key: string): string[] => {
            if (!tagsRaw) return [];
            const values: string[] = [];
            const re = new RegExp(`${key}=([^;|]+)`, 'gi');
            let m: RegExpExecArray | null;
            while ((m = re.exec(tagsRaw)) !== null) {
                const v = (m[1] || '').trim();
                if (v) values.push(v);
            }
            return values;
        };
        const extractTagValue = (key: string): string | undefined => extractTagValues(key)[0];

        const extraPhones = extractTagValues('extra_phone');
        const birthplace = extractTagValue('birthplace');

        // Строгое соответствие колонкам CSV: телефон1..4 из явных полей, телефон5..7 из тегов extra_phone
        const p1 = (client as any).phone || undefined;
        const p2 = (client as any).phone1 || undefined;
        const p3 = (client as any).phone2 || undefined;
        const p4 = (client as any).phone3 || undefined;
        const p5 = extraPhones[0] || undefined;
        const p6 = extraPhones[1] || undefined;
        const p7 = extraPhones[2] || undefined;

        const a1 = (client as any).address || undefined;
        const a2 = (client as any).address1 || undefined;
        const a3 = (client as any).address2 || undefined;
        const a4 = (client as any).address3 || undefined;
        const a5 = (client as any).address4 || undefined;

        // Email-поля не используются в Wiki карточке, не объявляем локальные переменные чтобы избежать TS warnings

        const showCallButton = (v?: string) => v && (
            <button
                className="call-button"
                title="Набрать"
                onClick={() => handleMakeSipCall(v)}
            >
                <Phone size={14} />
            </button>
        );

        // Helper to render a field only if value exists
        const RenderField = ({ label, value, icon, copy, actions, mono }: any) => {
            if (!value) return null;
            return (
                <FieldRow
                    label={label}
                    value={value}
                    valueMono={mono}
                    icon={icon}
                    copy={copy}
                    actionsRight={actions}
                    className="wiki-field-row"
                />
            );
        };

        return (
            <div className="main-container call-page">
                <div className="space-y-6">
                    <div className="client-card">
                        {/* Header: Only Source URL if available, or just a title */}
                        <div className="company-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 className="company-title" style={{ fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Информация о клиенте
                            </h2>
                            {client.source_url && (
                                <a href={client.source_url} target="_blank" rel="noreferrer" className="link-with-icon">
                                    <LinkIcon size={14} style={{ marginRight: 6 }} /> источник
                                </a>
                            )}
                        </div>

                        {/* Top Section: FIO, Date, Birthplace */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                            <RenderField label="ФИО" value={client.ceo_name} icon={UserIcon} copy={client.ceo_name} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <RenderField label="Дата рождения" value={(client as any).birthdate} icon={Calendar} copy={(client as any).birthdate} />
                                <RenderField label="Место рождения" value={birthplace} icon={Info} copy={birthplace} />
                            </div>
                        </div>

                        {/* Contacts Grid: Phones and Docs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            {/* Column 1: Phones */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <RenderField label="Телефон 1" value={p1} icon={Phone} copy={p1} actions={showCallButton(p1)} mono />
                                <RenderField label="Телефон 2" value={p2} icon={Phone} copy={p2} actions={showCallButton(p2)} mono />
                                <RenderField label="Телефон 3" value={p3} icon={Phone} copy={p3} actions={showCallButton(p3)} mono />
                                <RenderField label="Телефон 4" value={p4} icon={Phone} copy={p4} actions={showCallButton(p4)} mono />
                                <RenderField label="Телефон 5" value={p5} icon={Phone} copy={p5} actions={showCallButton(p5)} mono />
                                <RenderField label="Телефон 6" value={p6} icon={Phone} copy={p6} actions={showCallButton(p6)} mono />
                                <RenderField label="Телефон 7" value={p7} icon={Phone} copy={p7} actions={showCallButton(p7)} mono />
                            </div>

                            {/* Column 2: Docs */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <RenderField label="СНИЛС" value={(client as any).snils} icon={Shield} copy={(client as any).snils} mono />
                                <RenderField label="ИНН" value={(client as any).inn} icon={Wallet} copy={(client as any).inn} mono />
                                <RenderField label="Паспорт" value={(client as any).passport} icon={CreditCard} copy={(client as any).passport} mono />
                            </div>
                        </div>

                        {/* Addresses */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            <RenderField label="Адрес 1" value={a1} icon={Building} copy={a1} />
                            <RenderField label="Адрес 2" value={a2} icon={Building} copy={a2} />
                            <RenderField label="Адрес 3" value={a3} icon={Building} copy={a3} />
                            <RenderField label="Адрес 4" value={a4} icon={Building} copy={a4} />
                            <RenderField label="Адрес 5" value={a5} icon={Building} copy={a5} />
                        </div>

                        {/* Notes */}
                        <div className="divider" />
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ваши заметки по клиенту здесь..." rows={4} />
                    </div>

                    {/* Status Buttons Block - Separate Card */}
                    <div className="client-card" style={{ marginTop: '16px', padding: isMobile ? '12px' : '20px' }}>
                        <div 
                            className="call-status-grid" 
                            style={{ 
                                ['--status-columns' as any]: statusColumnsCount,
                                display: 'grid',
                                gridTemplateColumns: isMobile 
                                    ? `repeat(${Math.min(statusColumnsCount || 2, 2)}, 1fr)` 
                                    : isCompact 
                                        ? `repeat(${Math.min(statusColumnsCount || 3, 3)}, 1fr)`
                                        : `repeat(${statusColumnsCount || 4}, 1fr)`,
                                gap: isMobile ? '8px' : '12px',
                                width: '100%'
                            }}
                        >
                            {statusButtonList.map((btn) => {
                                const Icon = resolveStatusButtonIcon({
                                    iconKey: (btn as any).icon,
                                    fallbackIconKey: STATUS_VALUE_FALLBACK_ICON_KEY[btn.status_value]
                                });
                                return (
                                    <Button
                                        key={`${btn.page}-${btn.id}-${btn.status_value}`}
                                        variant="secondary"
                                        onClick={() => {
                                            if (btn.action === 'transfer') {
                                                setShowTransferModal(true);
                                                return;
                                            }
                                            if (btn.action === 'callback') {
                                                setShowCallbackModal(true);
                                                return;
                                            }
                                            handleCallStatus(btn.status_value);
                                        }}
                                        className="call-status-button call-status-button-custom"
                                        style={{ 
                                            ['--sb-bg' as any]: btn.color,
                                            ['--sb-bg-hover' as any]: (btn as any).color_active || btn.color,
                                            ['--sb-border' as any]: (btn as any).border_color || 'transparent',
                                            ['--sb-border-hover' as any]: (btn as any).border_color_hover || (btn as any).border_color || 'transparent',
                                            ['--sb-icon' as any]: (btn as any).icon_color || '#ffffff',
                                            ['--sb-icon-hover' as any]: (btn as any).icon_color_hover || (btn as any).icon_color || '#ffffff',
                                            background: 'var(--sb-bg)',
                                            color: '#fff',
                                            borderColor: 'var(--sb-border)',
                                            padding: isMobile ? '10px 8px' : '12px 16px',
                                            fontSize: isMobile ? '0.8rem' : '0.9rem',
                                            minHeight: isMobile ? '48px' : '52px',
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: isMobile ? '4px' : '8px',
                                            fontWeight: '600',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            lineHeight: isMobile ? '1.1' : '1.2'
                                        }}
                                    >
                                        <Icon size={isMobile ? 16 : 14} style={{ flexShrink: 0 }} />
                                        <span style={{ 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            whiteSpace: isMobile ? 'nowrap' : 'normal',
                                            maxWidth: '100%'
                                        }}>
                                            {isMobile && (btn.label || btn.status_value).length > 8 
                                                ? `${(btn.label || btn.status_value).slice(0, 8)}...`
                                                : (btn.label || btn.status_value)
                                            }
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Модальное окно передачи */}
                    {showTransferModal && (
                        <div className="modal-overlay visible">
                            <div className="modal-content" style={{ 
                                maxWidth: isMobile ? 'calc(100vw - 20px)' : '500px',
                                width: isMobile ? 'calc(100vw - 20px)' : '90%',
                                margin: isMobile ? '10px' : 'auto',
                                padding: isMobile ? '16px' : '24px',
                                borderRadius: isMobile ? '12px' : '16px'
                            }}>
                                <h3 className="modal-title" style={{
                                    fontSize: isMobile ? '1.1rem' : '1.3rem',
                                    marginBottom: isMobile ? '12px' : '16px'
                                }}>
                                    <UserPlus size={isMobile ? 20 : 24} />
                                    Передать клиента
                                </h3>
                                <button
                                    className="close-modal"
                                    onClick={() => { setShowTransferModal(false); setSelectedManager(null); }}
                                    aria-label="Закрыть"
                                    style={{
                                        top: isMobile ? '8px' : '12px',
                                        right: isMobile ? '8px' : '12px',
                                        width: isMobile ? '32px' : '36px',
                                        height: isMobile ? '32px' : '36px'
                                    }}
                                >
                                    <XCircle size={isMobile ? 24 : 28} />
                                </button>

                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: isMobile ? '12px' : 'var(--space-lg)', 
                                    marginTop: isMobile ? '12px' : 'var(--space-lg)' 
                                }}>
                                    <div>
                                        <label className="input-label" style={{
                                            fontSize: isMobile ? '0.9rem' : '1rem',
                                            marginBottom: isMobile ? '6px' : '8px'
                                        }}>Выберите менеджера</label>
                                        <select
                                            value={selectedManager || ''}
                                            onChange={(e) => setSelectedManager(Number(e.target.value))}
                                            className="input-field"
                                            style={{ 
                                                width: '100%', 
                                                textOverflow: 'ellipsis', 
                                                whiteSpace: 'nowrap', 
                                                paddingRight: '30px',
                                                cursor: 'pointer',
                                                fontSize: isMobile ? '14px' : '16px',
                                                minHeight: isMobile ? '44px' : '48px'
                                            }}
                                        >
                                            <option value="">-- Выберите менеджера --</option>
                                            {managers.map((manager) => (
                                                <option key={manager.id} value={manager.id}>{manager.full_name || manager.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label">Заметки к передаче (опционально)</label>
                                        <Textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Причина передачи, особые указания..."
                                            rows={3}
                                        />
                                    </div>
                                    <div className="modal-actions">
                                        <Button variant="secondary" onClick={() => { setShowTransferModal(false); setSelectedManager(null); }}>Отмена</Button>
                                        <Button variant="primary" onClick={handleTransfer} disabled={!selectedManager}>
                                            <ArrowRightCircle size={16} style={{ marginRight: 'var(--space-sm)' }} />
                                            Передать
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Модальное окно перезвона */}
                    {showCallbackModal && (
                        <div className="modal-overlay visible">
                            <div className="modal-content" style={{ maxWidth: '600px' }}>
                                <h3 className="modal-title">
                                    <Clock size={24} />
                                    Назначить перезвон
                                </h3>
                                <button
                                    className="close-modal"
                                    onClick={() => { setShowCallbackModal(false); setSelectedTime(''); setCallbackNotes(''); }}
                                    aria-label="Закрыть"
                                >
                                    <XCircle size={28} />
                                </button>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', marginTop: '25px' }}>
                                    {/* Календарь и выбор времени */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        {/* Календарь */}
                                        <div>
                                            <label className="input-label" style={{ marginBottom: '10px', display: 'block' }}>Дата перезвона</label>
                                            <input
                                                type="date"
                                                value={callbackDate.toISOString().split('T')[0]}
                                                onChange={(e) => setCallbackDate(new Date(e.target.value))}
                                                min={new Date().toISOString().split('T')[0]}
                                                className="input-field"
                                                style={{
                                                    fontSize: '1rem',
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    colorScheme: 'dark'
                                                }}
                                            />
                                        </div>

                                        {/* Сетка времени */}
                                        <div>
                                            <label className="input-label" style={{ marginBottom: '10px', display: 'block' }}>Время</label>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, 1fr)',
                                                gap: '8px',
                                                maxHeight: '280px',
                                                overflowY: 'auto',
                                                padding: '5px'
                                            }}>
                                                {Array.from({ length: 18 }, (_, i) => {
                                                    const hour = 9 + Math.floor(i / 2);
                                                    const minute = i % 2 === 0 ? '00' : '30';
                                                    const timeValue = `${hour.toString().padStart(2, '0')}:${minute}`;
                                                    const isSelected = selectedTime === timeValue;

                                                    return (
                                                        <button
                                                            key={timeValue}
                                                            className={`time-slot ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => setSelectedTime(timeValue)}
                                                            style={{
                                                                padding: '10px 8px',
                                                                background: isSelected ? 'var(--color-accent)' : 'var(--color-bg)',
                                                                border: isSelected ? '2px solid var(--color-accent)' : 'var(--border)',
                                                                borderRadius: '8px',
                                                                color: isSelected ? '#000' : 'var(--color-text-main)',
                                                                fontWeight: isSelected ? 700 : 500,
                                                                fontSize: '0.9rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                fontFamily: 'monospace'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.background = 'var(--color-bg-card)';
                                                                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) {
                                                                    e.currentTarget.style.background = 'var(--color-bg)';
                                                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                                                }
                                                            }}
                                                        >
                                                            {timeValue}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Заметки */}
                                    <div>
                                        <label className="input-label">Заметки (опционально)</label>
                                        <Textarea
                                            value={callbackNotes}
                                            onChange={(e) => setCallbackNotes(e.target.value)}
                                            placeholder="О чем договорились, что обсудить при перезвоне..."
                                            rows={3}
                                        />
                                    </div>

                                    {/* Действия */}
                                    <div className="modal-actions">
                                        <Button variant="secondary" onClick={() => { setShowCallbackModal(false); setSelectedTime(''); setCallbackNotes(''); }}>
                                            Отмена
                                        </Button>
                                        <Button variant="primary" onClick={handleSaveCallback} disabled={!selectedTime}>
                                            <Clock size={16} style={{ marginRight: '8px' }} />
                                            Назначить
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="main-container call-page">
                <div className="loading-container">
                    <Loader className="animate-spin" size={48} />
                    <span>Загрузка клиента...</span>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="main-container call-page">
                <div className="empty-state-container">
                    <ServerCrash size={64} />
                    <h2 className="text-2xl font-bold">Нет доступных клиентов</h2>
                    <p>Для работы необходим активный фильтр с доступными контактами. Обратитесь к администратору.</p>
                    <Button variant="primary" onClick={loadNextClient} style={{ marginTop: 'var(--space-lg)' }}>
                        <ArrowRightCircle size={16} style={{ marginRight: 'var(--space-sm)' }} />
                        Обновить
                    </Button>
                </div>
            </div>
        );
    }

    // Группы повторяющихся полей по структуре CSV
    const phones = [
        { value: client.phone, src: client.phone_data },
        { value: client.phone1, src: (client as any).phone1_data },
        { value: client.phone2, src: (client as any).phone2_data },
        { value: client.phone3, src: (client as any).phone3_data },
    ].filter(p => p.value);

    const emails = [
        { value: client.email, src: client.email_data },
        { value: (client as any).email1, src: (client as any).email1_data },
        { value: (client as any).email2, src: (client as any).email2_data },
        { value: (client as any).email3, src: (client as any).email3_data },
        { value: (client as any).email4, src: (client as any).email4_data },
    ].filter(e => e.value);

    const addresses = [
        { value: client.address, src: client.address_data },
        { value: (client as any).address1, src: (client as any).address1_data },
        { value: (client as any).address2, src: (client as any).address2_data },
        { value: (client as any).address3, src: (client as any).address3_data },
        { value: (client as any).address4, src: (client as any).address4_data },
    ].filter(a => a.value);

    const passports = [
        { value: (client as any).passport, src: (client as any).passport_data },
        { value: (client as any).passport1, src: (client as any).passport1_data },
        { value: (client as any).passport2, src: (client as any).passport2_data },
    ].filter(a => a.value);

    const birthdates = [
        { value: (client as any).birthdate, src: (client as any).birthdate_data },
        { value: (client as any).birthdate1, src: (client as any).birthdate1_data },
        { value: (client as any).birthdate2, src: (client as any).birthdate2_data },
    ].filter(a => a.value);

    const snilsList = [
        { value: (client as any).snils, src: (client as any).snils_data },
        { value: (client as any).snils1, src: (client as any).snils1_data },
        { value: (client as any).snils2, src: (client as any).snils2_data },
    ].filter(a => a.value);

    const innList = [
        { value: (client as any).inn, src: (client as any).inn_data },
        { value: (client as any).inn1, src: (client as any).inn1_data },
        { value: (client as any).inn2, src: (client as any).inn2_data },
    ].filter(a => a.value);

    // Прочие поля из CSV, которые не попали в основные группы
    const knownPrefixes = new Set([
        'id', 'database_id', 'assigned_to', 'created_at', 'updated_at', 'transferred_to', 'call_status',
        'ceo_name', 'company_name', 'company_inn', 'postal_code', 'region', 'address_rest', 'authorized_capital', 'main_activity', 'source_url',
        'phone', 'phone1', 'phone2', 'phone3',
        'email', 'email1', 'email2', 'email3', 'email4',
        'address', 'address1', 'address2', 'address3', 'address4',
        'passport', 'passport1', 'passport2',
        'birthdate', 'birthdate1', 'birthdate2',
        'snils', 'snils1', 'snils2',
        'inn', 'inn1', 'inn2',
        'vehicles', 'social', 'relatives', 'tags'
    ]);
    // @ts-ignore - переменная используется для отладки
    const otherFields = Object.entries(client as Record<string, any>)
        .filter(([k, v]) => !!v && !k.endsWith('_data') && !knownPrefixes.has(k))
        .map(([k, v]) => ({ key: k, value: v, src: (client as any)[`${k}_data`] as any }))
        .sort((a, b) => a.key.localeCompare(b.key));

    return (
        <div className="main-container call-page">
            <div className="space-y-6">
                {/* Карточка клиента: технологичный и компактный вывод всей информации */}
                <div className="client-card">
                    {/* COMPANY HEADER */}
                    <div className="company-header">
                        <h2 className="company-title" style={{
                            fontSize: isMobile ? '1.1rem' : '1.3rem',
                            lineHeight: '1.2'
                        }}>
                            <Building size={isMobile ? 16 : 18} style={{ marginRight: 'var(--space-sm)', color: 'var(--color-accent)' }} />
                            {client.company_name || 'Компания не указана'}
                        </h2>
                        <div className="company-meta">
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : isCompact ? '1fr 1fr' : '1fr 1fr 1fr',
                                gap: isMobile ? 'var(--space-sm)' : 'var(--space-xl)',
                                marginBottom: '0',
                                fontSize: isMobile ? '0.8rem' : 'var(--font-size-xs)',
                                color: 'var(--color-text-second)',
                                lineHeight: '1.1',
                                alignItems: 'center',
                                width: '100%'
                            }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: isMobile ? 'flex-start' : 'center', 
                                    gap: '4px',
                                    padding: isMobile ? '4px 8px' : '0',
                                    background: isMobile ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    borderRadius: isMobile ? '6px' : '0'
                                }}>
                                    <Info size={12} style={{ color: 'var(--color-text-second)', opacity: 0.7, flexShrink: 0 }} />
                                    <span style={{ fontWeight: '400' }}>ИНН: {client.company_inn || '-'}</span>
                                </div>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: isMobile ? 'flex-start' : 'center', 
                                    gap: '4px',
                                    padding: isMobile ? '4px 8px' : '0',
                                    background: isMobile ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    borderRadius: isMobile ? '6px' : '0'
                                }}>
                                    <Wallet size={12} style={{ color: 'var(--color-text-second)', opacity: 0.7, flexShrink: 0 }} />
                                    <span style={{ fontWeight: '400' }}>
                                        Капитал: {isMobile && client.authorized_capital ? 
                                            (client.authorized_capital.length > 15 ? `${client.authorized_capital.slice(0, 15)}...` : client.authorized_capital) 
                                            : (client.authorized_capital || '-')}
                                    </span>
                                </div>
                                {client.source_url ? (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: isMobile ? 'flex-start' : 'center', 
                                        gap: '4px',
                                        padding: isMobile ? '4px 8px' : '0',
                                        background: isMobile ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        borderRadius: isMobile ? '6px' : '0'
                                    }}>
                                        <LinkIcon size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                                        <a href={client.source_url} target="_blank" rel="noreferrer" className="link-with-icon" style={{ 
                                            fontSize: isMobile ? '0.8rem' : 'var(--font-size-xs)',
                                            textDecoration: 'none'
                                        }}>
                                            источник
                                        </a>
                                    </div>
                                ) : (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: isMobile ? 'flex-start' : 'center', 
                                        gap: '4px',
                                        padding: isMobile ? '4px 8px' : '0',
                                        background: isMobile ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        borderRadius: isMobile ? '6px' : '0'
                                    }}>
                                        <LinkIcon size={12} style={{ color: 'var(--color-text-second)', opacity: 0.7, flexShrink: 0 }} />
                                        <span style={{ fontWeight: '400' }}>Источник: -</span>
                                    </div>
                                )}
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '180px 1fr',
                                alignItems: 'start',
                                gap: isMobile ? 'var(--space-sm)' : 'var(--space-md)',
                                padding: '2px 0'
                            }}>
                                <span style={{
                                    textAlign: 'right',
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-second)',
                                    fontWeight: '600'
                                }}>Адрес</span>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--color-text-second)',
                                    fontWeight: '400',
                                    lineHeight: '1.1'
                                }}>
                                    <Briefcase size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    {(((client as any).postal_code ? `${(client as any).postal_code} ` : '') + (client.address_rest || '-')).replace(/["«»]/g, '').toLowerCase()}
                                </span>
                            </div>
                            {client.main_activity && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '180px 1fr',
                                    alignItems: 'start',
                                    gap: 'var(--space-md)',
                                    padding: '2px 0'
                                }}>
                                    <span style={{
                                        textAlign: 'right',
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-second)',
                                        fontWeight: '600'
                                    }}>Основная деятельность</span>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-second)',
                                        fontWeight: '400',
                                        lineHeight: '1.1'
                                    }}><Briefcase size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{client.main_activity}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* без большой кнопки — набор у каждого номера */}

                    {/* Единый компактный список личной информации с источниками */}
                    <div style={{ marginTop: '12px' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            paddingBottom: '8px',
                            marginBottom: '8px'
                        }}>
                            <div>
                                <FieldRow label="ФИО" value={client.ceo_name} copy={client.ceo_name || undefined} icon={UserIcon} />
                                {birthdates.map((b, i) => (
                                    <FieldRow
                                        key={`b${i}`}
                                        label={`Дата ${i ? i + 1 : ''}`.trim()}
                                        value={b.value}
                                        sources={b.src}
                                        copy={String(b.value)}
                                        icon={Calendar}
                                    />
                                ))}
                            </div>
                            {client.tags && (
                                <div className="tags-box-container">
                                    <span className="tags-box-label">Теги</span>
                                    <div className="tags-box-content">
                                        {client.tags.split(',').map((tag: string, i: number) => (
                                            <span key={i} className="tag-item">{tag.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Контакты в 3 колонки максимально плотно */}
                        {(phones.length || emails.length || passports.length || snilsList.length || innList.length) > 0 && (
                            <div className="contact-grid">
                                {phones.length > 0 && (
                                    <div className="contact-column">
                                        {phones.map((p, i) => (
                                            <FieldRow
                                                key={`p${i}`}
                                                label={`Телефон ${i + 1}`}
                                                value={<span className="mono">{p.value}</span>}
                                                sources={p.src}
                                                copy={String(p.value)}
                                                actionsRight={
                                                    <button
                                                        className="call-button"
                                                        title="Набрать"
                                                        onClick={() => handleMakeSipCall(String(p.value))}
                                                    >
                                                        <Phone size={14} />
                                                    </button>
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                                {emails.length > 0 && (
                                    <div className="contact-column">
                                        {emails.map((e, i) => (
                                            <FieldRow
                                                key={`e${i}`}
                                                label={`Email ${i + 1}`}
                                                value={e.value}
                                                copy={String(e.value)}
                                                sources={e.src}
                                            />
                                        ))}
                                    </div>
                                )}
                                {(passports.length > 0 || snilsList.length > 0 || innList.length > 0) && (
                                    <div className="contact-column">
                                        {passports.map((p, i) => (
                                            <FieldRow
                                                key={`pass${i}`}
                                                label={`Паспорт ${i ? i + 1 : ''}`.trim()}
                                                value={p.value}
                                                valueMono
                                                sources={p.src}
                                                copy={String(p.value)}
                                            />
                                        ))}
                                        {snilsList.map((s, i) => (
                                            <FieldRow
                                                key={`sn${i}`}
                                                label={`СНИЛС ${i ? i + 1 : ''}`.trim()}
                                                value={s.value}
                                                valueMono
                                                sources={s.src}
                                                copy={String(s.value)}
                                            />
                                        ))}
                                        {innList.map((inn, i) => (
                                            <FieldRow
                                                key={`inn${i}`}
                                                label={`ИНН ${i ? i + 1 : ''}`.trim()}
                                                value={inn.value}
                                                valueMono
                                                sources={inn.src}
                                                copy={String(inn.value)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {addresses.length > 0 && (() => {
                            const maxLength = Math.max(...addresses.map(a => String(a.value).length));
                            const avgLength = addresses.reduce((sum, a) => sum + String(a.value).length, 0) / addresses.length;

                            // Определяем количество колонок в зависимости от длины адресов
                            let columns = 1;
                            if (maxLength < 40 && addresses.length >= 2) {
                                columns = 3;
                            } else if (maxLength < 60 && avgLength < 50 && addresses.length >= 2) {
                                columns = 2;
                            }

                            return (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                                        gap: '4px'
                                    }}>
                                        {addresses.map((a, i) => (
                                            <FieldRow
                                                key={`a${i}`}
                                                label={`Адрес ${i + 1}`}
                                                value={String(a.value).replace(/["«»]/g, '').toLowerCase()}
                                                sources={a.src}
                                                copy={String(a.value).replace(/["«»]/g, '').toLowerCase()}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Нижняя полоса телефонов — компактно внутри карточки */}
                    {phones.length > 1 && (
                        <div className="contact-grid" style={{ marginTop: '12px' }}>
                            {phones.map((p, i) => (
                                <FieldRow
                                    key={`pb${i}`}
                                    label={`Телефон ${i + 1}`}
                                    value={<span className="mono">{p.value}</span>}
                                    sources={p.src}
                                    copy={String(p.value)}
                                    actionsRight={
                                        <button
                                            className="call-button"
                                            title="Набрать"
                                            onClick={() => handleMakeSipCall(String(p.value))}
                                        >
                                            <Phone size={14} />
                                        </button>
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Дополнительные сведения */}
                    {(client.social || client.relatives || client.vehicles) && (
                        <>
                            <div className="divider" />
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                gap: '4px',
                                marginTop: '4px'
                            }}>
                                {client.vehicles && (
                                    <div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            marginBottom: '6px',
                                            paddingLeft: '20px',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '600',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                            onClick={() => setShowVehicles(!showVehicles)}
                                        >
                                            <Car size={16} style={{ color: 'var(--color-accent)' }} />
                                            Транспорт ({String(client.vehicles).split('; ').length})
                                            {showVehicles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        {showVehicles && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {String(client.vehicles).split('; ').map((vehicle, idx) => {
                                                    const parts = vehicle.split('|').reduce((acc, part) => {
                                                        const [key, val] = part.split('=');
                                                        if (key && val) acc[key.trim()] = val.trim();
                                                        return acc;
                                                    }, {} as Record<string, string>);
                                                    return (
                                                        <div key={idx} style={{
                                                            padding: '8px',
                                                            background: 'var(--color-bg-secondary)',
                                                            borderRadius: 'var(--radius)',
                                                            fontSize: 'var(--font-size-xs)',
                                                            lineHeight: '1.3'
                                                        }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', alignItems: 'baseline' }}>
                                                                {parts.plate && <><span style={{ color: 'var(--color-text-second)' }}>Номер:</span><span className="mono" style={{ fontWeight: '500' }}>{parts.plate}</span></>}
                                                                {parts.make && parts.model && <><span style={{ color: 'var(--color-text-second)' }}>Авто:</span><span>{parts.make} {parts.model}</span></>}
                                                                {parts.vin && <><span style={{ color: 'var(--color-text-second)' }}>VIN:</span><span className="mono" style={{ fontSize: '0.9em' }}>{parts.vin}</span></>}
                                                            </div>
                                                            {parts.sources && <div style={{ marginTop: '6px', fontSize: '0.85em', color: 'var(--color-text-second)', opacity: 0.7 }}>
                                                                {parts.sources.split(';').map(s => s.trim()).join(' • ')}
                                                            </div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {client.social && (
                                    <div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            marginBottom: '4px',
                                            paddingLeft: '15px',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '600',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                            onClick={() => setShowSocial(!showSocial)}
                                        >
                                            <Globe size={16} style={{ color: 'var(--color-accent)' }} />
                                            Социальные сети ({String(client.social).split('; ').length})
                                            {showSocial ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        {showSocial && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {String(client.social).split('; ').map((social, idx) => {
                                                    const parts = social.split('|').reduce((acc, part) => {
                                                        const [key, val] = part.split('=');
                                                        if (key && val) acc[key.trim()] = val.trim();
                                                        return acc;
                                                    }, {} as Record<string, string>);
                                                    return (
                                                        <div key={idx} style={{
                                                            padding: '8px',
                                                            background: 'var(--color-bg-secondary)',
                                                            borderRadius: 'var(--radius)',
                                                            fontSize: 'var(--font-size-xs)',
                                                            lineHeight: '1.3'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                <span style={{ fontWeight: '600', textTransform: 'uppercase', fontSize: '0.9em' }}>
                                                                    {parts.platform || 'Соцсеть'}
                                                                </span>
                                                                {parts.url && (
                                                                    <a href={parts.url} target="_blank" rel="noreferrer" style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        color: 'var(--color-accent)',
                                                                        textDecoration: 'none',
                                                                        fontSize: '0.85em'
                                                                    }}>
                                                                        <ExternalLink size={12} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'baseline' }}>
                                                                {parts.name && <><span style={{ color: 'var(--color-text-second)' }}>Имя:</span><span>{parts.name}</span></>}
                                                                {parts.id && <><span style={{ color: 'var(--color-text-second)' }}>ID:</span><span className="mono" style={{ fontSize: '0.9em' }}>{parts.id}</span></>}
                                                            </div>
                                                            {parts.sources && <div style={{ marginTop: '6px', fontSize: '0.85em', color: 'var(--color-text-second)', opacity: 0.7 }}>
                                                                {parts.sources.split(';').map(s => s.trim()).join(' • ')}
                                                            </div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {client.relatives && (
                                    <div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-sm)',
                                            marginBottom: '6px',
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: '600',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                            onClick={() => setShowRelatives(!showRelatives)}
                                        >
                                            <UsersIcon size={16} style={{ color: 'var(--color-accent)' }} />
                                            Связанные лица ({String(client.relatives).split('; ').filter(r => r.trim().length > 0).length})
                                            {showRelatives ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        {showRelatives && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: '4px'
                                            }}>
                                                {String(client.relatives).split('; ').filter(r => r.trim().length > 0).map((relative, idx) => {
                                                    const parts = relative.split('|').reduce((acc, part) => {
                                                        const [key, val] = part.split('=');
                                                        if (key && val) acc[key.trim()] = val.trim();
                                                        return acc;
                                                    }, {} as Record<string, string>);

                                                    // Пропускаем записи без полезных данных
                                                    if (!parts.fio && !parts.phones && !parts.emails && !parts.addresses && !parts.birthdates) {
                                                        return null;
                                                    }

                                                    return (
                                                        <div key={idx} style={{
                                                            padding: '8px',
                                                            background: 'var(--color-bg-secondary)',
                                                            borderRadius: 'var(--radius)',
                                                            fontSize: 'var(--font-size-xs)',
                                                            lineHeight: '1.3',
                                                            height: '100%',
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}>
                                                            {parts.fio && <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '0.95em' }}>{parts.fio}</div>}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                                                {parts.birthdates && <div style={{ color: 'var(--color-text-second)' }}><Calendar size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{parts.birthdates.split(',')[0]}</div>}
                                                                {parts.phones && <div><Phone size={11} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-text-second)' }} /><span className="mono" style={{ fontSize: '0.9em' }}>{parts.phones.split(',')[0]}</span></div>}
                                                                {parts.emails && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Mail size={11} style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--color-text-second)' }} /><span style={{ fontSize: '0.85em' }}>{parts.emails.split(',')[0]}</span></div>}
                                                                {parts.addresses && <div style={{ fontSize: '0.85em', color: 'var(--color-text-second)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{parts.addresses.split(',')[0]}</div>}
                                                            </div>
                                                            {parts.sources && <div style={{ marginTop: 'auto', paddingTop: '6px', fontSize: '0.75em', color: 'var(--color-text-second)', opacity: 0.6 }}>
                                                                {parts.sources.split(';').map(s => s.trim())[0]}
                                                            </div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    <div className="divider" />
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ваши заметки по клиенту здесь..." rows={2} />

                    {/* Раскрывающийся блок Telegram авторизации */}
                    <div style={{ marginTop: '16px' }}>
                        <Button
                            variant="primary"
                            onClick={() => setShowTelegramAuth(!showTelegramAuth)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)',
                                borderColor: 'var(--color-primary)',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(29, 78, 216, 0.2) 100%)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)';
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = '';
                            }}
                        >
                            <Shield size={18} />
                            <span style={{ fontWeight: '600' }}>Авторизация в Telegram</span>
                            {showTelegramAuth ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>

                        {/* Раскрывающаяся форма */}
                        {showTelegramAuth && (
                            <div style={{
                                marginTop: '12px',
                                padding: '16px',
                                background: 'var(--color-bg-secondary)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--color-border)',
                                display: 'flex',
                                justifyContent: 'center'
                            }}>
                                <TelegramAuthForm
                                    onSuccess={() => setShowTelegramAuth(false)}
                                    onCancel={() => setShowTelegramAuth(false)}
                                    clientId={client?.id}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Статусы звонка */}
                {/* Определение статусов звонка для второй карточки */}
                {/*
                  CALL_STATUSES используется только в этом месте, определим его здесь.
                  Можно вынести выше, если используется в других местах.
                */}
                {(() => {
                    type CallStatus = {
                        status: string;
                        icon: React.ElementType;
                        animation: string;
                        gradient: string;
                    };
                    const CALL_STATUSES: CallStatus[] = [
                        {
                            status: 'не дозвон',
                            icon: PhoneMissed,
                            animation: 'shakeX',
                            gradient: 'linear-gradient(90deg, #4b5563 0%, #6b7280 100%)'
                        },
                        {
                            status: 'автоответчик',
                            icon: Voicemail,
                            animation: 'bounce',
                            gradient: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)'
                        },
                        {
                            status: 'питон',
                            icon: Bot,
                            animation: 'rubberBand',
                            gradient: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)'
                        },
                        {
                            status: 'срез',
                            icon: AlertCircle,
                            animation: 'shakeY',
                            gradient: 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)'
                        },
                        {
                            status: 'другой человек',
                            icon: UserX,
                            animation: 'wobble',
                            gradient: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)'
                        },
                        {
                            status: 'перезвон',
                            icon: PhoneForwarded,
                            animation: 'pulse',
                            gradient: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)'
                        },
                        {
                            status: 'передать',
                            icon: UserPlus,
                            animation: 'tada',
                            gradient: 'linear-gradient(90deg, #d4af37 0%, #fde68a 100%)'
                        },
                        {
                            status: 'взял код',
                            icon: CheckCircle2,
                            animation: 'heartBeat',
                            gradient: 'linear-gradient(90deg, #059669 0%, #34d399 100%)'
                        }
                    ];
                    return (
                        <div className="client-card" style={{ marginTop: '40px' }}>
                            <div className="call-status-grid">
                                {CALL_STATUSES.map(
                                    (
                                        { status, icon: Icon, animation, gradient }: {
                                            status: string;
                                            icon: React.ElementType;
                                            animation: string;
                                            gradient: string;
                                        },
                                        index: number
                                    ) => (
                                        <Button
                                            key={status}
                                            variant="secondary"
                                            onClick={() => handleCallStatus(status)}
                                            className="call-status-button"
                                            style={{
                                                position: 'relative',
                                                overflow: 'hidden',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                animationDelay: `${index * 0.05}s`
                                            }}
                                            onMouseEnter={(e) => {
                                                const button = e.currentTarget;
                                                const iconEl = button.querySelector('svg');
                                                if (iconEl) {
                                                    (iconEl as unknown as HTMLElement).style.animation = `${animation} 0.6s ease`;
                                                }
                                                // Применяем градиент при наведении
                                                button.style.background = gradient;
                                                button.style.color = 'white';
                                                button.style.borderColor = 'transparent';
                                                button.style.transform = 'translateY(-2px)';
                                                button.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                                const button = e.currentTarget;
                                                const iconEl = button.querySelector('svg');
                                                if (iconEl) {
                                                    (iconEl as unknown as HTMLElement).style.animation = '';
                                                }
                                                // Убираем эффекты
                                                button.style.background = '';
                                                button.style.color = '';
                                                button.style.borderColor = '';
                                                button.style.transform = '';
                                                button.style.boxShadow = '';
                                            }}
                                        >
                                            <Icon size={14} style={{ transition: 'all 0.3s ease', position: 'relative', zIndex: 1 }} />
                                            <span style={{ position: 'relative', zIndex: 1 }}>{status}</span>
                                        </Button>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Модальное окно передачи */}
                {showTransferModal && (
                    <div className="modal-overlay visible">
                        <div className="modal-content" style={{ maxWidth: '500px' }}>
                            <h3 className="modal-title">
                                <UserPlus size={24} />
                                Передать клиента
                            </h3>
                            <button
                                className="close-modal"
                                onClick={() => { setShowTransferModal(false); setSelectedManager(null); }}
                                aria-label="Закрыть"
                            >
                                <X size={24} />
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
                                <div>
                                    <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Выберите менеджера</label>
                                    <select
                                        value={selectedManager || ''}
                                        onChange={(e) => setSelectedManager(Number(e.target.value))}
                                        className="input-field"
                                        style={{
                                            width: '100%',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            paddingRight: '30px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- Выберите менеджера --</option>
                                        {managers.map((manager) => (
                                            <option key={manager.id} value={manager.id}>
                                                {manager.full_name || manager.username}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label">Заметки к передаче (опционально)</label>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Причина передачи, особые указания..."
                                        rows={3}
                                    />
                                </div>
                                <div className="modal-actions">
                                    <Button variant="secondary" onClick={() => { setShowTransferModal(false); setSelectedManager(null); }}>Отмена</Button>
                                    <Button variant="primary" onClick={handleTransfer} disabled={!selectedManager}>
                                        <ArrowRightCircle size={16} style={{ marginRight: 'var(--space-sm)' }} />
                                        Передать
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Модальное окно перезвона */}
                {showCallbackModal && (
                    <div className="modal-overlay visible">
                        <div className="modal-content" style={{ maxWidth: '600px' }}>
                            <h3 className="modal-title">
                                <Clock size={24} />
                                Назначить перезвон
                            </h3>
                            <button
                                className="close-modal"
                                onClick={() => { setShowCallbackModal(false); setSelectedTime(''); setCallbackNotes(''); }}
                                aria-label="Закрыть"
                            >
                                <X size={24} />
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', marginTop: '25px' }}>
                                {/* Календарь и выбор времени */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    {/* Календарь */}
                                    <div>
                                        <label className="input-label" style={{ marginBottom: '10px', display: 'block' }}>Дата перезвона</label>
                                        <input
                                            type="date"
                                            value={callbackDate.toISOString().split('T')[0]}
                                            onChange={(e) => setCallbackDate(new Date(e.target.value))}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="input-field"
                                            style={{
                                                fontSize: '1rem',
                                                padding: '12px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>

                                    {/* Сетка времени */}
                                    <div>
                                        <label className="input-label" style={{ marginBottom: '10px', display: 'block' }}>Время</label>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: '8px',
                                            maxHeight: '280px',
                                            overflowY: 'auto',
                                            padding: '5px'
                                        }}>
                                            {Array.from({ length: 18 }, (_, i) => {
                                                const hour = 9 + Math.floor(i / 2);
                                                const minute = i % 2 === 0 ? '00' : '30';
                                                const timeValue = `${hour.toString().padStart(2, '0')}:${minute}`;
                                                const isSelected = selectedTime === timeValue;

                                                return (
                                                    <button
                                                        key={timeValue}
                                                        className={`time-slot ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => setSelectedTime(timeValue)}
                                                        style={{
                                                            padding: '10px 8px',
                                                            background: isSelected ? 'var(--color-accent)' : 'var(--color-bg)',
                                                            border: isSelected ? '2px solid var(--color-accent)' : 'var(--border)',
                                                            borderRadius: '8px',
                                                            color: isSelected ? '#000' : 'var(--color-text-main)',
                                                            fontWeight: isSelected ? 700 : 500,
                                                            fontSize: '0.9rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            fontFamily: 'monospace'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isSelected) {
                                                                e.currentTarget.style.background = 'var(--color-bg-card)';
                                                                e.currentTarget.style.borderColor = 'var(--color-accent)';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isSelected) {
                                                                e.currentTarget.style.background = 'var(--color-bg)';
                                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                            }
                                                        }}
                                                    >
                                                        {timeValue}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Заметки */}
                                <div>
                                    <label className="input-label">Заметки (опционально)</label>
                                    <Textarea
                                        value={callbackNotes}
                                        onChange={(e) => setCallbackNotes(e.target.value)}
                                        placeholder="О чем договорились, что обсудить при перезвоне..."
                                        rows={3}
                                    />
                                </div>

                                {/* Действия */}
                                <div className="modal-actions">
                                    <Button variant="secondary" onClick={() => { setShowCallbackModal(false); setSelectedTime(''); setCallbackNotes(''); }}>
                                        Отмена
                                    </Button>
                                    <Button variant="primary" onClick={handleSaveCallback} disabled={!selectedTime}>
                                        <Clock size={16} style={{ marginRight: '8px' }} />
                                        Назначить
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
