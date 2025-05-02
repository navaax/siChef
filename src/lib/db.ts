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
      // Ensure the directory exists (though process.cwd() should exist)
      // This is more relevant if dbPath were in a subdirectory like 'data/'
      // await fs.mkdir(path.dirname(dbPath), { recursive: true });

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

  // Create tables if they don't exist, ensuring 'type' column is included
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto', -- Ensure type column exists
      imageUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('pieces', 'kg')), -- Enforce specific units
      initial_stock REAL DEFAULT 0,
      current_stock REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      categoryId TEXT NOT NULL,
      imageUrl TEXT,
      inventory_item_id TEXT, -- Link to inventory item (optional)
      inventory_consumed_per_unit REAL DEFAULT 1, -- How much inventory is used per product unit sold
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL -- Keep product if inventory deleted
    );

    -- Defines slots on a product where modifiers (from another category) can be chosen
    CREATE TABLE IF NOT EXISTS product_modifier_slots (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      label TEXT NOT NULL, -- UI Label e.g., "Choose Sauces", "Select Drink"
      linked_category_id TEXT NOT NULL, -- Category from which options are drawn
      min_quantity INTEGER NOT NULL DEFAULT 0,
      max_quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- Items included within a package (which is now a product of type 'paquete')
    CREATE TABLE IF NOT EXISTS package_items (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL, -- This is the product_id of the package
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1, -- How many of this product are in the package
        display_order INTEGER DEFAULT 0,
        FOREIGN KEY (package_id) REFERENCES products(id) ON DELETE CASCADE, -- Link to the package product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE -- If product deleted, package item is invalid
    );

    -- Overrides the default modifier slot rules for a specific item *within a package*
    CREATE TABLE IF NOT EXISTS package_item_modifier_slot_overrides (
        id TEXT PRIMARY KEY,
        package_item_id TEXT NOT NULL,
        product_modifier_slot_id TEXT NOT NULL, -- Which slot on the original product is being overridden
        min_quantity INTEGER NOT NULL,
        max_quantity INTEGER NOT NULL,
        FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE CASCADE,
        FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
        UNIQUE (package_item_id, product_modifier_slot_id) -- Ensures only one override per slot per package item
    );

  `);

  // Attempt to add the 'type' column to categories if it doesn't exist
  try {
    await dbInstance.exec(`
      ALTER TABLE categories ADD COLUMN type TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto';
    `);
    console.log("Successfully added 'type' column to 'categories' table (if it didn't exist).");
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate column name: type')) {
       // console.log("'type' column already exists in 'categories' table.");
    } else {
      console.error("Error attempting to add 'type' column to categories:", error);
    }
  }

  // Attempt to add 'inventory_item_id' column to products if it doesn't exist
  try {
    await dbInstance.exec(`
      ALTER TABLE products ADD COLUMN inventory_item_id TEXT;
    `);
     // Add foreign key constraint separately (might fail if data violates it initially)
     try {
        await dbInstance.exec(`ALTER TABLE products ADD CONSTRAINT fk_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL;`);
     } catch (fkError: any) {
        // Ignore if constraint already exists or handle specific FK errors
        if (!fkError.message.includes('duplicate constraint name')) {
             console.warn("Could not add foreign key for inventory_item_id initially (data might need cleanup or constraint exists):", fkError.message);
        }
     }
    console.log("Successfully added 'inventory_item_id' column to 'products' table (if it didn't exist).");
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate column name: inventory_item_id')) {
       // console.log("'inventory_item_id' column already exists in 'products' table.");
    } else {
      console.error("Error attempting to add 'inventory_item_id' column to products:", error);
    }
  }

  // Attempt to add 'inventory_consumed_per_unit' column to products if it doesn't exist
  try {
    await dbInstance.exec(`
      ALTER TABLE products ADD COLUMN inventory_consumed_per_unit REAL DEFAULT 1;
    `);
    console.log("Successfully added 'inventory_consumed_per_unit' column to 'products' table (if it didn't exist).");
  } catch (error: any) {
    if (error.message && error.message.includes('duplicate column name: inventory_consumed_per_unit')) {
       // console.log("'inventory_consumed_per_unit' column already exists in 'products' table.");
    } else {
      console.error("Error attempting to add 'inventory_consumed_per_unit' column to products:", error);
    }
  }

  // console.log("Database schema initialized/updated.");
}

// Example of how to close the database (optional, depends on app lifecycle)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    // console.log("Database connection closed.");
  }
}
