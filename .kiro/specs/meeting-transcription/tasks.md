# Plan de Implementación: Sistema de Transcripción de Reuniones

## Visión General

Implementación incremental del sistema de transcripción de reuniones como PWA offline-first con TypeScript. Se comienza con los modelos de datos e interfaces core, luego los módulos de captura y transcripción, seguido por diarización, NLP, sincronización, búsqueda, exportación, calendario y gestión de usuarios. Cada paso integra lo anterior.

## Tareas

- [x] 1. Configurar estructura del proyecto y definir interfaces core
  - [x] 1.1 Crear estructura de directorios del proyecto TypeScript con configuración de PWA, Service Worker base, e IndexedDB
    - Configurar `tsconfig.json`, `package.json` con dependencias (fast-check para testing)
    - Crear Service Worker base para funcionalidad offline
    - Configurar IndexedDB stores: `audioFiles`, `transcriptions`, `syncQueue`, `settings`
    - _Requisitos: 12.1, 12.2, 2.1_

  - [x] 1.2 Definir todas las interfaces y tipos TypeScript del sistema
    - Crear archivos de tipos para: `RecordingConfig`, `RecordingSession`, `RecordingStatus`, `AudioFile`
    - Crear tipos para: `RawTranscription`, `TranscriptionSegment`, `DiarizedSegment`, `DiarizedTranscription`, `SpeakerProfile`
    - Crear tipos para: `SyncItem`, `SyncResult`, `MeetingSummary`, `ActionItem`, `FormalMinutes`
    - Crear tipos para: `SearchQuery`, `SearchResult`, `ExportFormat`, `CalendarEvent`, `CalendarProvider`
    - Crear tipos para: `Permission`, `EditRecord`, `TranscriptionShare`
    - _Requisitos: Todos (interfaces base para todo el sistema)_

- [x] 2. Implementar módulo de captura de audio (`AudioCaptureModule`)
  - [x] 2.1 Implementar captura de audio desde micrófono del dispositivo
    - Implementar `startRecording()` con `navigator.mediaDevices.getUserMedia`
    - Implementar `stopRecording()` que guarda el `AudioFile` en IndexedDB
    - Implementar `getStatus()` para consultar estado de grabación
    - Manejar errores: micrófono no disponible, pérdida de señal
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implementar integración con plataformas de videoconferencia
    - Implementar captura directa vía APIs de Zoom, Teams y Google Meet
    - Implementar fallback a captura ambiental cuando no hay permisos de integración
    - Permitir al usuario elegir entre captura directa o ambiental
    - Capturar canales separados por participante cuando la plataforma lo permita
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Escribir tests unitarios para AudioCaptureModule
    - Test: iniciar y detener grabación correctamente
    - Test: fallback a captura ambiental sin permisos de integración
    - Test caso borde: grabación con audio vacío
    - Test error: micrófono no disponible
    - _Requisitos: 1.1, 1.5, 4.2_

- [x] 3. Implementar motor STT local (`LocalSTTEngine`)
  - [x] 3.1 Implementar transcripción local con Whisper WASM
    - Implementar `transcribe()` que procesa `AudioFile` y retorna `RawTranscription` con segmentos, timestamps y confianza
    - Implementar `isReady()` para verificar carga del modelo
    - Soportar idiomas español e inglés
    - Manejar errores: modelo no cargado, transcripción vacía, idioma no detectado
    - _Requisitos: 2.1, 2.2_

  - [x] 3.2 Escribir tests unitarios para LocalSTTEngine
    - Test: transcripción produce output para audio en español e inglés
    - Test caso borde: audio sin voz detectable
    - Test error: modelo WASM no cargado
    - _Requisitos: 2.1, 2.2_

- [x] 4. Implementar diarizador (`DiarizationEngine`)
  - [x] 4.1 Implementar diarización de hablantes
    - Implementar `diarize()` que asigna `speakerId` y `speakerLabel` a cada segmento
    - Etiquetar hablantes como "Hablante 1", "Hablante 2", etc.
    - Detectar identificación verbal de nombre (ej: "Hola, soy María") y propagar a segmentos posteriores
    - Marcar segmentos con baja confianza como "Hablante no identificado"
    - Generar `SpeakerProfile[]` con nombres identificados
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Escribir test de propiedad para consistencia de hablantes
    - **Propiedad 3: Consistencia de identificación de hablantes**
    - Generar transcripciones con N hablantes aleatorios y segmentos con confianza variable
    - Verificar que cada `speakerId` mapea a exactamente un `speakerLabel` y que segmentos con baja confianza usan "Hablante no identificado"
    - **Valida: Requisitos 3.1, 3.3, 3.4**

  - [x] 4.3 Escribir test de propiedad para persistencia de nombre identificado
    - **Propiedad 4: Persistencia de nombre de hablante identificado**
    - Generar secuencias de segmentos donde un hablante se identifica en un punto aleatorio
    - Verificar que todos los segmentos posteriores del mismo `speakerId` usan el nombre identificado
    - **Valida: Requisito 3.2**

  - [x] 4.4 Escribir tests unitarios para DiarizationEngine
    - Test: transcripción con un solo hablante
    - Test caso borde: audio de baja calidad sin distinción de hablantes
    - _Requisitos: 3.1, 3.4_

- [x] 5. Checkpoint - Verificar que los módulos core funcionan correctamente
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 6. Implementar gestor de sincronización (`SyncManager`)
  - [x] 6.1 Implementar sincronización offline/online
    - Implementar `syncPending()` que procesa la cola de sincronización cuando hay conectividad
    - Implementar `isOnline()` para verificar estado de red
    - Implementar `enqueue()` para registrar elementos pendientes (audio, transcripción, edición)
    - Implementar reintento exponencial (backoff) para fallos de conexión
    - Manejar conflictos de versiones con estrategia last-write-wins
    - _Requisitos: 2.3, 12.3_

  - [x] 6.2 Implementar re-procesamiento en nube tras sincronización
    - Disparar re-procesamiento por `Motor_STT_Nube` cuando una transcripción se sincroniza
    - Reemplazar transcripción local con versión mejorada y cambiar estado a "enhanced"
    - _Requisitos: 2.4, 2.5_

  - [x] 6.3 Escribir test de propiedad para sincronización completa
    - **Propiedad 1: Sincronización completa de elementos pendientes**
    - Generar colas de sync con items aleatorios (audio, transcripción, edición)
    - Verificar que todos los elementos son procesados y la cola queda vacía o con reintentos programados
    - **Valida: Requisitos 2.3, 12.3**

  - [x] 6.4 Escribir test de propiedad para reemplazo por transcripción mejorada
    - **Propiedad 2: Reemplazo por transcripción mejorada**
    - Generar pares de transcripción local + versión mejorada
    - Verificar que la versión local es reemplazada y el estado cambia a "enhanced"
    - **Valida: Requisito 2.5**

  - [x] 6.5 Escribir tests unitarios para SyncManager
    - Test: re-procesamiento en nube se dispara tras sincronización
    - Test caso borde: sincronización con cola vacía
    - Test error: fallo de red durante sincronización
    - _Requisitos: 2.3, 2.4, 2.5_

- [x] 7. Implementar servicio NLP (`NLPService`)
  - [x] 7.1 Implementar generación de resúmenes y extracción de accionables
    - Implementar `generateSummary()` que produce `MeetingSummary` con temas y puntos clave
    - Implementar `extractActionItems()` que extrae accionables con asignación a hablantes
    - Marcar accionables sin hablante determinable como "Sin asignar" (`assignedTo: "unassigned"`)
    - _Requisitos: 5.1, 5.2, 5.3, 5.5_

  - [x] 7.2 Implementar generación de actas formales
    - Implementar `generateMinutes()` que produce `FormalMinutes` con asistentes, temas, decisiones y accionables
    - Generar acta en el mismo idioma de la transcripción
    - _Requisitos: 6.1, 6.2_

  - [x] 7.3 Escribir test de propiedad para generación de resumen y accionables
    - **Propiedad 5: Generación de resumen y accionables post-transcripción**
    - Generar transcripciones completas con contenido variado
    - Verificar que se genera `MeetingSummary` con al menos un tema y `ActionItem[]` asociados
    - **Valida: Requisitos 5.1, 5.2**

  - [x] 7.4 Escribir test de propiedad para asignación de accionables
    - **Propiedad 6: Asignación de accionables a hablantes**
    - Generar accionables con speakerIds válidos e inválidos
    - Verificar que `assignedTo` referencia un `speakerId` válido o es "unassigned" con label "Sin asignar"
    - **Valida: Requisitos 5.3, 5.5**

  - [x] 7.5 Escribir test de propiedad para completitud de actas formales
    - **Propiedad 7: Completitud y coherencia de actas formales**
    - Generar transcripciones con idioma aleatorio (es/en) y hablantes variados
    - Verificar que el acta contiene las 4 secciones requeridas, asistentes corresponden a hablantes, e idioma coincide
    - **Valida: Requisitos 6.1, 6.2**

  - [x] 7.6 Escribir tests unitarios para NLPService
    - Test: accionable sin hablante asignable marcado como "Sin asignar"
    - Test: agregar recordatorio de accionable en calendario
    - _Requisitos: 5.4, 5.5_

- [x] 8. Checkpoint - Verificar módulos de procesamiento y NLP
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 9. Implementar gestión de usuarios y control de acceso (`UserService`)
  - [x] 9.1 Implementar servicio de autenticación y gestión de usuarios
    - Implementar `grantAccess()` y `revokeAccess()` para administradores
    - Implementar `shareTranscription()` con permisos `read` y `read-write`
    - Asociar cada transcripción al usuario creador (`ownerId`)
    - Restringir visualización de transcripciones al creador o usuarios con acceso compartido
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [x] 9.2 Escribir test de propiedad para control de acceso otorgar/revocar
    - **Propiedad 11: Control de acceso — otorgar y revocar**
    - Generar secuencias de operaciones grant/revoke
    - Verificar que grant seguido de revoke resulta en acceso denegado y viceversa
    - **Valida: Requisitos 9.1, 9.3**

  - [x] 9.3 Escribir tests unitarios para UserService
    - Test: compartir transcripción con permisos de solo lectura y lectura-edición
    - _Requisitos: 9.4_

- [x] 10. Implementar edición de transcripciones (`EditService`)
  - [x] 10.1 Implementar edición con historial y enforcement de permisos
    - Implementar `editSegment()` que modifica texto y crea `EditRecord`
    - Implementar `getEditHistory()` para consultar historial de ediciones
    - Verificar permisos antes de permitir edición (propietario o permiso read-write)
    - Rechazar ediciones sin permisos adecuados
    - _Requisitos: 8.1, 8.2, 8.3_

  - [x] 10.2 Escribir test de propiedad para enforcement de permisos de edición
    - **Propiedad 9: Enforcement de permisos de edición**
    - Generar combinaciones de usuario/transcripción/permiso
    - Verificar que solo propietarios o usuarios con read-write pueden editar
    - **Valida: Requisito 8.1**

  - [x] 10.3 Escribir test de propiedad para integridad del log de ediciones
    - **Propiedad 10: Integridad del log de ediciones y propiedad de transcripciones**
    - Generar secuencias de ediciones por distintos usuarios
    - Verificar que cada edición crea un `EditRecord` con `editedBy` y `editedAt` válidos
    - **Valida: Requisitos 8.2, 9.2**

  - [x] 10.4 Escribir tests unitarios para EditService
    - Test error: intento de edición sin permisos
    - _Requisitos: 8.1_

- [x] 11. Implementar servicio de búsqueda (`SearchService`)
  - [x] 11.1 Implementar búsqueda full-text con filtros y control de acceso
    - Implementar `search()` con filtros por rango de fechas, hablante e idioma
    - Retornar resultados con contexto, hablante y fecha de reunión
    - Restringir resultados a transcripciones accesibles por el usuario (propias o compartidas)
    - Implementar paginación
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 11.2 Escribir test de propiedad para búsqueda con filtros y control de acceso
    - **Propiedad 8: Correctitud de búsqueda con filtros y control de acceso**
    - Generar conjuntos de transcripciones con distintos propietarios, permisos y filtros
    - Verificar que resultados cumplen filtros, pertenecen a transcripciones accesibles, y contienen contexto
    - **Valida: Requisitos 7.1, 7.2, 7.3, 9.3**

  - [x] 11.3 Escribir tests unitarios para SearchService
    - Test caso borde: búsqueda sin resultados
    - _Requisitos: 7.1_

- [x] 12. Implementar servicio de exportación (`ExportService`)
  - [x] 12.1 Implementar exportación en formatos VTT, TXT y Markdown
    - Implementar `export()` para los tres formatos con marcas de hablante, timestamps y texto
    - Implementar `importVTT()` para importación de archivos VTT
    - Manejar errores: transcripción corrupta, VTT malformado
    - _Requisitos: 10.1, 10.2, 10.3, 10.4_

  - [x] 12.2 Escribir test de propiedad para preservación de estructura en exportación
    - **Propiedad 12: Preservación de estructura en exportación**
    - Generar transcripciones aleatorias y exportar a cada formato
    - Verificar que el archivo contiene marcas de hablante, timestamps y texto de cada segmento
    - **Valida: Requisitos 10.1, 10.2, 10.3**

  - [x] 12.3 Escribir test de propiedad para round-trip VTT
    - **Propiedad 13: Round-trip de exportación/importación VTT**
    - Generar transcripciones aleatorias con hablantes, timestamps y texto variado
    - Verificar que exportar a VTT e importar produce transcripción equivalente a la original
    - **Valida: Requisito 10.4**

  - [x] 12.4 Escribir tests unitarios para ExportService
    - Test caso borde: exportación de transcripción sin segmentos
    - Test error: archivo VTT malformado en importación
    - _Requisitos: 10.1, 10.4_

- [x] 13. Checkpoint - Verificar servicios de usuario, búsqueda y exportación
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 14. Implementar integración con calendario (`CalendarService`)
  - [x] 14.1 Implementar conexión con calendarios y auto-inicio de grabación
    - Implementar `connect()` para Google Calendar, Teams Calendar y otros
    - Implementar `getUpcomingEvents()` para obtener próximos eventos
    - Implementar notificación al usuario cuando una reunión está por comenzar
    - Iniciar grabación en modo apropiado (integración directa o ambiental) al aceptar auto-inicio
    - Implementar `createReminder()` para accionables en calendario
    - Asociar transcripción resultante con evento de calendario (título, participantes)
    - Manejar errores: token expirado, evento no encontrado
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 5.4_

  - [x] 14.2 Escribir test de propiedad para auto-inicio por calendario
    - **Propiedad 14: Auto-inicio de grabación por calendario**
    - Generar eventos de calendario con distintos tiempos y tipos de reunión
    - Verificar que se genera notificación y se inicia grabación en modo correcto
    - **Valida: Requisitos 11.2, 11.3**

  - [x] 14.3 Escribir test de propiedad para asociación transcripción-evento
    - **Propiedad 15: Asociación transcripción-evento de calendario**
    - Generar transcripciones creadas desde eventos de calendario
    - Verificar que la transcripción tiene `calendarEventId` y datos del evento asociados
    - **Valida: Requisito 11.4**

  - [x] 14.4 Escribir tests unitarios para CalendarService
    - Test error: token de calendario expirado
    - _Requisitos: 11.1_

- [x] 15. Implementar UI responsive y PWA
  - [x] 15.1 Implementar interfaz de usuario responsive
    - Crear componentes UI para: grabación, visualización de transcripción, edición, búsqueda, exportación
    - Implementar indicador visual de grabación activa
    - Implementar vista de acta formal con opción de edición antes de finalizar
    - Implementar vista de historial de ediciones
    - Asegurar compatibilidad responsive (desktop, tablet, móvil)
    - _Requisitos: 1.3, 6.3, 8.3, 12.1_

  - [x] 15.2 Configurar PWA completa con Service Worker y manifest
    - Configurar manifest.json para instalación como PWA
    - Implementar Service Worker con estrategia de cache offline-first
    - Asegurar funcionalidad con pantalla bloqueada
    - _Requisitos: 1.2, 12.2_

- [x] 16. Integración final y wiring de todos los componentes
  - [x] 16.1 Conectar todos los módulos y servicios
    - Integrar flujo completo: grabación → transcripción → diarización → NLP → almacenamiento
    - Integrar sincronización automática en background vía Service Worker
    - Integrar calendario con auto-inicio de grabación
    - Integrar búsqueda con control de acceso
    - Integrar exportación desde la UI
    - _Requisitos: Todos_

  - [x] 16.2 Escribir tests de integración end-to-end
    - Test: flujo completo de grabación a transcripción con diarización
    - Test: sincronización y re-procesamiento en nube
    - Test: búsqueda respeta permisos de acceso
    - _Requisitos: Todos_

- [x] 17. Dockerizar todos los servicios del sistema
  - [x] 17.1 Crear Dockerfiles con multi-stage build para cada servicio
    - Crear Dockerfile para cliente PWA (build + nginx:alpine)
    - Crear Dockerfile para API Gateway (build TS + node:alpine)
    - Crear Dockerfile para Motor STT Nube (deps + python:slim)
    - Crear Dockerfile para Servicio NLP (deps + python:slim)
    - Crear Dockerfile para Servicio de Búsqueda (build TS + node:alpine)
    - Crear Dockerfile para Servicio de Calendario (build TS + node:alpine)
    - _Requisitos: 13.1, 13.6_

  - [x] 17.2 Crear docker-compose.yml y configuración de entorno
    - Crear docker-compose.yml que orqueste todos los servicios, PostgreSQL y MinIO
    - Crear docker-compose.dev.yml con overrides para desarrollo (hot-reload, volúmenes)
    - Crear .env.example con todas las variables de entorno documentadas
    - Configurar health checks (`/health`) en cada contenedor
    - Verificar que `docker-compose up` levanta un entorno funcional completo
    - _Requisitos: 13.2, 13.3, 13.4, 13.5_

  - [x] 17.3 Escribir tests de smoke para contenedores Docker
    - Test: todos los contenedores pasan health check tras `docker-compose up`
    - Test: variables de entorno no tienen valores hardcodeados en las imágenes
    - _Requisitos: 13.3, 13.4, 13.5_

- [x] 18. Checkpoint final - Verificar integración completa y dockerización
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan propiedades universales de correctitud
- Los tests unitarios validan ejemplos específicos y casos borde
- Se usa TypeScript como lenguaje de implementación y fast-check para property-based testing
