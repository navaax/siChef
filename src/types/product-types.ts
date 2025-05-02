// src/types/product-types.ts

// --- Tipos de Base de Datos / Capa de Servicio ---

export interface Category {
  id: string;
  name: string;
  type: 'producto' | 'modificador' | 'paquete'; // Se mantiene para posible agrupación UI
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
  categoryId: string; // Referencia tabla categories (tipo 'producto' o 'modificador')
  imageUrl?: string;
  inventory_item_id?: string | null; // Permitir null explícitamente
  inventory_consumed_per_unit?: number | null; // Permitir null explícitamente
}

export interface Package {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    category_id?: string | null; // Opcional: Para agrupación UI, permite null
}


// Representa un slot en un producto donde se pueden elegir modificadores
export interface ProductModifierSlot {
    id: string;
    product_id: string; // Referencia tabla products
    label: string;
    linked_category_id: string; // Referencia tabla categories (tipo 'modificador')
    min_quantity: number;
    max_quantity: number;
    // NUEVO: Opciones específicas permitidas para este slot, si se definen
    allowedOptions?: ProductModifierSlotOption[];
}

// NUEVO: Representa una opción de modificador específica permitida para un slot
export interface ProductModifierSlotOption {
    id: string; // ID de la entrada en la tabla product_modifier_slot_options
    product_modifier_slot_id: string;
    modifier_product_id: string; // Referencia tabla products (el modificador permitido)
    // Para UI joining (opcional, se puede unir en el servicio):
    modifier_product_name?: string;
    modifier_product_price?: number;
}

// Representa un item dentro de un paquete
export interface PackageItem {
    id: string;
    package_id: string; // Referencia tabla packages
    product_id: string; // Referencia tabla products
    quantity: number;
    display_order: number;
    // Para UI joining:
    product_name?: string; // Unido en la capa de servicio
}

// Representa overrides para slots modificadores para un item específico *dentro de un paquete*
export interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string; // Referencia tabla package_items
    product_modifier_slot_id: string; // Referencia tabla product_modifier_slots
    min_quantity: number;
    max_quantity: number;
     // Para UI joining:
    product_modifier_slot_label?: string; // Unido en la capa de servicio
}


// --- Tipos de UI / Gestión de Pedidos (pueden extenderse de tipos base) ---

export interface SelectedModifierItem {
    productId: string; // ID del producto modificador seleccionado
    name: string;
    priceModifier?: number; // Precio del modificador en sí
    slotId: string; // A qué slot pertenece esta selección
    packageItemId?: string; // Si el modificador es para un item dentro de un paquete
}

export interface OrderItem {
  type: 'product' | 'package';
  id: string; // productId o packageId
  name: string;
  quantity: number;
  basePrice: number; // Precio base del producto o precio fijo del paquete
  selectedModifiers: SelectedModifierItem[]; // Modificadores aplicados directamente (para productos) o detalles complejos (para paquetes)
  totalPrice: number; // Precio total para esta línea de pedido (cantidad * (base + mods))
  uniqueId: string; // ID único para esta línea en el pedido actual

  // Solo para items de tipo 'package' en el pedido
  packageItems?: {
    packageItemId: string; // ID de la definición en package_items
    productId: string;
    productName: string;
    selectedModifiers: SelectedModifierItem[]; // Modificadores seleccionados *para este item específico dentro del paquete*
  }[];
}


export interface CurrentOrder {
  id: string; // Podría ser generado al guardar
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  paidAmount?: number;
  changeDue?: number;
}

// --- Tipos de Historial de Pedidos / Reportes ---

// Representa un componente/modificador tal como se guarda en el historial
export interface SavedOrderItemComponent {
    name: string;
    slotLabel?: string; // De qué grupo de modificadores viene (si aplica)
}

// Representa un item de pedido tal como se guarda en el historial
export interface SavedOrderItem {
  id: string; // productId o packageId
  name: string;
  quantity: number;
  price: number; // Precio base unitario del producto o paquete al momento de la venta
  totalItemPrice: number; // Precio total calculado para esta línea (cantidad * (precio + mods))
  components: SavedOrderItemComponent[]; // Lista de modificadores o contenido del paquete
}

// Representa un pedido guardado en el historial
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
  paidAmount?: number; // Cantidad pagada si fue efectivo
  changeGiven?: number; // Cambio dado si fue efectivo
}
