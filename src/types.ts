export interface User {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  lastSeen: any;
  isOnline: boolean;
  statusMessage?: string;
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
  type: 'text' | 'image' | 'video' | 'file' | 'system';
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  replyTo?: string; // ID of the message being replied to
  reactions?: Reaction[];
  isPinned?: boolean;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
  updatedAt: any;
}
