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
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isConnecting, setIsConnecting] = useState(true);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOffer = useRef<Map<string, boolean>>(new Map());
  const ignoreOffer = useRef<Map<string, boolean>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  };

  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startLocalStream();
    return () => {
      stopAllMedia();
    };
  }, []);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetControlsTimer);
    resetControlsTimer();
    return () => {
      window.removeEventListener('mousemove', resetControlsTimer);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, []);

  // Ensure local video is always attached to the ref
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoOff]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: session.type === 'video',
        audio: true
      });
      setLocalStream(stream);
      
      // Initialize calls to other participants
      session.participants.forEach(participantId => {
        if (participantId !== user?.uid) {
          createOrGetPeerConnection(participantId, stream);
          
          // If I am the host, I initiate the offer
          if (user?.uid === session.hostId) {
            initiateCall(participantId);
          }
        }
      });

      // Listen for incoming signals
      if (user) {
        const unsubSignals = callService.listenForSignals(session.callId, user.uid, (signal) => {
          handleIncomingSignal(signal, stream);
        });

        // Listen for call status changes
        const unsubStatus = onSnapshot(doc(db, 'calls', session.callId), (snapshot) => {
          const data = snapshot.data();
          if (data && (data.status === 'ended' || data.status === 'rejected')) {
            onEnd();
          }
        });

        return () => {
          unsubSignals();
          unsubStatus();
        };
      }
    } catch (err) {
      console.error("Media access error:", err);
      // Fallback to audio-only if video fails
      if (session.type === 'video') {
         try {
           const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
           setLocalStream(audioStream);
           setIsVideoOff(true);
         } catch (e) {
           alert("Could not access microphone or camera.");
         }
      }
    }
  };

  const stopAllMedia = () => {
    localStream?.getTracks().forEach(track => track.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
  };

  const createOrGetPeerConnection = (targetUserId: string, stream: MediaStream) => {
    if (peerConnections.current.has(targetUserId)) return peerConnections.current.get(targetUserId)!;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.current.set(targetUserId, pc);
    makingOffer.current.set(targetUserId, false);
    ignoreOffer.current.set(targetUserId, false);

    // Fixed order m-lines (0: audio, 1: video) to avoid SDP order failures
    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    pc.addTransceiver(audioTrack || 'audio', {
      direction: audioTrack ? 'sendrecv' : 'recvonly',
      streams: [stream]
    });

    pc.addTransceiver(videoTrack || 'video', {
      direction: videoTrack ? 'sendrecv' : 'recvonly',
      streams: [stream]
    });

    pc.onnegotiationneeded = async () => {
      try {
        console.log("Negotiation needed for:", targetUserId, "State:", pc.signalingState);
        makingOffer.current.set(targetUserId, true);
        await pc.setLocalDescription();
        
        if (user && pc.localDescription) {
          callService.addSignal(session.callId, user.uid, targetUserId, 'offer', pc.localDescription);
        }
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current.set(targetUserId, false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && user) {
        callService.addSignal(session.callId, user.uid, targetUserId, 'candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track from:", targetUserId, event.track.kind);
      // Use existing stream or create new one from track
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const existingStream = next.get(targetUserId);
        
        if (existingStream) {
          // If we already have a stream, add the new track to it
          existingStream.addTrack(event.track);
          // Force React update by creating a new stream object with same tracks
          next.set(targetUserId, new MediaStream(existingStream.getTracks()));
          return next;
        } else {
          next.set(targetUserId, incomingStream);
          return next;
        }
      });
      setIsConnecting(false);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${targetUserId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        // Handle reconnection or cleanup
      }
    };

    return pc;
  };

  const initiateCall = async (targetUserId: string) => {
    const pc = peerConnections.current.get(targetUserId);
    if (!pc) return;

    try {
      if (pc.signalingState !== 'stable') {
        console.warn("Skipping manual offer, signaling state not stable:", pc.signalingState);
        return;
      }

      makingOffer.current.set(targetUserId, true);
      await pc.setLocalDescription();
      
      if (user && pc.localDescription) {
        callService.addSignal(session.callId, user.uid, targetUserId, 'offer', pc.localDescription);
      }
    } catch (err) {
      console.error("Create offer error for", targetUserId, ":", err);
    } finally {
      makingOffer.current.set(targetUserId, false);
    }
  };

  const handleIncomingSignal = async (signal: WebRTCSignaling, stream: MediaStream) => {
    const pc = createOrGetPeerConnection(signal.from, stream);
    
    try {
      if (signal.type === 'offer') {
        const description = new RTCSessionDescription(signal.payload);
        
        // Perfect Negotiation Pattern
        const isPolite = user?.uid !== session.hostId;
        const offerCollision = makingOffer.current.get(signal.from) || pc.signalingState !== "stable";
        
        const shouldIgnore = !isPolite && offerCollision;
        ignoreOffer.current.set(signal.from, shouldIgnore);
        
        if (shouldIgnore) {
          console.log("Ignoring offer collision (isImpolite)");
          return;
        }

        if (offerCollision) {
          console.log("Rolling back due to offer collision (isPolite)");
          await pc.setLocalDescription({ type: "rollback" } as any);
        }

        await pc.setRemoteDescription(description);
        await pc.setLocalDescription(); // Answers automatically
        
        if (user && pc.localDescription) {
          callService.addSignal(session.callId, user.uid, signal.from, 'answer', pc.localDescription);
        }
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
      } else if (signal.type === 'candidate') {
        try {
          if (!ignoreOffer.current.get(signal.from)) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
          }
        } catch (e) {
          if (!ignoreOffer.current.get(signal.from)) console.error("Error adding ICE candidate:", e);
        }
      }
    } catch (err) {
      console.error("Signaling error:", err, "State:", pc.signalingState, "Type:", signal.type);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStream?.getAudioTracks().forEach(track => track.enabled = !next);
  };

  const toggleVideo = async () => {
    if (isVideoOff && localStream && localStream.getVideoTracks().length === 0) {
      // We are in an audio-only call and trying to turn on video
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);
        
        // Add to all peer connections
        peerConnections.current.forEach(pc => {
          const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video');
          if (videoTransceiver) {
            videoTransceiver.direction = 'sendrecv';
            videoTransceiver.sender.replaceTrack(videoTrack);
          }
        });
        
        setIsVideoOff(false);
        setLocalStream(new MediaStream(localStream.getTracks()));
      } catch (err) {
        console.error("Could not start video:", err);
      }
      return;
    }

    const next = !isVideoOff;
    setIsVideoOff(next);
    localStream?.getVideoTracks().forEach(track => {
      track.enabled = !next;
    });
  };

  const switchCamera = async () => {
    if (!localStream) return;
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false // Don't re-request audio
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      localStream.addTrack(newVideoTrack);
      
      // Update peer connections with the new track
      peerConnections.current.forEach(pc => {
        const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video');
        if (videoTransceiver) {
          videoTransceiver.sender.replaceTrack(newVideoTrack);
        }
      });

      // Update local stream state trigger
      setLocalStream(new MediaStream(localStream.getTracks()));
    } catch (err) {
      console.error("Failed to switch camera:", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans text-white select-none overflow-hidden cursor-none"
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Background: Remote Video(s) */}
      <div className="absolute inset-0 z-0">
        {remoteStreams.size > 0 ? (
          <div className={cn(
            "w-full h-full grid gap-1",
            remoteStreams.size === 1 ? "grid-cols-1" : "grid-cols-2"
          )}>
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
              <RemoteVideo key={userId} stream={stream} userId={userId} />
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
             <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <Loader2 className="h-20 w-20 animate-spin text-emerald-500/50" />
                <Phone className="h-10 w-10 absolute inset-0 m-auto text-emerald-500" />
             </div>
             <p className="text-sm font-black uppercase tracking-[0.3em] text-zinc-400 animate-pulse">Establishing Neural Link...</p>
          </div>
        )}
      </div>

      {/* Picture-in-Picture: Local Video */}
      <motion.div 
        drag
        dragConstraints={{ left: 20, top: 20, right: 20, bottom: 20 }}
        initial={{ x: 20, y: 20 }}
        className="absolute top-6 right-6 w-48 aspect-[3/4] md:w-64 z-20 rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl group"
      >
         <video 
           ref={localVideoRef} 
           autoPlay 
           muted 
           playsInline 
           className={cn("w-full h-full object-cover scale-x-[-1]", isVideoOff && "hidden")}
         />
         {isVideoOff && (
           <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
              <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold border-2 border-white/5">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="You" className="h-full w-full rounded-full object-cover" />
                ) : (
                  user?.displayName?.[0] || 'Y'
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                 <VideoOff className="h-8 w-8 text-white/20" />
              </div>
           </div>
         )}
         <div className="absolute bottom-3 left-3 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black border border-white/5 uppercase tracking-widest">
           <span className="text-zinc-100">YOU</span>
           {isMuted && <MicOff className="h-3 w-3 text-rose-500" />}
         </div>
         
         <button 
           onClick={switchCamera}
           className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/5 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
         >
           <LayoutGrid className="h-4 w-4" />
         </button>
      </motion.div>

      {/* Top Overlay: Info & Status */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 p-8 z-30 flex justify-between items-start pointer-events-none"
          >
            <div className="flex items-center space-x-4 pointer-events-auto">
               <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-emerald-500" />
               </div>
               <div>
                  <h2 className="text-lg font-black tracking-tight">{session.type === 'video' ? 'Video Sync' : 'Vocal Uplink'}</h2>
                  <div className="flex items-center space-x-2">
                     <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Secured Node-to-Node</span>
                  </div>
               </div>
            </div>

            <div className="flex flex-col items-end pointer-events-auto">
              <div className="flex items-center space-x-2 bg-zinc-900 border border-white/5 px-4 py-2 rounded-2xl">
                 <Users className="h-4 w-4 text-zinc-400" />
                 <span className="text-xs font-black uppercase tracking-wider">{session.participants.length}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Overlay: Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-12 z-30 flex justify-center"
          >
            <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-[40px] px-8 py-5 flex items-center space-x-8 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
               
               <ControlButton 
                 onClick={toggleMute} 
                 active={!isMuted} 
                 icon={isMuted ? MicOff : Mic} 
                 label={isMuted ? "Muted" : "Audio"}
                 color={isMuted ? "text-rose-500 bg-rose-500/10 border-rose-500/20" : "text-white bg-white/5 border-white/10"} 
               />
               
               <ControlButton 
                 onClick={toggleVideo} 
                 active={!isVideoOff} 
                 icon={isVideoOff ? VideoOff : Video} 
                 label={isVideoOff ? "Off" : "Video"}
                 color={isVideoOff ? "text-rose-500 bg-rose-500/10 border-rose-500/20" : "text-white bg-white/5 border-white/10"} 
               />

               <div className="h-10 w-[1px] bg-white/10 mx-2" />

               <ControlButton 
                 onClick={() => {}} 
                 icon={Sparkles} 
                 label="Filter"
                 color="text-purple-400 bg-purple-400/5 hover:bg-purple-400/10 border-purple-400/20" 
               />

               <ControlButton 
                 onClick={() => {}} 
                 icon={Hand} 
                 label="Action"
                 color="text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 border-amber-400/20" 
               />

               <button 
                 onClick={onEnd}
                 className="h-16 w-16 rounded-[28px] bg-rose-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 active:scale-90 transition-all hover:rotate-12 group/end"
               >
                 <PhoneOff className="h-8 w-8 group-hover:scale-110 transition-transform" />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const RemoteVideo: React.FC<{ stream: MediaStream, userId: string }> = ({ stream, userId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoActive, setIsVideoActive] = useState(true);
  const [userName, setUserName] = useState<string>(`User ${userId.slice(0, 4)}`);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUserName(userDoc.data().displayName);
          setPhotoURL(userDoc.data().photoURL);
        }
      } catch (e) {}
    };
    fetchUser();
  }, [userId]);
  
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    
    // Improved track monitoring
    const updateTracks = () => {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setIsVideoActive(videoTrack.enabled && !videoTrack.muted);
        
        const handleMute = () => setIsVideoActive(false);
        const handleUnmute = () => setIsVideoActive(true);
        
        videoTrack.addEventListener('mute', handleMute);
        videoTrack.addEventListener('unmute', handleUnmute);
        
        return () => {
          videoTrack.removeEventListener('mute', handleMute);
          videoTrack.removeEventListener('unmute', handleUnmute);
        };
      } else {
        setIsVideoActive(false);
      }
    };
    
    return updateTracks();
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={cn(
          "w-full h-full object-cover transition-all duration-1000",
          !isVideoActive ? "opacity-0 scale-110 blur-2xl" : "opacity-100 scale-100 blur-0"
        )}
      />
      
      {!isVideoActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-3xl transition-opacity duration-1000">
           <div className="relative group">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
              <div className={cn(
                "relative h-32 w-32 md:h-48 md:w-48 rounded-full flex items-center justify-center text-5xl font-black border-4 border-white/10 shadow-2xl overflow-hidden",
                photoURL ? "" : "bg-zinc-800 text-emerald-500"
              )}>
                {photoURL ? (
                  <img src={photoURL} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  userName[0]
                )}
              </div>
              <div className="mt-6 text-center">
                 <p className="text-xl font-black tracking-tight text-white mb-1">{userName}</p>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Video Feed Terminated</p>
              </div>
           </div>
        </div>
      )}

      {/* Subtle identity tag on remote video */}
      <div className="absolute bottom-12 left-12 z-10 flex items-center space-x-3 bg-black/20 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/5 opacity-40 hover:opacity-100 transition-opacity">
         <div className="h-2 w-2 rounded-full bg-emerald-500" />
         <span className="text-xs font-black uppercase tracking-widest text-white/80">{userName}</span>
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
