import { Router } from 'express';
import {
    getFilters,
    getWikiFilters,
    getFilterById,
    createFilter,
    updateFilter,
    toggleFilter,
    deleteFilter,
    getNextClientByFilter
} from '../controllers/filter.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Все роуты защищены аутентификацией
router.use(authenticate);

router.get('/', getFilters);
router.get('/wiki', getWikiFilters);
router.get('/:id', getFilterById);
router.post('/', createFilter);
router.put('/:id', updateFilter);
router.patch('/:id/toggle', toggleFilter);
router.delete('/:id', deleteFilter);
router.get('/:id/next-client', getNextClientByFilter);

export default router;
