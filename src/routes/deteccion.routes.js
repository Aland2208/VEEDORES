import { Router } from "express";

import {registrarDeteccion, getDetecciones, getDeteccionByID} from "../controladores/deteccionC.js";

const router = Router();

router.post('/registrar', registrarDeteccion);

router.get('/', getDetecciones);

router.get('/:id', getDeteccionByID);

export default router;