import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware для проверки роли администратора
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Доступ запрещен. Только для администраторов.'
        });
    }
    next();
};

/**
 * Middleware для проверки роли менеджера
 */
export const requireManager = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'manager') {
        return res.status(403).json({
            success: false,
            message: 'Доступ запрещен. Только для менеджеров.'
        });
    }
    next();
};

/**
 * Middleware для проверки роли администратора или менеджера
 */
export const requireAdminOrManager = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Доступ запрещен. Недостаточно прав.'
        });
    }
    next();
};

/**
 * Middleware для проверки роли закрывателя (zakryv)
 */
export const requireZakryv = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'zakryv') {
        return res.status(403).json({ success: false, message: 'Доступ запрещен. Только для роли zakryv.' });
    }
    next();
};

/**
 * Middleware для проверки роли администратора или zakryv
 */
export const requireAdminOrZakryv = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !['admin', 'zakryv'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Доступ запрещен. Требуется роль admin или zakryv.' });
    }
    next();
};