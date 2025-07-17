import { Auth, User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';

import React, { createContext, useContext, useEffect, useState } from 'react';
// @ts-ignore - Firebase config exports
import { auth, db } from '../config/firebase';

// Type assertions for Firebase imports
// @ts-ignore - Firebase imports are properly typed but TypeScript doesn't recognize them
const typedAuth = auth as Auth;
// @ts-ignore - Firebase imports are properly typed but TypeScript doesn't recognize them
const typedDb = db as Firestore;

interface UserProfile {
  username?: string;
  pushToken?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  username: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Load user profile from Firestore
  const loadUserProfile = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(typedDb, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        setUsername(userData.username || null);
      } else {
        // Create user document if it doesn't exist
        await setDoc(doc(typedDb, 'users', userId), {
          username: null,
        });
        setUsername(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUsername(null);
    }
  };

  const updateUsername = async (newUsername: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Update in Firestore
      await setDoc(doc(typedDb, 'users', user.uid), {
        username: newUsername,
      }, { merge: true });

      // Update local state
      setUsername(newUsername);
    } catch (error) {
      console.error('Error updating username:', error);
      throw new Error('Failed to update username');
    }
  };

  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    
    if (!typedAuth) {
      console.error('AuthProvider: auth is undefined!');
      setError('Firebase services are not properly initialized. Please check Firebase Console setup.');
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(typedAuth, async (user) => {
        console.log('AuthProvider: Auth state changed', user ? 'User logged in' : 'User logged out');
        setUser(user);
        
        if (user) {
          // Load user profile when user logs in
          await loadUserProfile(user.uid);
        } else {
          // Clear username when user logs out
          setUsername(null);
        }
        
        setLoading(false);
        setError(null); // Clear any previous errors on successful auth state change
      }, (authError) => {
        console.error('AuthProvider: Auth state change error:', authError);
        
        // Handle Firebase service registration errors
        if (authError.message?.includes('auth has not been registered')) {
          setError('Firebase Authentication is not enabled. Please enable Authentication in Firebase Console and reload the app.');
        } else {
          setError('Authentication service error. Please try again.');
        }
        setLoading(false);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('AuthProvider: Auth initialization error:', error);
      
      if (error.message?.includes('auth has not been registered')) {
        setError('Firebase Authentication is not enabled. Please enable Authentication in Firebase Console and reload the app.');
      } else {
        setError('Failed to initialize authentication. Please check your Firebase configuration.');
      }
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('AuthProvider: Attempting sign in for', email);
    clearError();
    
    if (!typedAuth) {
      const errorMsg = 'Firebase Authentication is not initialized. Please check Firebase Console setup.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const result = await signInWithEmailAndPassword(typedAuth, email, password);
      console.log('AuthProvider: Sign in successful', result.user.email);
    } catch (error: any) {
      console.error('AuthProvider: Sign in error:', error);
      
      // Handle Firebase service errors first
      if (error.code === 'auth/component-not-registered' || error.message?.includes('auth has not been registered')) {
        const errorMsg = 'Firebase Authentication is not enabled. Please enable Authentication in Firebase Console.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Authentication failed';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('AuthProvider: Attempting sign up for', email);
    clearError();
    
    if (!typedAuth) {
      const errorMsg = 'Firebase Authentication is not initialized. Please check Firebase Console setup.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const result = await createUserWithEmailAndPassword(typedAuth, email, password);
      console.log('AuthProvider: Sign up successful', result.user.email);
    } catch (error: any) {
      console.error('AuthProvider: Sign up error:', error);
      
      // Handle Firebase service errors first
      if (error.code === 'auth/component-not-registered' || error.message?.includes('auth has not been registered')) {
        const errorMsg = 'Firebase Authentication is not enabled. Please enable Authentication in Firebase Console.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password must be at least 6 characters long.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    console.log('AuthProvider: Attempting logout');
    clearError();
    
    if (!typedAuth) {
      const errorMsg = 'Firebase Authentication is not initialized.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      await signOut(typedAuth);
      console.log('AuthProvider: Logout successful');
    } catch (error: any) {
      console.error('AuthProvider: Logout error:', error);
      const errorMsg = 'Logout failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const value = {
    user,
    loading,
    error,
    username,
    signIn,
    signUp,
    logout,
    updateUsername,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 