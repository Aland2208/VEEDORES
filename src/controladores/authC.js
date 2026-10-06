import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { conmysql } from "../db.js";

// Ya no necesitamos importar nada de 'module' ni '@getbrevo/brevo' aquí

// ==========================================
// REGISTRAR USUARIO
// ==========================================
export const registrarUsuario = async (req, res) => {
    try {
        const { nombre, apellido, correo, password, id_rol } = req.body;

        if (!nombre || !apellido || !correo || !password) {
            return res.status(400).json({ estado: 0, mensaje: "Faltan datos obligatorios." });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const [resultado] = await conmysql.query(
            `INSERT INTO usuarios (nombre, apellido, correo, password_hash, id_rol) VALUES (?, ?, ?, ?, ?)`,
            [nombre, apellido, correo, hash, id_rol || 2]
        );

        res.status(201).json({
            estado: 1,
            mensaje: "Usuario registrado con éxito",
            id_usuario: resultado.insertId,
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ estado: 0, mensaje: "El correo ya está registrado." });
        }
        res.status(500).json({ estado: 0, mensaje: "Error del servidor al registrar." });
    }
};

// ==========================================
// LOGIN
// ==========================================
export const loginUsuario = async (req, res) => {
    try {
        const { correo, password } = req.body;

        const [usuarios] = await conmysql.query(
            `SELECT * FROM usuarios WHERE correo = ? AND estado = 1`,
            [correo]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ estado: 0, mensaje: "Credenciales inválidas." });
        }

        const usuario = usuarios[0];
        const passValido = await bcrypt.compare(password, usuario.password_hash);

        if (!passValido) {
            return res.status(401).json({ estado: 0, mensaje: "Credenciales inválidas." });
        }

        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, id_rol: usuario.id_rol },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.status(200).json({
            estado: 1,
            mensaje: "Login exitoso",
            token: token,
            data: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                id_rol: usuario.id_rol
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ estado: 0, mensaje: "Error del servidor en login." });
    }
};

// ==========================================
// SOLICITAR RECUPERACIÓN (MÉTODO FETCH SEGURO)
// ==========================================
export const solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;

        // 1. Generar token y guardarlo en MySQL
        const tokenRecuperacion = crypto.randomBytes(20).toString("hex");
        const fechaExpira = new Date(Date.now() + 3600000);

        const [resultado] = await conmysql.query(
            `UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE correo = ?`,
            [tokenRecuperacion, fechaExpira, correo]
        );

        if (resultado.affectedRows === 0) {
            return res.status(400).json({ estado: 0, mensaje: "Correo no encontrado." });
        }

        const urlRecuperacion = `${process.env.FRONTEND_URL}/restablecer-password?token=${tokenRecuperacion}`;

        // 2. Enviar el correo usando fetch directo a la API de Brevo
        const respuestaBrevo = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': process.env.API_BREVO
            },
            body: JSON.stringify({
                sender: { name: "Sistema Observador de Pesca", email: "veedoresbu@gmail.com" },
                to: [{ email: correo }],
                subject: "Recuperación de contraseña",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #3880ff; border-radius: 8px; max-width: 500px; margin: auto;">
                        <h2 style="color: #3880ff; text-align: center;">Recuperación de Contraseña</h2>
                        <p style="color: #333;">Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${urlRecuperacion}" style="background-color: #3880ff; color: white; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Restablecer mi contraseña</a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                        <p style="font-size: 11px; color: #999; text-align: center;">Si no solicitaste esto, ignora este mensaje.</p>
                    </div>
                `
            })
        });

        // 3. Verificar si Brevo aceptó la petición
        if (!respuestaBrevo.ok) {
            const errorData = await respuestaBrevo.json();
            console.error('❌ Error de Brevo:', errorData);
            return res.status(500).json({ estado: 0, mensaje: "Error al enviar el correo." });
        }

        const data = await respuestaBrevo.json();
        console.log('📨 Correo enviado correctamente. ID:', data.messageId);

        res.status(200).json({ estado: 1, mensaje: "Correo de recuperación enviado. Revisa tu bandeja de entrada." });

    } catch (error) {
        console.error('❌ Error interno:', error);
        res.status(500).json({ estado: 0, mensaje: "Error interno al enviar el correo." });
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
            `SELECT * FROM usuarios WHERE reset_token = ? AND reset_token_expira > ?`,
            [token, ahora]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({ estado: 0, mensaje: "El enlace de recuperación es inválido o ha expirado." });
        }

        const id_usuario = usuarios[0].id_usuario;
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(nuevaPassword, salt);

        await conmysql.query(
            `UPDATE usuarios SET password_hash = ?, reset_token = NULL, reset_token_expira = NULL WHERE id_usuario = ?`,
            [hash, id_usuario]
        );

        res.status(200).json({ estado: 1, mensaje: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ estado: 0, mensaje: "Error del servidor al restablecer contraseña." });
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

        // Verificar que el usuario exista
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

        // Verificar que el correo no pertenezca a otro usuario
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