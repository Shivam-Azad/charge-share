'use client';

export default function UsageHeatmap({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);

  return (
    <div className="rounded-[24px] p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Peak Hours</p>
      <div className="grid grid-cols-6 gap-2">
        {hours.map((count, hour) => {
          const intensity = count / max;
          return (
            <div key={hour} className="aspect-square rounded-xl flex items-center justify-center text-[8px] font-black"
              style={{
                background: `rgba(16,185,129,${0.05 + intensity * 0.5})`,
                border: '1px solid rgba(255,255,255,0.06)',
                color: intensity > 0.5 ? '#00130b' : 'rgba(255,255,255,0.35)',
              }}>
              {hour}
            </div>
          );
        })}
      </div>
    </div>
  );
}
