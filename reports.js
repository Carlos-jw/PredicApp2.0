/**
 * reports.js — Generación de PDF con jsPDF (carga lazy desde CDN).
 */

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

let _jsPDFPromise = null;

async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  if (!_jsPDFPromise) {
    _jsPDFPromise = new Promise((resolve, reject) => {
      const script  = document.createElement('script');
      script.src    = JSPDF_CDN;
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => reject(new Error('No se pudo cargar jsPDF desde CDN.'));
      document.head.appendChild(script);
    });
  }

  return _jsPDFPromise;
}

/**
 * Genera un PDF con los reportes proporcionados.
 *
 * @param {Array<object>} reports - Lista de objetos reporte.
 * @param {'download'|'share'} mode - 'download' o 'share' (Web Share API).
 */
export async function generatePDF(reports, mode = 'download') {
  const JsPDF = await loadJsPDF();
  const doc   = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const margin = 15;
  let y        = 20;
  const pageH  = doc.internal.pageSize.getHeight();
  const lineH  = 7;

  const addLine = (text, indent = 0, bold = false) => {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 10);
    doc.text(String(text ?? ''), margin + indent, y);
    y += lineH;
  };

  const addSeparator = () => {
    if (y + 3 > pageH - margin) { doc.addPage(); y = 20; }
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, 210 - margin, y);
    y += 4;
  };

  // Encabezado
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PredicApp — Reportes de Turno', margin, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Generado: ${new Date().toLocaleDateString('es', { dateStyle: 'long' })}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  addSeparator();

  reports.forEach((r, i) => {
    addLine(`Turno ${i + 1}: ${r.day ?? '—'} ${r.time ?? '—'}`, 0, true);
    addLine(`Punto: ${r.point ?? '—'}`, 4);
    addLine(`Participantes: ${(r.participants ?? []).join(', ') || '—'}`, 4);
    addLine(`Fecha: ${r.date ?? '—'}  |  Hora inicio: ${r.startTime || '—'}`, 4);
    addLine(`¿Se cumplió?: ${r.fulfilled ? 'Sí' : 'No'}  |  ¿Conversaciones?: ${r.conversation ? 'Sí' : 'No'}`, 4);
    addLine(`¿Estudio bíblico?: ${r.bibleStudy ? 'Sí' : 'No'}`, 4);
    addLine(`Revisitas: ${r.revisits ?? 0}  |  Estudios: ${r.studies ?? 0}`, 4);
    if (r.notes?.trim()) addLine(`Notas: ${r.notes.trim()}`, 4);
    y += 3;
    if (i < reports.length - 1) addSeparator();
  });

  const filename = `predicapp-reportes-${Date.now()}.pdf`;

  if (mode === 'share' && navigator.share && navigator.canShare) {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Reportes PredicApp' });
      return;
    }
  }

  doc.save(filename);
}
