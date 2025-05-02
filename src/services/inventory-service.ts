// src/services/inventory-service.ts
'use server';

import { getDb } from '@/lib/db';
import type { InventoryItem } from '@/types/product-types';
import { randomUUID } from 'crypto';

/**
 * Obtiene todos los items del inventario.
 * @returns Una promesa que resuelve a un array de objetos InventoryItem.
 */
export async function getInventoryItems(): Promise<InventoryItem[]> {
  const db = await getDb();
  try {
    // Corrected query without parameters
    const query = 'SELECT * FROM inventory_items ORDER BY name ASC';
    console.log(`[getInventoryItems] Query: ${query}`);
    // Passing an empty array for parameters
    const items = await db.all<InventoryItem[]>(query, []);
    console.log(`[getInventoryItems] Found ${items.length} inventory items.`);
    return items;
  } catch (error) {
    console.error('[getInventoryItems] Error fetching inventory items:', error);
    throw new Error(`Falló la obtención de items de inventario. Error original: ${error instanceof Error ? error.message : error}`);
  }
}


/**
 * Obtiene un item de inventario por su ID.
 * @param id El ID del item de inventario.
 * @returns Una promesa que resuelve al objeto InventoryItem o null si no se encuentra.
 */
export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  const db = await getDb();
  try {
    const query = 'SELECT * FROM inventory_items WHERE id = ?';
    console.log(`[getInventoryItemById] Query: ${query}, Params: [${id}]`);
    const item = await db.get<InventoryItem>(query, [id]);
    console.log(`[getInventoryItemById] Item ${id} found: ${!!item}`);
    return item || null;
  } catch (error) {
    console.error(`[getInventoryItemById] Error fetching inventory item ${id}:`, error);
    throw new Error(`Falló la obtención del item de inventario ${id}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Añade un nuevo item al inventario.
 * @param item El objeto del item a añadir (sin id ni current_stock).
 * @returns Una promesa que resuelve al objeto InventoryItem recién creado.
 */
export async function addInventoryItem(item: Omit<InventoryItem, 'id' | 'current_stock'>): Promise<InventoryItem> {
  const db = await getDb();
  const newItem: InventoryItem = {
    ...item,
    id: randomUUID(),
    current_stock: item.initial_stock, // El stock actual inicia igual al inicial
  };
  try {
    const query = 'INSERT INTO inventory_items (id, name, unit, initial_stock, current_stock) VALUES (?, ?, ?, ?, ?)';
    const params = [newItem.id, newItem.name, newItem.unit, newItem.initial_stock, newItem.current_stock];
    console.log(`[addInventoryItem] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, params);
    console.log(`[addInventoryItem] Inventory item ${newItem.id} added successfully.`);
    return newItem;
  } catch (error) {
    console.error(`[addInventoryItem] Error adding inventory item ${newItem.name}:`, error);
    throw new Error(`Falló al añadir item de inventario. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Actualiza el stock actual de un item de inventario (establece un valor absoluto).
 * @param id El ID del item a actualizar.
 * @param newStock El nuevo valor del stock actual.
 */
export async function updateInventoryItemStock(id: string, newStock: number): Promise<void> {
  const db = await getDb();
  try {
    const query = 'UPDATE inventory_items SET current_stock = ? WHERE id = ?';
    const params = [newStock, id];
    console.log(`[updateInventoryItemStock] Query: ${query}, Params: ${JSON.stringify(params)}`);
    const result = await db.run(query, params);
     if (result.changes === 0) {
      throw new Error(`Item de inventario con id ${id} no encontrado.`);
    }
    console.log(`[updateInventoryItemStock] Stock for item ${id} updated to ${newStock}.`);
  } catch (error) {
    console.error(`[updateInventoryItemStock] Error updating stock for inventory item ${id}:`, error);
    throw new Error(`Falló al actualizar stock para el item ${id}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Ajusta el stock actual de un item de inventario (suma o resta una cantidad).
 * @param itemId El ID del item a ajustar.
 * @param quantityChange La cantidad a añadir (positiva) o restar (negativa).
 */
export async function adjustInventoryStock(itemId: string, quantityChange: number): Promise<void> {
    const db = await getDb();
    try {
        const query = 'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?';
        const params = [quantityChange, itemId];
         console.log(`[adjustInventoryStock] Query: ${query}, Params: ${JSON.stringify(params)}`);
        const result = await db.run(query, params);
        if (result.changes === 0) {
            throw new Error(`Item de inventario con id ${itemId} no encontrado.`);
        }
        console.log(`[adjustInventoryStock] Stock for item ${itemId} adjusted by ${quantityChange}.`);
    } catch (error) {
        console.error(`[adjustInventoryStock] Error adjusting stock for inventory item ${itemId}:`, error);
        throw new Error(`Falló al ajustar stock para el item ${itemId}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Elimina un item del inventario.
 * @param id El ID del item a eliminar.
 */
export async function deleteInventoryItem(id: string): Promise<void> {
    const db = await getDb();
    try {
        // Considerar implicaciones: Productos vinculados tendrán inventory_item_id = NULL.
        const query = 'DELETE FROM inventory_items WHERE id = ?';
         console.log(`[deleteInventoryItem] Query: ${query}, Params: [${id}]`);
        const result = await db.run(query, [id]);
         if (result.changes === 0) {
          throw new Error(`Item de inventario con id ${id} no encontrado.`);
        }
        console.log(`[deleteInventoryItem] Inventory item ${id} deleted successfully.`);
    } catch (error) {
        console.error(`[deleteInventoryItem] Error deleting inventory item ${id}:`, error);
        throw new Error(`Falló al eliminar item de inventario ${id}. Error original: ${error instanceof Error ? error.message : error}`);
    }
}
