// src/services/product-service.ts
'use server';

import { getDb } from '@/lib/db';
import type {
    Category,
    Product,
    ProductModifierSlot,
    // Package, // DEPRECATED: Package is now just a Product with type 'paquete'
    PackageItem,
    PackageItemModifierSlotOverride
} from '@/types/product-types';
import { randomUUID } from 'crypto'; // Import randomUUID

/**
 * Fetches categories, optionally filtering by type.
 * @param type Optional category type ('producto', 'modificador', 'paquete')
 * @returns A promise resolving to an array of Category objects.
 */
export async function getCategories(type?: Category['type']): Promise<Category[]> {
  const db = await getDb();
  try {
    let query = 'SELECT * FROM categories';
    const params: any[] = [];
    if (type) {
        query += ' WHERE type = ?';
        params.push(type);
    }
    query += ' ORDER BY name ASC';
    const categories = await db.all<Category[]>(query, ...params);
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories.');
  }
}

/**
 * Fetches products that are NOT packages within a specific category.
 * @param categoryId The ID of the category.
 * @returns A promise resolving to an array of Product objects.
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  const db = await getDb();
  try {
    // Fetch products BELONGING to the specified category AND whose category type is NOT 'paquete'
     const products = await db.all<Product[]>(`
        SELECT p.*
        FROM products p
        JOIN categories c ON p.categoryId = c.id
        WHERE p.categoryId = ? AND c.type != 'paquete'
        ORDER BY p.name ASC
     `, categoryId);
    return products;
  } catch (error) {
    console.error(`Error fetching non-package products for category ${categoryId}:`, error);
    throw new Error(`Failed to fetch non-package products for category ${categoryId}.`);
  }
}

/**
 * Fetches ONLY packages (products associated with a category of type 'paquete').
 * @param categoryId The ID of the category (usually one with type 'paquete').
 * @returns A promise resolving to an array of Product objects representing packages.
 */
export async function getPackagesByCategory(categoryId: string): Promise<Product[]> {
    const db = await getDb();
    try {
        // Fetch products BELONGING to the specified category AND whose category type IS 'paquete'
         const packages = await db.all<Product[]>(`
            SELECT p.*
            FROM products p
            JOIN categories c ON p.categoryId = c.id
            WHERE p.categoryId = ? AND c.type = 'paquete'
            ORDER BY p.name ASC
        `, categoryId);
        return packages;
    } catch (error) {
        console.error(`Error fetching packages for category ${categoryId}:`, error);
        throw new Error(`Failed to fetch packages for category ${categoryId}.`);
    }
}

/**
 * Fetches a single product or package by its ID.
 * @param productId The ID of the product or package.
 * @returns A promise resolving to a Product object or null if not found.
 */
export async function getProductById(productId: string): Promise<Product | null> {
    const db = await getDb();
    try {
        // This function works for both regular products and packages now
        const product = await db.get<Product>(
            'SELECT * FROM products WHERE id = ?',
             productId
        );
        return product || null;
    } catch (error) {
        console.error(`Error fetching product/package ${productId}:`, error);
        throw new Error(`Failed to fetch product/package ${productId}.`);
    }
}

/**
 * Fetches the modifier slots defined for a specific product.
 * @param productId The ID of the product.
 * @returns A promise resolving to an array of ProductModifierSlot objects.
 */
export async function getModifierSlotsForProduct(productId: string): Promise<ProductModifierSlot[]> {
  const db = await getDb();
  try {
    const slots = await db.all<ProductModifierSlot[]>(`
      SELECT *
      FROM product_modifier_slots
      WHERE product_id = ?
      ORDER BY label ASC
    `, productId);
    return slots;
  } catch (error) {
    console.error(`Error fetching modifier slots for product ${productId}:`, error);
    throw new Error(`Failed to fetch modifier slots for product ${productId}.`);
  }
}

// DEPRECATED: getPackageById is now equivalent to getProductById
// export async function getPackageById(packageId: string): Promise<Product | null> {
//     return getProductById(packageId);
// }

/**
 * Fetches the items (products) included in a specific package definition.
 * @param packageId The ID of the package (which is a product ID).
 * @returns A promise resolving to an array of PackageItem objects, including the product name.
 */
export async function getItemsForPackage(packageId: string): Promise<PackageItem[]> {
    const db = await getDb();
    try {
        // Join with products table to get product name for UI display
        const items = await db.all<PackageItem[]>(`
            SELECT pi.*, p.name as product_name
            FROM package_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.package_id = ?
            ORDER BY pi.display_order ASC, p.name ASC
        `, packageId);
        return items;
    } catch (error) {
        console.error(`Error fetching items for package ${packageId}:`, error);
        throw new Error(`Failed to fetch items for package ${packageId}.`);
    }
}

/**
 * Fetches the modifier slot overrides defined for a specific item within a package.
 * @param packageItemId The unique ID of the item line within the package definition (from package_items table).
 * @returns A promise resolving to an array of PackageItemModifierSlotOverride objects, including the slot label.
 */
export async function getOverridesForPackageItem(packageItemId: string): Promise<PackageItemModifierSlotOverride[]> {
    const db = await getDb();
    try {
        // Join with product_modifier_slots to get the original slot label for UI display
         const overrides = await db.all<PackageItemModifierSlotOverride[]>(`
            SELECT pio.*, pms.label as product_modifier_slot_label
            FROM package_item_modifier_slot_overrides pio
            JOIN product_modifier_slots pms ON pio.product_modifier_slot_id = pms.id
            WHERE pio.package_item_id = ?
        `, packageItemId);
        return overrides;
    } catch (error) {
        console.error(`Error fetching overrides for package item ${packageItemId}:`, error);
        throw new Error(`Failed to fetch overrides for package item ${packageItemId}.`);
    }
}


// --- Functions for Product Settings Page ---

// Example: Add Category
export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const db = await getDb();
  const newCategory = { ...category, id: randomUUID() };
  await db.run('INSERT INTO categories (id, name, type, imageUrl) VALUES (?, ?, ?, ?)',
    newCategory.id, newCategory.name, newCategory.type, newCategory.imageUrl);
  return newCategory;
}

// Example: Add Product (Handles both regular and package products based on category type)
export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const db = await getDb();
  const newProduct = { ...product, id: randomUUID() };
  await db.run('INSERT INTO products (id, name, price, categoryId, imageUrl, inventory_item_id, inventory_consumed_per_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newProduct.id, newProduct.name, newProduct.price, newProduct.categoryId, newProduct.imageUrl, newProduct.inventory_item_id, newProduct.inventory_consumed_per_unit);
  return newProduct;
}

// Example: Add Modifier Slot to Product
export async function addModifierSlot(slot: Omit<ProductModifierSlot, 'id'>): Promise<ProductModifierSlot> {
  const db = await getDb();
  const newSlot = { ...slot, id: randomUUID() };
  await db.run('INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)',
    newSlot.id, newSlot.product_id, newSlot.label, newSlot.linked_category_id, newSlot.min_quantity, newSlot.max_quantity);
  return newSlot;
}

// Example: Add Item to Package
export async function addPackageItem(item: Omit<PackageItem, 'id'>): Promise<PackageItem> {
  const db = await getDb();
  const newItem = { ...item, id: randomUUID() };
  await db.run('INSERT INTO package_items (id, package_id, product_id, quantity, display_order) VALUES (?, ?, ?, ?, ?)',
    newItem.id, newItem.package_id, newItem.product_id, newItem.quantity, newItem.display_order);
  return newItem;
}

// Example: Add/Update Modifier Override for Package Item
// NOTE: Requires adding a UNIQUE constraint in db initialization:
// ALTER TABLE package_item_modifier_slot_overrides ADD CONSTRAINT unique_package_item_slot UNIQUE (package_item_id, product_modifier_slot_id);
export async function setPackageItemOverride(override: Omit<PackageItemModifierSlotOverride, 'id'>): Promise<PackageItemModifierSlotOverride> {
  const db = await getDb();
  const newId = randomUUID();
  // Use INSERT OR REPLACE to handle both adding and updating based on a unique constraint
  await db.run('INSERT OR REPLACE INTO package_item_modifier_slot_overrides (id, package_item_id, product_modifier_slot_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?)',
    newId, override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity);
  // Fetch the potentially replaced/inserted item to return it
  const result = await db.get<PackageItemModifierSlotOverride>('SELECT * FROM package_item_modifier_slot_overrides WHERE package_item_id = ? AND product_modifier_slot_id = ?', override.package_item_id, override.product_modifier_slot_id);
  if (!result) throw new Error("Failed to set package item override");
  return result;
}

// --- Delete Functions ---

export async function deleteCategory(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related products, slots etc.
    await db.run('DELETE FROM categories WHERE id = ?', id);
}

export async function deleteProduct(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related modifier slots, package items etc.
    await db.run('DELETE FROM products WHERE id = ?', id);
}

export async function deleteModifierSlot(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related overrides
    await db.run('DELETE FROM product_modifier_slots WHERE id = ?', id);
}

export async function deletePackageItem(id: string): Promise<void> {
    const db = await getDb();
     // CASCADE delete should handle related overrides
    await db.run('DELETE FROM package_items WHERE id = ?', id);
}

export async function deletePackageItemOverride(id: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM package_item_modifier_slot_overrides WHERE id = ?', id);
}

// Example: Update Category
// export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
//   const db = await getDb();
//   const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
//   const values = Object.values(updates);
//   await db.run(`UPDATE categories SET ${fields} WHERE id = ?`, [...values, id]);
// }

// ... other CRUD functions for update/delete ...
