# Volare Hub — Backend

API REST del backend de **Volare Hub**, una plataforma web para la gestión de comunicación y reservas de áreas comunes de una urbanización residencial. Centraliza el feed de publicaciones, las reservas de espacios comunes y la administración de usuarios en un solo lugar.

**🟢 En producción:** [urbvolare.com](https://urbvolare.com)

## Stack Tecnológico

- **Node.js + Express** — servidor HTTP y API REST
- **Prisma** — ORM y control de migraciones sobre la base de datos
- **PostgreSQL (Supabase)** — base de datos relacional
- **Cloudinary** — almacenamiento y entrega de imágenes y archivos adjuntos
- **JWT + bcrypt** — autenticación por token y hasheo seguro de contraseñas
- **Resend** — envío de correos transaccionales (recuperación de contraseña)

## Funcionalidades principales

- Feed de publicaciones con roles diferenciados (residente / administrador)
- Sistema de reservas de espacios comunes con calendario de disponibilidad
- Panel de administración
- Recuperación de contraseña por correo
- Buzón de sugerencias

## Arquitectura

Backend y frontend viven en repositorios separados. El backend se despliega en **Render** y el frontend en **Vercel**; la base de datos vive en **Supabase** (PostgreSQL) y los archivos multimedia se almacenan en **Cloudinary**.

## Instalación local

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Completar DATABASE_URL, DIRECT_URL, JWT_SECRET, credenciales de Cloudinary,
# FRONTEND_URL y RESEND_API_KEY en .env

# 4. Aplicar migraciones
npx prisma migrate dev

# 5. Levantar el servidor en modo desarrollo
npm run dev
```

> `npx prisma migrate dev` es solo para desarrollo local; en producción (Render) el pipeline ejecuta `npx prisma migrate deploy` automáticamente en cada despliegue.

---

Este proyecto fue desarrollado como parte de un internado, aplicando prácticas profesionales de seguridad (validación en backend, principio de menor privilegio en credenciales, auditoría de historial de git) y arquitectura escalable.
