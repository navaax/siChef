// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Ensure the database file path is correct, especially in production builds
const dbPath = path.join(process.cwd(), 'sichef.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    try {
      const newDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      db = newDb;
      await initializeDb(db); // Ensure schema is created/updated on first connect
    } catch (error) {
      console.error("Failed to open database:", error);
      throw error; // Re-throw the error to indicate failure
    }
  }
  return db;
}

async function initializeDb(dbInstance: Database): Promise<void> {
  // Use PRAGMA foreign_keys=ON; for enforcing foreign key constraints
  await dbInstance.exec('PRAGMA foreign_keys=ON;');

  // Create tables if they don't exist
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      -- Type is kept for potential UI grouping, but not for package identification
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

    -- Defines slots on a product where modifiers (from another category) can be chosen
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

    -- *** NEW: packages table ***
    CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        imageUrl TEXT
        -- categoryId TEXT, -- Optional: For UI grouping, can be added later if needed
        -- FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Items included within a package
    CREATE TABLE IF NOT EXISTS package_items (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL, -- *** UPDATED: References packages table ***
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE, -- *** UPDATED FK ***
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Overrides the default modifier slot rules for a specific item *within a package*
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

  // --- Attempt to add new columns if they don't exist (Best effort for existing DBs) ---

   // Attempt to add 'type' column to categories if it doesn't exist
   // This might not be strictly necessary anymore but kept for potential UI grouping
  try {
    await dbInstance.exec(`ALTER TABLE categories ADD COLUMN type TEXT CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto';`);
    console.log("Attempted to add 'type' column to 'categories' table (if it didn't exist).");
  } catch (error: any) {
    if (!error.message?.includes('duplicate column name')) {
      console.warn("Warning adding 'type' column to categories (might already exist or other issue):", error.message);
    }
  }

  // Attempt to add inventory columns to products if they don't exist
  try {
    await dbInstance.exec(`ALTER TABLE products ADD COLUMN inventory_item_id TEXT;`);
    console.log("Attempted to add 'inventory_item_id' column to 'products' table (if it didn't exist).");
  } catch (error: any) {
    if (!error.message?.includes('duplicate column name')) {
        console.warn("Warning adding 'inventory_item_id' column to products (might already exist):", error.message);
    }
  }
   try {
     await dbInstance.exec(`ALTER TABLE products ADD COLUMN inventory_consumed_per_unit REAL DEFAULT 1;`);
     console.log("Attempted to add 'inventory_consumed_per_unit' column to 'products' table (if it didn't exist).");
   } catch (error: any) {
      if (!error.message?.includes('duplicate column name')) {
          console.warn("Warning adding 'inventory_consumed_per_unit' column to products (might already exist):", error.message);
      }
   }


  console.log("Database schema initialized/verified.");
}

// Example of how to close the database (optional, depends on app lifecycle)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log("Database connection closed.");
  }
}
