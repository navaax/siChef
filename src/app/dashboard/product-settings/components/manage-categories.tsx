// src/app/dashboard/product-settings/components/manage-categories.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, Settings, ListChecks } from 'lucide-react';
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

// Importar servicios y tipos
import {
    addCategory as addCategoryService,
    updateCategory as updateCategoryService,
    deleteCategory as deleteCategoryService,
    getServingStylesForCategory,
    addServingStyleToCategory,
    updateServingStyle,
    deleteServingStyle,
} from '@/services/product-service';
import type { Category, ModifierServingStyle } from '@/types/product-types';

// Esquema Zod para validación del formulario de categoría
const categorySchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    type: z.enum(['producto', 'modificador', 'paquete'], { required_error: "Tipo es requerido" }),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

// Esquema Zod para el formulario de estilo de servicio
const servingStyleSchema = z.object({
    label: z.string().min(1, "La etiqueta es requerida."),
    // display_order: z.coerce.number().int().optional(), // Podríamos añadirlo después
});
type ServingStyleFormValues = z.infer<typeof servingStyleSchema>;

// Props para el componente
interface ManageCategoriesProps {
    initialData: Category[];
    onDataChange: () => Promise<void>; // Callback para notificar al padre que los datos cambiaron
}

const ManageCategories: React.FC<ManageCategoriesProps> = ({ initialData, onDataChange }) => {
    const [categories, setCategories] = useState<Category[]>(initialData);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    // Estado para gestionar estilos de servicio
    const [isServingStyleDialogOpen, setIsServingStyleDialogOpen] = useState(false);
    const [currentCategoryForServingStyles, setCurrentCategoryForServingStyles] = useState<Category | null>(null);
    const [servingStyles, setServingStyles] = useState<ModifierServingStyle[]>([]);
    const [editingServingStyle, setEditingServingStyle] = useState<ModifierServingStyle | null>(null);
    const [isServingStyleSubmitting, setIsServingStyleSubmitting] = useState(false);

    useEffect(() => {
        setCategories(initialData);
    }, [initialData]);

    const categoryForm = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '', type: 'producto', imageUrl: '' },
    });

    const servingStyleForm = useForm<ServingStyleFormValues>({
        resolver: zodResolver(servingStyleSchema),
        defaultValues: { label: '' },
    });

    const handleOpenCategoryForm = (category: Category | null = null) => {
        setEditingCategory(category);
        if (category) {
            categoryForm.reset(category);
        } else {
            categoryForm.reset({ name: '', type: 'producto', imageUrl: '' });
        }
        setIsFormOpen(true);
    };

    const handleCategoryFormSubmit: SubmitHandler<CategoryFormValues> = async (values) => {
        setIsSubmitting(true);
        try {
            if (editingCategory) {
                await updateCategoryService(editingCategory.id, values);
                toast({ title: "Éxito", description: "Categoría actualizada." });
            } else {
                await addCategoryService(values);
                toast({ title: "Éxito", description: "Categoría añadida." });
            }
            setIsFormOpen(false);
            await onDataChange();
        } catch (error) {
            const action = editingCategory ? 'actualizar' : 'añadir';
            console.error(`[ManageCategories] Error al ${action} categoría:`, error);
            toast({ variant: 'destructive', title: `Error al ${action}`, description: `No se pudo ${action} la categoría. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        setIsDeleting(id);
        try {
            await deleteCategoryService(id);
            toast({ title: "Éxito", description: `Categoría "${name}" eliminada.`, variant: "destructive" });
            await onDataChange();
             if (editingCategory?.id === id) {
                 setIsFormOpen(false);
             }
        } catch (error) {
            console.error(`[ManageCategories] Error al eliminar categoría ${id}:`, error);
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar la categoría. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsDeleting(null);
        }
    };

    // --- Funciones para Estilos de Servicio ---
    const fetchServingStyles = async (categoryId: string) => {
        try {
            const styles = await getServingStylesForCategory(categoryId);
            setServingStyles(styles);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los estilos de servicio." });
            setServingStyles([]);
        }
    };

    const handleOpenServingStylesDialog = (category: Category) => {
        if (category.type !== 'modificador') {
            toast({ title: "Información", description: "Los estilos de servicio solo aplican a categorías de tipo 'modificador'." });
            return;
        }
        setCurrentCategoryForServingStyles(category);
        fetchServingStyles(category.id);
        setIsServingStyleDialogOpen(true);
        setEditingServingStyle(null);
        servingStyleForm.reset({label: ''});
    };

    const handleServingStyleFormSubmit: SubmitHandler<ServingStyleFormValues> = async (values) => {
        if (!currentCategoryForServingStyles) return;
        setIsServingStyleSubmitting(true);
        try {
            if (editingServingStyle) {
                await updateServingStyle(editingServingStyle.id, values);
                toast({ title: "Éxito", description: "Estilo de servicio actualizado." });
            } else {
                await addServingStyleToCategory({ ...values, category_id: currentCategoryForServingStyles.id });
                toast({ title: "Éxito", description: "Estilo de servicio añadido." });
            }
            fetchServingStyles(currentCategoryForServingStyles.id); // Refrescar lista
            setEditingServingStyle(null);
            servingStyleForm.reset({label: ''});
        } catch (error) {
            const action = editingServingStyle ? 'actualizar' : 'añadir';
            toast({ variant: 'destructive', title: `Error al ${action}`, description: `No se pudo ${action} el estilo. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsServingStyleSubmitting(false);
        }
    };

    const handleEditServingStyle = (style: ModifierServingStyle) => {
        setEditingServingStyle(style);
        servingStyleForm.reset({ label: style.label });
    };

    const handleDeleteServingStyle = async (styleId: string) => {
        if (!currentCategoryForServingStyles) return;
        setIsServingStyleSubmitting(true); // Reutilizar estado para el spinner del botón
        try {
            await deleteServingStyle(styleId);
            toast({ title: "Éxito", description: "Estilo de servicio eliminado.", variant: "destructive" });
            fetchServingStyles(currentCategoryForServingStyles.id);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar el estilo. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsServingStyleSubmitting(false);
        }
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestionar Categorías</h3>
                 <Button size="sm" onClick={() => handleOpenCategoryForm()}>
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
                                {categories.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">No hay categorías.</TableCell></TableRow>
                                ) : (
                                    categories.map(cat => (
                                        <TableRow key={cat.id}>
                                            <TableCell className="font-medium">{cat.name}</TableCell>
                                            <TableCell className="capitalize">{cat.type}</TableCell>
                                            <TableCell>
                                                {cat.imageUrl ? (
                                                    <Image src={cat.imageUrl} alt={cat.name} width={40} height={30} className="rounded object-cover" data-ai-hint="food category image" unoptimized/>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                 {cat.type === 'modificador' && (
                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenServingStylesDialog(cat)} title="Configurar Estilos de Servicio">
                                                        <ListChecks className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                 )}
                                                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenCategoryForm(cat)} title="Editar Categoría">
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
                                                        <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

            {/* Dialogo Añadir/Editar Categoría */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Añadir Nueva Categoría'}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? `Modifica los detalles de "${editingCategory.name}".` : 'Define una nueva categoría.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...categoryForm}>
                        <form onSubmit={categoryForm.handleSubmit(handleCategoryFormSubmit)} className="space-y-4">
                            <FormField control={categoryForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="e.g., Alitas, Bebidas" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={categoryForm.control} name="type" render={({ field }) => (
                                    <FormItem><FormLabel>Tipo</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="producto">Producto (items vendibles)</SelectItem>
                                                <SelectItem value="modificador">Modificador (opciones para productos)</SelectItem>
                                                <SelectItem value="paquete">Paquete (para agrupar paquetes en UI)</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={categoryForm.control} name="imageUrl" render={({ field }) => (
                                    <FormItem><FormLabel>URL de Imagen (Opcional)</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                    Guardar Cambios
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Dialogo para Estilos de Servicio */}
            <Dialog open={isServingStyleDialogOpen} onOpenChange={setIsServingStyleDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Estilos de Servicio para "{currentCategoryForServingStyles?.name}"</DialogTitle>
                        <DialogDescription>Define cómo se pueden servir los modificadores de esta categoría.</DialogDescription>
                    </DialogHeader>
                    <Form {...servingStyleForm}>
                        <form onSubmit={servingStyleForm.handleSubmit(handleServingStyleFormSubmit)} className="space-y-3 mt-2">
                            <FormField control={servingStyleForm.control} name="label" render={({ field }) => (
                                <FormItem><FormLabel>Etiqueta del Estilo</FormLabel><FormControl><Input placeholder="e.g., Aparte, En Vasito" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <Button type="submit" size="sm" disabled={isServingStyleSubmitting} className="w-full">
                                {isServingStyleSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingServingStyle ? <Save className="mr-2 h-4 w-4"/> : <PlusCircle className="mr-2 h-4 w-4"/>)}
                                {editingServingStyle ? 'Actualizar Estilo' : 'Añadir Estilo'}
                            </Button>
                            {editingServingStyle && (
                                <Button type="button" variant="outline" size="sm" onClick={() => { setEditingServingStyle(null); servingStyleForm.reset({label: ''});}} className="w-full">
                                    Cancelar Edición
                                </Button>
                            )}
                        </form>
                    </Form>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-medium mb-2">Estilos Definidos:</h4>
                    <ScrollArea className="h-[200px]">
                        {servingStyles.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No hay estilos definidos para esta categoría.</p>
                        ) : (
                            <ul className="space-y-1 text-sm">
                                {servingStyles.map(style => (
                                    <li key={style.id} className="flex justify-between items-center p-1.5 hover:bg-muted/50 rounded-md">
                                        <span>{style.label}</span>
                                        <div className="space-x-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditServingStyle(style)} title="Editar Estilo">
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteServingStyle(style.id)} title="Eliminar Estilo" disabled={isServingStyleSubmitting}>
                                                {isServingStyleSubmitting && editingServingStyle?.id !== style.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ScrollArea>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default ManageCategories;
