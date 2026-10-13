import { conmysql } from '../db.js';

const respuestaError = (res, mensaje, codigo = 500) =>
    res.status(codigo).json({ estado: 0, mensaje });

const idValido = valor =>
    Number.isInteger(Number(valor)) && Number(valor) > 0;

// =====================================================
// 1. BUSCAR ADMINISTRADOR POR CORREO
// =====================================================

export const buscarAdministradorPorCorreo = async (req, res) => {
    try {
        const correo = String(req.query.correo || '').trim().toLowerCase();

        if (!correo || correo.length > 150) {
            return respuestaError(res, 'El correo electrónico no es válido.', 400);
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario, nombre, apellido, correo
            FROM usuarios
            WHERE LOWER(correo) = ?
              AND id_rol = 1
              AND estado = 1
            LIMIT 1
        `, [correo]);

        if (!administradores.length) {
            return respuestaError(
                res,
                'No se encontró un administrador con este correo.',
                404
            );
        }

        return res.json({
            estado: 1,
            mensaje: 'Administrador encontrado.',
            data: administradores[0]
        });

    } catch (error) {
        console.error('Buscar administrador:', error);
        return respuestaError(res, 'Error al buscar el administrador.');
    }
};

// =====================================================
// 2. ADMINISTRADOR ACTUAL DE UN VEEDOR
// =====================================================

export const getAdministradorActual = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!idValido(idUsuario)) {
            return respuestaError(res, 'Usuario no válido.', 400);
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
                ON u.id_usuario = a.id_administrador
            WHERE a.id_usuario = ?
              AND a.fecha_fin IS NULL
              AND u.id_rol = 1
              AND u.estado = 1
            LIMIT 1
        `, [idUsuario]);

        if (!resultado.length) {
            return res.json({
                estado: 1,
                vinculado: false,
                mensaje: 'El usuario no tiene un administrador vinculado.',
                data: null
            });
        }

        return res.json({
            estado: 1,
            vinculado: true,
            mensaje: 'Administrador actual obtenido correctamente.',
            data: resultado[0]
        });

    } catch (error) {
        console.error('Administrador actual:', error);
        return respuestaError(res, 'Error al obtener el administrador actual.');
    }
};

// =====================================================
// 3. VEEDORES ASIGNADOS AL ADMINISTRADOR
// =====================================================

export const getUsuariosAdministrador = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);

        if (!idValido(idAdministrador)) {
            return respuestaError(res, 'Administrador no válido.', 400);
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
                a.fecha_inicio,
                a.visualizacion_habilitada
            FROM administrador a
            INNER JOIN usuarios u
                ON a.id_usuario = u.id_usuario
            INNER JOIN usuarios admin
                ON admin.id_usuario = a.id_administrador
            WHERE a.id_administrador = ?
              AND a.fecha_fin IS NULL
              AND u.id_rol = 2
              AND admin.id_rol = 1
              AND admin.estado = 1
            ORDER BY u.nombre, u.apellido
        `, [idAdministrador]);

        return res.json({
            estado: 1,
            mensaje: 'Usuarios obtenidos correctamente.',
            data: usuarios.map(usuario => ({
                ...usuario,
                visualizacion_habilitada:
                    Number(usuario.visualizacion_habilitada) === 1
            }))
        });

    } catch (error) {
        console.error('Usuarios administrador:', error);
        return respuestaError(
            res,
            'Error al obtener los usuarios del administrador.'
        );
    }
};

// =====================================================
// 4. VEEDORES DISPONIBLES
// =====================================================

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
            WHERE u.id_rol = 2
              AND u.estado = 1
              AND NOT EXISTS (
                  SELECT 1
                  FROM administrador a
                  WHERE a.id_usuario = u.id_usuario
                    AND a.fecha_fin IS NULL
              )
            ORDER BY u.nombre, u.apellido
        `);

        return res.json({
            estado: 1,
            mensaje: 'Usuarios disponibles obtenidos correctamente.',
            data: usuarios
        });

    } catch (error) {
        console.error('Usuarios disponibles:', error);
        return respuestaError(
            res,
            'Error al obtener los usuarios disponibles.'
        );
    }
};

// =====================================================
// 5. ASIGNAR VEEDOR
// =====================================================

export const asignarUsuario = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.body.id_usuario);

        if (!idValido(idAdministrador) || !idValido(idUsuario)) {
            return respuestaError(
                res,
                'Administrador o usuario no válido.',
                400
            );
        }

        if (idAdministrador === idUsuario) {
            return respuestaError(
                res,
                'Un administrador no puede asignarse a sí mismo.',
                400
            );
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 1
              AND estado = 1
            LIMIT 1
        `, [idAdministrador]);

        if (!administradores.length) {
            return respuestaError(
                res,
                'El administrador no existe o no está activo.',
                404
            );
        }

        const [usuarios] = await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 2
              AND estado = 1
            LIMIT 1
        `, [idUsuario]);

        if (!usuarios.length) {
            return respuestaError(
                res,
                'El observador no existe o no está activo.',
                404
            );
        }

        const [asignaciones] = await conmysql.query(`
            SELECT id_asignacion, id_administrador
            FROM administrador
            WHERE id_usuario = ?
              AND fecha_fin IS NULL
            LIMIT 1
        `, [idUsuario]);

        if (asignaciones.length) {
            return respuestaError(
                res,
                'El observador ya tiene un administrador asignado.',
                409
            );
        }

        const [resultado] = await conmysql.query(`
            INSERT INTO administrador (
                id_administrador,
                id_usuario,
                fecha_inicio,
                visualizacion_habilitada
            )
            VALUES (
                ?,
                ?,
                DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR),
                1
            )
        `, [idAdministrador, idUsuario]);

        return res.status(201).json({
            estado: 1,
            mensaje: 'Usuario asignado correctamente.',
            data: {
                id_asignacion: resultado.insertId,
                id_administrador: idAdministrador,
                id_usuario: idUsuario,
                visualizacion_habilitada: true
            }
        });

    } catch (error) {
        console.error('Asignar usuario:', error);
        return respuestaError(res, 'Error al asignar el usuario.');
    }
};

// =====================================================
// 6. REASIGNAR VEEDOR
// =====================================================

export const reasignarUsuario = async (req, res) => {
    let conexion;

    try {
        const idUsuario = Number(req.params.id_usuario);
        const idNuevoAdministrador = Number(req.body.id_administrador);

        if (!idValido(idUsuario) || !idValido(idNuevoAdministrador)) {
            return respuestaError(
                res,
                'Usuario o administrador no válido.',
                400
            );
        }

        conexion = await conmysql.getConnection();
        await conexion.beginTransaction();

        const [usuarios] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 2
              AND estado = 1
            LIMIT 1
        `, [idUsuario]);

        if (!usuarios.length) {
            await conexion.rollback();
            return respuestaError(
                res,
                'El observador no existe o no está activo.',
                404
            );
        }

        const [administradores] = await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 1
              AND estado = 1
            LIMIT 1
        `, [idNuevoAdministrador]);

        if (!administradores.length) {
            await conexion.rollback();
            return respuestaError(
                res,
                'El nuevo administrador no existe o no está activo.',
                404
            );
        }

        const [actual] = await conexion.query(`
            SELECT id_asignacion, id_administrador
            FROM administrador
            WHERE id_usuario = ?
              AND fecha_fin IS NULL
            FOR UPDATE
        `, [idUsuario]);

        if (
            actual.length &&
            Number(actual[0].id_administrador) === idNuevoAdministrador
        ) {
            await conexion.rollback();
            return respuestaError(
                res,
                'El usuario ya pertenece a este administrador.',
                409
            );
        }

        const [fecha] = await conexion.query(`
            SELECT DATE_SUB(
                DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR),
                INTERVAL 5 HOUR
            ) AS fecha_cambio
        `);

        const fechaCambio = fecha[0].fecha_cambio;

        if (actual.length) {
            await conexion.query(`
                UPDATE administrador
                SET fecha_fin = ?
                WHERE id_asignacion = ?
            `, [fechaCambio, actual[0].id_asignacion]);
        }

        const [resultado] = await conexion.query(`
            INSERT INTO administrador (
                id_administrador,
                id_usuario,
                fecha_inicio,
                visualizacion_habilitada
            )
            VALUES (?, ?, ?, 1)
        `, [
            idNuevoAdministrador,
            idUsuario,
            fechaCambio
        ]);

        await conexion.commit();

        return res.json({
            estado: 1,
            mensaje: 'Usuario reasignado correctamente.',
            data: {
                id_asignacion: resultado.insertId,
                id_administrador: idNuevoAdministrador,
                id_usuario: idUsuario,
                visualizacion_habilitada: true
            }
        });

    } catch (error) {
        if (conexion) await conexion.rollback();

        console.error('Reasignar usuario:', error);
        return respuestaError(res, 'Error al reasignar el usuario.');

    } finally {
        if (conexion) conexion.release();
    }
};

// =====================================================
// 7. FINALIZAR ASIGNACIÓN
// =====================================================

export const quitarUsuarioAdministrador = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.params.id_usuario);

        if (!idValido(idAdministrador) || !idValido(idUsuario)) {
            return respuestaError(
                res,
                'Administrador o usuario no válido.',
                400
            );
        }

        const [resultado] = await conmysql.query(`
            UPDATE administrador
            SET fecha_fin = DATE_SUB(
                DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR),
                INTERVAL 5 HOUR
            )
            WHERE id_administrador = ?
              AND id_usuario = ?
              AND fecha_fin IS NULL
        `, [idAdministrador, idUsuario]);

        if (!resultado.affectedRows) {
            return respuestaError(
                res,
                'No existe una asignación activa para este usuario.',
                404
            );
        }

        return res.json({
            estado: 1,
            mensaje: 'Asignación finalizada correctamente.'
        });

    } catch (error) {
        console.error('Quitar usuario:', error);
        return respuestaError(res, 'Error al finalizar la asignación.');
    }
};

// =====================================================
// 8. HISTORIAL DE ADMINISTRADORES DEL VEEDOR
// =====================================================

export const getHistorialUsuario = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!idValido(idUsuario)) {
            return respuestaError(res, 'Usuario no válido.', 400);
        }

        const [historial] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,
                CONCAT(u.nombre, ' ', u.apellido) AS administrador,
                a.fecha_inicio,
                a.fecha_fin,
                CASE
                    WHEN a.fecha_fin IS NULL THEN 'Activo'
                    ELSE 'Finalizado'
                END AS estado_asignacion
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario = a.id_administrador
            WHERE a.id_usuario = ?
            ORDER BY a.fecha_inicio DESC
        `, [idUsuario]);

        return res.json({
            estado: 1,
            mensaje: 'Historial obtenido correctamente.',
            data: historial
        });

    } catch (error) {
        console.error('Historial usuario:', error);
        return respuestaError(res, 'Error al obtener el historial.');
    }
};

// =====================================================
// 9. VEEDORES RELACIONADOS CON ADMINISTRADOR
// =====================================================

export const getVeedoresHistorial = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);

        if (!idValido(idAdministrador)) {
            return respuestaError(res, 'Administrador no válido.', 400);
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario, nombre, apellido, correo
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 1
            LIMIT 1
        `, [idAdministrador]);

        if (!administradores.length) {
            return respuestaError(
                res,
                'Administrador no encontrado.',
                404
            );
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
                     AND TRIM(rep.titulo) <> ''
                    THEN rep.id_reporte
                END) AS reportes_completos,

                COUNT(DISTINCT CASE
                    WHEN rep.id_reporte IS NOT NULL
                     AND (
                        rep.id_tipo_reporte IS NULL
                        OR rep.titulo IS NULL
                        OR TRIM(rep.titulo) = ''
                     )
                    THEN rep.id_reporte
                END) AS reportes_incompletos,

                MAX(CASE
                    WHEN a.fecha_fin IS NULL THEN 1
                    ELSE 0
                END) AS relacion_actual,

                MIN(a.fecha_inicio) AS primera_asignacion,
                MAX(a.fecha_fin) AS ultima_fecha_fin

            FROM administrador a

            INNER JOIN usuarios u
                ON a.id_usuario = u.id_usuario

            LEFT JOIN reportes rep
                ON rep.id_usuario = u.id_usuario
               AND rep.fecha_generacion >= a.fecha_inicio
               AND (
                    a.fecha_fin IS NULL
                    OR rep.fecha_generacion < a.fecha_fin
               )

            WHERE a.id_administrador = ?
              AND u.id_rol = 2

            GROUP BY
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado

            ORDER BY relacion_actual DESC, u.nombre, u.apellido
        `, [idAdministrador]);

        return res.json({
            estado: 1,
            mensaje: 'Veedores del historial obtenidos correctamente.',
            administrador: administradores[0],
            cantidad: veedores.length,
            data: veedores
        });

    } catch (error) {
        console.error('Historial veedores:', error);
        return respuestaError(
            res,
            'Error al obtener el historial de veedores.'
        );
    }
};

// =====================================================
// 10. REPORTES HISTÓRICOS DE UN VEEDOR
// =====================================================

export const getReportesHistorialVeedor = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);
        const idUsuario = Number(req.params.id_usuario);

        if (!idValido(idAdministrador) || !idValido(idUsuario)) {
            return respuestaError(
                res,
                'Administrador o veedor no válido.',
                400
            );
        }

        const [administradores] = await conmysql.query(`
            SELECT id_usuario, nombre, apellido, correo
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 1
            LIMIT 1
        `, [idAdministrador]);

        if (!administradores.length) {
            return respuestaError(
                res,
                'Administrador no encontrado.',
                404
            );
        }

        const [relaciones] = await conmysql.query(`
            SELECT id_asignacion
            FROM administrador
            WHERE id_administrador = ?
              AND id_usuario = ?
            LIMIT 1
        `, [idAdministrador, idUsuario]);

        if (!relaciones.length) {
            return respuestaError(
                res,
                'El veedor no pertenece ni ha pertenecido a este administrador.',
                403
            );
        }

        const [veedores] = await conmysql.query(`
            SELECT id_usuario, nombre, apellido, correo, estado
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 2
            LIMIT 1
        `, [idUsuario]);

        if (!veedores.length) {
            return respuestaError(
                res,
                'Veedor no encontrado.',
                404
            );
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

                DATE_FORMAT(
                    rep.fecha_generacion, '%Y-%m-%d'
                ) AS fecha_reporte,

                DATE_FORMAT(
                    rep.fecha_generacion, '%H:%i:%s'
                ) AS hora_reporte,

                DATE_FORMAT(
                    rep.fecha_generacion, '%Y-%m-%d %H:%i:%s'
                ) AS fecha_generacion,

                tr.nombre_tipo,
                c.peso,

                DATE_FORMAT(
                    c.fecha_hora, '%Y-%m-%d'
                ) AS fecha_captura,

                DATE_FORMAT(
                    c.fecha_hora, '%H:%i:%s'
                ) AS hora_captura,

                d.id_deteccion,
                d.porcentaje,
                d.imagen_url,

                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,

                CASE
                    WHEN rep.id_tipo_reporte IS NOT NULL
                     AND rep.titulo IS NOT NULL
                     AND TRIM(rep.titulo) <> ''
                    THEN 'Completo'
                    ELSE 'Incompleto'
                END AS estado_reporte

            FROM reportes rep

            INNER JOIN administrador a
                ON a.id_usuario = rep.id_usuario

            LEFT JOIN tipos_reporte tr
                ON rep.id_tipo_reporte = tr.id_tipo_reporte

            LEFT JOIN capturas c
                ON rep.id_captura = c.id_captura

            LEFT JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            LEFT JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE rep.id_usuario = ?
              AND a.id_administrador = ?
              AND rep.fecha_generacion >= a.fecha_inicio
              AND (
                  a.fecha_fin IS NULL
                  OR rep.fecha_generacion < a.fecha_fin
              )

            ORDER BY rep.fecha_generacion DESC
        `, [idUsuario, idAdministrador]);

        const completos = reportes.filter(
            r => r.estado_reporte === 'Completo'
        ).length;

        return res.json({
            estado: 1,
            mensaje: 'Historial del veedor obtenido correctamente.',
            administrador: administradores[0],
            veedor: veedores[0],
            resumen: {
                total: reportes.length,
                completos,
                incompletos: reportes.length - completos
            },
            data: reportes
        });

    } catch (error) {
        console.error('Reportes historial veedor:', error);
        return respuestaError(
            res,
            'Error al obtener el historial del veedor.'
        );
    }
};

// =====================================================
// 11. GUARDAR URL DE LA CÁMARA
// =====================================================

export const guardarUrlCamaraAdmin = async (req, res) => {
    try {
        const idAdministrador = Number(req.body.id_administrador);
        let urlCamara = String(req.body.url_camara || '').trim();

        if (!idValido(idAdministrador) || !urlCamara) {
            return respuestaError(
                res,
                'El ID del administrador y la URL son obligatorios.',
                400
            );
        }

        if (
            Number(req.usuario?.id_usuario) !== idAdministrador ||
            Number(req.usuario?.id_rol) !== 1
        ) {
            return respuestaError(
                res,
                'No tienes permiso para configurar esta cámara.',
                403
            );
        }

        if (urlCamara.length > 2048) {
            return respuestaError(res, 'La URL no es válida.', 400);
        }

        let urlValidada;

        try {
            urlValidada = new URL(urlCamara);
        } catch {
            return respuestaError(
                res,
                'Ingresa una URL HTTPS válida.',
                400
            );
        }

        if (
            urlValidada.protocol !== 'https:' ||
            urlValidada.username ||
            urlValidada.password ||
            urlValidada.search ||
            urlValidada.hash ||
            urlValidada.pathname !== '/'
        ) {
            return respuestaError(
                res,
                'Ingresa únicamente la dirección HTTPS de la cámara.',
                400
            );
        }

        urlCamara = urlValidada.origin;

        const [admin] = await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario = ?
              AND id_rol = 1
              AND estado = 1
            LIMIT 1
        `, [idAdministrador]);

        if (!admin.length) {
            return respuestaError(
                res,
                'Solo un administrador activo puede configurar la cámara.',
                403
            );
        }

        await conmysql.query(`
            INSERT INTO configuracion_camara (
                id_administrador,
                url_camara,
                fecha_actualizacion
            )
            VALUES (
                ?,
                ?,
                DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)
            )
            ON DUPLICATE KEY UPDATE
                url_camara = VALUES(url_camara),
                fecha_actualizacion =
                    DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)
        `, [idAdministrador, urlCamara]);

        return res.json({
            estado: 1,
            mensaje: 'Cámara configurada correctamente.',
            data: {
                url_camara: urlCamara
            }
        });

    } catch (error) {
        console.error('Guardar URL cámara:', error);
        return respuestaError(
            res,
            'Error del servidor al configurar la cámara.'
        );
    }
};

// =====================================================
// 12. OBTENER CONFIGURACIÓN DE CÁMARA
// =====================================================

export const obtenerUrlCamaraVinculada = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!idValido(idUsuario)) {
            return respuestaError(res, 'Usuario no válido.', 400);
        }

        const [usuarios] = await conmysql.query(`
            SELECT id_usuario, id_rol
            FROM usuarios
            WHERE id_usuario = ?
              AND estado = 1
            LIMIT 1
        `, [idUsuario]);

        if (!usuarios.length) {
            return respuestaError(
                res,
                'Usuario no encontrado o inactivo.',
                404
            );
        }

        const usuario = usuarios[0];
        const esAdministrador = Number(usuario.id_rol) === 1;
        const esVeedor = Number(usuario.id_rol) === 2;

        let idAdminObjetivo = null;
        let permisoIndividual = false;

        // Administrador: acceso a su propia cámara.
        if (esAdministrador) {
            idAdminObjetivo = Number(usuario.id_usuario);
            permisoIndividual = true;
        }

        // Veedor: buscar asignación activa y permiso individual.
        if (esVeedor) {
            const [asignaciones] = await conmysql.query(`
                SELECT
                    a.id_administrador,
                    a.visualizacion_habilitada
                FROM administrador a
                INNER JOIN usuarios admin
                    ON admin.id_usuario = a.id_administrador
                WHERE a.id_usuario = ?
                  AND a.fecha_fin IS NULL
                  AND admin.id_rol = 1
                  AND admin.estado = 1
                ORDER BY a.fecha_inicio DESC
                LIMIT 1
            `, [idUsuario]);

            if (asignaciones.length) {
                idAdminObjetivo =
                    Number(asignaciones[0].id_administrador);

                permisoIndividual =
                    Number(
                        asignaciones[0].visualizacion_habilitada
                    ) === 1;
            }
        }

        if (!idAdminObjetivo) {
            return res.json({
                estado: 1,
                url_camara: null,
                visualizacion_habilitada: false,
                fecha_actualizacion: null,
                veedores: [],
                total_veedores: 0,
                mensaje: 'El veedor no tiene un administrador asignado.'
            });
        }

        // La configuración general sigue proporcionando la URL.
        const [config] = await conmysql.query(`
            SELECT
                url_camara,
                visualizacion_habilitada,
                DATE_FORMAT(
                    fecha_actualizacion,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_actualizacion
            FROM configuracion_camara
            WHERE id_administrador = ?
            LIMIT 1
        `, [idAdminObjetivo]);

        const configuracion = config[0] || null;

        // Se conserva el interruptor general existente.
        const permisoGeneral = configuracion
            ? Number(configuracion.visualizacion_habilitada) === 1
            : false;

        // El administrador conserva acceso al video.
        // El veedor necesita permiso general e individual.
        const visualizacionHabilitada = esAdministrador
            ? true
            : permisoGeneral && permisoIndividual;

        // Solo el administrador recibe la lista de sus veedores.
        let veedores = [];

        if (esAdministrador) {
            const [resultado] = await conmysql.query(`
                SELECT
                    u.id_usuario,
                    u.nombre,
                    u.apellido,
                    u.correo,
                    u.estado,
                    a.visualizacion_habilitada
                FROM administrador a
                INNER JOIN usuarios u
                    ON a.id_usuario = u.id_usuario
                WHERE a.id_administrador = ?
                  AND a.fecha_fin IS NULL
                  AND u.id_rol = 2
                ORDER BY u.nombre, u.apellido
            `, [idAdminObjetivo]);

            veedores = resultado.map(veedor => ({
                ...veedor,
                visualizacion_habilitada:
                    Number(veedor.visualizacion_habilitada) === 1
            }));
        }

        return res.json({
            estado: 1,
            url_camara: configuracion?.url_camara || null,
            visualizacion_habilitada: visualizacionHabilitada,
            fecha_actualizacion:
                configuracion?.fecha_actualizacion || null,
            total_veedores: veedores.length,
            veedores
        });

    } catch (error) {
        console.error('Obtener cámara vinculada:', error);

        return respuestaError(
            res,
            'Error del servidor al obtener la cámara vinculada.'
        );
    }
};

// =====================================================
// 13. HABILITAR / DESHABILITAR VIDEO DE UN VEEDOR
// =====================================================

export const cambiarVisualizacionCamara = async (req, res) => {
    try {
        const idAdministrador = Number(req.params.id_administrador);

        const idUsuario = Number(req.body?.id_usuario);

        const { visualizacion_habilitada } = req.body || {};

        // Validar administrador.
        if (!idValido(idAdministrador)) {
            return respuestaError(
                res,
                'Administrador no válido.',
                400
            );
        }

        // Solo el administrador propietario puede modificar permisos.
        if (
            Number(req.usuario?.id_usuario) !== idAdministrador ||
            Number(req.usuario?.id_rol) !== 1
        ) {
            return respuestaError(
                res,
                'No tienes permiso para modificar la visualización.',
                403
            );
        }

        // Es obligatorio indicar qué veedor se modificará.
        if (!idValido(idUsuario)) {
            return respuestaError(
                res,
                'Debes seleccionar un veedor válido.',
                400
            );
        }

        // Solo se aceptan valores booleanos.
        if (
            visualizacion_habilitada !== true &&
            visualizacion_habilitada !== false
        ) {
            return respuestaError(
                res,
                'La visualización debe ser true o false.',
                400
            );
        }

        // Confirmar que el veedor pertenece al administrador
        // y que la asignación continúa activa.
        const [veedores] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_usuario
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario = a.id_usuario
            WHERE a.id_administrador = ?
              AND a.id_usuario = ?
              AND a.fecha_fin IS NULL
              AND u.id_rol = 2
              AND u.estado = 1
            LIMIT 1
        `, [idAdministrador, idUsuario]);

        if (!veedores.length) {
            return respuestaError(
                res,
                'El veedor no está vinculado actualmente a este administrador.',
                404
            );
        }

        // Actualizar exclusivamente la asignación seleccionada.
        const [resultado] = await conmysql.query(`
            UPDATE administrador
            SET visualizacion_habilitada = ?
            WHERE id_asignacion = ?
              AND id_administrador = ?
              AND id_usuario = ?
              AND fecha_fin IS NULL
        `, [
            visualizacion_habilitada ? 1 : 0,
            veedores[0].id_asignacion,
            idAdministrador,
            idUsuario
        ]);

        if (!resultado.affectedRows) {
            return respuestaError(
                res,
                'No se pudo actualizar el permiso del veedor.',
                409
            );
        }

        return res.json({
            estado: 1,
            mensaje: visualizacion_habilitada
                ? 'Visualización en vivo habilitada para el veedor.'
                : 'Visualización en vivo deshabilitada para el veedor.',
            data: {
                id_administrador: idAdministrador,
                id_usuario: idUsuario,
                visualizacion_habilitada
            },
            visualizacion_habilitada
        });

    } catch (error) {
        console.error('Cambiar visualización cámara:', error);

        return respuestaError(
            res,
            'No se pudo actualizar la visualización del veedor.'
        );
    }
};