import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
    getMyPageVisibility,
    getAllPageVisibility,
    upsertPageVisibility,
    listAnnouncements,
    getActiveAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    setAnnouncementStatus,
    deleteAnnouncement,
    getStatusButtons,
    createStatusButton,
    updateStatusButton,
    deleteStatusButton,
    updateStatusLayout
} from '../controllers/ui.controller';

const router = Router();

router.use(authenticate);

router.get('/page-visibility', getMyPageVisibility);
router.get('/page-visibility/all', authorize(['admin']), getAllPageVisibility);
router.post('/page-visibility', authorize(['admin']), upsertPageVisibility);

router.get('/announcements/active', getActiveAnnouncements);
router.get('/announcements', authorize(['admin']), listAnnouncements);
router.post('/announcements', authorize(['admin']), createAnnouncement);
router.put('/announcements/:id', authorize(['admin']), updateAnnouncement);
router.patch('/announcements/:id/status', authorize(['admin']), setAnnouncementStatus);
router.delete('/announcements/:id', authorize(['admin']), deleteAnnouncement);

router.get('/status-buttons', getStatusButtons);
router.post('/status-buttons', authorize(['admin']), createStatusButton);
router.put('/status-buttons/:id', authorize(['admin']), updateStatusButton);
router.delete('/status-buttons/:id', authorize(['admin']), deleteStatusButton);
router.patch('/status-layout/:page', authorize(['admin']), updateStatusLayout);

export default router;
