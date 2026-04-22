/**
 * app.js — Entry point de PredicApp.
 * Inicializa módulos, listeners globales y wiring entre vistas.
 */
 
import { DAYS, TIMES } from './config.js';
import { switchPoint } from './data-sync.js';
import { hydrateEnrollTimeSelect, refreshEnrollPointOptions, setupCompleteFirstPoint, setupEnrollForm, setupProfileGuestNav } from './enroll-form.js';
import { initModalCloseButtons } from './modals.js';
import { loadMyReservationsList } from './my-reservations.js';
import { setupNavigation, activateAppView } from './navigation.js';
import { render } from './render-queue.js';
import { setupAdmin } from './setup-admin.js';
import { setupAuth } from './setup-auth.js';
import { setupParticipants } from './setup-participants.js';
import { setupReports, openReportModal } from './setup-reports.js';
import { setupReserveForm, openReserveFromBoard, syncSelectedSlotSummary } from './reserve-form.js';
import { registerServiceWorker } from './service-worker.js';
import { emptySlot, editSlot, handleApproveReservationRequest, handleRejectReservationRequest } from './slot-actions.js';
import { state } from './state.js';
import { setupHome } from './render-home.js';
import { toast } from './toast.js';
 
function getSlot(day, time) {
  return state.slots[day]?.find((slot) => slot.time === time) ?? null;
}
 
function setupPointSelector() {
  const pointSelect = document.getElementById('select-point');
  if (!pointSelect) return;
 
  pointSelect.addEventListener('change', () => {
    const pointId = pointSelect.value;
    if (!pointId) return;
    switchPoint(pointId);
  });
}
 
function setupBoardActions() {
  const tableBody = document.getElementById('board-tbody');
  if (!tableBody) return;
 
  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
 
    const day = button.dataset.day;
    const time = button.dataset.time;
    if (!day || !time) return;
 
    const slot = getSlot(day, time);
 
    if (button.classList.contains('btn-board-reserve')) {
      openReserveFromBoard(day, slot ?? { time });
      return;
    }
 
    if (button.classList.contains('btn-board-report')) {
      if (!slot) {
        toast('Primero registra una reserva para crear el reporte.', 'info');
        return;
      }
      openReportModal(day, slot);
      return;
    }
 
    if (button.classList.contains('btn-board-empty')) {
      if (!slot) return;
      await emptySlot(day, slot);
      return;
    }
 
    if (button.classList.contains('btn-board-edit')) {
      if (!slot) return;
      await editSlot(day, slot);
      return;
    }
 
    if (button.dataset.action === 'approve-request') {
      const targetUserId = button.dataset.uid;
      if (!slot || !targetUserId) return;
      await handleApproveReservationRequest(day, slot, targetUserId);
      return;
    }
 
    if (button.dataset.action === 'reject-request') {
      const targetUserId = button.dataset.uid;
      if (!slot || !targetUserId) return;
      await handleRejectReservationRequest(day, slot, targetUserId);
    }
  });
}
 
function setupViewEffects() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view === 'my-reservations') {
        void loadMyReservationsList();
      }
      if (view === 'reserve') {
        syncSelectedSlotSummary();
      }
    });
  });
}
 
function bootstrap() {
  // Configuración consumida por render-queue.js para tabla/selecciones.
  window.__predicappConfig = { DAYS, TIMES };
 
  initModalCloseButtons();
  setupNavigation();
  setupAuth();
  setupParticipants();
  setupAdmin();
  setupReports();
  setupReserveForm();
  setupHome();
  setupEnrollForm();
  setupCompleteFirstPoint();
  setupProfileGuestNav();
  setupPointSelector();
  setupBoardActions();
  setupViewEffects();
 
  hydrateEnrollTimeSelect();
  void refreshEnrollPointOptions({ silentToast: true });
 
  activateAppView('home');
  render();
  registerServiceWorker();
}
 
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
