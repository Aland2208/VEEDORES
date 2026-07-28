import { Server } from "socket.io";

let io;

export const iniciarSocket = (server) => {

    io = new Server(server, {

        cors: {

            origin: "*",

            methods: ["GET", "POST"]

        }

    });

    io.on("connection", (socket) => {

        console.log("Cliente conectado:", socket.id);

        socket.on("disconnect", () => {

            console.log("Cliente desconectado:", socket.id);

        });

    });

};

export const getIO = () => io;