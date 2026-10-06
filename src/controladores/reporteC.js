import { conmysql } from "../db.js";
import PDFDocument from "pdfkit";

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

// ======================================================
// OBTENER REPORTES PENDIENTES DEL DÍA
// ======================================================

export const getReportesPendientesHoy = async (req, res) => {

    try {

        // ==============================================
        // OBTENER USUARIO
        // ==============================================

        const { id_usuario } = req.params;


        // ==============================================
        // VALIDAR USUARIO
        // ==============================================

        if (!id_usuario) {

            return res.status(400).json({

                estado: 0,

                mensaje:
                    "Debe enviar el id_usuario"

            });

        }


        console.log(
            "=========================================="
        );

        console.log(
            "📄 CONSULTANDO REPORTES PENDIENTES DEL DÍA"
        );

        console.log(
            "👤 Usuario:",
            id_usuario
        );


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


        // ==============================================
        // VALIDAR QUE EL USUARIO EXISTA
        // ==============================================

        if (usuarios.length === 0) {

            return res.status(404).json({

                estado: 0,

                mensaje:
                    "Usuario no encontrado"

            });

        }


        // ==============================================
        // CONSULTAR REPORTES PENDIENTES DE HOY
        // ==============================================

        const [reportes] = await conmysql.query(

            `SELECT

                -- ======================================
                -- REPORTE
                -- ======================================
                rep.id_reporte,
                rep.id_captura,
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
                ) AS fecha_generacion,


                -- ======================================
                -- CAPTURA
                -- ======================================

                c.peso,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d'
                ) AS fecha_captura,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%H:%i:%s'
                ) AS hora_captura,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d %H:%i:%s'
                ) AS fecha_hora_captura,


                -- ======================================
                -- DETECCIÓN
                -- ======================================

                d.id_deteccion,

                d.porcentaje,

                d.imagen_url,


                -- ======================================
                -- ESPECIE
                -- ======================================

                e.id_especie,

                e.nombre_comun
                    AS especie,

                e.nombre_cientifico,


                -- ======================================
                -- USUARIO
                -- ======================================

                u.id_usuario,

                u.nombre,

                u.apellido,

                CONCAT(
                    u.nombre,
                    ' ',
                    u.apellido
                ) AS nombre_completo,


                -- ======================================
                -- ROL
                -- ======================================

                r.id_rol,

                r.nombre_rol


            FROM reportes rep


            INNER JOIN capturas c
                ON rep.id_captura =
                   c.id_captura


            INNER JOIN detecciones d
                ON c.id_deteccion =
                   d.id_deteccion


            INNER JOIN especies e
                ON d.id_especie =
                   e.id_especie


            INNER JOIN usuarios u
                ON rep.id_usuario =
                   u.id_usuario


            INNER JOIN roles r
                ON u.id_rol =
                   r.id_rol


            WHERE

                rep.id_usuario = ?

                AND rep.id_tipo_reporte IS NULL

                AND c.estado = 1

                AND DATE(
                    rep.fecha_generacion
                ) = DATE(
                    CONVERT_TZ(
                        UTC_TIMESTAMP(),
                        '+00:00',
                        '-05:00'
                    )
                )


            ORDER BY

                rep.fecha_generacion DESC`,

            [id_usuario]

        );


        // ==============================================
        // CALCULAR TOTAL DE REGISTROS
        // ==============================================

        const totalRegistros =
            reportes.length;


        // ==============================================
        // CALCULAR PESO TOTAL
        // ==============================================

        const pesoTotal =
            reportes.reduce(

                (total, reporte) => {

                    return total +
                        Number(
                            reporte.peso || 0
                        );

                },

                0

            );


        // ==============================================
        // CALCULAR CONFIANZA TOTAL
        // ==============================================

        const confianzaTotal =
            reportes.reduce(

                (total, reporte) => {

                    return total +
                        Number(
                            reporte.porcentaje || 0
                        );

                },

                0

            );


        // ==============================================
        // CALCULAR CONFIANZA PROMEDIO
        // ==============================================

        const confianzaPromedio =

            totalRegistros > 0

                ? confianzaTotal /
                  totalRegistros

                : 0;


        // ==============================================
        // RESPUESTA
        // ==============================================

        console.log(
            "📊 Registros encontrados:",
            totalRegistros
        );

        console.log(
            "⚖️ Peso total:",
            pesoTotal
        );

        console.log(
            "🎯 Confianza promedio:",
            confianzaPromedio
        );

        console.log(
            "=========================================="
        );


        return res.status(200).json({

            estado: 1,

            mensaje:
                "Reportes pendientes del día obtenidos correctamente",

            usuario:
                usuarios[0],

            resumen: {

                total_registros:
                    totalRegistros,

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
                reportes

        });

    }

    catch (error) {

        console.error(
            "❌ Error getReportesPendientesHoy:",
            error
        );


        return res.status(500).json({

            estado: 0,

            mensaje:
                "Error del servidor",

            error:
                error.message

        });
    }
};

// ======================================================
// FUNCIONES AUXILIARES PARA GENERACIÓN DE ARCHIVOS
// ======================================================

const validarDatosGeneracion = ({
    id_usuario,
    id_especie,
    ids_reportes,
    id_tipo_reporte,
    titulo
}) => {

    if (!id_usuario) {
        return "Debe enviar el id_usuario";
    }

    if (!id_especie) {
        return "Debe enviar el id_especie";
    }

    if (
        !Array.isArray(ids_reportes) ||
        ids_reportes.length === 0
    ) {
        return "Debe enviar al menos un id_reporte";
    }

    if (!id_tipo_reporte) {
        return "Debe seleccionar un tipo de reporte";
    }

    if (
        !titulo ||
        String(titulo).trim() === ""
    ) {
        return "Debe ingresar el título del reporte";
    }

    return null;
};


// ======================================================
// CONSULTAR Y VALIDAR REPORTES DE UNA ESPECIE
// ======================================================

const obtenerDatosReportesEspecie = async (
    conexion,
    {
        id_usuario,
        id_especie,
        ids_reportes
    }
) => {

    // ----------------------------------------------
    // ELIMINAR IDs REPETIDOS Y VALIDARLOS
    // ----------------------------------------------

    const idsUnicos = [
        ...new Set(
            ids_reportes
                .map(id => Number(id))
                .filter(id =>
                    Number.isInteger(id) &&
                    id > 0
                )
        )
    ];


    if (idsUnicos.length === 0) {

        const error =
            new Error(
                "No existen IDs de reportes válidos"
            );

        error.status = 400;

        throw error;
    }


    // ----------------------------------------------
    // PLACEHOLDERS PARA IN (?, ?, ?)
    // ----------------------------------------------

    const placeholders =
        idsUnicos
            .map(() => "?")
            .join(",");


    // ----------------------------------------------
    // CONSULTAR DATOS REALES
    // ----------------------------------------------

    const [reportes] =
        await conexion.query(

            `SELECT

                -- REPORTE
                rep.id_reporte,
                rep.id_captura,
                rep.id_usuario,
                rep.id_tipo_reporte,
                rep.titulo,
                rep.archivo_pdf,
                rep.archivo_csv,

                DATE_FORMAT(
                    rep.fecha_generacion,
                    '%Y-%m-%d'
                ) AS fecha_reporte,

                -- CAPTURA
                c.peso,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%Y-%m-%d'
                ) AS fecha_captura,

                DATE_FORMAT(
                    c.fecha_hora,
                    '%H:%i:%s'
                ) AS hora_captura,

                -- DETECCIÓN
                d.id_deteccion,
                d.porcentaje,
                d.imagen_url,

                -- ESPECIE
                e.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,

                -- USUARIO
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

            FROM reportes rep

            INNER JOIN capturas c
                ON rep.id_captura =
                   c.id_captura

            INNER JOIN detecciones d
                ON c.id_deteccion =
                   d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie =
                   e.id_especie

            INNER JOIN usuarios u
                ON rep.id_usuario =
                   u.id_usuario

            INNER JOIN roles r
                ON u.id_rol =
                   r.id_rol

            WHERE

                rep.id_usuario = ?

                AND d.id_especie = ?

                AND rep.id_tipo_reporte IS NULL

                AND c.estado = 1

                AND DATE(
                    rep.fecha_generacion
                ) = DATE(
                    CONVERT_TZ(
                        UTC_TIMESTAMP(),
                        '+00:00',
                        '-05:00'
                    )
                )

                AND rep.id_reporte
                    IN (${placeholders})

            ORDER BY
                c.fecha_hora ASC`,

            [
                Number(id_usuario),
                Number(id_especie),
                ...idsUnicos
            ]

        );


    // ----------------------------------------------
    // VALIDAR QUE TODOS LOS IDs COINCIDAN
    // ----------------------------------------------

    if (
        reportes.length !==
        idsUnicos.length
    ) {

        const error =
            new Error(
                "Uno o más reportes no pertenecen al usuario, a la especie seleccionada, no corresponden al día de hoy o ya fueron enviados"
            );

        error.status = 400;

        throw error;
    }


    return {
        reportes,
        idsUnicos
    };
};


// ======================================================
// VALIDAR TIPO DE REPORTE
// ======================================================

const validarTipoReporte = async (
    conexion,
    id_tipo_reporte
) => {

    const [tipos] =
        await conexion.query(

            `SELECT
                id_tipo_reporte,
                nombre_tipo
            FROM tipos_reporte
            WHERE id_tipo_reporte = ?
            LIMIT 1`,

            [
                Number(
                    id_tipo_reporte
                )
            ]

        );


    if (tipos.length === 0) {

        const error =
            new Error(
                "El tipo de reporte seleccionado no existe"
            );

        error.status = 400;

        throw error;
    }


    return tipos[0];
};


// ======================================================
// DESCARGAR IMAGEN DESDE CLOUDINARY
// ======================================================

const descargarImagen = async (
    imagenUrl
) => {

    try {

        if (!imagenUrl) {
            return null;
        }


        const respuesta =
            await fetch(
                imagenUrl,
                {
                    signal:
                        AbortSignal.timeout(
                            10000
                        )
                }
            );


        if (!respuesta.ok) {

            console.warn(
                "⚠️ No se pudo descargar imagen:",
                imagenUrl
            );

            return null;
        }


        const arrayBuffer =
            await respuesta.arrayBuffer();


        return Buffer.from(
            arrayBuffer
        );

    }

    catch (error) {

        console.warn(
            "⚠️ Error descargando imagen:",
            error.message
        );

        return null;
    }
};


// ======================================================
// CREAR PDF EN MEMORIA
// ======================================================

const crearPDFBuffer = async ({
    reportes,
    tipoReporte,
    titulo
}) => {

    return new Promise(
        async (resolve, reject) => {

            try {

                const doc =
                    new PDFDocument({
                        size: "A4",
                        margin: 45,
                        bufferPages: true,
                        info: {
                            Title:
                                String(titulo),
                            Author:
                                "Sistema VEEDOR",
                            Subject:
                                "Reporte de capturas"
                        }
                    });


                const partes = [];


                doc.on(
                    "data",
                    chunk => {
                        partes.push(chunk);
                    }
                );


                doc.on(
                    "end",
                    () => {

                        resolve(
                            Buffer.concat(
                                partes
                            )
                        );

                    }
                );


                doc.on(
                    "error",
                    reject
                );


                const primero =
                    reportes[0];


                // ==========================================
                // COLORES
                // ==========================================

                const ABYSS =
                    "#0A1F33";

                const TEAL =
                    "#12969E";

                const SLATE =
                    "#5A6B7A";

                const FOAM =
                    "#F2F7FA";

                const BORDER =
                    "#DDE6EA";


                // ==========================================
                // FUNCIONES INTERNAS DEL PDF
                // ==========================================

                const anchoPagina =
                    doc.page.width -
                    doc.page.margins.left -
                    doc.page.margins.right;


                const agregarNuevaPagina =
                    () => {

                        doc.addPage();

                        doc
                            .font("Helvetica")
                            .fontSize(8)
                            .fillColor(SLATE)
                            .text(
                                "Sistema VEEDOR",
                                {
                                    align:
                                        "right"
                                }
                            );

                        doc.moveDown(1);

                    };


                const verificarEspacio =
                    (altoNecesario) => {

                        const limite =
                            doc.page.height -
                            doc.page.margins.bottom -
                            35;


                        if (
                            doc.y +
                            altoNecesario >
                            limite
                        ) {

                            agregarNuevaPagina();

                        }

                    };


                // ==========================================
                // ENCABEZADO
                // ==========================================

                doc
                    .font("Helvetica-Bold")
                    .fontSize(10)
                    .fillColor(TEAL)
                    .text(
                        "SISTEMA VEEDOR"
                    );


                doc
                    .moveDown(0.5)
                    .font("Helvetica-Bold")
                    .fontSize(22)
                    .fillColor(ABYSS)
                    .text(
                        String(titulo)
                    );


                doc
                    .moveDown(0.3)
                    .font("Helvetica")
                    .fontSize(10)
                    .fillColor(SLATE)
                    .text(
                        tipoReporte.nombre_tipo
                    );


                doc.moveDown(1.2);


                doc
                    .strokeColor(TEAL)
                    .lineWidth(2)
                    .moveTo(
                        doc.page.margins.left,
                        doc.y
                    )
                    .lineTo(
                        doc.page.width -
                        doc.page.margins.right,
                        doc.y
                    )
                    .stroke();


                doc.moveDown(1.5);


                // ==========================================
                // INFORMACIÓN GENERAL
                // ==========================================

                doc
                    .font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor(ABYSS)
                    .text(
                        "Información general"
                    );


                doc.moveDown(0.7);


                const infoY =
                    doc.y;


                const columna1 =
                    doc.page.margins.left;


                const columna2 =
                    doc.page.margins.left +
                    anchoPagina / 2;


                doc
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor(SLATE)
                    .text(
                        "Especie",
                        columna1,
                        infoY
                    );


                doc
                    .font("Helvetica-Bold")
                    .fontSize(11)
                    .fillColor(ABYSS)
                    .text(
                        primero.especie,
                        columna1,
                        infoY + 14
                    );


                doc
                    .font("Helvetica-Oblique")
                    .fontSize(9)
                    .fillColor(SLATE)
                    .text(
                        primero.nombre_cientifico ||
                        "",
                        columna1,
                        infoY + 30
                    );


                doc
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor(SLATE)
                    .text(
                        "Responsable",
                        columna2,
                        infoY
                    );


                doc
                    .font("Helvetica-Bold")
                    .fontSize(11)
                    .fillColor(ABYSS)
                    .text(
                        primero.nombre_completo,
                        columna2,
                        infoY + 14
                    );


                doc
                    .font("Helvetica")
                    .fontSize(9)
                    .fillColor(SLATE)
                    .text(
                        primero.nombre_rol || "",
                        columna2,
                        infoY + 30
                    );


                doc.y =
                    infoY + 58;


                // ==========================================
                // CALCULAR RESUMEN
                // ==========================================

                const totalCapturas =
                    reportes.length;


                const pesoTotal =
                    reportes.reduce(
                        (total, item) =>
                            total +
                            Number(
                                item.peso || 0
                            ),
                        0
                    );


                const confianzaTotal =
                    reportes.reduce(
                        (total, item) =>
                            total +
                            Number(
                                item.porcentaje || 0
                            ),
                        0
                    );


                const confianzaPromedio =
                    totalCapturas > 0
                        ? confianzaTotal /
                          totalCapturas
                        : 0;


                // ==========================================
                // RESUMEN
                // ==========================================

                verificarEspacio(100);


                doc
                    .font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor(ABYSS)
                    .text(
                        "Resumen"
                    );


                doc.moveDown(0.7);


                const resumenY =
                    doc.y;


                const espacio =
                    8;


                const anchoCaja =
                    (
                        anchoPagina -
                        espacio * 2
                    ) / 3;


                const cajas = [

                    {
                        titulo:
                            "Capturas",
                        valor:
                            String(
                                totalCapturas
                            )
                    },

                    {
                        titulo:
                            "Peso acumulado",
                        valor:
                            `${pesoTotal.toFixed(2)} g`
                    },

                    {
                        titulo:
                            "Confianza promedio",
                        valor:
                            `${confianzaPromedio.toFixed(2)} %`
                    }

                ];


                cajas.forEach(
                    (caja, index) => {

                        const x =
                            doc.page.margins.left +
                            index *
                            (
                                anchoCaja +
                                espacio
                            );


                        doc
                            .roundedRect(
                                x,
                                resumenY,
                                anchoCaja,
                                55,
                                7
                            )
                            .fill(FOAM);


                        doc
                            .font("Helvetica")
                            .fontSize(8)
                            .fillColor(SLATE)
                            .text(
                                caja.titulo,
                                x + 10,
                                resumenY + 10,
                                {
                                    width:
                                        anchoCaja - 20
                                }
                            );


                        doc
                            .font("Helvetica-Bold")
                            .fontSize(13)
                            .fillColor(ABYSS)
                            .text(
                                caja.valor,
                                x + 10,
                                resumenY + 28,
                                {
                                    width:
                                        anchoCaja - 20
                                }
                            );

                    }
                );


                doc.y =
                    resumenY + 75;


                // ==========================================
                // DETALLE DE CAPTURAS
                // ==========================================

                verificarEspacio(100);


                doc
                    .font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor(ABYSS)
                    .text(
                        "Detalle de capturas"
                    );


                doc.moveDown(0.7);


                const dibujarCabeceraTabla =
                    () => {

                        const y =
                            doc.y;


                        doc
                            .rect(
                                doc.page.margins.left,
                                y,
                                anchoPagina,
                                24
                            )
                            .fill(ABYSS);


                        doc
                            .font("Helvetica-Bold")
                            .fontSize(8)
                            .fillColor("#FFFFFF");


                        doc.text(
                            "Registro",
                            55,
                            y + 8,
                            {
                                width: 80
                            }
                        );


                        doc.text(
                            "Peso",
                            155,
                            y + 8,
                            {
                                width: 80
                            }
                        );


                        doc.text(
                            "Confianza",
                            265,
                            y + 8,
                            {
                                width: 90
                            }
                        );


                        doc.text(
                            "Hora",
                            395,
                            y + 8,
                            {
                                width: 100
                            }
                        );


                        doc.y =
                            y + 24;

                    };


                dibujarCabeceraTabla();


                for (
                    const captura of reportes
                ) {

                    verificarEspacio(28);


                    const y =
                        doc.y;


                    doc
                        .rect(
                            doc.page.margins.left,
                            y,
                            anchoPagina,
                            25
                        )
                        .strokeColor(BORDER)
                        .lineWidth(0.5)
                        .stroke();


                    doc
                        .font("Helvetica-Bold")
                        .fontSize(8)
                        .fillColor(TEAL)
                        .text(
                            `#${captura.id_captura}`,
                            55,
                            y + 8,
                            {
                                width: 80
                            }
                        );


                    doc
                        .font("Helvetica")
                        .fillColor(ABYSS)
                        .text(
                            `${Number(
                                captura.peso || 0
                            ).toFixed(2)} g`,
                            155,
                            y + 8,
                            {
                                width: 80
                            }
                        );


                    doc.text(
                        `${Number(
                            captura.porcentaje || 0
                        ).toFixed(2)} %`,
                        265,
                        y + 8,
                        {
                            width: 90
                        }
                    );


                    doc.text(
                        captura.hora_captura ||
                        "",
                        395,
                        y + 8,
                        {
                            width: 100
                        }
                    );


                    doc.y =
                        y + 25;

                }


                doc.moveDown(1.5);


                // ==========================================
                // EVIDENCIAS FOTOGRÁFICAS
                // ==========================================

                verificarEspacio(160);


                doc
                    .font("Helvetica-Bold")
                    .fontSize(13)
                    .fillColor(ABYSS)
                    .text(
                        "Evidencias fotográficas"
                    );


                doc
                    .moveDown(0.3)
                    .font("Helvetica")
                    .fontSize(8)
                    .fillColor(SLATE)
                    .text(
                        "Imágenes correspondientes a las capturas incluidas en este reporte."
                    );


                doc.moveDown(1);


                // ==========================================
                // DESCARGAR IMÁGENES
                // ==========================================

                const imagenes = [];


                for (
                    const captura of reportes
                ) {

                    const buffer =
                        await descargarImagen(
                            captura.imagen_url
                        );


                    imagenes.push({
                        captura,
                        buffer
                    });

                }


                // ==========================================
                // COLLAGE
                // ==========================================

                const columnas =
                    3;


                const separacion =
                    8;


                const anchoImagen =
                    (
                        anchoPagina -
                        separacion *
                        (
                            columnas - 1
                        )
                    ) /
                    columnas;


                const altoImagen =
                    105;


                let columna =
                    0;


                let yCollage =
                    doc.y;


                for (
                    const item of imagenes
                ) {

                    // --------------------------------------
                    // NUEVA PÁGINA SI NO HAY ESPACIO
                    // --------------------------------------

                    if (
                        yCollage +
                        altoImagen +
                        30 >
                        doc.page.height -
                        doc.page.margins.bottom
                    ) {

                        agregarNuevaPagina();

                        yCollage =
                            doc.y;

                        columna =
                            0;

                    }


                    const x =
                        doc.page.margins.left +
                        columna *
                        (
                            anchoImagen +
                            separacion
                        );


                    // --------------------------------------
                    // MARCO
                    // --------------------------------------

                    doc
                        .roundedRect(
                            x,
                            yCollage,
                            anchoImagen,
                            altoImagen + 22,
                            6
                        )
                        .strokeColor(BORDER)
                        .lineWidth(0.7)
                        .stroke();


                    // --------------------------------------
                    // IMAGEN
                    // --------------------------------------

                    if (item.buffer) {

                        try {

                            doc.image(
                                item.buffer,
                                x + 4,
                                yCollage + 4,
                                {
                                    fit: [
                                        anchoImagen - 8,
                                        altoImagen - 8
                                    ],
                                    align:
                                        "center",
                                    valign:
                                        "center"
                                }
                            );

                        }

                        catch (error) {

                            console.warn(
                                "⚠️ PDFKit no pudo insertar una imagen:",
                                error.message
                            );


                            doc
                                .font("Helvetica")
                                .fontSize(8)
                                .fillColor(SLATE)
                                .text(
                                    "Imagen no disponible",
                                    x + 10,
                                    yCollage + 45,
                                    {
                                        width:
                                            anchoImagen - 20,
                                        align:
                                            "center"
                                    }
                                );

                        }

                    }

                    else {

                        doc
                            .font("Helvetica")
                            .fontSize(8)
                            .fillColor(SLATE)
                            .text(
                                "Imagen no disponible",
                                x + 10,
                                yCollage + 45,
                                {
                                    width:
                                        anchoImagen - 20,
                                    align:
                                        "center"
                                }
                            );

                    }


                    // --------------------------------------
                    // NÚMERO CAPTURA
                    // --------------------------------------

                    doc
                        .font("Helvetica-Bold")
                        .fontSize(8)
                        .fillColor(ABYSS)
                        .text(
                            `Captura #${item.captura.id_captura}`,
                            x + 6,
                            yCollage +
                            altoImagen +
                            5,
                            {
                                width:
                                    anchoImagen - 12,
                                align:
                                    "center"
                            }
                        );


                    columna++;


                    // --------------------------------------
                    // NUEVA FILA
                    // --------------------------------------

                    if (
                        columna ===
                        columnas
                    ) {

                        columna =
                            0;

                        yCollage +=
                            altoImagen +
                            30;

                    }

                }


                if (columna !== 0) {

                    yCollage +=
                        altoImagen +
                        30;

                }


                doc.y =
                    yCollage;


                // ==========================================
                // PIE FINAL
                // ==========================================

                verificarEspacio(50);


                doc.moveDown(1);


                doc
                    .font("Helvetica")
                    .fontSize(8)
                    .fillColor(SLATE)
                    .text(
                        `Documento generado por Sistema VEEDOR · ${new Date().toLocaleString(
                            "es-EC",
                            {
                                timeZone:
                                    "America/Guayaquil"
                            }
                        )}`,
                        {
                            align:
                                "center"
                        }
                    );


                // ==========================================
                // FINALIZAR
                // ==========================================

                doc.end();

            }

            catch (error) {

                reject(error);

            }

        }
    );
};


// ======================================================
// GENERAR PDF POR ESPECIE
// ======================================================

export const generarPDFEspecie = async (
    req,
    res
) => {

    let conexion = null;

    try {

        console.log(
            "=========================================="
        );

        console.log(
            "📄 GENERANDO PDF POR ESPECIE"
        );


        // ==============================================
        // DATOS RECIBIDOS
        // ==============================================

        const {

            id_usuario,

            id_especie,

            ids_reportes,

            id_tipo_reporte,

            titulo

        } = req.body;


        console.log(
            "👤 Usuario:",
            id_usuario
        );

        console.log(
            "🐟 Especie:",
            id_especie
        );

        console.log(
            "📋 Reportes:",
            ids_reportes
        );


        // ==============================================
        // VALIDACIONES BÁSICAS
        // ==============================================

        const errorValidacion =
            validarDatosGeneracion({
                id_usuario,
                id_especie,
                ids_reportes,
                id_tipo_reporte,
                titulo
            });


        if (errorValidacion) {

            return res
                .status(400)
                .json({
                    estado: 0,
                    mensaje:
                        errorValidacion
                });

        }


        // ==============================================
        // OBTENER CONEXIÓN
        // ==============================================

        conexion =
            await conmysql.getConnection();


        // ==============================================
        // VALIDAR TIPO DE REPORTE
        // ==============================================

        const tipoReporte =
            await validarTipoReporte(
                conexion,
                id_tipo_reporte
            );


        // ==============================================
        // OBTENER REPORTES
        // ==============================================

        const {
            reportes,
            idsUnicos
        } =
            await obtenerDatosReportesEspecie(
                conexion,
                {
                    id_usuario,
                    id_especie,
                    ids_reportes
                }
            );


        console.log(
            "📊 Capturas válidas:",
            reportes.length
        );


        // ==============================================
        // CREAR PDF
        // ==============================================

        const pdfBuffer =
            await crearPDFBuffer({
                reportes,
                tipoReporte,
                titulo:
                    String(
                        titulo
                    ).trim()
            });


        if (
            !pdfBuffer ||
            pdfBuffer.length === 0
        ) {

            throw new Error(
                "No fue posible generar el archivo PDF"
            );

        }


        console.log(
            "📦 PDF generado:",
            pdfBuffer.length,
            "bytes"
        );


        // ==============================================
        // ACTUALIZAR ESTADO PDF
        // ==============================================

        const placeholders =
            idsUnicos
                .map(() => "?")
                .join(",");


        await conexion.query(

            `UPDATE reportes

             SET archivo_pdf = 1

             WHERE id_reporte
             IN (${placeholders})

             AND id_usuario = ?`,

            [
                ...idsUnicos,
                Number(id_usuario)
            ]

        );


        console.log(
            "✅ archivo_pdf actualizado a 1"
        );


        // ==============================================
        // NOMBRE DEL ARCHIVO
        // ==============================================

        const especie =
            reportes[0]
                .especie
                .replace(
                    /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g,
                    "_"
                );


        const fecha =
            new Date()
                .toLocaleDateString(
                    "en-CA",
                    {
                        timeZone:
                            "America/Guayaquil"
                    }
                );


        const nombreArchivo =
            `reporte_${especie}_${fecha}.pdf`;


        // ==============================================
        // ENVIAR PDF
        // ==============================================

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );


        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${nombreArchivo}"`
        );


        res.setHeader(
            "Content-Length",
            pdfBuffer.length
        );


        console.log(
            "⬇️ Enviando PDF:",
            nombreArchivo
        );

        console.log(
            "=========================================="
        );


        return res
            .status(200)
            .send(pdfBuffer);

    }

    catch (error) {

        console.error(
            "❌ Error generarPDFEspecie:",
            error
        );


        // IMPORTANTE:
        // si todavía no enviamos el PDF,
        // podemos responder JSON normalmente.

        if (!res.headersSent) {

            return res
                .status(
                    error.status ||
                    500
                )
                .json({

                    estado: 0,

                    mensaje:
                        error.message ||
                        "Error al generar el PDF"

                });

        }

    }

    finally {

        if (conexion) {

            conexion.release();

        }

    }

};


// ======================================================
// ESCAPAR VALORES PARA CSV
// ======================================================

const escaparCSV = (
    valor
) => {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }


    const texto =
        String(valor);


    return `"${texto.replace(
        /"/g,
        '""'
    )}"`;

};


// ======================================================
// GENERAR CSV POR ESPECIE
// ======================================================

export const generarCSVEspecie = async (
    req,
    res
) => {

    let conexion = null;

    try {

        console.log(
            "=========================================="
        );

        console.log(
            "📊 GENERANDO CSV POR ESPECIE"
        );


        // ==============================================
        // DATOS RECIBIDOS
        // ==============================================

        const {

            id_usuario,

            id_especie,

            ids_reportes,

            id_tipo_reporte,

            titulo

        } = req.body;


        // ==============================================
        // VALIDACIONES
        // ==============================================

        const errorValidacion =
            validarDatosGeneracion({
                id_usuario,
                id_especie,
                ids_reportes,
                id_tipo_reporte,
                titulo
            });


        if (errorValidacion) {

            return res
                .status(400)
                .json({
                    estado: 0,
                    mensaje:
                        errorValidacion
                });

        }


        // ==============================================
        // CONEXIÓN
        // ==============================================

        conexion =
            await conmysql.getConnection();


        // ==============================================
        // VALIDAR TIPO
        // ==============================================

        const tipoReporte =
            await validarTipoReporte(
                conexion,
                id_tipo_reporte
            );


        // ==============================================
        // OBTENER DATOS
        // ==============================================

        const {
            reportes,
            idsUnicos
        } =
            await obtenerDatosReportesEspecie(
                conexion,
                {
                    id_usuario,
                    id_especie,
                    ids_reportes
                }
            );


        // ==============================================
        // CABECERAS CSV
        // ==============================================

        const filas = [];


        filas.push([
            "ID Reporte",
            "ID Captura",
            "Tipo de reporte",
            "Título",
            "Especie",
            "Nombre científico",
            "Peso (g)",
            "Confianza (%)",
            "Fecha",
            "Hora",
            "Responsable",
            "Imagen"
        ]);


        // ==============================================
        // DATOS
        // ==============================================

        for (
            const captura of reportes
        ) {

            filas.push([

                captura.id_reporte,

                captura.id_captura,

                tipoReporte.nombre_tipo,

                String(
                    titulo
                ).trim(),

                captura.especie,

                captura.nombre_cientifico,

                Number(
                    captura.peso || 0
                ).toFixed(2),

                Number(
                    captura.porcentaje || 0
                ).toFixed(2),

                captura.fecha_captura,

                captura.hora_captura,

                captura.nombre_completo,

                captura.imagen_url || ""

            ]);

        }


        // ==============================================
        // CONVERTIR A CSV
        // ==============================================

        const contenidoCSV =
            filas
                .map(
                    fila =>
                        fila
                            .map(
                                escaparCSV
                            )
                            .join(",")
                )
                .join("\r\n");


        // ==============================================
        // BOM UTF-8
        // PARA QUE EXCEL RECONOZCA TILDES Y Ñ
        // ==============================================

        const csvBuffer =
            Buffer.from(
                "\uFEFF" +
                contenidoCSV,
                "utf8"
            );


        // ==============================================
        // ACTUALIZAR ESTADO CSV
        // ==============================================

        const placeholders =
            idsUnicos
                .map(() => "?")
                .join(",");


        await conexion.query(

            `UPDATE reportes

             SET archivo_csv = 1

             WHERE id_reporte
             IN (${placeholders})

             AND id_usuario = ?`,

            [
                ...idsUnicos,
                Number(id_usuario)
            ]

        );


        console.log(
            "✅ archivo_csv actualizado a 1"
        );


        // ==============================================
        // NOMBRE DEL ARCHIVO
        // ==============================================

        const especie =
            reportes[0]
                .especie
                .replace(
                    /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g,
                    "_"
                );


        const fecha =
            new Date()
                .toLocaleDateString(
                    "en-CA",
                    {
                        timeZone:
                            "America/Guayaquil"
                    }
                );


        const nombreArchivo =
            `reporte_${especie}_${fecha}.csv`;


        // ==============================================
        // ENVIAR CSV
        // ==============================================

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );


        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${nombreArchivo}"`
        );


        res.setHeader(
            "Content-Length",
            csvBuffer.length
        );


        console.log(
            "⬇️ Enviando CSV:",
            nombreArchivo
        );

        console.log(
            "=========================================="
        );


        return res
            .status(200)
            .send(csvBuffer);

    }

    catch (error) {

        console.error(
            "❌ Error generarCSVEspecie:",
            error
        );


        if (!res.headersSent) {

            return res
                .status(
                    error.status ||
                    500
                )
                .json({

                    estado: 0,

                    mensaje:
                        error.message ||
                        "Error al generar el CSV"

                });

        }

    }

    finally {

        if (conexion) {

            conexion.release();

        }

    }

};

// ======================================================
// ENVIAR / FINALIZAR REPORTE POR ESPECIE
// ======================================================

export const enviarReporteEspecie = async (req, res) => {
    let conexion;

    try {
        const { id_usuario, id_especie, ids_reportes, id_tipo_reporte, titulo } = req.body;

        console.log("==========================================");
        console.log("📤 ENVIANDO REPORTE POR ESPECIE");
        console.log("👤 Usuario:", id_usuario);
        console.log("🐟 Especie:", id_especie);
        console.log("📋 Reportes:", ids_reportes);

        // Validaciones básicas
        const idUsuario = Number(id_usuario);
        const idEspecie = Number(id_especie);
        const idTipo = Number(id_tipo_reporte);
        const tituloLimpio = String(titulo || "").trim();

        if (!Number.isInteger(idUsuario) || idUsuario <= 0)
            return res.status(400).json({ estado: 0, mensaje: "Usuario no válido" });

        if (!Number.isInteger(idEspecie) || idEspecie <= 0)
            return res.status(400).json({ estado: 0, mensaje: "Especie no válida" });

        if (!Number.isInteger(idTipo) || idTipo <= 0)
            return res.status(400).json({ estado: 0, mensaje: "Seleccione un tipo de reporte" });

        if (!tituloLimpio)
            return res.status(400).json({ estado: 0, mensaje: "Ingrese un título para el reporte" });

        if (tituloLimpio.length > 255)
            return res.status(400).json({ estado: 0, mensaje: "El título no puede superar 255 caracteres" });

        if (!Array.isArray(ids_reportes) || ids_reportes.length === 0)
            return res.status(400).json({ estado: 0, mensaje: "No existen reportes para enviar" });

        // Normalizar IDs y eliminar repetidos
        const ids = [...new Set(
            ids_reportes
                .map(Number)
                .filter(id => Number.isInteger(id) && id > 0)
        )];

        if (ids.length === 0)
            return res.status(400).json({ estado: 0, mensaje: "Los IDs de reportes no son válidos" });

        conexion = await conmysql.getConnection();
        await conexion.beginTransaction();

        // Verificar tipo de reporte
        const [tipos] = await conexion.query(`
            SELECT id_tipo_reporte, nombre_tipo
            FROM tipos_reporte
            WHERE id_tipo_reporte = ?
            LIMIT 1
        `, [idTipo]);

        if (tipos.length === 0) {
            await conexion.rollback();
            return res.status(400).json({ estado: 0, mensaje: "El tipo de reporte no existe" });
        }

        const placeholders = ids.map(() => "?").join(",");

        // Obtener y bloquear los reportes antes de modificarlos
        const [reportes] = await conexion.query(`
            SELECT rep.id_reporte, rep.id_captura, rep.id_usuario,
                   rep.id_tipo_reporte, rep.archivo_pdf, rep.archivo_csv,
                   c.estado, d.id_especie, e.nombre_comun AS especie
            FROM reportes rep
            INNER JOIN capturas c ON rep.id_captura = c.id_captura
            INNER JOIN detecciones d ON c.id_deteccion = d.id_deteccion
            INNER JOIN especies e ON d.id_especie = e.id_especie
            WHERE rep.id_usuario = ?
              AND d.id_especie = ?
              AND rep.id_reporte IN (${placeholders})
            FOR UPDATE
        `, [idUsuario, idEspecie, ...ids]);

        if (reportes.length !== ids.length) {
            await conexion.rollback();
            return res.status(400).json({
                estado: 0,
                mensaje: "Uno o más reportes no pertenecen al usuario o a la especie seleccionada"
            });
        }

        // No permitir volver a enviar un reporte finalizado
        if (reportes.some(r => r.id_tipo_reporte !== null)) {
            await conexion.rollback();
            return res.status(409).json({
                estado: 0,
                mensaje: "Uno o más reportes ya fueron enviados anteriormente"
            });
        }

        // Todas las capturas deben continuar activas
        if (reportes.some(r => Number(r.estado) !== 1)) {
            await conexion.rollback();
            return res.status(409).json({
                estado: 0,
                mensaje: "Una o más capturas ya no se encuentran activas"
            });
        }

        // Validar archivos desde BD, no solamente desde Angular
        if (reportes.some(r => Number(r.archivo_pdf) !== 1)) {
            await conexion.rollback();
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe generar el PDF antes de enviar el reporte"
            });
        }

        if (reportes.some(r => Number(r.archivo_csv) !== 1)) {
            await conexion.rollback();
            return res.status(400).json({
                estado: 0,
                mensaje: "Debe generar el CSV antes de enviar el reporte"
            });
        }

        // Finalizar todos los registros del grupo
        const [resultado] = await conexion.query(`
            UPDATE reportes
            SET id_tipo_reporte = ?, titulo = ?
            WHERE id_usuario = ?
              AND id_tipo_reporte IS NULL
              AND archivo_pdf = 1
              AND archivo_csv = 1
              AND id_reporte IN (${placeholders})
        `, [idTipo, tituloLimpio, idUsuario, ...ids]);

        if (resultado.affectedRows !== ids.length) {
            await conexion.rollback();
            return res.status(409).json({
                estado: 0,
                mensaje: "No se pudieron actualizar todos los reportes"
            });
        }

        await conexion.commit();

        console.log("✅ Reporte enviado correctamente");
        console.log("📋 Registros actualizados:", ids);
        console.log("📝 Tipo:", tipos[0].nombre_tipo);
        console.log("📌 Título:", tituloLimpio);
        console.log("==========================================");

        return res.status(200).json({
            estado: 1,
            mensaje: "Reporte enviado correctamente",
            data: {
                id_especie: idEspecie,
                especie: reportes[0].especie,
                id_tipo_reporte: idTipo,
                tipo_reporte: tipos[0].nombre_tipo,
                titulo: tituloLimpio,
                total_reportes: ids.length,
                ids_reportes: ids
            }
        });

    } catch (error) {
        if (conexion) {
            try { await conexion.rollback(); } catch {}
        }

        console.error("❌ Error enviarReporteEspecie:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error interno al enviar el reporte"
        });

    } finally {
        if (conexion) conexion.release();
    }
};

// ======================================================
// HISTORIAL DE REPORTES CON FILTROS Y PAGINACIÓN
// ======================================================

export const getHistorialReportes = async (req, res) => {
    try {
        const {
            id_usuario,
            fecha_inicio,
            fecha_fin,
            id_especie,
            id_observador,
            id_tipo_reporte,
            busqueda,
            pagina = 1,
            limite = 10
        } = req.query;

        const idUsuario = Number(id_usuario);
        const paginaActual = Math.max(Number(pagina) || 1, 1);
        const limitePagina = Math.min(Math.max(Number(limite) || 10, 1), 50);
        const offset = (paginaActual - 1) * limitePagina;

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Usuario no válido"
            });
        }

        console.log("==========================================");
        console.log("📚 CONSULTANDO HISTORIAL DE REPORTES");
        console.log("👤 Usuario:", idUsuario);
        console.log("📄 Página:", paginaActual);
        console.log("🔢 Límite:", limitePagina);

        // Condiciones dinámicas
        const condiciones = [
            "rep.id_usuario = ?",
            "rep.id_tipo_reporte IS NOT NULL",
            "rep.titulo IS NOT NULL",
            "rep.archivo_pdf = 1",
            "rep.archivo_csv = 1",
            "c.estado = 1"
        ];

        const parametros = [idUsuario];

        if (fecha_inicio) {
            condiciones.push("DATE(rep.fecha_generacion) >= ?");
            parametros.push(fecha_inicio);
        }

        if (fecha_fin) {
            condiciones.push("DATE(rep.fecha_generacion) <= ?");
            parametros.push(fecha_fin);
        }

        if (id_especie) {
            condiciones.push("d.id_especie = ?");
            parametros.push(Number(id_especie));
        }

        if (id_observador) {
            condiciones.push("rep.id_usuario = ?");
            parametros.push(Number(id_observador));
        }

        if (id_tipo_reporte) {
            condiciones.push("rep.id_tipo_reporte = ?");
            parametros.push(Number(id_tipo_reporte));
        }

        if (busqueda?.trim()) {
            condiciones.push("rep.titulo LIKE ?");
            parametros.push(`%${busqueda.trim()}%`);
        }

        const where = condiciones.join(" AND ");

        // ==================================================
        // CONTAR REPORTES AGRUPADOS
        // ==================================================

        const [conteo] = await conmysql.query(`
            SELECT COUNT(*) AS total
            FROM (
                SELECT
                    rep.id_usuario,
                    d.id_especie,
                    rep.id_tipo_reporte,
                    rep.titulo,
                    DATE(rep.fecha_generacion) AS fecha
                FROM reportes rep
                INNER JOIN capturas c ON rep.id_captura = c.id_captura
                INNER JOIN detecciones d ON c.id_deteccion = d.id_deteccion
                WHERE ${where}
                GROUP BY
                    rep.id_usuario,
                    d.id_especie,
                    rep.id_tipo_reporte,
                    rep.titulo,
                    DATE(rep.fecha_generacion)
            ) AS grupos
        `, parametros);

        const total = Number(conteo[0]?.total || 0);
        const totalPaginas = Math.ceil(total / limitePagina);

        // ==================================================
        // OBTENER SOLO LOS GRUPOS DE LA PÁGINA SOLICITADA
        // ==================================================

        const [grupos] = await conmysql.query(`
            SELECT
                MIN(rep.id_reporte) AS id_reporte_grupo,
                rep.id_usuario,
                d.id_especie,
                e.nombre_comun AS especie,
                e.nombre_cientifico,
                rep.id_tipo_reporte,
                tr.nombre_tipo,
                rep.titulo,
                DATE(rep.fecha_generacion) AS fecha,
                MAX(rep.fecha_generacion) AS fecha_generacion,
                COUNT(*) AS total_capturas,
                COALESCE(SUM(c.peso), 0) AS peso_total,
                COALESCE(AVG(d.porcentaje), 0) AS confianza_promedio,
                u.nombre,
                u.apellido
            FROM reportes rep
            INNER JOIN capturas c ON rep.id_captura = c.id_captura
            INNER JOIN detecciones d ON c.id_deteccion = d.id_deteccion
            INNER JOIN especies e ON d.id_especie = e.id_especie
            INNER JOIN tipos_reporte tr
                ON rep.id_tipo_reporte = tr.id_tipo_reporte
            INNER JOIN usuarios u ON rep.id_usuario = u.id_usuario
            WHERE ${where}
            GROUP BY
                rep.id_usuario,
                d.id_especie,
                e.nombre_comun,
                e.nombre_cientifico,
                rep.id_tipo_reporte,
                tr.nombre_tipo,
                rep.titulo,
                DATE(rep.fecha_generacion),
                u.nombre,
                u.apellido
            ORDER BY fecha_generacion DESC
            LIMIT ? OFFSET ?
        `, [...parametros, limitePagina, offset]);

        console.log("📊 Reportes encontrados:", total);
        console.log("📄 Grupos devueltos:", grupos.length);
        console.log("==========================================");

        return res.status(200).json({
            estado: 1,
            mensaje: "Historial obtenido correctamente",
            data: grupos,
            paginacion: {
                pagina_actual: paginaActual,
                limite: limitePagina,
                total_reportes: total,
                total_paginas: totalPaginas,
                tiene_anterior: paginaActual > 1,
                tiene_siguiente: paginaActual < totalPaginas
            }
        });

    } catch (error) {
        console.error("❌ Error getHistorialReportes:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error al obtener el historial de reportes"
        });
    }
};

export const getEspeciesFiltro = async (req, res) => {
    try {
        const [especies] = await conmysql.query(`
            SELECT id_especie, nombre_comun, nombre_cientifico
            FROM especies
            ORDER BY nombre_comun ASC
        `);

        return res.status(200).json({
            estado: 1,
            data: especies
        });

    } catch (error) {
        console.error("❌ Error getEspeciesFiltro:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error al obtener las especies"
        });
    }
};

// ======================================================
// DETALLE DE UN REPORTE DEL HISTORIAL
// ======================================================
export const getDetalleReporte = async (req, res) => {
    try {
        const { id_usuario, id_especie, id_tipo_reporte, titulo, fecha } = req.query;

        const idUsuario = Number(id_usuario);
        const idEspecie = Number(id_especie);
        const idTipo = Number(id_tipo_reporte);

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({ estado: 0, mensaje: "Usuario no válido" });
        }

        if (!Number.isInteger(idEspecie) || idEspecie <= 0) {
            return res.status(400).json({ estado: 0, mensaje: "Especie no válida" });
        }

        if (!Number.isInteger(idTipo) || idTipo <= 0) {
            return res.status(400).json({ estado: 0, mensaje: "Tipo de reporte no válido" });
        }

        if (!titulo?.trim() || !fecha) {
            return res.status(400).json({ estado: 0, mensaje: "Faltan datos para identificar el reporte" });
        }

        const [filas] = await conmysql.query(`
            SELECT
                rep.id_reporte,
                rep.titulo,
                rep.id_tipo_reporte,
                tr.nombre_tipo,
                rep.fecha_generacion,

                c.id_captura,
                c.peso,
                c.fecha_hora AS fecha_captura,

                d.id_deteccion,
                d.id_especie,
                d.porcentaje,
                d.imagen_url,

                e.nombre_comun AS especie,
                e.nombre_cientifico,

                u.id_usuario,
                u.nombre,
                u.apellido

            FROM reportes rep

            INNER JOIN capturas c
                ON rep.id_captura = c.id_captura

            INNER JOIN detecciones d
                ON c.id_deteccion = d.id_deteccion

            INNER JOIN especies e
                ON d.id_especie = e.id_especie

            INNER JOIN tipos_reporte tr
                ON rep.id_tipo_reporte = tr.id_tipo_reporte

            INNER JOIN usuarios u
                ON rep.id_usuario = u.id_usuario

            WHERE rep.id_usuario = ?
              AND d.id_especie = ?
              AND rep.id_tipo_reporte = ?
              AND rep.titulo = ?
              AND DATE(rep.fecha_generacion) = ?
              AND rep.archivo_pdf = 1
              AND rep.archivo_csv = 1
              AND c.estado = 1

            ORDER BY c.fecha_hora ASC
        `, [
            idUsuario,
            idEspecie,
            idTipo,
            titulo.trim(),
            fecha
        ]);

        if (!filas.length) {
            return res.status(404).json({
                estado: 0,
                mensaje: "No se encontró el reporte"
            });
        }

        const primero = filas[0];

        const capturas = filas.map(fila => ({
            id_reporte: fila.id_reporte,
            id_captura: fila.id_captura,
            id_deteccion: fila.id_deteccion,
            peso: Number(fila.peso || 0),
            porcentaje: Number(fila.porcentaje || 0),
            imagen_url: fila.imagen_url,
            fecha_hora: fila.fecha_captura
        }));

        const pesoTotal = capturas.reduce(
            (total, captura) => total + captura.peso,
            0
        );

        const confianzaPromedio = capturas.length
            ? capturas.reduce(
                (total, captura) => total + captura.porcentaje,
                0
              ) / capturas.length
            : 0;

        return res.status(200).json({
            estado: 1,
            mensaje: "Detalle obtenido correctamente",
            data: {
                titulo: primero.titulo,
                id_tipo_reporte: primero.id_tipo_reporte,
                nombre_tipo: primero.nombre_tipo,
                fecha: fecha,

                id_especie: primero.id_especie,
                especie: primero.especie,
                nombre_cientifico: primero.nombre_cientifico,

                id_usuario: primero.id_usuario,
                nombre: primero.nombre,
                apellido: primero.apellido,

                total_capturas: capturas.length,
                peso_total: Number(pesoTotal.toFixed(2)),
                confianza_promedio: Number(confianzaPromedio.toFixed(2)),

                capturas
            }
        });

    } catch (error) {
        console.error("❌ Error getDetalleReporte:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error al obtener el detalle del reporte"
        });
    }
};