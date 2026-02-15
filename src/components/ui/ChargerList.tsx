'use client';
import { useState } from 'react';
import PaymentModal from '../PaymentModal'; 

interface ChargerListProps {
  onStart?: () => void;
}

const CHARGERS = [
  { id: 1, name: "SARAH'S DRIVEWAY", power: "7.2kW", price: "11", dist: "0.4km" },
  { id: 2, name: "GREEN PARK HUB", power: "22kW", price: "12", dist: "1.2km" },
  { id: 3, name: "MODERN VILLA #4", power: "11kW", price: "10", dist: "2.1km" },
];

export default function ChargerList({ onStart }: ChargerListProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState('');
  
  const handleStartClick = (price: string) => {
    setSelectedPrice(price);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    if (onStart) onStart();
  };

  return (
    <div className="w-full max-w-md mt-2">
      {showPayment && (
        <PaymentModal 
          amount={selectedPrice} 
          onSuccess={handlePaymentSuccess} 
          onClose={() => setShowPayment(false)}
        />
      )}

      <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
        {CHARGERS.map((charger) => (
          <div key={charger.id} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[32px] flex justify-between items-center transition-all hover:border-emerald-500/20">
            <div>
              <h3 className="text-white font-black italic uppercase text-sm tracking-tight">{charger.name}</h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">{charger.power} • {charger.dist}</p>
              <p className="text-emerald-400 text-sm font-black mt-2">₹{charger.price}<span className="text-zinc-600 text-[10px] ml-1">/unit</span></p>
            </div>
            <button 
              onClick={() => handleStartClick(charger.price)}
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