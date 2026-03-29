# Stage 1: Build TypeScript
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

USER appuser

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:4004/health || exit 1

CMD ["node", "dist/index.js"]
