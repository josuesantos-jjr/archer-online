# Use a imagem oficial do Node.js como base
FROM node:20-slim

# Define variáveis de ambiente para o Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos package.json e package-lock.json (se existir)
COPY package*.json ./

# Instala as dependências do sistema operacional necessárias para o Puppeteer
# e limpa o cache do apt para reduzir o tamanho da imagem
RUN apt-get update && apt-get install -y \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libdrm2 \
    libgbm-dev \
    libatk-bridge2.0-0 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3-tools \
    lsb-release \
    xdg-utils \
    wget \
    --no-install-recommends && \
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -i google-chrome-stable_current_amd64.deb; apt-get install -y --fix-broken && \
    rm google-chrome-stable_current_amd64.deb && \
    rm -rf /var/lib/apt/lists/*

# Instala as dependências do Node.js
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Constrói a aplicação Next.js para produção
RUN npm run build

# Expõe a porta que a aplicação Next.js vai usar
EXPOSE 3000

# Define o comando para iniciar a aplicação
CMD ["npm", "start"]