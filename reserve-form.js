/**
 * reserve-form.js — Formulario de reserva: guardar, cancelar propia reserva
 * y actualizar el resumen del slot seleccionado.
 */

import { MAX_RESERVATIONS_PER_SLOT, RESERVATION_APPROVAL } from './config.js';
import { DB } from './db.js';
import { canManageSlots, canUseAppData } from './permissions.js';
import { countPeople, getPeopleNames, detectConflict } from './reservations.js';
import { render } from './render-queue.js';
import { state } from './state.js';
import { setValue } from './dom-helpers.js';
import { showReassignModal } from './modals.js';
import { loadMyReservationsList } from './my-reservations.js';
import { confirm, toast } from './toast.js';

// ─── Helper interno ───────────────────────────────────────────────────────────

function getSelectedPoint() {
  return state.points.find((p) => p.id === state.selectedPointId) ?? null;
}

// ─── Resumen del slot seleccionado ────────────────────────────────────────────

export function syncSelectedSlotSummary() {
  const summary   = document.getElementById('selected-slot-summary');
  const day       = document.getElementById('select-day')?.value;
  const time      = document.getElementById('select-time')?.value;
  const cancelBtn = document.getElementById('btn-cancel-my-reservation');

  if (!summary) return;

  if (!day || !time) {
    summary.textContent = 'Selecciona un día y un horario.';
    state.canCancelOwnReservation = false;
    if (cancelBtn) cancelBtn.disabled = true;
    return;
  }

  const slot = state.slots[day]?.find((item) => item.time === time);
  if (!slot) {
    summary.textContent = 'El turno seleccionado aún no existe en este punto.';
    state.canCancelOwnReservation = false;
    if (cancelBtn) cancelBtn.disabled = true;
    return;
  }

  const people = countPeople(slot);
  const names  = getPeopleNames(slot, true);
  let suffix   = names.length ? ` Confirmados: ${names.join(', ')}` : '';

  const pendingMine = slot.reservations?.find(
    (r) => r.userId === state.authUser?.uid && r.approvalStatus === RESERVATION_APPROVAL.PENDING
  );
  if (pendingMine) suffix += ' · Tu solicitud está pendiente del capitán.';

  summary.textContent = `${day} ${time} - ${people}/${MAX_RESERVATIONS_PER_SLOT}.${suffix}`;

  const mine = Boolean(state.authUser?.uid) && slot.reservations.some(
    (r) => r.userId === state.authUser.uid && r.approvalStatus !== 'rejected'
  );
  state.canCancelOwnReservation = mine;

  if (cancelBtn) {
    cancelBtn.disabled = !mine;
    cancelBtn.title = mine ? '' : 'No tienes reserva en este turno.';
  }
}

// ─── Setup del formulario ─────────────────────────────────────────────────────

export function setupReserveForm() {
  const saveButton   = document.getElementById('btn-save-reserve-form');
  const cancelButton = document.getElementById('btn-cancel-my-reservation');

  const setLoading = (loading) => {
    if (saveButton)   saveButton.disabled   = loading;
    if (cancelButton) cancelButton.disabled = loading || !state.canCancelOwnReservation;
  };

  document.getElementById('select-day')?.addEventListener('change',  syncSelectedSlotSummary);
  document.getElementById('select-time')?.addEventListener('change', syncSelectedSlotSummary);

  saveButton?.addEventListener('click', async () => {
    await handleReservar(setLoading);
  });

  cancelButton?.addEventListener('click', async () => {
    if (!state.authUser || !state.profile) {
      toast('Debes iniciar sesión para cancelar tu turno.', 'error'); return;
    }
    const day  = document.getElementById('select-day')?.value;
    const time = document.getElementById('select-time')?.value;
    if (!day || !time) { toast('Selecciona día y horario.', 'error'); return; }

    const ok = await confirm('¿Deseas cancelar tu reserva en este turno?');
    if (!ok) return;

    setLoading(true);
    let result;
    try {
      result = await DB.cancelOwnReservation({
        pointId: state.selectedPointId,
        day,
        time,
        actor: { uid: state.authUser.uid }
      });
    } catch (error) {
      console.error(error);
      result = { ok: false, error: 'Error inesperado al cancelar la reserva.' };
    } finally {
      setLoading(false);
    }

    if (!result.ok) { toast(result.error ?? 'No se pudo cancelar tu reserva.', 'error'); return; }

    syncSelectedSlotSummary();
    render();
    toast('Tu reserva fue cancelada.', result.offline ? 'warning' : 'success');
    if (state.currentView === 'my-reservations') loadMyReservationsList();
  });
}

// ─── Lógica de guardado de reserva ───────────────────────────────────────────

async function handleReservar(setLoading) {
  if (!state.authUser || !state.profile) {
    toast('Debes iniciar sesión para gestionar tu turno.', 'error'); return;
  }
  if (!canUseAppData(state.profile)) {
    toast('Tu cuenta aún no tiene permiso para reservar.', 'error'); return;
  }
  if (!state.selectedPointId) {
    toast('Selecciona un punto.', 'error'); return;
  }

  const day         = document.getElementById('select-day')?.value;
  const time        = document.getElementById('select-time')?.value;
  const participant = document.getElementById('sel-participant')?.value;
  const companion1  = document.getElementById('sel-companion1')?.value || '';
  const companion2  = document.getElementById('sel-companion2')?.value || '';
  const pointName   = getSelectedPoint()?.name ?? '';

  if (!day || !time || !participant) {
    toast('Selecciona día, horario y participante.', 'error'); return;
  }

  const slot = state.slots[day]?.find((item) => item.time === time) ?? {
    id: `${day}-${time}`,
    day,
    time,
    reservations: [],
    status: 'free'
  };

  const reservationPayload = {
    userId:     state.authUser.uid,
    name:       participant,
    point:      pointName,
    companions: [companion1, companion2]
  };

  setLoading(true);
  let saveResult;

  try {
    const existingReservations = await DB.getUserReservationsAcrossPoints(state.authUser.uid);
    const selectedPoint = getSelectedPoint();
    const conflict = detectConflict(
      existingReservations,
      day,
      time,
      state.selectedPointId,
      {
        pointName:    selectedPoint?.name ?? pointName,
        subadminName: selectedPoint?.subadminName ?? ''
      }
    );

    if (conflict.status === 'blocked') {
      const cs    = conflict.conflictingSlot;
      const label = existingReservations.find((r) => r.pointId === cs.pointId)?.pointName || cs.pointId;
      toast(
        cs?.day && cs?.time
          ? `Ya tienes una reserva activa en ${label} para ${cs.day} ${cs.time}.`
          : 'Ya tienes una reserva activa en otro punto para ese mismo horario.',
        'error'
      );
      return;
    }

    if (conflict.status === 'warn') {
      const reassignPayload = {
        from: {
          pointId:      conflict.from.pointId     || state.profile?.assignedPointId    || '',
          pointName:    conflict.from.pointName   || state.profile?.assignedPointName  || 'Punto actual',
          subadminName: conflict.from.subadminName || state.profile?.assignedSubadminName || 'Sin capitán asignado'
        },
        to: {
          pointId:      conflict.to.pointId,
          pointName:    conflict.to.pointName   || selectedPoint?.name    || pointName,
          subadminName: conflict.to.subadminName || selectedPoint?.subadminName || 'Sin capitán asignado'
        },
        affectedReservations: conflict.affectedReservations
      };
      setLoading(false);
      const confirmed = await showReassignModal(reassignPayload);
      if (!confirmed) return;

      setLoading(true);
      saveResult = await DB.reassignUserToPoint(
        state.authUser.uid,
        state.selectedPointId,
        { ...reservationPayload, day, time }
      );
    } else {
      saveResult = await DB.upsertReservation({
        pointId:     state.selectedPointId,
        day,
        time,
        reservation: reservationPayload,
        actor: {
          uid:              state.authUser.uid,
          role:             state.profile.role,
          assignedPointIds: state.profile.assignedPointIds ?? []
        }
      });
    }
  } catch (error) {
    console.error(error);
    saveResult = { ok: false, error: 'Error inesperado al guardar la reserva.' };
  } finally {
    setLoading(false);
  }

  if (!saveResult?.ok) {
    toast(saveResult?.error ?? 'No se pudo guardar la reserva.', 'error'); return;
  }

  syncSelectedSlotSummary();
  render();

  const managerSaved   = canManageSlots(state.profile, state.selectedPointId);
  const successMessage = saveResult.removedReservations
    ? 'Reserva guardada y punto reasignado.'
    : managerSaved
      ? (saveResult.mode === 'updated' ? 'Reserva actualizada.'   : 'Reserva guardada.')
      : (saveResult.mode === 'updated' ? 'Solicitud actualizada.' : 'Solicitud enviada; el capitán la revisará.');

  toast(successMessage, saveResult.offline ? 'warning' : 'success');
  if (state.currentView === 'my-reservations') loadMyReservationsList();
}

// ─── Navegar al formulario desde el tablero ───────────────────────────────────

export function openReserveFromBoard(day, slot) {
  import('./navigation.js').then(({ openTab }) => openTab('reserve'));
  setValue('select-day',  day);
  setValue('select-time', slot.time);
  syncSelectedSlotSummary();
}
