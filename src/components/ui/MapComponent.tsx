"use client";
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { CHANDIGARH_STATIONS } from '@/data/ev-database';
import PaymentModal from '@/components/PaymentModal';

export default function MapComponent({ filter }: { filter: string }) {
  const router = useRouter();
  const [allStations, setAllStations] = useState<any[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  const center: [number, number] = [30.7333, 76.7794];

  useEffect(() => {
    const publicHubs = CHANDIGARH_STATIONS;
    let savedHosts = [];
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('my_hosted_chargers');
      savedHosts = stored ? JSON.parse(stored) : [];
    }
    const combined = [...publicHubs, ...savedHosts];
    setAllStations(filter === 'all' ? combined : combined.filter(s => s.type === filter));
  }, [filter]);

  const handleBookClick = (e: React.MouseEvent, station: any) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedStation(station);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    // 1. EXTRACT THE RATE (e.g., "₹15/kWh" -> 15)
    const rawPrice = selectedStation?.connectors?.[0]?.price || "₹12/kWh";
    const numericRate = parseInt(rawPrice.replace(/[^0-9]/g, '')) || 12;

    // 2. SAVE EVERYTHING FOR THE HOME PAGE
    localStorage.setItem('chargingStatus', 'CHARGING');
    localStorage.setItem('currentStationName', selectedStation.name);
    localStorage.setItem('currentStationRate', numericRate.toString()); // SAVE THE RATE
    localStorage.setItem('batteryLevel', '21'); 
    localStorage.setItem('liveKwh', '0.0');

    router.push('/');
  };

  return (
    <div className="h-[450px] w-full relative rounded-[32px] overflow-hidden border border-zinc-800 shadow-xl">
      {showPayment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <PaymentModal 
             amount="11" 
             onSuccess={handlePaymentSuccess} 
             onClose={() => setShowPayment(false)}
           />
        </div>
      )}

      <MapContainer center={center} zoom={12} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {allStations.map((station) => (
          <Marker key={station.id} position={station.location} icon={new L.Icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${station.type === 'public' ? 'blue' : 'green'}.png`,
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          })}>
            <Popup>
              <div className="p-2 text-black min-w-[150px] font-sans">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-sm uppercase italic leading-none">{station.name}</h3>
                </div>
                <p className="text-[10px] text-zinc-500 mb-2">{station.address}</p>
                <div className="flex justify-between items-center border-t pt-2 border-zinc-100">
                    <span className="text-xs font-black">{station.connectors?.[0]?.price || '₹12/kWh'}</span>
                    <button onClick={(e) => handleBookClick(e, station)} className="bg-black text-white px-4 py-1 rounded-full text-[9px] font-bold italic uppercase">Book</button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}