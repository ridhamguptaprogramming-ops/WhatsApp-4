import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CallSession, CallType, CallStatus, WebRTCSignaling } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

class CallService {
  private collectionName = 'calls';

  async createCall(hostId: string, participants: string[], type: CallType, isGroup: boolean = false, chatId?: string): Promise<string> {
    try {
      const docRef = doc(collection(db, this.collectionName));
      const callId = docRef.id;
      const callData: CallSession = {
        callId,
        hostId,
        participants,
        type,
        status: 'ringing',
        startTime: serverTimestamp(),
        isGroup,
        chatId
      };
      await setDoc(docRef, callData);
      return callId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, this.collectionName);
      return '';
    }
  }

  async updateCallStatus(callId: string, status: CallStatus) {
    try {
      const updateData: any = { status };
      if (status === 'ended') {
        updateData.endTime = serverTimestamp();
      }
      await updateDoc(doc(db, this.collectionName, callId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${this.collectionName}/${callId}`);
    }
  }

  async addSignal(callId: string, from: string, to: string, type: 'offer' | 'answer' | 'candidate', payload: any) {
    try {
      await addDoc(collection(db, this.collectionName, callId, 'signaling'), {
        from,
        to,
        type,
        payload: JSON.stringify(payload),
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${this.collectionName}/${callId}/signaling`);
    }
  }

  listenForSignals(callId: string, userId: string, onSignal: (signal: WebRTCSignaling) => void) {
    const q = query(
      collection(db, this.collectionName, callId, 'signaling'),
      where('to', '==', userId),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          onSignal({
            ...data,
            payload: JSON.parse(data.payload)
          } as WebRTCSignaling);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${this.collectionName}/${callId}/signaling`);
    });
  }

  listenForIncomingCalls(userId: string, onCall: (call: CallSession) => void) {
    const q = query(
      collection(db, this.collectionName),
      where('participants', 'array-contains', userId),
      where('status', '==', 'ringing'),
      orderBy('startTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          onCall(change.doc.data() as CallSession);
        }
      });
    }, (error) => {
      // Quiet fail to avoid intrusive errors on boot
      console.error("Listening for calls failed:", error);
    });
  }

  async getCallHistory(userId: string): Promise<CallSession[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('participants', 'array-contains', userId),
        orderBy('startTime', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as CallSession);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, this.collectionName);
      return [];
    }
  }

  async saveCallSummary(callId: string, summary: string) {
    try {
      await updateDoc(doc(db, this.collectionName, callId), { summary });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `${this.collectionName}/${callId}`);
    }
  }
}

export const callService = new CallService();
