import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  getDocs,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface WhiteboardStroke {
  strokeId: string;
  chatId: string;
  senderId: string;
  points: number[]; // [x1, y1, z1, x2, y2, z2, ...]
  color: string;
  width: number;
  timestamp: any;
}

export const whiteboardService = {
  async addStroke(chatId: string, senderId: string, points: number[], color: string, width: number) {
    const strokesRef = collection(db, 'chats', chatId, 'whiteboard_strokes');
    const newStroke = {
      strokeId: '',
      chatId,
      senderId,
      points,
      color,
      width,
      timestamp: serverTimestamp()
    };

    const docRef = await addDoc(strokesRef, newStroke);
    return docRef.id;
  },

  subscribeToStrokes(chatId: string, callback: (strokes: WhiteboardStroke[]) => void) {
    const strokesRef = collection(db, 'chats', chatId, 'whiteboard_strokes');
    const q = query(strokesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const strokes = snapshot.docs.map(doc => ({
        ...doc.data(),
        strokeId: doc.id
      })) as WhiteboardStroke[];
      callback(strokes);
    });
  },

  async clearWhiteboard(chatId: string) {
    const strokesRef = collection(db, 'chats', chatId, 'whiteboard_strokes');
    const snapshot = await getDocs(strokesRef);
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'chats', chatId, 'whiteboard_strokes', d.id)));
    await Promise.all(deletePromises);
  }
};
