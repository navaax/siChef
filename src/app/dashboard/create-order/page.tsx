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
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // For product images
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategory, // Added
    getPackageById, // Added
    getItemsForPackage, // Added
    getOverridesForPackageItem // Added
} from '@/services/product-service';
import { adjustInventoryStock } from '@/services/inventory-service'; // Added for inventory adjustment
import type {
    Category,
    Product,
    Package, // Added
    ProductModifierSlot, // Added
    PackageItem, // Added
    PackageItemModifierSlotOverride, // Added
    OrderItem,
    CurrentOrder,
    SelectedModifierItem, // Added
    SavedOrder
} from '@/types/product-types';

// --- Helper Functions ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const generateOrderId = (existingOrdersCount: number): string => {
  const nextId = existingOrdersCount + 1;
  return `siChef-${String(nextId).padStart(3, '0')}`;
};

// --- Component State ---
type View = 'categories' | 'products' | 'packages' | 'modifiers' | 'package-details';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[]; // Products from the linked category
    selectedOptions: SelectedModifierItem[]; // Modifiers chosen for this slot instance
    override?: PackageItemModifierSlotOverride; // Package-specific override rules
}

interface PackageDetailState {
    packageDef: Package;
    packageItems: PackageItem[]; // Items included in the package definition
    itemSlots: Record<string, ModifierSlotState[]>; // Key: PackageItem ID, Value: Its modifier slots
}

// --- Component ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null); // For configuring packages
  const [currentModifierSlots, setCurrentModifierSlots] = useState<ModifierSlotState[]>([]); // Holds state for modifier selection UI
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>({
    id: '', customerName: 'Guest', items: [], subtotal: 0, total: 0, paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  // State for fetched data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Products for the selected category
  const [packages, setPackages] = useState<Package[]>([]); // Packages for the selected category
  const [isLoading, setIsLoading] = useState({ categories: true, products: false, packages: false, modifiers: false, packageDetails: false });

  const { toast } = useToast();

  // --- Data Fetching Effects ---
  useEffect(() => {
    async function fetchCategories() {
      setIsLoading(prev => ({ ...prev, categories: true }));
      try {
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      } finally {
        setIsLoading(prev => ({ ...prev, categories: false }));
      }
    }
    fetchCategories();
  }, [toast]);

  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    try {
      const [fetchedProducts, fetchedPackages] = await Promise.all([
        getProductsByCategory(categoryId),
        getPackagesByCategory(categoryId) // Fetch packages too
      ]);
      setProducts(fetchedProducts);
      setPackages(fetchedPackages);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load items.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, products: false, packages: false }));
    }
  }, [toast]);

  // Fetches modifier slots and their options for a product
  const fetchAndPrepareModifierSlots = useCallback(async (productId: string): Promise<ModifierSlotState[]> => {
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    let preparedSlots: ModifierSlotState[] = [];
    try {
        const slots = await getModifierSlotsForProduct(productId);
        if (slots && slots.length > 0) {
            // Fetch options (products) for each slot's linked category
            const optionsPromises = slots.map(async (slot) => {
                const options = await getProductsByCategory(slot.linked_category_id);
                return { ...slot, options: options, selectedOptions: [] }; // Initialize state
            });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to load modifiers.", variant: "destructive" });
        // Decide how to handle failure - maybe return empty array?
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]);

   // Fetch details for a package, including its items and their modifier slots/overrides
   const fetchPackageDetails = useCallback(async (packageId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        try {
            const packageDef = await getPackageById(packageId);
            if (!packageDef) throw new Error("Package not found");

            const packageItems = await getItemsForPackage(packageId);

            const itemSlotsPromises = packageItems.map(async (item) => {
                // 1. Get the base modifier slots for the product in the package item
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);
                // 2. Get any overrides specific to this package item
                const overrides = await getOverridesForPackageItem(item.id);
                // 3. Apply overrides to the base slots
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    return override ? { ...slot, override: override, min_quantity: override.min_quantity, max_quantity: override.max_quantity } : slot;
                });
                return { packageItemId: item.id, slots: finalSlots };
            });

            const resolvedItemSlots = await Promise.all(itemSlotsPromises);
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
            toast({ title: "Error", description: `Failed to load package details: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
            setView('categories'); // Go back if details fail
        } finally {
            setIsLoading(prev => ({ ...prev, packageDetails: false }));
        }
   }, [toast, fetchAndPrepareModifierSlots]);


  // --- UI Interaction Handlers ---

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    fetchProductsAndPackages(category.id); // Fetch both products and packages
    setView('products'); // Initial view is products/packages list
  };

  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product);
    const slots = await fetchAndPrepareModifierSlots(product.id);
    if (slots.length > 0) {
        setCurrentModifierSlots(slots);
        setView('modifiers');
    } else {
        addProductToOrder(product, []); // Add directly if no modifiers
        setView('products'); // Stay on products view
    }
  };

   const handlePackageClick = async (pkg: Package) => {
      await fetchPackageDetails(pkg.id);
      // View is changed within fetchPackageDetails
   };


   // Handles selecting/deselecting a modifier option within a slot
   const handleModifierOptionChange = (
        slotId: string,
        optionProductId: string,
        optionName: string,
        optionPriceModifier: number | undefined, // Modifiers themselves might have price adjustments in future
        targetStateSetter: React.Dispatch<React.SetStateAction<ModifierSlotState[]>> | ((packageItemId: string, slotId: string, newSelections: SelectedModifierItem[]) => void) // Function type for package state update
    ) => {
        const updateSlots = (prevSlots: ModifierSlotState[]) => {
            return prevSlots.map(slot => {
                if (slot.id === slotId) {
                    const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                    let newSelections = [...slot.selectedOptions];

                    if (isSelected) {
                        // Deselect
                        newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                    } else {
                        // Select - check max quantity
                         const maxQty = slot.override?.max_quantity ?? slot.max_quantity;
                        if (newSelections.length < maxQty) {
                            newSelections.push({
                                productId: optionProductId,
                                name: optionName,
                                priceModifier: optionPriceModifier ?? 0,
                                slotId: slotId,
                            });
                        } else {
                            // Optionally show a toast or message that max quantity is reached
                            toast({ title: "Limite Alcanzado", description: `Solo puedes seleccionar hasta ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                            return slot; // Return unchanged slot
                        }
                    }
                    return { ...slot, selectedOptions: newSelections };
                }
                return slot;
            });
        };

        // Determine which state to update
        if (typeof targetStateSetter === 'function' && view !== 'package-details') {
            // Updating regular product modifier slots
            (targetStateSetter as React.Dispatch<React.SetStateAction<ModifierSlotState[]>>)(updateSlots);
        } else if (typeof targetStateSetter === 'function' && view === 'package-details') {
             // Updating slots within a package item (requires packageItemId)
             // This scenario needs the calling context to provide packageItemId
             console.warn("Modifier change within package needs packageItemId");
             // Example of how the calling context would use it:
             // handleModifierOptionChange(slot.id, option.id, option.name, option.price,
             //   (pItemId, sId, newSelections) => updatePackageItemSlotSelections(pItemId, sId, newSelections)
             // );
        } else {
            console.error("Invalid targetStateSetter provided to handleModifierOptionChange");
        }
    };

    // Specific handler for updating slots within the selectedPackageDetail state
    const updatePackageItemSlotSelections = (packageItemId: string, slotId: string, newSelections: SelectedModifierItem[]) => {
        setSelectedPackageDetail(prevDetail => {
            if (!prevDetail) return null;

            const updatedSlotsMap = { ...prevDetail.itemSlots };
            if (updatedSlotsMap[packageItemId]) {
                updatedSlotsMap[packageItemId] = updatedSlotsMap[packageItemId].map(slot =>
                    slot.id === slotId ? { ...slot, selectedOptions: newSelections } : slot
                );
            }

            return {
                ...prevDetail,
                itemSlots: updatedSlotsMap
            };
        });
    };


  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;

    // Validate min quantity for each slot
    for (const slot of currentModifierSlots) {
        const minQty = slot.override?.min_quantity ?? slot.min_quantity;
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selección Incompleta", description: `Debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
            return; // Stop adding
        }
    }

    const chosenModifiers = currentModifierSlots.flatMap(slot => slot.selectedOptions);
    addProductToOrder(selectedProduct, chosenModifiers);

    // Reset and go back
    resetProductSelection();
  };

   const handleAddPackageToOrder = () => {
        if (!selectedPackageDetail) return;

        // Validate min quantity for all slots within the package
        let allModifiersForPackage: SelectedModifierItem[] = [];
        for (const item of selectedPackageDetail.packageItems) {
            const slots = selectedPackageDetail.itemSlots[item.id] || [];
            for (const slot of slots) {
                const minQty = slot.override?.min_quantity ?? slot.min_quantity;
                if (slot.selectedOptions.length < minQty) {
                    toast({
                        title: "Selección Incompleta",
                        description: `Para "${item.product_name}" debes seleccionar al menos ${minQty} ${slot.label.toLowerCase()}.`,
                        variant: "destructive"
                    });
                    return; // Stop adding
                }
                 // Collect modifiers, potentially adding packageItemId for context if needed later
                 allModifiersForPackage.push(...slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id}))); // Add packageItemId context
            }
        }

        // Add package to order
        addPackageToOrder(selectedPackageDetail.packageDef, selectedPackageDetail.packageItems, selectedPackageDetail.itemSlots);

        // Reset and go back
        resetPackageSelection();
   };

  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[]) => {
    // Modifiers might have price adjustments in the future, calculate if needed
    const modifierPrice = modifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const itemPrice = product.price + modifierPrice;

    const newOrderItem: OrderItem = {
      type: 'product',
      id: product.id,
      name: product.name,
      quantity: 1,
      basePrice: product.price,
      selectedModifiers: modifiers,
      totalPrice: itemPrice, // Price for quantity 1 initially
      uniqueId: Date.now().toString() + Math.random().toString(), // Simple unique ID
    };

    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

    toast({
        title: `${product.name} añadido`,
        description: `Modificadores: ${modifiers.map(m => m.name).join(', ') || 'Ninguno'}`,
    });
  };

  const addPackageToOrder = (
        packageDef: Package,
        packageItems: PackageItem[],
        itemSlotsMap: Record<string, ModifierSlotState[]> // Contains selected options
    ) => {
        // Collect all selected modifiers from all items in the package
         const allSelectedModifiers = packageItems.flatMap(item => {
            const slots = itemSlotsMap[item.id] || [];
            return slots.flatMap(slot => slot.selectedOptions);
         });


        const newOrderItem: OrderItem = {
            type: 'package',
            id: packageDef.id,
            name: packageDef.name,
            quantity: 1,
            basePrice: packageDef.price,
            selectedModifiers: allSelectedModifiers, // Store all modifiers at the top level for simplicity in cart display
            totalPrice: packageDef.price, // Package price is fixed, modifiers assumed included unless specified otherwise
            uniqueId: Date.now().toString() + Math.random().toString(),
             packageItems: packageItems.map(item => ({ // Store details for potential breakdown display
                 packageItemId: item.id,
                 productId: item.product_id,
                 productName: item.product_name || 'Unknown Product',
                 selectedModifiers: (itemSlotsMap[item.id] || []).flatMap(slot => slot.selectedOptions)
            }))
        };

        setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

         toast({
            title: `Paquete "${packageDef.name}" añadido`,
            // description: `Incluye: ${packageItems.map(i => i.product_name).join(', ')}`,
        });
  };


   // Effect to calculate totals whenever order items change
  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal }));
  }, [currentOrder.items]);

  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta); // Allow quantity to become 0
          // Price calculation depends on type
          const pricePerUnit = item.basePrice + (item.type === 'product' ? item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0) : 0);
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: pricePerUnit * newQuantity,
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
        title: `Item removed from order`,
        variant: 'destructive'
    })
  };

  const resetProductSelection = () => {
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    setView('products');
  }

  const resetPackageSelection = () => {
    setSelectedPackageDetail(null);
    setView('products'); // Or 'packages' if you have a dedicated view
  }


  const handleBack = () => {
    if (view === 'modifiers') {
      resetProductSelection();
    } else if (view === 'package-details') {
       resetPackageSelection();
    } else if (view === 'products' || view === 'packages') {
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
        changeDue: change >= 0 ? change : undefined
      }));
    } else {
      setCurrentOrder(prev => ({ ...prev, paidAmount: undefined, changeDue: undefined }));
      setPaidAmountInput('');
    }
  }, [paidAmountInput, currentOrder.total, currentOrder.paymentMethod]);


  const handleSaveCustomer = () => {
      if(customerName.trim()){
        setCurrentOrder(prev => ({ ...prev, customerName: customerName }));
        setIsRegisteringCustomer(false);
        toast({ title: "Customer Saved", description: `Order associated with ${customerName}` });
      } else {
           toast({ title: "Invalid Name", description: "Please enter a customer name.", variant: 'destructive' });
      }
  };

  const handleFinalizeOrder = async () => { // Make async for inventory adjustment
    if (currentOrder.items.length === 0) {
      toast({ title: "Empty Order", description: "Please add items to the order.", variant: 'destructive' });
      return;
    }
     if (currentOrder.paymentMethod === 'cash' && (currentOrder.changeDue === undefined || currentOrder.changeDue < 0)) {
       toast({ title: "Payment Incomplete", description: "Please enter a valid amount paid in cash.", variant: 'destructive' });
      return;
    }

     // 1. Get existing orders to determine the next ID
     const storedOrdersString = localStorage.getItem('siChefOrders') || '[]';
     let existingOrders: SavedOrder[] = [];
     try {
         existingOrders = JSON.parse(storedOrdersString).map((order: any) => ({
             ...order,
             createdAt: new Date(order.createdAt)
         }));
     } catch (e) { console.error("Error parsing existing orders", e); }

     const newOrderId = generateOrderId(existingOrders.length);
     const newOrderNumber = existingOrders.length + 1;

     // --- Inventory Adjustment ---
     const inventoryAdjustments: Record<string, number> = {}; // Key: inventory_item_id, Value: total quantity change

     for (const orderItem of currentOrder.items) {
         if (orderItem.type === 'product') {
             // Fetch product details to get inventory link
             const productDetails = await getProductById(orderItem.id);
             if (productDetails?.inventory_item_id && productDetails.inventory_consumed_per_unit) {
                 const change = -(productDetails.inventory_consumed_per_unit * orderItem.quantity);
                 inventoryAdjustments[productDetails.inventory_item_id] = (inventoryAdjustments[productDetails.inventory_item_id] || 0) + change;
             }
         } else if (orderItem.type === 'package' && orderItem.packageItems) {
             for (const pkgItem of orderItem.packageItems) {
                 const productDetails = await getProductById(pkgItem.productId);
                 if (productDetails?.inventory_item_id && productDetails.inventory_consumed_per_unit) {
                      // Adjust based on product consumption * package item quantity * order item quantity
                     const change = -(productDetails.inventory_consumed_per_unit * 1 * orderItem.quantity); // Assuming pkgItem quantity is handled by product definition? Revisit if pkgItem.quantity matters here.
                     inventoryAdjustments[productDetails.inventory_item_id] = (inventoryAdjustments[productDetails.inventory_item_id] || 0) + change;
                 }
             }
         }
         // Note: Modifiers currently don't affect inventory, add logic if they do (e.g., extra cheese)
     }

     // Perform inventory adjustments
     try {
        for (const [itemId, change] of Object.entries(inventoryAdjustments)) {
             if (change !== 0) { // Only adjust if there's a change
                await adjustInventoryStock(itemId, change);
                console.log(`Adjusted inventory for ${itemId} by ${change}`);
             }
        }
     } catch (error) {
          toast({ title: "Inventory Error", description: `Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}. Order not saved.`, variant: "destructive" });
          return; // Stop order finalization if inventory fails
     }
     // --- End Inventory Adjustment ---


    // 2. Format the new order object to match SavedOrder
     const finalizedOrder: SavedOrder = {
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => ({
          id: item.id, // productId or packageId
          name: item.name,
          quantity: item.quantity,
          price: item.basePrice,
          // Simplified components - just list modifier names
          components: item.selectedModifiers.map(m => ({ name: m.name, slotLabel: `Slot ${m.slotId}` })), // Maybe improve this representation
          // isApart logic needs review based on new modifier system
      })),
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
    currentOrder.items.forEach(item => {
        console.log(`${item.quantity}x ${item.name} (${formatCurrency(item.basePrice)} each) ${item.type === 'package' ? '[PAQUETE]' : ''}`);
        if (item.selectedModifiers.length > 0) {
             // Group modifiers by slot for better readability
             const groupedModifiers: Record<string, string[]> = {};
             item.selectedModifiers.forEach(mod => {
                 const slotLabel = currentModifierSlots.find(s => s.id === mod.slotId)?.label || mod.slotId; // Find label or use ID
                 if (!groupedModifiers[slotLabel]) {
                    groupedModifiers[slotLabel] = [];
                 }
                 groupedModifiers[slotLabel].push(mod.name);
             });
             for (const [slotLabel, mods] of Object.entries(groupedModifiers)) {
                console.log(`  [${slotLabel}]: ${mods.join(', ')}`);
             }
        }
         // Optional: Print package contents breakdown
        if(item.type === 'package' && item.packageItems){
            item.packageItems.forEach(pkgItem => {
                 console.log(`    - ${pkgItem.productName}`);
                 const pkgItemMods = pkgItem.selectedModifiers;
                 if(pkgItemMods.length > 0){
                     const groupedPkgMods: Record<string, string[]> = {};
                     pkgItemMods.forEach(mod => {
                         const slotLabel = selectedPackageDetail?.itemSlots[pkgItem.packageItemId]?.find(s => s.id === mod.slotId)?.label || mod.slotId;
                         if (!groupedPkgMods[slotLabel]) groupedPkgMods[slotLabel] = [];
                         groupedPkgMods[slotLabel].push(mod.name);
                     });
                     for (const [slotLabel, mods] of Object.entries(groupedPkgMods)) {
                        console.log(`      [${slotLabel}]: ${mods.join(', ')}`);
                     }
                 }
            });
        }
    });
    console.log('-----------------------------');
    console.log(`Total: ${formatCurrency(finalizedOrder.total)}`);
    console.log(`Payment: ${finalizedOrder.paymentMethod}`);
     if(finalizedOrder.paymentMethod === 'cash') {
        console.log(`Paid: ${formatCurrency(finalizedOrder.paidAmount || 0)}`);
        console.log(`Change: ${formatCurrency(finalizedOrder.changeGiven || 0)}`);
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
    setSelectedPackageDetail(null);
    setProducts([]);
    setPackages([]);

    toast({ title: "Order Finalized", description: `${finalizedOrder.id} created and sent to kitchen.` });
  };

  // --- Rendering Logic ---
  const renderContent = () => {
    switch (view) {
      case 'categories':
        // ... (keep existing category rendering)
         if (isLoading.categories) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-32 bg-secondary">
                  {cat.imageUrl && <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />}
                   {!cat.imageUrl && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>}
                 </div>
                 <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm md:text-base">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        );

      case 'products': // Combined view for products and packages
        if (isLoading.products || isLoading.packages) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Categories
            </Button>
            <h2 className="text-xl font-semibold mb-4">{selectedCategory?.name}</h2>
             {/* Packages Section */}
             {packages.length > 0 && (
                 <>
                    <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Paquetes</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packages.map(pkg => (
                        <Card key={pkg.id} onClick={() => handlePackageClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                            <div className="relative w-full h-32 bg-secondary">
                            {pkg.imageUrl && <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal" />}
                            {!pkg.imageUrl && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>}
                                <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent">Paquete</Badge>
                            </div>
                        <CardHeader className="p-3">
                            <CardTitle className="text-sm md:text-base">{pkg.name}</CardTitle>
                            <CardDescription className="text-xs md:text-sm">{formatCurrency(pkg.price)}</CardDescription>
                        </CardHeader>
                        </Card>
                    ))}
                    </div>
                    <Separator className="my-6"/>
                    <h3 className="text-lg font-medium mb-3 text-primary">Productos Individuales</h3>
                 </>
             )}

            {/* Products Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map(prod => (
                <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                    <div className="relative w-full h-32 bg-secondary">
                      {prod.imageUrl && <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food" />}
                       {!prod.imageUrl && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>}
                     </div>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm md:text-base">{prod.name}</CardTitle>
                    <CardDescription className="text-xs md:text-sm">{formatCurrency(prod.price)}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
               {products.length === 0 && packages.length === 0 && <p className="col-span-full text-center text-muted-foreground">No items in this category.</p>}
               {products.length === 0 && packages.length > 0 && <p className="col-span-full text-center text-muted-foreground">No individual products in this category.</p>}
            </div>
          </>
        );

     case 'modifiers':
         if (isLoading.modifiers) {
             return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
         }
         if (!selectedProduct) return <p>Error: No product selected.</p>; // Should not happen
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to {selectedCategory?.name || 'Products'}
            </Button>
             <h2 className="text-xl font-semibold mb-2">{selectedProduct.name} - {formatCurrency(selectedProduct.price)}</h2>

             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4">No hay modificadores disponibles para este producto.</p>}

             <div className="space-y-6">
                {currentModifierSlots.map(slot => (
                    <div key={slot.id}>
                        <h3 className="text-lg font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                         {slot.selectedOptions.length > 0 && (
                             <div className="mb-2 text-xs text-muted-foreground">Seleccionado: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                         )}
                         {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones disponibles para "{slot.label}".</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {slot.options.map(option => {
                                const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                const isDisabled = !isSelected && slot.selectedOptions.length >= slot.max_quantity;
                                return (
                                    <Card
                                        key={option.id}
                                        onClick={() => !isDisabled && handleModifierOptionChange(slot.id, option.id, option.name, option.price, setCurrentModifierSlots)}
                                        className={cn(
                                            "cursor-pointer hover:shadow-md transition-all text-center text-xs p-2 overflow-hidden",
                                            isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                            isDisabled && "opacity-50 cursor-not-allowed bg-muted/50"
                                        )}
                                        title={isDisabled ? `Máximo (${slot.max_quantity}) alcanzado` : option.name}
                                        >
                                        {/* Basic name display for modifiers */}
                                        {option.name}
                                         {option.price > 0 && <span className="block text-muted-foreground">{formatCurrency(option.price)}</span>}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ))}
             </div>

            <Button onClick={handleAddProductWithModifiers} className="w-full mt-6">
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar al Pedido
            </Button>
          </>
        );

    case 'package-details':
        if (isLoading.packageDetails) {
           return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        if (!selectedPackageDetail) return <p>Error: No package selected.</p>;

        return (
            <>
             <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to {selectedCategory?.name || 'Items'}
             </Button>
             <h2 className="text-xl font-semibold mb-1">{selectedPackageDetail.packageDef.name} - {formatCurrency(selectedPackageDetail.packageDef.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Configura las opciones para este paquete.</p>

             <div className="space-y-6">
                 {selectedPackageDetail.packageItems.map(item => (
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(selectedPackageDetail.itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && (
                                         <div className="mb-2 text-xs text-muted-foreground">Seleccionado: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                                     )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No hay opciones disponibles para "{slot.label}".</p>}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {slot.options.map(option => {
                                            const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                            const isDisabled = !isSelected && slot.selectedOptions.length >= slot.max_quantity;
                                            return (
                                                 <Card
                                                    key={option.id}
                                                    onClick={() => !isDisabled && handleModifierOptionChange(
                                                        slot.id, option.id, option.name, option.price,
                                                        // Pass the specific update function for package state
                                                        (pItemId, sId, newSelections) => updatePackageItemSlotSelections(item.id, sId, newSelections)
                                                    )}
                                                    className={cn(
                                                        "cursor-pointer hover:shadow-md transition-all text-center text-xs p-2 overflow-hidden",
                                                        isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                                        isDisabled && "opacity-50 cursor-not-allowed bg-muted/50"
                                                    )}
                                                    title={isDisabled ? `Máximo (${slot.max_quantity}) alcanzado` : option.name}
                                                    >
                                                    {option.name}
                                                     {option.price > 0 && <span className="block text-muted-foreground">{formatCurrency(option.price)}</span>}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {selectedPackageDetail.itemSlots[item.id]?.length === 0 && <p className="text-sm text-muted-foreground">No hay modificadores para este item.</p>}
                        </div>
                    </Card>
                 ))}
             </div>

             <Button onClick={handleAddPackageToOrder} className="w-full mt-6">
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Paquete al Pedido
            </Button>

            </>
        );

      default:
        return null;
    }
  };


 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]"> {/* Adjusted height */}
      {/* Main Content */}
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader>
                <CardTitle>Crear Pedido</CardTitle>
                <CardDescription>Seleccione categorías, productos, paquetes y modificadores.</CardDescription>
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
           <CardHeader>
             <CardTitle>Resumen del Pedido</CardTitle>
             <CardDescription>{currentOrder.id || 'Nuevo Pedido'}</CardDescription>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden">
             {/* Customer Section */}
             <div className="mb-4">
               <Label htmlFor="customerName" className="mb-1 block">Cliente</Label>
               {isRegisteringCustomer ? (
                 <div className="flex gap-2">
                   <Input
                     id="customerName"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="Nombre del cliente"
                     className="flex-grow"
                   />
                   <Button size="sm" onClick={handleSaveCustomer}><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)}>X</Button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center">
                   <span>{currentOrder.customerName}</span>
                   <Button variant="link" className="p-0 h-auto text-accent" onClick={() => setIsRegisteringCustomer(true)}>
                     {currentOrder.customerName === 'Guest' ? 'Registrar' : 'Cambiar'}
                   </Button>
                 </div>
               )}
             </div>

             <Separator className="mb-4" />

             {/* Items List */}
             <ScrollArea className="flex-grow mb-4 pr-4"> {/* pr-4 for scrollbar */}
                {currentOrder.items.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">El pedido está vacío.</p>
                ) : (
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
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)} disabled={item.quantity <= 1}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                          {/* Modifier Display */}
                         {item.selectedModifiers.length > 0 && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                <span className='font-medium text-foreground'>Modificadores:</span>
                                <ul className='list-disc list-inside pl-2'>
                                    {item.selectedModifiers.map((mod, idx) => (
                                        <li key={`${mod.productId}-${idx}`}>
                                            {mod.name}
                                            {/* Future: Add price modifier display if applicable */}
                                            {/* {mod.priceModifier && mod.priceModifier > 0 ? ` (${formatCurrency(mod.priceModifier)})` : ''} */}
                                        </li>
                                    ))}
                                 </ul>
                             </div>
                         )}
                         {/* Package Item Breakdown (Optional) */}
                         {item.type === 'package' && item.packageItems && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                 <span className='font-medium text-foreground'>Contenido:</span>
                                 <ul className='list-disc list-inside pl-2'>
                                     {item.packageItems.map((pkgItem, idx) => (
                                         <li key={`${pkgItem.productId}-${idx}`}>{pkgItem.productName}</li>
                                     ))}
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
                 onValueChange={(value: 'cash' | 'card') => setCurrentOrder(prev => ({...prev, paymentMethod: value}))}
                 className="flex gap-4 mt-2"
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
                         <Label htmlFor="paidAmount" className="mb-1 block text-xs">Monto Pagado</Label>
                         <span className="absolute left-2.5 top-6 text-muted-foreground">$</span>
                         <Input
                            id="paidAmount"
                            type="number"
                            step="0.01"
                            value={paidAmountInput}
                            onChange={(e) => setPaidAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="pl-6"
                         />
                    </div>
                   {currentOrder.changeDue !== undefined && currentOrder.changeDue >= 0 && (
                     <div className="flex justify-between text-accent font-medium">
                       <span>Cambio:</span>
                       <span>{formatCurrency(currentOrder.changeDue)}</span>
                     </div>
                   )}
                    {currentOrder.paidAmount !== undefined && currentOrder.changeDue !== undefined && currentOrder.changeDue < 0 && (
                     <p className="text-destructive text-xs">Falta: {formatCurrency(Math.abs(currentOrder.changeDue))}</p>
                   )}
                 </div>
               )}

             </div>
           </CardContent>
            <div className="p-4 border-t mt-auto bg-muted/30">
                 <Button className="w-full" onClick={handleFinalizeOrder} disabled={currentOrder.items.length === 0}>
                    <Printer className="mr-2 h-4 w-4" /> Finalizar y Imprimir Comanda
                 </Button>
            </div>
         </Card>
       </div>
    </div>
  );
}
