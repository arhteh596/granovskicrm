import api from './api';

export const noteService = {
    // Получить все заметки пользователя
    getMyNotes: async () => {
        const response = await api.get('/notes/my');
        return response.data;
    },

    // Создать заметку
    createNote: async (clientId: number, noteText: string) => {
        const response = await api.post('/notes', {
            client_id: clientId,
            note_text: noteText
        });
        return response.data;
    },

    // Обновить заметку
    updateNote: async (id: number, noteText: string) => {
        const response = await api.put(`/notes/${id}`, {
            note_text: noteText
        });
        return response.data;
    },

    // Удалить заметку
    deleteNote: async (id: number) => {
        const response = await api.delete(`/notes/${id}`);
        return response.data;
    }
};

export const speechService = {
    // Получить все спичи пользователя
    getMySpeeches: async () => {
        const response = await api.get('/speeches/my');
        return response.data;
    },

    // Создать спич
    createSpeech: async (title: string, content: string, isFavorite = false) => {
        const response = await api.post('/speeches', {
            title,
            content,
            is_favorite: isFavorite
        });
        return response.data;
    },

    // Обновить спич
    updateSpeech: async (id: number, data: { title?: string; content?: string; is_favorite?: boolean }) => {
        const response = await api.put(`/speeches/${id}`, data);
        return response.data;
    },

    // Удалить спич
    deleteSpeech: async (id: number) => {
        const response = await api.delete(`/speeches/${id}`);
        return response.data;
    },

    // Переключить избранное
    toggleFavorite: async (id: number) => {
        const response = await api.patch(`/speeches/${id}/favorite`);
        return response.data;
    }
};
