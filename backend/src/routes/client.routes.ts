import { Router } from 'express';
import {
    getAllClients,
    getMyClients,
    getNextClient,
    getClientById,
    updateClientStatus,
    getClientsByStatus,
    transferClient,
    getClientNotes,
    addClientNote,
    setClientCallback,
    transferClientToUser,
    returnClientToWork,
    removeClientFromProfile
} from '../controllers/client.controller';
import { getClientTransferInfo } from '../controllers/client.controller';
import { getNextWikiClient } from '../controllers/wiki.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', asyncHandler(getAllClients));
router.get('/my', asyncHandler(getMyClients));
router.get('/next', asyncHandler(getNextClient));
router.get('/wiki/next', asyncHandler(getNextWikiClient));
router.get('/status/:status', asyncHandler(getClientsByStatus));
router.post('/transfer', asyncHandler(transferClient));

// Роуты с :id/подпуть должны быть ПЕРЕД общим /:id
router.get('/:id/notes', asyncHandler(getClientNotes));
router.get('/:id/transfer-info', asyncHandler(getClientTransferInfo));
router.post('/:id/notes', asyncHandler(addClientNote));
router.post('/:id/callback', asyncHandler(setClientCallback));
router.post('/:id/transfer', asyncHandler(transferClientToUser));
router.post('/:id/return-to-work', asyncHandler(returnClientToWork));
router.post('/:id/profile/remove', asyncHandler(removeClientFromProfile));
router.patch('/:id/status', asyncHandler(updateClientStatus));

// Общий роут /:id должен быть ПОСЛЕДНИМ
router.get('/:id', asyncHandler(getClientById));

export default router;
