# Meeting Transcription System

Sistema de transcripción de reuniones offline-first. Captura audio de reuniones físicas y virtuales (Zoom, Teams, Google Meet), transcribe localmente con Whisper WASM, identifica hablantes, genera resúmenes automáticos con accionables, produce actas formales y sincroniza con la nube para re-procesamiento de mayor precisión.

## Características principales

- **Grabación de audio** desde micrófono o integración directa con plataformas de videoconferencia
- **Transcripción local** (offline-first) con motor STT basado en Whisper WASM
- **Diarización** — identifica quién dijo qué, con detección verbal de nombres
- **Resúmenes automáticos** y extracción de accionables asignados a hablantes
- **Actas formales** estructuradas con asistentes, temas, decisiones y accionables
- **Búsqueda full-text** con filtros por fecha, hablante e idioma
- **Exportación** en formatos VTT, TXT y Markdown (con round-trip VTT)
- **Edición colaborativa** con historial de cambios y control de permisos
- **Integración con calendario** para auto-inicio de grabaciones
- **Sincronización offline/online** con re-procesamiento en nube
- **PWA instalable** que funciona con pantalla bloqueada
- **Soporte bilingüe** — español e inglés

## Arquitectura

```
Cliente PWA (Navegador)
├── UI Responsive (vanilla TS)
├── Service Worker (cache offline-first)
├── AudioCaptureModule → LocalSTTEngine → DiarizationEngine → NLPService
├── IndexedDB (audio, transcripciones, cola de sync, settings)
└── SyncManager ↔ API Gateway (nube)

Servicios en la Nube (Docker)
├── API Gateway (Node.js)        :4000
├── Motor STT Nube (Python)      :4001
├── Servicio NLP (Python)        :4002
├── Servicio de Búsqueda (Node)  :4003
├── Servicio de Calendario (Node):4004
├── PostgreSQL 16                :5432
└── MinIO (S3-compatible)        :9000
```

## Requisitos previos

- Node.js >= 20
- npm >= 9
- Docker y Docker Compose (para despliegue)

## Desarrollo local (cliente PWA)

1. Clonar el repositorio:

```bash
git clone <repo-url>
cd meeting-transcription
```

2. Instalar dependencias:

```bash
npm install
```

3. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`.

4. Ejecutar tests:

```bash
npm test
```

Esto ejecuta los 234 tests (unitarios + property-based con fast-check).

5. Ejecutar tests en modo watch:

```bash
npm run test:watch
```

6. Generar build de producción:

```bash
npm run build
```

Los archivos se generan en `dist/`.

7. Previsualizar el build:

```bash
npm run preview
```

## Despliegue con Docker

### 1. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores reales:

| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Secreto para tokens JWT (cambiar obligatoriamente) |
| `DATABASE_URL` | Connection string de PostgreSQL |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credenciales de MinIO/S3 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth para Google Calendar |
| `TEAMS_CLIENT_ID` / `TEAMS_CLIENT_SECRET` | OAuth para Microsoft Teams |
| `ZOOM_API_KEY` / `ZOOM_API_SECRET` | Integración con Zoom |
| `STT_MODEL_PATH` | Ruta al modelo Whisper en el servicio cloud |
| `NLP_MODEL_NAME` | Modelo de NLP para resúmenes |

### 2. Levantar todos los servicios

```bash
docker-compose up -d
```

Esto levanta 8 contenedores:
- **client** — PWA servida con nginx (puerto 3000)
- **api-gateway** — API REST (puerto 4000)
- **stt-cloud** — Motor STT de alta precisión (puerto 4001)
- **nlp-service** — Resúmenes y accionables (puerto 4002)
- **search-service** — Búsqueda full-text (puerto 4003)
- **calendar-service** — Integración con calendarios (puerto 4004)
- **postgres** — Base de datos PostgreSQL 16 (puerto 5432)
- **minio** — Almacenamiento de objetos S3-compatible (puerto 9000)

### 3. Verificar que los servicios están sanos

```bash
docker-compose ps
```

Todos los contenedores deben mostrar estado `healthy`. Cada servicio expone un endpoint `/health`.

### 4. Acceder a la aplicación

- PWA: `http://localhost:3000`
- API: `http://localhost:4000`
- MinIO Console: `http://localhost:9001`

### 5. Detener los servicios

```bash
docker-compose down
```

Para eliminar también los volúmenes de datos:

```bash
docker-compose down -v
```

## Desarrollo con Docker (hot-reload)

Para desarrollo con hot-reload y volúmenes montados:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Esto monta los directorios de código fuente como volúmenes y habilita recarga automática en todos los servicios.

## Estructura del proyecto

```
├── src/                          # Código fuente del cliente PWA
│   ├── db/                       # IndexedDB setup y operaciones
│   ├── integration/              # AppController (orquestador central)
│   ├── modules/                  # Módulos de negocio
│   │   ├── audio-capture.ts      # Captura de audio
│   │   ├── video-conference-capture.ts  # Integración videoconferencia
│   │   ├── local-stt-engine.ts   # Transcripción local (Whisper WASM)
│   │   ├── diarization-engine.ts # Identificación de hablantes
│   │   ├── nlp-service.ts        # Resúmenes y accionables
│   │   ├── sync-manager.ts       # Sincronización offline/online
│   │   ├── cloud-reprocessor.ts  # Re-procesamiento en nube
│   │   ├── user-service.ts       # Gestión de usuarios y permisos
│   │   ├── edit-service.ts       # Edición con historial
│   │   ├── search-service.ts     # Búsqueda full-text
│   │   ├── export-service.ts     # Exportación VTT/TXT/MD
│   │   ├── calendar-service.ts   # Integración con calendario
│   │   └── __tests__/            # Tests de propiedades (fast-check)
│   ├── types/                    # Interfaces y tipos TypeScript
│   ├── ui/                       # Componentes de UI (vanilla TS)
│   ├── main.ts                   # Entry point
│   ├── sw.ts                     # Service Worker
│   └── sw-register.ts            # Registro del Service Worker
├── services/                     # Servicios backend (Docker)
│   ├── api-gateway/
│   ├── stt-cloud/
│   ├── nlp-service/
│   ├── search-service/
│   └── calendar-service/
├── client/                       # Dockerfile + nginx config del cliente
├── tests/                        # Tests de smoke para Docker
├── docker-compose.yml            # Orquestación de producción
├── docker-compose.dev.yml        # Overrides para desarrollo
└── .env.example                  # Variables de entorno documentadas
```

## Testing

El proyecto usa Vitest como test runner y fast-check para property-based testing.

```bash
# Ejecutar todos los tests (234 tests, 30 archivos)
npm test

# Tests en modo watch
npm run test:watch

# Ejecutar solo tests de un módulo
npx vitest --run src/modules/nlp-service.test.ts

# Ejecutar solo tests de propiedades
npx vitest --run src/modules/__tests__/
```

### Propiedades de correctitud verificadas

El sistema valida 15 propiedades formales mediante property-based testing (100 iteraciones cada una):

1. Sincronización completa de elementos pendientes
2. Reemplazo por transcripción mejorada
3. Consistencia de identificación de hablantes
4. Persistencia de nombre de hablante identificado
5. Generación de resumen y accionables post-transcripción
6. Asignación de accionables a hablantes
7. Completitud y coherencia de actas formales
8. Correctitud de búsqueda con filtros y control de acceso
9. Enforcement de permisos de edición
10. Integridad del log de ediciones
11. Control de acceso — otorgar y revocar
12. Preservación de estructura en exportación
13. Round-trip de exportación/importación VTT
14. Auto-inicio de grabación por calendario
15. Asociación transcripción-evento de calendario

## Licencia

Privado — uso interno.
