/**
 * JS/CORTE.JS - Control del Turno de Caja y Cierre Z
 */

let activeCajaId = null;

async function loadCorteData() {
  const result = await fetchAPI('/caja/estado');
  if (result.success && result.caja) {
    const caja = result.caja;
    activeCajaId = caja.id;
    fondoInicial = Number(caja.fondo_inicial || 0);

    document.getElementById('corte-fondo-inicial').innerText = `$${fondoInicial.toFixed(2)}`;
    document.getElementById('corte-ventas-efectivo').innerText = `$${Number(caja.ventas_efectivo || 0).toFixed(2)}`;
    document.getElementById('corte-ventas-tarjeta').innerText = `$${Number(caja.ventas_tarjeta || 0).toFixed(2)}`;
    
    const totalEst = fondoInicial + Number(caja.ventas_efectivo || 0) + Number(caja.entradas || 0) - Number(caja.salidas || 0);
    document.getElementById('corte-total-caja').innerText = `$${totalEst.toFixed(2)}`;
  }
}

function setFondoInicial() {
  const val = prompt('Ingresa el monto del fondo inicial:', fondoInicial);
  if (val !== null) {
    fondoInicial = parseFloat(val) || 0;
    document.getElementById('corte-fondo-inicial').innerText = `$${fondoInicial.toFixed(2)}`;
  }
}

async function addMovimiento(tipo) {
  const monto = parseFloat(document.getElementById('mov-monto').value) || 0;
  const concepto = document.getElementById('mov-concepto').value.trim();

  if (monto <= 0 || !concepto || !activeCajaId) {
    alert('Ingresa monto y concepto válidos.');
    return;
  }

  const result = await fetchAPI('/caja/movimiento', {
    method: 'POST',
    body: JSON.stringify({ corte_id: activeCajaId, tipo, monto, concepto })
  });

  if (result.success) {
    document.getElementById('mov-monto').value = '';
    document.getElementById('mov-concepto').value = '';
    loadCorteData();
  }
}

async function realizarCorteCaja() {
  if (!confirm('¿Deseas realizar el Cierre de Caja (Corte Z)? Se cerrará la sesión del turno activo.')) return;

  const result = await fetchAPI('/caja/cierre', {
    method: 'POST',
    body: JSON.stringify({ corte_id: activeCajaId, efectivo_cierre: fondoInicial })
  });

  if (result.success) {
    alert('Corte Z finalizado exitosamente.');
    loadCorteData();
  }
}