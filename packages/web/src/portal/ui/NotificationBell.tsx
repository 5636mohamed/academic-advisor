// Cross-cutting in-app notification bell, shared by all three topbars
// (PortalLayout, AdvisorLayout, VpLayout) — one component instead of each
// layout re-implementing the same poll/dropdown/mark-read logic. Polling,
// not a live push connection (this app has no websocket infra anywhere
// else either) — 30s is frequent enough to feel current without hammering
// the API on every render.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Notification, NotificationRole } from '@advisor/shared';
import { IconBell } from './Icons';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function NotificationBell({ role, recipientId, basePath }: { role: NotificationRole; recipientId: string | undefined; basePath: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (!recipientId) return;
    api.notifications(role, recipientId).then(r => {
      setItems(r.notifications);
      setUnreadCount(r.unreadCount);
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, recipientId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openNotification = async (n: Notification) => {
    if (!n.read) {
      await api.markNotificationRead(n.id);
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) navigate(`${basePath}/${n.link}`.replace(/\/{2,}/g, '/'));
  };

  const markAllRead = async () => {
    if (!recipientId) return;
    await api.markAllNotificationsRead(role, recipientId);
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button type="button" className="su-icon-btn" aria-label="Notifications" title="Notifications" onClick={() => { setOpen(o => !o); if (!open) load(); }} style={{ position: 'relative' }}>
        <IconBell width={17} height={17} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, background: 'var(--su-danger)', color: '#fff',
              fontSize: 9.5, fontWeight: 700, lineHeight: '15px', textAlign: 'center', padding: '0 3px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="su-card su-pop"
          style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxWidth: '90vw', maxHeight: 420, overflowY: 'auto', zIndex: 60, padding: 0 }}
        >
          <div className="su-flex su-justify-between su-items-center" style={{ padding: '12px 14px', borderBottom: '1px solid var(--su-border)' }}>
            <span className="su-title" style={{ fontSize: 13.5 }}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="su-icon-btn" style={{ width: 'auto', height: 'auto', padding: '4px 8px', fontSize: 11, borderRadius: 6 }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="su-muted" style={{ padding: 20, textAlign: 'center', fontSize: 12.5 }}>Nothing yet.</div>
          ) : (
            items.map(n => (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--su-border)', cursor: 'pointer',
                  background: n.read ? 'transparent' : 'var(--su-accent-soft)',
                }}
              >
                <div className="su-flex su-justify-between su-items-center" style={{ gap: 8 }}>
                  <b style={{ fontSize: 12.5 }}>{n.title}</b>
                  <span className="su-muted" style={{ fontSize: 10.5, flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
                </div>
                <div className="su-muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
