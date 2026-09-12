import { Router } from "express";
import { 
    registrarUsuario, 
    loginUsuario, 
    solicitarRecuperacion, 
    restablecerPassword 
} from "../controladores/authC.js";

const router = Router();

router.post("/registro", registrarUsuario);
router.post("/login", loginUsuario);
router.post("/recuperar", solicitarRecuperacion);
router.post("/restablecer", restablecerPassword);

export default router;