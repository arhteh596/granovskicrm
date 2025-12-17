import { Router } from 'express';
import { getGlobalStatistics, getUserStatistics, getCallsByDate, getManagerCallHistory, getManagerPersonalStats, resetStatistics } from '../controllers/statistics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireManager } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin only routes
router.get('/global', requireAdmin, asyncHandler(getGlobalStatistics));
router.post('/reset', requireAdmin, asyncHandler(resetStatistics));

// Admin and Manager routes with built-in role checks
router.get('/user/:userId', asyncHandler(getUserStatistics));
router.get('/calls-by-date', asyncHandler(getCallsByDate));

// Manager only routes
router.get('/manager/personal', requireManager, asyncHandler(getManagerPersonalStats));
router.get('/manager/call-history', requireManager, asyncHandler(getManagerCallHistory));

export default router;
