# 📦 Inventario de Bodega — Fundación Kinal

Sistema full-stack de inventario para una bodega, con **3 tablas relacionales**:

```
Categoria (1) ───< Producto (1) ───< Movimiento
```

- Una **Categoría** agrupa varios **Productos** (Papelería, Limpieza, etc.)
- Un **Producto** tiene muchos **Movimientos** (entradas/salidas de bodega — kardex)
- Registrar un movimiento actualiza automáticamente el `stock` del producto

**Stack:** TypeScript + Node.js + Express + Prisma + PostgreSQL (backend) y Angular (frontend).

> Este documento reemplaza al README original del proyecto. Explica cómo instalarlo desde
> cero en PostgreSQL 18 / pgAdmin4, qué estaba fallando, qué se corrigió, qué se agregó
> (tema visual) y con qué asistencia de IA se hizo el trabajo. Todo está al final de este
> archivo en la sección **"7. Bitácora de cambios"**, con el detalle de cada corrección.

---

## 0. Estructura de carpetas (sin cambios respecto al proyecto original)

```
kinal-inventario/
├── backend/                        # API REST (Node + TypeScript + Express + Prisma)
│   ├── src/                        # controllers, routes, services, middlewares, types
│   ├── prisma/                     # schema.prisma, migración inicial y seed.ts
│   ├── .env / .env.example
│   └── package.json
│
├── frontend/                       # Código fuente "plantilla" del Angular (ver sección 3)
│   └── src/                        # se copia dentro de un proyecto Angular recién creado
│
└── kinal-inventario-frontend/      # Proyecto Angular YA generado y listo para usar
    ├── src/
    ├── angular.json
    └── package.json
```

> **Nota sobre las dos carpetas de frontend:** `kinal-inventario-frontend/` es el proyecto
> Angular **completo y ya generado** (tiene `angular.json`, `tsconfig`, etc.) — es el que
> realmente se ejecuta con `pnpm start`. `frontend/` es solo el código fuente (`src/`) que
> se usaría como plantilla si algún día necesitas regenerar el proyecto desde cero con
> `ng new`. Ambas carpetas ya están sincronizadas con todas las correcciones de este
> documento, así que **normalmente solo necesitas trabajar dentro de `kinal-inventario-frontend/`**.

---

## 1. Requisitos previos

1. **Node.js**: esta versión de Angular (22) requiere **Node.js v22.22.3+, v24.15.0+ o v26+**.
   Si tu Node es más viejo (por ejemplo v18 o v20, como pedían versiones anteriores de este
   proyecto), el frontend no va a compilar y `ng serve`/`ng build` van a rechazar arrancar
   con un mensaje de "minimum Node.js version". Verifica con:
   ```bash
   node -v
   ```
   Si necesitas actualizar en Windows, descarga el instalador LTS más reciente desde
   https://nodejs.org.
2. **PostgreSQL 18** con **pgAdmin4** (lo que ya tienes instalado).
3. **pnpm** como gestor de paquetes:
   ```bash
   npm install -g pnpm
   ```
   La diferencia clave con `npm` es que para ejecutar un binario instalado localmente (lo
   que en npm sería `npx algo`) en pnpm se usa `pnpm exec algo`.
4. **Angular CLI** global (opcional, pero cómodo):
   ```bash
   pnpm add -g @angular/cli
   ```
5. Editor recomendado: VS Code.

---

## 2. Crear la base de datos en PostgreSQL 18 con pgAdmin4

Con PostgreSQL 18 + pgAdmin4, sigue estos pasos exactos (son la causa más común de los
errores de conexión de Prisma):

1. Abre **pgAdmin4** y conéctate a tu servidor local (`localhost`, puerto `5432`) con el
   usuario `postgres` y la contraseña que definiste al instalar PostgreSQL.
2. Click derecho en **Databases → Create → Database…**
3. Nombre: `kinal_inventario`. En la pestaña **Definition**, deja el **Owner** como
   `postgres` y el **Encoding** como `UTF8`. Guarda.
4. **Anota la contraseña real del usuario `postgres`** — la necesitas en el paso 3.2 para
   `DATABASE_URL`. No hace falta crear las tablas a mano: Prisma las crea por ti en el
   paso 3.4 (`prisma migrate dev`), a partir de `prisma/schema.prisma`.
5. Verifica el puerto: en pgAdmin4, click derecho sobre el servidor → **Properties →
   Connection** → confirma que el puerto sea `5432` (o el que hayas configurado).

### Errores típicos y cómo resolverlos

| Error de Prisma | Causa más común | Solución |
|---|---|---|
| `P1000: Authentication failed` | La contraseña en `DATABASE_URL` no coincide con la del usuario `postgres` en pgAdmin4 | Copia exactamente la contraseña que usas para entrar a pgAdmin4 al `.env` |
| `P1001: Can't reach database server` | El servicio de PostgreSQL no está corriendo, o el puerto/host están mal | En Windows, revisa el servicio "postgresql-x64-18" en `services.msc`; confirma el puerto en pgAdmin4 |
| `P1003: Database does not exist` | No creaste la base `kinal_inventario` (paso 2) | Créala desde pgAdmin4 como se explicó arriba |
| `P3014: could not create shadow database` | El usuario de `DATABASE_URL` no tiene permiso `CREATEDB` (le hace falta a `prisma migrate dev` para probar la migración en una base temporal) | Usa el superusuario `postgres` (lo tiene por defecto), o si usas un rol personalizado, otórgale `CREATEDB` desde pgAdmin4 (Login/Group Roles → tu rol → Privileges) |
| El `.env` trae caracteres especiales en la contraseña (`@`, `#`, `%`, etc.) | Esos caracteres rompen la URL de conexión si no están codificados | Codifícalos en formato URL (por ejemplo `@` → `%40`) o usa una contraseña sin símbolos especiales para desarrollo local |

---

## 3. Backend paso a paso

```bash
cd backend
pnpm install
```

> **Nota sobre pnpm y Prisma:** las versiones recientes de pnpm bloquean por seguridad los
> scripts de instalación (`postinstall`) de paquetes nativos. Esto ya está resuelto en este
> proyecto: `backend/pnpm-workspace.yaml` autoriza explícitamente a `prisma`,
> `@prisma/client` y `@prisma/engines` a correr sus scripts, así que **no deberías ver el
> error `[ERR_PNPM_IGNORED_BUILDS]`**. Si aún así aparece, ejecuta `pnpm approve-builds`.

### 3.1 Variables de entorno

Ya existe un archivo `backend/.env` con valores de ejemplo funcionales. Solo necesitas
editar `DATABASE_URL` con la contraseña real de tu usuario `postgres` en PostgreSQL 18:

```
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/kinal_inventario?schema=public"
```

El resto de variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`) ya están listas
para que puedas iniciar sesión de inmediato con:

- Correo: `admin@kinal.edu.gt`
- Contraseña: `admin123`

Si quieres cambiar la contraseña del administrador, genera un nuevo hash con:
```bash
pnpm exec ts-node src/scripts/generarHash.ts tu_nueva_password
```
y copia el resultado en `ADMIN_PASSWORD_HASH` dentro de `.env`.

### 3.2 Crear las tablas (migración de Prisma)

```bash
pnpm exec prisma migrate dev --name init
```

Esto lee `prisma/schema.prisma`, genera el SQL, crea las 3 tablas (`categorias`,
`productos`, `movimientos`) en tu base `kinal_inventario`, y regenera el cliente de
Prisma tipado.

### 3.3 (Opcional) Insertar datos de ejemplo

```bash
pnpm exec prisma db seed
```

Esto agrega 2 categorías, 3 productos y 1 movimiento de ejemplo, para que las tablas de
Productos/Categorías/Movimientos no se vean vacías la primera vez que abras el frontend.

### 3.4 Levantar el servidor

```bash
pnpm run dev
```

Deberías ver: `🚀 Servidor escuchando en http://localhost:3000`

### 3.5 Probar la API

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/categorias
curl http://localhost:3000/api/productos
curl http://localhost:3000/api/movimientos
```

Para probar el login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@kinal.edu.gt","password":"admin123"}'
```

> Tip: `pnpm exec prisma studio` abre una interfaz web para ver y editar las tablas
> visualmente sin salir de la terminal.

---

## 4. Frontend paso a paso

El proyecto Angular ya está generado dentro de `kinal-inventario-frontend/`, así que
**no hace falta correr `ng new`**.

```bash
cd kinal-inventario-frontend
pnpm install
```

> Igual que en el backend, `pnpm-workspace.yaml` ya autoriza los scripts de instalación
> nativos que necesita Angular/esbuild (`esbuild`, `lmdb`, `msgpackr-extract`,
> `@parcel/watcher`), así que la instalación debería completarse sin pedirte
> `pnpm approve-builds`.

```bash
pnpm exec ng serve -o
```

Se abrirá `http://localhost:4200`. Angular consume la API en `http://localhost:3000/api`
(configurado en `src/environments/environment.ts`) — asegúrate de que el backend
(sección 3) ya esté corriendo.

### 4.1 Flujo de prueba recomendado

1. Ve a **Categorías** → inicia sesión primero (`/login`, `admin@kinal.edu.gt` /
   `admin123`)
2. Crea 1-2 categorías (ej. "Papelería", "Limpieza") — o usa las que trajo el seed
3. Ve a **Productos** → crea productos asignándolos a una categoría
4. Ve a **Movimientos** → registra una **ENTRADA** o **SALIDA** y observa cómo cambia
   el stock del producto en la lista de Productos
5. Confirma que las tres tablas (Productos, Categorías, Movimientos) muestran sus datos
   correctamente — este era uno de los problemas corregidos (ver sección 7).

---

## 5. Comandos rápidos (resumen)

```bash
# Backend
cd backend
pnpm install
pnpm exec prisma migrate dev --name init
pnpm exec prisma db seed
pnpm run dev                # http://localhost:3000

# Frontend (en otra terminal)
cd kinal-inventario-frontend
pnpm install
pnpm exec ng serve -o        # http://localhost:4200
```

---

## 6. Tema visual "futurista"

Se rediseñó por completo la hoja de estilos de la aplicación con un tema oscuro de
inspiración futurista/tecnológica:

- **Paleta**: fondo oscuro casi negro con degradados sutiles, acentos en cian neón
  (`#00e5ff`) y violeta (`#a06bff`), verde neón para "ENTRADA" y rojo neón para "SALIDA"
  y alertas de stock bajo.
- **Tipografía**: [Orbitron](https://fonts.google.com/specimen/Orbitron) (técnica, tipo
  "HUD") para títulos y encabezados de tabla, y
  [Rajdhani](https://fonts.google.com/specimen/Rajdhani) para el resto del texto —
  cargadas desde Google Fonts en `index.html`.
- **Tarjetas y tablas** con bordes finos brillantes (glow) en vez de las sombras grises
  planas del diseño original.
- **A propósito, casi sin animación**: solo hay transiciones cortas (150ms) en hover/focus
  de botones, enlaces y filas de tabla. No hay animaciones en bucle, parpadeos ni efectos
  de partículas, para que la interfaz se sienta moderna sin distraer ni cansar la vista,
  tal como se pidió.

Archivos tocados para el tema: `styles.css` (global), `app.component.css` (barra de
navegación), y los estilos puntuales de `login`, `producto-list` y `movimiento-list`.

---

## 7. Bitácora de cambios (qué estaba mal, qué se corrigió, qué se agregó)

Este proyecto fue revisado y corregido con ayuda de **Claude (Anthropic)** — modelo
**Claude Sonnet 4.5**, a través de la interfaz de Claude.ai con acceso a una terminal
para instalar dependencias, compilar el proyecto (`tsc --noEmit` en backend y frontend)
y verificar cada corrección antes de entregarla. No se modificó la estructura de
carpetas ni de archivos original; solo se corrigió contenido y se agregaron archivos
nuevos donde hacía falta.

### 7.1 Errores corregidos (Base de datos / Backend)

1. **Login nunca funcionaba con las credenciales documentadas.**
   `ADMIN_PASSWORD_HASH` en `backend/.env` y `backend/.env.example` era un hash de
   bcrypt que **no correspondía** a la contraseña `admin123` que el propio proyecto
   documentaba para iniciar sesión (se verificó con `bcrypt.compareSync`, dio `false`).
   Cualquiera que intentara entrar con `admin@kinal.edu.gt` / `admin123` recibía
   "Credenciales incorrectas" sin importar qué hiciera bien en la base de datos.
   **Corrección:** se generó un hash nuevo y válido para `admin123` y se actualizó en
   ambos archivos.

2. **`backend/pnpm-workspace.yaml` — placeholder inválido en el frontend (no en el backend).**
   El archivo equivalente en `frontend/pnpm-workspace.yaml` traía valores de ejemplo sin
   completar (`esbuild: set this to true or false`, literalmente texto en vez de
   `true`/`false`), lo cual es YAML inválido para lo que pnpm espera y hacía que pnpm
   bloqueara los scripts nativos de Angular/esbuild al instalar. **Corrección:** se
   reemplazaron esos valores por `true`. El archivo del backend (`backend/pnpm-workspace.yaml`)
   sí estaba bien formado — se verificó instalando desde cero — y solo se le agregaron
   comentarios explicativos.

3. **Faltaba `pnpm-workspace.yaml` en el proyecto Angular real.**
   `kinal-inventario-frontend/` (el proyecto que de verdad se ejecuta) no tenía este
   archivo, así que al instalar con pnpm aparecía `[ERR_PNPM_IGNORED_BUILDS]` para
   `esbuild`, `lmdb`, `msgpackr-extract` y `@parcel/watcher`, dejando el build de Angular
   sin esos paquetes nativos correctamente compilados. **Corrección:** se agregó el
   archivo con la autorización correspondiente.

4. **`backend/package.json` traía una configuración de pnpm obsoleta.**
   El bloque `"pnpm": { "onlyBuiltDependencies": [...] }` dentro de `package.json` ya no
   es leído por las versiones actuales de pnpm (que ahora usan `pnpm-workspace.yaml`) y
   solo generaba una advertencia confusa en cada instalación. **Corrección:** se eliminó,
   ya que la misma autorización está correctamente declarada en `pnpm-workspace.yaml`.

5. **El manejo de errores no distinguía errores de base de datos ni de validación.**
   `backend/src/middlewares/errorHandler.ts` respondía **500 "Error interno del
   servidor"** para absolutamente cualquier error que no fuera lanzado a propósito por
   un `service` — incluyendo errores de validación de Zod (por ejemplo, mandar un precio
   negativo) y errores reales de Prisma/PostgreSQL (nombre de categoría duplicado,
   producto con `categoriaId` inexistente, o incluso que la base de datos estuviera
   apagada). Esto hacía muy difícil saber, tanto en el frontend como revisando la
   consola del backend, qué había fallado realmente. **Corrección:** ahora se reconocen
   explícitamente:
   - `ZodError` → `400` con el detalle de qué campo falló y por qué.
   - Errores conocidos de Prisma (identificados por su código, ej. `P2002`) → `409` para
     violaciones de unicidad (ej. categoría duplicada), `400` para llaves foráneas
     inválidas (`P2003`), `404` para registros no encontrados (`P2025`).
   - Errores de conexión de Prisma (identificados por su `name`, ej.
     `PrismaClientInitializationError`) → `503`
     con un mensaje claro de que no se pudo conectar a PostgreSQL (útil justo para los
     errores de conexión descritos en la sección 2 de este README).

### 7.2 Errores corregidos (Frontend)

6. **Las tablas de Categorías y Movimientos no mostraban datos, aunque la API sí los
   devolvía.**
   `ProductoListComponent` ya tenía una corrección aplicada previamente: forzar
   `ChangeDetectorRef.detectChanges()` después de recibir la respuesta HTTP, porque en
   este proyecto la detección de cambios automática de Angular no estaba refrescando la
   vista de forma confiable tras la respuesta asíncrona. Esa misma corrección **no se
   había aplicado** a `CategoriaListComponent` ni a `MovimientoListComponent`, así que
   sus tablas se quedaban en blanco (o solo mostraban el mensaje de "cargando") aunque
   los datos llegaran correctamente del backend. **Corrección:** se aplicó el mismo
   patrón (`inject(ChangeDetectorRef)` + `detectChanges()` tanto en el `next` como en el
   `error` del `subscribe`) a los tres componentes de listado, y de paso se agregó
   registro por consola (`console.error`) de los errores HTTP para facilitar el
   diagnóstico futuro.

7. **Node.js desactualizado rompe el build de Angular 22 sin explicación clara.**
   El proyecto usa Angular 22, que exige Node **v22.22.3+ / v24.15.0+ / v26+**. El README
   original recomendaba Node 18/20 (una versión anterior del proyecto), lo cual ya no
   aplica y provoca que `ng serve`/`ng build` se nieguen a iniciar. **Corrección:** se
   actualizó la documentación de requisitos (sección 1 de este README).

### 7.3 Qué se agregó (no se quitó ni reestructuró nada existente)

- `backend/pnpm-workspace.yaml`: comentarios explicativos (contenido funcional sin cambios).
- `frontend/pnpm-workspace.yaml`: valores reales en vez de placeholders (ver punto 2).
- `kinal-inventario-frontend/pnpm-workspace.yaml`: archivo nuevo (ver punto 3).
- Manejo de errores de Zod y Prisma en `backend/src/middlewares/errorHandler.ts` (ver punto 5).
- Tema visual futurista completo (ver sección 6) + fuentes de Google Fonts en `index.html`.
- Este `README.md`.

### 7.4 Qué se verificó pero **no** se tocó por estar correcto

Antes de corregir nada se revisó línea por línea todo `backend/src` (controllers,
services, routes, middlewares, types) y todo `kinal-inventario-frontend/src` (componentes,
servicios, modelos, guard, interceptor, rutas). Ambos proyectos compilan sin errores
(`pnpm exec tsc --noEmit`), la relación entre las 3 tablas y sus validaciones con Zod
están correctamente implementadas, y la lógica de negocio (actualización de stock al
registrar un movimiento, restricciones para no borrar categorías/productos con
dependencias, JWT + bcrypt para el login) ya funcionaba como se esperaba. No se
modificó ningún archivo que no tuviera un problema identificado y verificado.

---

Con esto tienes un sistema de inventario funcional con TypeScript, Node.js, Prisma,
PostgreSQL 18 y Angular, con un tema visual propio y con los errores de base de datos y
de renderizado de tablas ya corregidos.
