// src/app/dashboard/clients/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Edit, Trash2, Loader2, Save, Users2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogPrimitiveFooter, AlertDialogHeader as AlertDialogPrimitiveHeader, AlertDialogTitle as AlertDialogPrimitiveTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { getClients, addClient, updateClient, deleteClient } from '@/services/client-service';
import type { Client } from '@/types/client-types';
import { format } from 'date-fns';

const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  phone: z.string().optional().nullable(),
  email: z.string().email("Correo electrónico inválido.").optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // For delete loading state
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    },
  });

  const fetchClients = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const fetchedClients = await getClients();
      setClients(fetchedClients);
      if (showToast) {
        toast({ title: "Clientes Actualizados", description: "La lista de clientes ha sido refrescada." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error al Cargar Clientes", description: error instanceof Error ? error.message : "No se pudieron cargar los clientes." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleOpenForm = (client: Client | null = null) => {
    setEditingClient(client);
    if (client) {
      form.reset({
        name: client.name,
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || '',
      });
    } else {
      form.reset();
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, values);
        toast({ title: "Cliente Actualizado", description: `Los datos de ${values.name} han sido actualizados.` });
      } else {
        await addClient(values);
        toast({ title: "Cliente Añadido", description: `${values.name} ha sido añadido a tu cartera.` });
      }
      setIsFormOpen(false);
      fetchClients(); // Refrescar lista
    } catch (error) {
      toast({ variant: 'destructive', title: `Error al ${editingClient ? 'actualizar' : 'añadir'} cliente`, description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    setIsDeleting(clientId);
    try {
      await deleteClient(clientId);
      toast({ title: "Cliente Eliminado", description: `${clientName} ha sido eliminado.`, variant: 'destructive' });
      fetchClients();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al Eliminar', description: error instanceof Error ? error.message : 'No se pudo eliminar el cliente.' });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Users2 className="h-6 w-6 text-primary" />
              <CardTitle>Cartera de Clientes</CardTitle>
            </div>
            <CardDescription>Administra la información de tus clientes.</CardDescription>
          </div>
          <Button size="sm" onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente
          </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : clients.length > 0 ? (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell>{client.email || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{client.address || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{client.notes || '-'}</TableCell>
                      <TableCell>{format(new Date(client.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenForm(client)} title="Editar Cliente">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={isDeleting === client.id} title="Eliminar Cliente">
                              {isDeleting === client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogPrimitiveHeader>
                              <AlertDialogPrimitiveTitle>¿Confirmar Eliminación?</AlertDialogPrimitiveTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará a "{client.name}" de forma permanente. ¿Estás seguro?
                              </AlertDialogDescription>
                            </AlertDialogPrimitiveHeader>
                            <AlertDialogPrimitiveFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteClient(client.id, client.name)}
                                className={cn(buttonVariants({ variant: "destructive" }))} 
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogPrimitiveFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                      No hay clientes registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient ? `Modifica los datos de ${editingClient.name}.` : 'Introduce la información del nuevo cliente.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...form.register('phone')} />
            </div>
            <div>
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="address">Dirección</Label>
              <Textarea id="address" {...form.register('address')} />
            </div>
            <div>
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea id="notes" {...form.register('notes')} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingClient ? 'Guardar Cambios' : 'Añadir Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
