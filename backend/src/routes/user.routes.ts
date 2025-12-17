import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, updateAvatar, uploadAvatar } from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

// Конфигурация multer для загрузки аватаров
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Абсолютный путь к каталогу загрузок внутри контейнера: /app/uploads/avatars
        const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
        try {
            fs.mkdirSync(uploadDir, { recursive: true });
        } catch (e) {
            return cb(e as Error, uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'));
        }
    }
});

const router = Router();

// All routes require authentication
router.use(authenticate);

// Available for all authenticated users (managers need to see other managers for transfer)
router.get('/', asyncHandler(getAllUsers));
router.get('/:id', asyncHandler(getUserById));

// Avatar routes (admin or self)
router.post('/:id/avatar/upload', upload.single('avatar'), asyncHandler(uploadAvatar));
router.patch('/:id/avatar', asyncHandler(updateAvatar));

// Admin only routes
router.post('/', authorize(['admin']), asyncHandler(createUser));
router.put('/:id', authorize(['admin']), asyncHandler(updateUser));
router.delete('/:id', authorize(['admin']), asyncHandler(deleteUser));

export default router;
