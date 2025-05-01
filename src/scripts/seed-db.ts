// src/scripts/seed-db.ts
import { getDb, closeDb } from '../lib/db';
import { randomUUID } from 'crypto';

// --- Types (matching database schema) ---
interface Category {
  id: string;
  name: string;
  imageUrl?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: 'pieces' | 'kg';
  initial_stock: number;
  current_stock: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  inventory_item_id?: string;
  inventory_consumed_per_unit?: number;
}

interface ProductModifierSlot {
    id: string;
    product_id: string;
    label: string;
    linked_category_id: string;
    min_quantity: number;
    max_quantity: number;
}

interface Package {
    id: string;
    name: string;
    price: number;
    category_id: string;
    imageUrl?: string;
}

interface PackageItem {
    id: string;
    package_id: string;
    product_id: string;
    quantity: number;
    display_order: number;
}

interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string;
    product_modifier_slot_id: string;
    min_quantity: number;
    max_quantity: number;
}


// --- Seed Data ---

const categories: Category[] = [
  { id: 'cat-alitas', name: 'Alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas' },
  { id: 'cat-costillas', name: 'Costillas', imageUrl: 'https://picsum.photos/200/150?random=costillas' },
  { id: 'cat-salsas', name: 'Salsas', imageUrl: 'https://picsum.photos/200/150?random=salsas' }, // Modifiers will come from here
  { id: 'cat-bebidas', name: 'Bebidas', imageUrl: 'https://picsum.photos/200/150?random=drinks' },
  { id: 'cat-acompanamientos', name: 'Acompañamientos', imageUrl: 'https://picsum.photos/200/150?random=sides' },
  { id: 'cat-paquetes', name: 'Paquetes', imageUrl: 'https://picsum.photos/200/150?random=packages' },
];

const inventoryItems: InventoryItem[] = [
    { id: 'inv-alitas', name: 'Alitas Crudas', unit: 'pieces', initial_stock: 1000, current_stock: 1000},
    { id: 'inv-costillas', name: 'Costillas Crudas', unit: 'pieces', initial_stock: 200, current_stock: 200},
    { id: 'inv-papas', name: 'Papas Fritas Congeladas', unit: 'kg', initial_stock: 50, current_stock: 50},
    { id: 'inv-refresco-lata', name: 'Refresco Lata', unit: 'pieces', initial_stock: 200, current_stock: 200 },
    // Sauces are products, not inventory items themselves unless bought in bulk
];

const products: Product[] = [
  // Alitas
  { id: 'prod-alitas-6', name: 'Alitas 6pz', price: 95, categoryId: 'cat-alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas6', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 6 },
  { id: 'prod-alitas-12', name: 'Alitas 12pz', price: 180, categoryId: 'cat-alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas12', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 12 },
  { id: 'prod-alitas-18', name: 'Alitas 18pz', price: 260, categoryId: 'cat-alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas18', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 18 },
  // Costillas
  { id: 'prod-costillas-5', name: 'Costillas 5pz', price: 150, categoryId: 'cat-costillas', imageUrl: 'https://picsum.photos/200/150?random=costillas5', inventory_item_id: 'inv-costillas', inventory_consumed_per_unit: 5 },
  // Salsas (as products in the 'cat-salsas' category)
  { id: 'prod-salsa-bbq', name: 'Salsa BBQ', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=bbq' },
  { id: 'prod-salsa-bufalo', name: 'Salsa Búfalo', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=bufalo' },
  { id: 'prod-salsa-mango', name: 'Salsa Mango Habanero', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=mango' },
  { id: 'prod-salsa-tamarindo', name: 'Salsa Tamarindo Chipotle', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=tamarindo' },
  { id: 'prod-salsa-valentina', name: 'Salsa Valentina', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=valentina' }, // Example simple sauce
  // Bebidas
  { id: 'prod-refresco-lata', name: 'Refresco de Lata', price: 25, categoryId: 'cat-bebidas', imageUrl: 'https://picsum.photos/200/150?random=can', inventory_item_id: 'inv-refresco-lata', inventory_consumed_per_unit: 1 },
  // Acompañamientos
  { id: 'prod-papas', name: 'Papas Fritas', price: 40, categoryId: 'cat-acompanamientos', imageUrl: 'https://picsum.photos/200/150?random=fries', inventory_item_id: 'inv-papas', inventory_consumed_per_unit: 0.15 }, // Consumes 150g
];

// Modifier Slots: Link products to categories for modifier selection
const modifierSlots: ProductModifierSlot[] = [
    // Alitas 6pz - Can choose up to 2 sauces
    { id: 'slot-alitas6-salsa', product_id: 'prod-alitas-6', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 2 },
    // Alitas 12pz - Can choose up to 3 sauces
    { id: 'slot-alitas12-salsa', product_id: 'prod-alitas-12', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 3 },
    // Alitas 18pz - Can choose up to 4 sauces
    { id: 'slot-alitas18-salsa', product_id: 'prod-alitas-18', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 4 },
    // Costillas 5pz - Can choose up to 2 sauces
    { id: 'slot-costillas5-salsa', product_id: 'prod-costillas-5', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 2 },
    // Add slots for drinks or sides if needed, e.g.:
    // { id: 'slot-combo-bebida', product_id: 'prod-combo-xyz', label: 'Elige Bebida', linked_category_id: 'cat-bebidas', min_quantity: 1, max_quantity: 1 },
];


// Packages
const packages: Package[] = [
    { id: 'pkg-pareja', name: 'Combo Pareja', price: 270, category_id: 'cat-paquetes', imageUrl: 'https://picsum.photos/200/150?random=pareja' }
];

// Items within Packages
const packageItems: PackageItem[] = [
    // Combo Pareja includes Alitas 6pz and Costillas 5pz
    { id: 'pkgitem-pareja-alitas', package_id: 'pkg-pareja', product_id: 'prod-alitas-6', quantity: 1, display_order: 0 },
    { id: 'pkgitem-pareja-costillas', package_id: 'pkg-pareja', product_id: 'prod-costillas-5', quantity: 1, display_order: 1 },
     // Could also include drinks or sides:
     { id: 'pkgitem-pareja-papas', package_id: 'pkg-pareja', product_id: 'prod-papas', quantity: 1, display_order: 2 },
     { id: 'pkgitem-pareja-bebida1', package_id: 'pkg-pareja', product_id: 'prod-refresco-lata', quantity: 1, display_order: 3 },
     { id: 'pkgitem-pareja-bebida2', package_id: 'pkg-pareja', product_id: 'prod-refresco-lata', quantity: 1, display_order: 4 },
];

// Overrides for Modifier Slots within Packages
const packageOverrides: PackageItemModifierSlotOverride[] = [
    // For Combo Pareja -> Alitas 6pz: Allow only 1 sauce (instead of default 2)
    { id: 'override-pareja-alitas-salsa', package_item_id: 'pkgitem-pareja-alitas', product_modifier_slot_id: 'slot-alitas6-salsa', min_quantity: 1, max_quantity: 1 },
    // For Combo Pareja -> Costillas 5pz: Allow only 1 sauce (instead of default 2)
    { id: 'override-pareja-costillas-salsa', package_item_id: 'pkgitem-pareja-costillas', product_modifier_slot_id: 'slot-costillas5-salsa', min_quantity: 1, max_quantity: 1 },
    // No override needed for drinks/sides if they don't have modifier slots or defaults are OK.
];


async function seedDatabase() {
  const db = await getDb();

  try {
    console.log('Starting database seeding...');
    await db.run('BEGIN TRANSACTION;');

    // Clear existing data in reverse order of dependency
    console.log('Clearing existing data...');
    await db.run('DELETE FROM package_item_modifier_slot_overrides;');
    await db.run('DELETE FROM package_items;');
    await db.run('DELETE FROM packages;');
    await db.run('DELETE FROM product_modifier_slots;');
    await db.run('DELETE FROM products;');
     await db.run('DELETE FROM inventory_items;'); // Clear inventory before products
    await db.run('DELETE FROM categories;');
    console.log('Existing data cleared.');

    // Insert Categories
    console.log('Inserting categories...');
    const categoryStmt = await db.prepare('INSERT INTO categories (id, name, imageUrl) VALUES (?, ?, ?)');
    for (const category of categories) {
      await categoryStmt.run(category.id, category.name, category.imageUrl);
    }
    await categoryStmt.finalize();
    console.log(`${categories.length} categories inserted.`);

    // Insert Inventory Items
    console.log('Inserting inventory items...');
    const inventoryStmt = await db.prepare('INSERT INTO inventory_items (id, name, unit, initial_stock, current_stock) VALUES (?, ?, ?, ?, ?)');
    for (const item of inventoryItems) {
        await inventoryStmt.run(item.id, item.name, item.unit, item.initial_stock, item.current_stock);
    }
    await inventoryStmt.finalize();
    console.log(`${inventoryItems.length} inventory items inserted.`);


    // Insert Products
    console.log('Inserting products...');
    const productStmt = await db.prepare('INSERT INTO products (id, name, price, categoryId, imageUrl, inventory_item_id, inventory_consumed_per_unit) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const product of products) {
      await productStmt.run(
        product.id,
        product.name,
        product.price,
        product.categoryId,
        product.imageUrl,
        product.inventory_item_id,
        product.inventory_consumed_per_unit ?? null // Use null if undefined
      );
    }
    await productStmt.finalize();
    console.log(`${products.length} products inserted.`);

    // Insert Modifier Slots
    console.log('Inserting product modifier slots...');
    const slotStmt = await db.prepare('INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)');
    for (const slot of modifierSlots) {
        await slotStmt.run(slot.id, slot.product_id, slot.label, slot.linked_category_id, slot.min_quantity, slot.max_quantity);
    }
    await slotStmt.finalize();
    console.log(`${modifierSlots.length} modifier slots inserted.`);


    // Insert Packages
    console.log('Inserting packages...');
    const packageStmt = await db.prepare('INSERT INTO packages (id, name, price, category_id, imageUrl) VALUES (?, ?, ?, ?, ?)');
    for (const pkg of packages) {
        await packageStmt.run(pkg.id, pkg.name, pkg.price, pkg.category_id, pkg.imageUrl);
    }
    await packageStmt.finalize();
    console.log(`${packages.length} packages inserted.`);

    // Insert Package Items
    console.log('Inserting package items...');
    const packageItemStmt = await db.prepare('INSERT INTO package_items (id, package_id, product_id, quantity, display_order) VALUES (?, ?, ?, ?, ?)');
    for (const item of packageItems) {
        await packageItemStmt.run(item.id, item.package_id, item.product_id, item.quantity, item.display_order);
    }
    await packageItemStmt.finalize();
    console.log(`${packageItems.length} package items inserted.`);

    // Insert Package Item Modifier Slot Overrides
    console.log('Inserting package item modifier slot overrides...');
    const overrideStmt = await db.prepare('INSERT INTO package_item_modifier_slot_overrides (id, package_item_id, product_modifier_slot_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?)');
    for (const override of packageOverrides) {
        await overrideStmt.run(override.id, override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity);
    }
    await overrideStmt.finalize();
    console.log(`${packageOverrides.length} package overrides inserted.`);


    await db.run('COMMIT;');
    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Error during database seeding:', error);
    await db.run('ROLLBACK;');
    console.log('Transaction rolled back.');
  } finally {
    await closeDb();
    console.log('Database connection closed.');
  }
}

seedDatabase().catch(err => {
  console.error("Unhandled error in seed script:", err);
  process.exit(1); // Exit with error code if seeding fails catastrophically
});
