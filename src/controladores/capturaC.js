import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";


// ==========================================
// REGISTRAR CAPTURA COMPLETA
// ==========================================

export const registrarCaptura = async (req, res) => {


    try {


        const {

            id_especie,
            id_usuario,
            peso,
            imagen_url

        } = req.body;



        if (
            id_especie == null ||
            id_usuario == null ||
            peso == null
        ) {


            return res.status(400).json({

                estado:0,

                mensaje:
                "Debe enviar id_especie, id_usuario y peso"

            });


        }



        // =====================================
        // 1. CREAR DETECCION
        // =====================================


        const [deteccion] = await conmysql.query(

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



        const id_deteccion =
            deteccion.insertId;



        // =====================================
        // 2. CREAR CAPTURA
        // =====================================


        const [captura] = await conmysql.query(

            `INSERT INTO capturas
            (
                id_deteccion,
                id_usuario,
                peso,
                fecha_hora,
                estado
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
                ),
                1
            )`,

            [

                id_deteccion,

                id_usuario,

                peso

            ]

        );



        // =====================================
        // 3. CONSULTAR RESULTADO COMPLETO
        // =====================================


        const [registro] = await conmysql.query(

            `SELECT

                c.id_captura,

                c.peso,

                c.fecha_hora,


                d.id_deteccion,

                d.imagen_url,


                e.nombre_comun,

                e.nombre_cientifico,


                u.nombre,
                u.apellido


            FROM capturas c


            INNER JOIN detecciones d

            ON c.id_deteccion = d.id_deteccion


            INNER JOIN especies e

            ON d.id_especie = e.id_especie


            INNER JOIN usuarios u

            ON c.id_usuario = u.id_usuario



            WHERE c.id_captura = ?`,

            [

                captura.insertId

            ]

        );



        // =====================================
        // 4. WEBSOCKET
        // =====================================


        const io = getIO();


        if(io){

            io.emit(
                "nuevaCaptura",
                registro[0]
            );

        }




        res.status(201).json({


            estado:1,


            mensaje:
            "Captura registrada correctamente",


            data:
            registro[0]


        });



    }

    catch(error){


        console.log(error);


        res.status(500).json({

            estado:0,

            mensaje:
            "Error del servidor"

        });


    }


};