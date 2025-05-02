// src/app/dashboard/create-order/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon, RotateCcw, ShoppingBag } from 'lucide-react'; // Íconos
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // Para imágenes de productos
import { cn } from '@/lib/utils'; // Importar utilidad cn
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategoryUI, // Fetches packages by their UI category - RENAMED
    getPackageById, // Fetch single package by ID
    getItemsForPackage,
    getOverridesForPackageItem,
    getModifiersByCategory, // Import this
} from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service'; // Se agregó ajuste y obtención de inventario
import type {
    Category,
    Product,
    Package, // Importar explícitamente el tipo Package
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride,
    OrderItem,
    CurrentOrder,
    SelectedModifierItem,
    SavedOrder,
    InventoryItem,
    ProductModifierSlotOption // Asegurarse que este tipo esté importado
} from '@/types/product-types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button" // Importar buttonVariants

// Capacitor (Importación conceptual - ¡Necesita un plugin real!)
// import { Plugins } from '@capacitor/core';
// const { PrinterPlugin } = Plugins;


// --- Funciones de Ayuda ---
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


const generateOrderId = (existingOrdersCount: number): string => {
  const nextId = existingOrdersCount + 1;
  return `siChef-${String(nextId).padStart(3, '0')}`;
};

// --- Estado del Componente ---
type View = 'categories' | 'products' | 'modifiers' | 'package-details';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[]; // Productos de la categoría vinculada
    selectedOptions: SelectedModifierItem[]; // Modificadores elegidos para esta instancia de slot
    override?: PackageItemModifierSlotOverride; // Reglas de override específicas del paquete (opcional)
}

interface PackageDetailState {
    packageDef: Package; // Definición del paquete de la tabla 'packages'
    packageItems: PackageItem[]; // Items incluidos en la definición del paquete
    // Clave: ID de PackageItem, Valor: Estado de sus slots modificadores
    itemSlots: Record<string, ModifierSlotState[]>;
}

// --- Componente ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Solo para productos regulares ahora
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null); // Para seleccionar paquetes
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null); // Para configurar detalles del paquete
  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]); // Mantiene el estado para la UI de selección de modificadores de productos regulares
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>({
    id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  // Estado para datos obtenidos
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Productos (no paquete) para la categoría seleccionada
  const [packages, setPackages] = useState<Package[]>([]); // Paquetes (de la tabla 'packages') para la categoría UI seleccionada
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map()); // Almacenar inventario para verificaciones

  const [isLoading, setIsLoading] = useState({
        categories: true,
        products: false,
        packages: false,
        modifiers: false,
        packageDetails: false,
        inventory: false, // Añadido para verificaciones/actualizaciones de inventario
        printing: false, // Nuevo estado para impresión
    });


  const { toast } = useToast();

  // --- Efectos de Obtención de Datos ---
  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(prev => ({ ...prev, categories: true, inventory: true }));
      try {
        const [fetchedCategories, fetchedInventory] = await Promise.all([
            getCategories(), // Obtener todas las categorías inicialmente
            getInventoryItems() // Obtener todos los items de inventario
        ]);
        setCategories(fetchedCategories);

        // Crear mapa de inventario para búsquedas rápidas
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

  // Obtiene productos no-paquete y paquetes para un ID de categoría dado
  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    setProducts([]); // Limpiar productos anteriores
    setPackages([]); // Limpiar paquetes anteriores
    try {
        // Obtener productos regulares (el servicio filtra paquetes y modificadores)
        const fetchedProducts = await getProductsByCategory(categoryId);
        // Obtener paquetes vinculados a esta categoría UI - UPDATED function name
        const fetchedPackages = await getPackagesByCategoryUI(categoryId);

        setProducts(fetchedProducts);
        setPackages(fetchedPackages);
    } catch (error) {
      toast({ title: "Error", description: `Fallo al cargar items para categoría ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, products: false, packages: false }));
    }
  }, [toast]);

  // Obtiene slots modificadores y sus opciones (productos) para un producto
   const fetchAndPrepareModifierSlots = useCallback(async (productId: string): Promise<ModifierSlotState[]> => {
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    let preparedSlots: ModifierSlotState[] = [];
    try {
        // 1. Obtener la definición de los slots
        const slotsDefinition = await getModifierSlotsForProduct(productId);
        if (slotsDefinition && slotsDefinition.length > 0) {
             // 2. Para cada slot, determinar qué opciones mostrar
             const optionsPromises = slotsDefinition.map(async (slot) => {
                 let options: Product[] = [];
                 if (slot.allowedOptions && slot.allowedOptions.length > 0) {
                     // Si hay opciones específicas definidas, usarlas
                      console.log(`[fetchAndPrepareModifierSlots] Slot ${slot.id} tiene ${slot.allowedOptions.length} opciones específicas.`);
                     // Necesitamos los detalles completos de cada producto modificador permitido
                     const optionDetailsPromises = slot.allowedOptions.map(opt => getProductById(opt.modifier_product_id));
                     options = (await Promise.all(optionDetailsPromises)).filter(p => p !== null) as Product[];
                 } else {
                     // Si no hay opciones específicas, obtener *todos* los modificadores de la categoría vinculada
                      console.log(`[fetchAndPrepareModifierSlots] Slot ${slot.id} usa categoría ${slot.linked_category_id}.`);
                     options = await getModifiersByCategory(slot.linked_category_id);
                 }
                 return { ...slot, options: options, selectedOptions: [] }; // Inicializar estado
             });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: `Fallo al cargar modificadores para producto ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]); // Se eliminó getModifiersByCategory de las dependencias ya que es estable

   // Obtener detalles para un paquete, incluyendo sus items y sus slots/overrides de modificadores
   const fetchPackageDetails = useCallback(async (packageId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        setSelectedPackageDetail(null); // Limpiar detalle anterior
        try {
            // Paquete en sí de la tabla 'packages'
            const packageDef = await getPackageById(packageId); // Usar getPackageById
            if (!packageDef) throw new Error("Paquete no encontrado");

            // Obtener la lista de IDs de productos definidos dentro de este paquete
            const packageItems = await getItemsForPackage(packageId);

            // Para cada item en el paquete, obtener sus slots modificadores base y aplicar overrides
            const itemSlotsPromises = packageItems.map(async (item) => {
                // 1. Obtener los slots modificadores base para el producto real en el item del paquete (ej., Alitas 6pz)
                // fetchAndPrepareModifierSlots ya maneja la lógica de opciones específicas vs. categoría completa
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);

                // 2. Obtener cualquier override específico para esta instancia de item de paquete
                const overrides = await getOverridesForPackageItem(item.id);

                // 3. Aplicar overrides a los slots base
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    // Si existe override, usar su min/max, de lo contrario, usar los predeterminados del slot
                    return override ? {
                        ...slot,
                        override: override, // Almacenar el objeto override en sí
                        min_quantity: override.min_quantity, // Usar directamente valores de override
                        max_quantity: override.max_quantity
                     } : slot;
                });
                return { packageItemId: item.id, slots: finalSlots };
            });

            const resolvedItemSlots = await Promise.all(itemSlotsPromises);

            // Crear un mapa para búsqueda fácil: { packageItemId: ModifierSlotState[] }
            const itemSlotsMap: Record<string, ModifierSlotState[]> = resolvedItemSlots.reduce((acc, curr) => {
                acc[curr.packageItemId] = curr.slots;
                return acc;
            }, {} as Record<string, ModifierSlotState[]>);


            setSelectedPackageDetail({
                packageDef,
                packageItems,
                itemSlots: itemSlotsMap
            });
            setView('package-details');

        } catch (error) {
            toast({ title: "Error", description: `Fallo al cargar detalles del paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
            setView('products'); // Regresar si fallan los detalles
        } finally {
            setIsLoading(prev => ({ ...prev, packageDetails: false }));
        }
   }, [toast, fetchAndPrepareModifierSlots]);


  // --- Manejadores de Interacción UI ---

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    fetchProductsAndPackages(category.id); // Obtener productos y/o paquetes
    setView('products'); // Mostrar la lista de items en esa categoría
  };

  // Maneja clic en un producto regular
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product); // Almacenar el producto clicado

    // Verificar inventario para el producto base
     if (product.inventory_item_id) {
       const invItem = inventoryMap.get(product.inventory_item_id);
       const consumed = product.inventory_consumed_per_unit ?? 0;
       if (!invItem || invItem.current_stock < consumed) {
            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${product.name}.`, variant: "destructive" });
            setSelectedProduct(null); // Resetear selección
            return; // Detener procesamiento
       }
     }

     // Obtener sus slots modificadores
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setCurrentModifierSlots(slots); // Establecer estado para UI de selección de modificadores
        setView('modifiers'); // Ir a la vista de selección de modificadores
    } else {
         // Sin modificadores, añadir directamente al pedido (el precio es solo el precio base)
        addProductToOrder(product, [], product.price);
         toast({ title: `${product.name} añadido`, description: 'Sin modificadores' });
         // MODIFICADO: Regresar a categorías después de añadir
         setView('categories');
         resetProductSelection(); // Resetear selección y slots
         setSelectedCategory(null); // Limpiar categoría seleccionada
         setProducts([]); // Limpiar productos de la lista
         setPackages([]); // Limpiar paquetes de la lista
    }

  };

  // Maneja clic en un paquete mostrado en la lista
  const handlePackageClick = async (pkg: Package) => {
    setSelectedPackage(pkg); // Almacenar la definición del paquete seleccionado
    // Obtener detalles completos incluyendo items y sus posibles overrides de modificadores
    await fetchPackageDetails(pkg.id);
    // La vista se cambia dentro de fetchPackageDetails a 'package-details'
  };


   // Manejador genérico para seleccionar/deseleccionar opciones de modificador
   // Funciona tanto para modificadores de productos regulares como para modificadores dentro de items de paquete
   const handleModifierOptionChange = (
        slotId: string,
        optionProductId: string, // El ID del producto que se selecciona como modificador (ej., 'prod-salsa-bbq')
        optionName: string,
        optionPriceModifier: number, // Precio del producto modificador en sí (a menudo 0 para salsas)
        context: 'product' | 'package', // ¿Dónde ocurre este cambio?
        packageItemId?: string // Solo proporcionado para contexto 'package'
    ) => {

        // Función para actualizar una lista de slots basada en el cambio de selección
        const updateSlotsLogic = (prevSlots: ModifierSlotState[]): ModifierSlotState[] => {
            return prevSlots.map(slot => {
                if (slot.id === slotId) {
                    const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                    let newSelections = [...slot.selectedOptions];
                    // Usar min/max de override si está disponible (del estado del slot), de lo contrario usar predeterminados de la definición del slot
                    const minQty = slot.min_quantity; // Ya ajustado si existe override
                    const maxQty = slot.max_quantity; // Ya ajustado si existe override

                    // Verificar inventario para la opción de modificador en sí (si aplica)
                    const modifierProductDetails = slot.options.find(opt => opt.id === optionProductId);
                    if (modifierProductDetails?.inventory_item_id) {
                         const invItem = inventoryMap.get(modifierProductDetails.inventory_item_id);
                         const consumed = modifierProductDetails.inventory_consumed_per_unit ?? 0;
                         if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${optionName}.`, variant: "destructive" });
                            return slot; // Prevenir selección
                         }
                    }


                    if (isSelected) {
                        // Deseleccionar: Filtrar la opción
                        newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                         // Verificar mínimo solo en el añadido final, no durante cambios de selección para mejor UX
                        // if (newSelections.length < minQty) {
                        //      toast({ title: "Minimum Not Met", description: `Requires at least ${minQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                        // }
                    } else {
                        // Seleccionar: Verificar si añadir viola la cantidad máxima
                        if (newSelections.length < maxQty) {
                            newSelections.push({
                                productId: optionProductId,
                                name: optionName,
                                priceModifier: optionPriceModifier, // Precio del modificador en sí
                                slotId: slotId,
                                // packageItemId podría añadirse después si es necesario en el tipo SelectedModifierItem
                            });
                        } else {
                            toast({ title: "Límite Alcanzado", description: `No se puede seleccionar más de ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                            return slot; // Devolver slot sin cambios si se alcanzó el máximo
                        }
                    }
                    return { ...slot, selectedOptions: newSelections };
                }
                return slot;
            });
        };

        // Actualizar el estado correcto basado en el contexto
        if (context === 'product') {
            setCurrentModifierSlots(updateSlotsLogic);
        } else if (context === 'package' && packageItemId && selectedPackageDetail) {
            // Actualizar el slot específico dentro del estado selectedPackageDetail
            setSelectedPackageDetail(prevDetail => {
                if (!prevDetail) return null;
                 // Una copia profunda podría ser más segura, pero un mapeo cuidadoso también puede funcionar
                 const updatedItemSlots = { ...prevDetail.itemSlots };
                 if(updatedItemSlots[packageItemId]) {
                    updatedItemSlots[packageItemId] = updateSlotsLogic(updatedItemSlots[packageItemId]);
                 }
                 return { ...prevDetail, itemSlots: updatedItemSlots };
            });
        } else {
            console.error("Contexto inválido para handleModifierOptionChange", { context, packageItemId });
            toast({ title: "Error Interno", description: "No se pudo actualizar la selección de modificadores.", variant: "destructive"});
        }
    };


  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;

    // Validar cantidad mínima para cada slot
    for (const slot of currentModifierSlots) {
        const minQty = slot.min_quantity;
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selección Incompleta", description: `Debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
            return; // Detener añadido
        }
    }

    // Calcular precio total por una unidad incluyendo modificadores
    // Precio base + suma de precios de productos modificadores
    const chosenModifiers = currentModifierSlots.flatMap(slot => slot.selectedOptions);
    const modifierPriceTotal = chosenModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const pricePerUnit = selectedProduct.price + modifierPriceTotal;

    // Añadir al pedido
    addProductToOrder(selectedProduct, chosenModifiers, pricePerUnit);

     toast({
        title: `${selectedProduct.name} añadido`,
        description: chosenModifiers.length > 0 ? `Modificadores: ${chosenModifiers.map(m => m.name).join(', ')}` : 'Sin modificadores',
    });

    // MODIFICADO: Regresar a categorías después de añadir
    setView('categories');
    resetProductSelection(); // Resetear selección y slots
    setSelectedCategory(null); // Limpiar categoría seleccionada
    setProducts([]); // Limpiar productos de la lista
    setPackages([]); // Limpiar paquetes de la lista
  };

   const handleAddPackageToOrder = async () => { // Hacer asíncrono para obtener detalles del producto
        if (!selectedPackageDetail) return;

        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;

        // --- Verificación de Inventario para Paquete ---
        let inventoryOk = true;
        const tempInventoryChanges: Record<string, number> = {}; // Rastrear cambios dentro del paquete

        // Verificar inventario de item de paquete base (SI la tabla packages tuviera enlace de inventario - no lo tiene actualmente)
        // Por ahora, solo verificamos los productos contenidos y modificadores.

        // Obtener detalles de producto para todos los items y modificadores dentro del paquete
        const allProductIdsInPackage = new Set<string>();
        packageItems.forEach(item => allProductIdsInPackage.add(item.product_id));
        Object.values(itemSlots).flat().forEach(slot => {
            slot.options.forEach(opt => allProductIdsInPackage.add(opt.id)); // Opciones de modificador
            slot.selectedOptions.forEach(sel => allProductIdsInPackage.add(sel.productId)); // Modificadores seleccionados
        });

        const productDetailsMap = new Map<string, Product>();
        const productFetchPromises = Array.from(allProductIdsInPackage).map(id =>
            getProductById(id).catch(err => {
                console.error(`Error obteniendo detalles para ID de producto ${id} en paquete:`, err);
                toast({ title: "Error Interno", description: `No se pudo obtener detalle del producto ID ${id}.`, variant: "destructive" });
                return null; // Devolver null en error
            })
        );
        const fetchedProducts = await Promise.all(productFetchPromises);
        fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });


        // Verificar inventario para cada producto dentro del paquete y sus modificadores seleccionados
        for (const item of packageItems) {
            // const productDetails = products.find(p => p.id === item.product_id) || // Verificar productos obtenidos
            //                          packages.find(p => p.id === item.product_id); // Verificar paquetes obtenidos (¿si un paquete contiene otro paquete?)
            const productDetails = productDetailsMap.get(item.product_id);

            if (!productDetails) {
                toast({ title: "Error", description: `Definición de producto para ${item.product_name} no encontrada.`, variant: "destructive" });
                inventoryOk = false;
                break; // Detener verificación si falta definición
            }

            // Verificar el producto en sí
            if (productDetails.inventory_item_id) {
                const invItem = inventoryMap.get(productDetails.inventory_item_id);
                const consumed = (productDetails.inventory_consumed_per_unit ?? 0) * item.quantity;
                const currentStock = invItem?.current_stock ?? 0;
                const alreadyConsumed = tempInventoryChanges[productDetails.inventory_item_id] || 0;

                if (currentStock + alreadyConsumed < consumed) {
                    toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${item.product_name} en paquete.`, variant: "destructive" });
                    inventoryOk = false;
                    break;
                } else if (consumed > 0) {
                    tempInventoryChanges[productDetails.inventory_item_id] = alreadyConsumed - consumed;
                }
            }

            // Verificar modificadores seleccionados para este item de paquete
            const slots = itemSlots[item.id] || [];
            for (const slot of slots) {
                 // Validar cantidad mínima
                const minQty = slot.min_quantity; // Ya ajustado por override
                if (slot.selectedOptions.length < minQty) {
                     toast({
                        title: "Selección Incompleta",
                        description: `Para "${item.product_name}", debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`,
                        variant: "destructive"
                    });
                    inventoryOk = false;
                    break;
                }

                 // Verificar inventario de modificador
                 for (const modOption of slot.selectedOptions) {
                     // const modProductDetails = slot.options.find(opt => opt.id === modOption.productId);
                     const modProductDetails = productDetailsMap.get(modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * item.quantity; // Asumir mod consumido por cantidad de item de paquete
                         const currentStock = invItem?.current_stock ?? 0;
                         const alreadyConsumed = tempInventoryChanges[modProductDetails.inventory_item_id] || 0;

                        if (currentStock + alreadyConsumed < consumed) {
                            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para modificador ${modOption.name}.`, variant: "destructive" });
                            inventoryOk = false;
                            break;
                         } else if (consumed > 0) {
                            tempInventoryChanges[modProductDetails.inventory_item_id] = alreadyConsumed - consumed;
                        }
                     }
                 }
                 if (!inventoryOk) break;
            }
             if (!inventoryOk) break;
        }
        // --- Fin Verificación de Inventario ---

        if (!inventoryOk) {
            return; // Detener si falló verificación de inventario o no se cumplió cantidad mínima
        }

        // --- Añadir Paquete al Pedido ---
        // Recolectar todos los modificadores seleccionados de todos los items en el paquete
         const allSelectedModifiersNested = packageItems.map(item => {
            const slots = itemSlots[item.id] || [];
            return slots.flatMap(slot => slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id}))); // Añadir contexto packageItemId
         }).flat();

        const packagePrice = packageDef.price; // Precio del paquete es fijo

        const newOrderItem: OrderItem = {
            type: 'package',
            id: packageDef.id, // ID del paquete de la tabla 'packages'
            name: packageDef.name,
            quantity: 1,
            basePrice: packagePrice, // Precio fijo del producto paquete
            selectedModifiers: allSelectedModifiersNested, // Almacenar todos los modificadores elegidos dentro del contexto del paquete
            totalPrice: packagePrice, // Precio total por un paquete (usualmente solo basePrice)
            uniqueId: Date.now().toString() + Math.random().toString(),
             // Almacenar detalles de los items y sus modificadores específicos *dentro* de esta instancia de paquete
             packageItems: packageItems.map(item => ({
                 packageItemId: item.id, // ID de la línea de definición de PackageItem
                 productId: item.product_id,
                 productName: item.product_name || 'Producto Desconocido', // Usar nombre unido
                 // Obtener modificadores seleccionados solo para esta instancia de item específica
                 selectedModifiers: (itemSlots[item.id] || []).flatMap(slot => slot.selectedOptions)
            }))
        };

        setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

         toast({
            title: `Paquete "${packageDef.name}" añadido`,
        });

        // MODIFICADO: Regresar a categorías después de añadir
        setView('categories');
        resetPackageSelection(); // Resetear selección y detalles
        setSelectedCategory(null); // Limpiar categoría seleccionada
        setProducts([]); // Limpiar productos de la lista
        setPackages([]); // Limpiar paquetes de la lista
   };

  // Añadir producto regular al pedido
  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[], pricePerUnit: number) => {

    const newOrderItem: OrderItem = {
      type: 'product',
      id: product.id,
      name: product.name,
      quantity: 1,
      basePrice: product.price, // Precio antes de modificadores
      selectedModifiers: modifiers,
      totalPrice: pricePerUnit, // Precio incluyendo modificadores para cantidad 1
      uniqueId: Date.now().toString() + Math.random().toString(), // ID único simple
    };

    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
    // Toast se maneja en la función que llama (handleProductClick o handleAddProductWithModifiers)
  };


   // Efecto para calcular totales cada vez que cambian los items del pedido
  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    // Cálculo simple de total por ahora, añadir impuestos/descuentos después si es necesario
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal }));
  }, [currentOrder.items]);

  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta); // Permitir que la cantidad sea 0
           // Recalcular precio por unidad basado en base + modificadores (para producto) o base fija (para paquete)
           let pricePerUnit = 0;
           if (item.type === 'product') {
              const modifierPriceTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
              pricePerUnit = item.basePrice + modifierPriceTotal;
           } else { // 'package'
              pricePerUnit = item.basePrice; // Precio del paquete es fijo por unidad
           }

            // --- Verificación de Inventario al Aumentar Cantidad ---
             if (delta > 0) {
                let checkOk = true;
                // Encontrar la definición del producto/paquete
                // Necesita verificación asíncrona aquí, potencialmente complejo. Por simplicidad, omitiendo verificación profunda por ahora.
                // const details = item.type === 'product' ? productDetailsMap.get(item.id) : packageDetailsMap.get(item.id);
                console.warn("Verificación de inventario al aumentar cantidad está simplificada. Confiando en verificación inicial de añadido.");

                // Verificación simple para el item principal si es un producto
                // if (item.type === 'product') {
                //    const productDetails = products.find(p => p.id === item.id);
                //    if (productDetails?.inventory_item_id) {
                //        const invItem = inventoryMap.get(productDetails.inventory_item_id);
                //        const consumed = productDetails.inventory_consumed_per_unit ?? 0;
                //        if (!invItem || invItem.current_stock < consumed * newQuantity) { // Verificar total necesario
                //            toast({ title: "Stock Insuficiente", description: `No hay inventario para ${newQuantity}x ${item.name}.`, variant: "destructive" });
                //            checkOk = false;
                //        }
                //    }
                // }

                if (!checkOk) return item; // Devolver item original si falla verificación
            }
             // --- Fin Verificación de Inventario ---


          return {
            ...item,
            quantity: newQuantity,
            totalPrice: pricePerUnit * newQuantity, // Actualizar precio total basado en nueva cantidad
          };
        }
        return item;
      });
      updatedItems = updatedItems.filter(item => item.quantity > 0); // Eliminar item si la cantidad es 0

      return { ...prev, items: updatedItems };
    });
  };


  const handleRemoveItem = (uniqueId: string) => {
     setCurrentOrder(prev => ({
      ...prev,
      items: prev.items.filter(item => item.uniqueId !== uniqueId)
    }));
     toast({
        title: `Item eliminado del pedido`,
        variant: 'destructive'
    })
  };

  // Función para limpiar todo el pedido
    const clearOrder = () => {
        setCurrentOrder({
            id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card'
        });
        setCustomerName('');
        setIsRegisteringCustomer(false);
        setPaidAmountInput('');
         toast({ title: "Pedido Limpiado", variant: "destructive" });
    };


  const resetProductSelection = () => {
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    // No cambia la vista aquí, se maneja en el caller
    // setView('products');
  }

  const resetPackageSelection = () => {
    setSelectedPackage(null);
    setSelectedPackageDetail(null);
    // No cambia la vista aquí, se maneja en el caller
    // setView('products');
  }


  const handleBack = () => {
    if (view === 'modifiers') {
      resetProductSelection();
      setView('products'); // Regresar a la lista de productos
    } else if (view === 'package-details') {
       resetPackageSelection();
       setView('products'); // Regresar a la lista de productos
    } else if (view === 'products') { // Vista unificada para productos y paquetes
      setView('categories');
      setSelectedCategory(null);
      setProducts([]);
      setPackages([]);
    }
  };

    // Efecto para calcular el cambio debido
  useEffect(() => {
    if (currentOrder.paymentMethod === 'cash') {
      const paid = parseFloat(paidAmountInput) || 0;
      const change = paid - currentOrder.total;
      setCurrentOrder(prev => ({
        ...prev,
        paidAmount: paid,
        changeDue: change >= 0 ? change : undefined // Solo establecer si no es negativo
      }));
    } else {
      // Resetear campos específicos de efectivo si cambia el método de pago
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

   // Función para generar el texto de la comanda (placeholder)
   const generateReceiptText = (order: SavedOrder): string => {
        let receipt = `-----------------------------\n`;
        receipt += `     Comanda Cocina\n`;
        receipt += `-----------------------------\n`;
        receipt += `Pedido #: ${order.orderNumber} (${order.id})\n`;
        receipt += `Cliente: ${order.customerName}\n`;
        receipt += `Fecha: ${format(order.createdAt, 'Pp')}\n`;
        receipt += `-----------------------------\n\n`;

        order.items.forEach(item => {
            receipt += `${item.quantity}x ${item.name}`;
            if(item.price !== item.totalItemPrice / item.quantity) { // Mostrar precio base si difiere
                receipt += ` (${formatCurrency(item.price)} c/u)`;
            }
            receipt += ` - ${formatCurrency(item.totalItemPrice)}\n`;

            if (item.components.length > 0) {
                item.components.forEach(comp => {
                    receipt += `  - ${comp.slotLabel ? `[${comp.slotLabel}] ` : ''}${comp.name}\n`;
                });
            }
            receipt += `\n`; // Espacio entre items
        });

        receipt += `-----------------------------\n`;
        receipt += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
        receipt += `TOTAL: ${formatCurrency(order.total)}\n`;
        receipt += `Forma Pago: ${order.paymentMethod.toUpperCase()}\n`;
        if(order.paymentMethod === 'cash' && order.paidAmount !== undefined) {
            receipt += `Pagado: ${formatCurrency(order.paidAmount)}\n`;
            receipt += `Cambio: ${formatCurrency(order.changeGiven ?? 0)}\n`;
        }
        receipt += `-----------------------------\n`;
        receipt += `    ¡Gracias por tu compra!\n`;
        receipt += `-----------------------------\n`;
        return receipt;
   };

   // Placeholder para la función de impresión real usando Capacitor
   const handlePrintReceipt = async (receiptText: string) => {
        setIsLoading(prev => ({ ...prev, printing: true }));
        toast({ title: "Imprimiendo...", description: "Enviando comanda a la impresora..." });

        console.log("--- INICIO COMANDA (SIMULADO) ---");
        console.log(receiptText);
        console.log("--- FIN COMANDA (SIMULADO) ---");

        // --- Inicio: Lógica de Capacitor (¡Requiere Plugin!) ---
        /*
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
            try {
                // Asumiendo que existe un plugin 'PrinterPlugin'
                // const { PrinterPlugin } = Plugins;
                // if (!PrinterPlugin) throw new Error("Plugin de impresora no disponible.");

                // 1. Buscar impresoras (ej. Bluetooth) - La implementación depende del plugin
                // const discovered = await PrinterPlugin.discoverPrinters({ types: ['bluetooth'] });
                // if (!discovered || discovered.printers.length === 0) {
                //   throw new Error("No se encontraron impresoras Bluetooth.");
                // }
                // const targetPrinter = discovered.printers[0]; // Seleccionar la primera encontrada (o permitir selección)
                // console.log("Usando impresora:", targetPrinter);

                // 2. Imprimir el texto
                // await PrinterPlugin.print({
                //   printerId: targetPrinter.id, // ID de la impresora encontrada
                //   content: receiptText,
                //   contentType: 'text' // O 'escpos' si generas comandos ESC/POS
                // });

                // Simulación para desarrollo web
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simular espera

                toast({ title: "Impresión Exitosa", description: "Comanda enviada correctamente (simulado)." });

            } catch (error) {
                console.error("Error al imprimir con Capacitor:", error);
                toast({
                    variant: "destructive",
                    title: "Error de Impresión",
                    description: `No se pudo imprimir. ${error instanceof Error ? error.message : 'Error desconocido'}`,
                });
            }
        } else {
            console.warn("Capacitor no disponible o no es plataforma nativa. Impresión simulada en consola.");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simular espera
             toast({ title: "Impresión Simulada", description: "Comanda mostrada en consola." });
        }
        */
         // Simulación simple sin Capacitor por ahora
         await new Promise(resolve => setTimeout(resolve, 1000));
         toast({ title: "Impresión Simulada", description: "Comanda mostrada en consola." });

        // --- Fin: Lógica de Capacitor ---

        setIsLoading(prev => ({ ...prev, printing: false }));
   };


  const handleFinalizeOrder = async () => {
    if (currentOrder.items.length === 0) {
      toast({ title: "Pedido Vacío", description: "Por favor añade items al pedido.", variant: 'destructive' });
      return;
    }
     if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < currentOrder.total)) {
       toast({ title: "Pago Incompleto", description: "La cantidad pagada en efectivo es menor que el total.", variant: 'destructive' });
      return;
    }

     // 1. Obtener pedidos existentes para determinar el siguiente ID
     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try {
         existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({
             ...order,
             createdAt: new Date(order.createdAt),
             // Asegurar que los campos requeridos existan y tengan tipos correctos
             items: order.items?.map((item: any) => ({
                id: item.id || 'unknown',
                name: item.name || 'Unknown Item',
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

     // --- Ajuste de Inventario ---
     setIsLoading(prev => ({ ...prev, inventory: true }));
     const inventoryAdjustments: Record<string, { change: number, name: string }> = {}; // Clave: inventory_item_id, Valor: {cambio total de cantidad, nombre del item}
     let inventoryAdjustmentFailed = false;

     try {
         // Pre-obtener detalles de producto necesarios para evitar awaits dentro del bucle
          const allProductIds = new Set<string>();
          currentOrder.items.forEach(item => {
             // Para productos, usar el ID del item directamente.
             // Para paquetes, necesitamos los IDs de los productos *dentro* del paquete.
             if (item.type === 'product') {
                allProductIds.add(item.id);
                item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             } else if (item.type === 'package' && item.packageItems) {
                // No añadir el ID del paquete en sí a menos que consuma inventario directamente (lo cual no hace ahora)
                item.packageItems.forEach(pkgItem => {
                     allProductIds.add(pkgItem.productId); // IDs de producto dentro del paquete
                     pkgItem.selectedModifiers.forEach(mod => allProductIds.add(mod.productId)); // IDs de modificador dentro del item de paquete
                 });
                 // También necesitamos modificadores adjuntos directamente al item de pedido del paquete (si hay, aunque usualmente vacío para paquetes)
                  item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             }
         });

         const productDetailsMap = new Map<string, Product>();
         const productFetchPromises = Array.from(allProductIds).map(id => getProductById(id));
         const fetchedProducts = await Promise.all(productFetchPromises);
         fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });


         // Calcular cambios de inventario necesarios
         for (const orderItem of currentOrder.items) {

             // 1. Consumir inventario para productos regulares y sus modificadores
             if (orderItem.type === 'product') {
                 const itemDetails = productDetailsMap.get(orderItem.id);
                 if (!itemDetails) continue; // No debería suceder si se pre-obtuvo

                 // Consumir inventario para el producto principal en sí
                 if (itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                     const invItemId = itemDetails.inventory_item_id;
                     const change = -(itemDetails.inventory_consumed_per_unit * orderItem.quantity);
                     const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                     inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                 }

                 // Consumir inventario para modificadores seleccionados
                 for (const modifier of orderItem.selectedModifiers) {
                     const modDetails = productDetailsMap.get(modifier.productId);
                     if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                         const invItemId = modDetails.inventory_item_id;
                         const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity); // Consumo de modificador por cantidad de item principal
                         const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                         inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }
                 }
             }
             // 2. Consumir inventario para items Y sus modificadores dentro de un paquete
             else if (orderItem.type === 'package' && orderItem.packageItems) {
                 for (const pkgItem of orderItem.packageItems) {
                     const pkgItemDetails = productDetailsMap.get(pkgItem.productId);
                     if (!pkgItemDetails) continue;

                     // Consumir para el producto del item de paquete
                     if (pkgItemDetails.inventory_item_id && pkgItemDetails.inventory_consumed_per_unit) {
                          const invItemId = pkgItemDetails.inventory_item_id;
                          // Consumo = consumo del producto * cantidad definida en paquete * cantidad de paquete en pedido
                          // Asumir cantidad de item de paquete definida en tabla package_items (o predeterminado 1)
                           const packageItemDef = selectedPackageDetail?.packageItems.find(pi => pi.id === pkgItem.packageItemId); // Buscar en detalle de paquete
                           const itemQtyInPackage = packageItemDef?.quantity || 1;
                           const change = -(pkgItemDetails.inventory_consumed_per_unit * itemQtyInPackage * orderItem.quantity);
                          const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                          inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }

                     // Consumir para los modificadores seleccionados del item de paquete
                      for (const modifier of pkgItem.selectedModifiers) {
                         const modDetails = productDetailsMap.get(modifier.productId);
                         if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                             const invItemId = modDetails.inventory_item_id;
                              // Consumo de modificador por cantidad general del paquete
                              const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity);
                             const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                             inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                         }
                     }
                 }
             }
         }

         // Realizar ajustes de inventario
         const adjustmentPromises: Promise<void>[] = [];
         for (const [itemId, { change, name }] of Object.entries(inventoryAdjustments)) {
             if (change !== 0) {
                 console.log(`Ajustando inventario para ${name} (ID: ${itemId}) por ${change}`);
                 adjustmentPromises.push(adjustInventoryStock(itemId, change));
             }
         }
         await Promise.all(adjustmentPromises);

          // Actualizar estado local del mapa de inventario después de ajuste exitoso
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

     if (inventoryAdjustmentFailed) {
         return; // Detener finalización de pedido si falla inventario
     }
     // --- Fin Ajuste de Inventario ---


    // 2. Formatear el nuevo objeto de pedido para que coincida con SavedOrder
     const finalizedOrder: SavedOrder = {
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => {
          let components: { name: string; slotLabel?: string }[] = [];

          // Si es un paquete, listar su contenido y sus modificadores específicos
           if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                    // Añadir el item de paquete en sí
                    components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido' });
                     // Añadir modificadores específicos para este item de paquete
                    if (pkgItem.selectedModifiers.length > 0) {
                         pkgItem.selectedModifiers.forEach(mod => {
                            // Intentar encontrar etiqueta de slot desde estado de detalle de paquete si está disponible
                             let slotLabel = 'Mod';
                             // Intentar buscar en selectedPackageDetail (si está cargado) o en currentModifierSlots (si se está editando)
                             const slotsSource = selectedPackageDetail?.itemSlots[pkgItem.packageItemId] ?? currentModifierSlots;
                             const slot = slotsSource.find(s => s.id === mod.slotId);
                             slotLabel = slot?.label || `Mod (${pkgItem.productName})`;
                             components.push({ name: `↳ ${mod.name}`, slotLabel: slotLabel});
                         });
                    }
                });
           }
           // Si es un producto regular, listar sus modificadores
           else if (item.type === 'product' && item.selectedModifiers.length > 0) {
                 item.selectedModifiers.forEach(mod => {
                     // Intentar encontrar la etiqueta de slot desde el estado de modificador actual (o slotDefinition si se carga)
                     let slotLabelFound = 'Mod';
                     const slotDefinition = currentModifierSlots.find(s => s.id === mod.slotId);
                     if(slotDefinition) slotLabelFound = slotDefinition.label;
                     // Fallback: buscar en la definición del producto si no está en estado
                     // const productSlots = await getModifierSlotsForProduct(item.id); // Esto sería async, no ideal aquí
                     components.push({ name: mod.name, slotLabel: slotLabelFound });
                 });
           }

          return {
              id: item.id, // productId o packageId
              name: item.name,
              quantity: item.quantity,
              price: item.basePrice, // Precio *antes* de mods para producto, precio de paquete para paquete
              totalItemPrice: item.totalPrice, // Almacenar el precio final calculado para este item de línea
              components: components,
          };
      }),
      paymentMethod: currentOrder.paymentMethod,
      subtotal: currentOrder.subtotal,
      total: currentOrder.total,
      status: 'completed', // Marcar como completado directamente para inventario
      createdAt: new Date(),
      paidAmount: currentOrder.paidAmount,
      changeGiven: currentOrder.changeDue,
    };

    // 3. Guardar en localStorage
    const updatedOrders = [...existingOrders, finalizedOrder];
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    // 4. Disparar Impresión (Ahora usa la función handlePrintReceipt)
    const receiptText = generateReceiptText(finalizedOrder);
    await handlePrintReceipt(receiptText); // Esperar a que la impresión termine (o falle)

    // 5. Resetear estado para un nuevo pedido (SOLO si la impresión no falló gravemente - podría necesitarse lógica adicional)
    setCurrentOrder({
      id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card'
    });
    setCustomerName('');
    setIsRegisteringCustomer(false);
    setPaidAmountInput('');
    setView('categories');
    setSelectedCategory(null);
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    setSelectedPackage(null);
    setSelectedPackageDetail(null);
    setProducts([]);
    setPackages([]);

    toast({ title: "Pedido Finalizado", description: `${finalizedOrder.id} creado y enviado a cocina.` });
  };

  // --- Lógica de Renderizado ---
  const renderContent = () => {
    switch (view) {
      case 'categories':
         if (isLoading.categories) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        // Filtrar categorías 'modificador' de la vista principal
        const displayCategories = categories.filter(cat => cat.type !== 'modificador');
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayCategories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-32 bg-secondary">
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div> // Ícono de marcador de posición
                  )}
                  {/* Badge for UI category of type 'paquete' */}
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

      case 'products': // Vista combinada para productos y paquetes
        if (isLoading.products || isLoading.packages) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Categorías
            </Button>
            <h2 className="text-xl font-semibold mb-4">{selectedCategory?.name}</h2>

             {/* Sección Paquetes */}
             {packages.length > 0 && (
                 <>
                    <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Paquetes Disponibles</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packages.map(pkg => ( // pkg es tipo Package
                        <Card key={pkg.id} onClick={() => handlePackageClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                            <div className="relative w-full h-32 bg-secondary">
                                {pkg.imageUrl ? (
                                    <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal" />
                                ) : (
                                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><PackageIcon className="h-8 w-8"/></div>
                                )}
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

            {/* Sección Productos */}
             {products.length > 0 && (
                 <>
                     <h3 className="text-lg font-medium mb-3 border-b pb-1">Productos Individuales</h3>
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {products.map(prod => (
                        <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                            <div className="relative w-full h-32 bg-secondary">
                              {prod.imageUrl ? (
                                <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food" />
                               ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8"/></div>
                               )}
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

            {/* Estado Vacío */}
            {products.length === 0 && packages.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-10">No hay items encontrados en la categoría '{selectedCategory?.name}'.</p>
             )}
          </>
        );

     case 'modifiers':
         if (isLoading.modifiers) {
             return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
         }
         if (!selectedProduct) return <p className="text-center text-muted-foreground py-10">Error: No hay producto seleccionado. Por favor, vuelve atrás.</p>;
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory?.name || 'Items'}
            </Button>
             <h2 className="text-xl font-semibold mb-2">{selectedProduct.name} - {formatCurrency(selectedProduct.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Selecciona modificadores para este producto.</p>

             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4">No hay modificadores disponibles para este producto.</p>}

             <div className="space-y-6">
                {currentModifierSlots.map(slot => (
                    <div key={slot.id}>
                        <h3 className="text-lg font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                         {slot.selectedOptions.length > 0 && (
                             <div className="mb-2 text-xs text-muted-foreground">Seleccionados: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                         )}
                         {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones disponibles para "{slot.label}". Verifica la categoría vinculada.</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {slot.options.map(option => { // option es un Product (ej., una salsa)
                                const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                const maxReached = slot.selectedOptions.length >= slot.max_quantity;
                                const isDisabled = !isSelected && maxReached;

                                 // Verificar inventario para la opción
                                let optionInventoryOk = true;
                                let optionInvItemName = '';
                                if (option.inventory_item_id) {
                                    const invItem = inventoryMap.get(option.inventory_item_id);
                                    optionInvItemName = invItem?.name || 'Item Inventario';
                                    optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                }
                                const isOutOfStock = !optionInventoryOk;

                                return (
                                    <Card
                                        key={option.id}
                                        onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionChange(
                                            slot.id,
                                            option.id,
                                            option.name,
                                            option.price, // Pasar el precio del producto modificador en sí
                                            'product' // Contexto es producto regular
                                        )}
                                        className={cn(
                                            "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative", // Relative para badge
                                            isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                            (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50"
                                        )}
                                        title={isDisabled ? `Max (${slot.max_quantity}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                        >
                                         {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                         <span className="text-xs md:text-sm block">{option.name}</span>
                                         {/* Mostrar precio solo si el modificador en sí tiene un precio > 0 */}
                                         {option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(option.price)}</span>}
                                    </Card>
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
        if (!selectedPackageDetail) return <p className="text-center text-muted-foreground py-10">Error: No hay paquete seleccionado. Por favor, vuelve atrás.</p>;

        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;

        return (
            <>
             <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
                <ChevronLeft className="mr-2 h-4 w-4" /> Volver a {selectedCategory?.name || 'Items'}
             </Button>
             <h2 className="text-xl font-semibold mb-1">{packageDef.name} - {formatCurrency(packageDef.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Configura opciones para este paquete.</p>

             <div className="space-y-6">
                 {packageItems.map(item => ( // item es definición de PackageItem
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        {/* Obtener los slots modificadores aplicables a este item dentro del paquete */}
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No hay opciones configurables para este item.</p>}
                            {(itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    {/* Mostrar etiqueta, usando min/max de override */}
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && (
                                         <div className="mb-2 text-xs text-muted-foreground">Seleccionados: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                                     )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones disponibles para "{slot.label}". Verifica la categoría vinculada.</p>}
                                    {/* Grid para opciones de modificador */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {slot.options.map(option => { // option es un Product (ej., salsa)
                                            const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                            const maxQty = slot.max_quantity; // Ya ajustado por override
                                            const maxReached = slot.selectedOptions.length >= maxQty;
                                            const isDisabled = !isSelected && maxReached;

                                             // Verificar inventario para la opción
                                            let optionInventoryOk = true;
                                            let optionInvItemName = '';
                                            if (option.inventory_item_id) {
                                                const invItem = inventoryMap.get(option.inventory_item_id);
                                                optionInvItemName = invItem?.name || 'Item Inventario';
                                                optionInventoryOk = !!invItem && invItem.current_stock >= (option.inventory_consumed_per_unit ?? 0);
                                            }
                                            const isOutOfStock = !optionInventoryOk;

                                            return (
                                                 <Card
                                                    key={option.id}
                                                    onClick={() => !isDisabled && !isOutOfStock && handleModifierOptionChange(
                                                        slot.id,
                                                        option.id,
                                                        option.name,
                                                        option.price, // Pasar precio de producto modificador
                                                        'package', // Contexto es paquete
                                                        item.id // Pasar el ID del item de paquete
                                                    )}
                                                    className={cn(
                                                        "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative",
                                                        isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                                        (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50"
                                                    )}
                                                    title={isDisabled ? `Max (${maxQty}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                                    >
                                                     {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                                    <span className="text-xs md:text-sm block">{option.name}</span>
                                                    {option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(option.price)}</span>}
                                                </Card>
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

      default:
        return <div className="text-center text-muted-foreground py-10">Algo salió mal.</div>;
    }
  };


 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]"> {/* Altura ajustada */}
      {/* Área de Contenido Principal (Categorías, Productos, Modificadores) */}
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader>
                <CardTitle>Crear Pedido</CardTitle>
                <CardDescription>Selecciona categorías, productos, paquetes y modificadores.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                 <ScrollArea className="h-full pr-4"> {/* Añadir pr-4 para espacio de barra de scroll */}
                   {renderContent()}
                 </ScrollArea>
             </CardContent>
         </Card>
      </div>

      {/* Barra Lateral Derecha (Resumen Pedido) */}
       <div className="lg:col-span-1 h-full">
         <Card className="h-full flex flex-col shadow-md">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <div>
                 <CardTitle>Resumen Pedido</CardTitle>
                 <CardDescription>{currentOrder.id || 'Nuevo Pedido'}</CardDescription>
               </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={currentOrder.items.length === 0}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Limpiar pedido actual?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará todos los items del pedido actual. No se puede deshacer.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={clearOrder} className={cn(buttonVariants({ variant: "destructive" }))}>
                            Limpiar Pedido
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden pt-4">
             {/* Sección Cliente */}
             <div className="mb-4">
               <Label htmlFor="customerName" className="mb-1 block">Cliente</Label>
               {isRegisteringCustomer ? (
                 <div className="flex gap-2">
                   <Input
                     id="customerName"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="Nombre cliente"
                     className="flex-grow"
                     aria-label="Input Nombre Cliente"
                   />
                   <Button size="sm" onClick={handleSaveCustomer} aria-label="Guardar Nombre Cliente"><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)} aria-label="Cancelar Input Nombre Cliente">X</Button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center">
                   <span>{currentOrder.customerName}</span>
                   <Button variant="link" className="p-0 h-auto text-accent" onClick={() => setIsRegisteringCustomer(true)}>
                     {currentOrder.customerName === 'Guest' ? 'Añadir Cliente' : 'Cambiar'}
                   </Button>
                 </div>
               )}
             </div>

             <Separator className="mb-4" />

             {/* Lista de Items */}
             <ScrollArea className="flex-grow mb-4 -mr-4 pr-4"> {/* Margen negativo + padding para barra de scroll */}
                {currentOrder.items.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">El pedido está vacío.</p>
                ) : (
                 <div className="space-y-3">
                 {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-sm border-b pb-2 last:border-b-0">
                         {/* Nombre del Item y Precio */}
                         <div className="flex justify-between items-start font-medium mb-1">
                             <div className='flex items-center gap-2'>
                                 {item.type === 'package' && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Paquete"/>}
                                 <span className="flex-1 mr-2">{item.name}</span>
                            </div>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          {/* Controles de Cantidad y Botón Eliminar */}
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)} aria-label={`Reducir cantidad de ${item.name}`}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)} aria-label={`Aumentar cantidad de ${item.name}`}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)} aria-label={`Eliminar ${item.name} del pedido`}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {/* Visualización de Contenido de Modificador/Paquete */}
                         {(item.selectedModifiers.length > 0 || (item.type === 'package' && item.packageItems && item.packageItems.length > 0)) && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modificadores:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Detalles / Modificadores:</span>}
                                <ul className='list-disc list-inside pl-2'>
                                     {/* Items de paquete y sus modificadores */}
                                    {item.type === 'package' && item.packageItems ? (
                                         item.packageItems.map(pkgItem => (
                                            <li key={pkgItem.packageItemId}>
                                                {pkgItem.productName}
                                                {pkgItem.selectedModifiers.length > 0 && (
                                                    <ul className="list-[circle] list-inside pl-4">
                                                        {pkgItem.selectedModifiers.map((mod, modIdx) => (
                                                            <li key={`${mod.productId}-${modIdx}`}>
                                                                {mod.name}
                                                                {mod.priceModifier && mod.priceModifier > 0 ? ` (${formatCurrency(mod.priceModifier)})` : ''}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                         ))
                                    ) : (
                                        // Modificadores de producto regular
                                        item.selectedModifiers.map((mod, idx) => (
                                            <li key={`${mod.productId}-${idx}`}>
                                                {mod.name}
                                                {mod.priceModifier && mod.priceModifier > 0 ? ` (${formatCurrency(mod.priceModifier)})` : ''}
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

             {/* Totales y Pago */}
             <Separator className="my-2" />
             <div className="space-y-2 text-sm pt-2">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Subtotal</span>
                 <span>{formatCurrency(currentOrder.subtotal)}</span>
               </div>
               <div className="flex justify-between font-bold text-base">
                 <span>Total</span>
                 <span>{formatCurrency(currentOrder.total)}</span>
               </div>

               <RadioGroup
                 value={currentOrder.paymentMethod}
                 onValueChange={(value) => setCurrentOrder(prev => ({...prev, paymentMethod: value as 'cash' | 'card'}))}
                 className="flex gap-4 mt-2"
                 aria-label="Método de Pago"
                >
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="card" id="pay-card" />
                   <Label htmlFor="pay-card">Tarjeta</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="cash" id="pay-cash" />
                   <Label htmlFor="pay-cash">Efectivo</Label>
                 </div>
               </RadioGroup>

               {currentOrder.paymentMethod === 'cash' && (
                 <div className="mt-2 space-y-2">
                     <div className='relative'>
                         <Label htmlFor="paidAmount" className="mb-1 block text-xs">Cantidad Pagada</Label>
                         <span className="absolute left-2.5 top-6 text-muted-foreground">$</span>
                         <Input
                            id="paidAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="pl-6"
                            aria-label="Cantidad Pagada en Efectivo"
                         />
                    </div>
                   {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount >= currentOrder.total && currentOrder.changeDue !== undefined && (
                     <div className="flex justify-between text-accent font-medium">
                       <span>Cambio:</span>
                       <span>{formatCurrency(currentOrder.changeDue)}</span>
                     </div>
                   )}
                    {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount < currentOrder.total && (
                     <p className="text-destructive text-xs">Faltante: {formatCurrency(currentOrder.total - currentOrder.paidAmount)}</p>
                   )}
                 </div>
               )}

             </div>
           </CardContent>
            <div className="p-4 border-t mt-auto bg-muted/30">
                 <Button
                    className="w-full"
                    onClick={handleFinalizeOrder}
                    disabled={currentOrder.items.length === 0 || isLoading.inventory || isLoading.printing} // Deshabilitar si está vacío o durante actualización/impresión
                    aria-label="Finalizar Pedido e Imprimir Ticket"
                >
                    {isLoading.inventory || isLoading.printing ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Printer className="mr-2 h-4 w-4" />
                    )}
                    {isLoading.printing ? 'Imprimiendo...' : 'Finalizar e Imprimir'}
                 </Button>
            </div>
         </Card>
       </div>
    </div>
  );
}
