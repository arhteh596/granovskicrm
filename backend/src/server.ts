import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import clientRoutes from './routes/client.routes';
import callRoutes from './routes/call.routes';
import databaseRoutes from './routes/database.routes';
import statisticsRoutes from './routes/statistics.routes';
import filterRoutes from './routes/filter.routes';
import noteRoutes from './routes/note.routes';
import speechRoutes from './routes/speech.routes';
import telegramRoutes from './telegram/routes/telegram.routes';
import pushRoutes from './routes/push.routes';
import uiRoutes from './routes/ui.routes';
import { errorHandler } from './middleware/error.middleware';
import logger from './utils/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;
// Database configured

// Middleware
// Разрешаем явно заголовок Authorization и почистим CORS-политику, чтобы
// браузер мог отправлять токен в заголовке при кросс-доменных запросах.
app.use(
    cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Authorization'],
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/databases', databaseRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/speeches', speechRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/ui', uiRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
