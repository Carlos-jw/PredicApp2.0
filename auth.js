/**
 * auth.js — Capa de autenticación Firebase.
 * Exporta helpers para sign-in (email/Google), logout y observación de sesión.
 */
 
import { firebaseConfig, assertFirebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
 
// Inicializa Firebase una sola vez
assertFirebaseConfig();
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseApp = app;
export const auth = getAuth(app);
 
// Persistencia local (sobrevive a recargas y cierres de pestaña)
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn('No se pudo establecer persistencia de sesión:', err)
);
 
/**
 * Suscribe un callback al estado de autenticación.
 * @param {function(import('firebase/auth').User|null): void} callback
 * @returns {function} Función para cancelar la suscripción.
 */
export function observeSession(callback) {
  return onAuthStateChanged(auth, callback);
}
 
/**
 * Inicia sesión con correo y contraseña.
 * @throws {FirebaseError}
 */
export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
 
/**
 * Inicia sesión con Google (popup).
 * @throws {FirebaseError}
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}
 
/**
 * Cierra la sesión actual.
 */
export async function logout() {
  return signOut(auth);
}
