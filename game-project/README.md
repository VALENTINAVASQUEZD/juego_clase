## Proyecto Final UCC – Backend + Game (React + Three.js)
## Maria Valentina Vasquez Delgado , Juan David Moncayo Muñoz 
Monorepo con dos aplicaciones principales:

- `backend`: API REST y servidor WebSocket (Socket.io) con Node.js, Express y **PostgreSQL**. Incluye autenticación con **JWT**.
- `game-project`: Frontend 3D con React, Vite y Three.js. Contiene **5 niveles** de juego con enemigos, premios y obstáculos.

---

### Requisitos

- Node.js 18+ y npm
- PostgreSQL 14+ (local o en la nube, p.ej. Supabase / Railway)

---

### Estructura

```
juego_clase/
├─ backend/            # API REST + Socket.io + autenticación JWT
└─ game-project/       # Frontend 3D (React + Vite + Three.js)
```

---

### Variables de entorno

Crear `backend/.env` con:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=tu_password
PG_DATABASE=threejs_blocks
JWT_SECRET=cambia_esto_por_un_secreto_seguro
PORT=3001
```

Crear `game-project/.env` (o `.env.local`) con:

```env
VITE_API_URL=http://localhost:3001
VITE_ENEMIES_COUNT=1
```

---

### Instalación

```bash
# Backend
cd backend
npm install

# Frontend
cd ../game-project
npm install
```

---

### Base de datos (PostgreSQL)

El backend usa PostgreSQL. Asegúrate de tener una base de datos creada y ejecuta el seed si es necesario:

```bash
cd backend
node seed.js   # carga bloques iniciales (opcional)
```

> Si usas Supabase o Railway, configura las variables `PG_*` con los datos de conexión del panel de tu servicio.

---

### Ejecución en desarrollo

```bash
# Terminal 1 – Backend
cd backend && node app.js
# → http://localhost:3001

# Terminal 2 – Frontend
cd game-project && npm run dev
# → http://localhost:5173
```

---

### Controles del juego

| Tecla | Acción |
|-------|--------|
| ↑ ↓ ← → | Mover personaje |
| `Espacio` | Saltar |
| `Shift` | **Correr (sprint)** |

---

### Los 5 niveles

| Nivel | Tema | Descripción |
|-------|------|-------------|
| 1 | Espacio Profundo | Nivel introductorio, 1 enemigo, 5 s de gracia |
| 2 | Zona de Peligro | Plataformas elevadas, más obstáculos |
| 3 | Energía Extrema | Velocidad del enemigo aumentada |
| 4 | Dimensión Oculta | Diseño laberíntico |
| 5 | Jefe Final | Mayor dificultad, nivel definitivo |

Cada nivel tiene 2 carteles vistosos contextuales. El enemigo espera **5 segundos** antes de perseguir al jugador al iniciar cada nivel.

---

### Autenticación JWT

1. `POST /api/auth/register` → Registra usuario, retorna `{ token }`.
2. `POST /api/auth/login` → Autentica usuario, retorna `{ token }`.
3. Rutas protegidas requieren header `Authorization: Bearer <token>`.

---

### API REST

Base URL: `http://localhost:3001/api`

- `GET  /api/blocks?level=1` → Lista bloques por nivel.
- `POST /api/blocks` → Crea un bloque `{ name, x, y, z, level }`.
- `POST /api/blocks/batch` → Inserta múltiples bloques.
- `GET  /api/blocks/ping` → Healthcheck.
- `POST /api/auth/register` → Registro.
- `POST /api/auth/login` → Login + JWT.

---

### WebSocket (multijugador)

Socket.io en `http://localhost:3001`. Eventos: `new-player`, `update-position`, `remove-player`, `players-update`, `existing-players`.

---

### Despliegue en Vercel (frontend)

1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repo.
3. Configura **Root Directory**: `game-project`.
4. Agrega variables de entorno en el panel de Vercel:
   ```
   VITE_API_URL=https://tu-backend.railway.app
   VITE_ENEMIES_COUNT=1
   ```
5. **Deploy**. Vercel detecta Vite automáticamente (build: `npm run build`, output: `dist`).

> Para el backend usa Railway o Render (soportan Node.js + PostgreSQL). Copia la URL pública en `VITE_API_URL`.

---

### Estructura del frontend

```
game-project/
├─ public/            # assets (modelos GLB, texturas, sonidos)
└─ src/
   ├─ Experience/     # Núcleo 3D
   │   ├─ World/      # Robot, Enemy, LevelManager, World
   │   └─ Utils/      # KeyboardControls, Physics, Time...
   ├─ loaders/        # ToyCarLoader
   ├─ network/        # SocketManager
   └─ controls/       # MobileControls
```

---

### Solución de problemas

- Verifica que PostgreSQL esté corriendo y las variables `PG_*` sean correctas.
- Si el frontend no carga datos, revisa `VITE_API_URL` en la consola del navegador.
- CORS: en producción cambia `origin: '*'` al dominio de Vercel.
- JWT expirado: vuelve a hacer login para obtener un token nuevo.

---

### Licencia y autoría

- Autor: Gustavo Willyn Sánchez Rodríguez — `guswillsan@gmail.com`
- Licencia: ISC