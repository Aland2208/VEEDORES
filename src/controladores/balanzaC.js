import { conmysql } from '../db.js'
import { getIO } from '../websocket/socket.js'

// Prueba del controlador
export const pruebaBalanza = (req, res) => {
    res.send('Controlador de balanza funcionando correctamente');
}


// Registrar peso enviado por ESP32
export const registrarPeso = async (req, res) => {
    try {

        const { peso, id_usuario } = req.body;
        if (peso == null) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe enviar el peso"

            });

        }

        const usuario = id_usuario || 1;

        const [result] = await conmysql.query(

            `INSERT INTO capturas
            (id_deteccion, id_usuario, peso, estado)
            VALUES (NULL, ?, ?, 1)`,

            [
                usuario,
                peso
            ]

        );

        // ==========================
        // ENVIAR PESO POR WEBSOCKET
        // ==========================
        const io = getIO();
        if (io) {

            io.emit("nuevoPeso", {

                id_captura: result.insertId,
                peso: Number(peso),
                fecha_hora: new Date()

            });

        }
        res.status(201).json({

            estado: 1,
            mensaje: "Peso registrado correctamente",
            id_captura: result.insertId,
            peso: peso

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


            io.emit(
                "pesoActual",
                {

                    peso: Number(peso),

                    fecha_hora: new Date()

                }
            );


        }



        res.json({

            estado: 1,

            mensaje: "Peso enviado en tiempo real",

            peso: Number(peso)

        });



    } catch(error) {


        console.log(error);


        res.status(500).json({

            estado:0,

            mensaje:"Error servidor"

        });


    }

};

// Obtener todos los pesos registrados
export const getPesos = async (req, res) => {

    try {

        const [result] = await conmysql.query(

            `SELECT
            c.id_captura,
            c.peso,
            c.fecha_hora,
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

            `SELECT *
             FROM capturas WHERE id_captura=?
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

            `SELECT id_captura, peso, fecha_hora FROM capturas
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



// desactivar registro de peso
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

}

// activar registro de peso
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

}