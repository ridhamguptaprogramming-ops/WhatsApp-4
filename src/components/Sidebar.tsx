import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Chat, User } from '../types';
import { Search, UserPlus, LogOut, Users, Check, ArrowLeft, ArrowRight, CheckCheck, Pin, MoreVertical, LayoutGrid, Filter, BellRing, Activity } from 'lucide-react';
import { cn, formatDate, formatLastSeen } from '../lib/utils';
import { logout } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { motion, AnimatePresence } from 'motion/react';
import { ProfileView } from './ProfileView';
import { chatService } from '../services/chatService';

interface SidebarProps {
  onSelectChat: (chatId: string) => void;
  onViewInsights: () => void;
  selectedChatId: string | null;
}

type ViewMode = 'chats' | 'users' | 'new-group-select' | 'new-group-info';

export const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, onViewInsights, selectedChatId }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chats');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups'>('all');
  
  // Group creation state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!user) return;

    // Listen to chats
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(d => ({ ...d.data(), chatId: d.id } as Chat)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    // Listen to all users for start-new-chat
    const usersQ = query(collection(db, 'users'), limit(50));
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
      setAllUsers(snapshot.docs.map(d => ({ ...d.data(), uid: d.id } as User)).filter(u => u.uid !== user.uid));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribe();
      unsubUsers();
    };
  }, [user]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0 || !user) return;
    const chatId = await chatService.createGroup(groupName, [...selectedUsers, user.uid]);
    onSelectChat(chatId);
    setViewMode('chats');
    setGroupName('');
    setSelectedUsers([]);
  };

  return (
    <div className="flex h-full w-[380px] flex-col border-r border-[#f0f2f5] bg-white min-w-[380px] z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Premium Header */}
      <div className="flex h-[80px] items-center justify-between px-6 bg-white/40 backdrop-blur-3xl sticky top-0 z-50">
        <div 
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => setSelectedProfileUserId(user?.uid || null)}
        >
          <div className="relative">
            <motion.img 
              whileHover={{ scale: 1.05 }}
              src={user?.photoURL} 
              alt="Avatar" 
              className="h-11 w-11 rounded-[18px] object-cover ring-2 ring-white shadow-xl transition-shadow group-hover:shadow-emerald-500/10" 
            />
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-black text-[18px] text-[#111b21] leading-tight tracking-tight">Messages</h1>
            <p className="text-[10px] text-[#667781] font-black uppercase tracking-[0.15em] opacity-60">Premium Uplink</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(16, 185, 129, 0.1)' }} 
            whileTap={{ scale: 0.9 }}
            onClick={onViewInsights} 
            className="p-2.5 text-[#54656f] hover:text-emerald-600 rounded-xl transition-colors"
            title="Insights"
          >
            <Activity className="h-5 w-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(16, 185, 129, 0.1)' }} 
            whileTap={{ scale: 0.9 }}
            onClick={() => setViewMode(viewMode === 'chats' ? 'users' : 'chats')} 
            className="p-2.5 text-[#54656f] hover:text-emerald-600 rounded-xl transition-colors"
          >
            <UserPlus className="h-5 w-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(16, 185, 129, 0.1)' }} 
            whileTap={{ scale: 0.9 }}
            onClick={() => setViewMode('new-group-select')} 
            className="p-2.5 text-[#54656f] hover:text-emerald-600 rounded-xl transition-colors"
          >
            <Users className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Modern Search & Filters */}
      <div className="px-6 pb-4 space-y-4">
        <div className={cn(
          "relative flex items-center rounded-2xl bg-[#f0f2f5]/50 px-4 py-3 transition-all duration-500 group",
          "focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        )}>
          {viewMode !== 'chats' ? (
             <button 
               onClick={() => setViewMode('chats')} 
               className="mr-3 text-[#54656f] hover:text-emerald-500 transition-colors"
             >
               <ArrowLeft className="h-5 w-5" />
             </button>
          ) : (
             <Search className="mr-3 h-[18px] w-[18px] text-[#54656f] group-focus-within:text-emerald-500 transition-colors" />
          )}
          <input
            type="text"
            placeholder={viewMode === 'chats' ? "Search conversations..." : "Search people..."}
            className="w-full bg-transparent text-[14px] text-[#111b21] outline-none placeholder:text-[#667781] font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {viewMode === 'chats' && (
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            {(['all', 'unread', 'groups'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  activeFilter === filter 
                    ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20" 
                    : "bg-[#f0f2f5] text-[#667781] hover:bg-[#e9edef] hover:text-[#111b21]"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {viewMode === 'users' && (
           <div className="divide-y divide-[#f5f6f6]">
             <div className="px-4 py-2 text-[12px] font-semibold text-[#667781] uppercase tracking-wider bg-[#f0f2f5]">All Users</div>
             {allUsers.filter(u => 
               u.displayName.toLowerCase().includes(search.toLowerCase()) || 
               u.username?.toLowerCase().includes(search.toLowerCase())
             ).map((u) => (
               <div 
                 key={u.uid} 
                 onClick={async () => {
                    const chatId = await chatService.getOrCreateChat(user!.uid, u.uid);
                    onSelectChat(chatId);
                    setViewMode('chats');
                 }}
                 className="flex cursor-pointer items-center px-3 py-3 transition-colors hover:bg-[#f5f6f6]"
               >
                 <div 
                   className="relative mr-3 flex-shrink-0"
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedProfileUserId(u.uid);
                   }}
                 >
                   <img src={u.photoURL} alt="" className="h-12 w-12 rounded-full object-cover shadow-sm" />
                   {u.isOnline && (
                     <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#06cf9c]" />
                   )}
                 </div>
                 <div className="flex-1 overflow-hidden">
                   <h3 className="font-medium text-[#111b21] flex items-center">
                     {u.displayName}
                     {u.username && <span className="ml-2 text-[10px] text-emerald-500 font-bold">@{u.username}</span>}
                   </h3>
                   <p className="text-[12px] text-[#667781] truncate">
                     {u.statusMessage || (u.isOnline ? "Available" : u.lastSeen ? `Last seen ${formatLastSeen(u.lastSeen)}` : 'Offline')}
                   </p>
                 </div>
               </div>
             ))}
           </div>
        )}

        {viewMode === 'new-group-select' && (
          <div className="flex flex-col h-full">
            <div className="px-4 py-2 text-[12px] font-semibold text-[#667781] uppercase tracking-wider bg-[#f0f2f5]">Select group members</div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#f5f6f6]">
              {allUsers.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase())).map((u) => (
                <div 
                  key={u.uid} 
                  onClick={() => toggleUserSelection(u.uid)}
                  className="flex cursor-pointer items-center px-3 py-3 transition-colors hover:bg-[#f5f6f6]"
                >
                  <div className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border mr-3 transition-colors",
                    selectedUsers.includes(u.uid) ? "bg-[#00a884] border-[#00a884]" : "bg-white border-gray-300"
                  )}>
                    {selectedUsers.includes(u.uid) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <img src={u.photoURL} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <div className="ml-3 flex-1">
                    <h3 className="font-medium text-[#111b21]">{u.displayName}</h3>
                  </div>
                </div>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex justify-center p-4 bg-[#f0f2f5]">
                <button 
                  onClick={() => setViewMode('new-group-info')}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] shadow-lg text-white"
                >
                  <ArrowRight className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'new-group-info' && (
          <div className="flex flex-col h-full bg-[#f0f2f5]">
            <div className="bg-white p-6 space-y-6">
              <div className="flex items-center space-x-4">
                <button onClick={() => setViewMode('new-group-select')} className="text-[#54656f]">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-medium text-[#111b21]">New group</h2>
              </div>
              <div className="flex flex-col items-center">
                <div className="h-40 w-40 rounded-full bg-[#dfe5e7] flex items-center justify-center overflow-hidden border border-white shadow-sm">
                   <Users className="h-20 w-20 text-[#54656f]" />
                </div>
                <input 
                  type="text" 
                  placeholder="Group Subject" 
                  className="mt-6 w-full border-b-2 border-[#00a884] py-2 text-sm outline-none bg-transparent"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1" />
            {groupName.trim() && (
              <div className="flex justify-center p-4">
                <button 
                  onClick={handleCreateGroup}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] shadow-lg text-white"
                >
                  <Check className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'chats' && (
          <div className="pb-10">
            {/* Pinned Section */}
            {chats.some(c => c.pinnedMessages && c.pinnedMessages.length > 0) && (
               <div className="mt-4">
                 <div className="px-6 py-2 flex items-center text-[10px] font-bold text-[#667781] uppercase tracking-[0.2em]">
                   <Pin className="h-3 w-3 mr-2 text-emerald-500" />
                   Pinned Conversations
                 </div>
                 <div className="space-y-0.5">
                   {chats
                    .filter(c => c.pinnedMessages && c.pinnedMessages.length > 0)
                    .map((chat) => (
                      <ChatItem 
                        key={chat.chatId} 
                        chat={chat} 
                        active={selectedChatId === chat.chatId}
                        onClick={() => onSelectChat(chat.chatId)}
                        onViewProfile={(uid) => setSelectedProfileUserId(uid)}
                      />
                    ))}
                 </div>
               </div>
            )}

            <div className="mt-4">
              <div className="px-6 py-2 flex items-center text-[10px] font-bold text-[#667781] uppercase tracking-[0.2em]">
                Recent Chats
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                {chats
                  .filter(c => {
                    const matchesSearch = c.type === 'group' ? c.name?.toLowerCase().includes(search.toLowerCase()) : true;
                    if (!matchesSearch) return false;
                    
                    if (activeFilter === 'unread') return (c.unreadCount?.[user?.uid || ''] || 0) > 0;
                    if (activeFilter === 'groups') return c.type === 'group';
                    return true;
                  })
                  .sort((a, b) => {
                    const timeA = a.lastMessage?.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
                    const timeB = b.lastMessage?.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                  })
                  .map((chat) => (
                    <motion.div
                      key={chat.chatId}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChatItem 
                        chat={chat} 
                        active={selectedChatId === chat.chatId}
                        onClick={() => onSelectChat(chat.chatId)}
                        onViewProfile={(uid) => setSelectedProfileUserId(uid)}
                      />
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedProfileUserId && (
          <ProfileView 
            userId={selectedProfileUserId} 
            isCurrentUser={selectedProfileUserId === user?.uid}
            onClose={() => setSelectedProfileUserId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ChatItem: React.FC<{ 
  chat: Chat; 
  active: boolean; 
  onClick: () => void;
  onViewProfile: (uid: string) => void;
}> = ({ chat, active, onClick, onViewProfile }) => {
  const { user } = useAuth();
  const [partner, setPartner] = useState<User | null>(null);

  useEffect(() => {
    if (chat.type === 'one-to-one' && user) {
      const partnerId = chat.participants.find(id => id !== user.uid);
      if (partnerId) {
         const unsub = onSnapshot(doc(db, 'users', partnerId), (doc) => {
           setPartner(doc.data() as User);
         }, (error) => {
           handleFirestoreError(error, OperationType.GET, `users/${partnerId}`);
         });
         return unsub;
      }
    }
  }, [chat, user]);

  const name = chat.type === 'group' ? chat.name : partner?.displayName;
  const photo = chat.type === 'group' 
    ? chat.photoURL 
    : (partner?.privacySettings?.showPhoto === 'nobody' ? 'https://ui-avatars.com/api/?name=?' : partner?.photoURL);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center px-6 py-4 transition-all duration-500 relative group mx-2 my-1 rounded-[24px] overflow-hidden",
        active ? "bg-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.08)] scale-[1.02]" : "hover:bg-[#f8f9fa]"
      )}
    >
      {active && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute left-0 w-1.5 h-[40%] bg-emerald-500 rounded-r-full"
        />
      )}
      <div 
        className="relative mr-4 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          if (chat.type === 'one-to-one' && partner) {
             onViewProfile(partner.uid);
          }
        }}
      >
        <div className="relative p-0.5 rounded-[20px] bg-gradient-to-tr from-emerald-500/10 to-transparent">
          <img 
            src={photo || 'https://ui-avatars.com/api/?name=?'} 
            alt="" 
            className={cn(
              "h-14 w-14 rounded-[18px] object-cover transition-all duration-500 shadow-sm",
              active ? "ring-2 ring-white" : "group-hover:scale-105"
            )} 
          />
        </div>
        {partner?.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
        )}
        {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && !active && (
          <div className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-emerald-500 border-2 border-white rounded-full animate-bounce shadow-md" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <h3 className={cn(
            "truncate text-[15.5px] tracking-tight font-display transition-colors",
            (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "font-black text-[#111b21]" : "font-bold text-[#111b21]/90",
            active && "text-emerald-900"
          )}>{name || 'Loading...'}</h3>
          {chat.lastMessage?.timestamp && (
            <span className={cn(
              "text-[10px] font-black tracking-tighter ml-2 uppercase opacity-60", 
              (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-emerald-600 opacity-100" : "text-[#667781]"
            )}>
              {formatDate(chat.lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center whitespace-nowrap">
          <div className="flex items-center space-x-1.5 flex-1 overflow-hidden mr-3">
            {chat.lastMessage?.senderId === user?.uid && (
              <span className="flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                {chat.lastMessage.status === 'read' ? (
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : <Check className="h-3.5 w-3.5" />}
              </span>
            )}
            <p className={cn(
              "truncate text-[13px] leading-tight transition-colors",
              (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-[#111b21] font-bold" : "text-[#667781]",
              active && "text-emerald-700/80"
            )}>
              {chat.lastMessage?.text || 'No messages yet'}
            </p>
          </div>
          {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xl shadow-emerald-500/20">
              {chat.unreadCount![user!.uid]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
