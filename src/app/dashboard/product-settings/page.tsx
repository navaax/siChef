// src/app/dashboard/product-settings/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Import services
import {
    getCategories, addCategory, updateCategory, deleteCategory,
    getProductsByCategory, addProduct, updateProduct, deleteProduct,
    getModifiersByCategory, // Specific function for modifiers
    getAllPackages, getPackageById, addPackage, updatePackage, deletePackage, // Package specific CRUD
    getProductById, // Keep for fetching products for packages
    getModifierSlotsForProduct, addModifierSlot, deleteModifierSlot,
    getItemsForPackage, addPackageItem, deletePackageItem,
    getOverridesForPackageItem, setPackageItemOverride, deletePackageItemOverride
} from '@/services/product-service';
import { getInventoryItems } from '@/services/inventory-service';

// Import types
import type { Category, Product, Package, InventoryItem, ProductModifierSlot, PackageItem, PackageItemModifierSlotOverride } from '@/types/product-types';

// --- Schemas ---
const categorySchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    type: z.enum(['producto', 'modificador', 'paquete'], { required_error: "Tipo es requerido" }),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

const productSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    categoryId: z.string().min(1, "Categoría es requerida"), // Refers to Category type 'producto' or 'modificador'
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    inventory_item_id: z.string().nullable().optional(),
    inventory_consumed_per_unit: z.coerce.number().min(0, "Consumo debe ser positivo").optional().nullable(),
}).refine(data => !data.inventory_item_id || (data.inventory_item_id && data.inventory_consumed_per_unit !== undefined && data.inventory_consumed_per_unit !== null), {
    message: "El consumo por unidad es requerido si se vincula un item de inventario.",
    path: ["inventory_consumed_per_unit"],
});
type ProductFormValues = z.infer<typeof productSchema>;


// For packages
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    // categoryId: z.string().optional(), // Optional category ID for UI grouping
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
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
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '', type: 'producto', imageUrl: '' },
    });

    const fetchCategoriesData = async () => {
        setIsLoading(true);
        try {
            const data = await getCategories();
            setCategories(data);
        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar las categorías.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategoriesData();
    }, [toast]);

    const handleOpenForm = (category: Category | null = null) => {
        setEditingCategory(category);
        if (category) {
            form.reset(category);
        } else {
            form.reset({ name: '', type: 'producto', imageUrl: '' });
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
            fetchCategoriesData();
        } catch (error) {
             const action = editingCategory ? 'actualizar' : 'añadir';
            toast({ title: "Error", description: `No se pudo ${action} la categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

     const handleDeleteCategory = async (id: string) => {
        setIsDeleting(id);
        try {
            await deleteCategory(id);
            toast({ title: "Éxito", description: "Categoría eliminada.", variant: "destructive" });
            fetchCategoriesData();
             if (editingCategory?.id === id) {
                 setIsFormOpen(false);
             }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo eliminar la categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        } finally {
            setIsDeleting(null);
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
            <p className="text-muted-foreground mb-4">Añade, edita o elimina categorías. Define si contienen productos, modificadores o paquetes (para UI).</p>

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
                                                             Esta acción eliminará la categoría "{cat.name}". Los productos asociados podrían quedar sin categoría o ser eliminados (dependiendo de la BD).
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
                                                <SelectItem value="modificador">Modificador (opciones para productos)</SelectItem>
                                                <SelectItem value="paquete">Paquete (solo para agrupar paquetes en UI)</SelectItem>
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
                                        <FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl>
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

    // Filter categories for product assignment ('producto' or 'modificador')
    const productAssignableCategories = useMemo(() => categories.filter(c => c.type === 'producto' || c.type === 'modificador'), [categories]);
    // Filter categories for modifier slots ('modificador' type only)
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
            inventory_item_id: null,
            inventory_consumed_per_unit: 1,
        },
    });

     const fetchProductData = async () => {
        setIsLoading(true);
        try {
            const [fetchedCategories, fetchedInventory] = await Promise.all([
                getCategories(), // Fetch all categories
                getInventoryItems(),
            ]);
            setCategories(fetchedCategories);
            setInventoryItems(fetchedInventory);

            let allProducts: Product[] = [];
            // Fetch products from 'producto' and 'modificador' categories
            const productCatIds = fetchedCategories.filter(c => c.type === 'producto').map(c => c.id);
            const modifierCatIds = fetchedCategories.filter(c => c.type === 'modificador').map(c => c.id);

            for (const catId of productCatIds) {
                const catProducts = await getProductsByCategory(catId); // Fetches only type 'producto'
                allProducts = [...allProducts, ...catProducts];
            }
             for (const catId of modifierCatIds) {
                const catModifiers = await getModifiersByCategory(catId); // Fetches only type 'modificador'
                allProducts = [...allProducts, ...catModifiers];
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
    }, [toast]);

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
            setCurrentModifierSlots([]);
        }
    }, [editingProduct, isFormOpen, toast]);

    const handleOpenForm = (product: Product | null = null) => {
        setEditingProduct(product);
        if (product) {
            form.reset({
                name: product.name,
                price: product.price,
                categoryId: product.categoryId,
                imageUrl: product.imageUrl || '',
                inventory_item_id: product.inventory_item_id || null,
                inventory_consumed_per_unit: product.inventory_consumed_per_unit ?? 1,
            });
        } else {
             form.reset({
                name: '',
                price: 0,
                categoryId: '',
                imageUrl: '',
                inventory_item_id: null,
                inventory_consumed_per_unit: 1,
            });
             setCurrentModifierSlots([]);
        }
        setIsFormOpen(true);
    };

     const handleFormSubmit: SubmitHandler<ProductFormValues> = async (values) => {
        const dataToSave = {
            ...values,
             imageUrl: values.imageUrl || null,
            inventory_item_id: values.inventory_item_id || null,
             inventory_consumed_per_unit: values.inventory_item_id ? (values.inventory_consumed_per_unit ?? 1) : null,
        };

        console.log("Saving product:", JSON.stringify(dataToSave, null, 2));

        try {
             if (editingProduct) {
                await updateProduct(editingProduct.id, dataToSave);
                toast({ title: "Éxito", description: "Producto actualizado." });
                 // Optionally keep form open to edit modifiers, or close it:
                 // setIsFormOpen(false);
                 fetchProductData(); // Refresh list
             } else {
                const newProduct = await addProduct(dataToSave as Omit<Product, 'id'>);
                toast({ title: "Éxito", description: "Producto añadido. Puedes añadir modificadores." });
                setEditingProduct(newProduct);
                fetchProductData();
             }

        } catch (error) {
             const action = editingProduct ? 'actualizar' : 'añadir';
            console.error(`Error ${action} product:`, error);
            toast({ title: "Error", description: `No se pudo ${action} el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

    const handleDeleteProduct = async (id: string) => {
        setIsDeleting(id);
        try {
            await deleteProduct(id);
            toast({ title: "Éxito", description: "Producto eliminado.", variant: "destructive" });
            fetchProductData();
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
                <h3 className="text-xl font-semibold">Gestionar Productos y Modificadores</h3>
                 <Button size="sm" onClick={() => handleOpenForm()}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto/Modificador
                 </Button>
             </div>
             <p className="text-muted-foreground mb-4">Define productos vendibles y opciones modificadoras. Vincula inventario y configura grupos de modificadores.</p>
             <Card>
                 <CardContent className="p-0">
                     <ScrollArea className="h-[60vh]">
                         <Table>
                             <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría (Tipo)</TableHead>
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
                                                <TableCell>{category?.name || 'N/A'} ({category?.type || 'N/A'})</TableCell>
                                                <TableCell className="text-right">{formatCurrency(prod.price)}</TableCell>
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
                                                                Esta acción eliminará "{prod.name}". Esta acción no se puede deshacer.
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

            {/* Add/Edit Product Dialog */}
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Editar Producto/Modificador' : 'Añadir Nuevo Producto/Modificador'}</DialogTitle>
                        <DialogDescription>
                             Define un producto vendible o una opción modificadora.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
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
                                        <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                 <SelectItem value="__NONE__" disabled>Selecciona una categoría</SelectItem>
                                                {productAssignableCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.type})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
                                                value={field.value ?? "__NONE__"}
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
                                {form.watch('inventory_item_id') && (
                                    <FormField control={form.control} name="inventory_consumed_per_unit" render={({ field }) => (
                                        <FormItem><FormLabel>Consumo por Unidad</FormLabel>
                                         <FormControl>
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
                                        {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                                  </Button>
                              </div>
                        </form>
                    </Form>

                    {/* Modifier Slot Management */}
                    {editingProduct && (
                        <div className="space-y-4 pt-6 border-t mt-6">
                            <h4 className="text-lg font-semibold">Grupos de Modificadores para "{editingProduct.name}"</h4>
                             <AddModifierSlotForm
                                modifierCategories={modifierCategories}
                                onAddSlot={handleAddModifierSlot}
                                isLoading={isModifierSlotsLoading}
                             />
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
    message: "Max debe ser >= Min",
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
        form.reset();
     }

     return (
         <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                <FormField control={form.control} name="label" render={({ field }) => (
                    <FormItem className="flex-grow"><FormLabel className="text-xs">Etiqueta UI</FormLabel><FormControl><Input placeholder="e.g., Salsas" {...field} /></FormControl><FormMessage className="text-xs"/> </FormItem>
                )}/>
                <FormField control={form.control} name="linked_category_id" render={({ field }) => (
                     <FormItem className="flex-grow"> <FormLabel className="text-xs">Cat. Modificador</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                             <FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl>
                             <SelectContent>
                                 <SelectItem value="__NONE__" disabled>Selecciona categoría</SelectItem>
                                 {modifierCategories.length === 0 && <SelectItem value="__NONE_AVAILABLE__" disabled>Crea una cat. 'modificador'</SelectItem>}
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

// Helper function to format currency
const formatCurrency = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


const ManagePackages = () => {
     const [packages, setPackages] = useState<Package[]>([]); // Use Package type
     const [allProducts, setAllProducts] = useState<Product[]>([]); // For adding items to packages
     const [isLoading, setIsLoading] = useState(true);
     const [isFormOpen, setIsFormOpen] = useState(false);
     const [editingPackage, setEditingPackage] = useState<Package | null>(null);
     const [isDeleting, setIsDeleting] = useState<string | null>(null);
     const { toast } = useToast();

     const [currentPackageItems, setCurrentPackageItems] = useState<PackageItem[]>([]);
     const [isPackageItemsLoading, setIsPackageItemsLoading] = useState(false);

     const packageForm = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, imageUrl: '' },
    });

    const addItemForm = useForm<AddPackageItemFormValues>({
        resolver: zodResolver(addPackageItemSchema),
        defaultValues: { product_id: '', quantity: 1 },
    });

      const fetchPackageData = async () => {
        setIsLoading(true);
        try {
            const [fetchedPackages, fetchedCategories] = await Promise.all([
                getAllPackages(), // Fetch all packages from the new table
                getCategories(), // Fetch all categories
            ]);
            setPackages(fetchedPackages);

            // Fetch all regular products/modifiers to add to packages
             let prodsForPackages: Product[] = [];
             const prodCats = fetchedCategories.filter(c => c.type === 'producto').map(c => c.id);
             const modCats = fetchedCategories.filter(c => c.type === 'modificador').map(c => c.id);

             for (const catId of prodCats) {
                 const prods = await getProductsByCategory(catId);
                 prodsForPackages = [...prodsForPackages, ...prods];
             }
             for (const catId of modCats) {
                 const mods = await getModifiersByCategory(catId);
                 prodsForPackages = [...prodsForPackages, ...mods];
             }
             setAllProducts(prodsForPackages);

        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar paquetes o productos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

     useEffect(() => {
        fetchPackageData();
    }, [toast]);

     // Fetch items for the package when editing
     useEffect(() => {
        if (editingPackage?.id && isFormOpen) {
            const fetchItems = async () => {
                setIsPackageItemsLoading(true);
                try {
                    const items = await getItemsForPackage(editingPackage.id);
                    setCurrentPackageItems(items);
                } catch (error) {
                    console.error("Error fetching package items:", error);
                    toast({ title: "Error", description: `No se pudieron cargar los items para ${editingPackage.name}. ${error instanceof Error ? error.message : ''}`, variant: "destructive" });
                    setCurrentPackageItems([]);
                } finally {
                    setIsPackageItemsLoading(false);
                }
            };
            fetchItems();
        } else {
            setCurrentPackageItems([]);
        }
     }, [editingPackage, isFormOpen, toast]);


    const handleOpenForm = (pkg: Package | null = null) => {
        setEditingPackage(pkg);
        if (pkg) {
            packageForm.reset({
                name: pkg.name,
                price: pkg.price,
                imageUrl: pkg.imageUrl || '',
            });
        } else {
            packageForm.reset({ name: '', price: 0, imageUrl: '' });
            setCurrentPackageItems([]);
        }
        addItemForm.reset();
        setIsFormOpen(true);
    };

    const handlePackageFormSubmit: SubmitHandler<PackageFormValues> = async (values) => {
        const dataToSave: Partial<Package> = {
             ...values,
             imageUrl: values.imageUrl || null,
        };

        console.log("[handlePackageFormSubmit] Submitting package info:", JSON.stringify(dataToSave, null, 2));

        try {
            if (editingPackage?.id) {
                console.log(`[handlePackageFormSubmit] Updating package with ID: ${editingPackage.id}`);
                await updatePackage(editingPackage.id, dataToSave); // Use updatePackage service
                 toast({ title: "Éxito", description: "Paquete actualizado." });
                 setEditingPackage(prev => prev ? { ...prev, ...dataToSave } : null);
                 // fetchPackageData(); // Refresh list in background
                 console.log("[handlePackageFormSubmit] Package updated.");
            } else {
                 console.log("[handlePackageFormSubmit] Creating new package...");
                 const newPackage = await addPackage(dataToSave as Omit<Package, 'id'>); // Use addPackage service
                 console.log("[handlePackageFormSubmit] New package created:", JSON.stringify(newPackage, null, 2));
                 toast({ title: "Éxito", description: "Paquete creado. Ahora puedes añadirle productos." });
                 setEditingPackage(newPackage); // Update state with the new package ID
                 fetchPackageData(); // Refresh the main list to include the new package
                 console.log("[handlePackageFormSubmit] New package created. Updated editingPackage state:", newPackage);
            }

        } catch (error) {
            const action = editingPackage?.id ? 'actualizar' : 'añadir';
            console.error(`[handlePackageFormSubmit] Error ${action} package:`, error);
            toast({ title: "Error", description: `No se pudo ${action} el paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };


    const handleDeletePackage = async (id: string) => {
        setIsDeleting(id);
        try {
            await deletePackage(id); // Use deletePackage service
            toast({ title: "Éxito", description: "Paquete eliminado.", variant: "destructive" });
            fetchPackageData();
             if (editingPackage?.id === id) {
                 setIsFormOpen(false);
             }
        } catch (error) {
            toast({ title: "Error", description: `No se pudo eliminar el paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        } finally {
            setIsDeleting(null);
        }
    };

     const handleAddPackageItemSubmit: SubmitHandler<AddPackageItemFormValues> = async (values) => {
         if (!editingPackage || !editingPackage.id) {
             console.error("[handleAddPackageItemSubmit] Cannot add item: No valid package ID. Ensure package is saved first.", editingPackage);
             toast({ title: "Error", description: "Guarda la información básica del paquete antes de añadir productos.", variant: "destructive" });
             return;
         }

          const newItemData: Omit<PackageItem, 'id' | 'product_name'> = {
             package_id: editingPackage.id,
             product_id: values.product_id,
             quantity: values.quantity,
             display_order: currentPackageItems.length,
         };

         const productToAdd = allProducts.find(p => p.id === values.product_id);
         if (!productToAdd) {
             console.error(`[handleAddPackageItemSubmit] Product with ID ${values.product_id} not found.`);
             toast({ title: "Error Interno", description: `Producto con ID ${values.product_id} no encontrado.`, variant: "destructive" });
             return;
         }

         console.log(`[handleAddPackageItemSubmit] Attempting to add item to package ${editingPackage.id}: Product ${productToAdd.name} (ID: ${values.product_id}), Qty: ${values.quantity}`);

         setIsPackageItemsLoading(true);
         try {
             const addedItem = await addPackageItem(newItemData);
             console.log("[handleAddPackageItemSubmit] Successfully added item:", addedItem);
             setCurrentPackageItems(prev => [...prev, { ...addedItem, product_name: productToAdd.name }]);
             addItemForm.reset();
             toast({ title: "Éxito", description: `"${productToAdd.name}" añadido al paquete.` });
         } catch (error) {
             console.error("[handleAddPackageItemSubmit] Error adding package item:", error);
             toast({ title: "Error", description: `No se pudo añadir el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };

     const handleDeletePackageItem = async (packageItemId: string) => {
         if (!editingPackage) return;
         const itemToDelete = currentPackageItems.find(item => item.id === packageItemId);
         const itemName = itemToDelete?.product_name || `Item ID ${packageItemId}`;

         setIsPackageItemsLoading(true);
         try {
             await deletePackageItem(packageItemId);
             setCurrentPackageItems(prev => prev.filter(item => item.id !== packageItemId));
             toast({ title: "Éxito", description: `"${itemName}" eliminado del paquete.`, variant: 'destructive' });
         } catch (error) {
             toast({ title: "Error", description: `No se pudo eliminar el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };


     return (
        <div>
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold">Gestionar Paquetes</h3>
                 <Button size="sm" onClick={() => handleOpenForm()}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Paquete
                 </Button>
             </div>
              <p className="text-muted-foreground mb-4">Crea y edita paquetes/combos. Añade productos y configura modificadores (próximamente).</p>
              <Card>
                 <CardContent className="p-0">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                           <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    {/* <TableHead>Categoría (UI)</TableHead> */}
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24">Cargando...</TableCell></TableRow>
                                 ) : packages.length === 0 ? (
                                     <TableRow><TableCell colSpan={3} className="text-center h-24">No hay paquetes.</TableCell></TableRow>
                                 ) : (
                                    packages.map(pkg => {
                                        // const category = categories.find(c => c.id === pkg.categoryId); // If categoryId is added to Package type
                                        return (
                                            <TableRow key={pkg.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    {pkg.imageUrl ? (
                                                        <Image src={pkg.imageUrl} alt={pkg.name} width={32} height={24} className="rounded object-cover" data-ai-hint="package combo deal image" />
                                                     ) : <div className='w-8 h-6 bg-muted rounded'></div>}
                                                    {pkg.name}
                                                </TableCell>
                                                 {/* <TableCell>{category?.name || 'N/A'}</TableCell> */}
                                                <TableCell className="text-right">{formatCurrency(pkg.price)}</TableCell>
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
                                                                 Esta acción eliminará el paquete "{pkg.name}" y su contenido definido. No se puede deshacer.
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

               {/* Add/Edit Package Dialog */}
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogContent className="sm:max-w-[700px]">
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
                                {/* Optional CategoryId for UI grouping
                                <FormField control={packageForm.control} name="categoryId" render={({ field }) => (
                                    <FormItem><FormLabel>Categoría (UI)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría UI" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                 <SelectItem value="__NONE__" disabled>Selecciona categoría</SelectItem>
                                                 {packageUiCategories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )}/> */}
                            </div>
                            <FormField control={packageForm.control} name="imageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <div className="flex justify-end">
                                <Button type="submit" size="sm" disabled={packageForm.formState.isSubmitting}>
                                    {packageForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                    {editingPackage ? 'Guardar Cambios Paquete' : 'Crear Paquete'}
                                </Button>
                             </div>
                        </form>
                     </Form>

                     {/* Package Items Management */}
                     {editingPackage?.id && (
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold">Contenido del Paquete "{editingPackage.name}"</h4>
                            <Form {...addItemForm}>
                                <form onSubmit={addItemForm.handleSubmit(handleAddPackageItemSubmit)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                                    <FormField
                                        control={addItemForm.control}
                                        name="product_id"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel className="text-xs">Producto a Añadir</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                         <SelectItem value="__NONE__" disabled>Selecciona producto</SelectItem>
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
                                    <Button type="submit" size="sm" disabled={isPackageItemsLoading || !editingPackage?.id}>
                                         {isPackageItemsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                                    </Button>
                                </form>
                            </Form>

                             <ScrollArea className="h-[200px] border rounded-md">
                                 {isPackageItemsLoading && !currentPackageItems.length && <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></div>}
                                 {!isPackageItemsLoading && currentPackageItems.length === 0 && (
                                     <p className="p-4 text-center text-sm text-muted-foreground">Añade productos al paquete.</p>
                                 )}
                                 {currentPackageItems.length > 0 && (
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
                                                         {/* TODO: Edit button */}
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

                              {/* TODO: Add Modifier Override Management */}
                              <Card className="mt-4 bg-muted/30">
                                    <CardHeader className="p-3"><CardTitle className="text-sm">Gestionar Modificadores del Paquete (Próximamente)</CardTitle></CardHeader>
                                    <CardContent className="p-3"><p className="text-xs text-muted-foreground">Aquí podrás ajustar los modificadores permitidos para cada producto dentro del paquete.</p></CardContent>
                                </Card>

                        </div>
                     )}
                     {!editingPackage?.id && (
                        <p className="text-center text-sm text-muted-foreground mt-4">Guarda la información básica del paquete para poder añadirle contenido.</p>
                     )}


                    <DialogFooter className="mt-6 pt-4 border-t">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

        </div>
     );
};

export default function ProductSettingsPage() {
  const [activeTab, setActiveTab] = useState("categories");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="pb-4 border-b">
          <CardTitle>Ajustes de Productos y Paquetes</CardTitle>
          <CardDescription>Administra categorías, productos, modificadores y paquetes.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow p-4 md:p-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <TabsList className="mb-4 shrink-0">
              <TabsTrigger value="categories">Categorías</TabsTrigger>
              <TabsTrigger value="products">Productos / Modificadores</TabsTrigger>
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
