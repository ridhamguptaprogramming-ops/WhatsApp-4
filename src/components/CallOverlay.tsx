import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Phone, 
  Maximize2, Minimize2, Users, LayoutGrid, 
  Settings, MessageSquare, Hand, Sparkles, Loader2
} from 'lucide-react';
import { CallSession, CallType, WebRTCSignaling } from '../types';
import { useAuth } from '../context/AuthContext';
import { callService } from '../services/callService';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';

interface CallOverlayProps {
  session: CallSession;
  onEnd: () => void;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({ session, onEnd }) => {
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(session.type === 'audio');
  const [isConnecting, setIsConnecting] = useState(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    startLocalStream();
    return () => {
      stopAllMedia();
    };
  }, []);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: session.type === 'video',
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      // Initialize calls to other participants
      session.participants.forEach(participantId => {
        if (participantId !== user?.uid) {
          initiatePeerConnection(participantId, stream);
        }
      });

      // Listen for incoming signals
      if (user) {
        const unsub = callService.listenForSignals(session.callId, user.uid, (signal) => {
          handleIncomingSignal(signal, stream);
        });
        return unsub;
      }
    } catch (err) {
      console.error("Media access error:", err);
      alert("Please allow camera and microphone access to join the call.");
    }
  };

  const stopAllMedia = () => {
    localStream?.getTracks().forEach(track => track.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
  };

  const initiatePeerConnection = async (targetUserId: string, stream: MediaStream) => {
    if (peerConnections.current.has(targetUserId)) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.current.set(targetUserId, pc);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate && user) {
        callService.addSignal(session.callId, user.uid, targetUserId, 'candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(targetUserId, event.streams[0]);
        return next;
      });
      setIsConnecting(false);
    };

    // If I am the host or have higher ID (to avoid race conditions in mesh), I'll create the offer
    // For simplicity here, let's assume host initiates
    if (user?.uid === session.hostId) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callService.addSignal(session.callId, user.uid, targetUserId, 'offer', offer);
    }
  };

  const handleIncomingSignal = async (signal: WebRTCSignaling, stream: MediaStream) => {
    let pc = peerConnections.current.get(signal.from);
    
    if (!pc) {
      pc = new RTCPeerConnection(rtcConfig);
      peerConnections.current.set(signal.from, pc);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && user) {
          callService.addSignal(session.callId, user.uid, signal.from, 'candidate', event.candidate);
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(signal.from, event.streams[0]);
          return next;
        });
        setIsConnecting(false);
      };
    }

    try {
      if (signal.type === 'offer') {
        if (pc.signalingState !== 'stable') return;
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (user) callService.addSignal(session.callId, user.uid, signal.from, 'answer', answer);
      } else if (signal.type === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      } else if (signal.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
      }
    } catch (err) {
      console.error("Signaling error:", err, "State:", pc.signalingState);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStream?.getAudioTracks().forEach(track => track.enabled = !next);
  };

  const toggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    localStream?.getVideoTracks().forEach(track => track.enabled = !next);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans text-white select-none overflow-hidden"
    >
      {/* Dynamic Grid Layout */}
      <div className={cn(
        "flex-1 p-4 grid gap-4 transition-all duration-500",
        remoteStreams.size === 0 ? "grid-cols-1" : 
        remoteStreams.size === 1 ? "grid-cols-2" : 
        "grid-cols-2 md:grid-cols-3"
      )}>
        {/* Local Video */}
        <div className="relative group rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
           <video 
             ref={localVideoRef} 
             autoPlay 
             muted 
             playsInline 
             className={cn("w-full h-full object-cover", isVideoOff && "hidden")}
           />
           {isVideoOff && (
             <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="h-20 w-20 rounded-full bg-emerald-500 flex items-center justify-center text-3xl font-bold">
                  {user?.displayName?.[0]}
                </div>
             </div>
           )}
           <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold border border-white/10 uppercase tracking-widest">
             <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
             <span>You</span>
             {isMuted && <MicOff className="h-3 w-3 text-rose-500" />}
           </div>
        </div>

        {/* Remote Videos */}
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
          <RemoteVideo key={userId} stream={stream} userId={userId} />
        ))}

        {isConnecting && remoteStreams.size === 0 && (
          <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
             <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-500/50" />
                <Phone className="h-6 w-6 absolute inset-0 m-auto text-emerald-500" />
             </div>
             <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Ringing participant...</p>
          </div>
        )}
      </div>

      {/* Floating Controls Dashboard */}
      <div className="h-24 px-8 flex items-center justify-center relative">
         <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/5 rounded-3xl px-6 py-4 flex items-center space-x-6 shadow-2xl">
            <ControlButton 
              onClick={toggleMute} 
              active={!isMuted} 
              icon={isMuted ? MicOff : Mic} 
              color={isMuted ? "text-rose-500 bg-rose-500/10" : "text-white hover:bg-white/10"} 
            />
            <ControlButton 
              onClick={toggleVideo} 
              active={!isVideoOff} 
              icon={isVideoOff ? VideoOff : Video} 
              color={isVideoOff ? "text-rose-500 bg-rose-500/10" : "text-white hover:bg-white/10"} 
            />
            
            <div className="h-8 w-[1px] bg-white/10" />
            
            <ControlButton 
              onClick={() => {}} 
              icon={Sparkles} 
              label="Enhance"
              color="text-purple-400 hover:bg-purple-400/10" 
            />
            <ControlButton 
              onClick={() => {}} 
              icon={Hand} 
              label="Raise"
              color="text-amber-400 hover:bg-amber-400/10" 
            />

            <button 
              onClick={onEnd}
              className="h-12 w-12 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20 active:scale-90 transition-all hover:rotate-12"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
         </div>

         {/* Call Stats Indicator */}
         <div className="absolute right-12 top-0 bottom-0 flex items-center space-x-6 text-zinc-500">
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Encrypted</span>
               <span className="text-[10px] font-mono">P2P Mesh v1.0</span>
            </div>
            <Settings className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
         </div>
      </div>
    </motion.div>
  );
};

const RemoteVideo: React.FC<{ stream: MediaStream, userId: string }> = ({ stream, userId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative group rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold border border-white/10 uppercase tracking-widest">
         <div className="h-2 w-2 bg-emerald-500 rounded-full" />
         <span>User {userId.slice(0, 4)}</span>
      </div>
    </div>
  );
};

const ControlButton: React.FC<{ 
  onClick: () => void, 
  icon: any, 
  active?: boolean, 
  color?: string,
  label?: string
}> = ({ onClick, icon: Icon, active, color, label }) => (
  <div className="flex flex-col items-center space-y-1">
    <button 
      onClick={onClick}
      className={cn(
        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all active:scale-95",
        color || "bg-white/5 text-white hover:bg-white/10"
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
    {label && <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>}
  </div>
);
