-- Creación de la base de datos
CREATE DATABASE IF NOT EXISTS punto_modelo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE punto_modelo;

-- Tabla de Usuarios (Cajeros y Administradores)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'CAJERO') NOT NULL DEFAULT 'CAJERO',
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'Otros',
    costo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de Cortes de Caja (Sesiones de Turno)
CREATE TABLE IF NOT EXISTS cortes_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fondo_inicial DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ventas_efectivo DECIMAL(10,2) DEFAULT 0.00,
    ventas_tarjeta DECIMAL(10,2) DEFAULT 0.00,
    entradas DECIMAL(10,2) DEFAULT 0.00,
    salidas DECIMAL(10,2) DEFAULT 0.00,
    efectivo_cierre DECIMAL(10,2) DEFAULT 0.00,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    estado ENUM('ABIERTA', 'CERRADA') DEFAULT 'ABIERTA',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Tabla de Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    usuario_id INT NULL,
    corte_id INT,
    subtotal DECIMAL(10,2) NOT NULL,
    ajuste_monto DECIMAL(10,2) DEFAULT 0.00,
    ajuste_tipo ENUM('DISCOUNT', 'SURCHARGE') DEFAULT 'DISCOUNT',
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('EFECTIVO', 'TARJETA') NOT NULL,
    pagado DECIMAL(10,2) NOT NULL,
    cambio DECIMAL(10,2) NOT NULL,
    referencia_tarjeta VARCHAR(50) NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (corte_id) REFERENCES cortes_caja(id)
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL -- <--- OPCIONAL (Si existe la tabla usuarios)
);
) ENGINE=InnoDB;

-- Tabla de Detalle de Ventas
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    costo_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- Tabla de Movimientos de Caja (Entradas / Salidas)
CREATE TABLE IF NOT EXISTS movimientos_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    corte_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo ENUM('ENTRADA', 'SALIDA') NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corte_id) REFERENCES cortes_caja(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Insertar Usuario Admin (Password: admin123) y Cajero (Password: cajero123)
-- Contraseñas encriptadas con bcryptjs ($2a$10$...)
INSERT INTO usuarios (nombre, usuario, password, rol) VALUES
('Administrador General', 'admin', '$2a$10$o9Roe9byCc8yqw75OhsN.OSOSTcWjY2LmumApdUtWHlVhBHqhSmne', 'ADMIN'),
('Cajero Turno 1', 'cajero', '$2a$10$doFHOPQHSreYY0zFsTbFu.kU14HLf0eqeUzUX5oCVL0Q1E1eCu/8y', 'CAJERO')
ON DUPLICATE KEY UPDATE id=id;

-- Insertar Catálogo de Productos de Muestra (Estilo Punto Modelo / Cervezas)
INSERT INTO productos (codigo, nombre, categoria, costo, precio, stock) VALUES
('7501064191012', 'Corona Extra 355ml Latón', 'Cervezas', 14.50, 22.00, 120),
('7501064191029', 'Victoria 355ml Vidrio', 'Cervezas', 13.00, 20.00, 96),
('7501064191036', 'Modelo Especial 473ml', 'Cervezas', 18.00, 26.00, 80),
('7501064191043', 'Barrilito 325ml', 'Cervezas', 10.00, 15.00, 144),
('7501055300010', 'Coca-Cola 600ml NR', 'Refrescos', 12.50, 18.00, 60),
('7501011100018', 'Sabritas Sal 45g', 'Botanas', 11.00, 17.00, 40)
ON DUPLICATE KEY UPDATE id=id;