import React, { createContext, useContext, useState, useEffect } from 'react';
import { requestFcmToken } from '../firebase';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    if (!userData || !userData.role) {
      console.error('Invalid user data provided');
      return;
    }
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    // Best-effort: register FCM token for this user
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          try {
            const msid = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
            if (!msid) throw new Error('Missing VITE_FIREBASE_MESSAGING_SENDER_ID');
            const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js`);
            // Initialize SW with messagingSenderId
            if (reg && reg.active) {
              reg.active.postMessage({ type: 'init-messaging', msid });
            } else if (reg && reg.waiting) {
              reg.waiting.postMessage({ type: 'init-messaging', msid });
            } else if (reg && reg.installing) {
              // give it a brief moment to activate
              await new Promise(r => setTimeout(r, 300));
              if (reg.active) reg.active.postMessage({ type: 'init-messaging', msid });
            }
            // Ask permission before getToken to avoid permission-blocked
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') throw new Error('Notification permission not granted');
            const token = await requestFcmToken(reg);
            if (token && userData?._id) {
              await authAPI.registerFcmToken({ userId: userData._id, fcmToken: token });
            }
            return;
          } catch (e) {
            console.warn('Service worker registration failed:', e);
          }
        }
        // Fallback: ask permission and get token without explicit SW reg
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Notification permission not granted');
        const token = await requestFcmToken();
        if (token && userData?._id) {
          await authAPI.registerFcmToken({ userId: userData._id, fcmToken: token });
        }
      } catch (e) {
        console.warn('FCM registration skipped/failed:', e);
      }
    })();
  };

  const isAdmin = () => {
    return user && user.role === 'admin';
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
