'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

export default function NotificationBell() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }

    const loadUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnread(count ?? 0);
    };

    loadUnread();
    const channel = supabase
      .channel(`notification-bell-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, loadUnread)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  if (!user) return null;

  return (
    <Link
      href="/notifications"
      aria-label="Notifications"
      className="relative w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: unread > 0 ? '#10b981' : 'rgba(255,255,255,0.35)',
      }}
    >
      <Bell size={16} strokeWidth={2.6} />
      {unread > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[8px] font-black"
          style={{ background: '#ef4444', color: 'white', border: '2px solid #050508' }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
