export interface User {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  lastSeen: any;
  isOnline: boolean;
  username?: string;
  bio?: string;
  bannerURL?: string;
  statusMessage?: string;
  statusEmoji?: string;
  availability?: 'online' | 'busy' | 'away' | 'offline';
  socialLinks?: {
    github?: string;
    twitter?: string;
    website?: string;
  };
  interests?: string[];
  privacySettings?: {
    showPhoto: 'everyone' | 'contacts' | 'nobody';
    showLastSeen: boolean;
    allowDirectMessages: boolean;
  };
  fcmTokens?: string[];
}

export interface Reaction {
  emoji: string;
  userId: string;
  timestamp: any;
}

export interface Chat {
  chatId: string;
  participants: string[];
  type: 'one-to-one' | 'group';
  name?: string;
  photoURL?: string;
  admins?: string[]; // List of admin user IDs
  pinnedMessages?: string[]; // List of messsage IDs
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
    status?: 'sent' | 'delivered' | 'read';
  };
  unreadCount?: { [userId: string]: number };
  createdAt: any;
}

export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'file' | 'system' | 'audio';
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  replyTo?: string; // ID of the message being replied to
  reactions?: Reaction[];
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  audioDuration?: number;
  metadata?: {
    linkPreview?: {
      title: string;
      description: string;
      image: string;
      url: string;
    };
    fileSize?: number;
    fileName?: string;
  };
}

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';
export type CallType = 'audio' | 'video';

export interface CallSession {
  callId: string;
  hostId: string;
  participants: string[];
  type: CallType;
  status: CallStatus;
  startTime: any;
  endTime?: any;
  duration?: number; // In seconds
  isGroup: boolean;
  chatId?: string;
  summary?: string;
}

export interface WebRTCSignaling {
  type: 'offer' | 'answer' | 'candidate';
  from: string;
  to: string;
  payload: any;
  timestamp: any;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
  updatedAt: any;
}
