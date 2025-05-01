// src/types/product-types.ts

// --- Database / Service Layer Types ---

export interface Category {
  id: string;
  name: string;
  imageUrl?: string; // Optional in DB
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl?: string; // Optional in DB
  // Modifiers are fetched separately via getModifiersForProduct
}

export interface Modifier {
  id: string;
  name: string;
  priceModifier?: number; // Optional price adjustment
}


// --- UI / Order Management Types (can be extended from base types) ---

export interface ModifierSelection extends Modifier {
  selected?: boolean; // For checkbox selection in UI
  isApart?: boolean; // For 'aparte' selection in UI
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  basePrice: number; // Price before modifiers
  selectedModifiers: ModifierSelection[]; // Modifiers chosen for this specific item instance
  totalPrice: number; // Calculated price with modifiers for the given quantity
  uniqueId: string; // Unique ID for each item added to the cart (e.g., using timestamp or uuid)
}

export interface CurrentOrder {
  id: string; // e.g., siChef-005 (generated on finalization)
  customerName: string; // Can be 'Guest' or a registered name
  items: OrderItem[];
  subtotal: number; // Sum of all item totals before tax/discounts
  total: number; // Final payable amount
  paymentMethod: 'cash' | 'card';
  paidAmount?: number; // Only for cash
  changeDue?: number; // Only for cash
}

// --- Order History / Reporting Types ---

export interface SavedOrderItem {
  id: string; // Matches product ID
  name: string;
  quantity: number;
  price: number; // Base price per unit at the time of order
  components?: string[]; // List of modifier names
  isApart?: boolean; // If any component was marked 'aparte' (simplification)
}

export interface SavedOrder {
  id: string; // Generated Order ID (e.g., siChef-001)
  orderNumber: number; // Sequential number for the day/period
  customerName: string;
  items: SavedOrderItem[];
  paymentMethod: 'cash' | 'card';
  subtotal: number; // Subtotal recorded at time of sale
  total: number; // Total recorded at time of sale
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  paidAmount?: number; // Cash specific
  changeGiven?: number; // Cash specific
}
