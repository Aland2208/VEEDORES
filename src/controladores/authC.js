import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { conmysql } from "../db.js";

// ==========================================
// CONTROL DE INTENTOS DE LOGIN
// ==========================================
const MAX_INTENTOS = 3;
const TIEMPO_BLOQUEO = 15 * 60 * 1000;
const intentosLogin = new Map();

// ==========================================
// REGISTRAR USUARIO
// ==========================================
export const registrarUsuario = async (req, res) => {
    try {
        const { nombre, apellido, correo, password, id_rol } = req.body;

        if (!nombre || !apellido || !correo || !password) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Faltan datos obligatorios."
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const [resultado] = await conmysql.query(
            `INSERT INTO usuarios (nombre,apellido,correo,password_hash,id_rol)
    VALUES (?,?,?,?,?)`,
            [nombre, apellido, correo, hash, id_rol || 2]
        );

        res.status(201).json({
            estado: 1,
            mensaje: "Usuario registrado con éxito",
            id_usuario: resultado.insertId
        });

    } catch (error) {
        console.error(error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                estado: 0,
                mensaje: "El correo ya está registrado."
            });
        }

        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor al registrar."
        });
    }
};

// ==========================================
// LOGIN CON BLOQUEO TEMPORAL
// ==========================================
export const loginUsuario = async (req, res) => {
    try {
        let { correo, password } = req.body;

        correo = String(correo || '').trim().toLowerCase();
        password = String(password || '');

        if (!correo || !password) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Correo y contraseña son obligatorios.'
            });
        }

        const clave = correo;
        const ahora = Date.now();
        const registro = intentosLogin.get(clave);

        // Verificar si el usuario está bloqueado
        if (registro?.bloqueadoHasta) {
            if (ahora < registro.bloqueadoHasta) {
                const segundosRestantes = Math.ceil(
                    (registro.bloqueadoHasta - ahora) / 1000
                );

                return res.status(423).json({
                    estado: 0,
                    bloqueado: true,
                    segundos_restantes: segundosRestantes,
                    mensaje: 'Acceso bloqueado temporalmente por múltiples intentos fallidos.'
                });
            }

            // Si terminó el tiempo de bloqueo, reiniciar intentos
            intentosLogin.delete(clave);
        }

        // Buscar usuario activo
        const [usuarios] = await conmysql.query(
            `SELECT * FROM usuarios WHERE correo=? AND estado=1`,
            [correo]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                estado: 0,
                mensaje: 'Credenciales inválidas.'
            });
        }

        const usuario = usuarios[0];

        // Comprobar contraseña
        const passValido = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        // Contraseña incorrecta
        if (!passValido) {
            const datos = intentosLogin.get(clave) || {
                intentos: 0,
                bloqueadoHasta: null
            };

            datos.intentos++;

            // Bloquear después de 5 intentos
            if (datos.intentos >= MAX_INTENTOS) {
                datos.bloqueadoHasta = Date.now() + TIEMPO_BLOQUEO;

                intentosLogin.set(clave, datos);

                return res.status(423).json({
                    estado: 0,
                    bloqueado: true,
                    intentos_restantes: 0,
                    segundos_restantes: TIEMPO_BLOQUEO / 1000,
                    mensaje: 'Has superado el máximo de 3 intentos fallidos. Acceso bloqueado durante 15 minutos.'
                });
            }

            // Guardar los intentos fallidos
            intentosLogin.set(clave, datos);

            const restantes = MAX_INTENTOS - datos.intentos;

            return res.status(401).json({
                estado: 0,
                bloqueado: false,
                intentos_fallidos: datos.intentos,
                intentos_restantes: restantes,
                mensaje: `Credenciales inválidas. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'}.`
            });
        }

        // Login correcto: eliminar intentos fallidos
        intentosLogin.delete(clave);

        // Generar JWT
        const token = jwt.sign(
            {
                id_usuario: usuario.id_usuario,
                id_rol: usuario.id_rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        return res.status(200).json({
            estado: 1,
            mensaje: "Login exitoso",
            token,
            data: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                id_rol: usuario.id_rol
            }
        });

    } catch (error) {
        console.error("❌ Error loginUsuario:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor en login."
        });
    }
};

// ==========================================
// SOLICITAR RECUPERACIÓN
// ==========================================
export const solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;

        const tokenRecuperacion = crypto.randomBytes(20).toString("hex");
        const fechaExpira = new Date(Date.now() + 3600000);

        const [resultado] = await conmysql.query(
            `UPDATE usuarios
    SET reset_token=?,reset_token_expira=?
    WHERE correo=?`,
            [tokenRecuperacion, fechaExpira, correo]
        );

        if (resultado.affectedRows === 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Correo no encontrado."
            });
        }

        const urlRecuperacion =
            `${process.env.FRONTEND_URL}/restablecer-password?token=${tokenRecuperacion}`;

        const respuestaBrevo = await fetch(
            'https://api.brevo.com/v3/smtp/email',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': process.env.API_BREVO
                },
                body: JSON.stringify({
                    sender: {
                        name: "Sistema Observador de Pesca",
                        email: "veedoresbu@gmail.com"
                    },
                    to: [
                        {
                            email: correo
                        }
                    ],
                    subject: "Recuperación de contraseña",
                    htmlContent: `
      <div style="font-family:Arial,sans-serif;padding:20px;border:2px solid #3880ff;border-radius:8px;max-width:500px;margin:auto;">
       <h2 style="color:#3880ff;text-align:center;">
        Recuperación de Contraseña
       </h2>

       <p style="color:#333;">
        Has solicitado restablecer tu contraseña.
        Haz clic en el botón de abajo para continuar:
       </p>

       <div style="text-align:center;margin:25px 0;">
        <a href="${urlRecuperacion}"
         style="background-color:#3880ff;color:white;padding:12px 20px;text-decoration:none;font-weight:bold;border-radius:5px;">
         Restablecer mi contraseña
        </a>
       </div>

       <hr style="border:none;border-top:1px solid #eee;margin-top:30px;"/>

       <p style="font-size:11px;color:#999;text-align:center;">
        Si no solicitaste esto, ignora este mensaje.
       </p>
      </div>
     `
                })
            }
        );

        if (!respuestaBrevo.ok) {
            const errorData = await respuestaBrevo.json();

            console.error('❌ Error de Brevo:', errorData);

            return res.status(500).json({
                estado: 0,
                mensaje: "Error al enviar el correo."
            });
        }

        const data = await respuestaBrevo.json();

        console.log(
            '📨 Correo enviado correctamente. ID:',
            data.messageId
        );

        res.status(200).json({
            estado: 1,
            mensaje: "Correo de recuperación enviado. Revisa tu bandeja de entrada."
        });

    } catch (error) {
        console.error('❌ Error interno:', error);

        res.status(500).json({
            estado: 0,
            mensaje: "Error interno al enviar el correo."
        });
    }
};

// ==========================================
// RESTABLECER CONTRASEÑA
// ==========================================
export const restablecerPassword = async (req, res) => {
    try {
        const { token, nuevaPassword } = req.body;
        const ahora = new Date();

        const [usuarios] = await conmysql.query(
            `SELECT *
    FROM usuarios
    WHERE reset_token=?
    AND reset_token_expira>?`,
            [token, ahora]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El enlace de recuperación es inválido o ha expirado."
            });
        }

        const id_usuario = usuarios[0].id_usuario;

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(nuevaPassword, salt);

        await conmysql.query(
            `UPDATE usuarios
    SET password_hash=?,
        reset_token=NULL,
        reset_token_expira=NULL
    WHERE id_usuario=?`,
            [hash, id_usuario]
        );

        // Si tenía intentos fallidos, los eliminamos
        const correoUsuario = String(
            usuarios[0].correo || ''
        ).trim().toLowerCase();

        if (correoUsuario) {
            intentosLogin.delete(correoUsuario);
        }

        res.status(200).json({
            estado: 1,
            mensaje: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor al restablecer contraseña."
        });
    }
};

// ==========================================
// OBTENER PERFIL DEL USUARIO
// ==========================================
export const obtenerPerfil = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        if (!idUsuario) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Usuario no válido."
            });
        }

        const [usuarios] = await conmysql.query(
            `SELECT id_usuario,nombre,apellido,correo
    FROM usuarios
    WHERE id_usuario=? AND estado=1
    LIMIT 1`,
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Usuario no encontrado."
            });
        }

        return res.status(200).json({
            estado: 1,
            data: usuarios[0]
        });

    } catch (error) {
        console.error("❌ Error obtenerPerfil:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor al obtener el perfil."
        });
    }
};

// ==========================================
// ACTUALIZAR PERFIL DEL USUARIO
// ==========================================
export const actualizarPerfil = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);

        let { nombre, apellido, correo } = req.body;

        nombre = String(nombre || "").trim();
        apellido = String(apellido || "").trim();
        correo = String(correo || "").trim().toLowerCase();

        if (!idUsuario) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Usuario no válido."
            });
        }

        if (!nombre || !apellido || !correo) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Nombre, apellido y correo son obligatorios."
            });
        }

        if (nombre.length > 100) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El nombre no puede superar los 100 caracteres."
            });
        }

        if (apellido.length > 100) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El apellido no puede superar los 100 caracteres."
            });
        }

        if (correo.length > 150) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El correo no puede superar los 150 caracteres."
            });
        }

        const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!correoValido.test(correo)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Ingrese un correo electrónico válido."
            });
        }

        const [usuarios] = await conmysql.query(
            `SELECT id_usuario
    FROM usuarios
    WHERE id_usuario=? AND estado=1
    LIMIT 1`,
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: "Usuario no encontrado."
            });
        }

        const [correoExistente] = await conmysql.query(
            `SELECT id_usuario
    FROM usuarios
    WHERE correo=? AND id_usuario<>?
    LIMIT 1`,
            [correo, idUsuario]
        );

        if (correoExistente.length > 0) {
            return res.status(409).json({
                estado: 0,
                mensaje: "El correo electrónico ya está registrado."
            });
        }

        await conmysql.query(
            `UPDATE usuarios
    SET nombre=?,apellido=?,correo=?
    WHERE id_usuario=?`,
            [nombre, apellido, correo, idUsuario]
        );

        return res.status(200).json({
            estado: 1,
            mensaje: "Información actualizada correctamente.",
            data: {
                id_usuario: idUsuario,
                nombre,
                apellido,
                correo
            }
        });

    } catch (error) {
        console.error("❌ Error actualizarPerfil:", error);

        return res.status(500).json({
            estado: 0,
            mensaje: "Error del servidor al actualizar el perfil."
        });
    }
};

// ==========================================
// CAMBIAR CONTRASEÑA
// ==========================================
export const cambiarPassword = async (req, res) => {
    try {
        const idUsuario = Number(req.params.id_usuario);
        const { passwordActual, nuevaPassword } = req.body;

        if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'Usuario no válido.'
            });
        }

        if (!passwordActual || !nuevaPassword) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'La contraseña actual y la nueva contraseña son obligatorias.'
            });
        }

        if (nuevaPassword.length < 8) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.'
            });
        }

        const [usuarios] = await conmysql.query(
            `SELECT id_usuario,password_hash
    FROM usuarios
    WHERE id_usuario=? AND estado=1
    LIMIT 1`,
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                estado: 0,
                mensaje: 'Usuario no encontrado.'
            });
        }

        const usuario = usuarios[0];

        const passwordCorrecta = await bcrypt.compare(
            passwordActual,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'La contraseña actual es incorrecta.'
            });
        }

        const mismaPassword = await bcrypt.compare(
            nuevaPassword,
            usuario.password_hash
        );

        if (mismaPassword) {
            return res.status(400).json({
                estado: 0,
                mensaje: 'La nueva contraseña debe ser diferente a la contraseña actual.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const nuevoHash = await bcrypt.hash(
            nuevaPassword,
            salt
        );

        await conmysql.query(
            `UPDATE usuarios
    SET password_hash=?
    WHERE id_usuario=?`,
            [nuevoHash, idUsuario]
        );

        return res.status(200).json({
            estado: 1,
            mensaje: 'Contraseña actualizada correctamente.'
        });

    } catch (error) {
        console.error(
            '❌ Error cambiarPassword:',
            error
        );

        return res.status(500).json({
            estado: 0,
            mensaje: 'Error del servidor al cambiar la contraseña.'
        });
    }
};

// ==========================================
// VALIDAR TOKEN DE RECUPERACIÓN
// ==========================================
export const validarTokenRecuperacion = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                estado: 0,
                valido: false,
                mensaje: "Token no proporcionado."
            });
        }

        const ahora = new Date();

        const [usuarios] = await conmysql.query(
            `SELECT id_usuario
    FROM usuarios
    WHERE reset_token=?
    AND reset_token_expira>?
    LIMIT 1`,
            [token, ahora]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({
                estado: 0,
                valido: false,
                mensaje: "El enlace de recuperación es inválido, expiró o ya fue utilizado."
            });
        }

        return res.status(200).json({
            estado: 1,
            valido: true,
            mensaje: "Token válido."
        });

    } catch (error) {
        console.error("❌ Error validarTokenRecuperacion:", error);

        return res.status(500).json({
            estado: 0,
            valido: false,
            mensaje: "Error del servidor al validar el enlace."
        });
    }
};