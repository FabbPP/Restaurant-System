Backend (Node.js + Express) para Restaurant-System

Requisitos:
- Node.js (16+)
- PostgreSQL

Instrucciones rápidas:
1. cd backend
2. npm install
3. Copiar .env.example a .env y ajustar DATABASE_URL (ej: postgresql://user:pass@localhost:5432/restaurantdb)
4. Crear la BD y ejecutar el script: psql <connection_string> -f sql/init.sql
5. Ejecutar en desarrollo: npm run dev (requiere nodemon) o npm start

Rutas principales (prefijo /api):
- /api/productos
- /api/mesas
- /api/meseros
- /api/ordenes

Nota: Este scaffold es mínimo; validar y ampliar según reglas de negocio (transacciones, validaciones, autenticación, etc.).
