# Image du backend Pédiatrix : Node.js, aucune dépendance système.
# Construction (Internet requis une seule fois, pour télécharger les paquets) :
#   docker compose build backend
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Comptes, tarifs, correspondance DHIS2, fichiers « lu » : volume persistant (voir docker-compose.yml).
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
