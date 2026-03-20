'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/AuthProvider';

// ── Types ────────────────────────────────────────────────────────────────────
type Status = 'pending' | 'approved' | 'en_route' | 'active' | 'completed' | 'denied' | 'cancelled';

interface SessionData {
  id: string;
  charger_id: number;
  driver_id: string;
  host_id: string;
  status: Status;
  rate_per_kwh: number;
  hold_amount: number;
  time_limit_mins: number;
  started_at: string | null;
  ended_at: string | null;
  kwh_delivered: number;
  amount_charged: number;
  approved_at: string | null;
}

interface ChargerData {
  name: string;
  address: string;
  power_kw: number;
  latitude: number;
  longitude: number;
}

interface ProfileData {
  full_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

/** Driver approved → show map + "I've arrived / Start Charging" */
function EnRouteScreen({
  session,
  charger,
  onArrived,
}: {
  session: SessionData;
  charger: ChargerData;
  onArrived: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-between p-6 pb-12">

      {/* Header */}
      <div className="pt-10 text-center w-full">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest italic">
            Approved — Head Over Now
          </span>
        </div>
        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">
          {charger.name}
        </h1>
        <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">
          {charger.address}
        </p>
      </div>

      {/* Map placeholder / route card */}
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden">
          {/* Stylised static map area */}
          <div className="relative h-52 bg-zinc-950 flex items-center justify-center overflow-hidden">
            {/* Grid lines for map feel */}
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            />
            {/* Destination pin */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.6)] border-4 border-emerald-400 mb-2">
                <span className="text-2xl">⚡</span>
              </div>
              <div className="bg-zinc-900/90 border border-emerald-500/30 px-3 py-1 rounded-full">
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Charger Location</p>
              </div>
            </div>
          </div>

          {/* Info row */}
          <div className="p-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Power', value: `${charger.power_kw} kW` },
              { label: 'Rate', value: `₹${session.rate_per_kwh}/kWh` },
              { label: 'Time Limit', value: `${session.time_limit_mins} min` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-zinc-600 text-[8px] font-black uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-white text-[11px] font-black italic">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Navigate externally */}
        {charger.latitude && charger.longitude && (
          <a
            href={`https://maps.google.com/?q=${charger.latitude},${charger.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-3 py-3 border border-zinc-800 rounded-2xl text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:border-zinc-700 transition-colors"
          >
            <span>📍</span> Open in Maps
          </a>
        )}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm space-y-3">
        <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest text-center">
          Tap when you're physically at the charger
        </p>
        <button
          onClick={onArrived}
          className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-[0.2em] rounded-[24px] active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        >
          ⚡ I've Arrived — Start Charging
        </button>
      </div>
    </main>
  );
}

/** Active charging screen — live kWh + cost counter */
function ActiveScreen({
  session,
  charger,
  onStop,
}: {
  session: SessionData;
  charger: ChargerData;
  onStop: (kwh: number, cost: number) => void;
}) {
  const POWER_KW = charger.power_kw || 7.4;
  // kWh ticks every 10 seconds (simulated)
  const KWH_PER_TICK = (POWER_KW / 3600) * 10;

  const [kwh, setKwh] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0); // seconds
  const [power, setPower] = useState(POWER_KW);

  const timeLimitSecs = (session.time_limit_mins || 120) * 60;
  const timeRemaining = Math.max(0, timeLimitSecs - timeElapsed);
  const cost = +(kwh * session.rate_per_kwh).toFixed(2);

  // Battery circle animation — we don't know real SOC, so simulate from 0 added
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const maxKwh = POWER_KW * (session.time_limit_mins / 60); // max possible kWh
  const pct = Math.min(100, (kwh / maxKwh) * 100);

  useEffect(() => {
    const kwhTimer = setInterval(() => {
      setKwh(prev => +(prev + KWH_PER_TICK).toFixed(3));
      setPower(+(POWER_KW + (Math.random() * 0.4 - 0.2)).toFixed(1));
    }, 10_000);

    const clockTimer = setInterval(() => {
      setTimeElapsed(prev => {
        if (prev + 1 >= timeLimitSecs) {
          clearInterval(kwhTimer);
          clearInterval(clockTimer);
          onStop(kwh, cost);
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      clearInterval(kwhTimer);
      clearInterval(clockTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-between p-6 pb-12">

      {/* Header */}
      <div className="pt-10 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest italic">Charging Active</span>
        </div>
        <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">{charger.name}</h1>
        <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">
          ₹{session.rate_per_kwh}/kWh · {charger.power_kw} kW
        </p>
      </div>

      {/* Charging circle */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-56 h-56 bg-emerald-500/5 blur-[90px] rounded-full animate-pulse" />
        <svg className="w-72 h-72 transform -rotate-90">
          <circle cx="144" cy="144" r={radius} stroke="#18181b" strokeWidth="8" fill="transparent" />
          <circle
            cx="144" cy="144" r={radius}
            stroke="#10b981" strokeWidth="10" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * pct) / 100}
            strokeLinecap="round"
            className="transition-all duration-[10000ms] ease-linear"
            style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))' }}
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-5xl font-black tracking-tighter italic leading-none">
            {kwh.toFixed(2)}<span className="text-lg text-emerald-500"> kWh</span>
          </p>
          <p className="text-emerald-400 text-xl font-black italic mt-2">₹{cost.toFixed(0)}</p>
          <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-1 italic">Cost so far</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-3xl backdrop-blur-md text-center">
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-1">Power</p>
          <p className="text-sm font-black italic">{power}<span className="text-[9px] text-zinc-600"> kW</span></p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-3xl backdrop-blur-md text-center">
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-1">Elapsed</p>
          <p className="text-sm font-black italic tabular-nums">{fmt(timeElapsed)}</p>
        </div>
        <div className={`border p-4 rounded-3xl backdrop-blur-md text-center ${timeRemaining < 300 ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900/40 border-zinc-800/50'}`}>
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-1">Left</p>
          <p className={`text-sm font-black italic tabular-nums ${timeRemaining < 300 ? 'text-red-400' : ''}`}>{fmt(timeRemaining)}</p>
        </div>
      </div>

      {/* Stop button */}
      <div className="w-full max-w-sm">
        <button
          onClick={() => onStop(kwh, cost)}
          className="w-full py-5 bg-zinc-900/80 backdrop-blur-md border border-red-900/30 text-red-400 font-black text-[10px] uppercase tracking-[0.4em] rounded-[24px] hover:bg-red-500/10 transition-all active:scale-95 shadow-xl"
        >
          Stop Session
        </button>
        <p className="text-zinc-700 text-[8px] font-bold uppercase tracking-widest text-center mt-3">
          Session auto-ends at {session.time_limit_mins} min limit
        </p>
      </div>
    </main>
  );
}

/** Post-session payment + rating modal */
function CompletedScreen({
  session,
  kwh,
  cost,
  userId,
  onDone,
}: {
  session: SessionData;
  kwh: number;
  cost: number;
  userId: string;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<'bill' | 'processing' | 'rating' | 'done'>('bill');
  const [rating, setRating] = useState(0);
  const restAmount = Math.max(0, cost - session.hold_amount);

  const handleSettle = async () => {
    setStep('processing');

    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, held')
      .eq('user_id', userId)
      .single();

    if (wallet) {
      const newHeld = Math.max(0, wallet.held - session.hold_amount);
      const newBalance = Math.max(0, wallet.balance - cost);

      await supabase.from('wallets')
        .update({ balance: newBalance, held: newHeld, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'charge',
        amount: -cost,
        description: 'Session payment',
        session_id: session.id,
      });

      // Credit host (85% after platform fee)
      const hostPayout = +(cost * 0.85).toFixed(2);
      const { data: hostWallet } = await supabase.from('wallets')
        .select('balance').eq('user_id', session.host_id).single();

      if (hostWallet) {
        await supabase.from('wallets')
          .update({ balance: hostWallet.balance + hostPayout, updated_at: new Date().toISOString() })
          .eq('user_id', session.host_id);
        await supabase.from('wallet_transactions').insert({
          user_id: session.host_id,
          type: 'payout',
          amount: hostPayout,
          description: 'Session earnings (85%)',
          session_id: session.id,
        });
      }
    }

    // Finalise session row
    await supabase.from('session_requests').update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      kwh_delivered: kwh,
      amount_charged: cost,
    }).eq('id', session.id);

    setTimeout(() => setStep('rating'), 1200);
  };

  const submitRating = async (score: number) => {
    if (score > 0) {
      await supabase.from('ratings').insert({
        session_id: session.id,
        from_user: userId,
        to_user: session.host_id,
        score,
      });
      // Recalculate host average
      const { data: allRatings } = await supabase
        .from('ratings').select('score').eq('to_user', session.host_id);
      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((s: number, r: any) => s + r.score, 0) / allRatings.length;
        await supabase.from('profiles').update({ rating: avg }).eq('id', session.host_id);
      }
    }
    setStep('done');
  };

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[100] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">

        {/* Bill */}
        {step === 'bill' && (
          <div className="p-6 animate-in fade-in zoom-in duration-300 space-y-5">
            <h2 className="text-white font-black italic uppercase text-center tracking-tighter text-xl">Session Complete</h2>

            <div className="space-y-3">
              {[
                { label: 'Energy Delivered', value: `${kwh.toFixed(2)} kWh`, color: 'text-white' },
                { label: 'Total Cost', value: `₹${cost.toFixed(2)}`, color: 'text-white' },
                { label: 'Pre-Auth Hold', value: `-₹${session.hold_amount.toFixed(2)}`, color: 'text-orange-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-zinc-500">{label}</span>
                  <span className={`italic font-black ${color}`}>{value}</span>
                </div>
              ))}
              <div className="h-px bg-zinc-800 my-1" />
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400 text-[12px] font-black uppercase">Amount Due</span>
                <span className="text-4xl font-black text-white italic">₹{restAmount.toFixed(0)}</span>
              </div>
              <p className="text-zinc-600 text-[8px] font-bold text-center">Deducted from your ChargeShare wallet</p>
            </div>

            <button
              onClick={handleSettle}
              className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
            >
              Confirm & Pay →
            </button>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white font-black italic uppercase text-xs tracking-widest animate-pulse">Processing Payment...</p>
          </div>
        )}

        {/* Rating */}
        {step === 'rating' && (
          <div className="p-6 text-center animate-in slide-in-from-right duration-500 space-y-5">
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em]">Rate this session</p>
            <h3 className="text-white text-xl font-black italic uppercase">How was your host?</h3>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-all ${rating >= star ? 'scale-110' : 'opacity-25'}`}
                >
                  ⚡
                </button>
              ))}
            </div>
            <button
              onClick={() => submitRating(rating)}
              className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl active:scale-95"
            >
              Submit Review
            </button>
            <button
              onClick={() => submitRating(0)}
              className="w-full py-2 text-zinc-600 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors"
            >
              Skip
            </button>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="p-8 text-center animate-in zoom-in duration-500 space-y-5">
            <div className="w-24 h-24 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto text-4xl font-black shadow-[0_0_40px_rgba(16,185,129,0.3)]">✓</div>
            <h3 className="text-white font-black italic uppercase text-2xl tracking-tighter">All Done!</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Session Closed · Wallet Updated</p>
            <button onClick={onDone} className="w-full py-5 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all">
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading / error skeletons ────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Session...</p>
      </div>
    </main>
  );
}

function ErrorScreen({ msg, onBack }: { msg: string; onBack: () => void }) {
  return (
    <main className="min-h-screen bg-[#050a14] flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-5">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-2xl">✕</div>
        <h2 className="text-white font-black italic uppercase text-xl">Something went wrong</h2>
        <p className="text-zinc-500 text-sm">{msg}</p>
        <button onClick={onBack} className="w-full py-4 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95">
          Back to Home
        </button>
      </div>
    </main>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;

  const [session, setSession] = useState<SessionData | null>(null);
  const [charger, setCharger] = useState<ChargerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stopped-session data (kwh + cost from ActiveScreen)
  const [finalKwh, setFinalKwh] = useState(0);
  const [finalCost, setFinalCost] = useState(0);

  // ── Fetch session + charger ──────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    if (!id) return;
    const { data: sess, error: sessErr } = await supabase
      .from('session_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (sessErr || !sess) {
      setError('Session not found.');
      setLoading(false);
      return;
    }

    setSession(sess as SessionData);

    const { data: ch } = await supabase
      .from('chargers')
      .select('name, address, power_kw, latitude, longitude')
      .eq('id', sess.charger_id)
      .single();

    if (ch) setCharger(ch as ChargerData);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Realtime: keep session status in sync ────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`session-page-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_requests',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setSession(prev => prev ? { ...prev, ...(payload.new as SessionData) } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Driver tapped "I've Arrived" — move status to active */
  const handleArrived = async () => {
    if (!session) return;
    await supabase.from('session_requests').update({
      status: 'active',
      started_at: new Date().toISOString(),
    }).eq('id', session.id);

    // Notify host
    await supabase.from('notifications').insert({
      user_id: session.host_id,
      type: 'session_started',
      title: 'Driver has arrived',
      body: 'The driver has arrived and started charging.',
      data: { session_id: session.id },
      read: false,
    });

    setSession(prev => prev ? { ...prev, status: 'active', started_at: new Date().toISOString() } : null);
  };

  /** Driver tapped Stop — capture kwh + cost, move to completed state */
  const handleStop = useCallback(async (kwh: number, cost: number) => {
    setFinalKwh(kwh);
    setFinalCost(cost);
    // Mark as completed optimistically (CompletedScreen handles the wallet logic)
    setSession(prev => prev ? { ...prev, status: 'completed' } : null);
  }, []);

  /** After full payment + rating flow */
  const handleDone = () => {
    router.replace('/');
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />;
  if (error || !session || !charger) return <ErrorScreen msg={error || 'Could not load session.'} onBack={() => router.replace('/')} />;

  const isDriver = user?.id === session.driver_id;
  const isHost = user?.id === session.host_id;

  // ── Completed overlay (driver view) ──────────────────────────────────────
  if (session.status === 'completed' && isDriver && finalKwh > 0) {
    return (
      <>
        <main className="min-h-screen bg-[#050a14]" />
        <CompletedScreen
          session={session}
          kwh={finalKwh}
          cost={finalCost}
          userId={user!.id}
          onDone={handleDone}
        />
      </>
    );
  }

  // ── En route — driver is heading to the charger ──────────────────────────
  if (session.status === 'approved' || session.status === 'en_route') {
    if (isDriver) {
      return (
        <EnRouteScreen
          session={session}
          charger={charger}
          onArrived={handleArrived}
        />
      );
    }
    // Host view while driver is en route
    return (
      <main className="min-h-screen bg-[#050a14] text-white flex flex-col items-center justify-center p-6 gap-6">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Driver is on the way</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">{charger.name}</h1>
          <p className="text-zinc-500 text-[10px] mt-1">Session will begin when driver arrives</p>
        </div>
        <button onClick={() => router.replace('/host')} className="py-3 px-8 border border-zinc-800 rounded-2xl text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
          Back to Host Dashboard
        </button>
      </main>
    );
  }

  // ── Active — charging in progress ────────────────────────────────────────
  if (session.status === 'active') {
    return (
      <ActiveScreen
        session={session}
        charger={charger}
        onStop={handleStop}
      />
    );
  }

  // ── Fallback for denied / cancelled / unknown ────────────────────────────
  return (
    <ErrorScreen
      msg={`Session status: ${session.status}. Nothing to show here.`}
      onBack={() => router.replace('/')}
    />
  );
}