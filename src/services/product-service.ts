// src/services/product-service.ts
'use server';

import { getDb } from '@/lib/db';
import type {
    Category,
    Product,
    Package,
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride
} from '@/types/product-types';
import { randomUUID } from 'crypto';

/**
 * Obtiene categorías, opcionalmente filtrando por tipo.
 * @param type Tipo de categoría opcional ('producto', 'modificador', 'paquete')
 * @returns Una promesa que resuelve a un array de objetos Category.
 */
export async function getCategories(type?: Category['type']): Promise<Category[]> {
  const db = await getDb();
  try {
    let query = 'SELECT id, name, type, imageUrl FROM categories';
    const params: any[] = [];
    if (type) {
        query += ' WHERE type = ?';
        params.push(type);
    }
    query += ' ORDER BY name ASC';
    console.log(`[getCategories] Query: ${query}, Params: ${JSON.stringify(params)}`);
    const categories = await db.all<Category[]>(query, params);
    console.log(`[getCategories] Found ${categories.length} categories.`);
    return categories;
  } catch (error) {
    console.error('[getCategories] Error fetching categories:', error);
    throw new Error(`Falló la obtención de categorías. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Obtiene productos (NO modificadores, NO paquetes) dentro de una categoría específica.
 * @param categoryId El ID de la categoría (debe ser tipo 'producto').
 * @returns Una promesa que resuelve a un array de objetos Product.
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  const db = await getDb();
  try {
    const query = `
        SELECT p.*
        FROM products p
        JOIN categories c ON p.categoryId = c.id
        WHERE p.categoryId = ? AND c.type = 'producto'
        ORDER BY p.name ASC
     `;
    console.log(`[getProductsByCategory] Query: ${query}, Params: [${categoryId}]`);
    const products = await db.all<Product[]>(query, [categoryId]);
    console.log(`[getProductsByCategory] Found ${products.length} products for category ${categoryId}.`);
    return products;
  } catch (error) {
    console.error(`[getProductsByCategory] Error fetching products for category ${categoryId}:`, error);
    throw new Error(`Falló la obtención de productos para la categoría ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Obtiene opciones modificadoras (productos asociados a una categoría de tipo 'modificador').
 * @param categoryId El ID de la categoría (debe ser tipo 'modificador').
 * @returns Una promesa que resuelve a un array de objetos Product que representan opciones modificadoras.
 */
export async function getModifiersByCategory(categoryId: string): Promise<Product[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT p.*
            FROM products p
            JOIN categories c ON p.categoryId = c.id
            WHERE p.categoryId = ? AND c.type = 'modificador'
            ORDER BY p.name ASC
        `;
        console.log(`[getModifiersByCategory] Query: ${query}, Params: [${categoryId}]`);
        const modifiers = await db.all<Product[]>(query, [categoryId]);
         console.log(`[getModifiersByCategory] Found ${modifiers.length} modifiers for category ${categoryId}.`);
        return modifiers;
    } catch (error) {
        console.error(`[getModifiersByCategory] Error fetching modifiers for category ${categoryId}:`, error);
        throw new Error(`Falló la obtención de modificadores para la categoría ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene todos los paquetes definidos.
 * @returns Una promesa que resuelve a un array de objetos Package.
 */
export async function getAllPackages(): Promise<Package[]> {
    const db = await getDb();
    try {
        // Usar category_id de la tabla packages
        const query = 'SELECT p.*, c.name as categoryName FROM packages p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.name ASC';
        console.log(`[getAllPackages] Query: ${query}`);
        const packages = await db.all<Package[]>(query);
        console.log(`[getAllPackages] Found ${packages.length} packages.`);
        return packages;
    } catch (error) {
        console.error(`[getAllPackages] Error fetching packages:`, error);
        throw new Error(`Falló la obtención de paquetes. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene paquetes asociados a una categoría específica (para UI).
 * @param categoryId El ID de la categoría (usualmente tipo 'paquete').
 * @returns Una promesa que resuelve a un array de objetos Package.
 */
export async function getPackagesByCategory(categoryId: string): Promise<Package[]> {
  const db = await getDb();
  try {
    const query = `
        SELECT *
        FROM packages
        WHERE category_id = ?
        ORDER BY name ASC
     `;
    console.log(`[getPackagesByCategory] Query: ${query}, Params: [${categoryId}]`);
    const packages = await db.all<Package[]>(query, [categoryId]);
    console.log(`[getPackagesByCategory] Found ${packages.length} packages for category ${categoryId}.`);
    return packages;
  } catch (error) {
    console.error(`[getPackagesByCategory] Error fetching packages for category ${categoryId}:`, error);
    throw new Error(`Falló la obtención de paquetes para la categoría ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Obtiene un solo producto por su ID.
 * @param productId El ID del producto.
 * @returns Una promesa que resuelve a un objeto Product o null si no se encuentra.
 */
export async function getProductById(productId: string): Promise<Product | null> {
    const db = await getDb();
    try {
        const query = 'SELECT * FROM products WHERE id = ?';
        console.log(`[getProductById] Query: ${query}, Params: [${productId}]`);
        const product = await db.get<Product>(query, [productId]);
        console.log(`[getProductById] Product ${productId} found: ${!!product}`);
        return product || null;
    } catch (error) {
        console.error(`[getProductById] Error fetching product ${productId}:`, error);
        throw new Error(`Falló la obtención del producto ${productId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene un solo paquete por su ID.
 * @param packageId El ID del paquete.
 * @returns Una promesa que resuelve a un objeto Package o null si no se encuentra.
 */
export async function getPackageById(packageId: string): Promise<Package | null> {
    const db = await getDb();
    try {
         const query = 'SELECT * FROM packages WHERE id = ?';
         console.log(`[getPackageById] Query: ${query}, Params: [${packageId}]`);
        const pkg = await db.get<Package>(query, [packageId]);
        console.log(`[getPackageById] Package ${packageId} found: ${!!pkg}`);
        return pkg || null;
    } catch (error) {
        console.error(`[getPackageById] Error fetching package ${packageId}:`, error);
        throw new Error(`Falló la obtención del paquete ${packageId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene los slots modificadores definidos para un producto específico.
 * @param productId El ID del producto.
 * @returns Una promesa que resuelve a un array de objetos ProductModifierSlot.
 */
export async function getModifierSlotsForProduct(productId: string): Promise<ProductModifierSlot[]> {
  const db = await getDb();
  try {
    const query = `
      SELECT *
      FROM product_modifier_slots
      WHERE product_id = ?
      ORDER BY label ASC
    `;
    console.log(`[getModifierSlotsForProduct] Query: ${query}, Params: [${productId}]`);
    const slots = await db.all<ProductModifierSlot[]>(query, [productId]);
    console.log(`[getModifierSlotsForProduct] Found ${slots.length} slots for product ${productId}.`);
    return slots;
  } catch (error) {
    console.error(`[getModifierSlotsForProduct] Error fetching modifier slots for product ${productId}:`, error);
    throw new Error(`Falló la obtención de slots modificadores para el producto ${productId}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Obtiene los items (productos) incluidos en la definición de un paquete específico.
 * @param packageId El ID del paquete.
 * @returns Una promesa que resuelve a un array de objetos PackageItem, incluyendo el nombre del producto.
 */
export async function getItemsForPackage(packageId: string): Promise<PackageItem[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT pi.*, p.name as product_name
            FROM package_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.package_id = ?
            ORDER BY pi.display_order ASC, p.name ASC
        `;
         console.log(`[getItemsForPackage] Query: ${query}, Params: [${packageId}]`);
        const items = await db.all<PackageItem[]>(query, [packageId]);
        console.log(`[getItemsForPackage] Found ${items.length} items for package ${packageId}.`);
        return items;
    } catch (error) {
        console.error(`[getItemsForPackage] Error fetching items for package ${packageId}:`, error);
        throw new Error(`Falló la obtención de items para el paquete ${packageId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene los overrides de slots modificadores definidos para un item específico dentro de un paquete.
 * @param packageItemId El ID único de la línea de item dentro de la definición del paquete (de la tabla package_items).
 * @returns Una promesa que resuelve a un array de objetos PackageItemModifierSlotOverride, incluyendo la etiqueta del slot.
 */
export async function getOverridesForPackageItem(packageItemId: string): Promise<PackageItemModifierSlotOverride[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT pio.*, pms.label as product_modifier_slot_label
            FROM package_item_modifier_slot_overrides pio
            JOIN product_modifier_slots pms ON pio.product_modifier_slot_id = pms.id
            WHERE pio.package_item_id = ?
        `;
         console.log(`[getOverridesForPackageItem] Query: ${query}, Params: [${packageItemId}]`);
        const overrides = await db.all<PackageItemModifierSlotOverride[]>(query, [packageItemId]);
         console.log(`[getOverridesForPackageItem] Found ${overrides.length} overrides for package item ${packageItemId}.`);
        return overrides;
    } catch (error) {
        console.error(`[getOverridesForPackageItem] Error fetching overrides for package item ${packageItemId}:`, error);
        throw new Error(`Falló la obtención de overrides para el item de paquete ${packageItemId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


// --- Funciones para la Página de Ajustes de Productos ---

// --- CRUD Categoría ---
export async function addCategory(category: Omit<Category, 'id'>): Promise<Category> {
  const db = await getDb();
  const newCategory = { ...category, id: randomUUID() };
  try {
    const query = 'INSERT INTO categories (id, name, type, imageUrl) VALUES (?, ?, ?, ?)';
    console.log(`[addCategory] Query: ${query}, Params: [${newCategory.id}, ${newCategory.name}, ${newCategory.type}, ${newCategory.imageUrl}]`);
    await db.run(query, [newCategory.id, newCategory.name, newCategory.type, newCategory.imageUrl]);
    console.log(`[addCategory] Category ${newCategory.id} added successfully.`);
    return newCategory;
  } catch (error) {
      console.error(`[addCategory] Error adding category ${newCategory.name}:`, error);
      throw new Error(`Falló al añadir categoría. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  if (fields.length === 0) return; // No hay nada que actualizar
  try {
    const query = `UPDATE categories SET ${fields} WHERE id = ?`;
    const params = [...values, id];
    console.log(`[updateCategory] Query: ${query}, Params: ${JSON.stringify(params)}`);
    const result = await db.run(query, params);
    if (result.changes === 0) throw new Error(`Categoría con id ${id} no encontrada.`);
     console.log(`[updateCategory] Category ${id} updated successfully.`);
  } catch (error) {
      console.error(`[updateCategory] Error updating category ${id}:`, error);
      throw new Error(`Falló al actualizar categoría. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function deleteCategory(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM categories WHERE id = ?';
         console.log(`[deleteCategory] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]);
        if (result.changes === 0) throw new Error(`Categoría con id ${id} no encontrada.`);
         console.log(`[deleteCategory] Category ${id} deleted successfully.`);
    } catch (error) {
         console.error(`[deleteCategory] Error deleting category ${id}:`, error);
         throw new Error(`Falló al eliminar categoría. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// --- CRUD Producto ---
export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const db = await getDb();
  const newProduct = { ...product, id: randomUUID() };
  try {
    const query = 'INSERT INTO products (id, name, price, categoryId, imageUrl, inventory_item_id, inventory_consumed_per_unit) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [
      newProduct.id, newProduct.name, newProduct.price, newProduct.categoryId,
      newProduct.imageUrl ?? null, newProduct.inventory_item_id ?? null,
      newProduct.inventory_consumed_per_unit ?? null
    ];
    console.log(`[addProduct] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, params);
    console.log(`[addProduct] Product ${newProduct.id} added successfully.`);
    return newProduct;
  } catch (error) {
    console.error(`[addProduct] Error inserting Product with ID ${newProduct.id}:`, error);
    throw new Error(`Falló al añadir producto. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id'>>): Promise<void> {
  const db = await getDb();
   const validUpdates: Partial<Product> = {};
   const params: any[] = [];

   Object.entries(updates).forEach(([key, value]) => {
     if (key === 'imageUrl' && value === '') {
       validUpdates[key as keyof Product] = null;
     } else if (key === 'inventory_item_id' && (value === '' || value === null || value === '__NONE__')) {
        validUpdates[key as keyof Product] = null;
        validUpdates['inventory_consumed_per_unit'] = null; // Asegurar que se limpia el consumo
     } else if (value !== undefined) {
        validUpdates[key as keyof Product] = value as any;
     }
   });

   // Si se vincula inventario, asegurar que consumo tenga valor (default 1 si no se provee)
   if (validUpdates.inventory_item_id && validUpdates.inventory_consumed_per_unit === undefined) {
        validUpdates.inventory_consumed_per_unit = 1;
   }
   // Si se desvincula inventario, asegurar que consumo sea null
   if (validUpdates.inventory_item_id === null) {
        validUpdates.inventory_consumed_per_unit = null;
   }

   const fields = Object.keys(validUpdates);
   if (fields.length === 0) {
        console.log("[updateProduct] No valid updates provided for product", id);
        return;
   }

   let query = 'UPDATE products SET ';
   query += fields.map(field => `${field} = ?`).join(', ');
   query += ' WHERE id = ?';
   params.push(...Object.values(validUpdates), id);

   console.log("[updateProduct] Updating Product:", query, params);

    try {
        const result = await db.run(query, params);
        if (result.changes === 0) throw new Error(`Producto con id ${id} no encontrado.`);
        console.log("[updateProduct] Product updated successfully:", id);
    } catch (error) {
        console.error(`[updateProduct] Error updating product ${id}:`, error);
        throw new Error(`Falló al actualizar producto. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


export async function deleteProduct(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM products WHERE id = ?';
         console.log(`[deleteProduct] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]);
        if (result.changes === 0) throw new Error(`Producto con id ${id} no encontrado.`);
         console.log(`[deleteProduct] Product ${id} deleted successfully.`);
    } catch (error) {
         console.error(`[deleteProduct] Error deleting product ${id}:`, error);
        throw new Error(`Falló al eliminar producto. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// --- CRUD Paquete ---
export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
    const db = await getDb();
    const newPackage = { ...pkg, id: randomUUID() };
    try {
        // Validar que category_id existe (si se proporciona)
        if (newPackage.category_id) {
             const category = await db.get('SELECT type FROM categories WHERE id = ?', [newPackage.category_id]);
             if (!category) {
                 throw new Error(`Categoría con ID ${newPackage.category_id} no encontrada.`);
             }
             // Ya no validamos estrictamente type='paquete' aquí
        }

        const query = 'INSERT INTO packages (id, name, price, imageUrl, category_id) VALUES (?, ?, ?, ?, ?)';
        const params = [newPackage.id, newPackage.name, newPackage.price, newPackage.imageUrl ?? null, newPackage.category_id ?? null];
        console.log(`[addPackage] Query: ${query}, Params: ${JSON.stringify(params)}`);
        await db.run(query, params);
        console.log(`[addPackage] Package ${newPackage.id} added successfully.`);
        return newPackage; // Devuelve el paquete completo con el nuevo ID
    } catch (error) {
        console.error(`[addPackage] Error inserting Package with ID ${newPackage.id}:`, error);
        throw new Error(`Falló al añadir paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


export async function updatePackage(id: string, updates: Partial<Omit<Package, 'id'>>): Promise<void> {
    const db = await getDb();
    const validUpdates: Partial<Package> = {};
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
        if (key === 'imageUrl' && value === '') {
            validUpdates[key as keyof Package] = null;
        } else if (key === 'category_id' && (value === '__NONE__' || value === null || value === '')) {
             validUpdates[key as keyof Package] = null; // Permitir desvincular categoría
        } else if (value !== undefined) {
            validUpdates[key as keyof Package] = value as any;
        }
    });

    // Validar categoría si se proporciona
    if (validUpdates.category_id) {
        const category = await db.get('SELECT type FROM categories WHERE id = ?', [validUpdates.category_id]);
        if (!category) {
            throw new Error(`Categoría con ID ${validUpdates.category_id} no encontrada.`);
        }
    }

    const fields = Object.keys(validUpdates);
    if (fields.length === 0) {
        console.log("[updatePackage] No valid updates provided for package", id);
        return;
    }

    let query = 'UPDATE packages SET ';
    query += fields.map(field => `${field} = ?`).join(', ');
    query += ' WHERE id = ?';
    params.push(...Object.values(validUpdates), id);

    console.log("[updatePackage] Updating Package:", query, params);

    try {
        const result = await db.run(query, params);
        if (result.changes === 0) throw new Error(`Paquete con id ${id} no encontrado.`);
        console.log("[updatePackage] Package updated successfully:", id);
    } catch (error) {
        console.error(`[updatePackage] Error updating package ${id}:`, error);
        throw new Error(`Falló al actualizar paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

export async function deletePackage(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM packages WHERE id = ?';
         console.log(`[deletePackage] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]); // CASCADE delete debería manejar package_items
        if (result.changes === 0) throw new Error(`Paquete con id ${id} no encontrado.`);
        console.log(`[deletePackage] Package ${id} deleted successfully.`);
    } catch (error) {
        console.error(`[deletePackage] Error deleting package ${id}:`, error);
        throw new Error(`Falló al eliminar paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


// --- CRUD Item de Paquete ---
export async function addPackageItem(item: Omit<PackageItem, 'id' | 'product_name'>): Promise<PackageItem> {
  const db = await getDb();
  const newItem = { ...item, id: randomUUID() };
  try {
    // Pre-checks (opcional pero recomendado)
    const pkgExists = await db.get('SELECT id FROM packages WHERE id = ?', newItem.package_id);
    if (!pkgExists) throw new Error(`Paquete con ID ${newItem.package_id} no existe.`);
    const prodExists = await db.get('SELECT id FROM products WHERE id = ?', newItem.product_id);
    if (!prodExists) throw new Error(`Producto con ID ${newItem.product_id} no existe.`);

    const query = 'INSERT INTO package_items (id, package_id, product_id, quantity, display_order) VALUES (?, ?, ?, ?, ?)';
    const params = [newItem.id, newItem.package_id, newItem.product_id, newItem.quantity, newItem.display_order];
    console.log(`[addPackageItem] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, params);
    console.log(`[addPackageItem] Package item ${newItem.id} added successfully.`);
     // Devolver sin product_name, se unirá después si es necesario
     return { ...newItem };
  } catch (error) {
      console.error(`[addPackageItem] SQLITE INSERT ERROR for package_items: ID=${newItem.id}, PackageID=${newItem.package_id}, ProductID=${newItem.product_id}. Error details:`, error);
      // Rethrowing the original error might be better for consistent error handling upstream
      if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
         throw new Error(`Error de llave foránea: Asegúrate que el ID de paquete '${newItem.package_id}' y el ID de producto '${newItem.product_id}' existen. Error original: ${error.message}`);
      }
      throw error; // Re-throw the original error if it's not a specific FK issue we handled
  }
}

export async function deletePackageItem(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM package_items WHERE id = ?';
         console.log(`[deletePackageItem] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]); // CASCADE delete debería manejar overrides
        if (result.changes === 0) throw new Error(`Item de paquete con id ${id} no encontrado.`);
        console.log(`[deletePackageItem] Package item ${id} deleted successfully.`);
    } catch (error) {
         console.error(`[deletePackageItem] Error deleting package item ${id}:`, error);
         throw new Error(`Falló al eliminar item de paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// --- CRUD Slot Modificador ---
export async function addModifierSlot(slot: Omit<ProductModifierSlot, 'id'>): Promise<ProductModifierSlot> {
  const db = await getDb();
  const newSlot = { ...slot, id: randomUUID() };
  try {
    // Validate linked_category_id exists and is of type 'modificador'
    const category = await db.get('SELECT type FROM categories WHERE id = ?', [newSlot.linked_category_id]);
    if (!category) {
      throw new Error(`Categoría vinculada con ID ${newSlot.linked_category_id} no encontrada.`);
    }
    if (category.type !== 'modificador') {
      throw new Error(`La categoría vinculada ${newSlot.linked_category_id} no es de tipo 'modificador'.`);
    }

    const query = 'INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [newSlot.id, newSlot.product_id, newSlot.label, newSlot.linked_category_id, newSlot.min_quantity, newSlot.max_quantity];
    console.log(`[addModifierSlot] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, params);
    console.log(`[addModifierSlot] Modifier slot ${newSlot.id} added successfully.`);
    return newSlot;
  } catch (error) {
      console.error(`[addModifierSlot] Error adding modifier slot for product ${newSlot.product_id}:`, error);
       throw new Error(`Falló al añadir slot modificador. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function deleteModifierSlot(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM product_modifier_slots WHERE id = ?';
         console.log(`[deleteModifierSlot] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]);
        if (result.changes === 0) throw new Error(`Slot modificador con id ${id} no encontrado.`);
         console.log(`[deleteModifierSlot] Modifier slot ${id} deleted successfully.`);
    } catch (error) {
         console.error(`[deleteModifierSlot] Error deleting modifier slot ${id}:`, error);
         throw new Error(`Falló al eliminar slot modificador. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


// --- CRUD Override de Paquete ---
export async function setPackageItemOverride(override: Omit<PackageItemModifierSlotOverride, 'id' | 'product_modifier_slot_label'>): Promise<PackageItemModifierSlotOverride> {
  const db = await getDb();
  const newId = randomUUID();
  try {
      // Pre-checks
      const itemExists = await db.get('SELECT id FROM package_items WHERE id = ?', override.package_item_id);
      if (!itemExists) throw new Error(`Item de paquete con ID ${override.package_item_id} no existe.`);
      const slotExists = await db.get('SELECT id FROM product_modifier_slots WHERE id = ?', override.product_modifier_slot_id);
      if (!slotExists) throw new Error(`Slot modificador con ID ${override.product_modifier_slot_id} no existe.`);

      // Usa INSERT OR REPLACE para simplificar (actualiza si la combinación ya existe)
      const query = `
         INSERT INTO package_item_modifier_slot_overrides (package_item_id, product_modifier_slot_id, min_quantity, max_quantity, id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(package_item_id, product_modifier_slot_id) DO UPDATE SET
           min_quantity = excluded.min_quantity,
           max_quantity = excluded.max_quantity
     `;
      const params = [override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity, newId];
      console.log(`[setPackageItemOverride] Query: ${query}, Params: ${JSON.stringify(params)}`);
      await db.run(query, params);

      // Re-fetch para obtener el ID correcto y la etiqueta
      const resultQuery = `
         SELECT pio.*, pms.label as product_modifier_slot_label
         FROM package_item_modifier_slot_overrides pio
         JOIN product_modifier_slots pms ON pio.product_modifier_slot_id = pms.id
         WHERE pio.package_item_id = ? AND pio.product_modifier_slot_id = ?
     `;
      const result = await db.get<PackageItemModifierSlotOverride>(resultQuery, [override.package_item_id, override.product_modifier_slot_id]);

      if (!result) throw new Error("Falló al establecer/verificar el override de item de paquete después de la inserción/reemplazo.");
      console.log(`[setPackageItemOverride] Override for item ${override.package_item_id}, slot ${override.product_modifier_slot_id} set successfully. Result ID: ${result.id}`);
      return result;

  } catch (error) {
      console.error(`[setPackageItemOverride] Error setting override for item ${override.package_item_id}, slot ${override.product_modifier_slot_id}:`, error);
      if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
          throw new Error(`Error de llave foránea: Asegúrate que el ID de item de paquete '${override.package_item_id}' y el ID de slot '${override.product_modifier_slot_id}' existen. Error original: ${error.message}`);
      }
      throw new Error(`Falló al establecer override de item de paquete. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


export async function deletePackageItemOverride(id: string): Promise<void> {
    const db = await getDb();
    try {
         const query = 'DELETE FROM package_item_modifier_slot_overrides WHERE id = ?';
         console.log(`[deletePackageItemOverride] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]);
        if (result.changes === 0) throw new Error(`Override de paquete con id ${id} no encontrado.`);
        console.log(`[deletePackageItemOverride] Package override ${id} deleted successfully.`);
    } catch (error) {
         console.error(`[deletePackageItemOverride] Error deleting package override ${id}:`, error);
        throw new Error(`Falló al eliminar override de paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene una lista combinada de todos los productos y paquetes.
 * Útil para poblar listas donde ambos tipos de items pueden ser seleccionados.
 * @returns Una promesa que resuelve a un array de objetos que pueden ser Product o Package.
 */
export async function getAllProductList(): Promise<(Product | Package)[]> {
    const db = await getDb();
    try {
        // Obtener productos (excluir tipo 'modificador' implícitamente si es necesario)
        const productsQuery = `
            SELECT p.id, p.name, p.price, p.categoryId as originalCategoryId, c.name as categoryName, c.type as categoryType, p.imageUrl, 'product' as itemType
            FROM products p
            JOIN categories c ON p.categoryId = c.id
            WHERE c.type = 'producto' -- Asegurar que solo se obtienen productos regulares
        `;
        // Obtener paquetes
        const packagesQuery = `
             SELECT pk.id, pk.name, pk.price, pk.category_id as originalCategoryId, c.name as categoryName, c.type as categoryType, pk.imageUrl, 'package' as itemType
             FROM packages pk
             LEFT JOIN categories c ON pk.category_id = c.id -- Left join si la categoría es opcional
         `;
        console.log(`[getAllProductList] Fetching products and packages`);
        const [products, packages] = await Promise.all([
             db.all<any[]>(productsQuery),
             db.all<any[]>(packagesQuery)
        ]);
        console.log(`[getAllProductList] Found ${products.length} products and ${packages.length} packages.`);

        // Combinar las listas
        const combinedList = [...products, ...packages];

        return combinedList;
    } catch (error) {
        console.error('[getAllProductList] Error fetching combined product list:', error);
        throw new Error(`Falló la obtención de la lista combinada de productos. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// Helper function (if needed elsewhere)
export async function getCategoryById(categoryId: string): Promise<Category | null> {
    const db = await getDb();
    try {
        const query = 'SELECT * FROM categories WHERE id = ?';
        const category = await db.get<Category>(query, [categoryId]);
        return category || null;
    } catch (error) {
        console.error(`[getCategoryById] Error fetching category ${categoryId}:`, error);
        throw new Error(`Falló la obtención de la categoría ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}
