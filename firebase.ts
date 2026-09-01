// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- 1. Agregamos esta herramienta
import { getAuth } from "firebase/auth"; // <-- 1. IMPORTAMOS EL MOTOR DE SEGURIDAD
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjbXMoPIBu6ucGop8lWOdzh3eMfH2zkLc",
  authDomain: "omnitech-solutions.firebaseapp.com",
  projectId: "omnitech-solutions",
  storageBucket: "omnitech-solutions.firebasestorage.app",
  messagingSenderId: "842747854928",
  appId: "1:842747854928:web:18f37410b2cf0ed3e0d155"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // <-- Esa palabra "export" es la que soluciona el error
export const auth = getAuth(app); // <-- 2. EXPORTAMOS LA LLAVE MAESTRA AL SISTEMA