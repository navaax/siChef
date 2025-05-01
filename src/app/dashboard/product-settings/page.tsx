// src/app/dashboard/product-settings/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

// Import services
import {
    getCategories, addCategory, updateCategory, deleteCategory,
    getProductsByCategory, addProduct, // updateProduct, deleteProduct,
    getPackagesByCategory, // Using getProductsByCategory with type 'paquete' or getPackagesByCategory
    getProductById, // Needed for fetching packages/products
    getModifierSlotsForProduct, addModifierSlot, // updateModifierSlot, deleteModifierSlot,
    getItemsForPackage, addPackageItem, // updatePackageItem, deletePackageItem,
    getOverridesForPackageItem, setPackageItemOverride, // deletePackageItemOverride
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
    inventory_item_id: z.string().optional(),
    inventory_consumed_per_unit: z.coerce.number().min(0, "Consumo debe ser positivo").optional(),
});
type ProductFormValues = z.infer<typeof productSchema>;

// For packages (which are also products)
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    categoryId: z.string().min(1, "Categoría (tipo paquete) es requerida"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
});
type PackageFormValues = z.infer<typeof packageSchema>;

// --- Components ---

const ManageCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
    }, []); // Run once on mount

    const handleAddCategory = async (values: CategoryFormValues) => {
        try {
            await addCategory(values);
            toast({ title: "Éxito", description: "Categoría añadida." });
            setIsAddDialogOpen(false);
            form.reset();
            fetchCategoriesData(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: `No se pudo añadir la categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

    // TODO: Implement Edit/Delete functionality similarly

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestionar Categorías</h3>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Categoría</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Añadir Nueva Categoría</DialogTitle>
                            <DialogDescription>Define una nueva categoría para tus productos o modificadores.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddCategory)} className="space-y-4">
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Guardar Categoría
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
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
                                                    <Image src={cat.imageUrl} alt={cat.name} width={40} height={30} className="rounded object-cover" />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" disabled> <Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                     </ScrollArea>
                </CardContent>
             </Card>
        </div>
    );
};

const ManageProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const { toast } = useToast();

    // Filter categories for product assignment (exclude 'paquete')
    const productCategories = useMemo(() => categories.filter(c => c.type === 'producto' || c.type === 'modificador'), [categories]);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: { name: '', price: 0, categoryId: '', imageUrl: '', inventory_item_id: '', inventory_consumed_per_unit: 1 },
    });

     const fetchProductData = async () => {
        setIsLoading(true);
        try {
            // Fetch all categories first for the dropdown
            const fetchedCategories = await getCategories();
            setCategories(fetchedCategories);

            // Fetch all products across all non-package categories
            let allProducts: Product[] = [];
            const productCatIds = fetchedCategories.filter(c => c.type === 'producto' || c.type === 'modificador').map(c => c.id);
            for (const catId of productCatIds) {
                const catProducts = await getProductsByCategory(catId);
                allProducts = [...allProducts, ...catProducts];
            }
            setProducts(allProducts);

            // Fetch inventory items
            const fetchedInventory = await getInventoryItems();
            setInventoryItems(fetchedInventory);

        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar productos, categorías o inventario.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProductData();
    }, []);

    const handleAddProduct = async (values: ProductFormValues) => {
        const dataToSave = {
            ...values,
            inventory_item_id: values.inventory_item_id || undefined, // Send undefined if empty string
             inventory_consumed_per_unit: values.inventory_item_id ? (values.inventory_consumed_per_unit ?? 1) : undefined, // Only send consumption if inventory item is linked
        };

        try {
            await addProduct(dataToSave);
            toast({ title: "Éxito", description: "Producto añadido." });
            setIsAddDialogOpen(false);
            form.reset();
            fetchProductData(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: `No se pudo añadir el producto: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

    // TODO: Implement Edit/Delete functionality
    // TODO: Implement Modifier Slot management within Edit Dialog

    return (
        <div>
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestionar Productos</h3>
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                         <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto</Button>
                    </DialogTrigger>
                     <DialogContent className="sm:max-w-[600px]"> {/* Wider dialog */}
                        <DialogHeader>
                            <DialogTitle>Añadir Nuevo Producto</DialogTitle>
                            <DialogDescription>Define un producto vendible o una opción modificadora.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddProduct)} className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="e.g., Alitas 6pz, Salsa BBQ" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="price" render={({ field }) => (
                                        <FormItem><FormLabel>Precio</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="categoryId" render={({ field }) => (
                                        <FormItem><FormLabel>Categoría</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                    <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://picsum.photos/..." {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                 <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="inventory_item_id" render={({ field }) => (
                                        <FormItem><FormLabel>Item de Inventario (Opcional)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                 <FormControl><SelectTrigger><SelectValue placeholder="Vincular inventario..." /></SelectTrigger></FormControl>
                                                 <SelectContent>
                                                    <SelectItem value="">-- Ninguno --</SelectItem>
                                                    {inventoryItems.map(item => (
                                                        <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                                                    ))}
                                                 </SelectContent>
                                            </Select><FormMessage /></FormItem>
                                    )}/>
                                    {/* Only show consumption field if inventory item is selected */}
                                    {form.watch('inventory_item_id') && (
                                        <FormField control={form.control} name="inventory_consumed_per_unit" render={({ field }) => (
                                            <FormItem><FormLabel>Consumo por Unidad</FormLabel><FormControl><Input type="number" step="0.01" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>
                                        )}/>
                                    )}
                                 </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Guardar Producto
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                 </Dialog>
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
                                                        <Image src={prod.imageUrl} alt={prod.name} width={32} height={24} className="rounded object-cover" />
                                                     ) : <div className='w-8 h-6 bg-muted rounded'></div>}
                                                    {prod.name}
                                                </TableCell>
                                                <TableCell>{category?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-right">${prod.price.toFixed(2)}</TableCell>
                                                <TableCell>{invItem?.name || <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                                <TableCell className="text-right">{invItem ? `${prod.inventory_consumed_per_unit ?? 1} ${invItem.unit}`: '-'}</TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" disabled> <Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled><Trash2 className="h-4 w-4" /></Button>
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
        </div>
    );
};

const ManagePackages = () => {
     const [packages, setPackages] = useState<Product[]>([]); // Packages are Products
     const [packageCategories, setPackageCategories] = useState<Category[]>([]);
     const [allProducts, setAllProducts] = useState<Product[]>([]); // For adding items to packages
     const [isLoading, setIsLoading] = useState(true);
     const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
     const { toast } = useToast();

     const form = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, categoryId: '', imageUrl: '' },
    });

      const fetchPackageData = async () => {
        setIsLoading(true);
        try {
            const fetchedCategories = await getCategories();
            const pkgCats = fetchedCategories.filter(c => c.type === 'paquete');
            setPackageCategories(pkgCats);

            // Fetch all packages
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
             setAllProducts(allProds);


        } catch (error) {
            toast({ title: "Error", description: "No se pudieron cargar paquetes o productos.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

     useEffect(() => {
        fetchPackageData();
    }, []);

    const handleAddPackage = async (values: PackageFormValues) => {
        // The form ensures categoryId belongs to a 'paquete' type category implicitly
        const dataToSave: Omit<Product, 'id' | 'inventory_item_id' | 'inventory_consumed_per_unit'> = values;

        try {
            await addProduct(dataToSave); // Use addProduct service function
            toast({ title: "Éxito", description: "Paquete añadido." });
            setIsAddDialogOpen(false);
            form.reset();
            fetchPackageData(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: `No se pudo añadir el paquete: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
        }
    };

     // TODO: Implement Edit/Delete functionality for packages
     // TODO: Implement Package Item management (add/remove products within package) in Edit Dialog
     // TODO: Implement Modifier Override management for package items in Edit Dialog

     return (
        <div>
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold">Gestionar Paquetes</h3>
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                     <DialogTrigger asChild>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Paquete</Button>
                     </DialogTrigger>
                     <DialogContent>
                         <DialogHeader>
                             <DialogTitle>Añadir Nuevo Paquete</DialogTitle>
                             <DialogDescription>Crea un nuevo combo o paquete.</DialogDescription>
                         </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddPackage)} className="space-y-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre del Paquete</FormLabel><FormControl><Input placeholder="e.g., Combo Pareja" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="price" render={({ field }) => (
                                        <FormItem><FormLabel>Precio del Paquete</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                    <FormField control={form.control} name="categoryId" render={({ field }) => (
                                        <FormItem><FormLabel>Categoría (de Paquetes)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                     {packageCategories.length === 0 && <SelectItem value="" disabled>Crea una categoría tipo 'paquete' primero</SelectItem>}
                                                    {packageCategories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                    <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://picsum.photos/..." {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={form.formState.isSubmitting || packageCategories.length === 0}>
                                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Guardar Paquete
                                    </Button>
                                </DialogFooter>
                            </form>
                         </Form>
                    </DialogContent>
                 </Dialog>
             </div>
              <p className="text-muted-foreground mb-4">Crea y edita paquetes. Añade productos y personaliza modificadores.</p>
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
                                                        <Image src={pkg.imageUrl} alt={pkg.name} width={32} height={24} className="rounded object-cover" />
                                                     ) : <div className='w-8 h-6 bg-muted rounded'></div>}
                                                    {pkg.name}
                                                </TableCell>
                                                 <TableCell>{category?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-right">${pkg.price.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" disabled> <Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled><Trash2 className="h-4 w-4" /></Button>
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
