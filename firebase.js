// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBfCuUFAxzhxuHhPYFkH_-rhwsKB9XthCc',
  authDomain: 'hacku-8ea4e.firebaseapp.com',
  projectId: 'hacku-8ea4e',
  storageBucket: 'hacku-8ea4e.firebasestorage.app',
  messagingSenderId: '91046515339',
  appId: '1:91046515339:web:6cbbec4ef6d6e7b7287a8e',
  measurementId: 'G-K315PJD6CC',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
