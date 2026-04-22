/**
 * enroll-form.js — Inscripción pública de participantes, selección de primer
 * punto para usuarios recién registrados, y navegación del perfil-invitado.
 */

import { DAYS, TIMES } from './config.js';
import { DB } from './db.js';
import { isPendingUserApproval, canUseAppData } from './permissions.js';
import { render } from './render-queue.js';
import { state } from './state.js';
import { renderSelectOptions, setValue } from './dom-helpers.js';
import { activateAppView, openTab } from './navigation.js';
import { openModal } from './modals.js';
import { toast } from './toast.js';

// ─── Helper interno ───────────────────────────────────────────────────────────

function profileNeedsAssignedPoint(profile) {
  if (!profile) return false;
  const id = String(profile.assignedPointId ?? '').trim();
  if (id) return false;
  const ids = profile.assignedPointIds;
  if (Array.isArray(ids) && ids.some((x) => String(x ?? '').trim() !== '')) return false;
  return true;
}

// ─── Carga pública de puntos ──────────────────────────────────────────────────

export async function refreshEnrollPointOptions(opts = {}) {
  const silentToast = Boolean(opts.silentToast);
  const enrollSel   = document.getElementById('enroll-point');
  const completeSel = document.getElementById('complete-point-select');
  if (!enrollSel && !completeSel) return;

  try {
    const points = await DB.listPointDocumentsPublic();
    state.enrollPoints = points;

    const baseOpts = points.length
      ? [
          { value: '', label: 'Selecciona un punto…' },
          ...points.map((p) => ({ value: p.id, label: p.name || p.id }))
        ]
      : [{ value: '', label: 'No hay puntos disponibles' }];

    if (enrollSel)   { renderSelectOptions(enrollSel, baseOpts); enrollSel.value = ''; }
    if (completeSel) { renderSelectOptions(completeSel, baseOpts); }
  } catch (error) {
    console.error(error);
    state.enrollPoints = [];
    const errOpt = [{ value: '', label: 'No se pudieron cargar los puntos (revisa reglas de Firestore).' }];
    if (enrollSel)   renderSelectOptions(enrollSel, errOpt);
    if (completeSel) renderSelectOptions(completeSel, errOpt);
    if (!silentToast) {
      toast('No se pudieron cargar los puntos. Comprueba conexión y reglas de Firestore.', 'error');
    }
  }
}

// ─── Hydratación estática de selects de inscripción ──────────────────────────

export function hydrateEnrollTimeSelect() {
  const enrollDay  = document.getElementById('enroll-day');
  const enrollTime = document.getElementById('enroll-time');

  if (enrollDay) {
    renderSelectOptions(enrollDay, [
      { value: '', label: 'Selecciona un día…' },
      ...DAYS.map((d) => ({ value: d, label: d }))
    ]);
  }
  if (enrollTime) {
    renderSelectOptions(enrollTime, [
      { value: '', label: 'Selecciona una hora…' },
      ...TIMES.map((t) => ({ value: t, label: t }))
    ]);
  }
}

// ─── Formulario de inscripción pública ───────────────────────────────────────

export function setupEnrollForm() {
  const btn = document.getElementById('btn-enroll-submit');
  btn?.addEventListener('click', async () => {
    const name          = document.getElementById('enroll-display-name')?.value.trim() ?? '';
    const phone         = document.getElementById('enroll-phone')?.value.trim() ?? '';
    const pointId       = document.getElementById('enroll-point')?.value ?? '';
    const preferredDay  = document.getElementById('enroll-day')?.value ?? '';
    const preferredTime = document.getElementById('enroll-time')?.value ?? '';

    if (!pointId)       { toast('Selecciona un punto de predicación.', 'error'); return; }
    if (!name)          { toast('El nombre es obligatorio.', 'error'); return; }
    if (!preferredDay)  { toast('Selecciona un día preferido.', 'error'); return; }
    if (!preferredTime) { toast('Selecciona una hora preferida.', 'error'); return; }

    const point = state.enrollPoints.find((p) => p.id === pointId);
    if (!point) { toast('Punto inválido. Recarga la página e intenta de nuevo.', 'error'); return; }

    btn.disabled = true;
    try {
      const result = await DB.enrollParticipantPublic({
        pointId: point.id, name, phone, preferredDay, preferredTime
      });
      if (result?.alreadyExists) {
        toast('Ese participante ya está inscrito en el punto seleccionado.', 'info');
      } else {
        toast('Inscripción registrada correctamente.', 'success');
      }
      setValue('enroll-display-name', '');
      setValue('enroll-phone', '');
      setValue('enroll-point', '');
      setValue('enroll-day', '');
      setValue('enroll-time', '');
    } catch (error) {
      console.error(error);
      toast(error?.message || 'No se pudo completar la inscripción.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── Panel "completar primer punto" (usuarios recién registrados) ─────────────

export function setupCompleteFirstPoint() {
  document.getElementById('btn-complete-first-point')?.addEventListener('click', async () => {
    if (!state.authUser?.uid || !state.profile) {
      toast('Debes tener sesión iniciada.', 'error'); return;
    }
    if (!profileNeedsAssignedPoint(state.profile)) {
      toast('Ya tienes un punto asignado.', 'info'); return;
    }
    const pointId = document.getElementById('complete-point-select')?.value ?? '';
    if (!pointId) { toast('Selecciona un punto.', 'error'); return; }

    const point = state.enrollPoints.find((p) => p.id === pointId);
    if (!point) { toast('Punto inválido. Recarga la página.', 'error'); return; }

    const btn = document.getElementById('btn-complete-first-point');
    if (btn) btn.disabled = true;
    try {
      await DB.saveUserProfile(state.authUser.uid, {
        assignedPointId:      point.id,
        assignedPointName:    String(point.name ?? '').trim() || point.id,
        assignedSubadminId:   String(point.subadminId ?? '').trim(),
        assignedSubadminName: String(point.subadminName ?? '').trim()
      });
      toast('Punto guardado correctamente.', 'success');
    } catch (error) {
      console.error(error);
      toast('No se pudo guardar el punto. Revisa las reglas de Firestore.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ─── Panel de perfil para invitados ──────────────────────────────────────────

export function setupProfileGuestNav() {
  document.getElementById('btn-profile-go-enroll')?.addEventListener('click', () => {
    activateAppView('home');
    render();
    requestAnimationFrame(() => {
      document.getElementById('guest-enroll-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.getElementById('btn-profile-go-login')?.addEventListener('click', () => {
    openModal('modal-auth');
  });
}

// ─── Panel "logged-pick-point" (render reactivo) ──────────────────────────────

export function updateLoggedPickPointPanel() {
  const el          = document.getElementById('logged-pick-point-panel');
  const completeSel = document.getElementById('complete-point-select');
  if (!el) return;

  const needsPoint = Boolean(
    state.authUser && state.profile && profileNeedsAssignedPoint(state.profile)
  );
  const showPick = Boolean(
    needsPoint && (canUseAppData(state.profile) || isPendingUserApproval(state.profile))
  );

  el.style.display = showPick ? '' : 'none';
  if (!showPick || !completeSel) return;

  if (!state.enrollPoints.length) {
    refreshEnrollPointOptions({ silentToast: true }).catch(() => {});
    return;
  }

  renderSelectOptions(completeSel, [
    { value: '', label: 'Selecciona un punto…' },
    ...state.enrollPoints.map((p) => ({ value: p.id, label: p.name || p.id }))
  ]);
}
