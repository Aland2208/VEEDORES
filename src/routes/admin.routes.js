import { Router } from 'express';

import {
    buscarAdministradorPorCorreo,
    getUsuariosAdministrador,
    getUsuariosDisponibles,
    asignarUsuario,
    reasignarUsuario,
    quitarUsuarioAdministrador,
    getHistorialUsuario,
    getAdministradorActual
} from '../controladores/administradorC.js';

const router=Router();

router.get('/buscar',buscarAdministradorPorCorreo);
router.get('/usuarios/:id_administrador',getUsuariosAdministrador);
router.get('/disponibles',getUsuariosDisponibles);
router.get('/historial/:id_usuario',getHistorialUsuario);

router.post('/asignar/:id_administrador',asignarUsuario);
router.patch('/reasignar/:id_usuario',reasignarUsuario);
router.patch('/quitar/:id_administrador/:id_usuario',quitarUsuarioAdministrador);
router.get('/actual/:id_usuario',getAdministradorActual);

export default router;