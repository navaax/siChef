// src/app/dashboard/product-settings/components/manage-packages.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, MinusCircle, Settings, ChevronsUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogPrimitiveFooter, AlertDialogHeader, AlertDialogPrimitiveHeader, AlertDialogTitle as AlertDialogPrimitiveTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    getOverridesForPackageItem,
    setPackageItemOverride,
    deletePackageItemOverride,
    getModifierSlotsForProduct,
    getAllPackages,
} from '@/services/product-service';

// Importar tipos
import type { Product, Package, PackageItem, PackageItemModifierSlotOverride, ProductModifierSlot, Category } from '@/types/product-types';

// --- Esquemas Zod ---
const packageSchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    price: z.coerce.number().min(0, "Precio debe ser positivo"),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
    category_id: z.string().nullable().optional(),
});
type PackageFormValues = z.infer<typeof packageSchema>;

const addPackageItemSchema = z.object({
    selectedCategoryId: z.string().min(1, "Selecciona una categoría"),
    product_id: z.string().min(1, "Selecciona un producto"),
    quantity: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1"),
});
type AddPackageItemFormValues = z.infer<typeof addPackageItemSchema>;

// --- Tipos Locales ---
interface PendingPackageItem {
  localId: string; // ID temporal para manejo en UI, o ID de BD si ya existe
  product_id: string;
  product_name: string;
  quantity: number;
  display_order?: number;
  modifierSlots?: ProductModifierSlot[]; // Los slots originales del producto base
  modifierOverrides?: PackageItemModifierSlotOverride[]; // Overrides definidos para este item DENTRO del paquete
}

// --- Props del Componente ---
interface ManagePackagesProps {
    allProductsAndModifiers: Product[];
    allCategories: Category[];
    initialPackages: Package[];
    onDataChange: () => Promise<void>;
}


// --- Componente Principal ---
const ManagePackages: React.FC<ManagePackagesProps> = ({
    allProductsAndModifiers,
    allCategories,
    initialPackages,
    onDataChange,
}) => {
    const [packages, setPackages] = useState<Package[]>(initialPackages);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [pendingItems, setPendingItems] = useState<PendingPackageItem[]>([]);
    const [originalDbItems, setOriginalDbItems] = useState<PackageItem[]>([]); // Para comparar al guardar
    const [isItemFormLoading, setIsItemFormLoading] = useState(false); // Para carga de productos en addItemForm
    const [isPackageContentLoading, setIsPackageContentLoading] = useState(false); // Para carga de contenido de paquete existente
    const [editingOverridesForItemLocalId, setEditingOverridesForItemLocalId] = useState<string | null>(null);
    const [productsInCategory, setProductsInCategory] = useState<Product[]>([]);
    const { toast } = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const replace = router.replace;
    const searchParams = useSearchParams();

    useEffect(() => {
        setPackages(initialPackages);
    }, [initialPackages]);

    useEffect(() => {
        const editPackageId = searchParams.get('editPackage');
        if (editPackageId && !isFormOpen) {
            const pkgToEdit = initialPackages.find(pkg => pkg.id === editPackageId);
            if (pkgToEdit) {
                handleEditClick(pkgToEdit);
            } else {
                const currentParams = new URLSearchParams(searchParams.toString());
                currentParams.delete('editPackage');
                replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, initialPackages, isFormOpen, pathname]); // Dependencias actualizadas

    const packageUICategories = useMemo(() => allCategories.filter(c => c.type === 'paquete'), [allCategories]);
    const productCategories = useMemo(() => allCategories.filter(c => c.type === 'producto'), [allCategories]);

    const packageForm = useForm<PackageFormValues>({
        resolver: zodResolver(packageSchema),
        defaultValues: { name: '', price: 0, imageUrl: '', category_id: null },
    });

    const addItemForm = useForm<AddPackageItemFormValues>({
        resolver: zodResolver(addPackageItemSchema),
        defaultValues: { selectedCategoryId: '', product_id: '', quantity: 1 },
    });

    const selectedCategoryId = addItemForm.watch('selectedCategoryId');

    useEffect(() => {
        console.log("[ManagePackages] Categoría para añadir ítem CAMBIÓ a:", selectedCategoryId);
        setProductsInCategory([]); // Limpiar productos de categoría anterior
        addItemForm.resetField('product_id', { defaultValue: '' }); // Resetear selección de producto

        if (selectedCategoryId && selectedCategoryId !== '__NONE__') {
            setIsItemFormLoading(true);
            try {
                console.log(`[ManagePackages] Filtrando productos para categoría ${selectedCategoryId}. Total de productos/modificadores disponibles: ${allProductsAndModifiers?.length || 0}`);
                if (!allProductsAndModifiers || allProductsAndModifiers.length === 0) {
                    console.warn("[ManagePackages] allProductsAndModifiers está vacío o no definido. No se pueden filtrar productos.");
                    setIsItemFormLoading(false);
                    return;
                }
                const prods = allProductsAndModifiers.filter(p => {
                    const categoryOfProduct = allCategories.find(c => c.id === p.categoryId);
                    return p.categoryId === selectedCategoryId && categoryOfProduct?.type === 'producto';
                });
                console.log(`[ManagePackages] Productos (tipo 'producto') filtrados para categoría ${selectedCategoryId}: ${prods.length}`, prods.map(p => ({id: p.id, name: p.name})));
                setProductsInCategory(prods);
                if (prods.length === 0) {
                    console.warn(`[ManagePackages] No se encontraron productos (tipo 'producto') para la categoría ${selectedCategoryId}.`);
                }
            } catch (error) {
                console.error("[ManagePackages] Error filtrando productos:", error);
                toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los productos para la categoría." });
            } finally {
                setIsItemFormLoading(false);
            }
        }
    }, [selectedCategoryId, addItemForm, toast, allProductsAndModifiers, allCategories]);


    const loadPackageContents = useCallback(async (packageId: string) => {
        console.log(`[loadPackageContents] Iniciando carga para paquete ID: ${packageId}`);
        setIsPackageContentLoading(true);
        setPendingItems([]);
        setOriginalDbItems([]);
        try {
            const dbItems = await getItemsForPackage(packageId);
            console.log(`[loadPackageContents] DB Items for package ${packageId}:`, JSON.stringify(dbItems.map(i => ({id: i.id, name: i.product_name, prod_id: i.product_id, quantity: i.quantity}))));
            setOriginalDbItems(dbItems);

            const pendingItemsPromises = dbItems.map(async (item) => {
                if (!item.product_id) {
                    console.warn(`[loadPackageContents] Package item ${item.id} (${item.product_name}) no tiene product_id. Omitiendo.`);
                    return null;
                }
                const productDetailsFromList = allProductsAndModifiers.find(p => p.id === item.product_id);
                const productName = productDetailsFromList?.name || item.product_name || 'Producto Desconocido (Error BD)';

                const [slots, overrides] = await Promise.all([
                    getModifierSlotsForProduct(item.product_id),
                    getOverridesForPackageItem(item.id) // item.id es el ID del package_item
                ]);
                console.log(`[loadPackageContents] Para ítem de paquete ${item.id} (${productName}), prod_id=${item.product_id}: Slots base=${slots.length}, Overrides BD=${overrides.length}`);
                return {
                    localId: item.id,
                    product_id: item.product_id,
                    product_name: productName,
                    quantity: item.quantity,
                    display_order: item.display_order,
                    modifierSlots: slots,
                    modifierOverrides: overrides,
                };
            });
            const loadedPendingItems = (await Promise.all(pendingItemsPromises)).filter(item => item !== null) as PendingPackageItem[];
            console.log(`[loadPackageContents] Processed pendingItems for package ${packageId}:`, JSON.stringify(loadedPendingItems.map(p => ({localId:p.localId, name:p.product_name, overrides: p.modifierOverrides?.length}))));
            setPendingItems(loadedPendingItems);
        } catch (error) {
            console.error(`[loadPackageContents] Error cargando contenido para paquete ${packageId}:`, error);
            toast({ variant: "destructive", title: "Error Contenido", description: `No se pudo cargar el contenido del paquete. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsPackageContentLoading(false);
            console.log(`[loadPackageContents] Finalizada carga para paquete ID: ${packageId}. isPackageContentLoading: false`);
        }
    }, [toast, allProductsAndModifiers]);

    const handleAddClick = () => {
        setEditingPackage(null);
        packageForm.reset({ name: '', price: 0, imageUrl: '', category_id: null });
        setPendingItems([]);
        setOriginalDbItems([]);
        setIsFormOpen(true);
    };

    const handleEditClick = (pkg: Package) => {
        setEditingPackage(pkg);
        packageForm.reset({
            name: pkg.name, price: pkg.price,
            imageUrl: pkg.imageUrl || '',
            category_id: pkg.category_id || null
        });
        loadPackageContents(pkg.id);
        setIsFormOpen(true);
        const currentParams = new URLSearchParams(searchParams.toString());
        if (currentParams.get('editPackage') !== pkg.id) {
            currentParams.set('editPackage', pkg.id);
            replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
        }
    };

    const handleCloseDialog = () => {
        if (isFormOpen) {
            setIsFormOpen(false);
            setEditingPackage(null);
            setPendingItems([]);
            setOriginalDbItems([]);
            setProductsInCategory([]); 
            addItemForm.reset(); 
            const currentParams = new URLSearchParams(searchParams.toString());
            if (currentParams.has('editPackage')) {
                currentParams.delete('editPackage');
                replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
            }
        }
    };

     const handleFinalSave = async () => {
        setIsSubmitting(true);
        const packageFormValues = await packageForm.trigger() ? packageForm.getValues() : null;
        if (!packageFormValues) {
             toast({ variant: "destructive", title: "Error de Validación", description: "Revisa los datos básicos del paquete." });
             setIsSubmitting(false);
             return;
        }

        const packageDataToSave: Omit<Package, 'id'> = {
            name: packageFormValues.name,
            price: packageFormValues.price,
            imageUrl: packageFormValues.imageUrl || null,
            category_id: packageFormValues.category_id || null,
        };

        try {
            let currentPackageId = editingPackage?.id;
            let action: 'creado' | 'actualizado' = 'actualizado';

            if (currentPackageId) {
                await updatePackageService(currentPackageId, packageDataToSave);
                console.log(`[FinalSave] Paquete ${currentPackageId} actualizado.`);
            } else {
                action = 'creado';
                const newPackage = await addPackageService(packageDataToSave);
                currentPackageId = newPackage.id;
                setEditingPackage(newPackage);
                console.log(`[FinalSave] Paquete ${currentPackageId} creado.`);
            }

            if (!currentPackageId) throw new Error("No se pudo obtener/crear el ID del paquete.");

            const dbItemsBeforeSave = [...originalDbItems]; 
            const itemsToDeleteFromDb = dbItemsBeforeSave.filter(
                dbItem => !pendingItems.some(pendingItem => pendingItem.localId === dbItem.id)
            );

            for (const itemToDelete of itemsToDeleteFromDb) {
                console.log(`[FinalSave] Eliminando ítem de paquete de BD: ${itemToDelete.id} (${itemToDelete.product_name})`);
                await deletePackageItem(itemToDelete.id);
            }

            for (const [index, pendingItem] of pendingItems.entries()) {
                let dbItemId = pendingItem.localId;
                const isNewDbItem = !dbItemsBeforeSave.some(dbItem => dbItem.id === pendingItem.localId);

                if (isNewDbItem) {
                    console.log(`[FinalSave] Añadiendo nuevo ítem al paquete ${currentPackageId}: ${pendingItem.product_name}`);
                    const newItemData: Omit<PackageItem, 'id' | 'product_name'> = {
                        package_id: currentPackageId,
                        product_id: pendingItem.product_id,
                        quantity: pendingItem.quantity,
                        display_order: index,
                    };
                    const createdItem = await addPackageItem(newItemData);
                    dbItemId = createdItem.id;
                    console.log(`[FinalSave] Nuevo ítem de paquete creado con ID de BD: ${dbItemId}`);
                } else {
                    console.log(`[FinalSave] Ítem de paquete existente ${dbItemId} (${pendingItem.product_name}). Procesando overrides.`);
                }

                const currentOverridesInDbForItem = await getOverridesForPackageItem(dbItemId);
                const localOverridesMap = new Map(pendingItem.modifierOverrides?.map(ov => [ov.product_modifier_slot_id, ov]));

                for (const dbOverride of currentOverridesInDbForItem) {
                    if (!localOverridesMap.has(dbOverride.product_modifier_slot_id)) {
                        console.log(`[FinalSave] Eliminando override de BD ${dbOverride.id} para ítem ${dbItemId}, slot ${dbOverride.product_modifier_slot_id}`);
                        await deletePackageItemOverride(dbOverride.id);
                    }
                }
                if (pendingItem.modifierOverrides) {
                    for (const localOverride of pendingItem.modifierOverrides) {
                        console.log(`[FinalSave] Estableciendo override para ítem ${dbItemId}, slot ${localOverride.product_modifier_slot_id}: Min=${localOverride.min_quantity}, Max=${localOverride.max_quantity}`);
                        await setPackageItemOverride({
                            package_item_id: dbItemId, 
                            product_modifier_slot_id: localOverride.product_modifier_slot_id,
                            min_quantity: localOverride.min_quantity,
                            max_quantity: localOverride.max_quantity,
                        });
                    }
                }
            }

            toast({ title: "Éxito", description: `Paquete ${action} con su contenido.` });
            await onDataChange(); 
            
            if (action === 'creado' && currentPackageId) {
                 handleCloseDialog(); 
            } else if (action === 'actualizado' && currentPackageId) {
                 loadPackageContents(currentPackageId); 
            }

        } catch (error) {
            const actionAttempted = editingPackage ? 'actualizar' : 'crear';
            console.error(`[ManagePackages] Error al ${actionAttempted} paquete y contenido:`, error);
            toast({ variant: "destructive", title: `Error al ${actionAttempted}`, description: `No se pudo guardar el paquete. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
     };


     const handleAddPendingItem: SubmitHandler<AddPackageItemFormValues> = async (values) => {
         setIsItemFormLoading(true);
         console.log(`[handleAddPendingItem] Intentando añadir producto ID: ${values.product_id} con cantidad: ${values.quantity}`);
         try {
             const productToAdd = productsInCategory.find(p => p.id === values.product_id);
             if (!productToAdd) {
                 console.error("[handleAddPendingItem] Producto no encontrado en productsInCategory. productsInCategory:", productsInCategory, "product_id buscado:", values.product_id);
                 throw new Error("Producto no encontrado en la categoría seleccionada.");
             }

             console.log(`[handleAddPendingItem] Producto encontrado: ${productToAdd.name}. Obteniendo slots...`);
             const slots = await getModifierSlotsForProduct(productToAdd.id);
             console.log(`[handleAddPendingItem] Slots obtenidos para ${productToAdd.name}: ${slots.length}`);

             const newPendingItem: PendingPackageItem = {
                 localId: uuidv4(), 
                 product_id: productToAdd.id,
                 product_name: productToAdd.name,
                 quantity: values.quantity,
                 modifierSlots: slots,
                 modifierOverrides: [],
             };
             setPendingItems(prev => [...prev, newPendingItem]);
             addItemForm.reset({ selectedCategoryId: selectedCategoryId, product_id: '', quantity: 1 }); 
             toast({ title: "Ítem Añadido (Temporalmente)", description: `"${productToAdd.name}" listo para guardar en el paquete.` });
         } catch (error) {
             console.error("[ManagePackages] Error añadiendo ítem pendiente:", error);
             toast({ variant: "destructive", title: "Error al Añadir", description: `No se pudo añadir el producto temporalmente. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsItemFormLoading(false);
         }
     };

    const handleDeletePendingItem = (localId: string) => {
         setPendingItems(prev => prev.filter(item => item.localId !== localId));
         toast({ title: "Ítem Eliminado (Temporalmente)", variant: 'destructive' });
     };

     const openOverridesDialog = (localId: string) => {
        console.log(`[openOverridesDialog] Abriendo diálogo para ítem localId: ${localId}`);
        const item = pendingItems.find(i => i.localId === localId);
        console.log(`[openOverridesDialog] Ítem encontrado:`, item ? { name: item.product_name, slots: item.modifierSlots?.length, overrides: item.modifierOverrides?.length } : 'No encontrado');
        setEditingOverridesForItemLocalId(localId);
     };

     const closeOverridesDialog = () => {
         setEditingOverridesForItemLocalId(null);
     };

    const handleSaveLocalOverride = (slotId: string, min: number, max: number) => {
        if (!editingOverridesForItemLocalId) return;
        console.log(`[handleSaveLocalOverride] Guardando override para ítem ${editingOverridesForItemLocalId}, slot ${slotId}, Min: ${min}, Max: ${max}`);
        setPendingItems(prevItems => prevItems.map(item => {
            if (item.localId === editingOverridesForItemLocalId) {
                 const existingOverrides = item.modifierOverrides || [];
                 const existingOverrideIndex = existingOverrides.findIndex(ov => ov.product_modifier_slot_id === slotId);
                 let newOverrides: PackageItemModifierSlotOverride[];
                 const slotLabel = item.modifierSlots?.find(s => s.id === slotId)?.label || 'Slot Desconocido';

                if (existingOverrideIndex > -1) {
                    newOverrides = [...existingOverrides];
                    newOverrides[existingOverrideIndex] = {
                         ...newOverrides[existingOverrideIndex],
                         min_quantity: min,
                         max_quantity: max,
                    };
                } else {
                     const newOverride: Omit<PackageItemModifierSlotOverride, 'id' | 'package_item_id' | 'product_modifier_slot_label'> = {
                         product_modifier_slot_id: slotId,
                         min_quantity: min,
                         max_quantity: max,
                    };
                    newOverrides = [...existingOverrides, newOverride as PackageItemModifierSlotOverride]; 
                }
                 toast({ title: "Regla Guardada (Temporalmente)", description: `Regla para "${slotLabel}" actualizada.` });
                return { ...item, modifierOverrides: newOverrides };
            }
            return item;
        }));
     };

     const handleDeleteLocalOverride = (slotId: string) => {
        if (!editingOverridesForItemLocalId) return;
        console.log(`[handleDeleteLocalOverride] Eliminando override para ítem ${editingOverridesForItemLocalId}, slot ${slotId}`);
        setPendingItems(prevItems => prevItems.map(item => {
            if (item.localId === editingOverridesForItemLocalId) {
                const slotLabel = item.modifierSlots?.find(s => s.id === slotId)?.label || 'Slot Desconocido';
                const updatedOverrides = (item.modifierOverrides || []).filter(ov => ov.product_modifier_slot_id !== slotId);
                 toast({ title: "Regla Eliminada (Temporalmente)", description: `Regla para "${slotLabel}" eliminada.`, variant: 'destructive' });
                 return { ...item, modifierOverrides: updatedOverrides };
            }
            return item;
        }));
     };

     const handleDeletePackage = async (id: string, name: string) => {
         setIsDeleting(id);
         try {
             await deletePackageService(id);
             toast({ title: 'Paquete Eliminado', description: `"${name}" eliminado.` });
             await onDataChange();
         } catch (error) {
              console.error("[Handler Delete Package] Error deleting package:", error);
             toast({ variant: 'destructive', title: 'Error al Eliminar Paquete', description: `No se pudo eliminar. ${error instanceof Error ? error.message : ''}` });
         } finally {
             setIsDeleting(null);
         }
     };

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
                     <ScrollArea className="h-[400px]"> {/* Altura ajustada para la lista de paquetes */}
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
                                                            <AlertDialogPrimitiveTitle>¿Estás seguro?</AlertDialogPrimitiveTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción eliminará el paquete "{pkg.name}" y todo su contenido. No se puede deshacer.
                                                            </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogPrimitiveFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeletePackage(pkg.id, pkg.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                Eliminar
                                                            </AlertDialogAction>
                                                            </AlertDialogPrimitiveFooter>
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

              <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDialog(); }}>
                 <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"> {/* Añadido overflow-hidden */}
                     <DialogHeader>
                         <DialogTitle>{editingPackage ? 'Editar Paquete' : 'Añadir Nuevo Paquete'}</DialogTitle>
                         <DialogDescription>
                            Define la información básica, añade productos y configura reglas. Guarda al final.
                        </DialogDescription>
                     </DialogHeader>

                     <ScrollArea className="flex-grow pr-6 -mr-6"> {/* ScrollArea principal */}
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
                                </form>
                            </Form>

                            <div className="space-y-4 mt-6 border-t pt-6">
                                <h4 className="text-lg font-semibold">Contenido del Paquete</h4>
                                <Form {...addItemForm}>
                                    <form onSubmit={addItemForm.handleSubmit(handleAddPendingItem)} className="flex items-end gap-2 border p-3 rounded-md bg-muted/50">
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
                                        <FormField control={addItemForm.control} name="product_id" render={({ field }) => (
                                            <FormItem className="flex-grow"> <FormLabel className="text-xs">Producto</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || '__NONE__'} disabled={!selectedCategoryId || selectedCategoryId === '__NONE__' || isItemFormLoading || productsInCategory.length === 0}>
                                                    <FormControl><SelectTrigger>
                                                        <SelectValue placeholder={isItemFormLoading ? "Cargando..." : (productsInCategory.length === 0 && selectedCategoryId && selectedCategoryId !== '__NONE__' ? "Sin productos" : "Selecciona producto")} />
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
                                        <Button type="submit" size="sm" disabled={isItemFormLoading} title="Añadir Ítem al Paquete">
                                            {isItemFormLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4" />}
                                        </Button>
                                    </form>
                                </Form>

                                <div className="h-[250px] border rounded-md"> {/* Altura ajustada para la lista de ítems */}
                                    <ScrollArea className="h-full">
                                    {console.log("[Render PendingItems] isPackageContentLoading:", isPackageContentLoading, "pendingItems.length:", pendingItems.length)}
                                    {isPackageContentLoading && editingPackage ? ( 
                                            <div className="flex justify-center items-center h-full text-muted-foreground">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando contenido del paquete...
                                            </div>
                                        ) : pendingItems.length === 0 ? (
                                            <p className="p-4 text-center text-sm text-muted-foreground">Añade productos al paquete usando el formulario de arriba.</p>
                                        ) : (
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
                     </ScrollArea>

                     <DialogFooter className="mt-auto pt-4 border-t shrink-0">
                         <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                        <Button type="button" onClick={handleFinalSave} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            {editingPackage ? 'Guardar Cambios Paquete' : 'Crear Paquete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={!!editingOverridesForItemLocalId} onOpenChange={(isOpen) => {if (!isOpen) closeOverridesDialog()}}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Configurar Modificadores para "{pendingItems.find(i => i.localId === editingOverridesForItemLocalId)?.product_name}"</DialogTitle>
                        <DialogDescription>Ajusta las reglas de selección de modificadores para este producto dentro del paquete.</DialogDescription>
                    </DialogHeader>
                     {isItemFormLoading && !pendingItems.find(i => i.localId === editingOverridesForItemLocalId)?.modifierSlots ? ( 
                        <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                    ) : (() => {
                        const currentItem = pendingItems.find(i => i.localId === editingOverridesForItemLocalId);
                        const slots = currentItem?.modifierSlots || [];
                        const overrides = currentItem?.modifierOverrides || [];
                        console.log(`[Dialog Overrides] Item: ${currentItem?.product_name}, Slots: ${slots.length}, Overrides en estado: ${overrides.length}`);

                        if (!currentItem) {
                             return <p className="text-center text-muted-foreground py-4">Error: No se encontró el ítem.</p>;
                        }
                        if (slots.length === 0) {
                            return <p className="text-center text-muted-foreground py-4">Este producto no tiene grupos modificadores configurables.</p>;
                        }

                        return (
                            <ScrollArea className="max-h-[50vh] pr-2 -mr-2">
                                <div className="space-y-4 p-1">
                                    {slots.map(slot => (
                                      <ModifierSlotOverrideEditor
                                        key={slot.id}
                                        slot={slot}
                                        currentOverride={overrides.find(ov => ov.product_modifier_slot_id === slot.id)}
                                        onSaveOverride={handleSaveLocalOverride}
                                        onDeleteOverride={handleDeleteLocalOverride}
                                        toast={toast}
                                      />
                                    ))}
                                </div>
                            </ScrollArea>
                        );
                    })()}
                     <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
         </div>
     );
};


// Nuevo componente para editar overrides de un slot
interface ModifierSlotOverrideEditorProps {
  slot: ProductModifierSlot;
  currentOverride: PackageItemModifierSlotOverride | undefined;
  onSaveOverride: (slotId: string, min: number, max: number) => void;
  onDeleteOverride: (slotId: string) => void;
  toast: ({}: any) => void; // Simplificado para el ejemplo
}

const ModifierSlotOverrideEditor: React.FC<ModifierSlotOverrideEditorProps> = ({
  slot,
  currentOverride,
  onSaveOverride,
  onDeleteOverride,
  toast
}) => {
  const initialMin = currentOverride?.min_quantity ?? slot.min_quantity;
  const initialMax = currentOverride?.max_quantity ?? slot.max_quantity;
  const isOverridden = !!currentOverride;

  const [minInput, setMinInput] = React.useState(initialMin);
  const [maxInput, setMaxInput] = React.useState(initialMax);

  React.useEffect(() => {
    setMinInput(currentOverride?.min_quantity ?? slot.min_quantity);
    setMaxInput(currentOverride?.max_quantity ?? slot.max_quantity);
  }, [currentOverride, slot.min_quantity, slot.max_quantity]);

  const handleSave = () => {
    if (maxInput < minInput) {
      toast({ variant: 'destructive', title: 'Error', description: 'Máximo no puede ser menor que Mínimo.' });
      return;
    }
    onSaveOverride(slot.id, minInput, maxInput);
  };

  return (
    <Card className={cn("p-3", isOverridden && "border-blue-500 ring-1 ring-blue-500")}>
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <Label htmlFor={`min-${slot.id}`} className="font-medium">{slot.label}</Label>
                {isOverridden && <Badge variant="outline" className="ml-2 text-blue-600 border-blue-500 text-xs px-1 py-0">
                     Regla Activa
                </Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Por defecto para este producto: Min {slot.min_quantity}, Max {slot.max_quantity}</p>
            <p className="text-xs text-muted-foreground">Configuración para este paquete:</p>
            <div className="flex items-end gap-3">
                <div className="flex-1">
                    <Label htmlFor={`min-${slot.id}`} className="text-xs">Min Requerido (Paquete)</Label>
                    <Input id={`min-${slot.id}`} type="number" min="0" value={minInput} onChange={e => setMinInput(parseInt(e.target.value, 10) || 0)} />
                </div>
                <div className="flex-1">
                    <Label htmlFor={`max-${slot.id}`} className="text-xs">Max Permitido (Paquete)</Label>
                    <Input id={`max-${slot.id}`} type="number" min="0" value={maxInput} onChange={e => setMaxInput(parseInt(e.target.value, 10) || 0)}/>
                </div>
                <div className="flex flex-col gap-1">
                    <Button
                        type="button" size="sm"
                        onClick={handleSave}
                        title="Guardar Regla"
                    >
                        <Save className="h-4 w-4"/>
                    </Button>
                    {isOverridden && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDeleteOverride(slot.id)} title="Eliminar Regla">
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    </Card>
  );
};


export default ManagePackages;
