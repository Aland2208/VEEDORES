import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";


// ==========================================
// REGISTRAR DETECCIÓN
// ==========================================

export const registrarDeteccion = async (req, res) => {

    try {

        const {
            id_especie,
            imagen_url,
            porcentaje
        } = req.body;


        // ======================================
        // VALIDACIONES
        // ======================================

        if (id_especie == null) {

            return res.status(400).json({

                estado: 0,
                mensaje: "Debe enviar el id_especie"

            });

        }


        // Si no llega porcentaje,
        // se guarda 0.00

        const porcentajeFinal =
            porcentaje != null
                ? Number(porcentaje)
                : 0;


        // ======================================
        // INSERTAR DETECCIÓN
        // ======================================

        const [result] = await conmysql.query(

            `INSERT INTO detecciones
            (
                id_especie,
                imagen_url,
                porcentaje,
                fecha_hora
            )
            VALUES
            (
                ?,
                ?,
                ?,
                CONVERT_TZ(
                    UTC_TIMESTAMP(),
                    '+00:00',
                    '-05:00'
                )
            )`,

            [
                id_especie,
                imagen_url || null,
                porcentajeFinal
            ]

        );


        // ======================================
        // CONSULTAR DETECCIÓN CREADA
        // ======================================

        const [registro] = await conmysql.query(

            `SELECT

                d.id_deteccion,
                d.id_especie,

                e.nombre_comun,
                e.nombre_cientifico,

                d.imagen_url,
                d.porcentaje,

                DATE_FORMAT(
                    d.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora

            FROM detecciones d

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE d.id_deteccion = ?`,

            [result.insertId]

        );


        // ======================================
        // WEBSOCKET
        // ======================================

        const io = getIO();


        if (io) {

            io.emit(
                "nuevaDeteccion",
                registro[0]
            );

        }


        // ======================================
        // RESPUESTA
        // ======================================

        res.status(201).json({

            estado: 1,

            mensaje:
                "Detección registrada correctamente",

            data:
                registro[0]

        });

    }

    catch (error) {

        console.error(
            "Error registrarDeteccion:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};


// ==========================================
// OBTENER TODAS LAS DETECCIONES
// ==========================================

export const getDetecciones = async (req, res) => {

    try {

        const [result] = await conmysql.query(

            `SELECT

                d.id_deteccion,
                d.id_especie,

                e.nombre_comun,
                e.nombre_cientifico,

                d.imagen_url,
                d.porcentaje,

                DATE_FORMAT(
                    d.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora

            FROM detecciones d

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            ORDER BY d.id_deteccion DESC`

        );


        res.json({

            estado: 1,
            cantidad: result.length,
            data: result

        });

    }

    catch (error) {

        console.error(
            "Error getDetecciones:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};


// ==========================================
// OBTENER DETECCIÓN POR ID
// ==========================================

export const getDeteccionByID = async (req, res) => {

    try {

        const { id } = req.params;


        const [result] = await conmysql.query(

            `SELECT

                d.id_deteccion,
                d.id_especie,

                e.nombre_comun,
                e.nombre_cientifico,

                d.imagen_url,
                d.porcentaje,

                DATE_FORMAT(
                    d.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora

            FROM detecciones d

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            WHERE d.id_deteccion = ?`,

            [id]

        );


        if (result.length <= 0) {

            return res.status(404).json({

                estado: 0,
                mensaje: "Detección no encontrada"

            });

        }


        res.json({

            estado: 1,
            data: result[0]

        });

    }

    catch (error) {

        console.error(
            "Error getDeteccionByID:",
            error
        );


        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};