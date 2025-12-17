// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import webPush from 'web-push';
import pool from '../config/database';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_CONTACT_EMAIL || 'mailto:noreply@example.com';

let isConfigured = false;
export const ensureVapidConfigured = () => {
  if (isConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[push] Missing VAPID keys. Push will be disabled.');
    return;
  }
  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  isConfigured = true;
};

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  data?: any;
};

export const sendPushToUser = async (userId: number, payload: PushPayload) => {
  ensureVapidConfigured();
  if (!isConfigured) return;

  const res = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  const rows = res.rows as Array<{ endpoint: string; p256dh: string; auth: string }>;

  const notifications = rows.map((r) => {
    const subscription = {
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth }
    } as any;

    return webPush
      .sendNotification(subscription, JSON.stringify(payload))
      .catch(async (err: any) => {
        // Remove gone subscriptions
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try { await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [r.endpoint]); } catch {}
        } else {
          console.warn('[push] send error:', err?.message || err);
        }
      });
  });

  await Promise.allSettled(notifications);
};
