import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { auth, googleProvider, microsoftProvider } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Linking is NOT logging in. signInWithPopup creates a Firebase session for
  // the Google account, which for a phone user would make the app think it just
  // switched accounts. So take the token, then drop the Firebase session
  // immediately — the phone session lives in an httpOnly cookie and is
  // untouched by this.
  const getGoogleIdTokenForLink = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    await signOut(auth);
    return idToken;
  };

  // Re-authentication, NOT linking. Returns a token whose auth_time is now, and
  // deliberately does NOT sign out — the caller still needs the Firebase session
  // to delete the Firebase user afterwards.
  const reauthenticateGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return await result.user.getIdToken(true);
  };

  const loginWithMicrosoft = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, microsoftProvider);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithEmail = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const signUpWithEmail = async (email, password) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const resetPassword = async (email) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteAccount = async () => {
    try {
      setError(null);
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    loginWithGoogle,
    getGoogleIdTokenForLink,
    reauthenticateGoogle,
    loginWithMicrosoft,
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
    logout,
    deleteAccount
  };
}
