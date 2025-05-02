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
    // Ensure the query selects the 'type' column
    let query = 'SELECT id, name, type, imageUrl FROM categories';
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

// --- Category CRUD ---
export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const db = await getDb();
  const newCategory = { ...category, id: randomUUID() };
  await db.run('INSERT INTO categories (id, name, type, imageUrl) VALUES (?, ?, ?, ?)',
    newCategory.id, newCategory.name, newCategory.type, newCategory.imageUrl);
  return newCategory;
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  if (fields.length === 0) return; // No updates provided
  const result = await db.run(`UPDATE categories SET ${fields} WHERE id = ?`, [...values, id]);
  if (result.changes === 0) throw new Error(`Category with id ${id} not found.`);
}

export async function deleteCategory(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related products, slots etc. if configured correctly in DB schema
    // Verify if products using this category exist before deleting? Or let cascade handle it.
    const result = await db.run('DELETE FROM categories WHERE id = ?', id);
    if (result.changes === 0) throw new Error(`Category with id ${id} not found.`);
}

// --- Product CRUD (also used for Packages) ---
export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const db = await getDb();
  const newProduct = { ...product, id: randomUUID() };
  console.log("[addProduct] Adding Product (or Package) - Attempting INSERT:", JSON.stringify(newProduct, null, 2));
  try {
    await db.run('INSERT INTO products (id, name, price, categoryId, imageUrl, inventory_item_id, inventory_consumed_per_unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newProduct.id,
      newProduct.name,
      newProduct.price,
      newProduct.categoryId,
      newProduct.imageUrl ?? null, // Ensure null if undefined
      newProduct.inventory_item_id ?? null, // Ensure null if undefined
      newProduct.inventory_consumed_per_unit ?? null // Ensure null if undefined
      );
    console.log(`[addProduct] Product/Package successfully added with ID: ${newProduct.id}`);
    return newProduct;
  } catch (error) {
    console.error(`[addProduct] Error inserting Product/Package with ID ${newProduct.id}:`, error); // Log the error
    throw error; // Re-throw the error so the frontend knows it failed
  }
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id'>>): Promise<void> {
  const db = await getDb();
   // Prepare updates, ensuring potential undefined values from form are handled
   const validUpdates: Partial<Product> = {};
   let query = 'UPDATE products SET ';
   const params: any[] = [];

   Object.entries(updates).forEach(([key, value]) => {
     // Handle optional fields that might come as empty strings from forms
     if (key === 'imageUrl' && value === '') {
       validUpdates[key as keyof Product] = null; // Store null in DB if image URL is cleared
     } else if (key === 'inventory_item_id' && (value === '' || value === null || value === '__NONE__')) { // Check for null/empty/placeholder
        validUpdates[key as keyof Product] = null; // Unlink inventory item
        // Also nullify consumption if inventory is unlinked
        validUpdates['inventory_consumed_per_unit'] = null;
     } else if (value !== undefined) {
        validUpdates[key as keyof Product] = value as any;
     }
   });

    // If inventory is linked, ensure consumption is set (default to 1 if not provided and not explicitly set to null)
   if (validUpdates.inventory_item_id && validUpdates.inventory_consumed_per_unit === undefined) {
        validUpdates.inventory_consumed_per_unit = 1;
   }
   // If inventory is unlinked, ensure consumption is null
   if (validUpdates.inventory_item_id === null) {
        validUpdates.inventory_consumed_per_unit = null;
   }


   const fields = Object.keys(validUpdates);
   if (fields.length === 0) {
        console.log("No valid updates provided for product", id);
        return; // No valid updates provided
   }


   query += fields.map(field => `${field} = ?`).join(', ');
   query += ' WHERE id = ?';
   params.push(...Object.values(validUpdates), id);

   console.log("Updating Product:", query, params);

   const result = await db.run(query, params);
   if (result.changes === 0) throw new Error(`Product with id ${id} not found.`);
   console.log("Product updated successfully:", id);
}


export async function deleteProduct(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related modifier slots, package items etc.
    const result = await db.run('DELETE FROM products WHERE id = ?', id);
    if (result.changes === 0) throw new Error(`Product with id ${id} not found.`);
}


// --- Modifier Slot CRUD ---
export async function addModifierSlot(slot: Omit<ProductModifierSlot, 'id'>): Promise<ProductModifierSlot> {
  const db = await getDb();
  const newSlot = { ...slot, id: randomUUID() };
  await db.run('INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)',
    newSlot.id, newSlot.product_id, newSlot.label, newSlot.linked_category_id, newSlot.min_quantity, newSlot.max_quantity);
  return newSlot;
}

// TODO: Implement updateModifierSlot


// --- Package Item CRUD ---
export async function addPackageItem(item: Omit<PackageItem, 'id' | 'product_name'>): Promise<PackageItem> {
  const db = await getDb();
  const newItem = { ...item, id: randomUUID() };

  // Detailed Logging for Debugging FK Constraint
  console.log(`[addPackageItem] START: Attempting to add item. Input Data:`, item);
  console.log(`[addPackageItem] Generated newItem object:`, newItem);

  // Pre-check if package_id exists in products table
  const packageExists = await db.get('SELECT id, name FROM products WHERE id = ?', newItem.package_id);
  if (!packageExists) {
    const errorMsg = `[addPackageItem] FOREIGN KEY PRE-CHECK FAILED: Package (Product) with ID ${newItem.package_id} does not exist in products table. Cannot add item.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  } else {
     console.log(`[addPackageItem] Pre-check PASSED: Found package (Product) ID ${newItem.package_id} with name "${packageExists.name}".`);
  }

  // Pre-check if product_id exists in products table
  const productExists = await db.get('SELECT id, name FROM products WHERE id = ?', newItem.product_id);
  if (!productExists) {
     const errorMsg = `[addPackageItem] FOREIGN KEY PRE-CHECK FAILED: Product with ID ${newItem.product_id} does not exist in products table. Cannot add item.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  } else {
     console.log(`[addPackageItem] Pre-check PASSED: Found product ID ${newItem.product_id} with name "${productExists.name}".`);
  }

  console.log(`[addPackageItem] All pre-checks passed. Proceeding with INSERT into package_items.`);

  // Proceed with insert
  try {
    await db.run('INSERT INTO package_items (id, package_id, product_id, quantity, display_order) VALUES (?, ?, ?, ?, ?)',
      newItem.id, newItem.package_id, newItem.product_id, newItem.quantity, newItem.display_order);
    console.log(`[addPackageItem] SUCCESS: Inserted package item with ID ${newItem.id} linking Package ${newItem.package_id} and Product ${newItem.product_id}.`);

     // Return the newly created item structure (without product_name initially)
     return {
         id: newItem.id,
         package_id: newItem.package_id,
         product_id: newItem.product_id,
         quantity: newItem.quantity,
         display_order: newItem.display_order,
         // product_name is added later in the UI/calling function
     };
  } catch (error) {
      console.error(`[addPackageItem] SQLITE INSERT ERROR for package_items: ID=${newItem.id}, PackageID=${newItem.package_id}, ProductID=${newItem.product_id}. Error details:`, error);
      // Rethrowing the original error might be better for consistent error handling upstream
      if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
         throw new Error(`Database constraint error: Ensure package ID '${newItem.package_id}' and product ID '${newItem.product_id}' are valid. Original error: ${error.message}`);
      }
      throw error; // Re-throw the original error if it's not a specific FK issue we handled
  }
}


// TODO: Implement updatePackageItem


// --- Package Override CRUD ---
export async function setPackageItemOverride(override: Omit<PackageItemModifierSlotOverride, 'id'>): Promise<PackageItemModifierSlotOverride> {
  const db = await getDb();
  const newId = randomUUID();
  // Use INSERT OR REPLACE to handle both adding and updating based on a unique constraint
  // Ensure the unique constraint (package_item_id, product_modifier_slot_id) exists in the DB schema.
  await db.run('INSERT OR REPLACE INTO package_item_modifier_slot_overrides (package_item_id, product_modifier_slot_id, min_quantity, max_quantity, id) VALUES (?, ?, ?, ?, ?)',
     override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity, newId); // Add ID for replace to work or fetch after
  // Fetch the potentially replaced/inserted item to return it
  const result = await db.get<PackageItemModifierSlotOverride>('SELECT * FROM package_item_modifier_slot_overrides WHERE package_item_id = ? AND product_modifier_slot_id = ?', override.package_item_id, override.product_modifier_slot_id);
  if (!result) throw new Error("Failed to set package item override");
  return result;
}

// TODO: Implement deletePackageItemOverride


// Existing delete functions - make sure they handle errors if item not found
export async function deleteModifierSlot(id: string): Promise<void> {
    const db = await getDb();
    // CASCADE delete should handle related overrides
    const result = await db.run('DELETE FROM product_modifier_slots WHERE id = ?', id);
    if (result.changes === 0) throw new Error(`Modifier slot with id ${id} not found.`);
}

export async function deletePackageItem(id: string): Promise<void> {
    const db = await getDb();
     // CASCADE delete should handle related overrides
    const result = await db.run('DELETE FROM package_items WHERE id = ?', id);
    if (result.changes === 0) throw new Error(`Package item with id ${id} not found.`);
}

export async function deletePackageItemOverride(id: string): Promise<void> {
    const db = await getDb();
    const result = await db.run('DELETE FROM package_item_modifier_slot_overrides WHERE id = ?', id);
    if (result.changes === 0) throw new Error(`Package override with id ${id} not found.`);
}
