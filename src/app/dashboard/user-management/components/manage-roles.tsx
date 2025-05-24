// src/app/dashboard/user-management/components/manage-roles.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button"; // Importación añadida
import { PlusCircle, Edit, Trash2, Loader2, Save, X, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Role, Permission } from '@/types/user-management-types';
import { addRole, updateRole, deleteRole } from '@/services/user-management-service';

const roleSchema = z.object({
    name: z.string().min(1, "Nombre del rol es requerido"),
    permission_ids: z.array(z.string()).optional(), // Los permisos son opcionales al crear/editar el nombre
});
type RoleFormValues = z.infer<typeof roleSchema>;

interface ManageRolesProps {
    initialRoles: Role[];
    allPermissions: Permission[];
    onDataChange: () => Promise<void>;
}

const ManageRoles: React.FC<ManageRolesProps> = ({ initialRoles, allPermissions, onDataChange }) => {
    const [roles, setRoles] = useState<Role[]>(initialRoles);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setRoles(initialRoles);
    }, [initialRoles]);

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleSchema),
        defaultValues: { name: '', permission_ids: [] },
    });

    const handleOpenForm = (role: Role | null = null) => {
        setEditingRole(role);
        if (role) {
            form.reset({
                name: role.name,
                permission_ids: role.permissions?.map(p => p.id) || [],
            });
        } else {
            form.reset({ name: '', permission_ids: [] });
        }
        setIsFormOpen(true);
    };

    const handleFormSubmit: SubmitHandler<RoleFormValues> = async (values) => {
        setIsSubmitting(true);
        const dataToSave = { name: values.name };
        const permissionIds = values.permission_ids || [];

        try {
            if (editingRole) {
                await updateRole(editingRole.id, dataToSave, permissionIds);
                toast({ title: "Éxito", description: "Rol actualizado." });
            } else {
                await addRole(dataToSave, permissionIds);
                toast({ title: "Éxito", description: "Rol añadido." });
            }
            setIsFormOpen(false);
            await onDataChange();
        } catch (error) {
            const action = editingRole ? 'actualizar' : 'añadir';
            toast({ variant: 'destructive', title: `Error al ${action}`, description: `No se pudo ${action} el rol. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        setIsDeleting(id);
        try {
            await deleteRole(id);
            toast({ title: "Éxito", description: `Rol "${name}" eliminado.`, variant: "destructive" });
            await onDataChange();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar el rol. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Roles y Permisos</h3>
                <Button size="sm" onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Rol
                </Button>
            </div>
            <p className="text-muted-foreground mb-4">Define roles y asigna los permisos correspondientes a cada uno.</p>
            <Card>
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre del Rol</TableHead>
                                    <TableHead>Permisos Asignados</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24">No hay roles definidos.</TableCell></TableRow>
                                ) : (
                                    roles.map(role => (
                                        <TableRow key={role.id}>
                                            <TableCell className="font-medium">{role.name}</TableCell>
                                            <TableCell>
                                                {role.permissions && role.permissions.length > 0 ?
                                                    role.permissions.map(p => <Badge key={p.id} variant="secondary" className="mr-1 mb-1 text-xs">{p.name}</Badge>)
                                                    : <span className="text-xs text-muted-foreground">Sin permisos</span>}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenForm(role)} title="Editar Rol y Permisos">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === role.id} title="Eliminar Rol">
                                                            {isDeleting === role.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará el rol "{role.name}". Los empleados con este rol lo perderán.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(role.id, role.name)} className={cn(buttonVariants({variant: "destructive"}))}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Editar Rol y Permisos' : 'Añadir Nuevo Rol'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre del Rol</FormLabel><FormControl><Input placeholder="Ej: Administrador, Cajero" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>

                            <FormField control={form.control} name="permission_ids" render={() => (
                                <FormItem>
                                    <FormLabel className="text-base">Permisos</FormLabel>
                                    <p className="text-xs text-muted-foreground mb-2">Selecciona los permisos para este rol.</p>
                                    <ScrollArea className="h-64 border rounded-md p-3">
                                        <div className="space-y-1">
                                        {allPermissions.length === 0 && <p className="text-xs text-muted-foreground">No hay permisos definidos en el sistema.</p>}
                                        {allPermissions.map(permission => (
                                            <FormField key={permission.id} control={form.control} name="permission_ids"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-1">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(permission.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...(field.value || []), permission.id])
                                                                            : field.onChange(field.value?.filter(value => value !== permission.id));
                                                                    }}
                                                                    id={`perm-${permission.id}`}
                                                                />
                                                            </FormControl>
                                                            <div className="grid gap-1.5 leading-none">
                                                                <label
                                                                    htmlFor={`perm-${permission.id}`}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                                >
                                                                    {permission.name}
                                                                </label>
                                                                {permission.description && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {permission.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </FormItem>
                                                    );
                                                }}
                                            />
                                        ))}
                                        </div>
                                    </ScrollArea>
                                    <FormMessage />
                                </FormItem>
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

export default ManageRoles;
