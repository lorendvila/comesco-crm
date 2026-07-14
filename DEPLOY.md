# Despliegue de COMESCO CRM en EasyPanel

El CRM es una **SPA (web estática)** que habla directamente con **Supabase (cloud)**.
No hay backend propio que desplegar: EasyPanel solo construye la web y la sirve con
nginx. La base de datos, la autenticación y la Edge Function ya están en Supabase.

---

## 0) Requisitos
- Un VPS con **EasyPanel** instalado.
- El repositorio en **GitHub** actualizado (rama `main`).
- Un **dominio** (o subdominio, p. ej. `crm.tudominio.com`) que puedas apuntar por DNS.

---

## 1) Crear el servicio en EasyPanel
1. Entra en EasyPanel → **Create Project** (p. ej. `comesco`).
2. Dentro del proyecto → **+ Service → App**.
3. **Source**: conecta **GitHub** y elige el repo `comesco-crm`, rama `main`.
   (Alternativa: “Git” con la URL del repo.)
4. **Build**: método **Dockerfile** (EasyPanel detecta el `Dockerfile` de la raíz).
   No hace falta configurar variables: las claves públicas de Supabase ya van por
   defecto en el Dockerfile.
5. Pulsa **Deploy**. En 1–2 min tendrás la web construida y corriendo (puerto 80).

> Actualizar en el futuro: haz `git push` a `main` y pulsa **Deploy** de nuevo
> (o activa auto-deploy). EasyPanel reconstruye la imagen.

---

## 2) Dominio + HTTPS
1. **DNS** (en tu proveedor del dominio): crea un registro **A** del dominio/subdominio
   apuntando a la **IP de tu VPS**.
   Ej.: `crm.tudominio.com  →  A  →  1.2.3.4`
2. En EasyPanel → el servicio → pestaña **Domains** → **Add Domain**:
   - Host: `crm.tudominio.com`
   - Port: **80**
   - Activa **HTTPS** (EasyPanel emite el certificado con Let's Encrypt automáticamente).
3. Espera a que propague el DNS (minutos) y entra en `https://crm.tudominio.com`.

---

## 3) Ajustes en Supabase (recomendado antes de dar acceso)
En el **Dashboard de Supabase** del proyecto `comesco-crm`:

1. **Authentication → URL Configuration**
   - **Site URL**: `https://crm.tudominio.com`
   - Añade la misma URL a **Redirect URLs**.
2. **Authentication → Providers → Email**
   - **Desactiva “Enable Sign Ups”** (registro público). Así nadie puede crearse una
     cuenta desde fuera. Los usuarios se crean **solo desde la pantalla “Usuarios”**
     del CRM (usa un canal seguro con service_role, no le afecta esta opción).

> Nota: la web es pública (cualquiera puede abrir la URL y ver el login), pero sin una
> cuenta válida no se ve ningún dato: la seguridad por filas (RLS) de Supabase lo impide.

---

## 4) Primer uso
1. Entra como **admin** (`lorendionis@gmail.com`) en `https://crm.tudominio.com`.
2. Ve a **Usuarios → Nuevo usuario** y crea la cuenta de la persona de **Admin**
   (rol Administrador o Comercial según corresponda) con una contraseña temporal.
3. Esa persona entra y puede cambiarla desde **“Cambiar contraseña”** (arriba a la derecha).

---

## Notas técnicas
- **Build**: `Dockerfile` multi-etapa (Node construye → nginx sirve). Config de nginx en
  `nginx.conf` (incluye el *fallback* de rutas de React Router y caché de assets).
- **Variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se incrustan en el build.
  Están como `ARG` por defecto en el `Dockerfile`; para cambiarlas, pásalas como
  *build args* en EasyPanel. La `anon key` es pública por diseño.
- **Edge Function** `admin-users`: ya desplegada en Supabase (gestiona altas/bajas de
  usuarios y contraseñas). No forma parte de esta imagen.
