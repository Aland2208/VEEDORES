import { Router } from 'express'
//importar las funciones
import { pruebaBalanza,registrarPeso, getPesos, getPesoByID, ultimoPeso, deletePeso } from '../controladores/balanzaC.js'
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();
//armar nuestras rutas
//router.get('/clientes', prueba)

router.get('/prueba', pruebaBalanza);
router.post('/registrar', registrarPeso);
router.get('/', getPesos);
router.get('/ultimo', ultimoPeso);
router.get('/:id', getPesoByID);
router.delete('/:id', deletePeso);

export default router