/**
 * state.js — Estado global mutable de la aplicación.
 * Un único objeto compartido por todos los módulos (patrón singleton).
 */

export const state = {
  // ── Autenticación ──
  authUser: null,      // firebase.User | null
  profile:  null,      // Documento users/{uid} | null

  // ── Puntos ──
  points:          [],  // Array<{id, name, subadminId, subadminName}>
  visiblePoints:   [],  // Subconjunto visible según rol
  selectedPointId: '',  // ID del punto activo en la UI
  enrollPoints:    [],  // Puntos cargados para formulario de inscripción pública

  // ── Participantes ──
  participants:                [],   // Del punto seleccionado
  participantsDirectory:       [],   // Todos los puntos (directorio global)
  selectedDirectoryParticipantId: '',
  participantQuery:            '',

  // ── Slots y reportes ──
  slots:   {},  // { [day]: Array<Slot> }
  reports: [],  // Array<Report>

  // ── Usuarios (admin) ──
  users:               [],  // Todos los usuarios (solo admin)
  pendingUsersCaptain: [],  // Usuarios pendientes visibles al capitán

  // ── Formulario reserva ──
  pendingReserveParticipantName: '',
  canCancelOwnReservation:       false,

  // ── Navegación ──
  currentView: 'home'  // 'home' | 'reserve' | 'board' | 'people' | 'profile' | 'admin'
};

// ── Destino pendiente desde la vista Inicio ───────────────────────────────────
let _pendingHomeDestination = null;

export function pendingHomeDestination() {
  return _pendingHomeDestination;
}

export function setPendingHomeDestination(dest) {
  _pendingHomeDestination = dest;
}

export function clearPendingHomeDestination() {
  _pendingHomeDestination = null;
}
