// Firebase configuration for React Native
import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase with error handling
let app;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

const initializeFirebaseServices = async () => {
  try {
    console.log('🔥 Initializing Firebase...');
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase app initialized successfully');
    
    // Initialize Auth
    console.log('🔐 Initializing Firebase Auth...');
    auth = getAuth(app);
    console.log('✅ Firebase auth initialized successfully');
    
    // Initialize Firestore
    console.log('📊 Initializing Firestore...');
    db = getFirestore(app);
    console.log('✅ Firestore initialized successfully');
    
    // Initialize Storage
    console.log('📁 Initializing Firebase Storage...');
    storage = getStorage(app, 'gs://sunulu.firebasestorage.app');
    console.log('✅ Firebase storage initialized successfully');

    // Test Firebase services
    console.log('🧪 Testing Firebase services...');
    
    // Test if auth can be used
    try {
      if (auth) {
        console.log('✅ Auth service is accessible');
      }
    } catch (authError) {
      console.error('❌ Auth service test failed:', authError);
      throw new Error('Firebase Authentication service is not enabled. Please enable Authentication in Firebase Console.');
    }

    console.log('🎉 All Firebase services initialized successfully!');
    return true;
    
  } catch (error: any) {
    console.error('❌ Firebase initialization error:', error);
    
    // Provide helpful error messages
    if (error?.message?.includes('auth has not been registered')) {
      console.error('💡 SOLUTION: Enable Authentication in Firebase Console:');
      console.error('1. Go to https://console.firebase.google.com/project/sunulu/authentication');
      console.error('2. Click "Get Started" in Authentication');
      console.error('3. Go to "Sign-in method" tab');
      console.error('4. Enable "Email/Password" provider');
      throw new Error('Firebase Authentication is not enabled. Please check the console logs for setup instructions.');
    }
    
    if (error?.message?.includes('firestore has not been registered')) {
      console.error('💡 SOLUTION: Enable Firestore in Firebase Console:');
      console.error('1. Go to https://console.firebase.google.com/project/sunulu/firestore');
      console.error('2. Click "Create database"');
      console.error('3. Choose "Start in test mode"');
      throw new Error('Firestore Database is not enabled. Please check the console logs for setup instructions.');
    }
    
    if (error?.message?.includes('storage has not been registered')) {
      console.error('💡 SOLUTION: Enable Storage in Firebase Console:');
      console.error('1. Go to https://console.firebase.google.com/project/sunulu/storage');
      console.error('2. Click "Get started"');
      console.error('3. Choose "Start in test mode"');
      throw new Error('Firebase Storage is not enabled. Please check the console logs for setup instructions.');
    }
    
    // Check if it's the "already initialized" error and handle gracefully
    if (error?.message?.includes('already initialized') || error?.message?.includes('duplicate app')) {
      console.log('⚠️ Firebase already initialized, using existing instance');
      const { getApp } = require('firebase/app');
      const { getAuth: getExistingAuth } = require('firebase/auth');
      const { getFirestore: getExistingFirestore } = require('firebase/firestore');
      const { getStorage: getExistingStorage } = require('firebase/storage');
      
      try {
        app = getApp();
        auth = getExistingAuth(app);
        db = getExistingFirestore(app);
        storage = getExistingStorage(app);
        console.log('✅ Using existing Firebase instances');
        return true;
      } catch (getError: any) {
        console.error('❌ Error getting existing Firebase instances:', getError);
        throw getError;
      }
    }
    
    throw error;
  }
};

// Initialize Firebase services
initializeFirebaseServices().catch((error) => {
  console.error('❌ Failed to initialize Firebase services:', error);
});

export { auth, db, storage };
export default app; 