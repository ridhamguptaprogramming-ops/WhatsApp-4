import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Info, Clock, ShieldCheck, Mail, Pencil, Camera, X } from 'lucide-react';
import { cn, formatLastSeen } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

interface ProfileViewProps {
  userId: string;
  onClose: () => void;
  isCurrentUser?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ userId, onClose, isCurrentUser }) => {
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setProfileUser(data);
        setNewStatus(data.statusMessage || 'Available');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    });

    return () => unsub();
  }, [userId]);

  const handleUpdateStatus = async () => {
    if (!profileUser || !isCurrentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        statusMessage: newStatus
      });
      setIsEditingStatus(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!profileUser) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 bottom-0 top-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] z-[60] flex flex-col bg-[#fdfdfd] border-l border-black/5 shadow-2xl"
    >
      {/* Premium Header */}
      <div className="flex h-[140px] items-end bg-emerald-600/90 backdrop-blur-md px-8 pb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="flex items-center space-x-4 relative z-10">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90"
          >
            <X className="h-6 w-6" />
          </button>
          <div>
            <h2 className="text-xl font-display font-bold">Profile Details</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Information & Settings</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pt-10 px-8">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative group cursor-pointer transition-transform hover:scale-102">
            <motion.img 
              layoutId={`avatar-${userId}`}
              src={profileUser.photoURL} 
              alt={profileUser.displayName} 
              className="h-44 w-44 rounded-3xl object-cover shadow-2xl ring-4 ring-white"
            />
            {isCurrentUser && (
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-8 w-8 text-white" />
              </div>
            )}
            {profileUser.isOnline && (
              <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-2xl border-4 border-white bg-emerald-500 shadow-lg" />
            )}
          </div>
          
          <h1 className="mt-8 text-2xl font-display font-bold text-[#111b21]">{profileUser.displayName}</h1>
          <div className="mt-2 flex items-center space-x-2">
             <div className={cn("h-2 w-2 rounded-full", profileUser.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} />
             <p className="text-[#667781] text-xs font-bold uppercase tracking-tighter">
                {profileUser.isOnline ? "Active Now" : profileUser.lastSeen ? `Last seen ${formatLastSeen(profileUser.lastSeen)}` : 'Offline'}
             </p>
          </div>
        </div>

        {/* Info Blocks */}
        <div className="space-y-6">
          {/* About Section */}
          <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-4">
             <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
               <Info className="h-4 w-4 mr-2" />
               About
             </div>
             {isEditingStatus ? (
               <div className="space-y-3">
                 <input
                   type="text"
                   value={newStatus}
                   onChange={(e) => setNewStatus(e.target.value)}
                   className="w-full border-b-2 border-emerald-500 bg-transparent pb-1 text-[#111b21] outline-none font-medium"
                   autoFocus
                   onKeyPress={(e) => e.key === 'Enter' && handleUpdateStatus()}
                 />
                 <div className="flex justify-end space-x-2 pt-2">
                   <button onClick={() => setIsEditingStatus(false)} className="text-xs font-bold px-3 py-2 text-gray-500">Cancel</button>
                   <button onClick={handleUpdateStatus} disabled={isSaving} className="text-xs font-bold px-4 py-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">Save Change</button>
                 </div>
               </div>
             ) : (
               <div className="flex items-center justify-between group">
                 <p className="text-[#111b21] text-[15px] font-medium italic">"{profileUser.statusMessage || 'Available'}"</p>
                 {isCurrentUser && (
                   <button onClick={() => setIsEditingStatus(true)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                     <Pencil className="h-4 w-4" />
                   </button>
                 )}
               </div>
             )}
          </div>

          {/* Contact Block */}
          <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-4">
             <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
               <Mail className="h-4 w-4 mr-2" />
               Email Address
             </div>
             <p className="text-[#111b21] font-semibold">{profileUser.email}</p>
          </div>

          {/* Productivity Block */}
          {isCurrentUser && (
            <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                   <ShieldCheck className="h-4 w-4 mr-2" />
                   Security Status
                 </div>
                 <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full font-bold">Encrypted</span>
               </div>
               <p className="text-[#667781] text-xs leading-relaxed">Your data is secured using Chatty AI's high-performance encryption standards.</p>
            </div>
          )}
        </div>
        
        <div className="h-20" />
      </div>
    </motion.div>
  );
};
