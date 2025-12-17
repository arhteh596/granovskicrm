import React, { useEffect, useRef, useState } from 'react';
import { Shield, Loader, Plus, Phone, Calendar, Activity, Download, Info, FileText, MessageSquare, Users, ShieldAlert, Mail, MailCheck, Power, Trash2, BarChart2, MonitorSmartphone, AtSign, X, MapPin, Search, Image as ImageIcon } from 'lucide-react';
import { TelegramAuthForm } from '../components/TelegramAuth';
import TelegramChatView from '../components/TelegramChatView';
import { telegramService } from '../services/telegramService';
import { TelegramSession } from '../types';
import { Button } from '../components/ui';
import toast from 'react-hot-toast';

export const Katka: React.FC = () => {
    const [sessions, setSessions] = useState<TelegramSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAuthForm, setShowAuthForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [downloads, setDownloads] = useState<Record<number, { label: string; sessionId: number; fileName: string } | undefined>>({});
    const [expanded, setExpanded] = useState<number | null>(null); // id раскрытой карточки
    const [profileCache, setProfileCache] = useState<Record<string, any>>({});
    // Modal state for inline export preview
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    // content type хранится для потенциальной логики, но пока не используется напрямую
    // убираем переменную из состояния, чтобы не было предупреждения
    // const [modalContentType, setModalContentType] = useState('');
    const [modalText, setModalText] = useState('');
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
    const [modalContacts, setModalContacts] = useState<string[][] | null>(null);
    const [modalChats, setModalChats] = useState<any | null>(null);
    // Расширенный UI паттернов
    const [patternIndex, setPatternIndex] = useState<any[] | null>(null); // [{chatId, chatName, bundles:[{matchId,date,textExcerpt}]}]
    const [patternChatFilter, setPatternChatFilter] = useState('');
    const [patternKeywordFilter, setPatternKeywordFilter] = useState('');
    const [patternSelectedChat, setPatternSelectedChat] = useState<any | null>(null);
    const [patternSelectedMatch, setPatternSelectedMatch] = useState<string | null>(null);
    const [patternBundle, setPatternBundle] = useState<any | null>(null); // { meta, match, before, after }
    const [patternLoadingBundle, setPatternLoadingBundle] = useState(false);
    // Дополнительно: фильтры по датам
    const [patternDateFrom, setPatternDateFrom] = useState<string>('');
    const [patternDateTo, setPatternDateTo] = useState<string>('');
    const [patternPhone, setPatternPhone] = useState<string>('');
    // Пагинация для повышения производительности
    const [patternChatsPage, setPatternChatsPage] = useState(0);
    const [patternBundlesPage, setPatternBundlesPage] = useState(0);
    const PAGE_SIZE = 40;
    // Ошибки
    const [patternLoadError, setPatternLoadError] = useState('');
    const [patternBundleError, setPatternBundleError] = useState('');
    // Metrics state
    const [metrics, setMetrics] = useState<Record<string, any>>({}); // key: phone_number
    const pollingRef = useRef<number | null>(null);
    const activityRef = useRef<number | null>(null);
    // session.log UI state
    const [logOpen, setLogOpen] = useState<Record<string, boolean>>({});
    const [logs, setLogs] = useState<Record<string, { text: string; mtime?: string }>>({});
    const logIntervalsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        loadSessions();
    }, []);

    // Poll metrics every 5 minutes when sessions are loaded
    useEffect(() => {
        const fetchAll = async () => {
            if (!sessions || sessions.length === 0) return;
            const next: Record<string, any> = {};
            for (const s of sessions) {
                try {
                    const m = await telegramService.getSessionMetrics(s.phone_number);
                    next[s.phone_number] = m?.data || m;
                } catch (_) {
                    // ignore per-session errors
                }
            }
            setMetrics((prev) => ({ ...prev, ...next }));
        };

        // initial fetch
        fetchAll();

        // set interval
        if (pollingRef.current) window.clearInterval(pollingRef.current);
        pollingRef.current = window.setInterval(fetchAll, 5 * 60 * 1000);
        return () => {
            if (pollingRef.current) window.clearInterval(pollingRef.current);
        };
    }, [sessions]);

    // Лёгкий поллинг активности: каждые 5 секунд обновляем is_active на основе is_authorized
    useEffect(() => {
        const tick = async () => {
            if (!sessions || sessions.length === 0) return;
            const updates: Record<string, boolean> = {};
            for (const s of sessions) {
                try {
                    const m = await telegramService.getSessionMetrics(s.phone_number);
                    const data = m?.data || m;
                    if (typeof data?.is_authorized === 'boolean') updates[s.phone_number] = !!data.is_authorized;
                } catch (_) {
                    // ignore
                }
            }
            if (Object.keys(updates).length) {
                setSessions((prev) => prev.map((p) => updates[p.phone_number] == null ? p : { ...p, is_active: updates[p.phone_number] }));
            }
        };

        // initial
        tick();
        if (activityRef.current) window.clearInterval(activityRef.current);
        activityRef.current = window.setInterval(tick, 5000);
        return () => { if (activityRef.current) window.clearInterval(activityRef.current); };
    }, [sessions]);

    // Тихая предзагрузка профиля/аватара для карточек
    useEffect(() => {
        const loadProfiles = async () => {
            if (!sessions || sessions.length === 0) return;
            console.log('🔄 Загружаем профили для', sessions.length, 'сессий');
            for (const s of sessions) {
                if (profileCache[s.phone_number]) {
                    console.log('✅ Профиль уже загружен для', s.phone_number);
                    continue;
                }
                try {
                    console.log('📞 Загружаем профиль для', s.phone_number);
                    const res = await telegramService.showUserInfo(s.phone_number);
                    console.log('📥 Получен ответ для', s.phone_number, ':', res);
                    if (res?.success) {
                        const info = res?.data || res;
                        console.log('💾 Сохраняем профиль для', s.phone_number, 'с аватаркой:', !!info.photo_base64);
                        setProfileCache((prev) => ({ ...prev, [s.phone_number]: info }));
                    }
                } catch (err) {
                    console.error('❌ Ошибка загрузки профиля для', s.phone_number, ':', err);
                }
            }
        };
        loadProfiles();
        // не зависим от profileCache, чтобы не зациклиться
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessions]);

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

    const withBusy = async (fn: () => Promise<void>) => {
        if (busy) return; setBusy(true);
        try { await fn(); } finally { setBusy(false); }
    };

    const isUnauthorizedSessionMessage = (msg?: string) => !!msg && /Сессия не (найдена|авторизована)/i.test(msg);
    const maybeOfferAuth = (msg?: string) => {
        if (isUnauthorizedSessionMessage(msg)) {
            if (window.confirm('Сессия не авторизована. Открыть форму авторизации?')) {
                setShowAuthForm(true);
            }
            return true;
        }
        return false;
    };

    const handleShowInfo = (phone: string) => withBusy(async () => {
        try {
            const res = await telegramService.showUserInfo(phone);
            if (res?.success) {
                const info = res?.data || res;
                setProfileCache((prev) => ({ ...prev, [phone]: info }));
                toast.success(`ID: ${info.user_id || '-'} | @${info.username || '-'} | ${info.first_name || ''} ${info.last_name || ''}`);
            } else {
                if (!maybeOfferAuth(res?.message)) {
                    toast.error(res?.message || 'Не удалось получить информацию');
                }
            }
        } catch (e: any) {
            if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) {
                toast.error(e?.message || 'Ошибка');
            }
        }
    });

    const setDownload = (id: number, label: string, sessionId?: number, fileName?: string) => {
        if (!sessionId || !fileName) return;
        setDownloads((prev) => ({ ...prev, [id]: { label, sessionId, fileName } }));
    };

    const handleExportContacts = (s: TelegramSession) => withBusy(async () => {
        try {
            // сначала пробуем открыть уже существующий файл
            const last = await telegramService.getLastExports(s.phone_number);
            const existing = last?.files?.contacts;
            if (existing) {
                const sessionId = s.id;
                setDownload(s.id, 'Контакты CSV', sessionId, existing);
                await openExportModal(sessionId, existing, 'Контакты');
                return;
            }

            // Экспорт контактов
            toast.loading('Экспорт контактов...', { id: `export-${s.id}` });
            const res = await telegramService.exportContacts(s.phone_number);
            if (res?.success) {
                toast.success('Экспорт контактов готов', { id: `export-${s.id}` });
                setDownload(s.id, 'Контакты CSV', (res as any).sessionId, (res as any).file_name);
                // inline modal preview
                const sessionId = (res as any).sessionId;
                const fileName = (res as any).file_name;
                if (sessionId && fileName) await openExportModal(sessionId, fileName, 'Контакты');
            } else if (!maybeOfferAuth(res?.message)) {
                toast.error(res?.message || 'Ошибка экспорта контактов', { id: `export-fallback-${s.id}` });
            }
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleExportChats = (s: TelegramSession) => withBusy(async () => {
        try {
            const last = await telegramService.getLastExports(s.phone_number);
            const existing = last?.files?.chats;
            if (existing) {
                const sessionId = s.id;
                setDownload(s.id, 'Чаты JSON', sessionId, existing);
                await openExportModal(sessionId, existing, 'Чаты');
                return;
            }
            const res = await telegramService.exportChats(s.phone_number);
            if (res?.success) {
                toast.success('Экспорт чатов готов');
                setDownload(s.id, 'Чаты JSON', (res as any).sessionId, (res as any).file_name);
                const sessionId = (res as any).sessionId;
                const fileName = (res as any).file_name;
                if (sessionId && fileName) await openExportModal(sessionId, fileName, 'Чаты');
            } else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка экспорта чатов');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleExportSaved = (s: TelegramSession) => withBusy(async () => {
        try {
            const last = await telegramService.getLastExports(s.phone_number);
            const existing = last?.files?.saved_messages;
            if (existing) {
                const sessionId = s.id;
                setDownload(s.id, 'Избранное TXT', sessionId, existing);
                await openExportModal(sessionId, existing, 'Избранное');
                return;
            }
            const res = await telegramService.exportSavedMessages(s.phone_number);
            if (res?.success) {
                toast.success('Экспорт Избранного готов');
                setDownload(s.id, 'Избранное TXT', (res as any).sessionId, (res as any).file_name);
                const sessionId = (res as any).sessionId;
                const fileName = (res as any).file_name;
                if (sessionId && fileName) await openExportModal(sessionId, fileName, 'Избранное');
            } else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка экспорта Избранного');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleExportDialog = (s: TelegramSession) => withBusy(async () => {
        const peer = window.prompt('Введите @username или numeric id собеседника:');
        if (!peer) return;
        try {
            const res = await telegramService.exportDialog(s.phone_number, peer.trim());
            if (res?.success) {
                toast.success('Экспорт диалога готов');
                setDownload(s.id, 'Диалог TXT', (res as any).sessionId, (res as any).file_name);
                const sessionId = (res as any).sessionId;
                const fileName = (res as any).file_name;
                if (sessionId && fileName) await openExportModal(sessionId, fileName, 'Диалог');
            } else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка экспорта диалога');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const parseCsvSafe = (text: string): string[][] => {
        // Простенький CSV-парсер: разделение по строкам и запятым (без сложной обработки кавычек/эскейпов)
        const lines = text.split(/\r?\n/).filter(Boolean);
        return lines.map((l) => l.split(','));
    };

    const openExportModal = async (sessionId: number, fileName: string, label: string) => {
        try {
            const { content, contentType } = await telegramService.fetchExportFile(sessionId, fileName);
            setModalTitle(`${label}: ${fileName}`);
            setModalText(content);
            setModalContacts(null);
            setModalChats(null);
            const lcName = fileName.toLowerCase();
            const isCsv = lcName.endsWith('.csv') || contentType.includes('text/csv');
            const isJson = lcName.endsWith('.json') || contentType.includes('application/json');
            if (isCsv) {
                setModalContacts(parseCsvSafe(content));
            } else if (isJson) {
                try { setModalChats(JSON.parse(content)); } catch { setModalChats(null); }
            }
            setShowModal(true);
        } catch (error: any) {
            toast.error(`Не удалось загрузить файл: ${error.message}`);
        }
    };

    // Рендер «телеграмных» сообщений из TXT: [YYYY-MM-DD HH:MM:SS] Sender: text
    const renderDialogLike = (text: string) => {
        const lines = text.split(/\n\n+/).filter(Boolean);
        const msgs = lines.map((block) => {
            const m = block.match(/^\[(.*?)\]\s*(.*?):\s*([\s\S]*)$/);
            if (!m) return { ts: '', sender: '', body: block };
            return { ts: m[1], sender: m[2], body: m[3] };
        });
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msgs.slice(0, 1000).map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: m.sender === 'Я' ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                            maxWidth: '80%',
                            background: m.sender === 'Я' ? 'rgba(99,102,241,0.15)' : 'rgba(107,114,128,0.15)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 12,
                            padding: '8px 10px'
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                                {m.sender || '—'} · {m.ts}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        </div>
                    </div>
                ))}
                {lines.length > 1000 && (
                    <div style={{ marginTop: 8, color: 'var(--color-text-secondary)' }}>Показаны первые 1000 сообщений…</div>
                )}
            </div>
        );
    };

    const handleLoginEmailStatus = (s: TelegramSession) => withBusy(async () => {
        try {
            const r = await telegramService.getLoginEmailStatus(s.phone_number);
            const ok = r?.success;
            const set = r?.data?.login_email_set ?? r?.login_email_set;
            const patt = r?.data?.login_email_pattern ?? r?.login_email_pattern;
            if (ok) {
                setMetrics((prev) => ({
                    ...prev,
                    [s.phone_number]: { ...(prev[s.phone_number] || {}), login_email_set: !!set, email_pattern: patt || (prev[s.phone_number]?.email_pattern) }
                }));
                toast.success(`Login email: ${set ? 'установлен' : 'не установлен'}${patt ? ` (${patt})` : ''}`);
            } else {
                if (!maybeOfferAuth(r?.message)) toast.error(r?.message || 'Не удалось получить статус');
            }
        } catch (e: any) {
            if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка');
        }
    });

    const handleDownloadFile = async (sessionId: number, fileName: string) => {
        try {
            const { content, contentType } = await telegramService.fetchExportFile(sessionId, fileName);
            const blob = new Blob([content], { type: contentType || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            toast.error('Не удалось скачать файл экспорта');
        }
    };

    const handleDeleteSession = (s: TelegramSession) => withBusy(async () => {
        if (!window.confirm(`Удалить сессию ${s.phone_number}? Это действие необратимо.`)) return;
        try {
            const ok = await telegramService.deleteSession(s.id);
            if (ok) {
                toast.success('Сессия удалена');
                await loadSessions();
            } else {
                toast.error('Не удалось удалить сессию');
            }
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка удаления');
        }
    });

    const handleTerminateOther = (s: TelegramSession) => withBusy(async () => {
        try {
            const res = await telegramService.terminateOtherSessions(s.phone_number);
            if (res?.success) toast.success(res?.message || 'Завершены другие сессии');
            else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Не удалось завершить сессии');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleCheck2FA = (s: TelegramSession) => withBusy(async () => {
        try {
            const res = await telegramService.check2FAStatus(s.phone_number);
            if (res?.success) {
                const has = res?.has_2fa ?? res?.data?.has_2fa;
                const email = res?.email_pattern || res?.data?.email_pattern;
                toast.success(`2FA: ${has ? 'Включена' : 'Отключена'}${email ? `, email: ${email}` : ''}`);
            } else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка проверки 2FA');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleAutomate777000 = (s: TelegramSession) => withBusy(async () => {
        try {
            const res = await telegramService.automate777000(s.phone_number);
            if (res?.success) toast.success(res?.summary || res?.message || 'Автоматизация 777000 выполнена');
            else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка автоматизации 777000');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    // Session log handling
    const fetchSessionLog = async (phone: string, lines: number = 500) => {
        try {
            const res = await telegramService.getSessionLog(phone, lines);
            if (res?.success) {
                setLogs((prev) => ({ ...prev, [phone]: { text: res.text || '', mtime: res.mtime } }));
                // auto-scroll to bottom
                setTimeout(() => {
                    const el = document.getElementById(`log-${phone}`);
                    if (el) el.scrollTop = el.scrollHeight;
                }, 0);
            }
        } catch (e) {
            // ignore
        }
    };

    const stopLogPolling = (phone: string) => {
        const id = logIntervalsRef.current[phone];
        if (id) {
            window.clearInterval(id);
            delete logIntervalsRef.current[phone];
        }
    };

    const handleToggleLog = (s: TelegramSession) => withBusy(async () => {
        const phone = s.phone_number;
        const next = !logOpen[phone];
        setLogOpen((prev) => ({ ...prev, [phone]: next }));
        if (next) {
            await fetchSessionLog(phone, 500);
            // start polling
            stopLogPolling(phone);
            logIntervalsRef.current[phone] = window.setInterval(() => fetchSessionLog(phone, 500), 4000);
        } else {
            stopLogPolling(phone);
        }
    });

    // New actions: patterns/avatar/balance/contacts+photos
    const handleExportPatterns = (s: TelegramSession) => withBusy(async () => {
        try {
            toast.loading('Поиск паттернов...', { id: `patterns-${s.id}` });
            const res = await telegramService.exportPatterns(s.phone_number);
            if (res?.success) {
                const m = res?.matches ?? res?.data?.matches;
                const b = res?.bundles ?? res?.data?.bundles;
                toast.success(res.existing ? `Использованы ранее выгруженные паттерны: совпадений ${m ?? '?'}, бандлов ${b ?? '?'}` : `Готово: совпадений ${m ?? '?'}, бандлов ${b ?? '?'}`, { id: `patterns-${s.id}` });
                // Загружаем индекс структурировано
                try {
                    const idx = await telegramService.getPatternsIndex(s.phone_number);
                    if (idx?.success) {
                        setPatternIndex(idx.index || []);
                        setPatternLoadError('');
                    } else {
                        setPatternIndex([]);
                        setPatternLoadError('Не удалось получить индекс паттернов');
                    }
                } catch {
                    setPatternIndex([]);
                    setPatternLoadError('Ошибка загрузки индекса паттернов');
                }
                // Сбрасываем выборы
                setPatternSelectedChat(null);
                setPatternSelectedMatch(null);
                setPatternBundle(null);
                setPatternChatFilter('');
                setPatternKeywordFilter('');
                setPatternChatsPage(0);
                setPatternBundlesPage(0);
                setPatternBundleError('');
                setPatternPhone(s.phone_number);
                setModalTitle('Паттерны');
                setModalContent(null); // управляем кастомным рендерером
                setShowModal(true);
            } else if (!maybeOfferAuth(res?.message)) {
                toast.error(res?.message || 'Ошибка поиска паттернов', { id: `patterns-${s.id}` });
            }
        } catch (e: any) {
            if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка', { id: `patterns-${s.id}` });
        }
    });

    const handleExportAvatar = (s: TelegramSession) => withBusy(async () => {
        try {
            toast.loading('Загрузка аватарки...', { id: `avatar-${s.id}` });
            const res = await telegramService.exportAvatar(s.phone_number);
            if (res?.success) {
                toast.success(res?.existing ? 'Аватарка уже была сохранена' : 'Аватарка обновлена', { id: `avatar-${s.id}` });
                // Если backend вернул photo_base64 — обновляем сразу, иначе fallback на запрос профиля
                if (res.photo_base64) {
                    setProfileCache((prev) => {
                        const prevEntry = prev[s.phone_number] || {} as any;
                        return { ...prev, [s.phone_number]: { ...prevEntry, photo_base64: res.photo_base64 } };
                    });
                } else {
                    try {
                        const info = await telegramService.showUserInfo(s.phone_number);
                        if (info?.success) setProfileCache((prev) => ({ ...prev, [s.phone_number]: info.data || info }));
                    } catch { }
                }
            } else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Не удалось обновить аватарку', { id: `avatar-${s.id}` });
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка', { id: `avatar-${s.id}` }); }
    });

    const handleCollectBalance = (s: TelegramSession) => withBusy(async () => {
        try {
            toast.loading('Сбор балансов...', { id: `balance-${s.id}` });
            const res = await telegramService.collectBalance(s.phone_number);
            if (res?.success) {
                const coins = res?.coins_found ?? res?.data?.coins_found;
                const coinsStr = Array.isArray(coins) ? coins.join(', ') : (coins || '—');
                toast.success(res.existing ? `Использован сохранённый баланс: ${coinsStr}` : `Баланс собран: ${coinsStr}`, { id: `balance-${s.id}`, duration: 4000 });

                // Показать баланс в красивом формате в стиле Telegram
                if (res.data) {
                    setModalTitle('💰 Баланс криптовалют');
                    setModalContent(
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '70vh',
                            overflow: 'auto'
                        }}>
                            {Object.entries(res.data).map(([botName, botData]: [string, any]) => (
                                <div key={botName} style={{
                                    background: 'var(--color-bg-card)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--color-border)',
                                    overflow: 'hidden'
                                }}>
                                    {/* Заголовок бота */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        padding: '12px 16px',
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '16px'
                                        }}>
                                            🤖
                                        </div>
                                        <div>
                                            <div>{botName}</div>
                                            {botData.balances && (
                                                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                                                    {botData.balances.length} монет
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Балансы */}
                                    <div style={{ padding: '12px' }}>
                                        {botData.balances && botData.balances.length > 0 ? (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: '8px'
                                            }}>
                                                {botData.balances.map((balance: any, idx: number) => (
                                                    <div key={idx} style={{
                                                        background: 'var(--color-bg-light)',
                                                        borderRadius: '8px',
                                                        padding: '10px 12px',
                                                        border: '1px solid var(--color-border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px'
                                                    }}>
                                                        <div style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '50%',
                                                            background: balance.coin === 'BTC' ? '#f7931a' :
                                                                balance.coin === 'ETH' ? '#627eea' :
                                                                    balance.coin === 'USDT' ? '#26a17b' :
                                                                        balance.coin === 'TON' ? '#0088cc' :
                                                                            '#6c757d',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: '700',
                                                            fontSize: '10px'
                                                        }}>
                                                            {balance.coin?.substring(0, 3) || '?'}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{
                                                                fontWeight: '600',
                                                                fontSize: '13px',
                                                                color: 'var(--color-text-main)',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {balance.coin || 'Неизвестная монета'}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '11px',
                                                                color: 'var(--color-text-second)',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {balance.amount || '0.00'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '20px',
                                                color: 'var(--color-text-second)',
                                                fontSize: '12px'
                                            }}>
                                                Балансы не найдены
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {Object.keys(res.data).length === 0 && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '40px 20px',
                                    color: 'var(--color-text-second)',
                                    fontSize: '14px'
                                }}>
                                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
                                    <div>Криптовалютные боты не найдены</div>
                                </div>
                            )}
                        </div>
                    );
                    setShowModal(true);
                }
            } else if (!maybeOfferAuth(res?.message)) {
                toast.error(res?.message || 'Ошибка сбора баланса', { id: `balance-${s.id}` });
            }
        } catch (e: any) {
            if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка', { id: `balance-${s.id}` });
        }
    });

    const handleExportContactsWithPhotos = (s: TelegramSession) => withBusy(async () => {
        try {
            toast.loading('Экспорт контактов с фото...', { id: `contacts-photos-${s.id}` });
            const res = await telegramService.exportContactsWithPhotos(s.phone_number);
            if (res?.success) {
                const cnt = res?.count ?? res?.data?.count;
                toast.success(res.existing ? `Использованы сохранённые контакты (${cnt ?? '?'})` : `Готово: экспортировано контактов ${cnt ?? '?'}`, { id: `contacts-photos-${s.id}` });
                // Модальное окно списком контактов в стиле Telegram
                if (res.contacts) {
                    setModalTitle('Контакты с фото');
                    setModalContent(
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            maxHeight: '70vh',
                            overflow: 'auto'
                        }}>
                            {res.contacts.slice(0, 500).map((c: any, idx: number) => {
                                // Генерируем цвет аватара на основе ID
                                const colors = [
                                    '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5',
                                    '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                                    '#DDA0DD', '#98D8E8', '#F7DC6F', '#BB8FCE'
                                ];
                                const avatarColor = colors[(c.id || idx) % colors.length];
                                const initials = (c.first_name?.[0] || '') + (c.last_name?.[0] || c.username?.[0] || 'U');
                                const displayName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || c.phone || `User ${c.id || idx}`;

                                return (
                                    <div key={c.id || idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        background: 'var(--color-bg-card)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--color-border)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'var(--color-bg-hover)';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'var(--color-bg-card)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {/* Telegram-подобный аватар с фото или инициалами */}
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: c.photo_base64 ? `url(data:image/jpeg;base64,${c.photo_base64})` : avatarColor,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: '600',
                                            fontSize: '14px',
                                            marginRight: '12px',
                                            flexShrink: 0,
                                            border: '2px solid var(--color-border)'
                                        }}>
                                            {!c.photo_base64 && initials.toUpperCase()}
                                        </div>

                                        {/* Информация о контакте */}
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            flex: 1,
                                            minWidth: 0
                                        }}>
                                            <div style={{
                                                fontWeight: '600',
                                                fontSize: '14px',
                                                color: 'var(--color-text-main)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {displayName}
                                            </div>
                                            <div style={{
                                                fontSize: '12px',
                                                color: 'var(--color-text-second)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {c.username && `@${c.username}`}
                                                {c.username && c.phone && ' • '}
                                                {c.phone}
                                            </div>
                                        </div>

                                        {/* Статус онлайн (если есть) */}
                                        {c.is_online && (
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: '#06FFA5',
                                                marginLeft: '8px',
                                                flexShrink: 0
                                            }} />
                                        )}
                                    </div>
                                );
                            })}
                            {res.contacts.length > 500 && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '16px',
                                    color: 'var(--color-text-second)',
                                    fontSize: '12px'
                                }}>
                                    Показаны первые 500 контактов из {res.contacts.length}
                                </div>
                            )}
                        </div>
                    );
                    setShowModal(true);
                }
            } else if (!maybeOfferAuth(res?.message)) {
                toast.error(res?.message || 'Ошибка экспорта контактов с фото', { id: `contacts-photos-${s.id}` });
            }
        } catch (e: any) {
            if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка', { id: `contacts-photos-${s.id}` });
        }
    });

    const handleSetOrUpdate2FAEmail = (s: TelegramSession) => withBusy(async () => {
        const email = window.prompt('Введите email для 2FA:');
        if (!email) return;
        const mode = window.prompt('Введите new (создать пароль) или update (сменить email):', 'new');
        let new_password: string | undefined = undefined;
        let current_password: string | undefined = undefined;
        if (mode === 'new') new_password = window.prompt('Новый пароль 2FA (будет установлен):') || undefined;
        if (mode === 'update') current_password = window.prompt('Текущий пароль 2FA (для смены email):') || undefined;
        try {
            const res = await telegramService.setOrUpdate2FAEmail(s.phone_number, email, new_password, current_password);
            if (res?.success) toast.success(res?.message || 'Операция 2FA выполнена');
            else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка операции 2FA');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleChangeLoginEmailSend = (s: TelegramSession) => withBusy(async () => {
        const new_email = window.prompt('Введите новый login email:');
        if (!new_email) return;
        try {
            const res = await telegramService.changeLoginEmailSend(s.phone_number, new_email);
            if (res?.success) toast.success(res?.message || 'Код подтверждения отправлен');
            else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка отправки кода');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleChangeLoginEmailVerify = (s: TelegramSession) => withBusy(async () => {
        const new_email = window.prompt('Повторно введите новый email (для проверки):');
        if (!new_email) return;
        const code = window.prompt('Введите код из email:');
        if (!code) return;
        try {
            const res = await telegramService.changeLoginEmailVerify(s.phone_number, new_email, code);
            if (res?.success) toast.success(res?.message || 'Email подтверждён');
            else if (!maybeOfferAuth(res?.message)) toast.error(res?.message || 'Ошибка подтверждения email');
        } catch (e: any) { if (!maybeOfferAuth(e?.response?.data?.message || e?.message)) toast.error(e?.message || 'Ошибка'); }
    });

    const handleAutoChangeLoginEmail = (s: TelegramSession) => withBusy(async () => {
        try {
            toast.loading('Автоматическая смена логин email...', { id: `auto-email-${s.id}` });
            const res = await telegramService.autoChangeLoginEmail(s.phone_number);

            if (res?.success) {
                toast.success(
                    `Email успешно изменен с ${res.old_email || 'не установлен'} на ${res.new_email}`,
                    { id: `auto-email-${s.id}`, duration: 4000 }
                );

                // Обновляем метрики для отображения нового email
                setMetrics((prev) => ({
                    ...prev,
                    [s.phone_number]: {
                        ...(prev[s.phone_number] || {}),
                        login_email_set: true,
                        email_pattern: res.new_email
                    }
                }));
            } else {
                toast.error(res?.message || 'Ошибка смены email', { id: `auto-email-${s.id}` });
            }
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка смены email', { id: `auto-email-${s.id}` });
        }
    });

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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={28} style={{ color: 'var(--color-primary)' }} />
                    <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Катка</h1>
                </div>
                <Button onClick={() => setShowAuthForm(true)}>
                    <Plus size={18} />
                    Добавить сессию
                </Button>
            </div>

            {sessions.length === 0 ? (
                <div style={{
                    background: 'var(--color-bg-card)',
                    borderRadius: 'var(--border-radius-card)',
                    border: 'var(--border)',
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)'
                }}>
                    <Shield size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p>Нет сохраненных сессий</p>
                </div>
            ) : (
                <div style={{
                    display: expanded ? 'block' : 'grid',
                    gridTemplateColumns: expanded ? undefined : 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: expanded ? undefined : '20px',
                    width: '100%'
                }}>
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => { if (!expanded) setExpanded(session.id); }}
                            style={expanded === session.id ? {
                                position: 'fixed',
                                top: '120px', // увеличенный отступ от шапки
                                left: '50%', // центрируем по горизонтали
                                transform: 'translateX(-50%)', // центрируем по горизонтали
                                bottom: '20px', // небольшой отступ снизу
                                background: 'var(--color-bg-card)',
                                border: 'none',
                                padding: '40px',
                                boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
                                zIndex: 1000,
                                overflow: 'auto',
                                cursor: 'default',
                                transition: 'all .3s ease',
                                borderRadius: '20px',
                                // Делаем ширину точно как у контента страницы, не на весь экран
                                width: 'calc(100% - 40px)', // ширина родителя минус отступы
                                maxWidth: '1200px' // максимальная ширина как у основного контента
                            } : {
                                background: 'var(--color-bg-card)',
                                borderRadius: 'var(--border-radius-card)',
                                border: 'var(--border)',
                                padding: '20px',
                                transition: 'all 0.2s',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            {expanded === session.id && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setExpanded(null); }}
                                    style={{
                                        position: 'fixed',
                                        top: '140px', // отступ от верха с учетом увеличенного отступа карточки
                                        right: '30px',
                                        background: 'rgba(0,0,0,0.8)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '50px',
                                        height: '50px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '24px',
                                        zIndex: 1001,
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                                >
                                    <X size={24} />
                                </button>
                            )}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '16px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'var(--color-primary)',
                                    fontWeight: 600
                                }}>
                                    <Phone size={20} />
                                    {session.phone_number}
                                </div>
                                <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: session.is_active
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : 'rgba(239, 68, 68, 0.1)',
                                    color: session.is_active ? '#10b981' : '#ef4444'
                                }}>
                                    {session.is_active ? 'Активна' : 'Неактивна'}
                                </span>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                fontSize: '0.9rem',
                                color: 'var(--color-text-secondary)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(() => {
                                        const profile = profileCache[session.phone_number];
                                        const hasAvatar = profile?.photo_base64;
                                        console.log(`🎭 Профиль для ${session.phone_number}:`, {
                                            exists: !!profile,
                                            hasAvatar: !!hasAvatar,
                                            avatarLength: hasAvatar ? profile.photo_base64.length : 0
                                        });

                                        return hasAvatar ? (
                                            <img
                                                src={`data:image/jpeg;base64,${profile.photo_base64}`}
                                                alt="avatar"
                                                style={{
                                                    width: expanded === session.id ? 64 : 40,
                                                    height: expanded === session.id ? 64 : 40,
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: '3px solid var(--color-primary)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: expanded === session.id ? 64 : 40,
                                                height: expanded === session.id ? 64 : 40,
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontSize: expanded === session.id ? 24 : 16,
                                                fontWeight: 600,
                                                border: '3px solid var(--color-primary)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                            }}>
                                                {session.phone_number.slice(-2)}
                                            </div>
                                        );
                                    })()}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, fontSize: expanded === session.id ? 20 : 16, color: 'var(--color-text-primary)' }}>
                                            {profileCache[session.phone_number]?.username ? `@${profileCache[session.phone_number].username}` : (profileCache[session.phone_number]?.first_name || session.phone_number)}
                                        </span>
                                        {profileCache[session.phone_number]?.first_name && (
                                            <span style={{ fontSize: expanded === session.id ? 16 : 14, opacity: 0.8, color: 'var(--color-text-secondary)' }}>
                                                {profileCache[session.phone_number].first_name} {profileCache[session.phone_number].last_name || ''}
                                            </span>
                                        )}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: 12,
                                            opacity: 0.7,
                                            marginTop: '4px',
                                            color: 'var(--color-text-secondary)'
                                        }}>
                                            <Users size={12} />
                                            <span>Менеджер: {session.creator_full_name || session.created_by_name || 'Неизвестно'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={16} />
                                    <span>{formatDate(session.created_at)}</span>
                                </div>
                                {session.last_used_at && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Activity size={16} />
                                        <span>Последнее использование: {formatDate(session.last_used_at)}</span>
                                    </div>
                                )}
                                {/* Metrics summary */}
                                {metrics[session.phone_number] && (
                                    <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <BarChart2 size={16} />
                                            <span>Контакты: {metrics[session.phone_number]?.contacts_count ?? '-'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FileText size={16} />
                                            <span>Чаты: {metrics[session.phone_number]?.chats_count ?? '-'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <ShieldAlert size={16} />
                                            <span>2FA: {metrics[session.phone_number]?.has_2fa ? 'Вкл' : 'Выкл'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MonitorSmartphone size={16} />
                                            <span>Устройств: {metrics[session.phone_number]?.devices?.length ?? 0}</span>
                                        </div>
                                        {/* Отображение стран всех активных устройств */}
                                        {(() => {
                                            const devs = metrics[session.phone_number]?.devices || [];
                                            const countries = Array.isArray(devs)
                                                ? [...new Set(devs.map((d: any) => d.country).filter(Boolean))]
                                                : [];
                                            return countries.length > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <MapPin size={16} />
                                                    <span>Страны: {countries.join(', ')}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                        {metrics[session.phone_number]?.email_pattern && (
                                            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Mail size={16} />
                                                <span>Email: {metrics[session.phone_number]?.email_pattern}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Expanded detailed info */}
                                {expanded === session.id && (
                                    <div style={{
                                        marginTop: 24,
                                        padding: 20,
                                        border: '2px solid var(--color-primary)',
                                        borderRadius: 16,
                                        background: 'linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-layer) 100%)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                                    }}>
                                        <h3 style={{
                                            margin: '0 0 16px 0',
                                            color: 'var(--color-primary)',
                                            fontSize: 20,
                                            fontWeight: 700,
                                            borderBottom: '2px solid var(--color-primary)',
                                            paddingBottom: '8px'
                                        }}>
                                            Детальная информация
                                        </h3>
                                        {profileCache[session.phone_number] && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                                gap: 16,
                                                marginBottom: 20,
                                                padding: 16,
                                                background: 'var(--color-bg-layer)',
                                                borderRadius: 12,
                                                border: '1px solid var(--color-border)'
                                            }}>
                                                <div style={{ padding: 8 }}>
                                                    <strong style={{ color: 'var(--color-text-primary)' }}>ID:</strong>
                                                    <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>{profileCache[session.phone_number].user_id || '—'}</span>
                                                </div>
                                                <div style={{ padding: 8 }}>
                                                    <strong style={{ color: 'var(--color-text-primary)' }}>Телефон:</strong>
                                                    <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>{profileCache[session.phone_number].phone || session.phone_number}</span>
                                                </div>
                                                <div style={{ padding: 8 }}>
                                                    <strong style={{ color: 'var(--color-text-primary)' }}>Бот:</strong>
                                                    <span style={{ marginLeft: 8, color: profileCache[session.phone_number].is_bot ? '#ef4444' : '#10b981' }}>
                                                        {profileCache[session.phone_number].is_bot ? 'Да' : 'Нет'}
                                                    </span>
                                                </div>
                                                <div style={{ padding: 8 }}>
                                                    <strong style={{ color: 'var(--color-text-primary)' }}>Верификация:</strong>
                                                    <span style={{ marginLeft: 8, color: profileCache[session.phone_number].is_verified ? '#10b981' : '#6b7280' }}>
                                                        {profileCache[session.phone_number].is_verified ? 'Да' : 'Нет'}
                                                    </span>
                                                </div>
                                                <div style={{ padding: 8 }}>
                                                    <strong style={{ color: 'var(--color-text-primary)' }}>Premium:</strong>
                                                    <span style={{ marginLeft: 8, color: profileCache[session.phone_number].is_premium ? '#f59e0b' : '#6b7280' }}>
                                                        {profileCache[session.phone_number].is_premium ? 'Да' : 'Нет'}
                                                    </span>
                                                </div>
                                                {metrics[session.phone_number]?.login_email_set != null && (
                                                    <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <AtSign size={16} color="var(--color-primary)" />
                                                        <strong style={{ color: 'var(--color-text-primary)' }}>Login email:</strong>
                                                        <span style={{ color: metrics[session.phone_number]?.login_email_set ? '#10b981' : '#6b7280' }}>
                                                            {metrics[session.phone_number]?.login_email_set ? 'Установлен' : 'Не установлен'}
                                                        </span>
                                                        {metrics[session.phone_number]?.email_pattern && (
                                                            <span style={{
                                                                marginLeft: 8,
                                                                fontSize: '0.9em',
                                                                color: 'var(--color-text-secondary)',
                                                                fontFamily: 'monospace'
                                                            }}>
                                                                ({metrics[session.phone_number].email_pattern})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {metrics[session.phone_number]?.devices?.length ? (
                                            <div style={{ marginTop: 16 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
                                                    <MonitorSmartphone size={20} /> Активные устройства
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                                                    {metrics[session.phone_number].devices.map((d: any, idx: number) => (
                                                        <div key={idx} style={{
                                                            padding: 16,
                                                            border: '2px solid var(--color-border)',
                                                            borderRadius: 12,
                                                            background: d.current
                                                                ? 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)'
                                                                : 'var(--color-bg-layer)',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                                            position: 'relative'
                                                        }}>
                                                            {d.current && (
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 8,
                                                                    right: 8,
                                                                    background: '#10b981',
                                                                    color: 'white',
                                                                    fontSize: 10,
                                                                    fontWeight: 600,
                                                                    padding: '2px 6px',
                                                                    borderRadius: 4
                                                                }}>
                                                                    ТЕКУЩЕЕ
                                                                </div>
                                                            )}
                                                            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                                                                {d.device_model || d.app_name || 'Неизвестное устройство'}
                                                            </div>
                                                            <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                                                                <strong>Платформа:</strong> {d.platform || '—'}
                                                            </div>
                                                            <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                                                                <strong>Версия системы:</strong> {d.system_version || '—'}
                                                            </div>
                                                            {d.app_version && (
                                                                <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                                                                    <strong>Версия приложения:</strong> {d.app_version}
                                                                </div>
                                                            )}
                                                            {d.country && (
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                    fontSize: 14,
                                                                    marginBottom: 6,
                                                                    color: 'var(--color-primary)',
                                                                    fontWeight: 600
                                                                }}>
                                                                    <MapPin size={14} />
                                                                    <span>{d.country}</span>
                                                                </div>
                                                            )}
                                                            {d.ip && (
                                                                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                                                                    <strong>IP:</strong> {d.ip}
                                                                </div>
                                                            )}
                                                            {d.date_active && (
                                                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                                                    <strong>Активность:</strong> {formatDate(d.date_active)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div style={{
                                            marginTop: 20,
                                            fontSize: 14,
                                            opacity: 0.8,
                                            textAlign: 'center',
                                            padding: 12,
                                            background: 'var(--color-bg-layer)',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            💡 Для закрытия полноэкранного режима нажмите кнопку «✕» в правом верхнем углу
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions: показываем только при развороте карточки */}
                            {expanded === session.id && (
                                <div style={{
                                    marginTop: 24,
                                    padding: 20,
                                    background: 'var(--color-bg-layer)',
                                    borderRadius: 16,
                                    border: '1px solid var(--color-border)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}>
                                    <h3 style={{
                                        margin: '0 0 16px 0',
                                        color: 'var(--color-text-primary)',
                                        fontSize: 18,
                                        fontWeight: 600,
                                        borderBottom: '1px solid var(--color-border)',
                                        paddingBottom: '8px'
                                    }}>
                                        Действия
                                    </h3>

                                    {/* Основные действия */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <Button size="sm" disabled={busy} onClick={() => handleShowInfo(session.phone_number)}>
                                            <Info size={14} />
                                            Профиль
                                        </Button>
                                        <Button size="sm" disabled={busy} onClick={() => handleCheck2FA(session)}>
                                            <ShieldAlert size={14} />
                                            Проверить 2FA
                                        </Button>
                                        <Button size="sm" disabled={busy} onClick={() => handleExportContacts(session)}>
                                            <Users size={14} />
                                            Контакты
                                        </Button>
                                        <Button size="sm" disabled={busy} onClick={() => handleExportChats(session)}>
                                            <FileText size={14} />
                                            Чаты
                                        </Button>
                                        <Button size="sm" disabled={busy} onClick={() => handleExportSaved(session)}>
                                            <MessageSquare size={14} />
                                            Избранное
                                        </Button>
                                    </div>

                                    {/* Дополнительные действия */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <Button size="sm" disabled={busy} onClick={() => handleExportDialog(session)}>
                                            <MessageSquare size={14} />
                                            Диалог
                                        </Button>
                                        <Button size="sm" variant="info" disabled={busy} onClick={() => handleAutomate777000(session)}>
                                            <Shield size={14} />
                                            777000
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleLoginEmailStatus(session)}>
                                            <AtSign size={14} />
                                            Login email статус
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleToggleLog(session)}>
                                            <FileText size={14} />
                                            Лог
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleExportPatterns(session)}>
                                            <Search size={14} />
                                            Паттерны
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleExportAvatar(session)}>
                                            <ImageIcon size={14} />
                                            Аватарка
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleCollectBalance(session)}>
                                            <BarChart2 size={14} />
                                            Баланс
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleExportContactsWithPhotos(session)}>
                                            <Users size={14} />
                                            Контакты+фото
                                        </Button>
                                    </div>

                                    {logOpen[session.phone_number] && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                                session.log {logs[session.phone_number]?.mtime ? `· обновлён: ${new Date(logs[session.phone_number]!.mtime!).toLocaleString('ru-RU')}` : ''}
                                            </div>
                                            <div id={`log-${session.phone_number}`} style={{
                                                height: 180,
                                                overflowY: 'auto',
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 8,
                                                padding: 8,
                                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                fontSize: 12,
                                                whiteSpace: 'pre',
                                            }}>
                                                {logs[session.phone_number]?.text || '—'}
                                            </div>
                                        </div>
                                    )}

                                    {/* Управление безопасностью */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <Button size="sm" variant="warning" disabled={busy} onClick={() => handleTerminateOther(session)}>
                                            <Power size={14} />
                                            Завершить др. сессии
                                        </Button>
                                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleSetOrUpdate2FAEmail(session)}>
                                            <Mail size={14} />
                                            2FA email
                                        </Button>
                                        <Button size="sm" variant="primary" disabled={busy} onClick={() => handleAutoChangeLoginEmail(session)}>
                                            <AtSign size={14} />
                                            Авто смена email
                                        </Button>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleChangeLoginEmailSend(session)} style={{ flex: 1, minWidth: '120px' }}>
                                                <Mail size={14} />
                                                Сменить email
                                            </Button>
                                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleChangeLoginEmailVerify(session)} style={{ flex: 1, minWidth: '120px' }}>
                                                <MailCheck size={14} />
                                                Подтвердить
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Опасные действия */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        paddingTop: '16px',
                                        borderTop: '1px solid var(--color-border)'
                                    }}>
                                        <Button size="sm" variant="warning" disabled={busy} onClick={() => handleDeleteSession(session)}>
                                            <Trash2 size={14} />
                                            Удалить сессию
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Download action (last export) с авторизованной загрузкой */}
                            {downloads[session.id] && (
                                <div style={{ marginTop: 10 }}>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const d = downloads[session.id]!;
                                            handleDownloadFile(d.sessionId, d.fileName);
                                        }}
                                    >
                                        <Download size={14} /> Скачать: {downloads[session.id]!.label}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

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

            {/* Inline export modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 1100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        width: 'min(100%, 900px)', maxHeight: '80vh', overflow: 'auto',
                        background: 'var(--color-bg-card)', border: 'var(--border)', borderRadius: 12, padding: 16
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={18} />
                                <strong>{modalTitle}</strong>
                            </div>
                            <Button size="sm" onClick={() => setShowModal(false)}>Закрыть</Button>
                        </div>

                        {/* Content rendering */}
                        {modalTitle === 'Паттерны' ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                maxHeight: '70vh',
                                overflow: 'auto'
                            }}>
                                {/* Красивый заголовок с иконкой и статистикой */}
                                {patternIndex && !patternSelectedChat && (
                                    <div style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '16px',
                                        padding: '20px',
                                        color: '#fff',
                                        textAlign: 'center',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '-50px',
                                            right: '-50px',
                                            width: '100px',
                                            height: '100px',
                                            background: 'rgba(255,255,255,0.1)',
                                            borderRadius: '50%'
                                        }} />
                                        <div style={{
                                            fontSize: '24px',
                                            marginBottom: '8px'
                                        }}>🔍 Анализ паттернов</div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{patternIndex.length}</div>
                                                <div style={{ fontSize: '12px', opacity: 0.9 }}>чатов</div>
                                            </div>
                                            <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.3)' }} />
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                                                    {patternIndex.reduce((acc, c) => acc + (c.bundles?.length || 0), 0)}
                                                </div>
                                                <div style={{ fontSize: '12px', opacity: 0.9 }}>совпадений</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Фильтры в стиле Telegram */}
                                {patternIndex && !patternSelectedChat && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        background: 'var(--color-bg-card)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '12px'
                                        }}>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: 'var(--color-text-secondary)',
                                                    marginBottom: '6px'
                                                }}>
                                                    🔍 Поиск по названию чата
                                                </label>
                                                <input
                                                    placeholder="Введите название чата..."
                                                    value={patternChatFilter}
                                                    onChange={(e) => setPatternChatFilter(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--color-border)',
                                                        background: 'var(--color-bg)',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s ease'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                                                />
                                            </div>
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    color: 'var(--color-text-secondary)',
                                                    marginBottom: '6px'
                                                }}>
                                                    ✨ Выделение ключевых слов
                                                </label>
                                                <input
                                                    placeholder="Слово для подсветки..."
                                                    value={patternKeywordFilter}
                                                    onChange={(e) => setPatternKeywordFilter(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--color-border)',
                                                        background: 'var(--color-bg)',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                        transition: 'border-color 0.2s ease'
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                                                    onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
                                                />
                                            </div>
                                        </div>
                                        {(patternChatFilter || patternKeywordFilter) && (
                                            <button
                                                onClick={() => {
                                                    setPatternChatFilter('');
                                                    setPatternKeywordFilter('');
                                                }}
                                                style={{
                                                    alignSelf: 'flex-start',
                                                    padding: '6px 12px',
                                                    borderRadius: '20px',
                                                    border: '1px solid var(--color-border)',
                                                    background: 'var(--color-bg)',
                                                    color: 'var(--color-text-secondary)',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--color-bg-hover)';
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'var(--color-bg)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                🗑️ Очистить фильтры
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Список чатов в красивом формате */}
                                {patternIndex && !patternSelectedChat && (
                                    <>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                            gap: '12px'
                                        }}>
                                            {patternIndex
                                                .filter(c => c.chatName.toLowerCase().includes(patternChatFilter.toLowerCase()))
                                                .sort((a, b) => (b.bundles?.length || 0) - (a.bundles?.length || 0))
                                                .slice(0, (patternChatsPage + 1) * PAGE_SIZE)
                                                .map((chat, idx) => {
                                                    // Генерируем иконку на основе названия чата
                                                    const chatIcons = ['💬', '🗣️', '💭', '📢', '🔊', '📡', '🎯', '⭐', '🔥', '💎'];
                                                    const chatIcon = chatIcons[Math.abs(chat.chatId || idx) % chatIcons.length];

                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => { setPatternSelectedChat(chat); setPatternBundlesPage(0); }}
                                                            style={{
                                                                background: 'var(--color-bg-card)',
                                                                borderRadius: '16px',
                                                                border: '1px solid var(--color-border)',
                                                                padding: '16px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.3s ease',
                                                                position: 'relative',
                                                                overflow: 'hidden'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)';
                                                                e.currentTarget.style.borderColor = '#667eea';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.boxShadow = 'none';
                                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                            }}
                                                        >
                                                            {/* Декоративный градиент */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '0',
                                                                right: '0',
                                                                width: '60px',
                                                                height: '60px',
                                                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                                                                borderRadius: '50%',
                                                                transform: 'translate(30px, -30px)'
                                                            }} />

                                                            {/* Иконка и заголовок */}
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                marginBottom: '12px',
                                                                position: 'relative',
                                                                zIndex: 1
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '24px',
                                                                    marginRight: '12px',
                                                                    width: '40px',
                                                                    height: '40px',
                                                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                                    borderRadius: '12px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    {chatIcon}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{
                                                                        fontWeight: '600',
                                                                        fontSize: '16px',
                                                                        color: 'var(--color-text-primary)',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        marginBottom: '4px'
                                                                    }} title={chat.chatName}>
                                                                        {chat.chatName}
                                                                    </div>
                                                                    <div style={{
                                                                        fontSize: '12px',
                                                                        color: 'var(--color-text-secondary)',
                                                                        opacity: 0.8
                                                                    }}>
                                                                        ID: {chat.chatId}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Статистика */}
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                marginBottom: '12px'
                                                            }}>
                                                                <div style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px'
                                                                }}>
                                                                    <div style={{
                                                                        padding: '4px 8px',
                                                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                                        borderRadius: '12px',
                                                                        color: '#fff',
                                                                        fontSize: '12px',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        📊 {chat.bundles?.length || 0} совпадений
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Превью текста */}
                                                            {chat.bundles?.[0]?.textExcerpt && (
                                                                <div style={{
                                                                    fontSize: '13px',
                                                                    color: 'var(--color-text-secondary)',
                                                                    lineHeight: '1.4',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 3,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden',
                                                                    background: 'rgba(102, 126, 234, 0.05)',
                                                                    borderRadius: '8px',
                                                                    padding: '8px',
                                                                    border: '1px solid rgba(102, 126, 234, 0.1)'
                                                                }}>
                                                                    "{chat.bundles[0].textExcerpt}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                            {patternIndex.filter(c => c.chatName.toLowerCase().includes(patternChatFilter.toLowerCase())).length === 0 && (
                                                <div style={{
                                                    gridColumn: '1 / -1',
                                                    textAlign: 'center',
                                                    padding: '40px',
                                                    color: 'var(--color-text-secondary)'
                                                }}>
                                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                                                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                                                        Чаты не найдены
                                                    </div>
                                                    <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                                        Попробуйте изменить фильтр поиска
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {patternIndex.filter(c => c.chatName.toLowerCase().includes(patternChatFilter.toLowerCase())).length > (patternChatsPage + 1) * PAGE_SIZE && (
                                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                                <button
                                                    onClick={() => setPatternChatsPage(p => p + 1)}
                                                    style={{
                                                        padding: '12px 24px',
                                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '24px',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                >
                                                    📥 Показать ещё чаты
                                                </button>
                                            </div>
                                        )}

                                        {patternLoadError && (
                                            <div style={{
                                                background: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)',
                                                color: '#fff',
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                fontSize: '14px',
                                                textAlign: 'center'
                                            }}>
                                                ❌ {patternLoadError}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Список бандлов выбранного чата в красивом формате */}
                                {patternSelectedChat && !patternSelectedMatch && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px'
                                    }}>
                                        {/* Красивый заголовок с кнопкой назад */}
                                        <div style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            color: '#fff',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '-30px',
                                                left: '-30px',
                                                width: '60px',
                                                height: '60px',
                                                background: 'rgba(255,255,255,0.15)',
                                                borderRadius: '50%'
                                            }} />
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                                zIndex: 1
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
                                                        💬 {patternSelectedChat.chatName}
                                                    </div>
                                                    <div style={{ fontSize: '14px', opacity: 0.9 }}>
                                                        📊 Найдено {patternSelectedChat.bundles?.length || 0} совпадений
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { setPatternSelectedChat(null); setPatternBundle(null); }}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.2)',
                                                        border: 'none',
                                                        borderRadius: '12px',
                                                        padding: '10px 16px',
                                                        color: '#fff',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    ← К списку чатов
                                                </button>
                                            </div>
                                        </div>

                                        {/* Фильтры в стиле Telegram */}
                                        <div style={{
                                            background: 'var(--color-bg-card)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            border: '1px solid var(--color-border)'
                                        }}>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                                gap: '12px',
                                                marginBottom: '12px'
                                            }}>
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'var(--color-text-secondary)',
                                                        marginBottom: '6px'
                                                    }}>
                                                        📅 Дата от
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={patternDateFrom}
                                                        onChange={(e) => setPatternDateFrom(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 10px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'var(--color-bg)',
                                                            fontSize: '12px',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'var(--color-text-secondary)',
                                                        marginBottom: '6px'
                                                    }}>
                                                        📅 Дата до
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={patternDateTo}
                                                        onChange={(e) => setPatternDateTo(e.target.value)}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 10px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'var(--color-bg)',
                                                            fontSize: '12px',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{
                                                        display: 'block',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        color: 'var(--color-text-secondary)',
                                                        marginBottom: '6px'
                                                    }}>
                                                        🔍 Ключевое слово
                                                    </label>
                                                    <input
                                                        value={patternKeywordFilter}
                                                        onChange={(e) => setPatternKeywordFilter(e.target.value)}
                                                        placeholder="Поиск по тексту..."
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px 10px',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--color-border)',
                                                            background: 'var(--color-bg)',
                                                            fontSize: '12px',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>
                                                {(patternDateFrom || patternDateTo || patternKeywordFilter) && (
                                                    <div style={{ display: 'flex', alignItems: 'end' }}>
                                                        <button
                                                            onClick={() => {
                                                                setPatternDateFrom('');
                                                                setPatternDateTo('');
                                                                setPatternKeywordFilter('');
                                                            }}
                                                            style={{
                                                                padding: '8px 12px',
                                                                background: 'var(--color-bg)',
                                                                border: '1px solid var(--color-border)',
                                                                borderRadius: '8px',
                                                                fontSize: '12px',
                                                                color: 'var(--color-text-secondary)',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'var(--color-bg-hover)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'var(--color-bg)';
                                                            }}
                                                        >
                                                            🗑️ Сброс
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Список совпадений (бандлов) */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                            gap: '12px'
                                        }}>
                                            {patternSelectedChat.bundles
                                                .filter((b: any) => {
                                                    const dOkFrom = !patternDateFrom || (b.date && b.date >= patternDateFrom);
                                                    const dOkTo = !patternDateTo || (b.date && b.date <= patternDateTo + 'T23:59:59');
                                                    const kwOk = !patternKeywordFilter || (b.textExcerpt && b.textExcerpt.toLowerCase().includes(patternKeywordFilter.toLowerCase()));
                                                    return dOkFrom && dOkTo && kwOk;
                                                })
                                                .slice(0, (patternBundlesPage + 1) * PAGE_SIZE)
                                                .map((b: any, idx: number) => {
                                                    const messageIcons = ['💬', '📝', '💭', '🗨️', '📢'];
                                                    const messageIcon = messageIcons[idx % messageIcons.length];

                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={async () => {
                                                                setPatternSelectedMatch(b.matchId);
                                                                setPatternLoadingBundle(true);
                                                                setPatternBundle(null);
                                                                setPatternBundleError('');
                                                                try {
                                                                    const full = await telegramService.getPatternBundle(patternPhone, patternSelectedChat.chatId, b.matchId);
                                                                    if (full?.success) setPatternBundle(full.bundle);
                                                                    else setPatternBundleError(full?.message || 'Ошибка загрузки бандла');
                                                                } catch (err: any) {
                                                                    setPatternBundleError(err?.message || 'Ошибка загрузки бандла');
                                                                }
                                                                setPatternLoadingBundle(false);
                                                            }}
                                                            style={{
                                                                background: 'var(--color-bg-card)',
                                                                borderRadius: '16px',
                                                                border: '1px solid var(--color-border)',
                                                                padding: '16px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.3s ease',
                                                                position: 'relative',
                                                                overflow: 'hidden'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.15)';
                                                                e.currentTarget.style.borderColor = '#667eea';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.boxShadow = 'none';
                                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                            }}
                                                        >
                                                            {/* Декоративный элемент */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '0',
                                                                right: '0',
                                                                width: '40px',
                                                                height: '40px',
                                                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                                                                borderRadius: '50%',
                                                                transform: 'translate(20px, -20px)'
                                                            }} />

                                                            {/* Заголовок с иконкой */}
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                marginBottom: '12px',
                                                                position: 'relative',
                                                                zIndex: 1
                                                            }}>
                                                                <div style={{
                                                                    fontSize: '20px',
                                                                    marginRight: '12px',
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                                    borderRadius: '10px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    {messageIcon}
                                                                </div>
                                                                <div>
                                                                    <div style={{
                                                                        fontSize: '14px',
                                                                        fontWeight: '600',
                                                                        color: 'var(--color-text-primary)',
                                                                        marginBottom: '2px'
                                                                    }}>
                                                                        Совпадение #{b.matchId}
                                                                    </div>
                                                                    {b.date && (
                                                                        <div style={{
                                                                            fontSize: '12px',
                                                                            color: 'var(--color-text-secondary)'
                                                                        }}>
                                                                            📅 {new Date(b.date).toLocaleDateString('ru-RU', {
                                                                                year: 'numeric',
                                                                                month: 'short',
                                                                                day: 'numeric',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Превью текста */}
                                                            {b.textExcerpt && (
                                                                <div style={{
                                                                    fontSize: '13px',
                                                                    color: 'var(--color-text-secondary)',
                                                                    lineHeight: '1.5',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 4,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    overflow: 'hidden',
                                                                    background: 'rgba(102, 126, 234, 0.05)',
                                                                    borderRadius: '8px',
                                                                    padding: '12px',
                                                                    border: '1px solid rgba(102, 126, 234, 0.1)',
                                                                    position: 'relative'
                                                                }}>
                                                                    <div style={{
                                                                        fontSize: '10px',
                                                                        color: 'var(--color-text-secondary)',
                                                                        marginBottom: '6px',
                                                                        opacity: 0.7
                                                                    }}>
                                                                        📄 Превью сообщения:
                                                                    </div>
                                                                    "{b.textExcerpt}"
                                                                </div>
                                                            )}

                                                            {/* Кнопка действия */}
                                                            <div style={{
                                                                marginTop: '12px',
                                                                textAlign: 'right'
                                                            }}>
                                                                <div style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '6px 12px',
                                                                    background: 'rgba(102, 126, 234, 0.1)',
                                                                    borderRadius: '16px',
                                                                    fontSize: '12px',
                                                                    color: '#667eea',
                                                                    fontWeight: '600'
                                                                }}>
                                                                    👁️ Открыть детали
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                            {/* Пустое состояние */}
                                            {patternSelectedChat.bundles.length === 0 && (
                                                <div style={{
                                                    gridColumn: '1 / -1',
                                                    textAlign: 'center',
                                                    padding: '40px',
                                                    color: 'var(--color-text-secondary)'
                                                }}>
                                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                                                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                                                        Совпадения не найдены
                                                    </div>
                                                    <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                                        В этом чате нет подходящих паттернов
                                                    </div>
                                                </div>
                                            )}

                                            {/* Фильтры не дали результатов */}
                                            {patternSelectedChat.bundles.filter((b: any) => {
                                                const dOkFrom = !patternDateFrom || (b.date && b.date >= patternDateFrom);
                                                const dOkTo = !patternDateTo || (b.date && b.date <= patternDateTo + 'T23:59:59');
                                                const kwOk = !patternKeywordFilter || (b.textExcerpt && b.textExcerpt.toLowerCase().includes(patternKeywordFilter.toLowerCase()));
                                                return dOkFrom && dOkTo && kwOk;
                                            }).length === 0 && patternSelectedChat.bundles.length > 0 && (
                                                    <div style={{
                                                        gridColumn: '1 / -1',
                                                        textAlign: 'center',
                                                        padding: '40px',
                                                        color: 'var(--color-text-secondary)'
                                                    }}>
                                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                                                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                                                            Ничего не найдено
                                                        </div>
                                                        <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                                            Попробуйте изменить параметры фильтрации
                                                        </div>
                                                    </div>
                                                )}
                                        </div>

                                        {/* Кнопка "Показать ещё" */}
                                        {patternSelectedChat.bundles.filter((b: any) => {
                                            const dOkFrom = !patternDateFrom || (b.date && b.date >= patternDateFrom);
                                            const dOkTo = !patternDateTo || (b.date && b.date <= patternDateTo + 'T23:59:59');
                                            const kwOk = !patternKeywordFilter || (b.textExcerpt && b.textExcerpt.toLowerCase().includes(patternKeywordFilter.toLowerCase()));
                                            return dOkFrom && dOkTo && kwOk;
                                        }).length > (patternBundlesPage + 1) * PAGE_SIZE && (
                                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                                    <button
                                                        onClick={() => setPatternBundlesPage(p => p + 1)}
                                                        style={{
                                                            padding: '12px 24px',
                                                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '24px',
                                                            fontSize: '14px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        }}
                                                    >
                                                        📥 Показать ещё совпадения
                                                    </button>
                                                </div>
                                            )}
                                    </div>
                                )}

                                {/* Просмотр конкретного бандла в красивом формате */}
                                {patternSelectedChat && patternSelectedMatch && (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px'
                                    }}>
                                        {/* Красивый заголовок с навигацией */}
                                        <div style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '16px',
                                            padding: '20px',
                                            color: '#fff',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '-40px',
                                                right: '-40px',
                                                width: '80px',
                                                height: '80px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '50%'
                                            }} />
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                                zIndex: 1
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>
                                                        🔍 Детали совпадения #{patternSelectedMatch}
                                                    </div>
                                                    <div style={{ fontSize: '14px', opacity: 0.9 }}>
                                                        💬 Чат: {patternSelectedChat.chatName}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => { setPatternSelectedMatch(null); setPatternBundle(null); }}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.2)',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            padding: '8px 12px',
                                                            color: '#fff',
                                                            fontSize: '13px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                                        }}
                                                    >
                                                        ← К совпадениям
                                                    </button>
                                                    <button
                                                        onClick={() => { setPatternSelectedChat(null); setPatternSelectedMatch(null); setPatternBundle(null); }}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.2)',
                                                            border: 'none',
                                                            borderRadius: '10px',
                                                            padding: '8px 12px',
                                                            color: '#fff',
                                                            fontSize: '13px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                                        }}
                                                    >
                                                        🏠 Все чаты
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Состояние загрузки */}
                                        {patternLoadingBundle && (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '40px',
                                                background: 'var(--color-bg-card)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--color-border)'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                                                    Загрузка сообщений...
                                                </div>
                                                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                                    Получение детальной информации о совпадении
                                                </div>
                                            </div>
                                        )}

                                        {/* Ошибка загрузки */}
                                        {patternBundleError && (
                                            <div style={{
                                                background: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)',
                                                borderRadius: '16px',
                                                padding: '20px',
                                                color: '#fff',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                                                    Ошибка загрузки
                                                </div>
                                                <div style={{ fontSize: '14px', marginBottom: '16px', opacity: 0.9 }}>
                                                    {patternBundleError}
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!patternSelectedMatch || !patternSelectedChat) return;
                                                        setPatternLoadingBundle(true);
                                                        setPatternBundleError('');
                                                        try {
                                                            const full = await telegramService.getPatternBundle(patternPhone, patternSelectedChat.chatId, patternSelectedMatch);
                                                            if (full?.success) setPatternBundle(full.bundle); else setPatternBundleError(full?.message || 'Ошибка повторной загрузки');
                                                        } catch (err: any) {
                                                            setPatternBundleError(err?.message || 'Ошибка повторной загрузки');
                                                        }
                                                        setPatternLoadingBundle(false);
                                                    }}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.2)',
                                                        border: 'none',
                                                        borderRadius: '12px',
                                                        padding: '12px 20px',
                                                        color: '#fff',
                                                        fontSize: '14px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    🔄 Повторить загрузку
                                                </button>
                                            </div>
                                        )}

                                        {/* Успешная загрузка - показ сообщений */}
                                        {patternBundle && !patternBundleError && (
                                            <div style={{
                                                background: 'var(--color-bg-card)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--color-border)',
                                                padding: '20px',
                                                position: 'relative'
                                            }}>
                                                {/* Декоративный элемент */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-20px',
                                                    left: '-20px',
                                                    width: '40px',
                                                    height: '40px',
                                                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))',
                                                    borderRadius: '50%'
                                                }} />

                                                {/* Заголовок секции */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    marginBottom: '20px',
                                                    paddingBottom: '12px',
                                                    borderBottom: '2px solid var(--color-border)',
                                                    position: 'relative',
                                                    zIndex: 1
                                                }}>
                                                    <div style={{
                                                        fontSize: '20px',
                                                        marginRight: '12px',
                                                        width: '36px',
                                                        height: '36px',
                                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                        borderRadius: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        💬
                                                    </div>
                                                    <div>
                                                        <div style={{
                                                            fontSize: '18px',
                                                            fontWeight: '700',
                                                            color: 'var(--color-text-primary)',
                                                            marginBottom: '4px'
                                                        }}>
                                                            Сообщения совпадения
                                                        </div>
                                                        <div style={{
                                                            fontSize: '14px',
                                                            color: 'var(--color-text-secondary)'
                                                        }}>
                                                            {patternKeywordFilter ? `🔍 Подсветка: "${patternKeywordFilter}"` : '📄 Полный текст сообщений'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Компонент просмотра сообщений в стиле Telegram */}
                                                <TelegramChatView
                                                    bundle={patternBundle}
                                                />
                                            </div>
                                        )}

                                        {/* Пустое состояние */}
                                        {!patternLoadingBundle && !patternBundle && !patternBundleError && (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '40px',
                                                background: 'var(--color-bg-card)',
                                                borderRadius: '16px',
                                                border: '1px solid var(--color-border)',
                                                color: 'var(--color-text-secondary)'
                                            }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                                                    Нет данных
                                                </div>
                                                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                                                    Не удалось получить содержимое совпадения
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}
                        {modalContacts ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                maxHeight: '70vh',
                                overflow: 'auto',
                                padding: '8px'
                            }}>
                                {modalContacts.slice(1, 1001).map((row, idx) => {
                                    // Предполагаем структуру: user_id, first_name, last_name, username, phone
                                    const [userId, firstName, lastName, username, phone] = row;
                                    const displayName = `${firstName || ''} ${lastName || ''}`.trim() || username || phone || `User ${userId}`;
                                    const usernameDisplay = username ? `@${username}` : '';

                                    // Генерируем цвет аватара на основе user_id
                                    const colors = [
                                        '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5',
                                        '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                                        '#DDA0DD', '#98D8E8', '#F7DC6F', '#BB8FCE'
                                    ];
                                    const avatarColor = colors[parseInt(userId || '0') % colors.length];
                                    const initials = (firstName?.[0] || '') + (lastName?.[0] || username?.[0] || 'U');

                                    return (
                                        <div key={idx} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            background: 'var(--color-bg-card)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--color-border)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--color-bg-hover)';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'var(--color-bg-card)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            {/* Аватар с инициалами */}
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: avatarColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                fontWeight: 'bold',
                                                fontSize: '18px',
                                                marginRight: '12px',
                                                flexShrink: 0
                                            }}>
                                                {initials.toUpperCase()}
                                            </div>

                                            {/* Информация о контакте */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontWeight: 600,
                                                    fontSize: '16px',
                                                    color: 'var(--color-text-primary)',
                                                    marginBottom: '2px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {displayName}
                                                </div>
                                                <div style={{
                                                    fontSize: '14px',
                                                    color: 'var(--color-text-secondary)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {usernameDisplay}
                                                    {usernameDisplay && phone && ' • '}
                                                    {phone}
                                                </div>
                                            </div>

                                            {/* Статус онлайн (заглушка) */}
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                background: Math.random() > 0.7 ? '#4CAF50' : '#9E9E9E',
                                                marginLeft: '8px',
                                                flexShrink: 0
                                            }} />
                                        </div>
                                    );
                                })}
                                {modalContacts.length > 1001 && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '16px',
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '14px'
                                    }}>
                                        Показаны первые 1000 контактов из {modalContacts.length - 1}
                                    </div>
                                )}
                            </div>
                        ) : modalChats ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
                                {(Array.isArray(modalChats) ? modalChats : []).slice(0, 1000).map((c: any, idx: number) => (
                                    <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.title || 'Без названия'}</div>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>Тип: {c.type || '-'}</div>
                                        {c.participants != null && (
                                            <div style={{ fontSize: 12, opacity: 0.8 }}>Участников: {c.participants}</div>
                                        )}
                                    </div>
                                ))}
                                {(Array.isArray(modalChats) ? modalChats : []).length > 1000 && (
                                    <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-secondary)' }}>Показаны первые 1000 чатов…</div>
                                )}
                            </div>
                        ) : modalContent ? (
                            <div className="text-sm">{modalContent}</div>
                        ) : (
                            renderDialogLike(modalText)
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
