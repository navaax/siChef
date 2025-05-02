'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Importar componentes de gestión
import ManageCategories from './components/manage-categories';
import ManageProducts from './components/manage-products';
import ManagePackages from './components/manage-packages';

// Importar servicios
import {
    getCategories,
    getProductsByCategory,
    getModifiersByCategory,
    getAllPackages,
    getAllProductList // Usar esta función para obtener productos y modificadores
} from '@/services/product-service';
import { getInventoryItems } from '@/services/inventory-service';
import type { Category, Product, Package, InventoryItem } from '@/types/product-types';

export default function ProductSettingsPage() {
    const [activeTab, setActiveTab] = useState("categories");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Estado para almacenar los datos compartidos
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]); // Almacena productos y modificadores
    const [allPackages, setAllPackages] = useState<Package[]>([]);
    const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([]);

    // Callback para recargar todos los datos
    const fetchData = useCallback(async () => {
        console.log("[ProductSettingsPage] Iniciando fetchData...");
        setIsLoading(true);
        setError(null); // Resetear error
        try {
            console.log("[ProductSettingsPage] Obteniendo categorías...");
            const fetchedCategories = await getCategories();
            console.log(`[ProductSettingsPage] Obtenidas ${fetchedCategories.length} categorías.`);
            setAllCategories(fetchedCategories);

            console.log("[ProductSettingsPage] Obteniendo items de inventario...");
            const fetchedInventory = await getInventoryItems();
            console.log(`[ProductSettingsPage] Obtenidos ${fetchedInventory.length} items de inventario.`);
            setAllInventoryItems(fetchedInventory);

            console.log("[ProductSettingsPage] Obteniendo todos los paquetes...");
            const fetchedPackages = await getAllPackages();
            console.log(`[ProductSettingsPage] Obtenidos ${fetchedPackages.length} paquetes.`);
            setAllPackages(fetchedPackages);

             console.log("[ProductSettingsPage] Obteniendo todos los productos y modificadores...");
            const productListRaw = await getAllProductList();
            // Aquí se asume que getAllProductList puede devolver productos/modificadores (itemType='product') y paquetes (itemType='package')
            const fetchedProductsAndModifiers = productListRaw.filter(item => item.itemType === 'product') as Product[];

             console.log(`[ProductSettingsPage] Obtenidos ${fetchedProductsAndModifiers.length} productos/modificadores.`);
             setAllProducts(fetchedProductsAndModifiers);


            console.log("[ProductSettingsPage] fetchData completado exitosamente.");

        } catch (err) {
            console.error("[ProductSettingsPage] Error general en fetchData:", err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al obtener datos de configuración: ${errorMessage}`);
            toast({
                variant: 'destructive',
                title: 'Error de Carga',
                description: `No se pudieron cargar todos los datos necesarios. ${errorMessage}`,
            });
        } finally {
            console.log("[ProductSettingsPage] Finalizando fetchData, isLoading=false.");
            setIsLoading(false);
        }
    }, [toast]); // toast es dependencia de useCallback

    // Ejecutar fetchData al montar el componente
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };

    // Renderizado de carga
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <span className="ml-4 text-lg text-muted-foreground">Cargando configuración...</span>
            </div>
        );
    }

    // Renderizado de error
    if (error) {
         return (
            <div className="flex items-center justify-center h-full flex-col text-center">
                <p className="text-destructive text-lg mb-4">{error}</p>
                <Button onClick={fetchData}>Intentar de Nuevo</Button>
            </div>
        );
    }

    // Renderizado principal
    return (
        <div className="flex flex-col h-full">
            <Card className="flex-grow flex flex-col shadow-md">
                <CardHeader className="pb-4 border-b">
                    <CardTitle>Ajustes de Productos y Paquetes</CardTitle>
                    <CardDescription>Administra categorías, productos, modificadores y paquetes.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow p-4 md:p-6 overflow-hidden">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
                        <TabsList className="mb-4 shrink-0">
                            <TabsTrigger value="categories">Categorías</TabsTrigger>
                            <TabsTrigger value="products">Productos / Modificadores</TabsTrigger>
                            <TabsTrigger value="packages">Paquetes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="categories" className="flex-grow overflow-auto mt-0">
                            <ManageCategories initialData={allCategories} onDataChange={fetchData} />
                        </TabsContent>
                        <TabsContent value="products" className="flex-grow overflow-auto mt-0">
                             <ManageProducts
                                categories={allCategories}
                                inventoryItems={allInventoryItems}
                                initialProducts={allProducts} // Pasar productos y modificadores
                                onDataChange={fetchData}
                            />
                        </TabsContent>
                        <TabsContent value="packages" className="flex-grow overflow-auto mt-0">
                              <ManagePackages
                                allProducts={allProducts.filter(p => p.categoryId && allCategories.find(c => c.id === p.categoryId)?.type === 'producto')} // Solo productos vendibles
                                allCategories={allCategories}
                                initialPackages={allPackages}
                                onDataChange={fetchData}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
