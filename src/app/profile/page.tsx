'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVehicle } from '@/context/VehicleContext'; // 1. Import the hook

export default function ProfilePage() {
  const router = useRouter();
  
  // 2. Extract the garage data from context
  const { userCars, selectedCarId, setSelectedCar } = useVehicle();

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-32 font-sans overflow-x-hidden">
      
      {/* 1. Header */}
      <div className="flex items-center justify-between mb-8 pt-4">
        <button onClick={() => router.back()} className="text-zinc-400 text-sm font-bold uppercase tracking-widest">
          ← Back
        </button>
        <h1 className="text-xl font-black italic uppercase tracking-tighter">Account Settings</h1>
        <div className="w-10" /> 
      </div>

      {/* 2. User Branding Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 mb-6 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] rounded-full"></div>
        <div className="w-24 h-24 bg-zinc-800 rounded-full border-2 border-emerald-500 mx-auto mb-4 flex items-center justify-center text-3xl font-black italic shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          SA
        </div>
        <h2 className="text-2xl font-black italic uppercase tracking-tight">Shivam Azad</h2>
        <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Verified Driver • Member since 2024</p>
      </div>

      {/* 3. Detailed Profile Sections */}
      <div className="space-y-6">
        
        {/* Personal Info Group */}
        <div>
          <h3 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 ml-2">Personal Details</h3>
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-[24px] divide-y divide-zinc-800/50">
            <div className="p-5 flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Email</span>
              <span className="text-sm font-bold">shivam.azad@example.com</span>
            </div>
            <div className="p-5 flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Phone</span>
              <span className="text-sm font-bold">+91 98765 43210</span>
            </div>
          </div>
        </div>

        {/* --- ADDED GARAGE LOGIC HERE --- */}
        <div>
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Your Garage</h3>
            <Link href="/onboarding" className="text-emerald-500 text-[10px] font-black uppercase hover:underline">+ Add Car</Link>
          </div>
          
          <div className="space-y-3">
            {/* If no cars, show a placeholder */}
            {userCars.length === 0 && (
              <p className="text-zinc-600 text-[10px] uppercase text-center py-4 italic">No vehicles added yet</p>
            )}

            {userCars.map((car: any) => (
              <button 
                key={car.instanceId} 
                onClick={() => setSelectedCar(car.id)}
                className={`w-full p-5 rounded-[24px] border flex items-center gap-4 transition-all active:scale-95 ${
                  selectedCarId === car.id 
                  ? 'border-emerald-500 bg-emerald-500/5' 
                  : 'border-zinc-800 bg-zinc-900 opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  selectedCarId === car.id ? 'bg-emerald-500/20' : 'bg-zinc-800'
                }`}>
                  🚗
                </div>
                <div className="text-left">
                   <p className="text-sm font-black italic uppercase tracking-tight">{car.name}</p>
                   <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
                     {car.charger} • {car.battery} {selectedCarId === car.id ? '• Active' : ''}
                   </p>
                </div>
                {selectedCarId === car.id && (
                  <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                )}
              </button>
            ))}
          </div>
        </div>
        {/* --- END GARAGE LOGIC --- */}

        {/* Preferences Section */}
        <div>
          <h3 className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-3 ml-2">Preferences</h3>
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-[24px] overflow-hidden">
            {[
              { label: 'Payment Methods', icon: '💳', val: 'UPI / Visa' },
              { label: 'Saved Locations', icon: '📍', val: 'Home, Work' },
              { label: 'Notification Settings', icon: '🔔', val: '' },
              { label: 'Privacy & Security', icon: '🛡️', val: '' },
            ].map((item, i) => (
              <div key={i} className="p-5 flex justify-between items-center border-b border-zinc-800 last:border-0 hover:bg-zinc-800/20 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-bold uppercase tracking-tight">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600 font-bold uppercase">{item.val}</span>
                  <span className="text-zinc-700 group-hover:text-emerald-500 transition-colors">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full mt-4 py-5 bg-red-500/5 border border-red-500/10 text-red-500 font-black uppercase text-[10px] tracking-[0.3em] rounded-[24px] hover:bg-red-500 hover:text-white transition-all duration-300"
        >
          Logout Session
        </button>
      </div>

      {/* Navigation Bar */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-[#121212]/90 backdrop-blur-xl border border-zinc-800/50 rounded-full flex items-center justify-around px-6 z-50">
        <Link href="/" className="text-zinc-500 flex flex-col items-center gap-1">
          <span className="text-lg">◓</span>
          <span className="text-[8px] font-bold uppercase tracking-widest">Home</span>
        </Link>
        <Link href="/host" className="text-zinc-500 flex flex-col items-center gap-1">
          <span className="text-lg">◇</span>
          <span className="text-[8px] font-bold uppercase tracking-widest">Host</span>
        </Link>
        <Link href="/wallet" className="text-zinc-500 flex flex-col items-center gap-1">
          <span className="text-lg">◍</span>
          <span className="text-[8px] font-bold uppercase tracking-widest">Wallet</span>
        </Link>
        <button className="text-emerald-500 flex flex-col items-center gap-1">
          <div className="w-1 h-1 bg-emerald-500 rounded-full mb-1 shadow-[0_0_5px_#10b981]"></div>
          <span className="text-lg text-zinc-300">○</span>
          <span className="text-[8px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </main>
  );
}