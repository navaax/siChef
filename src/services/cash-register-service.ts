// src/services/cash-register-service.ts
'use server';

import { getDb } from '@/lib/db';
import type { CashSession, CashSessionDetail, StartCashFormData } from '@/types/cash-register-types';
import { randomUUID } from 'crypto';
import { denominations } from '@/config/denominations'; // Importar denominaciones

/**
 * Obtiene la sesión de caja activa actual (si existe).
 * @returns Una promesa que resuelve a la CashSession activa o null.
 */
export async function getActiveCashSession(): Promise<CashSession | null> {
    const db = await getDb();
    try {
        const session = await db.get<CashSession>(
            "SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY start_time DESC LIMIT 1"
        );
        console.log("[getActiveCashSession] Sesión activa encontrada:", !!session);
        return session || null;
    } catch (error) {
        console.error("[getActiveCashSession] Error buscando sesión activa:", error);
        throw new Error(`Falló la búsqueda de sesión de caja activa. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Inicia una nueva sesión de caja con el conteo inicial de denominaciones.
 * @param formData Los datos del formulario de inicio de caja.
 * @param userId El ID del usuario que inicia la sesión (opcional).
 * @returns Una promesa que resuelve a la CashSession recién creada.
 */
export async function startCashSession(formData: StartCashFormData, userId?: string): Promise<CashSession> {
    const db = await getDb();
    const sessionId = randomUUID();
    const startTime = new Date().toISOString();
    const startingCashTotal = formData.total;

    // Validar si ya hay una sesión abierta
    const existingSession = await getActiveCashSession();
    if (existingSession) {
        throw new Error("Ya existe una sesión de caja abierta.");
    }

    try {
        await db.run('BEGIN TRANSACTION;');

        // 1. Insertar la sesión principal
        const sessionQuery = `
            INSERT INTO cash_sessions (id, user_id, start_time, starting_cash, status)
            VALUES (?, ?, ?, ?, 'open')
        `;
        await db.run(sessionQuery, [sessionId, userId ?? null, startTime, startingCashTotal]);
        console.log(`[startCashSession] Sesión ${sessionId} creada.`);

        // 2. Insertar los detalles de denominación inicial
        const detailStmt = await db.prepare(
            'INSERT INTO cash_session_details (id, cash_session_id, type, denomination_value, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const denom of denominations) {
            const valueStr = String(denom.value);
            const quantity = formData.denominations[valueStr] ?? 0;
            if (quantity > 0) {
                const subtotal = denom.value * quantity;
                await detailStmt.run(randomUUID(), sessionId, 'start', denom.value, quantity, subtotal);
            }
        }
        await detailStmt.finalize();
        console.log(`[startCashSession] Detalles de denominación inicial para sesión ${sessionId} insertados.`);

        await db.run('COMMIT;');

        // Devolver la sesión creada (leerla de la BD para confirmar)
        const newSession = await db.get<CashSession>('SELECT * FROM cash_sessions WHERE id = ?', [sessionId]);
        if (!newSession) {
             throw new Error("No se pudo recuperar la sesión de caja después de crearla.");
        }
        console.log(`[startCashSession] Sesión ${sessionId} iniciada exitosamente.`);
        return newSession;

    } catch (error) {
        await db.run('ROLLBACK;');
        console.error(`[startCashSession] Error iniciando sesión de caja:`, error);
        throw new Error(`Falló al iniciar la sesión de caja. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Cierra una sesión de caja existente con los datos de fin de día.
 * (Implementación parcial - solo datos básicos por ahora)
 * @param sessionId El ID de la sesión a cerrar.
 * @param endingCash El conteo total de efectivo al final.
 * @param totalCashSales Total de ventas en efectivo calculadas para la sesión.
 * @param totalCardSales Total de ventas con tarjeta calculadas para la sesión.
 * @param expenses Gastos registrados.
 * @param tips Propinas registradas.
 * @param loanAmount Préstamos/retiros.
 * @param loanReason Motivo del préstamo/retiro.
 * @returns Una promesa que resuelve a la CashSession actualizada.
 */
export async function closeCashSession(
    sessionId: string,
    endingCash: number,
    totalCashSales: number,
    totalCardSales: number,
    expenses: number,
    tips: number,
    loanAmount: number,
    loanReason: string
    // TODO: Añadir detalles de denominación final
): Promise<CashSession> {
    const db = await getDb();
    const endTime = new Date().toISOString();

    const session = await db.get<CashSession>("SELECT * FROM cash_sessions WHERE id = ? AND status = 'open'", [sessionId]);
    if (!session) {
        throw new Error(`Sesión de caja abierta con ID ${sessionId} no encontrada.`);
    }

    const calculatedDifference = endingCash - (session.starting_cash + totalCashSales - expenses - loanAmount + tips);

    try {
        await db.run('BEGIN TRANSACTION;');

        // 1. Actualizar la sesión principal
        const updateQuery = `
            UPDATE cash_sessions
            SET
                end_time = ?,
                ending_cash = ?,
                total_cash_sales = ?,
                total_card_sales = ?,
                total_expenses = ?,
                total_tips = ?,
                loans_withdrawals_amount = ?,
                loans_withdrawals_reason = ?,
                calculated_difference = ?,
                status = 'closed'
            WHERE id = ?
        `;
        await db.run(updateQuery, [
            endTime, endingCash, totalCashSales, totalCardSales,
            expenses, tips, loanAmount, loanReason,
            calculatedDifference, sessionId
        ]);
        console.log(`[closeCashSession] Sesión ${sessionId} actualizada a estado 'closed'.`);

        // 2. TODO: Insertar detalles de denominación final
        // Similar a startCashSession, pero con type='end'

        await db.run('COMMIT;');

        // Devolver la sesión actualizada
        const updatedSession = await db.get<CashSession>('SELECT * FROM cash_sessions WHERE id = ?', [sessionId]);
        if (!updatedSession) {
            throw new Error("No se pudo recuperar la sesión de caja después de cerrarla.");
        }
        console.log(`[closeCashSession] Sesión ${sessionId} cerrada exitosamente.`);
        return updatedSession;

    } catch (error) {
        await db.run('ROLLBACK;');
        console.error(`[closeCashSession] Error cerrando sesión de caja ${sessionId}:`, error);
        throw new Error(`Falló al cerrar la sesión de caja. Error original: ${error instanceof Error ? error.message : error}`);
    }
}

// TODO: Funciones para obtener historial de sesiones, detalles de una sesión, etc.
