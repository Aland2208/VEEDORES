import { Router } from "express";

import {
    getReporteCapturas, getReportePorFechas, getResumenEspecies, getTiposReporte, getReportesPendientesHoy,
    generarPDFEspecie, generarCSVEspecie, enviarReporteEspecie, getHistorialReportes, getEspeciesFiltro, getDetalleReporte,
    getReportesAdministradorHoy, editarTituloReporteAdmin, editarReporteAdmin
} from "../controladores/reporteC.js";


const router = Router();


router.get("/tipos", getTiposReporte);
router.get("/admin/hoy/:id_administrador", getReportesAdministradorHoy);
router.get("/pendientes/hoy/:id_usuario", getReportesPendientesHoy);
router.get("/capturas/:id_usuario/fecha", getReportePorFechas);
router.get("/admin/hoy/:id_administrador", getReportesAdministradorHoy);

router.patch("/admin/:id_administrador/reporte/:id_reporte/titulo", editarTituloReporteAdmin);
router.patch("/admin/:id_administrador/reporte/:id_reporte", editarReporteAdmin);


router.get(
    "/capturas/:id_usuario",
    getReporteCapturas
);


router.get(
    "/especies/:id_usuario",
    getResumenEspecies
);

router.post(
    "/generar-pdf-especie",
    generarPDFEspecie
);

router.post("/generar-csv-especie", generarCSVEspecie);
router.patch("/enviar-especie", enviarReporteEspecie);
router.get("/historial", getHistorialReportes);
router.get("/filtros/especies", getEspeciesFiltro);
router.get("/historial/detalle", getDetalleReporte);


export default router;