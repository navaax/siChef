// src/types/product-types.ts

// --- Database / Service Layer Types ---

export interface Category {
  id: string;
  name: string;
  type: 'producto' | 'modificador' | 'paquete'; // Kept for UI grouping potential
  imageUrl?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: 'pieces' | 'kg';
  initial_stock: number;
  current_stock: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string; // References categories table (type 'producto' or 'modificador')
  imageUrl?: string;
  inventory_item_id?: string;
  inventory_consumed_per_unit?: number;
}

// *** NEW: Package type ***
export interface Package {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    // categoryId?: string; // Optional, for UI grouping if needed later
}


// Represents a slot on a product where modifiers can be chosen
export interface ProductModifierSlot {
    id: string;
    product_id: string; // References products table
    label: string;
    linked_category_id: string; // References categories table (type 'modificador')
    min_quantity: number;
    max_quantity: number;
}

// Represents an item within a package
export interface PackageItem {
    id: string;
    package_id: string; // *** UPDATED: References packages table ***
    product_id: string; // References products table
    quantity: number;
    display_order: number;
    // For UI joining:
    product_name?: string; // Joined in service layer
}

// Represents overrides for modifier slots for a specific item *within a package*
export interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string; // References package_items table
    product_modifier_slot_id: string; // References product_modifier_slots table
    min_quantity: number;
    max_quantity: number;
     // For UI joining:
    product_modifier_slot_label?: string; // Joined in service layer
}


// --- UI / Order Management Types (can be extended from base types) ---

export interface SelectedModifierItem {
    productId: string;
    name: string;
    priceModifier?: number;
    slotId: string;
    packageItemId?: string;
}

export interface OrderItem {
  type: 'product' | 'package';
  id: string; // productId or packageId
  name: string;
  quantity: number;
  basePrice: number;
  selectedModifiers: SelectedModifierItem[];
  totalPrice: number;
  uniqueId: string;

  // Only for package items in the order
  packageItems?: {
    packageItemId: string;
    productId: string;
    productName: string;
    selectedModifiers: SelectedModifierItem[];
  }[];
}


export interface CurrentOrder {
  id: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  paidAmount?: number;
  changeDue?: number;
}

// --- Order History / Reporting Types ---

export interface SavedOrderItemComponent {
    name: string;
    slotLabel?: string;
}

export interface SavedOrderItem {
  id: string; // productId or packageId
  name: string;
  quantity: number;
  price: number;
  totalItemPrice: number;
  components: SavedOrderItemComponent[];
}

export interface SavedOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  items: SavedOrderItem[];
  paymentMethod: 'cash' | 'card';
  subtotal: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  paidAmount?: number;
  changeGiven?: number;
}
