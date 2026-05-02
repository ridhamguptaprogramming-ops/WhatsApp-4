import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, onSnapshot, arrayUnion } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { auth, db, messaging } from '../lib/firebase';
import { User } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        // Setup presence and update profile
        const userData: Partial<User> = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Anonymous',
          photoURL: fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName}`,
          email: fbUser.email || '',
          lastSeen: serverTimestamp(),
          isOnline: true,
        };

        await setDoc(userDocRef, userData, { merge: true });

        // Subscribe to actual user doc for real-time updates
        const unsubUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as User);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
        });

        // Request FCM Token
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging, {
              vapidKey: 'BPaY8lZp0_jPq3u7M-wzS4Tz-K4ZqZ6Q1nF8YJ4J-oA' // Note: This is an example, real VAPID key comes from Firebase Console
            });
            if (token) {
              await setDoc(userDocRef, { fcmTokens: arrayUnion(token) }, { merge: true });
            }
          }
        } catch (err) {
          console.error('Error getting FCM token:', err);
        }

        // Handle foreground notifications
        const unsubMessage = onMessage(messaging, (payload) => {
          console.log('Message received in foreground: ', payload);
          // show a custom UI toast if needed
        });

        return () => {
          unsubUser();
          unsubMessage();
        };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Presence logic: update offline on window close or unmount
  useEffect(() => {
    if (!user?.uid) return;

    const updatePresence = async (status: boolean) => {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { 
        isOnline: status,
        lastSeen: serverTimestamp()
      }, { merge: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => updatePresence(false));

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', () => updatePresence(false));
      updatePresence(false);
    };
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
