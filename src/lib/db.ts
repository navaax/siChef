// src/lib/db.ts
'use server'; // Asegurar que esto corra en el servidor

import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Asegurar que la ruta del archivo de la base de datos sea correcta, especialmente en builds de producción
const dbPath = path.join(process.cwd(), 'sichef.db');

let db: Database | null = null;
let isInitializing = false; // Bandera para prevenir inicializaciones concurrentes
let initializationPromise: Promise<Database> | null = null; // Promesa para la inicialización en curso

export async function getDb(): Promise<Database> {
  // Si la inicialización ya está en progreso, esperar a que se complete
  if (isInitializing && initializationPromise) {
    console.log(`[DB] Esperando inicialización en curso...`);
    return initializationPromise;
  }

  // Si la BD ya está inicializada, retornarla
  if (db) {
    // console.log("[DB] Retornando conexión de base de datos existente."); // Evitar logging excesivo
    return db;
  }

  // Iniciar inicialización
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log(`[DB] Intentando abrir base de datos en: ${dbPath}`);
      // Añadir logging verboso para el driver sqlite3
      const verboseSqlite3 = sqlite3.verbose();
      const newDb = await open({
        filename: dbPath,
        driver: verboseSqlite3.Database // Usar driver verboso para más logs
      });
      console.log("[DB] Base de datos abierta exitosamente. Inicializando esquema...");
      await initializeDb(newDb); // Asegurar que el esquema se cree/actualice
      db = newDb; // Asignar a la variable global *después* de una inicialización exitosa
      console.log("[DB] Conexión de base de datos establecida e inicializada.");
      isInitializing = false; // Resetear bandera
      initializationPromise = null; // Limpiar promesa
      return db;
    } catch (error) {
      isInitializing = false; // Resetear bandera en error
      initializationPromise = null; // Limpiar promesa
      db = null; // Asegurar que db sea null en error
      console.error("[DB] Falló al abrir o inicializar la base de datos:", error);
      throw error; // Re-lanzar el error para indicar fallo
    }
  })();

  return initializationPromise;
}


async function initializeDb(dbInstance: Database): Promise<void> {
    console.log("[DB Initialize] Iniciando inicialización de esquema...");
    try {
        // Usar PRAGMA foreign_keys=ON; para forzar restricciones de clave foránea
        await dbInstance.exec('PRAGMA foreign_keys=ON;');
        console.log("[DB Initialize] PRAGMA foreign_keys=ON ejecutado.");

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
            linked_category_id TEXT NOT NULL, /* ID de categoría tipo 'modificador' de donde sacar las opciones */
            min_quantity INTEGER NOT NULL DEFAULT 0,
            max_quantity INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (linked_category_id) REFERENCES categories(id) ON DELETE CASCADE /* Asegurar que la categoría vinculada exista */
            );

            CREATE TABLE IF NOT EXISTS product_modifier_slot_options (
            id TEXT PRIMARY KEY,
            product_modifier_slot_id TEXT NOT NULL,
            modifier_product_id TEXT NOT NULL, /* ID del producto (de tipo modificador) que es una opción */
            is_default BOOLEAN DEFAULT 0,
            price_adjustment REAL DEFAULT 0,
            FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
            FOREIGN KEY (modifier_product_id) REFERENCES products(id) ON DELETE CASCADE, /* Asegurar que el producto modificador exista */
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

            CREATE TABLE IF NOT EXISTS cash_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            starting_cash REAL NOT NULL DEFAULT 0,
            ending_cash REAL,
            total_cash_sales REAL,
            total_card_sales REAL,
            total_expenses REAL DEFAULT 0,
            total_tips REAL DEFAULT 0,
            loans_withdrawals_amount REAL DEFAULT 0,
            loans_withdrawals_reason TEXT,
            calculated_difference REAL,
            status TEXT NOT NULL CHECK(status IN ('open', 'closed')) DEFAULT 'open'
            );

            CREATE TABLE IF NOT EXISTS cash_session_details (
            id TEXT PRIMARY KEY,
            cash_session_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('start', 'end')),
            denomination_value REAL NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS modifier_serving_styles (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL, -- FK to categories (type 'modificador')
                label TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
                UNIQUE (category_id, label)
            );

            -- Tablas para Gestión de Usuarios --
            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT PRIMARY KEY, -- e.g., "manage_inventory", "view_reports"
                name TEXT NOT NULL UNIQUE, -- e.g., "Gestionar Inventario"
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS employees (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                pin TEXT, -- PIN específico del sistema para este empleado, no el de login al POS. Puede ser NULL.
                position_id TEXT,
                reports_to_employee_id TEXT, -- Para jerarquía, puede ser NULL
                status TEXT NOT NULL CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
                FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
                FOREIGN KEY (reports_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS employee_roles (
                employee_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                PRIMARY KEY (employee_id, role_id),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT NOT NULL,
                permission_id TEXT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

        `);
        console.log("[DB Initialize] Tablas base creadas o verificadas.");

        // --- Añadir/Verificar columnas existentes ---
        const columnsToVerify = [
            { table: 'categories', column: 'type', definition: "TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto'" },
            { table: 'products', column: 'inventory_item_id', definition: "TEXT" },
            { table: 'products', column: 'inventory_consumed_per_unit', definition: "REAL DEFAULT 1" },
            { table: 'product_modifier_slot_options', column: 'is_default', definition: "BOOLEAN DEFAULT 0" },
            { table: 'product_modifier_slot_options', column: 'price_adjustment', definition: "REAL DEFAULT 0" },
        ];

        for (const { table, column, definition } of columnsToVerify) {
            try {
                const tableInfo = await dbInstance.all(`PRAGMA table_info(${table})`);
                const columnExists = tableInfo.some(col => col.name === column);
                if (!columnExists) {
                    console.log(`[DB Initialize] Añadiendo columna '${column}' a la tabla '${table}'.`);
                    await dbInstance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
                    console.log(`[DB Initialize] Columna '${column}' añadida exitosamente a '${table}'.`);
                }
            } catch (alterError) {
                 console.warn(`[DB Initialize] No se pudo verificar o añadir columna '${column}' a la tabla '${table}' (puede que ya exista o haya otro problema):`, alterError);
            }
        }
        
        console.log("[DB Initialize] Inicialización/verificación de esquema finalizada.");
    } catch (initError) {
        console.error("[DB Initialize] Error durante inicialización de esquema:", initError);
        throw initError; // Propagar error
    }
}

export async function closeDb(): Promise<void> {
  if (db) {
    try {
        await db.close();
        db = null;
        console.log("[DB] Conexión de base de datos cerrada.");
    } catch (closeError) {
        console.error("[DB] Error cerrando conexión de base de datos:", closeError);
    }
  }
}

process.on('SIGINT', async () => {
    console.log('[DB] SIGINT recibido. Cerrando conexión de base de datos...');
    await closeDb();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('[DB] SIGTERM recibido. Cerrando conexión de base de datos...');
    await closeDb();
    process.exit(0);
});

