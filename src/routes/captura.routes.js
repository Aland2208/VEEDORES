import { Router } from "express";

import {registrarCaptura, anularCaptura} from "../controladores/capturaC.js";


const router = Router();

router.post("/guardar", registrarCaptura);
router.patch("/anular/:id", anularCaptura);

export default router;