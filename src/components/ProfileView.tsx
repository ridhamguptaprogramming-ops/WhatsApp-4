import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { Info, Clock, ShieldCheck, Mail, Pencil, Camera, X, Globe, Github, Twitter, Lock, Eye, MessageSquare, Check, Loader2, Image as ImageIcon, AtSign, Plus } from 'lucide-react';
import { cn, formatLastSeen } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, onSnapshot, runTransaction, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { QRCodeCanvas } from 'qrcode.react';

interface ProfileViewProps {
  userId: string;
  onClose: () => void;
  isCurrentUser?: boolean;
}

type ProfileTab = 'info' | 'social' | 'privacy';

export const ProfileView: React.FC<ProfileViewProps> = ({ userId, onClose, isCurrentUser }) => {
  const { user: authUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('info');
  const [showQR, setShowQR] = useState(false);
  
  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [newInterest, setNewInterest] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<'avatar' | 'banner' | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setProfileUser(data);
        if (!isEditing) {
          setEditData(data);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    });

    return () => unsub();
  }, [userId, isEditing]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !isCurrentUser) return;

    if (file.size > 5 * 1024 * 1024) { // Increased to 5MB for high res
      alert("File too large. Max 5MB.");
      return;
    }

    setUploadingType(type);
    const storageRef = ref(storage, `users/${userId}/${type}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      null,
      (error) => {
        console.error("Upload error:", error);
        setUploadingType(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        try {
          await updateDoc(doc(db, 'users', userId), {
            [type === 'avatar' ? 'photoURL' : 'bannerURL']: downloadURL
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
        }
        setUploadingType(null);
      }
    );
  };

  const handleSaveProfile = async () => {
    if (!isCurrentUser || !profileUser) return;
    setIsSaving(true);
    setUsernameError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) throw new Error("User does not exist");

        const oldUsername = userDoc.data().username;
        const newUsername = editData.username?.trim().toLowerCase();

        // If username changed, check uniqueness
        if (newUsername && newUsername !== oldUsername) {
          const usernameRef = doc(db, 'usernames', newUsername);
          const usernameDoc = await transaction.get(usernameRef);
          
          if (usernameDoc.exists()) {
            throw new Error("Username already taken");
          }

          transaction.set(usernameRef, { uid: userId });
          if (oldUsername) {
            transaction.delete(doc(db, 'usernames', oldUsername));
          }
        }

        transaction.update(userRef, {
          ...editData,
          displayName: editData.displayName || profileUser.displayName,
          username: newUsername || null
        });
      });

      setIsEditing(false);
    } catch (error: any) {
      if (error.message === "Username already taken") {
        setUsernameError("This username is already claimed.");
      } else {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addInterest = () => {
    if (!newInterest.trim()) return;
    const currentInterests = editData.interests || [];
    if (!currentInterests.includes(newInterest.trim())) {
      setEditData({ ...editData, interests: [...currentInterests, newInterest.trim()] });
    }
    setNewInterest('');
  };

  const removeInterest = (interest: string) => {
    setEditData({ ...editData, interests: (editData.interests || []).filter(i => i !== interest) });
  };

  if (!profileUser) return null;

  const availabilityColors = {
    online: 'bg-emerald-500',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
    offline: 'bg-gray-400'
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 bottom-0 top-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[450px] z-[60] flex flex-col bg-[#fdfdfd] border-l border-black/5 shadow-2xl"
    >
      {/* Premium Header & Banner */}
      <div className="relative h-[200px] flex-shrink-0 group">
        <div className="absolute inset-0 bg-emerald-600">
          {profileUser.bannerURL ? (
            <img src={profileUser.bannerURL} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-600 to-emerald-800 opacity-90" />
          )}
        </div>
        
        {isCurrentUser && (
          <button 
            onClick={() => bannerInputRef.current?.click()}
            className="absolute bottom-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30"
          >
            {uploadingType === 'banner' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
          </button>
        )}

        <div className="absolute top-0 left-0 p-6 z-10">
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-xl transition-all text-white active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Avatar Overlay */}
        <div className="absolute -bottom-12 left-8">
           <div className="relative group/avatar">
              <img 
                src={profileUser.privacySettings?.showPhoto === 'nobody' && !isCurrentUser 
                  ? 'https://ui-avatars.com/api/?name=?' 
                  : profileUser.photoURL} 
                alt={profileUser.displayName} 
                className="h-32 w-32 rounded-3xl object-cover shadow-2xl ring-4 ring-white"
              />
              {isCurrentUser && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                >
                  {uploadingType === 'avatar' ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                </button>
              )}
              <div className={cn(
                "absolute -bottom-1 -right-1 h-8 w-8 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-[14px]",
                availabilityColors[profileUser.availability || (profileUser.isOnline ? 'online' : 'offline')]
              )}>
                {profileUser.statusEmoji && <span className="mb-0.5">{profileUser.statusEmoji}</span>}
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col mt-16 px-8 pb-10 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-display font-bold text-[#111b21]">{profileUser.displayName}</h1>
            <p className="text-emerald-600 font-bold text-sm">@{profileUser.username || profileUser.uid.slice(0, 8)}</p>
          </div>
          {isCurrentUser && (
            <button 
              onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
              disabled={isSaving}
              className={cn(
                "px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center",
                isEditing ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-gray-100 text-[#111b21] hover:bg-gray-200"
              )}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isEditing ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              {isEditing ? 'Save' : 'Edit Profile'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 mb-6">
          {(['info', 'social', 'privacy'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative",
                activeTab === tab ? "text-emerald-600" : "text-gray-400"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
          {activeTab === 'info' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              {/* Display Name Edit */}
              {isEditing ? (
                <div className="space-y-4">
                  <div className="glass-card p-5 rounded-2xl border border-black/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-2 block">Display Name</label>
                    <input 
                      type="text" 
                      value={editData.displayName || ''} 
                      onChange={(e) => setEditData({...editData, displayName: e.target.value})}
                      className="w-full bg-transparent text-lg font-semibold outline-none border-b-2 border-emerald-500/30 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  
                  <div className="glass-card p-5 rounded-2xl border border-black/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-2 block">Username (@handle)</label>
                    <div className="flex items-center">
                      <AtSign className="h-4 w-4 mr-2 text-gray-400" />
                      <input 
                        type="text" 
                        value={editData.username || ''} 
                        onChange={(e) => setEditData({...editData, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
                        placeholder="john_doe"
                        className="w-full bg-transparent text-lg font-semibold outline-none border-b-2 border-emerald-500/30 focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    {usernameError && <p className="text-rose-500 text-[10px] mt-2 font-bold">{usernameError}</p>}
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-black/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-2 block">Bio</label>
                    <textarea 
                      rows={3}
                      value={editData.bio || ''} 
                      onChange={(e) => setEditData({...editData, bio: e.target.value})}
                      className="w-full bg-transparent text-sm outline-none resize-none"
                      placeholder="Tell the world about yourself..."
                    />
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-black/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-2 block">Availability & Status</label>
                    <div className="space-y-3">
                      <select 
                        value={editData.availability || 'online'}
                        onChange={(e) => setEditData({...editData, availability: e.target.value as any})}
                        className="w-full bg-gray-100 p-2 rounded-xl text-xs font-bold outline-none"
                      >
                        <option value="online">Online</option>
                        <option value="busy">Busy</option>
                        <option value="away">Away</option>
                        <option value="offline">Offline</option>
                      </select>
                      <div className="flex space-x-2">
                        <input 
                          type="text" 
                          value={editData.statusEmoji || ''} 
                          onChange={(e) => setEditData({...editData, statusEmoji: e.target.value})}
                          placeholder="👋"
                          className="w-12 text-center bg-gray-100 rounded-xl p-2 outline-none"
                          maxLength={2}
                        />
                        <input 
                          type="text" 
                          value={editData.statusMessage || ''} 
                          onChange={(e) => setEditData({...editData, statusMessage: e.target.value})}
                          className="flex-1 bg-transparent border-b-2 border-emerald-500/30 focus:border-emerald-500 outline-none px-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-black/5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-2 block">Interests</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(editData.interests || []).map(tag => (
                        <span key={tag} className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold flex items-center">
                          {tag}
                          <button onClick={() => removeInterest(tag)} className="ml-2 hover:text-emerald-800"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={newInterest} 
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                        className="flex-1 bg-transparent border-b outline-none text-xs"
                        placeholder="Add interest..."
                      />
                      <button onClick={addInterest} className="p-1 text-emerald-500"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-4">
                    <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                      <Info className="h-4 w-4 mr-2" />
                      About & Bio
                    </div>
                    <p className="text-[#111b21] text-[15px] font-medium leading-relaxed">
                      {profileUser.bio || 'No bio provided yet. Update your profile to share something about yourself.'}
                    </p>
                  </div>

                  <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-4">
                    <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                      <Clock className="h-4 w-4 mr-2" />
                      Presence
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#667781] mb-1">Availability</p>
                      <div className="flex items-center space-x-2">
                        <div className={cn("h-3 w-3 rounded-full", availabilityColors[profileUser.availability || 'online'])} />
                        <span className="text-sm font-bold capitalize">{profileUser.availability || 'online'}</span>
                      </div>
                    </div>
                  </div>

                  {profileUser.interests && profileUser.interests.length > 0 && (
                    <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-3">
                      <div className="text-emerald-600 font-bold uppercase tracking-widest text-[10px]">Interests</div>
                      <div className="flex flex-wrap gap-2">
                        {profileUser.interests.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-gray-100 text-[#111b21] rounded-full text-[10px] font-bold">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="glass-card p-6 rounded-3xl border border-black/5 flex items-center justify-between">
                     <div className="text-emerald-600 font-bold uppercase tracking-widest text-[10px]">Share Profile</div>
                     <button 
                        onClick={() => setShowQR(!showQR)}
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                     >
                       <AtSign className="h-5 w-5" />
                     </button>
                  </div>

                  <AnimatePresence>
                    {showQR && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center bg-white p-6 rounded-3xl border border-black/5 shadow-xl"
                      >
                        <QRCodeCanvas 
                          value={`${window.location.origin}/@${profileUser.username || profileUser.uid}`}
                          size={180}
                          style={{ margin: '0 auto' }}
                        />
                        <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scan to add @{profileUser.username || 'user'}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}

          {activeTab === 'social' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-6">
                <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                  <Globe className="h-4 w-4 mr-2" />
                  Online Presence
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-2xl"><Github className="h-5 w-5" /></div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editData.socialLinks?.github || ''}
                        onChange={(e) => setEditData({...editData, socialLinks: {...editData.socialLinks, github: e.target.value}})}
                        placeholder="GitHub handle"
                        className="flex-1 bg-transparent border-b outline-none text-sm"
                      />
                    ) : (
                      <a href={profileUser.socialLinks?.github} target="_blank" className="text-sm font-bold text-gray-700 hover:text-emerald-500">{profileUser.socialLinks?.github || 'Not linked'}</a>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gray-100 rounded-2xl"><Twitter className="h-5 w-5" /></div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editData.socialLinks?.twitter || ''}
                        onChange={(e) => setEditData({...editData, socialLinks: {...editData.socialLinks, twitter: e.target.value}})}
                        placeholder="Twitter handle"
                        className="flex-1 bg-transparent border-b outline-none text-sm"
                      />
                    ) : (
                      <a href={profileUser.socialLinks?.twitter} target="_blank" className="text-sm font-bold text-gray-700 hover:text-emerald-500">{profileUser.socialLinks?.twitter || 'Not linked'}</a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="glass-card p-6 rounded-3xl border border-black/5 space-y-6">
                <div className="flex items-center text-emerald-600 font-bold uppercase tracking-widest text-[10px]">
                  <Lock className="h-4 w-4 mr-2" />
                  Safety & Privacy
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Eye className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold">Profile Photo Visibility</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Who can see your picture</p>
                      </div>
                    </div>
                    <select 
                      disabled={!isEditing}
                      value={editData.privacySettings?.showPhoto || 'everyone'}
                      onChange={(e) => setEditData({...editData, privacySettings: {...editData.privacySettings, showPhoto: e.target.value as any}})}
                      className="text-xs font-bold bg-gray-100 p-2 rounded-xl outline-none"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">Contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-bold">Direct Messaging</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Allow non-contacts to message</p>
                      </div>
                    </div>
                    <button 
                      disabled={!isEditing}
                      onClick={() => setEditData({...editData, privacySettings: {...editData.privacySettings, allowDirectMessages: !editData.privacySettings?.allowDirectMessages}})}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editData.privacySettings?.allowDirectMessages ? "bg-emerald-500" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 h-4 w-4 bg-white rounded-full transition-all",
                        editData.privacySettings?.allowDirectMessages ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden Inputs */}
      <input 
        type="file" 
        hidden 
        ref={fileInputRef} 
        onChange={(e) => handleImageUpload(e, 'avatar')} 
        accept="image/*"
      />
      <input 
        type="file" 
        hidden 
        ref={bannerInputRef} 
        onChange={(e) => handleImageUpload(e, 'banner')} 
        accept="image/*"
      />
    </motion.div>
  );
};
