'use server';

import { getDb } from '@/lib/db';
import type { Category, Product, Modifier } from '@/types/product-types'; // Assuming types are defined here

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  try {
    const categories = await db.all<Category[]>('SELECT * FROM categories ORDER BY name ASC');
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories.'); // Re-throw for handling in components
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


export async function getModifiersForProduct(productId: string): Promise<Modifier[]> {
  const db = await getDb();
  try {
    const modifiers = await db.all<Modifier[]>(`
      SELECT m.*
      FROM modifiers m
      JOIN product_modifiers pm ON m.id = pm.modifierId
      WHERE pm.productId = ?
      ORDER BY m.name ASC
    `, productId);
    return modifiers;
  } catch (error) {
    console.error(`Error fetching modifiers for product ${productId}:`, error);
    throw new Error(`Failed to fetch modifiers for product ${productId}.`);
  }
}

// Potential future functions:
// export async function addProduct(...) { ... }
// export async function updateProduct(...) { ... }
// export async function addCategory(...) { ... }
