/**
 * render-profile.js — Panel de perfil: avatar, nombre, correo, rol, punto y capitán.
 */

import { getRoleLabel } from './config.js';   // ← sin ?v=4.2
import { canUseAppData } from './permissions.js';
import { state } from './state.js';

export function renderProfilePanel() {
  const av      = document.getElementById('profile-avatar-initials');
  const nameEl  = document.getElementById('profile-display-name');
  const emailEl = document.getElementById('profile-email');
  const pill    = document.getElementById('profile-status-pill');
  const roleEl  = document.getElementById('profile-role-detail');
  const pointEl = document.getElementById('profile-assigned-point');
  const subEl   = document.getElementById('profile-subadmin');

  if (!state.authUser || !state.profile) {
    if (av)      av.textContent      = '?';
    if (nameEl)  nameEl.textContent  = 'Sin sesión';
    if (emailEl) emailEl.textContent = 'Inicia sesión para ver tu perfil.';
    if (pill) {
      pill.textContent      = 'Participante';
      pill.style.background = 'rgba(113,128,150,.15)';
      pill.style.color      = '#718096';
    }
    if (roleEl)  roleEl.textContent  = '—';
    if (pointEl) pointEl.textContent = '—';
    if (subEl)   subEl.textContent   = '—';
    return;
  }

  const display  = String(state.profile.displayName ?? '').trim() || state.authUser.email || 'Usuario';
  const initials = display
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || display.slice(0, 2).toUpperCase();

  if (av)      av.textContent      = initials;
  if (nameEl)  nameEl.textContent  = display;
  if (emailEl) emailEl.textContent = state.authUser.email ?? '';

  if (pill) {
    if (!canUseAppData(state.profile)) {
      pill.textContent      = 'Pendiente de aprobación';
      pill.style.background = 'rgba(183,129,0,.15)';
      pill.style.color      = '#8a6d00';
    } else {
      pill.textContent      = 'Sesión activa';
      pill.style.background = 'rgba(46,125,50,.12)';
      pill.style.color      = '#2e7d32';
    }
  }

  if (roleEl)  roleEl.textContent  = getRoleLabel(state.profile.role);
  if (pointEl) pointEl.textContent = String(state.profile.assignedPointName ?? '').trim() || 'Sin asignar aún';
  if (subEl)   subEl.textContent   = String(state.profile.assignedSubadminName ?? '').trim() || '—';
}
