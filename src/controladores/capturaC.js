import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";

// ==========================================
// REGISTRAR CAPTURA COMPLETA
// ==========================================
export const registrarCaptura = async (req, res) => {
    let connection = null;

    try {
        const {
            id_especie,
            id_usuario,
            peso,
            imagen_url,
            porcentaje
        } = req.body;

        if (id_especie == null || id_usuario == null || peso == null) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar id_especie, id_usuario y peso"
            });
        }

        const idEspecieFinal = Number(id_especie);
        const idUsuarioFinal = Number(id_usuario);
        const pesoFinal = Number(peso);
        const porcentajeFinal = porcentaje != null ? Number(porcentaje) : 0;

        if (!Number.isInteger(idEspecieFinal) || idEspecieFinal <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El id_especie no es válido"
            });
        }

        if (!Number.isInteger(idUsuarioFinal) || idUsuarioFinal <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El id_usuario no es válido"
            });
        }

        if (!Number.isFinite(pesoFinal) || pesoFinal <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El peso debe ser mayor a 0"
            });
        }

        if (!Number.isFinite(porcentajeFinal) || porcentajeFinal < 0 || porcentajeFinal > 100) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El porcentaje debe estar entre 0 y 100"
            });
        }

        connection = await conmysql.getConnection();
        await connection.beginTransaction();

        // 1. Validar Especie
        const [especies] = await connection.query(
            `SELECT id_especie, nombre_comun, nombre_cientifico FROM especies WHERE id_especie = ? LIMIT 1`,
            [idEspecieFinal]
        );

        if (!especies || especies.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                estado: 0,
                mensaje: "La especie indicada no existe"
            });
        }

        // 2. Validar Usuario
        const [usuarios] = await connection.query(
            `SELECT id_usuario, nombre, apellido, id_rol FROM usuarios WHERE id_usuario = ? LIMIT 1`,
            [idUsuarioFinal]
        );

        if (!usuarios || usuarios.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                estado: 0,
                mensaje: "El usuario indicado no existe"
            });
        }

        // 3. Crear Detección
        const [deteccion] = await connection.query(
            `INSERT INTO detecciones (id_especie, imagen_url, porcentaje, fecha_hora)
             VALUES (?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'))`,
            [idEspecieFinal, imagen_url || null, porcentajeFinal]
        );

        const id_deteccion = deteccion.insertId;

        // 4. Crear Captura
        const [captura] = await connection.query(
            `INSERT INTO capturas (id_deteccion, id_usuario, peso, fecha_hora, estado)
             VALUES (?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'), 1)`,
            [id_deteccion, idUsuarioFinal, pesoFinal]
        );

        const id_captura = captura.insertId;

        // 5. Crear Reporte Pendiente
        const [reporte] = await connection.query(
            `INSERT INTO reportes (id_captura, id_usuario, id_tipo_reporte, titulo, archivo_pdf, archivo_csv, fecha_generacion)
             VALUES (?, ?, NULL, NULL, 0, 0, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'))`,
            [id_captura, idUsuarioFinal]
        );

        // 6. Consultar Resultado Completo
        const [registro] = await connection.query(
            `SELECT
                c.id_captura, c.peso, c.estado,
                DATE_FORMAT(c.fecha_hora, '%Y-%m-%d') AS fecha,
                DATE_FORMAT(c.fecha_hora, '%H:%i:%s') AS hora,
                DATE_FORMAT(c.fecha_hora, '%Y-%m-%d %H:%i:%s') AS fecha_hora,
                d.id_deteccion, d.id_especie, d.imagen_url, d.porcentaje,
                e.nombre_comun AS especie, e.nombre_cientifico,
                u.id_usuario, u.nombre, u.apellido,
                CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo,
                r.id_rol, r.nombre_rol,
                rep.id_reporte, rep.id_tipo_reporte, rep.titulo, rep.archivo_pdf, rep.archivo_csv,
                DATE_FORMAT(rep.fecha_generacion, '%Y-%m-%d') AS fecha_reporte,
                DATE_FORMAT(rep.fecha_generacion, '%H:%i:%s') AS hora_reporte,
                DATE_FORMAT(rep.fecha_generacion, '%Y-%m-%d %H:%i:%s') AS fecha_generacion
            FROM capturas c
            INNER JOIN detecciones d ON c.id_deteccion = d.id_deteccion
            INNER JOIN especies e ON d.id_especie = e.id_especie
            INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
            INNER JOIN roles r ON u.id_rol = r.id_rol
            LEFT JOIN reportes rep ON c.id_captura = rep.id_captura
            WHERE c.id_captura = ?
            LIMIT 1`,
            [id_captura]
        );

        await connection.commit();
        connection.release();

        // WebSocket
        try {
            const io = getIO();
            if (io) {
                io.emit("nuevaCaptura", registro[0]);
            }
        } catch (socketError) {
            console.error("⚠️ Error enviando WebSocket:", socketError);
        }

        return res.status(201).json({
            estado: 1,
            mensaje: "Captura y reporte pendiente registrados correctamente",
            data: registro[0]
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch { }
            connection.release();
        }
        console.error("❌ Error registrarCaptura:", error);
        return res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor al registrar la captura",
            error: error.message
        });
    }
};

// ==========================================
// ANULAR CAPTURA (SI NO TIENE REPORTE/CSV/PDF)
// ==========================================
export const anularCaptura = async (req, res) => {
    let connection = null;

    try {
        const idCaptura = Number(req.params.id);
        const { id_usuario } = req.body;

        if (!Number.isInteger(idCaptura) || idCaptura <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "ID de captura no válido"
            });
        }

        connection = await conmysql.getConnection();
        await connection.beginTransaction();

        // 1. Verificar captura
        const [capturas] = await connection.query(
            `SELECT id_captura, id_usuario, estado FROM capturas WHERE id_captura = ? LIMIT 1 FOR UPDATE`,
            [idCaptura]
        );

        if (capturas.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({
                estado: 0,
                mensaje: "Captura no encontrada"
            });
        }

        const captura = capturas[0];

        if (id_usuario && Number(captura.id_usuario) !== Number(id_usuario)) {
            await connection.rollback();
            connection.release();
            return res.status(403).json({
                estado: 0,
                mensaje: "No tienes permiso para anular esta captura"
            });
        }

        if (Number(captura.estado) === 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                estado: 0,
                mensaje: "La captura ya fue anulada previamente"
            });
        }

        // 2. Verificar que no esté consolidada en reportes
        const [reportes] = await connection.query(
            `SELECT id_reporte, id_tipo_reporte, archivo_pdf, archivo_csv 
             FROM reportes 
             WHERE id_captura = ? 
             LIMIT 1 FOR UPDATE`,
            [idCaptura]
        );

        if (reportes.length > 0) {
            const rep = reportes[0];
            if (rep.id_tipo_reporte !== null || Number(rep.archivo_pdf) === 1 || Number(rep.archivo_csv) === 1) {
                await connection.rollback();
                connection.release();
                return res.status(409).json({
                    estado: 0,
                    mensaje: "No se puede anular la captura porque ya tiene un reporte, PDF o CSV generado."
                });
            }

            // Eliminar el reporte pendiente
            await connection.query(`DELETE FROM reportes WHERE id_reporte = ?`, [rep.id_reporte]);
        }

        // 3. Desactivar captura (borrado lógico)
        await connection.query(`UPDATE capturas SET estado = 0 WHERE id_captura = ?`, [idCaptura]);

        await connection.commit();
        connection.release();

        return res.status(200).json({
            estado: 1,
            mensaje: "Captura anulada correctamente",
            id_captura: idCaptura
        });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch { }
            connection.release();
        }
        console.error("❌ Error anularCaptura:", error);
        return res.status(500).json({
            estado: 0,
            mensaje: "Error interno al anular la captura",
            error: error.message
        });
    }
};