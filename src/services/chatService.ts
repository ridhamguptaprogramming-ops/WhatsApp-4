import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc, 
  updateDoc,
  getDocs,
  getDocFromServer,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Chat, Message, User } from '../types';

export const chatService = {
  // ... existing methods ...
  async getOrCreateChat(userA: string, userB: string): Promise<string> {
    const participants = [userA, userB].sort();
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef, 
      where('participants', '==', participants),
      where('type', '==', 'one-to-one'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // Create new chat
    const newChatRef = await addDoc(chatsRef, {
      chatId: '', // placeholder
      participants,
      type: 'one-to-one',
      createdAt: serverTimestamp(),
    });
    
    await updateDoc(newChatRef, { chatId: newChatRef.id });
    return newChatRef.id;
  },

  async createGroup(name: string, participants: string[]): Promise<string> {
    const chatsRef = collection(db, 'chats');
    const newChatRef = await addDoc(chatsRef, {
      chatId: '',
      participants,
      type: 'group',
      name,
      createdAt: serverTimestamp(),
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a884&color=fff`,
    });

    await updateDoc(newChatRef, { chatId: newChatRef.id });
    return newChatRef.id;
  },

  async sendMessage(chatId: string, senderId: string, text: string, type: 'text' | 'image' | 'video' | 'file' = 'text', mediaUrl?: string) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const newMessage = {
      messageId: '',
      chatId,
      senderId,
      text,
      type,
      timestamp: serverTimestamp(),
      status: 'sent',
      ...(mediaUrl && { mediaUrl })
    };

    const docRef = await addDoc(messagesRef, newMessage);
    await updateDoc(docRef, { messageId: docRef.id });

    // Update chat head and increment unread counts for others
    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = await getDocFromServer(chatRef);
    const participants = chatDoc.data()?.participants as string[];
    
    const unreadUpdate: any = {};
    participants.forEach(p => {
      if (p !== senderId) {
        unreadUpdate[`unreadCount.${p}`] = (chatDoc.data()?.unreadCount?.[p] || 0) + 1;
      }
    });

    const lastMessageText = type === 'text' ? text : `[${type.charAt(0).toUpperCase() + type.slice(1)}]`;

    await updateDoc(chatRef, {
      ...unreadUpdate,
      lastMessage: {
        text: lastMessageText,
        senderId,
        timestamp: serverTimestamp(),
        status: 'sent'
      }
    });
  },

  async sendMediaMessage(chatId: string, senderId: string, file: File) {
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
    
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    await this.sendMessage(chatId, senderId, '', type, downloadURL);
  },

  async resetUnreadCount(chatId: string, userId: string) {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCount.${userId}`]: 0
    });
  },

  async setTyping(chatId: string, userId: string, isTyping: boolean) {
    const typingRef = doc(db, 'chats', chatId, 'typing', userId);
    await setDoc(typingRef, {
      isTyping,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async markAsRead(chatId: string, messageId: string, isLastMessage: boolean) {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, { status: 'read' });

    if (isLastMessage) {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        'lastMessage.status': 'read'
      });
    }
  }
};
