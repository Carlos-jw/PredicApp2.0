/**
 * setup-participants.js — Gestión de participantes del punto seleccionado.
 * Cubre el formulario de alta y el render de la lista con botón Eliminar.
 */

import { DB } from './db.js';
import { canEditParticipants } from './permissions.js';
import { state } from './state.js';
import { setValue } from './dom-helpers.js';
import { openModal, closeAllModals } from './modals.js';
import { confirm, toast } from './toast.js';

// ─── Event listeners ──────────────────────────────────────────────────────────

export function setupParticipants() {
  document.getElementById('btn-open-add-part')?.addEventListener('click', () => {
    if (!canEditParticipants(state.profile, state.selectedPointId)) {
      toast('Solo el super de servicio o el capitán del punto puede agregar participantes.', 'error');
      return;
    }
    setValue('inp-part-name', '');
    setValue('inp-part-phone', '');
    openModal('modal-participant');
  });

  document.getElementById('btn-save-part')?.addEventListener('click', async () => {
    if (!canEditParticipants(state.profile, state.selectedPointId)) {
      toast('No tienes permisos para esta accion.', 'error'); return;
    }
    if (!state.selectedPointId) {
      toast('Selecciona un punto valido.', 'error'); return;
    }

    const name  = (document.getElementById('inp-part-name')?.value.trim()  ?? '').slice(0, 80);
    const phone = (document.getElementById('inp-part-phone')?.value.trim() ?? '').slice(0, 30);

    if (!name) { toast('El nombre es obligatorio.', 'error'); return; }

    try {
      const result = await DB.addParticipant(state.selectedPointId, { name, phone });
      if (!result.ok) {
        toast(result.error ?? 'No se pudo agregar el participante.', 'error'); return;
      }
      closeAllModals();
      toast('Participante agregado.', result.offline ? 'warning' : 'success');
    } catch (error) {
      console.error(error);
      if (error?.code === 'permission-denied') {
        toast(
          'Sin permiso en Firestore: tu cuenta debe estar aprobada, con acceso a este punto y rol adecuado (super, capitán o publicador del punto). Revisa reglas y documento users/{tuUid}.',
          'error',
          12000
        );
      } else {
        toast('No se pudo agregar el participante.', 'error');
      }
    }
  });
}

// ─── Render de la lista ───────────────────────────────────────────────────────

export function renderParticipantsList() {
  const list = document.getElementById('participants-list');
  if (!list) return;

  list.innerHTML = '';

  if (!state.participants.length) {
    const empty = document.createElement('li');
    empty.className = 'list-empty';
    empty.textContent = 'Sin participantes en este punto.';
    list.appendChild(empty);
    return;
  }

  state.participants.forEach((participant, index) => {
    const item = document.createElement('li');
    item.className = 'admin-list-item';

    const main  = document.createElement('div');
    main.className = 'admin-list-item__main';

    const label = document.createElement('span');
    label.textContent = participant.phone
      ? `${participant.name} (${participant.phone})`
      : participant.name;
    main.appendChild(label);

    const prefDay  = String(participant.preferredDay  ?? '').trim();
    const prefTime = String(participant.preferredTime ?? '').trim();
    if (prefDay || prefTime) {
      const prefLine = document.createElement('span');
      prefLine.className = 'view-muted';
      prefLine.style.fontSize = '.8rem';
      prefLine.textContent = `Preferencia: ${[prefDay, prefTime].filter(Boolean).join(' · ')}`;
      main.appendChild(prefLine);
    }

    item.appendChild(main);

    if (canEditParticipants(state.profile, state.selectedPointId)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-delete-item';
      button.dataset.index = String(index);
      button.textContent = 'Eliminar';
      button.addEventListener('click', async () => {
        const ok = await confirm(`Eliminar participante ${participant.name}?`);
        if (!ok) return;
        try {
          const next   = state.participants.filter((_, i) => i !== index);
          const result = await DB.setParticipants(state.selectedPointId, next);
          if (!result.ok) { toast('No se pudo eliminar el participante.', 'error'); return; }
          toast('Participante eliminado.', result.offline ? 'warning' : 'success');
        } catch (error) {
          console.error(error);
          toast('No se pudo eliminar el participante.', 'error');
        }
      });
      item.appendChild(button);
    }

    list.appendChild(item);
  });
}
