// src/scripts/seed-db.ts
import { getDb, closeDb } from '../lib/db';
import { randomUUID } from 'crypto';
import type { Category, InventoryItem, Product, Package, PackageItem, ProductModifierSlot, ProductModifierSlotOption, PackageItemModifierSlotOverride, ModifierServingStyle } from '../types/product-types';
import type { Employee, Position, Role, Permission } from '../types/user-management-types';
import type { Promotion } from '../types/promotion-types';
import type { Client } from '../types/client-types'; // Importar tipo Client

// --- Seed Data ---

const categories: Category[] = [
  { id: 'cat-alitas', name: 'Alitas', type: 'producto', imageUrl: 'https://i.pinimg.com/736x/82/2e/a7/822ea701f82eb9f0f9509b8458b08600.jpg' },
  { id: 'cat-costillas', name: 'Costillas', type: 'producto', imageUrl: 'https://picsum.photos/200/150?random=costillas' },
  { id: 'cat-salsas', name: 'Salsas', type: 'modificador', imageUrl: 'https://picsum.photos/200/150?random=salsas' },
  { id: 'cat-aderezos', name: 'Aderezos', type: 'modificador', imageUrl: 'https://picsum.photos/200/150?random=dressing' },
  { id: 'cat-bebidas', name: 'Bebidas', type: 'producto', imageUrl: 'https://picsum.photos/200/150?random=drinks' },
  { id: 'cat-acompanamientos', name: 'Acompañamientos', type: 'producto', imageUrl: 'https://picsum.photos/200/150?random=sides' },
  { id: 'cat-paquetes-ui', name: 'Paquetes (UI Group)', type: 'paquete', imageUrl: 'https://picsum.photos/200/150?random=packages' },
];

const inventoryItems: InventoryItem[] = [
    { id: 'inv-alitas', name: 'Alitas Crudas', unit: 'pieces', initial_stock: 1000, current_stock: 1000},
    { id: 'inv-costillas', name: 'Costillas Crudas', unit: 'pieces', initial_stock: 200, current_stock: 200},
    { id: 'inv-papas', name: 'Papas Fritas Congeladas', unit: 'kg', initial_stock: 50, current_stock: 50},
    { id: 'inv-refresco-lata', name: 'Refresco Lata', unit: 'pieces', initial_stock: 200, current_stock: 200 },
    { id: 'inv-zanahoria', name: 'Zanahoria', unit: 'kg', initial_stock: 10, current_stock: 10 },
    { id: 'inv-apio', name: 'Apio', unit: 'kg', initial_stock: 10, current_stock: 10 },
];

const products: Product[] = [
  // Alitas
  { id: 'prod-alitas-6', name: 'Alitas 6pz', price: 95, categoryId: 'cat-alitas', imageUrl: 'https://i.pinimg.com/736x/82/2e/a7/822ea701f82eb9f0f9509b8458b08600.jpg', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 6, is_platform_item: true, platform_commission_rate: 0.30 },
  { id: 'prod-alitas-12', name: 'Alitas 12pz', price: 180, categoryId: 'cat-alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas12', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 12 },
  { id: 'prod-alitas-18', name: 'Alitas 18pz', price: 260, categoryId: 'cat-alitas', imageUrl: 'https://picsum.photos/200/150?random=alitas18', inventory_item_id: 'inv-alitas', inventory_consumed_per_unit: 18 },
  // Costillas
  { id: 'prod-costillas-5', name: 'Costillas 5pz', price: 150, categoryId: 'cat-costillas', imageUrl: 'https://picsum.photos/200/150?random=costillas5', inventory_item_id: 'inv-costillas', inventory_consumed_per_unit: 5 },
  // Salsas (Modifiers)
  { id: 'prod-salsa-bbq', name: 'Salsa BBQ', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=bbq' },
  { id: 'prod-salsa-bufalo', name: 'Salsa Búfalo', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=bufalo' },
  { id: 'prod-salsa-mango', name: 'Salsa Mango Habanero', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=mango' },
  { id: 'prod-salsa-tamarindo', name: 'Salsa Tamarindo Chipotle', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=tamarindo' },
  { id: 'prod-salsa-valentina', name: 'Salsa Valentina', price: 0, categoryId: 'cat-salsas', imageUrl: 'https://picsum.photos/200/150?random=valentina' },
  // Aderezos (Modifiers)
  { id: 'prod-aderezo-ranch', name: 'Aderezo Ranch', price: 5, categoryId: 'cat-aderezos', imageUrl: 'https://picsum.photos/200/150?random=ranch' },
  { id: 'prod-aderezo-bluecheese', name: 'Aderezo Blue Cheese', price: 7, categoryId: 'cat-aderezos', imageUrl: 'https://picsum.photos/200/150?random=bluecheese' },
  // Bebidas
  { id: 'prod-refresco-lata', name: 'Refresco de Lata', price: 25, categoryId: 'cat-bebidas', imageUrl: 'https://picsum.photos/200/150?random=can', inventory_item_id: 'inv-refresco-lata', inventory_consumed_per_unit: 1 },
  // Acompañamientos
  { id: 'prod-papas', name: 'Papas Fritas', price: 40, categoryId: 'cat-acompanamientos', imageUrl: 'https://picsum.photos/200/150?random=fries', inventory_item_id: 'inv-papas', inventory_consumed_per_unit: 0.15 },
  { id: 'prod-verdura', name: 'Verdura (Zanahoria y Apio)', price: 20, categoryId: 'cat-acompanamientos', imageUrl: 'https://picsum.photos/200/150?random=vegetables', inventory_item_id: null }, // Consumo se manejaría por receta si es complejo
];

const modifierSlots: ProductModifierSlot[] = [
    { id: 'slot-alitas6-salsa', product_id: 'prod-alitas-6', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 2 },
    { id: 'slot-alitas12-salsa', product_id: 'prod-alitas-12', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 3 },
    { id: 'slot-alitas18-salsa', product_id: 'prod-alitas-18', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 4 },
    { id: 'slot-costillas5-salsa', product_id: 'prod-costillas-5', label: 'Elige Salsas', linked_category_id: 'cat-salsas', min_quantity: 1, max_quantity: 2 },
    { id: 'slot-alitas-aderezo', product_id: 'prod-alitas-6', label: 'Aderezo (Opcional)', linked_category_id: 'cat-aderezos', min_quantity: 0, max_quantity: 1 },
    { id: 'slot-alitas12-aderezo', product_id: 'prod-alitas-12', label: 'Aderezo (Opcional)', linked_category_id: 'cat-aderezos', min_quantity: 0, max_quantity: 2 },
];

const modifierSlotOptions: ProductModifierSlotOption[] = [
    // Para slot-alitas-aderezo (en prod-alitas-6), hacer Ranch por defecto
    { id: 'opt-alitas6-ranch', product_modifier_slot_id: 'slot-alitas-aderezo', modifier_product_id: 'prod-aderezo-ranch', is_default: true, price_adjustment: 0},
];

const packages: Package[] = [
    { id: 'pkg-pareja', name: 'Combo Pareja', price: 270, imageUrl: 'https://picsum.photos/200/150?random=pareja', category_id: 'cat-paquetes-ui' }
];

const packageItems: PackageItem[] = [
    { id: 'pkgitem-pareja-alitas', package_id: 'pkg-pareja', product_id: 'prod-alitas-6', quantity: 1, display_order: 0 },
    { id: 'pkgitem-pareja-costillas', package_id: 'pkg-pareja', product_id: 'prod-costillas-5', quantity: 1, display_order: 1 },
    { id: 'pkgitem-pareja-papas', package_id: 'pkg-pareja', product_id: 'prod-papas', quantity: 1, display_order: 2 },
    { id: 'pkgitem-pareja-bebida1', package_id: 'pkg-pareja', product_id: 'prod-refresco-lata', quantity: 1, display_order: 3 },
    { id: 'pkgitem-pareja-bebida2', package_id: 'pkg-pareja', product_id: 'prod-refresco-lata', quantity: 1, display_order: 4 },
];

const packageOverrides: PackageItemModifierSlotOverride[] = [
    { id: 'override-pareja-alitas-salsa', package_item_id: 'pkgitem-pareja-alitas', product_modifier_slot_id: 'slot-alitas6-salsa', min_quantity: 1, max_quantity: 1 },
    { id: 'override-pareja-costillas-salsa', package_item_id: 'pkgitem-pareja-costillas', product_modifier_slot_id: 'slot-costillas5-salsa', min_quantity: 1, max_quantity: 1 },
];

const modifierServingStyles: ModifierServingStyle[] = [
    { id: 'style-salsa-aparte', category_id: 'cat-salsas', label: 'Aparte', display_order: 1 },
    { id: 'style-salsa-vasito', category_id: 'cat-salsas', label: 'En Vasito', display_order: 2 },
    { id: 'style-aderezo-extra', category_id: 'cat-aderezos', label: 'Extra', display_order: 1 },
];

// --- User Management Seed Data ---
const permissions: Permission[] = [
    { id: 'perm_view_dashboard', name: 'Ver Dashboard', description: 'Permite ver la pantalla principal del dashboard.' },
    { id: 'perm_create_orders', name: 'Crear Pedidos', description: 'Permite crear y finalizar nuevos pedidos.' },
    { id: 'perm_manage_inventory', name: 'Gestionar Inventario', description: 'Permite añadir, editar y eliminar items de inventario.' },
    { id: 'perm_manage_products', name: 'Gestionar Productos', description: 'Permite gestionar categorías, productos, modificadores y paquetes.' },
    { id: 'perm_manage_clients', name: 'Gestionar Clientes', description: 'Permite administrar la cartera de clientes.' },
    { id: 'perm_manage_promotions', name: 'Gestionar Promociones', description: 'Permite crear y administrar promociones.' },
    { id: 'perm_view_reports', name: 'Ver Reportes', description: 'Permite acceder y generar reportes de ventas.' },
    { id: 'perm_manage_cash_register', name: 'Gestionar Caja', description: 'Permite iniciar y cerrar sesiones de caja.' },
    { id: 'perm_manage_users', name: 'Gestionar Usuarios', description: 'Permite administrar empleados, puestos y roles.' },
    { id: 'perm_manage_settings', name: 'Gestionar Configuración', description: 'Permite cambiar la configuración general de la aplicación.' },
];

const roles: Role[] = [
    { id: 'role_admin', name: 'Administrador' },
    { id: 'role_cashier', name: 'Cajero' },
    { id: 'role_kitchen', name: 'Cocina' },
];

const positions: Position[] = [
    { id: 'pos_manager', name: 'Gerente General' },
    { id: 'pos_cashier', name: 'Cajero Principal' },
    { id: 'pos_cook', name: 'Jefe de Cocina' },
];

const employees: Employee[] = [
    { id: 'emp_admin_user', full_name: 'Admin Principal', pin: '1234', position_id: 'pos_manager', status: 'active' },
    { id: 'emp_cashier_user', full_name: 'Cajero Uno', pin: '0000', position_id: 'pos_cashier', reports_to_employee_id: 'emp_admin_user', status: 'active' },
];

const promotions: Promotion[] = [
    {
        id: 'promo-alitas-2x1-mitad',
        name: 'Alitas 2x1 (2da a Mitad)',
        description: 'En la compra de 2 órdenes de alitas 6pz, la segunda va a mitad de precio.',
        is_active: true,
        start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(), // Hace 7 días
        end_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), // Dentro de 30 días
        days_of_week: '0,1,2,3,4,5,6', // Todos los días
        product_id: 'prod-alitas-6',
        buy_quantity: 2,
        nth_item_to_discount: 2,
        discount_percentage: 0.50
    }
];

const clients: Client[] = [
    {
        id: 'client-001',
        name: 'Cliente Mostrador',
        phone: 'N/A',
        email: 'mostrador@sichef.com',
        address: 'N/A',
        notes: 'Cliente genérico para ventas de mostrador.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'client-002',
        name: 'Juan Pérez',
        phone: '5512345678',
        email: 'juan.perez@example.com',
        address: 'Calle Falsa 123, Colonia Centro',
        notes: 'Cliente frecuente. Prefiere salsas picantes.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
];


async function seedDatabase() {
  const db = await getDb();

  try {
    console.log('Iniciando sembrado de base de datos...');
    await db.run('BEGIN TRANSACTION;');

    console.log('Limpiando datos existentes...');
    await db.run('DELETE FROM clients;');
    await db.run('DELETE FROM promotions;');
    await db.run('DELETE FROM role_permissions;');
    await db.run('DELETE FROM employee_roles;');
    await db.run('DELETE FROM employees;');
    await db.run('DELETE FROM permissions;');
    await db.run('DELETE FROM roles;');
    await db.run('DELETE FROM positions;');
    await db.run('DELETE FROM modifier_serving_styles;');
    await db.run('DELETE FROM package_item_modifier_slot_overrides;');
    await db.run('DELETE FROM product_modifier_slot_options;');
    await db.run('DELETE FROM package_items;');
    await db.run('DELETE FROM packages;');
    await db.run('DELETE FROM product_modifier_slots;');
    await db.run('DELETE FROM products;');
    await db.run('DELETE FROM inventory_items;');
    await db.run('DELETE FROM categories;');
    console.log('Datos existentes limpiados.');

    // Insert Categories
    console.log('Insertando categorías...');
    const categoryStmt = await db.prepare('INSERT INTO categories (id, name, type, imageUrl) VALUES (?, ?, ?, ?)');
    for (const category of categories) {
      await categoryStmt.run(category.id, category.name, category.type, category.imageUrl);
    }
    await categoryStmt.finalize();
    console.log(`${categories.length} categorías insertadas.`);

    // Insert Inventory Items
    console.log('Insertando items de inventario...');
    const inventoryStmt = await db.prepare('INSERT INTO inventory_items (id, name, unit, initial_stock, current_stock) VALUES (?, ?, ?, ?, ?)');
    for (const item of inventoryItems) {
        await inventoryStmt.run(item.id, item.name, item.unit, item.initial_stock, item.current_stock);
    }
    await inventoryStmt.finalize();
    console.log(`${inventoryItems.length} items de inventario insertados.`);


    // Insert Products
    console.log('Insertando productos...');
    const productStmt = await db.prepare('INSERT INTO products (id, name, price, categoryId, imageUrl, inventory_item_id, inventory_consumed_per_unit, is_platform_item, platform_commission_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const product of products) {
      await productStmt.run(
        product.id, product.name, product.price, product.categoryId,
        product.imageUrl, product.inventory_item_id, product.inventory_consumed_per_unit ?? null,
        product.is_platform_item ? 1 : 0, product.platform_commission_rate ?? 0
      );
    }
    await productStmt.finalize();
    console.log(`${products.length} productos insertados.`);

     // Insert Packages
     console.log('Insertando paquetes...');
     const packageStmt = await db.prepare('INSERT INTO packages (id, name, price, imageUrl, category_id) VALUES (?, ?, ?, ?, ?)');
     for (const pkg of packages) {
        await packageStmt.run(pkg.id, pkg.name, pkg.price, pkg.imageUrl, pkg.category_id);
     }
     await packageStmt.finalize();
     console.log(`${packages.length} paquetes insertados.`);


    // Insert Modifier Slots
    console.log('Insertando slots de modificadores de producto...');
    const slotStmt = await db.prepare('INSERT INTO product_modifier_slots (id, product_id, label, linked_category_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?, ?)');
    for (const slot of modifierSlots) {
        await slotStmt.run(slot.id, slot.product_id, slot.label, slot.linked_category_id, slot.min_quantity, slot.max_quantity);
    }
    await slotStmt.finalize();
    console.log(`${modifierSlots.length} slots de modificadores insertados.`);

    // Insert Modifier Slot Options
    console.log('Insertando opciones de slots de modificadores...');
    const slotOptionStmt = await db.prepare('INSERT INTO product_modifier_slot_options (id, product_modifier_slot_id, modifier_product_id, is_default, price_adjustment) VALUES (?, ?, ?, ?, ?)');
    for (const opt of modifierSlotOptions) {
        await slotOptionStmt.run(opt.id, opt.product_modifier_slot_id, opt.modifier_product_id, opt.is_default ? 1 : 0, opt.price_adjustment);
    }
    await slotOptionStmt.finalize();
    console.log(`${modifierSlotOptions.length} opciones de slot de modificador insertadas.`);


    // Insert Package Items
    console.log('Insertando items de paquete...');
    const packageItemStmt = await db.prepare('INSERT INTO package_items (id, package_id, product_id, quantity, display_order) VALUES (?, ?, ?, ?, ?)');
    for (const item of packageItems) {
        await packageItemStmt.run(item.id, item.package_id, item.product_id, item.quantity, item.display_order);
    }
    await packageItemStmt.finalize();
    console.log(`${packageItems.length} items de paquete insertados.`);

    // Insert Package Item Modifier Slot Overrides
    console.log('Insertando overrides de slots de modificadores de item de paquete...');
    const overrideStmt = await db.prepare('INSERT INTO package_item_modifier_slot_overrides (id, package_item_id, product_modifier_slot_id, min_quantity, max_quantity) VALUES (?, ?, ?, ?, ?)');
    for (const override of packageOverrides) {
        await overrideStmt.run(override.id, override.package_item_id, override.product_modifier_slot_id, override.min_quantity, override.max_quantity);
    }
    await overrideStmt.finalize();
    console.log(`${packageOverrides.length} overrides de paquete insertados.`);

    // Insert Modifier Serving Styles
    console.log('Insertando estilos de servicio para modificadores...');
    const servingStyleStmt = await db.prepare('INSERT INTO modifier_serving_styles (id, category_id, label, display_order) VALUES (?, ?, ?, ?)');
    for (const style of modifierServingStyles) {
        await servingStyleStmt.run(style.id, style.category_id, style.label, style.display_order);
    }
    await servingStyleStmt.finalize();
    console.log(`${modifierServingStyles.length} estilos de servicio insertados.`);

    // User Management Data
    console.log('Insertando datos de gestión de usuarios...');
    const positionStmt = await db.prepare('INSERT INTO positions (id, name) VALUES (?, ?)');
    for (const pos of positions) await positionStmt.run(pos.id, pos.name);
    await positionStmt.finalize();
    console.log(`${positions.length} puestos insertados.`);

    const roleStmt = await db.prepare('INSERT INTO roles (id, name) VALUES (?, ?)');
    for (const role of roles) await roleStmt.run(role.id, role.name);
    await roleStmt.finalize();
    console.log(`${roles.length} roles insertados.`);

    const permissionStmt = await db.prepare('INSERT INTO permissions (id, name, description) VALUES (?, ?, ?)');
    for (const perm of permissions) await permissionStmt.run(perm.id, perm.name, perm.description);
    await permissionStmt.finalize();
    console.log(`${permissions.length} permisos insertados.`);

    const employeeStmt = await db.prepare('INSERT INTO employees (id, full_name, pin, position_id, reports_to_employee_id, status) VALUES (?, ?, ?, ?, ?, ?)');
    for (const emp of employees) await employeeStmt.run(emp.id, emp.full_name, emp.pin, emp.position_id, emp.reports_to_employee_id, emp.status);
    await employeeStmt.finalize();
    console.log(`${employees.length} empleados insertados.`);

    const adminRole = roles.find(r => r.id === 'role_admin');
    if (adminRole) {
        const rolePermissionStmt = await db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
        for (const perm of permissions) {
            await rolePermissionStmt.run(adminRole.id, perm.id);
        }
        await rolePermissionStmt.finalize();
        console.log(`Todos los permisos asignados al rol "${adminRole.name}".`);
    }

    const adminEmployee = employees.find(e => e.id === 'emp_admin_user');
    if (adminEmployee && adminRole) {
        const empRoleStmt = await db.prepare('INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)');
        await empRoleStmt.run(adminEmployee.id, adminRole.id);
        await empRoleStmt.finalize();
        console.log(`Rol "${adminRole.name}" asignado al empleado "${adminEmployee.full_name}".`);
    }
    const cashierEmployee = employees.find(e => e.id === 'emp_cashier_user');
    const cashierRole = roles.find(r => r.id === 'role_cashier');
    if (cashierEmployee && cashierRole) {
        const empRoleStmt = await db.prepare('INSERT INTO employee_roles (employee_id, role_id) VALUES (?, ?)');
        await empRoleStmt.run(cashierEmployee.id, cashierRole.id);
        await empRoleStmt.finalize();
        console.log(`Rol "${cashierRole.name}" asignado al empleado "${cashierEmployee.full_name}".`);
        const cashierPerms = ['perm_create_orders', 'perm_manage_cash_register', 'perm_view_dashboard'];
        const rolePermStmt = await db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
        for (const permId of cashierPerms) {
            if (permissions.find(p => p.id === permId)) {
                 await rolePermStmt.run(cashierRole.id, permId);
            }
        }
        await rolePermStmt.finalize();
        console.log(`Permisos de cajero asignados al rol "${cashierRole.name}".`);
    }

    // Insert Promotions
    console.log('Insertando promociones...');
    const promoStmt = await db.prepare('INSERT INTO promotions (id, name, description, is_active, start_date, end_date, days_of_week, product_id, buy_quantity, nth_item_to_discount, discount_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const promo of promotions) {
        await promoStmt.run(promo.id, promo.name, promo.description, promo.is_active ? 1:0, promo.start_date, promo.end_date, promo.days_of_week, promo.product_id, promo.buy_quantity, promo.nth_item_to_discount, promo.discount_percentage);
    }
    await promoStmt.finalize();
    console.log(`${promotions.length} promociones insertadas.`);

    // Insert Clients
    console.log('Insertando clientes...');
    const clientStmt = await db.prepare('INSERT INTO clients (id, name, phone, email, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const client of clients) {
        await clientStmt.run(client.id, client.name, client.phone, client.email, client.address, client.notes, client.created_at, client.updated_at);
    }
    await clientStmt.finalize();
    console.log(`${clients.length} clientes insertados.`);


    await db.run('COMMIT;');
    console.log('Sembrado de base de datos completado exitosamente!');

  } catch (error) {
    console.error('Error durante el sembrado de base de datos:', error);
    await db.run('ROLLBACK;');
    console.log('Transacción revertida.');
  } finally {
    await closeDb();
    console.log('Conexión de base de datos cerrada.');
  }
}

seedDatabase().catch(err => {
  console.error("Error no manejado en script de sembrado:", err);
  process.exit(1);
});
