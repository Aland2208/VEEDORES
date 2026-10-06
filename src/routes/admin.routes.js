import { Router } from 'express';

import {
    getUsuariosAdministrador,
    getUsuariosDisponibles,
    asignarUsuario,
    reasignarUsuario,
    quitarUsuarioAdministrador,
    getHistorialUsuario
} from '../controladores/administradorC.js';

const router=Router();

router.get('/usuarios/:id_administrador',getUsuariosAdministrador);
router.get('/disponibles',getUsuariosDisponibles);
router.get('/historial/:id_usuario',getHistorialUsuario);

router.post('/asignar/:id_administrador',asignarUsuario);

router.patch('/reasignar/:id_usuario',reasignarUsuario);
router.patch('/quitar/:id_administrador/:id_usuario',quitarUsuarioAdministrador);

export default router;