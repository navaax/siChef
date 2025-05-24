// src/app/dashboard/user-management/page.tsx
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Briefcase, ShieldCheck } from 'lucide-react';

// Importar componentes de gestión
import ManageEmployees from './components/manage-employees';
import ManagePositions from './components/manage-positions';
import ManageRoles from './components/manage-roles';

// Importar servicios
import {
    getEmployees,
    getPositions,
    getRoles,
    getAllPermissions
} from '@/services/user-management-service';
import type { Employee, Position, Role, Permission } from '@/types/user-management-types';

export default function UserManagementPage() {
    const [activeTab, setActiveTab] = useState("employees");
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    // Estados para los datos
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]); // Permisos para asignar a roles
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async (showToast = false) => {
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedEmployees, fetchedPositions, fetchedRoles, fetchedPermissions] = await Promise.all([
                getEmployees(),
                getPositions(),
                getRoles(),
                getAllPermissions()
            ]);
            setEmployees(fetchedEmployees);
            setPositions(fetchedPositions);
            setRoles(fetchedRoles);
            setPermissions(fetchedPermissions);

            if (showToast) {
                toast({ title: "Datos Actualizados", description: "La información de gestión de usuarios ha sido refrescada." });
            }
        } catch (err) {
            console.error("[UserManagementPage] Error en fetchData:", err);
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            setError(`Error al obtener datos de gestión de usuarios: ${errorMessage}`);
            toast({
                variant: 'destructive',
                title: 'Error de Carga',
                description: `No se pudieron cargar todos los datos necesarios. ${errorMessage}`,
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="ml-4 text-lg text-muted-foreground">Cargando gestión de usuarios...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full flex-col text-center">
                <p className="text-destructive text-lg mb-4">{error}</p>
                <Button onClick={() => fetchData(true)}>Intentar de Nuevo</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Card className="flex-grow flex flex-col shadow-md">
                <CardHeader className="pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" />
                        <CardTitle>Gestión de Usuarios y Permisos</CardTitle>
                    </div>
                    <CardDescription>Administra empleados, puestos, roles y sus permisos.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow p-4 md:p-6 overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className="mb-4 shrink-0">
                            <TabsTrigger value="employees"><Users className="mr-2 h-4 w-4" />Empleados</TabsTrigger>
                            <TabsTrigger value="positions"><Briefcase className="mr-2 h-4 w-4" />Puestos</TabsTrigger>
                            <TabsTrigger value="roles"><ShieldCheck className="mr-2 h-4 w-4" />Roles y Permisos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="employees" className="flex-grow overflow-auto mt-0">
                            <ManageEmployees
                                initialEmployees={employees}
                                allPositions={positions}
                                allRoles={roles}
                                onDataChange={() => fetchData(true)}
                            />
                        </TabsContent>
                        <TabsContent value="positions" className="flex-grow overflow-auto mt-0">
                            <ManagePositions
                                initialPositions={positions}
                                onDataChange={() => fetchData(true)}
                            />
                        </TabsContent>
                        <TabsContent value="roles" className="flex-grow overflow-auto mt-0">
                            <ManageRoles
                                initialRoles={roles}
                                allPermissions={permissions}
                                onDataChange={() => fetchData(true)}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
