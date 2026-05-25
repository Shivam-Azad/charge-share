'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface ChargerRow {
  id: string;
  name: string;
  address: string | null;
  power_kw: number | null;
  price_per_kwh: number | null;
  is_available: boolean | null;
  is_verified: boolean | null;
  host_id: string | null;
}

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };

export default function AdminChargersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ChargerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chargers')
      .select('id, name, address, power_kw, price_per_kwh, is_available, is_verified, host_id')
      .order('created_at', { ascending: false })
      .limit(80);
    if (error?.code === '42501') router.replace('/');
    setRows((data ?? []) as ChargerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setVerified = async (id: string, is_verified: boolean) => {
    await supabase.from('chargers').update({ is_verified }).eq('id', id);
    setRows(prev => prev.map(row => row.id === id ? { ...row, is_verified } : row));
  };

  return (
    <main className="min-h-screen pb-28" style={{ background: '#050508' }}>
      <div className="w-full max-w-md mx-auto px-5 pt-12">
        <button onClick={() => router.push('/admin')} className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: '#10b981' }}>Back to Admin</button>
        <h1 className="text-2xl font-black text-white tracking-tight mb-5">Chargers</h1>
        {loading ? (
          <div className="py-20 text-center text-zinc-600 text-xs font-black uppercase tracking-widest">Loading...</div>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.id} className="rounded-[24px] p-5" style={glass}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-black truncate">{row.name}</p>
                    <p className="text-[9px] font-bold mt-1 line-clamp-2" style={{ color: 'rgba(255,255,255,0.3)' }}>{row.address || 'No address'}</p>
                  </div>
                  <span className="text-[8px] font-black uppercase px-2 py-1 h-fit rounded-full"
                    style={{ background: row.is_verified ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)', color: row.is_verified ? '#10b981' : '#fbbf24' }}>
                    {row.is_verified ? 'Approved' : 'Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Power</p>
                    <p className="text-white text-sm font-black">{row.power_kw ?? '-'} kW</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Rate</p>
                    <p className="text-white text-sm font-black">Rs. {row.price_per_kwh ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Status</p>
                    <p className="text-white text-sm font-black">{row.is_available ? 'Live' : 'Offline'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setVerified(row.id, !row.is_verified)}
                  className="w-full mt-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest"
                  style={{ background: row.is_verified ? 'rgba(239,68,68,0.1)' : '#10b981', color: row.is_verified ? '#f87171' : '#000', border: row.is_verified ? '1px solid rgba(239,68,68,0.25)' : 'none' }}
                >
                  {row.is_verified ? 'Revoke Approval' : 'Approve Charger'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
