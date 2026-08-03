import { Router } from "express";

import {registrarCaptura} from "../controladores/capturaC.js";


const router = Router();

router.post("/guardar", registrarCaptura);

export default router;