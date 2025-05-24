// src/types/user-management-types.ts

export interface Employee {
  id: string;
  full_name: string;
  pin?: string | null; // PIN para este sistema, no necesariamente el de login
  position_id?: string | null;
  reports_to_employee_id?: string | null; // ID de otro empleado
  status: 'active' | 'inactive';
  // Campos adicionales que se pueden obtener por JOIN
  position_name?: string;
  reports_to_name?: string;
  roles?: Role[]; // Roles asignados
}

export interface Position {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
  permissions?: Permission[]; // Permisos asignados a este rol
}

export interface Permission {
  id: string; // e.g., "manage_inventory", "view_reports"
  name: string; // e.g., "Gestionar Inventario"
  description?: string;
}

// Para la tabla de unión employee_roles
export interface EmployeeRole {
  employee_id: string;
  role_id: string;
}

// Para la tabla de unión role_permissions
export interface RolePermission {
  role_id: string;
  permission_id: string;
}
