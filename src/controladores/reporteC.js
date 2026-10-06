import { conmysql } from "../db.js";


// ======================================================
// OBTENER REPORTE DE CAPTURAS DEL USUARIO
// ======================================================

export const getReporteCapturas = async (req, res) => {

    try {

        const { id_usuario } = req.params;


        // ==============================================
        // VALIDAR USUARIO
        // ==============================================

        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,
                mensaje: "Debe enviar el id_usuario"

            });

        }


        // ==============================================
        // CONSULTAR INFORMACIÓN DEL USUARIO
        // ==============================================

        const [usuarios] = await conmysql.query(

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

            WHERE u.id_usuario = ?`,

            [id_usuario]

        );


        if (usuarios.length === 0) {

            return res.status(404).json({

                estado: 0,
                mensaje: "Usuario no encontrado"

            });

        }


        // ==============================================
        // CONSULTAR CAPTURAS
        // ==============================================

        const [capturas] = await conmysql.query(

            `SELECT

                c.id_captura,

                d.id_deteccion,

                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,

                c.peso,

                d.porcentaje,

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

            WHERE
                c.id_usuario = ?
                AND c.estado = 1

            ORDER BY
                c.fecha_hora DESC`,

            [id_usuario]

        );


        // ==============================================
        // CALCULAR RESUMEN
        // ==============================================

        const totalCapturas =
            capturas.length;


        const pesoTotal =
            capturas.reduce(

                (total, captura) => {

                    return total +
                        Number(captura.peso || 0);

                },

                0

            );


        const confianzaTotal =
            capturas.reduce(

                (total, captura) => {

                    return total +
                        Number(captura.porcentaje || 0);

                },

                0

            );


        const confianzaPromedio =
            totalCapturas > 0

                ? confianzaTotal / totalCapturas

                : 0;


        // ==============================================
        // RESPUESTA
        // ==============================================

        res.json({

            estado: 1,

            mensaje:
                "Reporte obtenido correctamente",

            usuario:
                usuarios[0],

            resumen: {

                total_capturas:
                    totalCapturas,

                peso_total:
                    Number(
                        pesoTotal.toFixed(2)
                    ),

                confianza_promedio:
                    Number(
                        confianzaPromedio.toFixed(2)
                    )

            },

            data:
                capturas

        });

    }

    catch (error) {

        console.error(
            "❌ Error getReporteCapturas:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje:
                "Error del servidor"

        });

    }

};


// ======================================================
// REPORTE POR RANGO DE FECHAS
// ======================================================

export const getReportePorFechas = async (req, res) => {

    try {

        const { id_usuario } = req.params;

        const {
            fecha_inicio,
            fecha_fin
        } = req.query;


        // ==============================================
        // VALIDACIONES
        // ==============================================

        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,
                mensaje:
                    "Debe enviar el id_usuario"

            });

        }


        if (
            !fecha_inicio ||
            !fecha_fin
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "Debe enviar fecha_inicio y fecha_fin"

            });

        }


        // ==============================================
        // CONSULTAR USUARIO
        // ==============================================

        const [usuarios] = await conmysql.query(

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

            WHERE u.id_usuario = ?`,

            [id_usuario]

        );


        if (usuarios.length === 0) {

            return res.status(404).json({

                estado: 0,
                mensaje:
                    "Usuario no encontrado"

            });

        }


        // ==============================================
        // CONSULTAR CAPTURAS POR FECHA
        // ==============================================

        const [capturas] = await conmysql.query(

            `SELECT

                c.id_captura,

                d.id_deteccion,

                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,

                c.peso,

                d.porcentaje,

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

            WHERE
                c.id_usuario = ?

                AND c.estado = 1

                AND DATE(c.fecha_hora)
                    BETWEEN ? AND ?

            ORDER BY
                c.fecha_hora DESC`,

            [
                id_usuario,
                fecha_inicio,
                fecha_fin
            ]

        );


        // ==============================================
        // CALCULAR RESUMEN
        // ==============================================

        const totalCapturas =
            capturas.length;


        const pesoTotal =
            capturas.reduce(

                (total, captura) => {

                    return total +
                        Number(captura.peso || 0);

                },

                0

            );


        const confianzaTotal =
            capturas.reduce(

                (total, captura) => {

                    return total +
                        Number(captura.porcentaje || 0);

                },

                0

            );


        const confianzaPromedio =
            totalCapturas > 0

                ? confianzaTotal / totalCapturas

                : 0;


        // ==============================================
        // RESPUESTA
        // ==============================================

        res.json({

            estado: 1,

            mensaje:
                "Reporte por fechas obtenido correctamente",

            usuario:
                usuarios[0],

            filtros: {

                fecha_inicio,
                fecha_fin

            },

            resumen: {

                total_capturas:
                    totalCapturas,

                peso_total:
                    Number(
                        pesoTotal.toFixed(2)
                    ),

                confianza_promedio:
                    Number(
                        confianzaPromedio.toFixed(2)
                    )

            },

            data:
                capturas

        });

    }

    catch (error) {

        console.error(
            "❌ Error getReportePorFechas:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje:
                "Error del servidor"

        });

    }

};


// ======================================================
// RESUMEN POR ESPECIES
// ======================================================

export const getResumenEspecies = async (req, res) => {

    try {

        const { id_usuario } = req.params;


        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,
                mensaje:
                    "Debe enviar el id_usuario"

            });

        }


        // ==============================================
        // AGRUPAR POR ESPECIE
        // ==============================================

        const [result] = await conmysql.query(

            `SELECT

                e.id_especie,

                e.nombre_comun AS especie,

                e.nombre_cientifico,

                COUNT(c.id_captura)
                    AS cantidad_capturas,

                ROUND(
                    SUM(c.peso),
                    2
                ) AS peso_total,

                ROUND(
                    AVG(d.porcentaje),
                    2
                ) AS confianza_promedio

            FROM capturas c

            INNER JOIN detecciones d
                ON c.id_deteccion =
                   d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie =
                   e.id_especie

            WHERE
                c.id_usuario = ?
                AND c.estado = 1

            GROUP BY

                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico

            ORDER BY
                cantidad_capturas DESC`,

            [id_usuario]

        );


        res.json({

            estado: 1,

            cantidad_especies:
                result.length,

            data:
                result

        });

    }

    catch (error) {

        console.error(
            "❌ Error getResumenEspecies:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje:
                "Error del servidor"

        });

    }

};


// ======================================================
// OBTENER TIPOS DE REPORTE
// ======================================================

export const getTiposReporte = async (req, res) => {

    try {

        const [result] =
            await conmysql.query(

                `SELECT

                    id_tipo_reporte,

                    nombre_tipo

                FROM tipos_reporte

                ORDER BY
                    id_tipo_reporte ASC`

            );


        res.json({

            estado: 1,

            cantidad:
                result.length,

            data:
                result

        });

    }

    catch (error) {

        console.error(
            "❌ Error getTiposReporte:",
            error
        );


        res.status(500).json({

            estado: 0,

            mensaje:
                "Error del servidor"

        });

    }

};