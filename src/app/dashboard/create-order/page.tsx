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
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2, PackageIcon } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // For product images
import { cn } from '@/lib/utils'; // Import cn utility
import {
    getCategories,
    getProductsByCategory,
    getProductById,
    getModifierSlotsForProduct,
    getPackagesByCategory, // Fetches products from 'paquete' categories
    // getPackageById, // Alias for getProductById - REMOVED, use getProductById
    getItemsForPackage,
    getOverridesForPackageItem
} from '@/services/product-service';
import { adjustInventoryStock, getInventoryItems } from '@/services/inventory-service'; // Added inventory adjustment and fetching
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
    SavedOrder,
    InventoryItem
} from '@/types/product-types';

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
    packageDef: Product; // Package is now a Product type
    packageItems: PackageItem[]; // Items included in the package definition
    // Key: PackageItem ID, Value: Its modifier slots state
    itemSlots: Record<string, ModifierSlotState[]>;
}

// --- Component ---
export default function CreateOrderPage() {
  const [view, setView] = useState<View>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Can be regular product or package product
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<PackageDetailState | null>(null); // For configuring packages
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
  const [packages, setPackages] = useState<Product[]>([]); // Packages (products of type 'paquete') for the selected category
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
        toast({ title: "Error Loading Data", description: "Failed to load categories or inventory.", variant: "destructive" });
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
        // Fetch regular products (service filters out packages)
        const fetchedProducts = await getProductsByCategory(categoryId);
        // Fetch packages (service filters *for* packages)
        const fetchedPackages = await getPackagesByCategory(categoryId);

        setProducts(fetchedProducts);
        setPackages(fetchedPackages);
    } catch (error) {
      toast({ title: "Error", description: `Failed to load items for category ${categoryId}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
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
                const options = await getProductsByCategory(slot.linked_category_id);
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
  }, [toast]);

   // Fetch details for a package, including its items and their modifier slots/overrides
   const fetchPackageDetails = useCallback(async (packageProductId: string) => {
        setIsLoading(prev => ({ ...prev, packageDetails: true }));
        setSelectedPackageDetail(null); // Clear previous detail
        try {
            // Package itself is a product
            const packageDef = await getProductById(packageProductId);
            if (!packageDef) throw new Error("Package product not found");

            // Get the list of product IDs defined within this package
            const packageItems = await getItemsForPackage(packageProductId);

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
            toast({ title: "Error", description: `Failed to load package details: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
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

  // Handles click on EITHER a regular product OR a package product
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product); // Store the clicked product (could be regular or package)

    // Check inventory for the base product
     if (product.inventory_item_id) {
       const invItem = inventoryMap.get(product.inventory_item_id);
       const consumed = product.inventory_consumed_per_unit ?? 0;
       if (!invItem || invItem.current_stock < consumed) {
            toast({ title: "Out of Stock", description: `Not enough ${invItem?.name || 'inventory'} for ${product.name}.`, variant: "destructive" });
            setSelectedProduct(null); // Reset selection
            return; // Stop processing
       }
     }

    // Find the category details for the clicked product
    const parentCategory = categories.find(cat => cat.id === product.categoryId);
    if (parentCategory?.type === 'paquete') {
        await fetchPackageDetails(product.id); // Fetch details if it's a package
        // View is changed within fetchPackageDetails
    } else {
        // It's a regular product, fetch its modifier slots
        const slots = await fetchAndPrepareModifierSlots(product.id);
        if (slots.length > 0) {
            setCurrentModifierSlots(slots); // Set state for modifier selection UI
            setView('modifiers'); // Go to modifier selection view
        } else {
             // No modifiers, add directly to order (price is just base price)
            addProductToOrder(product, [], product.price);
             toast({ title: `${product.name} added`, description: 'No modifiers' });
             // Stay on products view for potential further additions
             setView('products');
             setSelectedProduct(null); // Reset selection after adding
        }
    }
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
                            toast({ title: "Out of Stock", description: `Not enough ${invItem?.name || 'inventory'} for ${optionName}.`, variant: "destructive" });
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
                            toast({ title: "Limit Reached", description: `Cannot select more than ${maxQty} ${slot.label.toLowerCase()}.`, variant: "default" });
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
            toast({ title: "Internal Error", description: "Could not update modifier selection.", variant: "destructive"});
        }
    };


  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;

    // Validate min quantity for each slot
    for (const slot of currentModifierSlots) {
        const minQty = slot.min_quantity;
        if (slot.selectedOptions.length < minQty) {
            toast({ title: "Selection Incomplete", description: `Must select at least ${minQty} ${slot.label.toLowerCase()}.`, variant: "destructive" });
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
        title: `${selectedProduct.name} added`,
        description: chosenModifiers.length > 0 ? `Modifiers: ${chosenModifiers.map(m => m.name).join(', ')}` : 'No modifiers',
    });

    // Reset and go back
    resetProductSelection();
  };

   const handleAddPackageToOrder = () => {
        if (!selectedPackageDetail) return;

        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;

        // --- Inventory Check for Package ---
        let inventoryOk = true;
        const tempInventoryChanges: Record<string, number> = {}; // Track changes within the package

        // Check base package item inventory (if package itself consumes something)
        if (packageDef.inventory_item_id) {
           const invItem = inventoryMap.get(packageDef.inventory_item_id);
           const consumed = packageDef.inventory_consumed_per_unit ?? 0;
           if (!invItem || invItem.current_stock < consumed) {
                toast({ title: "Out of Stock", description: `Not enough inventory for package base ${packageDef.name}.`, variant: "destructive" });
                inventoryOk = false;
           } else if (consumed > 0) {
                tempInventoryChanges[packageDef.inventory_item_id] = (tempInventoryChanges[packageDef.inventory_item_id] || 0) - consumed;
           }
        }

        // Check inventory for each product within the package and their selected modifiers
        for (const item of packageItems) {
            const productDetails = products.find(p => p.id === item.product_id) || // Check fetched products
                                     packages.find(p => p.id === item.product_id); // Check fetched packages (if a package contains another package?)
            if (!productDetails) {
                toast({ title: "Error", description: `Product definition for ${item.product_name} not found.`, variant: "destructive" });
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
                    toast({ title: "Out of Stock", description: `Not enough ${invItem?.name || 'inventory'} for ${item.product_name} in package.`, variant: "destructive" });
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
                        title: "Selection Incomplete",
                        description: `For "${item.product_name}", must select at least ${minQty} ${slot.label.toLowerCase()}.`,
                        variant: "destructive"
                    });
                    inventoryOk = false;
                    break;
                }

                 // Check modifier inventory
                 for (const modOption of slot.selectedOptions) {
                     const modProductDetails = slot.options.find(opt => opt.id === modOption.productId);
                     if (modProductDetails?.inventory_item_id) {
                        const invItem = inventoryMap.get(modProductDetails.inventory_item_id);
                        const consumed = (modProductDetails.inventory_consumed_per_unit ?? 0) * item.quantity; // Assume mod consumed per package item qty
                         const currentStock = invItem?.current_stock ?? 0;
                         const alreadyConsumed = tempInventoryChanges[modProductDetails.inventory_item_id] || 0;

                        if (currentStock + alreadyConsumed < consumed) {
                            toast({ title: "Out of Stock", description: `Not enough ${invItem?.name || 'inventory'} for modifier ${modOption.name}.`, variant: "destructive" });
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
            id: packageDef.id, // ID of the package product
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
            title: `Package "${packageDef.name}" added`,
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
                const productDetails = products.find(p => p.id === item.id) || packages.find(p => p.id === item.id); // Find the product/package definition

                if (productDetails?.inventory_item_id) {
                    const invItem = inventoryMap.get(productDetails.inventory_item_id);
                    const consumed = productDetails.inventory_consumed_per_unit ?? 0;
                    if (!invItem || invItem.current_stock < consumed * newQuantity) { // Check total needed
                        toast({ title: "Insufficient Stock", description: `Not enough inventory for ${newQuantity}x ${item.name}.`, variant: "destructive" });
                        checkOk = false;
                    }
                }
                 // Also check modifiers/package items if needed (more complex)
                 // For simplicity, we might only check the main item here or rely on initial add check.
                 // A more robust check would re-evaluate the entire item's inventory need at the new quantity.
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
        title: `Item removed from order`,
        variant: 'destructive'
    })
  };

  const resetProductSelection = () => {
    setSelectedProduct(null);
    setCurrentModifierSlots([]);
    setView('products'); // Go back to the list for the current category
  }

  const resetPackageSelection = () => {
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
        toast({ title: "Customer Saved", description: `Order associated with ${customerName}` });
      } else {
           toast({ title: "Invalid Name", description: "Please enter a customer name.", variant: 'destructive' });
      }
  };

  const handleFinalizeOrder = async () => {
    if (currentOrder.items.length === 0) {
      toast({ title: "Empty Order", description: "Please add items to the order.", variant: 'destructive' });
      return;
    }
     if (currentOrder.paymentMethod === 'cash' && (currentOrder.paidAmount === undefined || currentOrder.paidAmount < currentOrder.total)) {
       toast({ title: "Payment Incomplete", description: "Amount paid in cash is less than the total.", variant: 'destructive' });
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
             allProductIds.add(item.id); // Main product/package ID
             item.selectedModifiers.forEach(mod => allProductIds.add(mod.productId)); // Modifier product IDs
             if (item.packageItems) {
                 item.packageItems.forEach(pkgItem => {
                     allProductIds.add(pkgItem.productId); // Product IDs within package
                     pkgItem.selectedModifiers.forEach(mod => allProductIds.add(mod.productId)); // Modifier IDs within package item
                 });
             }
         });

         const productDetailsMap = new Map<string, Product>();
         const productFetchPromises = Array.from(allProductIds).map(id => getProductById(id));
         const fetchedProducts = await Promise.all(productFetchPromises);
         fetchedProducts.forEach(p => { if (p) productDetailsMap.set(p.id, p); });


         // Calculate inventory changes needed
         for (const orderItem of currentOrder.items) {
             const itemDetails = productDetailsMap.get(orderItem.id);
             if (!itemDetails) continue; // Should not happen if pre-fetched

             // 1. Consume inventory for the main product/package itself (if applicable)
             if (itemDetails.inventory_item_id && itemDetails.inventory_consumed_per_unit) {
                 const invItemId = itemDetails.inventory_item_id;
                 const change = -(itemDetails.inventory_consumed_per_unit * orderItem.quantity);
                 const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Unknown Inv Item' };
                 inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
             }

             // 2. Consume inventory for selected modifiers (for regular products)
             if (orderItem.type === 'product') {
                 for (const modifier of orderItem.selectedModifiers) {
                     const modDetails = productDetailsMap.get(modifier.productId);
                     if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                         const invItemId = modDetails.inventory_item_id;
                         const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity); // Modifier consumption per main item qty
                         const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Unknown Inv Item' };
                         inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }
                 }
             }
             // 3. Consume inventory for items AND their modifiers within a package
             else if (orderItem.type === 'package' && orderItem.packageItems) {
                 for (const pkgItem of orderItem.packageItems) {
                     const pkgItemDetails = productDetailsMap.get(pkgItem.productId);
                     if (!pkgItemDetails) continue;

                     // Consume for the package item's product
                     if (pkgItemDetails.inventory_item_id && pkgItemDetails.inventory_consumed_per_unit) {
                          const invItemId = pkgItemDetails.inventory_item_id;
                          // Consumption = product's consumption * quantity defined in package * quantity of package in order
                          const change = -(pkgItemDetails.inventory_consumed_per_unit * 1 * orderItem.quantity); // Assuming package definition quantity is 1, adjust if 'package_items.quantity' is used
                          const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Unknown Inv Item' };
                          inventoryAdjustments[invItemId] = { ...currentData, change: currentData.change + change };
                     }

                     // Consume for the package item's selected modifiers
                      for (const modifier of pkgItem.selectedModifiers) {
                         const modDetails = productDetailsMap.get(modifier.productId);
                         if (modDetails?.inventory_item_id && modDetails.inventory_consumed_per_unit) {
                             const invItemId = modDetails.inventory_item_id;
                             const change = -(modDetails.inventory_consumed_per_unit * orderItem.quantity); // Modifier consumption per overall package qty
                             const currentData = inventoryAdjustments[invItemId] || { change: 0, name: inventoryMap.get(invItemId)?.name || 'Unknown Inv Item' };
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
          toast({ title: "Inventory Error", description: `Failed to update inventory: ${error instanceof Error ? error.message : 'Unknown error'}. Order not saved.`, variant: "destructive" });
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
                         // Try to find the slot label from the original definition or override
                         pkgItem.selectedModifiers.forEach(mod => {
                             const slot = selectedPackageDetail?.itemSlots[pkgItem.packageItemId]?.find(s => s.id === mod.slotId);
                             components.push({ name: `↳ ${mod.name}`, slotLabel: slot?.label || `Mod (${pkgItem.productName})`}); // Indent or label differently
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
                  {cat.imageUrl ? (
                    <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>
                  )}
                  {cat.type === 'paquete' && <Badge variant="secondary" className="absolute top-1 right-1 text-accent border-accent">Paquete</Badge>}
                 </div>
                 <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm md:text-base">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
             {displayCategories.length === 0 && <p className="col-span-full text-center text-muted-foreground py-10">No categories available.</p>}
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

             {/* Packages Section (Products from category type 'paquete') */}
             {selectedCategory?.type === 'paquete' && packages.length > 0 && (
                 <>
                    {/* <h3 className="text-lg font-medium mb-3 text-accent border-b pb-1">Available Packages</h3> */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                    {packages.map(pkg => ( // pkg is type Product
                        <Card key={pkg.id} onClick={() => handleProductClick(pkg)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden border-accent border-2">
                            <div className="relative w-full h-32 bg-secondary">
                                {pkg.imageUrl ? (
                                    <Image src={pkg.imageUrl} alt={pkg.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="combo meal deal" />
                                ) : (
                                     <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>
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

            {/* Products Section (Products from category type 'producto') */}
             {selectedCategory?.type !== 'paquete' && products.length > 0 && (
                 <>
                     {/* Optional: Title like "Individual Products" if needed */}
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {products.map(prod => (
                        <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                            <div className="relative w-full h-32 bg-secondary">
                              {prod.imageUrl ? (
                                <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food" />
                               ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>
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
                <p className="col-span-full text-center text-muted-foreground py-10">No items found in the '{selectedCategory?.name}' category.</p>
             )}
          </>
        );

     case 'modifiers':
         if (isLoading.modifiers) {
             return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
         }
         if (!selectedProduct) return <p className="text-center text-muted-foreground py-10">Error: No product selected. Please go back.</p>;
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to {selectedCategory?.name || 'Items'}
            </Button>
             <h2 className="text-xl font-semibold mb-2">{selectedProduct.name} - {formatCurrency(selectedProduct.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Select modifiers for this product.</p>

             {currentModifierSlots.length === 0 && <p className="text-muted-foreground my-4">No modifiers available for this product.</p>}

             <div className="space-y-6">
                {currentModifierSlots.map(slot => (
                    <div key={slot.id}>
                        <h3 className="text-lg font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h3>
                         {slot.selectedOptions.length > 0 && (
                             <div className="mb-2 text-xs text-muted-foreground">Selected: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                         )}
                         {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No options available for "{slot.label}". Check the linked category.</p>}
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
                                    optionInvItemName = invItem?.name || 'Inventory Item';
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
                                        title={isDisabled ? `Max (${slot.max_quantity}) reached` : isOutOfStock ? `Out of Stock (${optionInvItemName})` : option.name}
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
               Add to Order
            </Button>
          </>
        );

    case 'package-details':
        if (isLoading.packageDetails) {
           return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        if (!selectedPackageDetail) return <p className="text-center text-muted-foreground py-10">Error: No package selected. Please go back.</p>;

        const { packageDef, packageItems, itemSlots } = selectedPackageDetail;

        return (
            <>
             <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to {selectedCategory?.name || 'Items'}
             </Button>
             <h2 className="text-xl font-semibold mb-1">{packageDef.name} - {formatCurrency(packageDef.price)}</h2>
             <p className="text-sm text-muted-foreground mb-4">Configure options for this package.</p>

             <div className="space-y-6">
                 {packageItems.map(item => ( // item is PackageItem definition
                    <Card key={item.id} className="p-4">
                        <CardTitle className="text-lg mb-3">{item.product_name} <span className="text-base font-normal text-muted-foreground">(x{item.quantity})</span></CardTitle>
                        {/* Get the modifier slots applicable to this item within the package */}
                        <div className="space-y-4 pl-4 border-l-2 border-muted ml-1">
                            {(itemSlots[item.id] || []).length === 0 && <p className="text-sm text-muted-foreground">No configurable options for this item.</p>}
                            {(itemSlots[item.id] || []).map(slot => (
                                <div key={slot.id}>
                                    {/* Display label, using override min/max */}
                                    <h4 className="text-md font-medium mb-2">{slot.label} <span className="text-sm text-muted-foreground">(Min: {slot.min_quantity}, Max: {slot.max_quantity})</span></h4>
                                    {slot.selectedOptions.length > 0 && (
                                         <div className="mb-2 text-xs text-muted-foreground">Selected: {slot.selectedOptions.length} / {slot.max_quantity}</div>
                                     )}
                                    {slot.options.length === 0 && <p className="text-sm text-muted-foreground">No options available for "{slot.label}". Check the linked category.</p>}
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
                                                optionInvItemName = invItem?.name || 'Inventory Item';
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
                                                    title={isDisabled ? `Max (${maxQty}) reached` : isOutOfStock ? `Out of Stock (${optionInvItemName})` : option.name}
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
                Add Package to Order
            </Button>

            </>
        );

      default:
        return <div className="text-center text-muted-foreground py-10">Something went wrong.</div>;
    }
  };


 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]"> {/* Adjusted height */}
      {/* Main Content Area (Categories, Products, Modifiers) */}
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
                     aria-label="Customer Name Input"
                   />
                   <Button size="sm" onClick={handleSaveCustomer} aria-label="Save Customer Name"><Save className="h-4 w-4"/></Button>
                   <Button size="sm" variant="outline" onClick={() => setIsRegisteringCustomer(false)} aria-label="Cancel Customer Name Entry">X</Button>
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
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)} aria-label={`Decrease quantity of ${item.name}`}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)} aria-label={`Increase quantity of ${item.name}`}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.uniqueId)} aria-label={`Remove ${item.name} from order`}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {/* Modifier/Package Content Display */}
                         {(item.selectedModifiers.length > 0 || (item.type === 'package' && item.packageItems && item.packageItems.length > 0)) && (
                             <div className="text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                                {item.type === 'product' && <span className='font-medium text-foreground'>Modifiers:</span>}
                                {item.type === 'package' && <span className='font-medium text-foreground'>Details / Modifiers:</span>}
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
                 aria-label="Payment Method"
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
                            aria-label="Amount Paid in Cash"
                         />
                    </div>
                   {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount >= currentOrder.total && currentOrder.changeDue !== undefined && (
                     <div className="flex justify-between text-accent font-medium">
                       <span>Change Due:</span>
                       <span>{formatCurrency(currentOrder.changeDue)}</span>
                     </div>
                   )}
                    {currentOrder.paidAmount !== undefined && currentOrder.total !== undefined && currentOrder.paidAmount < currentOrder.total && (
                     <p className="text-destructive text-xs">Amount Short: {formatCurrency(currentOrder.total - currentOrder.paidAmount)}</p>
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
                    aria-label="Finalize Order and Print Ticket"
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
