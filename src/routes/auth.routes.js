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
import { conmysql } from "../db.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/verificar-correo", verificarCorreo);
router.post("/login", loginUsuario);
router.post("/recuperar", solicitarRecuperacion);
router.get("/validar-reset/:token", validarTokenRecuperacion);
router.post("/restablecer", restablecerPassword);

router.get("/sesion", verifyToken, (req, res) => {
    return res.status(200).json({
        estado: 1,
        data: {
            id_usuario: Number(req.usuario.id_usuario),
            id_rol: Number(req.usuario.id_rol)
        }
    });
});

router.get("/sesion/camara", verifyToken, async (req, res) => {
    let cameraOrigin;
    try {
        const parsedUrl = new URL(String(req.query.url || ''));
        if (parsedUrl.protocol !== 'https:') {
            throw new Error('HTTPS is required');
        }
        cameraOrigin = parsedUrl.origin;
    } catch {
        return res.status(400).json({
            estado: 0,
            mensaje: 'La cámara solicitada no es válida.'
        });
    }

    try {
        const idUsuario = Number(req.usuario.id_usuario);
        const idRol = Number(req.usuario.id_rol);
        const [acceso] = await conmysql.query(`
            SELECT 1
            FROM configuracion_camara c
            INNER JOIN usuarios u
                ON u.id_usuario=?
               AND u.estado=1
            LEFT JOIN administrador a
                ON a.id_usuario=u.id_usuario
               AND a.fecha_fin IS NULL
            WHERE c.url_camara=?
              AND (
                (u.id_rol=1 AND c.id_administrador=u.id_usuario)
                OR
                (u.id_rol=2 AND c.id_administrador=a.id_administrador)
              )
              AND u.id_rol=?
            LIMIT 1
        `, [idUsuario, cameraOrigin, idRol]);

        if (!acceso.length) {
            return res.status(403).json({
                estado: 0,
                mensaje: 'No tienes acceso a esta cámara.'
            });
        }

        return res.status(200).json({ estado: 1 });
    } catch (error) {
        return res.status(500).json({
            estado: 0,
            mensaje: 'No se pudo validar el acceso a la cámara.'
        });
    }
});

router.get("/perfil/:id_usuario", verifyToken, requireOwnUserId, obtenerPerfil);
router.patch("/perfil/:id_usuario", verifyToken, requireOwnUserId, actualizarPerfil);
router.patch('/cambiar-password/:id_usuario', verifyToken, requireOwnUserId, cambiarPassword);

export default router;