import api from './api';

export interface CallFilter {
    id: number;
    name: string;
    database_ids: number[];
    user_ids: number[] | null;
    statuses: string[] | null;
    created_by: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    databaseNames?: string[];
    usernames?: string[];
    created_by_username?: string;
}

export interface CreateFilterDto {
    name: string;
    database_ids: number[];
    user_ids?: number[];
    statuses?: string[];
}

const filterService = {
    // Получить все фильтры
    getAll: async (): Promise<CallFilter[]> => {
        const response = await api.get('/filters');
        return response.data;
    },

    // Получить фильтр по ID
    getById: async (id: number): Promise<CallFilter> => {
        const response = await api.get(`/filters/${id}`);
        return response.data;
    },

    // Создать новый фильтр
    create: async (filter: CreateFilterDto): Promise<CallFilter> => {
        const response = await api.post('/filters', filter);
        return response.data;
    },

    // Обновить фильтр
    update: async (id: number, filter: Partial<CreateFilterDto>): Promise<CallFilter> => {
        const response = await api.put(`/filters/${id}`, filter);
        return response.data;
    },

    // Удалить фильтр
    delete: async (id: number): Promise<void> => {
        await api.delete(`/filters/${id}`);
    },

    // Получить следующего клиента по фильтру
    getNextClient: async (filterId: number): Promise<any> => {
        const response = await api.get(`/filters/${filterId}/next-client`);
        return response.data;
    }
};

export default filterService;
