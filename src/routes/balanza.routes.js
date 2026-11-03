
import { Router } from 'express';
import {
    pruebaBalanza,
    registrarPeso,
    pesoLive,
    getPesos,
    getPesoByID,
    ultimoPeso,
    desactivarPeso,
    activarPeso,
    taraRealizada,
    solicitarTara,
    consultarOrdenTara
} from '../controladores/balanzaC.js';

import {
    requireAdmin,
    requireDeviceKey,
    verifyToken
} from '../middlewares/verifyToken.js';

const router = Router();

// RUTAS EXCLUSIVAS DEL ESP32
router.post('/registrar', requireDeviceKey, registrarPeso);
router.post('/live', requireDeviceKey, pesoLive);
router.get('/orden-tara', requireDeviceKey, consultarOrdenTara);
router.post('/tara', requireDeviceKey, taraRealizada);

// RUTAS PARA USUARIOS AUTENTICADOS
router.use(verifyToken);
router.post('/solicitar-tara', solicitarTara);

// RUTAS ADMINISTRATIVAS
router.get('/prueba', requireAdmin, pruebaBalanza);
router.get('/', requireAdmin, getPesos);
router.get('/ultimo', requireAdmin, ultimoPeso);
router.get('/:id', requireAdmin, getPesoByID);
router.patch('/desactivar/:id', requireAdmin, desactivarPeso);
router.patch('/activar/:id', requireAdmin, activarPeso);

export default router;
