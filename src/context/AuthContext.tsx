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
          const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY?.trim();
          // Basics validation: VAPID keys are usually long 64+ char base64 strings
          // If it sounds like a placeholder or is missing, skip silently to avoid console spam
          if (vapidKey && vapidKey.length > 30 && !vapidKey.includes('YOUR_')) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              try {
                const token = await getToken(messaging, { vapidKey });
                if (token) {
                  await setDoc(userDocRef, { fcmTokens: arrayUnion(token) }, { merge: true });
                }
              } catch (getTokenError: any) {
                // Catch the common 'atob' error caused by malformed VAPID keys
                if (getTokenError.message?.includes('atob') || getTokenError.code === 'messaging/invalid-vapid-key') {
                  console.info('Push notifications disabled: VITE_FCM_VAPID_KEY is not a valid Base64 string.');
                } else {
                  console.warn('FCM Token generation failed:', getTokenError.message);
                }
              }
            }
          }
        } catch (err) {
          // General suppression for environment-related FCM failures in preview
          console.debug('FCM setup skipped or failed:', err);
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
