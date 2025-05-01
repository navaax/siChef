'use server';

import { getDb } from '@/lib/db';
import type { InventoryItem } from '@/types/product-types';
import { randomUUID } from 'crypto';

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const db = await getDb();
  try {
    const items = await db.all<InventoryItem[]>('SELECT * FROM inventory_items ORDER BY name ASC');
    return items;
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    throw new Error('Failed to fetch inventory items.');
  }
}

export async function addInventoryItem(item: Omit<InventoryItem, 'id' | 'current_stock'>): Promise<InventoryItem> {
  const db = await getDb();
  const newItem: InventoryItem = {
    ...item,
    id: randomUUID(),
    current_stock: item.initial_stock, // Current stock starts same as initial
  };
  try {
    await db.run(
      'INSERT INTO inventory_items (id, name, unit, initial_stock, current_stock) VALUES (?, ?, ?, ?, ?)',
      newItem.id,
      newItem.name,
      newItem.unit,
      newItem.initial_stock,
      newItem.current_stock
    );
    return newItem;
  } catch (error) {
    console.error('Error adding inventory item:', error);
    throw new Error('Failed to add inventory item.');
  }
}

export async function updateInventoryItemStock(id: string, newStock: number): Promise<void> {
  const db = await getDb();
  try {
    // Optionally, you might want to fetch the item first to log the change
    // For simplicity, just updating directly:
    const result = await db.run('UPDATE inventory_items SET current_stock = ? WHERE id = ?', newStock, id);
     if (result.changes === 0) {
      throw new Error(`Inventory item with id ${id} not found.`);
    }
  } catch (error) {
    console.error(`Error updating stock for inventory item ${id}:`, error);
    throw new Error(`Failed to update stock for inventory item ${id}.`);
  }
}

export async function adjustInventoryStock(itemId: string, quantityChange: number): Promise<void> {
    const db = await getDb();
    try {
        const result = await db.run(
            'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
            quantityChange, // Use positive for adding, negative for subtracting
            itemId
        );
        if (result.changes === 0) {
            throw new Error(`Inventory item with id ${itemId} not found.`);
        }
        // Add logging here if needed
    } catch (error) {
        console.error(`Error adjusting stock for inventory item ${itemId}:`, error);
        throw new Error(`Failed to adjust stock for inventory item ${itemId}.`);
    }
}

export async function deleteInventoryItem(id: string): Promise<void> {
    const db = await getDb();
    try {
        // Consider implications: Products linked to this item will have their inventory_item_id set to NULL.
        const result = await db.run('DELETE FROM inventory_items WHERE id = ?', id);
         if (result.changes === 0) {
          throw new Error(`Inventory item with id ${id} not found.`);
        }
    } catch (error) {
        console.error(`Error deleting inventory item ${id}:`, error);
        throw new Error(`Failed to delete inventory item ${id}.`);
    }
}
