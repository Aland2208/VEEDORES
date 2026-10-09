import { conmysql } from '../db.js';

/* BUSCAR ADMINISTRADOR POR CORREO */
export const buscarAdministradorPorCorreo = async (req, res) => {
    try {
        const correo = String(req.query.correo || '').trim().toLowerCase();

        if (!correo) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'El correo electrónico es obligatorio.'
            });
        }

        const [administradores] = await conmysql.query(`
            SELECT
                id_usuario,
                nombre,
                apellido,
                correo
            FROM usuarios
            WHERE LOWER(correo)=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `, [correo]);

        if (administradores.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'No se encontró un administrador con este correo.'
            });
        }

        return res.status(200).json({
            estado: 1,
            mensaje: 'Administrador encontrado.',
            data: administradores[0]
        });
    } catch (error) {
        console.error('❌ Error buscarAdministradorPorCorreo:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al buscar el administrador.'
        });
    }
};

/* OBTENER ADMINISTRADOR ACTUAL DEL OBSERVADOR */
export const getAdministradorActual = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario no válido.'
            });
        }

        const [resultado] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.fecha_inicio,
                u.nombre,
                u.apellido,
                u.correo
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_administrador
            WHERE a.id_usuario=?
              AND a.fecha_fin IS NULL
              AND u.id_rol=1
              AND u.estado=1
            LIMIT 1
        `, [idUsuario]);

        if (resultado.length === 0) {
            return res.status(200).json({
                estado: 1,
                vinculado: false,
                mensaje: 'El usuario no tiene un administrador vinculado.',
                data: null
            });
        }

        return res.status(200).json({
            estado: 1,
            vinculado: true,
            mensaje: 'Administrador actual obtenido correctamente.',
            data: resultado[0]
        });
    } catch (error) {
        console.error('❌ Error getAdministradorActual:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al obtener el administrador actual.'
        });
    }
};

/* OBTENER OBSERVADORES ACTUALES DE UN ADMINISTRADOR */
export const getUsuariosAdministrador = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Administrador no válido.'
            });
        }

        const [usuarios] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                u.fecha_creacion,
                a.fecha_inicio
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_usuario
            WHERE a.id_administrador=?
              AND a.fecha_fin IS NULL
              AND u.id_rol=2
            ORDER BY u.nombre ASC,u.apellido ASC
        `, [idAdministrador]);

        return res.status(200).json({
            estado: 1,
            mensaje: 'Usuarios obtenidos correctamente.',
            data: usuarios
        });
    } catch (error) {
        console.error('❌ Error getUsuariosAdministrador:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al obtener los usuarios del administrador.'
        });
    }
};

/* OBTENER OBSERVADORES SIN ADMINISTRADOR */
export const getUsuariosDisponibles = async (req, res) => {
    try {
        const [usuarios] = await conmysql.query(`
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                u.fecha_creacion
            FROM usuarios u
            WHERE u.id_rol=2
              AND u.estado=1
              AND NOT EXISTS(
                  SELECT 1
                  FROM administrador a
                  WHERE a.id_usuario=u.id_usuario
                    AND a.fecha_fin IS NULL
              )
            ORDER BY u.nombre ASC,u.apellido ASC
        `);

        return res.status(200).json({
            estado: 1,
            mensaje: 'Usuarios disponibles obtenidos correctamente.',
            data: usuarios
        });
    } catch (error) {
        console.error('❌ Error getUsuariosDisponibles:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al obtener los usuarios disponibles.'
        });
    }
};

/* ASIGNAR OBSERVADOR A ADMINISTRADOR */
export const asignarUsuario = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.body.id_usuario);

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0 ||
            !Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Administrador o usuario no válido.'
            });
        }

        if (idAdministrador === idUsuario) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Un administrador no puede asignarse a sí mismo.'
            });
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `, [idAdministrador]);

        if (administradores.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'El administrador no existe o no está activo.'
            });
        }

        const [usuarios] = await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
              AND estado=1
            LIMIT 1
        `, [idUsuario]);

        if (usuarios.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'El observador no existe o no está activo.'
            });
        }

        const [asignaciones] = await conmysql.query(`
            SELECT
                id_asignacion,
                id_administrador
            FROM administrador
            WHERE id_usuario=?
              AND fecha_fin IS NULL
            LIMIT 1
        `, [idUsuario]);

        if (asignaciones.length > 0) {
            return res.status(409).json({
                estado: 0,
                mensaje: 'El observador ya tiene un administrador asignado.'
            });
        }

        /* HORA DE ECUADOR UTC-5 */
        const [resultado] = await conmysql.query(`
            INSERT INTO administrador(
                id_administrador,
                id_usuario,
                fecha_inicio
            )
            VALUES(
                ?,
                ?,
                DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR)
            )
        `, [idAdministrador, idUsuario]);

        return res.status(201).json({
            estado: 1,
            mensaje: 'Usuario asignado correctamente.',
            data: {
                id_asignacion: resultado.insertId,
                id_administrador: idAdministrador,
                id_usuario: idUsuario
            }
        });
    } catch (error) {
        console.error('❌ Error asignarUsuario:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al asignar el usuario.'
        });
    }
};

/* REASIGNAR OBSERVADOR A OTRO ADMINISTRADOR */
export const reasignarUsuario = async (req, res) => {
    let conexion;

    try {
        const idUsuario = Number(req.params.id_usuario);
        const idNuevoAdministrador = Number(req.body.id_administrador);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0 ||
            !Number.isInteger(idNuevoAdministrador) || idNuevoAdministrador <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario o administrador no válido.'
            });
        }

        conexion = await conmysql.getConnection();
        await conexion.beginTransaction();

        const [usuarios] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
              AND estado=1
            LIMIT 1
        `, [idUsuario]);

        if (usuarios.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                estado: 0,
                mensaje: 'El observador no existe o no está activo.'
            });
        }

        const [administradores] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `, [idNuevoAdministrador]);

        if (administradores.length === 0) {
            await conexion.rollback();

            return res.status(404).json({
                estado: 0,
                mensaje: 'El nuevo administrador no existe o no está activo.'
            });
        }

        const [actual] = await conexion.query(`
            SELECT
                id_asignacion,
                id_administrador
            FROM administrador
            WHERE id_usuario=?
              AND fecha_fin IS NULL
            FOR UPDATE
        `, [idUsuario]);

        if (
            actual.length > 0 &&
            Number(actual[0].id_administrador) === idNuevoAdministrador
        ) {
            await conexion.rollback();

            return res.status(409).json({
                estado: 0,
                mensaje: 'El usuario ya pertenece a este administrador.'
            });
        }

        const [fecha] = await conexion.query(`
            SELECT
                DATE_SUB(
                    UTC_TIMESTAMP(),
                    INTERVAL 5 HOUR
                ) AS fecha_cambio
        `);

        const fechaCambio = fecha[0].fecha_cambio;

        /* CERRAR ASIGNACIÓN ANTERIOR */
        if (actual.length > 0) {
            await conexion.query(`
                UPDATE administrador
                SET fecha_fin=?
                WHERE id_asignacion=?
            `, [fechaCambio, actual[0].id_asignacion]);
        }

        /* CREAR NUEVA ASIGNACIÓN */
        const [resultado] = await conexion.query(`
            INSERT INTO administrador(
                id_administrador,
                id_usuario,
                fecha_inicio
            )
            VALUES(?,?,?)
        `, [idNuevoAdministrador, idUsuario, fechaCambio]);

        await conexion.commit();

        return res.status(200).json({
            estado: 1,
            mensaje: 'Usuario reasignado correctamente.',
            data: {
                id_asignacion: resultado.insertId,
                id_administrador: idNuevoAdministrador,
                id_usuario: idUsuario
            }
        });
    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error('❌ Error reasignarUsuario:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al reasignar el usuario.'
        });
    } finally {
        if (conexion) {
            conexion.release();
        }
    }
};

/* FINALIZAR ASIGNACIÓN ACTUAL */
export const quitarUsuarioAdministrador = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0 ||
            !Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Administrador o usuario no válido.'
            });
        }

        const [resultado] = await conmysql.query(`
            UPDATE administrador
            SET fecha_fin=
                DATE_SUB(
                    UTC_TIMESTAMP(),
                    INTERVAL 5 HOUR
                )
            WHERE id_administrador=?
              AND id_usuario=?
              AND fecha_fin IS NULL
        `, [idAdministrador, idUsuario]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'No existe una asignación activa para este usuario.'
            });
        }

        return res.status(200).json({
            estado: 1,
            mensaje: 'Asignación finalizada correctamente.'
        });
    } catch (error) {
        console.error('❌ Error quitarUsuarioAdministrador:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al finalizar la asignación.'
        });
    }
};

/* HISTORIAL DE ADMINISTRADORES DE UN OBSERVADOR */
export const getHistorialUsuario = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario no válido.'
            });
        }

        const [historial] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,
                CONCAT(
                    u.nombre,
                    ' ',
                    u.apellido
                ) AS administrador,
                a.fecha_inicio,
                a.fecha_fin,
                CASE
                    WHEN a.fecha_fin IS NULL
                    THEN 'Activo'
                    ELSE 'Finalizado'
                END AS estado_asignacion
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_administrador
            WHERE a.id_usuario=?
            ORDER BY a.fecha_inicio DESC
        `, [idUsuario]);

        return res.status(200).json({
            estado: 1,
            mensaje: 'Historial obtenido correctamente.',
            data: historial
        });
    } catch (error) {
        console.error('❌ Error getHistorialUsuario:', error);

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error al obtener el historial.'
        });
    }
};

/* HISTORIAL - VEEDORES RELACIONADOS CON ADMINISTRADOR */
export const getVeedoresHistorial = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Administrador no válido"
            });
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario,nombre,apellido,correo
            FROM usuarios
            WHERE id_usuario=? AND id_rol=1
            LIMIT 1
        `, [idAdministrador]);

        if (administradores.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Administrador no encontrado"
            });
        }

        const [veedores] = await conmysql.query(`
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                COUNT(DISTINCT rep.id_reporte) AS total_reportes,
                COUNT(DISTINCT CASE
                    WHEN rep.id_tipo_reporte IS NOT NULL
                     AND rep.titulo IS NOT NULL
                     AND TRIM(rep.titulo)<>''
                    THEN rep.id_reporte
                END) AS reportes_completos,
                COUNT(DISTINCT CASE
                    WHEN rep.id_reporte IS NOT NULL
                     AND (
                       rep.id_tipo_reporte IS NULL
                       OR rep.titulo IS NULL
                       OR TRIM(rep.titulo)=''
                     )
                    THEN rep.id_reporte
                END) AS reportes_incompletos,
                MAX(
                    CASE
                        WHEN a.fecha_fin IS NULL THEN 1
                        ELSE 0
                    END
                ) AS relacion_actual,
                MIN(a.fecha_inicio) AS primera_asignacion,
                MAX(a.fecha_fin) AS ultima_fecha_fin
            FROM administrador a
            INNER JOIN usuarios u
                ON a.id_usuario=u.id_usuario
            LEFT JOIN reportes rep
                ON rep.id_usuario=u.id_usuario
                AND rep.fecha_generacion>=a.fecha_inicio
                AND (
                    a.fecha_fin IS NULL
                    OR rep.fecha_generacion<a.fecha_fin
                )
            WHERE a.id_administrador=?
              AND u.id_rol=2
            GROUP BY
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado
            ORDER BY
                relacion_actual DESC,
                u.nombre ASC,
                u.apellido ASC
        `, [idAdministrador]);

        return res.status(200).json({
            estado: 1,
            mensaje: "Veedores del historial obtenidos correctamente",
            administrador: administradores[0],
            cantidad: veedores.length,
            data: veedores
        });
    } catch (error) {
        console.error("❌ Error getVeedoresHistorial:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error al obtener el historial de veedores",
            error: error.message
        });
    }
};

/* HISTORIAL - REPORTES DE UN VEEDOR */
export const getReportesHistorialVeedor = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Administrador no válido"
            });
        }

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Veedor no válido"
            });
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario,nombre,apellido,correo
            FROM usuarios
            WHERE id_usuario=? AND id_rol=1
            LIMIT 1
        `, [idAdministrador]);

        if (administradores.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Administrador no encontrado"
            });
        }

        const [relaciones] = await conmysql.query(`
            SELECT id_asignacion
            FROM administrador
            WHERE id_administrador=?
              AND id_usuario=?
            LIMIT 1
        `, [idAdministrador, idUsuario]);

        if (relaciones.length === 0) {
            return res.status(403).json({
                estado: 0,
                mensaje: "El veedor no pertenece ni ha pertenecido a este administrador"
            });
        }

        const [veedores] = await conmysql.query(`
            SELECT id_usuario,nombre,apellido,correo,estado
            FROM usuarios
            WHERE id_usuario=? AND id_rol=2
            LIMIT 1
        `, [idUsuario]);

        if (veedores.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Veedor no encontrado"
            });
        }

        const [reportes] = await conmysql.query(`
            SELECT DISTINCT
                rep.id_reporte,
                rep.id_captura,
                rep.id_usuario,
                rep.id_tipo_reporte,
                rep.titulo,
                rep.archivo_pdf,
                rep.archivo_csv,
                DATE_FORMAT(rep.fecha_generacion,'%Y-%m-%d') AS fecha_reporte,
                DATE_FORMAT(rep.fecha_generacion,'%H:%i:%s') AS hora_reporte,
                DATE_FORMAT(rep.fecha_generacion,'%Y-%m-%d %H:%i:%s') AS fecha_generacion,
                tr.nombre_tipo,
                c.peso,
                DATE_FORMAT(c.fecha_hora,'%Y-%m-%d') AS fecha_captura,
                DATE_FORMAT(c.fecha_hora,'%H:%i:%s') AS hora_captura,
                d.id_deteccion,
                d.porcentaje,
                d.imagen_url,
                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,
                CASE
                    WHEN rep.id_tipo_reporte IS NOT NULL
                     AND rep.titulo IS NOT NULL
                     AND TRIM(rep.titulo)<>''
                    THEN 'Completo'
                    ELSE 'Incompleto'
                END AS estado_reporte
            FROM reportes rep
            INNER JOIN administrador a
                ON a.id_usuario=rep.id_usuario
            LEFT JOIN tipos_reporte tr
                ON rep.id_tipo_reporte=tr.id_tipo_reporte
            LEFT JOIN capturas c
                ON rep.id_captura=c.id_captura
            LEFT JOIN detecciones d
                ON c.id_deteccion=d.id_deteccion
            LEFT JOIN especies e
                ON d.id_especie=e.id_especie
            WHERE rep.id_usuario=?
              AND a.id_administrador=?
              AND rep.fecha_generacion>=a.fecha_inicio
              AND (
                  a.fecha_fin IS NULL
                  OR rep.fecha_generacion<a.fecha_fin
              )
            ORDER BY rep.fecha_generacion DESC
        `, [idUsuario, idAdministrador]);

        const completos = reportes.filter(
            reporte => reporte.estado_reporte === "Completo"
        ).length;

        const incompletos = reportes.filter(
            reporte => reporte.estado_reporte === "Incompleto"
        ).length;

        return res.status(200).json({
            estado: 1,
            mensaje: "Historial del veedor obtenido correctamente",
            administrador: administradores[0],
            veedor: veedores[0],
            resumen: {
                total: reportes.length,
                completos,
                incompletos
            },
            data: reportes
        });
    } catch (error) {
        console.error("❌ Error getReportesHistorialVeedor:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error al obtener los reportes del veedor",
            error: error.message
        });
    }
};

/* ======================================================
   CONFIGURAR / ACTUALIZAR URL DE CÁMARA (ADMINISTRADOR)
====================================================== */
export const guardarUrlCamaraAdmin = async (req, res) => {
    try {
        const idAdministrador = Number(req.body.id_administrador);
        let urlCamara = String(req.body.url_camara || '').trim();

        if (!Number.isInteger(idAdministrador) || idAdministrador <= 0 || !urlCamara) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'El ID del administrador y la URL son obligatorios.'
            });
        }

        urlCamara = urlCamara.replace(/\/+$/, '');

        const [admin] = await conmysql.query(
            `SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND id_rol = 1 AND estado = 1 LIMIT 1`,
            [idAdministrador]
        );

        if (admin.length === 0) {
            return res.status(403).json({
                estado: 0,
                mensaje: 'Solo un administrador activo puede configurar la cámara.'
            });
        }

        await conmysql.query(
            `INSERT INTO configuracion_camara (id_administrador, url_camara, fecha_actualizacion)
             VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR))
             ON DUPLICATE KEY UPDATE 
                url_camara = VALUES(url_camara),
                fecha_actualizacion = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)`,
            [idAdministrador, urlCamara]
        );

        return res.status(200).json({
            estado: 1,
            mensaje: 'Cámara activada para todos los veedores asignados a tu cuenta.',
            data: { url_camara: urlCamara }
        });
    } catch (error) {
        console.error('❌ Error guardarUrlCamaraAdmin:', error);
        return res.status(500).json({
            estado: 0,
            mensaje: 'Error del servidor al configurar la cámara.'
        });
    }
};

/* ======================================================
   OBTENER URL DE CÁMARA VINCULADA + VEEDORES ACTIVOS
   (Para Administrador o Veedor asignado)
====================================================== */
export const obtenerUrlCamaraVinculada = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario no válido.'
            });
        }

        // 1. Obtener datos del usuario
        const [usuario] = await conmysql.query(
            `SELECT id_usuario, id_rol FROM usuarios WHERE id_usuario = ? AND estado = 1 LIMIT 1`,
            [idUsuario]
        );

        if (usuario.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'Usuario no encontrado o inactivo.'
            });
        }

        let idAdminObjetivo = null;

        if (usuario[0].id_rol === 1) {
            // Es Administrador: busca su propia cámara
            idAdminObjetivo = usuario[0].id_usuario;
        } else {
            // Es Veedor: busca su Administrador activo en la tabla `administrador`
            const [asignacion] = await conmysql.query(
                `SELECT id_administrador 
                 FROM administrador 
                 WHERE id_usuario = ? AND fecha_fin IS NULL 
                 ORDER BY fecha_inicio DESC 
                 LIMIT 1`,
                [idUsuario]
            );

            if (asignacion.length > 0) {
                idAdminObjetivo = asignacion[0].id_administrador;
            }
        }

        if (!idAdminObjetivo) {
            return res.status(200).json({
                estado: 1,
                url_camara: null,
                veedores: [],
                total_veedores: 0,
                mensaje: 'El veedor no tiene un administrador asignado.'
            });
        }

        // 2. Consultar la URL configurada por ese Administrador
        const [config] = await conmysql.query(
            `SELECT url_camara, DATE_FORMAT(fecha_actualizacion, '%Y-%m-%d %H:%i:%s') AS fecha_actualizacion 
             FROM configuracion_camara 
             WHERE id_administrador = ? 
             LIMIT 1`,
            [idAdminObjetivo]
        );

        // 3. Consultar la lista de veedores activos vinculados a este administrador
        const [veedores] = await conmysql.query(
            `SELECT 
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado
             FROM administrador a
             INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
             WHERE a.id_administrador = ? 
               AND a.fecha_fin IS NULL 
               AND u.id_rol = 2
             ORDER BY u.nombre ASC, u.apellido ASC`,
            [idAdminObjetivo]
        );

        return res.status(200).json({
            estado: 1,
            url_camara: config.length > 0 ? config[0].url_camara : null,
            fecha_actualizacion: config.length > 0 ? config[0].fecha_actualizacion : null,
            total_veedores: veedores.length,
            veedores: veedores
        });
    } catch (error) {
        console.error('❌ Error obtenerUrlCamaraVinculada:', error);
        return res.status(500).json({
            estado: 0,
            mensaje: 'Error del servidor al obtener la cámara vinculada.'
        });
    }
};