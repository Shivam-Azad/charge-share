'use client';

export default function CO2Card({ kwh }: { kwh: number }) {
  const co2 = kwh * 0.82;

  return (
    <div className="rounded-[24px] p-5 overflow-hidden relative" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', backdropFilter: 'blur(16px)' }}>
      <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)' }} />
      <p className="text-[9px] font-black uppercase tracking-widest mb-1 relative" style={{ color: '#10b981' }}>CO2 Saved</p>
      <p className="text-3xl font-black text-white relative">{co2.toFixed(1)} kg</p>
      <p className="text-[9px] font-bold mt-2 relative" style={{ color: 'rgba(255,255,255,0.35)' }}>{kwh.toFixed(1)} kWh charged x 0.82 kg CO2/kWh</p>
    </div>
  );
}
