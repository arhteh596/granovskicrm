import apiClient from './api';
import { LoginRequest, AuthResponse, User } from '../types';
export { noteService, speechService } from './note.service';

export const authService = {
    login: async (credentials: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post('/auth/login', credentials);
        return response.data;
    },

    register: async (userData: any): Promise<any> => {
        const response = await apiClient.post('/auth/register', userData);
        return response.data;
    },

    getCurrentUser: async (): Promise<User> => {
        const response = await apiClient.get('/auth/me');
        return response.data.data;
    },
};

export const userService = {
    getAll: async () => {
        const response = await apiClient.get('/users');
        return response.data.data;
    },

    create: async (userData: any) => {
        const response = await apiClient.post('/users', userData);
        return response.data;
    },

    update: async (id: number, userData: any) => {
        const response = await apiClient.put(`/users/${id}`, userData);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await apiClient.delete(`/users/${id}`);
        return response.data;
    },

    uploadAvatar: async (id: number, file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await apiClient.post(`/users/${id}/avatar/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
};

export const clientService = {
    getAll: async () => {
        const response = await apiClient.get('/clients');
        return response.data.data;
    },

    getMy: async () => {
        const response = await apiClient.get('/clients/my');
        return response.data.data;
    },

    getNext: async () => {
        const response = await apiClient.get('/clients/next');
        return response.data.data;
    },
    getNextWiki: async () => {
        const response = await apiClient.get('/clients/wiki/next');
        return response.data;
    },

    getById: async (id: number) => {
        const response = await apiClient.get(`/clients/${id}`);
        return response.data.data;
    },

    updateStatus: async (id: number, status: string, notes?: string) => {
        const response = await apiClient.patch(`/clients/${id}/status`, {
            call_status: status,
            notes,
        });
        return response.data;
    },

    setCallback: async (id: number, callback_datetime: string, callback_notes?: string) => {
        const response = await apiClient.post(`/clients/${id}/callback`, {
            callback_datetime,
            callback_notes,
        });
        return response.data;
    },

    transferToUser: async (id: number, to_user_id: number, transferred_notes?: string) => {
        const response = await apiClient.post(`/clients/${id}/transfer`, {
            to_user_id,
            transferred_notes,
        });
        return response.data;
    },

    transfer: async (clientId: number, toUserId: number, reason?: string) => {
        const response = await apiClient.post('/clients/transfer', {
            client_id: clientId,
            to_user_id: toUserId,
            reason,
        });
        return response.data;
    },

    getByStatus: async (status: string) => {
        const response = await apiClient.get(`/clients/status/${status}`);
        return response.data;
    },

    getTransferInfo: async (id: number) => {
        const response = await apiClient.get(`/clients/${id}/transfer-info`);
        return response.data;
    },

    returnToWork: async (id: number) => {
        const response = await apiClient.post(`/clients/${id}/return-to-work`);
        return response.data;
    },

    removeFromProfile: async (id: number, section: 'перезвон' | 'передать') => {
        const response = await apiClient.post(`/clients/${id}/profile/remove`, { section });
        return response.data;
    },
};

export const databaseService = {
    getAll: async () => {
        const response = await apiClient.get('/databases');
        return response.data.data;
    },

    getAllWiki: async () => {
        const response = await apiClient.get('/databases/wiki');
        return response.data.data;
    },

    upload: async (formData: FormData) => {
        const response = await apiClient.post('/databases/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },
    uploadWiki: async (formData: FormData) => {
        const response = await apiClient.post('/databases/upload-wiki', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getStatistics: async (databaseId: number) => {
        const response = await apiClient.get(`/databases/${databaseId}/statistics`);
        return response.data;
    },

    assignClients: async (databaseId: number, managerIds: number[], includeAdmin?: boolean) => {
        const response = await apiClient.post(`/databases/${databaseId}/assign`, {
            managerIds,
            includeAdmin,
        });
        return response.data;
    },

    delete: async (id: number) => {
        const response = await apiClient.delete(`/databases/${id}`);
        return response.data;
    },
};

export const statisticsService = {
    getGlobal: async (params?: { date_from?: string; date_to?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.date_from) queryParams.append('start_date', params.date_from);
        if (params?.date_to) queryParams.append('end_date', params.date_to);
        const queryString = queryParams.toString();
        const response = await apiClient.get(`/statistics/global${queryString ? `?${queryString}` : ''}`);
        return response.data.data;
    },

    getUser: async (userId: number) => {
        const response = await apiClient.get(`/statistics/user/${userId}`);
        return response.data.data;
    },

    getCallsByDate: async () => {
        const response = await apiClient.get('/statistics/calls-by-date');
        return response.data.data;
    },

    // Новые методы для менеджеров
    getManagerPersonal: async (params?: { date_from?: string; date_to?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.date_from) queryParams.append('date_from', params.date_from);
        if (params?.date_to) queryParams.append('date_to', params.date_to);

        const queryString = queryParams.toString();
        const url = `/statistics/manager/personal${queryString ? `?${queryString}` : ''}`;

        const response = await apiClient.get(url);
        return response.data.data;
    },

    getManagerCallHistory: async (params?: {
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.date_from) queryParams.append('date_from', params.date_from);
        if (params?.date_to) queryParams.append('date_to', params.date_to);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.offset) queryParams.append('offset', params.offset.toString());

        const queryString = queryParams.toString();
        const url = `/statistics/manager/call-history${queryString ? `?${queryString}` : ''}`;

        const response = await apiClient.get(url);
        return response.data.data;
    },

    resetStatistics: async (payload: { scope: 'day' | 'period' | 'all'; date?: string; start_date?: string; end_date?: string; }) => {
        const response = await apiClient.post('/statistics/reset', payload);
        return response.data;
    },
};

export const filterService = {
    getAll: async () => {
        const response = await apiClient.get('/filters');
        return response.data;
    },

    getAllWiki: async () => {
        const response = await apiClient.get('/filters/wiki');
        return response.data;
    },

    getById: async (id: number) => {
        const response = await apiClient.get(`/filters/${id}`);
        return response.data;
    },

    create: async (filter: any) => {
        const response = await apiClient.post('/filters', filter);
        return response.data;
    },

    update: async (id: number, filter: any) => {
        const response = await apiClient.put(`/filters/${id}`, filter);
        return response.data;
    },

    toggle: async (id: number, is_active: boolean) => {
        const response = await apiClient.patch(`/filters/${id}/toggle`, { is_active });
        return response.data;
    },

    delete: async (id: number) => {
        const response = await apiClient.delete(`/filters/${id}`);
        return response.data;
    },

    getNextClient: async (filterId: number) => {
        const response = await apiClient.get(`/filters/${filterId}/next-client`);
        return response.data;
    },
};

export const uiService = {
    getMyVisibility: async () => {
        const response = await apiClient.get('/ui/page-visibility');
        return response.data;
    },

    getAllVisibility: async () => {
        const response = await apiClient.get('/ui/page-visibility/all');
        return response.data;
    },

    upsertVisibility: async (payload: { role: string; page_key: string; visible: boolean }) => {
        const response = await apiClient.post('/ui/page-visibility', payload);
        return response.data;
    },

    getActiveAnnouncements: async () => {
        const response = await apiClient.get('/ui/announcements/active');
        return response.data;
    },

    listAnnouncements: async () => {
        const response = await apiClient.get('/ui/announcements');
        return response.data;
    },

    createAnnouncement: async (payload: any) => {
        const response = await apiClient.post('/ui/announcements', payload);
        return response.data;
    },

    updateAnnouncement: async (id: number, payload: any) => {
        const response = await apiClient.put(`/ui/announcements/${id}`, payload);
        return response.data;
    },

    setAnnouncementStatus: async (id: number, is_active: boolean) => {
        const response = await apiClient.patch(`/ui/announcements/${id}/status`, { is_active });
        return response.data;
    },

    deleteAnnouncement: async (id: number) => {
        const response = await apiClient.delete(`/ui/announcements/${id}`);
        return response.data;
    },

    getStatusButtons: async (page: 'call' | 'wiki') => {
        const response = await apiClient.get('/ui/status-buttons', { params: { page } });
        return response.data;
    },

    createStatusButton: async (payload: {
        page: string;
        label: string;
        status_value?: string;
        color?: string;
        color_active?: string;
        icon?: string;
        icon_color?: string;
        icon_color_hover?: string;
        border_color?: string;
        border_color_hover?: string;
        action?: string;
        position?: number;
    }) => {
        const response = await apiClient.post('/ui/status-buttons', payload);
        return response.data;
    },

    updateStatusButton: async (id: number, payload: {
        page?: string;
        label?: string;
        status_value?: string;
        color?: string;
        color_active?: string;
        icon?: string;
        icon_color?: string;
        icon_color_hover?: string;
        border_color?: string;
        border_color_hover?: string;
        action?: string;
        position?: number;
    }) => {
        const response = await apiClient.put(`/ui/status-buttons/${id}`, payload);
        return response.data;
    },

    deleteStatusButton: async (id: number) => {
        const response = await apiClient.delete(`/ui/status-buttons/${id}`);
        return response.data;
    },

    updateStatusLayout: async (page: 'call' | 'wiki', columns: number) => {
        const response = await apiClient.patch(`/ui/status-layout/${page}`, { columns });
        return response.data;
    }
};
