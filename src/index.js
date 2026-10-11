import http from "http";
import app from "./app.js";
import { PORT } from "./config.js";
import { iniciarSocket } from "./websocket/socket.js";

const server = http.createServer(app);

iniciarSocket(server);

server.listen(PORT);