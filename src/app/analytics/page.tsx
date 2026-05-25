'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';
import CO2Card from '@/components/charts/CO2Card';
import EarningsChart from '@/components/charts/EarningsChart';
import UsageHeatmap from '@/components/charts/UsageHeatmap';

type View = 'driver' | 'host';

interface SessionRow {
  id: string;
  charger_id: string | number | null;
  amount_charged: number | null;
  kwh_delivered: number | null;
  started_at: string | null;
  ended_at: string | null;
  driver_id?: string;
  host_id?: string;
}

interface ChargerRow {
  id: string | number;
  name: string;
}

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };

function monthLabel(date: string | null) {
  if (!date) return 'Now';
  return new Date(date).toLocaleDateString('en-IN', { month: 'short' });
}

function buildMonthly(rows: SessionRow[], mode: 'amount' | 'kwh') {
  const map = new Map<string, number>();
  rows.forEach(row => {
    const label = monthLabel(row.ended_at || row.started_at);
    const value = Number(mode === 'amount' ? row.amount_charged : row.kwh_delivered) || 0;
    map.set(label, (map.get(label) ?? 0) + value);
  });
  const points = Array.from(map.entries()).slice(-6).map(([label, value]) => ({ label, value: +value.toFixed(0) }));
  return points.length ? points : [{ label: 'Now', value: 0 }];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>('driver');
  const [loading, setLoading] = useState(true);
  const [driverRows, setDriverRows] = useState<SessionRow[]>([]);
  const [hostRows, setHostRows] = useState<SessionRow[]>([]);
  const [chargerNames, setChargerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/analytics');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const [{ data: driver }, { data: host }] = await Promise.all([
        supabase
          .from('session_requests')
          .select('id, charger_id, amount_charged, kwh_delivered, started_at, ended_at')
          .eq('driver_id', user.id)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
        supabase
          .from('session_requests')
          .select('id, charger_id, amount_charged, kwh_delivered, started_at, ended_at')
          .eq('host_id', user.id)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
      ]);

      const rows = [...(driver ?? []), ...(host ?? [])] as SessionRow[];
      const chargerIds = Array.from(new Set(rows.map(row => row.charger_id).filter(Boolean).map(String)));
      if (chargerIds.length) {
        const { data: chargers } = await supabase.from('chargers').select('id, name').in('id', chargerIds);
        setChargerNames(Object.fromEntries(((chargers ?? []) as ChargerRow[]).map(charger => [String(charger.id), charger.name])));
      }

      setDriverRows((driver ?? []) as SessionRow[]);
      setHostRows((host ?? []) as SessionRow[]);
      setLoading(false);
    };

    load();
  }, [supabase, user]);

  if (authLoading || !user) return <main className="min-h-screen" style={{ background: '#050508' }} />;

  const rows = view === 'driver' ? driverRows : hostRows;
  const totalKwh = rows.reduce((sum, row) => sum + Number(row.kwh_delivered ?? 0), 0);
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount_charged ?? 0), 0);
  const monthly = buildMonthly(rows, 'amount');

  const hourCounts = Array.from({ length: 24 }, () => 0);
  hostRows.forEach(row => {
    if (!row.started_at) return;
    hourCounts[new Date(row.started_at).getHours()] += 1;
  });

  const chargerCounts = rows.reduce<Record<string, number>>((acc, row) => {
    if (!row.charger_id) return acc;
    const id = String(row.charger_id);
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const topChargers = Object.entries(chargerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <main className="min-h-screen pb-32" style={{ background: '#050508' }}>
      <div className="w-full max-w-md mx-auto px-5 pt-12">
        <div className="flex items-center gap-3 mb-7">
          <Link href="/" className="w-10 h-10 rounded-2xl flex items-center justify-center" style={glass} aria-label="Back">
            <ArrowLeft size={16} color="rgba(255,255,255,0.55)" />
          </Link>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.3)' }}>Insights</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 mb-5 p-1 rounded-2xl" style={glass}>
          {(['driver', 'host'] as View[]).map(next => (
            <button
              key={next}
              onClick={() => setView(next)}
              className="py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              style={{ background: view === next ? '#10b981' : 'transparent', color: view === next ? '#000' : 'rgba(255,255,255,0.3)' }}
            >
              {next}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-600 text-xs font-black uppercase tracking-widest">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                [view === 'driver' ? 'Spent' : 'Earned', `Rs. ${totalAmount.toFixed(0)}`, '#10b981'],
                ['Sessions', rows.length, 'white'],
                ['Energy', `${totalKwh.toFixed(1)} kWh`, 'white'],
                [view === 'driver' ? 'Avg Spend' : 'Avg Earn', `Rs. ${rows.length ? (totalAmount / rows.length).toFixed(0) : 0}`, 'white'],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-[24px] p-5" style={glass}>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                  <p className="text-xl font-black" style={{ color: String(color) }}>{value}</p>
                </div>
              ))}
            </div>

            {view === 'driver' && <CO2Card kwh={totalKwh} />}
            <EarningsChart data={monthly} color={view === 'driver' ? '#60a5fa' : '#10b981'} />
            {view === 'host' && <UsageHeatmap hours={hourCounts} />}

            <div className="rounded-[24px] p-5" style={glass}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {view === 'driver' ? 'Favourite Chargers' : 'Per-Charger Breakdown'}
              </p>
              {topChargers.length === 0 ? (
                <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>No completed sessions yet.</p>
              ) : (
                <div className="space-y-3">
                  {topChargers.map(([id, count]) => (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-white text-[11px] font-black truncate max-w-[70%]">{chargerNames[id] || `Charger ${id}`}</span>
                      <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{count} sessions</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm h-16 rounded-3xl flex items-center justify-around z-50"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {[
          { href: '/', label: 'Home', active: false },
          { href: '/explore', label: 'Explore', active: false },
          { href: '/analytics', label: 'Analytics', active: true },
          { href: '/host', label: 'Host', active: false },
          { href: '/wallet', label: 'Wallet', active: false },
        ].map(item => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1">
            {item.active ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} /> : <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>o</span>}
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: item.active ? '#10b981' : 'rgba(255,255,255,0.25)' }}>{item.label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
