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
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
      unreadCount: {},
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
      admins: [participants[participants.length - 1]], // The creator is most likely the last added in current logic
      type: 'group',
      name,
      unreadCount: {},
      createdAt: serverTimestamp(),
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a884&color=fff`,
    });

    await updateDoc(newChatRef, { chatId: newChatRef.id });
    return newChatRef.id;
  },

  async sendMessage(
    chatId: string, 
    senderId: string, 
    text: string, 
    type: 'text' | 'image' | 'video' | 'file' | 'system' = 'text', 
    mediaUrl?: string,
    replyTo?: string
  ) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const newMessage = {
      messageId: '',
      chatId,
      senderId,
      text,
      type,
      timestamp: serverTimestamp(),
      status: 'sent',
      ...(mediaUrl && { mediaUrl }),
      ...(replyTo && { replyTo })
    };

    const docRef = await addDoc(messagesRef, newMessage);
    await updateDoc(docRef, { messageId: docRef.id });

    // Update chat head and increment unread counts for others
    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = await getDocFromServer(chatRef);
    const data = chatDoc.data();
    const participants = data?.participants as string[];
    
    const unreadUpdate: any = {};
    participants.forEach(p => {
      if (p !== senderId) {
        unreadUpdate[`unreadCount.${p}`] = (data?.unreadCount?.[p] || 0) + 1;
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

  async sendMediaMessage(
    chatId: string, 
    senderId: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ) {
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<void>((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        }, 
        (error) => {
          console.error("Storage upload error:", error);
          reject(error);
        }, 
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await this.sendMessage(chatId, senderId, '', type, downloadURL);
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });
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
  },

  async addReaction(chatId: string, messageId: string, userId: string, emoji: string) {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const messageDoc = await getDocFromServer(messageRef);
    const data = messageDoc.data();
    
    let reactions: any[] = data?.reactions || [];
    // Remove existing reaction from this user if it's the same emoji (toggle off) or different (update)
    const existingIndex = reactions.findIndex(r => r.userId === userId);
    
    if (existingIndex > -1) {
      if (reactions[existingIndex].emoji === emoji) {
        reactions.splice(existingIndex, 1);
      } else {
        reactions[existingIndex] = { emoji, userId, timestamp: new Date() };
      }
    } else {
      reactions.push({ emoji, userId, timestamp: new Date() });
    }
    
    await updateDoc(messageRef, { reactions });
  },

  async togglePinMessage(chatId: string, messageId: string, isPinned: boolean) {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const chatRef = doc(db, 'chats', chatId);
    
    await updateDoc(messageRef, { isPinned });
    
    const chatDoc = await getDocFromServer(chatRef);
    const pinnedMessages: string[] = chatDoc.data()?.pinnedMessages || [];
    
    if (isPinned) {
      if (!pinnedMessages.includes(messageId)) {
        await updateDoc(chatRef, {
          pinnedMessages: [...pinnedMessages, messageId]
        });
      }
    } else {
      await updateDoc(chatRef, {
        pinnedMessages: pinnedMessages.filter(id => id !== messageId)
      });
    }
  },

  async createTaskFromMessage(userId: string, messageText: string): Promise<void> {
    const tasksRef = collection(db, 'users', userId, 'tasks');
    await addDoc(tasksRef, {
      title: messageText,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
};
