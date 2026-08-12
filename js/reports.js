/**
 * JS/REPORTS.JS - Métricas de Negocio e Informes Imprimibles
 */

async function loadReportesData() {
  const result = await fetchAPI('/ventas');
  if (result.success) {
    salesHistory = result.data || [];
    renderReportesMetrics();
    renderPaymentReportTable();
  }
}

function renderReportesMetrics() {
  let totalVentas = 0;
  let totalEf = 0;
  let totalTarj = 0;
  let totalGanancia = 0;

  salesHistory.forEach(v => {
    const tot = Number(v.total || 0);
    totalVentas += tot;
    if (v.metodo_pago === 'TARJETA') totalTarj += tot;
    else totalEf += tot;
    totalGanancia += Number(v.ganancia || 0);
  });

  const totalTickets = salesHistory.length;
  const avgTicket = totalTickets > 0 ? totalVentas / totalTickets : 0;

  document.getElementById('rep-total-ventas').innerText = `$${totalVentas.toFixed(2)}`;
  document.getElementById('rep-total-ganancia').innerText = `$${totalGanancia.toFixed(2)}`;
  document.getElementById('rep-total-tickets').innerText = totalTickets;
  document.getElementById('rep-ticket-promedio').innerText = `$${avgTicket.toFixed(2)}`;

  document.getElementById('pm-cash-total').innerText = `$${totalEf.toFixed(2)}`;
  document.getElementById('pm-card-total').innerText = `$${totalTarj.toFixed(2)}`;
}

function renderPaymentReportTable() {
  const tbody = document.getElementById('payment-report-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  salesHistory.forEach((v, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-gray-50';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold">${v.folio}</td>
      <td class="py-2.5 px-3">${new Date(v.fecha).toLocaleString('es-MX')}</td>
      <td class="py-2.5 px-3 font-bold ${v.metodo_pago === 'TARJETA' ? 'text-indigo-600' : 'text-emerald-600'}">${v.metodo_pago}</td>
      <td class="py-2.5 px-3 text-right">$${Number(v.subtotal || v.total).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right text-amber-600">$${Number(v.ajuste_monto || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right font-black">$${Number(v.total).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="imprimirTicketVenta(${index})" title="Ver Ticket" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition shadow-sm inline-flex items-center gap-1">
          <i class="fa-solid fa-receipt"></i> Ticket
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function imprimirTicketVenta(index) {
  const venta = salesHistory[index];
  if (!venta) return;

  const idOFolio = venta.id || venta.folio;
  const res = await fetchAPI(`/ventas/${idOFolio}`);

  if (res.success && res.data) {
    const ventaCompleta = res.data;
    const items = (ventaCompleta.detalles || ventaCompleta.items || []).map(d => ({
      nombre: d.producto_nombre || d.nombre || 'Producto',
      cantidad: d.cantidad,
      precio: Number(d.precio_unitario || d.precio || 0),
      subtotal: Number(d.subtotal || 0)
    }));

    generateSaleTicket({
      folio: ventaCompleta.folio,
      fecha: ventaCompleta.fecha,
      metodo_pago: ventaCompleta.metodo_pago,
      total: ventaCompleta.total,
      pagado: ventaCompleta.pagado || ventaCompleta.total,
      cambio: ventaCompleta.cambio || 0
    }, items);
  } else {
    alert('No se pudo obtener el detalle de la venta desde la base de datos.');
  }
}

function exportPaymentReportToCSV() {
  let csv = 'Folio,Fecha,Metodo,Subtotal,Ajuste,Total\n';
  salesHistory.forEach(v => {
    csv += `"${v.folio}","${v.fecha}","${v.metodo_pago}",${v.subtotal || v.total},${v.ajuste_monto || 0},${v.total}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reporte_ventas_corona.csv';
  a.click();
}

/**
 * Genera e imprime el reporte general de ventas en la plantilla de impresión,
 * incluyendo el pie de tabla (tfoot) con la sumatoria del Gran Total.
 */
function printReportFromView() {
  const printArea = document.getElementById('print-area');
  if (!printArea) return;

  if (!salesHistory || salesHistory.length === 0) {
    alert('No hay ventas registradas para generar el reporte.');
    return;
  }

  // Acumuladores globales
  let grandSubtotal = 0;
  let grandAdjustment = 0;
  let grandTotal = 0;

  // Generar las filas de datos calculando totales acumulados
  const tableRows = salesHistory.map(v => {
    const subtotal = Number(v.subtotal || v.total || 0);
    const ajuste = Number(v.ajuste_monto || 0);
    const total = Number(v.total || 0);

    grandSubtotal += subtotal;
    grandAdjustment += ajuste;
    grandTotal += total;

    const fechaStr = v.fecha ? new Date(v.fecha).toLocaleString('es-MX') : '';

    return `
      <tr>
        <td style="padding: 6px; text-align: left;">${v.folio || '-'}</td>
        <td style="padding: 6px; text-align: left;">${fechaStr}</td>
        <td style="padding: 6px; text-align: center; text-transform: uppercase;">${v.metodo_pago || 'EFECTIVO'}</td>
        <td style="padding: 6px; text-align: right;">$${subtotal.toFixed(2)}</td>
        <td style="padding: 6px; text-align: right;">$${ajuste.toFixed(2)}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold;">$${total.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const nowStr = new Date().toLocaleString('es-MX');

  // Inyectar HTML en la zona de impresión
  printArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; font-size: 11px; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-transform: uppercase;">PUNTO MODELO</h2>
        <h3 style="margin: 4px 0 0 0; font-size: 13px; font-weight: bold; color: #555;">REPORTE GENERAL DE VENTAS</h3>
        <p style="margin: 8px 0 0 0; font-size: 10px; color: #777;"><strong>Fecha de Emisión:</strong> ${nowStr}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 15px;">
        <thead>
          <tr style="border-bottom: 2px solid #000; text-transform: uppercase; font-size: 9px;">
            <th style="padding: 6px; text-align: left;">Folio</th>
            <th style="padding: 6px; text-align: left;">Fecha</th>
            <th style="padding: 6px; text-align: center;">Método</th>
            <th style="padding: 6px; text-align: right;">Subtotal</th>
            <th style="padding: 6px; text-align: right;">Ajuste</th>
            <th style="padding: 6px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr style="border-top: 2px solid #000; border-bottom: 2px double #000; font-weight: bold; font-size: 11px; background-color: #f9f9f9;">
            <td colspan="3" style="padding: 8px; text-align: right; text-transform: uppercase;">GRAN TOTAL:</td>
            <td style="padding: 8px; text-align: right;">$${grandSubtotal.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right;">$${grandAdjustment.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-size: 12px; color: #0B2341;">$${grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  window.print();
}

// Alias de función para mantener compatibilidad con llamados antiguos
function printPaymentReportPDF() {
  printReportFromView();
}