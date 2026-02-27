import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBCbsODmwMwt7CKerwMi3JCklNxVY-SdGs",
  authDomain: "absen-app-ver2.firebaseapp.com",
  projectId: "absen-app-ver2",
  storageBucket: "absen-app-ver2.firebasestorage.app",
  messagingSenderId: "857233457394",
  appId: "1:857233457394:web:a96ba4f666aff6d84ed06b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;