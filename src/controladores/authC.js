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
// LISTA NEGRA Y DETECTOR DE TEXTO INCOHERENTE
// ==========================================
const palabrasProhibidas = [
    'mama', 'tanga', 'papa', 'culo', 'puta', 'puto', 'mierda', 'verga', 'pito',
    'pendejo', 'pendeja', 'idiota', 'maricon', 'perra', 'perro', 'chucha', 'hdp',
    'admin', 'administrador', 'root', 'test', 'prueba', 'usuario', 'null', 'undefined',
    'anonimo', 'nobody', 'fake', 'bot', 'observador', 'veedor'
];

const esNombreValidoBackend = (texto) => {
    const limpio = String(texto || '').trim().replace(/\s+/g, ' ');

    // 1. Longitud básica razonable
    if (limpio.length < 2 || limpio.length > 30) return false;

    // 2. Solo letras del abecedario en español y espacios simples
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+(?: [a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)*$/;
    if (!regexLetras.test(limpio)) return false;

    // 3. Máximo 2 palabras por campo (ej. "Juan Carlos" o "Pérez Loor")
    const palabras = limpio.split(' ');
    if (palabras.length > 2) return false;

    for (const palabra of palabras) {
        if (palabra.length < 2 || palabra.length > 15) return false;

        const pLower = palabra.toLowerCase();
        const pSinTildes = pLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // 4. Comprobar contra términos y palabras no admitidas
        if (palabrasProhibidas.includes(pSinTildes)) return false;

        // 5. Bloquear 3 letras idénticas seguidas (ej: "aaa", "fff", "lll")
        if (/([a-záéíóúñü])\1\1/i.test(pLower)) return false;

        // 6. Debe contener al menos una vocal
        if (!/[aeiouáéíóúü]/i.test(pLower)) return false;

        // 7. Bloquear 3 o más vocales consecutivas no comunes (ej: "uie", "iee")
        if (/[aeiouáéíóúü]{3,}/i.test(pLower)) return false;

        // 8. Bloquear 3 o más consonantes seguidas sin vocales
        if (/[bcdfghjklmnñpqrstvwxyz]{3,}/i.test(pLower)) return false;

        // 9. Combinaciones fonéticas imposibles en español (bloquea "bf", "fb", "ubf", "fub")
        if (/(bf|fb|ubf|fub|bbu|ffu|jd|dj|qj|xj|zx|jk|kj|wq|qw|fg|gf|vb|bv|bp|pb|fn|nf)/i.test(pLower)) return false;

        // 10. Bloquear repetición excesiva de la misma consonante en una palabra corta
        const conteoB = (pLower.match(/b/g) || []).length;
        const conteoF = (pLower.match(/f/g) || []).length;
        if (conteoB >= 3 || conteoF >= 3) return false;

        // 11. Bucles repetitivos de teclado (ej: "aijdaijd", "asdfasdf")
        if (/(.{2,4})\1\1/i.test(pLower)) return false;
    }

    return true;
};

// ==========================================
// REGISTRAR USUARIO
// ==========================================
export const registrarUsuario = async (req, res) => {
    try {
        let { nombre, apellido, correo, password, id_rol } = req.body;

        nombre = String(nombre || '').trim().replace(/\s+/g, ' ');
        apellido = String(apellido || '').trim().replace(/\s+/g, ' ');
        correo = String(correo || '').trim().toLowerCase();

        // 1. Validar campos obligatorios
        if (!nombre || !apellido || !correo || !password) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Todos los campos son obligatorios."
            });
        }

        // 2. Validar que el nombre sea auténtico
        if (!esNombreValidoBackend(nombre)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El nombre no es válido. Escriba un nombre real y formal."
            });
        }

        // 3. Validar que el apellido sea auténtico
        if (!esNombreValidoBackend(apellido)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El apellido no es válido. Escriba un apellido real y formal."
            });
        }

        // 4. Validar formato de correo
        const regexCorreo = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
        if (!regexCorreo.test(correo)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "Ingrese un correo electrónico válido."
            });
        }

        // Normalizar capitalización (Primera letra Mayúscula por palabra)
        const formatearPalabra = (str) =>
            str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');

        const nombreFormateado = formatearPalabra(nombre);
        const apellidoFormateado = formatearPalabra(apellido);

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const [resultado] = await conmysql.query(
            `INSERT INTO usuarios (nombre, apellido, correo, password_hash, id_rol)
             VALUES (?, ?, ?, ?, ?)`,
            [nombreFormateado, apellidoFormateado, correo, hash, id_rol || 2]
        );

        res.status(201).json({
            estado: 1,
            mensaje: "Usuario registrado con éxito",
            id_usuario: resultado.insertId
        });

    } catch (error) {
        console.error("❌ Error registrarUsuario:", error);

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

            intentosLogin.delete(clave);
        }

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

        const passValido = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passValido) {
            const datos = intentosLogin.get(clave) || {
                intentos: 0,
                bloqueadoHasta: null
            };

            datos.intentos++;

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

        intentosLogin.delete(clave);

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
             SET reset_token=?, reset_token_expira=?
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
                        name: "VIGÍA",
                        email: "veedoresbu@gmail.com"
                    },
                    to: [
                        {
                            email: correo
                        }
                    ],
                    subject: "Recuperación de contraseña | VIGÍA",
                    htmlContent: `
<!DOCTYPE html>
<html lang="es">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width,initial-scale=1.0">
 <title>Recuperación de contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6f9;font-family:Arial,Helvetica,sans-serif;color:#071627;">
 <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6f9;padding:40px 15px;">
  <tr>
   <td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(7,22,39,.08);">
     <tr><td style="height:6px;background-color:#17b8ac;font-size:0;line-height:0;">&nbsp;</td></tr>
     <tr>
      <td style="padding:35px 40px 25px 40px;">
       <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
         <td width="62" valign="middle">
          <div style="width:52px;height:52px;background-color:#071627;border-radius:12px;text-align:center;line-height:52px;color:#5eead4;font-size:27px;font-weight:bold;">◎</div>
         </td>
         <td valign="middle">
          <div style="font-size:26px;font-weight:800;color:#071627;letter-spacing:1px;">VIGÍA</div>
          <div style="margin-top:4px;font-size:11px;font-weight:600;color:#74889a;letter-spacing:1.2px;">OBSERVADORES · PESCA DE CERCO Y ATÚN</div>
         </td>
        </tr>
       </table>
      </td>
     </tr>
     <tr><td style="padding:0 40px;"><div style="height:1px;background-color:#e5eaef;"></div></td></tr>
     <tr>
      <td style="padding:38px 40px 15px 40px;text-align:center;">
       <div style="width:72px;height:72px;margin:0 auto 24px auto;background-color:#e9fbf9;border-radius:50%;line-height:72px;font-size:34px;">🔒</div>
       <h1 style="margin:0 0 15px 0;font-size:28px;line-height:36px;color:#071627;font-weight:800;">Recuperación de contraseña</h1>
       <p style="margin:0 auto;max-width:470px;color:#66798a;font-size:15px;line-height:24px;">
        Recibimos una solicitud para restablecer la contraseña asociada a tu cuenta de <strong style="color:#071627;">VIGÍA</strong>.
       </p>
      </td>
     </tr>
     <tr>
      <td align="center" style="padding:20px 40px 30px 40px;">
       <table cellpadding="0" cellspacing="0" border="0">
        <tr>
         <td align="center" style="background-color:#ff7a52;border-radius:30px;">
          <a href="${urlRecuperacion}" target="_blank" style="display:inline-block;padding:16px 34px;color:#071627;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:.5px;">
           RESTABLECER MI CONTRASEÑA →
          </a>
         </td>
        </tr>
       </table>
      </td>
     </tr>
     <tr>
      <td style="padding:0 40px 30px 40px;">
       <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f8fa;border-radius:12px;">
        <tr>
         <td width="45" style="padding:18px 0 18px 20px;color:#17b8ac;font-size:21px;vertical-align:top;">◷</td>
         <td style="padding:17px 20px 17px 5px;color:#66798a;font-size:13px;line-height:20px;">
          <strong style="color:#071627;">Este enlace es válido durante 1 hora.</strong><br>
          Después de ese tiempo deberás solicitar un nuevo enlace de recuperación.
         </td>
        </tr>
       </table>
      </td>
     </tr>
     <tr>
      <td style="padding:0 40px 35px 40px;">
       <p style="margin:0;color:#8293a1;font-size:12px;line-height:19px;text-align:center;">
        Si no solicitaste un cambio de contraseña, puedes ignorar este mensaje. Tu contraseña actual permanecerá sin cambios.
       </p>
      </td>
     </tr>
     <tr>
      <td style="padding:25px 40px;background-color:#071627;text-align:center;">
       <div style="color:#ffffff;font-size:13px;font-weight:700;margin-bottom:6px;">Sistema Observador de Pesca</div>
       <div style="color:#5eead4;font-size:11px;letter-spacing:.7px;">VIGÍA · DETECCIÓN DE ESPECIES CON IA</div>
       <div style="margin-top:15px;color:#8195a5;font-size:10px;">Este es un mensaje automático. No respondas a este correo.</div>
      </td>
     </tr>
    </table>
    <p style="margin:20px 0 0 0;color:#98a5b1;font-size:11px;text-align:center;">
     © ${new Date().getFullYear()} VIGÍA · Sistema Observador de Pesca
    </p>
   </td>
  </tr>
 </table>
</body>
</html>
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

        console.log('📨 Correo enviado correctamente. ID:', data.messageId);

        return res.status(200).json({
            estado: 1,
            mensaje: "Correo de recuperación enviado. Revisa tu bandeja de entrada."
        });

    } catch (error) {
        console.error('❌ Error interno:', error);

        return res.status(500).json({
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

        const correoUsuario = String(usuarios[0].correo || '').trim().toLowerCase();
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
            `SELECT id_usuario, nombre, apellido, correo
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

        nombre = String(nombre || "").trim().replace(/\s+/g, ' ');
        apellido = String(apellido || "").trim().replace(/\s+/g, ' ');
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

        // Validar formato de nombre auténtico
        if (!esNombreValidoBackend(nombre)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El nombre no es válido. Escriba un nombre real y formal."
            });
        }

        // Validar formato de apellido auténtico
        if (!esNombreValidoBackend(apellido)) {
            return res.status(400).json({
                estado: 0,
                mensaje: "El apellido no es válido. Escriba un apellido real y formal."
            });
        }

        const correoValido = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
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

        const formatearPalabra = (str) =>
            str.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');

        const nombreFormateado = formatearPalabra(nombre);
        const apellidoFormateado = formatearPalabra(apellido);

        await conmysql.query(
            `UPDATE usuarios
             SET nombre=?, apellido=?, correo=?
             WHERE id_usuario=?`,
            [nombreFormateado, apellidoFormateado, correo, idUsuario]
        );

        return res.status(200).json({
            estado: 1,
            mensaje: "Información actualizada correctamente.",
            data: {
                id_usuario: idUsuario,
                nombre: nombreFormateado,
                apellido: apellidoFormateado,
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
            `SELECT id_usuario, password_hash
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
        console.error('❌ Error cambiarPassword:', error);

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
             AND reset_token_expira>?`,
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