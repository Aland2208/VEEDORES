import express from 'express'
import cors from 'cors';

//importar las rutas 
import balanzaRouters from './routes/balanza.routes.js'
import deteccionRouters from './routes/deteccion.routes.js'
import capturaRouters from './routes/captura.routes.js'
const app = express();

app.use(express.json()); //la app trabajara con json

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}
app.use(cors(corsOptions))


// indicar las rutas a utilizar OJO
app.use('/api/balanza', balanzaRouters)
app.use('/api/deteccion', deteccionRouters)
app.use('/api/captura', capturaRouters)

app.use((req, resp, next) => {
    resp.status(400).json({
        message: 'Endpoint not fount'
    })
})

export default app;