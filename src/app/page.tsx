'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import BatteryCard from '@/components/ui/BatteryCard';
import FilterChips, { FilterType } from '@/components/ui/FilterChips';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useSessionRequest } from '@/hooks/useSessionRequest';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const RoutingControl = dynamic(() => import('@/components/ui/RoutingControl'), { ssr: false });

// ─── DISTANCE CALC ──────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── PUBLIC CHARGER NAVIGATION MODAL ────────────────────────────────────────
function PublicDirectionsModal({
  station,
  userLocation,
  onClose,
}: {
  station: any;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(
    userLocation ? [userLocation.lat, userLocation.lng] : null
  );

  const dest: [number, number] = [parseFloat(station.lat ?? station.latitude), parseFloat(station.lng ?? station.longitude)];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: dest, zoom: 14, maxZoom: 18, minZoom: 3,
      zoomControl: false, attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO', maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    // Inject styles
    if (!document.getElementById('cs-pub-styles')) {
      const s = document.createElement('style');
      s.id = 'cs-pub-styles';
      s.textContent = `
        .cs-pub-dot{width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(59,130,246,.25);animation:cs-pub-pulse 2s infinite;}
        @keyframes cs-pub-pulse{0%{box-shadow:0 0 0 4px rgba(59,130,246,.3);}70%{box-shadow:0 0 0 12px rgba(59,130,246,0);}100%{box-shadow:0 0 0 4px rgba(59,130,246,.3);}}
        .cs-pub-dest{display:flex;flex-direction:column;align-items:center;}
        .cs-pub-circle{width:40px;height:40px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,.3),0 6px 20px rgba(59,130,246,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;}
        .cs-pub-stem{width:3px;height:10px;background:#3b82f6;border-radius:0 0 2px 2px;}
        .clean-popup .leaflet-popup-content-wrapper{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:0;box-shadow:0 10px 30px rgba(0,0,0,.7);}
        .clean-popup .leaflet-popup-tip{background:#18181b;}
        .clean-popup .leaflet-popup-content{margin:0;width:auto!important;}
        .leaflet-routing-container{display:none!important;}
      `;
      document.head.appendChild(s);
    }

    // Destination pin (blue for public)
    const destIcon = L.divIcon({
      className: '',
      html: `<div class="cs-pub-dest"><div class="cs-pub-circle">⚡</div><div class="cs-pub-stem"></div></div>`,
      iconSize: [40, 50], iconAnchor: [20, 50],
    });
    L.marker(dest, { icon: destIcon })
      .bindPopup(`
        <div style="padding:12px 16px;font-family:system-ui,sans-serif;">
          <p style="margin:0 0 2px;font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:.06em;">Public Charger</p>
          <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#fff;">${station.name}</p>
          <p style="margin:0;font-size:11px;color:#a1a1aa;">${station.address || ''}</p>
          ${station.power_kw ? `<div style="margin-top:10px;"><span style="background:#27272a;color:#3b82f6;padding:4px 10px;border-radius:8px;font-size:10px;font-weight:700;">${station.power_kw} kW</span></div>` : ''}
        </div>
      `, { className: 'clean-popup', maxWidth: 260 })
      .addTo(map).openPopup();

    // User dot
    const userIcon = L.divIcon({
      className: '', html: `<div class="cs-pub-dot"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });

    // Use existing location if available, also watch for updates
    if (userLocation) {
      const coords: [number, number] = [userLocation.lat, userLocation.lng];
      userMarkerRef.current = L.marker(coords, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
      map.fitBounds(L.latLngBounds([coords, dest]), { padding: [80, 80], animate: true });
    }

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker(coords, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
          map.fitBounds(L.latLngBounds([coords, dest]), { padding: [80, 80], animate: true });
        } else {
          userMarkerRef.current.setLatLng(coords);
        }
      },
      (err) => console.warn('GPS:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(wid);
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
  }, []); // eslint-disable-line

  const reCentre = () => {
    if (!mapRef.current) return;
    const bounds = userPos ? L.latLngBounds([userPos, dest]) : L.latLngBounds([dest, dest]);
    mapRef.current.fitBounds(bounds, { padding: [80, 80], animate: true });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col">
      {/* Map fills screen */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Route line */}
      {mapRef.current && userPos && (
        <RoutingControl start={userPos} end={dest} map={mapRef.current} />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)', paddingBottom: '40px' }}>
        <div className="flex flex-col items-center pt-10 gap-2 px-4">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 backdrop-blur-md px-4 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
            </span>
            <span className="text-blue-300 text-[10px] font-black uppercase tracking-widest">Public Charger · Free to Use</span>
          </div>
          <h1 className="text-white text-lg font-black italic uppercase tracking-tighter text-center drop-shadow-lg">{station.name}</h1>
          {station.address && <p className="text-zinc-400 text-[10px] font-bold drop-shadow text-center">{station.address}</p>}
        </div>
      </div>

      {/* Re-centre button */}
      <button onClick={reCentre}
        className="absolute right-4 z-[500] w-11 h-11 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-full flex items-center justify-center text-blue-400 shadow-xl active:scale-95 transition-all"
        style={{ bottom: '180px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[500]"
        style={{ background: 'linear-gradient(to top, rgba(5,5,10,0.98) 70%, transparent 100%)' }}>
        <div className="px-4 pt-6 pb-8 space-y-3">
          {/* Info row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Type', value: 'Public' },
              { label: 'Power', value: station.power_kw ? `${station.power_kw} kW` : '—' },
              { label: 'Cost', value: station.price_per_kwh ? `₹${station.price_per_kwh}/kWh` : 'Free' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-900/80 backdrop-blur border border-zinc-800/80 rounded-2xl p-3 text-center">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">{label}</p>
                <p className="text-white text-[11px] font-black italic">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-zinc-500 text-[9px] font-bold text-center">
            This is a public charging station — no booking required. Just show up and plug in.
          </p>

          <button onClick={onClose}
            className="w-full py-5 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-[24px] active:scale-95 transition-all border border-zinc-700">
            ← Back to Stations
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BOOKING MODAL (private P2P stations only) ───────────────────────────────
function BookingModal({
  station, userId, onApproved, onClose,
}: {
  station: any; userId: string; onApproved: (sessionId: string) => void; onClose: () => void;
}) {
  const { session, loading, error, createRequest, cancelRequest } = useSessionRequest(userId);
  const [step, setStep] = useState<'confirm' | 'waiting' | 'denied'>('confirm');
  const [walletAvailable, setWalletAvailable] = useState<number | null>(null);
  const supabase = createClient();

  const rate = station.price_per_kwh || 11;
  const power = station.power_kw || 7.4;
  const timeLimitMins = 120;
  const holdAmount = +(rate * power * (timeLimitMins / 60)).toFixed(2);

  useEffect(() => {
    if (!userId) return;
    supabase.from('wallets').select('balance, held').eq('user_id', userId).single()
      .then(({ data }) => { if (data) setWalletAvailable(+(data.balance - data.held).toFixed(0)); });
  }, [userId]);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'approved') onApproved(session.id);
    else if (session.status === 'denied') setStep('denied');
  }, [session?.status]);

  const handleBook = async () => {
    const result = await createRequest({ chargerId: station.id, hostId: station.host_id, ratePerkWh: rate, powerkW: power, timeLimitMins });
    if (result) setStep('waiting');
  };

  const handleCancel = async () => {
    if (session?.id) await cancelRequest(session.id);
    onClose();
  };

  const insufficientBalance = walletAvailable !== null && walletAvailable < holdAmount;

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[150] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">

        {step === 'confirm' && (
          <div className="p-6 space-y-4 animate-in fade-in duration-300">
            <div className="text-center mb-2">
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Private P2P Charger</span>
              </div>
              <h2 className="text-white font-black italic uppercase text-xl mt-1">{station.name}</h2>
              <p className="text-zinc-500 text-[9px] font-bold mt-0.5">{station.address || 'India'}</p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-2xl space-y-2">
              {[
                ['Rate', `₹${rate}/kWh`],
                ['Power', `${power} kW`],
                ['Time Limit', `${timeLimitMins} mins`],
                ['Plug Type', (station.plug_types || ['Type 2']).join(', ')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-bold uppercase">{k}</span>
                  <span className="text-white text-[10px] font-black italic">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-orange-500/5 border border-orange-500/20 p-3 rounded-xl space-y-1">
              <div className="flex justify-between items-center">
                <p className="text-orange-300 text-[9px] font-black uppercase tracking-wide">Pre-Auth Hold</p>
                <p className="text-orange-400 font-black text-sm">₹{holdAmount}</p>
              </div>
              <p className="text-zinc-600 text-[8px] font-bold">Held from wallet now · released when session ends</p>
            </div>

            {walletAvailable !== null && (
              <div className={`flex justify-between items-center px-3 py-2 rounded-xl border ${insufficientBalance ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-800/30 border-zinc-700'}`}>
                <span className="text-zinc-500 text-[9px] font-bold uppercase">Your Balance</span>
                <span className={`font-black text-sm ${insufficientBalance ? 'text-red-400' : 'text-white'}`}>₹{walletAvailable}</span>
              </div>
            )}

            {insufficientBalance && (
              <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl">
                <p className="text-red-400 text-[9px] font-bold text-center">
                  Insufficient balance. <Link href="/wallet" className="underline font-black">Top up wallet →</Link>
                </p>
              </div>
            )}

            {error && <p className="text-red-400 text-[9px] font-bold uppercase tracking-wider">⚠ {error}</p>}

            <button onClick={handleBook} disabled={loading || insufficientBalance}
              className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Sending Request...' : 'Request Session →'}
            </button>
            <button onClick={onClose} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="p-8 text-center space-y-6 animate-in fade-in duration-300">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <div className="absolute inset-3 rounded-full bg-emerald-500/10 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <div>
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Request Sent</p>
              <h2 className="text-white font-black italic uppercase text-xl">Waiting for Host</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-2">The host is being notified. Usually under a minute.</p>
            </div>
            <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-2xl space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-zinc-500 text-[9px] font-bold uppercase">Station</span>
                <span className="text-white text-[9px] font-black">{station.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 text-[9px] font-bold uppercase">Hold</span>
                <span className="text-orange-400 text-[9px] font-black">₹{holdAmount} reserved</span>
              </div>
            </div>
            <button onClick={handleCancel} className="w-full py-3 text-zinc-600 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors">
              Cancel Request
            </button>
          </div>
        )}

        {step === 'denied' && (
          <div className="p-8 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">✕</div>
            <div>
              <p className="text-red-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Request Denied</p>
              <h2 className="text-white font-black italic uppercase text-xl">Host Declined</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-2">Your wallet hold has been released.</p>
            </div>
            <button onClick={onClose} className="w-full py-4 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
              Back to Stations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FINAL PAYMENT MODAL ─────────────────────────────────────────────────────
function FinalPaymentModal({ totalAmount, holdAmount, sessionId, userId, onComplete }: {
  totalAmount: number; holdAmount: number; sessionId: string | null; userId: string | null; onComplete: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<'bill' | 'processing' | 'feedback' | 'success'>('bill');
  const [rating, setRating] = useState(0);
  const restAmount = Math.max(0, totalAmount - holdAmount);

  const handleSettle = async () => {
    setStep('processing');
    if (userId && sessionId) {
      const { data: wallet } = await supabase.from('wallets').select('balance, held').eq('user_id', userId).single();
      if (wallet) {
        await supabase.from('wallets').update({
          balance: Math.max(0, wallet.balance - totalAmount),
          held: Math.max(0, wallet.held - holdAmount),
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        await supabase.from('wallet_transactions').insert({ user_id: userId, type: 'charge', amount: -totalAmount, description: 'Session payment', session_id: sessionId });
        await supabase.from('session_requests').update({ status: 'completed', ended_at: new Date().toISOString(), amount_charged: totalAmount }).eq('id', sessionId);
      }
    }
    setTimeout(() => setStep('feedback'), 1200);
  };

  const submitRating = async (score: number) => {
    if (userId && sessionId && score > 0) {
      const { data: sess } = await supabase.from('session_requests').select('host_id').eq('id', sessionId).single();
      if (sess?.host_id) {
        await supabase.from('ratings').insert({ session_id: sessionId, from_user: userId, to_user: sess.host_id, score });
        const { data: allRatings } = await supabase.from('ratings').select('score').eq('to_user', sess.host_id);
        if (allRatings?.length) {
          const avg = allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;
          await supabase.from('profiles').update({ rating: avg }).eq('id', sess.host_id);
        }
      }
    }
    setStep('success');
  };

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[100] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">
        {step === 'bill' && (
          <div className="p-6 animate-in fade-in zoom-in duration-300">
            <h2 className="text-white font-black italic uppercase text-center mb-6 tracking-tighter text-xl">Session Complete</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest"><span>Total Cost</span><span className="text-white italic">₹{totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-[10px] text-orange-400 font-bold uppercase tracking-widest"><span>Pre-Auth Hold</span><span className="italic">-₹{holdAmount.toFixed(2)}</span></div>
              <div className="h-px bg-zinc-800 my-2" />
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 text-[12px] font-black uppercase">Amount Due</span>
                <span className="text-4xl font-black text-white italic">₹{restAmount.toFixed(2)}</span>
              </div>
              <p className="text-zinc-600 text-[8px] font-bold text-center">Deducted from your ChargeShare wallet</p>
            </div>
            <button onClick={handleSettle} className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all">Confirm & Pay →</button>
          </div>
        )}
        {step === 'processing' && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white font-black italic uppercase text-xs tracking-widest animate-pulse">Processing Payment...</p>
          </div>
        )}
        {step === 'feedback' && (
          <div className="p-6 text-center animate-in slide-in-from-right duration-500">
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Rate this session</p>
            <h3 className="text-white text-xl font-black italic uppercase mb-5">How was it?</h3>
            <div className="flex justify-center gap-3 mb-6">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRating(star)} className={`text-3xl transition-all ${rating >= star ? 'grayscale-0 scale-110' : 'grayscale opacity-30'}`}>⚡</button>
              ))}
            </div>
            <button onClick={() => submitRating(rating)} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl mb-2">Submit Review</button>
            <button onClick={() => submitRating(0)} className="w-full py-3 text-zinc-600 font-bold uppercase text-[9px] tracking-widest hover:text-white">Skip</button>
          </div>
        )}
        {step === 'success' && (
          <div className="p-8 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_40px_rgba(16,185,129,0.3)]">✓</div>
            <h3 className="text-white font-black italic uppercase text-2xl tracking-tighter mb-2">All Done!</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-8">Session Closed · Wallet Updated</p>
            <button onClick={onComplete} className="w-full py-5 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-2xl">Back to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN HOME PAGE ──────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const BATTERY_CAPACITY = 30;
  const MAX_RANGE = 325;
  const START_LEVEL = 21;
  const START_RANGE = 63;

  const [chargingStatus, setChargingStatus] = useState<'IDLE' | 'CHARGING' | 'PAYING' | null>(null);
  const [liveKwh, setLiveKwh] = useState(0.0);
  const [batteryLevel, setBatteryLevel] = useState(START_LEVEL);
  const [range, setRange] = useState(START_RANGE);
  const [stationName, setStationName] = useState("Sarah's Driveway");
  const [stationRate, setStationRate] = useState(11);
  const [stationHoldAmount, setStationHoldAmount] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [allStations, setAllStations] = useState<any[]>([]);
  const [filteredStations, setFilteredStations] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [bookingStation, setBookingStation] = useState<any | null>(null);
  const [publicNavStation, setPublicNavStation] = useState<any | null>(null);
  const [userName, setUserName] = useState('');
  const [loadingStations, setLoadingStations] = useState(false);

  // Load user name
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    setUserName(meta?.full_name || meta?.name || user.email?.split('@')[0] || 'Driver');
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setUserName(data.full_name.split(' ')[0]); });
  }, [user]);

  // Init & recovery
  useEffect(() => {
    const savedStatus = localStorage.getItem('chargingStatus') as any;
    const savedKwh = localStorage.getItem('liveKwh');
    const savedBat = localStorage.getItem('batteryLevel');
    const savedRange = localStorage.getItem('range');
    const savedName = localStorage.getItem('currentStationName');
    const savedRate = localStorage.getItem('currentStationRate');
    const savedHold = localStorage.getItem('currentHoldAmount');
    const savedSessionId = localStorage.getItem('currentSessionId');

    setChargingStatus(savedStatus || 'IDLE');
    if (savedKwh) setLiveKwh(parseFloat(savedKwh));
    if (savedBat) setBatteryLevel(parseFloat(savedBat));
    if (savedRange) setRange(parseFloat(savedRange));
    if (savedName) setStationName(savedName);
    if (savedRate) setStationRate(parseInt(savedRate));
    if (savedHold) setStationHoldAmount(parseFloat(savedHold));
    if (savedSessionId) setActiveSessionId(savedSessionId);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error('GPS:', err)
      );
    }
  }, []);

  // Fetch BOTH private (DB) + public (OCM) stations via /api/chargers
  useEffect(() => {
    if (!userLocation) return;
    setLoadingStations(true);

    fetch(`/api/chargers?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=25`)
      .then(r => r.json())
      .then(({ local, external }) => {
        const processStation = (c: any, source: 'private' | 'public') => {
          const lat = typeof c.latitude === 'number' ? c.latitude : parseFloat(c.latitude ?? c.AddressInfo?.Latitude ?? '');
          const lng = typeof c.longitude === 'number' ? c.longitude : parseFloat(c.longitude ?? c.AddressInfo?.Longitude ?? '');
          if (isNaN(lat) || isNaN(lng)) return null;
          const dist = haversine(userLocation.lat, userLocation.lng, lat, lng);
          return {
            ...c,
            lat, lng,
            source,
            name: c.name ?? c.AddressInfo?.Title ?? 'EV Station',
            address: c.address ?? c.AddressInfo?.Town ?? c.AddressInfo?.AddressLine1 ?? '',
            power_kw: c.power_kw ?? c.Connections?.[0]?.PowerKW ?? null,
            price_per_kwh: source === 'public' ? null : (c.price_per_kwh ?? null),
            plug_types: c.plug_types ?? [],
            distanceNum: dist,
            distance: dist.toFixed(1),
          };
        };

        const privateStations = (local ?? []).map((c: any) => processStation(c, 'private')).filter(Boolean);
        const publicStations = (external ?? []).map((c: any) => processStation(c, 'public')).filter(Boolean);

        const combined = [...privateStations, ...publicStations]
          .sort((a: any, b: any) => a.distanceNum - b.distanceNum);

        setAllStations(combined);
        setLoadingStations(false);
      })
      .catch(err => { console.error('fetchStations:', err); setLoadingStations(false); });
  }, [userLocation]);

  // Apply filters
  useEffect(() => {
    let filtered = [...allStations];
    if (activeFilter === 'Private')   filtered = filtered.filter(c => c.source === 'private');
    else if (activeFilter === 'Public')    filtered = filtered.filter(c => c.source === 'public');
    else if (activeFilter === 'Fast')      filtered = filtered.filter(c => (c.power_kw || 0) >= 22);
    else if (activeFilter === 'Available') filtered = filtered.filter(c => c.is_available !== false);
    else if (activeFilter === 'Free')      filtered = filtered.filter(c => c.price_per_kwh === null || c.price_per_kwh === 0);
    setFilteredStations(filtered);
  }, [allStations, activeFilter]);

  // Persist charging state
  useEffect(() => {
    if (chargingStatus) {
      localStorage.setItem('chargingStatus', chargingStatus);
      localStorage.setItem('liveKwh', liveKwh.toString());
      localStorage.setItem('batteryLevel', batteryLevel.toString());
      localStorage.setItem('range', range.toString());
    }
  }, [chargingStatus, liveKwh, batteryLevel, range]);

  // Charging ticker
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (chargingStatus === 'CHARGING') {
      interval = setInterval(() => {
        setLiveKwh(prev => {
          const next = +(prev + 0.1).toFixed(2);
          const addedPct = (0.1 / BATTERY_CAPACITY) * 100;
          const addedRange = (0.1 / BATTERY_CAPACITY) * MAX_RANGE;
          setBatteryLevel(b => { const nb = b + addedPct; if (nb >= 100) { setChargingStatus('PAYING'); return 100; } return nb; });
          setRange(r => Math.min(MAX_RANGE, r + addedRange));
          return next;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [chargingStatus]);

  const currentTotalCost = liveKwh * stationRate;

  const handleSessionApproved = (sessionId: string) => {
    setBookingStation(null);
    router.push(`/session/${sessionId}`);
  };

  const resetSession = () => {
    localStorage.clear();
    setBatteryLevel(START_LEVEL);
    setRange(START_RANGE);
    setLiveKwh(0);
    setChargingStatus('IDLE');
    setActiveSessionId(null);
    window.location.reload();
  };

  if (chargingStatus === null) return <div className="min-h-screen bg-black" />;

  const privateCount = allStations.filter(s => s.source === 'private').length;
  const publicCount = allStations.filter(s => s.source === 'public').length;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center pb-40">

      {/* Public directions modal */}
      {publicNavStation && (
        <PublicDirectionsModal
          station={publicNavStation}
          userLocation={userLocation}
          onClose={() => setPublicNavStation(null)}
        />
      )}

      {/* Private booking modal — logged-in */}
      {bookingStation && user && (
        <BookingModal station={bookingStation} userId={user.id} onApproved={handleSessionApproved} onClose={() => setBookingStation(null)} />
      )}

      {/* Private booking modal — guest */}
      {bookingStation && !user && (
        <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[150] flex items-center justify-center p-5">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-2xl">⚡</div>
            <h2 className="text-white font-black italic uppercase text-xl">Sign In to Book</h2>
            <p className="text-zinc-500 text-[10px] font-bold">You need an account to request a private charging session.</p>
            <Link href="/login" className="block w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">Sign In / Register →</Link>
            <button onClick={() => setBookingStation(null)} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-5 pt-12">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="w-10" />
          <div className="text-center">
            <h1 className="text-xl font-black text-white italic uppercase tracking-tighter">
              {userName ? `Hey, ${userName.split(' ')[0]}` : 'ChargeShare'}
            </h1>
            <p className={`text-[10px] uppercase tracking-[0.3em] mt-1 font-bold ${chargingStatus === 'CHARGING' ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`}>
              ● {chargingStatus === 'CHARGING' ? 'Charging Live' : 'System Ready'}
            </p>
          </div>
          <button onClick={resetSession} className="text-[10px] text-zinc-700 font-bold uppercase border border-zinc-800 px-2 py-1 rounded-md hover:text-white transition-colors">
            Reset
          </button>
        </div>

        <BatteryCard level={Math.floor(batteryLevel)} range={Math.floor(range)} isCharging={chargingStatus === 'CHARGING'} />

        <div className="mt-8 min-h-[320px]">
          {chargingStatus === 'IDLE' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Header row with counts */}
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Stations Near You</h3>
                <div className="flex items-center gap-2">
                  {privateCount > 0 && (
                    <span className="text-emerald-500 text-[9px] font-black uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{privateCount} Private
                    </span>
                  )}
                  {publicCount > 0 && (
                    <span className="text-blue-400 text-[9px] font-black uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />{publicCount} Public
                    </span>
                  )}
                </div>
              </div>

              <FilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />

              <div className="mt-3">
                {loadingStations ? (
                  <div className="p-10 border border-dashed border-zinc-900 rounded-[32px] text-center">
                    <p className="text-zinc-700 text-[10px] uppercase font-bold animate-pulse">Scanning nearby stations...</p>
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="p-10 border border-dashed border-zinc-900 rounded-[32px] text-center">
                    <p className="text-zinc-700 text-[10px] uppercase font-bold animate-pulse">
                      {allStations.length === 0 ? 'Scanning 25km radius...' : `No ${activeFilter} stations nearby`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto no-scrollbar">
                    {filteredStations.map((station, idx) => {
                      const isPrivate = station.source === 'private';
                      return (
                        <div key={station.id ?? idx} className={`border p-5 rounded-[28px] flex justify-between items-center ${
                          isPrivate ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-900/40 border-blue-900/30'
                        }`}>
                          <div className="flex-1 min-w-0 mr-3">
                            {/* Source badge */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPrivate ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                              <span className={`text-[8px] font-black uppercase tracking-widest ${isPrivate ? 'text-emerald-500' : 'text-blue-400'}`}>
                                {isPrivate ? 'P2P Private' : 'Public'}
                              </span>
                            </div>
                            <h3 className="text-white font-black italic uppercase text-sm tracking-tight truncate">{station.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {station.plug_types?.length > 0 && (
                                <span className="text-zinc-500 text-[9px] font-bold uppercase">{station.plug_types.join(', ')}</span>
                              )}
                              {station.power_kw && <span className="text-zinc-600 text-[8px] font-bold">· {station.power_kw}kW</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {isPrivate ? (
                                <p className="text-emerald-400 text-sm font-black">₹{station.price_per_kwh || 11}/kWh</p>
                              ) : (
                                <p className="text-blue-400 text-sm font-black">
                                  {station.price_per_kwh ? `₹${station.price_per_kwh}/kWh` : 'Free / Operator rates'}
                                </p>
                              )}
                              <span className="text-zinc-600 text-[9px] font-black uppercase bg-zinc-800/60 px-2 py-0.5 rounded-full">
                                {station.distance} km
                              </span>
                              {isPrivate && station.is_available === false && (
                                <span className="text-red-400 text-[8px] font-black uppercase">Busy</span>
                              )}
                            </div>
                          </div>

                          {/* Action button */}
                          {isPrivate ? (
                            <button
                              onClick={() => setBookingStation(station)}
                              disabled={station.is_available === false}
                              className="bg-emerald-500 text-black px-4 py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                              BOOK
                            </button>
                          ) : (
                            <button
                              onClick={() => setPublicNavStation(station)}
                              className="bg-blue-500 text-white px-4 py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all flex-shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                            >
                              GO →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Active charging session card
            <div className="bg-zinc-900 border border-emerald-500/30 p-7 rounded-[40px] shadow-[0_0_50px_rgba(16,185,129,0.12)] animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-7">
                <div>
                  <p className="text-emerald-500 text-[9px] font-black uppercase mb-1">Active Session</p>
                  <h3 className="text-white text-xl font-black italic uppercase">{stationName}</h3>
                  <p className="text-zinc-500 text-[10px] font-bold">RATE: ₹{stationRate}/kWh</p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 animate-pulse border border-emerald-500/20">⚡</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-7">
                <div className="bg-zinc-800/50 p-5 rounded-3xl border border-white/5">
                  <p className="text-zinc-500 text-[8px] uppercase font-black mb-1">Energy Added</p>
                  <p className="text-2xl font-black text-white italic">{liveKwh.toFixed(1)} <span className="text-[10px]">kWh</span></p>
                </div>
                <div className="bg-zinc-800/50 p-5 rounded-3xl border border-white/5">
                  <p className="text-zinc-500 text-[8px] uppercase font-black mb-1">Cost So Far</p>
                  <p className="text-2xl font-black text-emerald-400 italic">₹{currentTotalCost.toFixed(0)}</p>
                </div>
              </div>
              <button onClick={() => setChargingStatus('PAYING')}
                className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all">
                Stop & Pay
              </button>
            </div>
          )}
        </div>

        <button onClick={() => router.push('/explore')} className="w-full py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest mt-8 mb-4 active:scale-95 transition-all">
          Open Map View
        </button>
      </div>

      {chargingStatus === 'PAYING' && (
        <FinalPaymentModal totalAmount={currentTotalCost} holdAmount={stationHoldAmount} sessionId={activeSessionId} userId={user?.id || null} onComplete={resetSession} />
      )}

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl flex items-center justify-around z-50">
        <Link href="/" className="flex flex-col items-center text-emerald-400 gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mb-1"></div><span className="text-[9px] font-bold uppercase">Home</span></Link>
        <Link href="/explore" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◎</span><span className="text-[9px] font-bold uppercase">Explore</span></Link>
        <Link href="/host" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◇</span><span className="text-[9px] font-bold uppercase">Host</span></Link>
        <Link href="/wallet" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◍</span><span className="text-[9px] font-bold uppercase">Wallet</span></Link>
        <Link href="/profile" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">○</span><span className="text-[9px] font-bold uppercase">Profile</span></Link>
      </nav>
    </main>
  );
}