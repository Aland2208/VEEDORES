import { Router } from 'express'
//importar las funciones
import { pruebaBalanza, registrarPeso, pesoLive, getPesos, getPesoByID, ultimoPeso, desactivarPeso, activarPeso, taraRealizada } from '../controladores/balanzaC.js'
import {
    requireAdmin,
    requireDeviceKey,
    verifyToken
} from "../middlewares/verifyToken.js";

const router = Router();
//armar nuestras rutas
//router.get('/clientes', prueba)

router.post('/registrar', requireDeviceKey, registrarPeso);
router.post('/live', requireDeviceKey, pesoLive);
router.post("/tara", requireDeviceKey, taraRealizada);

router.use(verifyToken);
router.get('/prueba', requireAdmin, pruebaBalanza);
router.get('/', requireAdmin, getPesos);
router.get('/ultimo', requireAdmin, ultimoPeso);
router.get('/:id', requireAdmin, getPesoByID);
router.patch('/desactivar/:id', requireAdmin, desactivarPeso);
router.patch('/activar/:id', requireAdmin, activarPeso);

export default router