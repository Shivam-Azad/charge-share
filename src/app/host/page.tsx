'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

const PLUG_TYPES = ['CCS2', 'Type 2', 'CHAdeMO', 'Type 1', 'Bharat AC-001', 'Bharat DC-001'];
const POWER_OPTIONS = ['3.3 kW', '7.4 kW', '11 kW', '22 kW', '50 kW', '100 kW', '150 kW'];

type Tab = 'requests' | 'active' | 'dashboard' | 'listings' | 'add';

interface HostListing { id: string; name: string; address: string; plug_types: string[]; power_kw: number; price_per_kwh: number; is_available: boolean; }
interface SessionRequest { id: string; charger_id: number; driver_id: string; status: string; requested_at: string; approved_at: string | null; started_at: string | null; hold_amount: number; rate_per_kwh: number; time_limit_mins: number; kwh_delivered?: number; amount_charged?: number; driver_name?: string; vehicle_reg?: string; charger_name?: string; }
interface EarningRow { id: string; charger_name: string; driver_name: string; kwh: number; earned: number; date: string; }

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, fontWeight: 700, outline: 'none' };

function RatingModal({ driverName, onSubmit, onSkip }: { driverName: string; onSubmit: (score: number, comment: string) => void; onSkip: () => void; }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-md rounded-[32px] p-6 space-y-5 animate-in slide-in-from-bottom-8 duration-300"
        style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#10b981' }}>Session Ended</p>
          <h2 className="text-white text-xl font-black">Rate the Driver</h2>
          <p className="text-[10px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{driverName}</p>
        </div>
        <div className="flex justify-center gap-3">
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setScore(s)}
              className={`text-3xl transition-all active:scale-90 ${s <= score ? 'opacity-100' : 'opacity-25'}`}>⭐</button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment..." rows={2}
          style={{ ...inputStyle, resize: 'none' } as any} />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onSkip} className="py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>Skip</button>
          <button onClick={() => score > 0 && onSubmit(score, comment)} disabled={score === 0}
            className="py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-30"
            style={{ background: '#10b981', color: '#000', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>Submit</button>
        </div>
      </div>
    </div>
  );
}

export default function HostPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;

  const [tab, setTab] = useState<Tab>('requests');
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [pendingRequests, setPendingRequests] = useState<SessionRequest[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveLoading, setAutoApproveLoading] = useState(false);
  const [earningsHistory, setEarningsHistory] = useState<EarningRow[]>([]);
  const [ratingTarget, setRatingTarget] = useState<{ sessionId: string; driverId: string; driverName: string; } | null>(null);
  const [stats, setStats] = useState({ totalEarnings: 0, totalSessions: 0, activeListings: 0 });
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', plug_types: [] as string[], power_kw: '7.4', price_per_kwh: '12', description: '', is_available: true });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('auto_approve').eq('id', user.id).single()
      .then(({ data }) => { if (data) setAutoApprove(data.auto_approve ?? false); });
  }, [user]);

  const handleAutoApproveToggle = async () => {
    if (!user || autoApproveLoading) return;
    const next = !autoApprove;
    setAutoApprove(next);
    setAutoApproveLoading(true);
    await supabase.from('profiles').update({ auto_approve: next }).eq('id', user.id);
    setAutoApproveLoading(false);
    showToast(next ? '✓ Auto-approve enabled' : '✓ Auto-approve disabled');
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from('chargers').select('*').eq('host_id', user.id).then(({ data }) => {
      if (data) { setListings(data as HostListing[]); setStats(s => ({ ...s, activeListings: data.filter((c: any) => c.is_available).length })); }
      setLoading(false);
    });
  }, [user]);

  const enrichRequest = async (req: any): Promise<SessionRequest> => {
    const [{ data: profile }, { data: charger }] = await Promise.all([
      supabase.from('profiles').select('full_name, vehicle_reg_number, mobile_number').eq('id', req.driver_id).single(),
      supabase.from('chargers').select('name').eq('id', req.charger_id).single(),
    ]);
    let driverName = profile?.full_name?.trim() || (profile?.mobile_number ? `+91 ${profile.mobile_number}` : null);
    if (!driverName) {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: req.driver_id });
      driverName = email ? email.split('@')[0] : `Driver …${req.driver_id.slice(-8)}`;
    }
    return { ...req, driver_name: driverName, vehicle_reg: profile?.vehicle_reg_number || null, charger_name: charger?.name || 'Your Charger' };
  };

  const loadRequests = async () => {
    if (!user) return;
    await supabase.rpc('cancel_stale_sessions');
    const { data, error } = await supabase.from('session_requests').select('*').eq('host_id', user.id).in('status', ['pending', 'approved', 'en_route', 'active']).order('requested_at', { ascending: false });
    if (error || !data) return;
    const enriched = await Promise.all(data.map(enrichRequest));
    setPendingRequests(enriched.filter(r => r.status === 'pending'));
    setActiveSessions(enriched.filter(r => ['approved', 'en_route', 'active'].includes(r.status)));
  };

  useEffect(() => { loadRequests(); }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('session_requests').select('id, amount_charged, kwh_delivered, ended_at, charger_id, driver_id').eq('host_id', user.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(20)
      .then(async ({ data }) => {
        if (!data?.length) return;
        const total = data.reduce((s, r) => s + (r.amount_charged || 0), 0);
        setStats(s => ({ ...s, totalEarnings: +total.toFixed(0), totalSessions: data.length }));
        const enriched = await Promise.all(data.map(async (r) => {
          const [{ data: ch }, { data: profile }] = await Promise.all([
            supabase.from('chargers').select('name').eq('id', r.charger_id).single(),
            supabase.from('profiles').select('full_name, mobile_number').eq('id', r.driver_id).single(),
          ]);
          return { id: r.id, charger_name: ch?.name || 'Your Charger', driver_name: profile?.full_name?.trim() || (profile?.mobile_number ? `+91 ${profile.mobile_number}` : `Driver…${r.driver_id.slice(-6)}`), kwh: +(r.kwh_delivered || 0).toFixed(2), earned: +(r.amount_charged || 0).toFixed(0), date: r.ended_at ? new Date(r.ended_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—' };
        }));
        setEarningsHistory(enriched);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('host-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_requests', filter: `host_id=eq.${user.id}` }, () => { loadRequests(); setTab('requests'); showToast('⚡ New charging request!'); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_requests', filter: `host_id=eq.${user.id}` }, () => { loadRequests(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleAllow = async (req: SessionRequest) => {
    setActionLoading(req.id);
    await supabase.from('session_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', req.id);
    await supabase.from('notifications').insert({ user_id: req.driver_id, type: 'session_approved', title: 'Session Approved!', body: `Your request at ${req.charger_name} has been approved.`, data: { session_id: req.id }, read: false });
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    setActionLoading(null);
    showToast('✓ Approved — driver is on the way');
    await loadRequests();
  };

  const handleDeny = async (req: SessionRequest) => {
    setActionLoading(req.id);
    await supabase.from('session_requests').update({ status: 'denied' }).eq('id', req.id);
    const { data: wallet } = await supabase.from('wallets').select('held').eq('user_id', req.driver_id).single();
    if (wallet) {
      await supabase.from('wallets').update({ held: Math.max(0, wallet.held - req.hold_amount), updated_at: new Date().toISOString() }).eq('user_id', req.driver_id);
      await supabase.from('wallet_transactions').insert({ user_id: req.driver_id, type: 'release', amount: req.hold_amount, description: 'Hold released — host declined', session_id: req.id });
    }
    await supabase.from('notifications').insert({ user_id: req.driver_id, type: 'session_denied', title: 'Request Declined', body: 'The host has declined your request.', data: { session_id: req.id }, read: false });
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    setActionLoading(null);
    showToast('✗ Declined · hold released');
  };

  const handleForceStop = async (req: SessionRequest) => {
    if (!confirm('Force-stop this session? The driver will be charged for actual usage.')) return;
    setActionLoading(req.id);
    const now = new Date().toISOString();
    const { data: latest } = await supabase.from('session_requests').select('kwh_delivered, amount_charged, hold_amount, rate_per_kwh, started_at').eq('id', req.id).single();
    const kwhDelivered = latest?.kwh_delivered || 0;
    const actualCost = latest?.amount_charged || +(kwhDelivered * (latest?.rate_per_kwh || req.rate_per_kwh)).toFixed(2);
    const holdAmount = latest?.hold_amount || req.hold_amount;
    await supabase.from('session_requests').update({ status: 'completed', ended_at: now, amount_charged: actualCost }).eq('id', req.id);
    const { data: driverWallet } = await supabase.from('wallets').select('balance, held').eq('user_id', req.driver_id).single();
    if (driverWallet) {
      await supabase.from('wallets').update({ balance: Math.max(0, driverWallet.balance - actualCost), held: Math.max(0, driverWallet.held - holdAmount), updated_at: now }).eq('user_id', req.driver_id);
      await supabase.from('wallet_transactions').insert({ user_id: req.driver_id, type: 'charge', amount: -actualCost, description: `Session at ${req.charger_name || 'charger'}`, session_id: req.id });
    }
    const { data: hostWallet } = await supabase.from('wallets').select('balance').eq('user_id', user!.id).single();
    if (hostWallet) {
      await supabase.from('wallets').update({ balance: hostWallet.balance + actualCost, updated_at: now }).eq('user_id', user!.id);
      await supabase.from('wallet_transactions').insert({ user_id: user!.id, type: 'payout', amount: actualCost, description: 'Session earnings', session_id: req.id });
    }
    await supabase.from('notifications').insert({ user_id: req.driver_id, type: 'session_ended', title: 'Session Ended by Host', body: `₹${actualCost.toFixed(0)} charged.`, data: { session_id: req.id }, read: false });
    setActiveSessions(prev => prev.filter(r => r.id !== req.id));
    setActionLoading(null);
    showToast('✓ Session stopped · payment processed');
    setRatingTarget({ sessionId: req.id, driverId: req.driver_id, driverName: req.driver_name || 'Driver' });
  };

  const submitRating = async (score: number, comment: string) => {
    if (!ratingTarget || !user) return;
    await supabase.from('ratings').insert({ session_id: ratingTarget.sessionId, from_user: user.id, to_user: ratingTarget.driverId, score, comment: comment.trim() || null });
    const { data: allRatings } = await supabase.from('ratings').select('score').eq('to_user', ratingTarget.driverId);
    if (allRatings?.length) {
      const avg = allRatings.reduce((a, r) => a + r.score, 0) / allRatings.length;
      await supabase.from('profiles').update({ rating: +avg.toFixed(2) }).eq('id', ratingTarget.driverId);
    }
    setRatingTarget(null);
    showToast('✓ Rating submitted');
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await supabase.from('chargers').update({ is_available: !current }).eq('id', id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, is_available: !current } : l));
    showToast(!current ? '✓ Charger is now Live' : '✓ Charger set to Offline');
  };

  const submitCharger = async () => {
    if (!user) return;
    if (!form.name || !form.address || !form.latitude || !form.longitude || form.plug_types.length === 0) { showToast('⚠ Fill all required fields'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('chargers').insert({ host_id: user.id, owner_id: user.id, name: form.name, address: form.address, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), plug_types: form.plug_types, power_kw: parseFloat(form.power_kw), price_per_kwh: parseFloat(form.price_per_kwh), description: form.description, is_available: form.is_available, is_verified: false }).select().single();
    setSaving(false);
    if (!error && data) { setListings(prev => [data as HostListing, ...prev]); setForm({ name: '', address: '', latitude: '', longitude: '', plug_types: [], power_kw: '7.4', price_per_kwh: '12', description: '', is_available: true }); setTab('listings'); showToast('✓ Charger listed! Pending verification.'); }
    else showToast('✗ Failed to save. Try again.');
  };

  const togglePlug = (p: string) => setForm(f => ({ ...f, plug_types: f.plug_types.includes(p) ? f.plug_types.filter(x => x !== p) : [...f.plug_types, p] }));

  const timeAgo = (iso: string) => {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

  return (
    <main className="min-h-screen pb-40" style={{ background: '#050508' }}>

      {ratingTarget && <RatingModal driverName={ratingTarget.driverName} onSubmit={submitRating} onSkip={() => setRatingTarget(null)} />}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-4 duration-300"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
          {toast}
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-5 pt-14">

        {/* Header */}
        <div className="flex justify-between items-center mb-7">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Host Mode</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Your Network</h1>
          </div>
          <div className="flex items-center gap-2">
            {pendingRequests.length > 0 && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                <span className="text-white text-[9px] font-black">{pendingRequests.length}</span>
              </div>
            )}
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>⚡</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl overflow-x-auto no-scrollbar"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['requests', 'active', 'dashboard', 'listings', 'add'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-shrink-0 px-3 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap"
              style={{
                background: tab === t ? '#10b981' : 'transparent',
                color: tab === t ? '#000' : 'rgba(255,255,255,0.3)',
                boxShadow: tab === t ? '0 0 16px rgba(16,185,129,0.25)' : 'none',
              }}>
              {t === 'add' ? '+ Add' : t === 'requests' ? 'Requests' : t === 'active' ? 'Active' : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'requests' && pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[7px] text-white font-black flex items-center justify-center" style={{ background: '#ef4444' }}>{pendingRequests.length}</span>
              )}
              {t === 'active' && activeSessions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[7px] font-black flex items-center justify-center" style={{ background: '#10b981', color: '#000' }}>{activeSessions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── REQUESTS ─── */}
        {tab === 'requests' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Auto-approve toggle */}
            <div className="rounded-[24px] p-4 flex justify-between items-center" style={glass}>
              <div>
                <p className="text-white text-sm font-black">Auto-Approve</p>
                <p className="text-[8px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {autoApproveLoading ? 'Saving...' : 'Approve all requests automatically'}
                </p>
              </div>
              <button onClick={handleAutoApproveToggle} disabled={autoApproveLoading}
                className="relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-60 flex-shrink-0"
                style={{ background: autoApprove ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                  style={{ left: autoApprove ? 24 : 2 }} />
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="py-16 text-center rounded-[32px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <p className="text-4xl mb-4">📡</p>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>No pending requests</p>
                <p className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.15)' }}>You'll be notified when a driver requests your charger</p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="rounded-[28px] p-5 animate-in fade-in zoom-in-95 duration-300"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', backdropFilter: 'blur(16px)' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: '#10b981' }}>New Request · {timeAgo(req.requested_at)}</p>
                      <h3 className="text-white font-black text-base">{req.driver_name}</h3>
                      {req.vehicle_reg && <span className="text-[9px] font-black font-mono tracking-widest" style={{ color: '#10b981' }}>{req.vehicle_reg}</span>}
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>🚗</div>
                  </div>
                  <div className="rounded-2xl p-3 space-y-2 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {[['Charger', req.charger_name || '–'], ['Rate', `₹${req.rate_per_kwh}/kWh`], ['Time Limit', `${req.time_limit_mins} mins`], ['Pre-Auth Hold', `₹${req.hold_amount}`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center">
                        <span className="text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</span>
                        <span className="text-white text-[9px] font-black">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleDeny(req)} disabled={actionLoading === req.id}
                      className="py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                      {actionLoading === req.id ? '...' : '✕ Deny'}
                    </button>
                    <button onClick={() => handleAllow(req)} disabled={actionLoading === req.id}
                      className="py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-40"
                      style={{ background: '#10b981', color: '#000', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
                      {actionLoading === req.id ? '...' : '✓ Allow'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── ACTIVE ─── */}
        {tab === 'active' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeSessions.length === 0 ? (
              <div className="py-16 text-center rounded-[32px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <p className="text-4xl mb-4">⚡</p>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>No active sessions</p>
                <p className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.15)' }}>Approved sessions appear here</p>
              </div>
            ) : (
              activeSessions.map(req => {
                const isActive = req.status === 'active';
                const isEnRoute = req.status === 'approved' || req.status === 'en_route';
                const elapsedMins = req.started_at ? Math.floor((Date.now() - new Date(req.started_at).getTime()) / 60000) : null;
                return (
                  <div key={req.id} className="rounded-[28px] p-5 space-y-4" style={glass}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2"
                          style={{ background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)'}` }}>
                          <span className="relative flex h-1.5 w-1.5">
                            {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />}
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: isActive ? '#10b981' : '#60a5fa' }} />
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: isActive ? '#10b981' : '#60a5fa' }}>
                            {isActive ? 'Charging Active' : 'Driver En Route'}
                          </span>
                        </div>
                        <h3 className="text-white font-black text-base">{req.driver_name}</h3>
                        {req.vehicle_reg && <span className="text-[9px] font-black font-mono tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{req.vehicle_reg}</span>}
                      </div>
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>🚗</div>
                    </div>
                    <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {[['Charger', req.charger_name || '–'], ['Rate', `₹${req.rate_per_kwh}/kWh`], ...(elapsedMins !== null ? [['Charging', `${elapsedMins} min`]] : []), ['Approved', req.approved_at ? timeAgo(req.approved_at) : '–']].map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center">
                          <span className="text-[8px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>{k}</span>
                          <span className="text-white text-[9px] font-black">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => router.push(`/session/${req.id}`)}
                        className="py-3.5 font-black uppercase text-[9px] tracking-widest rounded-2xl active:scale-95 transition-all"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
                        View Session
                      </button>
                      {isActive && (
                        <button onClick={() => handleForceStop(req)} disabled={actionLoading === req.id}
                          className="py-3.5 font-black uppercase text-[9px] tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                          {actionLoading === req.id ? '...' : 'Force Stop'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Earned', value: `₹${stats.totalEarnings}`, sub: '100% yours', color: '#10b981' },
                { label: 'Sessions', value: stats.totalSessions, sub: 'All time', color: 'white' },
                { label: 'Live Chargers', value: stats.activeListings, sub: 'Active now', color: 'white' },
                { label: 'Pending', value: pendingRequests.length, sub: 'Waiting', color: '#fbbf24' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-[24px] p-5" style={glass}>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                  <p className="text-[8px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>{sub}</p>
                </div>
              ))}
            </div>

            {earningsHistory.length > 0 ? (
              <div className="rounded-[24px] overflow-hidden" style={glass}>
                <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Recent Earnings</p>
                </div>
                {earningsHistory.map((e, i) => (
                  <div key={e.id} className="px-5 py-3 flex items-center gap-3"
                    style={{ borderBottom: i < earningsHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.1)' }}>⚡</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[11px] font-black truncate">{e.charger_name}</p>
                      <p className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{e.driver_name} · {e.kwh} kWh · {e.date}</p>
                    </div>
                    <p className="text-sm font-black flex-shrink-0" style={{ color: '#10b981' }}>+₹{e.earned}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] p-6" style={glass}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Host Tips</p>
                <div className="space-y-3">
                  {[['⚡', 'Set competitive rates — ₹10–14/kWh converts best'], ['📍', 'Accurate GPS gets 3x more bookings'], ['🕐', 'Respond quickly to build your trust rating'], ['💰', 'You keep 100% of your earnings — no platform cut']].map(([icon, tip], i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-sm">{icon}</span>
                      <p className="text-[10px] font-bold leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setTab('add')}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 24px rgba(16,185,129,0.25)' }}>
              + List Your Charger
            </button>
          </div>
        )}

        {/* ─── LISTINGS ─── */}
        {tab === 'listings' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-7 h-7 rounded-full border-2 border-t-emerald-500 animate-spin mx-auto mb-3"
                  style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
              </div>
            ) : listings.length === 0 ? (
              <div className="py-16 text-center rounded-[32px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>No chargers listed yet</p>
                <button onClick={() => setTab('add')} className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#10b981' }}>+ Add Your First Charger</button>
              </div>
            ) : (
              listings.map(l => (
                <div key={l.id} className="rounded-[24px] p-5" style={glass}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-black text-sm tracking-tight">{l.name}</h3>
                      <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{l.address}</p>
                    </div>
                    <button onClick={() => toggleAvailability(l.id, l.is_available)}
                      className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                      style={{ background: l.is_available ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                      <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                        style={{ left: l.is_available ? 24 : 2 }} />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {(l.plug_types || []).map(p => (
                      <span key={p} className="text-[8px] font-black uppercase px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{p}</span>
                    ))}
                    <span className="text-[8px] font-black uppercase px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{l.power_kw} kW</span>
                  </div>
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-sm font-black" style={{ color: '#10b981' }}>₹{l.price_per_kwh}/kWh</span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                      style={{ background: l.is_available ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${l.is_available ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`, color: l.is_available ? '#10b981' : 'rgba(255,255,255,0.25)' }}>
                      {l.is_available ? '● Live' : '○ Offline'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── ADD CHARGER ─── */}
        {tab === 'add' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-[24px] p-6 space-y-4" style={glass}>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Station Details</p>
              {[{ label: 'Station Name *', key: 'name', placeholder: "e.g. Azad's Home Charger" }, { label: 'Address *', key: 'address', placeholder: 'Street, Area, City' }].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[['Latitude *', 'latitude', '28.6139'], ['Longitude *', 'longitude', '77.2090']].map(([label, key, ph]) => (
                  <div key={key}>
                    <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
                    <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} type="number" step="any" style={inputStyle} />
                  </div>
                ))}
              </div>
              <button onClick={() => { if ('geolocation' in navigator) { navigator.geolocation.getCurrentPosition(pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); showToast('✓ Location captured'); }); } }}
                className="w-full py-3 font-black uppercase text-[9px] tracking-widest rounded-xl transition-all"
                style={{ border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', background: 'transparent' }}>
                📍 Use My Current Location
              </button>
            </div>

            <div className="rounded-[24px] p-6 space-y-4" style={glass}>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Charger Specs</p>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest block mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Plug Types *</label>
                <div className="flex flex-wrap gap-2">
                  {PLUG_TYPES.map(p => (
                    <button key={p} onClick={() => togglePlug(p)}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all"
                      style={{ background: form.plug_types.includes(p) ? '#10b981' : 'rgba(255,255,255,0.05)', border: `1px solid ${form.plug_types.includes(p) ? '#10b981' : 'rgba(255,255,255,0.1)'}`, color: form.plug_types.includes(p) ? '#000' : 'rgba(255,255,255,0.4)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Power Output</label>
                  <select value={form.power_kw} onChange={e => setForm(f => ({ ...f, power_kw: e.target.value }))} style={inputStyle}>
                    {POWER_OPTIONS.map(p => <option key={p} value={p.replace(' kW', '')}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Price (₹/kWh)</label>
                  <input value={form.price_per_kwh} onChange={e => setForm(f => ({ ...f, price_per_kwh: e.target.value }))} type="number" min="5" max="50" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Access instructions, parking info..." rows={3}
                  style={{ ...inputStyle, resize: 'none' } as any} />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <p className="text-white text-sm font-black">Go Live Immediately</p>
                  <p className="text-[8px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Visible to drivers right away</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, is_available: !f.is_available }))}
                  className="relative w-12 h-6 rounded-full transition-all duration-300"
                  style={{ background: form.is_available ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300"
                    style={{ left: form.is_available ? 24 : 2 }} />
                </button>
              </div>
            </div>

            <button onClick={submitCharger} disabled={saving}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-50"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 24px rgba(16,185,129,0.25)' }}>
              {saving ? 'Saving...' : 'List My Charger →'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm h-16 rounded-3xl flex items-center justify-around z-50"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {[{ href: '/', icon: '○', label: 'Home', active: false }, { href: '/explore', icon: '◎', label: 'Explore', active: false }, { href: '/host', icon: null, label: 'Host', active: true }, { href: '/wallet', icon: '◍', label: 'Wallet', active: false }, { href: '/profile', icon: '○', label: 'Profile', active: false }].map(({ href, icon, label, active }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1">
            {active ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} /> : <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>}
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: active ? '#10b981' : 'rgba(255,255,255,0.25)' }}>{label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}