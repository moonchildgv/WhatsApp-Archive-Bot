# Usa un'immagine Node.js basata su Debian Bullseye (stabile per Puppeteer)
FROM node:18-bullseye

# Imposta la directory di lavoro
WORKDIR /app

# Installa le dipendenze richieste per Puppeteer
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    libatk-bridge2.0-0 \
    libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

# Copia i file del progetto
COPY package.json package-lock.json* ./
COPY whatsapp-archive-bot.js ./

# Installa le dipendenze Node.js
RUN npm install

# Mappa la cartella di autenticazione fuori dal container
VOLUME ["/app/.wwebjs_auth"]

# Avvia il bot
CMD ["npm", "start"]
