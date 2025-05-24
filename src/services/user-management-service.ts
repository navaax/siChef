// src/services/user-management-service.ts
'use server';

import { getDb } from '@/lib/db';
import type { Employee, Position, Role, Permission, EmployeeRole, RolePermission } from '@/types/user-management-types';
import { randomUUID } from 'crypto';

// --- CRUD Empleados ---
export async function getEmployees(): Promise<Employee[]> {
  const db = await getDb();
  // Incluir nombre del puesto y a quién reporta (si existe)
  const query = `
    SELECT e.*, p.name as position_name, r.full_name as reports_to_name
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN employees r ON e.reports_to_employee_id = r.id
    ORDER BY e.full_name ASC
  `;
  const employees = await db.all<Employee[]>(query);
  // Para cada empleado, obtener sus roles
  for (const emp of employees) {
    emp.roles = await getRolesForEmployee(emp.id);
  }
  return employees;
}

export async function addEmployee(employeeData: Omit<Employee, 'id' | 'position_name' | 'reports_to_name' | 'roles'>, roleIds: string[] = []): Promise<Employee> {
  const db = await getDb();
  const newEmployee = { ...employeeData, id: randomUUID() };
  try {
    await db.run('BEGIN TRANSACTION;');
    const query = 'INSERT INTO employees (id, full_name, pin, position_id, reports_to_employee_id, status) VALUES (?, ?, ?, ?, ?, ?)';
    await db.run(query, newEmployee.id, newEmployee.full_name, newEmployee.pin, newEmployee.position_id, newEmployee.reports_to_employee_id, newEmployee.status);
    
    // Asignar roles
    for (const roleId of roleIds) {
      await assignRoleToEmployee(newEmployee.id, roleId);
    }
    await db.run('COMMIT;');
    return newEmployee;
  } catch (error) {
    await db.run('ROLLBACK;');
    console.error('[addEmployee] Error:', error);
    throw new Error(`Falló al añadir empleado. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function updateEmployee(id: string, updates: Partial<Omit<Employee, 'id' | 'position_name' | 'reports_to_name' | 'roles'>>, roleIds?: string[]): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  if (fields.length === 0 && roleIds === undefined) return;

  try {
    await db.run('BEGIN TRANSACTION;');
    if (fields.length > 0) {
      const values = Object.values(updates);
      const query = `UPDATE employees SET ${fields} WHERE id = ?`;
      const result = await db.run(query, ...values, id);
      if (result.changes === 0) throw new Error('Empleado no encontrado.');
    }

    // Actualizar roles si se proporcionan
    if (roleIds !== undefined) {
      // Eliminar roles existentes y añadir los nuevos
      await db.run('DELETE FROM employee_roles WHERE employee_id = ?', id);
      for (const roleId of roleIds) {
        await assignRoleToEmployee(id, roleId);
      }
    }
    await db.run('COMMIT;');
  } catch (error) {
    await db.run('ROLLBACK;');
    console.error(`[updateEmployee] Error actualizando empleado ${id}:`, error);
    throw new Error(`Falló al actualizar empleado. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function deleteEmployee(id: string): Promise<void> {
  const db = await getDb();
  // ON DELETE CASCADE se encargará de employee_roles y reports_to_employee_id (si está configurado así)
  try {
    const result = await db.run('DELETE FROM employees WHERE id = ?', id);
    if (result.changes === 0) throw new Error('Empleado no encontrado.');
  } catch (error) {
    console.error(`[deleteEmployee] Error eliminando empleado ${id}:`, error);
    throw new Error(`Falló al eliminar empleado. ${error instanceof Error ? error.message : ''}`);
  }
}

// --- CRUD Puestos ---
export async function getPositions(): Promise<Position[]> {
  const db = await getDb();
  return db.all<Position[]>('SELECT * FROM positions ORDER BY name ASC');
}

export async function addPosition(positionData: Omit<Position, 'id'>): Promise<Position> {
  const db = await getDb();
  const newPosition = { ...positionData, id: randomUUID() };
  try {
    await db.run('INSERT INTO positions (id, name) VALUES (?, ?)', newPosition.id, newPosition.name);
    return newPosition;
  } catch (error) {
    console.error('[addPosition] Error:', error);
    throw new Error(`Falló al añadir puesto. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function updatePosition(id: string, updates: Partial<Omit<Position, 'id'>>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  if (fields.length === 0) return;
  const values = Object.values(updates);
  try {
    const query = `UPDATE positions SET ${fields} WHERE id = ?`;
    const result = await db.run(query, ...values, id);
    if (result.changes === 0) throw new Error('Puesto no encontrado.');
  } catch (error) {
    console.error(`[updatePosition] Error actualizando puesto ${id}:`, error);
    throw new Error(`Falló al actualizar puesto. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function deletePosition(id: string): Promise<void> {
  const db = await getDb();
  // ON DELETE SET NULL en employees.position_id se encargará de las referencias
  try {
    const result = await db.run('DELETE FROM positions WHERE id = ?', id);
    if (result.changes === 0) throw new Error('Puesto no encontrado.');
  } catch (error) {
    console.error(`[deletePosition] Error eliminando puesto ${id}:`, error);
    throw new Error(`Falló al eliminar puesto. ${error instanceof Error ? error.message : ''}`);
  }
}

// --- CRUD Roles ---
export async function getRoles(): Promise<Role[]> {
  const db = await getDb();
  const roles = await db.all<Role[]>('SELECT * FROM roles ORDER BY name ASC');
  // Para cada rol, obtener sus permisos
  for (const role of roles) {
    role.permissions = await getPermissionsForRole(role.id);
  }
  return roles;
}

export async function addRole(roleData: Omit<Role, 'id' | 'permissions'>, permissionIds: string[] = []): Promise<Role> {
  const db = await getDb();
  const newRole = { ...roleData, id: randomUUID() };
  try {
    await db.run('BEGIN TRANSACTION;');
    await db.run('INSERT INTO roles (id, name) VALUES (?, ?)', newRole.id, newRole.name);
    for (const permId of permissionIds) {
      await assignPermissionToRole(newRole.id, permId);
    }
    await db.run('COMMIT;');
    return newRole;
  } catch (error) {
    await db.run('ROLLBACK;');
    console.error('[addRole] Error:', error);
    throw new Error(`Falló al añadir rol. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function updateRole(id: string, updates: Partial<Omit<Role, 'id' | 'permissions'>>, permissionIds?: string[]): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  if (fields.length === 0 && permissionIds === undefined) return;

  try {
    await db.run('BEGIN TRANSACTION;');
    if (fields.length > 0) {
      const values = Object.values(updates);
      const query = `UPDATE roles SET ${fields} WHERE id = ?`;
      const result = await db.run(query, ...values, id);
      if (result.changes === 0) throw new Error('Rol no encontrado.');
    }
    if (permissionIds !== undefined) {
      await db.run('DELETE FROM role_permissions WHERE role_id = ?', id);
      for (const permId of permissionIds) {
        await assignPermissionToRole(id, permId);
      }
    }
    await db.run('COMMIT;');
  } catch (error) {
    await db.run('ROLLBACK;');
    console.error(`[updateRole] Error actualizando rol ${id}:`, error);
    throw new Error(`Falló al actualizar rol. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function deleteRole(id: string): Promise<void> {
  const db = await getDb();
  // ON DELETE CASCADE se encargará de employee_roles y role_permissions
  try {
    const result = await db.run('DELETE FROM roles WHERE id = ?', id);
    if (result.changes === 0) throw new Error('Rol no encontrado.');
  } catch (error) {
    console.error(`[deleteRole] Error eliminando rol ${id}:`, error);
    throw new Error(`Falló al eliminar rol. ${error instanceof Error ? error.message : ''}`);
  }
}

// --- Gestión de Permisos ---
export async function getAllPermissions(): Promise<Permission[]> {
  const db = await getDb();
  return db.all<Permission[]>('SELECT * FROM permissions ORDER BY name ASC');
}

// (addPermission, updatePermission, deletePermission podrían añadirse si los permisos no son fijos)

// --- Gestión de Relaciones ---
export async function assignRoleToEmployee(employeeId: string, roleId: string): Promise<void> {
  const db = await getDb();
  try {
    await db.run('INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)', employeeId, roleId);
  } catch (error) {
    console.error(`[assignRoleToEmployee] Error asignando rol ${roleId} a empleado ${employeeId}:`, error);
    throw new Error(`Falló al asignar rol a empleado. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function removeRoleFromEmployee(employeeId: string, roleId: string): Promise<void> {
  const db = await getDb();
  try {
    await db.run('DELETE FROM employee_roles WHERE employee_id = ? AND role_id = ?', employeeId, roleId);
  } catch (error) {
    console.error(`[removeRoleFromEmployee] Error removiendo rol ${roleId} de empleado ${employeeId}:`, error);
    throw new Error(`Falló al remover rol de empleado. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function getRolesForEmployee(employeeId: string): Promise<Role[]> {
  const db = await getDb();
  const query = `
    SELECT r.* FROM roles r
    JOIN employee_roles er ON r.id = er.role_id
    WHERE er.employee_id = ?
  `;
  return db.all<Role[]>(query, employeeId);
}

export async function assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
  const db = await getDb();
  try {
    await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', roleId, permissionId);
  } catch (error) {
    console.error(`[assignPermissionToRole] Error asignando permiso ${permissionId} a rol ${roleId}:`, error);
    throw new Error(`Falló al asignar permiso a rol. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
  const db = await getDb();
  try {
    await db.run('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?', roleId, permissionId);
  } catch (error) {
    console.error(`[removePermissionFromRole] Error removiendo permiso ${permissionId} de rol ${roleId}:`, error);
    throw new Error(`Falló al remover permiso de rol. ${error instanceof Error ? error.message : ''}`);
  }
}

export async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
  const db = await getDb();
  const query = `
    SELECT p.* FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `;
  return db.all<Permission[]>(query, roleId);
}
