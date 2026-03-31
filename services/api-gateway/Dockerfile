# Stage 1: Build TypeScript
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY migrations/ ./migrations/

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
