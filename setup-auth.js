/**
 * setup-auth.js — Flujo completo de autenticación.
 * Conecta observeSession con el estado de la app y cablea todos los botones de auth.
 */
 
import { observeSession, logout, signIn, signInWithGoogle } from './auth.js';
import { DB, auth } from './db.js';   // ← import consolidado (antes era doble)
import { isAdmin } from './permissions.js';
import { render } from './render-queue.js';
import { state } from './state.js';
import { openModal, closeAllModals } from './modals.js';
import { activateAppView } from './navigation.js';
import { toast } from './toast.js';
import {
  unsubProfile, setUnsubProfile,
  unsubPoints,  setUnsubPoints,
  unsubUsers,   setUnsubUsers,
  unsubParticipantsDirectory, setUnsubParticipantsDirectory,
  unsubPointData, setUnsubPointData,
  unsubPendingUsers, setUnsubPendingUsers,
  startDataSync
} from './data-sync.js';
import { refreshEnrollPointOptions } from './enroll-form.js';
 
export function setupAuth() {
  observeSession(async (user) => {
    state.authUser = user;
 
    unsubProfile?.();
    setUnsubProfile(null);
 
    if (!user) {
      unsubPoints?.();   setUnsubPoints(null);
      unsubUsers?.();    setUnsubUsers(null);
      unsubParticipantsDirectory?.(); setUnsubParticipantsDirectory(null);
      unsubPointData?.(); setUnsubPointData(null);
      unsubPendingUsers?.(); setUnsubPendingUsers(null);
 
      state.profile                        = null;
      state.points                         = [];
      state.visiblePoints                  = [];
      state.selectedPointId                = '';
      state.participants                   = [];
      state.participantsDirectory          = [];
      state.selectedDirectoryParticipantId = '';
      state.participantQuery               = '';
      state.pendingReserveParticipantName  = '';
      state.canCancelOwnReservation        = false;
      state.slots                          = {};
      state.reports                        = [];
      state.users                          = [];
      state.pendingUsersCaptain            = [];
 
      refreshEnrollPointOptions({ silentToast: true }).catch(() => {});
      activateAppView('home');
      render();
      return;
    }
 
    try {
      await DB.ensureUserProfile(user);
    } catch (error) {
      console.error(error);
      toast('No se pudo preparar tu perfil en Firestore. Revisa reglas y conexión.', 'error');
      render();
      return;
    }
 
    setUnsubProfile(DB.subscribeUserProfile(
      user.uid,
      (profile) => {
        state.profile = profile;
        if (!profile) { render(); return; }
 
        void (async () => {
          try {
            await auth.currentUser?.getIdToken(true);
            const inviteClaim = await DB.claimCaptainInvite(user);
            if (inviteClaim?.claimed) {
              toast(`Capitán activado para ${inviteClaim.pointName}.`, 'success', 4500);
            }
            if (isAdmin(profile)) {
              await DB.bootstrapDefaults(user.uid);
            }
          } catch (error) {
            console.error(error);
          }
          startDataSync();
          render();
        })();
      },
      (error) => {
        console.error(error);
        if (error?.code === 'permission-denied') {
          toast(
            'No se pudo leer tu perfil en Firestore por permisos. ' +
            'Verifica reglas y que users/{uid} exista con rol válido.',
            'error',
            10000
          );
        } else {
          toast('No se pudo sincronizar tu perfil.', 'error');
        }
      }
    ));
  });
 
  // ── Botón Entrar / Cuenta ──
  document.getElementById('btn-open-auth')?.addEventListener('click', () => {
    if (state.authUser) {
      activateAppView('profile');
      render();
      return;
    }
    openModal('modal-auth');
  });
 
  // ── Google Sign-In ──
  document.getElementById('btn-google-signin')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (button && 'disabled' in button) button.disabled = true;
    toast('Abriendo Google…', 'info', 1200);
    try {
      await signInWithGoogle();
      closeAllModals();
      toast('Sesión iniciada con Google.', 'success');
    } catch (error) {
      console.error(error);
      const code = error?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        toast('Inicio con Google cancelado.', 'info'); return;
      }
      if (code === 'auth/popup-blocked') {
        toast('El navegador bloqueó la ventana emergente. Permite popups para este sitio.', 'error'); return;
      }
      if (code === 'auth/unauthorized-domain') {
        toast('Dominio no autorizado en Firebase Auth. Agrega este dominio en Authorized domains.', 'error'); return;
      }
      if (code === 'auth/account-exists-with-different-credential') {
        toast('Ese correo ya tiene cuenta con otro método. Usa correo y contraseña.', 'error'); return;
      }
      toast('No se pudo usar Google. En Firebase Console → Authentication → Sign-in method, activa Google.', 'error');
    } finally {
      if (button && 'disabled' in button) button.disabled = false;
    }
  });
 
  // ── Email + contraseña ──
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email    = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
 
    if (!email || !password) {
      toast('Debes ingresar correo y contraseña.', 'error'); return;
    }
 
    try {
      await signIn(email, password);
      closeAllModals();
      toast('Sesión iniciada.', 'success');
    } catch (error) {
      console.error(error);
      const code = error?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        toast('Correo o contraseña incorrectos, o la cuenta no existe.', 'error'); return;
      }
      if (code === 'auth/invalid-email')     { toast('El formato del correo no es válido.', 'error'); return; }
      if (code === 'auth/user-disabled')     { toast('Esta cuenta está deshabilitada.', 'error'); return; }
      if (code === 'auth/too-many-requests') { toast('Demasiados intentos. Espera unos minutos.', 'error'); return; }
      toast('No se pudo iniciar sesión. Verifica correo, contraseña y Firebase Auth.', 'error');
    }
  });
 
  // ── Cerrar sesión ──
  const doLogout = async () => {
    if (!state.authUser) return;
    await logout();
    toast('Sesión cerrada.', 'success');
  };
  document.getElementById('btn-logout')?.addEventListener('click', doLogout);
  document.getElementById('btn-profile-logout')?.addEventListener('click', doLogout);
}
