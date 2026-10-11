import { conmysql } from '../db.js';
import bcrypt from 'bcrypt';
import { esCorreoValido, passwordValida } from '../utilidades/correo.js';
import { esNombreValido } from '../utilidades/nombre.js';
import {
    crearTokenVerificacionCorreo,
    enviarCorreoVerificacion,
    servicioVerificacionCorreoConfigurado
} from '../utilidades/verificacion-correo.js';

/* LISTAR OBSERVADORES */
export const getObservadores=async(req,res)=>{
    try{
        const idAdministrador=Number(req.usuario.id_usuario);
        const [usuarios]=await conmysql.query(`
            SELECT
                u.id_usuario,
                u.nombre,
                u.apellido,
                u.correo,
                u.estado,
                (u.token_verificacion_correo IS NOT NULL) AS verificacion_pendiente,
                u.fecha_creacion
            FROM administrador a
            INNER JOIN usuarios u ON u.id_usuario=a.id_usuario
            INNER JOIN usuarios admin ON admin.id_usuario=a.id_administrador
            WHERE a.id_administrador=?
              AND a.fecha_fin IS NULL
              AND u.id_rol=2
              AND admin.id_rol=1
              AND admin.estado=1
            ORDER BY u.nombre ASC,u.apellido ASC
        `,[idAdministrador]);
        const [solicitudesPendientes]=await conmysql.query(`
            SELECT
                s.id_solicitud,
                s.nombre,
                s.apellido,
                s.correo,
                0 AS estado,
                1 AS verificacion_pendiente,
                s.fecha_creacion
            FROM solicitudes_registro s
            INNER JOIN usuarios admin
                ON admin.id_usuario = s.id_administrador
               AND admin.id_rol = 1
               AND admin.estado = 1
            WHERE s.id_administrador = ?
              AND s.id_rol = 2
              AND s.expira > NOW()
            ORDER BY s.fecha_creacion DESC
        `,[idAdministrador]);

        return res.status(200).json({
            estado:1,
            mensaje:'Observadores obtenidos correctamente.',
            data:[
                ...usuarios,
                ...solicitudesPendientes.map(solicitud=>({
                    ...solicitud,
                    id_usuario:null,
                    verificacion_pendiente:1
                }))
            ]
        });
    }catch(error){
        
        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener los observadores.'
        });
    }
};


/* CREAR OBSERVADOR */
export const crearObservador=async(req,res)=>{
    let conexion;
    try{
        let {nombre,apellido,correo,password}=req.body||{};

        if(typeof nombre!=='string'||typeof apellido!=='string'||
           typeof correo!=='string'||typeof password!=='string'){
            return res.status(400).json({
                estado:0,
                mensaje:'Completa todos los campos con un formato válido.'
            });
        }

        nombre=nombre.trim();
        apellido=apellido.trim();
        correo=correo.trim().toLowerCase();

        if(!nombre||!apellido||!correo||!password){
            return res.status(400).json({
                estado:0,
                mensaje:'Todos los campos son obligatorios.'
            });
        }

        if(!esNombreValido(nombre)||!esNombreValido(apellido)||
           !esCorreoValido(correo)){
            return res.status(400).json({
                estado:0,
                mensaje:'Nombre, apellido o correo no válidos.'
            });
        }

        if(typeof password!=='string'||!passwordValida(password)){
            return res.status(400).json({
                estado:0,
                mensaje:'La contraseña no cumple los requisitos de seguridad.'
            });
        }

        if(!servicioVerificacionCorreoConfigurado()){
            return res.status(503).json({
                estado:0,
                mensaje:'No se puede enviar el correo de verificación en este momento.'
            });
        }

        const passwordHash=await bcrypt.hash(password,10);
        const {token,tokenHash,expira}=crearTokenVerificacionCorreo();
        conexion=await conmysql.getConnection();
        await conexion.beginTransaction();

        const idAdministrador=Number(req.usuario.id_usuario);
        const [administradorActivo]=await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=? AND id_rol=1 AND estado=1
            LIMIT 1
        `,[idAdministrador]);

        if(administradorActivo.length===0){
            await conexion.rollback();
            return res.status(403).json({
                estado:0,
                mensaje:'La cuenta administradora no está activa.'
            });
        }

        const [existente]=await conexion.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE LOWER(correo)=?
            LIMIT 1
        `,[correo]);

        if(existente.length>0){
            await conexion.rollback();
            return res.status(409).json({
                estado:0,
                mensaje:'Ya existe una cuenta registrada con este correo.'
            });
        }

        await conexion.query(`
            DELETE FROM solicitudes_registro
            WHERE correo = ?
              AND expira <= NOW()
        `,[correo]);

        const [solicitudExistente]=await conexion.query(`
            SELECT id_solicitud
            FROM solicitudes_registro
            WHERE correo = ?
              AND expira > NOW()
            LIMIT 1
            FOR UPDATE
        `,[correo]);

        if(solicitudExistente.length>0){
            await conexion.rollback();
            return res.status(409).json({
                estado:0,
                mensaje:'Ya hay una solicitud pendiente para este correo. Revisa tu bandeja de entrada.'
            });
        }

        await conexion.query(`
            INSERT INTO solicitudes_registro(
                nombre,
                apellido,
                correo,
                password_hash,
                id_rol,
                id_administrador,
                token_hash,
                expira
            )
            VALUES(?, ?, ?, ?, 2, ?, ?, ?)
        `,[nombre,apellido,correo,passwordHash,tokenHash,expira]);
        

        try{
            await enviarCorreoVerificacion(correo,token);
        }catch(error){
            await conexion.rollback();
            return res.status(502).json({
                estado:0,
                mensaje:'No se pudo enviar el correo de verificación. Intenta nuevamente.'
            });
        }

        await conexion.commit();

        return res.status(201).json({
            estado:1,
            mensaje:'Solicitud enviada. El observador se creará cuando confirme su correo.',
            data:{
                nombre,
                apellido,
                correo,
                estado:0,
                verificacion_pendiente:true
            }
        });
    }catch(error){
        if(conexion) await conexion.rollback();

        if(error.code==='ER_DUP_ENTRY'){
            return res.status(409).json({
                estado:0,
                mensaje:'Ya existe una cuenta registrada con este correo.'
            });
        }

        
        return res.status(500).json({
            estado:0,
            mensaje:'Error al crear el observador.'
        });
    }finally{
        if(conexion) conexion.release();
    }
};


/* EDITAR OBSERVADOR */
export const editarObservador=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);

        const {nombre,apellido}=req.body||{};

        if(Object.prototype.hasOwnProperty.call(req.body||{},'correo')){
            return res.status(400).json({
                estado:0,
                mensaje:'El correo no se puede modificar desde esta pantalla.'
            });
        }

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido.'
            });
        }

        if(typeof nombre!=='string'||typeof apellido!=='string'){
            return res.status(400).json({
                estado:0,
                mensaje:'El nombre y el apellido son obligatorios.'
            });
        }

        const nombreLimpio=nombre.trim();
        const apellidoLimpio=apellido.trim();
        if(!esNombreValido(nombreLimpio)||!esNombreValido(apellidoLimpio)){
            return res.status(400).json({
                estado:0,
                mensaje:'El nombre o el apellido no son válidos.'
            });
        }

        const [usuario]=await conmysql.query(`
            SELECT u.id_usuario
            FROM usuarios u
            INNER JOIN administrador a ON a.id_usuario=u.id_usuario
            INNER JOIN usuarios admin ON admin.id_usuario=a.id_administrador
            WHERE u.id_usuario=?
              AND u.id_rol=2
              AND a.id_administrador=?
              AND a.fecha_fin IS NULL
              AND admin.id_rol=1
              AND admin.estado=1
            LIMIT 1
        `,[idUsuario,Number(req.usuario.id_usuario)]);

        if(usuario.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe.'
            });
        }

        await conmysql.query(`
            UPDATE usuarios
            SET
                nombre=?,
                apellido=?
            WHERE id_usuario=?
              AND id_rol=2
        `,[nombreLimpio,apellidoLimpio,idUsuario]);

        return res.status(200).json({
            estado:1,
            mensaje:'Observador actualizado correctamente.',
            data:{
                id_usuario:idUsuario,
                nombre:nombreLimpio,
                apellido:apellidoLimpio
            }
        });
    }catch(error){
        
        return res.status(500).json({
            estado:0,
            mensaje:'Error al actualizar el observador.'
        });
    }
};


/* ACTIVAR O DESACTIVAR OBSERVADOR */
export const cambiarEstadoObservador=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);
        const estado=Number(req.body.estado);

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido.'
            });
        }

        if(estado!==0&&estado!==1){
            return res.status(400).json({
                estado:0,
                mensaje:'El estado debe ser 0 o 1.'
            });
        }

        const [usuario]=await conmysql.query(`
            SELECT u.id_usuario,u.estado,u.token_verificacion_correo
            FROM usuarios u
            INNER JOIN administrador a ON a.id_usuario=u.id_usuario
            INNER JOIN usuarios admin ON admin.id_usuario=a.id_administrador
            WHERE u.id_usuario=?
              AND u.id_rol=2
              AND a.id_administrador=?
              AND a.fecha_fin IS NULL
              AND admin.id_rol=1
              AND admin.estado=1
            LIMIT 1
        `,[idUsuario,Number(req.usuario.id_usuario)]);

        if(usuario.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe.'
            });
        }

        if(usuario[0].token_verificacion_correo!==null){
            return res.status(409).json({
                estado:0,
                mensaje:'El observador debe verificar su correo antes de activar o desactivar la cuenta.'
            });
        }

        await conmysql.query(`
            UPDATE usuarios
            SET estado=?
            WHERE id_usuario=?
              AND id_rol=2
        `,[estado,idUsuario]);

        return res.status(200).json({
            estado:1,
            mensaje:estado===1
                ? 'Observador activado correctamente.'
                : 'Observador desactivado correctamente.',
            data:{
                id_usuario:idUsuario,
                estado
            }
        });
    }catch(error){
        
        return res.status(500).json({
            estado:0,
            mensaje:'Error al cambiar el estado del observador.'
        });
    }
};