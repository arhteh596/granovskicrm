import { Router } from 'express';
import {
    getAllCallHistory,
    getUserCallHistory,
    getClientCallHistory,
    getCallStatsByStatus,
    getCallStatsByDay,
    deleteCallHistoryRecord
} from '../controllers/call.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', authorize(['admin']), asyncHandler(getAllCallHistory));
router.get('/client/:clientId', asyncHandler(getClientCallHistory));
router.get('/user/:userId', asyncHandler(getUserCallHistory));
router.get('/stats/by-status', asyncHandler(getCallStatsByStatus));
router.get('/stats/by-day', asyncHandler(getCallStatsByDay));
router.delete('/:id', authorize(['admin']), asyncHandler(deleteCallHistoryRecord));

export default router;
