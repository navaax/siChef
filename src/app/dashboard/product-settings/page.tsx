// src/app/dashboard/product-settings/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form'; // Added Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle } from 'lucide-react'; // Added Save, X, MinusCircle
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added DialogClose
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Added AlertDialog
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator'; // Added Separator
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils'; // Added cn

// Import services
import {
    getCategories, addCategory, updateCategory, deleteCategory,
    getProductsByCategory, addProduct, updateProduct, deleteProduct,
    getPackagesByCategory, // Using getProductsByCategory with type 'paquete' or getPackagesByCategory
    getProductById, // Needed for fetching packages/products
    getModifierSlotsForProduct, addModifierSlot, deleteModifierSlot, // Added deleteModifierSlot
    getItemsForPackage, addPackageItem, deletePackageItem, // Added deletePackageItem
    getOverridesForPackageItem, setPackageItemOverride, deletePackageItemOverride // Added deletePackageItemOverride
} from '@/services/product-service';
import { getInventoryItems } from '@/services/inventory-service';

// Import types
import type { Category, Product, InventoryItem, ProductModifierSlot, PackageItem, PackageItemModifierSlotOverride } from '@/types/product-types';

// --- Schemas ---
const categorySchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    type: z.enum(['producto', 'modificador', 'paquete'], { required_error: "Tipo es requerido" }),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

const productSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"), // Coerce to number
    categoryId: z.string().min(1, "Categoría es requerida"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    // Use `null` as the default for optional string to avoid Zod issues with empty strings
    inventory_item_id: z.string().nullable().optional(), // Make optional here to handle empty string case
    inventory_consumed_per_unit: z.coerce.number().min(0, "Consumo debe ser positivo").optional().nullable(),
}).refine(data => !data.inventory_item_id || (data.inventory_item_id && data.inventory_consumed_per_unit !== undefined && data.inventory_consumed_per_unit !== null), {
    message: "El consumo por unidad es requerido si se vincula un item de inventario.",
    path: ["inventory_consumed_per_unit"],
});
type ProductFormValues = z.infer<typeof productSchema>;


// For packages (which are also products)
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    categoryId: z.string().min(1, "Categoría (tipo paquete) es requerida"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    // Packages generally don't have direct inventory links, items inside do
});
type PackageFormValues = z.infer<typeof packageSchema>;

const addPackageItemSchema = z.object({
    product_id: z.string().min(1, "Selecciona un producto"),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
});
type AddPackageItemFormValues = z.infer<typeof addPackageItemSchema>;

// --- Components ---

const ManageCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // Store ID of item being deleted
    const { toast } = useToast();

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '', type: 'producto', imageUrl: '' },
    });

    const fetchCategoriesData = async () => {
        setIsLoading(true);
        try {
            const data = await getCategories(); // Fetch all types
            setCategories(data);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las categorías.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategoriesData();
    }, [toast]); // Added toast dependency

    const handleOpenForm = (category: Category | null = null) => {
        setEditingCategory(category);
        if (category) {
            form.reset(category); // Load existing data into the form
        } else {
            form.reset({ name: '', type: 'producto', imageUrl: '' }); // Reset for new category
        }
        setIsFormOpen(true);
    };

    const handleFormSubmit: SubmitHandler<CategoryFormValues> = async (values) => {
        try {
            if (editingCategory) {
                await updateCategory(editingCategory.id, values);
                toast({ title: "Éxito", description: "Categoría actualizada." });
            } else {
                await addCategory(values);
                toast({ title: "Éxito", description: "Categoría añadida." });
            }
            setIsFormOpen(false);
            fetchCategoriesData(); // Refresh list
        } catch (error) {
             const action = editingCategory ? 'actualizar' : 'añadir';
            toast({ title: "Error", description: `No se pudo ${action} la categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

     const handleDeleteCategory = async (id: string) => {
        setIsDeleting(id); // Indicate deletion in progress
        try {
            await deleteCategory(id);
            toast({ title: "Éxito", description: "Categoría eliminada.", variant: "destructive" });
            fetchCategoriesData(); // Refresh list
             // Close the edit form if the deleted category was being edited
             if (editingCategory?.id === id) {
                 setIsFormOpen(false);
             }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo eliminar la categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
            // Consider checking for related products if CASCADE DELETE isn't reliable or needs confirmation
        } finally {
            setIsDeleting(null); // Reset deletion indicator
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestionar Categorías</h3>
                 <Button size="sm" onClick={() => handleOpenForm()}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Categoría
                 </Button>
            </div>
            <p className="text-muted-foreground mb-4">Añade, edita o elimina categorías. Define si contienen productos, modificadores o paquetes.</p>

            <Card>
                 <CardContent className="p-0">
                     <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Imagen</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">Cargando...</TableCell></TableRow>
                                ) : categories.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No hay categorías.</TableCell></TableRow>
                                ) : (
                                    categories.map(cat => (
                                        <TableRow key={cat.id}>
                                            <TableCell className="font-medium">{cat.name}</TableCell>
                                            <TableCell className="capitalize">{cat.type}</TableCell>
                                            <TableCell>
                                                {cat.imageUrl ? (
                                                    <Image src={cat.imageUrl} alt={cat.name} width={40} height={30} className="rounded object-cover" data-ai-hint="food category image"/>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => handleOpenForm(cat)} title="Editar Categoría">
                                                    <Edit className="h-4 w-4" />
                                                 </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === cat.id} title="Eliminar Categoría">
                                                            {isDeleting === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                             Esta acción eliminará la categoría "{cat.name}" y todos los productos asociados a ella. Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Eliminar
                                                        </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                 </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                     </ScrollArea>
                </CardContent>
             </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Añadir Nueva Categoría'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? `Modifica los detalles de "${editingCategory.name}".` : 'Define una nueva categoría.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl><Input placeholder="e.g., Alitas, Bebidas" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="producto">Producto (items vendibles)</SelectItem>
                                                <SelectItem value="modificador">Modificador (opciones)</SelectItem>
                                                <SelectItem value="paquete">Paquete (combos)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="imageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL de Imagen (Opcional)</FormLabel>
                                        <FormControl><Input type="url" placeholder="https://picsum.photos/..." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                    Guardar Cambios
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

        </div>
    );
};

const ManageProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    // Filter categories for product assignment (exclude 'paquete')
    const productCategories = useMemo(() => categories.filter(c => c.type === 'producto' || c.type === 'modificador'), [categories]);
    // Filter categories for modifier slots (only 'modificador' type)
    const modifierCategories = useMemo(() => categories.filter(c => c.type === 'modificador'), [categories]);

    const [currentModifierSlots, setCurrentModifierSlots] = useState<ProductModifierSlot[]>([]);
    const [isModifierSlotsLoading, setIsModifierSlotsLoading] = useState(false);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            price: 0,
            categoryId: '',
            imageUrl: '',
            inventory_item_id: null, // Use null for optional selects
            inventory_consumed_per_unit: 1,
        },
    });

     const fetchProductData = async () => {
        setIsLoading(true);
        try {
            const [fetchedCategories, fetchedInventory] = await Promise.all([
                getCategories(),
                getInventoryItems(),
            ]);
            setCategories(fetchedCategories);
            setInventoryItems(fetchedInventory);

            let allProducts: Product[] = [];
            const productCatIds = fetchedCategories.filter(c => c.type === 'producto' || c.type === 'modificador').map(c => c.id);
            for (const catId of productCatIds) {
                const catProducts = await getProductsByCategory(catId);
                allProducts = [...allProducts, ...catProducts];
            }
            setProducts(allProducts);

        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar productos, categorías o inventario.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProductData();
    }, [toast]); // Added toast dependency

    // Fetch modifier slots for the product when editing
    useEffect(() => {
        if (editingProduct && isFormOpen) {
            const fetchSlots = async () => {
                setIsModifierSlotsLoading(true);
                try {
                    const slots = await getModifierSlotsForProduct(editingProduct.id);
                    setCurrentModifierSlots(slots);
                } catch (error) {
                    toast({ title: "Error", description: `No se pudieron cargar los modificadores para ${editingProduct.name}.`, variant: "destructive" });
                    setCurrentModifierSlots([]);
                } finally {
                    setIsModifierSlotsLoading(false);
                }
            };
            fetchSlots();
        } else {
            setCurrentModifierSlots([]); // Clear slots when dialog closes or it's a new product
        }
    }, [editingProduct, isFormOpen, toast]);

    const handleOpenForm = (product: Product | null = null) => {
        setEditingProduct(product);
        if (product) {
            form.reset({ // Map product data to form values
                name: product.name,
                price: product.price,
                categoryId: product.categoryId,
                imageUrl: product.imageUrl || '',
                inventory_item_id: product.inventory_item_id || null, // Use null if undefined/empty
                inventory_consumed_per_unit: product.inventory_consumed_per_unit ?? 1,
            });
            // Modifier slots will be fetched by the useEffect
        } else {
             form.reset({
                name: '',
                price: 0,
                categoryId: '',
                imageUrl: '',
                inventory_item_id: null, // Reset with null
                inventory_consumed_per_unit: 1,
            });
             setCurrentModifierSlots([]); // Ensure slots are clear for new product
        }
        setIsFormOpen(true);
    };

     const handleFormSubmit: SubmitHandler<ProductFormValues> = async (values) => {
        // Ensure inventory_item_id is handled correctly (null vs undefined)
        const dataToSave = {
            ...values,
            inventory_item_id: values.inventory_item_id === '' ? null : values.inventory_item_id,
            inventory_consumed_per_unit: values.inventory_item_id === '' ? null : (values.inventory_consumed_per_unit ?? 1),
        };

        // console.log("Saving product:", dataToSave); // Log data being sent

        try {
             if (editingProduct) {
                await updateProduct(editingProduct.id, dataToSave);
                toast({ title: "Éxito", description: "Producto actualizado." });
             } else {
                 // Create product first, then potentially keep dialog open to add modifiers
                const newProduct = await addProduct(dataToSave as Omit<Product, 'id'>);
                toast({ title: "Éxito", description: "Producto añadido. Puedes añadir modificadores." });
                setEditingProduct(newProduct); // Update state to allow adding modifiers immediately
                fetchProductData(); // Refresh list in background
                // Do NOT close form here, allow adding modifiers
                return;
             }
            // If just updating, close the form
            setIsFormOpen(false);
            fetchProductData(); // Refresh list
        } catch (error) {
             const action = editingProduct ? 'actualizar' : 'añadir';
            console.error(`Error ${action} product:`, error); // Log detailed error
            toast({ title: "Error", description: `No se pudo ${action} el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

    const handleDeleteProduct = async (id: string) => {
        setIsDeleting(id);
        try {
            await deleteProduct(id);
            toast({ title: "Éxito", description: "Producto eliminado.", variant: "destructive" });
            fetchProductData(); // Refresh list
             // Close the edit form if the deleted product was being edited
             if (editingProduct?.id === id) {
                 setIsFormOpen(false);
             }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo eliminar el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        } finally {
            setIsDeleting(null);
        }
    };

     // --- Modifier Slot Management ---
    const handleAddModifierSlot = async (data: { label: string; linked_category_id: string; min_quantity: number; max_quantity: number }) => {
        if (!editingProduct) return;
        setIsModifierSlotsLoading(true);
        try {
            const newSlot = await addModifierSlot({
                product_id: editingProduct.id,
                ...data,
            });
            setCurrentModifierSlots(prev => [...prev, newSlot]);
            toast({ title: "Éxito", description: "Grupo modificador añadido." });
        } catch (error) {
             toast({ title: "Error", description: `No se pudo añadir el grupo: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        } finally {
            setIsModifierSlotsLoading(false);
        }
    };

    const handleDeleteModifierSlot = async (slotId: string) => {
         if (!editingProduct) return;
         setIsModifierSlotsLoading(true);
         try {
             await deleteModifierSlot(slotId);
             setCurrentModifierSlots(prev => prev.filter(slot => slot.id !== slotId));
             toast({ title: "Éxito", description: "Grupo modificador eliminado.", variant: 'destructive' });
         } catch (error) {
              toast({ title: "Error", description: `No se pudo eliminar el grupo: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
         } finally {
             setIsModifierSlotsLoading(false);
         }
    };

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestionar Productos</h3>
                 <Button size="sm" onClick={() => handleOpenForm()}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto
                 </Button>
             </div>
             <p className="text-muted-foreground mb-4">Define productos, asigna precios, vincula inventario (opcional) y configura modificadores.</p>
             <Card>
                 <CardContent className="p-0">
                     <ScrollArea className="h-[60vh]">
                         <Table>
                             <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead>Inventario Vinculado</TableHead>
                                    <TableHead className="text-right">Consumo</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24">Cargando...</TableCell></TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24">No hay productos.</TableCell></TableRow>
                                ) : (
                                    products.map(prod => {
                                         const category = categories.find(c => c.id === prod.categoryId);
                                         const invItem = inventoryItems.find(i => i.id === prod.inventory_item_id);
                                        return (
                                            <TableRow key={prod.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                     {prod.imageUrl ? (
                                                        <Image src={prod.imageUrl} alt={prod.name} width={32} height={24} className="rounded object-cover" data-ai-hint="product item image"/>
                                                     ) : <div className='w-8 h-6 bg-muted rounded'></div>}
                                                    {prod.name}
                                                </TableCell>
                                                <TableCell>{category?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-right">${prod.price.toFixed(2)}</TableCell>
                                                <TableCell>{invItem?.name || <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                                <TableCell className="text-right">{invItem ? `${prod.inventory_consumed_per_unit ?? 1} ${invItem.unit}`: '-'}</TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => handleOpenForm(prod)} title="Editar Producto">
                                                        <Edit className="h-4 w-4" />
                                                     </Button>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === prod.id} title="Eliminar Producto">
                                                               {isDeleting === prod.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción eliminará el producto "{prod.name}". Esta acción no se puede deshacer.
                                                            </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteProduct(prod.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                Eliminar
                                                            </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                         </Table>
                     </ScrollArea>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent className="sm:max-w-[700px]"> {/* Wider dialog for modifiers */}
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
                        <DialogDescription>
                             {editingProduct ? `Modifica los detalles de "${editingProduct.name}".` : 'Define un producto vendible o una opción modificadora.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        {/* Using a unique key to force re-render on submit/reset if needed, but onSubmit handles it */}
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="e.g., Alitas 6pz, Salsa BBQ" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Precio</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="categoryId" render={({ field }) => (
                                    <FormItem><FormLabel>Categoría</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {productCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.type})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://picsum.photos/..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField
                                   control={form.control}
                                   name="inventory_item_id"
                                   render={({ field }) => (
                                       <FormItem>
                                           <FormLabel>Item de Inventario (Opcional)</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)}
                                                value={field.value ?? "__NONE__"} // Handle null for select
                                            >
                                               <FormControl>
                                                   <SelectTrigger>
                                                       <SelectValue placeholder="Vincular inventario..." />
                                                   </SelectTrigger>
                                               </FormControl>
                                               <SelectContent>
                                                   <SelectItem value="__NONE__">-- Ninguno --</SelectItem>
                                                   {inventoryItems.map(item => (
                                                       <SelectItem key={item.id} value={item.id}>
                                                           {item.name} ({item.unit})
                                                       </SelectItem>
                                                   ))}
                                               </SelectContent>
                                           </Select>
                                           <FormMessage />
                                       </FormItem>
                                   )}
                                />
                                {/* Only show consumption field if inventory item is selected */}
                                {form.watch('inventory_item_id') && (
                                    <FormField control={form.control} name="inventory_consumed_per_unit" render={({ field }) => (
                                        <FormItem><FormLabel>Consumo por Unidad</FormLabel>
                                         <FormControl>
                                             {/* Ensure value passed to Input is string or number, handle null */}
                                             <Input type="number" step="0.01" placeholder="1" {...field} value={field.value ?? 1}/>
                                         </FormControl>
                                         <FormMessage />
                                         </FormItem>
                                    )}/>
                                )}
                             </div>
                              <div className="flex justify-end">
                                  <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                        {editingProduct ? 'Guardar Cambios Producto' : 'Crear Producto'}
                                  </Button>
                              </div>
                        </form>
                    </Form>

                    {/* Modifier Slot Management (Only visible when editing a product) */}
                    {editingProduct && (
                        <div className="space-y-4 pt-6 border-t mt-6">
                            <h4 className="text-lg font-semibold">Grupos de Modificadores para "{editingProduct.name}"</h4>

                            {/* Add Slot Form (Simplified inline form) */}
                             <AddModifierSlotForm
                                modifierCategories={modifierCategories}
                                onAddSlot={handleAddModifierSlot}
                                isLoading={isModifierSlotsLoading}
                             />

                             {/* Slots List */}
                             <ScrollArea className="h-[200px] border rounded-md">
                                {isModifierSlotsLoading && !currentModifierSlots.length && <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>}
                                {!isModifierSlotsLoading && currentModifierSlots.length === 0 && (
                                    <p className="p-4 text-center text-sm text-muted-foreground">No hay grupos modificadores definidos.</p>
                                )}
                                {currentModifierSlots.length > 0 && (
                                   <Table className="text-sm">
                                       <TableHeader>
                                           <TableRow>
                                               <TableHead>Etiqueta</TableHead>
                                               <TableHead>Categoría Vinculada</TableHead>
                                               <TableHead className="w-[60px] text-center">Min</TableHead>
                                               <TableHead className="w-[60px] text-center">Max</TableHead>
                                               <TableHead className="w-[80px] text-right">Acciones</TableHead>
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {currentModifierSlots.map(slot => {
                                               const linkedCat = modifierCategories.find(c => c.id === slot.linked_category_id);
                                               return (
                                                   <TableRow key={slot.id}>
                                                        <TableCell>{slot.label}</TableCell>
                                                        <TableCell>{linkedCat?.name || 'N/A'}</TableCell>
                                                        <TableCell className="text-center">{slot.min_quantity}</TableCell>
                                                        <TableCell className="text-center">{slot.max_quantity}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteModifierSlot(slot.id)} title="Eliminar Grupo" disabled={isModifierSlotsLoading}>
                                                                <MinusCircle className="h-3 w-3" />
                                                            </Button>
                                                        </TableCell>
                                                   </TableRow>
                                               );
                                            })}
                                       </TableBody>
                                   </Table>
                                )}
                            </ScrollArea>
                        </div>
                    )}


                    <DialogFooter className="mt-6 pt-4 border-t">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cerrar</Button>
                        </DialogClose>
                        {/* Main save button might be removed if saving happens per section */}
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>
    );
};

// --- Helper component for adding modifier slots ---
const addModifierSlotSchema = z.object({
    label: z.string().min(1, "Etiqueta requerida"),
    linked_category_id: z.string().min(1, "Categoría requerida"),
    min_quantity: z.coerce.number().int().min(0).default(0),
    max_quantity: z.coerce.number().int().min(1).default(1),
}).refine(data => data.max_quantity >= data.min_quantity, {
    message: "Max debe ser mayor o igual a Min",
    path: ["max_quantity"],
});
type AddModifierSlotFormValues = z.infer<typeof addModifierSlotSchema>;

interface AddModifierSlotFormProps {
    modifierCategories: Category[];
    onAddSlot: (data: AddModifierSlotFormValues) => Promise<void>;
    isLoading: boolean;
}

const AddModifierSlotForm: React.FC<AddModifierSlotFormProps> = ({ modifierCategories, onAddSlot, isLoading }) => {
     const form = useForm<AddModifierSlotFormValues>({
        resolver: zodResolver(addModifierSlotSchema),
        defaultValues: { label: '', linked_category_id: '', min_quantity: 1, max_quantity: 1 },
    });

     const handleSubmit = async (values: AddModifierSlotFormValues) => {
        await onAddSlot(values);
        form.reset(); // Reset form after successful add
     }

     return (
         <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                <FormField control={form.control} name="label" render={({ field }) => (
                    <FormItem className="flex-grow"><FormLabel className="text-xs">Etiqueta UI</FormLabel><FormControl><Input placeholder="e.g., Salsas" {...field} /></FormControl><FormMessage className="text-xs"/> </FormItem>
                )}/>
                <FormField control={form.control} name="linked_category_id" render={({ field }) => (
                     <FormItem className="flex-grow"> <FormLabel className="text-xs">Cat. Modificador</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value || ''}>
                             <FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                             <SelectContent>
                                 {modifierCategories.length === 0 && <SelectItem value="NONE_MOD_CAT" disabled>Crea una cat. 'modificador'</SelectItem>}
                                 {modifierCategories.map(cat => ( <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem> ))}
                             </SelectContent>
                         </Select><FormMessage className="text-xs"/></FormItem>
                )}/>
                 <FormField control={form.control} name="min_quantity" render={({ field }) => (
                    <FormItem className="w-16"><FormLabel className="text-xs">Min</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage className="text-xs"/></FormItem>
                 )}/>
                 <FormField control={form.control} name="max_quantity" render={({ field }) => (
                    <FormItem className="w-16"><FormLabel className="text-xs">Max</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl><FormMessage className="text-xs"/></FormItem>
                 )}/>
                <Button type="submit" size="sm" disabled={isLoading || modifierCategories.length === 0}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                 </Button>
            </form>
         </Form>
     );
}


const ManagePackages = () => {
     const [packages, setPackages] = useState<Product[]>([]); // Packages are Products
     const [packageCategories, setPackageCategories] = useState<Category[]>([]);
     const [allProducts, setAllProducts] = useState<Product[]>([]); // For adding items to packages
     const [isLoading, setIsLoading] = useState(true);
     const [isFormOpen, setIsFormOpen] = useState(false);
     const [editingPackage, setEditingPackage] = useState<Product | null>(null);
     const [isDeleting, setIsDeleting] = useState<string | null>(null);
     const { toast } = useToast();

     // State for managing items within the currently editing package
     const [currentPackageItems, setCurrentPackageItems] = useState<PackageItem[]>([]);
     const [isPackageItemsLoading, setIsPackageItemsLoading] = useState(false);

     const packageForm = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, categoryId: '', imageUrl: '' },
    });

    const addItemForm = useForm<AddPackageItemFormValues>({
        resolver: zodResolver(addPackageItemSchema),
        defaultValues: { product_id: '', quantity: 1 },
    });

      const fetchPackageData = async () => {
        setIsLoading(true);
        try {
            const fetchedCategories = await getCategories();
            const pkgCats = fetchedCategories.filter(c => c.type === 'paquete');
            setPackageCategories(pkgCats);

            let allPackages: Product[] = [];
            for (const cat of pkgCats) {
                const pkgs = await getPackagesByCategory(cat.id);
                allPackages = [...allPackages, ...pkgs];
            }
            setPackages(allPackages);

            // Fetch all regular products/modifiers to add to packages
             let allProds: Product[] = [];
             const prodCats = fetchedCategories.filter(c => c.type === 'producto' || c.type === 'modificador');
             for (const cat of prodCats) {
                 const prods = await getProductsByCategory(cat.id);
                 allProds = [...allProds, ...prods];
             }
             setAllProducts(allProds); // Keep only products and modifiers

        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar paquetes o productos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

     useEffect(() => {
        fetchPackageData();
    }, [toast]); // Added toast dependency

     // Fetch items for the package when editing
     useEffect(() => {
        if (editingPackage && isFormOpen) {
            const fetchItems = async () => {
                setIsPackageItemsLoading(true);
                try {
                    // Ensure editingPackage.id is valid before fetching
                    if (!editingPackage.id) {
                        throw new Error("Package ID is missing.");
                    }
                    const items = await getItemsForPackage(editingPackage.id);
                    setCurrentPackageItems(items);
                } catch (error) {
                    console.error("Error fetching package items:", error); // Log error
                    toast({ title: "Error", description: `No se pudieron cargar los items para ${editingPackage.name}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
                    setCurrentPackageItems([]);
                } finally {
                    setIsPackageItemsLoading(false);
                }
            };
            fetchItems();
        } else {
            setCurrentPackageItems([]); // Clear items when dialog closes or it's a new package
        }
     }, [editingPackage, isFormOpen, toast]);


    const handleOpenForm = (pkg: Product | null = null) => {
        setEditingPackage(pkg);
        if (pkg) {
            packageForm.reset({
                name: pkg.name,
                price: pkg.price,
                categoryId: pkg.categoryId,
                imageUrl: pkg.imageUrl || '',
            });
            // Items will be fetched by the useEffect
        } else {
            packageForm.reset({ name: '', price: 0, categoryId: '', imageUrl: '' });
            setCurrentPackageItems([]); // Ensure items are clear for new package
        }
        addItemForm.reset(); // Reset add item form as well
        setIsFormOpen(true);
    };

    const handlePackageFormSubmit: SubmitHandler<PackageFormValues> = async (values) => {
        // The form ensures categoryId belongs to a 'paquete' type category implicitly
        const dataToSave: Partial<Product> = values; // Omit<Product, 'id' | 'inventory_item_id' | 'inventory_consumed_per_unit'>

        // let savedPackageId: string | undefined = editingPackage?.id; // Keep track of ID

        try {
            if (editingPackage) {
                await updateProduct(editingPackage.id, dataToSave); // Use updateProduct for packages too
                 toast({ title: "Éxito", description: "Paquete actualizado." });
                 // Optionally refetch data if needed, but typically UI updates are sufficient
                 fetchPackageData(); // Refresh list in background
            } else {
                 // Create the package product FIRST
                 const newPackage = await addProduct(dataToSave as Omit<Product, 'id'>); // Use addProduct service function
                 // savedPackageId = newPackage.id; // Store the new ID
                 toast({ title: "Éxito", description: "Paquete creado. Ahora puedes añadirle productos." });
                 // IMPORTANT: Update the editingPackage state with the newly created package
                 // This ensures the subsequent addItem calls have the correct package_id
                 setEditingPackage(newPackage);
                 await fetchPackageData(); // Refresh list in background
                 // DO NOT CLOSE DIALOG - User needs to add items
                 return; // Prevent closing dialog
            }

            // If editing, maybe close dialog after basic info save, or keep open
            // Let's keep it open for consistency, user closes manually
            // setIsFormOpen(false);

        } catch (error) {
            const action = editingPackage ? 'actualizar' : 'añadir';
            console.error(`Error ${action} package:`, error); // Log detailed error
            toast({ title: "Error", description: `No se pudo ${action} el paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

    const handleDeletePackage = async (id: string) => {
        setIsDeleting(id);
        try {
            await deleteProduct(id); // Use deleteProduct for packages too
            toast({ title: "Éxito", description: "Paquete eliminado.", variant: "destructive" });
            fetchPackageData(); // Refresh list
             if (editingPackage?.id === id) { // Close dialog if deleted package was being edited
                 setIsFormOpen(false);
             }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo eliminar el paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        } finally {
            setIsDeleting(null);
        }
    };

     const handleAddPackageItemSubmit: SubmitHandler<AddPackageItemFormValues> = async (values) => {
         // Ensure we have a valid package ID (either from editing or after creation)
         if (!editingPackage || !editingPackage.id) {
             toast({ title: "Error", description: "Guarda la información básica del paquete antes de añadir productos.", variant: "destructive" });
             return;
         }

         // Refine the type for newItemData
          const newItemData: Omit<PackageItem, 'id' | 'product_name'> = {
             package_id: editingPackage.id, // Use the ID from the state
             product_id: values.product_id,
             quantity: values.quantity,
             display_order: currentPackageItems.length, // Simple order append
         };

         console.log("Attempting to add package item:", newItemData); // Log data being sent

         setIsPackageItemsLoading(true);
         try {
             const addedItem = await addPackageItem(newItemData);
             // Update local state optimistically or refetch
             const productName = allProducts.find(p => p.id === addedItem.product_id)?.name || 'Unknown';
             setCurrentPackageItems(prev => [...prev, { ...addedItem, product_name: productName }]);
             addItemForm.reset(); // Clear the add item form
             toast({ title: "Éxito", description: "Producto añadido al paquete." });
         } catch (error) {
             console.error("Error adding package item:", error); // Log detailed error
             toast({ title: "Error", description: `No se pudo añadir el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };

     const handleDeletePackageItem = async (packageItemId: string) => {
         if (!editingPackage) return;

         setIsPackageItemsLoading(true);
         try {
             await deletePackageItem(packageItemId);
             // Update local state
             setCurrentPackageItems(prev => prev.filter(item => item.id !== packageItemId));
             toast({ title: "Éxito", description: "Producto eliminado del paquete.", variant: 'destructive' });
         } catch (error) {
             toast({ title: "Error", description: `No se pudo eliminar el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };

     // TODO: Implement Modifier Override management for package items in Edit Dialog

     return (
        <div>
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold">Gestionar Paquetes</h3>
                 <Button size="sm" onClick={() => handleOpenForm()} disabled={packageCategories.length === 0}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Paquete
                 </Button>
             </div>
             {packageCategories.length === 0 && (
                <p className="text-destructive text-sm mb-4">Nota: Primero debes crear una categoría de tipo 'paquete' para poder añadir paquetes.</p>
             )}
              <p className="text-muted-foreground mb-4">Crea y edita paquetes. Añade productos y personaliza modificadores (próximamente en edición).</p>
              <Card>
                 <CardContent className="p-0">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                           <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">Cargando...</TableCell></TableRow>
                                 ) : packages.length === 0 ? (
                                     <TableRow><TableCell colSpan={4} className="text-center h-24">No hay paquetes.</TableCell></TableRow>
                                 ) : (
                                    packages.map(pkg => {
                                        const category = packageCategories.find(c => c.id === pkg.categoryId);
                                        return (
                                            <TableRow key={pkg.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    {pkg.imageUrl ? (
                                                        <Image src={pkg.imageUrl} alt={pkg.name} width={32} height={24} className="rounded object-cover" data-ai-hint="package combo deal image" />
                                                     ) : <div className='w-8 h-6 bg-muted rounded'></div>}
                                                    {pkg.name}
                                                </TableCell>
                                                 <TableCell>{category?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-right">${pkg.price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => handleOpenForm(pkg)} title="Editar Paquete">
                                                         <Edit className="h-4 w-4" />
                                                     </Button>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                             <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === pkg.id} title="Eliminar Paquete">
                                                                 {isDeleting === pkg.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                             </Button>
                                                        </AlertDialogTrigger>
                                                         <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                 Esta acción eliminará el paquete "{pkg.name}". Esta acción no se puede deshacer.
                                                            </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeletePackage(pkg.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                Eliminar
                                                            </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                     </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                             </TableBody>
                        </Table>
                    </ScrollArea>
                 </CardContent>
              </Card>

               {/* Add/Edit Dialog */}
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent className="sm:max-w-[700px]"> {/* Wider dialog for package items */}
                     <DialogHeader>
                         <DialogTitle>{editingPackage ? 'Editar Paquete' : 'Añadir Nuevo Paquete'}</DialogTitle>
                         <DialogDescription>
                            {editingPackage ? `Modifica los detalles de "${editingPackage.name}".` : 'Crea un nuevo combo o paquete.'}
                        </DialogDescription>
                     </DialogHeader>
                      {/* Package Base Info Form */}
                      <Form {...packageForm}>
                        <form onSubmit={packageForm.handleSubmit(handlePackageFormSubmit)} className="space-y-4 border-b pb-6 mb-6">
                            <FormField control={packageForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre del Paquete</FormLabel><FormControl><Input placeholder="e.g., Combo Pareja" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={packageForm.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Precio del Paquete</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={packageForm.control} name="categoryId" render={({ field }) => (
                                    <FormItem><FormLabel>Categoría (de Paquetes)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                 {packageCategories.length === 0 && <SelectItem value="NONE_PKG_CAT" disabled>Crea una categoría tipo paquete</SelectItem>}
                                                {packageCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={packageForm.control} name="imageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://picsum.photos/..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <div className="flex justify-end">
                                <Button type="submit" size="sm" disabled={packageForm.formState.isSubmitting || packageCategories.length === 0}>
                                    {packageForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                    {editingPackage ? 'Guardar Cambios Paquete' : 'Crear Paquete'}
                                </Button>
                             </div>
                        </form>
                     </Form>

                     {/* Package Items Management (Only visible AFTER package created/saved) */}
                     {editingPackage?.id && ( // Only show if editingPackage has an ID
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold">Contenido del Paquete "{editingPackage.name}"</h4>

                            {/* Add Item Form */}
                            <Form {...addItemForm}>
                                <form onSubmit={addItemForm.handleSubmit(handleAddPackageItemSubmit)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                                    <FormField
                                        control={addItemForm.control}
                                        name="product_id"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel className="text-xs">Producto a Añadir</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {allProducts.map(prod => (
                                                            <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={addItemForm.control}
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem className="w-20">
                                                <FormLabel className="text-xs">Cantidad</FormLabel>
                                                <FormControl><Input type="number" min="1" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" size="sm" disabled={isPackageItemsLoading}>
                                         {isPackageItemsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                                    </Button>
                                </form>
                            </Form>

                            {/* Items List */}
                             <ScrollArea className="h-[200px] border rounded-md">
                                 {isPackageItemsLoading && !currentPackageItems.length && <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>}
                                 {!isPackageItemsLoading && currentPackageItems.length === 0 && (
                                     <p className="p-4 text-center text-sm text-muted-foreground">Añade productos al paquete.</p>
                                 )}
                                 {currentPackageItems.length > 0 && ( // Display even while loading if items exist
                                    <Table className="text-sm">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Producto</TableHead>
                                                <TableHead className="w-[80px] text-right">Cantidad</TableHead>
                                                <TableHead className="w-[120px] text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentPackageItems.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.product_name || item.product_id}</TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">
                                                        {/* TODO: Edit button for quantity/overrides */}
                                                         {/* <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" title="Editar Item (Próximamente)">
                                                             <Edit className="h-3 w-3" />
                                                         </Button> */}
                                                         <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePackageItem(item.id)} title="Eliminar del Paquete" disabled={isPackageItemsLoading}>
                                                            <MinusCircle className="h-3 w-3" />
                                                         </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                 )}
                             </ScrollArea>

                              {/* TODO: Add Modifier Override Management Here */}
                              <Card className="mt-4 bg-muted/30">
                                    <CardHeader className="p-3"><CardTitle className="text-sm">Gestionar Modificadores del Paquete (Próximamente)</CardTitle></CardHeader>
                                    <CardContent className="p-3"><p className="text-xs text-muted-foreground">Aquí podrás ajustar los modificadores permitidos para cada producto dentro del paquete "{editingPackage.name}".</p></CardContent>
                                </Card>

                        </div>
                     )}


                    <DialogFooter className="mt-6 pt-4 border-t">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cerrar</Button>
                        </DialogClose>
                        {/* Optionally add a main save button if needed, but maybe handled per section */}
                    </DialogFooter>
                </DialogContent>
              </Dialog>

        </div>
     );
};

export default function ProductSettingsPage() {
  const [activeTab, setActiveTab] = useState("categories"); // Default to categories

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="pb-4 border-b"> {/* Remove flex row */}
          <CardTitle>Ajustes de Productos y Paquetes</CardTitle>
          <CardDescription>Administra categorías, productos, modificadores y paquetes.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-4 md:p-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <TabsList className="mb-4 shrink-0">
              <TabsTrigger value="categories">Categorías</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="packages">Paquetes</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="flex-grow overflow-auto mt-0">
              <ManageCategories />
            </TabsContent>
            <TabsContent value="products" className="flex-grow overflow-auto mt-0">
              <ManageProducts />
            </TabsContent>
            <TabsContent value="packages" className="flex-grow overflow-auto mt-0">
              <ManagePackages />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
