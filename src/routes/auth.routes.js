import { Router } from "express";

import {
    registrarUsuario,
    verificarCorreo,
    loginUsuario,
    solicitarRecuperacion,
    restablecerPassword,
    obtenerPerfil,
    actualizarPerfil,
    cambiarPassword,
    validarTokenRecuperacion
} from "../controladores/authC.js";

import {
    requireOwnUserId,
    verifyToken
} from "../middlewares/verifyToken.js";

import { limitarSolicitudesRegistro } from "../middlewares/limitar-registro.js";
import { conmysql } from "../db.js";

const router = Router();

// =====================================================
// 1. REGISTRO E INICIO DE SESIÓN
// =====================================================

router.post(
    "/registro",
    limitarSolicitudesRegistro,
    registrarUsuario
);

router.post("/verificar-correo", verificarCorreo);

router.post("/login", loginUsuario);

// =====================================================
// 2. RECUPERACIÓN DE CONTRASEÑA
// =====================================================

router.post("/recuperar", solicitarRecuperacion);

router.get(
    "/validar-reset/:token",
    validarTokenRecuperacion
);

router.post(
    "/restablecer",
    restablecerPassword
);

// =====================================================
// 3. VALIDAR SESIÓN
// =====================================================

router.get("/sesion", verifyToken, (req, res) => {
    return res.status(200).json({
        estado: 1,
        data: {
            id_usuario: Number(req.usuario.id_usuario),
            id_rol: Number(req.usuario.id_rol)
        }
    });
});

// =====================================================
// 4. VALIDAR ACCESO A LA CÁMARA
// =====================================================
//
// accion=video
//   Verifica permiso para visualizar video en vivo.
//
// accion=captura
//   Verifica acceso a la cámara sin aplicar
//   restricciones de visualización.
//
// La restricción individual solo afecta al video.
// =====================================================

router.get("/sesion/camara", verifyToken, async (req, res) => {

    // -------------------------------------------------
    // A. VALIDAR URL DE LA CÁMARA
    // -------------------------------------------------

    let cameraOrigin;

    try {
        const parsedUrl = new URL(
            String(req.query.url || "")
        );

        if (
            parsedUrl.protocol !== "https:" ||
            parsedUrl.username ||
            parsedUrl.password
        ) {
            throw new Error("URL no válida");
        }

        cameraOrigin = parsedUrl.origin;

    } catch (error) {
        return res.status(400).json({
            estado: 0,
            mensaje: "La cámara solicitada no es válida."
        });
    }

    // -------------------------------------------------
    // B. VALIDAR ACCIÓN SOLICITADA
    // -------------------------------------------------

    const accion = String(
        req.query.accion || ""
    ).trim().toLowerCase();

    if (
        accion !== "video" &&
        accion !== "captura"
    ) {
        return res.status(400).json({
            estado: 0,
            mensaje: "Debes indicar una acción válida: video o captura."
        });
    }

    try {

        // ---------------------------------------------
        // C. OBTENER DATOS DE LA SESIÓN
        // ---------------------------------------------

        const idUsuario = Number(
            req.usuario.id_usuario
        );

        const idRol = Number(
            req.usuario.id_rol
        );

        if (
            !Number.isInteger(idUsuario) ||
            idUsuario <= 0 ||
            ![1, 2].includes(idRol)
        ) {
            return res.status(403).json({
                estado: 0,
                mensaje: "Sesión sin permisos para acceder a la cámara."
            });
        }

        // ---------------------------------------------
        // D. ADMINISTRADOR - ROL 1
        // ---------------------------------------------

        if (idRol === 1) {

            const [administradores] = await conmysql.query(`
                SELECT
                    c.id_administrador,
                    c.url_camara
                FROM configuracion_camara c

                INNER JOIN usuarios u
                    ON u.id_usuario = c.id_administrador

                WHERE c.id_administrador = ?
                  AND c.url_camara = ?
                  AND u.id_rol = 1
                  AND u.estado = 1

                LIMIT 1
            `, [
                idUsuario,
                cameraOrigin
            ]);

            if (!administradores.length) {
                return res.status(403).json({
                    estado: 0,
                    mensaje: "No tienes acceso a esta cámara."
                });
            }

            // El administrador tiene acceso al video
            // y a las operaciones de captura.

            return res.status(200).json({
                estado: 1,
                mensaje: "Acceso autorizado.",
                data: {
                    id_usuario: idUsuario,
                    id_rol: idRol,
                    accion,
                    visualizacion_habilitada: true,
                    acceso_permitido: true
                }
            });
        }

        // ---------------------------------------------
        // E. VEEDOR - ROL 2
        // ---------------------------------------------

        const [veedores] = await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,

                a.visualizacion_habilitada
                    AS permiso_individual,

                c.visualizacion_habilitada
                    AS permiso_general,

                c.url_camara

            FROM administrador a

            INNER JOIN usuarios u
                ON u.id_usuario = a.id_usuario

            INNER JOIN usuarios admin
                ON admin.id_usuario = a.id_administrador

            INNER JOIN configuracion_camara c
                ON c.id_administrador = a.id_administrador

            WHERE a.id_usuario = ?
              AND a.fecha_fin IS NULL

              AND u.id_rol = 2
              AND u.estado = 1

              AND admin.id_rol = 1
              AND admin.estado = 1

              AND c.url_camara = ?

            ORDER BY a.fecha_inicio DESC

            LIMIT 1
        `, [
            idUsuario,
            cameraOrigin
        ]);

        // ---------------------------------------------
        // F. COMPROBAR VINCULACIÓN
        // ---------------------------------------------

        if (!veedores.length) {
            return res.status(403).json({
                estado: 0,
                mensaje: "No tienes una cámara vinculada o autorizada."
            });
        }

        const veedor = veedores[0];

        const permisoIndividual =
            Number(veedor.permiso_individual) === 1;

        const permisoGeneral =
            Number(veedor.permiso_general) === 1;

        const visualizacionHabilitada =
            permisoGeneral && permisoIndividual;

        // ---------------------------------------------
        // G. CAPTURAS
        // ---------------------------------------------
        //
        // El permiso de visualización NO restringe
        // las capturas.
        //
        // Solo se requiere que el veedor esté activo,
        // vinculado y utilice la cámara asignada.
        // ---------------------------------------------

        if (accion === "captura") {
            return res.status(200).json({
                estado: 1,
                mensaje: "Acceso a captura autorizado.",
                data: {
                    id_usuario: idUsuario,
                    id_rol: idRol,
                    id_administrador:
                        Number(veedor.id_administrador),
                    accion: "captura",
                    visualizacion_habilitada:
                        visualizacionHabilitada,
                    acceso_permitido: true
                }
            });
        }

        // ---------------------------------------------
        // H. VISUALIZACIÓN DE VIDEO
        // ---------------------------------------------

        if (!visualizacionHabilitada) {
            return res.status(403).json({
                estado: 0,
                mensaje:
                    "El administrador ha deshabilitado la visualización del video en vivo.",
                data: {
                    id_usuario: idUsuario,
                    id_rol: idRol,
                    accion: "video",
                    visualizacion_habilitada: false,
                    acceso_permitido: false
                }
            });
        }

        // ---------------------------------------------
        // I. VIDEO AUTORIZADO
        // ---------------------------------------------

        return res.status(200).json({
            estado: 1,
            mensaje: "Visualización de video autorizada.",
            data: {
                id_usuario: idUsuario,
                id_rol: idRol,
                id_administrador:
                    Number(veedor.id_administrador),
                accion: "video",
                visualizacion_habilitada: true,
                acceso_permitido: true
            }
        });

    } catch (error) {

        console.error(
            "Error al validar sesión de cámara:",
            error
        );

        return res.status(500).json({
            estado: 0,
            mensaje:
                "No se pudo validar el acceso a la cámara."
        });
    }
});

// =====================================================
// 5. PERFIL DE USUARIO
// =====================================================

router.get(
    "/perfil/:id_usuario",
    verifyToken,
    requireOwnUserId,
    obtenerPerfil
);

router.patch(
    "/perfil/:id_usuario",
    verifyToken,
    requireOwnUserId,
    actualizarPerfil
);

// =====================================================
// 6. CAMBIAR CONTRASEÑA
// =====================================================

router.patch(
    "/cambiar-password/:id_usuario",
    verifyToken,
    requireOwnUserId,
    cambiarPassword
);

export default router;