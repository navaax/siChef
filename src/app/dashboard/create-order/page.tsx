// src/app/dashboard/create-order/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation'; // Importar hooks de Next.js
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon, RotateCcw, ShoppingBag, CookingPot, DollarSign, Copy, Edit } from 'lucide-react'; // Añadido Edit
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format as formatDate } from 'date-fns'; // Renamed to avoid conflict
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategoryUI, // Renamed from getPackagesByCategory
    getPackageById,
    getItemsForPackage,
    getOverridesForPackageItem,
    getModifiersByCategory,
    getServingStylesForCategory,
} from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service';
import { printTicket, PrinterError } from '@/services/printer-service';
import { generateTicketData } from './ticket';
import type {
    Category,
    Product,
    Package,
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride,
    OrderItem,
    CurrentOrder,
    SelectedModifierItem,
    SavedOrder,
    InventoryItem,
    ModifierServingStyle,
} from '@/types/product-types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


// --- Funciones de Ayuda ---
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(0);
    }
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};


const generateOrderId = (existingOrdersCount: number): string => {
  const nextId = existingOrdersCount + 1;
  return `siChef-${String(nextId).padStart(3, '0')}`;
};

// --- Estado del Componente ---
type View = 'categories' | 'products' | 'modifiers' | 'package-details';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[];
    selectedOptions: SelectedModifierItem[]; // Se mantiene para package-details y configuración de modificadores de producto
}

interface PackageDetailState {
    packageDef: Package;
    packageItems: PackageItem[];
    itemSlots: Record<string, ModifierSlotState[]>; // Slot definitions for each package item
}

interface ModifierInteractionState {
    orderItemUniqueId: string | null; // ID del OrderItem si se edita un modificador de un pedido existente
    modifierProductId: string | null; // ID del producto modificador
    modifierSlotId: string | null; // ID del slot al que pertenece
    packageItemContextId?: string | null; // ID del item de paquete si el modificador es de un paquete
    anchorElement: HTMLElement | null;
    availableServingStyles?: ModifierServingStyle[];
}

// --- Componente ---
export default function CreateOrderPage() {
  const router = useRouter(); // Hook para navegación
  const pathname = usePathname(); // Hook para obtener el pathname actual
  const searchParams = useSearchParams(); // Hook para leer query params
  const { toast } = useToast();

  // Estados para la lógica de edición
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalOrderForEdit, setOriginalOrderForEdit] = useState<SavedOrder | null>(null);

  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null);
  
  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]);
  
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Omit<CurrentOrder, 'subtotal' | 'total'>>({
    id: '', customerName: 'Guest', items: [], paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [packagesData, setPackagesData] = useState<Package[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map());
  const [allProductsMap, setAllProductsMap] = useState<Map<string, Product>>(new Map()); // Mapa para fácil acceso a detalles de producto

  const [servingStylePopoverState, setServingStylePopoverState] = useState<ModifierInteractionState | null>(null);
  const [extraCostDialogState, setExtraCostDialogState] = useState<ModifierInteractionState & { currentExtraCost?: number } | null>(null);
  const [extraCostInput, setExtraCostInput] = useState<string>('');

  // States for quantity dialog (used for products without modifiers and packages)
  const [itemPendingQuantity, setItemPendingQuantity] = useState<{ data: Product | Package; type: 'product' | 'package' } | null>(null);
  const [pendingQuantityInput, setPendingQuantityInput] = useState<string>("1");
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);

  // States for multi-instance modifier configuration (for products AND packages)
  const [currentProductConfigQuantity, setCurrentProductConfigQuantity] = useState(1); // Cantidad de instancias del producto principal o paquete que se está configurando
  const [modifierConfigurations, setModifierConfigurations] = useState<SelectedModifierItem[][]>([]); // Array de selecciones de modificadores, uno para cada instancia del producto
  const [currentInstanceIndexForConfiguration, setCurrentInstanceIndexForConfiguration] = useState(0); // Índice de la instancia del producto que se está configurando

  const [isLoading, setIsLoading] = useState({
        page: true, // Nuevo estado de carga general para la página, especialmente para edición
        categories: true,
        products: false,
        packages: false,
        modifiers: false, 
        packageDetails: false,
        inventory: false,
        printing: false,
        servingStyles: false,
    });

  const subtotal = useMemo(() => {
    return currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [currentOrder.items]);

  const total = useMemo(() => subtotal, [subtotal]);


  const loadOrderForEditing = useCallback(async (orderId: string) => {
    console.log(`[CreateOrderPage] loadOrderForEditing llamado para: ${orderId}`);
    setIsLoading(prev => ({ ...prev, page: true }));
    try {
        const storedOrdersString = localStorage.getItem('siChefOrders');
        if (!storedOrdersString) {
            toast({ title: "Error", description: `No se encontraron pedidos guardados.`, variant: "destructive" });
            router.replace('/dashboard/home'); // Redirigir si no hay pedidos
            return;
        }
        const existingOrders: SavedOrder[] = JSON.parse(storedOrdersString);
        const orderToEdit = existingOrders.find(o => o.id === orderId);

        if (!orderToEdit) {
            toast({ title: "Error", description: `Pedido con ID ${orderId} no encontrado.`, variant: "destructive" });
            router.replace('/dashboard/home'); // Redirigir si el pedido no existe
            return;
        }

        console.log("[CreateOrderPage] Pedido a editar encontrado:", orderToEdit);
        setOriginalOrderForEdit(orderToEdit);
        setEditingOrderId(orderId);
        setCustomerName(orderToEdit.customerName);

        const reconstructedOrderItems: OrderItem[] = [];
        for (const savedItem of orderToEdit.items) {
            let baseItemDetails: Product | Package | null = null;
            let itemType: 'product' | 'package' = 'product'; // Asumir producto por defecto

            // Determinar si es producto o paquete y obtener detalles actuales
            // Esto es una simplificación; idealmente SavedOrderItem guardaría 'type'
            if ((savedItem.components || []).some(c => c.slotLabel === 'Contenido')) {
                itemType = 'package';
                baseItemDetails = await getPackageById(savedItem.id);
            } else {
                itemType = 'product';
                baseItemDetails = await getProductById(savedItem.id);
            }

            if (!baseItemDetails) {
                console.warn(`[loadOrderForEditing] No se encontraron detalles base para el ítem ${savedItem.name} (ID: ${savedItem.id})`);
                toast({ title: "Advertencia", description: `No se pudieron cargar todos los detalles para el ítem: ${savedItem.name}. Podría haber sido eliminado.`, variant: "default"});
                continue; // Saltar este ítem si no se encuentra su definición base
            }

            const reconstructedOrderItem: OrderItem = {
                type: itemType,
                id: baseItemDetails.id,
                name: baseItemDetails.name, // Usar nombre actual de la BD
                quantity: savedItem.quantity,
                basePrice: baseItemDetails.price, // Usar precio actual de la BD
                selectedModifiers: [],
                totalPrice: savedItem.totalItemPrice, // Usar precio total guardado (incluye modificadores y costos)
                uniqueId: Date.now().toString() + Math.random().toString(), // Nuevo uniqueId para la UI
                packageItems: [],
            };

            // Reconstruir selectedModifiers para productos directos
            if (itemType === 'product') {
                reconstructedOrderItem.selectedModifiers = (savedItem.components || [])
                    .map(comp => {
                        // comp.productId debería ser el ID del producto modificador
                        // comp.slotId debería ser el ID del slot
                        // comp.priceModifier debería ser el precio del modificador tal como se aplicó
                        if (!comp.productId || !comp.slotId) {
                            console.warn(`[loadOrderForEditing] Componente guardado sin productId o slotId para ${savedItem.name}:`, comp);
                            return null;
                        }
                        return {
                            productId: comp.productId,
                            name: comp.name,
                            priceModifier: comp.priceModifier || 0,
                            slotId: comp.slotId,
                            servingStyle: comp.servingStyle || 'Normal',
                            extraCost: comp.extraCost || 0,
                        };
                    }).filter(mod => mod !== null) as SelectedModifierItem[];
            }
            // Reconstruir packageItems y sus selectedModifiers (Más complejo)
            else if (itemType === 'package' && baseItemDetails) {
                const packageDef = baseItemDetails as Package;
                const currentPackageItemsDef = await getItemsForPackage(packageDef.id);
                
                reconstructedOrderItem.packageItems = currentPackageItemsDef.map(pkgItemDef => {
                    const savedSubItemModifiers: SelectedModifierItem[] = [];
                    // Lógica para encontrar y mapear los componentes guardados que pertenecen a este pkgItemDef.productId
                    // Esto es complicado porque `SavedOrderItemComponent` no tiene un `packageItemId` directo.
                    // Asumiremos que los componentes que no son 'Contenido' y que no se mapearon a `selectedModifiers` directos del paquete,
                    // pertenecen a los sub-items secuencialmente o por alguna otra heurística.
                    // Esta es una simplificación y puede necesitar una estructura de datos más robusta en `SavedOrderItem`.
                    (savedItem.components || []).forEach(comp => {
                        if (comp.slotLabel !== 'Contenido' && comp.productId && comp.slotId /* && algún_identificador_de_subitem */) {
                           // TODO: Mejorar la lógica de mapeo de modificadores a sub-items de paquete.
                           // Por ahora, esto es una aproximación.
                            if (comp.name.includes(pkgItemDef.product_name || '')) { // Heurística muy básica
                                savedSubItemModifiers.push({
                                    productId: comp.productId,
                                    name: comp.name,
                                    priceModifier: comp.priceModifier || 0,
                                    slotId: comp.slotId,
                                    servingStyle: comp.servingStyle || 'Normal',
                                    extraCost: comp.extraCost || 0,
                                });
                            }
                        }
                    });

                    return {
                        packageItemId: pkgItemDef.id,
                        productId: pkgItemDef.product_id,
                        productName: pkgItemDef.product_name || 'Producto de Paquete',
                        selectedModifiers: savedSubItemModifiers,
                    };
                });
            }

            reconstructedOrderItems.push(reconstructedOrderItem);
        }

        setCurrentOrder(prev => ({
            ...prev,
            items: reconstructedOrderItems,
            customerName: orderToEdit.customerName, // Asegurar que el nombre del cliente se carga
            paymentMethod: orderToEdit.paymentMethod, // Cargar método de pago
            // No cargar paidAmount ni changeDue, ya que se recalcularán
        }));
        setPaidAmountInput(''); // Resetear input de pago

        toast({ title: "Modo Edición", description: `Cargado pedido #${orderToEdit.orderNumber} para editar.` });
        console.log("[CreateOrderPage] Estado del pedido reconstruido:", reconstructedOrderItems);

    } catch (error) {
        console.error("[CreateOrderPage] Error cargando pedido para editar:", error);
        toast({ title: "Error al Cargar Pedido", description: `No se pudo cargar el pedido para editar. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
        router.replace('/dashboard/create-order'); // Volver a la página limpia si falla la carga
    } finally {
        setIsLoading(prev => ({ ...prev, page: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, toast, pathname]); // No incluir searchParams directamente si causa re-ejecuciones


  // Effect to load an order for editing if `editOrderId` is in URL params
  useEffect(() => {
    const orderIdFromQuery = searchParams.get('editOrderId');
    console.log(`[CreateOrderPage] useEffect for editOrderId. Query param: ${orderIdFromQuery}, current editingOrderId: ${editingOrderId}, isLoading.page: ${isLoading.page}`);

    if (orderIdFromQuery) {
      if (editingOrderId === orderIdFromQuery) {
        console.log(`[CreateOrderPage] Ya se está editando el pedido ${orderIdFromQuery}. No se recarga.`);
        // Consider removing the param only after successful load, or if it's certain it won't be needed again.
        // For now, let's clear it here to prevent re-trigger if user refreshes.
        const newParams = new URLSearchParams(Array.from(searchParams.entries()));
        newParams.delete('editOrderId');
        router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
        return;
      }
      
      if (!isLoading.page && !editingOrderId) { // Solo cargar si no está cargando y no estamos ya en modo edición
        console.log(`[CreateOrderPage] Llamando a loadOrderForEditing para ${orderIdFromQuery}`);
        loadOrderForEditing(orderIdFromQuery);
      }
    } else if (editingOrderId && !orderIdFromQuery) {
      // Si no hay editOrderId en URL pero estábamos en modo edición (ej. el usuario borró el param manualmente o navegó)
      // Resetear el modo edición para evitar inconsistencias.
      console.log("[CreateOrderPage] No hay editOrderId en URL, pero estábamos en modo edición. Reseteando.");
      setEditingOrderId(null);
      setOriginalOrderForEdit(null);
      clearOrder(); // Limpiar el pedido actual
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, editingOrderId, isLoading.page, loadOrderForEditing]); // loadOrderForEditing es una dependencia

  useEffect(() => {
    async function fetchInitialData() {
      console.log("[CreateOrderPage] fetchInitialData: Iniciando carga de datos iniciales.");
      setIsLoading(prev => ({ ...prev, categories: true, inventory: true, page: !editingOrderId })); // page true si no estamos editando
      try {
        const [fetchedCategories, fetchedInventory, fetchedAllProducts] = await Promise.all([
            getCategories(),
            getInventoryItems(),
            getAllProductsAndModifiersList() // Usar la función que obtiene todos los productos/modificadores
        ]);
        setCategoriesData(fetchedCategories);

        const invMap = new Map<string, InventoryItem>();
        fetchedInventory.forEach(item => invMap.set(item.id, item));
        setInventoryMap(invMap);
        
        const prodMap = new Map<string, Product>();
        fetchedAllProducts.forEach(p => prodMap.set(p.id, p));
        setAllProductsMap(prodMap); // Guardar todos los productos/modificadores en un mapa

        console.log(`[CreateOrderPage] fetchInitialData: ${fetchedCategories.length} categorías, ${fetchedInventory.length} ítems de inventario, ${fetchedAllProducts.length} productos/modificadores cargados.`);

      } catch (error) {
        console.error("[CreateOrderPage] fetchInitialData: Error cargando datos:", error);
        toast({ title: "Error al Cargar Datos", description: "Fallo al cargar datos iniciales de productos o inventario.", variant: "destructive" });
      } finally {
        setIsLoading(prev => ({ ...prev, categories: false, inventory: false, page: editingOrderId ? prev.page : false }));
        console.log("[CreateOrderPage] fetchInitialData: Carga finalizada.");
      }
    }
    // Solo ejecutar si no estamos en medio de cargar un pedido para editar
    if (!editingOrderId || !isLoading.page) {
        fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, editingOrderId]); // Depender de editingOrderId para re-evaluar si cargar


  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    setProductsData([]);
    setPackagesData([]);
    try {
        const fetchedProducts = await getProductsByCategory(categoryId);
        const fetchedPackages = await getPackagesByCategoryUI(categoryId); // Usar la función renombrada

        setProductsData(fetchedProducts);
        setPackagesData(fetchedPackages);
        console.log(`[CreateOrderPage] fetchProductsAndPackages: Productos y paquetes cargados para categoría ${categoryId}`);
    } catch (error) {
      toast({ title: "Error", description: `Fallo al cargar items para categoría ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      console.error(`[CreateOrderPage] fetchProductsAndPackages: Error para categoría ${categoryId}:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, products: false, packages: false }));
    }
  }, [toast]);

   const fetchAndPrepareModifierSlots = useCallback(async (productId: string): Promise<ModifierSlotState[]> => {
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    let preparedSlots: ModifierSlotState[] = [];
    try {
        console.log(`[CreateOrderPage] fetchAndPrepareModifierSlots: Para producto ${productId}`);
        const slotsDefinition = await getModifierSlotsForProduct(productId);
        if (slotsDefinition && slotsDefinition.length > 0) {
             const optionsPromises = slotsDefinition.map(async (slotDef) => {
                 let options: Product[] = [];
                 // Si el slot tiene allowedOptions específicas, esas son las únicas que se deben considerar
                 if (slotDef.allowedOptions && slotDef.allowedOptions.length > 0) {
                     const optionDetailsPromises = slotDef.allowedOptions.map(opt => getProductById(opt.modifier_product_id));
                     options = (await Promise.all(optionDetailsPromises)).filter(p => p !== null) as Product[];
                 } else {
                     // Si no hay allowedOptions, obtener todos los modificadores de la categoría vinculada
                     options = await getModifiersByCategory(slotDef.linked_category_id);
                 }
                 // Aplicar price_adjustment si existe en allowedOptions
                 const finalOptions = options.map(optProduct => {
                    const slotOptionConfig = slotDef.allowedOptions?.find(ao => ao.modifier_product_id === optProduct.id);
                    return { 
                        ...optProduct,
                        // El precio que se muestra en la UI de modificadores debe ser el base del producto modificador.
                        // El price_adjustment se aplica al calcular el `priceModifier` del `SelectedModifierItem`.
                    };
                 });

                 return { ...slotDef, options: finalOptions, selectedOptions: [] }; // Inicializar selectedOptions vacío para ModifierSlotState
             });
            preparedSlots = await Promise.all(optionsPromises);
        }
        console.log(`[CreateOrderPage] fetchAndPrepareModifierSlots: ${preparedSlots.length} slots preparados para ${productId}`);
    } catch (error) {
        toast({ title: "Error", description: `Fallo al cargar modificadores para producto ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
        console.error(`[CreateOrderPage] fetchAndPrepareModifierSlots: Error para ${productId}:`, error);
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]);

   const fetchPackageDetails = useCallback(async (packageId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        setSelectedPackageDetail(null);
        try {
            console.log(`[CreateOrderPage] fetchPackageDetails: Para paquete ${packageId}`);
            const packageDef = await getPackageById(packageId);
            if (!packageDef) throw new Error("Paquete no encontrado");

            const packageItems = await getItemsForPackage(packageId);
            const itemSlotsPromises = packageItems.map(async (item) => {
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);
                const overrides = await getOverridesForPackageItem(item.id);
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    return override ? {
                        ...slot,
                        override: override,
                        min_quantity: override.min_quantity,
                        max_quantity: override.max_quantity,
                        selectedOptions: [] // Asegurar que selectedOptions existe
                     } : { ...slot, selectedOptions: [] }; // Asegurar que selectedOptions existe
                });
                return { packageItemId: item.id, slots: finalSlots };
            });
            const resolvedItemSlots = await Promise.all(itemSlotsPromises);
            const itemSlotsMap: Record<string, ModifierSlotState[]> = resolvedItemSlots.reduce((acc, curr) => {
                acc[curr.packageItemId] = curr.slots;
                return acc;
            }, {} as Record<string, ModifierSlotState[]>);

            setSelectedPackageDetail({ packageDef, packageItems, itemSlots: itemSlotsMap });
            setView('package-details');
            console.log(`[CreateOrderPage] fetchPackageDetails: Detalles de paquete ${packageId} cargados.`);
        } catch (error) {
            toast({ title: "Error", description: `Fallo al cargar detalles del paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
            console.error(`[CreateOrderPage] fetchPackageDetails: Error para ${packageId}:`, error);
            setView('products');
        } finally {
            setIsLoading(prev => ({ ...prev, packageDetails: false }));
        }
   }, [toast, fetchAndPrepareModifierSlots]);

  const resetAndGoToCategories = () => {
    setView('categories');
    setSelectedCategory(null);
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    setModifierConfigurations([]);
    setCurrentInstanceIndexForConfiguration(0);
    setCurrentProductConfigQuantity(1);
    setSelectedPackage(null);
    setSelectedPackageDetail(null);
    setProductsData([]);
    setPackagesData([]);
  };

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    fetchProductsAndPackages(category.id);
    setView('products');
  };

  const handleProductClick = async (product: Product) => {
    if (product.inventory_item_id) {
        const invItem = inventoryMap.get(product.inventory_item_id);
        const consumed = product.inventory_consumed_per_unit ?? 0;
        if (!invItem || invItem.current_stock < consumed) {
            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${product.name}.`, variant: "destructive" });
            return;
        }
    }
    // Para productos con modificadores, vamos directo a la vista de modificadores
    // La cantidad se manejará allí.
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setSelectedProduct(product);
        setCurrentModifierSlots(slots);
        setCurrentProductConfigQuantity(1); // Default a 1, se ajusta en la vista de modificadores
        setModifierConfigurations([[]]); // Inicializa para una instancia
        setCurrentInstanceIndexForConfiguration(0);
        setView('modifiers');
    } else {
        // Producto SIN modificadores, abrir diálogo de cantidad.
        setItemPendingQuantity({ data: product, type: 'product' });
        setPendingQuantityInput("1");
        setIsQuantityDialogOpen(true);
    }
  };

  const handlePackageClick = (pkg: Package) => {
    // Paquetes siempre usan diálogo de cantidad primero
    setItemPendingQuantity({ data: pkg, type: 'package' });
    setPendingQuantityInput("1");
    setIsQuantityDialogOpen(true);
  };

  const handleConfirmQuantity = async () => {
    if (!itemPendingQuantity) return;

    const confirmedQuantity = parseInt(pendingQuantityInput, 10);
    if (isNaN(confirmedQuantity) || confirmedQuantity <= 0) {
      toast({ title: "Cantidad Inválida", description: "Introduce una cantidad válida (mayor que 0).", variant: "destructive" });
      return;
    }

    const itemData = itemPendingQuantity.data;
    const itemType = itemPendingQuantity.type;

    if (itemType === 'product') { // Solo para productos SIN modificadores
        const product = itemData as Product;
        if (product.inventory_item_id) {
            const invItem = inventoryMap.get(product.inventory_item_id);
            const consumedTotal = (product.inventory_consumed_per_unit ?? 0) * confirmedQuantity;
            if (!invItem || invItem.current_stock < consumedTotal) {
                toast({ title: "Sin Stock Suficiente", description: `Solo hay ${invItem?.current_stock && product.inventory_consumed_per_unit ? Math.floor(invItem.current_stock / product.inventory_consumed_per_unit) : 0} unidades de ${product.name} disponibles.`, variant: "destructive" });
                return;
            }
        }
        addProductToOrder(product, [], product.price, confirmedQuantity);
        toast({ title: `${product.name} (x${confirmedQuantity}) añadido` });
        resetAndGoToCategories();
    } else if (itemType === 'package') {
        // Para paquetes, currentProductConfigQuantity se usará en la vista de detalles del paquete
        setCurrentProductConfigQuantity(confirmedQuantity); // Guardar cantidad para el paquete
        setSelectedPackage(pkg);
        await fetchPackageDetails(pkg.id); // Esto pone view='package-details'
    }

    setIsQuantityDialogOpen(false);
    setItemPendingQuantity(null);
  };


  // --- MODIFIER INTERACTION HANDLERS (for multi-instance) ---
  const handleModifierOptionClick = (
    slotId: string,
    optionProductId: string,
    optionName: string,
    optionBasePrice: number, // Precio base del producto modificador
    context: 'product' | 'package',
    packageItemUniqueId?: string
  ) => {
    if (context === 'product' && view === 'modifiers') {
        setModifierConfigurations(prevConfigs => {
            const newConfigs = [...prevConfigs];
            const currentInstanceConfig = [...(newConfigs[currentInstanceIndexForConfiguration] || [])];
            const targetSlotDefinition = currentModifierSlots.find(s => s.id === slotId);

            if (!targetSlotDefinition) return prevConfigs;

            const isSelected = currentInstanceConfig.some(opt => opt.productId === optionProductId && opt.slotId === slotId);
            let newSelectionsForInstance = [...currentInstanceConfig];
            const currentSelectionsInSlot = newSelectionsForInstance.filter(opt => opt.slotId === slotId);

            const modifierProductDefinition = targetSlotDefinition.options.find(opt => opt.id === optionProductId);
            if (!modifierProductDefinition) return prevConfigs;

            // Obtener el price_adjustment del ProductModifierSlotOption (si existe para este slot y esta opción)
            const slotOptionConfig = targetSlotDefinition.allowedOptions?.find(ao => ao.modifier_product_id === optionProductId);
            const priceAdjustment = slotOptionConfig?.price_adjustment || 0;
            // El priceModifier base para SelectedModifierItem es el precio base del producto modificador + ajuste del slot
            const effectiveModifierPriceForSelected = optionBasePrice + priceAdjustment;


            if (modifierProductDefinition.inventory_item_id) {
                const invItem = inventoryMap.get(modifierProductDefinition.inventory_item_id);
                const consumed = modifierProductDefinition.inventory_consumed_per_unit ?? 0;
                if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                    toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${optionName}.`, variant: "destructive" });
                    return prevConfigs;
                }
            }

            if (isSelected) {
                newSelectionsForInstance = newSelectionsForInstance.filter(opt => !(opt.productId === optionProductId && opt.slotId === slotId));
            } else {
                if (currentSelectionsInSlot.length < targetSlotDefinition.max_quantity) {
                    newSelectionsForInstance.push({
                        productId: optionProductId,
                        name: optionName,
                        priceModifier: effectiveModifierPriceForSelected, // Guardar precio base + ajuste slot
                        slotId: slotId,
                        servingStyle: 'Normal',
                        extraCost: 0,
                    });
                } else {
                    return prevConfigs;
                }
            }
            newConfigs[currentInstanceIndexForConfiguration] = newSelectionsForInstance;
            return newConfigs;
        });
    } else if (context === 'package' && packageItemUniqueId && selectedPackageDetail) {
        setSelectedPackageDetail(prevDetail => {
            if (!prevDetail) return null;
            const updatedItemSlots = { ...prevDetail.itemSlots };
            if(updatedItemSlots[packageItemUniqueId]) {
                const targetSlotsForPackageItem = updatedItemSlots[packageItemUniqueId];
                updatedItemSlots[packageItemUniqueId] = targetSlotsForPackageItem.map(slot => {
                     if (slot.id === slotId) {
                        const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                        let newSelections = [...slot.selectedOptions];
                        const minQty = slot.min_quantity; // Usar min_quantity del slot (que puede ser de un override)
                        const maxQty = slot.max_quantity; // Usar max_quantity del slot

                        const modifierProductDef = slot.options.find(opt => opt.id === optionProductId);
                        if (!modifierProductDef) return slot;
                        
                        const slotOptCfg = slot.allowedOptions?.find(ao => ao.modifier_product_id === optionProductId);
                        const priceAdj = slotOptCfg?.price_adjustment || 0;
                        const effectiveModPriceForSelected = optionBasePrice + priceAdj;

                        if (modifierProductDef.inventory_item_id) {
                             const invItem = inventoryMap.get(modifierProductDef.inventory_item_id);
                             const consumed = modifierProductDef.inventory_consumed_per_unit ?? 0;
                             if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                                toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${optionName}.`, variant: "destructive" });
                                return slot;
                             }
                        }

                        if (isSelected) {
                            newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                        } else {
                            if (newSelections.length < maxQty) {
                                newSelections.push({
                                    productId: optionProductId,
                                    name: optionName,
                                    priceModifier: effectiveModPriceForSelected,
                                    slotId: slotId,
                                    servingStyle: 'Normal',
                                    extraCost: 0,
                                });
                            } else {
                                return slot;
                            }
                        }
                        return { ...slot, selectedOptions: newSelections };
                    }
                    return slot;
                });

            }
            return { ...prevDetail, itemSlots: updatedItemSlots };
        });
    }
  };

const handleModifierDoubleClick = async (
    event: React.MouseEvent<HTMLDivElement>,
    modifierProductId: string, 
    slotId: string,
    context: 'product' | 'package',
    packageItemContextId?: string
) => {
    event.preventDefault();
    console.log(`[CreateOrderPage] Doble clic en modificador: ProdID=${modifierProductId}, SlotID=${slotId}, Context=${context}, PkgItemID=${packageItemContextId}`);

    let isSelectedCurrently = false;
    let targetSlotDefinition: ProductModifierSlot | ModifierSlotState | undefined;
    let linkedCategoryIdForStyles: string | undefined;


    if (context === 'product' && view === 'modifiers') {
        targetSlotDefinition = currentModifierSlots.find(s => s.id === slotId);
        linkedCategoryIdForStyles = targetSlotDefinition?.linked_category_id;
        const currentInstanceConfig = modifierConfigurations[currentInstanceIndexForConfiguration] || [];
        const selectedOpt = currentInstanceConfig.find(so => so.productId === modifierProductId && so.slotId === slotId);
        isSelectedCurrently = !!selectedOpt;
        console.log(`[CreateOrderPage] Contexto producto: SlotDef encontrado=${!!targetSlotDefinition}, linkedCatID=${linkedCategoryIdForStyles}, estáSeleccionado=${isSelectedCurrently}`);
    } else if (context === 'package' && selectedPackageDetail && packageItemContextId) {
        const targetItemSlots = selectedPackageDetail.itemSlots[packageItemContextId];
        targetSlotDefinition = targetItemSlots?.find(s => s.id === slotId);
        linkedCategoryIdForStyles = targetSlotDefinition?.linked_category_id;
        const selectedOpt = targetSlotDefinition?.selectedOptions.find(so => so.productId === modifierProductId);
        isSelectedCurrently = !!selectedOpt;
        console.log(`[CreateOrderPage] Contexto paquete: SlotDef encontrado=${!!targetSlotDefinition}, linkedCatID=${linkedCategoryIdForStyles}, estáSeleccionado=${isSelectedCurrently}`);
    }

    if (!isSelectedCurrently) {
        console.log(`[CreateOrderPage] Doble clic en modificador no seleccionado. No se abre popover.`);
        return;
    }
    if (!targetSlotDefinition || !linkedCategoryIdForStyles) {
        toast({title: "Error Interno", description: "No se pudo determinar la categoría del modificador para estilos.", variant:"destructive"});
        console.error(`[CreateOrderPage] No se pudo encontrar slot o linked_category_id. SlotDef: ${targetSlotDefinition}, LinkedCatID: ${linkedCategoryIdForStyles}`);
        return;
    }

    setIsLoading(prev => ({ ...prev, servingStyles: true }));
    try {
        const styles = await getServingStylesForCategory(linkedCategoryIdForStyles);
        console.log(`[CreateOrderPage] Estilos de servicio cargados para categoría ${linkedCategoryIdForStyles}:`, styles);
        setServingStylePopoverState({
            orderItemUniqueId: null,
            modifierProductId: modifierProductId,
            modifierSlotId: slotId,
            packageItemContextId: context === 'package' ? packageItemContextId : null,
            anchorElement: event.currentTarget,
            availableServingStyles: styles,
        });
    } catch (error) {
        toast({title: "Error", description: "No se pudieron cargar los estilos de servicio.", variant:"destructive"});
        console.error(`[CreateOrderPage] Error cargando estilos de servicio para categoría ${linkedCategoryIdForStyles}:`, error);
    } finally {
        setIsLoading(prev => ({ ...prev, servingStyles: false }));
    }
};


const handleSaveServingStyle = (styleLabel: string) => {
    if (!servingStylePopoverState) return;
    const { modifierProductId, modifierSlotId, packageItemContextId } = servingStylePopoverState;

    if (view === 'modifiers' && !packageItemContextId) { // Configurando modificadores de un producto principal
        setModifierConfigurations(prevConfigs => {
            const newConfigs = [...prevConfigs];
            const currentInstanceConfig = newConfigs[currentInstanceIndexForConfiguration] || [];
            newConfigs[currentInstanceIndexForConfiguration] = currentInstanceConfig.map(opt =>
                (opt.productId === modifierProductId && opt.slotId === modifierSlotId) ? { ...opt, servingStyle: styleLabel } : opt
            );
            return newConfigs;
        });
    } else if (view === 'package-details' && selectedPackageDetail && packageItemContextId) { // Configurando modificadores de un item dentro de un paquete
         setSelectedPackageDetail(prevDetail => {
            if (!prevDetail) return null;
            const updatedItemSlots = { ...prevDetail.itemSlots };
            if (updatedItemSlots[packageItemContextId]) {
                updatedItemSlots[packageItemContextId] = updatedItemSlots[packageItemContextId].map(slot => {
                     if (slot.id === modifierSlotId) {
                        return {
                            ...slot,
                            selectedOptions: slot.selectedOptions.map(opt =>
                                opt.productId === modifierProductId ? { ...opt, servingStyle: styleLabel } : opt
                            )
                        };
                    }
                    return slot;
                });
            }
            return { ...prevDetail, itemSlots: updatedItemSlots };
        });
    }
    else if (servingStylePopoverState.orderItemUniqueId) { // Editando un item ya en el pedido
         setCurrentOrder(prevOrder => ({
            ...prevOrder,
            items: prevOrder.items.map(item => {
                if (item.uniqueId === servingStylePopoverState.orderItemUniqueId) {
                    let updatedSelectedModifiers = [...item.selectedModifiers];
                    let updatedPackageItems = item.packageItems ? [...item.packageItems] : undefined;

                    if (packageItemContextId && updatedPackageItems) { // Modificador de un item de paquete
                        updatedPackageItems = updatedPackageItems.map(pkgItem => {
                            if (pkgItem.packageItemId === packageItemContextId) {
                                return {
                                    ...pkgItem,
                                    selectedModifiers: pkgItem.selectedModifiers.map(mod =>
                                        mod.productId === modifierProductId && mod.slotId === modifierSlotId
                                            ? { ...mod, servingStyle: styleLabel }
                                            : mod
                                    )
                                };
                            }
                            return pkgItem;
                        });
                    } else { // Modificador de un producto directo
                        updatedSelectedModifiers = updatedSelectedModifiers.map(mod =>
                            mod.productId === modifierProductId && mod.slotId === modifierSlotId
                                ? { ...mod, servingStyle: styleLabel }
                                : mod
                        );
                    }
                    // Recalcular precio total del item (esto es importante)
                    let newItemTotalPrice = item.basePrice;
                    if (item.type === 'product') {
                        updatedSelectedModifiers.forEach(mod => { newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0); });
                    } else if (item.type === 'package' && updatedPackageItems) {
                        updatedPackageItems.forEach(pi => {
                           pi.selectedModifiers.forEach(mod => { newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0); });
                        });
                    }
                    newItemTotalPrice *= item.quantity;


                    return { ...item, selectedModifiers: updatedSelectedModifiers, packageItems: updatedPackageItems, totalPrice: newItemTotalPrice };
                }
                return item;
            })
        }));
    }

    setServingStylePopoverState(null);
    toast({title: "Estilo Guardado", description: `Modificador servido: ${styleLabel}`});
};

const handleOpenExtraCostDialog = (
    orderItemUniqueId: string,
    modifierProductId: string,
    modifierSlotId: string,
    packageItemContextId?: string
) => {
    const orderItem = currentOrder.items.find(item => item.uniqueId === orderItemUniqueId);
    if (!orderItem) return;

    let targetModifier: SelectedModifierItem | undefined;
    if (packageItemContextId && orderItem.packageItems) {
        const pkgItem = orderItem.packageItems.find(pi => pi.packageItemId === packageItemContextId);
        targetModifier = pkgItem?.selectedModifiers.find(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId);
    } else {
        targetModifier = orderItem.selectedModifiers.find(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId);
    }

    setExtraCostDialogState({
        orderItemUniqueId,
        modifierProductId,
        modifierSlotId,
        packageItemContextId,
        anchorElement: null,
        currentExtraCost: targetModifier?.extraCost || 0,
    });
    setExtraCostInput(String(targetModifier?.extraCost || 0));
};


const handleSaveExtraCost = () => {
    if (!extraCostDialogState) return;
    const { orderItemUniqueId, modifierProductId, modifierSlotId, packageItemContextId } = extraCostDialogState;
    const cost = parseFloat(extraCostInput);

    if (isNaN(cost) || cost < 0) {
        toast({ title: "Costo Inválido", description: "Introduce un número positivo.", variant: "destructive" });
        return;
    }

    setCurrentOrder(prevOrder => ({
        ...prevOrder,
        items: prevOrder.items.map(item => {
            if (item.uniqueId === orderItemUniqueId) {
                let updatedSelectedModifiers = [...item.selectedModifiers];
                let updatedPackageItems = item.packageItems ? [...item.packageItems] : undefined;
                
                let itemBasePrice = item.basePrice; // Precio base del producto o paquete

                if (packageItemContextId && updatedPackageItems) {
                    updatedPackageItems = updatedPackageItems.map(pkgItem => {
                        if (pkgItem.packageItemId === packageItemContextId) {
                            return {
                                ...pkgItem,
                                selectedModifiers: pkgItem.selectedModifiers.map(mod =>
                                    mod.productId === modifierProductId && mod.slotId === modifierSlotId
                                        ? { ...mod, extraCost: cost }
                                        : mod
                                )
                            };
                        }
                        return pkgItem;
                    });
                } else {
                    updatedSelectedModifiers = updatedSelectedModifiers.map(mod =>
                        mod.productId === modifierProductId && mod.slotId === modifierSlotId
                            ? { ...mod, extraCost: cost }
                            : mod
                    );
                }
                
                // Recalcular el precio total del OrderItem
                let newItemTotalPrice = itemBasePrice;
                if (item.type === 'product') {
                    updatedSelectedModifiers.forEach(mod => {
                        newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0);
                    });
                } else if (item.type === 'package' && updatedPackageItems) {
                     // Para paquetes, el precio base del paquete ya está en itemBasePrice.
                     // Ahora sumamos los priceModifier y extraCost de todos los modificadores de todos los sub-items.
                     updatedPackageItems.forEach(pkgItem => {
                         pkgItem.selectedModifiers.forEach(mod => {
                             newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0);
                         });
                     });
                     // Y también los modificadores directos del paquete (si los hubiera)
                     updatedSelectedModifiers.forEach(mod => {
                         newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0);
                     });
                }
                newItemTotalPrice *= item.quantity;


                return { ...item, selectedModifiers: updatedSelectedModifiers, packageItems: updatedPackageItems, totalPrice: newItemTotalPrice };
            }
            return item;
        })
    }));

    setExtraCostDialogState(null);
    toast({ title: "Costo Extra Guardado" });
};

// --- Handlers for config quantity in modifier view ---
const handleDecrementConfigQuantity = () => {
    if (currentProductConfigQuantity > 1) {
        const newQuantity = currentProductConfigQuantity - 1;
        setCurrentProductConfigQuantity(newQuantity);
        setModifierConfigurations(prev => prev.slice(0, newQuantity));
        if (currentInstanceIndexForConfiguration >= newQuantity) {
            setCurrentInstanceIndexForConfiguration(newQuantity - 1);
        }
    }
};

const handleIncrementConfigQuantity = () => {
    if (selectedProduct && selectedProduct.inventory_item_id) {
        const invItem = inventoryMap.get(selectedProduct.inventory_item_id);
        const consumedPerUnit = selectedProduct.inventory_consumed_per_unit ?? 0;
        if (!invItem || invItem.current_stock < consumedPerUnit * (currentProductConfigQuantity + 1) ) {
            toast({ title: "Sin Stock Suficiente", description: `No hay suficiente ${invItem?.name || 'inventario'} para añadir otra unidad de ${selectedProduct.name}. Solo quedan ${invItem?.current_stock && consumedPerUnit ? Math.floor(invItem.current_stock / consumedPerUnit) : 0}.`, variant: "destructive" });
            return;
        }
    }
    const newQuantity = currentProductConfigQuantity + 1;
    setCurrentProductConfigQuantity(newQuantity);
    setModifierConfigurations(prev => [...prev, []]);
};

const handleConfigQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newQuantity = parseInt(e.target.value, 10);
    if (isNaN(newQuantity) || newQuantity < 1) {
        setPendingQuantityInput(String(currentProductConfigQuantity)); // Revertir si es inválido
        return;
    }

    if (selectedProduct && selectedProduct.inventory_item_id) {
        const invItem = inventoryMap.get(selectedProduct.inventory_item_id);
        const consumedTotal = (selectedProduct.inventory_consumed_per_unit ?? 0) * newQuantity;
        const maxPossible = invItem?.current_stock && selectedProduct.inventory_consumed_per_unit ? Math.floor(invItem.current_stock / selectedProduct.inventory_consumed_per_unit) : 0;
        
        if (!invItem || invItem.current_stock < consumedTotal) {
            toast({ title: "Sin Stock Suficiente", description: `Solo hay ${maxPossible} unidades de ${selectedProduct.name} disponibles.`, variant: "destructive" });
            newQuantity = maxPossible > 0 ? maxPossible : 1;
        }
    }
    
    setCurrentProductConfigQuantity(newQuantity);
    setModifierConfigurations(prev => {
        const currentLength = prev.length;
        if (newQuantity > currentLength) {
            return [...prev, ...Array(newQuantity - currentLength).fill([])];
        } else if (newQuantity < currentLength) {
            return prev.slice(0, newQuantity);
        }
        return prev;
    });
    if (currentInstanceIndexForConfiguration >= newQuantity) {
        setCurrentInstanceIndexForConfiguration(Math.max(0, newQuantity - 1));
    }
};


  const handleAddConfiguredProductInstancesToOrder = () => {
    if (!selectedProduct || modifierConfigurations.length === 0) return;

    let allInstancesValid = true;
    for (let i = 0; i < currentProductConfigQuantity; i++) {
        const currentInstanceConfig = modifierConfigurations[i];
        for (const slot of currentModifierSlots) {
            const selectedForSlot = currentInstanceConfig.filter(mod => mod.slotId === slot.id);
            if (selectedForSlot.length < slot.min_quantity) {
                toast({ title: `Selección Incompleta (Instancia ${i + 1})`, description: `Debes seleccionar al menos ${slot.min_quantity} en "${slot.label}".`, variant: "destructive" });
                allInstancesValid = false;
                break;
            }
        }
        if (!allInstancesValid) break;
    }

    if (!allInstancesValid) return;

    modifierConfigurations.forEach((instanceConfig) => {
        let modifierPriceTotalForInstance = 0;
        instanceConfig.forEach(mod => {
            modifierPriceTotalForInstance += (mod.priceModifier || 0) + (mod.extraCost || 0);
        });
        const pricePerUnitForInstance = selectedProduct.price + modifierPriceTotalForInstance;
        addProductToOrder(selectedProduct, instanceConfig, pricePerUnitForInstance, 1);
    });

    toast({
        title: `${selectedProduct.name} (x${currentProductConfigQuantity}) añadido(s)`,
    });
    resetAndGoToCategories();
  };


   const handleAddPackageToOrder = async () => {
        if (!selectedPackageDetail) return;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        let inventoryOk = true;
        const tempInventoryChanges: Record<string, number> = {}; // Para rastrear consumo de inventario dentro de este paquete

        // Mapa para detalles de productos dentro del paquete, incluyendo modificadores
        const allProductIdsInPackageAndModifiers = new Set<string>();
        packageItems.forEach(item => allProductIdsInPackageAndModifiers.add(item.product_id));
        Object.values(itemSlots).flat().forEach(slot => {
            slot.options.forEach(opt => allProductIdsInPackageAndModifiers.add(opt.id));
            slot.selectedOptions.forEach(sel => allProductIdsInPackageAndModifiers.add(sel.productId));
        });
        
        // Reutilizar allProductsMap si está disponible y completo
        const productDetailsMap = new Map<string, Product>();
        allProductIdsInPackageAndModifiers.forEach(id => {
            const prod = allProductsMap.get(id);
            if (prod) productDetailsMap.set(id, prod);
        });


        for (const item of packageItems) {
            const productDetails = productDetailsMap.get(item.product_id);
            if (!productDetails) {
                toast({ title: "Error", description: `Definición de producto para ${item.product_name || 'desconocido'} no encontrada.`, variant: "destructive" });
                inventoryOk = false; break;
            }

            if (productDetails.inventory_item_id) {
                const invItem = inventoryMap.get(productDetails.inventory_item_id);
                const consumed = (productDetails.inventory_consumed_per_unit ?? 0) * item.quantity * currentProductConfigQuantity;
                const currentStock = invItem?.current_stock ?? 0;
                const alreadyConsumedInThisPackage = tempInventoryChanges[productDetails.inventory_item_id] || 0;

                if (currentStock + alreadyConsumedInThisPackage < consumed) { 
                    toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${item.product_name} en paquete.`, variant: "destructive" });
                    inventoryOk = false; break;
                } else if (consumed > 0) {
                    tempInventoryChanges[productDetails.inventory_item_id] = alreadyConsumedInThisPackage - consumed;
                }
            }

            const slotsForItem = itemSlots[item.id] || [];
            for (const slot of slotsForItem) {
                if (slot.selectedOptions.length < slot.min_quantity) {
                     toast({ title: "Selección Incompleta", description: `Para "${item.product_name}", debes seleccionar al menos ${slot.min_quantity} ${slot.label.toLowerCase()}.`, variant: "destructive" });
                    inventoryOk = false; break;
                }
                 for (const modOption of slot.selectedOptions) {
                     const modProductDetails = productDetailsMap.get(modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * currentProductConfigQuantity; // Modificadores de paquete se consumen por cada paquete
                         const currentStock = invItem?.current_stock ?? 0;
                         const alreadyConsumedInThisPackage = tempInventoryChanges[modProductDetails.inventory_item_id] || 0;
                        if (currentStock + alreadyConsumedInThisPackage < consumed) {
                            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para modificador ${modOption.name}.`, variant: "destructive" });
                            inventoryOk = false; break;
                         } else if (consumed > 0) {
                            tempInventoryChanges[modProductDetails.inventory_item_id] = alreadyConsumedInThisPackage - consumed;
                        }
                     }
                 }
                 if (!inventoryOk) break;
            }
             if (!inventoryOk) break;
        }

        if (!inventoryOk) return;

        for (let i = 0; i < currentProductConfigQuantity; i++) {
            let finalPackagePrice = packageDef.price; // Precio base del paquete
             const packageItemsWithModifiers: OrderItem['packageItems'] = packageItems.map(item => {
                const selectedModsForItem = (itemSlots[item.id] || []).flatMap(slot => slot.selectedOptions);
                // Sumar el costo de los modificadores al precio final del paquete
                selectedModsForItem.forEach(mod => {
                    finalPackagePrice += (mod.priceModifier || 0) + (mod.extraCost || 0);
                });
                return {
                    packageItemId: item.id,
                    productId: item.product_id,
                    productName: item.product_name || 'Producto Desconocido',
                    selectedModifiers: selectedModsForItem
                };
            });

            const newOrderItem: OrderItem = {
                type: 'package', id: packageDef.id, name: packageDef.name, quantity: 1, 
                basePrice: packageDef.price, // Precio base del paquete (sin modificadores de sub-items)
                selectedModifiers: [], 
                totalPrice: finalPackagePrice, // Precio final del paquete (1 instancia), incluyendo costos de modificadores de sub-items
                uniqueId: Date.now().toString() + Math.random().toString(),
                packageItems: packageItemsWithModifiers
            };
            setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
        }
        toast({ title: `Paquete "${packageDef.name}" (x${currentProductConfigQuantity}) añadido` });
        resetAndGoToCategories();
   };

  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[], pricePerUnit: number, quantity: number) => {
    const newOrderItem: OrderItem = {
      type: 'product', id: product.id, name: product.name, quantity: quantity,
      basePrice: product.price,
      selectedModifiers: modifiers,
      totalPrice: pricePerUnit * quantity, // Ya debe incluir el precio base y los modificadores
      uniqueId: Date.now().toString() + Math.random().toString(),
    };
    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
  };


  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta);
           // El precio unitario aquí es el (precio base del item + suma de todos sus modificadores/costos extra)
           // El `item.totalPrice` actual ya refleja esto para `item.quantity`.
           // Por lo tanto, el precio unitario es `item.totalPrice / item.quantity`.
           let pricePerUnitConsideringModifiers = item.basePrice;
           if (item.quantity > 0) { // Evitar división por cero
                pricePerUnitConsideringModifiers = item.totalPrice / item.quantity;
           } else if (newQuantity > 0) { // Si la cantidad era 0 y ahora es >0, recalcular precio unitario
                pricePerUnitConsideringModifiers = item.basePrice;
                if(item.type === 'product') {
                    item.selectedModifiers.forEach(mod => {
                        pricePerUnitConsideringModifiers += (mod.priceModifier || 0) + (mod.extraCost || 0);
                    });
                } else if (item.type === 'package' && item.packageItems) {
                    item.packageItems.forEach(pi => {
                        pi.selectedModifiers.forEach(mod => {
                             pricePerUnitConsideringModifiers += (mod.priceModifier || 0) + (mod.extraCost || 0);
                        });
                    });
                     item.selectedModifiers.forEach(mod => { // Modificadores directos del paquete
                        pricePerUnitConsideringModifiers += (mod.priceModifier || 0) + (mod.extraCost || 0);
                    });
                }
           }
          
          // TODO: Verificar inventario al aumentar cantidad. Es complejo.
          return { ...item, quantity: newQuantity, totalPrice: pricePerUnitConsideringModifiers * newQuantity };
        }
        return item;
      });
      updatedItems = updatedItems.filter(item => item.quantity > 0);
      return { ...prev, items: updatedItems };
    });
  };

  const handleRemoveItem = (uniqueId: string) => {
     setCurrentOrder(prev => ({ ...prev, items: prev.items.filter(item => item.uniqueId !== uniqueId) }));
     toast({ title: `Item eliminado del pedido`, variant: 'destructive' })
  };

  const clearOrder = () => {
    setCurrentOrder({ id: '', customerName: 'Guest', items: [], paymentMethod: 'card' });
    setCustomerName(''); setIsRegisteringCustomer(false); setPaidAmountInput('');
    resetProductSelection(); resetPackageSelection(); // Limpiar selecciones
    setEditingOrderId(null); setOriginalOrderForEdit(null); // Salir de modo edición
    const newParams = new URLSearchParams(Array.from(searchParams.entries()));
    newParams.delete('editOrderId');
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    toast({ title: "Pedido Limpiado", variant: "destructive" });
  };

  const resetProductSelection = () => {
    setSelectedProduct(null); 
    setCurrentModifierSlots([]);
    setModifierConfigurations([]);
    setCurrentInstanceIndexForConfiguration(0);
    setCurrentProductConfigQuantity(1);
  }
  const resetPackageSelection = () => {
    setSelectedPackage(null); 
    setSelectedPackageDetail(null);
    setCurrentProductConfigQuantity(1);
  }

  const handleBack = () => {
    if (view === 'modifiers') { resetProductSelection(); setView('products'); }
    else if (view === 'package-details') { resetPackageSelection(); setView('products'); }
    else if (view === 'products') { setView('categories'); setSelectedCategory(null); setProductsData([]); setPackagesData([]); }
  };

  useEffect(() => {
    if (currentOrder.paymentMethod === 'cash') {
      const paid = parseFloat(paidAmountInput) || 0;
      const change = paid - total;
      setCurrentOrder(prev => ({ ...prev, paidAmount: paid, changeDue: change >= 0 ? change : undefined }));
    } else {
      setCurrentOrder(prev => ({ ...prev, paidAmount: undefined, changeDue: undefined }));
      setPaidAmountInput('');
    }
  }, [paidAmountInput, total, currentOrder.paymentMethod]);


  const handleSaveCustomer = () => {
      if(customerName.trim()){
        setCurrentOrder(prev => ({ ...prev, customerName: customerName }));
        setIsRegisteringCustomer(false);
        toast({ title: "Cliente Guardado", description: `Pedido asociado con ${customerName}` });
      } else {
           toast({ title: "Nombre Inválido", description: "Por favor introduce un nombre de cliente.", variant: 'destructive' });
      }
  };

   const handleActualPrint = async (receiptHtml: string) => {
        setIsLoading(prev => ({ ...prev, printing: true }));
        toast({ title: "Imprimiendo...", description: "Enviando comanda a la impresora..." });
        try {
            await printTicket(receiptHtml);
            toast({ title: "Diálogo de Impresión Mostrado", description: `Selecciona una impresora en el diálogo del sistema.` });
        } catch (error) {
             console.error("Error al imprimir:", error);
             const message = error instanceof PrinterError ? error.message : "Error desconocido al imprimir.";
             toast({ variant: "destructive", title: "Error de Impresión", description: message });
        } finally {
            setIsLoading(prev => ({ ...prev, printing: false }));
        }
   };

  const handleFinalizeOrder = async () => {
    if (currentOrder.items.length === 0) {
      toast({ title: "Pedido Vacío", description: "Por favor añade items al pedido.", variant: 'destructive' }); return;
    }
    if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < total)) {
       toast({ title: "Pago Incompleto", description: "La cantidad pagada en efectivo es menor que el total.", variant: 'destructive' }); return;
    }

     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try {
         existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({
             ...order, createdAt: new Date(order.createdAt), updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
             items: order.items?.map((item: any) => ({
                id: item.id || 'unknown', name: item.name || 'Unknown Item',
                quantity: typeof item.quantity === 'number' ? item.quantity : 0,
                price: typeof item.price === 'number' ? item.price : 0,
                totalItemPrice: typeof item.totalItemPrice === 'number' ? item.totalItemPrice : 0,
                components: Array.isArray(item.components) ? item.components.map((c:any) => ({ ...c, productId: c.productId, slotId: c.slotId })) : [],
             })) || [],
             subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
             total: typeof order.total === 'number' ? order.total : 0,
             status: ['pending', 'completed', 'cancelled'].includes(order.status) ? order.status : 'pending',
             paymentMethod: ['cash', 'card'].includes(order.paymentMethod) ? order.paymentMethod : 'card',
         }));
     } catch (e) { console.error("Error parseando pedidos existentes", e); }

     setIsLoading(prev => ({ ...prev, inventory: true }));
     // --- Lógica de ajuste de inventario ---
     // Para edición:
     // 1. Reponer inventario del pedido original (si `originalOrderForEdit` existe)
     // 2. Consumir inventario del pedido actual (`currentOrder`)
     // Para nuevo pedido:
     // 1. Consumir inventario del pedido actual (`currentOrder`)
     let inventoryAdjustmentFailed = false;
     try {
        // Paso 1: Reponer inventario si estamos editando
        if (editingOrderId && originalOrderForEdit) {
            console.log("[CreateOrderPage] Reponiendo inventario del pedido original:", originalOrderForEdit.id);
            // Similar a la lógica de cancelación, pero con `originalOrderForEdit.items` y ajuste positivo
            const originalInventoryAdjustments: Record<string, number> = {}; // item_id -> change
            for (const savedItem of originalOrderForEdit.items) {
                const itemDef = allProductsMap.get(savedItem.id); // Usar allProductsMap para detalles actuales
                if (itemDef?.inventory_item_id && itemDef.inventory_consumed_per_unit) {
                    originalInventoryAdjustments[itemDef.inventory_item_id] = (originalInventoryAdjustments[itemDef.inventory_item_id] || 0) + (itemDef.inventory_consumed_per_unit * savedItem.quantity);
                }
                for (const comp of savedItem.components) {
                    if (comp.productId && comp.slotLabel !== 'Contenido') {
                        const modDef = allProductsMap.get(comp.productId);
                        if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) {
                            originalInventoryAdjustments[modDef.inventory_item_id] = (originalInventoryAdjustments[modDef.inventory_item_id] || 0) + (modDef.inventory_consumed_per_unit * savedItem.quantity);
                        }
                    }
                }
            }
            for (const [itemId, change] of Object.entries(originalInventoryAdjustments)) {
                if (change !== 0) await adjustInventoryStock(itemId, change);
            }
            console.log("[CreateOrderPage] Inventario del pedido original repuesto.");
        }

        // Paso 2: Consumir inventario del pedido actual (nuevo o editado)
        console.log("[CreateOrderPage] Consumiendo inventario del pedido actual/editado.");
        const currentInventoryAdjustments: Record<string, number> = {}; // item_id -> change (negativo para consumo)
        for (const orderItem of currentOrder.items) {
            const itemDef = allProductsMap.get(orderItem.id);
            if (itemDef?.inventory_item_id && itemDef.inventory_consumed_per_unit) {
                currentInventoryAdjustments[itemDef.inventory_item_id] = (currentInventoryAdjustments[itemDef.inventory_item_id] || 0) - (itemDef.inventory_consumed_per_unit * orderItem.quantity);
            }
            if (orderItem.type === 'product') {
                for (const modifier of orderItem.selectedModifiers) {
                    const modDef = allProductsMap.get(modifier.productId);
                    if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) {
                        currentInventoryAdjustments[modDef.inventory_item_id] = (currentInventoryAdjustments[modDef.inventory_item_id] || 0) - (modDef.inventory_consumed_per_unit * orderItem.quantity);
                    }
                }
            } else if (orderItem.type === 'package' && orderItem.packageItems) {
                for (const pkgItem of orderItem.packageItems) {
                    const pkgItemDef = allProductsMap.get(pkgItem.productId);
                    const pkgItemDefinitionFromPackage = selectedPackageDetail?.packageItems.find(piDef => piDef.id === pkgItem.packageItemId) || 
                                                         originalOrderForEdit?.items.find(oi => oi.id === orderItem.id) // Fallback para encontrar la definición original
                                                            ?.components.find(c => c.productId === pkgItem.productId && c.slotLabel === 'Contenido'); // Heurística
                    const itemQtyInPackage = (typeof pkgItemDefinitionFromPackage?.quantity === 'number' ? pkgItemDefinitionFromPackage.quantity : 1);


                    if (pkgItemDef?.inventory_item_id && pkgItemDef.inventory_consumed_per_unit) {
                        currentInventoryAdjustments[pkgItemDef.inventory_item_id] = (currentInventoryAdjustments[pkgItemDef.inventory_item_id] || 0) - (pkgItemDef.inventory_consumed_per_unit * itemQtyInPackage * orderItem.quantity);
                    }
                    for (const modifier of pkgItem.selectedModifiers) {
                        const modDef = allProductsMap.get(modifier.productId);
                        if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) {
                             currentInventoryAdjustments[modDef.inventory_item_id] = (currentInventoryAdjustments[modDef.inventory_item_id] || 0) - (modDef.inventory_consumed_per_unit * orderItem.quantity);
                        }
                    }
                }
            }
        }
        for (const [itemId, change] of Object.entries(currentInventoryAdjustments)) {
             if (change !== 0) await adjustInventoryStock(itemId, change);
        }
        console.log("[CreateOrderPage] Inventario del pedido actual consumido.");
        
        // Actualizar el mapa de inventario local
        const newInvMap = new Map(inventoryMap);
        Object.entries(currentInventoryAdjustments).forEach(([itemId, change]) => {
            const currentInvItem = newInvMap.get(itemId);
            if (currentInvItem) newInvMap.set(itemId, { ...currentInvItem, current_stock: currentInvItem.current_stock + change });
        });
        if (editingOrderId && originalOrderForEdit) { // Si se editó, también aplicar la reposición al mapa local
            Object.entries(currentInventoryAdjustments).forEach(([itemId, change]) => { // Aquí debería ser originalInventoryAdjustments
                const originalChange = (currentInventoryAdjustments[itemId] || 0) + (-change); // Esto es para el mapa, no para la BD
                const currentInvItem = newInvMap.get(itemId);
                if (currentInvItem) newInvMap.set(itemId, { ...currentInvItem, current_stock: currentInvItem.current_stock + originalChange });
            });
        }
        setInventoryMap(newInvMap);

     } catch (error) {
          toast({ title: "Error Inventario", description: `Fallo al actualizar inventario: ${error instanceof Error ? error.message : 'Error desconocido'}. Pedido no guardado.`, variant: "destructive" });
          inventoryAdjustmentFailed = true;
     } finally {
          setIsLoading(prev => ({ ...prev, inventory: false }));
     }
     if (inventoryAdjustmentFailed) return;


     const newOrderData = {
        customerName: currentOrder.customerName,
        items: currentOrder.items.map(item => {
            let components: SavedOrderItemComponent[] = [];
            if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                    // Componente para el sub-item del paquete
                    components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido', productId: pkgItem.productId });
                    if (pkgItem.selectedModifiers.length > 0) {
                         pkgItem.selectedModifiers.forEach(mod => {
                             components.push({ name: mod.name, slotId: mod.slotId, productId: mod.productId, priceModifier: mod.priceModifier, servingStyle: mod.servingStyle, extraCost: mod.extraCost });
                         });
                    }
                });
            }
            else if (item.type === 'product' && item.selectedModifiers.length > 0) {
                 item.selectedModifiers.forEach(mod => {
                    components.push({ name: mod.name, slotId: mod.slotId, productId: mod.productId, priceModifier: mod.priceModifier, servingStyle: mod.servingStyle, extraCost: mod.extraCost });
                 });
            }
            return {
              id: item.id, name: item.name, quantity: item.quantity,
              price: item.basePrice,
              totalItemPrice: item.totalPrice,
              components: components,
            };
        }),
        paymentMethod: currentOrder.paymentMethod, 
        subtotal: subtotal,
        total: total,
        status: 'pending', 
        paidAmount: currentOrder.paidAmount, changeGiven: currentOrder.changeDue,
    };

    let finalizedOrder: SavedOrder;
    let updatedOrders: SavedOrder[];

    if (editingOrderId) {
        finalizedOrder = {
            ...originalOrderForEdit!, // Usar el original para mantener createdAt y orderNumber
            ...newOrderData,
            id: editingOrderId, // Asegurar que el ID original se mantiene
            updatedAt: new Date(),
        };
        updatedOrders = existingOrders.map(o => o.id === editingOrderId ? finalizedOrder : o);
        toast({ title: "Pedido Actualizado", description: `${finalizedOrder.id} actualizado.` });
    } else {
        const newOrderId = generateOrderId(existingOrders.length);
        const newOrderNumber = existingOrders.length + 1;
        finalizedOrder = {
            ...newOrderData,
            id: newOrderId,
            orderNumber: newOrderNumber,
            createdAt: new Date(),
        };
        updatedOrders = [...existingOrders, finalizedOrder];
        toast({ title: "Pedido Finalizado", description: `${finalizedOrder.id} creado y guardado.` });
    }

    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    const printReceiptsEnabled = localStorage.getItem('siChefSettings_printReceipts') === 'true';
    if (printReceiptsEnabled) {
        const receiptHtml = await generateTicketData(finalizedOrder);
        await handleActualPrint(receiptHtml);
    } else {
         toast({ title: "Impresión Omitida", description: "La impresión de recibos está desactivada en la configuración." });
    }

    clearOrder(); // Esto también resetea editingOrderId y originalOrderForEdit
    resetAndGoToCategories();
  };

  const handleApplyCurrentModifiersToAllInstances = () => {
    if (modifierConfigurations.length <= 1 || currentInstanceIndexForConfiguration < 0) return;

    const currentConfig = modifierConfigurations[currentInstanceIndexForConfiguration];
    const newConfigs = modifierConfigurations.map(() => [...currentConfig]);
    setModifierConfigurations(newConfigs);
    toast({title: "Configuración Aplicada", description: "Modificadores de esta instancia aplicados a todas."});
  };

  const isViewLoading = isLoading.page || // Carga de página (para edición)
    (view === 'categories' && isLoading.categories) ||
    (view === 'products' && (isLoading.products || isLoading.packages)) ||
    (view === 'modifiers' && isLoading.modifiers) || // No incluir isLoading.servingStyles aquí
    (view === 'package-details' && isLoading.packageDetails); // No incluir isLoading.servingStyles aquí


  // --- Lógica de Renderizado ---
  const renderBackButton = () => {
    if (view === 'products') {
        return (
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2 md:mb-4 text-sm">
                <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Categorías
            </Button>
        );
    } else if (view === 'modifiers' && selectedCategory) {
        return (
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2 md:mb-4 text-sm">
                <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory.name}
            </Button>
        );
    } else if (view === 'package-details' && selectedCategory) {
         return (
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2 md:mb-4 text-sm">
                <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory.name}
            </Button>
        );
    }
    return editingOrderId && originalOrderForEdit ? 
      <CardDescription className="text-xs md:text-sm">Editando Pedido #{originalOrderForEdit.orderNumber}. Modifica y luego actualiza.</CardDescription> :
      <CardDescription className="text-xs md:text-sm">Selecciona categorías, productos, paquetes y modificadores.</CardDescription>;
  };


  const renderContent = () => {
    switch (view) {
      case 'categories':
        const displayCategories = categoriesData.filter(cat => cat.type !== 'modificador');
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {displayCategories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-24 md:h-32 bg-secondary">
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category"/>
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div>
                  )}
                  {cat.type === 'paquete' && <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent text-xs px-1 py-0">Paquete UI</Badge>}
                 </div>
                 <CardHeader className="p-2 md:p-3">
                  <CardTitle className="text-center text-xs md:text-sm">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
             {displayCategories.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">No hay categorías disponibles.</p>}
          </div>
        );

      case 'products':
        return (
          <>
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4">{selectedCategory?.name}</h2>
             {packagesData.length > 0 && (
                 <>
                    <h3 className="text-md md:text-lg font-medium mb-2 md:mb-3 text-accent border-b pb-1">Paquetes Disponibles</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
                    {packagesData.map(pkg => (
                        <Card key={pkg.id} onClick={() => handlePackageClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                            <div className="relative w-full h-24 md:h-32 bg-secondary">
                                {pkg.imageUrl ? (
                                    <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal"/>
                                ) : ( <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><PackageIcon className="h-8 w-8"/></div> )}
                                <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent text-xs px-1 py-0">Paquete</Badge>
                            </div>
                            <CardHeader className="p-2 md:p-3">
                                <CardTitle className="text-xs md:text-sm">{pkg.name}</CardTitle>
                                <CardDescription className="text-xs">{formatCurrency(pkg.price)}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                    </div>
                 </>
             )}
             {productsData.length > 0 && (
                 <>
                     <h3 className="text-md md:text-lg font-medium mb-2 md:mb-3 border-b pb-1">Productos Individuales</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                      {productsData.map(prod => (
                        <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                            <div className="relative w-full h-24 md:h-32 bg-secondary">
                              {prod.imageUrl ? (
                                <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food"/>
                               ) : ( <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8"/></div> )}
                             </div>
                          <CardHeader className="p-2 md:p-3">
                            <CardTitle className="text-xs md:text-sm">{prod.name}</CardTitle>
                            <CardDescription className="text-xs">{formatCurrency(prod.price)}</CardDescription>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                 </>
             )}
            {productsData.length === 0 && packagesData.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-10">No hay items encontrados en la categoría '{selectedCategory?.name}'.</p>
             )}
          </>
        );

     case 'modifiers':
         if (!selectedProduct) return <p className="text-center text-muted-foreground py-10">Error: No hay producto seleccionado.</p>;
         
         const currentInstanceConfig = modifierConfigurations[currentInstanceIndexForConfiguration] || [];

        return (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-3 p-2 border rounded-md bg-muted/30">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold">{selectedProduct.name}</h2>
                        <p className="text-sm text-muted-foreground">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handleDecrementConfigQuantity} disabled={currentProductConfigQuantity <= 1}>
                            <MinusCircle className="h-5 w-5" />
                        </Button>
                        <Input
                            type="number"
                            value={String(currentProductConfigQuantity)} // Asegurar que es string para el input
                            onChange={handleConfigQuantityInputChange}
                            className="w-16 h-9 text-center text-base"
                            min="1"
                        />
                        <Button variant="outline" size="icon" onClick={handleIncrementConfigQuantity}>
                            <PlusCircle className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {currentProductConfigQuantity > 1 && (
                    <div className="flex items-center justify-between gap-2 mb-3 p-2 border rounded-md bg-muted/30">
                        <Button variant="outline" size="sm" onClick={() => setCurrentInstanceIndexForConfiguration(prev => Math.max(0, prev - 1))} disabled={currentInstanceIndexForConfiguration === 0}>Anterior</Button>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Instancia {currentInstanceIndexForConfiguration + 1} de {currentProductConfigQuantity}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentInstanceIndexForConfiguration(prev => Math.min(currentProductConfigQuantity - 1, prev + 1))} disabled={currentInstanceIndexForConfiguration === currentProductConfigQuantity - 1}>Siguiente</Button>
                    </div>
                )}
                 <p className="text-xs md:text-sm text-muted-foreground mb-2">Configura modificadores. Doble clic para estilos de servicio.</p>
            </div>
            
             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4 text-center">No hay modificadores disponibles para este producto.</p>}
             
             <ScrollArea className="flex-grow mb-3">
                <div className="space-y-4 md:space-y-6 pr-2">
                    {currentModifierSlots.map(slot => {
                        const selectedForSlotInCurrentInstance = currentInstanceConfig.filter(sel => sel.slotId === slot.id);
                        return (
                            <div key={slot.id}>
                                <h3 className="text-md md:text-lg font-medium mb-1 md:mb-2">{slot.label} <span className="text-xs md:text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                                {selectedForSlotInCurrentInstance.length > 0 && (
                                    <div className="mb-1 text-xs text-muted-foreground">Seleccionados: {selectedForSlotInCurrentInstance.length} / {slot.max_quantity}</div>
                                )}
                                {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                                    {slot.options.map(option => {
                                        const isSelectedInCurrentInstance = selectedForSlotInCurrentInstance.some(sel => sel.productId === option.id);
                                        const maxReachedForSlotInCurrentInstance = selectedForSlotInCurrentInstance.length >= slot.max_quantity;
                                        const isDisabled = !isSelectedInCurrentInstance && maxReachedForSlotInCurrentInstance;
                                        
                                        const currentSelectionDetails = selectedForSlotInCurrentInstance.find(sel => sel.productId === option.id);
                                        
                                        let optionInventoryOk = true; let optionInvItemName = '';
                                        if (option.inventory_item_id) {
                                            const invItem = inventoryMap.get(option.inventory_item_id);
                                            optionInvItemName = invItem?.name || 'Item Inventario';
                                            optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                        }
                                        const isOutOfStock = !optionInventoryOk && !isSelectedInCurrentInstance;

                                        const slotOptionConfig = slot.allowedOptions?.find(ao => ao.modifier_product_id === option.id);
                                        const priceAdjustment = slotOptionConfig?.price_adjustment || 0;
                                        const displayPriceForModifier = option.price + priceAdjustment + (currentSelectionDetails?.extraCost || 0);

                                        return (
                                        <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id && servingStylePopoverState?.packageItemContextId === null} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}>
                                            <PopoverTrigger asChild>
                                            <div
                                                onDoubleClick={(e) => handleModifierDoubleClick(e, option.id, slot.id, 'product')}
                                            >
                                                <Card
                                                    onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'product' )}
                                                    className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative h-full flex flex-col justify-between", isSelectedInCurrentInstance && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )}
                                                    title={isDisabled ? `Max (${slot.max_quantity}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                                >
                                                    {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                                    <span className="text-xs md:text-sm block leading-tight">{option.name} {currentSelectionDetails?.servingStyle && currentSelectionDetails.servingStyle !== 'Normal' && `(${currentSelectionDetails.servingStyle})`}</span>
                                                    {displayPriceForModifier > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(displayPriceForModifier)}</span>}
                                                    {displayPriceForModifier <= 0 && option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(0)}</span>} {/* Mostrar $0.00 si el precio base era >0 pero el ajuste lo hizo <=0 */}

                                                </Card>
                                            </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2">
                                                <p className="text-xs font-medium mb-2 text-center">Estilo de Servicio para {option.name}</p>
                                                {isLoading.servingStyles ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2"/> : (
                                                    <RadioGroup
                                                        value={currentSelectionDetails?.servingStyle || "Normal"}
                                                        onValueChange={(style) => handleSaveServingStyle(style)}
                                                        className="space-y-1"
                                                    >
                                                        <div key="Normal" className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Normal" id={`${option.id}-Normal`} />
                                                            <Label htmlFor={`${option.id}-Normal`} className="text-xs font-normal">Normal</Label>
                                                        </div>
                                                        {servingStylePopoverState?.availableServingStyles?.map(style => (
                                                            <div key={style.id} className="flex items-center space-x-2">
                                                                <RadioGroupItem value={style.label} id={`${option.id}-${style.id}`} />
                                                                <Label htmlFor={`${option.id}-${style.id}`} className="text-xs font-normal">{style.label}</Label>
                                                            </div>
                                                        ))}
                                                        {servingStylePopoverState?.availableServingStyles?.length === 0 && (
                                                            <p className="text-xs text-muted-foreground text-center py-1">No hay estilos extra definidos.</p>
                                                        )}
                                                    </RadioGroup>
                                                )}
                                            </PopoverContent>
                                        </Popover>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
            <div className="mt-auto pt-3 border-t flex-shrink-0 space-y-2">
                {currentProductConfigQuantity > 1 && (
                    <Button variant="outline" onClick={handleApplyCurrentModifiersToAllInstances} className="w-full" disabled={isLoading.modifiers || isLoading.servingStyles}>
                        <Copy className="mr-2 h-4 w-4" /> Aplicar Modificadores Actuales a Todas las Instancias
                    </Button>
                )}
                <Button onClick={handleAddConfiguredProductInstancesToOrder} className="w-full" disabled={isLoading.modifiers || isLoading.servingStyles}>
                    {isLoading.modifiers || isLoading.servingStyles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Añadir {currentProductConfigQuantity > 1 ? `${currentProductConfigQuantity}x ` : ''}"{selectedProduct.name}" al Pedido
                </Button>
            </div>
          </div>
        );

    case 'package-details':
        if (!selectedPackageDetail) return <p className="text-center text-muted-foreground py-10">Error: No hay paquete seleccionado.</p>;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        return (
            <div className="flex flex-col h-full">
             <div className="flex-shrink-0">
                 <h2 className="text-lg md:text-xl font-semibold mb-1">{packageDef.name} - {formatCurrency(packageDef.price)}</h2>
                 <p className="text-xs md:text-sm text-muted-foreground mb-2">Configura opciones para este paquete ({currentProductConfigQuantity > 1 ? `${currentProductConfigQuantity} paquetes` : '1 paquete'}). Doble clic en modificadores para estilos.</p>
             </div>
             <ScrollArea className="flex-grow mb-3">
                <div className="space-y-4 md:space-y-6 pr-2">
                    {packageItems.map(item => (
                        <Card key={item.id} className="p-3 md:p-4">
                            <CardTitle className="text-md md:text-lg mb-2 md:mb-3">{item.product_name} <span className="text-sm md:text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                            <div className="space-y-3 md:space-y-4 pl-2 md:pl-4 border-l-2 border-muted ml-1">
                                {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No hay opciones configurables.</p>}
                                {(itemSlots[item.id] || []).map(slot => {
                                    const currentPackageItemInstanceConfig = slot.selectedOptions || [];
                                    return (
                                        <div key={slot.id}>
                                            <h4 className="text-sm md:text-md font-medium mb-1 md:mb-2">{slot.label} <span className="text-xs md:text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                            {currentPackageItemInstanceConfig.length > 0 && ( <div className="mb-1 text-xs text-muted-foreground">Seleccionados: {currentPackageItemInstanceConfig.length} / {slot.max_quantity}</div> )}
                                            {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                                                {slot.options.map(option => {
                                                    const isSelected = currentPackageItemInstanceConfig.some(sel => sel.productId === option.id);
                                                    const maxQty = slot.max_quantity;
                                                    const maxReached = currentPackageItemInstanceConfig.length >= maxQty;
                                                    const isDisabled = !isSelected && maxReached;
                                                    const currentSelection = currentPackageItemInstanceConfig.find(sel => sel.productId === option.id);
                                                    let optionInventoryOk = true; let optionInvItemName = '';
                                                    if (option.inventory_item_id) {
                                                        const invItem = inventoryMap.get(option.inventory_item_id);
                                                        optionInvItemName = invItem?.name || 'Item Inventario';
                                                        optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                                    }
                                                    const isOutOfStock = !optionInventoryOk && !isSelected;
                                                    const slotOptCfgPkg = slot.allowedOptions?.find(ao => ao.modifier_product_id === option.id);
                                                    const priceAdjPkg = slotOptCfgPkg?.price_adjustment || 0;
                                                    const displayPriceModPkg = option.price + priceAdjPkg + (currentSelection?.extraCost || 0);

                                                    return (
                                                    <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id && servingStylePopoverState?.packageItemContextId === item.id} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}>
                                                        <PopoverTrigger asChild>
                                                        <div
                                                            onDoubleClick={(e) => handleModifierDoubleClick(e, option.id, slot.id, 'package', item.id)}
                                                        >
                                                            <Card
                                                                onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'package', item.id )}
                                                                className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative h-full flex flex-col justify-between", isSelected && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )}
                                                                title={isDisabled ? `Max (${maxQty}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                                            >
                                                                {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                                                <span className="text-xs md:text-sm block leading-tight">{option.name} {currentSelection?.servingStyle && currentSelection.servingStyle !== 'Normal' && `(${currentSelection.servingStyle})`}</span>
                                                                {displayPriceModPkg > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(displayPriceModPkg)}</span>}
                                                                {displayPriceModPkg <= 0 && option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(0)}</span>}
                                                            </Card>
                                                        </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-56 p-2">
                                                        <p className="text-xs font-medium mb-2 text-center">Estilo de Servicio para {option.name}</p>
                                                            {isLoading.servingStyles ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2"/> : (
                                                                <RadioGroup value={currentSelection?.servingStyle || "Normal"} onValueChange={(style) => handleSaveServingStyle(style)} className="space-y-1">
                                                                    <div key="Normal" className="flex items-center space-x-2">
                                                                        <RadioGroupItem value="Normal" id={`${item.id}-${option.id}-Normal`} />
                                                                        <Label htmlFor={`${item.id}-${option.id}-Normal`} className="text-xs font-normal">Normal</Label>
                                                                    </div>
                                                                    {servingStylePopoverState?.availableServingStyles?.map(style => (
                                                                        <div key={style.id} className="flex items-center space-x-2">
                                                                            <RadioGroupItem value={style.label} id={`${item.id}-${option.id}-${style.id}`} />
                                                                            <Label htmlFor={`${item.id}-${option.id}-${style.id}`} className="text-xs font-normal">{style.label}</Label>
                                                                        </div>
                                                                    ))}
                                                                    {servingStylePopoverState?.availableServingStyles?.length === 0 && (
                                                                        <p className="text-xs text-muted-foreground text-center py-1">No hay estilos extra definidos.</p>
                                                                    )}
                                                                </RadioGroup>
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    ))}
                </div>
             </ScrollArea>
             <div className="mt-auto pt-3 border-t flex-shrink-0">
                 <Button onClick={handleAddPackageToOrder} className="w-full" disabled={isLoading.packageDetails || isLoading.inventory || isLoading.servingStyles}>
                    {isLoading.packageDetails || isLoading.inventory || isLoading.servingStyles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Añadir Paquete(s) al Pedido
                </Button>
            </div>
            </div>
        );
      default: return <div className="text-center text-muted-foreground py-10">Algo salió mal.</div>;
    }
  };

 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 h-[calc(100vh-theme(spacing.16))]">
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader className="pb-2 md:pb-4">
                 <div className="flex justify-between items-center">
                    <CardTitle className="text-lg md:text-xl">
                        {editingOrderId ? `Editando Pedido #${originalOrderForEdit?.orderNumber || editingOrderId.substring(0,8)}` : "Crear Pedido"}
                    </CardTitle>
                    {/* Botón de Pausar/Reanudar (a implementar) */}
                </div>
                {renderBackButton()}
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden p-3 md:p-4">
                {isViewLoading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                     <ScrollArea className="h-full pr-2 md:pr-4" key={view === 'modifiers' ? `mod-scroll-${currentInstanceIndexForConfiguration}-${currentProductConfigQuantity}` : view}> 
                        {renderContent()} 
                     </ScrollArea>
                )}
             </CardContent>
         </Card>
      </div>

      <div className="lg:col-span-1 h-full">
         <Card className="h-full flex flex-col shadow-md">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 md:pt-4 border-b">
               <div>
                 <CardTitle className="text-base md:text-lg">Resumen Pedido</CardTitle>
                 <CardDescription className="text-xs md:text-sm">{editingOrderId ? `Editando: #${originalOrderForEdit?.orderNumber}` : (currentOrder.id || 'Nuevo Pedido')}</CardDescription>
               </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-8 md:h-9" disabled={currentOrder.items.length === 0 && !editingOrderId}><RotateCcw className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> Limpiar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Limpiar pedido?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer y te sacará del modo edición si estás en él.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={clearOrder} className={cn(buttonVariants({ variant: "destructive" }))}>Limpiar Pedido</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden pt-3 md:pt-4 p-3 md:p-4">
             <div className="mb-3 md:mb-4">
               <Label htmlFor="customerName" className="mb-1 block text-xs md:text-sm">Cliente</Label>
               {isRegisteringCustomer ? (
                 <div className="flex gap-2">
                   <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre cliente" className="flex-grow h-9 text-sm" aria-label="Input Nombre Cliente" />
                   <Button size="sm" onClick={handleSaveCustomer} aria-label="Guardar Cliente" className="h-9"><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)} aria-label="Cancelar Cliente" className="h-9">X</Button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center text-sm md:text-base">
                   <span>{currentOrder.customerName}</span>
                   <Button variant="link" className="p-0 h-auto text-accent text-xs md:text-sm" onClick={() => setIsRegisteringCustomer(true)}>{currentOrder.customerName === 'Guest' ? 'Añadir Cliente' : 'Cambiar'}</Button>
                 </div>
               )}
             </div>
             <Separator className="mb-3 md:mb-4" />
             <div className="flex-grow mb-3 md:mb-4 overflow-y-auto -mr-3 md:-mr-4 pr-3 md:pr-4" key={`order-summary-${currentOrder.items.length}`}>
                {currentOrder.items.length === 0 ? (<p className="text-muted-foreground text-center py-8 text-sm md:text-base">El pedido está vacío.</p>) : (
                 <div className="space-y-2 md:space-y-3">
                 {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-xs md:text-sm border-b pb-2 last:border-b-0">
                         <div className="flex justify-between items-start font-medium mb-0.5 md:mb-1">
                             <div className='flex items-center gap-1 md:gap-2'>
                                 {item.type === 'package' && <PackageIcon className="h-3 w-3 md:h-4 md:w-4 text-accent flex-shrink-0" title="Paquete"/>}
                                 <span className="flex-1 mr-1 md:mr-2">{item.name}</span>
                            </div>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-0.5 md:gap-1 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)}><MinusCircle className="h-3 w-3 md:h-4 md:w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-3 w-3 md:h-4 md:w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-3 w-3 md:h-4 md:w-4"/></Button>
                         </div>
                         {(item.selectedModifiers.length > 0 || (item.type === 'package' && item.packageItems && item.packageItems.some(pi => pi.selectedModifiers.length > 0))) && (
                             <div className="text-xs text-muted-foreground ml-2 md:ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modificadores:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Detalles/Modificadores:</span>}
                                <ul className='list-disc list-inside pl-1 md:pl-2'>
                                    {item.type === 'package' && item.packageItems ? (
                                         item.packageItems.map(pkgItem => (
                                            <li key={pkgItem.packageItemId}>
                                                {pkgItem.productName}
                                                {pkgItem.selectedModifiers.length > 0 && (
                                                    <ul className="list-[circle] list-inside pl-2 md:pl-4">
                                                        {pkgItem.selectedModifiers.map((mod, modIdx) => (
                                                            <li key={`${mod.productId}-${modIdx}`} className="flex justify-between items-center">
                                                                <span>
                                                                  {mod.name}
                                                                  {mod.servingStyle && mod.servingStyle !== 'Normal' && ` (${mod.servingStyle})`}
                                                                  {(mod.priceModifier || 0) + (mod.extraCost || 0) !== 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''}
                                                                </span>
                                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/70" onClick={() => handleOpenExtraCostDialog(item.uniqueId, mod.productId, mod.slotId, pkgItem.packageItemId)}><DollarSign className="h-3 w-3"/></Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                         ))
                                    ) : (
                                        item.selectedModifiers.map((mod, idx) => (
                                            <li key={`${mod.productId}-${idx}`} className="flex justify-between items-center">
                                                <span>
                                                  {mod.name}
                                                  {mod.servingStyle && mod.servingStyle !== 'Normal' && ` (${mod.servingStyle})`}
                                                  {(mod.priceModifier || 0) + (mod.extraCost || 0) !== 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''}
                                                </span>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/70" onClick={() => handleOpenExtraCostDialog(item.uniqueId, mod.productId, mod.slotId)}><DollarSign className="h-3 w-3"/></Button>
                                            </li>
                                        ))
                                    )}
                                 </ul>
                             </div>
                         )}
                     </div>
                     ))}
                 </div>
                )}
             </div>
             <Separator className="my-2" />
             <div className="space-y-1 md:space-y-2 text-xs md:text-sm pt-1 md:pt-2">
               <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
               <div className="flex justify-between font-bold text-sm md:text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
               <RadioGroup value={currentOrder.paymentMethod} onValueChange={(value) => setCurrentOrder(prev => ({...prev, paymentMethod: value as 'cash' | 'card'}))} className="flex gap-4 mt-1 md:mt-2" aria-label="Método de Pago">
                 <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="pay-card" /><Label htmlFor="pay-card">Tarjeta</Label></div>
                 <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="pay-cash" /><Label htmlFor="pay-cash">Efectivo</Label></div>
               </RadioGroup>
               {currentOrder.paymentMethod === 'cash' && (
                 <div className="mt-1 md:mt-2 space-y-1 md:space-y-2">
                     <div className='relative'>
                         <Label htmlFor="paidAmount" className="mb-1 block text-xs">Pagado</Label>
                         <span className="absolute left-2.5 top-5 md:top-6 text-muted-foreground text-xs md:text-sm">$</span>
                         <Input id="paidAmount" type="number" step="0.01" min="0" value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} placeholder="0.00" className="pl-5 md:pl-6 h-9 text-sm" aria-label="Cantidad Pagada" />
                    </div>
                   {currentOrder.paidAmount !== undefined && total !== undefined && currentOrder.paidAmount >= total && currentOrder.changeDue !== undefined && (
                     <div className="flex justify-between text-accent font-medium"><span>Cambio:</span><span>{formatCurrency(currentOrder.changeDue)}</span></div>
                   )}
                    {currentOrder.paidAmount !== undefined && total !== undefined && currentOrder.paidAmount < total && (
                     <p className="text-destructive text-xs">Faltante: {formatCurrency(total - currentOrder.paidAmount)}</p>
                   )}
                 </div>
               )}
             </div>
           </CardContent>
            <div className="p-3 md:p-4 border-t mt-auto bg-muted/30">
                 <Button className="w-full h-10 md:h-11 text-sm md:text-base" onClick={handleFinalizeOrder} disabled={currentOrder.items.length === 0 || isLoading.inventory || isLoading.printing}>
                    {isLoading.inventory || isLoading.printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingOrderId ? <Edit className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />)}
                    {editingOrderId ? (isLoading.printing ? 'Actualizando e Imprimiendo...' : 'Actualizar Pedido e Imprimir') : (isLoading.printing ? 'Imprimiendo...' : 'Finalizar e Imprimir')}
                 </Button>
            </div>
         </Card>
       </div>

        <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle>Cantidad para "{itemPendingQuantity?.data.name}"</DialogTitle>
                    <DialogDescription>Introduce cuántas unidades de este item deseas añadir.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="quantity_input" className="sr-only">Cantidad</Label>
                    <Input
                        id="quantity_input"
                        type="number"
                        min="1"
                        value={pendingQuantityInput}
                        onChange={(e) => setPendingQuantityInput(e.target.value)}
                        className="text-center text-lg h-12"
                        autoFocus
                    />
                </div>
                <DialogFooter className="gap-2 sm:justify-center">
                     <DialogClose asChild>
                        <Button type="button" variant="outline">Cancelar</Button>
                     </DialogClose>
                    <Button onClick={handleConfirmQuantity}>Aceptar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


       <Dialog open={!!extraCostDialogState} onOpenChange={() => setExtraCostDialogState(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Añadir Costo Extra</DialogTitle>
                    <DialogDescription>
                        Introduce un costo adicional para el modificador "{
                            extraCostDialogState?.modifierProductId && allProductsMap.get(extraCostDialogState.modifierProductId)?.name
                        }". Este se sumará a su precio.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="extraCost" className="text-right">Costo Extra</Label>
                        <Input
                            id="extraCost"
                            type="number"
                            step="0.01"
                            min="0"
                            value={extraCostInput}
                            onChange={(e) => setExtraCostInput(e.target.value)}
                            className="col-span-3"
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setExtraCostDialogState(null)}>Cancelar</Button>
                    <Button onClick={handleSaveExtraCost}>Guardar Costo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
