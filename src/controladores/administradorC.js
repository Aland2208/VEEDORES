import { conmysql } from '../db.js';

/* BUSCAR ADMINISTRADOR POR CORREO */
export const buscarAdministradorPorCorreo=async(req,res)=>{
    try{
        const correo=String(req.query.correo||'').trim().toLowerCase();

        if(!correo){
            return res.status(400).json({
                estado:0,
                mensaje:'El correo electrónico es obligatorio.'
            });
        }

        const [administradores]=await conmysql.query(`
            SELECT
                id_usuario,
                nombre,
                apellido,
                correo
            FROM usuarios
            WHERE LOWER(correo)=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `,[correo]);

        if(administradores.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'No se encontró un administrador con este correo.'
            });
        }

        return res.status(200).json({
            estado:1,
            mensaje:'Administrador encontrado.',
            data:administradores[0]
        });
    }catch(error){
        console.error('❌ Error buscarAdministradorPorCorreo:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al buscar el administrador.'
        });
    }
};


/* OBTENER ADMINISTRADOR ACTUAL DEL OBSERVADOR */
export const getAdministradorActual=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido.'
            });
        }

        const [resultado]=await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.fecha_inicio,
                u.nombre,
                u.apellido,
                u.correo
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_administrador
            WHERE a.id_usuario=?
              AND a.fecha_fin IS NULL
              AND u.id_rol=1
              AND u.estado=1
            LIMIT 1
        `,[idUsuario]);

        if(resultado.length===0){
            return res.status(200).json({
                estado:1,
                vinculado:false,
                mensaje:'El usuario no tiene un administrador vinculado.',
                data:null
            });
        }

        return res.status(200).json({
            estado:1,
            vinculado:true,
            mensaje:'Administrador actual obtenido correctamente.',
            data:resultado[0]
        });
    }catch(error){
        console.error('❌ Error getAdministradorActual:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener el administrador actual.'
        });
    }
};


/* OBTENER OBSERVADORES ACTUALES DE UN ADMINISTRADOR */
export const getUsuariosAdministrador=async(req,res)=>{
    try{
        const idAdministrador=Number(req.params.id_administrador);

        if(!Number.isInteger(idAdministrador)||idAdministrador<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Administrador no válido.'
            });
        }

        const [usuarios]=await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                u.fecha_creacion,
                a.fecha_inicio
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_usuario
            WHERE a.id_administrador=?
              AND a.fecha_fin IS NULL
              AND u.id_rol=2
            ORDER BY u.nombre ASC,u.apellido ASC
        `,[idAdministrador]);

        return res.status(200).json({
            estado:1,
            mensaje:'Usuarios obtenidos correctamente.',
            data:usuarios
        });
    }catch(error){
        console.error('❌ Error getUsuariosAdministrador:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener los usuarios del administrador.'
        });
    }
};


/* OBTENER OBSERVADORES SIN ADMINISTRADOR */
export const getUsuariosDisponibles=async(req,res)=>{
    try{
        const [usuarios]=await conmysql.query(`
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                u.fecha_creacion
            FROM usuarios u
            WHERE u.id_rol=2
              AND u.estado=1
              AND NOT EXISTS(
                  SELECT 1
                  FROM administrador a
                  WHERE a.id_usuario=u.id_usuario
                    AND a.fecha_fin IS NULL
              )
            ORDER BY u.nombre ASC,u.apellido ASC
        `);

        return res.status(200).json({
            estado:1,
            mensaje:'Usuarios disponibles obtenidos correctamente.',
            data:usuarios
        });
    }catch(error){
        console.error('❌ Error getUsuariosDisponibles:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener los usuarios disponibles.'
        });
    }
};


/* ASIGNAR OBSERVADOR A ADMINISTRADOR */
export const asignarUsuario=async(req,res)=>{
    try{
        const idAdministrador=Number(req.params.id_administrador);
        const idUsuario=Number(req.body.id_usuario);

        if(!Number.isInteger(idAdministrador)||idAdministrador<=0||
           !Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Administrador o usuario no válido.'
            });
        }

        if(idAdministrador===idUsuario){
            return res.status(400).json({
                estado:0,
                mensaje:'Un administrador no puede asignarse a sí mismo.'
            });
        }

        const [administradores]=await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `,[idAdministrador]);

        if(administradores.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El administrador no existe o no está activo.'
            });
        }

        const [usuarios]=await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
              AND estado=1
            LIMIT 1
        `,[idUsuario]);

        if(usuarios.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe o no está activo.'
            });
        }

        const [asignaciones]=await conmysql.query(`
            SELECT
                id_asignacion,
                id_administrador
            FROM administrador
            WHERE id_usuario=?
              AND fecha_fin IS NULL
            LIMIT 1
        `,[idUsuario]);

        if(asignaciones.length>0){
            return res.status(409).json({
                estado:0,
                mensaje:'El observador ya tiene un administrador asignado.'
            });
        }

        /* HORA DE ECUADOR UTC-5 */
        const [resultado]=await conmysql.query(`
            INSERT INTO administrador(
                id_administrador,
                id_usuario,
                fecha_inicio
            )
            VALUES(
                ?,
                ?,
                DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR)
            )
        `,[idAdministrador,idUsuario]);

        return res.status(201).json({
            estado:1,
            mensaje:'Usuario asignado correctamente.',
            data:{
                id_asignacion:resultado.insertId,
                id_administrador:idAdministrador,
                id_usuario:idUsuario
            }
        });
    }catch(error){
        console.error('❌ Error asignarUsuario:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al asignar el usuario.'
        });
    }
};


/* REASIGNAR OBSERVADOR A OTRO ADMINISTRADOR */
export const reasignarUsuario=async(req,res)=>{
    let conexion;

    try{
        const idUsuario=Number(req.params.id_usuario);
        const idNuevoAdministrador=Number(req.body.id_administrador);

        if(!Number.isInteger(idUsuario)||idUsuario<=0||
           !Number.isInteger(idNuevoAdministrador)||idNuevoAdministrador<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario o administrador no válido.'
            });
        }

        conexion=await conmysql.getConnection();
        await conexion.beginTransaction();

        const [usuarios]=await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
              AND estado=1
            LIMIT 1
        `,[idUsuario]);

        if(usuarios.length===0){
            await conexion.rollback();

            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe o no está activo.'
            });
        }

        const [administradores]=await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=1
              AND estado=1
            LIMIT 1
        `,[idNuevoAdministrador]);

        if(administradores.length===0){
            await conexion.rollback();

            return res.status(404).json({
                estado:0,
                mensaje:'El nuevo administrador no existe o no está activo.'
            });
        }

        const [actual]=await conexion.query(`
            SELECT
                id_asignacion,
                id_administrador
            FROM administrador
            WHERE id_usuario=?
              AND fecha_fin IS NULL
            FOR UPDATE
        `,[idUsuario]);

        if(
            actual.length>0 &&
            Number(actual[0].id_administrador)===idNuevoAdministrador
        ){
            await conexion.rollback();

            return res.status(409).json({
                estado:0,
                mensaje:'El usuario ya pertenece a este administrador.'
            });
        }

        /*
         * OBTENEMOS UNA SOLA FECHA DE ECUADOR.
         * La misma fecha se utiliza para cerrar la asignación
         * anterior y comenzar la nueva.
         */
        const [fecha]=await conexion.query(`
            SELECT
                DATE_SUB(
                    UTC_TIMESTAMP(),
                    INTERVAL 5 HOUR
                ) AS fecha_cambio
        `);

        const fechaCambio=fecha[0].fecha_cambio;

        /* CERRAR ASIGNACIÓN ANTERIOR */
        if(actual.length>0){
            await conexion.query(`
                UPDATE administrador
                SET fecha_fin=?
                WHERE id_asignacion=?
            `,[fechaCambio,actual[0].id_asignacion]);
        }

        /* CREAR NUEVA ASIGNACIÓN */
        const [resultado]=await conexion.query(`
            INSERT INTO administrador(
                id_administrador,
                id_usuario,
                fecha_inicio
            )
            VALUES(?,?,?)
        `,[idNuevoAdministrador,idUsuario,fechaCambio]);

        await conexion.commit();

        return res.status(200).json({
            estado:1,
            mensaje:'Usuario reasignado correctamente.',
            data:{
                id_asignacion:resultado.insertId,
                id_administrador:idNuevoAdministrador,
                id_usuario:idUsuario
            }
        });
    }catch(error){
        if(conexion){
            await conexion.rollback();
        }

        console.error('❌ Error reasignarUsuario:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al reasignar el usuario.'
        });
    }finally{
        if(conexion){
            conexion.release();
        }
    }
};


/* FINALIZAR ASIGNACIÓN ACTUAL */
export const quitarUsuarioAdministrador=async(req,res)=>{
    try{
        const idAdministrador=Number(req.params.id_administrador);
        const idUsuario=Number(req.params.id_usuario);

        if(!Number.isInteger(idAdministrador)||idAdministrador<=0||
           !Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Administrador o usuario no válido.'
            });
        }

        const [resultado]=await conmysql.query(`
            UPDATE administrador
            SET fecha_fin=
                DATE_SUB(
                    UTC_TIMESTAMP(),
                    INTERVAL 5 HOUR
                )
            WHERE id_administrador=?
              AND id_usuario=?
              AND fecha_fin IS NULL
        `,[idAdministrador,idUsuario]);

        if(resultado.affectedRows===0){
            return res.status(404).json({
                estado:0,
                mensaje:'No existe una asignación activa para este usuario.'
            });
        }

        return res.status(200).json({
            estado:1,
            mensaje:'Asignación finalizada correctamente.'
        });
    }catch(error){
        console.error('❌ Error quitarUsuarioAdministrador:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al finalizar la asignación.'
        });
    }
};


/* HISTORIAL DE ADMINISTRADORES DE UN OBSERVADOR */
export const getHistorialUsuario=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido.'
            });
        }

        const [historial]=await conmysql.query(`
            SELECT
                a.id_asignacion,
                a.id_administrador,
                a.id_usuario,
                CONCAT(
                    u.nombre,
                    ' ',
                    u.apellido
                ) AS administrador,
                a.fecha_inicio,
                a.fecha_fin,
                CASE
                    WHEN a.fecha_fin IS NULL
                    THEN 'Activo'
                    ELSE 'Finalizado'
                END AS estado_asignacion
            FROM administrador a
            INNER JOIN usuarios u
                ON u.id_usuario=a.id_administrador
            WHERE a.id_usuario=?
            ORDER BY a.fecha_inicio DESC
        `,[idUsuario]);

        return res.status(200).json({
            estado:1,
            mensaje:'Historial obtenido correctamente.',
            data:historial
        });
    }catch(error){
        console.error('❌ Error getHistorialUsuario:',error);

        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener el historial.'
        });
    }
};