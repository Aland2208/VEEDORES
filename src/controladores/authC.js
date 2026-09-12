import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { conmysql } from "../db.js";

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
// SOLICITAR RECUPERACIÓN (VÍA API BREVO)
// ==========================================
export const solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;
        
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

        // Llamada directa a la API oficial de Brevo
        const respuestaBrevo = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "api-key": process.env.API_BREVO
            },
            body: JSON.stringify({
                sender: { email: "veedoresbu@gmail.com", name: "Sistema Observador de Pesca" },
                to: [{ email: correo }],
                subject: "Recuperación de Contraseña",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #3880ff; text-align: center;">Recuperación de Contraseña</h2>
                        <p>Has solicitado restablecer tu contraseña en el Sistema de Observador de Pesca.</p>
                        <p>Haz clic en el siguiente botón para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${urlRecuperacion}" style="background-color: #3880ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer Contraseña</a>
                        </div>
                        <p style="font-size: 12px; color: #666; text-align: center;">Si tú no solicitaste esto, ignora este correo.</p>
                    </div>
                `
            })
        });

        if (!respuestaBrevo.ok) {
            const errorDetalle = await respuestaBrevo.json();
            console.error("Error API Brevo:", errorDetalle);
            return res.status(500).json({ estado: 0, mensaje: "No se pudo enviar el correo de recuperación." });
        }

        res.status(200).json({ estado: 1, mensaje: "Correo de recuperación enviado. Revisa tu bandeja de entrada." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ estado: 0, mensaje: "Error del servidor." });
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