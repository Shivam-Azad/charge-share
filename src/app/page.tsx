'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BatteryCard from '@/components/ui/BatteryCard';
import FilterChips from '@/components/ui/FilterChips';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useVehicle } from '@/context/VehicleContext';
import { useSessionRequest } from '@/hooks/useSessionRequest';

// ─── DISTANCE CALC ──────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── BOOKING MODAL ──────────────────────────────────────────────────────────
// Replaces the old fake OTP modal.
// Steps: confirm details → (submit) → waiting for host → denied/approved
function BookingModal({
  station,
  userId,
  onApproved,
  onClose,
}: {
  station: any;
  userId: string;
  onApproved: (sessionId: string) => void;
  onClose: () => void;
}) {
  const { session, loading, error, createRequest, cancelRequest } = useSessionRequest(userId);
  const [step, setStep] = useState<'confirm' | 'waiting' | 'denied'>('confirm');
  const [walletAvailable, setWalletAvailable] = useState<number | null>(null);
  const supabase = createClient();

  const rate = station.price_per_kwh || 11;
  const power = station.power_kw || 7.4;
  const timeLimitMins = 120;
  const holdAmount = +(rate * power * (timeLimitMins / 60)).toFixed(2);

  // Load wallet balance for display
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('wallets')
      .select('balance, held')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) setWalletAvailable(+(data.balance - data.held).toFixed(0));
      });
  }, [userId]);

  // Watch for status changes from the hook
  useEffect(() => {
    if (!session) return;
    if (session.status === 'approved') {
      onApproved(session.id);
    } else if (session.status === 'denied') {
      setStep('denied');
    }
  }, [session?.status]);

  const handleBook = async () => {
    const result = await createRequest({
      chargerId: station.id,
      hostId: station.host_id,
      ratePerkWh: rate,
      powerkW: power,
      timeLimitMins,
    });
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

        {/* ── Confirm step ── */}
        {step === 'confirm' && (
          <div className="p-6 space-y-4 animate-in fade-in duration-300">
            <div className="text-center mb-2">
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em]">Book Session</p>
              <h2 className="text-white font-black italic uppercase text-xl mt-1">{station.name}</h2>
              <p className="text-zinc-500 text-[9px] font-bold mt-0.5">{station.address || 'India'}</p>
            </div>

            {/* Session details */}
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

            {/* Pre-auth hold info */}
            <div className="bg-orange-500/5 border border-orange-500/20 p-3 rounded-xl space-y-1">
              <div className="flex justify-between items-center">
                <p className="text-orange-300 text-[9px] font-black uppercase tracking-wide">Pre-Auth Hold</p>
                <p className="text-orange-400 font-black text-sm">₹{holdAmount}</p>
              </div>
              <p className="text-zinc-600 text-[8px] font-bold">
                Held from wallet now · released when session ends · only actual usage charged
              </p>
            </div>

            {/* Wallet balance */}
            {walletAvailable !== null && (
              <div className={`flex justify-between items-center px-3 py-2 rounded-xl border ${
                insufficientBalance
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-zinc-800/30 border-zinc-700'
              }`}>
                <span className="text-zinc-500 text-[9px] font-bold uppercase">Your Balance</span>
                <span className={`font-black text-sm ${insufficientBalance ? 'text-red-400' : 'text-white'}`}>
                  ₹{walletAvailable}
                </span>
              </div>
            )}

            {insufficientBalance && (
              <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl">
                <p className="text-red-400 text-[9px] font-bold text-center">
                  Insufficient balance. <Link href="/wallet" className="underline font-black">Top up wallet →</Link>
                </p>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-[9px] font-bold uppercase tracking-wider animate-in fade-in">
                ⚠ {error}
              </p>
            )}

            <button
              onClick={handleBook}
              disabled={loading || insufficientBalance}
              className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending Request...' : `Request Session →`}
            </button>
            <button onClick={onClose} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        )}

        {/* ── Waiting for host ── */}
        {step === 'waiting' && (
          <div className="p-8 text-center space-y-6 animate-in fade-in duration-300">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <div className="absolute inset-3 rounded-full bg-emerald-500/10 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <div>
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Request Sent</p>
              <h2 className="text-white font-black italic uppercase text-xl">Waiting for Host</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-2">
                The host is being notified. This usually takes under a minute.
              </p>
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

            <button
              onClick={handleCancel}
              className="w-full py-3 text-zinc-600 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors"
            >
              Cancel Request
            </button>
          </div>
        )}

        {/* ── Denied ── */}
        {step === 'denied' && (
          <div className="p-8 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">✕</div>
            <div>
              <p className="text-red-400 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Request Denied</p>
              <h2 className="text-white font-black italic uppercase text-xl">Host Declined</h2>
              <p className="text-zinc-500 text-[10px] font-bold mt-2">
                Your wallet hold has been released. Try another station nearby.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all"
            >
              Back to Stations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FINAL PAYMENT MODAL ────────────────────────────────────────────────────
function FinalPaymentModal({ totalAmount, holdAmount, sessionId, userId, onComplete }: {
  totalAmount: number;
  holdAmount: number;
  sessionId: string | null;
  userId: string | null;
  onComplete: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState<'bill' | 'processing' | 'feedback' | 'success'>('bill');
  const [rating, setRating] = useState(0);
  const restAmount = Math.max(0, totalAmount - holdAmount);

  const handleSettle = async () => {
    setStep('processing');
    // Release hold, deduct actual cost from wallet
    if (userId && sessionId) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance, held')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        const newHeld = Math.max(0, wallet.held - holdAmount);
        const newBalance = Math.max(0, wallet.balance - totalAmount);
        await supabase
          .from('wallets')
          .update({ balance: newBalance, held: newHeld, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        await supabase.from('wallet_transactions').insert({
          user_id: userId,
          type: 'charge',
          amount: -totalAmount,
          description: 'Session payment',
          session_id: sessionId,
        });

        await supabase
          .from('session_requests')
          .update({ status: 'completed', ended_at: new Date().toISOString(), amount_charged: totalAmount })
          .eq('id', sessionId);
      }
    }
    setTimeout(() => setStep('feedback'), 1200);
  };

  const submitRating = async (score: number) => {
    if (userId && sessionId && score > 0) {
      // Get host_id from session
      const { data: sess } = await supabase
        .from('session_requests')
        .select('host_id')
        .eq('id', sessionId)
        .single();

      if (sess?.host_id) {
        await supabase.from('ratings').insert({
          session_id: sessionId,
          from_user: userId,
          to_user: sess.host_id,
          score,
        });
        // Recalculate host rating average
        const { data: allRatings } = await supabase
          .from('ratings')
          .select('score')
          .eq('to_user', sess.host_id);
        if (allRatings && allRatings.length > 0) {
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
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                <span>Total Cost</span><span className="text-white italic">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-orange-400 font-bold uppercase tracking-widest">
                <span>Pre-Auth Hold</span><span className="italic">-₹{holdAmount.toFixed(2)}</span>
              </div>
              <div className="h-px bg-zinc-800 my-2" />
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 text-[12px] font-black uppercase">Amount Due</span>
                <span className="text-4xl font-black text-white italic">₹{restAmount.toFixed(2)}</span>
              </div>
              <p className="text-zinc-600 text-[8px] font-bold text-center">Deducted from your ChargeShare wallet</p>
            </div>
            <button onClick={handleSettle} className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all">
              Confirm & Pay →
            </button>
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
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)}
                  className={`text-3xl transition-all ${rating >= star ? 'grayscale-0 scale-110' : 'grayscale opacity-30'}`}>⚡</button>
              ))}
            </div>
            <button onClick={() => submitRating(rating)} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl mb-2">
              Submit Review
            </button>
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

  const [nearbyStations, setNearbyStations] = useState<any[]>([]);
  const [filteredStations, setFilteredStations] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [bookingStation, setBookingStation] = useState<any | null>(null);
  const [userName, setUserName] = useState('');

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

  // Fetch nearby
  useEffect(() => {
    if (!userLocation) return;
    supabase.rpc('nearby_chargers_bbox', {
      lat: userLocation.lat, lng: userLocation.lng, radius_km: 25,
    }).then(({ data, error }) => {
      if (!error && data) {
        const withDist = data.map((c: any) => {
          const cLat = parseFloat(c.latitude);
          const cLng = parseFloat(c.longitude);
          const dist = !isNaN(cLat) && !isNaN(cLng)
            ? haversine(userLocation.lat, userLocation.lng, cLat, cLng) : 0;
          return { ...c, distanceNum: dist, distance: dist.toFixed(1) };
        }).sort((a: any, b: any) => a.distanceNum - b.distanceNum);
        setNearbyStations(withDist);
      }
    });
  }, [userLocation]);

  // Apply filters
  useEffect(() => {
    let filtered = [...nearbyStations];
    if (activeFilter === 'Fast') filtered = filtered.filter(c => (c.power_kw || 0) >= 22);
    else if (activeFilter === 'Available') filtered = filtered.filter(c => c.is_available !== false);
    else if (activeFilter === 'Free') filtered = filtered.filter(c => c.is_free === true || c.price_per_kwh === 0);
    else if (activeFilter === 'Top Rated') filtered = filtered.filter(c => (c.rating || 0) >= 4.5).slice(0, 5);
    setFilteredStations(filtered);
  }, [nearbyStations, activeFilter]);

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

  // Called when host approves → start charging
  const handleSessionApproved = (sessionId: string) => {
    const station = bookingStation;
    const rate = station?.price_per_kwh || 11;
    const hold = +(rate * (station?.power_kw || 7.4) * (120 / 60)).toFixed(2);
    const name = station?.name || 'Unknown Station';

    localStorage.setItem('currentStationRate', rate.toString());
    localStorage.setItem('currentStationName', name);
    localStorage.setItem('currentHoldAmount', hold.toString());
    localStorage.setItem('currentSessionId', sessionId);

    setStationRate(rate);
    setStationName(name);
    setStationHoldAmount(hold);
    setActiveSessionId(sessionId);
    setChargingStatus('CHARGING');
    setBookingStation(null);
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

  return (
    <main className="min-h-screen bg-black flex flex-col items-center pb-40">

      {/* Booking modal — only for logged-in users */}
      {bookingStation && user && (
        <BookingModal
          station={bookingStation}
          userId={user.id}
          onApproved={handleSessionApproved}
          onClose={() => setBookingStation(null)}
        />
      )}

      {/* Guest trying to book */}
      {bookingStation && !user && (
        <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[150] flex items-center justify-center p-5">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-2xl">⚡</div>
            <h2 className="text-white font-black italic uppercase text-xl">Sign In to Book</h2>
            <p className="text-zinc-500 text-[10px] font-bold">You need an account to request a charging session.</p>
            <Link href="/login" className="block w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
              Sign In / Register →
            </Link>
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
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Stations Near You</h3>
                <span className="text-emerald-500 text-[9px] font-black uppercase">{filteredStations.length} Found</span>
              </div>

              <FilterChips activeFilter={activeFilter as any} onFilterChange={(f) => setActiveFilter(f)} />

              <div className="mt-3">
                {filteredStations.length === 0 ? (
                  <div className="p-10 border border-dashed border-zinc-900 rounded-[32px] text-center">
                    <p className="text-zinc-700 text-[10px] uppercase font-bold animate-pulse">
                      {nearbyStations.length === 0 ? 'Scanning 25km radius...' : `No ${activeFilter} stations nearby`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar">
                    {filteredStations.map(station => (
                      <div key={station.id} className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-[28px] flex justify-between items-center">
                        <div className="flex-1 min-w-0 mr-3">
                          <h3 className="text-white font-black italic uppercase text-sm tracking-tight truncate">{station.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-zinc-500 text-[9px] font-bold uppercase">{(station.plug_types || ['Type 2']).join(', ')}</span>
                            {station.power_kw && <span className="text-zinc-600 text-[8px] font-bold">· {station.power_kw}kW</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-emerald-400 text-sm font-black">₹{station.price_per_kwh || 11}/kWh</p>
                            <span className="text-zinc-600 text-[9px] font-black uppercase bg-zinc-800/60 px-2 py-0.5 rounded-full">
                              {station.distance ? `${station.distance} km` : '–'}
                            </span>
                            {station.is_available === false && (
                              <span className="text-red-400 text-[8px] font-black uppercase">Busy</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setBookingStation(station)}
                          disabled={station.is_available === false}
                          className="bg-emerald-500 text-black px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          BOOK
                        </button>
                      </div>
                    ))}
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
              <button
                onClick={() => setChargingStatus('PAYING')}
                className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
              >
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
        <FinalPaymentModal
          totalAmount={currentTotalCost}
          holdAmount={stationHoldAmount}
          sessionId={activeSessionId}
          userId={user?.id || null}
          onComplete={resetSession}
        />
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