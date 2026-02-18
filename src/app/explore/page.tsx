'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import L from 'leaflet';

// Icon Definitions
const iconPrivate = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const iconPublic = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ExplorePage() {
  const supabase = createClient();
  const [chargers, setChargers] = useState<any[]>([]);
  const [pos, setPos] = useState<[number, number]>([28.6139, 77.2090]); // Default Delhi

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      setPos([lat, lng]);

      try {
        // 1. Fetch Hosts from Supabase (Private)
        const { data: hostData } = await supabase.rpc('nearby_chargers', {
          user_lat: lat,
          user_long: lng,
          radius_meters: 25000
        });

        // 2. Fetch Public Stations from Open Charge Map API
        const ocmKey = process.env.NEXT_PUBLIC_OCM_API_KEY;
        const ocmRes = await fetch(
          `https://api.openchargemap.io/v3/poi/?key=${ocmKey}&latitude=${lat}&longitude=${lng}&distance=25&distanceunit=KM&maxresults=50`
        );
        const ocmRaw = await ocmRes.json();

        // Standardize OCM data format
        const publicData = ocmRaw.map((item: any) => ({
          id: `ocm-${item.ID}`,
          name: item.AddressInfo.Title,
          latitude: item.AddressInfo.Latitude,
          longitude: item.AddressInfo.Longitude,
          is_public: true,
          charger_type: item.Connections?.[0]?.ConnectionType?.Title || 'Standard',
          price_per_kwh: item.UsageCost || 'Varies'
        }));

        // Merge both lists
        setChargers([...(hostData || []), ...publicData]);
      } catch (error) {
        console.error("Error loading chargers:", error);
      }
    });
  }, [supabase]);

  return (
    <main className="h-screen w-full bg-[#050a14] relative">
      <MapContainer center={pos} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; Open Charge Map'
        />
        
        {chargers.map((charger) => (
          <Marker 
            key={charger.id} 
            position={[charger.latitude, charger.longitude]}
            icon={charger.is_public ? iconPublic : iconPrivate}
          >
            <Popup className="custom-popup">
              <div className="p-2">
                <h3 className="font-black uppercase text-xs italic">{charger.name}</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">
                  {charger.charger_type} • {charger.is_public ? 'Public' : `₹${charger.price_per_kwh}/kWh`}
                </p>
                <button 
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${charger.latitude},${charger.longitude}`)}
                  className="mt-2 w-full bg-emerald-500 text-black text-[9px] font-black py-2 rounded-lg uppercase"
                >
                  Navigate
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </main>
  );
}