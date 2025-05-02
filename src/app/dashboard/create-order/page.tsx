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
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon, RotateCcw, ShoppingBag } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // For product images
import { cn } from '@/lib/utils'; // Import cn utility
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategory, // Fetches packages by their UI category
    getPackageById, // Fetch single package by ID
    getItemsForPackage,
    getOverridesForPackageItem
} from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service'; // Added inventory adjustment and fetching
import type {
    Category,
    Product,
    Package, // Import Package type explicitly
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride,
    OrderItem,
    CurrentOrder,
    SelectedModifierItem,
    SavedOrder,
    InventoryItem
} from '@/types/product-types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button" // Import buttonVariants


// --- Helper Functions ---
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

// --- Component State ---
type View = 'categories' | 'products' | 'modifiers' | 'package-details';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[]; // Products from the linked category
    selectedOptions: SelectedModifierItem[]; // Modifiers chosen for this slot instance
    override?: PackageItemModifierSlotOverride; // Package-specific override rules (optional)
}

interface PackageDetailState {
    packageDef: Package; // Package definition from 'packages' table
    packageItems: PackageItem[]; // Items included in the package definition
    // Key: PackageItem ID, Value: Its modifier slots state
    itemSlots: Record<string, ModifierSlotState[]>;
}

// --- Component ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Only for regular products now
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null); // For selecting packages
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null); // For configuring package details
  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]); // Holds state for regular product modifier selection UI
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>({
    id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  // State for fetched data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Products (non-package) for the selected category
  const [packages, setPackages] = useState<Package[]>([]); // Packages (from 'packages' table) for the selected UI category
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItem>>(new Map()); // Store inventory for checks

  const [isLoading, setIsLoading] = useState({
        categories: true,
        products: false,
        packages: false,
        modifiers: false,
        packageDetails: false,
        inventory: false, // Added for inventory checks/updates
    });


  const { toast } = useToast();

  // --- Data Fetching Effects ---
  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(prev => ({ ...prev, categories: true, inventory: true }));
      try {
        const [fetchedCategories, fetchedInventory] = await Promise.all([
            getCategories(), // Fetch all categories initially
            getInventoryItems() // Fetch all inventory items
        ]);
        setCategories(fetchedCategories);

        // Create inventory map for quick lookups
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

  // Fetches non-package products and package products for a given category ID
  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    setProducts([]); // Clear previous products
    setPackages([]); // Clear previous packages
    try {
        // Fetch regular products (service filters out packages and modifiers)
        const fetchedProducts = await getProductsByCategory(categoryId);
        // Fetch packages linked to this UI category
        const fetchedPackages = await getPackagesByCategory(categoryId);

        setProducts(fetchedProducts);
        setPackages(fetchedPackages);
    } catch (error) {
      toast({ title: "Error", description: `Fallo al cargar items para categoría ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, products: false, packages: false }));
    }
  }, [toast]);

  // Fetches modifier slots and their options (products) for a product
   const fetchAndPrepareModifierSlots = useCallback(async (productId: string): Promise<ModifierSlotState[]> => {
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    let preparedSlots: ModifierSlotState[] = [];
    try {
        const slotsDefinition = await getModifierSlotsForProduct(productId);
        if (slotsDefinition && slotsDefinition.length > 0) {
            // Fetch options (products) for each slot's linked category
            const optionsPromises = slotsDefinition.map(async (slot) => {
                // Fetch products from the linked category (these are the modifier options)
                // Use getModifiersByCategory instead of getProductsByCategory for modifier options
                const options = await getModifiersByCategory(slot.linked_category_id);
                return { ...slot, options: options, selectedOptions: [] }; // Initialize state
            });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: `Fallo al cargar modificadores para producto ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]); // Removed getModifiersByCategory from dependencies as it's stable

   // Fetch details for a package, including its items and their modifier slots/overrides
   const fetchPackageDetails = useCallback(async (packageId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        setSelectedPackageDetail(null); // Clear previous detail
        try {
            // Package itself from 'packages' table
            const packageDef = await getPackageById(packageId); // Use getPackageById
            if (!packageDef) throw new Error("Paquete no encontrado");

            // Get the list of product IDs defined within this package
            const packageItems = await getItemsForPackage(packageId);

            // For each item in the package, fetch its base modifier slots & apply overrides
            const itemSlotsPromises = packageItems.map(async (item) => {
                // 1. Get the base modifier slots for the actual product in the package item (e.g., Alitas 6pz)
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);

                // 2. Get any overrides specific to this package item instance
                const overrides = await getOverridesForPackageItem(item.id);

                // 3. Apply overrides to the base slots
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    // If override exists, use its min/max, otherwise use slot's default
                    return override ? {
                        ...slot,
                        override: override, // Store the override object itself
                        min_quantity: override.min_quantity, // Directly use override values
                        max_quantity: override.max_quantity
                     } : slot;
                });
                return { packageItemId: item.id, slots: finalSlots };
            });

            const resolvedItemSlots = await Promise.all(itemSlotsPromises);

            // Create a map for easy lookup: { packageItemId: ModifierSlotState[] }
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
            setView('products'); // Go back if details fail
        } finally {
            setIsLoading(prev => ({ ...prev, packageDetails: false }));
        }
   }, [toast, fetchAndPrepareModifierSlots]);


  // --- UI Interaction Handlers ---

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    fetchProductsAndPackages(category.id); // Fetch products and/or packages
    setView('products'); // Show the list of items in that category
  };

  // Handles click on a regular product
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product); // Store the clicked product

    // Check inventory for the base product
     if (product.inventory_item_id) {
       const invItem = inventoryMap.get(product.inventory_item_id);
       const consumed = product.inventory_consumed_per_unit ?? 0;
       if (!invItem || invItem.current_stock < consumed) {
            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${product.name}.`, variant: "destructive" });
            setSelectedProduct(null); // Reset selection
            return; // Stop processing
       }
     }

     // Fetch its modifier slots
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setCurrentModifierSlots(slots); // Set state for modifier selection UI
        setView('modifiers'); // Go to modifier selection view
    } else {
         // No modifiers, add directly to order (price is just base price)
        addProductToOrder(product, [], product.price);
         toast({ title: `${product.name} añadido`, description: 'Sin modificadores' });
         // Stay on products view for potential further additions
         setView('products');
         setSelectedProduct(null); // Reset selection after adding
    }

  };

  // Handles click on a package displayed in the list
  const handlePackageClick = async (pkg: Package) => {
    setSelectedPackage(pkg); // Store the selected package definition
    // Fetch full details including items and their potential modifier overrides
    await fetchPackageDetails(pkg.id);
    // View is changed within fetchPackageDetails to 'package-details'
  };


   // Generic handler for selecting/deselecting modifier options
   // Works for both regular product modifiers and modifiers within package items
   const handleModifierOptionChange = (
        slotId: string,
        optionProductId: string, // The ID of the product being selected as modifier (e.g., 'prod-salsa-bbq')
        optionName: string,
        optionPriceModifier: number, // Price of the modifier product itself (often 0 for sauces)
        context: 'product' | 'package', // Where is this change happening?
        packageItemId?: string // Only provided for 'package' context
    ) => {

        // Function to update a list of slots based on selection change
        const updateSlotsLogic = (prevSlots: ModifierSlotState[]): ModifierSlotState[] => {
            return prevSlots.map(slot => {
                if (slot.id === slotId) {
                    const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                    let newSelections = [...slot.selectedOptions];
                    // Use override min/max if available (from slot state), otherwise use slot definition defaults
                    const minQty = slot.min_quantity; // Already adjusted if override exists
                    const maxQty = slot.max_quantity; // Already adjusted if override exists

                    // Check inventory for the modifier option itself (if applicable)
                    const modifierProductDetails = slot.options.find(opt => opt.id === optionProductId);
                    if (modifierProductDetails?.inventory_item_id) {
                         const invItem = inventoryMap.get(modifierProductDetails.inventory_item_id);
                         const consumed = modifierProductDetails.inventory_consumed_per_unit ?? 0;
                         if (!isSelected && (!invItem || invItem.current_stock < consumed)) {
                            toast({ title: "Sin Stock", description: `No hay suficiente ${invItem?.name || 'inventario'} para ${optionName}.`, variant: "destructive" });
                            return slot; // Prevent selection
                         }
                    }


                    if (isSelected) {
                        // Deselect: Filter out the option
                        newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                         // Check minimum only on final add, not during selection changes for better UX
                        // if (newSelections.length < minQty) {
                        //      toast({ title: "Minimum Not Met", description: `Requires at least ${minQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                        // }
                    } else {
                        // Select: Check if adding violates max quantity
                        if (newSelections.length < maxQty) {
                            newSelections.push({
                                productId: optionProductId,
                                name: optionName,
                                priceModifier: optionPriceModifier, // Price of the modifier itself
                                slotId: slotId,
                                // packageItemId might be added later if needed in SelectedModifierItem type
                            });
                        } else {
                            toast({ title: "Límite Alcanzado", description: `No se puede seleccionar más de ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                            return slot; // Return unchanged slot if max reached
                        }
                    }
                    return { ...slot, selectedOptions: newSelections };
                }
                return slot;
            });
        };

        // Update the correct state based on the context
        if (context === 'product') {
            setCurrentModifierSlots(updateSlotsLogic);
        } else if (context === 'package' && packageItemId && selectedPackageDetail) {
            // Update the specific slot within the selectedPackageDetail state
            setSelectedPackageDetail(prevDetail => {
                if (!prevDetail) return null;
                 // Deep copy might be safer, but careful mapping can work too
                 const updatedItemSlots = { ...prevDetail.itemSlots };
                 if(updatedItemSlots[packageItemId]) {
                    updatedItemSlots[packageItemId] = updateSlotsLogic(updatedItemSlots[packageItemId]);
                 }
                 return { ...prevDetail, itemSlots: updatedItemSlots };
            });
        } else {
            console.error("Invalid context for handleModifierOptionChange", { context, packageItemId });
            toast({ title: "Error Interno", description: "No se pudo actualizar la selección de modificadores.", variant: "destructive"});
        }
    };


  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;

    // Validate min quantity for each slot
    for (const slot of currentModifierSlots) {
        const minQty = slot.min_quantity;
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selección Incompleta", description: `Debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
            return; // Stop adding
        }
    }

    // Calculate total price for one unit including modifiers
    // Base price + sum of modifier product prices
    const chosenModifiers = currentModifierSlots.flatMap(slot => slot.selectedOptions);
    const modifierPriceTotal = chosenModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const pricePerUnit = selectedProduct.price + modifierPriceTotal;

    // Add to order
    addProductToOrder(selectedProduct, chosenModifiers, pricePerUnit);

     toast({
        title: `${selectedProduct.name} añadido`,
        description: chosenModifiers.length > 0 ? `Modificadores: ${chosenModifiers.map(m => m.name).join(', ')}` : 'Sin modificadores',
    });

    // Reset and go back
    resetProductSelection();
  };

   const handleAddPackageToOrder = async () => { // Make async for product detail fetching
        if (!selectedPackageDetail) return;

        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;

        // --- Inventory Check for Package ---
        let inventoryOk = true;
        const tempInventoryChanges: Record<string, number> = {}; // Track changes within the package

        // Check base package item inventory (IF packages table had inventory link - it doesn't currently)
        // For now, we only check the contained products and modifiers.

        // Fetch product details for all items and modifiers within the package
        const allProductIdsInPackage = new Set<string>();
        packageItems.forEach(item => allProductIdsInPackage.add(item.product_id));
        Object.values(itemSlots).flat().forEach(slot => {
            slot.options.forEach(opt => allProductIdsInPackage.add(opt.id)); // Modifier options
            slot.selectedOptions.forEach(sel => allProductIdsInPackage.add(sel.productId)); // Selected modifiers
        });

        const productDetailsMap = new Map<string, Product>();
        const productFetchPromises = Array.from(allProductIdsInPackage).map(id =>
            getProductById(id).catch(err => {
                console.error(`Error fetching details for product ID ${id} in package:`, err);
                toast({ title: "Error Interno", description: `No se pudo obtener detalle del producto ID ${id}.`, variant: "destructive" });
                return null; // Return null on error
            })
        );
        const fetchedProducts = await Promise.all(productFetchPromises);
        fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });


        // Check inventory for each product within the package and their selected modifiers
        for (const item of packageItems) {
            // const productDetails = products.find(p => p.id === item.product_id) || // Check fetched products
            //                          packages.find(p => p.id === item.product_id); // Check fetched packages (if a package contains another package?)
            const productDetails = productDetailsMap.get(item.product_id);

            if (!productDetails) {
                toast({ title: "Error", description: `Definición de producto para ${item.product_name} no encontrada.`, variant: "destructive" });
                inventoryOk = false;
                break; // Stop checking if definition is missing
            }

            // Check the product itself
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

            // Check selected modifiers for this package item
            const slots = itemSlots[item.id] || [];
            for (const slot of slots) {
                 // Validate min quantity
                const minQty = slot.min_quantity; // Already adjusted for override
                if (slot.selectedOptions.length < minQty) {
                     toast({
                        title: "Selección Incompleta",
                        description: `Para "${item.product_name}", debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`,
                        variant: "destructive"
                    });
                    inventoryOk = false;
                    break;
                }

                 // Check modifier inventory
                 for (const modOption of slot.selectedOptions) {
                     // const modProductDetails = slot.options.find(opt => opt.id === modOption.productId);
                     const modProductDetails = productDetailsMap.get(modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * item.quantity; // Assume mod consumed per package item qty
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
        // --- End Inventory Check ---

        if (!inventoryOk) {
            return; // Stop if inventory check failed or min quantity not met
        }

        // --- Add Package to Order ---
        // Collect all selected modifiers from all items in the package
         const allSelectedModifiersNested = packageItems.map(item => {
            const slots = itemSlots[item.id] || [];
            return slots.flatMap(slot => slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id}))); // Add packageItemId context
         }).flat();

        const packagePrice = packageDef.price; // Package price is fixed

        const newOrderItem: OrderItem = {
            type: 'package',
            id: packageDef.id, // ID of the package from 'packages' table
            name: packageDef.name,
            quantity: 1,
            basePrice: packagePrice, // Fixed price of the package product
            selectedModifiers: allSelectedModifiersNested, // Store all chosen modifiers within package context
            totalPrice: packagePrice, // Total price for one package (usually just basePrice)
            uniqueId: Date.now().toString() + Math.random().toString(),
             // Store details of the items and their specific modifiers *within* this package instance
             packageItems: packageItems.map(item => ({
                 packageItemId: item.id, // ID of the PackageItem definition line
                 productId: item.product_id,
                 productName: item.product_name || 'Unknown Product', // Use joined name
                 // Get selected modifiers only for this specific item instance
                 selectedModifiers: (itemSlots[item.id] || []).flatMap(slot => slot.selectedOptions)
            }))
        };

        setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

         toast({
            title: `Paquete "${packageDef.name}" añadido`,
        });

        // Reset and go back
        resetPackageSelection();
   };

  // Add regular product to order
  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[], pricePerUnit: number) => {

    const newOrderItem: OrderItem = {
      type: 'product',
      id: product.id,
      name: product.name,
      quantity: 1,
      basePrice: product.price, // Price before modifiers
      selectedModifiers: modifiers,
      totalPrice: pricePerUnit, // Price including modifiers for quantity 1
      uniqueId: Date.now().toString() + Math.random().toString(), // Simple unique ID
    };

    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));
    // Toast is handled in the calling function (handleProductClick or handleAddProductWithModifiers)
  };


   // Effect to calculate totals whenever order items change
  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    // Simple total calculation for now, add tax/discounts later if needed
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal }));
  }, [currentOrder.items]);

  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta); // Allow quantity to become 0
           // Recalculate price per unit based on base + modifiers (for product) or fixed base (for package)
           let pricePerUnit = 0;
           if (item.type === 'product') {
              const modifierPriceTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
              pricePerUnit = item.basePrice + modifierPriceTotal;
           } else { // 'package'
              pricePerUnit = item.basePrice; // Package price is fixed per unit
           }

            // --- Inventory Check on Quantity Increase ---
             if (delta > 0) {
                let checkOk = true;
                // Find the product/package definition
                // Need async check here, potentially complex. For simplicity, skipping deep check for now.
                // const details = item.type === 'product' ? productDetailsMap.get(item.id) : packageDetailsMap.get(item.id);
                console.warn("Inventory check on quantity increase is simplified. Relying on initial add check.");

                // Simple check for the main item if it's a product
                // if (item.type === 'product') {
                //    const productDetails = products.find(p => p.id === item.id);
                //    if (productDetails?.inventory_item_id) {
                //        const invItem = inventoryMap.get(productDetails.inventory_item_id);
                //        const consumed = productDetails.inventory_consumed_per_unit ?? 0;
                //        if (!invItem || invItem.current_stock < consumed * newQuantity) { // Check total needed
                //            toast({ title: "Stock Insuficiente", description: `No hay inventario para ${newQuantity}x ${item.name}.`, variant: "destructive" });
                //            checkOk = false;
                //        }
                //    }
                // }

                if (!checkOk) return item; // Return original item if check fails
            }
             // --- End Inventory Check ---


          return {
            ...item,
            quantity: newQuantity,
            totalPrice: pricePerUnit * newQuantity, // Update total price based on new quantity
          };
        }
        return item;
      });
      updatedItems = updatedItems.filter(item => item.quantity > 0); // Remove item if quantity is 0

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

  // Function to clear the entire order
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
    setView('products'); // Go back to the list for the current category
  }

  const resetPackageSelection = () => {
    setSelectedPackage(null);
    setSelectedPackageDetail(null);
    setView('products'); // Go back to the list for the current category
  }


  const handleBack = () => {
    if (view === 'modifiers') {
      resetProductSelection();
    } else if (view === 'package-details') {
       resetPackageSelection();
    } else if (view === 'products') { // Unified view for products & packages
      setView('categories');
      setSelectedCategory(null);
      setProducts([]);
      setPackages([]);
    }
  };

    // Effect to calculate change due
  useEffect(() => {
    if (currentOrder.paymentMethod === 'cash') {
      const paid = parseFloat(paidAmountInput) || 0;
      const change = paid - currentOrder.total;
      setCurrentOrder(prev => ({
        ...prev,
        paidAmount: paid,
        changeDue: change >= 0 ? change : undefined // Only set if non-negative
      }));
    } else {
      // Reset cash specific fields if payment method changes
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

  const handleFinalizeOrder = async () => {
    if (currentOrder.items.length === 0) {
      toast({ title: "Pedido Vacío", description: "Por favor añade items al pedido.", variant: 'destructive' });
      return;
    }
     if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < currentOrder.total)) {
       toast({ title: "Pago Incompleto", description: "La cantidad pagada en efectivo es menor que el total.", variant: 'destructive' });
      return;
    }

     // 1. Get existing orders to determine the next ID
     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try {
         existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({
             ...order,
             createdAt: new Date(order.createdAt),
             // Ensure required fields exist and have correct types
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
     } catch (e) { console.error("Error parsing existing orders", e); }

     const newOrderId = generateOrderId(existingOrders.length);
     const newOrderNumber = existingOrders.length + 1;

     // --- Inventory Adjustment ---
     setIsLoading(prev => ({ ...prev, inventory: true }));
     const inventoryAdjustments: Record<string, { change: number, name: string }> = {}; // Key: inventory_item_id, Value: {total quantity change, item name}
     let inventoryAdjustmentFailed = false;

     try {
         // Pre-fetch necessary product details to avoid awaits inside the loop
          const allProductIds = new Set<string>();
          currentOrder.items.forEach(item => {
             // For products, use the item ID directly.
             // For packages, we need the IDs of the products *inside* the package.
             if (item.type === 'product') {
                allProductIds.add(item.id);
                item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             } else if (item.type === 'package' && item.packageItems) {
                // Don't add the package ID itself unless it directly consumes inventory (which it doesn't now)
                item.packageItems.forEach(pkgItem => {
                     allProductIds.add(pkgItem.productId); // Product IDs within package
                     pkgItem.selectedModifiers.forEach(mod => allProductIds.add(mod.productId)); // Modifier IDs within package item
                 });
                 // Also need modifiers attached directly to the package order item (if any, though usually empty for packages)
                  item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId));
             }
         });

         const productDetailsMap = new Map<string, Product>();
         const productFetchPromises = Array.from(allProductIds).map(id => getProductById(id));
         const fetchedProducts = await Promise.all(productFetchPromises);
         fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });


         // Calculate inventory changes needed
         for (const orderItem of currentOrder.items) {

             // 1. Consume inventory for regular products and their modifiers
             if (orderItem.type === 'product') {
                 const itemDetails = productDetailsMap.get(orderItem.id);
                 if (!itemDetails) continue; // Should not happen if pre-fetched

                 // Consume inventory for the main product itself
                 if (itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                     const invItemId = itemDetails.inventory_item_id;
                     const change = -(itemDetails.inventory_consumed_per_unit * orderItem.quantity);
                     const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                     inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                 }

                 // Consume inventory for selected modifiers
                 for (const modifier of orderItem.selectedModifiers) {
                     const modDetails = productDetailsMap.get(modifier.productId);
                     if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                         const invItemId = modDetails.inventory_item_id;
                         const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity); // Modifier consumption per main item qty
                         const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                         inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }
                 }
             }
             // 2. Consume inventory for items AND their modifiers within a package
             else if (orderItem.type === 'package' && orderItem.packageItems) {
                 for (const pkgItem of orderItem.packageItems) {
                     const pkgItemDetails = productDetailsMap.get(pkgItem.productId);
                     if (!pkgItemDetails) continue;

                     // Consume for the package item's product
                     if (pkgItemDetails.inventory_item_id && pkgItemDetails.inventory_consumed_per_unit) {
                          const invItemId = pkgItemDetails.inventory_item_id;
                          // Consumption = product's consumption * quantity defined in package * quantity of package in order
                          // Assume package item quantity is defined in package_items table (or default 1)
                           const packageItemDef = packageItems.find(pi => pi.id === pkgItem.packageItemId);
                           const itemQtyInPackage = packageItemDef?.quantity || 1;
                           const change = -(pkgItemDetails.inventory_consumed_per_unit * itemQtyInPackage * orderItem.quantity);
                          const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                          inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }

                     // Consume for the package item's selected modifiers
                      for (const modifier of pkgItem.selectedModifiers) {
                         const modDetails = productDetailsMap.get(modifier.productId);
                         if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                             const invItemId = modDetails.inventory_item_id;
                              // Modifier consumption per overall package qty
                              const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity);
                             const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Inv Item Desc.' };
                             inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                         }
                     }
                 }
             }
         }

         // Perform inventory adjustments
         const adjustmentPromises: Promise<void>[] = [];
         for (const [itemId, { change, name }] of Object.entries(inventoryAdjustments)) {
             if (change !== 0) {
                 console.log(`Adjusting inventory for ${name} (ID: ${itemId}) by ${change}`);
                 adjustmentPromises.push(adjustInventoryStock(itemId, change));
             }
         }
         await Promise.all(adjustmentPromises);

          // Update local inventory map state after successful adjustment
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
         return; // Stop order finalization if inventory fails
     }
     // --- End Inventory Adjustment ---


    // 2. Format the new order object to match SavedOrder
     const finalizedOrder: SavedOrder = {
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => {
          let components: { name: string; slotLabel?: string }[] = [];

          // If it's a package, list its contents and their specific modifiers
           if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                    // Add the package item itself
                    components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido' });
                     // Add modifiers specific to this package item
                    if (pkgItem.selectedModifiers.length > 0) {
                         pkgItem.selectedModifiers.forEach(mod => {
                            // Try to find slot label from package detail state if available
                             let slotLabel = 'Mod';
                             if (selectedPackageDetail && selectedPackageDetail.itemSlots[pkgItem.packageItemId]) {
                                 const slot = selectedPackageDetail.itemSlots[pkgItem.packageItemId].find(s => s.id === mod.slotId);
                                 slotLabel = slot?.label || `Mod (${pkgItem.productName})`;
                             }
                             components.push({ name: `↳ ${mod.name}`, slotLabel: slotLabel});
                         });
                    }
                });
           }
           // If it's a regular product, list its modifiers
           else if (item.type === 'product' && item.selectedModifiers.length > 0) {
                 item.selectedModifiers.forEach(mod => {
                     // Try to find the slot label from the current modifier state
                     const slot = currentModifierSlots.find(s => s.id === mod.slotId);
                     components.push({ name: mod.name, slotLabel: slot?.label || 'Mod' });
                 });
           }

          return {
              id: item.id, // productId or packageId
              name: item.name,
              quantity: item.quantity,
              price: item.basePrice, // Price *before* mods for product, package price for package
              totalItemPrice: item.totalPrice, // Store the final calculated price for this line item
              components: components,
          };
      }),
      paymentMethod: currentOrder.paymentMethod,
      subtotal: currentOrder.subtotal,
      total: currentOrder.total,
      status: 'completed', // Mark as completed directly for inventory
      createdAt: new Date(),
      paidAmount: currentOrder.paidAmount,
      changeGiven: currentOrder.changeDue,
    };

    // 3. Save to localStorage
    const updatedOrders = [...existingOrders, finalizedOrder];
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    // 4. Trigger Print (Simulated)
    console.log('--- Printing Kitchen Comanda ---');
    console.log(`Pedido #: ${finalizedOrder.orderNumber} (${finalizedOrder.id})`);
    console.log(`Cliente: ${finalizedOrder.customerName}`);
    console.log('-----------------------------');
    finalizedOrder.items.forEach(item => {
        console.log(`${item.quantity}x ${item.name} (${formatCurrency(item.price)} c/u)`);
        // Print simplified components/modifiers
        if (item.components.length > 0) {
             item.components.forEach(comp => {
                 console.log(`  - ${comp.slotLabel ? `[${comp.slotLabel}] ` : ''}${comp.name}`);
             });
        }
    });
    console.log('-----------------------------');
    console.log(`Total: ${formatCurrency(finalizedOrder.total)}`);
    console.log(`Forma Pago: ${finalizedOrder.paymentMethod}`);
     if(finalizedOrder.paymentMethod === 'cash' && finalizedOrder.paidAmount !== undefined) {
        console.log(`Pagado: ${formatCurrency(finalizedOrder.paidAmount)}`);
        console.log(`Cambio: ${formatCurrency(finalizedOrder.changeGiven ?? 0)}`);
    }
     console.log('-----------------------------');

    // 5. Reset state for a new order
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

  // --- Rendering Logic ---
  const renderContent = () => {
    switch (view) {
      case 'categories':
         if (isLoading.categories) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        // Filter out 'modificador' categories from the main view
        const displayCategories = categories.filter(cat => cat.type !== 'modificador');
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayCategories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-32 bg-secondary">
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div> // Placeholder icon
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

      case 'products': // Combined view for products and packages
        if (isLoading.products || isLoading.packages) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Categorías
            </Button>
            <h2 className="text-xl font-semibold mb-4">{selectedCategory?.name}</h2>

             {/* Packages Section */}
             {packages.length > 0 && (
                 <>
                    <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Paquetes Disponibles</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packages.map(pkg => ( // pkg is type Package
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

            {/* Products Section */}
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

            {/* Empty State */}
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
                            {slot.options.map(option => { // option is a Product (e.g., a sauce)
                                const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                const maxReached = slot.selectedOptions.length >= slot.max_quantity;
                                const isDisabled = !isSelected && maxReached;

                                 // Check inventory for the option
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
                                            option.price, // Pass the price of the modifier product itself
                                            'product' // Context is regular product
                                        )}
                                        className={cn(
                                            "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden relative", // Relative for badge
                                            isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                            (isDisabled || isOutOfStock) && "opacity-50 cursor-not-allowed bg-muted/50"
                                        )}
                                        title={isDisabled ? `Max (${slot.max_quantity}) alcanzado` : isOutOfStock ? `Sin Stock (${optionInvItemName})` : option.name}
                                        >
                                         {isOutOfStock && <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-xs px-1 py-0">Stock</Badge>}
                                         <span className="text-xs md:text-sm block">{option.name}</span>
                                         {/* Show price only if modifier itself has a price > 0 */}
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
                 {packageItems.map(item => ( // item is PackageItem definition
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        {/* Get the modifier slots applicable to this item within the package */}
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No hay opciones configurables para este item.</p>}
                            {(itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    {/* Display label, using override min/max */}
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && (
                                         <div className="mb-2 text-xs text-muted-foreground">Seleccionados: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                                     )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones disponibles para "{slot.label}". Verifica la categoría vinculada.</p>}
                                    {/* Grid for modifier options */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {slot.options.map(option => { // option is a Product (e.g., sauce)
                                            const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                            const maxQty = slot.max_quantity; // Already adjusted for override
                                            const maxReached = slot.selectedOptions.length >= maxQty;
                                            const isDisabled = !isSelected && maxReached;

                                             // Check inventory for the option
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
                                                        option.price, // Pass modifier product price
                                                        'package', // Context is package
                                                        item.id // Pass the package item ID
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]"> {/* Adjusted height */}
      {/* Main Content Area (Categories, Products, Modifiers) */}
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader>
                <CardTitle>Crear Pedido</CardTitle>
                <CardDescription>Selecciona categorías, productos, paquetes y modificadores.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                 <ScrollArea className="h-full pr-4"> {/* Add pr-4 for scrollbar space */}
                   {renderContent()}
                 </ScrollArea>
             </CardContent>
         </Card>
      </div>

      {/* Right Sidebar (Order Summary) */}
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
             {/* Customer Section */}
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

             {/* Items List */}
             <ScrollArea className="flex-grow mb-4 -mr-4 pr-4"> {/* Negative margin + padding for scrollbar */}
                {currentOrder.items.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">El pedido está vacío.</p>
                ) : (
                 <div className="space-y-3">
                 {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-sm border-b pb-2 last:border-b-0">
                         {/* Item Name and Price */}
                         <div className="flex justify-between items-start font-medium mb-1">
                             <div className='flex items-center gap-2'>
                                 {item.type === 'package' && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Paquete"/>}
                                 <span className="flex-1 mr-2">{item.name}</span>
                            </div>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          {/* Quantity Controls and Remove Button */}
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)} aria-label={`Reducir cantidad de ${item.name}`}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)} aria-label={`Aumentar cantidad de ${item.name}`}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)} aria-label={`Eliminar ${item.name} del pedido`}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {/* Modifier/Package Content Display */}
                         {(item.selectedModifiers.length > 0 || (item.type === 'package' && item.packageItems && item.packageItems.length > 0)) && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modificadores:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Detalles / Modificadores:</span>}
                                <ul className='list-disc list-inside pl-2'>
                                     {/* Package items and their modifiers */}
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
                                        // Regular product modifiers
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

             {/* Totals and Payment */}
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
                    disabled={currentOrder.items.length === 0 || isLoading.inventory} // Disable if empty or during inventory update
                    aria-label="Finalizar Pedido e Imprimir Ticket"
                >
                    {isLoading.inventory ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Printer className="mr-2 h-4 w-4" />
                    )}
                    Finalizar e Imprimir Ticket
                 </Button>
            </div>
         </Card>
       </div>
    </div>
  );
}
