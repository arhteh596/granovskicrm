import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Определяем базовый URL API с учётом туннеля и прокси:
// - Если задан VITE_API_URL, гарантируем, что в конце есть "/api".
// - Иначе используем относительный путь "/api" (работает через Vite proxy в dev и через Nginx в prod/через туннель).
const rawEnvUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const normalizedEnvUrl = rawEnvUrl
    ? rawEnvUrl.replace(/\/$/, '') + (rawEnvUrl.endsWith('/api') ? '' : '/api')
    : undefined;
const API_URL = normalizedEnvUrl || '/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// В dev-режиме покажем базовый URL в консоли для диагностики
try {
    // @ts-ignore
    if ((import.meta as any)?.env?.DEV) {
        // eslint-disable-next-line no-console
        console.info('[api] baseURL =', API_URL);
    }
} catch { }

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
