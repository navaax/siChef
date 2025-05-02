'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
    getOverridesForPackageItem,
    setPackageItemOverride,
    deletePackageItemOverride,
    getModifierSlotsForProduct, // Para mostrar opciones de override
} from '@/services/product-service';

// Importar tipos
import type { Product, Package, PackageItem, PackageItemModifierSlotOverride, ProductModifierSlot, Category } from '@/types/product-types';

// --- Esquemas Zod ---
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    // Nuevo campo para categoría de UI
    category_id: z.string().nullable().optional(), // Permite nulo o string
});
type PackageFormValues = z.infer<typeof packageSchema>;

const addPackageItemSchema = z.object({
    product_id: z.string().min(1, "Selecciona un producto"),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
});
type AddPackageItemFormValues = z.infer<typeof addPackageItemSchema>;

const overrideSchema = z.object({
    min_quantity: z.coerce.number().int().min(0),
    max_quantity: z.coerce.number().int().min(0), // Puede ser 0 si se quiere deshabilitar
}).refine(data => data.max_quantity >= data.min_quantity, {
    message: "Max debe ser >= Min",
    path: ["max_quantity"],
});
type OverrideFormValues = z.infer<typeof overrideSchema>;


// --- Props del Componente ---
interface ManagePackagesProps {
    allProducts: Product[]; // Todos los productos disponibles para añadir
    allCategories: Category[]; // Todas las categorías para el selector de UI
    initialPackages: Package[];
    onDataChange: () => Promise<void>; // Callback para refrescar datos
}


// --- Componente Principal ---
const ManagePackages: React.FC<ManagePackagesProps> = ({
    allProducts,
    allCategories,
    initialPackages,
    onDataChange,
}) => {
    const [packages, setPackages] = useState<Package[]>(initialPackages);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false); // Estado del diálogo
    const [isSubmitting, setIsSubmitting] = useState(false); // Estado de carga del form principal
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // Estado de carga de eliminación
    const [currentPackageItems, setCurrentPackageItems] = useState<PackageItem[]>([]);
    const [isPackageItemsLoading, setIsPackageItemsLoading] = useState(false); // Carga para items
    const [isOverridesLoading, setIsOverridesLoading] = useState(false); // Carga para overrides
    const [editingOverridesForItem, setEditingOverridesForItem] = useState<PackageItem | null>(null); // Item para el cual editamos overrides
    const [itemModifierSlots, setItemModifierSlots] = useState<ProductModifierSlot[]>([]); // Slots del producto seleccionado para override
    const [currentItemOverrides, setCurrentItemOverrides] = useState<PackageItemModifierSlotOverride[]>([]); // Overrides existentes para ese item
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
        if (editPackageId) {
             const pkgToEdit = initialPackages.find(pkg => pkg.id === editPackageId);
             if (pkgToEdit) {
                 handleEditClick(pkgToEdit);
             } else {
                 // Si el ID no corresponde a ningún paquete, eliminar el param
                 const newParams = new URLSearchParams(searchParams);
                 newParams.delete('editPackage');
                 replace(`${pathname}?${newParams.toString()}`);
             }
         }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [searchParams, initialPackages]);


    // Filtrar categorías tipo 'paquete' para el selector de UI
    const packageUICategories = useMemo(() => allCategories.filter(c => c.type === 'paquete'), [allCategories]);


    const packageForm = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, imageUrl: '', category_id: null },
    });

    const addItemForm = useForm<AddPackageItemFormValues>({
        resolver: zodResolver(addPackageItemSchema),
        defaultValues: { product_id: '', quantity: 1 },
    });

    const overrideForm = useForm<OverrideFormValues>(); // No necesita resolver aquí, validación manual al guardar

    // Cargar items del paquete al editar
    const fetchPackageItems = useCallback(async (packageId: string) => {
        setIsPackageItemsLoading(true);
        try {
            console.log(`[ManagePackages] Cargando items para paquete ID: ${packageId}`);
            const items = await getItemsForPackage(packageId);
            console.log(`[ManagePackages] Items cargados:`, items);
            setCurrentPackageItems(items);
        } catch (error) {
            console.error(`[ManagePackages] Error cargando items para paquete ${packageId}:`, error);
            toast({ variant: "destructive", title: "Error Items", description: `No se pudieron cargar los items del paquete. ${error instanceof Error ? error.message : ''}` });
            setCurrentPackageItems([]);
        } finally {
            setIsPackageItemsLoading(false);
        }
    }, [toast]);

    // --- Handlers para abrir/cerrar diálogo ---
     const handleAddClick = () => {
         setEditingPackage(null);
         packageForm.reset({ name: '', price: 0, imageUrl: '', category_id: null });
         setCurrentPackageItems([]);
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
         fetchPackageItems(pkg.id);
         setIsFormOpen(true);
          // Actualizar URL sin recargar para mantener estado
          const currentParams = new URLSearchParams(window.location.search);
          currentParams.set('editPackage', pkg.id);
          replace(`${pathname}?${currentParams.toString()}`);
     };

     const handleCloseDialog = () => {
         setIsFormOpen(false);
         setEditingPackage(null);
         setCurrentPackageItems([]);
         // Limpiar el query param al cerrar
         const currentParams = new URLSearchParams(window.location.search);
         currentParams.delete('editPackage');
         replace(`${pathname}?${currentParams.toString()}`);
     };


     // Guardar/Actualizar información básica del paquete
     const handlePackageFormSubmit: SubmitHandler<PackageFormValues> = useCallback(async (values) => {
        setIsSubmitting(true);
        const dataToSave: Omit<Package, 'id'> = {
            ...values,
            imageUrl: values.imageUrl || null,
            category_id: values.category_id || null,
        };
        console.log("[ManagePackages] Guardando info paquete:", JSON.stringify(dataToSave, null, 2));

        try {
            let updatedPackage: Package;
            let action = 'creado';
            if (editingPackage?.id) {
                action = 'actualizado';
                await updatePackageService(editingPackage.id, dataToSave);
                updatedPackage = { ...editingPackage, ...dataToSave, items: currentPackageItems }; // Conservar items
            } else {
                updatedPackage = await addPackageService(dataToSave);
                updatedPackage.items = []; // Nuevo paquete no tiene items aún
                 // Actualizar URL con el nuevo ID después de crear SIN recargar
                 const currentParams = new URLSearchParams(window.location.search);
                 currentParams.set('editPackage', updatedPackage.id);
                 replace(`${pathname}?${currentParams.toString()}`);
            }
            toast({ title: "Éxito", description: `Paquete ${action}.` });
            setEditingPackage(updatedPackage); // Actualizar estado de edición
            await onDataChange(); // Refrescar lista principal en el padre
        } catch (error) {
            const action = editingPackage?.id ? 'actualizar' : 'añadir';
            console.error(`[ManagePackages] Error al ${action} paquete:`, error);
            toast({ variant: "destructive", title: `Error al ${action}`, description: `No se pudo ${action} el paquete. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingPackage, currentPackageItems, replace, pathname, toast, onDataChange]);


    // Añadir un producto al paquete actual
    const handleAddPackageItemSubmit: SubmitHandler<AddPackageItemFormValues> = async (values) => {
         if (!editingPackage || !editingPackage.id) {
             toast({ variant: "destructive", title: "Error", description: "Guarda la información básica del paquete antes de añadir productos." });
             return;
         }
         setIsPackageItemsLoading(true);
         try {
             const productToAdd = allProducts.find(p => p.id === values.product_id);
             if (!productToAdd) throw new Error("Producto no encontrado");

             const newItemData: Omit<PackageItem, 'id' | 'product_name'> = {
                 package_id: editingPackage.id,
                 product_id: values.product_id,
                 quantity: values.quantity,
                 display_order: currentPackageItems.length,
             };

             const addedItem = await addPackageItem(newItemData);
             // Añadir el nombre del producto manualmente después de la inserción exitosa
             setCurrentPackageItems(prev => [...prev, { ...addedItem, product_name: productToAdd.name }]);
             addItemForm.reset();
             toast({ title: "Éxito", description: `"${productToAdd.name}" añadido al paquete.` });
         } catch (error) {
             console.error("[ManagePackages] Error añadiendo item al paquete:", error);
             toast({ variant: "destructive", title: "Error al Añadir", description: `No se pudo añadir el producto. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };

    // Eliminar un producto del paquete
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
             console.error(`[ManagePackages] Error eliminando item ${packageItemId} del paquete:`, error);
             toast({ variant: "destructive", title: "Error al Eliminar", description: `No se pudo eliminar el producto. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsPackageItemsLoading(false);
         }
     };

    // --- Gestión de Overrides de Modificadores ---

     // Abrir diálogo para editar overrides de un item específico
     const openOverridesDialog = async (item: PackageItem) => {
        setEditingOverridesForItem(item);
        setIsOverridesLoading(true);
        setCurrentItemOverrides([]); // Limpiar overrides anteriores
        setItemModifierSlots([]); // Limpiar slots anteriores
        overrideForm.reset(); // Limpiar formulario

        try {
            console.log(`[ManagePackages] Cargando datos para overrides del item ${item.id} (Producto ID: ${item.product_id})`);
            const [slots, overrides] = await Promise.all([
                getModifierSlotsForProduct(item.product_id),
                getOverridesForPackageItem(item.id)
            ]);
            console.log(`[ManagePackages] Slots encontrados para producto ${item.product_id}:`, slots);
            console.log(`[ManagePackages] Overrides encontrados para item ${item.id}:`, overrides);
            setItemModifierSlots(slots);
            setCurrentItemOverrides(overrides);
        } catch (error) {
            console.error(`[ManagePackages] Error cargando datos de overrides para item ${item.id}:`, error);
            toast({ variant: "destructive", title: "Error Overrides", description: `No se pudieron cargar los datos de modificadores. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsOverridesLoading(false);
        }
     };

     // Guardar un override específico
     const handleSaveOverride = async (slotId: string, min: number, max: number) => {
        if (!editingOverridesForItem) return;
        setIsOverridesLoading(true);
        try {
            const data: Omit<PackageItemModifierSlotOverride, 'id' | 'product_modifier_slot_label'> = {
                package_item_id: editingOverridesForItem.id,
                product_modifier_slot_id: slotId,
                min_quantity: min,
                max_quantity: max,
            };
            const savedOverride = await setPackageItemOverride(data);
            // Actualizar lista de overrides actual
             setCurrentItemOverrides(prev => {
                const existingIndex = prev.findIndex(ov => ov.product_modifier_slot_id === slotId);
                if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = savedOverride;
                    return updated;
                } else {
                    return [...prev, savedOverride];
                }
            });
            toast({ title: "Éxito", description: `Regla para slot ${slotId.substring(0, 8)}... guardada.` });
        } catch (error) {
             console.error(`[ManagePackages] Error guardando override para slot ${slotId}:`, error);
             toast({ variant: "destructive", title: "Error al Guardar", description: `No se pudo guardar la regla. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsOverridesLoading(false);
        }
     };

     // Eliminar un override específico
     const handleDeleteOverride = async (overrideId: string) => {
        if (!editingOverridesForItem) return;
        setIsOverridesLoading(true);
        try {
            await deletePackageItemOverride(overrideId);
            setCurrentItemOverrides(prev => prev.filter(ov => ov.id !== overrideId));
            toast({ title: "Éxito", description: `Regla eliminada.`, variant: 'destructive' });
        } catch (error) {
             console.error(`[ManagePackages] Error eliminando override ${overrideId}:`, error);
             toast({ variant: "destructive", title: "Error al Eliminar", description: `No se pudo eliminar la regla. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsOverridesLoading(false);
        }
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
                            {editingPackage ? `Modifica los detalles de "${editingPackage.name}".` : 'Crea un nuevo combo o paquete.'}
                        </DialogDescription>
                     </DialogHeader>

                     <ScrollArea className="flex-grow pr-6 -mr-6"> {/* Scroll para contenido largo */}
                        {/* Formulario Info Básica Paquete */}
                        <Form {...packageForm}>
                            <form onSubmit={packageForm.handleSubmit(handlePackageFormSubmit)} className="space-y-4 border-b pb-6 mb-6">
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
                                <div className="flex justify-end">
                                    <Button type="submit" size="sm" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                        {editingPackage ? 'Guardar Cambios Paquete' : 'Crear Paquete'}
                                    </Button>
                                </div>
                            </form>
                        </Form>

                        {/* Gestión de Items del Paquete (solo si editando/creado) */}
                        {editingPackage?.id && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-semibold">Contenido del Paquete "{editingPackage.name}"</h4>
                                <Form {...addItemForm}>
                                    <form onSubmit={addItemForm.handleSubmit(handleAddPackageItemSubmit)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
                                        <FormField control={addItemForm.control} name="product_id" render={({ field }) => (
                                            <FormItem className="flex-grow"> <FormLabel className="text-xs">Producto a Añadir</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="__NONE__" disabled>Selecciona producto</SelectItem>
                                                        {allProducts
                                                             .filter(p => p.categoryId && allCategories.find(c => c.id === p.categoryId)?.type !== 'paquete') // Excluir paquetes de ser añadidos a sí mismos
                                                             .map(prod => (
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
                                        <Button type="submit" size="sm" disabled={isPackageItemsLoading || !editingPackage?.id}>
                                            {isPackageItemsLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                                        </Button>
                                    </form>
                                </Form>

                                <div className="h-[250px] border rounded-md"> {/* Altura fija para scroll interno */}
                                    <ScrollArea className="h-full">
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
                                                                 <Button variant="ghost" size="icon" className="h-6 w-6 mr-1 text-blue-600 hover:text-blue-800" onClick={() => openOverridesDialog(item)} title="Configurar Modificadores" disabled={isOverridesLoading}>
                                                                    <Settings className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeletePackageItem(item.id)} title="Eliminar del Paquete" disabled={isPackageItemsLoading}>
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
                        )}
                        {!editingPackage?.id && (
                            <p className="text-center text-sm text-muted-foreground mt-4">Guarda la información básica del paquete para poder añadirle contenido.</p>
                        )}
                     </ScrollArea> {/* Fin ScrollArea principal */}

                     <DialogFooter className="mt-auto pt-4 border-t shrink-0"> {/* Footer fuera del scroll */}
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={handleCloseDialog}>Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Dialogo para Overrides de Modificadores */}
              <Dialog open={!!editingOverridesForItem} onOpenChange={(isOpen) => {if (!isOpen) setEditingOverridesForItem(null)}}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Modificadores para "{editingOverridesForItem?.product_name}"</DialogTitle>
                        <DialogDescription>Ajusta las reglas de selección de modificadores para este producto dentro del paquete.</DialogDescription>
                    </DialogHeader>
                    {isOverridesLoading ? (
                        <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                    ) : itemModifierSlots.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">Este producto no tiene grupos modificadores configurables.</p>
                    ) : (
                         <ScrollArea className="max-h-[50vh]">
                            <div className="space-y-4 p-1">
                                {itemModifierSlots.map(slot => {
                                    const currentOverride = currentItemOverrides.find(ov => ov.product_modifier_slot_id === slot.id);
                                    const initialMin = currentOverride?.min_quantity ?? slot.min_quantity;
                                    const initialMax = currentOverride?.max_quantity ?? slot.max_quantity;
                                    const isOverridden = !!currentOverride;

                                    return (
                                        <Card key={slot.id} className={cn("p-3", isOverridden && "border-blue-500")}>
                                             <Form {...overrideForm}> {/* Usar el mismo form para cada card */}
                                                <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label htmlFor={`min-${slot.id}`} className="font-medium">{slot.label}</Label>
                                                        {isOverridden && <Badge variant="outline" className="text-blue-600 border-blue-500">Modificado</Badge>}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Default: Min {slot.min_quantity}, Max {slot.max_quantity}</p>
                                                     <div className="flex items-center gap-3">
                                                        <FormField control={overrideForm.control} name={`min_quantity_${slot.id}` as any} defaultValue={initialMin} render={({ field }) => (
                                                            <FormItem className="flex-1">
                                                                <FormLabel htmlFor={`min-${slot.id}`} className="text-xs">Min Requerido</FormLabel>
                                                                <FormControl>
                                                                    <Input id={`min-${slot.id}`} type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}/>
                                                         <FormField control={overrideForm.control} name={`max_quantity_${slot.id}` as any} defaultValue={initialMax} render={({ field }) => (
                                                            <FormItem className="flex-1">
                                                                <FormLabel htmlFor={`max-${slot.id}`} className="text-xs">Max Permitido</FormLabel>
                                                                <FormControl>
                                                                    <Input id={`max-${slot.id}`} type="number" min="0" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/>
                                                                </FormControl>
                                                                 <FormMessage />
                                                            </FormItem>
                                                        )}/>
                                                         <div className="flex flex-col gap-1 pt-4">
                                                            <Button
                                                                type="button" size="sm"
                                                                onClick={async () => {
                                                                    const minVal = overrideForm.getValues(`min_quantity_${slot.id}` as any);
                                                                    const maxVal = overrideForm.getValues(`max_quantity_${slot.id}` as any);
                                                                     if (maxVal < minVal) {
                                                                        toast({ variant: 'destructive', title: 'Error', description: 'Máximo no puede ser menor que Mínimo.' });
                                                                        return;
                                                                    }
                                                                    await handleSaveOverride(slot.id, minVal, maxVal);
                                                                }}
                                                                disabled={isOverridesLoading}
                                                                title="Guardar Regla"
                                                             >
                                                                <Save className="h-4 w-4"/>
                                                             </Button>
                                                             {isOverridden && currentOverride && ( // Added check for currentOverride
                                                                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteOverride(currentOverride.id)} disabled={isOverridesLoading} title="Eliminar Regla">
                                                                    <Trash2 className="h-4 w-4"/>
                                                                </Button>
                                                             )}
                                                         </div>
                                                     </div>
                                                 </form>
                                            </Form>
                                        </Card>
                                    );
                                })}
                            </div>
                         </ScrollArea>
                    )}
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
