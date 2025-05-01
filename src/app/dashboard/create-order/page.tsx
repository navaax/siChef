"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, MinusCircle, ChevronLeft, Save, Printer, Trash2 } from 'lucide-react'; // Icons
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image'; // For product images

// --- Types ---
interface Modifier {
  id: string;
  name: string;
  priceModifier?: number; // Optional price adjustment
  selected?: boolean; // For checkbox selection
  isApart?: boolean; // For 'aparte' selection
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  imageUrl: string; // Added image URL
  modifiers?: Modifier[]; // Modifiers specific to this product
}

interface Category {
  id: string;
  name: string;
  imageUrl: string; // Added image URL for category
}

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  selectedModifiers: Modifier[]; // Modifiers chosen for this specific item instance
  totalPrice: number; // Calculated price with modifiers
  uniqueId: string; // Unique ID for each item added to the cart (e.g., using timestamp or uuid)
}

interface CurrentOrder {
  id: string; // e.g., siChef-005
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'card';
  paidAmount?: number;
  changeDue?: number;
}


// --- Mock Data ---
const categories: Category[] = [
  { id: 'cat-burgers', name: 'Burgers', imageUrl: 'https://picsum.photos/200/150?random=1' },
  { id: 'cat-salads', name: 'Salads', imageUrl: 'https://picsum.photos/200/150?random=2' },
  { id: 'cat-drinks', name: 'Drinks', imageUrl: 'https://picsum.photos/200/150?random=3' },
  { id: 'cat-sides', name: 'Sides', imageUrl: 'https://picsum.photos/200/150?random=4' },
];

const products: Product[] = [
  // Burgers
  {
    id: 'prod-101', name: 'Cheeseburger', price: 8.50, categoryId: 'cat-burgers', imageUrl: 'https://picsum.photos/200/150?random=11',
    modifiers: [
      { id: 'mod-pickle', name: 'Extra Pickles' },
      { id: 'mod-bacon', name: 'Add Bacon', priceModifier: 1.50 },
      { id: 'mod-cheese', name: 'Extra Cheese', priceModifier: 1.00 },
      { id: 'mod-onion', name: 'No Onions' },
    ]
  },
  { id: 'prod-102', name: 'Veggie Burger', price: 7.50, categoryId: 'cat-burgers', imageUrl: 'https://picsum.photos/200/150?random=12', modifiers: [ { id: 'mod-lettuce', name: 'Lettuce Wrap' }, { id: 'mod-avocado', name: 'Add Avocado', priceModifier: 1.25 } ] },
  // Salads
  { id: 'prod-305', name: 'Chicken Salad', price: 9.75, categoryId: 'cat-salads', imageUrl: 'https://picsum.photos/200/150?random=21', modifiers: [{ id: 'mod-dressing', name: 'Ranch Dressing'}, { id: 'mod-dressing-vinaigrette', name: 'Vinaigrette'}] },
  { id: 'prod-306', name: 'Caesar Salad', price: 9.00, categoryId: 'cat-salads', imageUrl: 'https://picsum.photos/200/150?random=22', modifiers: [{ id: 'mod-anchovies', name: 'Add Anchovies', priceModifier: 1.00 }] },
  // Drinks
  { id: 'prod-401', name: 'Iced Tea', price: 2.50, categoryId: 'cat-drinks', imageUrl: 'https://picsum.photos/200/150?random=31' },
  { id: 'prod-402', name: 'Cola', price: 2.00, categoryId: 'cat-drinks', imageUrl: 'https://picsum.photos/200/150?random=32' },
  // Sides
  { id: 'prod-203', name: 'Fries', price: 3.00, categoryId: 'cat-sides', imageUrl: 'https://picsum.photos/200/150?random=41' },
  { id: 'prod-204', name: 'Onion Rings', price: 4.00, categoryId: 'cat-sides', imageUrl: 'https://picsum.photos/200/150?random=42' },
];


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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<Modifier[]>([]);
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

  const { toast } = useToast();

  // Effect to calculate totals whenever order items change
  useEffect(() => {
    const subtotal = currentOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    setCurrentOrder(prev => ({ ...prev, subtotal: subtotal, total: subtotal })); // Add tax/fees later if needed
  }, [currentOrder.items]);

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


  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    setView('products');
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    if (product.modifiers && product.modifiers.length > 0) {
      // Initialize modifiers state for the selected product
      setCurrentModifiers(product.modifiers.map(m => ({ ...m, selected: false, isApart: false })));
      setView('modifiers');
    } else {
      // Add product directly if no modifiers
      addProductToOrder(product, []);
      setView('products'); // Stay on products view
    }
  };

  const handleModifierChange = (modifierId: string, type: 'select' | 'apart') => {
    setCurrentModifiers(prev =>
      prev.map(mod => {
        if (mod.id === modifierId) {
          if (type === 'select') {
            return { ...mod, selected: !mod.selected };
          } else if (type === 'apart') {
            // Ensure 'aparte' can only be true if the modifier is selected
            const newApartState = !mod.isApart;
            return { ...mod, isApart: newApartState, selected: newApartState ? true : mod.selected };
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

   const addProductToOrder = (product: Product, modifiers: Modifier[]) => {
    const modifierPrice = modifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    const itemPrice = product.price + modifierPrice;

    const newOrderItem: OrderItem = {
      productId: product.id,
      name: product.name,
      quantity: 1, // Start with quantity 1
      basePrice: product.price,
      selectedModifiers: modifiers,
      totalPrice: itemPrice,
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

  const handleQuantityChange = (uniqueId: string, delta: number) => {
     setCurrentOrder(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.uniqueId === uniqueId) {
          const newQuantity = Math.max(1, item.quantity + delta); // Ensure quantity doesn't go below 1
          const pricePerItem = item.totalPrice / item.quantity; // Recalculate price based on base + modifiers
          return {
            ...item,
            quantity: newQuantity,
            totalPrice: pricePerItem * newQuantity,
          };
        }
        return item;
      });
       // Optionally remove item if quantity becomes 0 (if delta can be -1 and quantity is 1)
        // updatedItems = updatedItems.filter(item => item.quantity > 0);

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
    }
  };

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
     const existingOrders: any[] = JSON.parse(storedOrdersString); // Use 'any' carefully or define a proper type
     const newOrderId = generateOrderId(existingOrders.length);


    // 2. Format the new order object to match the structure in home/page.tsx
     const finalizedOrder = {
      id: newOrderId,
      orderNumber: existingOrders.length + 1,
      customerName: currentOrder.customerName,
      items: currentOrder.items.map(item => ({ // Map to the structure expected in home/page.tsx
          id: item.productId, // Use productId as the item's ID in the final order
          name: item.name,
          quantity: item.quantity,
          price: item.basePrice, // Store base price, total might be derived or stored separately if needed
          components: item.selectedModifiers.map(m => m.name),
          isApart: item.selectedModifiers.some(m => m.isApart) // Check if any modifier has isApart
      })),
      paymentMethod: currentOrder.paymentMethod,
      total: currentOrder.total,
      status: 'pending' as const, // Default status
      createdAt: new Date(),
      paidAmount: currentOrder.paidAmount,
      changeGiven: currentOrder.changeDue, // Renamed from changeDue
    };

    // 3. Save to localStorage (Simulating backend)
    const updatedOrders = [...existingOrders, finalizedOrder];
    localStorage.setItem('siChefOrders', JSON.stringify(updatedOrders));

    // 4. Trigger Print (Simulated)
    console.log('--- Printing Kitchen Comanda ---');
    console.log(`Pedido #: ${finalizedOrder.orderNumber} (${finalizedOrder.id})`);
    console.log(`Cliente: ${finalizedOrder.customerName}`);
    console.log('-----------------------------');
    finalizedOrder.items.forEach(item => {
      console.log(`${item.quantity}x ${item.name}`);
      if (item.components && item.components.length > 0) {
        item.components.forEach(comp => {
             // Need to find the original modifier to check isApart
             const originalModifier = currentOrder.items
                .find(ci => ci.productId === item.id)
                ?.selectedModifiers.find(sm => sm.name === comp);
          console.log(`  - ${comp} ${originalModifier?.isApart ? '(Aparte)' : ''}`);
        });
      }
    });
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


    toast({ title: "Order Finalized", description: `${finalizedOrder.id} created and sent to kitchen.` });

    // Potentially navigate back to home or stay for new order
    // router.push('/dashboard/home');
  };

  const renderContent = () => {
    switch (view) {
      case 'categories':
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.map(cat => (
              <Card key={cat.id} onClick={() => handleCategoryClick(cat)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                 <div className="relative w-full h-32">
                  <Image src={cat.imageUrl} alt={cat.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="food category" />
                 </div>
                 <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm md:text-base">{cat.name}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        );
      case 'products':
        const categoryProducts = products.filter(p => p.categoryId === selectedCategory?.id);
        return (
          <>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Categories
            </Button>
            <h2 className="text-xl font-semibold mb-4"> {selectedCategory?.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categoryProducts.map(prod => (
                <Card key={prod.id} onClick={() => handleProductClick(prod)} className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden">
                    <div className="relative w-full h-32">
                      <Image src={prod.imageUrl} alt={prod.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300" data-ai-hint="menu item food" />
                     </div>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm md:text-base">{prod.name}</CardTitle>
                    <CardDescription className="text-xs md:text-sm">{formatCurrency(prod.price)}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
               {categoryProducts.length === 0 && <p>No products in this category.</p>}
            </div>
          </>
        );
      case 'modifiers':
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
                                checked={mod.selected}
                                onChange={() => handleModifierChange(mod.id, 'select')}
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                             />
                            <label htmlFor={`mod-select-${mod.id}`} className="text-sm font-medium cursor-pointer select-none">
                                {mod.name} {mod.priceModifier ? ` (+${formatCurrency(mod.priceModifier)})` : ''}
                            </label>
                        </div>
                         <label
                           htmlFor={`mod-apart-${mod.id}`}
                           className="flex items-center gap-2 text-sm cursor-pointer select-none hover:text-accent transition-colors"
                           onDoubleClick={(e) => {
                               e.preventDefault(); // Prevent text selection on double click
                               handleModifierChange(mod.id, 'apart');
                            }}
                            title="Double-click to toggle 'Aparte'"
                           >
                           Aparte
                            <input
                                type="checkbox"
                                id={`mod-apart-${mod.id}`}
                                checked={mod.isApart}
                                onChange={() => handleModifierChange(mod.id, 'apart')} // Also allow single click change
                                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                                disabled={!mod.selected && !mod.isApart} // Disable if not selected initially, unless already 'apart'
                            />
                        </label>
                    </div>
                ))}
                {currentModifiers.length === 0 && <p>No complements available for this product.</p>}
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-theme(spacing.24))]"> {/* Adjust height based on layout */}
      {/* Main Content (Categories/Products/Modifiers) */}
      <div className="lg:col-span-2 h-full">
         <Card className="h-full flex flex-col">
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
         <Card className="h-full flex flex-col">
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
                     <div key={item.uniqueId} className="text-sm border-b pb-2">
                         <div className="flex justify-between items-center font-medium mb-1">
                             <span>{item.name}</span>
                             <span>{formatCurrency(item.totalPrice)}</span>
                         </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, -1)}><MinusCircle className="h-4 w-4"/></Button>
                                <span>{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleQuantityChange(item.uniqueId, 1)}><PlusCircle className="h-4 w-4"/></Button>
                            </div>
                             <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemoveItem(item.uniqueId)}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                         {item.selectedModifiers.length > 0 && (
                         <ul className="list-disc list-inside text-xs text-muted-foreground ml-4 mt-1">
                             {item.selectedModifiers.map(mod => (
                             <li key={mod.id}>
                                 {mod.name} {mod.priceModifier ? `(${formatCurrency(mod.priceModifier)})` : ''}
                                  {mod.isApart ? <Badge variant="outline" className="ml-1 text-xs">Aparte</Badge> : ''}
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
               {/* <div className="flex justify-between">
                 <span className="text-muted-foreground">Subtotal</span>
                 <span>{formatCurrency(currentOrder.subtotal)}</span>
               </div> */}
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
            <div className="p-4 border-t mt-auto">
                 <Button className="w-full" onClick={handleFinalizeOrder} disabled={currentOrder.items.length === 0}>
                    <Printer className="mr-2 h-4 w-4" /> Finalizar y Imprimir Comanda
                 </Button>
            </div>
         </Card>
       </div>
    </div>
  );
}
