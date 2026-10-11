import { Router } from "express";

import {registrarCaptura, anularCaptura} from "../controladores/capturaC.js";
import {
    requireOwnUserRequest,
    requireRole,
    verifyToken
} from "../middlewares/verifyToken.js";


const router = Router();

router.use(verifyToken, requireRole(2), requireOwnUserRequest);
router.post("/guardar", registrarCaptura);
router.patch("/anular/:id", anularCaptura);

export default router;