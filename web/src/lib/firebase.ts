import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from 'firebase/auth';

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
export { onAuthStateChanged };
export const googleProvider = new GoogleAuthProvider();

// Custom parameters to ensure clean Google OAuth account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export async function checkRedirectAuth() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
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
    }
  } catch (err) {
    console.warn('Redirect auth result check:', err);
  }

  if (auth.currentUser) {
    const user = auth.currentUser;
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
  }

  return null;
}

export async function signInWithGoogle(forceRedirect = false) {
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  if (forceRedirect || isEmbedded) {
    try {
      await signInWithRedirect(auth, googleProvider);
      return { success: false, redirecting: true, error: '' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Redirect auth failed' };
    }
  }

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
    console.warn('signInWithPopup error/blocked, attempting redirect fallback:', error?.code || error);
    try {
      await signInWithRedirect(auth, googleProvider);
      return { success: false, redirecting: true, error: '' };
    } catch (redirectErr: any) {
      console.error('Redirect auth error:', redirectErr);
      return {
        success: false,
        error: redirectErr?.message || 'Google sign-in failed'
      };
    }
  }
}

export default app;
