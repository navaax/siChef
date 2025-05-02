// src/types/product-types.ts

// --- Database / Service Layer Types ---

export interface Category {
  id: string;
  name: string;
  type: 'producto' | 'modificador' | 'paquete'; // Ensure type is included
  imageUrl?: string; // Optional in DB
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
  categoryId: string;
  imageUrl?: string; // Optional in DB
  inventory_item_id?: string; // Link to inventory item (optional)
  inventory_consumed_per_unit?: number; // How much inventory is used per product unit sold
}

// Represents a slot on a product where modifiers can be chosen
export interface ProductModifierSlot {
    id: string;
    product_id: string;
    label: string; // UI Label e.g., "Choose Sauces", "Select Drink"
    linked_category_id: string; // Category from which options are drawn
    min_quantity: number;
    max_quantity: number;
}

// Represents an item within a package
export interface PackageItem {
    id: string; // Unique ID for this line item within the package definition
    package_id: string; // This is the product_id of the package (Product type)
    product_id: string; // The ID of the product included in the package
    quantity: number; // How many of this product are in the package
    display_order: number;
    // For UI joining:
    product_name?: string; // Joined in service layer
}

// Represents overrides for modifier slots for a specific item *within a package*
export interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string;
    product_modifier_slot_id: string; // Which slot on the original product is being overridden
    min_quantity: number;
    max_quantity: number;
     // For UI joining:
    product_modifier_slot_label?: string; // Joined in service layer
}


// --- UI / Order Management Types (can be extended from base types) ---

// Represents a chosen modifier (which is actually a Product from a linked category)
export interface SelectedModifierItem {
    productId: string; // The ID of the product selected as a modifier
    name: string;
    priceModifier?: number; // Price adjustment (if any) - could be derived or stored separately
    slotId: string; // Which slot this modifier belongs to
    packageItemId?: string; // Optional: Which package item this modifier belongs to (if inside a package)
}

export interface OrderItem {
  type: 'product' | 'package'; // Distinguish between regular products and packages
  id: string; // Either productId or packageId
  name: string;
  quantity: number;
  basePrice: number; // Price before modifiers (for products) or package price (for packages)
  selectedModifiers: SelectedModifierItem[]; // Modifiers chosen for this specific item instance (apply to products within packages too)
  totalPrice: number; // Calculated price with modifiers for the given quantity
  uniqueId: string; // Unique ID for each item added to the cart (e.g., using timestamp or uuid)

  // Only for package items in the order, structure might need refinement
  packageItems?: {
    packageItemId: string; // Reference to the PackageItem definition
    productId: string;
    productName: string;
    selectedModifiers: SelectedModifierItem[]; // Modifiers specific to this sub-item within the package
  }[];
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

// Represents a simplified view of an order item for display in history/reports
export interface SavedOrderItemComponent {
    name: string;
    slotLabel?: string; // Label of the slot it filled (e.g., "Salsa", "Bebida")
}

export interface SavedOrderItem {
  id: string; // Matches product ID or package ID
  name: string;
  quantity: number;
  price: number; // Base price per unit or package price at time of order
  totalItemPrice: number; // Total price for this line item (qty * (base + mods))
  components: SavedOrderItemComponent[]; // List of modifier names or included package items
}

export interface SavedOrder {
  id: string; // Generated Order ID (e.g., siChef-001)
  orderNumber: number; // Sequential number for the day/period
  customerName: string;
  items: SavedOrderItem[]; // Simplified representation for reporting
  paymentMethod: 'cash' | 'card';
  subtotal: number; // Subtotal recorded at time of sale
  total: number; // Total recorded at time of sale
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  paidAmount?: number; // Cash specific
  changeGiven?: number; // Cash specific
}
