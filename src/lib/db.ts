// src/lib/db.ts
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

// Ensure the database file path is correct, especially in production builds
const dbPath = path.join(process.cwd(), 'sichef.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    // console.log(`Opening database at: ${dbPath}`);
    try {
      const newDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      // console.log("Database opened successfully.");
      db = newDb;
      await initializeDb(db); // Ensure schema is created on first connect
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
      imageUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      categoryId TEXT NOT NULL,
      imageUrl TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS modifiers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priceModifier REAL DEFAULT 0
    );

    -- Junction table for many-to-many relationship between products and modifiers
    CREATE TABLE IF NOT EXISTS product_modifiers (
      productId TEXT NOT NULL,
      modifierId TEXT NOT NULL,
      PRIMARY KEY (productId, modifierId),
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (modifierId) REFERENCES modifiers(id) ON DELETE CASCADE
    );
  `);
  // console.log("Database schema initialized (if not exists).");
}

// Example of how to close the database (optional, depends on app lifecycle)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    // console.log("Database connection closed.");
  }
}
