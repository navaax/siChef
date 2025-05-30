// src/types/product-types.ts

// --- Tipos de Base de Datos / Capa de Servicio ---

export interface Category {
  id: string;
  name: string;
  type: 'producto' | 'modificador' | 'paquete'; // Tipo de categoría
  imageUrl?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: 'pieces' | 'kg'; // Unidad de medida
  initial_stock: number;
  current_stock: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string; // ID de la categoría a la que pertenece
  imageUrl?: string;
  inventory_item_id?: string | null; // Opcional: ID del item de inventario vinculado
  inventory_consumed_per_unit?: number | null; // Opcional: cuánto inventario consume
  is_platform_item?: boolean; // Para precios de plataforma
  platform_commission_rate?: number; // Tasa de comisión de plataforma (ej. 0.30 para 30%)
}

export interface Package {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    category_id?: string | null; // Opcional: ID de categoría (tipo 'paquete') para agrupación en UI
}

export interface ProductModifierSlot {
    id: string;
    product_id: string; // ID del producto al que pertenece este slot
    label: string; // Etiqueta UI para el slot (ej. "Elige Salsas")
    linked_category_id: string; // ID de categoría (tipo 'modificador') de donde se obtienen las opciones
    min_quantity: number;
    max_quantity: number;
    allowedOptions?: ProductModifierSlotOption[]; // Opciones específicas pre-filtradas para este slot
}

// Representa una opción específica que PUEDE estar en un slot.
// Si esta opción está en `ProductModifierSlot.allowedOptions`, significa que está explícitamente permitida.
export interface ProductModifierSlotOption {
    id: string; // ID de la entrada en la tabla product_modifier_slot_options
    product_modifier_slot_id: string;
    modifier_product_id: string; // ID del producto (de tipo 'modificador') que es esta opción
    modifier_product_name?: string; // Nombre del producto modificador (para UI)
    modifier_product_price?: number; // Precio base del producto modificador (para UI)
    is_default?: boolean; // ¿Es la opción por defecto en este slot?
    price_adjustment?: number; // Ajuste (+/-) al precio base del producto modificador, SOLO para este slot
}

export interface PackageItem {
    id: string;
    package_id: string; // ID del paquete al que pertenece
    product_id: string; // ID del producto incluido en el paquete
    quantity: number;
    display_order: number; // Para ordenar los items dentro del paquete en la UI
    product_name?: string; // Nombre del producto (para UI)
}

// Regla que sobreescribe min/max de un ProductModifierSlot para un PackageItem específico
export interface PackageItemModifierSlotOverride {
    id: string;
    package_item_id: string; // ID del item de paquete cuya regla de slot se sobreescribe
    product_modifier_slot_id: string; // ID del slot original del producto base que se está sobreescribiendo
    min_quantity: number;
    max_quantity: number;
    product_modifier_slot_label?: string; // Etiqueta del slot original (para UI)
}

// Nuevo tipo para Estilos de Servicio configurables
export interface ModifierServingStyle {
  id: string;
  category_id: string; // ID de la categoría (tipo 'modificador') a la que pertenece este estilo
  label: string; // Texto del estilo (ej. "Aparte", "En Vasito")
  display_order?: number;
}


// --- Tipos de UI / Gestión de Pedidos (pueden extenderse de tipos base) ---

export interface SelectedModifierItem {
    productId: string; // ID del producto modificador
    name: string; // Nombre del producto modificador
    priceModifier?: number; // Precio final del modificador (precio_base + price_adjustment_del_slot + extraCost_del_pedido)
    slotId: string; // ID del ProductModifierSlot al que pertenece
    packageItemId?: string; // Si el modificador es de un item dentro de un paquete
    servingStyle?: string; // Estilo de servicio seleccionado (ej. "Aparte", "En Vasito")
    extraCost?: number; // Costo adicional específico para esta instancia en el pedido
}

export interface OrderItem {
  type: 'product' | 'package';
  id: string; // ID del producto o paquete base
  name: string;
  quantity: number;
  basePrice: number; // Precio base original del producto o paquete
  totalPrice: number; // Precio total del item (cantidad * (precio_plataforma_si_aplica o basePrice + suma de modificadores))
  uniqueId: string; // ID único para la línea del pedido en la UI
  applied_commission_rate?: number; // Tasa de comisión que se aplicó (si es de plataforma)
  original_platform_price?: number; // Precio de plataforma individual si se aplicó

  packageItems?: {
    packageItemId: string; // ID del PackageItem (definición del paquete)
    productId: string;
    productName: string;
    selectedModifiers: SelectedModifierItem[]; // Modificadores para este item específico del paquete
  }[];
}


export interface CurrentOrder {
  id: string; // ID del pedido (puede ser temporal o de la BD)
  customerName: string;
  items: OrderItem[];
  paymentMethod: 'cash' | 'card';
  paidAmount?: number; // Para pagos en efectivo
  changeDue?: number; // Para pagos en efectivo
}

// --- Tipos de Historial de Pedidos / Reportes ---

export interface SavedOrderItemComponent {
    name: string; // Nombre del modificador o del item de paquete
    slotLabel?: string; // Etiqueta del grupo al que pertenece (si es modificador) o "Contenido" (si es item de paquete)
    servingStyle?: string; // Estilo de servicio para el modificador
    extraCost?: number; // Costo extra aplicado al modificador
    productId?: string; // ID del producto modificador
    priceModifier?: number; // Precio base del modificador + ajuste del slot (NO incluye extraCost)
    slotId?: string;
}

export interface SavedOrderItem {
  id: string; // ID del producto o paquete original
  name: string;
  quantity: number;
  price: number; // Precio base unitario original del producto o paquete
  totalItemPrice: number; // Precio total de esta línea de pedido (cantidad * (precio_plataforma o precio + modificadores))
  components: SavedOrderItemComponent[]; // Lista de modificadores o contenido del paquete con sus detalles
  // Para trazabilidad de precios de plataforma
  isPlatformItem?: boolean;
  platformPricePerUnit?: number; // Precio unitario de plataforma que se cobró
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
  createdAt: Date; // Fecha de creación
  updatedAt?: Date; // Fecha de última modificación
  paidAmount?: number;
  changeGiven?: number;
  cancellationDetails?: { // Detalles de cancelación
    reason: string;
    cancelledBy: string; // Username del que canceló
    cancelledAt: string; // Timestamp ISO
    authorizedPin?: string; // PIN ingresado (para registro)
  };
}

// Para el pedido pausado
export interface PausedOrder extends Omit<CurrentOrder, 'subtotal' | 'total'> {
  pausedId: string;
  pausedAt: string; // ISO string
  // Re-añadir subtotal y total ya que CurrentOrder no los tiene directamente
  subtotal: number; 
  total: number;
}
