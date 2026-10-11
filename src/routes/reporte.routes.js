import { Router } from "express";

import {
    getReporteCapturas, getReportePorFechas, getResumenEspecies, getTiposReporte, getReportesPendientesHoy,
    getReportesPendientesAnteriores,
    generarPDFEspecie, generarCSVEspecie, enviarReporteEspecie, getHistorialReportes, getEspeciesFiltro, getDetalleReporte,
    getReportesAdministradorHoy, editarTituloReporteAdmin, editarReporteAdmin, generarPDFReporteAdmin, generarCSVReporteAdmin
} from "../controladores/reporteC.js";
import {
    requireOwnAdminRequest,
    requireOwnUserId,
    requireOwnUserRequest,
    verifyToken
} from "../middlewares/verifyToken.js";


const router = Router();


router.get("/tipos", verifyToken, getTiposReporte);
router.get(
    "/admin/hoy/:id_administrador",
    verifyToken,
    requireOwnAdminRequest,
    getReportesAdministradorHoy
);
router.get(
    "/pendientes/hoy/:id_usuario",
    verifyToken,
    requireOwnUserId,
    getReportesPendientesHoy
);
router.get(
    "/pendientes/anteriores/:id_usuario",
    verifyToken,
    requireOwnUserId,
    getReportesPendientesAnteriores
);
router.get(
    "/capturas/:id_usuario/fecha",
    verifyToken,
    requireOwnUserId,
    getReportePorFechas
);

router.patch(
    "/admin/:id_administrador/reporte/:id_reporte/titulo",
    verifyToken,
    requireOwnAdminRequest,
    editarTituloReporteAdmin
);
router.patch(
    "/admin/:id_administrador/reporte/:id_reporte",
    verifyToken,
    requireOwnAdminRequest,
    editarReporteAdmin
);
router.get(
    "/admin/:id_administrador/reporte/:id_reporte/pdf",
    verifyToken,
    requireOwnAdminRequest,
    generarPDFReporteAdmin
);
router.get(
    "/admin/:id_administrador/reporte/:id_reporte/csv",
    verifyToken,
    requireOwnAdminRequest,
    generarCSVReporteAdmin
);


router.get(
    "/capturas/:id_usuario",
    verifyToken,
    requireOwnUserId,
    getReporteCapturas
);


router.get(
    "/especies/:id_usuario",
    verifyToken,
    requireOwnUserId,
    getResumenEspecies
);

router.post(
    "/generar-pdf-especie",
    verifyToken,
    requireOwnUserRequest,
    generarPDFEspecie
);

router.post("/generar-csv-especie", verifyToken, requireOwnUserRequest, generarCSVEspecie);
router.patch("/enviar-especie", verifyToken, requireOwnUserRequest, enviarReporteEspecie);
router.get("/historial", verifyToken, requireOwnUserRequest, getHistorialReportes);
router.get("/filtros/especies", verifyToken, getEspeciesFiltro);
router.get("/historial/detalle", verifyToken, requireOwnUserRequest, getDetalleReporte);


export default router;