import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VehicleProvider } from '@/context/VehicleContext';
import { AuthProvider } from '@/components/AuthProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChargeShare - EV Social Network",
  description: "Share your charger, grow the community.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <VehicleProvider>
            <div className="desktop-shell">

              {/* ── Animated background ── */}
              <div className="bg-anim">
                <div className="orb o1" /><div className="orb o2" /><div className="orb o3" />
                <div className="grid-bg" />
              </div>

              {/* ── LEFT: Branding ── */}
              <div className="left-panel">
                <div className="brand-icon">⚡</div>
                <p className="brand-name">Charge<span>.Share</span></p>
                <p className="brand-sub">India's Private EV Network</p>
                <div className="brand-stats">
                  <div className="stat"><span className="stat-val">2.4K</span><span className="stat-label">Chargers</span></div>
                  <div className="stat-divider"/>
                  <div className="stat"><span className="stat-val">18K</span><span className="stat-label">Sessions</span></div>
                  <div className="stat-divider"/>
                  <div className="stat"><span className="stat-val">P2P</span><span className="stat-label">Network</span></div>
                </div>
              </div>

              {/* ── CENTER: Phone ── */}
              <div className="phone-wrap">
                <div className="phone-frame">
                  <div className="phone-notch" />
                  <div className="phone-screen">{children}</div>
                  <div className="phone-bar" />
                </div>
              </div>

              {/* ── RIGHT: EV charging animation ── */}
              <div className="right-panel">
                <svg className="ev-scene" viewBox="0 0 320 420" fill="none" xmlns="http://www.w3.org/2000/svg">

                  {/* Road */}
                  <rect x="20" y="340" width="280" height="6" rx="3" fill="#18181b"/>
                  <rect x="20" y="348" width="280" height="2" rx="1" fill="#10b981" opacity="0.2"/>

                  {/* Road dashes — animated */}
                  <g className="road-dash">
                    <rect x="60"  y="343" width="30" height="2" rx="1" fill="#27272a"/>
                    <rect x="130" y="343" width="30" height="2" rx="1" fill="#27272a"/>
                    <rect x="200" y="343" width="30" height="2" rx="1" fill="#27272a"/>
                    <rect x="270" y="343" width="30" height="2" rx="1" fill="#27272a"/>
                  </g>

                  {/* Car body */}
                  <g className="car-float">
                    {/* Shadow */}
                    <ellipse cx="160" cy="342" rx="70" ry="6" fill="#10b981" opacity="0.08"/>

                    {/* Wheels */}
                    <circle cx="110" cy="335" r="14" fill="#18181b" stroke="#27272a" strokeWidth="2"/>
                    <circle cx="110" cy="335" r="8"  fill="#09090b" stroke="#10b981" strokeWidth="1.5"/>
                    <circle cx="110" cy="335" r="2"  fill="#10b981"/>
                    <circle cx="210" cy="335" r="14" fill="#18181b" stroke="#27272a" strokeWidth="2"/>
                    <circle cx="210" cy="335" r="8"  fill="#09090b" stroke="#10b981" strokeWidth="1.5"/>
                    <circle cx="210" cy="335" r="2"  fill="#10b981"/>

                    {/* Body */}
                    <rect x="75" y="308" width="170" height="28" rx="4" fill="#09090b" stroke="#27272a" strokeWidth="1.5"/>
                    {/* Roof */}
                    <path d="M105 308 Q115 280 145 276 L175 276 Q205 280 215 308Z" fill="#0f0f0f" stroke="#27272a" strokeWidth="1.5"/>
                    {/* Windshield */}
                    <path d="M113 308 Q120 286 145 282 L175 282 Q200 286 207 308Z" fill="#0a1a12" stroke="#10b981" strokeWidth="0.8" opacity="0.7"/>

                    {/* Headlights */}
                    <rect x="75" y="318" width="18" height="8" rx="2" fill="#10b981" opacity="0.9"/>
                    <rect x="75" y="318" width="18" height="8" rx="2" fill="#10b981" className="headlight-glow"/>
                    {/* Taillights */}
                    <rect x="227" y="318" width="18" height="8" rx="2" fill="#ef4444" opacity="0.7"/>

                    {/* Door line */}
                    <line x1="160" y1="308" x2="160" y2="336" stroke="#1f1f1f" strokeWidth="1"/>
                    {/* Door handles */}
                    <rect x="130" y="320" width="12" height="3" rx="1.5" fill="#27272a"/>
                    <rect x="178" y="320" width="12" height="3" rx="1.5" fill="#27272a"/>

                    {/* ChargeShare badge */}
                    <rect x="133" y="328" width="54" height="6" rx="3" fill="#10b981" opacity="0.15"/>
                    <text x="160" y="333" textAnchor="middle" fill="#10b981" fontSize="4" fontWeight="bold" fontFamily="monospace">CHARGE·SHARE</text>

                    {/* Charging port */}
                    <rect x="227" y="308" width="8" height="12" rx="2" fill="#10b981" opacity="0.3" stroke="#10b981" strokeWidth="1"/>
                    <rect x="229" y="310" width="4" height="8" rx="1" fill="#10b981" opacity="0.8"/>
                  </g>

                  {/* Charging cable */}
                  <path className="cable-pulse"
                    d="M270 200 C270 220 250 240 240 260 C232 276 235 290 235 308"
                    stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"
                    fill="none" strokeDasharray="4 3"/>

                  {/* Charging station */}
                  <g className="station">
                    {/* Post */}
                    <rect x="258" y="160" width="24" height="140" rx="4" fill="#09090b" stroke="#27272a" strokeWidth="1.5"/>
                    {/* Screen */}
                    <rect x="262" y="168" width="16" height="24" rx="2" fill="#0a1a12" stroke="#10b981" strokeWidth="1"/>
                    {/* Screen content */}
                    <rect x="264" y="171" width="12" height="2" rx="1" fill="#10b981" opacity="0.8"/>
                    <rect x="264" y="175" width="8"  height="2" rx="1" fill="#10b981" opacity="0.5"/>
                    <rect x="264" y="179" width="10" height="2" rx="1" fill="#10b981" opacity="0.6"/>
                    {/* Plug socket */}
                    <rect x="263" y="198" width="14" height="10" rx="2" fill="#18181b" stroke="#10b981" strokeWidth="1"/>
                    <circle cx="267" cy="203" r="2" fill="#10b981" opacity="0.6"/>
                    <circle cx="273" cy="203" r="2" fill="#10b981" opacity="0.6"/>
                    {/* Status light */}
                    <circle cx="270" cy="165" r="3" fill="#10b981" className="status-blink"/>
                    {/* Brand */}
                    <text x="270" y="220" textAnchor="middle" fill="#10b981" fontSize="3.5" fontWeight="bold" fontFamily="monospace" opacity="0.6">CS-01</text>
                  </g>

                  {/* Energy bolts flowing down cable */}
                  <g className="bolt-flow">
                    <text x="245" y="230" fill="#10b981" fontSize="10" opacity="0.9">⚡</text>
                    <text x="238" y="260" fill="#10b981" fontSize="8"  opacity="0.6">⚡</text>
                    <text x="234" y="285" fill="#10b981" fontSize="6"  opacity="0.4">⚡</text>
                  </g>

                  {/* Floating stats */}
                  <g className="stat-card" style={{animationDelay: '0s'}}>
                    <rect x="20" y="60" width="100" height="44" rx="10" fill="#09090b" stroke="#10b981" strokeWidth="1" opacity="0.9"/>
                    <text x="70" y="79" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">CHARGING</text>
                    <text x="70" y="93" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="monospace">7.4 kW</text>
                    <circle cx="30" cy="75" r="4" fill="#10b981" className="status-blink"/>
                  </g>

                  <g className="stat-card" style={{animationDelay: '0.4s'}}>
                    <rect x="20" y="120" width="100" height="44" rx="10" fill="#09090b" stroke="#27272a" strokeWidth="1" opacity="0.9"/>
                    <text x="70" y="139" textAnchor="middle" fill="#52525b" fontSize="7" fontWeight="bold" fontFamily="monospace">BATTERY</text>
                    {/* Battery bar */}
                    <rect x="30" y="145" width="80" height="8" rx="4" fill="#18181b"/>
                    <rect x="30" y="145" width="56" height="8" rx="4" fill="#10b981" className="battery-fill"/>
                    <text x="70" y="153" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="monospace">74%</text>
                  </g>

                  <g className="stat-card" style={{animationDelay: '0.8s'}}>
                    <rect x="20" y="180" width="100" height="44" rx="10" fill="#09090b" stroke="#27272a" strokeWidth="1" opacity="0.9"/>
                    <text x="70" y="199" textAnchor="middle" fill="#52525b" fontSize="7" fontWeight="bold" fontFamily="monospace">COST</text>
                    <text x="70" y="215" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="bold" fontFamily="monospace">₹342</text>
                  </g>

                  {/* Particle sparks */}
                  <g className="sparks">
                    <circle cx="232" cy="312" r="2" fill="#10b981" className="spark s1"/>
                    <circle cx="240" cy="305" r="1.5" fill="#10b981" className="spark s2"/>
                    <circle cx="225" cy="308" r="1" fill="#10b981" className="spark s3"/>
                    <circle cx="238" cy="315" r="1.5" fill="#10b981" className="spark s4"/>
                  </g>

                  {/* Top label */}
                  <text x="160" y="30" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="monospace" letterSpacing="3" opacity="0.5">LIVE SESSION</text>
                  <line x1="60" y1="35" x2="260" y2="35" stroke="#10b981" strokeWidth="0.5" opacity="0.2"/>
                </svg>

                <p className="scene-caption">Peer-to-peer EV charging,<br/>wherever you are.</p>
              </div>

            </div>

            <style>{`
              .desktop-shell {
                min-height: 100vh;
                background: #000;
              }
              .bg-anim, .left-panel, .right-panel { display: none; }
              .phone-wrap { display: contents; }
              .phone-frame, .phone-notch, .phone-bar { display: none; }
              .phone-screen { display: contents; }

              @media (min-width: 900px) {
                body { overflow: hidden; height: 100vh; }

                .desktop-shell {
                  display: grid;
                  grid-template-columns: 1fr 390px 1fr;
                  align-items: center;
                  justify-items: center;
                  width: 100vw;
                  height: 100vh;
                  background: #020408;
                  position: relative;
                  overflow: hidden;
                  gap: 0;
                }

                /* Background */
                .bg-anim {
                  display: block;
                  position: absolute;
                  inset: 0;
                  pointer-events: none;
                  z-index: 0;
                }
                .orb {
                  position: absolute;
                  border-radius: 50%;
                  filter: blur(90px);
                  opacity: 0.12;
                  animation: orbFloat 10s ease-in-out infinite;
                }
                .o1 { width:500px;height:500px;background:#10b981;top:-150px;left:-100px;animation-delay:0s; }
                .o2 { width:350px;height:350px;background:#3b82f6;bottom:-100px;right:100px;animation-delay:-4s; }
                .o3 { width:250px;height:250px;background:#10b981;top:40%;right:-50px;animation-delay:-7s; }
                @keyframes orbFloat {
                  0%,100%{ transform:translate(0,0) scale(1); }
                  33%{ transform:translate(20px,-15px) scale(1.04); }
                  66%{ transform:translate(-15px,10px) scale(0.96); }
                }
                .grid-bg {
                  position: absolute; inset: 0;
                  background-image:
                    linear-gradient(rgba(16,185,129,0.025) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(16,185,129,0.025) 1px, transparent 1px);
                  background-size: 50px 50px;
                }

                /* Left panel */
                .left-panel {
                  display: flex;
                  flex-direction: column;
                  gap: 16px;
                  position: relative;
                  z-index: 10;
                  padding: 40px;
                  justify-self: end;
                  padding-right: 60px;
                }
                .brand-icon {
                  width: 64px; height: 64px;
                  background: #10b981;
                  border-radius: 18px;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 32px;
                  box-shadow: 0 0 40px rgba(16,185,129,0.35);
                  margin-bottom: 8px;
                }
                .brand-name {
                  font-size: 38px; font-weight: 900;
                  color: white; font-style: italic;
                  text-transform: uppercase; letter-spacing: -0.04em;
                  line-height: 1; margin: 0;
                }
                .brand-name span { color: #10b981; }
                .brand-sub {
                  font-size: 10px; font-weight: 700;
                  color: #52525b; text-transform: uppercase;
                  letter-spacing: 0.25em; margin: 4px 0 20px 0;
                }
                .brand-stats {
                  display: flex; align-items: center; gap: 16px;
                }
                .stat { display: flex; flex-direction: column; gap: 2px; }
                .stat-val {
                  font-size: 20px; font-weight: 900;
                  color: white; font-style: italic; line-height: 1;
                }
                .stat-label {
                  font-size: 9px; font-weight: 700;
                  color: #52525b; text-transform: uppercase; letter-spacing: 0.15em;
                }
                .stat-divider {
                  width: 1px; height: 28px; background: #27272a;
                }

                /* Phone */
                .phone-wrap {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  position: relative;
                  z-index: 10;
                  height: 100vh;
                }
                .phone-frame {
                  display: flex;
                  flex-direction: column;
                  position: relative;
                  width: 390px; height: 844px;
                  background: #000;
                  border-radius: 54px;
                  border: 2px solid rgba(255,255,255,0.08);
                  box-shadow:
                    0 0 0 1px rgba(0,0,0,0.5),
                    0 60px 120px rgba(0,0,0,0.9),
                    0 0 80px rgba(16,185,129,0.06),
                    inset 0 1px 0 rgba(255,255,255,0.04);
                  overflow: hidden;
                }
                .phone-notch {
                  display: block;
                  width: 120px; height: 34px;
                  background: #000;
                  border-radius: 0 0 20px 20px;
                  position: absolute;
                  top: 0; left: 50%; transform: translateX(-50%);
                  z-index: 20;
                  border: 1px solid rgba(255,255,255,0.06);
                  border-top: none;
                }
                .phone-screen {
                  display: block;
                  width: 100%; height: 100%;
                  overflow-y: auto; overflow-x: hidden;
                  border-radius: 54px;
                  scrollbar-width: none;
                }
                .phone-screen::-webkit-scrollbar { display: none; }
                .phone-bar {
                  display: block;
                  position: absolute; bottom: 10px;
                  width: 120px; height: 5px;
                  background: rgba(255,255,255,0.18);
                  border-radius: 10px; z-index: 20;
                  left: 50%; transform: translateX(-50%);
                }

                /* Right panel */
                .right-panel {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  position: relative;
                  z-index: 10;
                  padding: 40px;
                  justify-self: start;
                  padding-left: 60px;
                  gap: 20px;
                }
                .ev-scene {
                  width: 320px;
                  filter: drop-shadow(0 0 30px rgba(16,185,129,0.1));
                }
                .scene-caption {
                  font-size: 12px; font-weight: 700;
                  color: #52525b; text-transform: uppercase;
                  letter-spacing: 0.1em; text-align: center;
                  line-height: 1.6; margin: 0;
                }

                /* ── SVG Animations ── */

                /* Car gentle float */
                .car-float {
                  animation: carFloat 3s ease-in-out infinite;
                }
                @keyframes carFloat {
                  0%,100% { transform: translateY(0px); }
                  50%      { transform: translateY(-6px); }
                }

                /* Headlight glow pulse */
                .headlight-glow {
                  animation: headGlow 1.5s ease-in-out infinite;
                }
                @keyframes headGlow {
                  0%,100% { opacity: 0.9; filter: blur(0px); }
                  50%      { opacity: 1;   filter: blur(2px) drop-shadow(0 0 6px #10b981); }
                }

                /* Status blink */
                .status-blink {
                  animation: blink 1.2s ease-in-out infinite;
                }
                @keyframes blink {
                  0%,100% { opacity: 1; }
                  50%      { opacity: 0.2; }
                }

                /* Cable dash animation */
                .cable-pulse {
                  animation: cableDash 1s linear infinite;
                }
                @keyframes cableDash {
                  to { stroke-dashoffset: -14; }
                }

                /* Energy bolts flow */
                .bolt-flow {
                  animation: boltFlow 1.5s ease-in-out infinite;
                }
                @keyframes boltFlow {
                  0%   { transform: translateY(0px);  opacity: 1; }
                  100% { transform: translateY(10px); opacity: 0; }
                }

                /* Battery fill pulse */
                .battery-fill {
                  animation: battFill 2s ease-in-out infinite;
                }
                @keyframes battFill {
                  0%,100% { width: 56px; }
                  50%      { width: 60px; }
                }

                /* Floating stat cards */
                .stat-card {
                  animation: statFloat 4s ease-in-out infinite;
                }
                @keyframes statFloat {
                  0%,100% { transform: translateY(0px); opacity: 0.95; }
                  50%      { transform: translateY(-4px); opacity: 1; }
                }

                /* Sparks */
                .spark { animation: sparkPop 1.8s ease-in-out infinite; }
                .s1 { animation-delay: 0s; }
                .s2 { animation-delay: 0.3s; }
                .s3 { animation-delay: 0.6s; }
                .s4 { animation-delay: 0.9s; }
                @keyframes sparkPop {
                  0%,100% { opacity: 0; transform: scale(0); }
                  20%,80% { opacity: 1; transform: scale(1); }
                  50%      { opacity: 0.6; transform: scale(1.5) translate(2px,-2px); }
                }

                /* Road dashes scroll */
                .road-dash {
                  animation: roadScroll 1.2s linear infinite;
                }
                @keyframes roadScroll {
                  from { transform: translateX(0); }
                  to   { transform: translateX(-70px); }
                }
              }

              @media (min-width: 900px) and (max-width: 1200px) {
                .left-panel { display: none; }
                .desktop-shell { grid-template-columns: 390px 1fr; }
              }
              @media (min-width: 900px) and (max-width: 1050px) {
                .right-panel { display: none; }
                .desktop-shell { grid-template-columns: 1fr; }
              }
            `}</style>
          </VehicleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}