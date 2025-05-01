'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, Edit, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { getInventoryItems, addInventoryItem, updateInventoryItemStock, deleteInventoryItem } from '@/services/inventory-service'; // Adjust path as needed
import type { InventoryItem } from '@/types/product-types'; // Adjust path as needed

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState<'pieces' | 'kg'>('pieces');
  const [newItemInitialStock, setNewItemInitialStock] = useState('');
  const [editStockValue, setEditStockValue] = useState('');
  const { toast } = useToast();

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const items = await getInventoryItems();
      setInventoryItems(items);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load inventory items.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [toast]); // Dependency array includes toast for consistency

  const handleAddItem = async () => {
    if (!newItemName || !newItemUnit || newItemInitialStock === '') {
      toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    const stock = parseFloat(newItemInitialStock);
    if (isNaN(stock) || stock < 0) {
        toast({ title: "Error", description: "Initial stock must be a non-negative number.", variant: "destructive" });
        return;
    }

    try {
      await addInventoryItem({ name: newItemName, unit: newItemUnit, initial_stock: stock });
      toast({ title: "Success", description: `${newItemName} added to inventory.` });
      setIsAddDialogOpen(false);
      setNewItemName('');
      setNewItemUnit('pieces');
      setNewItemInitialStock('');
      fetchItems(); // Refresh list
    } catch (error) {
      toast({ title: "Error", description: `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    }
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setEditStockValue(String(item.current_stock)); // Pre-fill with current stock
    setIsEditDialogOpen(true);
  };

   const handleUpdateStock = async () => {
        if (!editingItem || editStockValue === '') {
            toast({ title: "Error", description: "No item selected or stock value is empty.", variant: "destructive" });
            return;
        }
        const newStock = parseFloat(editStockValue);
         if (isNaN(newStock) || newStock < 0) {
            toast({ title: "Error", description: "Stock must be a non-negative number.", variant: "destructive" });
            return;
        }

        try {
            await updateInventoryItemStock(editingItem.id, newStock);
            toast({ title: "Success", description: `Stock for ${editingItem.name} updated.` });
            setIsEditDialogOpen(false);
            setEditingItem(null);
            setEditStockValue('');
            fetchItems(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: `Failed to update stock: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
   };

   const handleDeleteItem = async (itemId: string, itemName: string) => {
        if (!confirm(`Are you sure you want to delete "${itemName}"? This cannot be undone.`)) {
            return;
        }
        try {
            await deleteInventoryItem(itemId);
            toast({ title: "Success", description: `${itemName} deleted from inventory.` });
            fetchItems(); // Refresh list
        } catch (error) {
            toast({ title: "Error", description: `Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        }
   }


  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
          <div>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>Gestiona las existencias de tus ingredientes y productos base.</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir Nuevo Item al Inventario</DialogTitle>
                <DialogDescription>Introduce los detalles del nuevo item.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemName" className="text-right">Nombre</Label>
                  <Input id="itemName" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="col-span-3" placeholder="e.g., Alitas de Pollo, Salsa BBQ" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="itemUnit" className="text-right">Unidad</Label>
                  <Select value={newItemUnit} onValueChange={(value: 'pieces' | 'kg') => setNewItemUnit(value)}>
                     <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Seleccionar unidad" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="pieces">Piezas</SelectItem>
                        <SelectItem value="kg">Kilogramos (Kg)</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="initialStock" className="text-right">Stock Inicial</Label>
                  <Input id="initialStock" type="number" value={newItemInitialStock} onChange={(e) => setNewItemInitialStock(e.target.value)} className="col-span-3" placeholder="e.g., 100, 5.5" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddItem}>Guardar Item</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[100px]">Unidad</TableHead>
                  <TableHead className="text-right w-[120px]">Stock Inicial</TableHead>
                  <TableHead className="text-right w-[120px] text-accent font-semibold">Stock Actual</TableHead>
                  {/* <TableHead className="text-right w-[120px]">Vendido (calc.)</TableHead> */}
                  <TableHead className="text-right w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">Cargando inventario...</TableCell>
                  </TableRow>
                ) : inventoryItems.length > 0 ? (
                  inventoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="capitalize">{item.unit}</TableCell>
                      <TableCell className="text-right">{item.initial_stock.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-accent font-semibold">{item.current_stock.toLocaleString()}</TableCell>
                      {/* <TableCell className="text-right text-muted-foreground">{(item.initial_stock - item.current_stock).toLocaleString()}</TableCell> */}
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => openEditDialog(item)} title="Edit Stock">
                            <Edit className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item.id, item.name)} title="Delete Item">
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No hay items en el inventario.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

       {/* Edit Stock Dialog */}
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Stock Actual: {editingItem?.name}</DialogTitle>
                <DialogDescription>Introduce el nuevo valor del stock actual para este item.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editStock" className="text-right">Nuevo Stock ({editingItem?.unit})</Label>
                  <Input
                    id="editStock"
                    type="number"
                    value={editStockValue}
                    onChange={(e) => setEditStockValue(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., 85, 4.2"
                   />
                </div>
                <p className="text-sm text-muted-foreground col-span-4 text-center px-4">
                    Nota: Esto reemplazará el valor actual del stock. No es un ajuste.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingItem(null); }}>Cancelar</Button>
                <Button onClick={handleUpdateStock}><Save className="mr-2 h-4 w-4"/> Actualizar Stock</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  );
}
