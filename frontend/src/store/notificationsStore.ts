import { create } from 'zustand';
import toast from 'react-hot-toast';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
};

interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & { id?: string }) => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clear: () => void;
}

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Helpers for persistence
const STORAGE_KEY = 'crm_notifications_v1';
const loadFromStorage = (): NotificationItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return [];
};
const saveToStorage = (list: NotificationItem[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: loadFromStorage(),
  unreadCount: 0,
  addNotification: (payload) => {
    const id = payload.id ?? genId();
    const item: NotificationItem = {
      id,
      title: payload.title,
      message: payload.message,
      createdAt: Date.now(),
      read: false,
    };
    const list = [item, ...get().notifications].slice(0, 200);
    const unreadCount = list.filter(n => !n.read).length;
    set({ notifications: list, unreadCount });
    saveToStorage(list);
    // Show toast immediately regardless of current page
    try {
      const title = payload.title || 'Уведомление';
      const message = payload.message || '';
      toast(`${title}: ${message}`);
    } catch {}
    // Play contextual sound (only for важные типы уведомлений)
    try {
      const title = (payload.title || '').toLowerCase();
      let src = '';
      if (title.includes('перезвон')) {
        src = '/assets/sounds/callback.mp3';
      } else if (title.includes('передан') || title.includes('переданный клиент')) {
        src = '/assets/sounds/transfer.mp3';
      }
      if (!src) src = '/assets/sounds/notify.mp3';
      const audio = new Audio(src);
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {}

    // Web Notifications API when tab is inactive
    try {
      if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(payload.title || 'Уведомление', {
            body: payload.message || '',
            icon: '/assets/logo-header.png',
            tag: `notif-${id}`
          });
        }
      }
    } catch {}
  },
  markAsRead: (id) => {
    const list = get().notifications.map(n => n.id === id ? { ...n, read: true } : n);
    const unreadCount = list.filter(n => !n.read).length;
    set({ notifications: list, unreadCount });
    saveToStorage(list);
  },
  removeNotification: (id) => {
    const list = get().notifications.filter(n => n.id !== id);
    const unreadCount = list.filter(n => !n.read).length;
    set({ notifications: list, unreadCount });
    saveToStorage(list);
  },
  clear: () => { set({ notifications: [], unreadCount: 0 }); saveToStorage([]); }
}));
