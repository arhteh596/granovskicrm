import express from 'express';
import { getMyNotes, createNote, updateNote, deleteNote } from '../controllers/note.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/my', getMyNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

export default router;
