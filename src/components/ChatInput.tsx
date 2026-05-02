import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile, Paperclip, Mic, X, Image as ImageIcon, FileIcon, Square, Loader2, Sparkles, Wand2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';

interface ChatInputProps {
  chatId: string;
  onSendMessage: (text: string) => Promise<void>;
  onSendMedia: (file: File | Blob, audioDuration?: number) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyingTo?: { text: string; senderName: string } | null;
  onCancelReply?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  chatId, 
  onSendMessage, 
  onSendMedia, 
  onTyping,
  replyingTo,
  onCancelReply
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showSmartTools, setShowSmartTools] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load draft
  useEffect(() => {
    const draft = localStorage.getItem(`draft_${chatId}`);
    if (draft) setText(draft);
  }, [chatId]);

  // Save draft
  useEffect(() => {
    if (text) {
      localStorage.setItem(`draft_${chatId}`, text);
    } else {
      localStorage.removeItem(`draft_${chatId}`);
    }
  }, [text, chatId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping(e.target.value.length > 0);
    
    // Auto resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    try {
      await onSendMessage(text);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingTime > 1) {
          await onSendMedia(audioBlob, recordingTime);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => onSendMedia(file));
  }, [onSendMedia]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    noClick: true,
    accept: {
      'image/*': [],
      'video/*': [],
      'application/pdf': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': []
    }
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) onSendMedia(file);
      }
    }
  };

  const improveWithAI = async (tone: 'professional' | 'friendly' | 'concise') => {
    if (!text.trim()) return;
    setIsImproving(true);
    try {
      const improved = await geminiService.improveWriting(text, tone);
      setText(improved);
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="relative border-t border-black/5 bg-white/80 backdrop-blur-md px-4 py-3" {...getRootProps()} onPaste={handlePaste}>
      <input {...getInputProps()} />
      
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm border-2 border-dashed border-emerald-500 animate-pulse">
          <div className="flex flex-col items-center text-emerald-600">
            <Paperclip className="h-10 w-10 mb-2" />
            <span className="font-bold uppercase tracking-widest text-xs">Drop files to send</span>
          </div>
        </div>
      )}

      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-2 p-3 bg-gray-50 rounded-2xl border-l-4 border-emerald-500 flex items-center justify-between"
          >
            <div className="overflow-hidden">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Replying to {replyingTo.senderName}</p>
              <p className="text-xs text-gray-500 truncate">{replyingTo.text}</p>
            </div>
            <button onClick={onCancelReply} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end space-x-2 relative z-10">
        <div className="flex items-center space-x-1 mb-1">
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={cn("p-2 rounded-xl transition-colors", showEmojiPicker ? "text-emerald-500 bg-emerald-50" : "text-gray-400 hover:bg-gray-100")}
          >
            <Smile className="h-6 w-6" />
          </button>
          
          <div className="relative group">
            <button className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
              <Paperclip className="h-6 w-6" />
            </button>
            <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 origin-bottom-left">
              <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-2 flex flex-col space-y-1">
                <button className="p-3 hover:bg-emerald-50 rounded-xl text-emerald-600 flex items-center space-x-3 transition-colors">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-xs font-bold whitespace-nowrap">Image / Video</span>
                </button>
                <button className="p-3 hover:bg-blue-50 rounded-xl text-blue-600 flex items-center space-x-3 transition-colors">
                  <FileIcon className="h-5 w-5" />
                  <span className="text-xs font-bold whitespace-nowrap">Document</span>
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setShowSmartTools(!showSmartTools)}
            className={cn("p-2 rounded-xl transition-all", showSmartTools ? "text-purple-500 bg-purple-50" : "text-gray-400 hover:text-purple-500 hover:bg-purple-50")}
          >
            <Sparkles className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Recording..." : "Type a message..."}
            disabled={isRecording}
            className="w-full bg-gray-100 rounded-2xl px-4 py-3 pr-12 outline-none resize-none text-[15px] max-h-[150px] transition-all focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
          />
          
          <AnimatePresence>
            {text.length > 0 && !isRecording && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-2 bottom-2 p-1.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 transition-transform"
                onClick={handleSend}
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!text.length && (
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            className={cn(
              "p-3 rounded-2xl transition-all relative overflow-hidden",
              isRecording ? "bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/30" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
            )}
          >
            {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            {isRecording && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-white/20 animate-pulse"
              />
            )}
          </button>
        )}
      </div>

      {/* Recording Display */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute inset-x-0 bottom-0 top-0 z-20 bg-white flex items-center px-6 space-x-6"
          >
             <div className="flex items-center space-x-4 flex-1">
                <div className="flex items-center space-x-1">
                   {[1,2,3,4,5,6,7,8].map(i => (
                     <motion.div 
                       key={i}
                       animate={{ height: [4, 12, 4] }}
                       transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                       className="w-1 bg-rose-500 rounded-full"
                     />
                   ))}
                </div>
                <span className="text-sm font-bold text-rose-500">{formatTime(recordingTime)}</span>
                <span className="text-xs font-medium text-gray-400 animate-pulse">Recording voice... Release to send</span>
             </div>
             <button onClick={stopRecording} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
               <X className="h-6 w-6" />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker Overlay */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div 
            initial={{ opacity: 0, bottom: '80%' }}
            animate={{ opacity: 1, bottom: '100%' }}
            exit={{ opacity: 0, bottom: '80%' }}
            className="absolute left-4 mb-4 z-50"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden">
               <EmojiPicker 
                 theme={Theme.LIGHT} 
                 onEmojiClick={(data) => {
                   setText(prev => prev + data.emoji);
                   setShowEmojiPicker(false);
                 }} 
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Tools Overlay */}
      <AnimatePresence>
        {showSmartTools && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-4 right-4 mb-4 z-50 p-6 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-black/5"
          >
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="text-sm font-bold flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                    AI Writing Assistant
                  </h3>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Refine your message with Gemini-3</p>
               </div>
               <button onClick={() => setShowSmartTools(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                 <X className="h-4 w-4 text-gray-400" />
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               {[
                 { id: 'friendly', name: 'Friendly', icon: Smile, color: 'text-amber-500 bg-amber-50' },
                 { id: 'professional', name: 'Professional', icon: Wand2, color: 'text-blue-500 bg-blue-50' },
                 { id: 'concise', name: 'Concise', icon: History, color: 'text-emerald-500 bg-emerald-50' },
                 { id: 'humorous', name: 'Witty', icon: Sparkles, color: 'text-purple-500 bg-purple-50' }
               ].map(tool => (
                 <button 
                  key={tool.id}
                  onClick={() => improveWithAI(tool.id as any)}
                  disabled={isImproving || !text.trim()}
                  className={cn(
                    "p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 transition-all active:scale-95",
                    tool.color,
                    (isImproving || !text.trim()) && "opacity-50 grayscale"
                  )}
                 >
                   <tool.icon className="h-6 w-6" />
                   <span className="text-[10px] font-bold uppercase tracking-widest">{tool.name}</span>
                 </button>
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
