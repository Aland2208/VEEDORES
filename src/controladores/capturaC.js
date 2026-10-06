import { conmysql } from "../db.js";
import { getIO } from "../websocket/socket.js";


// ==========================================
// REGISTRAR CAPTURA COMPLETA
// ==========================================

export const registrarCaptura = async (req, res) => {

    // ======================================
    // CONEXIÓN PARA TRANSACCIÓN
    // ======================================

    let connection = null;


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
        // CONVERTIR VALORES
        // ======================================

        const idEspecieFinal =
            Number(id_especie);

        const idUsuarioFinal =
            Number(id_usuario);

        const pesoFinal =
            Number(peso);

        const porcentajeFinal =
            porcentaje != null
                ? Number(porcentaje)
                : 0;


        // ======================================
        // VALIDAR ID ESPECIE
        // ======================================

        if (
            !Number.isInteger(idEspecieFinal) ||
            idEspecieFinal <= 0
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "El id_especie no es válido"

            });

        }


        // ======================================
        // VALIDAR ID USUARIO
        // ======================================

        if (
            !Number.isInteger(idUsuarioFinal) ||
            idUsuarioFinal <= 0
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "El id_usuario no es válido"

            });

        }


        // ======================================
        // VALIDAR PESO
        // ======================================

        if (
            !Number.isFinite(pesoFinal) ||
            pesoFinal <= 0
        ) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "El peso debe ser mayor a 0"

            });

        }


        // ======================================
        // VALIDAR PORCENTAJE
        // ======================================

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
        // OBTENER CONEXIÓN
        // ======================================

        connection =
            await conmysql.getConnection();


        // ======================================
        // INICIAR TRANSACCIÓN
        // ======================================

        await connection.beginTransaction();


        console.log(
            "🔄 Transacción iniciada"
        );


        // ======================================
        // 1. VALIDAR ESPECIE
        // ======================================

        const [especies] =
            await connection.query(

                `SELECT
                    id_especie,
                    nombre_comun,
                    nombre_cientifico
                 FROM especies
                 WHERE id_especie = ?
                 LIMIT 1`,

                [
                    idEspecieFinal
                ]

            );


        if (
            !especies ||
            especies.length === 0
        ) {

            await connection.rollback();

            connection.release();

            connection = null;


            return res.status(404).json({

                estado: 0,

                mensaje:
                    "La especie indicada no existe"

            });

        }


        // ======================================
        // 2. VALIDAR USUARIO
        // ======================================

        const [usuarios] =
            await connection.query(

                `SELECT
                    id_usuario,
                    nombre,
                    apellido,
                    id_rol
                 FROM usuarios
                 WHERE id_usuario = ?
                 LIMIT 1`,

                [
                    idUsuarioFinal
                ]

            );


        if (
            !usuarios ||
            usuarios.length === 0
        ) {

            await connection.rollback();

            connection.release();

            connection = null;


            return res.status(404).json({

                estado: 0,

                mensaje:
                    "El usuario indicado no existe"

            });

        }


        // ======================================
        // 3. CREAR DETECCIÓN
        // ======================================

        const [deteccion] =
            await connection.query(

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
                    idEspecieFinal,
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
        // 4. CREAR CAPTURA
        // ======================================

        const [captura] =
            await connection.query(

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
                    idUsuarioFinal,
                    pesoFinal
                ]

            );


        const id_captura =
            captura.insertId;


        console.log(
            "✅ Captura creada:",
            id_captura
        );


        // ======================================
        // 5. CREAR REPORTE PENDIENTE
        // ======================================
        //
        // Cada captura genera automáticamente
        // un reporte pendiente.
        //
        // id_tipo_reporte = NULL
        // titulo          = NULL
        // archivo_pdf     = 0
        // archivo_csv     = 0
        //
        // PDF:
        // 0 = No generado
        // 1 = Generado
        //
        // CSV:
        // 0 = No generado
        // 1 = Generado
        //
        // ======================================

        const [reporte] =
            await connection.query(

                `INSERT INTO reportes
                (
                    id_captura,
                    id_usuario,
                    id_tipo_reporte,
                    titulo,
                    archivo_pdf,
                    archivo_csv,
                    fecha_generacion
                )
                VALUES
                (
                    ?,
                    ?,
                    NULL,
                    NULL,
                    0,
                    0,
                    CONVERT_TZ(
                        UTC_TIMESTAMP(),
                        '+00:00',
                        '-05:00'
                    )
                )`,

                [
                    id_captura,
                    idUsuarioFinal
                ]

            );


        const id_reporte =
            reporte.insertId;


        console.log(
            "📄 Reporte pendiente creado:",
            id_reporte
        );

        console.log(
            "🔗 Asociado a captura:",
            id_captura
        );

        console.log(
            "📋 Tipo de reporte: NULL"
        );

        console.log(
            "📝 Título: NULL"
        );

        console.log(
            "📄 PDF generado: NO"
        );

        console.log(
            "📊 CSV generado: NO"
        );


        // ======================================
        // 6. CONSULTAR RESULTADO COMPLETO
        // ======================================

        const [registro] =
            await connection.query(

                `SELECT

                    -- =========================
                    -- CAPTURA
                    -- =========================

                    c.id_captura,
                    c.peso,
                    c.estado,

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


                    -- =========================
                    -- DETECCIÓN
                    -- =========================

                    d.id_deteccion,
                    d.id_especie,
                    d.imagen_url,
                    d.porcentaje,


                    -- =========================
                    -- ESPECIE
                    -- =========================

                    e.nombre_comun
                        AS especie,

                    e.nombre_cientifico,


                    -- =========================
                    -- USUARIO
                    -- =========================

                    u.id_usuario,
                    u.nombre,
                    u.apellido,

                    CONCAT(
                        u.nombre,
                        ' ',
                        u.apellido
                    ) AS nombre_completo,


                    -- =========================
                    -- ROL
                    -- =========================

                    r.id_rol,
                    r.nombre_rol,


                    -- =========================
                    -- REPORTE
                    -- =========================

                    rep.id_reporte,

                    rep.id_tipo_reporte,

                    rep.titulo,

                    rep.archivo_pdf,

                    rep.archivo_csv,

                    DATE_FORMAT(
                        rep.fecha_generacion,
                        '%Y-%m-%d'
                    ) AS fecha_reporte,

                    DATE_FORMAT(
                        rep.fecha_generacion,
                        '%H:%i:%s'
                    ) AS hora_reporte,

                    DATE_FORMAT(
                        rep.fecha_generacion,
                        '%Y-%m-%d %H:%i:%s'
                    ) AS fecha_generacion


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


                LEFT JOIN reportes rep
                    ON c.id_captura =
                       rep.id_captura


                WHERE c.id_captura = ?

                LIMIT 1`,

                [
                    id_captura
                ]

            );


        // ======================================
        // 7. VALIDAR RESULTADO
        // ======================================

        if (
            !registro ||
            registro.length === 0
        ) {

            throw new Error(
                "La captura fue creada, pero no se pudo consultar el resultado completo"
            );

        }


        // ======================================
        // 8. CONFIRMAR TRANSACCIÓN
        // ======================================

        await connection.commit();


        console.log(
            "✅ Transacción confirmada"
        );


        // ======================================
        // LIBERAR CONEXIÓN
        // ======================================

        connection.release();

        connection = null;


        // ======================================
        // 9. WEBSOCKET
        // ======================================

        try {

            const io = getIO();


            if (io) {

                io.emit(
                    "nuevaCaptura",
                    registro[0]
                );


                console.log(
                    "📡 Evento nuevaCaptura enviado"
                );

            }

        }

        catch (socketError) {

            /*
             * Un error del WebSocket NO debe
             * deshacer una captura que ya fue
             * guardada correctamente.
             */

            console.error(
                "⚠️ Error enviando WebSocket:",
                socketError
            );

        }


        // ======================================
        // 10. MOSTRAR RESULTADO
        // ======================================

        console.log(
            "=========================================="
        );

        console.log(
            "📤 CAPTURA REGISTRADA:"
        );

        console.log(
            registro[0]
        );

        console.log(
            "=========================================="
        );


        // ======================================
        // 11. RESPUESTA
        // ======================================

        return res.status(201).json({

            estado: 1,

            mensaje:
                "Captura y reporte pendiente registrados correctamente",

            data:
                registro[0]

        });

    }

    catch (error) {

        // ======================================
        // ROLLBACK
        // ======================================

        if (connection) {

            try {

                await connection.rollback();


                console.log(
                    "↩️ Transacción revertida"
                );

            }

            catch (rollbackError) {

                console.error(
                    "❌ Error realizando rollback:",
                    rollbackError
                );

            }


            // ==================================
            // LIBERAR CONEXIÓN
            // ==================================

            try {

                connection.release();

            }

            catch (releaseError) {

                console.error(
                    "❌ Error liberando conexión:",
                    releaseError
                );

            }


            connection = null;

        }


        // ======================================
        // MOSTRAR ERROR
        // ======================================

        console.error(
            "❌ Error registrarCaptura:",
            error
        );


        // ======================================
        // RESPUESTA
        // ======================================

        return res.status(500).json({

            estado: 0,

            mensaje:
                "Error del servidor al registrar la captura",

            error:
                error.message

        });

    }

};