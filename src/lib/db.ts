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
      console.log(`[DB] Attempting to open database at: ${dbPath}`);
      const newDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      db = newDb;
      console.log("[DB] Database opened successfully.");
      await initializeDb(db); // Asegurar que el esquema se cree/actualice en la primera conexión
    } catch (error) {
      console.error("[DB] Failed to open database:", error);
      throw error; // Re-lanzar el error para indicar fallo
    }
  }
  return db;
}

async function initializeDb(dbInstance: Database): Promise<void> {
  console.log("[DB] Initializing database schema...");
  // Usar PRAGMA foreign_keys=ON; para forzar restricciones de clave foránea
  await dbInstance.exec('PRAGMA foreign_keys=ON;');
  console.log("[DB] PRAGMA foreign_keys=ON executed.");

  // Crear tablas si no existen
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
        category_id TEXT, -- Opcional: Para agrupación UI
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
      linked_category_id TEXT NOT NULL, -- Categoría de donde provienen las opciones (tipo 'modificador')
      min_quantity INTEGER NOT NULL DEFAULT 0,
      max_quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- NUEVA TABLA: Almacena las opciones específicas permitidas para un slot de modificador
    CREATE TABLE IF NOT EXISTS product_modifier_slot_options (
      id TEXT PRIMARY KEY,
      product_modifier_slot_id TEXT NOT NULL,
      modifier_product_id TEXT NOT NULL, -- El producto específico (tipo modificador) permitido
      FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (modifier_product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE (product_modifier_slot_id, modifier_product_id) -- Asegura que un producto no se añada dos veces al mismo slot
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
  `);

  console.log("[DB] Basic tables created or verified.");

  // --- Intentar añadir columnas nuevas si no existen (Mejor esfuerzo para BD existentes) ---
  const columnsToAdd = [
    { table: 'categories', column: 'type', definition: "TEXT CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto'" },
    { table: 'products', column: 'inventory_item_id', definition: 'TEXT' },
    { table: 'products', column: 'inventory_consumed_per_unit', definition: 'REAL DEFAULT 1' },
    { table: 'packages', column: 'category_id', definition: 'TEXT' }, // Asegurar que esta columna exista
  ];

  for (const { table, column, definition } of columnsToAdd) {
    try {
      await dbInstance.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      console.log(`[DB] Attempted to add column '${column}' to table '${table}'.`);
    } catch (error: any) {
      // Ignorar error si la columna ya existe
      if (!error.message?.includes('duplicate column name')) {
        console.warn(`[DB] Warning adding column '${column}' to table '${table}' (might already exist or other issue):`, error.message);
      } else {
        // console.log(`[DB] Column '${column}' already exists in table '${table}'.`);
      }
    }
  }

   // Añadir FK para packages.category_id si no existe (manejo de errores simple)
   /* // Esto es más complejo y propenso a errores si la tabla ya tiene datos que violan la FK.
      // Se asume que la creación inicial de la tabla ya incluye la FK.
   try {
       await dbInstance.exec(`
           -- No se puede añadir FK con ALTER TABLE en SQLite de forma simple y segura
           -- Se asume que la tabla se creó correctamente con la FK
       `);
   } catch (error: any) {
       console.warn("[DB] Could not ensure foreign key on packages.category_id (might require manual migration):", error.message);
   }
   */


  console.log("[DB] Database schema initialized/verified.");
}

// Ejemplo de cómo cerrar la base de datos (opcional, depende del ciclo de vida de la app)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log("[DB] Database connection closed.");
  }
}
