'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useVehicle } from '@/context/VehicleContext';
import { createClient } from '@/utils/supabase/client';
import { EV_BRANDS, EV_MODELS } from '@/data/ev-database';

type Tab = 'profile' | 'garage' | 'sessions' | 'host';

interface UserProfile {
  full_name: string;
  phone: string;
  city: string;
  upi_id: string;
  is_host: boolean;
  host_bank_account: string;
  host_upi: string;
  dl_number: string;
  aadhar_last4: string;
  rating: number;
  total_sessions: number;
}

interface Session {
  id: string;
  station_name: string;
  kwh: number;
  cost: number;
  date: string;
  type: 'driver' | 'host';
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { userCars, selectedCar, setSelectedCar, addCar } = useVehicle();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showAddCar, setShowAddCar] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    phone: '',
    city: '',
    upi_id: '',
    is_host: false,
    host_bank_account: '',
    host_upi: '',
    dl_number: '',
    aadhar_last4: '',
    rating: 4.8,
    total_sessions: 0,
  });

  // Add car form
  const [carForm, setCarForm] = useState({ brand: 'Tata', model: 'nexon-ev' });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Load profile from Supabase
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(prev => ({ ...prev, ...data }));
      } else {
        // Pre-fill from auth data
        const meta = user.user_metadata;
        setProfile(prev => ({
          ...prev,
          full_name: meta?.full_name || meta?.name || '',
          phone: meta?.phone || '',
        }));
      }

      // Load session history (mock for now)
      setSessions([
        { id: '1', station_name: "Sarah's Driveway", kwh: 7.5, cost: 83, date: '9 Mar 2026', type: 'driver' },
        { id: '2', station_name: 'Statiq Hub', kwh: 3.8, cost: 55, date: '7 Mar 2026', type: 'driver' },
        { id: '3', station_name: 'Your Charger', kwh: 11.2, cost: 134, date: '6 Mar 2026', type: 'host' },
        { id: '4', station_name: 'Your Charger', kwh: 8.9, cost: 107, date: '4 Mar 2026', type: 'host' },
      ]);
    };

    load();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: profile.full_name,
        phone: profile.phone,
        city: profile.city,
        upi_id: profile.upi_id,
        is_host: profile.is_host,
        host_bank_account: profile.host_bank_account,
        host_upi: profile.host_upi,
        dl_number: profile.dl_number,
        aadhar_last4: profile.aadhar_last4,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);
    if (!error) showToast('✓ Profile saved');
    else showToast('✗ Save failed');
  };

  const handleAddCar = () => {
    const brandModels = EV_MODELS[carForm.brand] || [];
    const model = brandModels.find((m: any) => m.id === carForm.model);
    if (!model) return;
    addCar({ ...model, brand: carForm.brand });
    setShowAddCar(false);
    showToast('✓ Vehicle added to garage');
  };

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <main className="min-h-screen bg-black pb-40">

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-zinc-900 border border-emerald-500/40 px-6 py-3 rounded-2xl text-emerald-400 text-[11px] font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-4 duration-300">
          {toast}
        </div>
      )}

      {/* Add Car Modal */}
      {showAddCar && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-5">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-6 space-y-4">
            <h3 className="text-white font-black italic uppercase text-xl text-center">Add Vehicle</h3>

            <div>
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Brand</label>
              <select
                value={carForm.brand}
                onChange={e => setCarForm({ brand: e.target.value, model: EV_MODELS[e.target.value]?.[0]?.id || '' })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50"
              >
                {EV_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Model</label>
              <select
                value={carForm.model}
                onChange={e => setCarForm(f => ({ ...f, model: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50"
              >
                {(EV_MODELS[carForm.brand] || []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.battery}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddCar(false)} className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-black uppercase text-[10px] tracking-widest rounded-xl">Cancel</button>
              <button onClick={handleAddCar} className="flex-1 py-4 bg-emerald-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl">Add Car</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-5 pt-14">

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-[20px] flex items-center justify-center text-black font-black text-2xl italic flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white italic uppercase tracking-tighter truncate">
              {profile.full_name || user?.email?.split('@')[0] || 'Driver'}
            </h1>
            <p className="text-zinc-500 text-[9px] font-bold mt-0.5 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-emerald-400 text-[10px] font-black">⚡ {profile.rating}</span>
              <span className="text-zinc-600 text-[8px] font-bold">· {sessions.length} sessions</span>
              {profile.is_host && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[7px] font-black uppercase px-2 py-0.5 rounded-full">Host</span>}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex-shrink-0 text-zinc-600 text-[8px] font-black uppercase border border-zinc-800 px-3 py-2 rounded-xl hover:text-white hover:border-zinc-700 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 mb-6 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          {([['profile', 'Profile'], ['garage', 'Garage'], ['sessions', 'History'], ['host', 'Host']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${
                tab === t ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── PROFILE TAB ─── */}
        {tab === 'profile' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Personal Info</p>

              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Shivam Azad', type: 'text' },
                { label: 'Phone Number', key: 'phone', placeholder: '+91 98161XX102', type: 'tel' },
                { label: 'City', key: 'city', placeholder: 'Mohali', type: 'text' },
                { label: 'UPI ID', key: 'upi_id', placeholder: 'azad@upi', type: 'text' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={(profile as any)[key]}
                    onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                  />
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Account Info</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-500 text-[9px] font-bold uppercase">Email</span>
                  <span className="text-white text-[10px] font-black italic truncate max-w-[55%]">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-zinc-800">
                  <span className="text-zinc-500 text-[9px] font-bold uppercase">Member Since</span>
                  <span className="text-white text-[10px] font-black italic">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-zinc-800">
                  <span className="text-zinc-500 text-[9px] font-bold uppercase">User ID</span>
                  <span className="text-zinc-600 text-[9px] font-mono">{user?.id?.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile →'}
            </button>
          </div>
        )}

        {/* ─── GARAGE TAB ─── */}
        {tab === 'garage' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {userCars.length === 0 ? (
              <div className="py-16 border border-dashed border-zinc-800 rounded-[32px] text-center">
                <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest mb-4">No vehicles in garage</p>
                <button onClick={() => setShowAddCar(true)} className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">+ Add Your EV</button>
              </div>
            ) : (
              userCars.map((car: any) => {
                const isActive = selectedCar === car.id;
                return (
                  <div
                    key={car.instanceId || car.id}
                    onClick={() => setSelectedCar(car.id)}
                    className={`p-5 rounded-[28px] border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-emerald-500' : 'text-zinc-500'}`}>
                          {car.brand}
                        </p>
                        <h3 className="text-white font-black italic uppercase text-lg tracking-tight">{car.name}</h3>
                        <div className="flex gap-2 mt-2">
                          <span className="bg-zinc-800 text-zinc-400 text-[8px] font-black uppercase px-2 py-1 rounded-lg">{car.charger}</span>
                          <span className="bg-zinc-800 text-zinc-400 text-[8px] font-black uppercase px-2 py-1 rounded-lg">{car.battery}</span>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        isActive ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-700'
                      }`}>
                        {isActive && <div className="w-3 h-3 bg-black rounded-full" />}
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20">
                        <span className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">● Active Vehicle</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <button
              onClick={() => setShowAddCar(true)}
              className="w-full py-4 border border-dashed border-zinc-700 rounded-2xl text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all"
            >
              + Add Another Vehicle
            </button>
          </div>
        )}

        {/* ─── SESSION HISTORY TAB ─── */}
        {tab === 'sessions' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-[22px]">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">As Driver</p>
                <p className="text-xl font-black text-white italic">{sessions.filter(s => s.type === 'driver').length}</p>
                <p className="text-zinc-600 text-[8px]">sessions</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-[22px]">
                <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">As Host</p>
                <p className="text-xl font-black text-emerald-400 italic">{sessions.filter(s => s.type === 'host').length}</p>
                <p className="text-zinc-600 text-[8px]">sessions</p>
              </div>
            </div>

            {sessions.map(s => (
              <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-[24px] flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 ${
                  s.type === 'host' ? 'bg-emerald-500/10' : 'bg-zinc-800'
                }`}>
                  {s.type === 'host' ? '🏠' : '⚡'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-black italic truncate">{s.station_name}</p>
                  <p className="text-zinc-500 text-[8px] font-bold">{s.kwh} kWh · {s.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-black text-sm italic ${s.type === 'host' ? 'text-emerald-400' : 'text-white'}`}>
                    {s.type === 'host' ? '+' : '-'}₹{s.cost}
                  </p>
                  <p className="text-zinc-600 text-[7px] font-bold uppercase">{s.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── HOST DETAILS TAB ─── */}
        {tab === 'host' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Host toggle */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px] flex justify-between items-center">
              <div>
                <p className="text-white font-black italic uppercase">Enable Host Mode</p>
                <p className="text-zinc-500 text-[8px] font-bold mt-0.5">Share your charger and earn ₹</p>
              </div>
              <button
                onClick={() => setProfile(p => ({ ...p, is_host: !p.is_host }))}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${profile.is_host ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${profile.is_host ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {profile.is_host && (
              <>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
                  <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">KYC Details</p>
                  <p className="text-zinc-600 text-[8px] font-bold">Required to receive payouts. Data is encrypted and secure.</p>

                  {[
                    { label: "Driver's License Number", key: 'dl_number', placeholder: 'HR-0120110012345' },
                    { label: 'Aadhaar Last 4 Digits', key: 'aadhar_last4', placeholder: '1234', type: 'password', max: 4 },
                  ].map(({ label, key, placeholder, type, max }) => (
                    <div key={key}>
                      <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">{label}</label>
                      <input
                        type={type || 'text'}
                        value={(profile as any)[key]}
                        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value.slice(0, max || 50) }))}
                        placeholder={placeholder}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px] space-y-4">
                  <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">Payout Details</p>

                  {[
                    { label: 'UPI ID for Payouts', key: 'host_upi', placeholder: 'azad@upi' },
                    { label: 'Bank Account (Optional)', key: 'host_bank_account', placeholder: 'XXXXX1234 · IFSC' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">{label}</label>
                      <input
                        value={(profile as any)[key]}
                        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-[20px]">
                  <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mb-2">Host Agreement</p>
                  <p className="text-zinc-400 text-[9px] font-bold leading-relaxed">
                    By enabling Host Mode, you agree to ChargeShare's Terms of Service. Platform fee: 15% per session. Payouts processed every Monday. Minimum payout: ₹100.
                  </p>
                </div>
              </>
            )}

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Continue →'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl flex items-center justify-around z-50">
        <Link href="/" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">○</span><span className="text-[9px] font-bold uppercase">Home</span></Link>
        <Link href="/explore" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◎</span><span className="text-[9px] font-bold uppercase">Explore</span></Link>
        <Link href="/host" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◇</span><span className="text-[9px] font-bold uppercase">Host</span></Link>
        <Link href="/wallet" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◍</span><span className="text-[9px] font-bold uppercase">Wallet</span></Link>
        <Link href="/profile" className="flex flex-col items-center text-emerald-400 gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mb-1"></div><span className="text-[9px] font-bold uppercase">Profile</span></Link>
      </nav>
    </main>
  );
}