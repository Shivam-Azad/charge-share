'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface ProfileRow {
  id: string;
  full_name: string | null;
  mobile_number: string | null;
  city: string | null;
  rating: number | null;
  flagged: boolean | null;
  flag_reason: string | null;
  banned: boolean | null;
  vehicle_verified: boolean | null;
  vehicle_reg_number: string | null;
}

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };

export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let request = supabase
      .from('profiles')
      .select('id, full_name, mobile_number, city, rating, flagged, flag_reason, banned, vehicle_verified, vehicle_reg_number')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (query.trim()) {
      request = request.or(`full_name.ilike.%${query.trim()}%,mobile_number.ilike.%${query.trim()}%,vehicle_reg_number.ilike.%${query.trim()}%`);
    }

    const { data, error } = await request;
    if (error?.code === '42501') router.replace('/');
    setRows((data ?? []) as ProfileRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const setBan = async (id: string, banned: boolean) => {
    await supabase.from('profiles').update({ banned, flagged: banned ? true : false, flag_reason: banned ? 'Admin ban' : null }).eq('id', id);
    setRows(prev => prev.map(row => row.id === id ? { ...row, banned, flagged: banned, flag_reason: banned ? 'Admin ban' : null } : row));
  };

  return (
    <main className="min-h-screen pb-28" style={{ background: '#050508' }}>
      <div className="w-full max-w-md mx-auto px-5 pt-12">
        <button onClick={() => router.push('/admin')} className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: '#10b981' }}>Back to Admin</button>
        <h1 className="text-2xl font-black text-white tracking-tight mb-5">Users</h1>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, mobile, registration"
          className="w-full rounded-2xl px-4 py-3.5 text-white text-sm font-bold outline-none mb-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />
        {loading ? (
          <div className="py-20 text-center text-zinc-600 text-xs font-black uppercase tracking-widest">Loading...</div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="rounded-[24px] p-5" style={glass}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-black truncate">{row.full_name || 'Unnamed User'}</p>
                    <p className="text-[9px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {row.mobile_number ? `+91 ${row.mobile_number}` : row.city || row.id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="text-[8px] font-black uppercase px-2 py-1 h-fit rounded-full"
                    style={{ background: row.flagged ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)', color: row.flagged ? '#f87171' : '#10b981' }}>
                    {row.flagged ? 'Flagged' : 'Clear'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Rating</p>
                    <p className="text-white text-sm font-black">{Number(row.rating ?? 0).toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Vehicle</p>
                    <p className="text-white text-[10px] font-black font-mono">{row.vehicle_reg_number || 'Not added'} {row.vehicle_verified ? 'Verified' : ''}</p>
                  </div>
                </div>
                {row.flag_reason && <p className="text-[9px] font-bold mt-3 text-red-300">{row.flag_reason}</p>}
                <button
                  onClick={() => setBan(row.id, !row.banned)}
                  className="w-full mt-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest"
                  style={{ background: row.banned ? '#10b981' : 'rgba(239,68,68,0.1)', color: row.banned ? '#000' : '#f87171', border: row.banned ? 'none' : '1px solid rgba(239,68,68,0.25)' }}
                >
                  {row.banned ? 'Unban User' : 'Ban User'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
