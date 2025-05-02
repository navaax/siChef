// src/app/dashboard/product-settings/components/manage-products.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle, Settings, CheckSquare, Square, List } from 'lucide-react'; // Añadir iconos
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox'; // Importar Checkbox
import { Badge } from '@/components/ui/badge'; // Importar Badge
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Importar servicios específicos
import {
    addProduct as addProductService,
    updateProduct as updateProductService,
    deleteProduct as deleteProductService,
    getModifierSlotsForProduct,
    addModifierSlot,
    deleteModifierSlot,
    getModifiersByCategory, // Para obtener modificadores de una categoría
    addModifierSlotOption, // Para añadir opciones específicas
    deleteModifierSlotOption, // Para eliminar opciones específicas
    getModifierSlotOptions, // Para obtener las opciones actuales
} from '@/services/product-service';

// Importar tipos
import type { Category, Product, InventoryItem, ProductModifierSlot, ProductModifierSlotOption } from '@/types/product-types';

// --- Esquemas Zod ---
const productSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    categoryId: z.string().min(1, "Categoría es requerida"), // Refiere a Categoría tipo 'producto' o 'modificador'
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    inventory_item_id: z.string().nullable().optional(),
    inventory_consumed_per_unit: z.coerce.number().min(0, "Consumo debe ser positivo").optional().nullable(),
}).refine(data => !data.inventory_item_id || (data.inventory_item_id && data.inventory_consumed_per_unit !== undefined && data.inventory_consumed_per_unit !== null), {
    message: "El consumo por unidad es requerido si se vincula un item de inventario.",
    path: ["inventory_consumed_per_unit"],
});
type ProductFormValues = z.infer<typeof productSchema>;

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

// --- Props del Componente ---
interface ManageProductsProps {
    categories: Category[];
    inventoryItems: InventoryItem[];
    initialProducts: Product[];
    onDataChange: () => Promise<void>; // Callback para refrescar datos
}

// --- Componente Principal ---
const ManageProducts: React.FC<ManageProductsProps> = ({
    categories,
    inventoryItems,
    initialProducts,
    onDataChange
}) => {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // Estado de carga del form
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // Estado de carga de eliminación
    const [currentModifierSlots, setCurrentModifierSlots] = useState<ProductModifierSlot[]>([]);
    const [isModifierSlotsLoading, setIsModifierSlotsLoading] = useState(false);
    const [editingSlotOptions, setEditingSlotOptions] = useState<ProductModifierSlot | null>(null); // Slot cuyas opciones se están editando
    const [optionsForEditingSlot, setOptionsForEditingSlot] = useState<Product[]>([]); // Productos modificadores de la categoría vinculada
    const [isLoadingOptions, setIsLoadingOptions] = useState(false); // Carga para opciones de slot

    const { toast } = useToast();

    // Actualizar estado local si los datos iniciales cambian
    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);

    // Filtrar categorías asignables a productos ('producto' o 'modificador')
    const productAssignableCategories = useMemo(() => categories.filter(c => c.type === 'producto' || c.type === 'modificador'), [categories]);
    // Filtrar categorías para slots modificadores (solo tipo 'modificador')
    const modifierCategories = useMemo(() => categories.filter(c => c.type === 'modificador'), [categories]);

    const productForm = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '', price: 0, categoryId: '', imageUrl: '',
            inventory_item_id: null, inventory_consumed_per_unit: 1,
        },
    });

    // Cargar slots modificadores al editar un producto
    const fetchSlotsForProduct = async (productId: string) => {
        setIsModifierSlotsLoading(true);
        try {
            const slots = await getModifierSlotsForProduct(productId);
            setCurrentModifierSlots(slots);
        } catch (error) {
            console.error(`[ManageProducts] Error cargando slots para ${productId}:`, error);
            toast({ variant: "destructive", title: "Error Slots", description: `No se pudieron cargar los modificadores. ${error instanceof Error ? error.message : ''}`});
            setCurrentModifierSlots([]);
        } finally {
            setIsModifierSlotsLoading(false);
        }
    };

    useEffect(() => {
        if (editingProduct && isFormOpen) {
            fetchSlotsForProduct(editingProduct.id);
        } else {
            setCurrentModifierSlots([]);
        }
    }, [editingProduct, isFormOpen, toast]);

    const handleOpenForm = (product: Product | null = null) => {
        setEditingProduct(product);
        if (product) {
            productForm.reset({
                name: product.name, price: product.price, categoryId: product.categoryId,
                imageUrl: product.imageUrl || '', inventory_item_id: product.inventory_item_id || null,
                inventory_consumed_per_unit: product.inventory_consumed_per_unit ?? 1,
            });
        } else {
             productForm.reset({
                name: '', price: 0, categoryId: '', imageUrl: '',
                inventory_item_id: null, inventory_consumed_per_unit: 1,
            });
             setCurrentModifierSlots([]); // Limpiar slots al añadir nuevo
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
         setIsFormOpen(false);
         setEditingProduct(null); // Limpiar producto en edición
         setCurrentModifierSlots([]); // Limpiar slots
         setEditingSlotOptions(null); // Cerrar diálogo de opciones si está abierto
    }

    const handleFormSubmit: SubmitHandler<ProductFormValues> = async (values) => {
        setIsSubmitting(true);
        const dataToSave = {
            ...values,
             imageUrl: values.imageUrl || null,
            inventory_item_id: values.inventory_item_id || null,
             inventory_consumed_per_unit: values.inventory_item_id ? (values.inventory_consumed_per_unit ?? 1) : null,
        };

        console.log("[ManageProducts] Guardando producto:", JSON.stringify(dataToSave, null, 2));

        try {
             let productId = editingProduct?.id;
             if (productId) {
                await updateProductService(productId, dataToSave as Partial<Omit<Product, 'id'>>);
                toast({ title: "Éxito", description: "Producto actualizado." });
                // Actualizar producto en la lista local si es necesario (o re-fetch)
                await onDataChange();
                // Mantener el producto en edición para gestión de slots
                setEditingProduct(prev => prev ? { ...prev, ...dataToSave } : null);
             } else {
                const newProduct = await addProductService(dataToSave as Omit<Product, 'id'>);
                toast({ title: "Éxito", description: "Producto añadido. Ahora puedes añadir modificadores." });
                setEditingProduct(newProduct); // Establecer como producto en edición para añadir slots
                await onDataChange();
             }
             // No cerrar el form automáticamente al guardar para permitir añadir/editar slots
             // handleCloseForm();
        } catch (error) {
             const action = editingProduct ? 'actualizar' : 'añadir';
            console.error(`[ManageProducts] Error al ${action} producto:`, error);
            toast({ variant: "destructive", title: `Error al ${action}`, description: `No se pudo ${action} el producto. ${error instanceof Error ? error.message : ''}`});
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProduct = async (id: string, name: string) => {
        setIsDeleting(id);
        try {
            await deleteProductService(id);
            toast({ title: "Éxito", description: `"${name}" eliminado.`, variant: "destructive" });
            await onDataChange();
             if (editingProduct?.id === id) {
                 handleCloseForm(); // Cerrar form si se elimina el producto en edición
             }
        } catch (error) {
             console.error(`[ManageProducts] Error al eliminar producto ${id}:`, error);
            toast({ variant: "destructive", title: 'Error al Eliminar', description: `No se pudo eliminar el producto. ${error instanceof Error ? error.message : ''}`});
        } finally {
            setIsDeleting(null);
        }
    };

    // --- Gestión de Slots Modificadores ---
    const handleAddModifierSlot = async (data: AddModifierSlotFormValues) => {
        if (!editingProduct) return;
        setIsModifierSlotsLoading(true);
        try {
            const newSlot = await addModifierSlot({
                product_id: editingProduct.id,
                ...data,
            });
            // Refrescar slots para el producto actual
            await fetchSlotsForProduct(editingProduct.id);
            toast({ title: "Éxito", description: "Grupo modificador añadido." });
        } catch (error) {
            console.error(`[ManageProducts] Error al añadir slot:`, error);
            toast({ variant: "destructive", title: "Error Slot", description: `No se pudo añadir el grupo. ${error instanceof Error ? error.message : ''}`});
        } finally {
            setIsModifierSlotsLoading(false);
        }
    };

    const handleDeleteModifierSlot = async (slotId: string) => {
         if (!editingProduct) return;
         setIsModifierSlotsLoading(true);
         try {
             await deleteModifierSlot(slotId);
              // Refrescar slots para el producto actual
             await fetchSlotsForProduct(editingProduct.id);
             toast({ title: "Éxito", description: "Grupo modificador eliminado.", variant: 'destructive' });
         } catch (error) {
             console.error(`[ManageProducts] Error al eliminar slot ${slotId}:`, error);
             toast({ variant: "destructive", title: "Error Slot", description: `No se pudo eliminar el grupo. ${error instanceof Error ? error.message : ''}`});
         } finally {
             setIsModifierSlotsLoading(false);
         }
    };

    // --- Gestión de Opciones Específicas del Slot ---
    const handleOpenEditSlotOptions = async (slot: ProductModifierSlot) => {
         setIsLoadingOptions(true);
         setEditingSlotOptions(slot);
         try {
             // 1. Obtener las opciones YA seleccionadas para este slot
             const currentlyAllowedOptions = await getModifierSlotOptions(slot.id);
             // Actualizar el estado del slot con las opciones obtenidas (importante para la UI)
             setEditingSlotOptions(prev => prev ? { ...prev, allowedOptions: currentlyAllowedOptions } : null);

             // 2. Obtener TODOS los productos de la categoría vinculada
             const allOptionsInCategory = await getModifiersByCategory(slot.linked_category_id);
             setOptionsForEditingSlot(allOptionsInCategory);

         } catch (error) {
             console.error(`[ManageProducts] Error al preparar opciones para slot ${slot.id}:`, error);
             toast({ variant: "destructive", title: "Error Opciones", description: `No se pudieron cargar las opciones. ${error instanceof Error ? error.message : ''}` });
             setOptionsForEditingSlot([]);
             setEditingSlotOptions(null); // Cerrar si hay error
         } finally {
             setIsLoadingOptions(false);
         }
    };

    const handleToggleSlotOption = async (slotId: string, modifierProductId: string, isCurrentlyAllowed: boolean) => {
         setIsLoadingOptions(true); // Reutilizar estado de carga
         try {
            let updatedOption: ProductModifierSlotOption | null = null;
            if (isCurrentlyAllowed) {
                // Encontrar el ID de la opción específica para eliminarla
                const optionToDelete = editingSlotOptions?.allowedOptions?.find(opt => opt.modifier_product_id === modifierProductId);
                if (optionToDelete) {
                    await deleteModifierSlotOption(optionToDelete.id);
                    toast({ title: "Opción Deshabilitada", variant: "destructive" });
                } else {
                    console.warn(`[ManageProducts] No se encontró la opción ${modifierProductId} para eliminar del slot ${slotId}`);
                    toast({ title: "Advertencia", description: "No se encontró la opción para eliminar.", variant: "default" });
                }
            } else {
                 // Añadir la opción
                 updatedOption = await addModifierSlotOption({ product_modifier_slot_id: slotId, modifier_product_id: modifierProductId });
                 toast({ title: "Opción Habilitada" });
            }

            // Actualizar el estado local de allowedOptions en editingSlotOptions
             setEditingSlotOptions(prevSlot => {
                 if (!prevSlot) return null;
                 let newAllowedOptions = [...(prevSlot.allowedOptions || [])];
                 if (isCurrentlyAllowed) {
                     newAllowedOptions = newAllowedOptions.filter(opt => opt.modifier_product_id !== modifierProductId);
                 } else if (updatedOption) { // Añadir solo si la operación de añadir fue exitosa
                     // Necesitamos añadir el nombre y precio si es posible (aunque no estrictamente necesario aquí)
                     const prodInfo = optionsForEditingSlot.find(p => p.id === modifierProductId);
                     newAllowedOptions.push({
                         ...updatedOption,
                         modifier_product_name: prodInfo?.name,
                         modifier_product_price: prodInfo?.price
                     });
                 }
                 return { ...prevSlot, allowedOptions: newAllowedOptions };
             });

             // Refrescar la lista principal de slots en el diálogo principal (para que refleje el badge)
             if (editingProduct) {
                 await fetchSlotsForProduct(editingProduct.id);
             }

         } catch (error) {
             console.error(`[ManageProducts] Error al ${isCurrentlyAllowed ? 'eliminar' : 'añadir'} opción ${modifierProductId} del slot ${slotId}:`, error);
             toast({ variant: "destructive", title: "Error Opción", description: `No se pudo actualizar la opción. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsLoadingOptions(false);
         }
     };

    const handleCloseEditSlotOptions = () => {
        setEditingSlotOptions(null);
        setOptionsForEditingSlot([]);
    };


    // Helper para formatear moneda
    const formatCurrency = (amount: number | null | undefined): string => {
        if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
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
                                {products.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24">No hay productos.</TableCell></TableRow>
                                ) : (
                                    products.map(prod => {
                                         const category = categories.find(c => c.id === prod.categoryId);
                                         const invItem = inventoryItems.find(i => i.id === prod.inventory_item_id);
                                        return (
                                            <TableRow key={prod.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                     {prod.imageUrl ? (
                                                        <Image src={prod.imageUrl} alt={prod.name} width={32} height={24} className="rounded object-cover" data-ai-hint="product item image" unoptimized/>
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
                                                                Esta acción eliminará "{prod.name}". Esta acción no se puede deshacer y puede afectar paquetes o modificadores existentes.
                                                            </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteProduct(prod.id, prod.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

            {/* Dialogo Añadir/Editar Producto */}
             <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) handleCloseForm() }}>
                 <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? 'Editar Producto/Modificador' : 'Añadir Nuevo Producto/Modificador'}</DialogTitle>
                        <DialogDescription>
                             Define un producto vendible o una opción modificadora.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...productForm}>
                        <form onSubmit={productForm.handleSubmit(handleFormSubmit)} className="space-y-4">
                            <FormField control={productForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="e.g., Alitas 6pz, Salsa BBQ" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={productForm.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Precio</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={productForm.control} name="categoryId" render={({ field }) => (
                                    <FormItem><FormLabel>Categoría</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || '__NONE__'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                 <SelectItem value="__NONE__" disabled>Selecciona una categoría</SelectItem>
                                                {productAssignableCategories.length === 0 && <SelectItem value="__NO_CATS__" disabled>Crea una categoría primero</SelectItem>}
                                                {productAssignableCategories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.type})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={productForm.control} name="imageUrl" render={({ field }) => (
                                <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <div className="grid grid-cols-2 gap-4">
                                <FormField
                                   control={productForm.control}
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
                                {productForm.watch('inventory_item_id') && (
                                    <FormField control={productForm.control} name="inventory_consumed_per_unit" render={({ field }) => (
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
                                  <Button type="submit" size="sm" disabled={isSubmitting || productAssignableCategories.length === 0}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                        {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                                  </Button>
                              </div>
                        </form>
                    </Form>

                    {/* Gestión de Slots Modificadores (solo si editando) */}
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
                                               <TableHead className="w-[120px] text-right">Opciones</TableHead> {/* Cambiado a Opciones */}
                                           </TableRow>
                                       </TableHeader>
                                       <TableBody>
                                           {currentModifierSlots.map(slot => {
                                               const linkedCat = modifierCategories.find(c => c.id === slot.linked_category_id);
                                               const hasSpecificOptions = slot.allowedOptions && slot.allowedOptions.length > 0;
                                               return (
                                                   <TableRow key={slot.id}>
                                                        <TableCell>{slot.label}</TableCell>
                                                        <TableCell>{linkedCat?.name || 'N/A'}</TableCell>
                                                        <TableCell className="text-center">{slot.min_quantity}</TableCell>
                                                        <TableCell className="text-center">{slot.max_quantity}</TableCell>
                                                        <TableCell className="text-right space-x-1">
                                                            {/* Botón para editar opciones */}
                                                             <Button variant="outline" size="icon" className="h-6 w-6 text-blue-600 hover:text-blue-800" onClick={() => handleOpenEditSlotOptions(slot)} title="Configurar Opciones Específicas">
                                                                <List className="h-3.5 w-3.5" />
                                                             </Button>
                                                             {hasSpecificOptions && (
                                                                <Badge variant="secondary" className="text-blue-700 border-blue-300 px-1 text-xs">
                                                                    {slot.allowedOptions?.length} esp.
                                                                </Badge>
                                                             )}
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteModifierSlot(slot.id)} title="Eliminar Grupo" disabled={isModifierSlotsLoading}>
                                                                <MinusCircle className="h-3.5 w-3.5" />
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
                        {/* <DialogClose asChild> */}
                            <Button type="button" variant="outline" onClick={handleCloseForm}>Cerrar</Button>
                        {/* </DialogClose> */}
                    </DialogFooter>
                </DialogContent>
             </Dialog>

             {/* Dialogo para Editar Opciones Específicas del Slot */}
             <Dialog open={!!editingSlotOptions} onOpenChange={(open) => { if (!open) handleCloseEditSlotOptions() }}>
                <DialogContent className="sm:max-w-[600px]">
                   <DialogHeader>
                     <DialogTitle>Configurar Opciones Específicas para "{editingSlotOptions?.label}"</DialogTitle>
                     <DialogDescription>
                        Selecciona qué modificadores de la categoría "{modifierCategories.find(c => c.id === editingSlotOptions?.linked_category_id)?.name}" están permitidos en este grupo. Si no seleccionas ninguno, se permitirán todos.
                    </DialogDescription>
                   </DialogHeader>

                   {isLoadingOptions ? (
                      <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                   ) : optionsForEditingSlot.length === 0 && editingSlotOptions ? (
                      <p className="text-muted-foreground text-center py-4">No hay productos modificadores en la categoría "{modifierCategories.find(c => c.id === editingSlotOptions?.linked_category_id)?.name}".</p>
                   ) : (
                      <ScrollArea className="max-h-[50vh] pr-3 -mr-3">
                         <div className="space-y-2">
                            {optionsForEditingSlot.map(option => {
                               const isAllowed = !!editingSlotOptions?.allowedOptions?.some(allowed => allowed.modifier_product_id === option.id);
                               return (
                                  <div key={option.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                                      <div className="flex items-center gap-2">
                                         {option.imageUrl ? (
                                            <Image src={option.imageUrl} alt={option.name} width={24} height={24} className="rounded object-cover" unoptimized />
                                         ) : <div className='w-6 h-6 bg-muted rounded'></div>}
                                         <Label htmlFor={`opt-${option.id}`} className="text-sm cursor-pointer">
                                            {option.name} ({formatCurrency(option.price)})
                                         </Label>
                                      </div>
                                      <Checkbox
                                         id={`opt-${option.id}`}
                                         checked={isAllowed}
                                         onCheckedChange={() => editingSlotOptions && handleToggleSlotOption(editingSlotOptions.id, option.id, isAllowed)}
                                         disabled={isLoadingOptions}
                                         aria-label={`Permitir ${option.name}`}
                                      />
                                  </div>
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

// --- Componente Auxiliar para Añadir Slots ---
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

export default ManageProducts;
