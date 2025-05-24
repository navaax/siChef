// src/types/product-types.ts

// --- Tipos de Base de Datos / Capa de Servicio ---

export interface Category {
  id: string;
  name: string;
  type: 'producto' | 'modificador' | 'paquete';
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
  categoryId: string;
  imageUrl?: string;
  inventory_item_id?: string | null;
  inventory_consumed_per_unit?: number | null;
}

export interface Package {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    category_id?: string | null; // Opcional: Para agrupación UI, permite null
}

export interface ProductModifierSlot {
    id: string;
    product_id: string;
    label: string;
    linked_category_id: string;
    min_quantity: number;
    max_quantity: number;
    allowedOptions?: ProductModifierSlotOption[];
}

export interface ProductModifierSlotOption {
    id: string;
    product_modifier_slot_id: string;
    modifier_product_id: string;
    modifier_product_name?: string;
    modifier_product_price?: number;
    // Nuevos campos para configuración detallada de la opción dentro del slot
    is_default?: boolean;
    price_adjustment?: number; // Ajuste al precio base del modificador, específico para este slot
}

export interface PackageItem {
    id: string;
    package_id: string;
    product_id: string;
    quantity: number;
    display_order: number;
    product_name?: string;
}

export interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string;
    product_modifier_slot_id: string;
    min_quantity: number;
    max_quantity: number;
    product_modifier_slot_label?: string;
}


// --- Tipos de UI / Gestión de Pedidos (pueden extenderse de tipos base) ---

export interface SelectedModifierItem {
    productId: string;
    name: string;
    priceModifier?: number; // Precio del modificador en sí (base + price_adjustment del slot + extraCost del pedido)
    slotId: string;
    packageItemId?: string;
    // Nuevos campos para interacciones avanzadas
    servingStyle?: string; // e.g., "Aparte", "En Vasito"
    extraCost?: number; // Costo adicional específico para esta instancia en el pedido
}

export interface OrderItem {
  type: 'product' | 'package';
  id: string;
  name: string;
  quantity: number;
  basePrice: number;
  selectedModifiers: SelectedModifierItem[];
  totalPrice: number;
  uniqueId: string;

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

// --- Tipos de Historial de Pedidos / Reportes ---

export interface SavedOrderItemComponent {
    name: string;
    slotLabel?: string;
    servingStyle?: string; // Estilo de servicio para el modificador
    extraCost?: number; // Costo extra aplicado al modificador
}

export interface SavedOrderItem {
  id: string;
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
