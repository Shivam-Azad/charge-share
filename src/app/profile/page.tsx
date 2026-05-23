'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useVehicle } from '@/context/VehicleContext';
import { createClient } from '@/utils/supabase/client';
import { EV_BRANDS, EV_MODELS } from '@/data/ev-database';

type Tab = 'profile' | 'garage' | 'sessions' | 'host';

interface UserProfile {
  full_name: string; mobile_number: string; city: string; upi_id: string;
  is_host: boolean; host_bank_account: string; host_upi: string;
  dl_number: string; aadhar_last4: string; rating: number; total_sessions: number;
}

interface Session {
  id: string; station_name: string; kwh: number; cost: number; date: string; type: 'driver' | 'host';
}

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { userCars, selectedCar, setSelectedCar, addCar } = useVehicle();

  const [tab, setTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastOk, setToastOk] = useState(true);
  const [showAddCar, setShowAddCar] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [carForm, setCarForm] = useState({ brand: 'Tata', model: 'nexon-ev' });

  const [profile, setProfile] = useState<UserProfile>({
    full_name: '', mobile_number: '', city: '', upi_id: '',
    is_host: false, host_bank_account: '', host_upi: '',
    dl_number: '', aadhar_last4: '', rating: 4.8, total_sessions: 0,
  });

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setProfileLoading(false); return; }
    const supabase = createClient();
    (async () => {
      setProfileLoading(true);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(prev => ({
          ...prev,
          full_name: data.full_name ?? prev.full_name,
          mobile_number: data.mobile_number ?? data.phone ?? prev.mobile_number,
          city: data.city ?? prev.city,
          upi_id: data.upi_id ?? prev.upi_id,
          is_host: data.is_host ?? prev.is_host,
          host_bank_account: data.host_bank_account ?? prev.host_bank_account,
          host_upi: data.host_upi ?? prev.host_upi,
          dl_number: data.dl_number ?? prev.dl_number,
          aadhar_last4: data.aadhar_last4 ?? prev.aadhar_last4,
          rating: data.rating ?? prev.rating,
          total_sessions: data.total_sessions ?? prev.total_sessions,
        }));
      } else {
        const meta = user.user_metadata ?? {};
        setProfile(prev => ({ ...prev, full_name: meta.full_name || meta.name || '', mobile_number: meta.mobile_number || meta.phone || '' }));
        await supabase.from('profiles').insert({ id: user.id, full_name: meta.full_name || meta.name || '' });
      }
      setProfileLoading(false);
    })();
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      setSessionsLoading(true);
      const { data: driverSessions } = await supabase.from('session_requests').select('id, amount_charged, kwh_delivered, ended_at, charger_id').eq('driver_id', user.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(20);
      const { data: hostSessions } = await supabase.from('session_requests').select('id, amount_charged, kwh_delivered, ended_at, charger_id').eq('host_id', user.id).eq('status', 'completed').order('ended_at', { ascending: false }).limit(20);
      const enrich = async (rows: any[], type: 'driver' | 'host'): Promise<Session[]> => {
        if (!rows?.length) return [];
        return Promise.all(rows.map(async (r) => {
          const { data: ch } = await supabase.from('chargers').select('name').eq('id', r.charger_id).single();
          return { id: r.id, station_name: ch?.name || 'Charging Station', kwh: +(r.kwh_delivered || 0).toFixed(2), cost: +(r.amount_charged || 0).toFixed(0), date: r.ended_at ? new Date(r.ended_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', type };
        }));
      };
      const [driverRows, hostRows] = await Promise.all([enrich(driverSessions ?? [], 'driver'), enrich(hostSessions ?? [], 'host')]);
      setSessions([...driverRows, ...hostRows].sort((a, b) => a.date === '—' ? 1 : b.date === '—' ? -1 : new Date(b.date).getTime() - new Date(a.date).getTime()));
      setSessionsLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { showToast('Not logged in', false); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id, full_name: profile.full_name, mobile_number: profile.mobile_number,
      city: profile.city, upi_id: profile.upi_id, is_host: profile.is_host,
      host_bank_account: profile.host_bank_account, host_upi: profile.host_upi,
      dl_number: profile.dl_number, aadhar_last4: profile.aadhar_last4,
      onboarding_complete: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    setSaving(false);
    if (!error) { showToast('Profile saved'); setEditMode(false); }
    else showToast(error.message, false);
  };

  const handleAddCar = () => {
    const model = (EV_MODELS[carForm.brand] || []).find((m: any) => m.id === carForm.model);
    if (!model) return;
    addCar({ ...model, brand: carForm.brand });
    setShowAddCar(false);
    showToast('Vehicle added');
  };

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';
  const firstName = profile.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Driver';
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
  const totalEarned = sessions.filter(s => s.type === 'host').reduce((a, s) => a + s.cost, 0);
  const totalSpent = sessions.filter(s => s.type === 'driver').reduce((a, s) => a + s.cost, 0);

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13, fontWeight: 700, outline: 'none' };
  const inputStyleRO = { ...inputStyle, background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.7)', cursor: 'default' };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: '#050508' }}>
        <div className="w-7 h-7 rounded-full border-2 border-t-emerald-500 animate-spin" style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-40" style={{ background: '#050508' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-3 duration-200"
          style={{ background: toastOk ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${toastOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toastOk ? '#10b981' : '#f87171' }}>
          {toastOk ? '✓' : '✗'} {toast}
        </div>
      )}

      {/* Add Car Modal */}
      {showAddCar && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
          <div className="w-full max-w-sm rounded-[32px] p-6 space-y-4 animate-in slide-in-from-bottom-8 duration-300"
            style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-center mb-2">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: '#10b981' }}>Garage</p>
              <h3 className="text-white font-black text-xl">Add Vehicle</h3>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Brand</label>
              <select value={carForm.brand} onChange={e => setCarForm({ brand: e.target.value, model: EV_MODELS[e.target.value]?.[0]?.id || '' })}
                style={{ ...inputStyle }}>
                {EV_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Model</label>
              <select value={carForm.model} onChange={e => setCarForm(f => ({ ...f, model: e.target.value }))}
                style={{ ...inputStyle }}>
                {(EV_MODELS[carForm.brand] || []).map((m: any) => <option key={m.id} value={m.id}>{m.name} · {m.battery}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAddCar(false)} className="flex-1 py-3.5 font-black uppercase text-[9px] tracking-widest rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>Cancel</button>
              <button onClick={handleAddCar} className="flex-1 py-3.5 font-black uppercase text-[9px] tracking-widest rounded-2xl"
                style={{ background: '#10b981', color: '#000' }}>Add →</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto px-4 pt-12">

        {/* ── HERO CARD ── */}
        <div className="rounded-[28px] p-5 mb-5 relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Glow */}
          <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />

          <div className="flex items-start gap-4 mb-5 relative">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-black font-black text-xl"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 28px rgba(16,185,129,0.35)' }}>
                {initials}
              </div>
              {profile.is_host && (
                <div className="absolute -bottom-1.5 -right-1.5 rounded-lg px-1.5 py-0.5"
                  style={{ background: '#10b981' }}>
                  <span className="text-black text-[7px] font-black uppercase">Host</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-white font-black text-2xl tracking-tight leading-none truncate">{firstName}</h1>
              <p className="text-[10px] font-bold truncate mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="text-[10px]" style={{ color: i <= Math.round(profile.rating) ? '#10b981' : 'rgba(255,255,255,0.15)' }}>★</span>
                  ))}
                </div>
                <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{profile.rating.toFixed(1)} · Since {memberSince}</span>
              </div>
            </div>

            {/* Logout */}
            <button onClick={async () => { await logout(); window.location.href = '/login'; }}
              className="flex-shrink-0 p-2 rounded-xl transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />

          {/* Stats */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { val: sessions.length, label: 'Sessions', accent: false },
              { val: `₹${totalEarned}`, label: 'Earned', accent: true },
              { val: `₹${totalSpent}`, label: 'Spent', accent: false },
              { val: userCars.length || 0, label: 'Vehicles', accent: false },
            ].map(({ val, label, accent }, i) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                {i > 0 && <div />}
                <span className="text-lg font-black leading-none" style={{ color: accent ? '#10b981' : 'white' }}>{val}</span>
                <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="grid grid-cols-4 gap-1 mb-5 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {([['profile', 'Profile'], ['garage', 'Garage'], ['sessions', 'History'], ['host', 'Host']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all"
              style={{
                background: tab === t ? '#10b981' : 'transparent',
                color: tab === t ? '#000' : 'rgba(255,255,255,0.3)',
                boxShadow: tab === t ? '0 0 16px rgba(16,185,129,0.25)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400">

            {/* Personal Info */}
            <div className="rounded-[24px] overflow-hidden" style={glass}>
              <div className="px-5 pt-4 pb-3 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Personal Info</p>
                {!editMode && (
                  <button onClick={() => setEditMode(true)} className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#10b981' }}>Edit</button>
                )}
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', key: 'full_name', placeholder: 'Shivam Azad' },
                    { label: 'City', key: 'city', placeholder: 'Hamirpur' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <p className="text-[8px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                      {editMode ? (
                        <input value={(profile as any)[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder} style={inputStyle} />
                      ) : (
                        <p className="text-white text-sm font-bold px-1">{(profile as any)[key] || <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mobile */}
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Mobile Number</p>
                  {editMode ? (
                    <div className="flex gap-2">
                      <span className="px-3 py-2.5 rounded-xl text-sm font-black flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>+91</span>
                      <input value={profile.mobile_number} onChange={e => setProfile(p => ({ ...p, mobile_number: e.target.value.replace(/\D/g,'').slice(0,10) }))}
                        placeholder="9876543210" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  ) : (
                    <p className="text-white text-sm font-bold px-1">{profile.mobile_number ? `+91 ${profile.mobile_number}` : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}</p>
                  )}
                </div>

                {/* UPI */}
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>UPI ID</p>
                  {editMode ? (
                    <input value={profile.upi_id} onChange={e => setProfile(p => ({ ...p, upi_id: e.target.value }))}
                      placeholder="name@upi" style={inputStyle} />
                  ) : (
                    <p className="text-white text-sm font-bold px-1">{profile.upi_id || <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Account info */}
            <div className="rounded-[24px] p-5" style={glass}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Account</p>
              <div className="space-y-3">
                {[
                  { label: 'Email', value: user?.email || '—', mono: false },
                  { label: 'Member Since', value: memberSince, mono: false },
                  { label: 'User ID', value: (user?.id?.slice(0,16) ?? '') + '…', mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                    <span className="text-[11px] font-bold truncate max-w-[55%] text-right"
                      style={{ color: mono ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 10 : 11 }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {editMode && (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="flex-[2] py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: '#10b981', color: '#000', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
                  {saving ? 'Saving...' : 'Save Changes →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── GARAGE TAB ── */}
        {tab === 'garage' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400">
            {userCars.length === 0 ? (
              <div className="py-16 text-center rounded-[28px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>🚗</div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>No vehicles yet</p>
                <button onClick={() => setShowAddCar(true)} className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#10b981' }}>+ Add Your EV</button>
              </div>
            ) : (
              userCars.map((car: any) => {
                const isActive = selectedCar === car.id;
                return (
                  <div key={car.instanceId || car.id} onClick={() => setSelectedCar(car.id)}
                    className="rounded-[24px] p-5 cursor-pointer transition-all active:scale-[0.98]"
                    style={{
                      background: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      backdropFilter: 'blur(12px)',
                    }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: isActive ? '#10b981' : 'rgba(255,255,255,0.3)' }}>{car.brand}</p>
                        <h3 className="text-white font-black text-base tracking-tight">{car.name}</h3>
                        <div className="flex gap-1.5 mt-2">
                          {[car.charger, car.battery].map((tag: string) => tag && (
                            <span key={tag} className="text-[8px] font-black uppercase px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ borderColor: isActive ? '#10b981' : 'rgba(255,255,255,0.15)', background: isActive ? '#10b981' : 'transparent' }}>
                        {isActive && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(16,185,129,0.15)' }}>
                        <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#10b981' }}>● Active Vehicle</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <button onClick={() => setShowAddCar(true)}
              className="w-full py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all"
              style={{ border: '1px dashed rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', background: 'transparent' }}>
              + Add Another Vehicle
            </button>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'sessions' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'As Driver', value: sessions.filter(s => s.type === 'driver').length, sub: `₹${totalSpent} spent`, accent: false },
                { label: 'As Host', value: sessions.filter(s => s.type === 'host').length, sub: `₹${totalEarned} earned`, accent: true },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className="rounded-2xl p-4" style={glass}>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                  <p className="text-2xl font-black" style={{ color: accent ? '#10b981' : 'white' }}>{value}</p>
                  <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>
                </div>
              ))}
            </div>

            {sessionsLoading ? (
              <div className="py-12 text-center">
                <div className="w-6 h-6 rounded-full border-2 border-t-emerald-500 animate-spin mx-auto mb-3"
                  style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center rounded-[28px]" style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>No sessions yet</p>
              </div>
            ) : (
              sessions.map(s => (
                <div key={s.id} className="rounded-[20px] p-4 flex items-center gap-3" style={glass}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: s.type === 'host' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', color: s.type === 'host' ? '#10b981' : 'rgba(255,255,255,0.5)' }}>
                    {s.type === 'host' ? '⌂' : '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[11px] font-black truncate">{s.station_name}</p>
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.kwh} kWh · {s.date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm" style={{ color: s.type === 'host' ? '#10b981' : 'rgba(255,255,255,0.9)' }}>
                      {s.type === 'host' ? '+' : '−'}₹{s.cost}
                    </p>
                    <p className="text-[8px] font-bold uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.type}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── HOST TAB ── */}
        {tab === 'host' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-400">

            {/* Host toggle */}
            <div className="rounded-[24px] p-5 flex items-center justify-between" style={glass}>
              <div>
                <p className="text-white font-black text-sm">Host Mode</p>
                <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Share your charger and earn</p>
              </div>
              <button onClick={() => setProfile(p => ({ ...p, is_host: !p.is_host }))}
                className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                style={{ background: profile.is_host ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300"
                  style={{ left: profile.is_host ? 24 : 2 }} />
              </button>
            </div>

            {profile.is_host && (
              <>
                {/* KYC */}
                <div className="rounded-[24px] overflow-hidden" style={glass}>
                  <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>KYC Details</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <p className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>Required to receive payouts. Stored securely.</p>
                    {[
                      { label: "Driver's License No.", key: 'dl_number', placeholder: 'HR-0120110012345', type: 'text', max: 50 },
                      { label: 'Aadhaar Last 4 Digits', key: 'aadhar_last4', placeholder: '••••', type: 'password', max: 4 },
                    ].map(({ label, key, placeholder, type, max }) => (
                      <div key={key}>
                        <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
                        <input type={type} value={(profile as any)[key]}
                          onChange={e => setProfile(p => ({ ...p, [key]: e.target.value.slice(0, max) }))}
                          placeholder={placeholder} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payout */}
                <div className="rounded-[24px] overflow-hidden" style={glass}>
                  <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Payout Details</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {[
                      { label: 'UPI ID', key: 'host_upi', placeholder: 'name@upi' },
                      { label: 'Bank Account (optional)', key: 'host_bank_account', placeholder: 'XXXXX1234 · IFSC' },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
                        <input value={(profile as any)[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Host agreement — platform fee removed */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#10b981' }}>Host Agreement</p>
                  <p className="text-[9px] font-bold leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    ChargeShare is completely free — you keep 100% of your earnings. Payouts every Monday. Min. payout ₹100. By saving you agree to ChargeShare's Terms of Service.
                  </p>
                </div>
              </>
            )}

            <button onClick={saveProfile} disabled={saving}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
              {saving ? 'Saving...' : 'Save & Continue →'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm h-16 rounded-3xl flex items-center justify-around z-50"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {[
          { href: '/', icon: '○', label: 'Home', active: false },
          { href: '/explore', icon: '◎', label: 'Explore', active: false },
          { href: '/host', icon: '◇', label: 'Host', active: false },
          { href: '/wallet', icon: '◍', label: 'Wallet', active: false },
          { href: '/profile', icon: null, label: 'Profile', active: true },
        ].map(({ href, icon, label, active }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1">
            {active
              ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
              : <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>
            }
            <span className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: active ? '#10b981' : 'rgba(255,255,255,0.25)' }}>{label}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}