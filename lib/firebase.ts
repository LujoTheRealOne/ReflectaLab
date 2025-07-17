// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQXH2oz7CfCUcFabyU-nNupCL-T7AYzBM",
  authDomain: "reflecta-labs-v2.firebaseapp.com",
  projectId: "reflecta-labs-v2",
  storageBucket: "reflecta-labs-v2.firebasestorage.app",
  messagingSenderId: "733781858573",
  appId: "1:733781858573:web:e9531b0c4de9434070f844"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };