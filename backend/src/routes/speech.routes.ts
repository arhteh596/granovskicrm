import express from 'express';
import { getMySpeeches, createSpeech, updateSpeech, deleteSpeech, toggleFavorite } from '../controllers/speech.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/my', getMySpeeches);
router.post('/', createSpeech);
router.put('/:id', updateSpeech);
router.delete('/:id', deleteSpeech);
router.patch('/:id/favorite', toggleFavorite);

export default router;
