// Generate VAPID keys for Web Push
// Usage: node scripts/gen-vapid.js
// Copy keys into backend .env (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) and frontend VITE_VAPID_PUBLIC_KEY

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const webPush = require('web-push');
const keys = webPush.generateVAPIDKeys();
console.log(JSON.stringify(keys, null, 2));
