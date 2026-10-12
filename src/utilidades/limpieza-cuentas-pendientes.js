import { conmysql } from '../db.js';

const TAMANO_LOTE = 200;
const INTERVALO_LIMPIEZA_MS = 60 * 1000;

export async function limpiarCuentasPendientesVencidas() {
    const conexion = await conmysql.getConnection();

    try {
        await conexion.beginTransaction();

        const [solicitudesEliminadas] = await conexion.query(`
            DELETE FROM solicitudes_registro
            WHERE expira <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)
            ORDER BY expira ASC
            LIMIT ${TAMANO_LOTE}
        `);

        const [usuarios] = await conexion.query(`
            SELECT u.id_usuario
            FROM usuarios u
            WHERE u.estado = 0
              AND u.token_verificacion_correo IS NOT NULL
              AND u.verificacion_correo_expira IS NOT NULL
              AND u.verificacion_correo_expira <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)
              AND NOT EXISTS (
                  SELECT 1
                  FROM capturas c
                  WHERE c.id_usuario = u.id_usuario
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM reportes r
                  WHERE r.id_usuario = u.id_usuario
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM administrador a
                  WHERE a.id_administrador = u.id_usuario
                    AND a.id_usuario <> u.id_usuario
              )
            ORDER BY u.verificacion_correo_expira ASC
            LIMIT ${TAMANO_LOTE}
            FOR UPDATE
        `);

        if (usuarios.length === 0) {
            await conexion.commit();
            return Number(solicitudesEliminadas.affectedRows);
        }

        const ids = usuarios.map(usuario => Number(usuario.id_usuario));
        const placeholders = ids.map(() => '?').join(',');

        await conexion.query(`
            DELETE FROM administrador
            WHERE id_usuario IN (${placeholders})
        `, ids);

        const [resultado] = await conexion.query(`
            DELETE FROM usuarios
            WHERE id_usuario IN (${placeholders})
              AND estado = 0
              AND token_verificacion_correo IS NOT NULL
              AND verificacion_correo_expira <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)
        `, ids);

        await conexion.commit();
        return Number(solicitudesEliminadas.affectedRows) +
            Number(resultado.affectedRows);
    } catch (error) {
        try {
            await conexion.rollback();
        } catch {
            // Preserve the original cleanup error.
        }
        throw error;
    } finally {
        conexion.release();
    }
}

export function iniciarLimpiezaCuentasPendientes() {
    const ejecutarLimpieza = async () => {
        try {
            await limpiarCuentasPendientesVencidas();
        } catch {
            console.error('No se pudieron limpiar las cuentas de correo pendientes vencidas.');
        }
    };

    void ejecutarLimpieza();

    const temporizador = setInterval(ejecutarLimpieza, INTERVALO_LIMPIEZA_MS);
    temporizador.unref();
}
