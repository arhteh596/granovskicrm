import { Router } from 'express';
import { login, register, getCurrentUser } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public routes
router.post('/login', asyncHandler(login));

// Protected routes
router.post('/register', authenticate, asyncHandler(register)); // Только для admin
router.get('/me', authenticate, asyncHandler(getCurrentUser));

export default router;
