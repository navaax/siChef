// src/scripts/seed-db.ts
import { getDb, closeDb } from '../lib/db';

// --- Types (matching those in create-order page for consistency) ---
interface Modifier {
  id: string;
  name: string;
  priceModifier?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  modifiers?: Modifier[]; // Modifiers specific to this product
}

interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

// --- Seed Data (from create-order page) ---
const categories: Category[] = [
  { id: 'cat-burgers', name: 'Burgers', imageUrl: 'https://picsum.photos/200/150?random=1' },
  { id: 'cat-salads', name: 'Salads', imageUrl: 'https://picsum.photos/200/150?random=2' },
  { id: 'cat-drinks', name: 'Drinks', imageUrl: 'https://picsum.photos/200/150?random=3' },
  { id: 'cat-sides', name: 'Sides', imageUrl: 'https://picsum.photos/200/150?random=4' },
];

const products: Product[] = [
  // Burgers
  {
    id: 'prod-101', name: 'Cheeseburger', price: 8.50, categoryId: 'cat-burgers', imageUrl: 'https://picsum.photos/200/150?random=11',
    modifiers: [
      { id: 'mod-pickle', name: 'Extra Pickles' },
      { id: 'mod-bacon', name: 'Add Bacon', priceModifier: 1.50 },
      { id: 'mod-cheese', name: 'Extra Cheese', priceModifier: 1.00 },
      { id: 'mod-onion', name: 'No Onions' },
    ]
  },
  {
    id: 'prod-102', name: 'Veggie Burger', price: 7.50, categoryId: 'cat-burgers', imageUrl: 'https://picsum.photos/200/150?random=12',
    modifiers: [
        { id: 'mod-lettuce', name: 'Lettuce Wrap' },
        { id: 'mod-avocado', name: 'Add Avocado', priceModifier: 1.25 }
    ]
  },
  // Salads
  {
    id: 'prod-305', name: 'Chicken Salad', price: 9.75, categoryId: 'cat-salads', imageUrl: 'https://picsum.photos/200/150?random=21',
    modifiers: [
        { id: 'mod-dressing-ranch', name: 'Ranch Dressing'}, // Changed ID
        { id: 'mod-dressing-vinaigrette', name: 'Vinaigrette'}
    ]
  },
  {
    id: 'prod-306', name: 'Caesar Salad', price: 9.00, categoryId: 'cat-salads', imageUrl: 'https://picsum.photos/200/150?random=22',
    modifiers: [
        { id: 'mod-anchovies', name: 'Add Anchovies', priceModifier: 1.00 }
    ]
  },
  // Drinks
  { id: 'prod-401', name: 'Iced Tea', price: 2.50, categoryId: 'cat-drinks', imageUrl: 'https://picsum.photos/200/150?random=31' },
  { id: 'prod-402', name: 'Cola', price: 2.00, categoryId: 'cat-drinks', imageUrl: 'https://picsum.photos/200/150?random=32' },
  // Sides
  { id: 'prod-203', name: 'Fries', price: 3.00, categoryId: 'cat-sides', imageUrl: 'https://picsum.photos/200/150?random=41' },
  { id: 'prod-204', name: 'Onion Rings', price: 4.00, categoryId: 'cat-sides', imageUrl: 'https://picsum.photos/200/150?random=42' },
];

// Extract unique modifiers from all products
const allModifiersMap = new Map<string, Modifier>();
products.forEach(product => {
  product.modifiers?.forEach(modifier => {
    if (!allModifiersMap.has(modifier.id)) {
      allModifiersMap.set(modifier.id, modifier);
    }
  });
});
const uniqueModifiers = Array.from(allModifiersMap.values());


async function seedDatabase() {
  const db = await getDb();

  try {
    console.log('Starting database seeding...');
    await db.run('BEGIN TRANSACTION;');

    // Clear existing data (optional, but good for repeatable seeding)
    console.log('Clearing existing data...');
    await db.run('DELETE FROM product_modifiers;');
    await db.run('DELETE FROM modifiers;');
    await db.run('DELETE FROM products;');
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

    // Insert Unique Modifiers
    console.log('Inserting modifiers...');
    const modifierStmt = await db.prepare('INSERT INTO modifiers (id, name, priceModifier) VALUES (?, ?, ?)');
    for (const modifier of uniqueModifiers) {
      await modifierStmt.run(modifier.id, modifier.name, modifier.priceModifier ?? 0);
    }
    await modifierStmt.finalize();
    console.log(`${uniqueModifiers.length} modifiers inserted.`);

    // Insert Products and Product-Modifier relationships
    console.log('Inserting products and relationships...');
    const productStmt = await db.prepare('INSERT INTO products (id, name, price, categoryId, imageUrl) VALUES (?, ?, ?, ?, ?)');
    const productModifierStmt = await db.prepare('INSERT INTO product_modifiers (productId, modifierId) VALUES (?, ?)');

    for (const product of products) {
      await productStmt.run(product.id, product.name, product.price, product.categoryId, product.imageUrl);
      if (product.modifiers) {
        for (const modifier of product.modifiers) {
          await productModifierStmt.run(product.id, modifier.id);
        }
      }
    }
    await productStmt.finalize();
    await productModifierStmt.finalize();
    console.log(`${products.length} products and their modifier relationships inserted.`);


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
