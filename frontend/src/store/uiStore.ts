import { create } from 'zustand';
import { Announcement, PageVisibilityRule, StatusButton } from '../types';
import { uiService } from '../services';

const defaultVisibility: Record<string, Record<string, boolean>> = {
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

const defaultStatusButtons: Record<'call' | 'wiki', StatusButton[]> = {
    call: [
        { id: 1, page: 'call', label: 'не дозвон', status_value: 'не дозвон', color: '#4b5563', color_active: '#374151', icon: 'phone-missed', action: 'set-status', position: 1 },
        { id: 2, page: 'call', label: 'автоответчик', status_value: 'автоответчик', color: '#2563eb', color_active: '#1d4ed8', icon: 'voicemail', action: 'set-status', position: 2 },
        { id: 3, page: 'call', label: 'питон', status_value: 'питон', color: '#d97706', color_active: '#b45309', icon: 'bot', action: 'set-status', position: 3 },
        { id: 4, page: 'call', label: 'срез', status_value: 'срез', color: '#dc2626', color_active: '#b91c1c', icon: 'alert-circle', action: 'set-status', position: 4 },
        { id: 5, page: 'call', label: 'другой человек', status_value: 'другой человек', color: '#7c3aed', color_active: '#6d28d9', icon: 'user-x', action: 'set-status', position: 5 },
        { id: 6, page: 'call', label: 'перезвон', status_value: 'перезвон', color: '#0ea5e9', color_active: '#0284c7', icon: 'phone-forwarded', action: 'callback', position: 6 },
        { id: 7, page: 'call', label: 'передать', status_value: 'передать', color: '#d4af37', color_active: '#c59f24', icon: 'user-plus', action: 'transfer', position: 7 },
        { id: 8, page: 'call', label: 'взял код', status_value: 'взял код', color: '#059669', color_active: '#047857', icon: 'check-circle-2', action: 'set-status', position: 8 }
    ],
    wiki: [
        { id: 101, page: 'wiki', label: 'не дозвон', status_value: 'не дозвон', color: '#4b5563', color_active: '#374151', icon: 'phone-missed', action: 'set-status', position: 1 },
        { id: 102, page: 'wiki', label: 'автоответчик', status_value: 'автоответчик', color: '#2563eb', color_active: '#1d4ed8', icon: 'voicemail', action: 'set-status', position: 2 },
        { id: 103, page: 'wiki', label: 'питон', status_value: 'питон', color: '#d97706', color_active: '#b45309', icon: 'bot', action: 'set-status', position: 3 },
        { id: 104, page: 'wiki', label: 'срез', status_value: 'срез', color: '#dc2626', color_active: '#b91c1c', icon: 'alert-circle', action: 'set-status', position: 4 },
        { id: 105, page: 'wiki', label: 'другой человек', status_value: 'другой человек', color: '#7c3aed', color_active: '#6d28d9', icon: 'user-x', action: 'set-status', position: 5 },
        { id: 106, page: 'wiki', label: 'перезвон', status_value: 'перезвон', color: '#0ea5e9', color_active: '#0284c7', icon: 'phone-forwarded', action: 'callback', position: 6 },
        { id: 107, page: 'wiki', label: 'передать', status_value: 'передать', color: '#d4af37', color_active: '#c59f24', icon: 'user-plus', action: 'transfer', position: 7 },
        { id: 108, page: 'wiki', label: 'взял код', status_value: 'взял код', color: '#059669', color_active: '#047857', icon: 'check-circle-2', action: 'set-status', position: 8 }
    ]
};

const defaultStatusColumns: Record<'call' | 'wiki', number> = {
    call: 4,
    wiki: 4
};

interface UiState {
    visibility: Record<string, Record<string, boolean>>;
    announcements: Announcement[];
    isLoading: boolean;
    statusButtons: Record<string, StatusButton[]>;
    statusColumns: Record<string, number>;
    fetchVisibility: (role?: string | null) => Promise<void>;
    fetchAnnouncements: () => Promise<void>;
    setVisibility: (role: string, pageKey: string, visible: boolean) => void;
    fetchStatusButtons: (page: 'call' | 'wiki') => Promise<void>;
    createStatusButton: (payload: { page: 'call' | 'wiki'; label: string; status_value?: string; color?: string; action?: string; position?: number }) => Promise<void>;
    updateStatusButton: (id: number, payload: { page?: 'call' | 'wiki'; label?: string; status_value?: string; color?: string; action?: string; position?: number }) => Promise<void>;
    deleteStatusButton: (id: number, page: 'call' | 'wiki') => Promise<void>;
    updateStatusColumns: (page: 'call' | 'wiki', columns: number) => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
    visibility: defaultVisibility,
    announcements: [],
    isLoading: false,
    statusButtons: {
        call: [...defaultStatusButtons.call],
        wiki: [...defaultStatusButtons.wiki]
    },
    statusColumns: { ...defaultStatusColumns },
    fetchVisibility: async (role?: string | null) => {
        if (!role || role === 'admin') return;
        try {
            set({ isLoading: true });
            const response = await uiService.getMyVisibility();
            const rules: PageVisibilityRule[] = response?.rules || [];
            const next = { ...defaultVisibility } as Record<string, Record<string, boolean>>;
            next[role] = { ...(defaultVisibility[role] || {}) };
            rules.forEach((rule) => {
                next[rule.role] = next[rule.role] || { ...defaultVisibility[rule.role] };
                next[rule.role][rule.page_key] = rule.visible;
            });
            set({ visibility: next, isLoading: false });
        } catch (error) {
            console.error('fetchVisibility error', error);
            set({ isLoading: false });
        }
    },
    fetchAnnouncements: async () => {
        try {
            const response = await uiService.getActiveAnnouncements();
            const items: Announcement[] = response?.items || [];
            set({ announcements: items });
        } catch (error) {
            console.error('fetchAnnouncements error', error);
        }
    },
    setVisibility: (role: string, pageKey: string, visible: boolean) => {
        const current = get().visibility;
        const next = { ...current, [role]: { ...(current[role] || {}) } };
        next[role][pageKey] = visible;
        set({ visibility: next });
    },
    fetchStatusButtons: async (page: 'call' | 'wiki') => {
        try {
            const response = await uiService.getStatusButtons(page);
            const buttons: StatusButton[] = response?.buttons || [];
            const columns = response?.columns || defaultStatusColumns[page];
            set((state) => ({
                statusButtons: { ...state.statusButtons, [page]: buttons.length ? buttons : defaultStatusButtons[page] },
                statusColumns: { ...state.statusColumns, [page]: columns }
            }));
        } catch (error) {
            console.error('fetchStatusButtons error', error);
            set((state) => ({
                statusButtons: { ...state.statusButtons, [page]: defaultStatusButtons[page] },
                statusColumns: { ...state.statusColumns, [page]: defaultStatusColumns[page] }
            }));
        }
    },
    createStatusButton: async (payload) => {
        const response = await uiService.createStatusButton(payload);
        const button: StatusButton = response?.button;
        if (button) {
            set((state) => ({
                statusButtons: {
                    ...state.statusButtons,
                    [button.page]: [...(state.statusButtons[button.page] || []), button].sort((a, b) => a.position - b.position)
                }
            }));
        }
    },
    updateStatusButton: async (id, payload) => {
        const response = await uiService.updateStatusButton(id, payload);
        const button: StatusButton = response?.button;
        if (button) {
            set((state) => ({
                statusButtons: Object.keys(state.statusButtons).reduce((acc, key) => {
                    const filtered = (state.statusButtons[key] || []).filter((b) => b.id !== button.id);
                    acc[key] = filtered;
                    return acc;
                }, {} as Record<string, StatusButton[]>),
            }));

            set((state) => ({
                statusButtons: {
                    ...state.statusButtons,
                    [button.page]: [...(state.statusButtons[button.page] || []), button].sort((a, b) => a.position - b.position)
                }
            }));
        }
    },
    deleteStatusButton: async (id, page) => {
        await uiService.deleteStatusButton(id);
        set((state) => ({
            statusButtons: {
                ...state.statusButtons,
                [page]: (state.statusButtons[page] || []).filter((b) => b.id !== id)
            }
        }));
    },
    updateStatusColumns: async (page, columns) => {
        await uiService.updateStatusLayout(page, columns);
        set((state) => ({
            statusColumns: { ...state.statusColumns, [page]: columns }
        }));
    }
}));
