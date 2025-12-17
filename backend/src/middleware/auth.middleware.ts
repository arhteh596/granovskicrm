import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        console.log('[AUTH] Authorization header:', authHeader ? 'present' : 'missing');
        console.log('[AUTH] JWT_SECRET exists:', !!process.env.JWT_SECRET);

        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            console.log('[AUTH] No token provided');
            throw new AppError('No token provided', 401);
        }

        console.log('[AUTH] Token (first 20 chars):', token.substring(0, 20));
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        console.log('[AUTH] Token verified successfully for user:', decoded.username);
        req.user = decoded;
        next();
    } catch (error) {
        console.log('[AUTH] Token verification failed:', error instanceof Error ? error.message : 'Unknown error');
        next(new AppError('Invalid or expired token', 401));
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError('Insufficient permissions', 403));
        }

        next();
    };
};
