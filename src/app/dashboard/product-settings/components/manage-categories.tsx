{'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X } from 'lucide-react';
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

// Importar servicios específicos para categorías
import { addCategory as addCategoryService, updateCategory as updateCategoryService, deleteCategory as deleteCategoryService } from '@/services/product-service';
import type { Category } from '@/types/product-types';

// Esquema Zod para validación del formulario de categoría
const categorySchema = z.object({
    name: z.string().min(1, "Nombre es requerido"),
    type: z.enum(['producto', 'modificador', 'paquete'], { required_error: "Tipo es requerido" }),
    imageUrl: z.string().url("Debe ser una URL válida").optional().or(z.literal('')),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

// Props para el componente
interface ManageCategoriesProps {
    initialData: Category[];
    onDataChange: () => Promise<void>; // Callback para notificar al padre que los datos cambiaron
}

const ManageCategories: React.FC<ManageCategoriesProps> = ({ initialData, onDataChange }) => {
    const [categories, setCategories] = useState<Category[]>(initialData);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false); // Para estado de carga del form
    const [isDeleting, setIsDeleting] = useState<string | null>(null); // Para estado de carga de eliminación
    const { toast } = useToast();

    // Actualizar estado local si initialData cambia
    useEffect(() => {
        setCategories(initialData);
    }, [initialData]);

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: '', type: 'producto', imageUrl: '' },
    });

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
            await onDataChange(); // Notificar al padre para refrescar todo
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
            await onDataChange(); // Notificar al padre
             if (editingCategory?.id === id) {
                 setIsFormOpen(false); // Cerrar form si se elimina la categoría en edición
             }
        } catch (error) {
            console.error(`[ManageCategories] Error al eliminar categoría ${id}:`, error);
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar la categoría. ${error instanceof Error ? error.message : ''}` });
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

            {/* Dialogo Añadir/Editar */}
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
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
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

export default ManageCategories;
