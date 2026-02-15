'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext<any>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const savedUser = localStorage.getItem('demo_user');
    if (savedUser) {
      setSession({ user: JSON.parse(savedUser) });
      setStatus('authenticated');
    } else {
      setStatus('unauthenticated');
    }
  }, []);

  const signIn = () => {
    const mockUser = { 
      id: 'host-demo-99', 
      name: 'Demo Host', 
      email: 'host@chargeshare.demo' 
    };
    localStorage.setItem('demo_user', JSON.stringify(mockUser));
    setSession({ user: mockUser });
    setStatus('authenticated');
  };

  const signOut = () => {
    localStorage.removeItem('demo_user');
    setSession(null);
    setStatus('unauthenticated');
  };

  return (
    <AuthContext.Provider value={{ data: session, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useMockAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useMockAuth must be used within AuthProvider");
  return context;
};