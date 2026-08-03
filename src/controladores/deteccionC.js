import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";

// ==============================
// REGISTRAR DETECCION
// ==============================

export const registrarDeteccion = async (req, res) => {

    try {

        const {
            id_especie,
            imagen_url
        } = req.body;

        if (id_especie == null) {

            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar el id_especie"
            });

        }

        const [result] = await conmysql.query(

            `INSERT INTO detecciones
            (
                id_especie,
                imagen_url,
                fecha_hora
            )
            VALUES
            (
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
                imagen_url || null
            ]

        );

        const [registro] = await conmysql.query(

            `SELECT

                d.id_deteccion,
                d.id_especie,
                e.nombre_comun,

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

        const io = getIO();

        if (io) {

            io.emit("nuevaDeteccion", registro[0]);

        }

        res.status(201).json({

            estado: 1,
            mensaje: "Detección registrada correctamente",
            data: registro[0]

        });

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};


// ==============================
// OBTENER TODAS
// ==============================

export const getDetecciones = async (req, res) => {

    try {

        const [result] = await conmysql.query(

            `SELECT

                d.id_deteccion,
                d.id_especie,

                e.nombre_comun,
                e.nombre_cientifico,

                d.imagen_url,

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

            cantidad: result.length,
            data: result

        });

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};


// ==============================
// OBTENER POR ID
// ==============================

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

        res.json(result[0]);

    }

    catch (error) {

        console.log(error);

        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });

    }

};