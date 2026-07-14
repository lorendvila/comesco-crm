# =====================================================================
# COMESCO CRM — imagen de producción
# SPA de Vite (React) servida por nginx. Habla directo con Supabase cloud,
# así que no hay backend propio: solo construir estáticos y servirlos.
# =====================================================================

# ---- 1) Construcción ----
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependencias con el lockfile (reproducible)
COPY package.json package-lock.json ./
RUN npm ci

# Copia el código y construye
COPY . .

# Variables PÚBLICAS de Supabase. Se incrustan en el bundle al construir
# (Vite reemplaza import.meta.env.VITE_* en tiempo de build). La anon key es
# pública por diseño: la RLS es la que protege los datos. Se pueden sobreescribir
# pasando --build-arg en EasyPanel si algún día cambian.
ARG VITE_SUPABASE_URL=https://vpjoiszxdycszrvyciyl.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwam9pc3p4ZHljc3pydnljaXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDA5NjQsImV4cCI6MjA5ODkxNjk2NH0.NvizjV-8Fc4p-EifVUdTgwNR4vciNi4YQBIDfvXUv5s
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---- 2) Servido ----
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
