// src/lib/db.ts
'use server'; // Ensure this runs on the server

import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Asegurar que la ruta del archivo de la base de datos sea correcta, especialmente en builds de producción
const dbPath = path.join(process.cwd(), 'sichef.db');

let db: Database | null = null;
let isInitializing = false; // Flag to prevent concurrent initializations
let initializationPromise: Promise<Database> | null = null; // Promise for ongoing initialization

export async function getDb(): Promise<Database> {
  // If initialization is already in progress, wait for it to complete
  if (isInitializing && initializationPromise) {
    console.log(`[DB] Waiting for ongoing initialization...`);
    return initializationPromise;
  }

  // If db is already initialized, return it
  if (db) {
    // console.log("[DB] Returning existing database connection."); // Avoid excessive logging
    return db;
  }

  // Start initialization
  isInitializing = true;
  initializationPromise = (async () => {
    try {
      console.log(`[DB] Attempting to open database at: ${dbPath}`);
      // Add verbose logging for sqlite3 driver
      const verboseSqlite3 = sqlite3.verbose();
      const newDb = await open({
        filename: dbPath,
        driver: verboseSqlite3.Database // Use verbose driver for more logs
      });
      console.log("[DB] Database opened successfully. Initializing schema...");
      await initializeDb(newDb); // Asegurar que el esquema se cree/actualice
      db = newDb; // Assign to the global variable *after* successful initialization
      console.log("[DB] Database connection established and initialized.");
      isInitializing = false; // Reset flag
      initializationPromise = null; // Clear promise
      return db;
    } catch (error) {
      isInitializing = false; // Reset flag on error
      initializationPromise = null; // Clear promise
      db = null; // Ensure db is null on error
      console.error("[DB] Failed to open or initialize database:", error);
      throw error; // Re-lanzar el error para indicar fallo
    }
  })();

  return initializationPromise;
}


async function initializeDb(dbInstance: Database): Promise<void> {
    console.log("[DB Initialize] Starting schema initialization...");
    try {
        // Usar PRAGMA foreign_keys=ON; para forzar restricciones de clave foránea
        await dbInstance.exec('PRAGMA foreign_keys=ON;');
        console.log("[DB Initialize] PRAGMA foreign_keys=ON executed.");

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
        console.log("[DB Initialize] Basic tables created or verified.");

        // --- Add 'type' column to 'categories' if it doesn't exist ---
        try {
            const columns = await dbInstance.all(`PRAGMA table_info(categories)`);
            const hasTypeColumn = columns.some(col => col.name === 'type');
            if (!hasTypeColumn) {
                 console.log("[DB Initialize] Adding 'type' column to 'categories' table.");
                 await dbInstance.exec(`
                    ALTER TABLE categories
                    ADD COLUMN type TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto';
                 `);
                 console.log("[DB Initialize] 'type' column added successfully.");
             } else {
                 // console.log("[DB Initialize] 'type' column already exists in 'categories'."); // Less verbose
             }
        } catch (addColumnError) {
             console.warn("[DB Initialize] Could not check or add 'type' column to categories (might already exist or other issue):", addColumnError);
        }

         // --- Add 'inventory_item_id' and 'inventory_consumed_per_unit' to 'products' if they don't exist ---
        try {
             const productColumns = await dbInstance.all(`PRAGMA table_info(products)`);
             const hasInvItemId = productColumns.some(col => col.name === 'inventory_item_id');
             const hasInvConsumed = productColumns.some(col => col.name === 'inventory_consumed_per_unit');

             if (!hasInvItemId) {
                console.log("[DB Initialize] Adding 'inventory_item_id' column to 'products' table.");
                await dbInstance.exec(`ALTER TABLE products ADD COLUMN inventory_item_id TEXT;`);
                 // Add foreign key constraint separately if needed, though altering constraints is complex in SQLite
                 console.log("[DB Initialize] 'inventory_item_id' column added.");
             }
             if (!hasInvConsumed) {
                 console.log("[DB Initialize] Adding 'inventory_consumed_per_unit' column to 'products' table.");
                 await dbInstance.exec(`ALTER TABLE products ADD COLUMN inventory_consumed_per_unit REAL DEFAULT 1;`);
                 console.log("[DB Initialize] 'inventory_consumed_per_unit' column added.");
             }
             // Re-add foreign key constraint if columns were added (complex, might be better to recreate table in dev)
             // For simplicity, we'll assume the FK was added initially or rely on the app logic
             // console.log("[DB Initialize] Inventory columns checked/added to 'products'."); // Less verbose

        } catch (addProductColumnError) {
             console.warn("[DB Initialize] Could not check or add inventory columns to products:", addProductColumnError);
        }


        console.log("[DB Initialize] Schema initialization/verification finished.");
    } catch (initError) {
        console.error("[DB Initialize] Error during schema initialization:", initError);
        throw initError; // Propagate error
    }
}

// Ejemplo de cómo cerrar la base de datos (opcional, depende del ciclo de vida de la app)
export async function closeDb(): Promise<void> {
  if (db) {
    try {
        await db.close();
        db = null;
        console.log("[DB] Database connection closed.");
    } catch (closeError) {
        console.error("[DB] Error closing database connection:", closeError);
        // Decide if you want to throw, but usually logging is sufficient here
    }
  } else {
      // console.log("[DB] Close requested, but no active connection."); // Less verbose
  }
}

// Graceful shutdown handling (optional but good practice)
process.on('SIGINT', async () => {
    console.log('[DB] Received SIGINT. Closing database connection...');
    await closeDb();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('[DB] Received SIGTERM. Closing database connection...');
    await closeDb();
    process.exit(0);
});
