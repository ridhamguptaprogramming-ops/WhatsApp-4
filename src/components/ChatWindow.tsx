import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Chat, Message, User, TypingStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { MoreVertical, Search, Send, Smile, Paperclip, Check, CheckCheck, FileIcon, Download, Loader2, Box, Users, X, Reply, Zap, Sparkles, Pin, ListTodo } from 'lucide-react';
import { cn, formatDate, formatLastSeen } from '../lib/utils';
import { chatService } from '../services/chatService';
import { geminiService } from '../services/geminiService';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';
import { ARWhiteboard } from './ARWhiteboard';
import { ProfileView } from './ProfileView';
import { motion, AnimatePresence } from 'motion/react';

import { useInView } from 'react-intersection-observer';

import { ChatInput } from './ChatInput';
import { Play, Pause, Volume2, Pencil, Trash2, Phone, Video } from 'lucide-react';
import { useCalling } from '../context/CallingContext';

interface ChatWindowProps {
  chatId: string;
}

interface MessageItemProps {
  msg: Message;
  chat: Chat | null;
  user: User | null;
  isLast: boolean;
  onReply: (msg: Message) => void;
  onTask: (msg: Message) => void;
  replyToMsg?: Message | null;
}

const EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

const MessageItem: React.FC<MessageItemProps> = ({ msg, chat, user, isLast, onReply, onTask, replyToMsg }) => {
  const [showReactions, setShowReactions] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.5,
  });

  useEffect(() => {
    if (inView && msg.senderId !== user?.uid && msg.status !== 'read' && chat?.chatId) {
      chatService.markAsRead(chat.chatId, msg.messageId, isLast);
    }
  }, [inView, msg, user, chat, isLast]);

  const handleReact = (emoji: string) => {
    if (chat?.chatId && user) {
      chatService.addReaction(chat.chatId, msg.messageId, user.uid, emoji);
      setShowReactions(false);
    }
  };

  const renderMedia = () => {
    if (msg.isDeleted) return null;
    if (!msg.mediaUrl && msg.type !== 'text') return null;

    if (msg.type === 'audio') {
      return <AudioMessage url={msg.mediaUrl!} duration={msg.audioDuration} isMe={isMe} />;
    }

    if (msg.type === 'image') {
      return (
        <div className="mb-2 overflow-hidden rounded-xl bg-black/5 ring-1 ring-black/5">
          <img 
            src={msg.mediaUrl} 
            alt="Shared image" 
            className="max-h-[350px] w-full object-cover cursor-pointer hover:opacity-95 transition-opacity" 
            onClick={() => window.open(msg.mediaUrl, '_blank')}
          />
        </div>
      );
    }

    if (msg.type === 'video') {
      return (
        <div className="mb-2 overflow-hidden rounded-xl bg-black group relative">
          <video 
            src={msg.mediaUrl} 
            controls 
            playsInline
            className="max-h-[350px] w-full"
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
          className="flex items-center space-x-3 rounded-xl bg-black/5 p-4 hover:bg-black/10 transition-colors mb-2 border border-black/5"
        >
          <div className={cn("rounded-full p-2.5", isMe ? "bg-emerald-500/20 text-emerald-100" : "bg-emerald-500/10 text-emerald-600")}>
            <FileIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <p className={cn("truncate text-sm font-bold", isMe ? "text-white" : "text-[#111b21]")}>
              {msg.metadata?.fileName || 'File Attachment'}
            </p>
            <p className={cn("text-[10px] opacity-70", isMe ? "text-emerald-50" : "text-[#667781]")}>
              {msg.metadata?.fileSize ? `${(msg.metadata.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Click to view'}
            </p>
          </div>
          <Download className={cn("h-4 w-4", isMe ? "text-white" : "text-[#54656f]")} />
        </a>
      );
    }

    return null;
  };

  const isMe = msg.senderId === user?.uid;

  if (msg.isDeleted) {
    return (
      <div className={cn("flex flex-col mb-1", isMe ? "items-end" : "items-start")}>
        <div className="px-4 py-2 bg-gray-100 rounded-2xl text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-300">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={ref}
      className={cn(
        "group relative flex flex-col mb-2 transition-all",
        isMe ? "items-end" : "items-start"
      )}
    >
      <div className={cn(
        "relative max-w-[85%] sm:max-w-[70%] transition-all",
        isMe ? "items-end" : "items-start"
      )}>
        {/* Reply Quote */}
        {replyToMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mb-[-12px] pb-4 px-4 pt-2 rounded-t-[20px] transition-all opacity-80 border-x border-t",
              isMe ? "bg-emerald-600/10 border-emerald-500/20 mr-4" : "bg-gray-100 border-gray-200 ml-4"
            )}
          >
            <div className="flex items-center space-x-2 mb-1">
              <Reply className="h-3 w-3 opacity-40 rotate-180" />
              <span className="font-black text-[10px] uppercase tracking-wider opacity-60">
                {replyToMsg.senderId === user?.uid ? 'You' : 'Participant'}
              </span>
            </div>
            <p className="truncate italic text-xs opacity-80 max-w-[200px]">
              {replyToMsg.text || 'Media attachment'}
            </p>
          </motion.div>
        )}

        <div className={cn(
          "px-5 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all relative overflow-visible rounded-[24px] border",
          isMe 
            ? "bg-emerald-500 text-white border-emerald-400 rounded-tr-none shadow-emerald-500/10" 
            : "bg-white text-[#111b21] border-[#f0f2f5] rounded-tl-none"
        )}>
          {chat?.type === 'group' && !isMe && (
            <div className="text-[11px] font-black text-emerald-600 mb-1.5 uppercase tracking-wider opacity-80">
              {msg.senderId.slice(0, 8)}
            </div>
          )}
          
          <div className="relative z-10">
            {renderMedia()}
            
            {msg.text && (
              <div className={cn(
                "markdown-body",
                isMe ? "text-white" : "text-[#111b21]"
              )}>
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {msg.text}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-1.5 mt-1.5 opacity-60">
            {msg.isEdited && (
              <span className="text-[9px] font-black uppercase tracking-tighter mr-1">Edited</span>
            )}
            <span className="text-[10px] font-black tracking-tighter">
              {msg.timestamp ? formatDate(msg.timestamp) : 'SENDING'}
            </span>
            {isMe && (
                msg.status === 'read' 
                  ? <CheckCheck className="h-[14px] w-[14px] text-white" />
                  : <Check className="h-[14px] w-[14px] text-white opacity-40" />
            )}
          </div>

          {/* Reactions Display */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className={cn(
              "absolute -bottom-4 flex -space-x-1",
              isMe ? "right-2" : "left-2"
            )}>
              {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => (
                <div key={emoji} className="bg-white rounded-full px-1.5 py-0.5 text-[12px] shadow-sm ring-1 ring-black/5 hover:scale-110 transition-transform cursor-pointer">
                  {emoji}
                </div>
              ))}
              <div className="bg-gray-50 text-[10px] px-1 py-0.5 rounded-full ring-1 ring-black/5 ml-1 flex items-center text-[#667781] font-bold">
                {msg.reactions.length}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar (Hover only) */}
        <div className={cn(
          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 z-20",
          isMe ? "right-full mr-2" : "left-full ml-2"
        )}>
          <button 
            onClick={() => onReply(msg)}
            className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50 text-[#54656f] active:scale-90 transition-transform"
          >
            <Reply className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onTask(msg)}
            className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50 text-[#54656f] active:scale-90 transition-transform"
            title="Convert to Task"
          >
            <ListTodo className="h-4 w-4" />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowReactions(!showReactions)}
              className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50 text-[#54656f] active:scale-90 transition-transform"
            >
              <Smile className="h-4 w-4" />
            </button>
            <AnimatePresence>
              {showReactions && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-2 bg-white rounded-full shadow-xl border border-black/5 p-1 flex space-x-1 z-50 left-1/2 -translate-x-1/2"
                >
                  {EMOJIS.map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => handleReact(emoji)}
                      className="hover:scale-125 transition-transform p-1 text-lg leading-none active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => chat?.chatId && chatService.togglePinMessage(chat.chatId, msg.messageId, !msg.isPinned)}
            className={cn(
              "p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50 active:scale-90 transition-transform",
              msg.isPinned ? "text-emerald-500" : "text-[#54656f]"
            )}
          >
            <Pin className="h-4 w-4" />
          </button>
          {isMe && (
            <>
              <button 
                onClick={() => {
                  const newText = prompt("Edit message:", msg.text);
                  if (newText && chat?.chatId) chatService.editMessage(chat.chatId, msg.messageId, newText);
                }}
                className="p-1.5 bg-white rounded-full shadow-md hover:bg-emerald-50 text-emerald-600 active:scale-90 transition-transform"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button 
                onClick={() => {
                  if (confirm("Delete this message?") && chat?.chatId) chatService.deleteMessage(chat.chatId, msg.messageId);
                }}
                className="p-1.5 bg-white rounded-full shadow-md hover:bg-rose-50 text-rose-600 active:scale-90 transition-transform"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AudioMessage: React.FC<{ url: string; duration?: number; isMe: boolean }> = ({ url, duration, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className={cn("flex items-center space-x-4 min-w-[200px] py-1", isMe ? "text-white" : "text-[#111b21]")}>
      <button 
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md",
          isMe ? "bg-white text-emerald-600" : "bg-emerald-500 text-white"
        )}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col space-y-1">
        <div className="flex items-center space-x-0.5 h-6">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-1 rounded-full bg-current transition-all",
                progress > (i * 5) ? "opacity-100" : "opacity-30"
              )}
              style={{ height: `${20 + Math.sin(i * 0.5) * 40}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-bold opacity-70">
           <span>{duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : 'Voice Note'}</span>
           <Volume2 className="h-3 w-3" />
        </div>
      </div>
      
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ chatId }) => {
  const { user } = useAuth();
  const { startCall } = useCalling();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<User | null>(null);
  const [typing, setTyping] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<{ file: File; url: string; type: 'image' | 'video' | 'file' } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
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
      const activeIds = snapshot.docs
        .filter(doc => {
          const d = doc.data();
          return d.isTyping && d.updatedAt?.toDate() > Date.now() - 5000 && doc.id !== user.uid;
        })
        .map(doc => doc.id);
      setTyping(activeIds);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    
    // Get smart replies for the last message if it's from partner
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.senderId !== user?.uid && last.text) {
        geminiService.suggestSmartReplies(last.text).then(setSmartReplies);
      } else {
        setSmartReplies([]);
      }
    }
  }, [messages, user?.uid]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !user) return;
    
    await chatService.sendMessage(chatId, user.uid, inputValue, 'text', undefined, replyingTo?.messageId);
    setInputValue('');
    setReplyingTo(null);
    chatService.setTyping(chatId, user.uid, false);
  };

  const handleSummarize = async () => {
    if (messages.length < 5) {
      alert("Need at least 5 messages to summarize.");
      return;
    }
    setIsSummarizing(true);
    setSummary(null);
    try {
      const chatLogs = messages.slice(-20).map(m => ({ 
        text: m.text, 
        senderName: m.senderId === user?.uid ? 'Me' : (partner?.displayName || 'Partner') 
      }));
      const res = await geminiService.summarizeChat(chatLogs);
      setSummary(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleConvertToTask = async (msg: Message) => {
    if (!user || !msg.text) return;
    try {
      const details = await geminiService.generateTaskDetails(msg.text);
      await chatService.createTaskFromMessage(user.uid, `${details.category}: ${details.title}`);
      alert("Added to tasks!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!user) return;
    chatService.setTyping(chatId, user.uid, e.target.value.length > 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('File is too large. Please select a file smaller than 50MB.');
      return;
    }

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const url = URL.createObjectURL(file);
    setPendingFile({ file, url, type });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile || !user || isUploading) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      await chatService.sendMediaMessage(chatId, user.uid, pendingFile.file, (progress) => {
        setUploadProgress(progress);
      });
      setPendingFile(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages (media)`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const cancelUpload = () => {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.url);
      setPendingFile(null);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-[#fdfdfd] relative overflow-hidden">
      {/* Premium Header */}
      <div 
        className="flex h-[80px] items-center bg-white/60 backdrop-blur-3xl px-8 z-40 border-b border-[#f0f2f5] cursor-pointer hover:bg-white/80 transition-all sticky top-0"
        onClick={() => {
          if (chat?.type === 'one-to-one') {
            setShowPartnerProfile(true);
          } else {
            setShowPartnerProfile(true); 
          }
        }}
      >
        <div className="relative">
          <motion.img 
            layoutId={chat?.chatId}
            src={partner?.photoURL || chat?.photoURL || 'https://ui-avatars.com/api/'} 
            alt="" 
            className="h-12 w-12 rounded-[18px] border-2 border-white shadow-xl object-cover" 
          />
          {partner?.isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
          )}
        </div>
        <div className="ml-4 flex-1">
          <h2 className="font-display font-black text-[18px] text-[#111b21] tracking-tight leading-tight">
            {chat?.type === 'group' ? chat.name : partner?.displayName}
          </h2>
          <p className="text-[11px] text-[#667781] font-black uppercase tracking-[0.1em] flex items-center h-4 mt-0.5">
            <AnimatePresence mode="wait">
              {typing.length > 0 ? (
                <motion.span 
                  key="typing"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  className="text-emerald-500 flex items-center"
                >
                  <span className="flex space-x-1 mr-2">
                    {[0, 1, 2].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1 h-1 bg-emerald-500 rounded-full"
                      />
                    ))}
                  </span>
                  Typing
                </motion.span>
              ) : chat?.type === 'group' ? (
                <motion.span 
                  key="group"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center opacity-60"
                >
                  <Users className="h-3 w-3 mr-1.5" />
                  {chat.participants.length} Active
                </motion.span>
              ) : partner?.isOnline ? (
                <motion.span 
                  key="online"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-emerald-500 flex items-center"
                >
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                  Online Now
                </motion.span>
              ) : (
                <motion.span 
                  key="offline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="opacity-40"
                >
                  {partner?.lastSeen ? `Seen ${formatLastSeen(partner.lastSeen)}` : 'Disconnected'}
                </motion.span>
              )}
            </AnimatePresence>
          </p>
        </div>
        <div className="flex items-center space-x-2 text-[#54656f]" onClick={(e) => e.stopPropagation()}>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }} 
            whileTap={{ scale: 0.9 }}
            onClick={() => partner && startCall([partner.uid], 'audio', chat?.type === 'group', chatId)}
            className="p-2.5 rounded-xl transition-all"
            title="Audio Uplink"
          >
            <Phone className="h-5 w-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }} 
            whileTap={{ scale: 0.9 }}
            onClick={() => partner && startCall([partner.uid], 'video', chat?.type === 'group', chatId)}
            className="p-2.5 rounded-xl transition-all"
            title="Visual Stream"
          >
            <Video className="h-5 w-5" />
          </motion.button>
          <div className="w-[1px] h-6 bg-[#f0f2f5] mx-2" />
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(240, 242, 245, 0.8)' }} 
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowWhiteboard(true)}
            className="p-2.5 rounded-xl transition-all"
          >
            <Box className="h-5 w-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(240, 242, 245, 0.8)' }} 
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl transition-all"
          >
            <Search className="h-5 w-5" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(240, 242, 245, 0.8)' }} 
            whileTap={{ scale: 0.9 }}
            className="p-2.5 rounded-xl transition-all"
          >
            <MoreVertical className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#fdfdfd] relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-multiply transition-opacity duration-1000" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.626 10.5H60v2H54.626l-3.5 3.5h-2l3.5-3.5H45.5v-2h7.126l-3.5-3.5h2l3.5 3.5zM10.5 45.5V60h-2V45.5l-3.5 3.5h-2l3.5-3.5V36.5h2v7.126l3.5-3.5h2l-3.5 3.5z' fill='%23000000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")` }} 
        />
        
        <div className="flex flex-col space-y-4 max-w-5xl mx-auto relative z-10">
          {summary && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-6 mx-auto max-w-lg bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-sm italic shadow-sm relative overflow-hidden"
            >
              <button onClick={() => setSummary(null)} className="absolute top-2 right-2 text-emerald-300 hover:text-emerald-500"><X className="h-4 w-4"/></button>
              <div className="flex items-center mb-2 font-bold uppercase tracking-widest text-[10px]">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Summary
              </div>
              <p className="leading-relaxed">{summary}</p>
            </motion.div>
          )}

          <div className="flex justify-center mb-4">
            <span className="bg-white/90 backdrop-blur-sm text-[12px] px-3 py-1 rounded-full shadow-sm text-[#54656f] uppercase tracking-wider border border-[#d1d7db]/30 font-bold">Today</span>
          </div>
          
          <AnimatePresence>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.messageId}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-20px" }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  type: "spring",
                  damping: 25,
                  stiffness: 300,
                  delay: index > messages.length - 5 ? (index - (messages.length - 5)) * 0.05 : 0 
                }}
                layout
              >
                <MessageItem 
                  msg={msg} 
                  chat={chat} 
                  user={user} 
                  isLast={index === messages.length - 1}
                  onReply={setReplyingTo}
                  onTask={handleConvertToTask}
                  replyToMsg={msg.replyTo ? messages.find(m => m.messageId === msg.replyTo) : null}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {typing.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="flex items-center space-x-2 py-2 px-4"
              >
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                      className="w-1.5 h-1.5 bg-[#00a884] rounded-full"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-bold text-[#00a884] uppercase tracking-widest italic">
                  {typing.length === 1 ? 'someone is typing' : 'several people typing'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput 
        chatId={chatId}
        onSendMessage={async (text) => {
          if (user) {
            await chatService.sendMessage(chatId, user.uid, text, 'text', undefined, replyingTo?.messageId);
            setReplyingTo(null);
            chatService.setTyping(chatId, user.uid, false);
          }
        }}
        onSendMedia={async (file, duration) => {
          if (user) {
            await chatService.sendMediaMessage(chatId, user.uid, file, undefined, duration);
          }
        }}
        onTyping={(isTyping) => {
          if (user) chatService.setTyping(chatId, user.uid, isTyping);
        }}
        replyingTo={replyingTo ? { text: replyingTo.text || 'Media', senderName: replyingTo.senderId === user?.uid ? 'Me' : 'Partner' } : null}
        onCancelReply={() => setReplyingTo(null)}
      />

      <AnimatePresence>
        {showWhiteboard && (
          <ARWhiteboard 
            chatId={chatId} 
            onClose={() => setShowWhiteboard(false)} 
          />
        )}
        {showPartnerProfile && partner && (
          <ProfileView 
            userId={partner.uid} 
            onClose={() => setShowPartnerProfile(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
