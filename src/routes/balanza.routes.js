import { Router } from 'express'
//importar las funciones
import { pruebaBalanza,registrarPeso, getPesos, getPesoByID, ultimoPeso, desactivarPeso, activarPeso } from '../controladores/balanzaC.js'
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();
//armar nuestras rutas
//router.get('/clientes', prueba)

router.get('/prueba', pruebaBalanza);
router.post('/registrar', registrarPeso);
router.get('/', getPesos);
router.get('/ultimo', ultimoPeso);
router.get('/:id', getPesoByID);
router.patch('/desactivar/:id', desactivarPeso);
router.patch('/activar/:id', activarPeso);

export default router