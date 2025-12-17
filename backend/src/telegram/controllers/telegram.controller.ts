import { Request, Response } from 'express';
import { telegramAuthService } from '../services/telegramAuth.service';
import { telegramSessionDb } from '../services/telegramSession.db';
import path from 'path';
import fs from 'fs/promises';
import { SESSION_STORAGE_PATH } from '../config/credentials';
import pool from '../../config/database';
import { TelegramAuthRequest, TelegramCodeRequest, TelegramPasswordRequest } from '../../types';

// --- Сброс 2FA ---
export const resetTwoFactor = async (req: Request, res: Response) => {
    const { phone_number } = req.body;
    if (!phone_number || typeof phone_number !== 'string') {
        return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    }
    try {
        // Инициируем восстановление (код придет на email), одновременно вернем маску email
        const result = await telegramAuthService.request2FARecovery(phone_number);
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message || 'Не удалось запросить восстановление 2FA' });
        }
        res.json({ success: true, masked_email: result.email_pattern || result.maskedEmail, message: result.message || `Код для сброса 2FA отправлен` });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка сброса 2FA' });
    }
};

// --- Смена пароля 2FA ---
export const changeTwoFactorPassword = async (req: Request, res: Response) => {
    const { phone_number, code, new_password, email } = req.body as { phone_number?: string; code?: string; new_password?: string; email?: string };
    if (!phone_number || !code || !new_password) {
        return res.status(400).json({ success: false, message: 'phone_number, code и new_password обязательны' });
    }
    try {
        const result = await telegramAuthService.recover2FASetPassword(phone_number, code, new_password, email);
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message || 'Не удалось установить новый пароль 2FA' });
        }
        res.json({ success: true, message: result.message || 'Пароль 2FA успешно установлен' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка установки пароля 2FA' });
    }
};
// --- Повторная отправка email-кода ---
export const resendEmailCode = async (req: Request, res: Response) => {
    try {
        const { phone_number } = req.body;
        if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
        const r = await telegramAuthService.request2FARecovery(phone_number);
        res.json({ success: r.success, message: r.message || 'Код отправлен повторно', masked_email: r.email_pattern || r.maskedEmail });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка повторной отправки email-кода' });
    }
};

// --- Повторная отправка phone-кода ---
export const resendPhoneCode = async (req: Request, res: Response) => {
    try {
        const { phone_number, force_sms } = req.body as { phone_number: string; force_sms?: boolean };
        if (!phone_number) {
            return res.status(400).json({ success: false, message: 'phone_number обязателен' });
        }
        const userId = (req as any).user?.id;
        const result = await telegramAuthService.sendCode(phone_number, userId, undefined, !!force_sms);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка повторной отправки phone-кода' });
    }
};
// (Импорты перенесены вверх для чистоты структуры)

export const checkConnection = async (req: Request, res: Response) => {
    try {
        const result = await telegramAuthService.checkConnection();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка проверки соединения'
        });
    }
};

export const sendCode = async (req: Request, res: Response) => {
    try {
        const { phone_number, client_id, force_sms } = req.body as TelegramAuthRequest & { force_sms?: boolean };
        const userId = (req as any).user?.id;

        if (!phone_number) {
            return res.status(400).json({ success: false, message: 'Номер телефона обязателен' });
        }

        const result = await telegramAuthService.sendCode(phone_number, userId, client_id, !!force_sms);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка отправки кода' });
    }
};

export const verifyCode = async (req: Request, res: Response) => {
    try {
        const { phone_number, code, phone_code_hash } = req.body as TelegramCodeRequest;

        if (!phone_number || !code || !phone_code_hash) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны'
            });
        }

        const result = await telegramAuthService.verifyCode(phone_number, code, phone_code_hash);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка верификации кода'
        });
    }
};

export const verifyPassword = async (req: Request, res: Response) => {
    try {
        const { phone_number, password } = req.body as TelegramPasswordRequest;

        if (!phone_number || !password) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны'
            });
        }

        const result = await telegramAuthService.verifyPassword(phone_number, password);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка верификации пароля'
        });
    }
};

export const getAllSessions = async (req: Request, res: Response) => {
    try {
        const sessions = await telegramSessionDb.getAllWithUserInfo();
        res.json({
            success: true,
            data: sessions
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка получения сессий'
        });
    }
};

export const getSessionById = async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.id);
        const session = await telegramSessionDb.getById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Сессия не найдена'
            });
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка получения сессии'
        });
    }
};

export const deleteSession = async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.id);
        const success = await telegramAuthService.deleteSession(sessionId);

        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Сессия не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Сессия удалена'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка удаления сессии'
        });
    }
};

export const getSessionHistory = async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.id);
        const history = await telegramSessionDb.getHistory(sessionId);

        res.json({
            success: true,
            data: history
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Ошибка получения истории'
        });
    }
};

// --- Email code handlers (заглушки) ---
export const sendEmailCode = async (req: Request, res: Response) => {
    // TODO: Реализовать отправку email-кода
    const { email } = req.body;
    // TODO: Реализовать отправку email-кода
    res.json({ success: true, sent_to: email, message: `Код отправлен на почту ${email}` });
};

export const verifyEmailCode = async (req: Request, res: Response) => {
    // TODO: Реализовать проверку email-кода
    res.status(501).json({ success: false, message: 'verifyEmailCode не реализован' });
};

// --- Secure download of export files ---
export const downloadExport = async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const fileName = req.params.fileName;
        if (!sessionId || !fileName) {
            return res.status(400).json({ success: false, message: 'Некорректные параметры' });
        }

        const session = await telegramSessionDb.getById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Сессия не найдена' });
        }

        // Файлы экспорта хранятся в: telegram-sessions/<phone>/exports/<fileName>
        const baseDir = path.resolve(process.cwd(), SESSION_STORAGE_PATH);
        const safePhoneDir = path.join(baseDir, session.phone_number);
        const exportsDir = path.join(safePhoneDir, 'exports');

        // Исключаем directory traversal
        const filePath = path.resolve(exportsDir, fileName);
        if (!filePath.startsWith(exportsDir)) {
            return res.status(403).json({ success: false, message: 'Доступ запрещён' });
        }

        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ success: false, message: 'Файл не найден' });
        }

        res.download(filePath, fileName);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || 'Ошибка скачивания файла' });
    }
};

// ---------- Katka control handlers ----------
export const showUserInfo = async (req: Request, res: Response) => {
    const { phone_number } = req.query as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.showUserInfo(String(phone_number));
    res.status(result.success ? 200 : 400).json(result);
};

export const exportContactsCsv = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.exportContactsCsv(phone_number, (req as any).user?.id);
    if (result?.success) {
        const session = await telegramSessionDb.findByPhone(phone_number);
        const downloadUrl = session ? `/api/telegram/exports/${session.id}/${result.file_name}` : undefined;
        return res.json({ ...result, downloadUrl, sessionId: session?.id });
    }
    return res.status(400).json(result);
};

export const terminateOtherSessions = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.terminateOtherSessions(phone_number);
    res.status(result.success ? 200 : 400).json(result);
};

export const exportChatsJson = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.exportChatsJson(phone_number, (req as any).user?.id);
    if (result?.success) {
        const session = await telegramSessionDb.findByPhone(phone_number);
        const downloadUrl = session ? `/api/telegram/exports/${session.id}/${result.file_name}` : undefined;
        return res.json({ ...result, downloadUrl, sessionId: session?.id });
    }
    return res.status(400).json(result);
};

export const exportSavedMessages = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.exportSavedMessages(phone_number, (req as any).user?.id);
    if (result?.success) {
        const session = await telegramSessionDb.findByPhone(phone_number);
        const downloadUrl = session ? `/api/telegram/exports/${session.id}/${result.file_name}` : undefined;
        return res.json({ ...result, downloadUrl, sessionId: session?.id });
    }
    return res.status(400).json(result);
};

export const exportDialogWithUser = async (req: Request, res: Response) => {
    const { phone_number, peer } = req.body as any;
    if (!phone_number || !peer) return res.status(400).json({ success: false, message: 'phone_number и peer обязательны' });
    const result = await telegramAuthService.exportDialogWithUser(phone_number, peer, (req as any).user?.id);
    if (result?.success) {
        const session = await telegramSessionDb.findByPhone(phone_number);
        const downloadUrl = session ? `/api/telegram/exports/${session.id}/${result.file_name}` : undefined;
        return res.json({ ...result, downloadUrl, sessionId: session?.id });
    }
    return res.status(400).json(result);
};

export const check2FAStatus = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    const result = await telegramAuthService.check2FAStatus(String(phone));
    res.status(result.success ? 200 : 400).json(result);
};

export const automate777000 = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    const result = await telegramAuthService.automate777000(phone_number);
    res.status(result.success ? 200 : 400).json(result);
};

export const setOrUpdate2FAEmail = async (req: Request, res: Response) => {
    const { phone_number, new_password, current_password, email } = req.body as any;
    if (!phone_number || !email) return res.status(400).json({ success: false, message: 'phone_number и email обязательны' });
    const result = await telegramAuthService.setOrUpdate2FAEmail(phone_number, { new_password, current_password, email });
    res.status(result.success ? 200 : 400).json(result);
};

export const changeLoginEmailSend = async (req: Request, res: Response) => {
    const { phone_number, new_email } = req.body as any;
    if (!phone_number || !new_email) return res.status(400).json({ success: false, message: 'phone_number и new_email обязательны' });
    const result = await telegramAuthService.changeLoginEmailSend(phone_number, new_email);
    res.status(result.success ? 200 : 400).json(result);
};

export const changeLoginEmailVerify = async (req: Request, res: Response) => {
    const { phone_number, new_email, code } = req.body as any;
    if (!phone_number || !new_email || !code) return res.status(400).json({ success: false, message: 'phone_number, new_email и code обязательны' });
    const result = await telegramAuthService.changeLoginEmailVerify(phone_number, new_email, code);
    res.status(result.success ? 200 : 400).json(result);
};

// Session metrics for Katka cards
export const getSessionMetrics = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    const result = await telegramAuthService.getSessionMetrics(String(phone));
    res.status(result.success ? 200 : 400).json(result);
};

export const getLoginEmailStatus = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    const result = await telegramAuthService.getLoginEmailStatus(String(phone));
    res.status(result.success ? 200 : 400).json(result);
};

// Последние экспортные файлы (без перегенерации)
export const getLastExports = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    const result = await telegramAuthService.getLastExports(String(phone));
    res.status(200).json(result);
};

// Автоматическая смена логин email
export const autoChangeLoginEmail = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });

    try {
        const result = await telegramAuthService.autoChangeLoginEmail(phone_number, (req as any).user?.id);
        return res.json(result);
    } catch (error: any) {
        console.error('Ошибка автоматической смены email:', error);
        return res.status(500).json({
            success: false,
            message: `Ошибка смены email: ${error.message}`
        });
    }
};

// --- Katka: patterns export ---
export const exportPatterns = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    try {
        const result = await telegramAuthService.exportPatterns(phone_number, (req as any).user?.id);
        return res.status(result?.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка экспорта паттернов' });
    }
};

// --- Katka: patterns index (list bundles) ---
export const getPatternsIndex = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    try {
        const result = await telegramAuthService.getPatternsIndex(String(phone));
        return res.status(200).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка получения индекса паттернов' });
    }
};

// --- Katka: single pattern bundle details ---
export const getPatternBundle = async (req: Request, res: Response) => {
    const { phone, chatId, matchId } = req.params as any;
    if (!phone || !chatId || !matchId) return res.status(400).json({ success: false, message: 'phone, chatId, matchId обязательны' });
    try {
        const result = await telegramAuthService.getPatternBundle(String(phone), String(chatId), String(matchId));
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка получения бандла паттернов' });
    }
};

// --- Katka: avatar export ---
export const exportAvatar = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    try {
        const result = await telegramAuthService.exportAvatar(phone_number);
        return res.status(result?.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка экспорта аватарки' });
    }
};

// --- Katka: collect balance ---
export const collectBalance = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    try {
        const result = await telegramAuthService.collectBalance(phone_number, (req as any).user?.id);
        return res.status(result?.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка сбора баланса' });
    }
};

// --- Katka: export contacts with photos ---
export const exportContactsWithPhotos = async (req: Request, res: Response) => {
    const { phone_number } = req.body as any;
    if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number обязателен' });
    try {
        const result = await telegramAuthService.exportContactsWithPhotos(phone_number, (req as any).user?.id);
        return res.status(result?.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка экспорта контактов с фото' });
    }
};

// --- Katka: session.log tail ---
export const getSessionLog = async (req: Request, res: Response) => {
    const { phone } = req.params as any;
    const lines = Math.max(1, Math.min(parseInt(String((req.query as any)?.lines || '500'), 10) || 500, 5000));
    if (!phone) return res.status(400).json({ success: false, message: 'phone обязателен' });
    try {
        const result = await telegramAuthService.getSessionLog(String(phone), lines);
        return res.status(result?.success ? 200 : 400).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Ошибка чтения лога' });
    }
};
