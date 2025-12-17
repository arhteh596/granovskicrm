import { Request, Response } from 'express';
import { telegramAuthService } from '../telegram/services/telegramAuth.service';
import { telegramSessionDb } from '../telegram/services/telegramSession.db';

class TelegramController {
    checkConnection = async (req: Request, res: Response) => {
        try {
            const result = await telegramAuthService.checkConnection();
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    sendCode = async (req: Request, res: Response) => {
        const { phone_number, client_id, force_sms } = req.body;
        const userId = (req as any).user.id;
        if (!phone_number) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        try {
            const result = await telegramAuthService.sendCode(phone_number, userId, client_id, force_sms);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    verifyCode = async (req: Request, res: Response) => {
        const { phone_number, code, phone_code_hash } = req.body;
        if (!phone_number || !code || !phone_code_hash) {
            return res.status(400).json({ success: false, message: 'Phone number, code, and phone code hash are required' });
        }
        try {
            const result = await telegramAuthService.verifyCode(phone_number, code, phone_code_hash);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    sendEmailCode = async (req: Request, res: Response) => {
        const { phone_number, phone_code_hash, email } = req.body;
        if (!phone_number || !phone_code_hash || !email) {
            return res.status(400).json({ success: false, message: 'Phone number, phone code hash, and email are required' });
        }
        try {
            const result = await telegramAuthService.sendEmailCode(phone_number, phone_code_hash, email);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    verifyEmailCode = async (req: Request, res: Response) => {
        const { phone_number, phone_code_hash, code } = req.body;
        if (!phone_number || !phone_code_hash || !code) {
            return res.status(400).json({ success: false, message: 'Phone number, phone code hash, and code are required' });
        }
        try {
            const result = await telegramAuthService.verifyEmailCode(phone_number, phone_code_hash, code);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    verifyPassword = async (req: Request, res: Response) => {
        const { phone_number, password } = req.body;
        if (!phone_number || !password) {
            return res.status(400).json({ success: false, message: 'Phone number and password are required' });
        }
        try {
            const result = await telegramAuthService.verifyPassword(phone_number, password);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    getAllSessions = async (req: Request, res: Response) => {
        try {
            const sessions = await telegramSessionDb.getAll();
            res.status(200).json({ success: true, data: sessions });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    getSessionById = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const session = await telegramSessionDb.getById(parseInt(id, 10));
            if (session) {
                res.status(200).json({ success: true, data: session });
            } else {
                res.status(404).json({ success: false, message: 'Session not found' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    deleteSession = async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const success = await telegramAuthService.deleteSession(parseInt(id, 10));
            if (success) {
                res.status(200).json({ success: true, message: 'Session deleted' });
            } else {
                res.status(404).json({ success: false, message: 'Session not found or could not be deleted' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    };

    getSessionHistory = async (req: Request, res: Response) => {
        res.status(501).json({ success: false, message: 'Not implemented' });
    };
}

export const telegramController = new TelegramController();