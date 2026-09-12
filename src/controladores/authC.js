import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { conmysql } from "../db.js";

// ==========================================
// CONFIGURACIÓN BREVO SMTP
// ==========================================
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
    },
});

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
            [nombre, apellido, correo, hash, id_rol || 2] // Por defecto asume rol 2 (Observador)
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
// SOLICITAR RECUPERACIÓN (Manda el correo vía Brevo)
// ==========================================
export const solicitarRecuperacion = async (req, res) => {
    try {
        const { correo } = req.body;
        
        // Generar un token aleatorio seguro
        const tokenRecuperacion = crypto.randomBytes(20).toString("hex");
        // Establecer caducidad en 1 hora
        const fechaExpira = new Date(Date.now() + 3600000); 

        const [resultado] = await conmysql.query(
            `UPDATE usuarios SET reset_token = ?, reset_token_expira = ? WHERE correo = ?`,
            [tokenRecuperacion, fechaExpira, correo]
        );

        if (resultado.affectedRows === 0) {
            return res.status(400).json({ estado: 0, mensaje: "Correo no encontrado." });
        }

        // Crear la URL que el usuario clickeará (apunta a tu frontend en Ionic/Angular)
        const urlRecuperacion = `${process.env.FRONTEND_URL}/restablecer-password?token=${tokenRecuperacion}`;

        const mailOptions = {
            from: '"Sistema Observador de Pesca" <veedoresbu@gmail.com>',
            to: correo,
            subject: "Recuperación de Contraseña",
            html: `
                <h3>Recuperación de Contraseña</h3>
                <p>Has solicitado restablecer tu contraseña en el Sistema de Observador de Pesca.</p>
                <p>Haz clic en el siguiente enlace para crear una nueva contraseña. Este enlace expira en 1 hora.</p>
                <a href="${urlRecuperacion}">Restablecer Contraseña</a>
                <br><br>
                <p>Si tú no solicitaste esto, ignora este correo.</p>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error Brevo SMTP:", error);
                return res.status(500).json({ estado: 0, mensaje: "No se pudo enviar el correo." });
            }
            res.status(200).json({ estado: 1, mensaje: "Correo de recuperación enviado. Revisa tu bandeja de entrada." });
        });

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