'use server';

import { getDb } from '@/lib/db';
import type {
    Category,
    Product,
    ProductModifierSlot,
    Package,
    PackageItem,
    PackageItemModifierSlotOverride
} from '@/types/product-types';

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  try {
    const categories = await db.all<Category[]>('SELECT * FROM categories ORDER BY name ASC');
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories.');
  }
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  const db = await getDb();
  try {
    const products = await db.all<Product[]>('SELECT * FROM products WHERE categoryId = ? ORDER BY name ASC', categoryId);
    return products;
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId}:`, error);
    throw new Error(`Failed to fetch products for category ${categoryId}.`);
  }
}

export async function getProductById(productId: string): Promise<Product | null> {
    const db = await getDb();
    try {
        const product = await db.get<Product>(
            'SELECT * FROM products WHERE id = ?',
             productId
        );
        return product || null;
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error);
        throw new Error(`Failed to fetch product ${productId}.`);
    }
}

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

export async function getPackagesByCategory(categoryId: string): Promise<Package[]> {
    const db = await getDb();
    try {
        const packages = await db.all<Package[]>('SELECT * FROM packages WHERE category_id = ? ORDER BY name ASC', categoryId);
        return packages;
    } catch (error) {
        console.error(`Error fetching packages for category ${categoryId}:`, error);
        throw new Error(`Failed to fetch packages for category ${categoryId}.`);
    }
}

export async function getPackageById(packageId: string): Promise<Package | null> {
    const db = await getDb();
    try {
        const pkg = await db.get<Package>('SELECT * FROM packages WHERE id = ?', packageId);
        return pkg || null;
    } catch (error) {
        console.error(`Error fetching package ${packageId}:`, error);
        throw new Error(`Failed to fetch package ${packageId}.`);
    }
}


export async function getItemsForPackage(packageId: string): Promise<PackageItem[]> {
    const db = await getDb();
    try {
        // Join with products table to get product name
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

export async function getOverridesForPackageItem(packageItemId: string): Promise<PackageItemModifierSlotOverride[]> {
    const db = await getDb();
    try {
        // Join with product_modifier_slots to get the label for the UI
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


// Potential future functions:
// export async function addProduct(...) { ... }
// export async function updateProduct(...) { ... }
// export async function addCategory(...) { ... }
// export async function addPackage(...) { ... }
// export async function updatePackage(...) { ... }
// export async function addInventoryItem(...) { ... }
// export async function updateInventory(...) { ... }
