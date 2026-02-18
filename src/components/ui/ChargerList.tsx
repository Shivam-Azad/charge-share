'use client';
import { useState } from 'react';
import PaymentModal from '../PaymentModal'; 

interface Station {
  id: number;
  name: string;
  charger_type: string;
  price: string | number;
  // Add other fields returned by your Supabase RPC if needed
}

interface ChargerListProps {
  items: Station[]; // FIX: Added items to the interface
  onStart: (rate: number, name: string) => void;
}

export default function ChargerList({ items, onStart }: ChargerListProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  
  const handleStartClick = (station: Station) => {
    setSelectedStation(station);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    if (onStart && selectedStation) {
      // Ensure price is a number before passing to onStart
      const rate = typeof selectedStation.price === 'string' 
        ? parseInt(selectedStation.price) 
        : selectedStation.price;
      onStart(rate, selectedStation.name);
    }
  };

  return (
    <div className="w-full max-w-md mt-2">
      {showPayment && selectedStation && (
        <PaymentModal 
          amount={selectedStation.price.toString()} 
          onSuccess={handlePaymentSuccess} 
          onClose={() => setShowPayment(false)}
        />
      )}

      <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
        {items.map((station) => (
          <div key={station.id} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[32px] flex justify-between items-center transition-all hover:border-emerald-500/20">
            <div>
              <h3 className="text-white font-black italic uppercase text-sm tracking-tight">{station.name}</h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{station.charger_type}</p>
              <p className="text-emerald-400 text-sm font-black mt-2">₹{station.price}<span className="text-zinc-600 text-[10px] ml-1">/unit</span></p>
            </div>
            <button 
              onClick={() => handleStartClick(station)}
              className="bg-emerald-500 text-black px-8 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
            >
              START
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}