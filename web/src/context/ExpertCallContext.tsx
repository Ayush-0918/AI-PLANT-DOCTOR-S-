'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type CallStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExpertCallContextType {
  isOpen: boolean;
  phoneNumber: string;
  status: CallStatus;
  message: string;
  setPhoneNumber: (num: string) => void;
  openCallModal: () => void;
  closeCallModal: () => void;
  triggerCall: () => Promise<void>;
}

const ExpertCallContext = createContext<ExpertCallContextType | undefined>(undefined);

export function ExpertCallProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('6207116098');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [message, setMessage] = useState('');

  const openCallModal = () => setIsOpen(true);
  const closeCallModal = () => {
    setIsOpen(false);
    setStatus('idle');
    setMessage('');
  };

  const triggerCall = async () => {
    if (!phoneNumber) return;
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/expert/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      let data: { success: boolean; message?: string } = { success: false };
      try { data = await res.json(); } catch {}

      if (!res.ok || !data.success) {
        throw new Error(data.message || `Server error (${res.status})`);
      }

      setStatus('success');
      setMessage('📞 Aapke phone pe call aa rahi hai! Expert se baat karein.');
      setTimeout(() => { closeCallModal(); }, 5000);
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '';
      setMessage(msg || 'Call nahi hua. Backend check karein ya VAPI credentials add karein.');
    }
  };


  return (
    <ExpertCallContext.Provider value={{
      isOpen,
      phoneNumber,
      status,
      message,
      setPhoneNumber,
      openCallModal,
      closeCallModal,
      triggerCall
    }}>
      {children}
    </ExpertCallContext.Provider>
  );
}

export function useExpertCall() {
  const context = useContext(ExpertCallContext);
  if (!context) {
    throw new Error('useExpertCall must be used within ExpertCallProvider');
  }
  return context;
}
