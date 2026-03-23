/**
 * Notification bar — displays toasts at bottom of screen (VS Code style).
 */

import React from 'react';
import { useNotificationStore } from '../store/notificationStore';

export const NotificationBar: React.FC = () => {
  const items = useNotificationStore((s) => s.items);
  const remove = useNotificationStore((s) => s.remove);

  if (items.length === 0) return null;

  return (
    <div className="arcforge-notification-bar">
      {items.map((n) => (
        <div
          key={n.id}
          className={`arcforge-notification arcforge-notification-${n.type}`}
          role="alert"
        >
          <span className="arcforge-notification-message">{n.message}</span>
          <button
            type="button"
            className="arcforge-notification-close"
            onClick={() => remove(n.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
