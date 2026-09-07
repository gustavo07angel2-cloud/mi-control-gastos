# Mi Control de Gastos

Aplicación web para registrar ingresos y gastos personales en quetzales, organizar un presupuesto por quincena, visualizar gráficas y llevar metas de ahorro o deudas.

## Tecnologías

- React 19 y TypeScript
- Vinext / Vite
- Tailwind CSS
- Cloudflare Workers y D1
- Drizzle ORM
- Recharts

## Requisitos

- Node.js 22.13 o superior
- npm
- Git, si deseas subir el proyecto a GitHub

## Ejecutarlo localmente

Abre una terminal dentro de la carpeta del proyecto y ejecuta:

```bash
npm install
npm run build
npm run db:local:init
npm run dev
```

La terminal mostrará la dirección local, normalmente:

```text
http://localhost:5173
```

`db:local:init` se ejecuta solamente la primera vez para crear las tablas de la base de datos local. Los datos locales se guardan dentro de la carpeta ignorada `.wrangler`.

## Subirlo a GitHub

Primero crea un repositorio vacío en GitHub. Después, desde la carpeta del proyecto, ejecuta:

```bash
git init
git add .
git commit -m "Primera versión del control de gastos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mi-control-gastos.git
git push -u origin main
```

Reemplaza `TU-USUARIO` por tu nombre de usuario de GitHub.

## Publicarlo en Cloudflare

La aplicación usa D1 para guardar los registros, por lo que Cloudflare Workers es la opción de despliegue preparada en este proyecto.

1. Inicia sesión desde la terminal:

```bash
npx wrangler login
```

2. Crea la base de datos:

```bash
npx wrangler d1 create mi-control-gastos-db
```

3. Copia `.env.example` como `.env.production` y pega en ella el `database_id` que te entregó Cloudflare:

```env
CLOUDFLARE_D1_DATABASE_NAME=mi-control-gastos-db
CLOUDFLARE_D1_DATABASE_ID=tu_database_id_real
```

4. Prepara la aplicación y crea las tablas remotas:

```bash
npm run build
npm run db:remote:init
```

5. Publica el proyecto:

```bash
npm run deploy
```

Cloudflare mostrará la URL pública al terminar. La base local y la base publicada son independientes, por lo que sus registros no se mezclan.

## Comandos principales

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia el proyecto localmente |
| `npm run build` | Genera la versión de producción |
| `npm run db:local:init` | Crea las tablas locales |
| `npm run db:remote:init` | Crea las tablas en Cloudflare D1 |
| `npm run deploy` | Publica en Cloudflare Workers |

## Carpetas importantes

- `app/`: páginas y API del sistema.
- `components/expense-dashboard.tsx`: interfaz principal.
- `db/schema.ts`: tablas de movimientos, presupuestos, metas y deudas.
- `drizzle/`: migraciones de la base de datos.
- `public/`: archivos públicos del proyecto.
