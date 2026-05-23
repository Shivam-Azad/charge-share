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

const PublicDirectionsModal = dynamic<{
  station: any;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}>(
  () => import('@/components/ui/PublicDirectionsModal'),
  { ssr: false }
);

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── BOOKING MODAL ───────────────────────────────────────────────────────────
function BookingModal({ station, userId, onApproved, onClose }: {
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
    <div className="fixed inset-0 z-[150] flex items-end justify-center p-4" style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(20px)'}}>
      <div className="w-full max-w-sm rounded-[32px] overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
        style={{background:'rgba(255,255,255,0.05)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 -8px 40px rgba(0,0,0,0.6)'}}>

        {step === 'confirm' && (
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                  style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)'}}>⚡</div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest" style={{color:'#10b981'}}>P2P Private</p>
                  <h2 className="text-white font-black text-base leading-tight">{station.name}</h2>
                </div>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
            </div>

            {/* Details */}
            <div className="rounded-2xl p-4 space-y-2.5" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)'}}>
              {[['Rate', `₹${rate}/kWh`], ['Power', `${power} kW`], ['Time Limit', `${timeLimitMins} mins`], ['Plug', (station.plug_types || ['Type 2']).join(', ')]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{color:'#71717a'}}>{k}</span>
                  <span className="text-white text-[10px] font-bold">{v}</span>
                </div>
              ))}
            </div>

            {/* Hold */}
            <div className="rounded-2xl p-3.5 flex justify-between items-center" style={{background:'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.2)'}}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider" style={{color:'#fb923c'}}>Pre-Auth Hold</p>
                <p className="text-zinc-500 text-[8px] font-bold mt-0.5">Released when session ends</p>
              </div>
              <p className="font-black text-lg" style={{color:'#fb923c'}}>₹{holdAmount}</p>
            </div>

            {/* Balance */}
            {walletAvailable !== null && (
              <div className="rounded-xl p-3 flex justify-between items-center"
                style={{background: insufficientBalance ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${insufficientBalance ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`}}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Your Balance</span>
                <span className={`font-black text-sm ${insufficientBalance ? 'text-red-400' : 'text-white'}`}>₹{walletAvailable}</span>
              </div>
            )}

            {insufficientBalance && (
              <p className="text-center text-[9px] font-bold" style={{color:'#f87171'}}>
                Insufficient balance. <Link href="/wallet" className="underline font-black">Top up →</Link>
              </p>
            )}

            {error && <p className="text-[9px] font-bold uppercase tracking-wider" style={{color:'#f87171'}}>⚠ {error}</p>}

            <button onClick={handleBook} disabled={loading || !!insufficientBalance}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-40"
              style={{background:'#10b981', color:'#000', boxShadow:'0 0 24px rgba(16,185,129,0.35)'}}>
              {loading ? 'Sending...' : 'Request Session →'}
            </button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="p-8 text-center space-y-5">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" style={{borderColor:'rgba(16,185,129,0.2)', borderTopColor:'#10b981'}} />
              <div className="absolute inset-3 rounded-full flex items-center justify-center text-2xl" style={{background:'rgba(16,185,129,0.1)'}}>⚡</div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{color:'#10b981'}}>Request Sent</p>
              <h2 className="text-white font-black text-xl">Waiting for Host</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-1">Usually under a minute</p>
            </div>
            <button onClick={handleCancel} className="text-zinc-600 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors">
              Cancel Request
            </button>
          </div>
        )}

        {step === 'denied' && (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
              style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)'}}>✕</div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1 text-red-400">Declined</p>
              <h2 className="text-white font-black text-xl">Host Declined</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-1">Your hold has been released.</p>
            </div>
            <button onClick={onClose} className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl"
              style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white'}}>
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

  const modalStyle = {background:'rgba(15,15,20,0.98)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.08)'};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{background:'rgba(0,0,0,0.9)', backdropFilter:'blur(20px)'}}>
      <div className="w-full max-w-sm rounded-[32px] overflow-hidden" style={modalStyle}>
        {step === 'bill' && (
          <div className="p-6 animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl"
                style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)'}}>✓</div>
              <h2 className="text-white font-black text-xl">Session Complete</h2>
            </div>
            <div className="rounded-2xl p-4 space-y-3 mb-5" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500 font-bold uppercase tracking-widest">Total Cost</span>
                <span className="text-white font-black">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="font-bold uppercase tracking-widest" style={{color:'#fb923c'}}>Pre-Auth Hold</span>
                <span className="font-black" style={{color:'#fb923c'}}>-₹{holdAmount.toFixed(2)}</span>
              </div>
              <div className="h-px" style={{background:'rgba(255,255,255,0.06)'}} />
              <div className="flex justify-between items-center pt-1">
                <span className="text-zinc-400 text-[11px] font-black uppercase">Due Now</span>
                <span className="text-3xl font-black text-white">₹{restAmount.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={handleSettle} className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl"
              style={{background:'#10b981', color:'#000', boxShadow:'0 0 24px rgba(16,185,129,0.3)'}}>
              Confirm & Pay →
            </button>
          </div>
        )}
        {step === 'processing' && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full border-4 border-t-emerald-500 animate-spin mx-auto mb-5"
              style={{borderColor:'rgba(16,185,129,0.15)', borderTopColor:'#10b981'}} />
            <p className="text-white font-black uppercase text-xs tracking-widest animate-pulse">Processing...</p>
          </div>
        )}
        {step === 'feedback' && (
          <div className="p-6 text-center animate-in slide-in-from-right duration-500">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{color:'#10b981'}}>Rate this session</p>
            <h3 className="text-white text-xl font-black mb-5">How was it?</h3>
            <div className="flex justify-center gap-3 mb-6">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRating(star)}
                  className={`text-3xl transition-all active:scale-90 ${rating >= star ? 'opacity-100 scale-110' : 'opacity-25'}`}>⭐</button>
              ))}
            </div>
            <button onClick={() => submitRating(rating)} className="w-full py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl mb-2"
              style={{background:'#10b981', color:'#000'}}>Submit</button>
            <button onClick={() => submitRating(0)} className="w-full py-3 text-zinc-600 font-bold uppercase text-[9px] tracking-widest hover:text-white">Skip</button>
          </div>
        )}
        {step === 'success' && (
          <div className="p-8 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl font-black"
              style={{background:'#10b981', color:'#000', boxShadow:'0 0 40px rgba(16,185,129,0.4)'}}>✓</div>
            <h3 className="text-white font-black text-2xl mb-1">All Done!</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-7">Session Closed · Wallet Updated</p>
            <button onClick={onComplete} className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl"
              style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white'}}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STATION CARD ─────────────────────────────────────────────────────────────
function StationCard({ station, onBook, onGo }: { station: any; onBook: () => void; onGo: () => void }) {
  const isPrivate = station.source === 'private';
  return (
    <div className="rounded-[24px] p-4 flex justify-between items-center transition-all active:scale-[0.98]"
      style={{
        background: isPrivate ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.04)',
        border: `1px solid ${isPrivate ? 'rgba(255,255,255,0.08)' : 'rgba(59,130,246,0.15)'}`,
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: isPrivate ? '#10b981' : '#60a5fa'}} />
          <span className="text-[8px] font-black uppercase tracking-widest" style={{color: isPrivate ? '#10b981' : '#60a5fa'}}>
            {isPrivate ? 'P2P Private' : 'Public'}
          </span>
        </div>
        <h3 className="text-white font-black text-sm tracking-tight truncate mb-1">{station.name}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {station.plug_types?.length > 0 && (
            <span className="text-[8px] font-bold uppercase text-zinc-600">{station.plug_types.slice(0,2).join(', ')}</span>
          )}
          {station.power_kw && <span className="text-[8px] font-bold text-zinc-700">· {station.power_kw}kW</span>}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-black text-sm" style={{color: isPrivate ? '#10b981' : '#60a5fa'}}>
            {isPrivate ? `₹${station.price_per_kwh || 11}/kWh` : (station.price_per_kwh ? `₹${station.price_per_kwh}/kWh` : 'Free')}
          </span>
          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-zinc-500"
            style={{background:'rgba(255,255,255,0.05)'}}>
            {station.distance} km
          </span>
          {isPrivate && station.is_available === false && (
            <span className="text-[8px] font-black uppercase text-red-400">Busy</span>
          )}
        </div>
      </div>

      {isPrivate ? (
        <button onClick={onBook} disabled={station.is_available === false}
          className="px-4 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
          style={{background:'#10b981', color:'#000', boxShadow:'0 0 16px rgba(16,185,129,0.3)'}}>
          BOOK
        </button>
      ) : (
        <button onClick={onGo}
          className="px-4 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all active:scale-95 flex-shrink-0"
          style={{background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', color:'#60a5fa'}}>
          GO →
        </button>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    setUserName(meta?.full_name || meta?.name || user.email?.split('@')[0] || 'Driver');
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setUserName(data.full_name.split(' ')[0]); });
  }, [user]);

  useEffect(() => {
    const savedStatus = localStorage.getItem('chargingStatus') as any;
    setChargingStatus(savedStatus || 'IDLE');
    const savedKwh = localStorage.getItem('liveKwh');
    const savedBat = localStorage.getItem('batteryLevel');
    const savedRange = localStorage.getItem('range');
    const savedName = localStorage.getItem('currentStationName');
    const savedRate = localStorage.getItem('currentStationRate');
    const savedHold = localStorage.getItem('currentHoldAmount');
    const savedSessId = localStorage.getItem('currentSessionId');
    if (savedKwh) setLiveKwh(parseFloat(savedKwh));
    if (savedBat) setBatteryLevel(parseFloat(savedBat));
    if (savedRange) setRange(parseFloat(savedRange));
    if (savedName) setStationName(savedName);
    if (savedRate) setStationRate(parseInt(savedRate));
    if (savedHold) setStationHoldAmount(parseFloat(savedHold));
    if (savedSessId) setActiveSessionId(savedSessId);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error('GPS:', err)
      );
    }
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    setLoadingStations(true);
    fetch(`/api/chargers?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=25`)
      .then(r => r.json())
      .then(({ local, external }) => {
        const process = (c: any, source: 'private' | 'public') => {
          const lat = typeof c.latitude === 'number' ? c.latitude : parseFloat(c.latitude ?? c.AddressInfo?.Latitude ?? '');
          const lng = typeof c.longitude === 'number' ? c.longitude : parseFloat(c.longitude ?? c.AddressInfo?.Longitude ?? '');
          if (isNaN(lat) || isNaN(lng)) return null;
          const dist = haversine(userLocation.lat, userLocation.lng, lat, lng);
          return { ...c, lat, lng, source, name: c.name ?? c.AddressInfo?.Title ?? 'EV Station', address: c.address ?? c.AddressInfo?.Town ?? '', power_kw: c.power_kw ?? c.Connections?.[0]?.PowerKW ?? null, price_per_kwh: source === 'public' ? null : (c.price_per_kwh ?? null), plug_types: c.plug_types ?? [], distanceNum: dist, distance: dist.toFixed(1) };
        };
        const priv = (local ?? []).map((c: any) => process(c, 'private')).filter(Boolean);
        const pub = (external ?? []).map((c: any) => process(c, 'public')).filter(Boolean);
        setAllStations([...priv, ...pub].sort((a: any, b: any) => a.distanceNum - b.distanceNum));
        setLoadingStations(false);
      })
      .catch(err => { console.error('fetchStations:', err); setLoadingStations(false); });
  }, [userLocation]);

  useEffect(() => {
    let f = [...allStations];
    if (activeFilter === 'Private') f = f.filter(c => c.source === 'private');
    else if (activeFilter === 'Public') f = f.filter(c => c.source === 'public');
    else if (activeFilter === 'Fast') f = f.filter(c => (c.power_kw || 0) >= 22);
    else if (activeFilter === 'Available') f = f.filter(c => c.is_available !== false);
    else if (activeFilter === 'Free') f = f.filter(c => c.price_per_kwh === null || c.price_per_kwh === 0);
    setFilteredStations(f);
  }, [allStations, activeFilter]);

  useEffect(() => {
    if (chargingStatus) {
      localStorage.setItem('chargingStatus', chargingStatus);
      localStorage.setItem('liveKwh', liveKwh.toString());
      localStorage.setItem('batteryLevel', batteryLevel.toString());
      localStorage.setItem('range', range.toString());
    }
  }, [chargingStatus, liveKwh, batteryLevel, range]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (chargingStatus === 'CHARGING') {
      interval = setInterval(() => {
        setLiveKwh(prev => {
          const next = +(prev + 0.1).toFixed(2);
          setBatteryLevel(b => {
            const nb = b + (0.1 / BATTERY_CAPACITY) * 100;
            if (nb >= 100) { setChargingStatus('PAYING'); return 100; }
            return nb;
          });
          setRange(r => Math.min(MAX_RANGE, r + (0.1 / BATTERY_CAPACITY) * MAX_RANGE));
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

  if (chargingStatus === null) return <div className="min-h-screen" style={{background:'#050508'}} />;

  const privateCount = allStations.filter(s => s.source === 'private').length;
  const publicCount = allStations.filter(s => s.source === 'public').length;

  return (
    <main className="min-h-screen flex flex-col pb-40" style={{background:'#050508'}}>

      {publicNavStation && (
        <PublicDirectionsModal station={publicNavStation} userLocation={userLocation} onClose={() => setPublicNavStation(null)} />
      )}

      {bookingStation && user && (
        <BookingModal station={bookingStation} userId={user.id} onApproved={handleSessionApproved} onClose={() => setBookingStation(null)} />
      )}

      {bookingStation && !user && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center p-4" style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(20px)'}}>
          <div className="w-full max-w-sm rounded-[32px] p-8 text-center space-y-5 animate-in slide-in-from-bottom-8 duration-300"
            style={{background:'rgba(255,255,255,0.05)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.1)'}}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto text-2xl"
              style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)'}}>⚡</div>
            <h2 className="text-white font-black text-xl">Sign In to Book</h2>
            <p className="text-zinc-500 text-[10px] font-bold">You need an account to request a private charging session.</p>
            <Link href="/login" className="block w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl"
              style={{background:'#10b981', color:'#000'}}>Sign In / Register →</Link>
            <button onClick={() => setBookingStation(null)} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-5 pt-12 mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-7">
          <div className="flex flex-col">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-0.5" style={{color:'rgba(255,255,255,0.3)'}}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            <h1 className="text-xl font-black text-white tracking-tight">
              {userName ? `Hey, ${userName.split(' ')[0]} 👋` : 'ChargeShare'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${chargingStatus === 'CHARGING' ? 'animate-pulse' : ''}`}
              style={{background: chargingStatus === 'CHARGING' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: chargingStatus === 'CHARGING' ? '#10b981' : 'rgba(255,255,255,0.3)', border: `1px solid ${chargingStatus === 'CHARGING' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`}}>
              {chargingStatus === 'CHARGING' ? '⚡ Live' : '● Ready'}
            </span>
            <button onClick={resetSession} className="text-[9px] font-bold uppercase px-2 py-1.5 rounded-lg transition-colors"
              style={{color:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.06)'}}>
              Reset
            </button>
          </div>
        </div>

        {/* Battery Card */}
        <BatteryCard level={Math.floor(batteryLevel)} range={Math.floor(range)} isCharging={chargingStatus === 'CHARGING'} />

        {/* Main Content */}
        <div className="mt-6">
          {chargingStatus === 'IDLE' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Section header */}
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-[10px] uppercase tracking-widest font-black" style={{color:'rgba(255,255,255,0.4)'}}>
                  Stations Near You
                </h3>
                <div className="flex items-center gap-3">
                  {privateCount > 0 && (
                    <span className="text-[8px] font-black uppercase flex items-center gap-1" style={{color:'#10b981'}}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:'#10b981'}} />{privateCount} Private
                    </span>
                  )}
                  {publicCount > 0 && (
                    <span className="text-[8px] font-black uppercase flex items-center gap-1" style={{color:'#60a5fa'}}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:'#60a5fa'}} />{publicCount} Public
                    </span>
                  )}
                </div>
              </div>

              <FilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />

              <div className="mt-3">
                {loadingStations ? (
                  <div className="py-12 text-center rounded-[28px]" style={{border:'1px dashed rgba(255,255,255,0.06)'}}>
                    <div className="w-6 h-6 rounded-full border-2 border-t-emerald-500 animate-spin mx-auto mb-3"
                      style={{borderColor:'rgba(16,185,129,0.2)', borderTopColor:'#10b981'}} />
                    <p className="text-[9px] uppercase font-black tracking-widest" style={{color:'rgba(255,255,255,0.2)'}}>Scanning nearby...</p>
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="py-12 text-center rounded-[28px]" style={{border:'1px dashed rgba(255,255,255,0.06)'}}>
                    <p className="text-[9px] uppercase font-black tracking-widest" style={{color:'rgba(255,255,255,0.2)'}}>
                      {allStations.length === 0 ? 'Scanning 25km radius...' : `No ${activeFilter} stations nearby`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto no-scrollbar">
                    {filteredStations.map((station, idx) => (
                      <StationCard
                        key={station.id ?? idx}
                        station={station}
                        onBook={() => setBookingStation(station)}
                        onGo={() => setPublicNavStation(station)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Active Charging Card */
            <div className="rounded-[28px] p-6 animate-in zoom-in-95 duration-300"
              style={{background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', backdropFilter:'blur(16px)', boxShadow:'0 0 40px rgba(16,185,129,0.08)'}}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{color:'#10b981'}}>Active Session</p>
                  <h3 className="text-white text-lg font-black tracking-tight">{stationName}</h3>
                  <p className="text-[9px] font-bold mt-0.5" style={{color:'rgba(255,255,255,0.3)'}}>₹{stationRate}/kWh</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
                  style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)'}}>
                  <span className="text-lg">⚡</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: 'Energy Added', value: `${liveKwh.toFixed(1)} kWh`, color: 'white' },
                  { label: 'Cost So Far', value: `₹${currentTotalCost.toFixed(0)}`, color: '#10b981' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-2xl p-4" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <p className="text-[8px] uppercase font-black tracking-widest mb-1" style={{color:'rgba(255,255,255,0.3)'}}>{label}</p>
                    <p className="text-xl font-black" style={{color}}>{value}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setChargingStatus('PAYING')}
                className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
                style={{background:'#10b981', color:'#000', boxShadow:'0 0 24px rgba(16,185,129,0.3)'}}>
                Stop & Pay
              </button>
            </div>
          )}
        </div>

        {/* Map button */}
        <button onClick={() => router.push('/explore')}
          className="w-full py-4 font-black text-xs uppercase tracking-widest mt-6 mb-4 rounded-2xl transition-all active:scale-95"
          style={{background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)'}}>
          Open Map View →
        </button>
      </div>

      {chargingStatus === 'PAYING' && (
        <FinalPaymentModal totalAmount={currentTotalCost} holdAmount={stationHoldAmount} sessionId={activeSessionId} userId={user?.id || null} onComplete={resetSession} />
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm h-16 rounded-3xl flex items-center justify-around z-50"
        style={{background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
        <Link href="/" className="flex flex-col items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{background:'#10b981'}} />
          <span className="text-[9px] font-black uppercase tracking-wider" style={{color:'#10b981'}}>Home</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center gap-1 group">
          <span className="text-base" style={{color:'rgba(255,255,255,0.25)'}}>◎</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.25)'}}>Explore</span>
        </Link>
        <Link href="/host" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{color:'rgba(255,255,255,0.25)'}}>◇</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.25)'}}>Host</span>
        </Link>
        <Link href="/wallet" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{color:'rgba(255,255,255,0.25)'}}>◍</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.25)'}}>Wallet</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{color:'rgba(255,255,255,0.25)'}}>○</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.25)'}}>Profile</span>
        </Link>
      </nav>
    </main>
  );
}