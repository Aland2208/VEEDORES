import { conmysql } from '../db.js'
import { getIO } from '../websocket/socket.js'

// Prueba del controlador
export const pruebaBalanza = (req, res) => {
    res.send('Controlador de balanza funcionando correctamente');
}

// Registrar peso enviado por ESP32
export const registrarPeso = async (req, res) => {

    try {
        const { peso, id_usuario, id_deteccion } = req.body;

        if (peso == null) {

            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar el peso"
            });

        }

        // Validación estricta para cumplir con id_deteccion NOT NULL
        if (id_deteccion == null) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar el id_deteccion de la especie clasificada"
            });
        }

        const usuario = id_usuario || 1;

        // Guardar usando hora Ecuador
        const [result] = await conmysql.query(

            `INSERT INTO capturas
            (id_deteccion, id_usuario, peso, fecha_hora, estado)
            VALUES
            (
                ?,
                ?,
                ?,
                CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'),
                1
            )`,
            [
                id_deteccion,
                usuario,
                peso
            ]
        );

        // Obtener la fecha exacta guardada
        const [registro] = await conmysql.query(
            `SELECT
                DATE_FORMAT(
                    fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora
             FROM capturas
             WHERE id_captura = ?`,
            [result.insertId]
        );

        // Enviar por websocket
        const io = getIO();
        if (io) {

            io.emit("nuevoPeso", {
                id_captura: result.insertId,
                id_deteccion: Number(id_deteccion),
                peso: Number(peso),
                fecha_hora: registro[0].fecha_hora
            });
        }

        res.status(201).json({

            estado: 1,
            mensaje: "Peso registrado correctamente",
            id_captura: result.insertId,
            id_deteccion: Number(id_deteccion),
            peso: Number(peso),
            fecha_hora: registro[0].fecha_hora
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor"
        });
    }
};

// =======================
// PESO EN TIEMPO REAL
// =======================

export const pesoLive = (req, res) => {
    try {
        const { peso } = req.body;
        if (peso == null) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar el peso"
            });
        }

        const io = getIO();
        if (io) {
            io.emit("pesoActual", {
                peso: Number(peso),
                fecha_hora: new Date().toLocaleString("es-EC", {
                    timeZone: "America/Guayaquil",
                    hour12: false
                })
            });
        }

        res.json({
            estado: 1,
            mensaje: "Peso enviado en tiempo real",
            peso: Number(peso)
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error servidor"
        });
    }
};

// Obtener todos los pesos registrados (con unión opcional a detecciones si lo requieres)
export const getPesos = async (req, res) => {
    try {
        const [result] = await conmysql.query(
            `SELECT
                c.id_captura,
                c.id_deteccion,
                c.peso,
                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora,
                c.estado,
                u.nombre,
                u.apellido
            FROM capturas c
            INNER JOIN usuarios u
                ON c.id_usuario = u.id_usuario
            WHERE c.estado = 1
            ORDER BY c.id_captura DESC`
        );

        res.json({
            cantidad: result.length,
            data: result
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor"
        });
    }
};

// Obtener peso por ID
export const getPesoByID = async (req, res) => {

    try {

        const { id } = req.params;

        const [result] = await conmysql.query(

            `SELECT
                id_captura,
                id_deteccion,
                id_usuario,
                peso,
                DATE_FORMAT(
                    fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora,
                estado
            FROM capturas
            WHERE id_captura = ?
            AND estado = 1`,

            [id]

        );

        if (result.length <= 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Registro no encontrado"
            });
        }

        res.json(result[0]);

    } catch (error) {
        console.log(error);
        res.status(500).json({

            estado: 0,
            mensaje: "Error del servidor"

        });
    }
};

// Obtener el último peso recibido
export const ultimoPeso = async (req, res) => {
    try {
        const [result] = await conmysql.query(

            `SELECT
                id_captura,
                id_deteccion,
                peso,
                DATE_FORMAT(
                    fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora
            FROM capturas
            WHERE estado = 1
            ORDER BY id_captura DESC
            LIMIT 1`
        );

        if (result.length <= 0) {
            return res.json({
                estado: 0,
                mensaje: "No existen registros"
            });
        }

        res.json({
            estado: 1,
            data: result[0]
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error"
        });
    }
};

// Desactivar registro
export const desactivarPeso = async (req, res) => {
    try {

        const { id } = req.params;

        const [result] = await conmysql.query(
            `UPDATE capturas
             SET estado = 0
             WHERE id_captura = ?`,
            [id]
        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Registro no encontrado"
            });
        }

        res.json({
            estado: 1,
            mensaje: "Registro desactivado correctamente"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor"
        });
    }
};

// Activar registro
export const activarPeso = async (req, res) => {

    try {
        const { id } = req.params;

        const [result] = await conmysql.query(
            `UPDATE capturas
             SET estado = 1
             WHERE id_captura = ?`,
            [id]

        );

        if (result.affectedRows <= 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Registro no encontrado"
            });
        }

        res.json({
            estado: 1,
            mensaje: "Registro activado correctamente"

        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor"
        });
    }
};

export const taraRealizada = (req, res) => {

    try {
        const io = getIO();
        if (io) {
            io.emit("taraRealizada", {
                mensaje: "Balanza puesta en cero correctamente",
                fecha_hora: new Date().toLocaleString("es-EC", {
                    timeZone: "America/Guayaquil",
                    hour12: false
                })
            });
        }

        res.json({
            estado: 1,
            mensaje: "Tara enviada"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor"
        });
    }
};