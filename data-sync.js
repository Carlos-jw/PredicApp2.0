/**
 * data-sync.js — Suscripciones en tiempo real a Firestore.
 * Gestiona el ciclo de vida de todos los listeners y actualiza el estado global.
 */
 
import { DB } from './db.js';
import { isAdmin, isSubadmin, canUseAppData } from './permissions.js';
import { render } from './render-queue.js';
import { state, pendingHomeDestination, clearPendingHomeDestination } from './state.js';
import { openTab } from './navigation.js';
import { toast } from './toast.js';
 
// ─── Referencias a unsub functions ───────────────────────────────────────────
 
export let unsubProfile                  = null;
export let unsubPoints                   = null;
export let unsubUsers                    = null;
export let unsubParticipantsDirectory    = null;
export let unsubPointData                = null;
export let unsubPendingUsers             = null;
 
export function setUnsubProfile(fn)                 { unsubProfile = fn; }
export function setUnsubPoints(fn)                  { unsubPoints = fn; }
export function setUnsubUsers(fn)                   { unsubUsers = fn; }
export function setUnsubParticipantsDirectory(fn)   { unsubParticipantsDirectory = fn; }
export function setUnsubPointData(fn)               { unsubPointData = fn; }
export function setUnsubPendingUsers(fn)            { unsubPendingUsers = fn; }
 
let _lastSyncErrorToastAt = 0;
 
function notifySyncError(scope, error) {
  console.error(`[data-sync] ${scope}:`, error);
 
  const now = Date.now();
  if (now - _lastSyncErrorToastAt < 5000) return;
  _lastSyncErrorToastAt = now;
 
  if (error?.code === 'permission-denied') {
    toast(
      `Firestore denegó permisos al sincronizar ${scope}. ` +
      'Verifica reglas y que la cuenta tenga el rol correcto en users/{uid}.',
      'error',
      10000
    );
    return;
  }
 
  toast(`No se pudo sincronizar ${scope}.`, 'warning');
}
 
// ─── Bootstrap de suscripciones tras login ────────────────────────────────────
 
export function startDataSync() {
  if (!state.authUser || !state.profile) return;
 
  _subscribePoints();
  if (isAdmin(state.profile)) _subscribeUsers();
}
 
// ─── Puntos ───────────────────────────────────────────────────────────────────
 
function _subscribePoints() {
  unsubPoints?.();
 
  setUnsubPoints(DB.subscribePoints(
    (points) => {
      state.points = points;
 
      // Puntos visibles según rol
      if (isAdmin(state.profile)) {
        state.visiblePoints = points;
      } else {
        const assigned = state.profile?.assignedPointIds ?? [];
        state.visiblePoints = points.filter((p) => assigned.includes(p.id));
      }
 
      // Auto-seleccionar primer punto visible si no hay ninguno seleccionado
      if (!state.selectedPointId && state.visiblePoints.length) {
        state.selectedPointId = state.visiblePoints[0].id;
      }
 
      // Suscripción al directorio global de participantes
      _subscribeDirectory(points);
 
      // Suscripción a datos del punto seleccionado
      if (state.selectedPointId) _subscribePointData(state.selectedPointId);
 
      render();
    },
    (error) => {
      state.points = [];
      state.visiblePoints = [];
      notifySyncError('puntos', error);
      render();
    }
  ));
}
 
// ─── Directorio global de participantes ──────────────────────────────────────
 
function _subscribeDirectory(points) {
  unsubParticipantsDirectory?.();
 
  const pointIds = points.map((p) => p.id);
  const pointsMap = Object.fromEntries(points.map((p) => [p.id, p.name]));
 
  const unsub = DB.subscribeParticipantsDirectory(
    pointIds,
    pointsMap,
    (directory) => {
      state.participantsDirectory = directory;
      render();
    },
    (error) => {
      state.participantsDirectory = [];
      notifySyncError('directorio de participantes', error);
      render();
    }
  );
 
  setUnsubParticipantsDirectory(unsub);
}
 
// ─── Datos del punto seleccionado ─────────────────────────────────────────────
 
function _subscribePointData(pointId) {
  unsubPointData?.();
  setUnsubPointData(null);
 
  if (!pointId) { render(); return; }
 
  let participantsReady = false;
  let slotsReady        = false;
  let reportsReady      = false;
 
  const tryRender = () => {
    if (participantsReady && slotsReady && reportsReady) {
      _resolvePendingHomeDestination();
      render();
    }
  };
 
  const unsubPart = DB.subscribeParticipants(
    pointId,
    (items) => {
      state.participants = items;
      participantsReady  = true;
      tryRender();
    },
    (error) => {
      state.participants = [];
      participantsReady = true;
      notifySyncError('participantes del punto', error);
      tryRender();
    }
  );
 
  const unsubSlots = DB.subscribeSlots(
    pointId,
    (items) => {
      state.slots = items;
      slotsReady  = true;
      tryRender();
    },
    (error) => {
      state.slots = {};
      slotsReady = true;
      notifySyncError('turnos del punto', error);
      tryRender();
    }
  );
 
  const unsubReports = DB.subscribeReports(
    pointId,
    (items) => {
      state.reports = items;
      reportsReady  = true;
      tryRender();
    },
    (error) => {
      state.reports = [];
      reportsReady = true;
      notifySyncError('reportes del punto', error);
      tryRender();
    }
  );
 
  // Suscripción a pendientes del capitán
  if (isSubadmin(state.profile)) {
    unsubPendingUsers?.();
    setUnsubPendingUsers(
      DB.subscribePendingUsersForCaptain(
        pointId,
        (users) => {
          state.pendingUsersCaptain = users;
          render();
        },
        (error) => {
          state.pendingUsersCaptain = [];
          notifySyncError('pendientes de aprobación', error);
          render();
        }
      )
    );
  }
 
  setUnsubPointData(() => {
    unsubPart();
    unsubSlots();
    unsubReports();
  });
}
 
// ─── Usuarios (admin) ─────────────────────────────────────────────────────────
 
function _subscribeUsers() {
  unsubUsers?.();
  setUnsubUsers(
    DB.subscribeUsers(
      (users) => {
        state.users = users;
        render();
      },
      (error) => {
        state.users = [];
        notifySyncError('usuarios (panel admin)', error);
        render();
      }
    )
  );
}
 
// ─── Cambio de punto ──────────────────────────────────────────────────────────
 
export function switchPoint(pointId, opts = {}) {
  if (pointId === state.selectedPointId && !opts.force) return;
 
  state.selectedPointId = pointId;
  state.participants    = [];
  state.slots           = {};
  state.reports         = [];
 
  unsubPointData?.();
  setUnsubPointData(null);
 
  _subscribePointData(pointId);
  render();
}
 
// ─── Resolver destino pendiente desde Inicio ──────────────────────────────────
 
function _resolvePendingHomeDestination() {
  const dest = pendingHomeDestination();
  if (!dest) return;
  clearPendingHomeDestination();
  requestAnimationFrame(() => openTab(dest));
}
