# Usar la imagen oficial de Node.js (Version LTS)
FROM node:20-slim

# Crear directorio de la app
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Exponer el puerto que usa Cloud Run (8080 por defecto)
EXPOSE 8080

# Comando para arrancar la app
CMD [ "npm", "start" ]
