import { conmysql } from '../db.js';
import bcrypt from 'bcrypt';

/* LISTAR OBSERVADORES */
export const getObservadores=async(req,res)=>{
    try{
        const [usuarios]=await conmysql.query(`
            SELECT
                id_usuario,
                nombre,
                apellido,
                correo,
                estado,
                fecha_creacion
            FROM usuarios
            WHERE id_rol=2
            ORDER BY nombre ASC,apellido ASC
        `);

        return res.status(200).json({
            estado:1,
            mensaje:'Observadores obtenidos correctamente.',
            data:usuarios
        });
    }catch(error){
        console.error('❌ Error getObservadores:',error);
        return res.status(500).json({
            estado:0,
            mensaje:'Error al obtener los observadores.'
        });
    }
};


/* CREAR OBSERVADOR */
export const crearObservador=async(req,res)=>{
    try{
        let {nombre,apellido,correo,password}=req.body;

        nombre=String(nombre||'').trim();
        apellido=String(apellido||'').trim();
        correo=String(correo||'').trim().toLowerCase();
        password=String(password||'');

        if(!nombre||!apellido||!correo||!password){
            return res.status(400).json({
                estado:0,
                mensaje:'Todos los campos son obligatorios.'
            });
        }

        if(password.length<6){
            return res.status(400).json({
                estado:0,
                mensaje:'La contraseña debe tener al menos 6 caracteres.'
            });
        }

        const [existente]=await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE LOWER(correo)=?
            LIMIT 1
        `,[correo]);

        if(existente.length>0){
            return res.status(409).json({
                estado:0,
                mensaje:'Ya existe una cuenta registrada con este correo.'
            });
        }

        const passwordHash=await bcrypt.hash(password,10);

        const [resultado]=await conmysql.query(`
            INSERT INTO usuarios(
                id_rol,
                nombre,
                apellido,
                correo,
                password_hash,
                estado,
                fecha_creacion
            )
            VALUES(
                2,
                ?,
                ?,
                ?,
                ?,
                1,
                DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 HOUR)
            )
        `,[nombre,apellido,correo,passwordHash]);

        return res.status(201).json({
            estado:1,
            mensaje:'Observador creado correctamente.',
            data:{
                id_usuario:resultado.insertId,
                nombre,
                apellido,
                correo,
                estado:1
            }
        });
    }catch(error){
        console.error('❌ Error crearObservador:',error);
        return res.status(500).json({
            estado:0,
            mensaje:'Error al crear el observador.'
        });
    }
};


/* EDITAR OBSERVADOR */
export const editarObservador=async(req,res)=>{
    try{
        const idUsuario=Number(req.params.id_usuario);

        let {nombre,apellido,correo}=req.body;

        nombre=String(nombre||'').trim();
        apellido=String(apellido||'').trim();
        correo=String(correo||'').trim().toLowerCase();

        if(!Number.isInteger(idUsuario)||idUsuario<=0){
            return res.status(400).json({
                estado:0,
                mensaje:'Usuario no válido.'
            });
        }

        if(!nombre||!apellido||!correo){
            return res.status(400).json({
                estado:0,
                mensaje:'Nombre, apellido y correo son obligatorios.'
            });
        }

        const [usuario]=await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
            LIMIT 1
        `,[idUsuario]);

        if(usuario.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe.'
            });
        }

        const [correoExistente]=await conmysql.query(`
            SELECT id_usuario
            FROM usuarios
            WHERE LOWER(correo)=?
              AND id_usuario<>?
            LIMIT 1
        `,[correo,idUsuario]);

        if(correoExistente.length>0){
            return res.status(409).json({
                estado:0,
                mensaje:'El correo ya está registrado por otro usuario.'
            });
        }

        await conmysql.query(`
            UPDATE usuarios
            SET
                nombre=?,
                apellido=?,
                correo=?
            WHERE id_usuario=?
              AND id_rol=2
        `,[nombre,apellido,correo,idUsuario]);

        return res.status(200).json({
            estado:1,
            mensaje:'Observador actualizado correctamente.',
            data:{
                id_usuario:idUsuario,
                nombre,
                apellido,
                correo
            }
        });
    }catch(error){
        console.error('❌ Error editarObservador:',error);
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
            SELECT id_usuario,estado
            FROM usuarios
            WHERE id_usuario=?
              AND id_rol=2
            LIMIT 1
        `,[idUsuario]);

        if(usuario.length===0){
            return res.status(404).json({
                estado:0,
                mensaje:'El observador no existe.'
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
        console.error('❌ Error cambiarEstadoObservador:',error);
        return res.status(500).json({
            estado:0,
            mensaje:'Error al cambiar el estado del observador.'
        });
    }
};