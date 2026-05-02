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

export interface Chat {
  chatId: string;
  participants: string[];
  type: 'one-to-one' | 'group';
  name?: string;
  photoURL?: string;
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
  type: 'text' | 'image' | 'video' | 'file';
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
}

export interface TypingStatus {
  userId: string;
  isTyping: boolean;
  updatedAt: any;
}
