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
            {/* Desktop: phone frame with animated background */}
            <div className="desktop-shell">
              {/* Animated background */}
              <div className="bg-animation">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
                <div className="grid-lines" />
              </div>

              {/* Brand text on desktop */}
              <div className="brand-tag">
                <span className="brand-logo">⚡</span>
                <div>
                  <p className="brand-name">Charge<span>.Share</span></p>
                  <p className="brand-sub">India's Private EV Network</p>
                </div>
              </div>

              {/* Phone frame */}
              <div className="phone-frame">
                <div className="phone-notch" />
                <div className="phone-screen">
                  {children}
                </div>
                <div className="phone-home-bar" />
              </div>

              {/* Side text */}
              <div className="side-text">
                <p>PEER-TO-PEER</p>
                <p>EV CHARGING</p>
                <p>NETWORK</p>
              </div>
            </div>

            <style>{`
              /* ---- MOBILE: just render normally ---- */
              .desktop-shell {
                min-height: 100vh;
                background: #000;
              }
              .bg-animation, .brand-tag, .phone-frame, .side-text {
                display: contents;
              }
              .phone-notch, .phone-home-bar { display: none; }
              .phone-screen { display: contents; }

              /* ---- DESKTOP: phone frame + animated bg ---- */
              @media (min-width: 768px) {
                body {
                  overflow: hidden;
                  height: 100vh;
                }

                .desktop-shell {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 60px;
                  width: 100vw;
                  height: 100vh;
                  background: #020408;
                  position: relative;
                  overflow: hidden;
                }

                /* Animated orbs */
                .bg-animation {
                  display: block;
                  position: absolute;
                  inset: 0;
                  pointer-events: none;
                  z-index: 0;
                }
                .orb {
                  position: absolute;
                  border-radius: 50%;
                  filter: blur(80px);
                  opacity: 0.15;
                  animation: float 8s ease-in-out infinite;
                }
                .orb-1 {
                  width: 500px; height: 500px;
                  background: #10b981;
                  top: -100px; left: -100px;
                  animation-delay: 0s;
                }
                .orb-2 {
                  width: 400px; height: 400px;
                  background: #3b82f6;
                  bottom: -80px; right: 200px;
                  animation-delay: -3s;
                }
                .orb-3 {
                  width: 300px; height: 300px;
                  background: #10b981;
                  top: 50%; right: -50px;
                  animation-delay: -5s;
                }
                @keyframes float {
                  0%, 100% { transform: translate(0, 0) scale(1); }
                  33% { transform: translate(30px, -20px) scale(1.05); }
                  66% { transform: translate(-20px, 15px) scale(0.95); }
                }

                /* Grid lines */
                .grid-lines {
                  display: block;
                  position: absolute;
                  inset: 0;
                  background-image:
                    linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px);
                  background-size: 60px 60px;
                }

                /* Brand tag */
                .brand-tag {
                  display: flex;
                  flex-direction: column;
                  gap: 16px;
                  position: relative;
                  z-index: 10;
                  align-self: center;
                }
                .brand-logo {
                  font-size: 48px;
                  width: 72px; height: 72px;
                  background: #10b981;
                  border-radius: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 0 40px rgba(16,185,129,0.3);
                }
                .brand-name {
                  font-size: 36px;
                  font-weight: 900;
                  color: white;
                  font-style: italic;
                  text-transform: uppercase;
                  letter-spacing: -0.04em;
                  line-height: 1;
                  margin: 0;
                }
                .brand-name span { color: #10b981; }
                .brand-sub {
                  font-size: 10px;
                  font-weight: 700;
                  color: #52525b;
                  text-transform: uppercase;
                  letter-spacing: 0.25em;
                  margin: 6px 0 0 0;
                }

                /* Phone frame */
                .phone-frame {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  position: relative;
                  z-index: 10;
                  width: 390px;
                  height: 844px;
                  background: #000;
                  border-radius: 54px;
                  border: 2px solid rgba(255,255,255,0.08);
                  box-shadow:
                    0 0 0 1px rgba(0,0,0,0.5),
                    0 50px 100px rgba(0,0,0,0.8),
                    0 0 60px rgba(16,185,129,0.08),
                    inset 0 1px 0 rgba(255,255,255,0.05);
                  overflow: hidden;
                }

                .phone-notch {
                  display: block;
                  width: 120px; height: 34px;
                  background: #000;
                  border-radius: 0 0 20px 20px;
                  position: absolute;
                  top: 0; left: 50%;
                  transform: translateX(-50%);
                  z-index: 20;
                  border: 1px solid rgba(255,255,255,0.06);
                  border-top: none;
                }

                .phone-screen {
                  display: block;
                  width: 100%;
                  height: 100%;
                  overflow-y: auto;
                  overflow-x: hidden;
                  border-radius: 54px;
                  scrollbar-width: none;
                }
                .phone-screen::-webkit-scrollbar { display: none; }

                .phone-home-bar {
                  display: block;
                  position: absolute;
                  bottom: 10px;
                  width: 120px; height: 5px;
                  background: rgba(255,255,255,0.2);
                  border-radius: 10px;
                  z-index: 20;
                }

                /* Side text */
                .side-text {
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  position: relative;
                  z-index: 10;
                  align-self: center;
                }
                .side-text p {
                  font-size: 11px;
                  font-weight: 900;
                  color: rgba(255,255,255,0.06);
                  letter-spacing: 0.3em;
                  text-transform: uppercase;
                  margin: 0;
                  writing-mode: vertical-rl;
                }
              }

              /* Hide side-text on smaller desktops */
              @media (min-width: 768px) and (max-width: 1100px) {
                .side-text { display: none; }
                .brand-tag { display: none; }
              }
            `}</style>
          </VehicleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}