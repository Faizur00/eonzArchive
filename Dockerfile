FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server.js ./
COPY src ./src
COPY web ./web
COPY kookit ./kookit

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]