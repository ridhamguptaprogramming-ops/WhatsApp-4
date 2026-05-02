import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Chat, Message, User, TypingStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { MoreVertical, Search, Send, Smile, Paperclip, Check, CheckCheck, FileIcon, Download, Loader2 } from 'lucide-react';
import { cn, formatDate, formatLastSeen } from '../lib/utils';
import { chatService } from '../services/chatService';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

import { useInView } from 'react-intersection-observer';

interface ChatWindowProps {
  chatId: string;
}

interface MessageItemProps {
  msg: Message;
  chat: Chat | null;
  user: User | null;
  isLast: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ msg, chat, user, isLast }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.5,
  });

  useEffect(() => {
    if (inView && msg.senderId !== user?.uid && msg.status !== 'read' && chat?.chatId) {
      chatService.markAsRead(chat.chatId, msg.messageId, isLast);
    }
  }, [inView, msg, user, chat, isLast]);

  const renderMedia = () => {
    if (!msg.mediaUrl) return null;

    if (msg.type === 'image') {
      return (
        <div className="mb-1 overflow-hidden rounded-md bg-black/5">
          <img 
            src={msg.mediaUrl} 
            alt="Shared image" 
            className="max-h-[300px] w-full object-cover cursor-pointer hover:opacity-95 transition-opacity" 
            onClick={() => window.open(msg.mediaUrl, '_blank')}
          />
        </div>
      );
    }

    if (msg.type === 'video') {
      return (
        <div className="mb-1 overflow-hidden rounded-md bg-black">
          <video 
            src={msg.mediaUrl} 
            controls 
            className="max-h-[300px] w-full"
          />
        </div>
      );
    }

    if (msg.type === 'file') {
      return (
        <a 
          href={msg.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center space-x-3 rounded-md bg-black/5 p-3 hover:bg-black/10 transition-colors mb-1"
        >
          <div className="rounded-full bg-[#111b21]/10 p-2 text-[#54656f]">
            <FileIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-[#111b21]">File Attachment</p>
            <p className="text-xs text-[#667781]">Click to view/download</p>
          </div>
          <Download className="h-4 w-4 text-[#54656f]" />
        </a>
      );
    }

    return null;
  };

  return (
    <div 
      ref={ref}
      className={cn(
        "relative max-w-[70%] rounded-lg p-1.5 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1",
        msg.senderId === user?.uid 
          ? "self-end bg-[#d9fdd3] rounded-tr-none" 
          : "self-start bg-white rounded-tl-none"
      )}
    >
      <div className="px-1.5 pt-0.5">
        {chat?.type === 'group' && msg.senderId !== user?.uid && (
          <div className="text-[12px] font-bold text-[#e542a3] mb-0.5">Alex</div>
        )}
        
        {renderMedia()}
        
        {msg.text && (
          <p className="text-[14.2px] text-[#111b21] leading-relaxed pb-4">{msg.text}</p>
        )}
        
        <div className="absolute bottom-1 right-2 flex items-center space-x-1 pl-4">
          <span className="text-[10px] text-[#667781]">
            {msg.timestamp ? formatDate(msg.timestamp) : '...'}
          </span>
          {msg.senderId === user?.uid && (
              msg.status === 'read' 
                ? <CheckCheck className="h-[15px] w-[15px] text-[#53bdeb]" />
                : <Check className="h-[15px] w-[15px] text-[#667781]" />
          )}
        </div>
      </div>
    </div>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<User | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    // Listen to chat metadata
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      const data = doc.data() as Chat;
      setChat(data);
      if (data.unreadCount?.[user.uid] && data.unreadCount[user.uid] > 0) {
        chatService.resetUnreadCount(chatId, user.uid);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    });

    // Listen to messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    const unsubMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ ...d.data(), messageId: d.id } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    // Listen to typing status
    const unsubTyping = onSnapshot(collection(db, 'chats', chatId, 'typing'), (snapshot) => {
      const active = snapshot.docs
        .map(doc => doc.data() as { isTyping: boolean, updatedAt: any })
        .filter(d => d.isTyping && d.updatedAt?.toDate() > Date.now() - 5000); // 5 sec threshold
      // Simplified: list of userIds who are typing
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/typing`);
    });

    return () => {
      unsubChat();
      unsubMessages();
      unsubTyping();
    };
  }, [chatId, user]);

  useEffect(() => {
    if (chat && user) {
      const pId = chat.participants.find(id => id !== user.uid);
      if (pId) {
        onSnapshot(doc(db, 'users', pId), (doc) => {
          setPartner(doc.data() as User);
        });
      }
    }
  }, [chat, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;
    
    await chatService.sendMessage(chatId, user.uid, inputValue);
    setInputValue('');
    chatService.setTyping(chatId, user.uid, false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!user) return;
    chatService.setTyping(chatId, user.uid, e.target.value.length > 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      await chatService.sendMediaMessage(chatId, user.uid, file);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages (media)`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-[#efeae2] relative overflow-hidden">
      {/* Header */}
      <div className="flex h-[60px] items-center bg-[#f0f2f5] px-4 border-l border-[#d1d7db] z-10 shadow-sm">
        <img src={partner?.photoURL || chat?.photoURL || 'https://ui-avatars.com/api/'} alt="" className="h-10 w-10 rounded-full border border-white shadow-sm" />
        <div className="ml-4 flex-1">
          <h2 className="font-medium text-[#111b21]">{chat?.type === 'group' ? chat.name : partner?.displayName}</h2>
          <p className="text-[13px] text-[#667781]">
            {partner?.isOnline ? (
              <span className="text-[#00a884] font-medium">online</span>
            ) : partner?.lastSeen ? (
              `last seen ${formatLastSeen(partner.lastSeen)}`
            ) : ''}
          </p>
        </div>
        <div className="flex space-x-6 text-[#54656f]">
          <Search className="h-5 w-5 cursor-pointer hover:text-[#111b21] transition-colors" />
          <MoreVertical className="h-5 w-5 cursor-pointer hover:text-[#111b21] transition-colors" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-center mb-4">
            <span className="bg-white text-[12px] px-3 py-1 rounded-md shadow-sm text-[#54656f] uppercase tracking-wider">Today</span>
          </div>
          
          {messages.map((msg, index) => (
            <MessageItem 
              key={msg.messageId} 
              msg={msg} 
              chat={chat} 
              user={user} 
              isLast={index === messages.length - 1} 
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex h-[72px] items-center bg-white px-4 py-3 space-x-4 border-t border-[#d1d7db]/60 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex space-x-4 text-[#54656f]">
          <Smile className="h-[26px] w-[26px] cursor-pointer hover:text-[#00a884] transition-all hover:scale-110 active:scale-95" />
          <div className="relative">
            {isUploading ? (
              <Loader2 className="h-[26px] w-[26px] animate-spin text-[#00a884]" />
            ) : (
              <Paperclip 
                onClick={() => fileInputRef.current?.click()}
                className="h-[26px] w-[26px] cursor-pointer hover:text-[#00a884] transition-all hover:scale-110 active:scale-95" 
              />
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
          </div>
        </div>
        <form onSubmit={handleSendMessage} className="flex-1">
          <div className="bg-[#f0f2f5] rounded-xl px-5 py-2.5 transition-all duration-300 ease-in-out focus-within:bg-white focus-within:ring-2 focus-within:ring-[#00a884]/20 border border-transparent focus-within:border-[#00a884]/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus-within:shadow-md">
            <input
              type="text"
              placeholder="Type a message"
              className="w-full text-[15px] font-sans text-[#111b21] outline-none placeholder:text-[#667781] bg-transparent font-medium"
              value={inputValue}
              onChange={handleTyping}
            />
          </div>
        </form>
        <div className="text-[#54656f] flex items-center justify-center w-12">
          {inputValue.trim() ? (
             <button 
               type="submit" 
               onClick={handleSendMessage}
               className="bg-[#00a884] p-3 rounded-full text-white shadow-lg hover:bg-[#008f70] transition-all transform hover:scale-110 active:scale-90"
             >
               <Send className="h-5 w-5 ml-0.5" />
             </button>
          ) : (
             <div className="p-3 hover:bg-[#f0f2f5] rounded-full transition-all cursor-pointer text-[#54656f] hover:text-[#111b21] hover:scale-110 active:scale-95">
               <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                 <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
               </svg>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
