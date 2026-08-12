/**
 * JS/CONFIG.JS - Configuración Global y Headers de Petición
 */

const API_URL = 'http://localhost:3000/api';

// Estado global de la aplicación
let currentUser = null;
let products = [];
let cart = [];
let salesHistory = [];
let movimientosCaja = [];
let fondoInicial = 0;
let paymentMethod = 'EFECTIVO';
let discountPercent = 0;

/**
 * Función auxiliar para realizar peticiones HTTP autenticadas con JWT
 */
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('pos_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
      alert('Sesión expirada o no autorizada. Por favor, inicia sesión de nuevo.');
      logout();
      return { success: false };
    }
    return await response.json();
  } catch (error) {
    console.error(`Error en petición a ${endpoint}:`, error);
    return { success: false, message: 'Error de conexión con el servidor.' };
  }
}