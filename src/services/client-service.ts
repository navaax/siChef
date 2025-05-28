// src/services/client-service.ts
'use server';

import { getDb } from '@/lib/db';
import type { Client } from '@/types/client-types';
import { randomUUID } from 'crypto';

/**
 * Obtiene todos los clientes.
 * @returns Una promesa que resuelve a un array de objetos Client.
 */
export async function getClients(): Promise<Client[]> {
  const db = await getDb();
  try {
    const query = 'SELECT * FROM clients ORDER BY name ASC';
    console.log(`[getClients] Query: ${query}`);
    const clients = await db.all<Client[]>(query);
    console.log(`[getClients] Encontrados ${clients.length} clientes.`);
    return clients;
  } catch (error) {
    console.error('[getClients] Error obteniendo clientes:', error);
    throw new Error(`Falló la obtención de clientes. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Obtiene un cliente por su ID.
 * @param id El ID del cliente.
 * @returns Una promesa que resuelve al objeto Client o null si no se encuentra.
 */
export async function getClientById(id: string): Promise<Client | null> {
  const db = await getDb();
  try {
    const query = 'SELECT * FROM clients WHERE id = ?';
    console.log(`[getClientById] Query: ${query}, Params: [${id}]`);
    const client = await db.get<Client>(query, id);
    console.log(`[getClientById] Cliente ${id} encontrado: ${!!client}`);
    return client || null;
  } catch (error) {
    console.error(`[getClientById] Error obteniendo cliente ${id}:`, error);
    throw new Error(`Falló la obtención del cliente ${id}. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Añade un nuevo cliente.
 * @param clientData Los datos del cliente a añadir (sin id, created_at, updated_at).
 * @returns Una promesa que resuelve al objeto Client recién creado.
 */
export async function addClient(clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
  const db = await getDb();
  const newClient = {
    ...clientData,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  try {
    const query = 'INSERT INTO clients (id, name, phone, email, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      newClient.id,
      newClient.name,
      newClient.phone || null,
      newClient.email || null,
      newClient.address || null,
      newClient.notes || null,
      newClient.created_at,
      newClient.updated_at,
    ];
    console.log(`[addClient] Query: ${query}, Params: ${JSON.stringify(params)}`);
    await db.run(query, ...params);
    console.log(`[addClient] Cliente ${newClient.id} añadido exitosamente.`);
    return newClient;
  } catch (error) {
    console.error(`[addClient] Error añadiendo cliente ${newClient.name}:`, error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: clients.email')) {
        throw new Error('El correo electrónico proporcionado ya está registrado.');
    }
    throw new Error(`Falló al añadir cliente. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Actualiza un cliente existente.
 * @param id El ID del cliente a actualizar.
 * @param updates Los campos a actualizar.
 */
export async function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
  const db = await getDb();
  
  // Asegurar que updated_at se actualice
  const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };

  const fields = Object.keys(updatesWithTimestamp).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updatesWithTimestamp);

  if (fields.length === 0) return; 

  try {
    const query = `UPDATE clients SET ${fields} WHERE id = ?`;
    const params = [...values, id];
    console.log(`[updateClient] Query: ${query}, Params: ${JSON.stringify(params)}`);
    const result = await db.run(query, ...params);
    if (result.changes === 0) throw new Error(`Cliente con id ${id} no encontrado.`);
    console.log(`[updateClient] Cliente ${id} actualizado exitosamente.`);
  } catch (error) {
    console.error(`[updateClient] Error actualizando cliente ${id}:`, error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: clients.email')) {
        throw new Error('El correo electrónico proporcionado ya está registrado para otro cliente.');
    }
    throw new Error(`Falló al actualizar cliente. Error original: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Elimina un cliente.
 * @param id El ID del cliente a eliminar.
 */
export async function deleteClient(id: string): Promise<void> {
  const db = await getDb();
  try {
    const query = 'DELETE FROM clients WHERE id = ?';
    console.log(`[deleteClient] Query: ${query}, Params: [${id}]`);
    const result = await db.run(query, id);
    if (result.changes === 0) throw new Error(`Cliente con id ${id} no encontrado.`);
    console.log(`[deleteClient] Cliente ${id} eliminado exitosamente.`);
  } catch (error) {
    console.error(`[deleteClient] Error eliminando cliente ${id}:`, error);
    throw new Error(`Falló al eliminar cliente. Error original: ${error instanceof Error ? error.message : error}`);
  }
}
