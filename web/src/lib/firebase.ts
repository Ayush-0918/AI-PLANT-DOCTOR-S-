import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCC_Vp5W4RY8HXio39fHXBtul9i86ulSps",
  authDomain: "plant-doctors.firebaseapp.com",
  projectId: "plant-doctors",
  storageBucket: "plant-doctors.firebasestorage.app",
  messagingSenderId: "786095852488",
  appId: "1:786095852488:web:efd33718dea854a4fa4efd",
  measurementId: "G-001FK862HH"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        name: user.displayName || 'Farmer',
        email: user.email || '',
        phone: user.phoneNumber || '',
        uid: user.uid,
        photoURL: user.photoURL || '',
      }
    };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      console.warn('Google Sign-In popup closed by user.');
      return {
        success: false,
        closedByUser: true,
        error: ''
      };
    }
    console.error('Firebase Google Auth error:', error);
    return {
      success: false,
      error: error.message || 'Google sign-in failed'
    };
  }
}

export default app;
