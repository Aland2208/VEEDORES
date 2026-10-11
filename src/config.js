import {config} from 'dotenv'
config()

export const BD_HOST=process.env.BD_HOST || 'localhost'
export const BD_DATABASE=process.env.BD_DATABASE || 'baseapp20252'
export const BD_USER=process.env.BD_USER ||'root'
export const BD_PASSWORD=process.env.BD_PASSWORD || ''
export const BD_PORT=process.env.BD_PORT || 3306
export const PORT=process.env.PORT || 3000

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'clave_por_defecto') {
    throw new Error('JWT_SECRET debe configurarse antes de iniciar el servidor.')
}

export const JWT_SECRET = process.env.JWT_SECRET

const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean) || []

if (process.env.FRONTEND_URL) {
    configuredOrigins.push(new URL(process.env.FRONTEND_URL).origin)
}

if (process.env.NODE_ENV !== 'production') {
    configuredOrigins.push('http://localhost:8100', 'http://localhost:4200')
}

export const CORS_ORIGINS = [...new Set(configuredOrigins)]