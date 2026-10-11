import express from 'express'
import cors from 'cors';

//importar las rutas 
import balanzaRouters from './routes/balanza.routes.js'
import deteccionRouters from './routes/deteccion.routes.js'
import capturaRouters from './routes/captura.routes.js'
import authRouters from './routes/auth.routes.js'
import reporteRouters from './routes/reporte.routes.js'
import dashboardRouters from './routes/dashboard.routes.js';
import administradorR from './routes/admin.routes.js';
import usuariosR from './routes/usuario.routes.js';

const app = express();

app.use(express.json({ limit: '1mb' })); // la app trabajara con JSON limitado

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
app.use('/api/auth', authRouters)
app.use('/api/reporte', reporteRouters)
app.use('/api/dashboard', dashboardRouters)
app.use('/api/administrador',administradorR);
app.use('/api/usuarios',usuariosR);


app.use((req, resp, next) => {
    resp.status(400).json({
        message: 'Endpoint not fount'
    })
})

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status = Number(error.statusCode || error.status);

    if (status === 400) {
        return res.status(400).json({
            message: 'La solicitud no es válida.'
        });
    }

    if (status === 413) {
        return res.status(413).json({
            message: 'La solicitud supera el tamaño permitido.'
        });
    }

    return res.status(500).json({
        message: 'Error interno del servidor.'
    });
});

export default app;