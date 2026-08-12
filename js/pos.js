/**
 * JS/POS.JS - Lógica del Punto de Venta, Carrito, Modal de Cobro e Impresión
 */

async function initPOSModule() {
  await loadProducts();
  setupEventListeners();
}

function setupEventListeners() {
  const posSearch = document.getElementById('pos-search');
  if (posSearch) {
    posSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleBarScanner(posSearch.value);
      }
    });

    posSearch.addEventListener('input', (e) => {
      toggleClearSearch(e.target);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      openPaymentModal();
    }
  });
}

function toggleClearSearch(input) {
  const btnClear = document.getElementById('btn-clear-pos-search');
  if (btnClear) {
    if (input.value.trim().length > 0) {
      btnClear.classList.remove('hidden');
    } else {
      btnClear.classList.add('hidden');
    }
  }
  filterPOSProducts();
}

function clearPOSSearch() {
  const input = document.getElementById('pos-search');
  if (input) {
    input.value = '';
    toggleClearSearch(input);
    input.focus();
  }
}

function switchTab(tab) {
  const tabs = ['pos', 'inventory', 'corte', 'reports'];
  tabs.forEach(t => {
    const sec = document.getElementById(`sec-${t}`);
    const btn = document.getElementById(`tab-${t}`);
    if (sec) sec.classList.add('hidden');
    if (btn) {
      btn.classList.remove('bg-coronaGold', 'text-coronaBlue');
      btn.classList.add('hover:bg-blue-900', 'text-white');
    }
  });

  const targetSec = document.getElementById(`sec-${tab}`);
  const targetBtn = document.getElementById(`tab-${tab}`);
  if (targetSec) targetSec.classList.remove('hidden');
  if (targetBtn) {
    targetBtn.classList.add('bg-coronaGold', 'text-coronaBlue');
    targetBtn.classList.remove('hover:bg-blue-900', 'text-white');
  }

  if (tab === 'inventory') renderInventoryTable();
  if (tab === 'corte') loadCorteData();
  if (tab === 'reports' && currentUser?.rol === 'ADMIN') loadReportesData();
}

async function loadProducts() {
  const result = await fetchAPI('/productos');
  if (result.success) {
    products = result.data || [];
    renderPOSProducts(products);
  }
}

function filterPOSProducts() {
  const searchInput = document.getElementById('pos-search');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const catVal = document.getElementById('pos-category-filter')?.value || 'ALL';

  const filtered = products.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchVal) || (p.codigo && p.codigo.includes(searchVal));
    const matchesCat = (catVal === 'ALL') || (p.categoria === catVal);
    return matchesSearch && matchesCat;
  });

  renderPOSProducts(filtered);
}

async function handleBarScanner(code) {
  if (!code) return;
  const result = await fetchAPI(`/productos/codigo/${encodeURIComponent(code.trim())}`);
  if (result.success && result.data) {
    addToCart(result.data.id);
    clearPOSSearch();
  } else {
    alert('Producto no encontrado');
  }
}

function renderPOSProducts(items = products) {
  const grid = document.getElementById('pos-products-grid');
  if (!grid) return;
  grid.innerHTML = '';

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'bg-white border hover:border-coronaGold rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition shadow-sm hover:shadow-md h-32';
    card.onclick = () => addToCart(p.id);

    card.innerHTML = `
      <div>
        <div class="text-[9px] font-bold text-coronaGold uppercase tracking-wider mb-0.5">${p.categoria || 'General'}</div>
        <div class="font-bold text-coronaBlue text-xs leading-tight line-clamp-2">${p.nombre}</div>
      </div>
      <div class="flex justify-between items-end pt-1.5 border-t border-gray-100">
        <span class="text-sm font-black text-coronaBlue">$${Number(p.precio).toFixed(2)}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${p.stock > 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
          Stock: ${p.stock}
        </span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function addToCart(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  const inCart = cart.find(c => c.id === id);
  if (inCart) {
    if (inCart.cantidad + 1 > prod.stock) {
      alert(`Stock insuficiente (${prod.stock} disponibles).`);
      return;
    }
    inCart.cantidad += 1;
  } else {
    if (prod.stock < 1) {
      alert('Producto sin stock.');
      return;
    }
    cart.push({
      id: prod.id,
      nombre: prod.nombre,
      precio: Number(prod.precio),
      cantidad: 1,
      stock: prod.stock
    });
  }
  renderCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;

  const newQty = item.cantidad + delta;
  if (newQty <= 0) {
    cart = cart.filter(c => c.id !== id);
  } else if (newQty > item.stock) {
    alert(`Stock insuficiente (${item.stock} disponibles).`);
    return;
  } else {
    item.cantidad = newQty;
  }
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  discountPercent = 0;
  const discInput = document.getElementById('discount-percent');
  if (discInput) discInput.value = 0;
  renderCart();
}

function setDiscountPercent(percent) {
  discountPercent = Number(percent) || 0;
  const discInput = document.getElementById('discount-percent');
  if (discInput) discInput.value = discountPercent;
  renderCart();
}

function onDiscountInput() {
  const val = parseFloat(document.getElementById('discount-percent').value);
  discountPercent = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
  renderCart();
}

function calculateCartTotals() {
  const subtotalBase = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const itemCount = cart.reduce((acc, item) => acc + item.cantidad, 0);
  const type = document.getElementById('discount-type') ? document.getElementById('discount-type').value : 'DISCOUNT';

  let adjustmentAmount = (subtotalBase * discountPercent) / 100;
  let total = type === 'SURCHARGE' ? subtotalBase + adjustmentAmount : Math.max(0, subtotalBase - adjustmentAmount);

  return { subtotalBase, itemCount, adjustmentAmount, total, type };
}

function renderCart() {
  const tbody = document.getElementById('cart-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  cart.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-gray-50 text-xs';
    tr.innerHTML = `
      <td class="py-2 px-2 font-bold text-coronaBlue">${item.nombre}</td>
      <td class="py-2 px-1 text-center">
        <div class="flex items-center justify-center space-x-1">
          <button onclick="updateCartQty(${item.id}, -1)" class="w-4 h-4 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300">-</button>
          <span class="w-5 text-center font-bold">${item.cantidad}</span>
          <button onclick="updateCartQty(${item.id}, 1)" class="w-4 h-4 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300">+</button>
        </div>
      </td>
      <td class="py-2 px-1 text-right">$${item.precio.toFixed(2)}</td>
      <td class="py-2 px-1 text-right font-black">$${(item.precio * item.cantidad).toFixed(2)}</td>
      <td class="py-2 px-1 text-center">
        <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-xmark"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const { subtotalBase, itemCount, adjustmentAmount, total, type } = calculateCartTotals();

  document.getElementById('cart-subtotal-base').innerText = `$${subtotalBase.toFixed(2)}`;
  document.getElementById('cart-item-count').innerText = itemCount;
  document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;

  const discountRow = document.getElementById('cart-discount-row');
  if (discountRow) {
    if (discountPercent > 0) {
      discountRow.classList.remove('hidden');
      document.getElementById('cart-discount-label').innerText = `Ajuste (${discountPercent}%):`;
      document.getElementById('cart-discount-val').innerText = `${type === 'SURCHARGE' ? '+' : '-'}$${adjustmentAmount.toFixed(2)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }
}

function openPaymentModal() {
  if (cart.length === 0) {
    alert('Agrega productos al carrito.');
    return;
  }
  const { total } = calculateCartTotals();
  document.getElementById('modal-pay-total').innerText = `$${total.toFixed(2)}`;
  document.getElementById('card-charge-amount').innerText = total.toFixed(2);
  document.getElementById('pay-amount').value = '';
  setPaymentMethod('EFECTIVO');
  calculateChange();
  document.getElementById('modal-payment').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('modal-payment').classList.add('hidden');
}

function setPaymentMethod(method) {
  paymentMethod = method;
  const btnCash = document.getElementById('btn-pay-cash');
  const btnCard = document.getElementById('btn-pay-card');
  const cashFields = document.getElementById('pay-cash-fields');
  const cardFields = document.getElementById('pay-card-fields');

  if (method === 'EFECTIVO') {
    btnCash.className = 'py-2.5 rounded-lg font-bold text-xs uppercase border-2 border-emerald-600 bg-emerald-50 text-emerald-700';
    btnCard.className = 'py-2.5 rounded-lg font-bold text-xs uppercase border-2 border-gray-200 text-gray-600 hover:border-indigo-400';
    cashFields.classList.remove('hidden');
    cardFields.classList.add('hidden');
  } else {
    btnCard.className = 'py-2.5 rounded-lg font-bold text-xs uppercase border-2 border-indigo-600 bg-indigo-50 text-indigo-700';
    btnCash.className = 'py-2.5 rounded-lg font-bold text-xs uppercase border-2 border-gray-200 text-gray-600 hover:border-emerald-400';
    cardFields.classList.remove('hidden');
    cashFields.classList.add('hidden');
  }
}

function calculateChange() {
  const { total } = calculateCartTotals();
  const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
  const change = Math.max(0, amount - total);
  document.getElementById('pay-change').innerText = `$${change.toFixed(2)}`;
}

async function processSale() {
  const { adjustmentAmount, total, type } = calculateCartTotals();
  const payAmount = parseFloat(document.getElementById('pay-amount').value) || 0;

  if (paymentMethod === 'EFECTIVO' && payAmount < total) {
    alert('Monto pagado es menor al total.');
    return;
  }

  const cartBackup = [...cart];

  const payload = {
    items: cart.map(i => ({ producto_id: i.id, cantidad: i.cantidad })),
    metodo_pago: paymentMethod,
    pagado: paymentMethod === 'EFECTIVO' ? payAmount : total,
    cambio: paymentMethod === 'EFECTIVO' ? Math.max(0, payAmount - total) : 0,
    ajuste_monto: adjustmentAmount,
    ajuste_tipo: type,
    referencia_tarjeta: paymentMethod === 'TARJETA' ? document.getElementById('pay-card-ref').value : null
  };

  const result = await fetchAPI('/ventas', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (result.success) {
    closePaymentModal();

    generateSaleTicket({
      folio: result.folio || 'S/F',
      fecha: new Date().toLocaleString('es-MX'),
      metodo_pago: paymentMethod,
      total: total,
      pagado: paymentMethod === 'EFECTIVO' ? payAmount : total,
      cambio: paymentMethod === 'EFECTIVO' ? Math.max(0, payAmount - total) : 0
    }, cartBackup);

    clearCart();
    await loadProducts();
  } else {
    alert(`Error: ${result.error || result.message}`);
  }
}

/* ==========================================================================
   MÓDULO DE IMPRESIÓN (TICKETS Y REPORTES)
   ========================================================================== */

function printHTMLContent(htmlContent) {
  let printArea = document.getElementById('print-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area';
    document.body.appendChild(printArea);
  }

  printArea.innerHTML = htmlContent;
  window.print();
  printArea.innerHTML = '';
}

function generateSaleTicket(ventaData, cartItems) {
  const fechaStr = ventaData.fecha ? new Date(ventaData.fecha).toLocaleString('es-MX') : new Date().toLocaleString('es-MX');

  let itemsRows = cartItems.map(item => {
    const cant = item.cantidad || item.cant || 1;
    const nom = item.nombre || item.producto_nombre || item.producto || 'Producto';
    const precioUnit = Number(item.precio || item.precio_unitario || 0);
    const sub = item.subtotal ? Number(item.subtotal) : (precioUnit * cant);

    return `
      <tr>
        <td style="text-align: left; padding: 2px 0;">${cant}x ${nom}</td>
        <td style="text-align: right; padding: 2px 0;">$${sub.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const ticketHTML = `
    <div style="font-family: monospace; width: 280px; padding: 5px; font-size: 12px; color: #000;">
      <div style="text-align: center;">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold;">PUNTO MODELO</h2>
        <p style="margin: 2px 0;">Abarrotes y Cervezas</p>
      </div>
      <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;"/>
      <p style="margin: 2px 0;"><b>Folio:</b> ${ventaData.folio}</p>
      <p style="margin: 2px 0;"><b>Fecha:</b> ${fechaStr}</p>
      <p style="margin: 2px 0;"><b>Pago:</b> ${ventaData.metodo_pago}</p>
      <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;"/>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding-bottom: 4px;">Cant. / Producto</th>
            <th style="text-align: right; padding-bottom: 4px;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;"/>
      <div style="text-align: right; font-weight: bold; font-size: 14px;">
        TOTAL: $${Number(ventaData.total).toFixed(2)}
      </div>
      <div style="text-align: right; font-size: 11px; margin-top: 2px;">
        Pagado: $${Number(ventaData.pagado).toFixed(2)}<br>
        Cambio: $${Number(ventaData.cambio).toFixed(2)}
      </div>
      <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;"/>
      <p style="text-align: center; margin: 8px 0 0 0;">¡Gracias por su compra!</p>
    </div>
  `;

  printHTMLContent(ticketHTML);
}

function renderReportesTable(ventas = []) {
  const tbody = document.getElementById('payment-report-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  ventas.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 hover:bg-gray-50';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-gray-800">${v.folio}</td>
      <td class="py-2.5 px-3 text-gray-500">${new Date(v.fecha).toLocaleString('es-MX')}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${v.metodo_pago === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}">
          ${v.metodo_pago}
        </span>
      </td>
      <td class="py-2.5 px-3 text-right text-gray-600">$${Number(v.subtotal || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right text-amber-600">$${Number(v.ajuste_monto || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-right font-black text-gray-900">$${Number(v.total).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="reprintTicketById(${v.id})" title="Imprimir Ticket" class="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 text-xs font-bold transition">
          <i class="fa-solid fa-receipt mr-1"></i>Ticket
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function reprintTicketById(ventaId) {
  const result = await fetchAPI(`/ventas/${ventaId}`);
  if (result.success && result.data) {
    const venta = result.data;
    const items = (venta.detalles || venta.items || []).map(d => ({
      nombre: d.producto_nombre || d.nombre || 'Producto',
      cantidad: d.cantidad,
      precio: Number(d.precio_unitario || d.precio || 0),
      subtotal: Number(d.subtotal || 0)
    }));

    generateSaleTicket({
      folio: venta.folio,
      fecha: venta.fecha,
      metodo_pago: venta.metodo_pago,
      total: venta.total,
      pagado: venta.pagado || venta.total,
      cambio: venta.cambio || 0
    }, items);
  } else {
    alert('No se pudo obtener el detalle de la venta.');
  }
}

function printReportFromView() {
  const rows = document.querySelectorAll('#payment-report-table-body tr');

  let tableContent = '';
  rows.forEach(tr => {
    const cols = tr.querySelectorAll('td');
    if (cols.length >= 6) {
      tableContent += `
        <tr>
          <td style="padding: 6px; border: 1px solid #ddd;">${cols[0].innerText}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${cols[1].innerText}</td>
          <td style="padding: 6px; border: 1px solid #ddd;">${cols[2].innerText}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${cols[3].innerText}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${cols[4].innerText}</td>
          <td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${cols[5].innerText}</td>
        </tr>
      `;
    }
  });

  const reportHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 800px; margin: 0 auto;">
      <h2 style="text-align: center; color: #0b2341; margin-bottom: 5px;">PUNTO MODELO</h2>
      <h3 style="text-align: center; color: #555; margin-top: 0;">REPORTE GENERAL DE VENTAS</h3>
      <hr style="margin: 15px 0; border: none; border-top: 1px solid #ccc;"/>
      <p style="text-align: right; font-size: 12px;"><b>Fecha de Emisión:</b> ${new Date().toLocaleString('es-MX')}</p>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">FOLIO</th>
            <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">FECHA</th>
            <th style="padding: 6px; border: 1px solid #ddd; text-align: left;">MÉTODO</th>
            <th style="padding: 6px; border: 1px solid #ddd; text-align: right;">SUBTOTAL</th>
            <th style="padding: 6px; border: 1px solid #ddd; text-align: right;">AJUSTE</th>
            <th style="padding: 6px; border: 1px solid #ddd; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${tableContent || '<tr><td colspan="6" style="text-align: center; padding: 10px;">Sin datos registrados.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  printHTMLContent(reportHTML);
}

function printCorteZReport(corteData, ventasList = []) {
  const fecha = new Date().toLocaleString('es-MX');

  let lineasVentas = ventasList.map(v => `
    <tr>
      <td style="padding: 6px; border: 1px solid #ccc;">${v.folio}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${v.metodo_pago}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: right;">$${Number(v.total).toFixed(2)}</td>
    </tr>
  `).join('');

  const reportHTML = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 800px; margin: 0 auto;">
      <div style="text-align: center; border-bottom: 2px solid #0b2341; padding-bottom: 10px; margin-bottom: 15px;">
        <h1 style="margin: 0; color: #0b2341;">PUNTO MODELO</h1>
        <h3 style="margin: 5px 0 0 0; color: #fdb913;">REPORTE DE CORTE DE CAJA</h3>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px;">
        <div>
          <p style="margin: 3px 0;"><b>Apertura:</b> ${corteData.fecha_apertura || 'N/A'}</p>
          <p style="margin: 3px 0;"><b>Cierre / Emisión:</b> ${fecha}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 3px 0;"><b>Usuario:</b> ${currentUser?.nombre || 'General'}</p>
          <p style="margin: 3px 0;"><b>Estado:</b> ${corteData.estado || 'ABIERTA'}</p>
        </div>
      </div>

      <h4 style="margin-bottom: 8px; color: #0b2341;">Desglose de Ventas</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left;">
            <th style="padding: 6px; border: 1px solid #ccc;">Folio</th>
            <th style="padding: 6px; border: 1px solid #ccc;">Método Pago</th>
            <th style="padding: 6px; border: 1px solid #ccc; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineasVentas.length > 0 ? lineasVentas : '<tr><td colspan="3" style="padding: 8px; text-align: center; border: 1px solid #ccc;">No hay ventas registradas.</td></tr>'}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: right; font-size: 14px;">
        <p style="margin: 4px 0;">Fondo Inicial: <b>$${Number(corteData.fondo_inicial || 0).toFixed(2)}</b></p>
        <p style="margin: 4px 0;">Ventas Efectivo: <b>$${Number(corteData.ventas_efectivo || 0).toFixed(2)}</b></p>
        <p style="margin: 4px 0;">Ventas Tarjeta: <b>$${Number(corteData.ventas_tarjeta || 0).toFixed(2)}</b></p>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #cbd5e1;"/>
        <p style="margin: 4px 0; font-size: 16px; color: #0b2341;">TOTAL EN CAJA: <b>$${(Number(corteData.fondo_inicial || 0) + Number(corteData.ventas_efectivo || 0)).toFixed(2)}</b></p>
      </div>
    </div>
  `;

  printHTMLContent(reportHTML);
}