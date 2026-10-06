import { Router } from "express";
import {
    registrarUsuario,
    loginUsuario,
    solicitarRecuperacion,
    restablecerPassword,
    obtenerPerfil,
    actualizarPerfil,
    cambiarPassword
} from "../controladores/authC.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);
router.post("/recuperar", solicitarRecuperacion);
router.post("/restablecer", restablecerPassword);

router.get("/perfil/:id_usuario", obtenerPerfil);
router.patch("/perfil/:id_usuario", actualizarPerfil);
router.patch('/cambiar-password/:id_usuario',cambiarPassword);

export default router;