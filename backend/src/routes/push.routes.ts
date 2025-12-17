import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import pool from '../config/database';
import { ensureVapidConfigured, sendPushToUser } from '../utils/push';

const router = Router();

router.use(authenticate);

// Save subscription
router.post('/subscribe', async (req: any, res) => {
  ensureVapidConfigured();
  const userId = req.user?.id;
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ success: false, message: 'Invalid subscription' });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'DB error' });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req: any, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ success: false });
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false });
  }
});

// Test push
router.post('/test', async (req: any, res) => {
  const userId = req.user?.id;
  await sendPushToUser(userId, { title: 'Тестовое уведомление', body: 'CRM push работает' });
  return res.json({ success: true });
});

export default router;
