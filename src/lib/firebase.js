import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
// Always ask WHICH Google account. Without this Firebase silently reuses the
// browser's existing session, so someone with several Gmail addresses cannot
// choose — and linking picks whichever they last used, which is how a link
// attempt hit the "belongs to another account" refusal by accident.
googleProvider.setCustomParameters({ prompt: "select_account" });
export const microsoftProvider = new OAuthProvider("microsoft.com");

export default app;
