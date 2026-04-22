/**
 * utils.js — Funciones utilitarias generales.
 */

/**
 * Normaliza un nombre para comparación: minúsculas, sin tildes, sin espacios extra.
 */
export function normalizeName(str) {
  return String(str ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Parsea un entero no negativo; devuelve 0 si el valor no es válido.
 */
export function parseNonNegativeInt(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Valida formato básico de correo electrónico.
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());
}

/**
 * Resuelve el objetivo para asignar un capitán.
 * Acepta UID directo o email+nombre y devuelve { uid, email, displayName }
 * o { error } si los datos son insuficientes.
 */
export function resolveCaptainAssignTarget(uidRaw, emailRaw, displayNameRaw) {
  const uid         = uidRaw.trim();
  const email       = emailRaw.trim().toLowerCase();
  const displayName = displayNameRaw.trim();

  if (uid) return { uid, email, displayName };

  if (!email) {
    return { error: 'Debes ingresar el UID o el correo del capitán.' };
  }

  // Generar UID determinista a partir del email si no se proveyó
  const generatedUid = `email-${email.replace(/[^a-z0-9]/g, '-')}`;
  return { uid: generatedUid, email, displayName };
}
