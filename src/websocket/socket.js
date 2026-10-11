import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { CORS_ORIGINS, JWT_SECRET } from "../config.js";

let io;

export const iniciarSocket = (server) => {

    io = new Server(server, {
        cors: {
            origin: CORS_ORIGINS,
            methods: ["GET", "POST"],
            credentials: false
        }
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string" || !token) {
            return next(new Error("Authentication required"));
        }

        try {
            socket.data.usuario = jwt.verify(token, JWT_SECRET);
            return next();
        } catch {
            return next(new Error("Invalid session"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`usuario:${Number(socket.data.usuario.id_usuario)}`);
        if (Number(socket.data.usuario.id_rol) === 1) {
            socket.join("administradores");
        }

        socket.on("disconnect", () => {
            
        });
    });

};

export const getIO = () => io;