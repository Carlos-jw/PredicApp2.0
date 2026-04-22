/**
 * firebase-config.js — Configuración de Firebase.
 * Soporta dos fuentes:
 * 1) Runtime: window.__FIREBASE_CONFIG__ (recomendado para hosting estático)
 * 2) Build-time: import.meta.env.VITE_FIREBASE_* (si usas bundler)
 */
 
function readBuildEnv() {
  try {
    return import.meta?.env ?? {};
  } catch {
    return {};
  }
}
 
function readRuntimeConfig() {
  if (typeof window === 'undefined') return {};
  const cfg = window.__FIREBASE_CONFIG__;
  return cfg && typeof cfg === 'object' ? cfg : {};
}
 
const runtime = readRuntimeConfig();
const env = readBuildEnv();
 
export const firebaseConfig = {
  apiKey:            runtime.apiKey            ?? env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        runtime.authDomain        ?? env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         runtime.projectId         ?? env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     runtime.storageBucket     ?? env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: runtime.messagingSenderId ?? env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             runtime.appId             ?? env.VITE_FIREBASE_APP_ID              ?? ''
};
 
const REQUIRED_FIELDS = ['apiKey', 'authDomain', 'projectId', 'appId'];
 
export function assertFirebaseConfig() {
  const missing = REQUIRED_FIELDS.filter((field) => !String(firebaseConfig[field] ?? '').trim());
  if (!missing.length) return;
 
  throw new Error(
    `Firebase config incompleta: faltan ${missing.join(', ')}. ` +
    'Define window.__FIREBASE_CONFIG__ en index.html o usa VITE_FIREBASE_* con bundler.'
  );
}
