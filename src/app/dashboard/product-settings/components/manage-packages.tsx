'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle, Settings, ChevronsUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Para override config
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Importar servicios específicos para paquetes
import {
    addPackage as addPackageService,
    updatePackage as updatePackageService,
    deletePackage as deletePackageService,
    getItemsForPackage,
    addPackageItem,
    deletePackageItem,
    updatePackageItemsAndOverrides, // NEW: Service function to handle bulk save
    getOverridesForPackageItem,
    setPackageItemOverride,
    deletePackageItemOverride,
    getModifierSlotsForProduct, // Para mostrar opciones de override
    getProductsByCategory, // Para popular select de productos
} from '@/services/product-service';

// Importar tipos
import type { Product, Package, PackageItem, PackageItemModifierSlotOverride, ProductModifierSlot, Category } from '@/types/product-types';

// --- Esquemas Zod ---
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    category_id: z.string().nullable().optional(), // Permite nulo o string
});
type PackageFormValues = z.infer<typeof packageSchema>;

// Schema for adding an item (used locally before final save)
const addPackageItemSchema = z.object({
    selectedCategoryId: z.string().min(1, "Selecciona una categoría"),
    product_id: z.string().min(1, "Selecciona un producto"),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
});
type AddPackageItemFormValues = z.infer<typeof addPackageItemSchema>;

// --- Tipos Locales ---
interface PendingPackageItem extends Omit<PackageItem, 'id' | 'package_id' | 'display_order' > {
  localId: string; // ID temporal para manejo en UI
  product_name: string;
  modifierSlots?: ProductModifierSlot[]; // Slots del producto base
  modifierOverrides?: PackageItemModifierSlotOverride[]; // Overrides definidos localmente
}

// --- Props del Componente ---
interface ManagePackagesProps {
    allProducts: Product[]; // Todos los productos disponibles para añadir (ya no se usa directo)
    allCategories: Category[]; // Todas las categorías para el selector de UI y productos
    initialPackages: Package[];
    onDataChange: () => Promise<void>; // Callback para refrescar datos
}


// --- Componente Principal ---
const ManagePackages: React.FC<ManagePackagesProps> = ({
    allCategories,
    initialPackages,
    onDataChange,
}) => {
    const [packages, setPackages] = useState<Package[]>(initialPackages);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null); // Info básica del paquete
    const [isFormOpen, setIsFormOpen] = useState(false); // Estado del diálogo principal
    const [isSubmitting, setIsSubmitting] = useState(false); // Estado de carga del save final
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // Estado de carga de eliminación de paquete
    const [pendingItems, setPendingItems] = useState<PendingPackageItem[]>([]); // Items en el editor actual
    const [isItemDataLoading, setIsItemDataLoading] = useState(false); // Carga para items/productos
    const [editingOverridesForItemLocalId, setEditingOverridesForItemLocalId] = useState<string | null>(null); // Local ID del item para override
    const [productsInCategory, setProductsInCategory] = useState<Product[]>([]); // Productos de la categoría seleccionada
    const { toast } = useToast();

     // Router and Pathname
     const router = useRouter();
     const pathname = usePathname();
     const replace = router.replace; // Definir replace
     const searchParams = useSearchParams(); // Para leer query params


    // Actualizar estado local si los datos iniciales cambian
    useEffect(() => {
        setPackages(initialPackages);
    }, [initialPackages]);

     // Efecto para abrir el diálogo si hay un query param 'editPackage'
     useEffect(() => {
        const editPackageId = searchParams.get('editPackage');
        if (editPackageId && !isFormOpen) { // Solo abrir si no está abierto ya
             const pkgToEdit = initialPackages.find(pkg => pkg.id === editPackageId);
             if (pkgToEdit) {
                 handleEditClick(pkgToEdit);
             } else {
                 const newParams = new URLSearchParams(searchParams);
                 newParams.delete('editPackage');
                 replace(`${pathname}?${newParams.toString()}`);
             }
         }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [searchParams, initialPackages, isFormOpen]); // Añadir isFormOpen a deps


    // Filtrar categorías tipo 'paquete' para el selector de UI
    const packageUICategories = useMemo(() => allCategories.filter(c => c.type === 'paquete'), [allCategories]);
    // Filtrar categorías tipo 'producto' para el selector de Productos
    const productCategories = useMemo(() => allCategories.filter(c => c.type === 'producto'), [allCategories]);


    const packageForm = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, imageUrl: '', category_id: null },
    });

    const addItemForm = useForm<AddPackageItemFormValues>({
        resolver: zodResolver(addPackageItemSchema),
        defaultValues: { selectedCategoryId: '', product_id: '', quantity: 1 },
    });

    // Observar cambios en la categoría seleccionada para cargar productos
    const selectedCategoryId = addItemForm.watch('selectedCategoryId');
    useEffect(() => {
        const fetchProducts = async () => {
            if (selectedCategoryId) {
                setIsItemDataLoading(true);
                try {
                    const prods = await getProductsByCategory(selectedCategoryId);
                    setProductsInCategory(prods);
                    addItemForm.resetField('product_id', { defaultValue: '' }); // Resetear producto al cambiar categoría
                } catch (error) {
                    console.error("Error fetching products for category:", error);
                    toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los productos." });
                    setProductsInCategory([]);
                } finally {
                    setIsItemDataLoading(false);
                }
            } else {
                setProductsInCategory([]);
            }
        };
        fetchProducts();
    }, [selectedCategoryId, addItemForm, toast]); // Dependencias correctas

    // Cargar items y overrides del paquete al editar
    const loadPackageContents = useCallback(async (packageId: string) => {
        setIsItemDataLoading(true);
        setPendingItems([]);
        try {
            console.log(`[ManagePackages] Cargando contenido para paquete ID: ${packageId}`);
            const dbItems = await getItemsForPackage(packageId);
            const pendingItemsPromises = dbItems.map(async (item) => {
                // Cargar slots base y overrides para cada item
                const [slots, overrides] = await Promise.all([
                    getModifierSlotsForProduct(item.product_id),
                    getOverridesForPackageItem(item.id) // Usar ID del package_item
                ]);
                 // Aquí, item ya tiene product_name del servicio getItemsForPackage
                return {
                    ...item,
                    localId: item.id, // Usar ID real como localId al cargar
                    modifierSlots: slots,
                    modifierOverrides: overrides,
                };
            });
            const loadedPendingItems = await Promise.all(pendingItemsPromises);
            console.log(`[ManagePackages] Contenido cargado:`, loadedPendingItems);
            setPendingItems(loadedPendingItems);
        } catch (error) {
            console.error(`[ManagePackages] Error cargando contenido para paquete ${packageId}:`, error);
            toast({ variant: "destructive", title: "Error Contenido", description: `No se pudo cargar el contenido del paquete. ${error instanceof Error ? error.message : ''}` });
            setPendingItems([]);
        } finally {
            setIsItemDataLoading(false);
        }
    }, [toast]);

    // --- Handlers para abrir/cerrar diálogo ---
     const handleAddClick = () => {
         setEditingPackage(null);
         packageForm.reset({ name: '', price: 0, imageUrl: '', category_id: null });
         setPendingItems([]); // Limpiar items pendientes
         setIsFormOpen(true);
     };

     const handleEditClick = (pkg: Package) => {
         setEditingPackage(pkg);
         packageForm.reset({
             name: pkg.name,
             price: pkg.price,
             imageUrl: pkg.imageUrl || '',
             category_id: pkg.category_id || null
         });
         loadPackageContents(pkg.id); // Cargar contenido al editar
         setIsFormOpen(true);
          // Actualizar URL sin recargar para mantener estado
          const currentParams = new URLSearchParams(window.location.search);
          currentParams.set('editPackage', pkg.id);
          replace(`${pathname}?${currentParams.toString()}`);
     };

     const handleCloseDialog = () => {
         setIsFormOpen(false);
         setEditingPackage(null);
         setPendingItems([]);
         // Limpiar el query param al cerrar
         const currentParams = new URLSearchParams(window.location.search);
         currentParams.delete('editPackage');
         replace(`${pathname}?${currentParams.toString()}`);
     };

    // --- Guardado Final del Paquete y su Contenido ---
     const handleFinalSave = async () => {
        setIsSubmitting(true);

        // 1. Validar y obtener datos del form de paquete
        const packageFormValues = await packageForm.trigger() ? packageForm.getValues() : null;
        if (!packageFormValues) {
             toast({ variant: "destructive", title: "Error de Validación", description: "Revisa los datos básicos del paquete." });
             setIsSubmitting(false);
             return;
        }

        const packageData: Omit<Package, 'id'> = {
            name: packageFormValues.name,
            price: packageFormValues.price,
            imageUrl: packageFormValues.imageUrl || null,
            category_id: packageFormValues.category_id || null,
        };

        try {
            let packageId = editingPackage?.id;
            let action: 'creado' | 'actualizado' = 'actualizado';

            // 2. Guardar/Actualizar información básica del paquete
            if (packageId) {
                await updatePackageService(packageId, packageData);
            } else {
                action = 'creado';
                const newPackage = await addPackageService(packageData);
                packageId = newPackage.id;
                setEditingPackage(newPackage); // Actualizar estado local con el nuevo paquete
            }

            if (!packageId) {
                throw new Error("No se pudo obtener el ID del paquete después de guardar.");
            }

            // 3. Preparar y guardar items y overrides
             const itemsToSave = pendingItems.map((item, index) => ({
                // Si el localId es un UUID, es un item existente, pasar su ID real. Si no, es nuevo (id será null).
                id: item.localId.includes('-') ? item.localId : null, // Asumimos que UUIDs tienen guiones
                package_id: packageId!,
                product_id: item.product_id,
                quantity: item.quantity,
                display_order: index, // Reordenar basado en el estado actual
                modifierOverrides: item.modifierOverrides?.map(ov => ({
                    // Si el override tiene ID real, pasarlo. Si no, es nuevo (id será null).
                     id: ov.id.includes('-') ? ov.id : null,
                     package_item_id: '', // Será reemplazado en el backend si es necesario
                     product_modifier_slot_id: ov.product_modifier_slot_id,
                     min_quantity: ov.min_quantity,
                     max_quantity: ov.max_quantity,
                })) || [],
            }));

            await updatePackageItemsAndOverrides(packageId, itemsToSave);


            toast({ title: "Éxito", description: `Paquete ${action} con su contenido.` });
            await onDataChange(); // Refrescar lista principal en el padre
            handleCloseDialog(); // Cerrar diálogo después de guardar exitosamente

        } catch (error) {
            const actionAttempted = editingPackage ? 'actualizar' : 'crear';
            console.error(`[ManagePackages] Error al ${actionAttempted} paquete y contenido:`, error);
            toast({ variant: "destructive", title: `Error al ${actionAttempted}`, description: `No se pudo guardar el paquete. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
     };

     // Añadir un producto a la lista PENDIENTE (localmente)
     const handleAddPendingItem: SubmitHandler<AddPackageItemFormValues> = async (values) => {
         setIsItemDataLoading(true);
         try {
             const productToAdd = productsInCategory.find(p => p.id === values.product_id);
             if (!productToAdd) throw new Error("Producto no encontrado en la categoría seleccionada.");

             // Cargar slots del producto base
             const slots = await getModifierSlotsForProduct(productToAdd.id);

             const newPendingItem: PendingPackageItem = {
                 localId: randomUUID(), // ID temporal local
                 product_id: productToAdd.id,
                 product_name: productToAdd.name,
                 quantity: values.quantity,
                 modifierSlots: slots,
                 modifierOverrides: [], // Inicia sin overrides
             };

             setPendingItems(prev => [...prev, newPendingItem]);
             addItemForm.reset(); // Limpiar form de añadir item
             setProductsInCategory([]); // Limpiar productos cargados
             toast({ title: "Item Añadido (Temporalmente)", description: `"${productToAdd.name}" listo para guardar en el paquete.` });
         } catch (error) {
             console.error("[ManagePackages] Error añadiendo item pendiente:", error);
             toast({ variant: "destructive", title: "Error al Añadir", description: `No se pudo añadir el producto temporalmente. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsItemDataLoading(false);
         }
     };

    // Eliminar un producto de la lista PENDIENTE
    const handleDeletePendingItem = (localId: string) => {
         setPendingItems(prev => prev.filter(item => item.localId !== localId));
         toast({ title: "Item Eliminado (Temporalmente)", variant: 'destructive' });
     };

    // --- Gestión de Overrides de Modificadores (LOCAL) ---

     const openOverridesDialog = (localId: string) => {
        setEditingOverridesForItemLocalId(localId);
     };

     const closeOverridesDialog = () => {
         setEditingOverridesForItemLocalId(null);
     };

     // Guardar o actualizar un override LOCALMENTE
    const handleSaveLocalOverride = (slotId: string, min: number, max: number) => {
        if (!editingOverridesForItemLocalId) return;

        setPendingItems(prevItems => prevItems.map(item => {
            if (item.localId === editingOverridesForItemLocalId) {
                 const existingOverrides = item.modifierOverrides || [];
                 const existingOverrideIndex = existingOverrides.findIndex(ov => ov.product_modifier_slot_id === slotId);
                 let newOverrides: PackageItemModifierSlotOverride[];

                 const slotLabel = item.modifierSlots?.find(s => s.id === slotId)?.label || 'Unknown Slot';

                if (existingOverrideIndex > -1) {
                    // Actualizar override existente
                    newOverrides = [...existingOverrides];
                    newOverrides[existingOverrideIndex] = {
                         ...newOverrides[existingOverrideIndex], // Conservar ID si ya existe
                         min_quantity: min,
                         max_quantity: max,
                         product_modifier_slot_label: slotLabel,
                    };
                } else {
                    // Añadir nuevo override
                     const newOverride: PackageItemModifierSlotOverride = {
                         id: randomUUID(), // ID temporal local para el override
                         package_item_id: item.localId, // Referencia al ID local del item
                         product_modifier_slot_id: slotId,
                         min_quantity: min,
                         max_quantity: max,
                         product_modifier_slot_label: slotLabel,
                    };
                    newOverrides = [...existingOverrides, newOverride];
                }
                 toast({ title: "Regla Guardada (Temporalmente)", description: `Regla para "${slotLabel}" actualizada.` });
                return { ...item, modifierOverrides: newOverrides };
            }
            return item;
        }));
     };

     // Eliminar un override LOCALMENTE
     const handleDeleteLocalOverride = (slotId: string) => {
        if (!editingOverridesForItemLocalId) return;

        setPendingItems(prevItems => prevItems.map(item => {
            if (item.localId === editingOverridesForItemLocalId) {
                const slotLabel = item.modifierSlots?.find(s => s.id === slotId)?.label || 'Unknown Slot';
                const updatedOverrides = (item.modifierOverrides || []).filter(ov => ov.product_modifier_slot_id !== slotId);
                 toast({ title: "Regla Eliminada (Temporalmente)", description: `Regla para "${slotLabel}" eliminada.`, variant: 'destructive' });
                 return { ...item, modifierOverrides: updatedOverrides };
            }
            return item;
        }));
     };


     // Eliminar un paquete completo
     const handleDeletePackage = async (id: string, name: string) => {
         setIsDeleting(id);
         try {
             await deletePackageService(id);
             toast({ title: 'Paquete Eliminado', description: `"${name}" eliminado.` });
             await onDataChange();
         } catch (error) {
              console.error("[ManagePackages][Handler Delete Package] Error deleting package:", error);
             toast({ variant: 'destructive', title: 'Error al Eliminar Paquete', description: `No se pudo eliminar. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsDeleting(null);
         }
     };


     // Helper para formatear moneda
    const formatCurrency = (amount: number | null | undefined): string => {
        if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };


     return (
        <div>
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold">Gestionar Paquetes</h3>
                 <Button size="sm" onClick={handleAddClick}>
                     <PlusCircle className="mr-2 h-4 w-4" /> Añadir Paquete
                 </Button>
             </div>
             <p className="text-muted-foreground mb-4">Crea combos o paquetes, añade productos y configura reglas de modificadores.</p>

             <Card>
                 <CardContent className="p-0">
                     <ScrollArea className="h-[60vh]">
                         <Table>
                             <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría (UI)</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead>Imagen</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {packages.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center h-24">No hay paquetes definidos.</TableCell></TableRow>
                                ) : (
                                    packages.map(pkg => {
                                        const uiCategory = allCategories.find(c => c.id === pkg.category_id);
                                        return (
                                            <TableRow key={pkg.id}>
                                                <TableCell className="font-medium">{pkg.name}</TableCell>
                                                <TableCell>{uiCategory?.name || <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(pkg.price)}</TableCell>
                                                <TableCell>
                                                    {pkg.imageUrl ? (
                                                        <Image src={pkg.imageUrl} alt={pkg.name} width={40} height={30} className="rounded object-cover" data-ai-hint="package deal image" unoptimized/>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => handleEditClick(pkg)} title="Editar Paquete">
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
                                                                Esta acción eliminará el paquete "{pkg.name}" y todo su contenido. No se puede deshacer.
                                                            </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeletePackage(pkg.id, pkg.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

             {/* Dialogo Añadir/Editar Paquete */}
              <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDialog(); }}>
                 <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                     <DialogHeader>
                         <DialogTitle>{editingPackage ? 'Editar Paquete' : 'Añadir Nuevo Paquete'}</DialogTitle>
                         <DialogDescription>
                            Define la información básica, añade productos y configura reglas. Guarda al final.
                        </DialogDescription>
                     </DialogHeader>

                     <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Scroll para contenido largo */}
                        {/* Formulario Info Básica Paquete */}
                        <Form {...packageForm}>
                            <form onSubmit={(e) => e.preventDefault()} className="space-y-4 border-b pb-6 mb-6">
                                <FormField control={packageForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre del Paquete</FormLabel><FormControl><Input placeholder="e.g., Combo Pareja" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={packageForm.control} name="price" render={({ field }) => (
                                        <FormItem><FormLabel>Precio del Paquete</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}/>
                                     <FormField control={packageForm.control} name="category_id" render={({ field }) => (
                                        <FormItem><FormLabel>Categoría (UI)</FormLabel>
                                            <Select onValueChange={(value) => field.onChange(value === "__NONE__" ? null : value)} value={field.value ?? "__NONE__"}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona para agrupar" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                     <SelectItem value="__NONE__">-- Ninguna --</SelectItem>
                                                    {packageUICategories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select><FormMessage /></FormItem>
                                    )}/>
                                </div>
                                <FormField control={packageForm.control} name="imageUrl" render={({ field }) => (
                                    <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                {/* Botón de Guardar Info Básica Eliminado - Se guarda todo al final */}
                            </form>
                        </Form>

                        {/* Gestión de Items del Paquete (se maneja localmente) */}
                        <div className="space-y-4">
                            <h4 className="text-lg font-semibold">Contenido del Paquete</h4>
                            <Form {...addItemForm}>
                                <form onSubmit={addItemForm.handleSubmit(handleAddPendingItem)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                                    {/* Selector de Categoría */}
                                     <FormField control={addItemForm.control} name="selectedCategoryId" render={({ field }) => (
                                        <FormItem className="flex-grow"> <FormLabel className="text-xs">Categoría Producto</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="__NONE__" disabled>Selecciona categoría</SelectItem>
                                                    {productCategories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select> <FormMessage />
                                        </FormItem>
                                    )}/>
                                     {/* Selector de Producto */}
                                    <FormField control={addItemForm.control} name="product_id" render={({ field }) => (
                                        <FormItem className="flex-grow"> <FormLabel className="text-xs">Producto</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || '__NONE__'} disabled={!selectedCategoryId || isItemDataLoading}>
                                                <FormControl><SelectTrigger>
                                                    <SelectValue placeholder={isItemDataLoading ? "Cargando..." : "Selecciona producto"} />
                                                </SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="__NONE__" disabled>Selecciona producto</SelectItem>
                                                    {productsInCategory.map(prod => (
                                                        <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select> <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={addItemForm.control} name="quantity" render={({ field }) => (
                                        <FormItem className="w-20"> <FormLabel className="text-xs">Cantidad</FormLabel>
                                            <FormControl><Input type="number" min="1" {...field} /></FormControl> <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <Button type="submit" size="sm" disabled={isItemDataLoading} title="Añadir Item al Paquete">
                                        {isItemDataLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                                    </Button>
                                </form>
                            </Form>

                            <div className="h-[250px] border rounded-md"> {/* Altura fija para scroll interno */}
                                <ScrollArea className="h-full">
                                    {pendingItems.length === 0 && (
                                        <p className="p-4 text-center text-sm text-muted-foreground">Añade productos al paquete usando el formulario de arriba.</p>
                                    )}
                                    {pendingItems.length > 0 && (
                                        <Table className="text-sm">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="w-[80px] text-right">Cantidad</TableHead>
                                                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingItems.map(item => (
                                                    <TableRow key={item.localId}>
                                                        <TableCell>
                                                            {item.product_name}
                                                             {/* Indicador visual de overrides */}
                                                             {(item.modifierOverrides && item.modifierOverrides.length > 0) && (
                                                                <Badge variant="outline" className="ml-2 text-blue-600 border-blue-500 text-xs px-1 py-0">
                                                                    {item.modifierOverrides.length} Regla(s)
                                                                </Badge>
                                                             )}
                                                        </TableCell>
                                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                                        <TableCell className="text-right">
                                                             <Button variant="ghost" size="icon" className="h-6 w-6 mr-1 text-blue-600 hover:text-blue-800" onClick={() => openOverridesDialog(item.localId)} title="Configurar Modificadores">
                                                                <Settings className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePendingItem(item.localId)} title="Eliminar del Paquete">
                                                                <MinusCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>


                     </ScrollArea> {/* Fin ScrollArea principal */}

                     <DialogFooter className="mt-auto pt-4 border-t shrink-0"> {/* Footer fuera del scroll */}
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                        </DialogClose>
                        {/* Botón final para guardar todo */}
                        <Button type="button" onClick={handleFinalSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            {editingPackage ? 'Guardar Cambios Paquete' : 'Crear Paquete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Dialogo para Overrides de Modificadores (Usa estado local) */}
              <Dialog open={!!editingOverridesForItemLocalId} onOpenChange={(isOpen) => {if (!isOpen) closeOverridesDialog()}}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Modificadores para "{pendingItems.find(i => i.localId === editingOverridesForItemLocalId)?.product_name}"</DialogTitle>
                        <DialogDescription>Ajusta las reglas de selección de modificadores para este producto dentro del paquete.</DialogDescription>
                    </DialogHeader>
                     {isItemDataLoading ? ( // Usar el mismo loader que al cargar items
                        <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                    ) : (() => { // IIFE para renderizar contenido
                        const currentItem = pendingItems.find(i => i.localId === editingOverridesForItemLocalId);
                        const slots = currentItem?.modifierSlots || [];
                        const overrides = currentItem?.modifierOverrides || [];

                        if (slots.length === 0) {
                            return <p className="text-center text-muted-foreground py-4">Este producto no tiene grupos modificadores configurables.</p>;
                        }

                        return (
                            <ScrollArea className="max-h-[50vh]">
                                <div className="space-y-4 p-1">
                                    {slots.map(slot => {
                                        const currentOverride = overrides.find(ov => ov.product_modifier_slot_id === slot.id);
                                        const initialMin = currentOverride?.min_quantity ?? slot.min_quantity;
                                        const initialMax = currentOverride?.max_quantity ?? slot.max_quantity;
                                        const isOverridden = !!currentOverride;

                                         // Estado local para inputs del override actual
                                         const [minInput, setMinInput] = useState(initialMin);
                                         const [maxInput, setMaxInput] = useState(initialMax);

                                         // Sincronizar estado local si el override cambia (e.g., al eliminar)
                                         useEffect(() => {
                                             const updatedOverride = overrides.find(ov => ov.product_modifier_slot_id === slot.id);
                                             setMinInput(updatedOverride?.min_quantity ?? slot.min_quantity);
                                             setMaxInput(updatedOverride?.max_quantity ?? slot.max_quantity);
                                         }, [overrides, slot.id, slot.min_quantity, slot.max_quantity]);

                                        return (
                                            <Card key={slot.id} className={cn("p-3", isOverridden && "border-blue-500")}>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label htmlFor={`min-${slot.id}`} className="font-medium">{slot.label}</Label>
                                                        {isOverridden && <Badge variant="outline" className="text-blue-600 border-blue-500">Modificado</Badge>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Default: Min {slot.min_quantity}, Max {slot.max_quantity}</p>
                                                    <div className="flex items-end gap-3"> {/* Use items-end */}
                                                        <div className="flex-1">
                                                            <Label htmlFor={`min-${slot.id}`} className="text-xs">Min Requerido</Label>
                                                            <Input id={`min-${slot.id}`} type="number" min="0" value={minInput} onChange={e => setMinInput(parseInt(e.target.value, 10) || 0)} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <Label htmlFor={`max-${slot.id}`} className="text-xs">Max Permitido</Label>
                                                            <Input id={`max-${slot.id}`} type="number" min="0" value={maxInput} onChange={e => setMaxInput(parseInt(e.target.value, 10) || 0)}/>
                                                        </div>
                                                        <div className="flex flex-col gap-1"> {/* No pt-4 needed */}
                                                            <Button
                                                                type="button" size="sm"
                                                                onClick={() => {
                                                                    if (maxInput < minInput) {
                                                                        toast({ variant: 'destructive', title: 'Error', description: 'Máximo no puede ser menor que Mínimo.' });
                                                                        return;
                                                                    }
                                                                    handleSaveLocalOverride(slot.id, minInput, maxInput);
                                                                }}
                                                                title="Guardar Regla"
                                                            >
                                                                <Save className="h-4 w-4"/>
                                                            </Button>
                                                            {isOverridden && (
                                                                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteLocalOverride(slot.id)} title="Eliminar Regla">
                                                                    <Trash2 className="h-4 w-4"/>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        );
                    })()} {/* Fin IIFE */}
                     <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
         </div>
     );
};

export default ManagePackages;