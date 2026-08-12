import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firebase Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Executes official Firebase Authentication 'Sign in with Google' popup flow.
 * Authenticates user via Firebase popup, syncs with backend database, and persists customer to 'ps_logged_in_customer'.
 */
export async function signInWithGoogleFirebase() {
  try {
    // 1. Trigger official Firebase popup for account selection
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (!user || !user.email) {
      throw new Error('Google Authentication failed: No email returned from Google.');
    }

    const emailTrim = user.email.toLowerCase().trim();
    const displayName = user.displayName || emailTrim.split('@')[0];
    const photoURL = user.photoURL || undefined;

    // 2. Sync / create customer record in backend database
    const response = await fetch('/api/customers/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailTrim,
        name: displayName,
        googleId: user.uid,
        picture: photoURL
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Server error during Google authentication.');
    }

    const customer = data.customer;

    // 3. Persist authenticated user state strictly to 'ps_logged_in_customer' storage key
    if (customer) {
      localStorage.setItem('ps_logged_in_customer', JSON.stringify(customer));
    }

    return {
      user,
      customer
    };
  } catch (err: any) {
    console.error('[Firebase Google Auth Error]', err);
    throw err;
  }
}

export { signInWithPopup, signOut };
