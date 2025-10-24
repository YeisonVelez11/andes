FROM ghcr.io/puppeteer/puppeteer:19.7.2

USER root

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p screenshots

# Cambiar a usuario no-root
RUN chown -R pptruser:pptruser /usr/src/app
USER pptruser

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD [ "node", "server.js" ]