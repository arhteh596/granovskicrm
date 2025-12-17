import { Router } from 'express';
import { uploadDatabase, getDatabases, getWikiDatabases, getDatabaseById, getDatabaseStatistics, assignClientsToManagers, deleteDatabase } from '../controllers/database.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for CSV upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Абсолютный путь к каталогу загрузок CSV: /app/uploads/csv
        const uploadDir = path.join(process.cwd(), 'uploads', 'csv');
        try {
            fs.mkdirSync(uploadDir, { recursive: true });
        } catch (e) {
            return cb(e as Error, uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

router.post('/upload', upload.single('csvFile'), asyncHandler(uploadDatabase));
// Загрузка Баз Wiki: CSV с разделителем ';' и русскими заголовками, маппинг в структуру clients
import { uploadWikiDatabase } from '../controllers/wiki.controller';
router.post('/upload-wiki', upload.single('csvFile'), asyncHandler(uploadWikiDatabase));
router.get('/', asyncHandler(getDatabases));
router.get('/wiki', asyncHandler(getWikiDatabases));
router.get('/:id', asyncHandler(getDatabaseById));
router.get('/:id/statistics', asyncHandler(getDatabaseStatistics));
router.post('/:id/assign', asyncHandler(assignClientsToManagers));
router.delete('/:id', asyncHandler(deleteDatabase));

export default router;
