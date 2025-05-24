// src/services/product-service.ts
'use server';

import { getDb } from '@/lib/db';
import type {
    Category,
    Product,
    Package,
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride,
    ProductModifierSlotOption,
    ModifierServingStyle
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
    const categories = await db.all<Category[]>(query, ...params);
    console.log(`[getCategories] Encontradas ${categories.length} categorías.`);
    return categories;
  } catch (error) {
    console.error('[getCategories] Error obteniendo categorías:', error);
    throw new Error(`Falló la obtención de categorías. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Obtiene productos (NO modificadores) dentro de una categoría específica.
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
    const products = await db.all<Product[]>(query, categoryId);
    console.log(`[getProductsByCategory] Encontrados ${products.length} productos para categoría ${categoryId}.`);
    return products;
  } catch (error) {
    console.error(`[getProductsByCategory] Error obteniendo productos para categoría ${categoryId}:`, error);
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
        const modifiers = await db.all<Product[]>(query, categoryId);
         console.log(`[getModifiersByCategory] Encontrados ${modifiers.length} modificadores para categoría ${categoryId}.`);
        return modifiers;
    } catch (error) {
        console.error(`[getModifiersByCategory] Error obteniendo modificadores para categoría ${categoryId}:`, error);
        throw new Error(`Falló la obtención de modificadores para la categoría ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene todos los paquetes definidos desde la tabla 'packages'.
 * @returns Una promesa que resuelve a un array de objetos Package.
 */
export async function getAllPackages(): Promise<Package[]> {
    const db = await getDb();
    try {
        // Se une con categories opcionalmente para obtener el nombre de la categoría UI
        const query = `
            SELECT p.*, c.name as categoryName
            FROM packages p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.name ASC
        `;
        console.log(`[getAllPackages] Query: ${query}`);
        const packages = await db.all<Package[]>(query);
        console.log(`[getAllPackages] Encontrados ${packages.length} paquetes.`);
        return packages;
    } catch (error) {
        console.error(`[getAllPackages] Error obteniendo paquetes:`, error);
        throw new Error(`Falló la obtención de paquetes. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene paquetes asociados a una categoría UI específica (de la tabla 'packages').
 * @param categoryId El ID de la categoría (usualmente tipo 'paquete').
 * @returns Una promesa que resuelve a un array de objetos Package.
 */
export async function getPackagesByCategoryUI(categoryId: string): Promise<Package[]> {
  const db = await getDb();
  try {
    const query = `
        SELECT *
        FROM packages
        WHERE category_id = ?
        ORDER BY name ASC
     `;
    console.log(`[getPackagesByCategoryUI] Query: ${query}, Params: [${categoryId}]`);
    const packages = await db.all<Package[]>(query, categoryId);
    console.log(`[getPackagesByCategoryUI] Encontrados ${packages.length} paquetes para categoría UI ${categoryId}.`);
    return packages;
  } catch (error) {
    console.error(`[getPackagesByCategoryUI] Error obteniendo paquetes para categoría UI ${categoryId}:`, error);
    throw new Error(`Falló la obtención de paquetes para la categoría UI ${categoryId}. Error original: ${error instanceof Error ? error.message : error}`);
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
        const product = await db.get<Product>(query, productId);
        console.log(`[getProductById] Producto ${productId} encontrado: ${!!product}`);
        return product || null;
    } catch (error) {
        console.error(`[getProductById] Error obteniendo producto ${productId}:`, error);
        throw new Error(`Falló la obtención del producto ${productId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene un solo paquete por su ID (de la tabla 'packages').
 * @param packageId El ID del paquete.
 * @returns Una promesa que resuelve a un objeto Package o null si no se encuentra.
 */
export async function getPackageById(packageId: string): Promise<Package | null> {
    const db = await getDb();
    try {
         const query = 'SELECT * FROM packages WHERE id = ?';
         console.log(`[getPackageById] Query: ${query}, Params: [${packageId}]`);
        const pkg = await db.get<Package>(query, packageId);
        console.log(`[getPackageById] Paquete ${packageId} encontrado: ${!!pkg}`);
        return pkg || null;
    } catch (error) {
        console.error(`[getPackageById] Error obteniendo paquete ${packageId}:`, error);
        throw new Error(`Falló la obtención del paquete ${packageId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene los slots modificadores definidos para un producto específico, incluyendo sus opciones permitidas.
 * @param productId El ID del producto.
 * @returns Una promesa que resuelve a un array de objetos ProductModifierSlot, cada uno potencialmente con un array `allowedOptions`.
 */
export async function getModifierSlotsForProduct(productId: string): Promise<ProductModifierSlot[]> {
  const db = await getDb();
  try {
    // 1. Obtener los slots base
    const slotQuery = `
      SELECT *
      FROM product_modifier_slots
      WHERE product_id = ?
      ORDER BY label ASC
    `;
    console.log(`[getModifierSlotsForProduct] Query Slots: ${slotQuery}, Params: [${productId}]`);
    const slots = await db.all<ProductModifierSlot[]>(slotQuery, productId);
    console.log(`[getModifierSlotsForProduct] Encontrados ${slots.length} slots base para producto ${productId}.`);

    // 2. Para cada slot, obtener sus opciones específicas permitidas (si existen)
    const slotsWithOptionsPromises = slots.map(async (slot) => {
      const options = await getModifierSlotOptions(slot.id);
      return { ...slot, allowedOptions: options.length > 0 ? options : undefined };
    });

    const slotsWithOptions = await Promise.all(slotsWithOptionsPromises);
    console.log(`[getModifierSlotsForProduct] Slots con opciones preparados para producto ${productId}.`);
    return slotsWithOptions;

  } catch (error) {
    console.error(`[getModifierSlotsForProduct] Error obteniendo slots modificadores para producto ${productId}:`, error);
    throw new Error(`Falló la obtención de slots modificadores para el producto ${productId}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Obtiene las opciones de modificador *específicas* permitidas para un slot de modificador.
 * @param productModifierSlotId El ID del slot de modificador.
 * @returns Una promesa que resuelve a un array de ProductModifierSlotOption.
 */
export async function getModifierSlotOptions(productModifierSlotId: string): Promise<ProductModifierSlotOption[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT
                pmso.id,
                pmso.product_modifier_slot_id,
                pmso.modifier_product_id,
                p.name as modifier_product_name,
                p.price as modifier_product_price,
                pmso.is_default,
                pmso.price_adjustment
            FROM product_modifier_slot_options pmso
            JOIN products p ON pmso.modifier_product_id = p.id
            WHERE pmso.product_modifier_slot_id = ?
            ORDER BY p.name ASC
        `;
        console.log(`[getModifierSlotOptions] Query: ${query}, Params: [${productModifierSlotId}]`);
        const options = await db.all<ProductModifierSlotOption[]>(query, productModifierSlotId);
        console.log(`[getModifierSlotOptions] Encontradas ${options.length} opciones específicas para slot ${productModifierSlotId}.`);
        return options;
    } catch (error) {
        console.error(`[getModifierSlotOptions] Error obteniendo opciones para slot ${productModifierSlotId}:`, error);
        throw new Error(`Falló la obtención de opciones para el slot ${productModifierSlotId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


/**
 * Obtiene los items (productos) incluidos en la definición de un paquete específico.
 * @param packageId El ID del paquete (de la tabla 'packages').
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
        const items = await db.all<PackageItem[]>(query, packageId);
        console.log(`[getItemsForPackage] Encontrados ${items.length} items para paquete ${packageId}.`);
        return items;
    } catch (error) {
        console.error(`[getItemsForPackage] Error obteniendo items para paquete ${packageId}:`, error);
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
        const overrides = await db.all<PackageItemModifierSlotOverride[]>(query, packageItemId);
         console.log(`[getOverridesForPackageItem] Encontrados ${overrides.length} overrides para item de paquete ${packageItemId}.`);
        return overrides;
    } catch (error) {
        console.error(`[getOverridesForPackageItem] Error obteniendo overrides para item de paquete ${packageItemId}:`, error);
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
    await db.run(query, newCategory.id, newCategory.name, newCategory.type, newCategory.imageUrl);
    console.log(`[addCategory] Categoría ${newCategory.id} añadida exitosamente.`);
    return newCategory;
  } catch (error) {
      console.error(`[addCategory] Error añadiendo categoría ${newCategory.name}:`, error);
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
    const result = await db.run(query, ...params); // Usar spread operator para params
    if (result.changes === 0) throw new Error(`Categoría con id ${id} no encontrada.`);
     console.log(`[updateCategory] Categoría ${id} actualizada exitosamente.`);
  } catch (error) {
      console.error(`[updateCategory] Error actualizando categoría ${id}:`, error);
      throw new Error(`Falló al actualizar categoría. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function deleteCategory(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM categories WHERE id = ?';
         console.log(`[deleteCategory] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id);
        if (result.changes === 0) throw new Error(`Categoría con id ${id} no encontrada.`);
         console.log(`[deleteCategory] Categoría ${id} eliminada exitosamente.`);
    } catch (error) {
         console.error(`[deleteCategory] Error eliminando categoría ${id}:`, error);
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
    await db.run(query, ...params); // Usar spread operator para params
    console.log(`[addProduct] Producto ${newProduct.id} añadido exitosamente.`);
    return newProduct;
  } catch (error) {
    console.error(`[addProduct] Error insertando Producto con ID ${newProduct.id}:`, error);
    throw new Error(`Falló al añadir producto. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id'>>): Promise<void> {
  const db = await getDb();
   const validUpdates: Partial<Product> = {};
   const paramsToSpread: any[] = [];

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
        console.log("[updateProduct] No hay actualizaciones válidas para producto", id);
        return;
   }

   let query = 'UPDATE products SET ';
   query += fields.map(field => `${field} = ?`).join(', ');
   query += ' WHERE id = ?';
   paramsToSpread.push(...Object.values(validUpdates), id);

   console.log("[updateProduct] Actualizando Producto:", query, paramsToSpread);

    try {
        const result = await db.run(query, ...paramsToSpread); // Usar spread operator para params
        if (result.changes === 0) throw new Error(`Producto con id ${id} no encontrado.`);
        console.log("[updateProduct] Producto actualizado exitosamente:", id);
    } catch (error) {
        console.error(`[updateProduct] Error actualizando producto ${id}:`, error);
        throw new Error(`Falló al actualizar producto. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// OJO: Al eliminar un producto, también se eliminarán las opciones de slot que lo referencien
// y los items de paquete que lo contengan, debido a ON DELETE CASCADE.
export async function deleteProduct(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM products WHERE id = ?';
         console.log(`[deleteProduct] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id);
        console.log(`[deleteProduct] Producto ${id} eliminado (o no existía). Cambios: ${result.changes}`);
    } catch (error) {
         console.error(`[deleteProduct] Error eliminando producto ${id}:`, error);
        throw new Error(`Falló al eliminar producto. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// --- CRUD Paquete ---
export async function addPackage(pkg: Omit<Package, 'id'>): Promise<Package> {
    const db = await getDb();
    const newPackage = { ...pkg, id: randomUUID() };
    try {
        // Validar que category_id existe (si se proporciona) y es de tipo 'paquete'
        if (newPackage.category_id) {
             const category = await db.get('SELECT type FROM categories WHERE id = ?', newPackage.category_id);
             if (!category) {
                 throw new Error(`Categoría con ID ${newPackage.category_id} no encontrada.`);
             }
             if (category.type !== 'paquete') {
                 throw new Error(`La categoría UI '${newPackage.category_id}' no es de tipo 'paquete'.`);
             }
        }

        const query = 'INSERT INTO packages (id, name, price, imageUrl, category_id) VALUES (?, ?, ?, ?, ?)';
        const params = [newPackage.id, newPackage.name, newPackage.price, newPackage.imageUrl ?? null, newPackage.category_id ?? null];
        console.log(`[addPackage] Query: ${query}, Params: ${JSON.stringify(params)}`);
        await db.run(query, ...params); // Usar spread operator para params
        console.log(`[addPackage] Paquete ${newPackage.id} añadido exitosamente.`);
        return newPackage; // Devuelve el paquete completo con el nuevo ID
    } catch (error) {
        console.error(`[addPackage] Error insertando Paquete con ID ${newPackage.id}:`, error);
        throw new Error(`Falló al añadir paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


export async function updatePackage(id: string, updates: Partial<Omit<Package, 'id'>>): Promise<void> {
    const db = await getDb();
    const validUpdates: Partial<Package> = {};
    const paramsToSpread: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
        if (key === 'imageUrl' && value === '') {
            validUpdates[key as keyof Package] = null;
        } else if (key === 'category_id' && (value === '__NONE__' || value === null || value === '')) {
             validUpdates[key as keyof Package] = null; // Permitir desvincular categoría
        } else if (value !== undefined) {
            validUpdates[key as keyof Package] = value as any;
        }
    });

    // Validar categoría si se proporciona y no es null
    if (validUpdates.category_id) {
        const category = await db.get('SELECT type FROM categories WHERE id = ?', validUpdates.category_id);
        if (!category) {
            throw new Error(`Categoría con ID ${validUpdates.category_id} no encontrada.`);
        }
         if (category.type !== 'paquete') {
             throw new Error(`La categoría UI '${validUpdates.category_id}' no es de tipo 'paquete'.`);
         }
    }

    const fields = Object.keys(validUpdates);
    if (fields.length === 0) {
        console.log("[updatePackage] No hay actualizaciones válidas para paquete", id);
        return;
    }

    let query = 'UPDATE packages SET ';
    query += fields.map(field => `${field} = ?`).join(', ');
    query += ' WHERE id = ?';
    paramsToSpread.push(...Object.values(validUpdates), id);

    console.log("[updatePackage] Actualizando Paquete:", query, paramsToSpread);

    try {
        const result = await db.run(query, ...paramsToSpread); // Usar spread operator para params
        if (result.changes === 0) throw new Error(`Paquete con id ${id} no encontrado.`);
        console.log("[updatePackage] Paquete actualizado exitosamente:", id);
    } catch (error) {
        console.error(`[updatePackage] Error actualizando paquete ${id}:`, error);
        throw new Error(`Falló al actualizar paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

export async function deletePackage(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM packages WHERE id = ?';
         console.log(`[deletePackage] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id); // CASCADE delete debería manejar package_items
        if (result.changes === 0) throw new Error(`Paquete con id ${id} no encontrado.`);
        console.log(`[deletePackage] Paquete ${id} eliminado exitosamente.`);
    } catch (error) {
        console.error(`[deletePackage] Error eliminando paquete ${id}:`, error);
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
    await db.run(query, ...params); // Usar spread operator para params
    console.log(`[addPackageItem] Item de paquete ${newItem.id} añadido exitosamente.`);
     // Devolver sin product_name, se unirá después si es necesario
     return { ...newItem };
  } catch (error) {
      console.error(`[addPackageItem] Error de Inserción SQLITE para package_items: ID=${newItem.id}, PackageID=${newItem.package_id}, ProductID=${newItem.product_id}. Detalles del error:`, error);
      if (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed")) {
         throw new Error(`Error de restricción de Base de Datos: Asegúrate que el ID de paquete '${newItem.package_id}' y el ID de producto '${newItem.product_id}' son válidos. Error original: ${error.message}`);
      }
      throw error;
  }
}

export async function deletePackageItem(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM package_items WHERE id = ?';
         console.log(`[deletePackageItem] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id); // CASCADE delete debería manejar overrides
        if (result.changes === 0) throw new Error(`Item de paquete con id ${id} no encontrado.`);
        console.log(`[deletePackageItem] Item de paquete ${id} eliminado exitosamente.`);
    } catch (error) {
         console.error(`[deletePackageItem] Error eliminando item de paquete ${id}:`, error);
         throw new Error(`Falló al eliminar item de paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// --- CRUD Slot Modificador ---
export async function addModifierSlot(slot: Omit<ProductModifierSlot, 'id' | 'allowedOptions'>): Promise<ProductModifierSlot> {
  const db = await getDb();
  const newSlot = { ...slot, id: randomUUID() };
  try {
    // Validar que linked_category_id existe y es de tipo 'modificador'
    const category = await db.get('SELECT type FROM categories WHERE id = ?', newSlot.linked_category_id);
    if (!category) {
      throw new Error(`Categoría vinculada con ID ${newSlot.linked_category_id} no encontrada.`);
    }
    if (category.type !== 'modificador') {
      throw new Error(`La categoría vinculada ${newSlot.linked_category_id} no es de tipo 'modificador'.`);
    }

    const query = 'INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [newSlot.id, newSlot.product_id, newSlot.label, newSlot.linked_category_id, newSlot.min_quantity, newSlot.max_quantity];
    console.log(`[addModifierSlot] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, ...params); // Usar spread operator para params
    console.log(`[addModifierSlot] Slot modificador ${newSlot.id} añadido exitosamente.`);
    // Devuelve el slot sin allowedOptions; estas se gestionan por separado
    return { id: newSlot.id, ...slot };
  } catch (error) {
      console.error(`[addModifierSlot] Error añadiendo slot modificador para producto ${newSlot.product_id}:`, error);
       throw new Error(`Falló al añadir slot modificador. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

// OJO: Al eliminar un slot, también se eliminarán las opciones y overrides que lo referencien
// debido a ON DELETE CASCADE.
export async function deleteModifierSlot(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM product_modifier_slots WHERE id = ?';
         console.log(`[deleteModifierSlot] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id);
        if (result.changes === 0) throw new Error(`Slot modificador con id ${id} no encontrado.`);
         console.log(`[deleteModifierSlot] Slot modificador ${id} eliminado exitosamente.`);
    } catch (error) {
         console.error(`[deleteModifierSlot] Error eliminando slot modificador ${id}:`, error);
         throw new Error(`Falló al eliminar slot modificador. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


// --- CRUD Opciones Específicas de Slot Modificador ---
export async function addModifierSlotOption(option: Omit<ProductModifierSlotOption, 'id' | 'modifier_product_name' | 'modifier_product_price'>): Promise<ProductModifierSlotOption> {
    const db = await getDb();
    const newOption = { ...option, id: randomUUID() };
    try {
        // Validar que el slot existe
        const slotExists = await db.get('SELECT id FROM product_modifier_slots WHERE id = ?', [newOption.product_modifier_slot_id]);
        if (!slotExists) throw new Error(`Slot modificador con ID ${newOption.product_modifier_slot_id} no encontrado.`);

        // Validar que el producto modificador existe y es de tipo 'modificador'
        const modifierProd = await db.get(`
            SELECT c.type
            FROM products p
            JOIN categories c ON p.categoryId = c.id
            WHERE p.id = ?
        `, [newOption.modifier_product_id]);
        if (!modifierProd) throw new Error(`Producto modificador con ID ${newOption.modifier_product_id} no encontrado.`);
        if (modifierProd.type !== 'modificador') throw new Error(`Producto ${newOption.modifier_product_id} no es de tipo 'modificador'.`);


        const query = 'INSERT INTO product_modifier_slot_options (id, product_modifier_slot_id, modifier_product_id, is_default, price_adjustment) VALUES (?, ?, ?, ?, ?)';
        const params = [newOption.id, newOption.product_modifier_slot_id, newOption.modifier_product_id, option.is_default ?? 0, option.price_adjustment ?? 0];
        console.log(`[addModifierSlotOption] Query: ${query}, Params: ${JSON.stringify(params)}`);
        await db.run(query, ...params); // Usar spread operator para params
        console.log(`[addModifierSlotOption] Opción ${newOption.modifier_product_id} añadida a slot ${newOption.product_modifier_slot_id}.`);
        // Devolver la opción insertada (sin nombre/precio, se obtienen al leer)
        return newOption;
    } catch (error) {
        console.error(`[addModifierSlotOption] Error añadiendo opción ${newOption.modifier_product_id} a slot ${newOption.product_modifier_slot_id}:`, error);
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
           throw new Error(`La opción ya existe en este grupo.`);
        }
        throw new Error(`Falló al añadir opción al slot. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

export async function updateModifierSlotOptionConfig(optionId: string, config: { is_default?: boolean; price_adjustment?: number }): Promise<void> {
    const db = await getDb();
    const updates: Partial<Pick<ProductModifierSlotOption, 'is_default' | 'price_adjustment'>> = {};
    if (config.is_default !== undefined) updates.is_default = config.is_default;
    if (config.price_adjustment !== undefined) updates.price_adjustment = config.price_adjustment;

    if (Object.keys(updates).length === 0) return;

    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    try {
        const query = `UPDATE product_modifier_slot_options SET ${fields} WHERE id = ?`;
        const params = [...values, optionId];
        console.log(`[updateModifierSlotOptionConfig] Query: ${query}, Params: ${JSON.stringify(params)}`);
        const result = await db.run(query, ...params);
        if (result.changes === 0) throw new Error(`Opción de slot con id ${optionId} no encontrada.`);
        console.log(`[updateModifierSlotOptionConfig] Configuración de opción ${optionId} actualizada.`);
    } catch (error) {
        console.error(`[updateModifierSlotOptionConfig] Error actualizando config de opción ${optionId}:`, error);
        throw new Error(`Falló al actualizar config de opción. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


export async function deleteModifierSlotOption(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM product_modifier_slot_options WHERE id = ?';
         console.log(`[deleteModifierSlotOption] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id);
        if (result.changes === 0) throw new Error(`Opción de slot modificador con id ${id} no encontrada.`);
         console.log(`[deleteModifierSlotOption] Opción de slot modificador ${id} eliminada exitosamente.`);
    } catch (error) {
         console.error(`[deleteModifierSlotOption] Error eliminando opción de slot modificador ${id}:`, error);
         throw new Error(`Falló al eliminar opción de slot. Error original: ${error instanceof Error ? error.message : error}`);
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

        // Check if override exists
        const existingQuery = `SELECT id FROM package_item_modifier_slot_overrides WHERE package_item_id = ? AND product_modifier_slot_id = ?`;
        const existingOverride = await db.get<{id: string}>(existingQuery, override.package_item_id, override.product_modifier_slot_id);

        let resultId = existingOverride ? existingOverride.id : newId;

        if (existingOverride) {
             const updateQuery = `UPDATE package_item_modifier_slot_overrides SET min_quantity = ?, max_quantity = ? WHERE id = ?`;
             const updateParams = [override.min_quantity, override.max_quantity, existingOverride.id];
             console.log(`[setPackageItemOverride] Actualizando override existente: Query: ${updateQuery}, Params: ${JSON.stringify(updateParams)}`);
             await db.run(updateQuery, ...updateParams); // Usar spread operator para params
        } else {
             const insertQuery = `INSERT INTO package_item_modifier_slot_overrides (id, package_item_id, product_modifier_slot_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?)`;
             const insertParams = [newId, override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity];
             console.log(`[setPackageItemOverride] Insertando nuevo override: Query: ${insertQuery}, Params: ${JSON.stringify(insertParams)}`);
             await db.run(insertQuery, ...insertParams); // Usar spread operator para params
        }


        // Re-fetch para obtener el ID correcto y la etiqueta
        const resultQuery = `
           SELECT pio.*, pms.label as product_modifier_slot_label
           FROM package_item_modifier_slot_overrides pio
           JOIN product_modifier_slots pms ON pio.product_modifier_slot_id = pms.id
           WHERE pio.id = ? 
       `; // Buscar por el ID del override (existente o nuevo)
        const result = await db.get<PackageItemModifierSlotOverride>(resultQuery, resultId);

        if (!result) throw new Error("Falló al establecer/verificar el override de item de paquete después de la inserción/actualización.");
        console.log(`[setPackageItemOverride] Override para item ${override.package_item_id}, slot ${override.product_modifier_slot_id} establecido exitosamente. ID Resultante: ${result.id}`);
        return result;

    } catch (error) {
        console.error(`[setPackageItemOverride] Error estableciendo override para item ${override.package_item_id}, slot ${override.product_modifier_slot_id}:`, error);
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
        const result = await db.run(query, id);
        if (result.changes === 0) throw new Error(`Override de paquete con id ${id} no encontrado.`);
        console.log(`[deletePackageItemOverride] Override de paquete ${id} eliminado exitosamente.`);
    } catch (error) {
         console.error(`[deletePackageItemOverride] Error eliminando override de paquete ${id}:`, error);
        throw new Error(`Falló al eliminar override de paquete. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Obtiene una lista combinada de todos los productos (incluyendo modificadores).
 * @returns Una promesa que resuelve a un array de objetos Product.
 */
export async function getAllProductsAndModifiersList(): Promise<Product[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT p.*, c.name as categoryName, c.type as categoryType
            FROM products p
            LEFT JOIN categories c ON p.categoryId = c.id
            ORDER BY c.name, p.name
        `;
        console.log(`[getAllProductsAndModifiersList] Obteniendo todos los productos/modificadores.`);
        const products = await db.all<Product[]>(query);
        console.log(`[getAllProductsAndModifiersList] Encontrados ${products.length} productos/modificadores.`);
        return products;
    } catch (error) {
        console.error('[getAllProductsAndModifiersList] Error obteniendo lista de productos:', error);
        throw new Error(`Falló la obtención de la lista de productos. Error original: ${error instanceof Error ? error.message : error}`);
    }
}


// --- CRUD Estilos de Servicio para Categorías de Modificadores ---

/**
 * Obtiene todos los estilos de servicio configurados para una categoría de modificador específica.
 * @param categoryId El ID de la categoría (debe ser tipo 'modificador').
 * @returns Una promesa que resuelve a un array de ModifierServingStyle.
 */
export async function getServingStylesForCategory(categoryId: string): Promise<ModifierServingStyle[]> {
    const db = await getDb();
    try {
        const query = `
            SELECT * FROM modifier_serving_styles
            WHERE category_id = ?
            ORDER BY display_order ASC, label ASC
        `;
        console.log(`[getServingStylesForCategory] Query: ${query}, Params: [${categoryId}]`);
        const styles = await db.all<ModifierServingStyle[]>(query, categoryId);
        console.log(`[getServingStylesForCategory] Encontrados ${styles.length} estilos de servicio para categoría ${categoryId}.`);
        return styles;
    } catch (error) {
        console.error(`[getServingStylesForCategory] Error obteniendo estilos de servicio para categoría ${categoryId}:`, error);
        throw new Error(`Falló la obtención de estilos de servicio. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Añade un nuevo estilo de servicio a una categoría de modificador.
 * @param style El objeto ModifierServingStyle a añadir (sin id).
 * @returns Una promesa que resuelve al ModifierServingStyle recién creado.
 */
export async function addServingStyleToCategory(style: Omit<ModifierServingStyle, 'id'>): Promise<ModifierServingStyle> {
    const db = await getDb();
    const newStyle = { ...style, id: randomUUID() };
    try {
        // Validar que la categoría existe y es de tipo 'modificador'
        const category = await db.get('SELECT type FROM categories WHERE id = ?', [newStyle.category_id]);
        if (!category) {
            throw new Error(`Categoría con ID ${newStyle.category_id} no encontrada para añadir estilo de servicio.`);
        }
        if (category.type !== 'modificador') {
            throw new Error(`La categoría ${newStyle.category_id} no es de tipo 'modificador'. No se pueden añadir estilos de servicio.`);
        }

        const query = 'INSERT INTO modifier_serving_styles (id, category_id, label, display_order) VALUES (?, ?, ?, ?)';
        const params = [newStyle.id, newStyle.category_id, newStyle.label, newStyle.display_order ?? 0];
        console.log(`[addServingStyleToCategory] Query: ${query}, Params: ${JSON.stringify(params)}`);
        await db.run(query, ...params);
        console.log(`[addServingStyleToCategory] Estilo de servicio '${newStyle.label}' añadido a categoría ${newStyle.category_id}.`);
        return newStyle;
    } catch (error) {
        console.error(`[addServingStyleToCategory] Error añadiendo estilo de servicio '${newStyle.label}':`, error);
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(`El estilo de servicio '${newStyle.label}' ya existe para esta categoría.`);
        }
        throw new Error(`Falló al añadir estilo de servicio. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Actualiza un estilo de servicio existente.
 * @param id El ID del estilo de servicio a actualizar.
 * @param updates Los campos a actualizar.
 */
export async function updateServingStyle(id: string, updates: Partial<Omit<ModifierServingStyle, 'id' | 'category_id'>>): Promise<void> {
    const db = await getDb();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    if (fields.length === 0) return; // No hay nada que actualizar

    try {
        const query = `UPDATE modifier_serving_styles SET ${fields} WHERE id = ?`;
        const params = [...values, id];
        console.log(`[updateServingStyle] Query: ${query}, Params: ${JSON.stringify(params)}`);
        const result = await db.run(query, ...params);
        if (result.changes === 0) throw new Error(`Estilo de servicio con id ${id} no encontrado.`);
        console.log(`[updateServingStyle] Estilo de servicio ${id} actualizado.`);
    } catch (error) {
        console.error(`[updateServingStyle] Error actualizando estilo de servicio ${id}:`, error);
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            // Asumimos que la restricción UNIQUE es en (category_id, label)
            throw new Error(`La etiqueta de estilo de servicio ya existe para esta categoría.`);
        }
        throw new Error(`Falló al actualizar estilo de servicio. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Elimina un estilo de servicio.
 * @param id El ID del estilo de servicio a eliminar.
 */
export async function deleteServingStyle(id: string): Promise<void> {
    const db = await getDb();
    try {
        const query = 'DELETE FROM modifier_serving_styles WHERE id = ?';
        console.log(`[deleteServingStyle] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, id);
        if (result.changes === 0) throw new Error(`Estilo de servicio con id ${id} no encontrado.`);
        console.log(`[deleteServingStyle] Estilo de servicio ${id} eliminado.`);
    } catch (error) {
        console.error(`[deleteServingStyle] Error eliminando estilo de servicio ${id}:`, error);
        throw new Error(`Falló al eliminar estilo de servicio. Error original: ${error instanceof Error ? error.message : error}`);
    }
}
