# Usamos una imagen oficial de Node.js que ya viene con Puppeteer preinstalado para ahorrar tiempo
FROM ghcr.io/puppeteer/puppeteer:latest

# Cambiamos al usuario root para tener permisos de instalación
USER root

# Establecemos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las librerías de tu proyecto
RUN npm install

# Copiamos el resto de tu código (index.js, alumnos.json, etc.)
COPY . .

# Exponemos el puerto que definiste en tu .env (Render lo necesita)
EXPOSE 3000

# Comando para iniciar el bot
CMD ["node", "index.js"]