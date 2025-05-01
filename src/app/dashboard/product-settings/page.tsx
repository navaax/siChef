// src/app/dashboard/product-settings/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
// Import other necessary components: Input, Select, Table, Dialog, etc.
// Import services for categories, products, packages, modifierslots, overrides
// import { getCategories, addCategory, updateCategory, deleteCategory, ... } from '@/services/product-service';
// import { getInventoryItems } from '@/services/inventory-service';

// --- Placeholder Components ---

const ManageCategories = () => {
     // TODO:
     // - Fetch categories using getCategories()
     // - Display in a table (ID, Name, Type, ImageUrl)
     // - Implement Add/Edit/Delete dialogs
     //   - Add/Edit: Name, Type (Select: producto, modificador, paquete), ImageUrl (Input)
     //   - Delete: Confirmation dialog
     // - Use react-hook-form and zod for validation
     // - Show toasts on success/error
     return (
        <div>
            <h3 className="text-xl font-semibold mb-4">Gestionar Categorías</h3>
            <p className="text-muted-foreground">Aquí podrás añadir, editar o eliminar categorías. Define si una categoría contiene productos regulares, modificadores (como salsas o extras) o paquetes.</p>
            {/* Placeholder for Table and Dialogs */}
            <div className="mt-4 border rounded-lg p-4 bg-muted/50">
                [Tabla de Categorías y Botones de Acción irán aquí]
            </div>
        </div>
     )
};

const ManageProducts = () => {
    // TODO:
    // - Fetch products (excluding packages) using getProductsByCategory() grouped by category or a flat list with category name
    // - Fetch categories (for dropdowns)
    // - Fetch inventory items (for dropdowns)
    // - Display products in a table (Name, Category, Price, Inventory Item, Consumption, ImageUrl)
    // - Implement Add/Edit/Delete dialogs for Products
    //   - Add/Edit: Name, Price, Category (Select - filter out 'paquete' type?), ImageUrl, Inventory Item (Select - optional), Inventory Consumed (Input - numeric)
    //   - Delete: Confirmation dialog
    // - Implement Modifier Slot management within Add/Edit Product Dialog
    //   - Fetch modifier slots for the product being edited (getModifierSlotsForProduct)
    //   - Display slots in a list/table (Label, Linked Category, Min, Max)
    //   - Implement Add/Edit/Delete for slots
    //     - Add/Edit Slot: Label (Input), Linked Category (Select - filter for 'modificador' type?), Min Qty (Input - numeric), Max Qty (Input - numeric)
    // - Use react-hook-form and zod
    // - Show toasts
    return (
        <div>
             <h3 className="text-xl font-semibold mb-4">Gestionar Productos</h3>
             <p className="text-muted-foreground">Define los productos individuales que vendes, asigna precios, vincula inventario (opcional) y configura qué modificadores pueden aplicarse.</p>
              {/* Placeholder for Table and Dialogs */}
            <div className="mt-4 border rounded-lg p-4 bg-muted/50">
                [Tabla de Productos y Botones de Acción irán aquí]
                 <div className="mt-4 border-t pt-4">
                    <h4 className="font-medium">Gestión de Modificadores (por Producto):</h4>
                    <p className="text-sm text-muted-foreground">Dentro de la edición de cada producto, podrás definir "slots" (espacios) para modificadores. Por ejemplo, un producto "Alitas" puede tener un slot "Elige Salsas" vinculado a la categoría "Salsas", permitiendo seleccionar 2 opciones.</p>
                    [UI para gestionar slots dentro del diálogo de producto irá aquí]
                 </div>
            </div>
        </div>
    );
};

const ManagePackages = () => {
    // TODO:
    // - Fetch packages (products of type 'paquete') using getPackagesByCategory() or getCategories('paquete') -> getProductsByCategory()
    // - Fetch categories and products (for dropdowns when adding items to package)
    // - Display packages in a table (Name, Price, Category, ImageUrl)
    // - Implement Add/Edit/Delete dialogs for Packages
    //   - Add/Edit: Name, Price, Category (Select - should likely be the 'paquete' category), ImageUrl
    //   - Delete: Confirmation dialog
    // - Implement Package Item management within Add/Edit Package Dialog
    //   - Fetch items for the package being edited (getItemsForPackage)
    //   - Display items in a list/table (Product Name, Qty)
    //   - Implement Add/Edit/Delete for package items
    //     - Add/Edit Item: Product (Select), Quantity (Input - numeric)
    // - Implement Modifier Override management for each Package Item within Add/Edit Package Dialog
    //   - For a selected package item, fetch its base product's modifier slots (getModifierSlotsForProduct)
    //   - Fetch existing overrides for this specific package item (getOverridesForPackageItem)
    //   - Display the slots, showing default min/max and allowing override inputs
    //   - Save overrides (new table: package_item_modifier_slot_overrides)
    // - Use react-hook-form and zod
    // - Show toasts
     return (
        <div>
             <h3 className="text-xl font-semibold mb-4">Gestionar Paquetes</h3>
              <p className="text-muted-foreground">Crea y edita paquetes (combos). Añade productos existentes al paquete y personaliza las reglas de los modificadores para cada producto dentro del paquete.</p>
              {/* Placeholder for Table and Dialogs */}
            <div className="mt-4 border rounded-lg p-4 bg-muted/50">
                 [Tabla de Paquetes y Botones de Acción irán aquí]
                 <div className="mt-4 border-t pt-4">
                     <h4 className="font-medium">Gestión de Contenido y Modificadores (por Paquete):</h4>
                    <p className="text-sm text-muted-foreground">Dentro de la edición de cada paquete:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground ml-4">
                        <li>Añade o quita productos que forman parte del paquete.</li>
                        <li>Para cada producto dentro del paquete, puedes ajustar cuántos modificadores se permiten (ej. el "Combo Pareja" incluye "Alitas 6pz", pero solo permite elegir 1 salsa en lugar de las 2 por defecto).</li>
                     </ul>
                     [UI para gestionar items y overrides de modificadores dentro del diálogo de paquete irá aquí]
                 </div>
            </div>
        </div>
     );
};

export default function ProductSettingsPage() {
  const [activeTab, setActiveTab] = useState("products");

  // Fetch necessary data (categories, products, packages) on load
  useEffect(() => {
    // TODO: Fetch initial data needed for the default tab (e.g., products and categories)
     console.log(`Loading data for tab: ${activeTab}`);
     // Example: Fetch categories for dropdowns regardless of tab
     // getCategories().then(setAllCategories);
  }, [activeTab]); // Refetch or filter data when tab changes

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-grow flex flex-col shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div>
            <CardTitle>Ajustes de Productos y Paquetes</CardTitle>
            <CardDescription>Administra categorías, productos, modificadores y paquetes.</CardDescription>
          </div>
           {/* Contextual Add Button based on active tab */}
           {/* TODO: Wire these buttons to open the respective Add Dialogs */}
           {activeTab === 'categories' && <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Categoría</Button>}
           {activeTab === 'products' && <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto</Button>}
           {activeTab === 'packages' && <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Añadir Paquete</Button>}
        </CardHeader>
        <CardContent className="flex-grow p-4 md:p-6 overflow-hidden"> {/* Added overflow-hidden */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <TabsList className="mb-4 shrink-0"> {/* Prevent TabsList from shrinking */}
              <TabsTrigger value="categories">Categorías</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="packages">Paquetes</TabsTrigger>
            </TabsList>
            {/* Ensure TabsContent takes remaining space and allows scrolling */}
            <TabsContent value="categories" className="flex-grow overflow-auto mt-0">
              <ManageCategories />
            </TabsContent>
            <TabsContent value="products" className="flex-grow overflow-auto mt-0">
              <ManageProducts />
            </TabsContent>
            <TabsContent value="packages" className="flex-grow overflow-auto mt-0">
              <ManagePackages />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// TODO: Implement the actual UI and logic for each management section.
// - Use shadcn components (Table, Dialog, Input, Select, Button, etc.)
// - Integrate with backend services (product-service, inventory-service)
// - Add state management for forms and fetched data (useState, useEffect, potentially context or Zustand for complex state)
// - Implement form handling (react-hook-form) and validation (zod)
// - Provide user feedback with toasts (useToast)
