/**
 * setup-reports.js — Modal de reporte: guardar, eliminar, descargar PDF
 * y la función que lo abre desde el tablero.
 */

import { DAYS } from './config.js';
import { DB } from './db.js';
import { generatePDF } from './reports.js';
import { canManageSlots } from './permissions.js';
import { getPeopleNames } from './reservations.js';
import { state } from './state.js';
import { setText, setValue } from './dom-helpers.js';
import { openModal, closeAllModals } from './modals.js';
import { confirm, toast } from './toast.js';
import { parseNonNegativeInt } from './utils.js';

// ─── Helpers internos ─────────────────────────────────────────────────────────

function getSelectedPoint() {
  return state.points.find((p) => p.id === state.selectedPointId) ?? null;
}

function getSlotMetaById(slotId) {
  for (const day of DAYS) {
    const slot = state.slots[day]?.find((item) => item.id === slotId);
    if (slot) return { day, slot };
  }
  return null;
}

// ─── Event listeners del modal ────────────────────────────────────────────────

export function setupReports() {
  // Guardar
  document.getElementById('btn-save-report')?.addEventListener('click', async () => {
    const slotId   = document.getElementById('modal-report')?.dataset.slotId ?? '';
    const slotMeta = getSlotMetaById(slotId);
    if (!slotMeta) { toast('No se encontró el turno para guardar el reporte.', 'error'); return; }

    const existing = state.reports.find((r) => r.slotId === slotId);
    const report = {
      ...(existing ?? {}),
      slotId,
      day:          slotMeta.day,
      time:         slotMeta.slot.time,
      point:        getSelectedPoint()?.name ?? '',
      participants: getPeopleNames(slotMeta.slot),
      date:         document.getElementById('report-date')?.value       || new Date().toISOString().slice(0, 10),
      startTime:    document.getElementById('report-start-time')?.value || '',
      fulfilled:    document.getElementById('report-fulfilled')?.value    === 'true',
      conversation: document.getElementById('report-conversation')?.value === 'true',
      bibleStudy:   document.getElementById('report-bible-study')?.value  === 'true',   // ← corregido
      revisits:     parseNonNegativeInt(document.getElementById('report-revisits')?.value),  // ← corregido
      studies:      parseNonNegativeInt(document.getElementById('report-studies')?.value),
      notes:        (document.getElementById('report-notes')?.value.trim() ?? '').slice(0, 500),
      updatedAt:    Date.now()
    };

    if (!report.id) {
      report.id        = `${slotId}-${Date.now()}`;
      report.createdAt = Date.now();
    }

    const nextReports = existing
      ? state.reports.map((item) => (item.slotId === slotId ? report : item))
      : [...state.reports, report];

    try {
      const result = await DB.setReports(state.selectedPointId, nextReports);
      if (!result.ok) { toast('No se pudo guardar el reporte.', 'error'); return; }
      toast('Reporte guardado.', result.offline ? 'warning' : 'success');
      closeAllModals();
    } catch (error) {
      console.error(error);
      toast('No se pudo guardar el reporte.', 'error');
    }
  });

  // Descargar PDF
  document.getElementById('btn-download-report')?.addEventListener('click', async () => {
    const slotId = document.getElementById('modal-report')?.dataset.slotId ?? '';
    const report = state.reports.find((item) => item.slotId === slotId);
    if (!report) { toast('Guarda primero el reporte para descargarlo.', 'error'); return; }
    try {
      await generatePDF([report], 'download');
      toast('PDF generado.', 'success');
    } catch (error) {
      console.error(error);
      toast('No se pudo generar el PDF.', 'error');
    }
  });

  // Eliminar
  document.getElementById('btn-remove-report')?.addEventListener('click', async () => {
    const slotId = document.getElementById('modal-report')?.dataset.slotId ?? '';
    if (!slotId) return;
    const ok = await confirm('¿Eliminar reporte de este turno?');
    if (!ok) return;
    try {
      const nextReports = state.reports.filter((item) => item.slotId !== slotId);
      const result      = await DB.setReports(state.selectedPointId, nextReports);
      if (!result.ok) { toast('No se pudo eliminar el reporte.', 'error'); return; }
      toast('Reporte eliminado.', result.offline ? 'warning' : 'success');
      closeAllModals();
    } catch (error) {
      console.error(error);
      toast('No se pudo eliminar el reporte.', 'error');
    }
  });
}

// ─── Abrir modal de reporte desde el tablero ──────────────────────────────────

export function openReportModal(day, slot) {
  if (!canManageSlots(state.profile, state.selectedPointId)) {
    toast('No tienes permisos para reportar turnos de este punto.', 'error'); return;
  }

  const modal = document.getElementById('modal-report');
  if (!modal) return;

  const existing       = state.reports.find((r) => r.slotId === slot.id);
  modal.dataset.slotId = slot.id;

  setText(
    'report-slot-label',
    `${day} ${slot.time} · ${getSelectedPoint()?.name ?? ''} · Publicadores: ${getPeopleNames(slot).join(', ') || '-'}`
  );

  setValue('report-date',         existing?.date        ?? new Date().toISOString().slice(0, 10));
  setValue('report-start-time',   existing?.startTime   ?? '');
  setValue('report-fulfilled',    String(existing?.fulfilled    ?? true));
  setValue('report-conversation', String(existing?.conversation ?? false));
  setValue('report-bible-study',  String(existing?.bibleStudy  ?? false));   // ← corregido
  setValue('report-revisits',     String(existing?.revisits     ?? 0));       // ← corregido
  setValue('report-studies',      String(existing?.studies      ?? 0));
  setValue('report-notes',        existing?.notes ?? '');
  openModal('modal-report');
}
