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
    getAllPackages,
    getAllProductList // Para obtener productos y modificadores para pasarlos
} from '@/services/product-service';
import { getInventoryItems } from '@/services/inventory-service';
import type { Category, Product, Package, InventoryItem } from '@/types/product-types';

export default function ProductSettingsPage() {
    const [activeTab, setActiveTab] = useState("categories");
    // Removed global isLoading state
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Estado para almacenar los datos compartidos
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [allProductsAndModifiers, setAllProductsAndModifiers] = useState<Product[]>([]); // Almacena productos y modificadores
    const [allPackages, setAllPackages] = useState<Package[]>([]);
    const [allInventoryItems, setAllInventoryItems] = useState<InventoryItem[]>([]);
    const [isInitialDataLoading, setIsInitialDataLoading] = useState(true); // Separate state for initial load

    // Callback para recargar todos los datos
    const fetchData = useCallback(async (showToast = false) => {
        console.log("[ProductSettingsPage] Iniciando fetchData...");
        setIsInitialDataLoading(true); // Use initial load state
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
            const fetchedProductsAndMods = productListRaw as Product[]; // Assuming getAllProductList returns combined but we filter later if needed
            console.log(`[ProductSettingsPage] Obtenidos ${fetchedProductsAndMods.length} productos/modificadores.`);
            setAllProductsAndModifiers(fetchedProductsAndMods);

            console.log("[ProductSettingsPage] fetchData completado exitosamente.");
            if (showToast) {
                toast({ title: "Datos Actualizados", description: "La información de productos ha sido refrescada." });
            }

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
            setIsInitialDataLoading(false); // Set initial load state to false
        }
    }, [toast]); // toast es dependencia de useCallback

    // Ejecutar fetchData al montar el componente
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
    };

    // Renderizado de carga inicial
    if (isInitialDataLoading) {
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
                <Button onClick={() => fetchData(true)}>Intentar de Nuevo</Button>
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

                        {/* Cada componente de contenido maneja su propio estado interno si es necesario */}
                        <TabsContent value="categories" className="flex-grow overflow-auto mt-0">
                            <ManageCategories initialData={allCategories} onDataChange={() => fetchData(true)} />
                        </TabsContent>
                        <TabsContent value="products" className="flex-grow overflow-auto mt-0">
                             <ManageProducts
                                categories={allCategories}
                                inventoryItems={allInventoryItems}
                                initialProducts={allProductsAndModifiers} // Pasar productos y modificadores
                                onDataChange={() => fetchData(true)}
                            />
                        </TabsContent>
                        <TabsContent value="packages" className="flex-grow overflow-auto mt-0">
                              <ManagePackages
                                allProducts={allProductsAndModifiers} // Pasar todos los productos para seleccionar
                                allCategories={allCategories} // Pasar todas las categorías para el selector de UI y de productos
                                initialPackages={allPackages} // Pasar los paquetes existentes
                                onDataChange={() => fetchData(true)} // Pasar la función de refresco
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}