import http from "http";
import app from "./app.js";
import { PORT } from "./config.js";
import { iniciarSocket } from "./websocket/socket.js";
import { iniciarLimpiezaCuentasPendientes } from "./utilidades/limpieza-cuentas-pendientes.js";

const server = http.createServer(app);

iniciarSocket(server);
iniciarLimpiezaCuentasPendientes();

server.listen(PORT);