// src/app/dashboard/create-order/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon, RotateCcw, ShoppingBag, CookingPot, DollarSign } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
} from '@/types/product-types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"; // Para diálogo de costo extra
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Para estilos de servicio


// --- Definiciones ---
const PREDEFINED_SERVING_STYLES = ["Normal", "Aparte", "En Vasito", "Extra de esto"];

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
    selectedOptions: SelectedModifierItem[];
    override?: PackageItemModifierSlotOverride;
}

interface PackageDetailState {
    packageDef: Package;
    packageItems: PackageItem[];
    itemSlots: Record<string, ModifierSlotState[]>;
}

interface ModifierInteractionState {
    orderItemUniqueId: string | null; // Para identificar a qué OrderItem pertenece el modificador
    modifierProductId: string | null;
    modifierSlotId: string | null; // Para saber a qué slot pertenece (para recalcular precio si es necesario)
    packageItemContextId?: string | null; // Si el modificador es de un item dentro de un paquete
    anchorElement: HTMLElement | null; // Para anclar el Popover
}

// --- Componente ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null);
  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>({
    id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [packagesData, setPackagesData] = useState<Package[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map());

  // Estados para interacciones avanzadas con modificadores
  const [servingStylePopoverState, setServingStylePopoverState] = useState<ModifierInteractionState | null>(null);
  const [extraCostDialogState, setExtraCostDialogState] = useState<ModifierInteractionState & { currentExtraCost?: number } | null>(null);
  const [extraCostInput, setExtraCostInput] = useState<string>('');


  const [isLoading, setIsLoading] = useState({
        categories: true,
        products: false,
        packages: false,
        modifiers: false,
        packageDetails: false,
        inventory: false,
        printing: false,
    });


  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(prev => ({ ...prev, categories: true, inventory: true }));
      try {
        const [fetchedCategories, fetchedInventory] = await Promise.all([
            getCategories(),
            getInventoryItems()
        ]);
        setCategoriesData(fetchedCategories);

        const invMap = new Map<string, InventoryItem>();
        fetchedInventory.forEach(item => invMap.set(item.id, item));
        setInventoryMap(invMap);

      } catch (error) {
        toast({ title: "Error al Cargar Datos", description: "Fallo al cargar categorías o inventario.", variant: "destructive" });
      } finally {
        setIsLoading(prev => ({ ...prev, categories: false, inventory: false }));
      }
    }
    fetchInitialData();
  }, [toast]);

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
                 // Si allowedOptions existe y tiene items, usa esos IDs para obtener detalles de producto
                 if (slotDef.allowedOptions && slotDef.allowedOptions.length > 0) {
                     const optionDetailsPromises = slotDef.allowedOptions.map(opt => getProductById(opt.modifier_product_id));
                     options = (await Promise.all(optionDetailsPromises)).filter(p => p !== null) as Product[];
                 } else {
                     // Si no hay allowedOptions, obtener todos los modificadores de la categoría vinculada
                     options = await getModifiersByCategory(slotDef.linked_category_id);
                 }
                 // Aquí, slotDef.allowedOptions (si existe) ya tiene price_adjustment y is_default de la BD
                 // Necesitamos mapear esto a las 'options' que son Product[] para la UI
                 const finalOptions = options.map(optProduct => {
                    const slotOptionConfig = slotDef.allowedOptions?.find(ao => ao.modifier_product_id === optProduct.id);
                    return {
                        ...optProduct,
                        // El precio base del producto modificador ya está en optProduct.price
                        // Si hay un price_adjustment en la configuración del slot, se sumará al seleccionar
                        // is_default también vendría de slotOptionConfig si se usara para preselección
                    };
                 });

                 return { ...slotDef, options: finalOptions, selectedOptions: [] };
             });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: `Fallo al cargar modificadores para producto ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]);

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
                    return override ? {
                        ...slot,
                        override: override,
                        min_quantity: override.min_quantity,
                        max_quantity: override.max_quantity
                     } : slot;
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
    setSelectedProduct(product);
     if (product.inventory_item_id) {
       const invItem = inventoryMap.get(product.inventory_item_id);
       const consumed = product.inventory_consumed_per_unit ?? 0;
       if (!invItem || invItem.current_stock < consumed) {
            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${product.name}.`, variant: "destructive" });
            setSelectedProduct(null);
            return;
       }
     }
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setCurrentModifierSlots(slots);
        setView('modifiers');
    } else {
        addProductToOrder(product, [], product.price);
        toast({ title: `${product.name} añadido`, description: 'Sin modificadores' });
        setView('categories');
        resetProductSelection();
        setSelectedCategory(null);
        setProductsData([]);
        setPackagesData([]);
    }
  };

  const handlePackageClick = async (pkg: Package) => {
    setSelectedPackage(pkg);
    await fetchPackageDetails(pkg.id);
  };

  // --- MODIFIER INTERACTION HANDLERS ---
  const handleModifierOptionClick = (
    slotId: string,
    optionProductId: string,
    optionName: string,
    optionBasePrice: number, // Precio base del producto modificador
    context: 'product' | 'package',
    packageItemId?: string
) => {
    const updateSlotsLogic = (prevSlots: ModifierSlotState[]): ModifierSlotState[] => {
        return prevSlots.map(slot => {
            if (slot.id === slotId) {
                const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                let newSelections = [...slot.selectedOptions];
                const minQty = slot.min_quantity;
                const maxQty = slot.max_quantity;

                const modifierProductDefinition = slot.options.find(opt => opt.id === optionProductId);
                if (!modifierProductDefinition) return slot; // Should not happen

                // Considerar price_adjustment del slot si existe
                const slotOptionConfig = slot.allowedOptions?.find(ao => ao.modifier_product_id === optionProductId);
                const priceAdjustment = slotOptionConfig?.price_adjustment || 0;
                const effectiveModifierPrice = optionBasePrice + priceAdjustment; // Precio a usar para este modificador en este slot

                if (modifierProductDefinition.inventory_item_id) {
                     const invItem = inventoryMap.get(modifierProductDefinition.inventory_item_id);
                     const consumed = modifierProductDefinition.inventory_consumed_per_unit ?? 0;
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
                            priceModifier: effectiveModifierPrice, // Usar precio efectivo
                            slotId: slotId,
                            // servingStyle y extraCost se añadirán por otras interacciones
                        });
                    } else {
                        toast({ title: "Límite Alcanzado", description: `No se puede seleccionar más de ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                        return slot;
                    }
                }
                return { ...slot, selectedOptions: newSelections };
            }
            return slot;
        });
    };

    if (context === 'product') {
        setCurrentModifierSlots(updateSlotsLogic);
    } else if (context === 'package' && packageItemId && selectedPackageDetail) {
        setSelectedPackageDetail(prevDetail => {
            if (!prevDetail) return null;
             const updatedItemSlots = { ...prevDetail.itemSlots };
             if(updatedItemSlots[packageItemId]) {
                updatedItemSlots[packageItemId] = updateSlotsLogic(updatedItemSlots[packageItemId]);
             }
             return { ...prevDetail, itemSlots: updatedItemSlots };
        });
    }
};

// Para abrir popover de estilos de servicio
const handleModifierDoubleClick = (
    event: React.MouseEvent<HTMLDivElement>,
    orderItemUniqueId: string | undefined, // ID del OrderItem si el modificador ya está en el pedido
    productId: string,
    slotId: string,
    context: 'product' | 'package',
    packageItemContextId?: string
) => {
    event.preventDefault(); // Prevenir que se dispare el single click
    // Si el modificador aún no está en el pedido (estamos en la pantalla de selección de modificadores)
    // necesitamos una forma de identificar a qué OrderItem se añadirá.
    // Por ahora, asumimos que si orderItemUniqueId no está, el popover afectará la próxima adición.
    // Esto es complejo. Simplifiquemos: el popover SÓLO funciona para modificadores YA en el pedido.
    // Para modificadores que se están seleccionando (antes de añadir al pedido), no habrá popover de estilo.
    // El usuario los añade y LUEGO puede doble-clickear en el RESUMEN DEL PEDIDO para cambiar estilo.
    // --> ESTO ES UN CAMBIO DE PLAN: Interacciones avanzadas sólo en el resumen del pedido.
    // Por lo tanto, esta función NO se llamará desde las tarjetas de selección de modificadores.

    // --> REVERTIR PLAN: Mantener popover en tarjetas de selección.
    // Encontrar el orderItem relevante o el slot de selección actual.
    let targetOrderItem: OrderItem | undefined;
    if (orderItemUniqueId) {
        targetOrderItem = currentOrder.items.find(item => item.uniqueId === orderItemUniqueId);
    }

    // Necesitamos saber si este modificador está actualmente seleccionado en el panel de selección o en el pedido
    let isSelectedCurrently = false;
    let currentServingStyle: string | undefined;

    if (context === 'product' && selectedProduct) { // Modificador de producto regular, en selección
        const targetSlot = currentModifierSlots.find(s => s.id === slotId);
        const selectedOpt = targetSlot?.selectedOptions.find(so => so.productId === productId);
        isSelectedCurrently = !!selectedOpt;
        currentServingStyle = selectedOpt?.servingStyle;
    } else if (context === 'package' && selectedPackageDetail && packageItemContextId) { // Modificador de item de paquete, en selección
        const targetItemSlots = selectedPackageDetail.itemSlots[packageItemContextId];
        const targetSlot = targetItemSlots?.find(s => s.id === slotId);
        const selectedOpt = targetSlot?.selectedOptions.find(so => so.productId === productId);
        isSelectedCurrently = !!selectedOpt;
        currentServingStyle = selectedOpt?.servingStyle;
    } else if (targetOrderItem) { // Modificador ya en el pedido
        // Lógica para encontrar el SelectedModifierItem en targetOrderItem...
        // Esto se manejará en el resumen del pedido, no aquí.
        return;
    }

    if (!isSelectedCurrently) {
        toast({title: "Opción no seleccionada", description: "Selecciona el modificador primero con un clic.", variant:"default"});
        return;
    }

    setServingStylePopoverState({
        orderItemUniqueId: orderItemUniqueId || null, // Si es null, se aplica al item en `currentModifierSlots` o `selectedPackageDetail`
        modifierProductId: productId,
        modifierSlotId: slotId,
        packageItemContextId: packageItemContextId,
        anchorElement: event.currentTarget,
    });
};


// Guardar estilo de servicio seleccionado desde el popover
const handleSaveServingStyle = (style: string) => {
    if (!servingStylePopoverState) return;
    const { orderItemUniqueId, modifierProductId, modifierSlotId, packageItemContextId } = servingStylePopoverState;

    // Actualizar en el pedido actual si orderItemUniqueId está presente
    if (orderItemUniqueId) {
        // Lógica para actualizar currentOrder.items[...].selectedModifiers[...]
        // O currentOrder.items[...].packageItems[...].selectedModifiers[...]
        // Esta parte es compleja y la dejaremos para el resumen del pedido
    } else { // Actualizar en el estado de selección (currentModifierSlots o selectedPackageDetail)
        if (selectedProduct && !packageItemContextId) { // Modificador de producto regular
            setCurrentModifierSlots(prevSlots => prevSlots.map(slot => {
                if (slot.id === modifierSlotId) {
                    return {
                        ...slot,
                        selectedOptions: slot.selectedOptions.map(opt =>
                            opt.productId === modifierProductId ? { ...opt, servingStyle: style } : opt
                        )
                    };
                }
                return slot;
            }));
        } else if (selectedPackageDetail && packageItemContextId) { // Modificador de item de paquete
            setSelectedPackageDetail(prevDetail => {
                if (!prevDetail) return null;
                const updatedItemSlots = { ...prevDetail.itemSlots };
                if (updatedItemSlots[packageItemContextId]) {
                    updatedItemSlots[packageItemContextId] = updatedItemSlots[packageItemContextId].map(slot => {
                         if (slot.id === modifierSlotId) {
                            return {
                                ...slot,
                                selectedOptions: slot.selectedOptions.map(opt =>
                                    opt.productId === modifierProductId ? { ...opt, servingStyle: style } : opt
                                )
                            };
                        }
                        return slot;
                    });
                }
                return { ...prevDetail, itemSlots: updatedItemSlots };
            });
        }
    }
    setServingStylePopoverState(null); // Cerrar popover
    toast({title: "Estilo Guardado", description: `Modificador servido: ${style}`});
};

// Abrir diálogo de costo extra (llamado desde el resumen del pedido)
const handleOpenExtraCostDialog = (
    orderItemUniqueId: string,
    modifierProductId: string,
    modifierSlotId: string,
    packageItemContextId?: string
) => {
    // Encontrar el SelectedModifierItem en currentOrder para obtener el extraCost actual
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
        anchorElement: null, // No necesita ancla para diálogo
        currentExtraCost: targetModifier?.extraCost || 0,
    });
    setExtraCostInput(String(targetModifier?.extraCost || 0));
};


// Guardar costo extra
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
                // Recalcular precio total del item
                let newItemTotalPrice = item.basePrice;
                const allMods = packageItemContextId && updatedPackageItems
                    ? updatedPackageItems.flatMap(pi => pi.selectedModifiers)
                    : updatedSelectedModifiers;

                allMods.forEach(mod => {
                    newItemTotalPrice += (mod.priceModifier || 0) + (mod.extraCost || 0);
                });
                newItemTotalPrice *= item.quantity;


                return { ...item, selectedModifiers: updatedSelectedModifiers, packageItems: updatedPackageItems, totalPrice: newItemTotalPrice };
            }
            return item;
        })
    }));

    setExtraCostDialogState(null);
    toast({ title: "Costo Extra Guardado" });
};


  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;
    for (const slot of currentModifierSlots) {
        const minQty = slot.min_quantity;
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selección Incompleta", description: `Debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
            return;
        }
    }
    const chosenModifiers = currentModifierSlots.flatMap(slot => slot.selectedOptions);
    let modifierPriceTotal = 0;
    chosenModifiers.forEach(mod => {
        modifierPriceTotal += (mod.priceModifier || 0) + (mod.extraCost || 0); // Incluir extraCost
    });
    const pricePerUnit = selectedProduct.price + modifierPriceTotal;

    addProductToOrder(selectedProduct, chosenModifiers, pricePerUnit);
    toast({
        title: `${selectedProduct.name} añadido`,
        description: chosenModifiers.length > 0 ? `Modificadores: ${chosenModifiers.map(m => `${m.name}${m.servingStyle ? ` (${m.servingStyle})` : ''}`).join(', ')}` : 'Sin modificadores',
    });
    setView('categories');
    resetProductSelection();
    setSelectedCategory(null);
    setProductsData([]);
    setPackagesData([]);
  };

   const handleAddPackageToOrder = async () => {
        if (!selectedPackageDetail) return;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        let inventoryOk = true;
        const tempInventoryChanges: Record<string, number> = {};

        const allProductIdsInPackage = new Set<string>();
        packageItems.forEach(item => allProductIdsInPackage.add(item.product_id));
        Object.values(itemSlots).flat().forEach(slot => {
            slot.options.forEach(opt => allProductIdsInPackage.add(opt.id));
            slot.selectedOptions.forEach(sel => allProductIdsInPackage.add(sel.productId));
        });

        const productDetailsMap = new Map<string, Product>();
        const productFetchPromises = Array.from(allProductIdsInPackage).map(id =>
            getProductById(id).catch(err => {
                console.error(`Error obteniendo detalles para ID de producto ${id} en paquete:`, err);
                toast({ title: "Error Interno", description: `No se pudo obtener detalle del producto ID ${id}.`, variant: "destructive" });
                return null;
            })
        );
        const fetchedProducts = await Promise.all(productFetchPromises);
        fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });

        for (const item of packageItems) {
            const productDetails = productDetailsMap.get(item.product_id);
            if (!productDetails) {
                toast({ title: "Error", description: `Definición de producto para ${item.product_name} no encontrada.`, variant: "destructive" });
                inventoryOk = false; break;
            }
            if (productDetails.inventory_item_id) {
                const invItem = inventoryMap.get(productDetails.inventory_item_id);
                const consumed = (productDetails.inventory_consumed_per_unit ?? 0) * item.quantity;
                const currentStock = invItem?.current_stock ?? 0;
                const alreadyConsumed = tempInventoryChanges[productDetails.inventory_item_id] || 0;
                if (currentStock + alreadyConsumed < consumed) {
                    toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${item.product_name} en paquete.`, variant: "destructive" });
                    inventoryOk = false; break;
                } else if (consumed > 0) {
                    tempInventoryChanges[productDetails.inventory_item_id] = alreadyConsumed - consumed;
                }
            }
            const slots = itemSlots[item.id] || [];
            for (const slot of slots) {
                const minQty = slot.min_quantity;
                if (slot.selectedOptions.length < minQty) {
                     toast({ title: "Selección Incompleta", description: `Para "${item.product_name}", debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
                    inventoryOk = false; break;
                }
                 for (const modOption of slot.selectedOptions) {
                     const modProductDetails = productDetailsMap.get(modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * item.quantity;
                         const currentStock = invItem?.current_stock ?? 0;
                         const alreadyConsumed = tempInventoryChanges[modProductDetails.inventory_item_id] || 0;
                        if (currentStock + alreadyConsumed < consumed) {
                            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para modificador ${modOption.name}.`, variant: "destructive" });
                            inventoryOk = false; break;
                         } else if (consumed > 0) {
                            tempInventoryChanges[modProductDetails.inventory_item_id] = alreadyConsumed - consumed;
                        }
                     }
                 }
                 if (!inventoryOk) break;
            }
             if (!inventoryOk) break;
        }

        if (!inventoryOk) return;

        const allSelectedModifiersNested = packageItems.map(item => {
            const slots = itemSlots[item.id] || [];
            return slots.flatMap(slot => slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id})));
         }).flat();

        const packagePrice = packageDef.price;
        const newOrderItem: OrderItem = {
            type: 'package', id: packageDef.id, name: packageDef.name, quantity: 1,
            basePrice: packagePrice, selectedModifiers: allSelectedModifiersNested,
            totalPrice: packagePrice, uniqueId: Date.now().toString() + Math.random().toString(),
             packageItems: packageItems.map(item => ({
                 packageItemId: item.id, productId: item.product_id,
                 productName: item.product_name || 'Producto Desconocido',
                 selectedModifiers: (itemSlots[item.id] || []).flatMap(slot => slot.selectedOptions)
            }))
        };
        setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
        toast({ title: `Paquete "${packageDef.name}" añadido` });
        setView('categories');
        resetPackageSelection();
        setSelectedCategory(null);
        setProductsData([]);
        setPackagesData([]);
   };

  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[], pricePerUnit: number) => {
    const newOrderItem: OrderItem = {
      type: 'product', id: product.id, name: product.name, quantity: 1,
      basePrice: product.price, selectedModifiers: modifiers,
      totalPrice: pricePerUnit, uniqueId: Date.now().toString() + Math.random().toString(),
    };
    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
  };

  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal }));
  }, [currentOrder.items]);

  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta);
           let pricePerUnit = 0;
           if (item.type === 'product') {
                let modifierPriceTotal = 0;
                item.selectedModifiers.forEach(mod => {
                    modifierPriceTotal += (mod.priceModifier || 0) + (mod.extraCost || 0);
                });
                pricePerUnit = item.basePrice + modifierPriceTotal;
           } else {
              pricePerUnit = item.basePrice; // El precio de los paquetes es fijo, los modificadores internos no alteran su precio de venta.
           }
          console.warn("Verificación de inventario al aumentar cantidad está simplificada.");
          return { ...item, quantity: newQuantity, totalPrice: pricePerUnit * newQuantity };
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
    setCurrentOrder({ id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card' });
    setCustomerName(''); setIsRegisteringCustomer(false); setPaidAmountInput('');
    toast({ title: "Pedido Limpiado", variant: "destructive" });
  };

  const resetProductSelection = () => {
    setSelectedProduct(null); setCurrentModifierSlots([]);
  }
  const resetPackageSelection = () => {
    setSelectedPackage(null); setSelectedPackageDetail(null);
  }

  const handleBack = () => {
    if (view === 'modifiers') { resetProductSelection(); setView('products'); }
    else if (view === 'package-details') { resetPackageSelection(); setView('products'); }
    else if (view === 'products') { setView('categories'); setSelectedCategory(null); setProductsData([]); setPackagesData([]); }
  };

  useEffect(() => {
    if (currentOrder.paymentMethod === 'cash') {
      const paid = parseFloat(paidAmountInput) || 0;
      const change = paid - currentOrder.total;
      setCurrentOrder(prev => ({ ...prev, paidAmount: paid, changeDue: change >= 0 ? change : undefined }));
    } else {
      setCurrentOrder(prev => ({ ...prev, paidAmount: undefined, changeDue: undefined }));
      setPaidAmountInput('');
    }
  }, [paidAmountInput, currentOrder.total, currentOrder.paymentMethod]);

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
    if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < currentOrder.total)) {
       toast({ title: "Pago Incompleto", description: "La cantidad pagada en efectivo es menor que el total.", variant: 'destructive' }); return;
    }

     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try {
         existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({
             ...order, createdAt: new Date(order.createdAt),
             items: order.items?.map((item: any) => ({
                id: item.id || 'unknown', name: item.name || 'Unknown Item',
                quantity: typeof item.quantity === 'number' ? item.quantity : 0,
                price: typeof item.price === 'number' ? item.price : 0,
                totalItemPrice: typeof item.totalItemPrice === 'number' ? item.totalItemPrice : 0,
                components: Array.isArray(item.components) ? item.components : [],
             })) || [],
             subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
             total: typeof order.total === 'number' ? order.total : 0,
             status: ['pending', 'completed', 'cancelled'].includes(order.status) ? order.status : 'pending',
             paymentMethod: ['cash', 'card'].includes(order.paymentMethod) ? order.paymentMethod : 'card',
         }));
     } catch (e) { console.error("Error parseando pedidos existentes", e); }

     const newOrderId = generateOrderId(existingOrders.length);
     const newOrderNumber = existingOrders.length + 1;

     setIsLoading(prev => ({ ...prev, inventory: true }));
     const inventoryAdjustments: Record<string, { change: number, name: string }> = {};
     let inventoryAdjustmentFailed = false;

     try {
          const allProductIds = new Set<string>();
          currentOrder.items.forEach(item => {
             if (item.type === 'product') {
                allProductIds.add(item.id);
                item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             } else if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                     allProductIds.add(pkgItem.productId);
                     pkgItem.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
                 });
                  item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             }
         });
         const productDetailsMap = new Map<string, Product>();
         const productFetchPromises = Array.from(allProductIds).map(id => getProductById(id));
         const fetchedProducts = await Promise.all(productFetchPromises);
         fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });

         for (const orderItem of currentOrder.items) {
             if (orderItem.type === 'product') {
                 const itemDetails = productDetailsMap.get(orderItem.id); if (!itemDetails) continue;
                 if (itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                     const invItemId = itemDetails.inventory_item_id;
                     const change = -(itemDetails.inventory_consumed_per_unit * orderItem.quantity);
                     const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                     inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                 }
                 for (const modifier of orderItem.selectedModifiers) {
                     const modDetails = productDetailsMap.get(modifier.productId);
                     if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                         const invItemId = modDetails.inventory_item_id;
                         const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity);
                         const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                         inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }
                 }
             }
             else if (orderItem.type === 'package' && orderItem.packageItems) {
                 for (const pkgItem of orderItem.packageItems) {
                     const pkgItemDetails = productDetailsMap.get(pkgItem.productId); if (!pkgItemDetails) continue;
                     if (pkgItemDetails.inventory_item_id && pkgItemDetails.inventory_consumed_per_unit) {
                          const invItemId = pkgItemDetails.inventory_item_id;
                           const packageItemDef = selectedPackageDetail?.packageItems.find(pi => pi.id === pkgItem.packageItemId);
                           const itemQtyInPackage = packageItemDef?.quantity || 1;
                           const change = -(pkgItemDetails.inventory_consumed_per_unit * itemQtyInPackage * orderItem.quantity);
                          const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                          inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }
                      for (const modifier of pkgItem.selectedModifiers) {
                         const modDetails = productDetailsMap.get(modifier.productId);
                         if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                             const invItemId = modDetails.inventory_item_id;
                              const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity);
                             const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                             inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                         }
                     }
                 }
             }
         }
         const adjustmentPromises: Promise<void>[] = [];
         for (const [itemId, { change }] of Object.entries(inventoryAdjustments)) {
             if (change !== 0) {
                 adjustmentPromises.push(adjustInventoryStock(itemId, change));
             }
         }
         await Promise.all(adjustmentPromises);
          setInventoryMap(prevMap => {
              const newMap = new Map(prevMap);
              for (const [itemId, { change }] of Object.entries(inventoryAdjustments)) {
                  const currentItem = newMap.get(itemId);
                  if (currentItem) {
                      newMap.set(itemId, { ...currentItem, current_stock: currentItem.current_stock + change });
                  }
              }
              return newMap;
          });
     } catch (error) {
          toast({ title: "Error Inventario", description: `Fallo al actualizar inventario: ${error instanceof Error ? error.message : 'Error desconocido'}. Pedido no guardado.`, variant: "destructive" });
          inventoryAdjustmentFailed = true;
     } finally {
          setIsLoading(prev => ({ ...prev, inventory: false }));
     }
     if (inventoryAdjustmentFailed) return;

     const finalizedOrder: SavedOrder = {
      id: newOrderId, orderNumber: newOrderNumber, customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => {
          let components: { name: string; slotLabel?: string, servingStyle?: string, extraCost?: number }[] = [];
           if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                    components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido' });
                    if (pkgItem.selectedModifiers.length > 0) {
                         pkgItem.selectedModifiers.forEach(mod => {
                             let slotLabel = 'Mod';
                             const slotsSource = selectedPackageDetail?.itemSlots[pkgItem.packageItemId] ?? currentModifierSlots;
                             const slot = slotsSource.find(s => s.id === mod.slotId);
                             slotLabel = slot?.label || `Mod (${pkgItem.productName})`;
                             components.push({ name: `↳ ${mod.name}`, slotLabel: slotLabel, servingStyle: mod.servingStyle, extraCost: mod.extraCost });
                         });
                    }
                });
           }
           else if (item.type === 'product' && item.selectedModifiers.length > 0) {
                 item.selectedModifiers.forEach(mod => {
                     let slotLabelFound = 'Mod';
                     const slotDefinition = currentModifierSlots.find(s => s.id === mod.slotId);
                     if(slotDefinition) slotLabelFound = slotDefinition.label;
                     components.push({ name: mod.name, slotLabel: slotLabelFound, servingStyle: mod.servingStyle, extraCost: mod.extraCost });
                 });
           }
          return {
              id: item.id, name: item.name, quantity: item.quantity,
              price: item.basePrice, totalItemPrice: item.totalPrice, components: components,
          };
      }),
      paymentMethod: currentOrder.paymentMethod, subtotal: currentOrder.subtotal, total: currentOrder.total,
      status: 'pending', createdAt: new Date(),
      paidAmount: currentOrder.paidAmount, changeGiven: currentOrder.changeDue,
    };

    const updatedOrders = [...existingOrders, finalizedOrder];
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    const printReceiptsEnabled = localStorage.getItem('siChefSettings_printReceipts') === 'true';
    if (printReceiptsEnabled) {
        const receiptHtml = await generateTicketData(finalizedOrder);
        await handleActualPrint(receiptHtml);
    } else {
         toast({ title: "Impresión Omitida", description: "La impresión de recibos está desactivada en la configuración." });
    }

    setCurrentOrder({ id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card' });
    setCustomerName(''); setIsRegisteringCustomer(false); setPaidAmountInput('');
    setView('categories'); setSelectedCategory(null); setSelectedProduct(null); setCurrentModifierSlots([]);
    setSelectedPackage(null); setSelectedPackageDetail(null); setProductsData([]); setPackagesData([]);
    toast({ title: "Pedido Finalizado", description: `${finalizedOrder.id} creado y guardado.` });
  };

  // --- Lógica de Renderizado ---
  const renderContent = () => {
    switch (view) {
      case 'categories':
         if (isLoading.categories) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        const displayCategories = categoriesData.filter(cat => cat.type !== 'modificador');
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayCategories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-32 bg-secondary">
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div>
                  )}
                  {cat.type === 'paquete' && <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent">Paquete</Badge>}
                 </div>
                 <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm md:text-base">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
             {displayCategories.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">No hay categorías disponibles.</p>}
          </div>
        );

      case 'products':
        if (isLoading.products || isLoading.packages) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Categorías
            </Button>
            <h2 className="text-xl font-semibold mb-4">{selectedCategory?.name}</h2>
             {packagesData.length > 0 && (
                 <>
                    <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Paquetes Disponibles</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packagesData.map(pkg => (
                        <Card key={pkg.id} onClick={() => handlePackageClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                            <div className="relative w-full h-32 bg-secondary">
                                {pkg.imageUrl ? (
                                    <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal" />
                                ) : ( <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><PackageIcon className="h-8 w-8"/></div> )}
                                <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent">Paquete</Badge>
                            </div>
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm md:text-base">{pkg.name}</CardTitle>
                                <CardDescription className="text-xs md:text-sm">{formatCurrency(pkg.price)}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                    </div>
                 </>
             )}
             {productsData.length > 0 && (
                 <>
                     <h3 className="text-lg font-medium mb-3 border-b pb-1">Productos Individuales</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {productsData.map(prod => (
                        <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                            <div className="relative w-full h-32 bg-secondary">
                              {prod.imageUrl ? (
                                <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food" />
                               ) : ( <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8"/></div> )}
                             </div>
                          <CardHeader className="p-3">
                            <CardTitle className="text-sm md:text-base">{prod.name}</CardTitle>
                            <CardDescription className="text-xs md:text-sm">{formatCurrency(prod.price)}</CardDescription>
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
         if (isLoading.modifiers) {
             return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
         }
         if (!selectedProduct) return <p className="text-center text-muted-foreground py-10">Error: No hay producto seleccionado.</p>;
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory?.name || 'Items'}
            </Button>
             <h2 className="text-xl font-semibold mb-2">{selectedProduct.name} - {formatCurrency(selectedProduct.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Selecciona modificadores. Doble clic para estilos de servicio.</p>

             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4">No hay modificadores disponibles.</p>}
             <div className="space-y-6">
                {currentModifierSlots.map(slot => (
                    <div key={slot.id}>
                        <h3 className="text-lg font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                         {slot.selectedOptions.length > 0 && (
                             <div className="mb-2 text-xs text-muted-foreground">Seleccionados: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                         )}
                         {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {slot.options.map(option => {
                                const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                const maxReached = slot.selectedOptions.length >= slot.max_quantity;
                                const isDisabled = !isSelected && maxReached;
                                const currentSelection = slot.selectedOptions.find(sel => sel.productId === option.id);
                                let optionInventoryOk = true; let optionInvItemName = '';
                                if (option.inventory_item_id) {
                                    const invItem = inventoryMap.get(option.inventory_item_id);
                                    optionInvItemName = invItem?.name || 'Item Inventario';
                                    optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                }
                                const isOutOfStock = !optionInventoryOk;

                                return (
                                  <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}>
                                    <PopoverTrigger asChild>
                                      {/* Envolver Card con un div para asegurar un solo hijo para PopoverTrigger asChild */}
                                      <div
                                        onDoubleClick={(e) => handleModifierDoubleClick(e, undefined, option.id, slot.id, 'product')}
                                      >
                                        <Card
                                            onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'product' )}
                                            className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative", isSelected && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )}
                                            title={isDisabled ? `Max (${slot.max_quantity}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                        >
                                            {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                            <span className="text-xs md:text-sm block">{option.name} {currentSelection?.servingStyle && `(${currentSelection.servingStyle})`}</span>
                                            {option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(option.price + (currentSelection?.extraCost || 0) )}</span>}
                                        </Card>
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2">
                                        <p className="text-xs font-medium mb-2 text-center">Estilo de Servicio para {option.name}</p>
                                        <RadioGroup
                                            defaultValue={currentSelection?.servingStyle || "Normal"}
                                            onValueChange={(style) => handleSaveServingStyle(style)}
                                            className="space-y-1"
                                        >
                                            {PREDEFINED_SERVING_STYLES.map(style => (
                                                <div key={style} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={style} id={`${option.id}-${style}`} />
                                                    <Label htmlFor={`${option.id}-${style}`} className="text-xs font-normal">{style}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </PopoverContent>
                                  </Popover>
                                );
                            })}
                        </div>
                    </div>
                ))}
             </div>
            <Button onClick={handleAddProductWithModifiers} className="w-full mt-6" disabled={isLoading.modifiers}>
               {isLoading.modifiers ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
               Añadir al Pedido
            </Button>
          </>
        );

    case 'package-details':
        if (isLoading.packageDetails) {
           return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        if (!selectedPackageDetail) return <p className="text-center text-muted-foreground py-10">Error: No hay paquete seleccionado.</p>;
        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;
        return (
            <>
             <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
                <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory?.name || 'Items'}
             </Button>
             <h2 className="text-xl font-semibold mb-1">{packageDef.name} - {formatCurrency(packageDef.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Configura opciones para este paquete. Doble clic en modificadores para estilos.</p>
             <div className="space-y-6">
                 {packageItems.map(item => (
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No hay opciones configurables.</p>}
                            {(itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && ( <div className="mb-2 text-xs text-muted-foreground">Seleccionados: {slot.selectedOptions.length} / {slot.max_quantity}</div> )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones para "{slot.label}".</p>}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {slot.options.map(option => {
                                            const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                            const maxQty = slot.max_quantity;
                                            const maxReached = slot.selectedOptions.length >= maxQty;
                                            const isDisabled = !isSelected && maxReached;
                                            const currentSelection = slot.selectedOptions.find(sel => sel.productId === option.id);
                                            let optionInventoryOk = true; let optionInvItemName = '';
                                            if (option.inventory_item_id) {
                                                const invItem = inventoryMap.get(option.inventory_item_id);
                                                optionInvItemName = invItem?.name || 'Item Inventario';
                                                optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                            }
                                            const isOutOfStock = !optionInventoryOk;
                                            return (
                                              <Popover key={option.id} open={servingStylePopoverState?.modifierProductId === option.id && servingStylePopoverState?.modifierSlotId === slot.id && servingStylePopoverState?.packageItemContextId === item.id} onOpenChange={(open) => { if (!open) setServingStylePopoverState(null); }}>
                                                <PopoverTrigger asChild>
                                                  <div
                                                    onDoubleClick={(e) => handleModifierDoubleClick(e, undefined, option.id, slot.id, 'package', item.id)}
                                                  >
                                                    <Card
                                                        onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionClick( slot.id, option.id, option.name, option.price, 'package', item.id )}
                                                        className={cn( "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative", isSelected && "border-accent ring-2 ring-accent ring-offset-1", (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50" )}
                                                        title={isDisabled ? `Max (${maxQty}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                                    >
                                                        {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                                        <span className="text-xs md:text-sm block">{option.name} {currentSelection?.servingStyle && `(${currentSelection.servingStyle})`}</span>
                                                        {option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(option.price + (currentSelection?.extraCost || 0))}</span>}
                                                    </Card>
                                                  </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-56 p-2">
                                                   <p className="text-xs font-medium mb-2 text-center">Estilo de Servicio para {option.name}</p>
                                                    <RadioGroup defaultValue={currentSelection?.servingStyle || "Normal"} onValueChange={(style) => handleSaveServingStyle(style)} className="space-y-1">
                                                        {PREDEFINED_SERVING_STYLES.map(style => (
                                                            <div key={style} className="flex items-center space-x-2">
                                                                <RadioGroupItem value={style} id={`${item.id}-${option.id}-${style}`} />
                                                                <Label htmlFor={`${item.id}-${option.id}-${style}`} className="text-xs font-normal">{style}</Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </PopoverContent>
                                              </Popover>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                 ))}
             </div>
             <Button onClick={handleAddPackageToOrder} className="w-full mt-6" disabled={isLoading.packageDetails || isLoading.inventory}>
                {isLoading.packageDetails || isLoading.inventory ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                Añadir Paquete al Pedido
            </Button>
            </>
        );
      default: return <div className="text-center text-muted-foreground py-10">Algo salió mal.</div>;
    }
  };

 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]">
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader>
                <CardTitle>Crear Pedido</CardTitle>
                <CardDescription>Selecciona categorías, productos, paquetes y modificadores.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                 <ScrollArea className="h-full pr-4"> {renderContent()} </ScrollArea>
             </CardContent>
         </Card>
      </div>

      <div className="lg:col-span-1 h-full">
         <Card className="h-full flex flex-col shadow-md">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <div>
                 <CardTitle>Resumen Pedido</CardTitle>
                 <CardDescription>{currentOrder.id || 'Nuevo Pedido'}</CardDescription>
               </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={currentOrder.items.length === 0}><RotateCcw className="mr-2 h-4 w-4" /> Limpiar</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Limpiar pedido?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={clearOrder} className={cn(buttonVariants({ variant: "destructive" }))}>Limpiar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden pt-4">
             <div className="mb-4">
               <Label htmlFor="customerName" className="mb-1 block">Cliente</Label>
               {isRegisteringCustomer ? (
                 <div className="flex gap-2">
                   <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre cliente" className="flex-grow" aria-label="Input Nombre Cliente" />
                   <Button size="sm" onClick={handleSaveCustomer} aria-label="Guardar Cliente"><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)} aria-label="Cancelar Cliente">X</Button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center">
                   <span>{currentOrder.customerName}</span>
                   <Button variant="link" className="p-0 h-auto text-accent" onClick={() => setIsRegisteringCustomer(true)}>{currentOrder.customerName === 'Guest' ? 'Añadir Cliente' : 'Cambiar'}</Button>
                 </div>
               )}
             </div>
             <Separator className="mb-4" />
             <ScrollArea className="flex-grow mb-4 -mr-4 pr-4">
                {currentOrder.items.length === 0 ? (<p className="text-muted-foreground text-center py-8">El pedido está vacío.</p>) : (
                 <div className="space-y-3">
                 {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-sm border-b pb-2 last:border-b-0">
                         <div className="flex justify-between items-start font-medium mb-1">
                             <div className='flex items-center gap-2'>
                                 {item.type === 'package' && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Paquete"/>}
                                 <span className="flex-1 mr-2">{item.name}</span>
                            </div>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {(item.selectedModifiers.length > 0 || (item.type === 'package' && item.packageItems && item.packageItems.length > 0)) && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modificadores:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Detalles/Modificadores:</span>}
                                <ul className='list-disc list-inside pl-2'>
                                    {item.type === 'package' && item.packageItems ? (
                                         item.packageItems.map(pkgItem => (
                                            <li key={pkgItem.packageItemId}>
                                                {pkgItem.productName}
                                                {pkgItem.selectedModifiers.length > 0 && (
                                                    <ul className="list-[circle] list-inside pl-4">
                                                        {pkgItem.selectedModifiers.map((mod, modIdx) => (
                                                            <li key={`${mod.productId}-${modIdx}`} className="flex justify-between items-center">
                                                                <span>
                                                                  {mod.name}
                                                                  {mod.servingStyle && ` (${mod.servingStyle})`}
                                                                  {(mod.priceModifier || 0) + (mod.extraCost || 0) > 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''}
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
                                                  {mod.servingStyle && ` (${mod.servingStyle})`}
                                                  {(mod.priceModifier || 0) + (mod.extraCost || 0) > 0 ? ` (${formatCurrency((mod.priceModifier || 0) + (mod.extraCost || 0))})` : ''}
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
             </ScrollArea>
             <Separator className="my-2" />
             <div className="space-y-2 text-sm pt-2">
               <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(currentOrder.subtotal)}</span></div>
               <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(currentOrder.total)}</span></div>
               <RadioGroup value={currentOrder.paymentMethod} onValueChange={(value) => setCurrentOrder(prev => ({...prev, paymentMethod: value as 'cash' | 'card'}))} className="flex gap-4 mt-2" aria-label="Método de Pago">
                 <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="pay-card" /><Label htmlFor="pay-card">Tarjeta</Label></div>
                 <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="pay-cash" /><Label htmlFor="pay-cash">Efectivo</Label></div>
               </RadioGroup>
               {currentOrder.paymentMethod === 'cash' && (
                 <div className="mt-2 space-y-2">
                     <div className='relative'>
                         <Label htmlFor="paidAmount" className="mb-1 block text-xs">Pagado</Label>
                         <span className="absolute left-2.5 top-6 text-muted-foreground">$</span>
                         <Input id="paidAmount" type="number" step="0.01" min="0" value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} placeholder="0.00" className="pl-6" aria-label="Cantidad Pagada" />
                    </div>
                   {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount >= currentOrder.total && currentOrder.changeDue !== undefined && (
                     <div className="flex justify-between text-accent font-medium"><span>Cambio:</span><span>{formatCurrency(currentOrder.changeDue)}</span></div>
                   )}
                    {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount < currentOrder.total && (
                     <p className="text-destructive text-xs">Faltante: {formatCurrency(currentOrder.total - currentOrder.paidAmount)}</p>
                   )}
                 </div>
               )}
             </div>
           </CardContent>
            <div className="p-4 border-t mt-auto bg-muted/30">
                 <Button className="w-full" onClick={handleFinalizeOrder} disabled={currentOrder.items.length === 0 || isLoading.inventory || isLoading.printing}>
                    {isLoading.inventory || isLoading.printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    {isLoading.printing ? 'Imprimiendo...' : 'Finalizar e Imprimir'}
                 </Button>
            </div>
         </Card>
       </div>
       {/* Dialogo para Costo Extra */}
       <Dialog open={!!extraCostDialogState} onOpenChange={() => setExtraCostDialogState(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Añadir Costo Extra</DialogTitle>
                    <DialogDescription>
                        Introduce un costo adicional para el modificador "{extraCostDialogState?.modifierProductId ? productsData.find(p=>p.id === extraCostDialogState.modifierProductId)?.name : ''}". Este se sumará a su precio.
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
