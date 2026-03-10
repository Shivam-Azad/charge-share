'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BatteryCard from '@/components/ui/BatteryCard';
import FilterChips from '@/components/ui/FilterChips';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useVehicle } from '@/context/VehicleContext';

// ─── DISTANCE CALC ─────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── OTP BOOKING MODAL ─────────────────────────────────────────────────────
function BookingModal({ station, onConfirm, onClose }: { station: any; onConfirm: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'confirm' | 'payment' | 'otp' | 'success'>('confirm');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [generatedOtp] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [payStep, setPayStep] = useState<'form' | 'processing' | 'done'>('form');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

  const handlePayment = () => {
    const e: Record<string, string> = {};
    if (card.number.replace(/\s/g, '').length < 16) e.number = 'Invalid';
    if (card.expiry.length < 5) e.expiry = 'Invalid';
    if (card.cvv.length < 3) e.cvv = 'Invalid';
    if (!card.name.trim()) e.name = 'Required';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setPayStep('processing');
    setTimeout(() => { setPayStep('done'); setTimeout(() => setStep('otp'), 1000); }, 2500);
  };

  const handleOtp = (idx: number, val: string) => {
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 3) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const checkOtp = () => {
    if (otp.join('') === generatedOtp) { setStep('success'); setTimeout(onConfirm, 1500); }
    else { setOtp(['', '', '', '']); document.getElementById('otp-0')?.focus(); }
  };

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[150] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">

        {/* ── Confirm Step ── */}
        {step === 'confirm' && (
          <div className="p-6 space-y-4 animate-in fade-in duration-300">
            <div className="text-center mb-2">
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em]">Book Session</p>
              <h2 className="text-white font-black italic uppercase text-xl mt-1">{station.name}</h2>
              <p className="text-zinc-500 text-[9px] font-bold mt-0.5">{station.address || 'India'}</p>
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700 p-4 rounded-2xl space-y-2">
              {[
                ['Rate', `₹${station.price_per_kwh || 11}/kWh`],
                ['Deposit (deducted at end)', '₹11.00'],
                ['Plug Type', (station.plug_types || ['Type 2']).join(', ')],
                ['Power', `${station.power_kw || 7.4} kW`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center">
                  <span className="text-zinc-500 text-[9px] font-bold uppercase">{k}</span>
                  <span className="text-white text-[10px] font-black italic">{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl">
              <p className="text-blue-400 text-[8px] font-bold">A ₹11 deposit is charged now and deducted from your final bill. Pay the rest when done charging.</p>
            </div>

            <button onClick={() => setStep('payment')} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
              Pay Deposit & Book →
            </button>
            <button onClick={onClose} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        )}

        {/* ── Stripe Payment Step ── */}
        {step === 'payment' && (
          <div>
            <div className="bg-[#635BFF] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center"><span className="text-[#635BFF] font-black text-[10px]">S</span></div>
                <span className="text-white font-bold text-sm">Stripe</span>
                <span className="text-white/50 text-[9px] font-bold">· Booking Deposit</span>
              </div>
              <span className="text-white font-black">₹11.00</span>
            </div>
            <div className="p-6 space-y-3">
              {payStep === 'form' && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div>
                    <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1">Card Number</label>
                    <input value={card.number} onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                      placeholder="4242 4242 4242 4242"
                      className={`w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.number ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1">Expiry</label>
                      <input value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                        placeholder="MM/YY"
                        className={`w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.expiry ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`} />
                    </div>
                    <div>
                      <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1">CVV</label>
                      <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="•••" type="password"
                        className={`w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.cvv ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`} />
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1">Name on Card</label>
                    <input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))}
                      placeholder="SHIVAM AZAD"
                      className={`w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 uppercase ${errors.name ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`} />
                  </div>
                  <button onClick={handlePayment} className="w-full py-4 bg-[#635BFF] text-white font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
                    Pay ₹11 Deposit →
                  </button>
                </div>
              )}
              {payStep === 'processing' && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 border-4 border-[#635BFF]/20 border-t-[#635BFF] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white font-black italic uppercase text-[10px] tracking-widest animate-pulse">Processing Deposit...</p>
                </div>
              )}
              {payStep === 'done' && (
                <div className="py-8 text-center animate-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">✓</div>
                  <p className="text-white font-black italic uppercase text-sm">Deposit Confirmed</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── OTP Step ── */}
        {step === 'otp' && (
          <div className="p-6 text-center space-y-5 animate-in fade-in duration-300">
            <div>
              <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Session Start</p>
              <h2 className="text-white font-black italic uppercase text-xl">Enter OTP</h2>
              <p className="text-zinc-500 text-[9px] font-bold mt-2">
                Show this to your host or enter the OTP from the charger display
              </p>
            </div>

            {/* Demo OTP hint */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
              <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">Demo OTP: {generatedOtp}</p>
            </div>

            <div className="flex gap-3 justify-center">
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  value={d}
                  onChange={e => handleOtp(i, e.target.value)}
                  onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && document.getElementById(`otp-${i - 1}`)?.focus()}
                  maxLength={1}
                  className="w-14 h-14 text-center text-2xl font-black text-white bg-zinc-800 border-2 border-zinc-700 rounded-2xl focus:outline-none focus:border-emerald-500 transition-colors"
                />
              ))}
            </div>

            <button onClick={checkOtp} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
              Start Charging →
            </button>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="p-8 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_50px_rgba(16,185,129,0.3)]">⚡</div>
            <h3 className="text-white font-black italic uppercase text-2xl tracking-tighter">Charging!</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-2">Session is now live</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FINAL PAYMENT MODAL ───────────────────────────────────────────────────
function FinalPaymentModal({ totalAmount, bookingFee, restAmount, onComplete }: {
  totalAmount: number; bookingFee: number; restAmount: number; onComplete: () => void;
}) {
  const [step, setStep] = useState<'bill' | 'payment' | 'feedback' | 'success'>('bill');
  const [rating, setRating] = useState(0);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [payStep, setPayStep] = useState<'form' | 'processing' | 'done'>('form');

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

  const handlePay = () => {
    setPayStep('processing');
    setTimeout(() => { setPayStep('done'); setTimeout(() => setStep('feedback'), 1000); }, 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/97 backdrop-blur-xl z-[100] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">

        {step === 'bill' && (
          <div className="p-6 animate-in fade-in zoom-in duration-300">
            <h2 className="text-white font-black italic uppercase text-center mb-6 tracking-tighter text-xl">Session Complete</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                <span>Gross Total</span><span className="text-white italic">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                <span>Deposit Paid</span><span className="italic">-₹{bookingFee.toFixed(2)}</span>
              </div>
              <div className="h-px bg-zinc-800 my-2" />
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 text-[12px] font-black uppercase">Amount Due</span>
                <span className="text-4xl font-black text-white italic">₹{restAmount.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={() => setStep('payment')} className="w-full py-5 bg-[#635BFF] text-white font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all">
              Pay ₹{restAmount.toFixed(2)} via Stripe →
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div>
            <div className="bg-[#635BFF] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center"><span className="text-[#635BFF] font-black text-[10px]">S</span></div>
                <span className="text-white font-bold text-sm">Stripe</span>
                <span className="text-white/50 text-[9px]">· Final Payment</span>
              </div>
              <span className="text-white font-black">₹{restAmount.toFixed(2)}</span>
            </div>
            <div className="p-6 space-y-3">
              {payStep === 'form' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1">Card Number</label>
                    <input value={card.number} onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                      placeholder="4242 4242 4242 4242"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 focus:border-[#635BFF]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} placeholder="MM/YY"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 focus:border-[#635BFF]" />
                    <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g,'').slice(0,4) }))} placeholder="•••" type="password"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 focus:border-[#635BFF]" />
                  </div>
                  <input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))} placeholder="NAME ON CARD"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 focus:border-[#635BFF] uppercase" />
                  <button onClick={handlePay} className="w-full py-4 bg-[#635BFF] text-white font-black uppercase text-xs tracking-widest rounded-xl active:scale-95">Pay ₹{restAmount.toFixed(2)} →</button>
                </div>
              )}
              {payStep === 'processing' && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 border-4 border-[#635BFF]/20 border-t-[#635BFF] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white font-black italic uppercase text-[10px] animate-pulse">Processing...</p>
                </div>
              )}
              {payStep === 'done' && (
                <div className="py-6 text-center animate-in zoom-in">
                  <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-black">✓</div>
                  <p className="text-white font-black italic uppercase text-sm">Payment Complete</p>
                </div>
              )}
            </div>
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
            <textarea placeholder="Any comments? (Optional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 mb-4 resize-none h-20 placeholder:text-zinc-600" />
            <button onClick={() => setStep('success')} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl">Submit Review</button>
            <button onClick={() => setStep('success')} className="w-full mt-2 py-3 text-zinc-600 font-bold uppercase text-[9px] tracking-widest hover:text-white">Skip</button>
          </div>
        )}

        {step === 'success' && (
          <div className="p-8 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_40px_rgba(16,185,129,0.3)]">✓</div>
            <h3 className="text-white font-black italic uppercase text-2xl tracking-tighter mb-2">All Done!</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-8">Session Closed · E-Receipt Sent</p>
            <button onClick={onComplete} className="w-full py-5 bg-zinc-800 text-white font-black uppercase text-xs tracking-widest rounded-2xl">Back to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN HOME PAGE ────────────────────────────────────────────────────────
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

    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (data?.full_name) setUserName(data.full_name.split(' ')[0]);
    };
    loadProfile();
  }, [user]);

  // Init & recovery
  useEffect(() => {
    const savedStatus = localStorage.getItem('chargingStatus') as any;
    const savedKwh = localStorage.getItem('liveKwh');
    const savedBat = localStorage.getItem('batteryLevel');
    const savedRange = localStorage.getItem('range');
    const savedName = localStorage.getItem('currentStationName');
    const savedRate = localStorage.getItem('currentStationRate');

    setChargingStatus(savedStatus || 'IDLE');
    if (savedKwh) setLiveKwh(parseFloat(savedKwh));
    if (savedBat) setBatteryLevel(parseFloat(savedBat));
    if (savedRange) setRange(parseFloat(savedRange));
    if (savedName) setStationName(savedName);
    if (savedRate) setStationRate(parseInt(savedRate));

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
    const fetchNearby = async () => {
      const { data, error } = await supabase.rpc('nearby_chargers_bbox', {
        lat: userLocation.lat, lng: userLocation.lng, radius_km: 25,
      });
      if (!error && data) {
        const withDist = data.map((c: any) => {
          const cLat = parseFloat(c.latitude);
          const cLng = parseFloat(c.longitude);
          const dist = !isNaN(cLat) && !isNaN(cLng)
            ? haversine(userLocation.lat, userLocation.lng, cLat, cLng)
            : 0;
          return { ...c, distanceNum: dist, distance: dist.toFixed(1) };
        }).sort((a: any, b: any) => a.distanceNum - b.distanceNum);
        setNearbyStations(withDist);
      }
    };
    fetchNearby();
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

  // Persist
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
  const bookingFee = 11;
  const restAmount = Math.max(0, currentTotalCost - bookingFee);

  const handleBook = (station: any) => setBookingStation(station);

  const handleBookingConfirmed = () => {
    const rate = bookingStation.price_per_kwh || 11;
    const name = bookingStation.name || 'Unknown Station';
    localStorage.setItem('currentStationRate', rate.toString());
    localStorage.setItem('currentStationName', name);
    setStationRate(rate);
    setStationName(name);
    setChargingStatus('CHARGING');
    setBookingStation(null);
  };

  const resetDemo = () => {
    localStorage.clear();
    setBatteryLevel(START_LEVEL);
    setRange(START_RANGE);
    setLiveKwh(0);
    setChargingStatus('IDLE');
    window.location.reload();
  };

  if (chargingStatus === null) return <div className="min-h-screen bg-black" />;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center pb-40">

      {bookingStation && (
        <BookingModal
          station={bookingStation}
          onConfirm={handleBookingConfirmed}
          onClose={() => setBookingStation(null)}
        />
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
          <button onClick={resetDemo} className="text-[10px] text-zinc-700 font-bold uppercase border border-zinc-800 px-2 py-1 rounded-md hover:text-white transition-colors">
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

              <FilterChips
                activeFilter={activeFilter as any}
                onFilterChange={(f) => setActiveFilter(f)}
              />

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
                          onClick={() => handleBook(station)}
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
          bookingFee={bookingFee}
          restAmount={restAmount}
          onComplete={() => { setChargingStatus('IDLE'); setLiveKwh(0.0); localStorage.clear(); }}
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