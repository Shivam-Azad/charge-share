'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    // In a real app, we'd verify the OTP here
    // For your demo, we'll set a fake "auth" flag in the browser
    localStorage.setItem('isLoggedIn', 'true');
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-black text-white p-8 flex flex-col justify-center font-sans">
      <div className="mb-12">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl mb-6 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
          <span className="text-black text-2xl font-black italic">⚡</span>
        </div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
          Charge.<span className="text-emerald-500">Share</span>
        </h1>
        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-[0.3em] mt-4">
          India's Private EV Network
        </p>
      </div>

      {step === 'PHONE' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl focus-within:border-emerald-500 transition-all flex items-center gap-3">
            <span className="text-zinc-500 font-bold border-r border-zinc-800 pr-3">+91</span>
            <input 
              type="tel" 
              placeholder="Mobile Number"
              className="bg-transparent outline-none flex-1 font-mono tracking-widest text-lg"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <button 
            onClick={() => phone.length === 10 ? setStep('OTP') : alert('Enter 10 digits')}
            className="w-full py-5 bg-white text-black font-black uppercase text-xs tracking-[.3em] rounded-2xl active:scale-95 transition-all"
          >
            Get OTP
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in zoom-in duration-300">
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4].map((i) => (
              <input key={i} type="text" maxLength={1} className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl text-center text-2xl font-black text-emerald-500" />
            ))}
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-5 bg-emerald-500 text-black font-black uppercase text-xs tracking-[.3em] rounded-2xl"
          >
            Verify OTP
          </button>
        </div>
      )}

      <button 
        onClick={handleLogin}
        className="mt-8 text-zinc-600 text-[9px] uppercase font-bold tracking-widest hover:text-zinc-400 transition-colors"
      >
        Skip to Guest Mode →
      </button>
    </main>
  );
}