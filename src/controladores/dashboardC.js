import { conmysql } from '../db.js';

export const getDashboardVeedor=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido'
            });
        }

        // Fecha actual de Ecuador (UTC-5)
        const [fechaResultado]=await conmysql.query(`
            SELECT DATE(DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR)) AS fecha_ecuador
        `);

        const fechaEcuador=fechaResultado[0].fecha_ecuador;

        console.log('📊 Dashboard usuario:',idUsuario);
        console.log('🇪🇨 Fecha Ecuador:',fechaEcuador);

        // RESUMEN GENERAL
        const [resumen]=await conmysql.query(`
            SELECT
                COUNT(c.id_captura) AS total_capturas,
                COALESCE(SUM(c.peso),0) AS peso_total,
                COALESCE(AVG(d.porcentaje),0) AS confianza_promedio,
                COUNT(DISTINCT d.id_especie) AS total_especies
            FROM capturas c
            INNER JOIN detecciones d
                ON c.id_deteccion=d.id_deteccion
            WHERE c.id_usuario=?
              AND c.estado=1
              AND c.fecha_hora>=?
              AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)
        `,[idUsuario,fechaEcuador,fechaEcuador]);

        // DISTRIBUCIÓN POR ESPECIE
        const [especies]=await conmysql.query(`
            SELECT
                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico,
                COUNT(c.id_captura) AS total_capturas,
                COALESCE(SUM(c.peso),0) AS peso_total,
                COALESCE(AVG(d.porcentaje),0) AS confianza_promedio
            FROM capturas c
            INNER JOIN detecciones d
                ON c.id_deteccion=d.id_deteccion
            INNER JOIN especies e
                ON d.id_especie=e.id_especie
            WHERE c.id_usuario=?
              AND c.estado=1
              AND c.fecha_hora>=?
              AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)
            GROUP BY
                e.id_especie,
                e.nombre_comun,
                e.nombre_cientifico
            ORDER BY total_capturas DESC
        `,[idUsuario,fechaEcuador,fechaEcuador]);

        // ACTIVIDAD POR HORA
        const [actividad]=await conmysql.query(`
            SELECT
                HOUR(c.fecha_hora) AS hora,
                COUNT(c.id_captura) AS total_capturas,
                COALESCE(SUM(c.peso),0) AS peso_total
            FROM capturas c
            WHERE c.id_usuario=?
              AND c.estado=1
              AND c.fecha_hora>=?
              AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)
            GROUP BY HOUR(c.fecha_hora)
            ORDER BY hora ASC
        `,[idUsuario,fechaEcuador,fechaEcuador]);

        console.log('📌 Resumen:',resumen[0]);
        console.log('🐟 Especies:',especies.length);
        console.log('⏰ Actividad:',actividad.length);

        return res.status(200).json({
            estado:1,
            mensaje:'Dashboard obtenido correctamente',
            data:{
                resumen:{
                    total_capturas:Number(resumen[0]?.total_capturas||0),
                    peso_total:Number(resumen[0]?.peso_total||0),
                    confianza_promedio:Number(resumen[0]?.confianza_promedio||0),
                    total_especies:Number(resumen[0]?.total_especies||0)
                },
                especies:especies.map(item=>({
                    id_especie:item.id_especie,
                    nombre_comun:item.nombre_comun,
                    nombre_cientifico:item.nombre_cientifico,
                    total_capturas:Number(item.total_capturas||0),
                    peso_total:Number(item.peso_total||0),
                    confianza_promedio:Number(item.confianza_promedio||0)
                })),
                actividad:actividad.map(item=>({
                    hora:Number(item.hora),
                    total_capturas:Number(item.total_capturas||0),
                    peso_total:Number(item.peso_total||0)
                }))
            }
        });

    }catch(error){
        console.error('❌ Error getDashboardVeedor:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener el dashboard'
        });
    }
};

export const getDashboardAdministrador=async(req,res)=>{
 try{
  const idAdministrador=Number(req.params.id_administrador);
  const periodo=String(req.query.periodo||'hoy');
  const idUsuario=req.query.id_usuario?Number(req.query.id_usuario):null;
  const desdePersonalizado=req.query.desde?String(req.query.desde):null;
  const hastaPersonalizado=req.query.hasta?String(req.query.hasta):null;

  if(!Number.isInteger(idAdministrador)||idAdministrador<=0){
   return res.status(400).json({estado:0,mensaje:'Administrador no válido'});
  }

  if(idUsuario!==null&&(!Number.isInteger(idUsuario)||idUsuario<=0)){
   return res.status(400).json({estado:0,mensaje:'Veedor no válido'});
  }

  const [admin]=await conmysql.query(`
   SELECT id_usuario,nombre,apellido,correo
   FROM usuarios
   WHERE id_usuario=? AND id_rol=1
   LIMIT 1
  `,[idAdministrador]);

  if(!admin.length){
   return res.status(404).json({estado:0,mensaje:'Administrador no encontrado'});
  }

  const [fechaResultado]=await conmysql.query(`
   SELECT DATE(DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR)) AS fecha_ecuador
  `);

  const hoy=fechaResultado[0].fecha_ecuador;
  let desde=hoy;
  let hasta=hoy;

  if(periodo==='7dias'){
   const [r]=await conmysql.query(`
    SELECT
     DATE_SUB(?,INTERVAL 6 DAY) AS desde,
     ? AS hasta
   `,[hoy,hoy]);
   desde=r[0].desde;
   hasta=r[0].hasta;
  }else if(periodo==='30dias'){
   const [r]=await conmysql.query(`
    SELECT
     DATE_SUB(?,INTERVAL 29 DAY) AS desde,
     ? AS hasta
   `,[hoy,hoy]);
   desde=r[0].desde;
   hasta=r[0].hasta;
  }else if(periodo==='personalizado'){
   if(!desdePersonalizado||!hastaPersonalizado){
    return res.status(400).json({
     estado:0,
     mensaje:'Debe indicar las fechas desde y hasta'
    });
   }

   if(!/^\d{4}-\d{2}-\d{2}$/.test(desdePersonalizado)||
      !/^\d{4}-\d{2}-\d{2}$/.test(hastaPersonalizado)){
    return res.status(400).json({
     estado:0,
     mensaje:'Las fechas deben tener formato YYYY-MM-DD'
    });
   }

   if(desdePersonalizado>hastaPersonalizado){
    return res.status(400).json({
     estado:0,
     mensaje:'La fecha inicial no puede ser mayor a la fecha final'
    });
   }

   desde=desdePersonalizado;
   hasta=hastaPersonalizado;
  }else if(periodo!=='hoy'){
   return res.status(400).json({estado:0,mensaje:'Período no válido'});
  }

  if(idUsuario!==null){
   const [relacion]=await conmysql.query(`
    SELECT 1
    FROM administrador
    WHERE id_administrador=? AND id_usuario=?
    LIMIT 1
   `,[idAdministrador,idUsuario]);

   if(!relacion.length){
    return res.status(403).json({
     estado:0,
     mensaje:'El veedor no está relacionado con este administrador'
    });
   }
  }

  const filtroUsuarioCaptura=idUsuario!==null?' AND c.id_usuario=?':'';
  const filtroUsuarioReporte=idUsuario!==null?' AND rep.id_usuario=?':'';

  // =====================================================
  // RESUMEN DE CAPTURAS
  // =====================================================
  const parametrosResumenCapturas=[
   idAdministrador,
   desde,
   hasta
  ];

  if(idUsuario!==null)parametrosResumenCapturas.push(idUsuario);

  const [resumenCapturas]=await conmysql.query(`
   SELECT
    COUNT(c.id_captura) AS total_capturas,
    COALESCE(SUM(c.peso),0) AS peso_total,
    COALESCE(AVG(d.porcentaje),0) AS confianza_promedio,
    COUNT(DISTINCT d.id_especie) AS total_especies
   FROM capturas c
   INNER JOIN detecciones d ON c.id_deteccion=d.id_deteccion
   WHERE c.estado=1
    AND c.fecha_hora>=?
    AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)
    AND EXISTS(
     SELECT 1
     FROM administrador a
     WHERE a.id_administrador=?
      AND a.id_usuario=c.id_usuario
      AND c.fecha_hora>=a.fecha_inicio
      AND (a.fecha_fin IS NULL OR c.fecha_hora<a.fecha_fin)
    )
    ${filtroUsuarioCaptura}
  `,[
   desde,
   hasta,
   idAdministrador,
   ...(idUsuario!==null?[idUsuario]:[])
  ]);

  // =====================================================
  // RESUMEN DE REPORTES
  // =====================================================
  const [resumenReportes]=await conmysql.query(`
   SELECT
    COUNT(rep.id_reporte) AS total_reportes,

    SUM(
     CASE
      WHEN rep.id_tipo_reporte IS NOT NULL
       AND rep.titulo IS NOT NULL
       AND TRIM(rep.titulo)<>''
      THEN 1 ELSE 0
     END
    ) AS reportes_completos,

    SUM(
     CASE
      WHEN rep.id_tipo_reporte IS NULL
       OR rep.titulo IS NULL
       OR TRIM(rep.titulo)=''
      THEN 1 ELSE 0
     END
    ) AS reportes_incompletos

   FROM reportes rep
   WHERE rep.fecha_generacion>=?
    AND rep.fecha_generacion<DATE_ADD(?,INTERVAL 1 DAY)

    AND EXISTS(
     SELECT 1
     FROM administrador a
     WHERE a.id_administrador=?
      AND a.id_usuario=rep.id_usuario
      AND rep.fecha_generacion>=a.fecha_inicio
      AND (a.fecha_fin IS NULL OR rep.fecha_generacion<a.fecha_fin)
    )

    ${filtroUsuarioReporte}
  `,[
   desde,
   hasta,
   idAdministrador,
   ...(idUsuario!==null?[idUsuario]:[])
  ]);

  // =====================================================
  // DISTRIBUCIÓN POR ESPECIE
  // =====================================================
  const [especies]=await conmysql.query(`
   SELECT
    e.id_especie,
    e.nombre_comun,
    e.nombre_cientifico,
    COUNT(c.id_captura) AS total_capturas,
    COALESCE(SUM(c.peso),0) AS peso_total,
    COALESCE(AVG(d.porcentaje),0) AS confianza_promedio

   FROM capturas c

   INNER JOIN detecciones d
    ON c.id_deteccion=d.id_deteccion

   INNER JOIN especies e
    ON d.id_especie=e.id_especie

   WHERE c.estado=1
    AND c.fecha_hora>=?
    AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)

    AND EXISTS(
     SELECT 1
     FROM administrador a
     WHERE a.id_administrador=?
      AND a.id_usuario=c.id_usuario
      AND c.fecha_hora>=a.fecha_inicio
      AND (a.fecha_fin IS NULL OR c.fecha_hora<a.fecha_fin)
    )

    ${filtroUsuarioCaptura}

   GROUP BY
    e.id_especie,
    e.nombre_comun,
    e.nombre_cientifico

   ORDER BY total_capturas DESC
  `,[
   desde,
   hasta,
   idAdministrador,
   ...(idUsuario!==null?[idUsuario]:[])
  ]);

  // =====================================================
  // RENDIMIENTO POR VEEDOR
  // =====================================================
  const [veedores]=await conmysql.query(`
   SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,

    COUNT(DISTINCT c.id_captura) AS total_capturas,

    COALESCE(SUM(
     CASE
      WHEN c.id_captura IS NOT NULL
      THEN c.peso ELSE 0
     END
    ),0) AS peso_total,

    COALESCE(AVG(
     CASE
      WHEN c.id_captura IS NOT NULL
      THEN d.porcentaje
     END
    ),0) AS confianza_promedio,

    (
     SELECT COUNT(*)
     FROM reportes rep
     WHERE rep.id_usuario=u.id_usuario
      AND rep.fecha_generacion>=?
      AND rep.fecha_generacion<DATE_ADD(?,INTERVAL 1 DAY)
      AND EXISTS(
       SELECT 1
       FROM administrador ar
       WHERE ar.id_administrador=?
        AND ar.id_usuario=u.id_usuario
        AND rep.fecha_generacion>=ar.fecha_inicio
        AND (ar.fecha_fin IS NULL OR rep.fecha_generacion<ar.fecha_fin)
      )
    ) AS total_reportes,

    (
     SELECT COUNT(*)
     FROM reportes rep
     WHERE rep.id_usuario=u.id_usuario
      AND rep.fecha_generacion>=?
      AND rep.fecha_generacion<DATE_ADD(?,INTERVAL 1 DAY)
      AND rep.id_tipo_reporte IS NOT NULL
      AND rep.titulo IS NOT NULL
      AND TRIM(rep.titulo)<>''
      AND EXISTS(
       SELECT 1
       FROM administrador ar
       WHERE ar.id_administrador=?
        AND ar.id_usuario=u.id_usuario
        AND rep.fecha_generacion>=ar.fecha_inicio
        AND (ar.fecha_fin IS NULL OR rep.fecha_generacion<ar.fecha_fin)
      )
    ) AS reportes_completos,

    (
     SELECT COUNT(*)
     FROM reportes rep
     WHERE rep.id_usuario=u.id_usuario
      AND rep.fecha_generacion>=?
      AND rep.fecha_generacion<DATE_ADD(?,INTERVAL 1 DAY)
      AND (
       rep.id_tipo_reporte IS NULL
       OR rep.titulo IS NULL
       OR TRIM(rep.titulo)=''
      )
      AND EXISTS(
       SELECT 1
       FROM administrador ar
       WHERE ar.id_administrador=?
        AND ar.id_usuario=u.id_usuario
        AND rep.fecha_generacion>=ar.fecha_inicio
        AND (ar.fecha_fin IS NULL OR rep.fecha_generacion<ar.fecha_fin)
      )
    ) AS reportes_incompletos

   FROM usuarios u

   LEFT JOIN capturas c
    ON c.id_usuario=u.id_usuario
    AND c.estado=1
    AND c.fecha_hora>=?
    AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)
    AND EXISTS(
     SELECT 1
     FROM administrador ac
     WHERE ac.id_administrador=?
      AND ac.id_usuario=u.id_usuario
      AND c.fecha_hora>=ac.fecha_inicio
      AND (ac.fecha_fin IS NULL OR c.fecha_hora<ac.fecha_fin)
    )

   LEFT JOIN detecciones d
    ON c.id_deteccion=d.id_deteccion

   WHERE u.id_rol=2

    AND EXISTS(
     SELECT 1
     FROM administrador a
     WHERE a.id_administrador=?
      AND a.id_usuario=u.id_usuario
    )

    ${idUsuario!==null?' AND u.id_usuario=?':''}

   GROUP BY
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo

   ORDER BY total_capturas DESC,total_reportes DESC
  `,[
   desde,hasta,idAdministrador,
   desde,hasta,idAdministrador,
   desde,hasta,idAdministrador,
   desde,hasta,idAdministrador,
   idAdministrador,
   ...(idUsuario!==null?[idUsuario]:[])
  ]);

  // =====================================================
  // ACTIVIDAD
  // HOY = POR HORA
  // OTROS PERÍODOS = POR DÍA
  // =====================================================
  let actividad=[];

  if(periodo==='hoy'){
   const [resultado]=await conmysql.query(`
    SELECT
     HOUR(c.fecha_hora) AS hora,
     COUNT(c.id_captura) AS total_capturas,
     COALESCE(SUM(c.peso),0) AS peso_total

    FROM capturas c

    WHERE c.estado=1
     AND c.fecha_hora>=?
     AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)

     AND EXISTS(
      SELECT 1
      FROM administrador a
      WHERE a.id_administrador=?
       AND a.id_usuario=c.id_usuario
       AND c.fecha_hora>=a.fecha_inicio
       AND (a.fecha_fin IS NULL OR c.fecha_hora<a.fecha_fin)
     )

     ${filtroUsuarioCaptura}

    GROUP BY HOUR(c.fecha_hora)
    ORDER BY hora ASC
   `,[
    desde,
    hasta,
    idAdministrador,
    ...(idUsuario!==null?[idUsuario]:[])
   ]);

   actividad=resultado.map(item=>({
    hora:Number(item.hora),
    total_capturas:Number(item.total_capturas||0),
    peso_total:Number(item.peso_total||0)
   }));
  }else{
   const [resultado]=await conmysql.query(`
    SELECT
     DATE_FORMAT(c.fecha_hora,'%Y-%m-%d') AS fecha,
     COUNT(c.id_captura) AS total_capturas,
     COALESCE(SUM(c.peso),0) AS peso_total

    FROM capturas c

    WHERE c.estado=1
     AND c.fecha_hora>=?
     AND c.fecha_hora<DATE_ADD(?,INTERVAL 1 DAY)

     AND EXISTS(
      SELECT 1
      FROM administrador a
      WHERE a.id_administrador=?
       AND a.id_usuario=c.id_usuario
       AND c.fecha_hora>=a.fecha_inicio
       AND (a.fecha_fin IS NULL OR c.fecha_hora<a.fecha_fin)
     )

     ${filtroUsuarioCaptura}

    GROUP BY DATE(c.fecha_hora)
    ORDER BY DATE(c.fecha_hora) ASC
   `,[
    desde,
    hasta,
    idAdministrador,
    ...(idUsuario!==null?[idUsuario]:[])
   ]);

   actividad=resultado.map(item=>({
    fecha:item.fecha,
    total_capturas:Number(item.total_capturas||0),
    peso_total:Number(item.peso_total||0)
   }));
  }

  const rCapturas=resumenCapturas[0]||{};
  const rReportes=resumenReportes[0]||{};

  return res.status(200).json({
   estado:1,
   mensaje:'Dashboard general obtenido correctamente',

   data:{
    filtros:{
     periodo,
     desde,
     hasta,
     id_usuario:idUsuario
    },

    resumen:{
     total_capturas:Number(rCapturas.total_capturas||0),
     peso_total:Number(rCapturas.peso_total||0),
     confianza_promedio:Number(rCapturas.confianza_promedio||0),
     total_especies:Number(rCapturas.total_especies||0),
     total_reportes:Number(rReportes.total_reportes||0),
     reportes_completos:Number(rReportes.reportes_completos||0),
     reportes_incompletos:Number(rReportes.reportes_incompletos||0)
    },

    especies:especies.map(item=>({
     id_especie:Number(item.id_especie),
     nombre_comun:item.nombre_comun,
     nombre_cientifico:item.nombre_cientifico,
     total_capturas:Number(item.total_capturas||0),
     peso_total:Number(item.peso_total||0),
     confianza_promedio:Number(item.confianza_promedio||0)
    })),

    actividad,

    veedores:veedores.map(item=>({
     id_usuario:Number(item.id_usuario),
     nombre:item.nombre,
     apellido:item.apellido,
     correo:item.correo,
     total_capturas:Number(item.total_capturas||0),
     total_reportes:Number(item.total_reportes||0),
     reportes_completos:Number(item.reportes_completos||0),
     reportes_incompletos:Number(item.reportes_incompletos||0),
     peso_total:Number(item.peso_total||0),
     confianza_promedio:Number(item.confianza_promedio||0)
    }))
   }
  });

 }catch(error){
  console.error('❌ Error getDashboardAdministrador:',error);

  return res.status(500).json({
   estado:0,
   mensaje:'Error al obtener el dashboard general',
   error:error.message
  });
 }
};