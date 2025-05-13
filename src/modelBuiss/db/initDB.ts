// src/modelBuiss/config/bd/initDB.ts
import { openDB as openDatabase }  from './db';
var jsonRespones = { estatus: 200, message: 'Configuracion Bd en proceso', success: true };
export const initDB = async () => {
  const db = await openDatabase();

  // Ejecutar en transacción por performance y rollback automático si falla
  try {
    await db.transaction(async tx => {
        // Tabla: categories
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            imageUrl TEXT,
            type TEXT NOT NULL CHECK(type IN ('producto', 'modificador', 'paquete')) DEFAULT 'producto'
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_id ON categories(id);`);
    
        // Tabla: products
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            categoryId TEXT NOT NULL,
            imageUrl TEXT,
            inventory_item_id TEXT,
            inventory_consumed_per_unit REAL DEFAULT 1,
            FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);`);
    
        // Tabla: package_item_modifier_slot_overrides
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS package_item_modifier_slot_overrides (
            id TEXT PRIMARY KEY,
            package_item_id TEXT NOT NULL,
            product_modifier_slot_id TEXT NOT NULL,
            min_quantity INTEGER NOT NULL,
            max_quantity INTEGER NOT NULL,
            FOREIGN KEY (package_item_id) REFERENCES package_items(id) ON DELETE CASCADE,
            FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_package_item_modifier_slot_overrides_package_item_id ON package_item_modifier_slot_overrides(package_item_id);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_package_item_modifier_slot_overrides_product_modifier_slot_id ON package_item_modifier_slot_overrides(product_modifier_slot_id);`);
    
        // Tabla: package_items
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS package_items (
            id TEXT PRIMARY KEY,
            package_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            display_order INTEGER DEFAULT 0,
            FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON package_items(package_id);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_package_items_product_id ON package_items(product_id);`);
    
        // Tabla: packages
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS packages (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category_id TEXT NOT NULL,
            imageUrl TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_packages_category_id ON packages(category_id);`);
    
        // Tabla: product_modifier_slots
        tx.executeSql(`
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
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifier_slots_product_id ON product_modifier_slots(product_id);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifier_slots_linked_category_id ON product_modifier_slots(linked_category_id);`);
    
        // Tabla: inventory_items
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS inventory_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL CHECK(unit IN ('pieces', 'kg')),
            initial_stock REAL DEFAULT 0,
            current_stock REAL DEFAULT 0
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_items_id ON inventory_items(id);`);
    
        // Tabla: product_modifiers
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS product_modifiers (
            productId TEXT NOT NULL,
            modifierId TEXT NOT NULL,
            PRIMARY KEY (productId, modifierId),
            FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (modifierId) REFERENCES modifiers(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifiers_productId ON product_modifiers(productId);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifiers_modifierId ON product_modifiers(modifierId);`);
    
        // Tabla: modifiers
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS modifiers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            priceModifier REAL DEFAULT 0
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_modifiers_id ON modifiers(id);`);
    
        // Tabla: cash_session_details
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS cash_session_details (
            id TEXT PRIMARY KEY,
            cash_session_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('start', 'end')),
            denomination_value REAL NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (cash_session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_cash_session_details_cash_session_id ON cash_session_details(cash_session_id);`);
    
        // Tabla: cash_sessions
        tx.executeSql(`
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
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_cash_sessions_id ON cash_sessions(id);`);
    
        // Tabla: product_modifier_slot_options
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS product_modifier_slot_options (
            id TEXT PRIMARY KEY,
            product_modifier_slot_id TEXT NOT NULL,
            modifier_product_id TEXT NOT NULL,
            FOREIGN KEY (product_modifier_slot_id) REFERENCES product_modifier_slots(id) ON DELETE CASCADE,
            FOREIGN KEY (modifier_product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE (product_modifier_slot_id, modifier_product_id)
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifier_slot_options_product_modifier_slot_id ON product_modifier_slot_options(product_modifier_slot_id);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_product_modifier_slot_options_modifier_product_id ON product_modifier_slot_options(modifier_product_id);`);
    
        // Usuario admin inicial (si fuera necesario)
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            pin TEXT NOT NULL
          );
        `);
        tx.executeSql(`
          INSERT OR IGNORE INTO users (id, username, pin)
          VALUES ('1', 'admin', '1234');
        `);
      });
  } catch (error: any) {
    console.error("Error al inicializar la base de datos:", error.message);
    jsonRespones = { estatus: 500, message: `BD error: ${error.message}`, success: false };
  }

  return jsonRespones;
};