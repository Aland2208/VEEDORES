import { conmysql } from "../db.js";


// ======================================================
// OBTENER DATOS PARA REPORTE DE CAPTURAS POR USUARIO
// ======================================================

export const getReporteCapturas = async (req, res) => {

    try {

        const { id_usuario } = req.params;


        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,
                mensaje: "Debe enviar el id_usuario"

            });

        }


        // ==========================================
        // DATOS DEL USUARIO
        // ==========================================

        const [usuario] = await conmysql.query(

            `SELECT

                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,

                r.id_rol,
                r.nombre_rol

            FROM usuarios u

            INNER JOIN roles r
                ON u.id_rol = r.id_rol

            WHERE u.id_usuario = ?
              AND u.estado = 1`,

            [id_usuario]

        );


        if (usuario.length <= 0) {

            return res.status(404).json({

                estado: 0,
                mensaje: "Usuario no encontrado"

            });

        }


        // ==========================================
        // CAPTURAS DEL USUARIO
        // ==========================================

        const [capturas] = await conmysql.query(

            `SELECT

                c.id_captura,

                d.id_deteccion,

                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,
                e.descripcion AS descripcion_especie,

                c.peso,

                d.porcentaje AS porcentaje_deteccion,
                d.imagen_url,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d'
                ) AS fecha,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%H:%i:%s'
                ) AS hora,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE c.id_usuario = ?
              AND c.estado = 1

            ORDER BY c.fecha_hora DESC`,

            [id_usuario]

        );


        // ==========================================
        // RESUMEN
        // ==========================================

        const [resumen] = await conmysql.query(

            `SELECT

                COUNT(c.id_captura) AS total_capturas,

                COUNT(
                    DISTINCT d.id_especie
                ) AS total_especies,

                COALESCE(
                    SUM(c.peso),
                    0
                ) AS peso_total,

                COALESCE(
                    AVG(c.peso),
                    0
                ) AS peso_promedio

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            WHERE c.id_usuario = ?
              AND c.estado = 1`,

            [id_usuario]

        );


        // ==========================================
        // RESPUESTA
        // ==========================================

        res.json({

            estado: 1,

            tipo_reporte: {
                id_tipo_reporte: 1,
                nombre_tipo: "Reporte de Capturas"
            },

            usuario: usuario[0],

            resumen: {

                total_capturas:
                    Number(resumen[0].total_capturas),

                total_especies:
                    Number(resumen[0].total_especies),

                peso_total:
                    Number(resumen[0].peso_total),

                peso_promedio:
                    Number(resumen[0].peso_promedio)

            },

            cantidad: capturas.length,

            data: capturas

        });

    }

    catch (error) {

        console.log(
            "Error getReporteCapturas:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};



// ======================================================
// OBTENER REPORTE DE CAPTURAS POR FECHA
// ======================================================

export const getReporteCapturasPorFecha = async (req, res) => {

    try {

        const { id_usuario } = req.params;

        const {
            fecha_inicio,
            fecha_fin
        } = req.query;


        if (
            !id_usuario ||
            !fecha_inicio ||
            !fecha_fin
        ) {

            return res.status(400).json({

                estado: 0,
                mensaje:
                    "Debe enviar id_usuario, fecha_inicio y fecha_fin"

            });

        }


        // ==========================================
        // USUARIO + ROL
        // ==========================================

        const [usuario] = await conmysql.query(

            `SELECT

                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,

                r.id_rol,
                r.nombre_rol

            FROM usuarios u

            INNER JOIN roles r
                ON u.id_rol = r.id_rol

            WHERE u.id_usuario = ?
              AND u.estado = 1`,

            [id_usuario]

        );


        if (usuario.length <= 0) {

            return res.status(404).json({

                estado: 0,
                mensaje: "Usuario no encontrado"

            });

        }


        // ==========================================
        // CAPTURAS
        // ==========================================

        const [capturas] = await conmysql.query(

            `SELECT

                c.id_captura,

                d.id_deteccion,

                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,
                e.descripcion AS descripcion_especie,

                c.peso,

                d.porcentaje AS porcentaje_deteccion,
                d.imagen_url,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d'
                ) AS fecha,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%H:%i:%s'
                ) AS hora,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE c.id_usuario = ?

              AND c.estado = 1

              AND DATE(c.fecha_hora)
                  BETWEEN ? AND ?

            ORDER BY c.fecha_hora DESC`,

            [
                id_usuario,
                fecha_inicio,
                fecha_fin
            ]

        );


        // ==========================================
        // RESUMEN DEL PERIODO
        // ==========================================

        const [resumen] = await conmysql.query(

            `SELECT

                COUNT(c.id_captura)
                    AS total_capturas,

                COUNT(
                    DISTINCT d.id_especie
                ) AS total_especies,

                COALESCE(
                    SUM(c.peso),
                    0
                ) AS peso_total,

                COALESCE(
                    AVG(c.peso),
                    0
                ) AS peso_promedio

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            WHERE c.id_usuario = ?

              AND c.estado = 1

              AND DATE(c.fecha_hora)
                  BETWEEN ? AND ?`,

            [
                id_usuario,
                fecha_inicio,
                fecha_fin
            ]

        );


        res.json({

            estado: 1,

            tipo_reporte: {
                id_tipo_reporte: 1,
                nombre_tipo: "Reporte de Capturas"
            },

            usuario: usuario[0],

            periodo: {
                fecha_inicio,
                fecha_fin
            },

            resumen: {

                total_capturas:
                    Number(resumen[0].total_capturas),

                total_especies:
                    Number(resumen[0].total_especies),

                peso_total:
                    Number(resumen[0].peso_total),

                peso_promedio:
                    Number(resumen[0].peso_promedio)

            },

            cantidad: capturas.length,

            data: capturas

        });

    }

    catch (error) {

        console.log(
            "Error getReporteCapturasPorFecha:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};



// ======================================================
// OBTENER RESUMEN POR ESPECIE
// ======================================================

export const getResumenEspecies = async (req, res) => {

    try {

        const { id_usuario } = req.params;


        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,
                mensaje: "Debe enviar el id_usuario"

            });

        }


        const [result] = await conmysql.query(

            `SELECT

                e.id_especie,

                e.nombre_comun AS especie,

                e.nombre_cientifico,

                COUNT(
                    c.id_captura
                ) AS cantidad_capturas,

                COALESCE(
                    SUM(c.peso),
                    0
                ) AS peso_total,

                COALESCE(
                    AVG(c.peso),
                    0
                ) AS peso_promedio

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE c.id_usuario = ?
              AND c.estado = 1

            GROUP BY

                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico

            ORDER BY cantidad_capturas DESC`,

            [id_usuario]

        );


        res.json({

            estado: 1,

            cantidad_especies: result.length,

            data: result

        });

    }

    catch (error) {

        console.log(
            "Error getResumenEspecies:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};



// ======================================================
// OBTENER TIPOS DE REPORTE
// ======================================================

export const getTiposReporte = async (req, res) => {

    try {

        const [result] = await conmysql.query(

            `SELECT

                id_tipo_reporte,
                nombre_tipo,
                descripcion

            FROM tipos_reporte

            ORDER BY id_tipo_reporte ASC`

        );


        res.json({

            estado: 1,

            cantidad: result.length,

            data: result

        });

    }

    catch (error) {

        console.log(
            "Error getTiposReporte:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};