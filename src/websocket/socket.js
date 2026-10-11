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
        
        socket.on("disconnect", () => {
            
        });
    });

};

export const getIO = () => io;