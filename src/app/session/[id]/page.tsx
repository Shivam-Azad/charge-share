'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const RoutingControl = dynamic(() => import('@/components/ui/RoutingControl'), { ssr: false });

type Status = 'pending' | 'approved' | 'en_route' | 'active' | 'completed' | 'denied' | 'cancelled';

interface SessionData {
  id: string; charger_id: number; driver_id: string; host_id: string;
  status: Status; rate_per_kwh: number; hold_amount: number; time_limit_mins: number;
  started_at: string | null; ended_at: string | null; kwh_delivered: number;
  amount_charged: number; approved_at: string | null;
}

interface ChargerData {
  name: string; address: string; power_kw: number; latitude: number; longitude: number;
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Navigation Map ────────────────────────────────────────────────────────────
function NavigationMap({ charger, session, onArrived }: {
  charger: ChargerData; session: SessionData; onArrived: () => Promise<void>;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const didFlyRef = useRef(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [arrivedLoading, setArrivedLoading] = useState(false);
  const dest: [number, number] = [charger.latitude, charger.longitude];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { center: dest, zoom: 14, maxZoom: 18, minZoom: 3, zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO', maxZoom: 18 }).addTo(map);
    mapRef.current = map;

    if (!document.getElementById('cs-nav-styles')) {
      const s = document.createElement('style');
      s.id = 'cs-nav-styles';
      s.textContent = `
        .cs-user-dot{width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(59,130,246,.25);animation:cs-loc-pulse 2s infinite;}
        @keyframes cs-loc-pulse{0%{box-shadow:0 0 0 4px rgba(59,130,246,.3);}70%{box-shadow:0 0 0 12px rgba(59,130,246,0);}100%{box-shadow:0 0 0 4px rgba(59,130,246,.3);}}
        .cs-dest-wrap{display:flex;flex-direction:column;align-items:center;}
        .cs-dest-circle{width:44px;height:44px;background:#10b981;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,.3),0 6px 20px rgba(16,185,129,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;}
        .cs-dest-stem{width:3px;height:10px;background:#10b981;border-radius:0 0 2px 2px;}
        .clean-popup .leaflet-popup-content-wrapper{background:rgba(10,10,15,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0;box-shadow:0 20px 60px rgba(0,0,0,.8),0 0 0 1px rgba(16,185,129,0.1);}
        .clean-popup .leaflet-popup-tip{background:rgba(10,10,15,0.95);}
        .clean-popup .leaflet-popup-content{margin:0;width:auto!important;}
        .leaflet-routing-container{display:none!important;}
      `;
      document.head.appendChild(s);
    }

    const destIcon = L.divIcon({ className: '', html: `<div class="cs-dest-wrap"><div class="cs-dest-circle">⚡</div><div class="cs-dest-stem"></div></div>`, iconSize: [44, 54], iconAnchor: [22, 54] });
    L.marker(dest, { icon: destIcon })
      .bindPopup(`
        <div style="padding:16px 18px;font-family:system-ui,sans-serif;">
          <p style="margin:0 0 2px;font-size:9px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:.12em;">Your Charger</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#fff;">${charger.name}</p>
          <p style="margin:0 0 12px;font-size:11px;color:rgba(255,255,255,0.4);">${charger.address}</p>
          <div style="display:flex;gap:8px;">
            <span style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.25);color:#10b981;padding:5px 12px;border-radius:10px;font-size:10px;font-weight:800;">${charger.power_kw} kW</span>
            <span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);padding:5px 12px;border-radius:10px;font-size:10px;font-weight:800;">₹${session.rate_per_kwh}/kWh</span>
          </div>
        </div>
      `, { className: 'clean-popup', maxWidth: 280 }).addTo(map).openPopup();

    const userIcon = L.divIcon({ className: '', html: `<div class="cs-user-dot"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker(coords, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        } else { userMarkerRef.current.setLatLng(coords); }
        if (!didFlyRef.current) {
          didFlyRef.current = true;
          map.fitBounds(L.latLngBounds([coords, dest]), { padding: [90, 90], animate: true, duration: 1.2 });
        }
      },
      (err) => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => { navigator.geolocation.clearWatch(wid); map.remove(); mapRef.current = null; userMarkerRef.current = null; didFlyRef.current = false; };
  }, []); // eslint-disable-line

  const reCentre = () => {
    if (!mapRef.current) return;
    const bounds = userPos ? L.latLngBounds([userPos, dest]) : L.latLngBounds([dest, dest]);
    mapRef.current.fitBounds(bounds, { padding: [90, 90], animate: true });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: '#050508' }}>
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />
      {mapRef.current && userPos && <RoutingControl start={userPos} end={dest} map={mapRef.current} />}

      {/* Top overlay */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,8,0.9) 0%, rgba(5,5,8,0) 100%)', paddingBottom: '50px' }}>
        <div className="flex flex-col items-center pt-12 gap-2 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(12px)' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#60a5fa' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#3b82f6' }} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#93c5fd' }}>Navigation Active</span>
          </div>
          <h1 className="text-white text-lg font-black tracking-tight text-center drop-shadow-lg">{charger.name}</h1>
          <p className="text-[10px] font-bold drop-shadow text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{charger.address}</p>
        </div>
      </div>

      {/* Re-centre button */}
      <button onClick={reCentre}
        className="absolute right-4 z-[500] w-11 h-11 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all"
        style={{ bottom: '240px', background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: '#60a5fa' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]"
        style={{ background: 'linear-gradient(to top, rgba(5,5,8,1) 60%, transparent 100%)' }}>
        <div className="px-5 pt-8 pb-10 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Power', value: `${charger.power_kw} kW` }, { label: 'Rate', value: `₹${session.rate_per_kwh}/kWh` }, { label: 'Time Limit', value: `${session.time_limit_mins} min` }].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <p className="text-white text-[11px] font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl px-4 py-3 flex justify-between items-center"
            style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
            <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#fb923c' }}>Pre-Auth Hold Active</p>
            <p className="font-black text-sm" style={{ color: '#fb923c' }}>₹{session.hold_amount}</p>
          </div>

          <button
            onClick={async () => { setArrivedLoading(true); await onArrived(); setArrivedLoading(false); }}
            disabled={arrivedLoading}
            className="w-full py-5 font-black uppercase text-xs tracking-[0.2em] rounded-[24px] active:scale-95 transition-all disabled:opacity-60"
            style={{ background: '#10b981', color: '#000', boxShadow: '0 0 32px rgba(16,185,129,0.4)' }}>
            {arrivedLoading ? 'Starting Session...' : "⚡ I've Arrived — Start Charging"}
          </button>
          <p className="text-center text-[8px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Tap only when physically at the charger
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Active charging screen ────────────────────────────────────────────────────
function ActiveScreen({ session, charger, onStop }: {
  session: SessionData; charger: ChargerData; onStop: (kwh: number, cost: number) => void;
}) {
  const POWER_KW = charger.power_kw || 7.4;
  const KWH_PER_TICK = (POWER_KW / 3600) * 10;
  const [kwh, setKwh] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [power, setPower] = useState(POWER_KW);
  const timeLimitSecs = (session.time_limit_mins || 120) * 60;
  const timeRemaining = Math.max(0, timeLimitSecs - timeElapsed);
  const cost = +(kwh * session.rate_per_kwh).toFixed(2);
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const maxKwh = POWER_KW * (session.time_limit_mins / 60);
  const pct = Math.min(100, (kwh / maxKwh) * 100);
  const kwhRef = useRef(0); const costRef = useRef(0);
  kwhRef.current = kwh; costRef.current = cost;

  useEffect(() => {
    const kwhTimer = setInterval(() => {
      setKwh(prev => +(prev + KWH_PER_TICK).toFixed(3));
      setPower(+(POWER_KW + (Math.random() * 0.4 - 0.2)).toFixed(1));
    }, 10_000);
    const clockTimer = setInterval(() => {
      setTimeElapsed(prev => {
        const next = prev + 1;
        if (next >= timeLimitSecs) { clearInterval(kwhTimer); clearInterval(clockTimer); onStop(kwhRef.current, costRef.current); }
        return next;
      });
    }, 1000);
    return () => { clearInterval(kwhTimer); clearInterval(clockTimer); };
  }, []); // eslint-disable-line

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-between p-6 pb-12"
      style={{ background: 'linear-gradient(180deg, #050508 0%, #050d14 100%)' }}>

      {/* Header */}
      <div className="pt-10 text-center w-full">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#34d399' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10b981' }} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#10b981' }}>Charging Active</span>
        </div>
        <h1 className="text-xl font-black tracking-tight">{charger.name}</h1>
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
          ₹{session.rate_per_kwh}/kWh · {charger.power_kw} kW
        </p>
      </div>

      {/* Ring */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-56 h-56 rounded-full animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />
        <svg className="w-72 h-72 transform -rotate-90">
          <circle cx="144" cy="144" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="transparent" />
          <circle cx="144" cy="144" r={radius} stroke="#10b981" strokeWidth="10" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * pct) / 100}
            strokeLinecap="round"
            className="transition-all duration-[10000ms] ease-linear"
            style={{ filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.6))' }} />
        </svg>
        <div className="absolute text-center">
          <p className="text-5xl font-black tracking-tighter leading-none">
            {kwh.toFixed(2)}<span className="text-lg" style={{ color: '#10b981' }}> kWh</span>
          </p>
          <p className="text-xl font-black mt-2" style={{ color: '#10b981' }}>₹{cost.toFixed(0)}</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Cost so far</p>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-3">
        {[
          { label: 'Power', value: `${power} kW`, warn: false },
          { label: 'Elapsed', value: fmt(timeElapsed), warn: false },
          { label: 'Left', value: fmt(timeRemaining), warn: timeRemaining < 300 },
        ].map(({ label, value, warn }) => (
          <div key={label} className="rounded-3xl p-4 text-center"
            style={{
              background: warn ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${warn ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            <p className="text-[8px] uppercase font-black tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
            <p className="text-sm font-black tabular-nums" style={{ color: warn ? '#f87171' : 'white' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Stop button */}
      <div className="w-full max-w-sm">
        <button onClick={() => onStop(kwh, cost)}
          className="w-full py-5 font-black text-[10px] uppercase tracking-[0.4em] rounded-[24px] transition-all active:scale-95"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', backdropFilter: 'blur(12px)' }}>
          Stop Session
        </button>
        <p className="text-center text-[8px] font-bold uppercase tracking-widest mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Auto-ends at {session.time_limit_mins} min limit
        </p>
      </div>
    </main>
  );
}

// ── Completed Screen ──────────────────────────────────────────────────────────
function CompletedScreen({ session, kwh, cost, userId, onDone }: {
  session: SessionData; kwh: number; cost: number; userId: string; onDone: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<'bill' | 'processing' | 'rating' | 'done'>('bill');
  const [rating, setRating] = useState(0);
  const restAmount = Math.max(0, cost - session.hold_amount);

  const handleSettle = async () => {
    setStep('processing');
    const { data: wallet } = await supabase.from('wallets').select('balance, held').eq('user_id', userId).single();
    if (wallet) {
      await supabase.from('wallets').update({
        balance: Math.max(0, wallet.balance - cost),
        held: Math.max(0, wallet.held - session.hold_amount),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'charge', amount: -cost, description: 'Session payment', session_id: session.id });
      await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'release', amount: session.hold_amount, description: 'Pre-auth hold released', session_id: session.id });

      // Host gets 100% — no platform fee
      const { data: hw } = await supabase.from('wallets').select('balance').eq('user_id', session.host_id).single();
      if (hw) {
        await supabase.from('wallets').update({ balance: hw.balance + cost, updated_at: new Date().toISOString() }).eq('user_id', session.host_id);
        await supabase.from('wallet_transactions').insert({ user_id: session.host_id, type: 'payout', amount: cost, description: 'Session earnings (100%)', session_id: session.id });
      }
    }
    await supabase.from('session_requests').update({ status: 'completed', ended_at: new Date().toISOString(), kwh_delivered: kwh, amount_charged: cost }).eq('id', session.id);
    setTimeout(() => setStep('rating'), 1200);
  };

  const submitRating = async (score: number) => {
    if (score > 0) {
      await supabase.from('ratings').insert({ session_id: session.id, from_user: userId, to_user: session.host_id, score });
      const { data: all } = await supabase.from('ratings').select('score').eq('to_user', session.host_id);
      if (all?.length) {
        const avg = all.reduce((s: number, r: any) => s + r.score, 0) / all.length;
        await supabase.from('profiles').update({ rating: avg }).eq('id', session.host_id);
      }
    }
    setStep('done');
  };

  const modalStyle = { background: 'rgba(10,10,15,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm rounded-[32px] overflow-hidden animate-in slide-in-from-bottom-8 duration-300" style={modalStyle}>

        {step === 'bill' && (
          <div className="p-6 animate-in fade-in zoom-in duration-300 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <span className="text-xl">✓</span>
              </div>
              <h2 className="text-white font-black text-xl">Session Complete</h2>
            </div>
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Energy Delivered', value: `${kwh.toFixed(2)} kWh`, color: 'rgba(255,255,255,0.9)' },
                { label: 'Total Cost', value: `₹${cost.toFixed(2)}`, color: 'rgba(255,255,255,0.9)' },
                { label: 'Pre-Auth Hold', value: `-₹${session.hold_amount.toFixed(2)}`, color: '#fb923c' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  <span className="font-black" style={{ color }}>{value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] font-black uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Amount Due</span>
                <span className="text-4xl font-black text-white">₹{restAmount.toFixed(0)}</span>
              </div>
              <p className="text-center text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>Deducted from your ChargeShare wallet</p>
            </div>
            <button onClick={handleSettle}
              className="w-full py-5 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
              Confirm & Pay →
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full border-4 border-t-emerald-500 animate-spin mx-auto mb-5"
              style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
            <p className="text-white font-black uppercase text-xs tracking-widest animate-pulse">Processing Payment...</p>
          </div>
        )}

        {step === 'rating' && (
          <div className="p-6 text-center animate-in slide-in-from-right duration-500 space-y-5">
            <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: '#10b981' }}>Rate this session</p>
            <h3 className="text-white text-xl font-black">How was your host?</h3>
            <div className="flex justify-center gap-3">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRating(star)}
                  className={`text-3xl transition-all active:scale-90 ${rating >= star ? 'opacity-100 scale-110' : 'opacity-25'}`}>⭐</button>
              ))}
            </div>
            <button onClick={() => submitRating(rating)}
              className="w-full py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl active:scale-95"
              style={{ background: '#10b981', color: '#000' }}>Submit Review</button>
            <button onClick={() => submitRating(0)}
              className="w-full py-2 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}>Skip</button>
          </div>
        )}

        {step === 'done' && (
          <div className="p-8 text-center animate-in zoom-in duration-500 space-y-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl font-black"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}>✓</div>
            <h3 className="text-white font-black text-2xl">All Done!</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Session Closed · Wallet Updated</p>
            <button onClick={onDone}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#050508' }}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-t-emerald-500 animate-spin mx-auto mb-4"
          style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse" style={{ color: 'rgba(255,255,255,0.2)' }}>Loading Session...</p>
      </div>
    </main>
  );
}

function ErrorScreen({ msg, onBack }: { msg: string; onBack: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: '#050508' }}>
      <div className="text-center max-w-sm space-y-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>✕</div>
        <h2 className="text-white font-black text-xl">Something went wrong</h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{msg}</p>
        <button onClick={onBack}
          className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>
          Back to Home
        </button>
      </div>
    </main>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;

  const [session, setSession] = useState<SessionData | null>(null);
  const [charger, setCharger] = useState<ChargerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalKwh, setFinalKwh] = useState(0);
  const [finalCost, setFinalCost] = useState(0);

  const loadSession = useCallback(async () => {
    if (!id) return;
    const { data: sess, error: e } = await supabase.from('session_requests').select('*').eq('id', id).single();
    if (e || !sess) { setError('Session not found.'); setLoading(false); return; }
    setSession(sess as SessionData);
    const { data: ch } = await supabase.from('chargers').select('name, address, power_kw, latitude, longitude').eq('id', sess.charger_id).single();
    if (ch) setCharger(ch as ChargerData);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadSession(); }, [loadSession]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`session-page-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_requests', filter: `id=eq.${id}` },
        (payload) => setSession(prev => prev ? { ...prev, ...(payload.new as SessionData) } : null))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const handleArrived = async () => {
    if (!session) return;
    await supabase.from('session_requests').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', session.id);
    await supabase.from('notifications').insert({ user_id: session.host_id, type: 'session_started', title: 'Driver has arrived', body: 'The driver has arrived and started charging.', data: { session_id: session.id }, read: false });
    setSession(prev => prev ? { ...prev, status: 'active', started_at: new Date().toISOString() } : null);
  };

  const handleStop = useCallback((kwh: number, cost: number) => {
    setFinalKwh(kwh); setFinalCost(cost);
    setSession(prev => prev ? { ...prev, status: 'completed' } : null);
  }, []);

  if (loading) return <LoadingScreen />;
  if (error || !session || !charger) return <ErrorScreen msg={error || 'Could not load session.'} onBack={() => router.replace('/')} />;

  const isDriver = user?.id === session.driver_id;

  if (session.status === 'completed' && isDriver && finalKwh > 0) {
    return (
      <>
        <main className="min-h-screen" style={{ background: '#050508' }} />
        <CompletedScreen session={session} kwh={finalKwh} cost={finalCost} userId={user!.id} onDone={() => router.replace('/')} />
      </>
    );
  }

  if (session.status === 'approved' || session.status === 'en_route') {
    if (isDriver) return <NavigationMap charger={charger} session={session} onArrived={handleArrived} />;
    return (
      <main className="min-h-screen text-white flex flex-col items-center justify-center p-6 gap-6" style={{ background: '#050508' }}>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#60a5fa' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#3b82f6' }} />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#93c5fd' }}>Driver is on the way</span>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight">{charger.name}</h1>
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Session begins when driver arrives</p>
        </div>
        <button onClick={() => router.replace('/host')}
          className="py-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
          Back to Host Dashboard
        </button>
      </main>
    );
  }

  if (session.status === 'active') return <ActiveScreen session={session} charger={charger} onStop={handleStop} />;
  return <ErrorScreen msg={`Session status: ${session.status}`} onBack={() => router.replace('/')} />;
}