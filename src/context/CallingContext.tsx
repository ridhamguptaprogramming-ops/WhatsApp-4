import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CallSession, CallType } from '../types';
import { useAuth } from './AuthContext';
import { callService } from '../services/callService';
import { CallOverlay } from '../components/CallOverlay';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { AnimatePresence } from 'motion/react';

interface CallingContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  startCall: (participants: string[], type: CallType, isGroup?: boolean, chatId?: string) => Promise<void>;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
}

const CallingContext = createContext<CallingContextType | undefined>(undefined);

export const CallingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen for incoming calls
    const unsub = callService.listenForIncomingCalls(user.uid, (call) => {
      if (!activeCall && call.hostId !== user.uid) {
        setIncomingCall(call);
      }
    });

    return () => unsub();
  }, [user, activeCall]);

  const startCall = async (participants: string[], type: CallType, isGroup: boolean = false, chatId?: string) => {
    if (!user) return;
    const callId = await callService.createCall(user.uid, [...participants, user.uid], type, isGroup, chatId);
    if (callId) {
       // Auto-join active session
       setActiveCall({
         callId,
         hostId: user.uid,
         participants: [...participants, user.uid],
         type,
         status: 'ringing',
         startTime: new Date(),
         isGroup,
         chatId
       });
    }
  };

  const acceptCall = () => {
    if (incomingCall) {
      callService.updateCallStatus(incomingCall.callId, 'connected');
      setActiveCall({ ...incomingCall, status: 'connected' });
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      callService.updateCallStatus(incomingCall.callId, 'rejected');
      setIncomingCall(null);
    }
  };

  const endCall = useCallback(() => {
    if (activeCall) {
      callService.updateCallStatus(activeCall.callId, 'ended');
      setActiveCall(null);
    }
  }, [activeCall]);

  return (
    <CallingContext.Provider value={{ activeCall, incomingCall, startCall, acceptCall, rejectCall, endCall }}>
      {children}
      <AnimatePresence>
        {incomingCall && (
          <IncomingCallModal 
            call={incomingCall} 
            onAccept={acceptCall} 
            onReject={rejectCall} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeCall && (
          <CallOverlay 
            session={activeCall} 
            onEnd={endCall} 
          />
        )}
      </AnimatePresence>
    </CallingContext.Provider>
  );
};

export const useCalling = () => {
  const context = useContext(CallingContext);
  if (!context) throw new Error('useCalling must be used within CallingProvider');
  return context;
};
