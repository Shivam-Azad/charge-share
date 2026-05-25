'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

interface NotificationRow {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  read: boolean;
  data: { session_id?: string; [key: string]: unknown } | null;
  created_at: string;
}

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const loadItems = async () => {
    if (!user) return;
    setLoadingItems(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read, data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data ?? []) as NotificationRow[]);
    setLoadingItems(false);
  };

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/notifications');
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    loadItems();
    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, loadItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setItems(prev => prev.map(item => ({ ...item, read: true })));
  };

  const openNotification = async (item: NotificationRow) => {
    await supabase.from('notifications').update({ read: true }).eq('id', item.id);
    const sessionId = item.data?.session_id;
    if (sessionId) router.push(`/session/${sessionId}`);
    else setItems(prev => prev.map(row => row.id === item.id ? { ...row, read: true } : row));
  };

  if (loading || !user) {
    return <main className="min-h-screen" style={{ background: '#050508' }} />;
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: '#050508' }}>
      <div className="w-full max-w-md mx-auto px-5 pt-12">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={glass}
              aria-label="Back"
            >
              <ArrowLeft size={16} color="rgba(255,255,255,0.55)" />
            </Link>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.3)' }}>Alerts</p>
              <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
            </div>
          </div>
          <button
            onClick={markAllRead}
            className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
            style={glass}
            aria-label="Mark all read"
          >
            <CheckCheck size={16} color="#10b981" />
          </button>
        </div>

        {loadingItems ? (
          <div className="py-20 text-center">
            <div className="w-7 h-7 rounded-full border-2 border-t-emerald-500 animate-spin mx-auto mb-3"
              style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center rounded-[32px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
            <Bell size={28} className="mx-auto mb-4" color="rgba(255,255,255,0.18)" />
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => openNotification(item)}
                className="w-full text-left rounded-[24px] p-4 active:scale-[0.99] transition-all"
                style={{
                  ...glass,
                  border: item.read ? glass.border : '1px solid rgba(16,185,129,0.25)',
                  background: item.read ? glass.background : 'rgba(16,185,129,0.07)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: item.read ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.13)' }}
                  >
                    <Bell size={15} color={item.read ? 'rgba(255,255,255,0.35)' : '#10b981'} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-white text-sm font-black truncate">{item.title}</span>
                      {!item.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />}
                    </span>
                    {item.body && <span className="block text-[10px] font-bold mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{item.body}</span>}
                    <span className="block text-[8px] font-black uppercase tracking-widest mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
