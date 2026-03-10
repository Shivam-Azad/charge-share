'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

const PLUG_TYPES = ['CCS2', 'Type 2', 'CHAdeMO', 'Type 1', 'Bharat AC-001', 'Bharat DC-001'];
const POWER_OPTIONS = ['3.3 kW', '7.4 kW', '11 kW', '22 kW', '50 kW', '100 kW', '150 kW'];

type Tab = 'dashboard' | 'listings' | 'add';

interface HostListing {
  id: string;
  name: string;
  address: string;
  plug_types: string[];
  power_kw: number;
  price_per_kwh: number;
  is_available: boolean;
  total_sessions?: number;
  total_earnings?: number;
}

export default function HostPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalSessions: 0,
    activeListings: 0,
    pendingPayout: 0,
  });

  // Add charger form
  const [form, setForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    plug_types: [] as string[],
    power_kw: '7.4',
    price_per_kwh: '12',
    description: '',
    is_available: true,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Load host's listings
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('chargers')
        .select('*')
        .eq('owner_id', user.id);

      if (!error && data) {
        setListings(data as HostListing[]);

        // Load sessions for earnings
        const { data: sessions } = await supabase
          .from('charging_sessions')
          .select('total_cost, charger_id')
          .in('charger_id', data.map((c: any) => c.id))
          .eq('status', 'completed');

        const totalEarnings = sessions?.reduce((s: number, r: any) => s + (r.total_cost || 0), 0) ?? 0;
        const hostCut = totalEarnings * 0.85; // 85% goes to host
        setStats({
          totalEarnings: hostCut,
          totalSessions: sessions?.length ?? 0,
          activeListings: data.filter((c: any) => c.is_available).length,
          pendingPayout: hostCut * 0.3, // mock pending
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Toggle availability
  const toggleAvailability = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('chargers')
      .update({ is_available: !current })
      .eq('id', id);

    if (!error) {
      setListings(prev => prev.map(l => l.id === id ? { ...l, is_available: !current } : l));
      showToast(!current ? '✓ Charger is now Live' : '✓ Charger set to Offline');
    }
  };

  // Add new charger
  const submitCharger = async () => {
    if (!user) return;
    if (!form.name || !form.address || !form.latitude || !form.longitude || form.plug_types.length === 0) {
      showToast('⚠ Fill all required fields');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from('chargers').insert({
      owner_id: user.id,
      name: form.name,
      address: form.address,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      plug_types: form.plug_types,
      power_kw: parseFloat(form.power_kw),
      price_per_kwh: parseFloat(form.price_per_kwh),
      description: form.description,
      is_available: form.is_available,
      is_verified: false,
    }).select().single();

    setSaving(false);

    if (!error && data) {
      setListings(prev => [data as HostListing, ...prev]);
      setForm({ name: '', address: '', latitude: '', longitude: '', plug_types: [], power_kw: '7.4', price_per_kwh: '12', description: '', is_available: true });
      setTab('listings');
      showToast('✓ Charger listed! Pending verification.');
    } else {
      showToast('✗ Failed to save. Try again.');
    }
  };

  const togglePlug = (p: string) => {
    setForm(f => ({
      ...f,
      plug_types: f.plug_types.includes(p)
        ? f.plug_types.filter(x => x !== p)
        : [...f.plug_types, p],
    }));
  };

  return (
    <main className="min-h-screen bg-black pb-40">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-zinc-900 border border-emerald-500/40 px-6 py-3 rounded-2xl text-emerald-400 text-[11px] font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-5 pt-14">

        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Host Mode</p>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Your Network</h1>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">⚡</div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          {(['dashboard', 'listings', 'add'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {t === 'add' ? '+ List' : t}
            </button>
          ))}
        </div>

        {/* ─── DASHBOARD TAB ─── */}
        {tab === 'dashboard' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Total Earned</p>
                <p className="text-2xl font-black text-emerald-400 italic">₹{stats.totalEarnings.toFixed(0)}</p>
                <p className="text-zinc-600 text-[8px] font-bold mt-1">After 15% platform fee</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Sessions</p>
                <p className="text-2xl font-black text-white italic">{stats.totalSessions}</p>
                <p className="text-zinc-600 text-[8px] font-bold mt-1">All time</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Active</p>
                <p className="text-2xl font-black text-white italic">{stats.activeListings}</p>
                <p className="text-zinc-600 text-[8px] font-bold mt-1">Live chargers</p>
              </div>
              <div className="bg-zinc-900 border border-emerald-500/20 p-5 rounded-[28px] relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/3 pointer-events-none" />
                <p className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mb-1">Pending</p>
                <p className="text-2xl font-black text-emerald-400 italic">₹{stats.pendingPayout.toFixed(0)}</p>
                <p className="text-zinc-600 text-[8px] font-bold mt-1">Ready to payout</p>
              </div>
            </div>

            {/* Quick tips */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px]">
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-4">Host Tips</p>
              <div className="space-y-3">
                {[
                  ['⚡', 'Set competitive rates — ₹10–14/kWh converts best'],
                  ['📍', 'Accurate GPS location gets 3x more bookings'],
                  ['🕐', 'Keep availability updated to build trust rating'],
                  ['💰', 'Payouts processed every Monday to your wallet'],
                ].map(([icon, tip], i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-sm">{icon}</span>
                    <p className="text-zinc-400 text-[10px] font-bold leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setTab('add')}
              className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              + List Your Charger
            </button>
          </div>
        )}

        {/* ─── LISTINGS TAB ─── */}
        {tab === 'listings' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">Loading Listings...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="py-16 border border-dashed border-zinc-800 rounded-[32px] text-center">
                <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest mb-4">No chargers listed yet</p>
                <button onClick={() => setTab('add')} className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">+ Add Your First Charger</button>
              </div>
            ) : (
              listings.map(l => (
                <div key={l.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-black italic uppercase text-sm tracking-tight">{l.name}</h3>
                      <p className="text-zinc-500 text-[9px] font-bold mt-0.5">{l.address}</p>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleAvailability(l.id, l.is_available)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${l.is_available ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${l.is_available ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex gap-2 flex-wrap mb-3">
                    {(l.plug_types || []).map(p => (
                      <span key={p} className="bg-zinc-800 text-zinc-400 text-[8px] font-black uppercase px-2 py-1 rounded-lg">{p}</span>
                    ))}
                    <span className="bg-zinc-800 text-zinc-400 text-[8px] font-black uppercase px-2 py-1 rounded-lg">{l.power_kw} kW</span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
                    <span className="text-emerald-400 text-sm font-black italic">₹{l.price_per_kwh}/kWh</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${l.is_available ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-zinc-600 border-zinc-700 bg-zinc-800/50'}`}>
                      {l.is_available ? '● Live' : '○ Offline'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── ADD CHARGER TAB ─── */}
        {tab === 'add' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Station Details</p>

              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Station Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Azad's Home Charger"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Address *</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Street, Area, City"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Latitude *</label>
                  <input
                    value={form.latitude}
                    onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="28.6139"
                    type="number"
                    step="any"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Longitude *</label>
                  <input
                    value={form.longitude}
                    onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="77.2090"
                    type="number"
                    step="any"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(pos => {
                      setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
                      showToast('✓ Location captured');
                    });
                  }
                }}
                className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-500 text-[9px] font-black uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all"
              >
                📍 Use My Current Location
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Charger Specs</p>

              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-2">Plug Types * (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {PLUG_TYPES.map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlug(p)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all ${
                        form.plug_types.includes(p)
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Power Output</label>
                  <select
                    value={form.power_kw}
                    onChange={e => setForm(f => ({ ...f, power_kw: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50"
                  >
                    {POWER_OPTIONS.map(p => <option key={p} value={p.replace(' kW', '')}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Price (₹/kWh)</label>
                  <input
                    value={form.price_per_kwh}
                    onChange={e => setForm(f => ({ ...f, price_per_kwh: e.target.value }))}
                    type="number"
                    min="5"
                    max="50"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Access instructions, parking info, availability hours..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 resize-none placeholder:text-zinc-600"
                />
              </div>

              {/* Availability toggle */}
              <div className="flex justify-between items-center pt-2">
                <div>
                  <p className="text-white text-sm font-black italic uppercase">Go Live Immediately</p>
                  <p className="text-zinc-500 text-[8px] font-bold mt-0.5">Make visible to drivers now</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, is_available: !f.is_available }))}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${form.is_available ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${form.is_available ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            <button
              onClick={submitCharger}
              disabled={saving}
              className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              {saving ? 'Saving...' : 'List My Charger →'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl flex items-center justify-around z-50">
        <Link href="/" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">○</span><span className="text-[9px] font-bold uppercase">Home</span></Link>
        <Link href="/explore" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◎</span><span className="text-[9px] font-bold uppercase">Explore</span></Link>
        <Link href="/host" className="flex flex-col items-center text-emerald-400 gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mb-1"></div><span className="text-[9px] font-bold uppercase">Host</span></Link>
        <Link href="/wallet" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◍</span><span className="text-[9px] font-bold uppercase">Wallet</span></Link>
        <Link href="/profile" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◇</span><span className="text-[9px] font-bold uppercase">Profile</span></Link>
      </nav>
    </main>
  );
}