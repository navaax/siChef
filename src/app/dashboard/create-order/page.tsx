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
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2, Loader2 } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // For product images
import { getCategories, getProductsByCategory, getModifiersForProduct, getProductById } from '@/services/product-service'; // Import DB service functions
import type { Category, Product, Modifier, OrderItem, CurrentOrder, ModifierSelection, SavedOrder } from '@/types/product-types'; // Import shared types


// --- Helper Functions ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const generateOrderId = (existingOrdersCount: number): string => {
  const nextId = existingOrdersCount + 1;
  return `siChef-${String(nextId).padStart(3, '0')}`;
};


// --- Component ---
export default function CreateOrderPage() {
  const [view, setView] = useState<'categories' | 'products' | 'modifiers'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Store full product
  const [currentModifiers, setCurrentModifiers] = useState<ModifierSelection[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder>({
    id: '', // Will be set when finalized
    customerName: 'Guest',
    items: [],
    subtotal: 0,
    total: 0,
    paymentMethod: 'card',
  });
  const [paidAmountInput, setPaidAmountInput] = useState('');

  // State for fetched data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Products for the selected category
  const [isLoading, setIsLoading] = useState({ categories: true, products: false, modifiers: false });

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

  const fetchProducts = useCallback(async (categoryId: string) => {
    setIsLoading(prev => ({ ...prev, products: true }));
    try {
      const fetchedProducts = await getProductsByCategory(categoryId);
      setProducts(fetchedProducts);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load products.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, products: false }));
    }
  }, [toast]);

  const fetchModifiers = useCallback(async (productId: string) => {
    if (!selectedProduct) return; // Should have selected product by now
    setIsLoading(prev => ({ ...prev, modifiers: true }));
    try {
      const fetchedModifiers = await getModifiersForProduct(productId);
      // Initialize UI state for modifiers
      setCurrentModifiers(fetchedModifiers.map(m => ({ ...m, selected: false, isApart: false })));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load modifiers.", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, modifiers: false }));
    }
  }, [toast, selectedProduct]); // Depend on selectedProduct


  // --- UI Interaction Handlers ---

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    fetchProducts(category.id); // Fetch products for this category
    setView('products');
  };

  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product); // Store the full product object
    // Fetch modifiers *before* deciding view
    setIsLoading(prev => ({ ...prev, modifiers: true })); // Indicate loading
    try {
        const fetchedModifiers = await getModifiersForProduct(product.id);
        if (fetchedModifiers && fetchedModifiers.length > 0) {
            setCurrentModifiers(fetchedModifiers.map(m => ({ ...m, selected: false, isApart: false })));
            setView('modifiers');
        } else {
            // No modifiers, add directly
            addProductToOrder(product, []);
            setView('products'); // Stay on products view
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to load modifiers.", variant: "destructive" });
        // Decide how to handle failure - maybe stay on products view?
        setView('products');
    } finally {
        setIsLoading(prev => ({ ...prev, modifiers: false })); // Stop loading indicator
    }
};

  const handleModifierChange = (modifierId: string, type: 'select' | 'apart') => {
    setCurrentModifiers(prev =>
      prev.map(mod => {
        if (mod.id === modifierId) {
          if (type === 'select') {
            return { ...mod, selected: !mod.selected, isApart: !mod.selected ? false : mod.isApart }; // Reset 'apart' if deselected
          } else if (type === 'apart') {
            // Toggle 'aparte', ensure 'selected' is true if 'apart' becomes true
            const newApartState = !mod.isApart;
            return { ...mod, isApart: newApartState, selected: newApartState || mod.selected };
          }
        }
        return mod;
      })
    );
  };

  const handleAddProductWithModifiers = () => {
    if (!selectedProduct) return;

    const chosenModifiers = currentModifiers.filter(m => m.selected);
    addProductToOrder(selectedProduct, chosenModifiers);

    // Reset and go back
    setSelectedProduct(null);
    setCurrentModifiers([]);
    setView('products');
  };

   const addProductToOrder = (product: Product, modifiers: ModifierSelection[]) => {
    const modifierPrice = modifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const itemPrice = product.price + modifierPrice;

    const newOrderItem: OrderItem = {
      productId: product.id,
      name: product.name,
      quantity: 1, // Start with quantity 1
      basePrice: product.price,
      selectedModifiers: modifiers,
      totalPrice: itemPrice, // Price for quantity 1 initially
      uniqueId: Date.now().toString() + Math.random().toString(), // Simple unique ID
    };

    setCurrentOrder(prev => ({
      ...prev,
      items: [...prev.items, newOrderItem]
    }));

    toast({
        title: `${product.name} added`,
        description: `Modifiers: ${modifiers.map(m => m.name).join(', ') || 'None'}`,
    })
  };

   // Effect to calculate totals whenever order items change
  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    // Assuming total is same as subtotal for now (no tax/discounts)
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal }));
  }, [currentOrder.items]);

    const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      let updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(0, item.quantity + delta); // Allow quantity to become 0
          const pricePerUnit = item.basePrice + item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: pricePerUnit * newQuantity,
          };
        }
        return item;
      });
      // Remove item if quantity is 0
      updatedItems = updatedItems.filter(item => item.quantity > 0);

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

  const handleBack = () => {
    if (view === 'modifiers') {
      setView('products');
      setSelectedProduct(null);
      setCurrentModifiers([]);
    } else if (view === 'products') {
      setView('categories');
      setSelectedCategory(null);
      setProducts([]); // Clear products when going back to categories
    }
  };

    // Effect to calculate change due when paid amount or total changes (for cash)
  useEffect(() => {
    if (currentOrder.paymentMethod === 'cash') {
      const paid = parseFloat(paidAmountInput) || 0;
      const change = paid - currentOrder.total;
      setCurrentOrder(prev => ({
        ...prev,
        paidAmount: paid,
        changeDue: change >= 0 ? change : undefined // Only show non-negative change
      }));
    } else {
      // Reset cash-specific fields if switching away from cash
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

  const handleFinalizeOrder = () => {
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
             createdAt: new Date(order.createdAt) // Ensure date is parsed correctly
         }));
     } catch (e) {
        console.error("Error parsing existing orders from localStorage", e);
        // Handle error, maybe reset localStorage or notify user
     }

     const newOrderId = generateOrderId(existingOrders.length);
     const newOrderNumber = existingOrders.length + 1;


    // 2. Format the new order object to match the SavedOrder structure
     const finalizedOrder: SavedOrder = {
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => ({ // Map to SavedOrderItem
          id: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.basePrice, // Store base price per unit
          components: item.selectedModifiers.map(m => m.name),
          // Simplify: mark true if *any* modifier had isApart
          isApart: item.selectedModifiers.some(m => m.isApart)
      })),
      paymentMethod: currentOrder.paymentMethod,
      subtotal: currentOrder.subtotal, // Store calculated subtotal
      total: currentOrder.total,
      status: 'pending', // Default status
      createdAt: new Date(),
      paidAmount: currentOrder.paidAmount,
      changeGiven: currentOrder.changeDue,
    };

    // 3. Save to localStorage (Simulating backend)
    const updatedOrders = [...existingOrders, finalizedOrder];
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    // 4. Trigger Print (Simulated - Keep console log for now)
    console.log('--- Printing Kitchen Comanda ---');
    console.log(`Pedido #: ${finalizedOrder.orderNumber} (${finalizedOrder.id})`);
    console.log(`Cliente: ${finalizedOrder.customerName}`);
    console.log('-----------------------------');
    finalizedOrder.items.forEach(item => {
      console.log(`${item.quantity}x ${item.name} (${formatCurrency(item.price)} each)`);
      if (item.components && item.components.length > 0) {
        // Find the original OrderItem to check individual modifier 'isApart' status
        const originalOrderItem = currentOrder.items.find(ci => ci.productId === item.id);
        item.components.forEach(compName => {
            const originalModifier = originalOrderItem?.selectedModifiers.find(sm => sm.name === compName);
            console.log(`  - ${compName} ${originalModifier?.isApart ? '(Aparte)' : ''}`);
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
    setView('categories'); // Go back to categories view
    setSelectedCategory(null);
    setSelectedProduct(null);
    setCurrentModifiers([]);
    setProducts([]); // Clear product list


    toast({ title: "Order Finalized", description: `${finalizedOrder.id} created and sent to kitchen.` });

    // Potentially navigate back to home or stay for new order
    // router.push('/dashboard/home');
  };

  const renderContent = () => {
    switch (view) {
      case 'categories':
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
      case 'products':
        if (isLoading.products) {
          return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Categories
            </Button>
            <h2 className="text-xl font-semibold mb-4"> {selectedCategory?.name}</h2>
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
               {products.length === 0 && <p className="col-span-full text-center text-muted-foreground">No products in this category.</p>}
            </div>
          </>
        );
      case 'modifiers':
         if (isLoading.modifiers) {
            return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
         }
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to {selectedCategory?.name || 'Products'}
            </Button>
             <h2 className="text-xl font-semibold mb-2">{selectedProduct?.name} - {formatCurrency(selectedProduct?.price || 0)}</h2>
             <h3 className="text-lg font-medium mb-4">Complementos</h3>
             <div className="space-y-3 mb-6">
                {currentModifiers.map(mod => (
                    <div key={mod.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-3">
                             <input
                                type="checkbox"
                                id={`mod-select-${mod.id}`}
                                checked={!!mod.selected} // Ensure boolean
                                onChange={() => handleModifierChange(mod.id, 'select')}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                             />
                            <label htmlFor={`mod-select-${mod.id}`} className="text-sm font-medium cursor-pointer select-none">
                                {mod.name} {mod.priceModifier ? ` (+${formatCurrency(mod.priceModifier)})` : ''}
                            </label>
                        </div>
                         <label
                           htmlFor={`mod-apart-${mod.id}`}
                           className={`flex items-center gap-2 text-sm cursor-pointer select-none transition-colors ${mod.selected ? 'hover:text-accent' : 'text-muted-foreground cursor-not-allowed opacity-50'}`}
                           onClick={(e) => { // Use onClick for label to handle disabled state
                                if (!mod.selected) {
                                    e.preventDefault(); // Prevent toggling if parent not selected
                                    return;
                                }
                                handleModifierChange(mod.id, 'apart');
                            }}
                            title={mod.selected ? "Toggle 'Aparte'" : "'Aparte' requires selecting the item first"}
                           >
                           Aparte
                            <input
                                type="checkbox"
                                id={`mod-apart-${mod.id}`}
                                checked={!!mod.isApart} // Ensure boolean
                                onChange={() => handleModifierChange(mod.id, 'apart')} // Will be handled by label's onClick
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                disabled={!mod.selected} // Disable checkbox directly if parent not selected
                            />
                        </label>
                    </div>
                ))}
                {currentModifiers.length === 0 && <p className="text-muted-foreground">No complements available for this product.</p>}
            </div>
            <Button onClick={handleAddProductWithModifiers} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar al Pedido
            </Button>
          </>
        );
      default:
        return null;
    }
  };


 return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.16))]"> {/* Adjusted height */}
      {/* Main Content (Categories/Products/Modifiers) */}
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col shadow-md">
            <CardHeader>
                <CardTitle>Crear Pedido</CardTitle>
                <CardDescription>Seleccione categorías, productos y complementos.</CardDescription>
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
                             <span className="flex-1 mr-2">{item.name}</span>
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
                         {item.selectedModifiers.length > 0 && (
                         <ul className="list-disc list-inside text-xs text-muted-foreground ml-4 mt-1 space-y-0.5">
                             {item.selectedModifiers.map(mod => (
                             <li key={mod.id}>
                                 {mod.name} {mod.priceModifier ? `(${formatCurrency(mod.priceModifier)})` : ''}
                                  {mod.isApart ? <Badge variant="outline" className="ml-1 text-xs px-1 py-0">Aparte</Badge> : ''}
                             </li>
                             ))}
                         </ul>
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
                 {/* Add Tax/Fees here if needed */}
               <div className="flex justify-between font-bold text-base">
                 <span>Total</span>
                 <span>{formatCurrency(currentOrder.total)}</span>
               </div>

               <RadioGroup
                 defaultValue="card"
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
                            className="pl-6" // Make space for the $ sign
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
