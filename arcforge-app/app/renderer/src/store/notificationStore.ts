/**
 * Notification/toast store — replaces alert() with non-blocking notifications.
 */

import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
}

interface NotificationState {
  items: Notification[];
  add: (type: NotificationType, message: string) => void;
  remove: (id: string) => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  add: (type, message) => {
    const id = `notif-${++nextId}`;
    const item: Notification = { id, type, message, createdAt: Date.now() };
    set((s) => ({ items: [...s.items, item] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((n) => n.id !== id) }));
    }, 5000);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
}));
