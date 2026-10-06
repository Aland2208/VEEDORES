import { Router } from "express";
import {
    registrarUsuario,
    loginUsuario,
    solicitarRecuperacion,
    restablecerPassword,
    obtenerPerfil,
    actualizarPerfil
} from "../controladores/authC.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);
router.post("/recuperar", solicitarRecuperacion);
router.post("/restablecer", restablecerPassword);

router.get("/perfil/:id_usuario", obtenerPerfil);
router.patch("/perfil/:id_usuario", actualizarPerfil);

export default router;