'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import map to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/ui/MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full bg-zinc-900 animate-pulse rounded-[32px] flex items-center justify-center">
      <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.3em]">Loading Grid...</p>
    </div>
  )
}) as React.ComponentType<{ filter: 'all' | 'public' | 'private' }>;

export default function ExplorePage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'public' | 'private'>('all');

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-6 pb-32">
      {/* 1. Header */}
      <div className="flex justify-between items-end mb-8 pt-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Explore</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Chandigarh Grid</p>
        </div>
        <div className="text-right">
          <p className="text-blue-400 text-xs font-black italic">12+ HUBs</p>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-tight">Nearby Locations</p>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {(['all', 'public', 'private'] as const).map((filter) => (
          <button 
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${
              activeFilter === filter 
                ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            {filter === 'all' ? 'All' : filter === 'public' ? 'Public Hubs' : 'Private Hosts'}
          </button>
        ))}
      </div>

      {/* 3. Map Section */}
      <div className="relative mb-8 shadow-2xl shadow-blue-500/10">
        <MapComponent filter={activeFilter} />
      </div>

      {/* 4. Quick Status Card */}
      <div className="bg-gradient-to-r from-zinc-900/50 to-zinc-900/20 border border-zinc-800 p-6 rounded-[32px] mb-6">
        <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Fastest Near You</h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-black italic uppercase">Mercedes-Benz Hub</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-tighter">Industrial Area Ph II • 0.8km</p>
          </div>
          <div className="text-right">
            <p className="text-blue-400 font-black italic">180kW</p>
            <p className="text-[8px] text-emerald-500 font-bold uppercase">Live Available</p>
          </div>
        </div>
      </div>

      {/* 5. Navigation Bar */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-[#0a0a0a]/80 backdrop-blur-xl border border-zinc-800/50 rounded-full flex items-center justify-around px-6 z-50 shadow-2xl">
        <Link href="/" className="text-zinc-500 hover:text-white flex flex-col items-center gap-1 transition-colors">
          <span className="text-lg">◓</span>
          <span className="text-[8px] font-bold uppercase">Home</span>
        </Link>
        <Link href="/explore" className="text-blue-400 flex flex-col items-center gap-1">
          <div className="w-1 h-1 bg-blue-400 rounded-full mb-1"></div>
          <span className="text-lg">◎</span>
          <span className="text-[8px] font-bold uppercase">Explore</span>
        </Link>
        <Link href="/host" className="text-zinc-500 hover:text-white flex flex-col items-center gap-1 transition-colors">
          <span className="text-lg">◇</span>
          <span className="text-[8px] font-bold uppercase">Host</span>
        </Link>
        <Link href="/wallet" className="text-zinc-500 hover:text-white flex flex-col items-center gap-1 transition-colors">
          <span className="text-lg">◍</span>
          <span className="text-[8px] font-bold uppercase">Wallet</span>
        </Link>
      </nav>
    </main>
  );
}