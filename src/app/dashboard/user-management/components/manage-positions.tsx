// src/app/dashboard/user-management/components/manage-positions.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from '@/components/ui/button'; // Importación añadida
import { PlusCircle, Edit, Trash2, Loader2, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Position } from '@/types/user-management-types';
import { addPosition, updatePosition, deletePosition } from '@/services/user-management-service';

const positionSchema = z.object({
    name: z.string().min(1, "Nombre del puesto es requerido"),
});
type PositionFormValues = z.infer<typeof positionSchema>;

interface ManagePositionsProps {
    initialPositions: Position[];
    onDataChange: () => Promise<void>;
}

const ManagePositions: React.FC<ManagePositionsProps> = ({ initialPositions, onDataChange }) => {
    const [positions, setPositions] = useState<Position[]>(initialPositions);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setPositions(initialPositions);
    }, [initialPositions]);

    const form = useForm<PositionFormValues>({
        resolver: zodResolver(positionSchema),
        defaultValues: { name: '' },
    });

    const handleOpenForm = (position: Position | null = null) => {
        setEditingPosition(position);
        if (position) {
            form.reset({ name: position.name });
        } else {
            form.reset({ name: '' });
        }
        setIsFormOpen(true);
    };

    const handleFormSubmit: SubmitHandler<PositionFormValues> = async (values) => {
        setIsSubmitting(true);
        try {
            if (editingPosition) {
                await updatePosition(editingPosition.id, values);
                toast({ title: "Éxito", description: "Puesto actualizado." });
            } else {
                await addPosition(values);
                toast({ title: "Éxito", description: "Puesto añadido." });
            }
            setIsFormOpen(false);
            await onDataChange();
        } catch (error) {
            const action = editingPosition ? 'actualizar' : 'añadir';
            toast({ variant: 'destructive', title: `Error al ${action}`, description: `No se pudo ${action} el puesto. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        setIsDeleting(id);
        try {
            await deletePosition(id);
            toast({ title: "Éxito", description: `Puesto "${name}" eliminado.`, variant: "destructive" });
            await onDataChange();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar el puesto. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Puestos</h3>
                <Button size="sm" onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Puesto
                </Button>
            </div>
             <p className="text-muted-foreground mb-4">Crea y gestiona los diferentes puestos de trabajo en tu negocio.</p>
            <Card>
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre del Puesto</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {positions.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24">No hay puestos definidos.</TableCell></TableRow>
                                ) : (
                                    positions.map(pos => (
                                        <TableRow key={pos.id}>
                                            <TableCell className="font-medium">{pos.name}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenForm(pos)} title="Editar Puesto">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === pos.id} title="Eliminar Puesto">
                                                            {isDeleting === pos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el puesto "{pos.name}". Los empleados con este puesto quedarán sin asignación.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(pos.id, pos.name)} className={cn(buttonVariants({variant: "destructive"}))}>Eliminar</AlertDialogAction></AlertDialogFooter>
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

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingPosition ? 'Editar Puesto' : 'Añadir Nuevo Puesto'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre del Puesto</FormLabel><FormControl><Input placeholder="Ej: Cajero, Cocinero" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                    Guardar
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ManagePositions;
