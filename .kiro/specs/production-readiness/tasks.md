# Plan de Implementación: Preparación para Producción

## Visión General

Implementación incremental para llevar a producción la PWA KeepWeChat. Se reemplazan los stubs existentes por implementaciones reales sin modificar las interfaces del cliente. El orden es: base de datos → API Gateway con seguridad → servicios backend (STT, NLP, Búsqueda, Calendario) → Service Worker completo → UI conectada a API real → monitoreo → CI/CD. Cada paso integra lo anterior y se valida con tests.

## Tareas

- [x] 1. Crear migraciones PostgreSQL y esquema de base de datos
  - [x] 1.1 Crear estructura de migraciones y las 12 migraciones SQL
    - Crear directorio `services/api-gateway/migrations/`
    - Crear `001_create_users.sql`: tabla `users` con campos id, email, name, password_hash, role, is_active, timestamps
    - Crear `002_create_transcriptions.sql`: tabla `transcriptions` con owner_id FK, title, language, audio_file_url, status, duration, recorded_at
    - Crear `003_create_segments_with_tsvector.sql`: tabla `segments` con transcription_id FK, speaker_id FK, start_time, end_time, content, confidence, order_index, search_vector tsvector
    - Crear `004_create_speakers.sql`: tabla `speakers` con transcription_id FK, label, identified_name
    - Crear `005_create_action_items.sql`: tabla `action_items` con transcription_id FK, assigned_to_speaker_id FK, description, status, reminder_calendar_id
    - Crear `006_create_summaries_minutes.sql`: tablas `meeting_summaries` y `formal_minutes` con transcription_id FK UK, campos JSONB
    - Crear `007_create_edit_records.sql`: tabla `edit_records` con transcription_id FK, segment_index, previous_text, new_text, edited_by FK
    - Crear `008_create_shares.sql`: tabla `transcription_shares` con FKs, permission, constraint UNIQUE
    - Crear `009_create_calendar_tokens.sql`: tabla `calendar_tokens` con user_id FK, provider, tokens cifrados, status
    - Crear `010_create_refresh_tokens.sql`: tabla `refresh_tokens` con user_id FK, token_hash, expires_at, is_revoked
    - Crear `011_create_auth_events.sql`: tabla `auth_events` con user_id FK, event_type, ip_address
    - Crear `012_create_indexes.sql`: todos los índices (GIN para tsvector, FKs, búsquedas frecuentes) y trigger `update_search_vector()`
    - _Requisitos: 6.1, 6.2, 6.4, 6.5_

  - [x] 1.2 Implementar runner de migraciones y foreign keys/constraints
    - Agregar dependencia `pg` y `node-pg-migrate` al API Gateway
    - Crear script de ejecución de migraciones que se ejecute al inicio del servicio
    - Implementar todos los constraints CHECK (confidence 0-1, startTime < endTime, roles válidos, language es|en, permission read|read-write)
    - Implementar todas las foreign keys con ON DELETE CASCADE donde corresponda
    - _Requisitos: 6.2, 6.3, 6.5_

  - [x] 1.3 Escribir test de propiedad para integridad referencial de la BD
    - **Propiedad 13: Integridad referencial de la base de datos**
    - Generar inserciones con FKs válidas e inválidas y verificar que la BD rechaza las inválidas
    - Verificar constraints CHECK (confidence entre 0-1, startTime < endTime, roles válidos)
    - **Valida: Requisito 6.5**

- [x] 2. Implementar API Gateway con autenticación y seguridad
  - [x] 2.1 Implementar middleware stack del API Gateway
    - Agregar dependencias: `jsonwebtoken`, `bcrypt`, `zod`, `helmet`, `cors`, `express-rate-limit`, `pg`, `prom-client`, `winston`
    - Implementar middleware de security headers con helmet (CSP, X-Content-Type-Options, X-Frame-Options, HSTS)
    - Implementar middleware CORS con orígenes desde variable de entorno `ALLOWED_ORIGINS`
    - Implementar body parser con límite de 50mb para audio uploads
    - Implementar middleware de request ID + logging estructurado JSON con winston
    - _Requisitos: 1.8, 9.3, 9.4, 10.1_

  - [x] 2.2 Implementar autenticación JWT con rotación de refresh tokens
    - Implementar endpoints POST `/api/auth/register` (bcrypt cost 12), `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
    - Implementar middleware JWT que valida access token (15min expiración) en todas las rutas excepto /health, /auth/login, /auth/register
    - Implementar rotación de refresh tokens: al usar un refresh token, invalidar el anterior y emitir uno nuevo (7 días)
    - Registrar intentos de autenticación fallidos en tabla `auth_events` con IP y timestamp
    - _Requisitos: 1.2, 1.3, 9.1, 9.2, 9.5, 9.6_

  - [x] 2.3 Implementar rate limiting y validación de esquemas Zod
    - Implementar rate limiter: 100 req/min por userId, respuesta 429 con header Retry-After
    - Definir esquemas Zod para cada ruta (transcripciones CRUD, auth, búsqueda, calendario, sync, export)
    - Implementar middleware de validación que retorna 400 con lista de campos con errores
    - Implementar sanitización de inputs contra SQL injection y XSS
    - _Requisitos: 1.4, 1.5, 1.6, 1.7, 9.3_

  - [x] 2.4 Implementar endpoints REST de transcripciones, ediciones y compartición
    - Implementar CRUD de transcripciones: GET/POST/PUT/DELETE `/api/transcriptions` y `/api/transcriptions/:id`
    - Implementar edición de segmentos: POST `/api/transcriptions/:id/segments/:idx/edit` y GET `/api/transcriptions/:id/edits`
    - Implementar compartición: POST/GET `/api/transcriptions/:id/share`
    - Implementar proxy routes: POST `/api/stt/transcribe`, POST `/api/nlp/summary`, `/api/nlp/actions`, `/api/nlp/minutes`
    - Implementar POST `/api/sync` para sincronización batch y GET `/api/export/:id/:format`
    - _Requisitos: 1.1_

  - [x] 2.5 Escribir test de propiedad para validación JWT
    - **Propiedad 1: Validación JWT rechaza tokens inválidos**
    - Generar tokens con secretos aleatorios, timestamps expirados, payloads malformados
    - Verificar que todos son rechazados con HTTP 401 y no se enrutan al microservicio
    - **Valida: Requisitos 1.2, 1.3**

  - [x] 2.6 Escribir test de propiedad para rate limiting
    - **Propiedad 2: Rate limiting por usuario**
    - Generar secuencias de N requests (N entre 1 y 200) para un usuario
    - Verificar que las primeras 100 pasan y las siguientes reciben 429 con Retry-After positivo
    - **Valida: Requisitos 1.4, 1.5**

  - [x] 2.7 Escribir test de propiedad para validación de esquemas Zod
    - **Propiedad 3: Validación de esquema de peticiones**
    - Generar bodies JSON aleatorios (válidos e inválidos) contra esquemas Zod definidos
    - Verificar que inválidos reciben 400 con lista de errores y válidos son aceptados
    - **Valida: Requisitos 1.6, 1.7**

  - [x] 2.8 Escribir test de propiedad para CORS
    - **Propiedad 4: CORS rechaza orígenes no autorizados**
    - Generar URLs de origen aleatorias y verificar contra lista de permitidos
    - Verificar que orígenes no autorizados no reciben header Access-Control-Allow-Origin
    - **Valida: Requisito 1.8**

  - [x] 2.9 Escribir tests de propiedad para seguridad (tokens, bcrypt, sanitización, headers, auditoría, rotación)
    - **Propiedad 17: Tiempos de expiración de tokens JWT** — Verificar access token 15min, refresh token 7 días
    - **Propiedad 18: Contraseñas hasheadas con bcrypt cost ≥ 12** — Generar contraseñas, hashear, verificar prefijo `$2b$12`
    - **Propiedad 19: Sanitización de inputs contra inyección** — Generar payloads SQL/XSS, verificar sanitización
    - **Propiedad 20: Headers de seguridad en todas las respuestas** — Verificar CSP, X-Content-Type-Options, X-Frame-Options, HSTS
    - **Propiedad 21: Auditoría de intentos de autenticación fallidos** — Verificar registros en auth_events
    - **Propiedad 22: Rotación de refresh tokens** — Verificar invalidación del token anterior tras refresh
    - **Valida: Requisitos 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**


- [x] 3. Checkpoint - Verificar base de datos y API Gateway
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Implementar Motor STT Nube real (FastAPI + Whisper)
  - [x] 4.1 Implementar servicio STT con FastAPI y Whisper
    - Reemplazar stub Flask en `services/stt-cloud/src/main.py` por FastAPI con uvicorn
    - Actualizar `services/stt-cloud/requirements.txt` con fastapi, uvicorn, openai-whisper, torch, python-multipart, prometheus-client
    - Implementar endpoint POST `/transcribe` que recibe audio multipart/form-data y retorna JSON compatible con `RawTranscription`
    - Soportar formatos WAV, WebM, OGG; retornar 400 para formatos no soportados o archivos corruptos
    - Soportar idiomas español e inglés (auto-detect si no se especifica)
    - Implementar endpoint GET `/health` y GET `/metrics` (Prometheus)
    - Actualizar Dockerfile para instalar dependencias de Whisper y torch
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 10.4_

  - [x] 4.2 Escribir test de propiedad para compatibilidad de respuesta STT
    - **Propiedad 5: Respuesta STT compatible con RawTranscription**
    - Generar respuestas de transcripción y verificar que cada segmento tiene startTime ≥ 0, endTime > startTime, text no vacío, confidence entre 0 y 1
    - Verificar campos language y duration presentes
    - **Valida: Requisitos 2.1, 2.5**

- [x] 5. Implementar Servicio NLP real (FastAPI + LLM)
  - [x] 5.1 Implementar servicio NLP con FastAPI y OpenAI SDK
    - Reemplazar stub Flask en `services/nlp-service/src/main.py` por FastAPI con uvicorn
    - Actualizar `services/nlp-service/requirements.txt` con fastapi, uvicorn, openai, prometheus-client
    - Implementar endpoint POST `/summary` que recibe TranscriptionInput y retorna SummaryResponse
    - Implementar endpoint POST `/actions` que retorna ActionItemResponse[] con asignación a hablantes
    - Implementar endpoint POST `/minutes` que retorna MinutesResponse con las 4 secciones requeridas
    - Generar respuestas en el mismo idioma de la transcripción fuente
    - Retornar HTTP 503 si el LLM no está disponible
    - Implementar endpoints GET `/health` y GET `/metrics` (Prometheus)
    - Actualizar Dockerfile
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.4_

  - [x] 5.2 Escribir tests de propiedad para NLP (resumen, accionables, actas, idioma)
    - **Propiedad 6: Resumen NLP contiene al menos un tema** — Verificar array topics no vacío y language presente
    - **Propiedad 7: Accionables NLP referencian hablantes válidos** — Verificar assignedTo es speakerId válido o "unassigned"
    - **Propiedad 8: Acta formal contiene todas las secciones requeridas** — Verificar attendees, topicsDiscussed, decisions, actionItems
    - **Propiedad 9: Idioma de respuesta NLP coincide con transcripción fuente** — Verificar language de respuesta = language de input
    - **Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.6**

- [x] 6. Implementar Servicio de Búsqueda real (Express + PostgreSQL tsvector)
  - [x] 6.1 Implementar búsqueda full-text con PostgreSQL
    - Reemplazar stub en `services/search-service/src/index.ts` por implementación real
    - Agregar dependencias: `pg`, `prom-client`, `winston`
    - Implementar endpoint GET `/search` con query params: q, dateFrom, dateTo, speaker, lang, page
    - Implementar búsqueda con tsvector usando plainto_tsquery con configuración de diccionario según idioma (spanish/english)
    - Implementar control de acceso: solo transcripciones propias o compartidas
    - Implementar paginación y ordenamiento por relevancia (ts_rank)
    - Implementar endpoint POST `/index` para indexar transcripciones (llamado internamente)
    - Implementar endpoints GET `/health` y GET `/metrics`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 10.4_

  - [x] 6.2 Escribir test de propiedad para búsqueda con filtros y control de acceso
    - **Propiedad 10: Búsqueda respeta filtros y control de acceso**
    - Generar conjuntos de transcripciones con distintos propietarios, permisos y filtros
    - Verificar que resultados cumplen filtros, pertenecen a transcripciones accesibles, y contienen campos requeridos
    - **Valida: Requisitos 4.2, 4.3, 4.4**

- [x] 7. Implementar Servicio de Calendario real (Express + OAuth 2.0)
  - [x] 7.1 Implementar flujo OAuth y gestión de eventos de calendario
    - Reemplazar stub en `services/calendar-service/src/index.ts` por implementación real
    - Agregar dependencias: `googleapis`, `@azure/msal-node`, `pg`, `prom-client`, `winston`
    - Implementar GET `/connect/:provider` que redirige a OAuth del proveedor (Google Calendar, Teams Calendar)
    - Implementar GET `/callback/:provider` que intercambia código por tokens y los almacena cifrados en PostgreSQL
    - Implementar GET `/events` que retorna eventos próximos en formato compatible con CalendarEvent del cliente
    - Implementar POST `/reminders` para crear recordatorios en el calendario del proveedor
    - Implementar renovación automática de tokens: si access token expira, usar refresh token; si falla, marcar `requires_reauth`
    - Implementar endpoints GET `/health` y GET `/metrics`
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.4_

  - [x] 7.2 Escribir tests de propiedad para calendario (renovación de tokens, compatibilidad de eventos)
    - **Propiedad 11: Renovación automática de tokens de calendario** — Verificar renovación con refresh token válido y cambio a requires_reauth con inválido
    - **Propiedad 12: Eventos de calendario compatibles con CalendarEvent** — Verificar deserialización con campos id, title, startTime, endTime, participants, provider
    - **Valida: Requisitos 5.3, 5.4, 5.5**

- [x] 8. Checkpoint - Verificar todos los servicios backend
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 9. Implementar Service Worker completo
  - [x] 9.1 Implementar estrategias de cache y background sync en el Service Worker
    - Reemplazar `src/sw.ts` con implementación robusta
    - Implementar cache-first para assets estáticos (JS, CSS, HTML, imágenes) con cache versionado `static-v{hash}`
    - Implementar network-first para peticiones API (`/api/*`) con timeout de 5s y fallback a cache
    - Implementar página de fallback offline (`/offline.html`) para rutas no cacheadas
    - Implementar background sync: encolar peticiones de sincronización fallidas con tag `sync-pending`
    - Implementar reintento con backoff exponencial (max 5 reintentos) para operaciones encoladas
    - Implementar notificación de actualización: enviar mensaje al cliente cuando nueva versión del SW está disponible
    - Crear archivo `public/offline.html` con página de fallback
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 9.2 Escribir tests de propiedad para Service Worker (cache-first, network-first, background sync)
    - **Propiedad 14: SW cache-first para assets estáticos** — Verificar que assets en cache se sirven inmediatamente sin importar estado de red
    - **Propiedad 15: SW network-first con fallback para API** — Verificar red primero, fallback a cache si falla, error offline si no hay cache
    - **Propiedad 16: Background sync encola y reintenta peticiones fallidas** — Verificar encolamiento y reintento al restaurar conectividad
    - **Valida: Requisitos 8.1, 8.2, 8.4**

- [x] 10. Conectar UI existente a API real
  - [x] 10.1 Conectar pantallas UI a los endpoints reales del API Gateway
    - Modificar `src/ui/app.ts` y `src/ui/pipeline-service.ts` para usar fetch contra API Gateway real en lugar de módulos locales
    - Conectar dashboard (`dashboard-screen.ts`) a GET `/api/transcriptions` con paginación
    - Conectar pantalla de búsqueda (`search-screen.ts`) a GET `/api/search` con filtros reales (fecha, hablante, idioma)
    - Conectar detalle de transcripción (`transcription-detail-screen.ts`) a API real con edición inline y compartición
    - Conectar vista de actas (`minutes-view.ts`) a POST `/api/nlp/minutes`
    - Conectar historial de ediciones (`edit-history.ts`) a GET `/api/transcriptions/:id/edits`
    - Implementar pantalla de login/registro conectada a `/api/auth/register` y `/api/auth/login`
    - Almacenar tokens JWT en memoria (no localStorage) y usar refresh token para renovación
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 11. Implementar sistema de monitoreo
  - [x] 11.1 Implementar logging estructurado JSON y métricas Prometheus en todos los servicios
    - Configurar winston en servicios Node.js (API Gateway, Search, Calendar) con formato JSON: timestamp, level, service, requestId, message
    - Configurar logging JSON en servicios Python (STT, NLP) con campos equivalentes
    - Implementar middleware de captura de errores no manejados con stack trace y contexto
    - Agregar prom-client en servicios Node.js: http_request_duration_seconds (histogram), http_requests_total (counter), http_request_errors_total (counter)
    - Agregar prometheus-client en servicios Python con métricas equivalentes
    - Exponer endpoint GET `/metrics` en cada servicio
    - Crear archivo `prometheus.yml` con configuración de scraping y regla de alerta (error rate > 5% en 5min)
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.2 Escribir test de propiedad para logging estructurado
    - **Propiedad 23: Logging estructurado en formato JSON**
    - Generar operaciones que producen logs y verificar que cada log es JSON válido con campos timestamp (ISO 8601), level, service, requestId (UUID), message (no vacío)
    - **Valida: Requisito 10.1**

- [x] 12. Checkpoint - Verificar Service Worker, UI y monitoreo
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 13. Implementar pipeline CI/CD con GitHub Actions
  - [x] 13.1 Crear workflow de GitHub Actions
    - Crear `.github/workflows/ci.yml` con los stages: Lint + TypeCheck → Tests → Docker Build → Publish → Deploy
    - Stage 1: Ejecutar `tsc --noEmit` y ESLint en todos los servicios TypeScript
    - Stage 2: Ejecutar `vitest --run` (unitarios + propiedades con fast-check) y tests Python con pytest + hypothesis
    - Stage 3: Build de todas las imágenes Docker, verificar que compilan sin error
    - Stage 4: Solo en rama principal, publicar imágenes tagueadas con hash del commit
    - Stage 5: Deploy a producción con aprobación manual requerida
    - Configurar notificación al equipo si algún paso falla
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 14. Actualizar Docker Compose y configuración de entorno
  - [x] 14.1 Actualizar docker-compose.yml y archivos de configuración
    - Actualizar `docker-compose.yml` con variables de entorno nuevas (ALLOWED_ORIGINS, etc.)
    - Actualizar `docker-compose.dev.yml` con overrides para desarrollo (hot-reload, volúmenes de código fuente)
    - Actualizar `.env.example` con todas las variables nuevas documentadas
    - Agregar servicio Prometheus al docker-compose con configuración de scraping
    - Verificar que todos los servicios tienen health checks funcionales
    - _Requisitos: 6.3, 10.4_

- [x] 15. Checkpoint final - Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan las 23 propiedades universales de correctitud del diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- Se usa TypeScript + fast-check para servicios Node.js y Python + hypothesis para servicios FastAPI
- Las interfaces del cliente no se modifican; se inyectan implementaciones reales en runtime
