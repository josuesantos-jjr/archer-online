#!/bin/sh

# Inicia o daemon do PM2
pm2-runtime start ecosystem.config.js --env production

# Inicia o Next.js em segundo plano
npm start &

# Mantém o contêiner rodando
wait