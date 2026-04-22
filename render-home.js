/**
 * render-home.js — Vista Inicio: directorio de participantes, tarjeta de
 * selección y navegación inteligente al punto del participante elegido.
 */

import { canUseAppData } from './permissions.js';
import { state, pendingHomeDestination, setPendingHomeDestination } from './state.js';
import { renderSelectOptions, setValue } from './dom-helpers.js';
import { toast } from './toast.js';

// ─── Filtrado y selección ─────────────────────────────────────────────────────

export function getFilteredParticipantsDirectory() {
  const query = state.participantQuery.trim().toLowerCase();
  if (!query) return state.participantsDirectory;

  return state.participantsDirectory.filter((p) => {
    const haystack = [p.name, p.phone, p.pointName].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

export function getSelectedDirectoryParticipant() {
  if (!state.selectedDirectoryParticipantId) return null;
  return state.participantsDirectory.find(
    (p) => p.id === state.selectedDirectoryParticipantId
  ) ?? null;
}

// ─── Render del directorio ────────────────────────────────────────────────────

export function renderHomeDirectory() {
  const list = document.getElementById('home-participant-list');
  if (!list) return;

  const filtered = getFilteredParticipantsDirectory();
  if (!filtered.some((p) => p.id === state.selectedDirectoryParticipantId)) {
    state.selectedDirectoryParticipantId = filtered[0]?.id ?? '';
  }

  renderSelectOptions(
    list,
    filtered.map((p) => ({
      value: p.id,
      label: `${p.name} · ${p.pointName}${p.phone ? ` · ${p.phone}` : ''}`
    }))
  );

  list.value    = state.selectedDirectoryParticipantId || '';
  list.disabled = !filtered.length;

  const countEl = document.getElementById('home-participant-count');
  if (countEl) {
    countEl.textContent = filtered.length
      ? `${filtered.length} participante(s) en la lista`
      : 'Sin resultados con el filtro actual.';
  }

  const searchInput = document.getElementById('home-participant-search');
  if (searchInput && document.activeElement !== searchInput) {
    searchInput.value = state.participantQuery;
  }

  renderHomeSelectionCard();
}

// ─── Tarjeta de selección ─────────────────────────────────────────────────────

export function renderHomeSelectionCard() {
  const participant = getSelectedDirectoryParticipant();
  const nameNode  = document.getElementById('home-participant-name');
  const pointNode = document.getElementById('home-participant-point');
  const phoneNode = document.getElementById('home-participant-phone');
  const goReserve = document.getElementById('btn-home-go-reserve');
  const goPeople  = document.getElementById('btn-home-go-people');
  const goBoard   = document.getElementById('btn-home-go-board');

  const hasSelection = Boolean(participant);
  if (nameNode)  nameNode.textContent  = participant?.name ?? 'Sin seleccion';
  if (pointNode) pointNode.textContent = participant
    ? `Punto: ${participant.pointName}`
    : 'Selecciona un participante para ver su punto.';
  if (phoneNode) phoneNode.textContent = participant?.phone
    ? `Telefono: ${participant.phone}`
    : '';

  [goReserve, goPeople, goBoard].forEach((btn) => {
    if (btn) btn.disabled = !hasSelection;
  });
}

// ─── Navegación al destino ────────────────────────────────────────────────────

export function goToHomeDestination(destination) {
  if (state.authUser && !canUseAppData(state.profile)) {
    toast('Tu acceso a turnos y tablero aun no esta activo.', 'info'); return;
  }

  const participant = getSelectedDirectoryParticipant();
  if (!participant) {
    toast('Selecciona un participante para continuar.', 'error'); return;
  }

  const tabByDestination = {
    reserve: '.nav-tab[data-view="reserve"]',
    people:  '.nav-tab[data-view="people"]',
    board:   '.nav-tab[data-view="board"]'
  };
  const navigateToTargetTab = () => {
    document.querySelector(tabByDestination[destination])?.click();
  };

  const shouldSwitchPoint = participant.pointId !== state.selectedPointId;
  if (shouldSwitchPoint) {
    setPendingHomeDestination(destination);
    // Importamos lazy para evitar ciclo render-home ↔ data-sync
    import('./data-sync.js').then(({ switchPoint }) => {
      switchPoint(participant.pointId, { keepPendingHomeDestination: true });
    });
  } else {
    navigateToTargetTab();
  }

  if (destination === 'reserve') {
    state.pendingReserveParticipantName = participant.name;
    setValue('sel-participant', participant.name);
    import('./reserve-form.js').then(({ syncSelectedSlotSummary }) => syncSelectedSlotSummary());
  }
}

// ─── Setup de eventos de la vista Inicio ─────────────────────────────────────

export function setupHome() {
  const searchInput = document.getElementById('home-participant-search');
  const list        = document.getElementById('home-participant-list');
  const goReserve   = document.getElementById('btn-home-go-reserve');
  const goPeople    = document.getElementById('btn-home-go-people');
  const goBoard     = document.getElementById('btn-home-go-board');

  searchInput?.addEventListener('input', () => {
    state.participantQuery = searchInput.value.trim();
    const filtered = getFilteredParticipantsDirectory();
    if (!filtered.some((p) => p.id === state.selectedDirectoryParticipantId)) {
      state.selectedDirectoryParticipantId = filtered[0]?.id ?? '';
    }
    renderHomeDirectory();
  });

  list?.addEventListener('change', () => {
    state.selectedDirectoryParticipantId = list.value || '';
    renderHomeSelectionCard();
  });

  list?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      goToHomeDestination('reserve');
    }
  });

  goReserve?.addEventListener('click', () => goToHomeDestination('reserve'));
  goPeople?.addEventListener('click',  () => goToHomeDestination('people'));
  goBoard?.addEventListener('click',   () => goToHomeDestination('board'));
}
