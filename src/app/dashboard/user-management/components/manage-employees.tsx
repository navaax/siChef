// src/app/dashboard/user-management/components/manage-employees.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save, X, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Employee, Position, Role } from '@/types/user-management-types';
import { addEmployee, updateEmployee, deleteEmployee, getEmployees } from '@/services/user-management-service';

const employeeSchema = z.object({
    full_name: z.string().min(1, "Nombre completo es requerido"),
    pin: z.string().length(4, "PIN debe ser de 4 dígitos").regex(/^\d{4}$/, "PIN debe ser numérico").optional().or(z.literal('')),
    position_id: z.string().nullable().optional(),
    reports_to_employee_id: z.string().nullable().optional(),
    status: z.enum(['active', 'inactive']),
    role_ids: z.array(z.string()).min(1, "Debe seleccionar al menos un rol"),
});
type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface ManageEmployeesProps {
    initialEmployees: Employee[];
    allPositions: Position[];
    allRoles: Role[];
    onDataChange: () => Promise<void>;
}

const ManageEmployees: React.FC<ManageEmployeesProps> = ({ initialEmployees, allPositions, allRoles, onDataChange }) => {
    const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setEmployees(initialEmployees);
    }, [initialEmployees]);

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: { full_name: '', pin: '', position_id: null, reports_to_employee_id: null, status: 'active', role_ids: [] },
    });

    const handleOpenForm = (employee: Employee | null = null) => {
        setEditingEmployee(employee);
        if (employee) {
            form.reset({
                full_name: employee.full_name,
                pin: employee.pin || '',
                position_id: employee.position_id || null,
                reports_to_employee_id: employee.reports_to_employee_id || null,
                status: employee.status,
                role_ids: employee.roles?.map(r => r.id) || [],
            });
        } else {
            form.reset({ full_name: '', pin: '', position_id: null, reports_to_employee_id: null, status: 'active', role_ids: [] });
        }
        setIsFormOpen(true);
    };

    const handleFormSubmit: SubmitHandler<EmployeeFormValues> = async (values) => {
        setIsSubmitting(true);
        const dataToSave = {
            full_name: values.full_name,
            pin: values.pin || null,
            position_id: values.position_id || null,
            reports_to_employee_id: values.reports_to_employee_id || null,
            status: values.status,
        };

        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, dataToSave, values.role_ids);
                toast({ title: "Éxito", description: "Empleado actualizado." });
            } else {
                await addEmployee(dataToSave, values.role_ids);
                toast({ title: "Éxito", description: "Empleado añadido." });
            }
            setIsFormOpen(false);
            await onDataChange();
        } catch (error) {
            const action = editingEmployee ? 'actualizar' : 'añadir';
            toast({ variant: 'destructive', title: `Error al ${action}`, description: `No se pudo ${action} el empleado. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        setIsDeleting(id);
        try {
            await deleteEmployee(id);
            toast({ title: "Éxito", description: `Empleado "${name}" eliminado.`, variant: "destructive" });
            await onDataChange();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al Eliminar', description: `No se pudo eliminar el empleado. ${error instanceof Error ? error.message : ''}` });
        } finally {
            setIsDeleting(null);
        }
    };

    const getStatusVariant = (status: 'active' | 'inactive') => {
        return status === 'active' ? 'default' : 'secondary';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Empleados</h3>
                <Button size="sm" onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Añadir Empleado
                </Button>
            </div>
            <Card>
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-20rem)]"> {/* Ajustar altura según necesidad */}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre Completo</TableHead>
                                    <TableHead>Puesto</TableHead>
                                    <TableHead>Reporta a</TableHead>
                                    <TableHead>Roles</TableHead>
                                    <TableHead>PIN</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">No hay empleados.</TableCell></TableRow>
                                ) : (
                                    employees.map(emp => (
                                        <TableRow key={emp.id}>
                                            <TableCell className="font-medium">{emp.full_name}</TableCell>
                                            <TableCell>{emp.position_name || <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                            <TableCell>{emp.reports_to_name || <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                            <TableCell>
                                                {emp.roles && emp.roles.length > 0 ?
                                                    emp.roles.map(r => <Badge key={r.id} variant="outline" className="mr-1 mb-1 text-xs">{r.name}</Badge>) :
                                                    <span className="text-xs text-muted-foreground">Sin roles</span>
                                                }
                                            </TableCell>
                                            <TableCell>{emp.pin ? "****" : <span className="text-xs text-muted-foreground">N/A</span>}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(emp.status)} className="capitalize">{emp.status}</Badge></TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenForm(emp)} title="Editar Empleado">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === emp.id} title="Eliminar Empleado">
                                                            {isDeleting === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará a "{emp.full_name}". No se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(emp.id, emp.full_name)} className={cn(buttonVariants({ variant: "destructive" }))}>Eliminar</AlertDialogAction></AlertDialogFooter>
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
                        <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Añadir Nuevo Empleado'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="full_name" render={({ field }) => (
                                <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="pin" render={({ field }) => (
                                <FormItem><FormLabel>PIN (4 dígitos, opcional)</FormLabel><FormControl><Input type="password" maxLength={4} {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="position_id" render={({ field }) => (
                                <FormItem><FormLabel>Puesto</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''} >
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar puesto" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">-- Sin Puesto --</SelectItem>
                                            {allPositions.map(pos => <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="reports_to_employee_id" render={({ field }) => (
                                <FormItem><FormLabel>Reporta a (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">-- Nadie --</SelectItem>
                                            {employees.filter(e => e.id !== editingEmployee?.id).map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Estado</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="active">Activo</SelectItem>
                                            <SelectItem value="inactive">Inactivo</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="role_ids" render={() => (
                                <FormItem>
                                    <FormLabel>Roles</FormLabel>
                                    <ScrollArea className="h-32 border rounded-md p-2">
                                        {allRoles.map(role => (
                                            <FormField key={role.id} control={form.control} name="role_ids"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 py-1">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(role.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...(field.value || []), role.id])
                                                                            : field.onChange(field.value?.filter(value => value !== role.id));
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal">{role.name}</FormLabel>
                                                        </FormItem>
                                                    );
                                                }}
                                            />
                                        ))}
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

export default ManageEmployees;
