FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Solo dependencias de producción (en desarrollo, docker-compose usa node --watch, que no necesita devDependencies)
RUN npm install --omit=dev && npm cache clean --force

COPY . .

# El proceso no necesita ser root
USER node

EXPOSE 3000

CMD ["npm", "start"]
