/**
 * JS/INVENTORY.JS - Administración de Productos y Exportación CSV
 */

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const searchVal = document.getElementById('inv-search').value.toLowerCase().trim();
  tbody.innerHTML = '';

  products.filter(p => p.nombre.toLowerCase().includes(searchVal) || (p.codigo && p.codigo.includes(searchVal)))
          .forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            tr.innerHTML = `
              <td class="py-2.5 px-4 font-mono text-xs font-bold text-gray-700">${p.codigo || '-'}</td>
              <td class="py-2.5 px-4 font-bold text-coronaBlue">${p.nombre}</td>
              <td class="py-2.5 px-4 font-semibold text-gray-600">${p.categoria || 'Otros'}</td>
              <td class="py-2.5 px-4 text-right">$${Number(p.costo || 0).toFixed(2)}</td>
              <td class="py-2.5 px-4 text-right font-black text-emerald-600">$${Number(p.precio).toFixed(2)}</td>
              <td class="py-2.5 px-4 text-center">
                <span class="px-2 py-0.5 rounded text-xs font-bold ${p.stock > 5 ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}">
                  ${p.stock}
                </span>
              </td>
              <td class="py-2.5 px-4 text-center admin-only">
                <div class="flex items-center justify-center space-x-3">
                  <button onclick='editProduct(${JSON.stringify(p)})' class="text-coronaGold hover:text-coronaGoldHover font-bold" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button onclick="deleteProduct(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700 font-bold" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </td>
            `;
            tbody.appendChild(tr);
          });
}

function openProductModal() {
  document.getElementById('modal-prod-title').innerText = 'Nuevo Producto';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-code').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-category').value = 'Cervezas';
  document.getElementById('prod-stock').value = '0';
  document.getElementById('prod-cost').value = '0';
  document.getElementById('prod-price').value = '0';
  document.getElementById('modal-product').classList.remove('hidden');
}

function editProduct(p) {
  document.getElementById('modal-prod-title').innerText = 'Editar Producto';
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-code').value = p.codigo || '';
  document.getElementById('prod-name').value = p.nombre;
  document.getElementById('prod-category').value = p.categoria || 'Otros';
  document.getElementById('prod-stock').value = p.stock;
  document.getElementById('prod-cost').value = p.costo || 0;
  document.getElementById('prod-price').value = p.precio;
  document.getElementById('modal-product').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('modal-product').classList.add('hidden');
}

async function saveProduct() {
  const id = document.getElementById('prod-id').value;
  const body = {
    codigo: document.getElementById('prod-code').value.trim(),
    nombre: document.getElementById('prod-name').value.trim(),
    categoria: document.getElementById('prod-category').value,
    stock: parseInt(document.getElementById('prod-stock').value) || 0,
    costo: parseFloat(document.getElementById('prod-cost').value) || 0,
    precio: parseFloat(document.getElementById('prod-price').value) || 0
  };

  const endpoint = id ? `/productos/${id}` : '/productos';
  const method = id ? 'PUT' : 'POST';

  const result = await fetchAPI(endpoint, { method, body: JSON.stringify(body) });

  if (result.success) {
    closeProductModal();
    await loadProducts();
    renderInventoryTable();
  } else {
    alert('Error al guardar el producto');
  }
}

async function deleteProduct(id, nombre) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${nombre}"?`)) {
    return;
  }

  const result = await fetchAPI(`/productos/${id}`, { method: 'DELETE' });

  if (result.success) {
    await loadProducts();
    renderInventoryTable();
  } else {
    alert(result.error || 'Error al eliminar el producto');
  }
}

function exportInventoryToCSV() {
  let csv = 'Codigo,Nombre,Categoria,Costo,Precio,Stock\n';
  products.forEach(p => {
    csv += `"${p.codigo || ''}","${p.nombre}","${p.categoria || ''}",${p.costo || 0},${p.precio},${p.stock}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'inventario_punto_modelo.csv';
  a.click();
}