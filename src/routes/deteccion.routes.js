import { Router } from "express";

import {registrarDeteccion, getDetecciones, getDeteccionByID} from "../controladores/deteccionC.js";
import { requireAdmin, verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.post('/registrar', requireAdmin, registrarDeteccion);

router.get('/', requireAdmin, getDetecciones);

router.get('/:id', requireAdmin, getDeteccionByID);

export default router;