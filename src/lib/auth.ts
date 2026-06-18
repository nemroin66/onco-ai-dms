import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import firebaseConfig from './firebaseConfig';

const isConfigValid = () => {
  const { apiKey, authDomain, projectId, appId } = firebaseConfig;
  return Boolean(apiKey && authDomain && projectId && appId);
};

const assertConfig = () => {
  if (!isConfigValid()) {
    throw new Error('Firebase configuration is missing or incomplete. Check VITE_FIREBASE_* env variables.');
  }
};

let isSigningIn = false;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  assertConfig();

  if (import.meta.env.DEV) {
    console.debug('Firebase auth initialized with project:', firebaseConfig.projectId, 'authDomain:', firebaseConfig.authDomain);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await user.getIdToken();
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  assertConfig();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential) {
      throw new Error('Google credential missing after sign-in.');
    }

    return { user: result.user, accessToken: await result.user.getIdToken() };
  } catch (error: any) {
    const firebaseCredential = GoogleAuthProvider.credentialFromError(error);
    console.error('Google sign-in error:', {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      customData: error?.customData,
      email: error?.email,
      credential: firebaseCredential,
      stack: error?.stack,
    });
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignIn = async (email: string, password: string): Promise<User> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const getAccessToken = async (): Promise<string | null> => {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
};

export const logout = async () => {
  await auth.signOut();
};

export type FirebaseUserProfile = {
  name?: string;
  role?: "admin" | "user";
  email?: string;
};

export const getFirebaseUserProfile = async (uid: string): Promise<FirebaseUserProfile | null> => {
  try {
    const profileDoc = await getDoc(doc(db, 'users', uid));
    if (!profileDoc.exists()) return null;
    return profileDoc.data() as FirebaseUserProfile;
  } catch (err) {
    console.error('Error loading user profile from Firestore:', err);
    return null;
  }
};
