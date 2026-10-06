import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";


// ==========================================
// REGISTRAR CAPTURA COMPLETA
// ==========================================

export const registrarCaptura = async (req, res) => {

    try {

        // ======================================
        // RECIBIR DATOS
        // ======================================

        const {
            id_especie,
            id_usuario,
            peso,
            imagen_url,
            porcentaje
        } = req.body;


        console.log(
            "=========================================="
        );

        console.log(
            "📥 DATOS RECIBIDOS PARA CAPTURA:"
        );

        console.log(req.body);

        console.log(
            "=========================================="
        );


        // ======================================
        // VALIDAR CAMPOS OBLIGATORIOS
        // ======================================

        if (
            id_especie == null ||
            id_usuario == null ||
            peso == null
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "Debe enviar id_especie, id_usuario y peso"

            });

        }


        // ======================================
        // PREPARAR PORCENTAJE
        // ======================================

        const porcentajeFinal =
            porcentaje != null
                ? Number(porcentaje)
                : 0;


        if (
            !Number.isFinite(porcentajeFinal) ||
            porcentajeFinal < 0 ||
            porcentajeFinal > 100
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "El porcentaje debe estar entre 0 y 100"

            });

        }


        console.log(
            "🎯 Porcentaje recibido:",
            porcentajeFinal
        );


        // ======================================
        // 1. CREAR DETECCIÓN
        // ======================================

        const [deteccion] = await conmysql.query(

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


        const id_deteccion =
            deteccion.insertId;


        console.log(
            "✅ Detección creada:",
            id_deteccion
        );


        // ======================================
        // 2. CREAR CAPTURA
        // ======================================

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


        const id_captura =
            captura.insertId;


        console.log(
            "✅ Captura creada:",
            id_captura
        );


        // ======================================
        // 3. CREAR REGISTRO DE REPORTE PENDIENTE
        // ======================================
        //
        // Cuando se registra la captura:
        //
        // id_usuario       = usuario que capturó
        // id_tipo_reporte  = NULL
        // titulo           = NULL
        // archivo_pdf      = NULL
        //
        // El tipo de reporte se asignará
        // posteriormente desde el módulo Reportes.
        // ======================================

        const [reporte] = await conmysql.query(

            `INSERT INTO reportes
            (
                id_usuario,
                id_tipo_reporte,
                titulo,
                archivo_pdf,
                fecha_generacion
            )
            VALUES
            (
                ?,
                NULL,
                NULL,
                NULL,
                CONVERT_TZ(
                    UTC_TIMESTAMP(),
                    '+00:00',
                    '-05:00'
                )
            )`,

            [
                id_usuario
            ]

        );


        const id_reporte =
            reporte.insertId;


        console.log(
            "✅ Reporte pendiente creado:",
            id_reporte
        );

        console.log(
            "📄 Tipo de reporte: NULL"
        );


        // ======================================
        // 4. CONSULTAR RESULTADO COMPLETO
        // ======================================

        const [registro] = await conmysql.query(

            `SELECT

                -- CAPTURA

                c.id_captura,
                c.peso,

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
                ) AS fecha_hora,


                -- DETECCIÓN

                d.id_deteccion,
                d.id_especie,
                d.imagen_url,
                d.porcentaje,


                -- ESPECIE

                e.nombre_comun AS especie,
                e.nombre_cientifico,


                -- USUARIO

                u.id_usuario,
                u.nombre,
                u.apellido,

                CONCAT(
                    u.nombre,
                    ' ',
                    u.apellido
                ) AS nombre_completo,


                -- ROL

                r.id_rol,
                r.nombre_rol


            FROM capturas c


            INNER JOIN detecciones d
                ON c.id_deteccion =
                   d.id_deteccion


            INNER JOIN especies e
                ON d.id_especie =
                   e.id_especie


            INNER JOIN usuarios u
                ON c.id_usuario =
                   u.id_usuario


            INNER JOIN roles r
                ON u.id_rol =
                   r.id_rol


            WHERE c.id_captura = ?`,

            [
                id_captura
            ]

        );


        // ======================================
        // 5. PREPARAR RESULTADO
        // ======================================

        const resultadoCompleto = {

            ...registro[0],

            id_reporte:
                id_reporte,

            id_tipo_reporte:
                null

        };


        // ======================================
        // 6. WEBSOCKET
        // ======================================

        const io = getIO();


        if (io) {

            io.emit(
                "nuevaCaptura",
                resultadoCompleto
            );

        }


        // ======================================
        // 7. RESPUESTA
        // ======================================

        console.log(
            "=========================================="
        );

        console.log(
            "📤 CAPTURA REGISTRADA:"
        );

        console.log(
            resultadoCompleto
        );

        console.log(
            "=========================================="
        );


        res.status(201).json({

            estado: 1,

            mensaje:
                "Captura registrada correctamente",

            data:
                resultadoCompleto

        });

    }

    catch (error) {

        console.error(
            "❌ Error registrarCaptura:",
            error
        );


        res.status(500).json({

            estado: 0,

            mensaje:
                "Error del servidor"

        });

    }

};