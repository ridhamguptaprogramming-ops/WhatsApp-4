import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, Video, X, Check } from 'lucide-react';
import { CallSession } from '../types';
import { cn } from '../lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface IncomingCallModalProps {
  call: CallSession;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ call, onAccept, onReject }) => {
  const [callerName, setCallerName] = useState('Someone');
  const [callerPhoto, setCallerPhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchCaller = async () => {
      const userRef = doc(db, 'users', call.hostId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setCallerName(data.displayName);
        setCallerPhoto(data.photoURL);
      }
    };
    fetchCaller();
    
    // Play ringtone (simulated)
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.loop = true;
    audio.play().catch(() => {}); // Autoplay might be blocked
    
    return () => {
      audio.pause();
    };
  }, [call.hostId]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-8 right-8 z-[200] w-80 bg-white rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-black/5 overflow-hidden p-6"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"
          />
          <img 
            src={callerPhoto || `https://ui-avatars.com/api/?name=${callerName}`} 
            alt={callerName}
            className="h-20 w-20 rounded-3xl object-cover relative z-10 border-4 border-white shadow-lg"
          />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-2xl z-20 shadow-lg">
            {call.type === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          </div>
        </div>

        <h3 className="text-lg font-bold text-[#111b21]">{callerName}</h3>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Incoming {call.type} call...</p>

        <div className="flex items-center space-x-4 mt-8 w-full">
           <button 
             onClick={onReject}
             className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-400 p-4 rounded-3xl transition-colors active:scale-95 flex items-center justify-center"
           >
             <X className="h-6 w-6" />
           </button>
           <button 
             onClick={onAccept}
             className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-3xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95 flex items-center justify-center animate-bounce-subtle"
           >
             <Check className="h-6 w-6" />
           </button>
        </div>
      </div>
    </motion.div>
  );
};
