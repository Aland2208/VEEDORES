/* import app from './app.js'
import{PORT} from './config.js'

app.listen(PORT);//3000
console.log('El servidor esta escuchando por el puesto:',PORT) */

import http from "http";
import app from "./app.js";
import { PORT } from "./config.js";
import { iniciarSocket } from "./websocket/socket.js";

const server = http.createServer(app);

iniciarSocket(server);

server.listen(PORT, () => {

    console.log("Servidor iniciado en puerto:", PORT);

});