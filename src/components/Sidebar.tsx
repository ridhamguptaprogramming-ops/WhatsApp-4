import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Chat, User } from '../types';
import { Search, UserPlus, LogOut, Users, Check, ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react';
import { cn, formatDate, formatLastSeen } from '../lib/utils';
import { logout } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId: string | null;
}

type ViewMode = 'chats' | 'users' | 'new-group-select' | 'new-group-info';

export const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, selectedChatId }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chats');
  
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
    const { chatService } = await import('../services/chatService');
    const chatId = await chatService.createGroup(groupName, [...selectedUsers, user.uid]);
    onSelectChat(chatId);
    setViewMode('chats');
    setGroupName('');
    setSelectedUsers([]);
  };

  return (
    <div className="flex h-full w-[350px] flex-col border-r border-[#d1d7db] bg-white min-w-[350px]">
      {/* Header */}
      <div className="flex h-[60px] items-center justify-between bg-[#f0f2f5] px-4 py-2">
        <div className="flex items-center space-x-3">
          <img src={user?.photoURL} alt="Avatar" className="h-10 w-10 rounded-full border border-white shadow-sm" />
        </div>
        <div className="flex space-x-6 text-[#54656f]">
          <button onClick={() => setViewMode(viewMode === 'chats' ? 'users' : 'chats')} className="transition-colors hover:text-[#00a884]" title="New Chat">
            <UserPlus className="h-6 w-6" />
          </button>
          <button onClick={() => setViewMode('new-group-select')} className="transition-colors hover:text-[#00a884]" title="New Group">
            <Users className="h-6 w-6" />
          </button>
          <button onClick={logout} title="Logout" className="transition-colors hover:text-red-500">
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Conditional Search / Header for Sub-views */}
      {viewMode === 'chats' || viewMode === 'users' || viewMode === 'new-group-select' ? (
        <div className="px-3 py-2 bg-white border-b border-[#f0f2f5]">
          <div className={cn(
            "relative flex items-center rounded-xl bg-[#f0f2f5] px-4 py-2 transition-all duration-300 ease-in-out",
            "focus-within:bg-white focus-within:ring-2 focus-within:ring-[#00a884]/20 focus-within:shadow-[0_2px_8px_rgba(0,168,132,0.1)]"
          )}>
            {viewMode !== 'chats' ? (
               <button 
                 onClick={() => setViewMode('chats')} 
                 className="mr-3 text-[#54656f] hover:text-[#00a884] transition-colors"
               >
                 <ArrowLeft className="h-5 w-5" />
               </button>
            ) : (
               <Search className="mr-3 h-[18px] w-[18px] text-[#54656f] transition-transform duration-300 group-focus-within:scale-110" />
            )}
            <input
              type="text"
              placeholder={viewMode === 'chats' ? "Search or start new chat" : "Search users..."}
              className="w-full bg-transparent text-[15px] text-[#111b21] outline-none placeholder:text-[#667781] font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'users' && (
           <div className="divide-y divide-[#f5f6f6]">
             <div className="px-4 py-2 text-[12px] font-semibold text-[#667781] uppercase tracking-wider bg-[#f0f2f5]">All Users</div>
             {allUsers.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase())).map((u) => (
               <div 
                 key={u.uid} 
                 onClick={async () => {
                    const { chatService } = await import('../services/chatService');
                    const chatId = await chatService.getOrCreateChat(user!.uid, u.uid);
                    onSelectChat(chatId);
                    setViewMode('chats');
                 }}
                 className="flex cursor-pointer items-center px-3 py-3 transition-colors hover:bg-[#f5f6f6]"
               >
                 <div className="relative mr-3 flex-shrink-0">
                   <img src={u.photoURL} alt="" className="h-12 w-12 rounded-full object-cover shadow-sm" />
                   {u.isOnline && (
                     <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#06cf9c]" />
                   )}
                 </div>
                 <div className="flex-1 overflow-hidden">
                   <h3 className="font-medium text-[#111b21]">{u.displayName}</h3>
                   <p className="text-[12px] text-[#667781] truncate">
                     {u.isOnline ? (
                       <span className="text-[#00a884] font-medium">Online</span>
                     ) : u.lastSeen ? (
                       `Last seen ${formatLastSeen(u.lastSeen)}`
                     ) : 'Offline'}
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
          <div className="divide-y divide-[#f5f6f6]">
            <AnimatePresence mode="popLayout" initial={false}>
              {chats
                .filter(c => 
                  c.type === 'group' 
                    ? c.name?.toLowerCase().includes(search.toLowerCase()) 
                    : true
                )
                .sort((a, b) => {
                  const timeA = a.lastMessage?.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
                  const timeB = b.lastMessage?.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
                  return timeB - timeA;
                })
                .map((chat) => (
                  <motion.div
                    key={chat.chatId}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ 
                      duration: 0.2,
                      layout: { duration: 0.25, ease: "easeOut" }
                    }}
                  >
                    <ChatItem 
                      chat={chat} 
                      active={selectedChatId === chat.chatId}
                      onClick={() => onSelectChat(chat.chatId)}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatItem: React.FC<{ chat: Chat; active: boolean; onClick: () => void }> = ({ chat, active, onClick }) => {
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
  const photo = chat.type === 'group' ? chat.photoURL : partner?.photoURL;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center px-3 py-3 transition-all duration-200 border-l-4 border-transparent hover:bg-[#f5f6f6]",
        active && "bg-[#f0f2f5] hover:bg-[#f0f2f5] border-[#00a884]"
      )}
    >
      <div className="relative mr-3 flex-shrink-0">
        <img src={photo || 'https://ui-avatars.com/api/?name=?'} alt="" className="h-12 w-12 rounded-full object-cover shadow-sm" />
        {partner?.isOnline && (
          <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#06cf9c]" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className={cn(
            "truncate font-medium text-[#111b21]",
            (chat.unreadCount?.[user?.uid || ''] || 0) > 0 && "font-bold"
          )}>{name || 'Loading...'}</h3>
          {chat.lastMessage?.timestamp && (
            <span className={cn(
              "text-[12px] whitespace-nowrap ml-2", 
              (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-[#00a884] font-semibold" : "text-[#667781]"
            )}>
              {formatDate(chat.lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-1 flex-1 overflow-hidden mr-2">
            {chat.lastMessage?.senderId === user?.uid && (
              <span className="flex-shrink-0">
                {chat.lastMessage.status === 'read' ? (
                  <CheckCheck className="h-4 w-4 text-[#53bdeb]" />
                ) : chat.lastMessage.status === 'delivered' ? (
                  <CheckCheck className="h-4 w-4 text-[#8696a0]" />
                ) : (
                  <Check className="h-4 w-4 text-[#8696a0]" />
                )}
              </span>
            )}
            <p className={cn(
              "truncate text-sm",
              (chat.unreadCount?.[user?.uid || ''] || 0) > 0 ? "text-[#111b21] font-medium" : "text-[#667781]"
            )}>
              {chat.lastMessage?.text || 'No messages yet'}
            </p>
          </div>
          {(chat.unreadCount?.[user?.uid || ''] || 0) > 0 && (
            <span className="bg-[#00a884] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center animate-in zoom-in-50 duration-300">
              {chat.unreadCount![user!.uid]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
