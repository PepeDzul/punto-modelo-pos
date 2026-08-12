/**
 * SERVER.JS - Servidor API RESTful para Punto Modelo POS
 * Compatible con Node.js en Debian Linux y MariaDB
 */
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'punto_modelo_corona_secret_key_2026';

// Configuración de Conexión a MariaDB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'pass',
  database: process.env.DB_NAME || 'punto_modelo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// Middleware de Verificación de Token JWT
function verifyToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) return res.status(403).json({ success: false, message: 'Acceso denegado: Token requerido' });

  const token = bearerHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    req.user = decoded;
    next();
  });
}

// Middleware para Control de Rol Administrador
function requireAdmin(req, res, next) {
  if (req.user.rol !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Permiso denegado: Se requiere rol de Administrador' });
  }
  next();
}

// =========================================================================
// RUTAS DE AUTENTICACIÓN
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE usuario = ? AND activo = TRUE', [usuario]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, nombre: user.nombre, usuario: user.usuario, rol: user.rol }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// RUTAS DE PRODUCTOS E INVENTARIO
// =========================================================================
app.get('/api/productos', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM productos ORDER BY nombre ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/productos/codigo/:codigo', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM productos WHERE codigo = ?', [req.params.codigo]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/productos', verifyToken, requireAdmin, async (req, res) => {
  const { codigo, nombre, categoria, costo, precio, stock } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO productos (codigo, nombre, categoria, costo, precio, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [codigo, nombre, categoria, costo, precio, stock]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/productos/:id', verifyToken, requireAdmin, async (req, res) => {
  const { codigo, nombre, categoria, costo, precio, stock } = req.body;
  try {
    await pool.query(
      'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, costo = ?, precio = ?, stock = ? WHERE id = ?',
      [codigo, nombre, categoria, costo, precio, stock, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute('DELETE FROM productos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    return res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar producto:', err.message);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ 
        error: 'No se puede eliminar el producto porque ya tiene ventas registradas.' 
      });
    }
    return res.status(500).json({ error: 'Error en el servidor: ' + err.message });
  }
});

// =========================================================================
// RUTAS DE VENTAS Y TRANSACCIONES
// =========================================================================
app.post('/api/ventas', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { items, metodo_pago, pagado, cambio, ajuste_monto, ajuste_tipo, referencia_tarjeta } = req.body;
    const usuario_id = req.user.id;

    const [cajaRows] = await connection.query(
      'SELECT id FROM cortes_caja WHERE usuario_id = ? AND estado = "ABIERTA" ORDER BY id DESC LIMIT 1',
      [usuario_id]
    );

    const corte_id = cajaRows.length > 0 ? cajaRows[0].id : null;

    let subtotalBase = 0;
    for (const item of items) {
      const [prodRows] = await connection.query('SELECT precio, costo, stock FROM productos WHERE id = ?', [item.producto_id]);
      if (prodRows.length === 0) throw new Error(`Producto ID ${item.producto_id} no encontrado`);
      if (prodRows[0].stock < item.cantidad) throw new Error(`Stock insuficiente para el producto ID ${item.producto_id}`);

      item.precio_unitario = prodRows[0].precio;
      item.costo_unitario = prodRows[0].costo;
      item.subtotal = prodRows[0].precio * item.cantidad;
      subtotalBase += item.subtotal;
    }

    let total = subtotalBase;
    if (ajuste_tipo === 'SURCHARGE') {
      total += (ajuste_monto || 0);
    } else {
      total -= (ajuste_monto || 0);
    }

    const folio = 'FOL-' + Date.now().toString().slice(-8);

    const [ventaResult] = await connection.query(
      `INSERT INTO ventas (folio, usuario_id, corte_id, subtotal, ajuste_monto, ajuste_tipo, total, metodo_pago, pagado, cambio, referencia_tarjeta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [folio, usuario_id, corte_id, subtotalBase, ajuste_monto || 0, ajuste_tipo, total, metodo_pago, pagado, cambio, referencia_tarjeta]
    );

    const venta_id = ventaResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [venta_id, item.producto_id, item.cantidad, item.precio_unitario, item.costo_unitario, item.subtotal]
      );

      await connection.query(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    if (corte_id) {
      if (metodo_pago === 'EFECTIVO') {
        await connection.query('UPDATE cortes_caja SET ventas_efectivo = ventas_efectivo + ? WHERE id = ?', [total, corte_id]);
      } else {
        await connection.query('UPDATE cortes_caja SET ventas_tarjeta = ventas_tarjeta + ? WHERE id = ?', [total, corte_id]);
      }
    }

    await connection.commit();
    res.json({ success: true, folio, venta_id });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/api/ventas', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.*, u.nombre as cajero,
             (SELECT SUM(dv.cantidad) FROM detalle_ventas dv WHERE dv.venta_id = v.id) as total_articulos,
             (SELECT SUM(dv.subtotal - (dv.costo_unitario * dv.cantidad)) FROM detalle_ventas dv WHERE dv.venta_id = v.id) as ganancia
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY v.fecha DESC LIMIT 100
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// NUEVO ENDPOINT: Obtener detalle completo de una venta específica (por ID o Folio)
app.get('/api/ventas/:id', verifyToken, async (req, res) => {
  try {
    const param = req.params.id;
    let queryVenta = 'SELECT v.*, u.nombre as cajero FROM ventas v JOIN usuarios u ON v.usuario_id = u.id WHERE ';
    
    if (isNaN(param)) {
      queryVenta += 'v.folio = ?';
    } else {
      queryVenta += 'v.id = ?';
    }

    const [ventas] = await pool.query(queryVenta, [param]);
    if (ventas.length === 0) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const venta = ventas[0];

    const [detalles] = await pool.query(`
      SELECT dv.*, p.nombre as producto_nombre, p.codigo
      FROM detalle_ventas dv
      LEFT JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = ?
    `, [venta.id]);

    venta.items = detalles;
    venta.detalles = detalles;

    res.json({ success: true, data: venta });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// RUTAS DE CORTE DE CAJA
// =========================================================================
app.get('/api/caja/estado', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cortes_caja WHERE usuario_id = ? AND estado = "ABIERTA" ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      const [insert] = await pool.query(
        'INSERT INTO cortes_caja (usuario_id, fondo_inicial) VALUES (?, 0.00)',
        [req.user.id]
      );
      const [newBox] = await pool.query('SELECT * FROM cortes_caja WHERE id = ?', [insert.insertId]);
      return res.json({ success: true, caja: newBox[0] });
    }

    res.json({ success: true, caja: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/caja/movimiento', verifyToken, async (req, res) => {
  const { corte_id, tipo, monto, concepto } = req.body;
  try {
    await pool.query(
      'INSERT INTO movimientos_caja (corte_id, usuario_id, tipo, monto, concepto) VALUES (?, ?, ?, ?, ?)',
      [corte_id, req.user.id, tipo, monto, concepto]
    );

    const campo = tipo === 'ENTRADA' ? 'entradas' : 'salidas';
    await pool.query(`UPDATE cortes_caja SET ${campo} = ${campo} + ? WHERE id = ?`, [monto, corte_id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/caja/cierre', verifyToken, async (req, res) => {
  const { corte_id, efectivo_cierre } = req.body;
  try {
    await pool.query(
      'UPDATE cortes_caja SET efectivo_cierre = ?, fecha_cierre = NOW(), estado = "CERRADA" WHERE id = ?',
      [efectivo_cierre, corte_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🍺 Servidor Punto Modelo POS corriendo en http://localhost:${PORT}`);
});