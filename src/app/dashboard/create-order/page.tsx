// src/app/dashboard/create-order/page.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
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
import { cn } from '@/lib/utils'; // Import cn utility
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategory, // Still fetches products from 'paquete' categories
    getPackageById, // Alias for getProductById
    getItemsForPackage,
    getOverridesForPackageItem
} from '@/services/product-service';
import { adjustInventoryStock } from '@/services/inventory-service'; // Added for inventory adjustment
import type {
    Category,
    Product,
    // Package type is now just Product
    ProductModifierSlot,
    PackageItem,
    PackageItemModifierSlotOverride,
    OrderItem,
    CurrentOrder,
    SelectedModifierItem,
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
type View = 'categories' | 'products' | 'modifiers' | 'package-details';

interface ModifierSlotState extends ProductModifierSlot {
    options: Product[]; // Products from the linked category
    selectedOptions: SelectedModifierItem[]; // Modifiers chosen for this slot instance
    override?: PackageItemModifierSlotOverride; // Package-specific override rules
}

interface PackageDetailState {
    packageDef: Product; // Package is now a Product type
    packageItems: PackageItem[]; // Items included in the package definition
    itemSlots: Record<string, ModifierSlotState[]>; // Key: PackageItem ID, Value: Its modifier slots
}

// --- Component ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Can be regular product or package product
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
  const [products, setProducts] = useState<Product[]>([]); // Products (non-package) for the selected category
  const [packages, setPackages] = useState<Product[]>([]); // Packages (products of type 'paquete') for the selected category
  const [isLoading, setIsLoading] = useState({ categories: true, products: false, packages: false, modifiers: false, packageDetails: false });

  const { toast } = useToast();

  // --- Data Fetching Effects ---
  useEffect(() => {
    async function fetchCategories() {
      setIsLoading(prev => ({ ...prev, categories: true }));
      try {
        const fetchedCategories = await getCategories(); // Fetch all categories initially
        setCategories(fetchedCategories);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      } finally {
        setIsLoading(prev => ({ ...prev, categories: false }));
      }
    }
    fetchCategories();
  }, [toast]);

  // Fetches non-package products and package products for a given category ID
  const fetchProductsAndPackages = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true, packages: true }));
    try {
        // Fetch regular products (assuming service filters out packages)
        const fetchedProducts = await getProductsByCategory(categoryId);
        // Fetch packages (assuming service filters *for* packages)
        const fetchedPackages = await getPackagesByCategory(categoryId);

        setProducts(fetchedProducts);
        setPackages(fetchedPackages); // Packages are also of type Product now
    } catch (error) {
      toast({ title: "Error", description: `Failed to load items for category ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
       setProducts([]);
       setPackages([]);
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
                // Fetch products from the linked category (these are the modifier options)
                const options = await getProductsByCategory(slot.linked_category_id);
                // Note: Modifiers (like sauces) might have price 0, but are still products
                return { ...slot, options: options, selectedOptions: [] }; // Initialize state
            });
            preparedSlots = await Promise.all(optionsPromises);
        }
    } catch (error) {
        toast({ title: "Error", description: `Failed to load modifiers for product ${productId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
    return preparedSlots;
  }, [toast]); // Added getProductsByCategory to dependencies implicitly

   // Fetch details for a package, including its items and their modifier slots/overrides
   const fetchPackageDetails = useCallback(async (packageProductId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        try {
            // Package itself is a product
            const packageDef = await getProductById(packageProductId); // Use getProductById
            if (!packageDef) throw new Error("Package product not found");

            // Get the list of product IDs defined within this package
            const packageItems = await getItemsForPackage(packageProductId); // Use package's product ID

            // For each item in the package, fetch its details and potential modifier slots + overrides
            const itemSlotsPromises = packageItems.map(async (item) => {
                // 1. Get the base modifier slots for the actual product in the package item (e.g., Alitas 6pz)
                const baseSlots = await fetchAndPrepareModifierSlots(item.product_id);

                // 2. Get any overrides specific to this package item instance (e.g., override for 'Alitas 6pz' *inside* 'Combo Pareja')
                const overrides = await getOverridesForPackageItem(item.id); // Use the unique package_item ID

                // 3. Apply overrides to the base slots
                const finalSlots = baseSlots.map(slot => {
                    const override = overrides.find(o => o.product_modifier_slot_id === slot.id);
                    // If override exists, use its min/max, otherwise use slot's default
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
            toast({ title: "Error", description: `Failed to load package details: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
            setView('categories'); // Go back if details fail
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

  // Handles click on EITHER a regular product OR a package product
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product); // Store the clicked product (could be regular or package)

    // Check if the product's category type is 'paquete'
    const parentCategory = categories.find(cat => cat.id === product.categoryId);
    if (parentCategory?.type === 'paquete') {
        await fetchPackageDetails(product.id); // Fetch details if it's a package
        // View is changed within fetchPackageDetails
    } else {
        // It's a regular product, check for modifiers
        const slots = await fetchAndPrepareModifierSlots(product.id);
        if (slots.length > 0) {
            setCurrentModifierSlots(slots);
            setView('modifiers'); // Go to modifier selection view
        } else {
            addProductToOrder(product, []); // Add directly if no modifiers
            // Stay on products view or go back to categories? Stay for now.
            setView('products');
        }
    }
  };

   // This function remains largely the same, but the type of pkg is now Product
   // const handlePackageClick = async (pkg: Product) => {
   //    await fetchPackageDetails(pkg.id);
   //    // View is changed within fetchPackageDetails
   // };


   // Generic handler for selecting/deselecting modifier options
   // Works for both regular product modifiers and modifiers within package items
   const handleModifierOptionChange = (
        slotId: string,
        optionProductId: string, // The ID of the product being selected as modifier (e.g., 'prod-salsa-bbq')
        optionName: string,
        optionPriceModifier: number, // Price of the modifier product itself (often 0 for sauces)
        targetStateSetter: React.Dispatch<React.SetStateAction<ModifierSlotState[]>> | ((packageItemId: string, slotId: string, newSelections: SelectedModifierItem[]) => void),
        packageItemId?: string // Optional: Only provided when modifying within a package context
    ) => {

        // Function to update a list of slots based on selection change
        const updateSlotsLogic = (prevSlots: ModifierSlotState[]): ModifierSlotState[] => {
            return prevSlots.map(slot => {
                if (slot.id === slotId) {
                    const isSelected = slot.selectedOptions.some(opt => opt.productId === optionProductId);
                    let newSelections = [...slot.selectedOptions];
                    // Use override min/max if available, otherwise use slot defaults
                    const minQty = slot.override?.min_quantity ?? slot.min_quantity;
                    const maxQty = slot.override?.max_quantity ?? slot.max_quantity;

                    if (isSelected) {
                        // Deselect: Check if deselecting violates min quantity
                        if (newSelections.length - 1 < minQty) {
                             // This check might be annoying UX, maybe only validate on 'Add to Order'?
                             // toast({ title: "Minimum Not Met", description: `Must select at least ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
                             // return slot; // Prevent deselecting below minimum (or allow and validate later)
                             newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                        } else {
                            newSelections = newSelections.filter(opt => opt.productId !== optionProductId);
                        }
                    } else {
                        // Select: Check if adding violates max quantity
                        if (newSelections.length < maxQty) {
                            newSelections.push({
                                productId: optionProductId,
                                name: optionName,
                                // Use the base price of the modifier product as its price effect
                                priceModifier: optionPriceModifier,
                                slotId: slotId,
                            });
                        } else {
                            toast({ title: "Limit Reached", description: `Cannot select more than ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
                            return slot; // Return unchanged slot if max reached
                        }
                    }
                    return { ...slot, selectedOptions: newSelections };
                }
                return slot;
            });
        };

        // Determine which state update function to call
        if (packageItemId && typeof targetStateSetter === 'function' && view === 'package-details') {
            // We are inside package details, call the specific update function for package state
            targetStateSetter(packageItemId, slotId, updateSlotsLogic(selectedPackageDetail?.itemSlots[packageItemId]?.find(s => s.id === slotId)?.selectedOptions ?? []));
             // Manually trigger the update for the specific slot
             const updatedSlots = updateSlotsLogic(selectedPackageDetail?.itemSlots[packageItemId] ?? []);
             targetStateSetter(packageItemId, slotId, updatedSlots.find(s => s.id === slotId)?.selectedOptions ?? []);


        } else if (!packageItemId && typeof targetStateSetter === 'function' && view === 'modifiers') {
            // We are modifying a regular product, use the standard state setter
             (targetStateSetter as React.Dispatch<React.SetStateAction<ModifierSlotState[]>>)(updateSlotsLogic);
        } else {
            console.error("Invalid state or context for handleModifierOptionChange", { view, packageItemId, targetStateSetter });
             toast({ title: "Internal Error", description: "Could not update modifier selection.", variant: "destructive"});
        }
    };

    // Specific handler for updating slots within the selectedPackageDetail state
    const updatePackageItemSlotSelections = (packageItemId: string, slotId: string, newSelections: SelectedModifierItem[]) => {
        setSelectedPackageDetail(prevDetail => {
            if (!prevDetail) return null;

            // Create a deep copy of the itemSlots to avoid mutation issues
             const updatedSlotsMap = JSON.parse(JSON.stringify(prevDetail.itemSlots));

            // Find the specific slot within the specific item and update its selections
            if (updatedSlotsMap[packageItemId]) {
                const itemSlots = updatedSlotsMap[packageItemId] as ModifierSlotState[];
                const slotIndex = itemSlots.findIndex(slot => slot.id === slotId);
                if (slotIndex !== -1) {
                    itemSlots[slotIndex].selectedOptions = newSelections;
                } else {
                     console.warn(`Slot ${slotId} not found for package item ${packageItemId}`);
                }
            } else {
                 console.warn(`Package item ${packageItemId} not found in itemSlots map`);
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
        const minQty = slot.min_quantity; // No overrides for regular products
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selection Incomplete", description: `Must select at least ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
            return; // Stop adding
        }
    }

    // Calculate total price including modifiers
    // Base price + sum of modifier product prices
    const modifierPriceTotal = currentModifierSlots.flatMap(slot => slot.selectedOptions).reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const totalPrice = selectedProduct.price + modifierPriceTotal;

    const chosenModifiers = currentModifierSlots.flatMap(slot => slot.selectedOptions);
    addProductToOrder(selectedProduct, chosenModifiers, totalPrice);

    // Reset and go back
    resetProductSelection();
  };

   const handleAddPackageToOrder = () => {
        if (!selectedPackageDetail) return;

        // Validate min quantity for all slots within the package, considering overrides
        let allModifiersForPackage: SelectedModifierItem[] = [];
        for (const item of selectedPackageDetail.packageItems) {
            const slots = selectedPackageDetail.itemSlots[item.id] || [];
            for (const slot of slots) {
                 // Use override min/max if available, otherwise slot defaults
                const minQty = slot.override?.min_quantity ?? slot.min_quantity;
                if (slot.selectedOptions.length < minQty) {
                    toast({
                        title: "Selection Incomplete",
                        description: `For "${item.product_name}", must select at least ${minQty} ${slot.label.toLowerCase()}.`,
                        variant: "destructive"
                    });
                    return; // Stop adding
                }
                 // Collect modifiers, adding packageItemId context
                 allModifiersForPackage.push(...slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id})));
            }
        }

        // Package price is fixed, modifiers selected within don't change the package price itself (unless designed differently)
        const packagePrice = selectedPackageDetail.packageDef.price;

        // Add package to order
        addPackageToOrder(selectedPackageDetail.packageDef, selectedPackageDetail.packageItems, selectedPackageDetail.itemSlots, packagePrice);

        // Reset and go back
        resetPackageSelection();
   };

  // Add regular product to order
  const addProductToOrder = (product: Product, modifiers: SelectedModifierItem[], totalPrice: number) => {

    const newOrderItem: OrderItem = {
      type: 'product',
      id: product.id,
      name: product.name,
      quantity: 1,
      basePrice: product.price, // Price before modifiers
      selectedModifiers: modifiers,
      totalPrice: totalPrice, // Price including modifiers for quantity 1
      uniqueId: Date.now().toString() + Math.random().toString(), // Simple unique ID
    };

    setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

    toast({
        title: `${product.name} added`,
        description: modifiers.length > 0 ? `Modifiers: ${modifiers.map(m => m.name).join(', ')}` : 'No modifiers',
    });
  };

  // Add package (which is a product type) to order
  const addPackageToOrder = (
        packageDef: Product, // Package definition (Product type)
        packageItems: PackageItem[], // Definition of items inside
        itemSlotsMap: Record<string, ModifierSlotState[]>, // Contains selected options for each item
        totalPrice: number // Package price (usually fixed)
    ) => {
        // Collect all selected modifiers from all items in the package
         const allSelectedModifiersNested = packageItems.map(item => {
            const slots = itemSlotsMap[item.id] || [];
            return slots.flatMap(slot => slot.selectedOptions.map(opt => ({...opt, packageItemId: item.id}))); // Add packageItemId
         }).flat();


        const newOrderItem: OrderItem = {
            type: 'package',
            id: packageDef.id, // ID of the package product
            name: packageDef.name,
            quantity: 1,
            basePrice: packageDef.price, // Fixed price of the package product
            // Store modifiers selected *within* the package for potential display/kitchen ticket
            selectedModifiers: allSelectedModifiersNested,
            totalPrice: totalPrice, // Total price for one package (usually just basePrice)
            uniqueId: Date.now().toString() + Math.random().toString(),
             // Store details of the items and their specific modifiers *within* this package instance
             packageItems: packageItems.map(item => ({
                 packageItemId: item.id, // ID of the PackageItem definition line
                 productId: item.product_id,
                 productName: item.product_name || 'Unknown Product',
                 // Get selected modifiers only for this specific item instance
                 selectedModifiers: (itemSlotsMap[item.id] || []).flatMap(slot => slot.selectedOptions)
            }))
        };

        setCurrentOrder(prev => ({ ...prev, items: [...prev.items, newOrderItem] }));

         toast({
            title: `Package "${packageDef.name}" added`,
            // description: `Includes: ${packageItems.map(i => i.product_name).join(', ')}`,
        });
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
          let pricePerUnit = 0;

          if (item.type === 'product') {
             // Recalculate price per unit including modifiers
             const modifierPriceTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
             pricePerUnit = item.basePrice + modifierPriceTotal;
          } else {
             // Package price is fixed per unit
             pricePerUnit = item.basePrice;
          }

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
    // Decide where to go back - to the list of packages/products or all categories?
    setView('products'); // Go back to the product/package list view
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
        changeDue: change >= 0 ? change : undefined
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
             // Adjust inventory for the main product
             const productDetails = await getProductById(orderItem.id);
             if (productDetails?.inventory_item_id && productDetails.inventory_consumed_per_unit) {
                 const change = -(productDetails.inventory_consumed_per_unit * orderItem.quantity);
                 inventoryAdjustments[productDetails.inventory_item_id] = (inventoryAdjustments[productDetails.inventory_item_id] || 0) + change;
             }
             // Adjust inventory for modifiers IF they consume inventory
             for (const modifier of orderItem.selectedModifiers) {
                 const modProductDetails = await getProductById(modifier.productId);
                  if (modProductDetails?.inventory_item_id && modProductDetails.inventory_consumed_per_unit) {
                     const change = -(modProductDetails.inventory_consumed_per_unit * orderItem.quantity); // Modifier consumption per main item qty
                     inventoryAdjustments[modProductDetails.inventory_item_id] = (inventoryAdjustments[modProductDetails.inventory_item_id] || 0) + change;
                 }
             }

         } else if (orderItem.type === 'package' && orderItem.packageItems) {
             // Iterate through each defined item within the package
             for (const pkgItem of orderItem.packageItems) {
                 // Adjust inventory for the product within the package item
                 const productDetails = await getProductById(pkgItem.productId);
                 if (productDetails?.inventory_item_id && productDetails.inventory_consumed_per_unit) {
                     // Adjust based on product consumption * package item quantity * overall package quantity
                     const change = -(productDetails.inventory_consumed_per_unit * 1 * orderItem.quantity); // Assuming pkgItem definition quantity is 1, adjust if not
                     inventoryAdjustments[productDetails.inventory_item_id] = (inventoryAdjustments[productDetails.inventory_item_id] || 0) + change;
                 }
                 // Adjust inventory for modifiers selected for this specific package item
                  for (const modifier of pkgItem.selectedModifiers) {
                     const modProductDetails = await getProductById(modifier.productId);
                     if (modProductDetails?.inventory_item_id && modProductDetails.inventory_consumed_per_unit) {
                         const change = -(modProductDetails.inventory_consumed_per_unit * orderItem.quantity); // Modifier consumption per overall package qty
                         inventoryAdjustments[modProductDetails.inventory_item_id] = (inventoryAdjustments[modProductDetails.inventory_item_id] || 0) + change;
                     }
                 }
             }
         }
     }

     // Perform inventory adjustments
     setIsLoading(prev => ({ ...prev, inventory: true })); // Indicate loading during adjustment
     try {
        for (const [itemId, change] of Object.entries(inventoryAdjustments)) {
             if (change !== 0) { // Only adjust if there's a change
                await adjustInventoryStock(itemId, change);
                console.log(`Adjusted inventory for ${itemId} by ${change}`);
             }
        }
     } catch (error) {
          toast({ title: "Inventory Error", description: `Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}. Order not saved.`, variant: "destructive" });
          setIsLoading(prev => ({ ...prev, inventory: false }));
          return; // Stop order finalization if inventory fails
     } finally {
          setIsLoading(prev => ({ ...prev, inventory: false }));
     }
     // --- End Inventory Adjustment ---


    // 2. Format the new order object to match SavedOrder
     const finalizedOrder: SavedOrder = {
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => {
          // Get modifier names, potentially grouped by slot if structure allows/needed
           const components = item.selectedModifiers.map(m => ({
                name: m.name,
                slotLabel: currentModifierSlots.find(s => s.id === m.slotId)?.label || // Find label from current slots if available
                           selectedPackageDetail?.itemSlots[m.packageItemId || '']?.find(s => s.id === m.slotId)?.label || // Find in package detail state
                           `Mod` // Fallback
           }));

           // If it's a package, add the base package items to components list for display
           if (item.type === 'package' && item.packageItems) {
                item.packageItems.forEach(pkgItem => {
                    components.push({ name: `${pkgItem.productName}`, slotLabel: 'Contenido' }); // Indicate it's package content
                     // Add modifiers specific to this package item
                    pkgItem.selectedModifiers.forEach(mod => {
                         components.push({ name: `↳ ${mod.name}`, slotLabel: `Mod (${pkgItem.productName})`}); // Indent or label differently
                    });
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
        const isPackage = categories.find(c => c.id === products.find(p => p.id === item.id)?.categoryId)?.type === 'paquete'; // Check if it was a package
        console.log(`${item.quantity}x ${item.name} (${formatCurrency(item.price)} c/u) ${isPackage ? '[PAQUETE]' : ''}`);
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
     if(finalizedOrder.paymentMethod === 'cash') {
        console.log(`Pagado: ${formatCurrency(finalizedOrder.paidAmount || 0)}`);
        console.log(`Cambio: ${formatCurrency(finalizedOrder.changeGiven || 0)}`);
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
                  {cat.imageUrl && <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />}
                   {!cat.imageUrl && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>}
                    {cat.type === 'paquete' && <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent">Paquete</Badge>}
                 </div>
                 <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm md:text-base">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
             {displayCategories.length === 0 && <p className="col-span-full text-center text-muted-foreground">No categories available.</p>}
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

             {/* Packages Section (if the selected category *is* 'paquete') */}
             {selectedCategory?.type === 'paquete' && packages.length > 0 && (
                 <>
                    {/* <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Available Packages</h3> */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packages.map(pkg => ( // pkg is type Product
                        <Card key={pkg.id} onClick={() => handleProductClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
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
                 </>
             )}

            {/* Products Section (if the selected category *is not* 'paquete') */}
             {selectedCategory?.type !== 'paquete' && products.length > 0 && (
                 <>
                     {/* Optional: Title like "Individual Products" if needed */}
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
                    </div>
                 </>
             )}

            {/* Empty State */}
            {products.length === 0 && packages.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-10">No items found in the '{selectedCategory?.name}' category.</p>
             )}
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

             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4">No modifiers available for this product.</p>}

             <div className="space-y-6">
                {currentModifierSlots.map(slot => (
                    <div key={slot.id}>
                        <h3 className="text-lg font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                         {slot.selectedOptions.length > 0 && (
                             <div className="mb-2 text-xs text-muted-foreground">Selected: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                         )}
                         {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No options available for "{slot.label}".</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {slot.options.map(option => { // option is a Product (e.g., a sauce)
                                const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                const isDisabled = !isSelected && slot.selectedOptions.length >= slot.max_quantity;
                                return (
                                    <Card
                                        key={option.id}
                                        onClick={() => !isDisabled && handleModifierOptionChange(
                                            slot.id,
                                            option.id,
                                            option.name,
                                            option.price, // Pass the price of the modifier product itself
                                            setCurrentModifierSlots // Target state setter for regular product modifiers
                                            // No packageItemId needed here
                                        )}
                                        className={cn(
                                            "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden", // Adjusted padding and text size
                                            isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                            isDisabled && "opacity-50 cursor-not-allowed bg-muted/50"
                                        )}
                                        title={isDisabled ? `Max (${slot.max_quantity}) reached` : option.name}
                                        >
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

            <Button onClick={handleAddProductWithModifiers} className="w-full mt-6">
              <PlusCircle className="mr-2 h-4 w-4" /> Add to Order
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
             <p className="text-sm text-muted-foreground mb-4">Configure options for this package.</p>

             <div className="space-y-6">
                 {selectedPackageDetail.packageItems.map(item => ( // item is PackageItem definition
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        {/* Get the modifier slots applicable to this item within the package */}
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(selectedPackageDetail.itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    {/* Display label, using override min/max */}
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.override?.min_quantity ?? slot.min_quantity}, Max: {slot.override?.max_quantity ?? slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && (
                                         <div className="mb-2 text-xs text-muted-foreground">Selected: {slot.selectedOptions.length} / {slot.override?.max_quantity ?? slot.max_quantity}</div>
                                     )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No options available for "{slot.label}".</p>}
                                    {/* Grid for modifier options */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {slot.options.map(option => { // option is a Product (e.g., sauce)
                                            const isSelected = slot.selectedOptions.some(sel => sel.productId === option.id);
                                            // Check against override max quantity if it exists
                                            const maxQty = slot.override?.max_quantity ?? slot.max_quantity;
                                            const isDisabled = !isSelected && slot.selectedOptions.length >= maxQty;
                                            return (
                                                 <Card
                                                    key={option.id}
                                                    onClick={() => !isDisabled && handleModifierOptionChange(
                                                        slot.id,
                                                        option.id,
                                                        option.name,
                                                        option.price, // Pass modifier product price
                                                        updatePackageItemSlotSelections, // Specific update function for package state
                                                        item.id // Pass the package item ID
                                                    )}
                                                    className={cn(
                                                        "cursor-pointer hover:shadow-md transition-all text-center p-2 overflow-hidden", // Adjusted padding and text size
                                                        isSelected && "border-accent ring-2 ring-accent ring-offset-1",
                                                        isDisabled && "opacity-50 cursor-not-allowed bg-muted/50"
                                                    )}
                                                    title={isDisabled ? `Max (${maxQty}) reached` : option.name}
                                                    >
                                                    <span className="text-xs md:text-sm block">{option.name}</span>
                                                    {option.price > 0 && <span className="block text-xs text-muted-foreground mt-0.5">{formatCurrency(option.price)}</span>}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {/* Show message if a package item has no configurable slots */}
                            {(selectedPackageDetail.itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No configurable options for this item.</p>}
                        </div>
                    </Card>
                 ))}
             </div>

             <Button onClick={handleAddPackageToOrder} className="w-full mt-6">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Package to Order
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
                <CardTitle>Create Order</CardTitle>
                <CardDescription>Select categories, products, packages, and modifiers.</CardDescription>
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
             <CardTitle>Order Summary</CardTitle>
             <CardDescription>{currentOrder.id || 'New Order'}</CardDescription>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col overflow-hidden">
             {/* Customer Section */}
             <div className="mb-4">
               <Label htmlFor="customerName" className="mb-1 block">Customer</Label>
               {isRegisteringCustomer ? (
                 <div className="flex gap-2">
                   <Input
                     id="customerName"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="Customer name"
                     className="flex-grow"
                   />
                   <Button size="sm" onClick={handleSaveCustomer}><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)}>X</Button>
                 </div>
               ) : (
                 <div className="flex justify-between items-center">
                   <span>{currentOrder.customerName}</span>
                   <Button variant="link" className="p-0 h-auto text-accent" onClick={() => setIsRegisteringCustomer(true)}>
                     {currentOrder.customerName === 'Guest' ? 'Add Customer' : 'Change'}
                   </Button>
                 </div>
               )}
             </div>

             <Separator className="mb-4" />

             {/* Items List */}
             <ScrollArea className="flex-grow mb-4 -mr-4 pr-4"> {/* Negative margin + padding for scrollbar */}
                {currentOrder.items.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Order is empty.</p>
                ) : (
                 <div className="space-y-3">
                 {currentOrder.items.map((item) => (
                     <div key={item.uniqueId} className="text-sm border-b pb-2 last:border-b-0">
                         {/* Item Name and Price */}
                         <div className="flex justify-between items-start font-medium mb-1">
                             <div className='flex items-center gap-2'>
                                 {item.type === 'package' && <PackageIcon className="h-4 w-4 text-accent flex-shrink-0" title="Package"/>}
                                 <span className="flex-1 mr-2">{item.name}</span>
                            </div>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          {/* Quantity Controls and Remove Button */}
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {/* Modifier/Package Content Display */}
                         {item.selectedModifiers.length > 0 && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modifiers:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Details / Modifiers:</span>}
                                <ul className='list-disc list-inside pl-2'>
                                     {/* Group modifiers by package item if applicable */}
                                    {item.type === 'package' && item.packageItems ? (
                                         item.packageItems.map(pkgItem => (
                                            <React.Fragment key={pkgItem.packageItemId}>
                                                <li>{pkgItem.productName}</li>
                                                {pkgItem.selectedModifiers.length > 0 && (
                                                    <ul className="list-[circle] list-inside pl-4">
                                                        {pkgItem.selectedModifiers.map((mod, modIdx) => (
                                                            <li key={`${mod.productId}-${modIdx}`}>{mod.name}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </React.Fragment>
                                         ))
                                    ) : (
                                        // Regular product modifiers
                                        item.selectedModifiers.map((mod, idx) => (
                                            <li key={`${mod.productId}-${idx}`}>
                                                {mod.name}
                                                {/* Display modifier price if > 0 */}
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
                 onValueChange={(value: 'cash' | 'card') => setCurrentOrder(prev => ({...prev, paymentMethod: value}))}
                 className="flex gap-4 mt-2"
                >
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="card" id="pay-card" />
                   <Label htmlFor="pay-card">Card</Label>
                 </div>
                 <div className="flex items-center space-x-2">
                   <RadioGroupItem value="cash" id="pay-cash" />
                   <Label htmlFor="pay-cash">Cash</Label>
                 </div>
               </RadioGroup>

               {currentOrder.paymentMethod === 'cash' && (
                 <div className="mt-2 space-y-2">
                     <div className='relative'>
                         <Label htmlFor="paidAmount" className="mb-1 block text-xs">Amount Paid</Label>
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
                         />
                    </div>
                   {currentOrder.changeDue !== undefined && currentOrder.changeDue >= 0 && (
                     <div className="flex justify-between text-accent font-medium">
                       <span>Change Due:</span>
                       <span>{formatCurrency(currentOrder.changeDue)}</span>
                     </div>
                   )}
                    {currentOrder.paidAmount !== undefined && currentOrder.changeDue !== undefined && currentOrder.changeDue < 0 && (
                     <p className="text-destructive text-xs">Amount Short: {formatCurrency(Math.abs(currentOrder.changeDue))}</p>
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
                >
                    {isLoading.inventory ? (
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Printer className="mr-2 h-4 w-4" />
                    )}
                    Finalize & Print Ticket
                 </Button>
            </div>
         </Card>
       </div>
    </div>
  );
}
