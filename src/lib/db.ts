// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Asegurar que la ruta del archivo de la base de datos sea correcta, especialmente en builds de producción
const dbPath = path.join(process.cwd(), 'sichef.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    try {
      console.log(`[DB] Intentando abrir la base de datos en: ${dbPath}`);
      // Add verbose logging for sqlite3 driver
      // const verboseSqlite3 = sqlite3.verbose();
      const newDb = await open({
        filename: dbPath,
        driver: sqlite3.Database // Use the imported class directly
        // driver: verboseSqlite3.Database // Use verbose driver for more logs
      });
      db = newDb;
      console.log("[DB] Base de datos abierta exitosamente.");
      await initializeDb(db); // Asegurar que el esquema se cree/actualice en la primera conexión
    } catch (error) {
      console.error("[DB] Falló al abrir la base de datos:", error);
      throw error; // Re-lanzar el error para indicar fallo
    }
  }
  return db;
}


async function initializeDb(dbInstance: Database): Promise<void> {
  console.log("[DB] Inicializando esquema de base de datos...");
  // Usar PRAGMA foreign_keys=ON; para forzar restricciones de clave foránea
  await dbInstance.exec('PRAGMA foreign_keys=ON;');
  console.log("[DB] PRAGMA foreign_keys=ON ejecutado.");

  // --- Creación de Tablas ---
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto',
      imageUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('pieces', 'kg')),
      initial_stock REAL DEFAULT 0,
      current_stock REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      categoryId TEXT NOT NULL,
      imageUrl TEXT,
      inventory_item_id TEXT,
      inventory_consumed_per_unit REAL DEFAULT 1,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      imageUrl TEXT,
      category_id TEXT, -- Opcional: Para agrupación UI (puede ser NULL)
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );


    CREATE TABLE IF NOT EXISTS package_items (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_modifier_slots (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      label TEXT NOT NULL,
      linked_category_id TEXT NOT NULL,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      max_quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_modifier_slot_options (
      id TEXT PRIMARY KEY,
      product_modifier_slot_id TEXT NOT NULL,
      modifier_product_id TEXT NOT NULL,
      FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE (product_modifier_slot_id, modifier_product_id)
    );

    CREATE TABLE IF NOT EXISTS package_item_modifier_slot_overrides (
      id TEXT PRIMARY KEY,
      package_item_id TEXT NOT NULL,
      product_modifier_slot_id TEXT NOT NULL,
      min_quantity INTEGER NOT NULL,
      max_quantity INTEGER NOT NULL,
      FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE CASCADE,
      FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
      UNIQUE (package_item_id, product_modifier_slot_id)
    );

    -- NUEVAS TABLAS PARA CAJA --
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT, -- Quién abrió o cerró? Puede ser null si es general
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      starting_cash REAL NOT NULL DEFAULT 0,
      ending_cash REAL, -- Conteo final
      total_cash_sales REAL, -- Calculado de órdenes completadas
      total_card_sales REAL, -- Calculado de órdenes completadas
      total_expenses REAL DEFAULT 0,
      total_tips REAL DEFAULT 0,
      loans_withdrawals_amount REAL DEFAULT 0,
      loans_withdrawals_reason TEXT,
      calculated_difference REAL, -- (ending_cash - (starting_cash + cash_sales - expenses - loans + tips))
      status TEXT NOT NULL CHECK(status IN ('open', 'closed')) DEFAULT 'open'
      -- FOREIGN KEY (user_id) REFERENCES users(id) -- Si hubiera tabla de usuarios
    );

    CREATE TABLE IF NOT EXISTS cash_session_details (
       id TEXT PRIMARY KEY,
       cash_session_id TEXT NOT NULL,
       type TEXT NOT NULL CHECK(type IN ('start', 'end')), -- Indica si es conteo inicial o final
       denomination_value REAL NOT NULL, -- e.g., 500, 200, 0.50
       quantity INTEGER NOT NULL,
       subtotal REAL NOT NULL, -- quantity * denomination_value
       FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
    );
  `);
  console.log("[DB] Tablas básicas creadas o verificadas.");

  // --- Intentar añadir columnas nuevas si no existen (Mejor esfuerzo para BD existentes) ---
  // No se necesitan nuevas columnas en tablas existentes para esta feature por ahora

  console.log("[DB] Esquema de base de datos inicializado/verificado.");
}

// Ejemplo de cómo cerrar la base de datos (opcional, depende del ciclo de vida de la app)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log("[DB] Conexión de base de datos cerrada.");
  }
}
