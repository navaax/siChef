
// src/app/dashboard/create-order/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon, RotateCcw, ShoppingBag, CookingPot, DollarSign, Copy, Edit, PauseCircle, PlayCircle, Bike, Store, Truck, Search, UserPlus, Users } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { cn, formatCurrency } from '@/lib/utils';
import { format as formatDateFn } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategoryUI,
    getPackageById,
    getItemsForPackage,
    getOverridesForPackageItem,
    getModifiersByCategory,
    getServingStylesForCategory,
    getAllProductsAndModifiersList,
} from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service';
import { searchClientsByPhone, addClient as addClientService } from '@/services/client-service'; // Importar servicio de cliente
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
    SelectedModifierItem,
    SavedOrder,
    SavedOrderItemComponent,
    InventoryItem,
    ModifierServingStyle,
    PausedOrder,
} from '@/types/product-types';
import type { Client } from '@/types/client-types'; // Importar tipo Client
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from '@/components/ui/textarea';
import { Select as ShadSelect, SelectContent as ShadSelectContent, SelectItem as ShadSelectItem, SelectTrigger as ShadSelectTrigger, SelectValue as ShadSelectValue } from "@/components/ui/select";

// --- Estado del Componente ---
type View = 'categories' | 'products' | 'modifiers' | 'package-details';
type OrderType = 'pickup' | 'delivery' | 'platform';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[];
    selectedOptions: SelectedModifierItem[];
}

interface PackageDetailState {
    packageDef: Package;
    packageItems: PackageItem[];
    itemSlots: Record<string, ModifierSlotState[]>;
}

interface ModifierInteractionState {
    orderItemUniqueId: string | null;
    modifierProductId: string | null;
    modifierSlotId: string | null;
    packageItemContextId?: string | null;
    anchorElement: HTMLElement | null;
    availableServingStyles?: ModifierServingStyle[];
}

interface PlatformConfig {
  id: string;
  name: string;
  commissionRate: number;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [originalOrderForEdit, setOriginalOrderForEdit] = useState<SavedOrder | null>(null);

  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null);

  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]);

  const [currentOrderType, setCurrentOrderType] = useState<OrderType>('pickup');
  
  // Estados para gestión de cliente
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClientFieldsForDelivery, setShowNewClientFieldsForDelivery] = useState(false);
  const [newCustomerNameForDelivery, setNewCustomerNameForDelivery] = useState('');
  // deliveryAddress y deliveryPhone se usan tanto para clientes existentes como nuevos
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');


  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [platformOrderId, setPlatformOrderId] = useState('');
  const [configuredPlatforms, setConfiguredPlatforms] = useState<PlatformConfig[]>([]);
  const [globalPlatformPriceIncreasePercent, setGlobalPlatformPriceIncreasePercent] = useState(0);


  const [currentOrder, setCurrentOrder] = useState<Omit<OrderItem, 'subtotal' | 'total'> & { id: string, customerName: string, items: OrderItem[], paymentMethod: 'cash' | 'card', orderType: OrderType, platformName?: string, platformOrderId?: string, deliveryAddress?: string, deliveryPhone?: string, paidAmount?: number, changeDue?: number, clientId?: string | null }>({
    id: '', customerName: 'Cliente General', items: [], paymentMethod: 'card', orderType: 'pickup', clientId: null
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [packagesData, setPackagesData] = useState<Package[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map());
  const [allProductsMap, setAllProductsMap] = useState<Map<string, Product>>(new Map());

  const [servingStylePopoverState, setServingStylePopoverState] = useState<ModifierInteractionState | null>(null);
  const [extraCostDialogState, setExtraCostDialogState] = useState<ModifierInteractionState & { currentExtraCost?: number } | null>(null);
  const [extraCostInput, setExtraCostInput] = useState<string>('');

  const [itemPendingQuantity, setItemPendingQuantity] = useState<{ data: Product | Package; type: 'product' | 'package' } | null>(null);
  const [pendingQuantityInput, setPendingQuantityInput] = useState<string>("1");
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);

  const [currentProductConfigQuantity, setCurrentProductConfigQuantity] = useState(1);
  const [modifierConfigurations, setModifierConfigurations] = useState<SelectedModifierItem[][]>([[]]);
  const [currentInstanceIndexForConfiguration, setCurrentInstanceIndexForConfiguration] = useState(0);

  const [isLoading, setIsLoading] = useState({
        page: false,
        categories: true,
        products: false,
        packages: false,
        modifiers: false,
        packageDetails: false,
        inventory: true,
        printing: false,
        servingStyles: false,
    });
  const [hasLoadedCoreData, setHasLoadedCoreData] = useState(false);

  const subtotal = useMemo(() => {
    return currentOrder.items.reduce((sum, item) => {
        const itemEffectivePrice = item.original_platform_price ?? item.basePrice;
        let modifiersTotal = 0;
        if (item.type === 'product') {
            modifiersTotal = (item.selectedModifiers || []).reduce((modSum, mod) => modSum + (mod.priceModifier || 0) + (mod.extraCost || 0), 0);
        } else if (item.type === 'package' && item.packageItems) {
            item.packageItems.forEach(pi => {
                modifiersTotal += (pi.selectedModifiers || []).reduce((modSum, mod) => modSum + (mod.priceModifier || 0) + (mod.extraCost || 0), 0);
            });
        }
        return sum + (itemEffectivePrice + modifiersTotal) * item.quantity;
    }, 0);
  }, [currentOrder.items]);

  const total = useMemo(() => subtotal, [subtotal]);

  // --- Helper & Core Logic Callbacks (Order of definition matters for dependencies) ---

  const resetProductSelection = useCallback(() => {
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    setModifierConfigurations([[]]);
    setCurrentInstanceIndexForConfiguration(0);
    setCurrentProductConfigQuantity(1);
  }, []);

  const resetPackageSelection = useCallback(() => {
    setSelectedPackage(null);
    setSelectedPackageDetail(null);
    setCurrentProductConfigQuantity(1);
  }, []);

  const resetAndGoToCategories = useCallback(() => {
    setView('categories');
    setSelectedCategory(null);
    resetProductSelection();
    resetPackageSelection();
    setProductsData([]);
    setPackagesData([]);
  }, [resetProductSelection, resetPackageSelection]);

  const clearOrder = useCallback(() => {
    const currentOrderTypePersisted = currentOrderType;
    setCurrentOrder({ id: '', customerName: 'Cliente General', items: [], paymentMethod: 'card', orderType: currentOrderTypePersisted, clientId: null });
    setCustomerPhoneInput(''); setSelectedClient(null); setSearchResults([]); setShowNewClientFieldsForDelivery(false); setNewCustomerNameForDelivery('');
    setPaidAmountInput('');
    setDeliveryAddress(''); setDeliveryPhone('');
    setSelectedPlatformId(null); setPlatformOrderId('');

    setEditingOrderId(null); setOriginalOrderForEdit(null);

    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('editOrderId');
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });

    toast({ title: "Pedido Limpiado", variant: "destructive" });
    resetAndGoToCategories();
  }, [currentOrderType, resetAndGoToCategories, router, pathname, searchParams, toast]);

  const fetchInitialData = useCallback(async () => {
    console.log("[CreateOrderPage] fetchInitialData: Called. Current isLoading.page:", isLoading.page);
    if (isLoading.page && hasLoadedCoreData) {
        console.log("[CreateOrderPage] fetchInitialData: Already loading or core data present, exiting to prevent re-fetch.");
        return;
    }
    setIsLoading(prev => ({ ...prev, page: true, categories: true, inventory: true, products: true, packages: true }));
    setHasLoadedCoreData(false);

    try {
      console.log("[CreateOrderPage] fetchInitialData: 1. Attempting to getCategories...");
      const fetchedCategories = await getCategories();
      setCategoriesData(fetchedCategories);
      console.log(`[CreateOrderPage] fetchInitialData: 2. getCategories SUCCESS - ${fetchedCategories.length} categories loaded.`);

      console.log("[CreateOrderPage] fetchInitialData: 3. Attempting to getInventoryItems...");
      const fetchedInventory = await getInventoryItems();
      const invMap = new Map<string, InventoryItem>();
      fetchedInventory.forEach(item => invMap.set(item.id, item));
      setInventoryMap(invMap);
      console.log(`[CreateOrderPage] fetchInitialData: 4. getInventoryItems SUCCESS - ${fetchedInventory.length} inventory items loaded.`);

      console.log("[CreateOrderPage] fetchInitialData: 5. Attempting to getAllProductsAndModifiersList...");
      const fetchedAllProducts = await getAllProductsAndModifiersList();
      const prodMap = new Map<string, Product>();
      fetchedAllProducts.forEach(p => prodMap.set(p.id, p));
      setAllProductsMap(prodMap);
      console.log(`[CreateOrderPage] fetchInitialData: 6. getAllProductsAndModifiersList SUCCESS - ${fetchedAllProducts.length} products/modifiers loaded.`);

      console.log("[CreateOrderPage] fetchInitialData: 7. Attempting to load platform settings from localStorage...");
      try {
          const storedPlatforms = localStorage.getItem('siChefSettings_configuredPlatforms');
          if (storedPlatforms) {
              setConfiguredPlatforms(JSON.parse(storedPlatforms));
              console.log("[CreateOrderPage] fetchInitialData: 8. Platform configurations LOADED from localStorage.");
          } else {
              console.log("[CreateOrderPage] fetchInitialData: 8. No platform configurations found in localStorage. Using defaults.");
              const defaultPlatforms: PlatformConfig[] = [
                { id: 'didi_food', name: 'Didi Food', commissionRate: 0.30 },
                { id: 'uber_eats', name: 'Uber Eats', commissionRate: 0.32 },
              ];
              setConfiguredPlatforms(defaultPlatforms);
              localStorage.setItem('siChefSettings_configuredPlatforms', JSON.stringify(defaultPlatforms));
          }
      } catch (e) {
          console.error("[CreateOrderPage] fetchInitialData: Error parsing storedPlatforms from localStorage:", e);
          toast({ title: "Error Configuración Plataformas", description: "No se pudo cargar la configuración de plataformas guardada. Usando defaults.", variant: "destructive" });
          const defaultPlatforms: PlatformConfig[] = [
              { id: 'didi_food', name: 'Didi Food', commissionRate: 0.30 },
              { id: 'uber_eats', name: 'Uber Eats', commissionRate: 0.32 },
          ];
          setConfiguredPlatforms(defaultPlatforms);
      }

      let increasePercent = 0;
      const storedIncrease = localStorage.getItem('siChefSettings_platformPriceIncrease');
      if (storedIncrease) {
          const parsed = parseFloat(storedIncrease);
          if (!isNaN(parsed) && parsed > 0) {
              increasePercent = parsed / 100;
              console.log(`[CreateOrderPage] fetchInitialData: 9. Platform price increase LOADED: ${parsed}%`);
          } else {
              console.warn("[CreateOrderPage] fetchInitialData: 9. Stored platformPriceIncrease is invalid or not positive:", storedIncrease, "Using default 15%.");
              increasePercent = 0.15; // Default 15%
              localStorage.setItem('siChefSettings_platformPriceIncrease', '15');
          }
      } else {
          console.log("[CreateOrderPage] fetchInitialData: 9. No platform price increase found in localStorage. Using default 15%.");
          increasePercent = 0.15; // Default 15%
          localStorage.setItem('siChefSettings_platformPriceIncrease', '15');
      }
      setGlobalPlatformPriceIncreasePercent(increasePercent);

      setHasLoadedCoreData(true);
      console.log("[CreateOrderPage] fetchInitialData: 10. Core data loading SUCCESS. hasLoadedCoreData set to true.");

    } catch (error) {
      console.error("[CreateOrderPage] fetchInitialData: CRITICAL ERROR during core data loading:", error);
      toast({ title: "Error al Cargar Datos Iniciales", description: `Fallo al cargar datos esenciales. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
      setHasLoadedCoreData(false);
    } finally {
      console.log("[CreateOrderPage] fetchInitialData: Entering FINALLY block.");
      setIsLoading(prev => ({
          ...prev,
          page: false,
          categories: false,
          inventory: false,
          products: false,
          packages: false,
      }));
      console.log("[CreateOrderPage] fetchInitialData: FINALLY block executed. All isLoading flags set to false.");
    }
  }, [toast]);

  const loadOrderForEditing = useCallback(async (orderId: string) => {
    console.log(`[CreateOrderPage] loadOrderForEditing llamado para: ${orderId}`);
    setIsLoading(prev => ({ ...prev, page: true }));
    try {
        const storedOrdersString = localStorage.getItem('siChefOrders');
        if (!storedOrdersString) {
            toast({ title: "Error", description: `No se encontraron pedidos guardados.`, variant: "destructive" });
            router.replace('/dashboard/create-order');
            return;
        }
        const existingOrders: SavedOrder[] = JSON.parse(storedOrdersString);
        const orderToEdit = existingOrders.find(o => o.id === orderId);

        if (!orderToEdit) {
            toast({ title: "Error", description: `Pedido con ID ${orderId} no encontrado.`, variant: "destructive" });
            router.replace('/dashboard/create-order');
            return;
        }
        console.log("[CreateOrderPage] Pedido a editar encontrado:", orderToEdit);
        setOriginalOrderForEdit(orderToEdit);
        setEditingOrderId(orderId);
        setCurrentOrderType(orderToEdit.order_type || 'pickup');
        setDeliveryAddress(orderToEdit.delivery_address || '');
        setDeliveryPhone(orderToEdit.delivery_phone || '');

        const platformNameForSelect = orderToEdit.platform_name && orderToEdit.platform_name.trim() !== "" ? orderToEdit.platform_name : null;
        const foundPlatform = configuredPlatforms.find(p => p.name === platformNameForSelect);
        setSelectedPlatformId(foundPlatform ? foundPlatform.id : null);
        setPlatformOrderId(orderToEdit.platform_order_id || '');

        // Cliente
        if (orderToEdit.client_id) {
            // Aquí idealmente se buscaría el cliente por ID si fuera necesario mostrar más que el nombre
            // Pero para la UI de create-order, solo necesitamos el nombre y el ID para el pedido
            const clientNameFromOrder = orderToEdit.customerName || 'Cliente';
            setSelectedClient({ id: orderToEdit.client_id, name: clientNameFromOrder, created_at: '', updated_at:'' }); // Dummy Client object
            setCustomerPhoneInput(orderToEdit.delivery_phone || ''); // Asumimos que delivery_phone podría ser el del cliente
        } else {
            setSelectedClient(null);
            setCustomerPhoneInput(orderToEdit.delivery_phone || ''); // Aún puede haber un teléfono de contacto
        }


        const reconstructedOrderItems: OrderItem[] = [];
        for (const savedItem of orderToEdit.items) {
            let baseItemDetails: Product | Package | null = null;
            let itemType: 'product' | 'package' = 'product';

            const productMatch = allProductsMap.get(savedItem.id);
            if (productMatch) {
                baseItemDetails = productMatch;
                itemType = 'product';
            } else {
                const packageData = await getPackageById(savedItem.id);
                if (packageData) {
                    baseItemDetails = packageData;
                    itemType = 'package';
                } else {
                     console.warn(`[loadOrderForEditing] No se encontraron detalles base para el ítem ${savedItem.name} (ID: ${savedItem.id}). Omitiendo.`);
                     toast({ title: "Advertencia", description: `No se pudieron cargar todos los detalles para el ítem: ${savedItem.name}.`, variant: "default"});
                     continue;
                }
            }

            if (!baseItemDetails) continue;
            
            const originalBasePrice = itemType === 'package' ? (baseItemDetails as Package).price : (baseItemDetails as Product).price;
            const platformPrice = savedItem.platformPricePerUnit;
            const itemPriceForCalc = platformPrice ?? originalBasePrice;

            const reconstructedOrderItem: OrderItem = {
                type: itemType, id: baseItemDetails.id, name: baseItemDetails.name,
                quantity: savedItem.quantity, basePrice: originalBasePrice,
                original_platform_price: platformPrice, totalPrice: itemPriceForCalc * savedItem.quantity,
                uniqueId: uuidv4(), packageItems: [],
                applied_commission_rate: savedItem.isPlatformItem && savedItem.original_price_before_inflation && savedItem.original_price_before_inflation > 0 && platformPrice
                                            ? (platformPrice / savedItem.original_price_before_inflation) - 1
                                            : undefined,
                original_price_before_inflation: savedItem.original_price_before_inflation,
            };
            
             let modifiersTotalForThisItem = 0;
            if (itemType === 'product') {
                reconstructedOrderItem.selectedModifiers = (savedItem.components || [])
                    .filter(comp => comp.slotId && comp.productId)
                    .map(comp => {
                        const mod: SelectedModifierItem = {
                            productId: comp.productId!, name: comp.name,
                            priceModifier: comp.priceModifier || 0, slotId: comp.slotId!,
                            servingStyle: comp.servingStyle || 'Normal', extraCost: comp.extraCost || 0,
                        };
                        modifiersTotalForThisItem += (mod.priceModifier || 0) + (mod.extraCost || 0);
                        return mod;
                    }).filter(mod => mod !== null) as SelectedModifierItem[];
            } else if (itemType === 'package' && baseItemDetails) {
                const packageDef = baseItemDetails as Package;
                const currentPackageItemsDef = await getItemsForPackage(packageDef.id);
                reconstructedOrderItem.packageItems = currentPackageItemsDef.map(pkgItemDef => {
                    const savedSubItemModifiers: SelectedModifierItem[] = [];
                     (savedItem.components || []).forEach(comp => {
                         if (comp.slotLabel !== 'Contenido' && comp.productId && comp.slotId && comp.name.includes(pkgItemDef.product_name || 'NON_MATCHABLE_NAME_GUARD')) {
                            const mod: SelectedModifierItem = {
                                productId: comp.productId, name: comp.name,
                                priceModifier: comp.priceModifier || 0, slotId: comp.slotId,
                                servingStyle: comp.servingStyle || 'Normal', extraCost: comp.extraCost || 0,
                            };
                            modifiersTotalForThisItem += (mod.priceModifier || 0) + (mod.extraCost || 0);
                            savedSubItemModifiers.push(mod);
                        }
                    });
                    return {
                        packageItemId: pkgItemDef.id, productId: pkgItemDef.product_id,
                        productName: pkgItemDef.product_name || 'Producto de Paquete',
                        selectedModifiers: savedSubItemModifiers,
                    };
                });
            }
            reconstructedOrderItem.totalPrice = (itemPriceForCalc + modifiersTotalForThisItem) * savedItem.quantity;
            reconstructedOrderItems.push(reconstructedOrderItem);
        }

        setCurrentOrder(prev => ({
            ...prev, items: reconstructedOrderItems,
            customerName: orderToEdit.customerName || 'Cliente General',
            paymentMethod: orderToEdit.paymentMethod, orderType: orderToEdit.order_type || 'pickup',
            platformName: orderToEdit.platform_name, platformOrderId: orderToEdit.platform_order_id,
            deliveryAddress: orderToEdit.delivery_address, deliveryPhone: orderToEdit.delivery_phone,
            clientId: orderToEdit.client_id || null,
        }));
        setPaidAmountInput('');
        toast({ title: "Modo Edición", description: `Cargado pedido #${orderToEdit.orderNumber} para editar.` });
    } catch (error) {
        console.error("[CreateOrderPage] Error cargando pedido para editar:", error);
        toast({ title: "Error al Cargar Pedido", description: `No se pudo cargar el pedido para editar. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
        router.replace('/dashboard/create-order');
    } finally {
        setIsLoading(prev => ({ ...prev, page: false }));
    }
  }, [router, toast, allProductsMap, configuredPlatforms]);


  // --- useEffect Hooks ---
  useEffect(() => {
    console.log("[CreateOrderPage] Mount useEffect: isLoading.page:", isLoading.page, "hasLoadedCoreData:", hasLoadedCoreData);
    if (!hasLoadedCoreData) { // Solo llamar si los datos NO están cargados
        console.log("[CreateOrderPage] Mount useEffect: Calling fetchInitialData.");
        fetchInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount

  useEffect(() => {
    const orderIdFromQuery = searchParams.get('editOrderId');
    console.log(`[CreateOrderPage] Route Change useEffect. Query: ${orderIdFromQuery}, CurrentEditingID: ${editingOrderId}, HasCoreData: ${hasLoadedCoreData}, isLoading.page: ${isLoading.page}`);

    if (orderIdFromQuery) {
      if (hasLoadedCoreData) {
        if (!editingOrderId || editingOrderId !== orderIdFromQuery) {
          console.log(`[CreateOrderPage] Edición: Datos principales cargados. Llamando a loadOrderForEditing para ${orderIdFromQuery}.`);
          loadOrderForEditing(orderIdFromQuery);
        }
      } else if (!isLoading.page) {
          console.warn(`[CreateOrderPage] Edición: Solicitado ${orderIdFromQuery}, pero los datos principales aún no están cargados y no se está cargando la página. Esto podría ser un problema si fetchInitialData no se dispara.`);
          if (!hasLoadedCoreData) fetchInitialData(); // Forzar recarga si no tiene datos y no está cargando
      }
    } else {
      if (editingOrderId) { // Si estaba editando y ya no hay ID en query
        console.log("[CreateOrderPage] Cambiando de Edición a Nuevo pedido. Reseteando.");
        clearOrder(); // clearOrder maneja el reseteo completo
      }
    }
  }, [searchParams, editingOrderId, hasLoadedCoreData, loadOrderForEditing, fetchInitialData, clearOrder]);


  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    setProductsData([]);
    setPackagesData([]);
    try {
        const fetchedProducts = await getProductsByCategory(categoryId);
        const fetchedPackages = await getPackagesByCategoryUI(categoryId);
        setProductsData(fetchedProducts);
        setPackagesData(fetchedPackages);
    } catch (error) {
      toast({ title: "Error", description: `Fallo al cargar items para categoría ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, products: false, packages: false }));
    }
  }, [toast]);

   const fetchAndPrepareModifierSlots = useCallback(async (productId: string): Promise<ModifierSlotState[]> => {
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    let preparedSlots: ModifierSlotState[] = [];
    try {
        const slotsDefinition = await getModifierSlotsForProduct(productId);
        if (slotsDefinition && slotsDefinition.length > 0) {
             const optionsPromises = slotsDefinition.map(async (slotDef) => {
                 let options: Product[] = [];
                 if (slotDef.allowedOptions && slotDef.allowedOptions.length > 0) {
                     const optionDetailsPromises = slotDef.allowedOptions.map(opt => {
                        const modifierProduct = allProductsMap.get(opt.modifier_product_id);
                        if (modifierProduct) {
                            return {
                                ...modifierProduct,
                                price: (modifierProduct.price ?? 0) + (opt.price_adjustment ?? 0),
                                is_default_option_in_slot: opt.is_default,
                            };
                        }
                        return null;
                     });
                     options = (await Promise.all(optionDetailsPromises)).filter(p => p !== null) as Product[];
                 } else {
                     options = await getModifiersByCategory(slotDef.linked_category_id);
                 }
                 return { ...slotDef, options: options, selectedOptions: [] };
             });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: `Fallo al cargar modificadores para producto ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast, allProductsMap]);

   const fetchPackageDetails = useCallback(async (packageId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        setSelectedPackageDetail(null);
        try {
            const packageDef = await getPackageById(packageId);
            if (!packageDef) throw new Error("Paquete no encontrado");

            const packageItems = await getItemsForPackage(packageId);
            const itemSlotsPromises = packageItems.map(async (item) => {
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);
                const overrides = await getOverridesForPackageItem(item.id);
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    return override ? { ...slot, min_quantity: override.min_quantity, max_quantity: override.max_quantity, selectedOptions: [] } : { ...slot, selectedOptions: [] };
                });
                return { packageItemId: item.id, slots: finalSlots };
            });
            const resolvedItemSlots = await Promise.all(itemSlotsPromises);
            const itemSlotsMap: Record<string, ModifierSlotState[]> = resolvedItemSlots.reduce((acc, curr) => { acc[curr.packageItemId] = curr.slots; return acc; }, {} as Record<string, ModifierSlotState[]>);
            setSelectedPackageDetail({ packageDef, packageItems, itemSlots: itemSlotsMap });
            setView('package-details');
        } catch (error) {
            toast({ title: "Error", description: `Fallo al cargar detalles del paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
            setView('products');
        } finally {
            setIsLoading(prev => ({ ...prev, packageDetails: false }));
        }
   }, [toast, fetchAndPrepareModifierSlots]);

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
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setSelectedProduct(product);
        setCurrentModifierSlots(slots);
        setCurrentProductConfigQuantity(1);
        setModifierConfigurations([[]]);
        setCurrentInstanceIndexForConfiguration(0);
        setView('modifiers');
    } else {
        setItemPendingQuantity({ data: product, type: 'product' });
        setPendingQuantityInput("1");
        setIsQuantityDialogOpen(true);
    }
  };

  const handlePackageClick = (pkg: Package) => {
    setItemPendingQuantity({ data: pkg, type: 'package' });
    setPendingQuantityInput("1");
    setIsQuantityDialogOpen(true);
  };

  const handleConfirmQuantity = async () => {
    if (!itemPendingQuantity) return;
    const confirmedQuantity = parseInt(pendingQuantityInput, 10);
    if (isNaN(confirmedQuantity) || confirmedQuantity <= 0) {
      toast({ title: "Cantidad Inválida", description: "Introduce una cantidad válida.", variant: "destructive" });
      return;
    }

    const itemData = itemPendingQuantity.data;
    const itemType = itemPendingQuantity.type;
    let basePrice = itemData.price;
    let finalPriceForOrder = basePrice;
    let appliedInflationRate: number | undefined = undefined;
    let originalPriceBeforeInflation: number | undefined = undefined;

    if (itemType === 'product') {
        const product = itemData as Product;
        if (product.inventory_item_id) {
            const invItem = inventoryMap.get(product.inventory_item_id);
            const consumedTotal = (product.inventory_consumed_per_unit ?? 0) * confirmedQuantity;
            if (!invItem || invItem.current_stock < consumedTotal) {
                toast({ title: "Sin Stock Suficiente", description: `Solo hay ${invItem?.current_stock && product.inventory_consumed_per_unit ? Math.floor(invItem.current_stock / product.inventory_consumed_per_unit) : 0} unidades de ${product.name}.`, variant: "destructive" });
                return;
            }
        }
        originalPriceBeforeInflation = product.price;
        if (currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) {
            finalPriceForOrder = originalPriceBeforeInflation * (1 + globalPlatformPriceIncreasePercent);
            appliedInflationRate = globalPlatformPriceIncreasePercent;
        } else {
            finalPriceForOrder = originalPriceBeforeInflation;
        }
        addProductToOrder(product, [], product.price, confirmedQuantity, currentOrderType === 'platform' ? finalPriceForOrder : undefined, appliedInflationRate, originalPriceBeforeInflation);
        toast({ title: `${product.name} (x${confirmedQuantity}) añadido` });
        resetAndGoToCategories();
    } else if (itemType === 'package') {
        const pkg = itemData as Package;
        setCurrentProductConfigQuantity(confirmedQuantity);
        setSelectedPackage(pkg);
        await fetchPackageDetails(pkg.id);
    }
    setIsQuantityDialogOpen(false);
    setItemPendingQuantity(null);
  };


  const handleModifierOptionClick = (
    slotId: string, optionProductId: string, optionName: string,
    optionEffectivePriceInSlot: number, context: 'product' | 'package',
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

            if (modifierProductDefinition.inventory_item_id) {
                const invItem = inventoryMap.get(modifierProductDefinition.inventory_item_id);
                const consumed = modifierProductDefinition.inventory_consumed_per_unit ?? 0;
                if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                    toast({ title: "Sin Stock", description: `No hay suficiente inventario para ${optionName}.`, variant: "destructive" });
                    return prevConfigs;
                }
            }
            if (isSelected) {
                newSelectionsForInstance = newSelectionsForInstance.filter(opt => !(opt.productId === optionProductId && opt.slotId === slotId));
            } else {
                if (currentSelectionsInSlot.length < targetSlotDefinition.max_quantity) {
                    newSelectionsForInstance.push({ productId: optionProductId, name: optionName, priceModifier: optionEffectivePriceInSlot, slotId: slotId, servingStyle: 'Normal', extraCost: 0 });
                } else {
                    toast({ title: "Límite Alcanzado", description: `Máximo ${targetSlotDefinition.max_quantity} para "${targetSlotDefinition.label}".`, variant: "default" });
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
                        const modifierProductDef = slot.options.find(opt => opt.id === optionProductId);
                        if (!modifierProductDef) return slot;
                        if (modifierProductDef.inventory_item_id) {
                             const invItem = inventoryMap.get(modifierProductDef.inventory_item_id);
                             const consumed = modifierProductDef.inventory_consumed_per_unit ?? 0;
                             if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                                toast({ title: "Sin Stock", description: `No hay suficiente inventario para ${optionName}.`, variant: "destructive" });
                                return slot;
                             }
                        }
                        if (isSelected) {
                            newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                        } else {
                            if (newSelections.length < slot.max_quantity) {
                                newSelections.push({ productId: optionProductId, name: optionName, priceModifier: optionEffectivePriceInSlot, slotId: slotId, servingStyle: 'Normal', extraCost: 0 });
                            } else {
                                toast({ title: "Límite Alcanzado", description: `Máximo ${slot.max_quantity} para "${slot.label}".`, variant: "default" });
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
    event: React.MouseEvent<HTMLDivElement>, modifierProductId: string, slotId: string,
    context: 'product' | 'package', packageItemContextId?: string
) => {
    event.preventDefault();
    let isSelectedCurrently = false; let targetSlotDefinition: ProductModifierSlot | ModifierSlotState | undefined;
    let linkedCategoryIdForStyles: string | undefined;

    if (context === 'product' && view === 'modifiers') {
        targetSlotDefinition = currentModifierSlots.find(s => s.id === slotId);
        linkedCategoryIdForStyles = targetSlotDefinition?.linked_category_id;
        const currentInstanceConfig = modifierConfigurations[currentInstanceIndexForConfiguration] || [];
        isSelectedCurrently = !!currentInstanceConfig.find(so => so.productId === modifierProductId && so.slotId === slotId);
    } else if (context === 'package' && selectedPackageDetail && packageItemContextId) {
        const targetItemSlots = selectedPackageDetail.itemSlots[packageItemContextId];
        targetSlotDefinition = targetItemSlots?.find(s => s.id === slotId);
        linkedCategoryIdForStyles = targetSlotDefinition?.linked_category_id;
        isSelectedCurrently = !!targetSlotDefinition?.selectedOptions.find(so => so.productId === modifierProductId);
    }

    if (!isSelectedCurrently || !targetSlotDefinition || !linkedCategoryIdForStyles) return;

    setIsLoading(prev => ({ ...prev, servingStyles: true }));
    try {
        const styles = await getServingStylesForCategory(linkedCategoryIdForStyles);
        setServingStylePopoverState({
            orderItemUniqueId: null, modifierProductId: modifierProductId, modifierSlotId: slotId,
            packageItemContextId: context === 'package' ? packageItemContextId : null,
            anchorElement: event.currentTarget, availableServingStyles: styles,
        });
    } catch (error) {
        toast({title: "Error", description: "No se pudieron cargar los estilos de servicio.", variant:"destructive"});
    } finally {
        setIsLoading(prev => ({ ...prev, servingStyles: false }));
    }
};


const handleSaveServingStyle = (styleLabel: string) => {
    if (!servingStylePopoverState) return;
    const { modifierProductId, modifierSlotId, packageItemContextId, orderItemUniqueId } = servingStylePopoverState;
    if (orderItemUniqueId) {
         setCurrentOrder(prevOrder => ({ ...prevOrder, items: prevOrder.items.map(item => {
                if (item.uniqueId === orderItemUniqueId) {
                    let updatedSelectedModifiers = [...(item.selectedModifiers || [])];
                    let updatedPackageItems = item.packageItems ? [...item.packageItems] : undefined;
                    if (packageItemContextId && updatedPackageItems) {
                        updatedPackageItems = updatedPackageItems.map(pkgItem => pkgItem.packageItemId === packageItemContextId ? { ...pkgItem, selectedModifiers: pkgItem.selectedModifiers.map(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId ? { ...mod, servingStyle: styleLabel } : mod) } : pkgItem);
                    } else {
                        updatedSelectedModifiers = updatedSelectedModifiers.map(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId ? { ...mod, servingStyle: styleLabel } : mod);
                    }
                    return { ...item, selectedModifiers: updatedSelectedModifiers, packageItems: updatedPackageItems };
                }
                return item;
            })
        }));
    } else {
        if (view === 'modifiers' && !packageItemContextId) {
            setModifierConfigurations(prevConfigs => {
                const newConfigs = [...prevConfigs];
                const currentInstanceConfig = newConfigs[currentInstanceIndexForConfiguration] || [];
                newConfigs[currentInstanceIndexForConfiguration] = currentInstanceConfig.map(opt => (opt.productId === modifierProductId && opt.slotId === modifierSlotId) ? { ...opt, servingStyle: styleLabel } : opt);
                return newConfigs;
            });
        } else if (view === 'package-details' && selectedPackageDetail && packageItemContextId) {
             setSelectedPackageDetail(prevDetail => {
                if (!prevDetail) return null;
                const updatedItemSlots = { ...prevDetail.itemSlots };
                if (updatedItemSlots[packageItemContextId]) {
                    updatedItemSlots[packageItemContextId] = updatedItemSlots[packageItemContextId].map(slot => slot.id === modifierSlotId ? { ...slot, selectedOptions: slot.selectedOptions.map(opt => opt.productId === modifierProductId ? { ...opt, servingStyle: styleLabel } : opt) } : slot);
                }
                return { ...prevDetail, itemSlots: updatedItemSlots };
            });
        }
    }
    setServingStylePopoverState(null);
    toast({title: "Estilo Guardado", description: `Modificador servido: ${styleLabel}`});
};

const handleOpenExtraCostDialog = (orderItemUniqueId: string, modifierProductId: string, modifierSlotId: string, packageItemContextId?: string) => {
    const orderItem = currentOrder.items.find(item => item.uniqueId === orderItemUniqueId);
    if (!orderItem) return;
    let targetModifier: SelectedModifierItem | undefined;
    if (packageItemContextId && orderItem.packageItems) {
        const pkgItem = orderItem.packageItems.find(pi => pi.packageItemId === packageItemContextId);
        targetModifier = pkgItem?.selectedModifiers.find(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId);
    } else {
        targetModifier = (orderItem.selectedModifiers || []).find(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId);
    }
    setExtraCostDialogState({ orderItemUniqueId, modifierProductId, modifierSlotId, packageItemContextId, anchorElement: null, currentExtraCost: targetModifier?.extraCost || 0 });
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
    setCurrentOrder(prevOrder => ({ ...prevOrder, items: prevOrder.items.map(item => {
            if (item.uniqueId === orderItemUniqueId) {
                let updatedSelectedModifiers = [...(item.selectedModifiers || [])];
                let updatedPackageItems = item.packageItems ? [...item.packageItems] : undefined;
                if (packageItemContextId && updatedPackageItems) {
                    updatedPackageItems = updatedPackageItems.map(pkgItem => pkgItem.packageItemId === packageItemContextId ? { ...pkgItem, selectedModifiers: pkgItem.selectedModifiers.map(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId ? { ...mod, extraCost: cost } : mod) } : pkgItem);
                } else {
                    updatedSelectedModifiers = updatedSelectedModifiers.map(mod => mod.productId === modifierProductId && mod.slotId === modifierSlotId ? { ...mod, extraCost: cost } : mod);
                }
                return { ...item, selectedModifiers: updatedSelectedModifiers, packageItems: updatedPackageItems };
            }
            return item;
        })
    }));
    setExtraCostDialogState(null);
    toast({ title: "Costo Extra Guardado" });
};

const handleDecrementConfigQuantity = () => {
    if (currentProductConfigQuantity > 1) {
        const newQuantity = currentProductConfigQuantity - 1;
        setCurrentProductConfigQuantity(newQuantity);
        if (view === 'modifiers') {
            setModifierConfigurations(prev => prev.slice(0, newQuantity));
            if (currentInstanceIndexForConfiguration >= newQuantity) setCurrentInstanceIndexForConfiguration(newQuantity - 1);
        }
    }
};

const handleIncrementConfigQuantity = () => {
    let canIncrement = true; const newQuantity = currentProductConfigQuantity + 1;
    if (view === 'modifiers' && selectedProduct && selectedProduct.inventory_item_id) {
        const invItem = inventoryMap.get(selectedProduct.inventory_item_id);
        const consumedPerUnit = selectedProduct.inventory_consumed_per_unit ?? 0;
        if (!invItem || invItem.current_stock < consumedPerUnit * newQuantity ) {
            toast({ title: "Sin Stock Suficiente", description: `No hay suficiente inventario para ${selectedProduct.name}. Solo quedan ${invItem?.current_stock && consumedPerUnit ? Math.floor(invItem.current_stock / consumedPerUnit) : 0}.`, variant: "destructive" });
            canIncrement = false;
        }
    }
    if (canIncrement) {
        setCurrentProductConfigQuantity(newQuantity);
        if (view === 'modifiers') setModifierConfigurations(prev => [...prev, []]);
    }
};

const handleConfigQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newQuantity = parseInt(e.target.value, 10);
    if (isNaN(newQuantity) || newQuantity < 1) { if (e.target.value === "") return; if (newQuantity < 1) newQuantity = 1; }
    if (view === 'modifiers' && selectedProduct && selectedProduct.inventory_item_id) {
        const invItem = inventoryMap.get(selectedProduct.inventory_item_id);
        const consumedTotal = (selectedProduct.inventory_consumed_per_unit ?? 0) * newQuantity;
        const maxPossible = invItem?.current_stock && selectedProduct.inventory_consumed_per_unit && selectedProduct.inventory_consumed_per_unit > 0 ? Math.floor(invItem.current_stock / selectedProduct.inventory_consumed_per_unit) : (invItem?.current_stock === 0 ? 0 : Infinity);
        if (newQuantity > maxPossible && maxPossible > 0) {
            toast({ title: "Sin Stock Suficiente", description: `Solo hay ${maxPossible} unidades de ${selectedProduct.name}.`, variant: "destructive" });
            newQuantity = maxPossible;
        } else if (maxPossible === 0) {
             toast({ title: "Sin Stock", description: `No hay unidades de ${selectedProduct.name}.`, variant: "destructive" });
             newQuantity = 1;
        }
    }
    setCurrentProductConfigQuantity(newQuantity);
    if (view === 'modifiers') {
        setModifierConfigurations(prev => {
            const currentLength = prev.length;
            if (newQuantity > currentLength) return [...prev, ...Array(newQuantity - currentLength).fill([])];
            else if (newQuantity < currentLength) return prev.slice(0, newQuantity);
            return prev;
        });
        if (currentInstanceIndexForConfiguration >= newQuantity) setCurrentInstanceIndexForConfiguration(Math.max(0, newQuantity - 1));
    }
};


  const handleAddConfiguredProductInstancesToOrder = () => {
    if (!selectedProduct || modifierConfigurations.length === 0) return;
    let allInstancesValid = true;
    for (let i = 0; i < currentProductConfigQuantity; i++) {
        const currentInstanceConfig = modifierConfigurations[i] || [];
        for (const slot of currentModifierSlots) {
            const selectedForSlot = currentInstanceConfig.filter(mod => mod.slotId === slot.id);
            if (selectedForSlot.length < slot.min_quantity) {
                toast({ title: `Selección Incompleta (Instancia ${i + 1})`, description: `Debes seleccionar al menos ${slot.min_quantity} en "${slot.label}".`, variant: "destructive" });
                allInstancesValid = false; setCurrentInstanceIndexForConfiguration(i); break;
            }
        }
        if (!allInstancesValid) break;
    }
    if (!allInstancesValid) return;

    modifierConfigurations.forEach((instanceConfig) => {
        let sumOfModifiersPriceForInstance = instanceConfig.reduce((sum, mod) => sum + (mod.priceModifier || 0) + (mod.extraCost || 0), 0);
        const originalPriceBeforeInflation = selectedProduct.price + sumOfModifiersPriceForInstance;
        let finalPriceForOrder = originalPriceBeforeInflation; let appliedInflationRate: number | undefined = undefined;
        if (currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) {
            finalPriceForOrder = originalPriceBeforeInflation * (1 + globalPlatformPriceIncreasePercent);
            appliedInflationRate = globalPlatformPriceIncreasePercent;
        }
        addProductToOrder(selectedProduct, instanceConfig, selectedProduct.price, 1, currentOrderType === 'platform' ? finalPriceForOrder : undefined, appliedInflationRate, originalPriceBeforeInflation);
    });
    toast({ title: `${selectedProduct.name} (x${currentProductConfigQuantity}) añadido(s)` });
    resetAndGoToCategories();
  };


   const handleAddPackageToOrder = async () => {
        if (!selectedPackageDetail) return;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        let inventoryOk = true; const tempInventoryChanges: Record<string, number> = {};
        for (const itemDef of packageItems) {
            const productDetails = allProductsMap.get(itemDef.product_id);
            if (!productDetails) { toast({ title: "Error", description: `Definición de producto para ${itemDef.product_name || 'desconocido'} no encontrada.`, variant: "destructive" }); inventoryOk = false; break; }
            if (productDetails.inventory_item_id) {
                const invItem = inventoryMap.get(productDetails.inventory_item_id);
                const consumed = (productDetails.inventory_consumed_per_unit ?? 0) * itemDef.quantity * currentProductConfigQuantity;
                const currentStock = invItem?.current_stock ?? 0; const alreadyConsumedInThisPackage = tempInventoryChanges[productDetails.inventory_item_id] || 0;
                if (currentStock - alreadyConsumedInThisPackage < consumed) {
                    toast({ title: "Sin Stock", description: `No hay suficiente inventario para ${itemDef.product_name} (necesitan ${consumed}, disponibles ${currentStock - alreadyConsumedInThisPackage}).`, variant: "destructive" });
                    inventoryOk = false; break;
                } else if (consumed > 0) tempInventoryChanges[productDetails.inventory_item_id] = (tempInventoryChanges[productDetails.inventory_item_id] || 0) + consumed;
            }
            const slotsConfiguredForItem = itemSlots[itemDef.id] || [];
            for (const slot of slotsConfiguredForItem) {
                if (slot.selectedOptions.length < slot.min_quantity) { toast({ title: "Selección Incompleta", description: `Para "${itemDef.product_name}", selecciona al menos ${slot.min_quantity} ${slot.label.toLowerCase()}.`, variant: "destructive" }); inventoryOk = false; break; }
                 for (const modOption of slot.selectedOptions) {
                     const modProductDetails = allProductsMap.get(modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * currentProductConfigQuantity;
                         const currentStock = invItem?.current_stock ?? 0; const alreadyConsumedInThisPackage = tempInventoryChanges[modProductDetails.inventory_item_id] || 0;
                        if (currentStock - alreadyConsumedInThisPackage < consumed) {
                            toast({ title: "Sin Stock", description: `No hay suficiente inventario para modificador ${modOption.name} (necesitan ${consumed}, disponibles ${currentStock - alreadyConsumedInThisPackage}).`, variant: "destructive" });
                            inventoryOk = false; break;
                         } else if (consumed > 0) tempInventoryChanges[modProductDetails.inventory_item_id] = (tempInventoryChanges[modProductDetails.inventory_item_id] || 0) + consumed;
                     }
                 }
                 if (!inventoryOk) break;
            }
             if (!inventoryOk) break;
        }
        if (!inventoryOk) return;

        for (let i = 0; i < currentProductConfigQuantity; i++) {
            let packagePriceWithModifiers = packageDef.price;
            const packageItemsForOrder: OrderItem['packageItems'] = packageItems.map(itemDef => {
                const selectedModsForThisSubItem = (itemSlots[itemDef.id] || []).flatMap(slot => slot.selectedOptions);
                selectedModsForThisSubItem.forEach(mod => packagePriceWithModifiers += (mod.priceModifier || 0) + (mod.extraCost || 0));
                return { packageItemId: itemDef.id, productId: itemDef.product_id, productName: itemDef.product_name || 'Producto Desconocido', selectedModifiers: selectedModsForThisSubItem };
            });
            const originalPriceBeforeInflation = packagePriceWithModifiers;
            let finalPriceForOrder = originalPriceBeforeInflation; let appliedInflationRate: number | undefined = undefined;
            if (currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) {
                 finalPriceForOrder = originalPriceBeforeInflation * (1 + globalPlatformPriceIncreasePercent);
                 appliedInflationRate = globalPlatformPriceIncreasePercent;
            }
            const newOrderItem: OrderItem = {
                type: 'package', id: packageDef.id, name: packageDef.name, quantity: 1,
                basePrice: packageDef.price, original_platform_price: currentOrderType === 'platform' ? finalPriceForOrder : undefined,
                totalPrice: finalPriceForOrder, applied_commission_rate: appliedInflationRate, selectedModifiers: [],
                uniqueId: uuidv4(), packageItems: packageItemsForOrder, original_price_before_inflation: originalPriceBeforeInflation,
            };
            setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
        }
        toast({ title: `Paquete "${packageDef.name}" (x${currentProductConfigQuantity}) añadido` });
        resetAndGoToCategories();
   };

  const addProductToOrder = (
    product: Product, modifiers: SelectedModifierItem[], baseItemPrice: number, quantity: number,
    inflatedPricePerUnitWithMods?: number, appliedInflationRate?: number, originalPriceBeforeInflationWithMods?: number
  ) => {
    let sumOfModifiersPrice = modifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0) + (mod.extraCost || 0), 0);
    const effectiveOriginalPriceWithMods = originalPriceBeforeInflationWithMods ?? (baseItemPrice + sumOfModifiersPrice);
    let finalUnitPrice = inflatedPricePerUnitWithMods ?? effectiveOriginalPriceWithMods;
    const newOrderItem: OrderItem = {
      type: 'product', id: product.id, name: product.name, quantity: quantity, basePrice: baseItemPrice,
      selectedModifiers: modifiers, totalPrice: finalUnitPrice * quantity, uniqueId: uuidv4(),
      original_platform_price: currentOrderType === 'platform' ? finalUnitPrice : undefined,
      applied_commission_rate: appliedInflationRate, original_price_before_inflation: effectiveOriginalPriceWithMods,
    };
    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
  };


  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta);
          let unitPriceForRecalc = 0;
          if (item.quantity > 0) unitPriceForRecalc = item.totalPrice / item.quantity;
          else baseOrPlatformPrice = item.original_platform_price ?? (item.original_price_before_inflation ?? item.basePrice);
          return { ...item, quantity: newQuantity, totalPrice: unitPriceForRecalc * newQuantity };
        }
        return item;
      });
      updatedItems = updatedItems.filter(item => item.quantity > 0);
      return { ...prev, items: updatedItems };
    });
  };

  const handleRemoveItem = (uniqueId: string) => {
     setCurrentOrder(prev => ({ ...prev, items: prev.items.filter(item => item.uniqueId !== uniqueId) }));
     toast({ title: `Item eliminado`, variant: 'destructive' })
  };

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

  const handlePauseOrder = () => {
        if (currentOrder.items.length === 0) { toast({ title: "Pedido Vacío", variant: "default" }); return; }
        const pausedOrder: PausedOrder = { ...currentOrder, subtotal: subtotal, total: total, pausedId: uuidv4(), pausedAt: new Date().toISOString() };
        try {
            const existingPausedOrdersString = localStorage.getItem('siChefPausedOrders');
            const existingPausedOrders: PausedOrder[] = existingPausedOrdersString ? JSON.parse(existingPausedOrdersString) : [];
            existingPausedOrders.push(pausedOrder);
            localStorage.setItem('siChefPausedOrders', JSON.stringify(existingPausedOrders));
            toast({ title: "Pedido Pausado", description: `El pedido para ${currentOrder.customerName} ha sido guardado.` });
            clearOrder();
        } catch (error) {
            console.error("Error pausando pedido:", error);
            toast({ title: "Error al Pausar", variant: "destructive" });
        }
   };


  const handleFinalizeOrder = async () => {
    if (currentOrder.items.length === 0) { toast({ title: "Pedido Vacío", variant: 'destructive' }); return; }
    if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < total)) { toast({ title: "Pago Incompleto", variant: 'destructive' }); return; }
    if (currentOrderType === 'platform' && (!selectedPlatformId || !platformOrderId)) { toast({ title: "Datos de Plataforma Incompletos", variant: 'destructive' }); return; }
    if (currentOrderType === 'delivery' && !deliveryAddress) { toast({ title: "Datos de Entrega Incompletos", variant: 'destructive' }); return; }

    let customerToSave = currentOrder.customerName;
    let clientIdToSave = selectedClient?.id || null;

    // Lógica para registrar nuevo cliente si es necesario (delivery)
    if (showNewClientFieldsForDelivery && currentOrderType === 'delivery' && newCustomerNameForDelivery.trim() && customerPhoneInput.trim()) {
        setIsLoading(prev => ({ ...prev, page: true })); // Indicar carga
        try {
            const newClient = await addClientService({
                name: newCustomerNameForDelivery,
                phone: customerPhoneInput,
                address: deliveryAddress, // Dirección del pedido actual
                email: null, // No se pide email en este flujo rápido
                notes: `Registrado desde pedido de delivery el ${formatDateFn(new Date(), 'Pp')}`
            });
            customerToSave = newClient.name;
            clientIdToSave = newClient.id;
            setSelectedClient(newClient); // Actualizar el cliente seleccionado
            toast({ title: "Cliente Registrado", description: `${newClient.name} añadido a la cartera.` });
        } catch (error) {
            console.error("Error registrando nuevo cliente:", error);
            toast({ title: "Error al Registrar Cliente", description: error instanceof Error ? error.message : "No se pudo guardar el nuevo cliente.", variant: "destructive" });
            setIsLoading(prev => ({ ...prev, page: false }));
            return; // No continuar con el pedido si el registro del cliente falla
        } finally {
            setIsLoading(prev => ({ ...prev, page: false }));
        }
    }


     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try { existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({ ...order, createdAt: new Date(order.createdAt), updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined, items: order.items?.map((item: any) => ({ id: item.id || 'unknown', name: item.name || 'Unknown Item', quantity: typeof item.quantity === 'number' ? item.quantity : 0, price: typeof item.price === 'number' ? item.price : 0, totalItemPrice: typeof item.totalItemPrice === 'number' ? item.totalItemPrice : 0, components: Array.isArray(item.components) ? item.components.map((c:any) => ({ ...c, productId: c.productId, slotId: c.slotId, priceModifier: c.priceModifier })) : [], isPlatformItem: typeof item.isPlatformItem === 'boolean' ? item.isPlatformItem : false, platformPricePerUnit: typeof item.platformPricePerUnit === 'number' ? item.platformPricePerUnit : undefined, original_price_before_inflation: typeof item.original_price_before_inflation === 'number' ? item.original_price_before_inflation : undefined })) || [], subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0, total: typeof order.total === 'number' ? order.total : 0, status: ['pending', 'completed', 'cancelled'].includes(order.status) ? order.status : 'pending', paymentMethod: ['cash', 'card'].includes(order.paymentMethod) ? order.paymentMethod : 'card', order_type: order.order_type || 'pickup', platform_name: order.platform_name, platform_order_id: order.platform_order_id, delivery_address: order.delivery_address, delivery_phone: order.delivery_phone, client_id: order.client_id }));
     } catch (e) { console.error("Error parseando pedidos existentes", e); }

     setIsLoading(prev => ({ ...prev, inventory: true }));
     let inventoryAdjustmentFailed = false;
     try {
        if (editingOrderId && originalOrderForEdit) {
            const originalInventoryAdjustments: Record<string, number> = {};
            for (const savedItem of originalOrderForEdit.items) {
                const itemDef = allProductsMap.get(savedItem.id);
                if (itemDef) {
                    if ('inventory_item_id' in itemDef && itemDef.inventory_item_id && itemDef.inventory_consumed_per_unit) originalInventoryAdjustments[itemDef.inventory_item_id] = (originalInventoryAdjustments[itemDef.inventory_item_id] || 0) + (itemDef.inventory_consumed_per_unit * savedItem.quantity);
                    for (const comp of savedItem.components) { if (comp.productId && comp.slotLabel !== 'Contenido') { const modDef = allProductsMap.get(comp.productId); if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) originalInventoryAdjustments[modDef.inventory_item_id] = (originalInventoryAdjustments[modDef.inventory_item_id] || 0) + (modDef.inventory_consumed_per_unit * savedItem.quantity); } }
                }
            }
            for (const [itemId, change] of Object.entries(originalInventoryAdjustments)) if (change !== 0) await adjustInventoryStock(itemId, change);
        }

        const currentInventoryAdjustments: Record<string, number> = {};
        for (const orderItem of currentOrder.items) {
            const itemDef = allProductsMap.get(orderItem.id);
            if (itemDef) {
                if (orderItem.type === 'product') {
                    const productDef = itemDef as Product;
                    if (productDef.inventory_item_id && productDef.inventory_consumed_per_unit) currentInventoryAdjustments[productDef.inventory_item_id] = (currentInventoryAdjustments[productDef.inventory_item_id] || 0) - (productDef.inventory_consumed_per_unit * orderItem.quantity);
                    for (const modifier of (orderItem.selectedModifiers || [])) { const modDef = allProductsMap.get(modifier.productId); if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) currentInventoryAdjustments[modDef.inventory_item_id] = (currentInventoryAdjustments[modDef.inventory_item_id] || 0) - (modDef.inventory_consumed_per_unit * orderItem.quantity); }
                } else if (orderItem.type === 'package' && orderItem.packageItems) {
                    for (const pkgItem of orderItem.packageItems) {
                        const pkgItemDef = allProductsMap.get(pkgItem.productId);
                        if (pkgItemDef?.inventory_item_id && pkgItemDef.inventory_consumed_per_unit) { const packageDefinition = await getPackageById(orderItem.id); const itemInPackageDef = packageDefinition ? (await getItemsForPackage(packageDefinition.id)).find(i => i.id === pkgItem.packageItemId) : undefined; const itemQtyInPackage = itemInPackageDef?.quantity || 1; currentInventoryAdjustments[pkgItemDef.inventory_item_id] = (currentInventoryAdjustments[pkgItemDef.inventory_item_id] || 0) - (pkgItemDef.inventory_consumed_per_unit * itemQtyInPackage * orderItem.quantity); }
                        for (const modifier of pkgItem.selectedModifiers) { const modDef = allProductsMap.get(modifier.productId); if (modDef?.inventory_item_id && modDef.inventory_consumed_per_unit) currentInventoryAdjustments[modDef.inventory_item_id] = (currentInventoryAdjustments[modDef.inventory_item_id] || 0) - (modDef.inventory_consumed_per_unit * orderItem.quantity); }
                    }
                }
            }
        }
        for (const [itemId, change] of Object.entries(currentInventoryAdjustments)) if (change !== 0) await adjustInventoryStock(itemId, change);
        const newInvMap = new Map(inventoryMap);
        Object.entries(currentInventoryAdjustments).forEach(([itemId, change]) => { const currentInvItem = newInvMap.get(itemId); if (currentInvItem) newInvMap.set(itemId, { ...currentInvItem, current_stock: currentInvItem.current_stock + change }); });
        setInventoryMap(newInvMap);
     } catch (error) { toast({ title: "Error Inventario", description: `Fallo al actualizar inventario: ${error instanceof Error ? error.message : 'Error desconocido'}. Pedido no guardado.`, variant: "destructive" }); inventoryAdjustmentFailed = true;
     } finally { setIsLoading(prev => ({ ...prev, inventory: false })); }
     if (inventoryAdjustmentFailed) return;

     const newOrderData = {
        customerName: customerToSave, // Usar el nombre de cliente actualizado
        client_id: clientIdToSave,   // Usar el ID del cliente (nuevo o existente)
        items: currentOrder.items.map(item => {
            let components: SavedOrderItemComponent[] = [];
            if (item.type === 'package' && item.packageItems) { item.packageItems.forEach(pkgItem => { components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido', productId: pkgItem.productId }); if (pkgItem.selectedModifiers.length > 0) pkgItem.selectedModifiers.forEach(mod => components.push({ name: mod.name, slotId: mod.slotId, productId: mod.productId, priceModifier: mod.priceModifier, servingStyle: mod.servingStyle, extraCost: mod.extraCost })); });
            } else if (item.type === 'product' && (item.selectedModifiers || []).length > 0) (item.selectedModifiers || []).forEach(mod => components.push({ name: mod.name, slotId: mod.slotId, productId: mod.productId, priceModifier: mod.priceModifier, servingStyle: mod.servingStyle, extraCost: mod.extraCost }));
            return { id: item.id, name: item.name, quantity: item.quantity, price: item.basePrice, totalItemPrice: item.totalPrice, components: components, isPlatformItem: currentOrderType === 'platform', platformPricePerUnit: item.original_platform_price, original_price_before_inflation: item.original_price_before_inflation };
        }),
        paymentMethod: currentOrder.paymentMethod, subtotal: subtotal, total: total, status: 'pending',
        paidAmount: currentOrder.paidAmount, changeGiven: currentOrder.changeDue, order_type: currentOrderType,
        platform_name: currentOrderType === 'platform' ? configuredPlatforms.find(p => p.id === selectedPlatformId)?.name : undefined,
        platform_order_id: currentOrderType === 'platform' ? platformOrderId : undefined,
        delivery_address: currentOrderType === 'delivery' ? deliveryAddress : undefined,
        delivery_phone: currentOrderType === 'delivery' ? deliveryPhone : undefined,
    };

    let finalizedOrder: SavedOrder; let updatedOrders: SavedOrder[];
    if (editingOrderId && originalOrderForEdit) {
        finalizedOrder = { ...originalOrderForEdit, ...newOrderData, updatedAt: new Date() };
        updatedOrders = existingOrders.map(o => o.id === editingOrderId ? finalizedOrder : o);
        toast({ title: "Pedido Actualizado", description: `#${finalizedOrder.orderNumber} actualizado.` });
    } else {
        const newOrderId = uuidv4(); const newOrderNumber = existingOrders.length + 1;
        finalizedOrder = { ...newOrderData, id: newOrderId, orderNumber: newOrderNumber, createdAt: new Date() };
        updatedOrders = [...existingOrders, finalizedOrder];
        toast({ title: "Pedido Finalizado", description: `${finalizedOrder.id} creado y guardado.` });
    }
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));
    const printReceiptsEnabled = localStorage.getItem('siChefSettings_printReceipts') === 'true';
    if (printReceiptsEnabled) { const receiptHtml = await generateTicketData(finalizedOrder); await handleActualPrint(receiptHtml); }
    else { toast({ title: "Impresión Omitida", description: "La impresión está desactivada." }); }
    clearOrder();
  };

  const handleApplyCurrentModifiersToAllInstances = () => {
    if (modifierConfigurations.length <= 1 || currentInstanceIndexForConfiguration < 0) return;
    const currentConfig = modifierConfigurations[currentInstanceIndexForConfiguration];
    const newConfigs = modifierConfigurations.map(() => [...currentConfig.map(mod => ({...mod}))]);
    setModifierConfigurations(newConfigs);
    toast({title: "Configuración Aplicada"});
  };

  const isViewLoading = isLoading.page || (view === 'categories' && isLoading.categories && categoriesData.length === 0) || (view === 'products' && (isLoading.products || isLoading.packages)) || (view === 'modifiers' && isLoading.modifiers) || (view === 'package-details' && isLoading.packageDetails);


  const renderBackButton = () => {
    let buttonText = ''; let onClickAction = handleBack;
    if (view === 'products' && selectedCategory) buttonText = `Volver a Categorías`;
    else if (view === 'modifiers' && selectedProduct && selectedCategory) buttonText = `Volver a ${selectedCategory.name}`;
    else if (view === 'package-details' && selectedPackage && selectedCategory) buttonText = `Volver a ${selectedCategory.name}`;
    if (buttonText) return <Button variant="ghost" size="sm" onClick={onClickAction} className="mb-2 md:mb-4 text-sm"><ChevronLeft className="mr-2 h-4 w-4" /> {buttonText}</Button>;
    return editingOrderId && originalOrderForEdit ? <CardDescription className="text-xs md:text-sm">Editando Pedido #{originalOrderForEdit.orderNumber}.</CardDescription> : null;
  };

  const renderOrderTypeSpecificFields = () => {
    if (currentOrderType === 'delivery') {
      return (
        <>
          <div className="mb-2">
            <Label htmlFor="deliveryAddress" className="mb-1 block text-xs md:text-sm">Dirección de Entrega</Label>
            <Textarea id="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Calle, Número, Colonia..." rows={2} className="text-sm"/>
          </div>
          <div className="mb-3">
            <Label htmlFor="deliveryPhone" className="mb-1 block text-xs md:text-sm">Teléfono de Contacto (Entrega)</Label>
            <Input id="deliveryPhone" type="tel" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} placeholder="Número para entrega" className="text-sm h-9"/>
          </div>
        </>
      );
    }
    if (currentOrderType === 'platform') {
      return (
        <>
          <div className="mb-2">
            <Label htmlFor="platformSelect" className="mb-1 block text-xs md:text-sm">Plataforma</Label>
            <ShadSelect value={selectedPlatformId || undefined} onValueChange={setSelectedPlatformId}>
              <ShadSelectTrigger id="platformSelect" className="h-9 text-sm">
                <ShadSelectValue placeholder="Selecciona plataforma" />
              </ShadSelectTrigger>
              <ShadSelectContent>
                {configuredPlatforms.length === 0 && <ShadSelectItem value="__NO_PLATFORMS__" disabled>No hay plataformas configuradas</ShadSelectItem>}
                {configuredPlatforms.filter(p => p.id && p.id.trim() !== "").map(p => <ShadSelectItem key={p.id} value={p.id}>{p.name}</ShadSelectItem>)}
              </ShadSelectContent>
            </ShadSelect>
          </div>
          <div className="mb-3">
            <Label htmlFor="platformOrderId" className="mb-1 block text-xs md:text-sm">ID Pedido Plataforma</Label>
            <Input id="platformOrderId" value={platformOrderId} onChange={(e) => setPlatformOrderId(e.target.value)} placeholder="ID de Didi, Uber, etc." className="text-sm h-9"/>
          </div>
        </>
      );
    }
    return null;
  };

  // --- Funciones de manejo de cliente ---
  const handleCustomerPhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value;
    setCustomerPhoneInput(searchTerm);
    setSelectedClient(null); // Limpiar cliente seleccionado si se modifica el teléfono
    setCurrentOrder(prev => ({ ...prev, customerName: 'Cliente General', clientId: null }));
    setShowNewClientFieldsForDelivery(false); // Ocultar campos de nuevo cliente

    if (searchTerm.length >= 3) {
      setIsSearchingClients(true);
      try {
        const results = await searchClientsByPhone(searchTerm);
        setSearchResults(results);
        if (results.length === 0 && currentOrderType === 'delivery') {
          setShowNewClientFieldsForDelivery(true);
        }
      } catch (error) {
        toast({ title: "Error Búsqueda Cliente", description: "No se pudo buscar clientes.", variant: "destructive" });
        setSearchResults([]);
      } finally {
        setIsSearchingClients(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setCurrentOrder(prev => ({ ...prev, customerName: client.name, clientId: client.id }));
    setCustomerPhoneInput(client.phone || '');
    setDeliveryAddress(client.address || ''); // Pre-llenar dirección si es para delivery
    setDeliveryPhone(client.phone || '');    // Pre-llenar teléfono de entrega
    setSearchResults([]);
    setShowNewClientFieldsForDelivery(false);
    setNewCustomerNameForDelivery('');
  };

  const handleClearSelectedClient = () => {
    setSelectedClient(null);
    setCurrentOrder(prev => ({ ...prev, customerName: 'Cliente General', clientId: null }));
    setCustomerPhoneInput('');
    setSearchResults([]);
    setShowNewClientFieldsForDelivery(false);
    setNewCustomerNameForDelivery('');
    // No limpiar deliveryAddress/Phone aquí, ya que podrían ser para un cliente nuevo
  };


  // Renderizado principal del contenido (categorías, productos, modificadores)
  const renderContent = () => {
    switch (view) {
      case 'categories':
        const displayCategories = categoriesData.filter(cat => cat.type !== 'modificador');
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {isLoading.categories && displayCategories.length === 0 ? ( Array.from({length: 5}).map((_, i) => ( <Card key={`skel-cat-${i}`} className="animate-pulse"><div className="relative w-full h-24 md:h-32 bg-secondary/70 rounded-t-md"></div><CardHeader className="p-2 md:p-3"><div className="h-4 bg-secondary/70 rounded w-3/4 mx-auto"></div></CardHeader></Card> ))
            ) : displayCategories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-24 md:h-32 bg-secondary">
                  {cat.imageUrl ? <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category"/> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div> }
                  {cat.type === 'paquete' && <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent text-xs px-1 py-0">Paquetes</Badge>}
                 </div> <CardHeader className="p-2 md:p-3"><CardTitle className="text-center text-xs md:text-sm">{cat.name}</CardTitle></CardHeader>
              </Card>
            ))}
             {displayCategories.length === 0 && !isLoading.categories && <p className="col-span-full text-center text-muted-foreground py-10">No hay categorías disponibles.</p>}
          </div>
        );

      case 'products':
        let effectiveGlobalIncrease = (currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) ? globalPlatformPriceIncreasePercent : 0;
        return (
          <>
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4">{selectedCategory?.name}</h2>
             {(isLoading.products || isLoading.packages) && productsData.length === 0 && packagesData.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"> {Array.from({length: 8}).map((_,i) => ( <Card key={`skel-item-${i}`} className="animate-pulse"><div className="relative w-full h-24 md:h-32 bg-secondary/70 rounded-t-md"></div><CardHeader className="p-2 md:p-3"><div className="h-4 bg-secondary/70 rounded w-3/4 mb-1"></div><div className="h-3 bg-secondary/70 rounded w-1/2"></div></CardHeader></Card> ))} </div>
             ) : (
                <>
                {packagesData.length > 0 && (
                    <> <h3 className="text-md md:text-lg font-medium mb-2 md:mb-3 text-accent border-b pb-1">Paquetes Disponibles</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
                        {packagesData.map(pkg => { let displayPkgPrice = pkg.price * (1 + effectiveGlobalIncrease); return (
                            <Card key={pkg.id} onClick={() => handlePackageClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                                <div className="relative w-full h-24 md:h-32 bg-secondary">
                                    {pkg.imageUrl ? <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal"/> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><PackageIcon className="h-8 w-8"/></div> }
                                    <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent text-xs px-1 py-0">Paquete</Badge>
                                    {effectiveGlobalIncrease > 0 && <Badge variant="outline" className="absolute top-1 left-1 text-xs px-1 py-0 bg-background/80 border-orange-500 text-orange-600">Plataforma</Badge>}
                                </div> <CardHeader className="p-2 md:p-3"><CardTitle className="text-xs md:text-sm">{pkg.name}</CardTitle><CardDescription className="text-xs">{formatCurrency(displayPkgPrice)}</CardDescription></CardHeader>
                            </Card>
                        )})} </div>
                    </>
                )}
                {productsData.length > 0 && (
                    <> <h3 className="text-md md:text-lg font-medium mb-2 md:mb-3 border-b pb-1">Productos Individuales</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                        {productsData.map(prod => { let displayProdPrice = prod.price * (1 + effectiveGlobalIncrease); return (
                                <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                                    <div className="relative w-full h-24 md:h-32 bg-secondary">
                                    {prod.imageUrl ? <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food"/> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8"/></div> }
                                    {effectiveGlobalIncrease > 0 && <Badge variant="outline" className="absolute top-1 left-1 text-xs px-1 py-0 bg-background/80 border-orange-500 text-orange-600">Plataforma</Badge>}
                                    </div> <CardHeader className="p-2 md:p-3"><CardTitle className="text-xs md:text-sm">{prod.name}</CardTitle><CardDescription className="text-xs">{formatCurrency(displayProdPrice)}</CardDescription></CardHeader>
                                </Card>
                            );
                        })} </div>
                    </>
                )}
                {productsData.length === 0 && packagesData.length === 0 && !(isLoading.products || isLoading.packages) && <p className="col-span-full text-center text-muted-foreground py-10">No hay items en '{selectedCategory?.name}'.</p>}
                </>
             )}
          </>
        );

     case 'modifiers':
         if (!selectedProduct) return <p className="text-center text-muted-foreground py-10">Error: No hay producto seleccionado.</p>;
         const currentInstanceConfig = modifierConfigurations[currentInstanceIndexForConfiguration] || [];
         let displayPriceForSelectedProduct = selectedProduct.price * (1 + ((currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) ? globalPlatformPriceIncreasePercent : 0));
        return (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-3 p-2 border rounded-md bg-muted/30">
                    <div> <h2 className="text-lg md:text-xl font-semibold">{selectedProduct.name}</h2> <p className="text-sm text-muted-foreground">{formatCurrency(displayPriceForSelectedProduct)} {currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0 && <Badge variant="outline" className="ml-2 text-xs border-orange-500 text-orange-600">Plataforma</Badge>} </p> </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handleDecrementConfigQuantity} disabled={currentProductConfigQuantity <= 1}><MinusCircle className="h-5 w-5" /></Button>
                        <Input type="number" value={String(currentProductConfigQuantity)} onChange={handleConfigQuantityInputChange} className="w-16 h-9 text-center text-base" min="1"/>
                        <Button variant="outline" size="icon" onClick={handleIncrementConfigQuantity}><PlusCircle className="h-5 w-5" /></Button>
                    </div>
                </div>
                {currentProductConfigQuantity > 1 && ( <div className="flex items-center justify-between gap-2 mb-3 p-2 border rounded-md bg-muted/30"> <Button variant="outline" size="sm" onClick={() => setCurrentInstanceIndexForConfiguration(prev => Math.max(0, prev - 1))} disabled={currentInstanceIndexForConfiguration === 0}>Anterior</Button> <span className="text-sm text-muted-foreground whitespace-nowrap">Configurando {selectedProduct.name} (Instancia {currentInstanceIndexForConfiguration + 1} de {currentProductConfigQuantity})</span> <Button variant="outline" size="sm" onClick={() => setCurrentInstanceIndexForConfiguration(prev => Math.min(currentProductConfigQuantity - 1, prev + 1))} disabled={currentInstanceIndexForConfiguration === currentProductConfigQuantity - 1}>Siguiente</Button> </div> )}
                 <p className="text-xs md:text-sm text-muted-foreground mb-2">Configura modificadores. Doble clic para estilos.</p>
            </div>
             {currentModifierSlots.length === 0 && !isLoading.modifiers && <p className="text-muted-foreground my-4 text-center">No hay modificadores para este producto.</p>}
             {isLoading.modifiers && <div className="flex justify-center items-center my-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}
             <ScrollArea className="flex-grow mb-3"> <div className="space-y-4 md:space-y-6 pr-2"> {currentModifierSlots.map(slot => { const selectedForSlotInCurrentInstance = currentInstanceConfig.filter(sel => sel.slotId === slot.id); return (
                            <div key={slot.id}> <h3 className="text-md md:text-lg font-medium mb-1 md:mb-2">{slot.label} <span className="text-xs md:text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3> {selectedForSlotInCurrentInstance.length > 0 && <div className="mb-1 text-xs text-muted-foreground">Seleccionados: {selectedForSlotInCurrentInstance.length} / {slot.max_quantity}</div>} {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>} <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3"> {slot.options.map(option => { const isSelectedInCurrentInstance = selectedForSlotInCurrentInstance.some(sel => sel.productId === option.id); const maxReachedForSlotInCurrentInstance = selectedForSlotInCurrentInstance.length >= slot.max_quantity; const isDisabled = !isSelectedInCurrentInstance && maxReachedForSlotInCurrentInstance; const currentSelectionDetails = selectedForSlotInCurrentInstance.find(sel => sel.productId === option.id); let optionInventoryOk = true; let optionInvItemName = ''; if (option.inventory_item_id) { const invItem = inventoryMap.get(option.inventory_item_id); optionInvItemName = invItem?.name || 'Inventario'; optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0); } const isOutOfStock = !optionInventoryOk && !isSelectedInCurrentInstance; let displayPriceForModifier = option.price + (currentSelectionDetails?.extraCost || 0); return (
                                        <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id && servingStylePopoverState?.packageItemContextId === null && servingStylePopoverState.orderItemUniqueId === null} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}> <PopoverTrigger asChild> <div onDoubleClick={(e) => handleModifierDoubleClick(e, option.id, slot.id, 'product')}> <Card onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'product' )} className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative h-full flex flex-col justify-between", isSelectedInCurrentInstance && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )} title={isDisabled ? `Max (${slot.max_quantity})` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}> {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>} <span className="text-xs md:text-sm block leading-tight">{option.name} {currentSelectionDetails?.servingStyle && currentSelectionDetails.servingStyle !== 'Normal' && `(${currentSelectionDetails.servingStyle})`}</span> {displayPriceForModifier > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(displayPriceForModifier)}</span>} {displayPriceForModifier <= 0 && option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(0)}</span>} </Card> </div> </PopoverTrigger>
                                            <PopoverContent className="w-56 p-2"> <p className="text-xs font-medium mb-2 text-center">Estilo para {option.name}</p> {isLoading.servingStyles ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2"/> : ( <RadioGroup value={currentSelectionDetails?.servingStyle || "Normal"} onValueChange={(style) => handleSaveServingStyle(style)} className="space-y-1"> <div key="Normal" className="flex items-center space-x-2"><RadioGroupItem value="Normal" id={`${option.id}-Normal`} /><Label htmlFor={`${option.id}-Normal`} className="text-xs font-normal">Normal</Label></div> {servingStylePopoverState?.availableServingStyles?.map(style => ( <div key={style.id} className="flex items-center space-x-2"><RadioGroupItem value={style.label} id={`${option.id}-${style.id}`} /><Label htmlFor={`${option.id}-${style.id}`} className="text-xs font-normal">{style.label}</Label></div> ))} {servingStylePopoverState?.availableServingStyles?.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">No hay estilos.</p>} </RadioGroup> )} </PopoverContent>
                                        </Popover>
                                        ); })} </div> </div> ); })} </div> </ScrollArea>
            <div className="mt-auto pt-3 border-t flex-shrink-0 space-y-2"> {currentProductConfigQuantity > 1 && <Button variant="outline" onClick={handleApplyCurrentModifiersToAllInstances} className="w-full" disabled={isLoading.modifiers || isLoading.servingStyles}><Copy className="mr-2 h-4 w-4" /> Aplicar Modificadores a Todas las Instancias</Button>} <Button onClick={handleAddConfiguredProductInstancesToOrder} className="w-full" disabled={isLoading.modifiers || isLoading.servingStyles}> {isLoading.modifiers || isLoading.servingStyles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Añadir {currentProductConfigQuantity > 1 ? `${currentProductConfigQuantity}x ` : ''}"{selectedProduct.name}" al Pedido </Button> </div>
          </div>
        );

    case 'package-details':
        if (!selectedPackageDetail) return <p className="text-center text-muted-foreground py-10">Error: No hay paquete.</p>;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        let displayPackagePrice = packageDef.price * (1 + ((currentOrderType === 'platform' && globalPlatformPriceIncreasePercent > 0) ? globalPlatformPriceIncreasePercent : 0));
        return (
            <div className="flex flex-col h-full">
             <div className="flex-shrink-0"> <h2 className="text-lg md:text-xl font-semibold mb-1">{packageDef.name} - {formatCurrency(displayPackagePrice)}</h2> <p className="text-xs md:text-sm text-muted-foreground mb-2">Configura ({currentProductConfigQuantity > 1 ? `${currentProductConfigQuantity} paquetes` : '1 paquete'}). Doble clic en modificadores para estilos.</p> </div>
             <ScrollArea className="flex-grow mb-3"> <div className="space-y-4 md:space-y-6 pr-2"> {packageItems.map(item => ( <Card key={item.id} className="p-3 md:p-4"> <CardTitle className="text-md md:text-lg mb-2 md:mb-3">{item.product_name} <span className="text-sm md:text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle> <div className="space-y-3 md:space-y-4 pl-2 md:pl-4 border-l-2 border-muted ml-1"> {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No hay opciones.</p>} {(itemSlots[item.id] || []).map(slot => { const currentPackageItemInstanceConfig = slot.selectedOptions || []; return ( <div key={slot.id}> <h4 className="text-sm md:text-md font-medium mb-1 md:mb-2">{slot.label} <span className="text-xs md:text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4> {currentPackageItemInstanceConfig.length > 0 && <div className="mb-1 text-xs text-muted-foreground">Seleccionados: {currentPackageItemInstanceConfig.length} / {slot.max_quantity}</div>} {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>} <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3"> {slot.options.map(option => { const isSelected = currentPackageItemInstanceConfig.some(sel => sel.productId === option.id); const maxReached = currentPackageItemInstanceConfig.length >= slot.max_quantity; const isDisabled = !isSelected && maxReached; const currentSelection = currentPackageItemInstanceConfig.find(sel => sel.productId === option.id); let optionInventoryOk = true; let optionInvItemName = ''; if (option.inventory_item_id) { const invItem = inventoryMap.get(option.inventory_item_id); optionInvItemName = invItem?.name || 'Inventario'; optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0); } const isOutOfStock = !optionInventoryOk && !isSelected; let displayPriceModPkg = option.price + (currentSelection?.extraCost || 0); return (
                                                    <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id && servingStylePopoverState?.packageItemContextId === item.id && servingStylePopoverState.orderItemUniqueId === null} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}> <PopoverTrigger asChild> <div onDoubleClick={(e) => handleModifierDoubleClick(e, option.id, slot.id, 'package', item.id)}> <Card onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'package', item.id )} className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative h-full flex flex-col justify-between", isSelected && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )} title={isDisabled ? `Max (${slot.max_quantity})` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}> {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>} <span className="text-xs md:text-sm block leading-tight">{option.name} {currentSelection?.servingStyle && currentSelection.servingStyle !== 'Normal' && `(${currentSelection.servingStyle})`}</span> {displayPriceModPkg > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(displayPriceModPkg)}</span>} {displayPriceModPkg <= 0 && option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(0)}</span>} </Card> </div> </PopoverTrigger>
                                                        <PopoverContent className="w-56 p-2"> <p className="text-xs font-medium mb-2 text-center">Estilo para {option.name}</p> {isLoading.servingStyles ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-2"/> : ( <RadioGroup value={currentSelection?.servingStyle || "Normal"} onValueChange={(style) => handleSaveServingStyle(style)} className="space-y-1"> <div key="Normal" className="flex items-center space-x-2"><RadioGroupItem value="Normal" id={`${item.id}-${option.id}-Normal`} /><Label htmlFor={`${item.id}-${option.id}-Normal`} className="text-xs font-normal">Normal</Label></div> {servingStylePopoverState?.availableServingStyles?.map(style => ( <div key={style.id} className="flex items-center space-x-2"><RadioGroupItem value={style.label} id={`${item.id}-${option.id}-${style.id}`} /><Label htmlFor={`${item.id}-${option.id}-${style.id}`} className="text-xs font-normal">{style.label}</Label></div> ))} {servingStylePopoverState?.availableServingStyles?.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">No hay estilos.</p>} </RadioGroup> )} </PopoverContent>
                                                    </Popover> ); })} </div> </div> ); })} </div> </Card> ))} </div> </ScrollArea>
             <div className="mt-auto pt-3 border-t flex-shrink-0"> <Button onClick={handleAddPackageToOrder} className="w-full" disabled={isLoading.packageDetails || isLoading.inventory || isLoading.servingStyles}> {isLoading.packageDetails || isLoading.inventory || isLoading.servingStyles ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Añadir Paquete(s) al Pedido </Button> </div>
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
                 <div className="flex justify-between items-center"> <CardTitle className="text-lg md:text-xl"> {editingOrderId ? `Editando Pedido #${originalOrderForEdit?.orderNumber || editingOrderId.substring(0,8)}` : "Crear Pedido"} </CardTitle>
                    <div className="flex items-center gap-2"> {currentOrder.items.length > 0 && <Button variant="outline" size="sm" onClick={handlePauseOrder} title="Pausar pedido"><PauseCircle className="mr-1 md:mr-2 h-4 w-4" /> Pausar</Button>} <AlertDialog> <AlertDialogTrigger asChild> <Button variant="outline" size="sm" className="text-xs h-8 md:h-9" disabled={currentOrder.items.length === 0 && !editingOrderId}><RotateCcw className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" /> Limpiar</Button> </AlertDialogTrigger> <AlertDialogContent> <AlertDialogHeader><AlertDialogTitle>¿Limpiar pedido?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader> <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={clearOrder} className={cn(buttonVariants({ variant: "destructive" }))}>Limpiar</AlertDialogAction></AlertDialogFooter> </AlertDialogContent> </AlertDialog> </div>
                </div> {renderBackButton()}
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden p-3 md:p-4">
                {isViewLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : <div className="h-full">{renderContent()}</div>}
             </CardContent>
         </Card>
      </div>

      <div className="lg:col-span-1 h-full">
         <Card className="h-full flex flex-col shadow-md">
           <CardHeader className="pb-2 pt-3 md:pt-4 border-b">
               <div className="flex flex-row items-center justify-between space-y-0 "> <CardTitle className="text-base md:text-lg">Resumen Pedido</CardTitle> <CardDescription className="text-xs md:text-sm">{editingOrderId ? `Editando: #${originalOrderForEdit?.orderNumber}` : (currentOrder.id || 'Nuevo Pedido')}</CardDescription> </div>
                 <RadioGroup value={currentOrderType} onValueChange={(value) => setCurrentOrderType(value as OrderType)} className="flex gap-2 pt-2">
                    <div className="flex items-center space-x-1"><RadioGroupItem value="pickup" id="type-pickup" className="h-3.5 w-3.5"/><Label htmlFor="type-pickup" className="text-xs">Recoger <Store className="inline h-3 w-3 ml-0.5"/></Label></div>
                    <div className="flex items-center space-x-1"><RadioGroupItem value="delivery" id="type-delivery" className="h-3.5 w-3.5"/><Label htmlFor="type-delivery" className="text-xs">Delivery <Bike className="inline h-3 w-3 ml-0.5"/></Label></div>
                    <div className="flex items-center space-x-1"><RadioGroupItem value="platform" id="type-platform" className="h-3.5 w-3.5"/><Label htmlFor="type-platform" className="text-xs">Plataforma <Truck className="inline h-3 w-3 ml-0.5"/></Label></div>
                </RadioGroup>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden pt-3 md:pt-4 p-3 md:p-4">
             {/* Sección Cliente */}
            <div className="mb-3 md:mb-4">
                <Label htmlFor="customerPhoneInput" className="mb-1 block text-xs md:text-sm">Cliente (Teléfono)</Label>
                <div className="flex items-center gap-2">
                    <Input
                        id="customerPhoneInput"
                        type="tel"
                        value={customerPhoneInput}
                        onChange={handleCustomerPhoneChange}
                        placeholder="Buscar o añadir por teléfono..."
                        className="flex-grow h-9 text-sm"
                        disabled={!!selectedClient}
                    />
                    {selectedClient && (
                        <Button variant="outline" size="sm" onClick={handleClearSelectedClient} className="h-9 text-xs">Cambiar</Button>
                    )}
                </div>
                {isSearchingClients && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
                {searchResults.length > 0 && (
                    <ScrollArea className="mt-2 border rounded-md max-h-32">
                        {searchResults.map(client => (
                            <div key={client.id} onClick={() => handleSelectClient(client)} className="p-2 hover:bg-accent cursor-pointer text-sm">
                                {client.name} ({client.phone})
                            </div>
                        ))}
                    </ScrollArea>
                )}
                {searchResults.length === 0 && customerPhoneInput.length >= 3 && !isSearchingClients && !selectedClient && (
                    <p className="text-xs text-muted-foreground mt-1">No se encontraron clientes. Puedes registrar uno nuevo si es para entrega.</p>
                )}
                {selectedClient && <p className="text-sm font-medium mt-1">Seleccionado: {selectedClient.name}</p>}
                {currentOrderType === 'delivery' && showNewClientFieldsForDelivery && !selectedClient && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                        <Label htmlFor="newCustomerName" className="text-xs">Nombre Nuevo Cliente (Entrega)</Label>
                        <Input id="newCustomerName" value={newCustomerNameForDelivery} onChange={(e) => setNewCustomerNameForDelivery(e.target.value)} placeholder="Nombre del nuevo cliente" className="h-9 text-sm" />
                    </div>
                )}
            </div>

             {renderOrderTypeSpecificFields()}
             <Separator className="mb-3 md:mb-4" />
             <div className="flex-grow mb-3 md:mb-4 overflow-y-auto -mr-3 md:-mr-4 pr-3 md:pr-4" key={`order-summary-${currentOrder.items.length}`}>
                {currentOrder.items.length === 0 ? (<p className="text-muted-foreground text-center py-8 text-sm md:text-base">El pedido está vacío.</p>) : (
                 <div className="space-y-2 md:space-y-3"> {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-xs md:text-sm border-b pb-2 last:border-b-0">
                         <div className="flex justify-between items-start font-medium mb-0.5 md:mb-1"> <div className='flex items-center gap-1 md:gap-2'> {item.type === 'package' && <PackageIcon className="h-3 w-3 md:h-4 md:w-4 text-accent flex-shrink-0" title="Paquete"/>} <span className="flex-1 mr-1 md:mr-2">{item.name}</span> </div> <span>{formatCurrency(item.totalPrice)}</span> </div>
                          <div className="flex justify-between items-center text-xs"> <div className="flex items-center gap-0.5 md:gap-1 text-muted-foreground"> <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)}><MinusCircle className="h-3 w-3 md:h-4 md:w-4"/></Button> <span>{item.quantity}</span> <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-3 w-3 md:h-4 md:w-4"/></Button> </div> <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-3 w-3 md:h-4 md:w-4"/></Button> </div>
                         {item.applied_commission_rate !== undefined && item.original_platform_price !== undefined && ( <div className="text-xs text-orange-600 ml-2 md:ml-4 mt-0.5"> Precio Plataforma: {formatCurrency(item.original_platform_price * item.quantity)} ({formatCurrency(item.original_platform_price)} c/u) <br/> <span className="text-muted-foreground text-xs"> Base con mods: {formatCurrency(item.original_price_before_inflation ? item.original_price_before_inflation * item.quantity : 0)} | Aumento: {(item.applied_commission_rate * 100).toFixed(0)}% </span> </div> )}
                         {((item.selectedModifiers && item.selectedModifiers.length > 0) || (item.type === 'package' && item.packageItems && item.packageItems.some(pi => pi.selectedModifiers.length > 0))) && ( <div className="text-xs text-muted-foreground ml-2 md:ml-4 mt-1 space-y-0.5"> {item.type === 'product' && <span className='font-medium text-foreground'>Modificadores:</span>} {item.type === 'package' && <span className='font-medium text-foreground'>Detalles/Modificadores:</span>} <ul className='list-disc list-inside pl-1 md:pl-2'> {item.type === 'package' && item.packageItems ? ( item.packageItems.map(pkgItem => ( <li key={pkgItem.packageItemId}> {pkgItem.productName} {pkgItem.selectedModifiers.length > 0 && ( <ul className="list-[circle] list-inside pl-2 md:pl-4"> {pkgItem.selectedModifiers.map((mod, modIdx) => ( <li key={`${mod.productId}-${modIdx}`} className="flex justify-between items-center"> <span> {mod.name} {mod.servingStyle && mod.servingStyle !== 'Normal' && ` (${mod.servingStyle})`} {(mod.priceModifier || 0) + (mod.extraCost || 0) !== 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''} </span> <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/70" onClick={() => handleOpenExtraCostDialog(item.uniqueId, mod.productId, mod.slotId, pkgItem.packageItemId)}><DollarSign className="h-3 w-3"/></Button> </li> ))} </ul> )} </li> )) ) : ( (item.selectedModifiers || []).map((mod, idx) => ( <li key={`${mod.productId}-${idx}`} className="flex justify-between items-center"> <span> {mod.name} {mod.servingStyle && mod.servingStyle !== 'Normal' && ` (${mod.servingStyle})`} {(mod.priceModifier || 0) + (mod.extraCost || 0) !== 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''} </span> <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/70" onClick={() => handleOpenExtraCostDialog(item.uniqueId, mod.productId, mod.slotId)}><DollarSign className="h-3 w-3"/></Button> </li> )) )} </ul> </div> )}
                     </div> ))} </div> )}
             </div>
             <Separator className="my-2" />
             <div className="space-y-1 md:space-y-2 text-xs md:text-sm pt-1 md:pt-2">
               <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
               <div className="flex justify-between font-bold text-sm md:text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
               <RadioGroup value={currentOrder.paymentMethod} onValueChange={(value) => setCurrentOrder(prev => ({...prev, paymentMethod: value as 'cash' | 'card'}))} className="flex gap-4 mt-1 md:mt-2" aria-label="Método de Pago"> <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="pay-card" /><Label htmlFor="pay-card">Tarjeta</Label></div> <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="pay-cash" /><Label htmlFor="pay-cash">Efectivo</Label></div> </RadioGroup>
               {currentOrder.paymentMethod === 'cash' && ( <div className="mt-1 md:mt-2 space-y-1 md:space-y-2"> <div className='relative'> <Label htmlFor="paidAmount" className="mb-1 block text-xs">Pagado</Label> <span className="absolute left-2.5 top-5 md:top-6 text-muted-foreground text-xs md:text-sm">$</span> <Input id="paidAmount" type="number" step="0.01" min="0" value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} placeholder="0.00" className="pl-5 md:pl-6 h-9 text-sm" aria-label="Cantidad Pagada" /> </div> {currentOrder.paidAmount !== undefined && total !== undefined && currentOrder.paidAmount >= total && currentOrder.changeDue !== undefined && ( <div className="flex justify-between text-accent font-medium"><span>Cambio:</span><span>{formatCurrency(currentOrder.changeDue)}</span></div> )} {currentOrder.paidAmount !== undefined && total !== undefined && currentOrder.paidAmount < total && ( <p className="text-destructive text-xs">Faltante: {formatCurrency(total - currentOrder.paidAmount)}</p> )} </div> )}
             </div>
           </CardContent>
            <div className="p-3 md:p-4 border-t mt-auto bg-muted/30">
                 <Button className="w-full h-10 md:h-11 text-sm md:text-base" onClick={handleFinalizeOrder} disabled={currentOrder.items.length === 0 || isLoading.inventory || isLoading.printing || (isLoading.page && showNewClientFieldsForDelivery)}>
                    {isLoading.inventory || isLoading.printing || (isLoading.page && showNewClientFieldsForDelivery) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingOrderId ? <Edit className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />)}
                    {editingOrderId ? (isLoading.printing ? 'Actualizando...' : 'Actualizar Pedido') : (isLoading.printing ? 'Imprimiendo...' : 'Finalizar e Imprimir')}
                 </Button>
            </div>
         </Card>
       </div>

        <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader><DialogTitle>Cantidad para "{itemPendingQuantity?.data.name}"</DialogTitle><DialogDescription>Unidades a añadir.</DialogDescription></DialogHeader>
                <div className="py-4"><Label htmlFor="quantity_input" className="sr-only">Cantidad</Label><Input id="quantity_input" type="number" min="1" value={pendingQuantityInput} onChange={(e) => setPendingQuantityInput(e.target.value)} className="text-center text-lg h-12" autoFocus/></div>
                <DialogFooter className="gap-2 sm:justify-center"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button onClick={handleConfirmQuantity}>Aceptar</Button></DialogFooter>
            </DialogContent>
        </Dialog>

       <Dialog open={!!extraCostDialogState} onOpenChange={() => setExtraCostDialogState(null)}>
            <DialogContent>
                <DialogHeader><DialogTitle>Añadir Costo Extra</DialogTitle><DialogDescription>Costo adicional para "{extraCostDialogState?.modifierProductId && allProductsMap.get(extraCostDialogState.modifierProductId)?.name}".</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="extraCost" className="text-right">Costo Extra</Label><Input id="extraCost" type="number" step="0.01" min="0" value={extraCostInput} onChange={(e) => setExtraCostInput(e.target.value)} className="col-span-3" placeholder="0.00"/></div></div>
                <DialogFooter><Button variant="outline" onClick={() => setExtraCostDialogState(null)}>Cancelar</Button><Button onClick={handleSaveExtraCost}>Guardar Costo</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
