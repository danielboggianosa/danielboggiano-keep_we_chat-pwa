# Documento de Requisitos: Preparación para Producción

## Introducción

Este documento define los requisitos para llevar a producción la aplicación de transcripción de reuniones. La lógica de negocio del lado cliente está completamente implementada con backends pluggables (stubs), pero faltan las implementaciones reales de los servicios backend, la interfaz de usuario completa, el Service Worker con estrategias de cache robustas, las integraciones reales de STT/NLP/Diarización, la persistencia en PostgreSQL, la seguridad, el monitoreo y el pipeline de CI/CD.

## Glosario

- **API_Gateway**: Servicio central que enruta peticiones REST a los microservicios internos, gestiona autenticación JWT y aplica rate limiting
- **Motor_STT_Nube**: Servicio Python que integra el modelo Whisper para transcripción de audio con alta precisión
- **Servicio_NLP**: Servicio Python que integra un modelo de lenguaje (GPT-4 o similar) para generar resúmenes, extraer accionables y producir actas formales
- **Servicio_Busqueda**: Servicio que implementa búsqueda full-text sobre transcripciones usando PostgreSQL con índices tsvector
- **Servicio_Calendario**: Servicio que integra OAuth real con Google Calendar y Microsoft Teams Calendar
- **Service_Worker**: Componente del navegador que gestiona cache offline, background sync y fallback de páginas
- **Pipeline_CICD**: Sistema automatizado de build, test y deploy continuo
- **Sistema_Monitoreo**: Conjunto de herramientas para logging estructurado, error tracking y métricas de rendimiento
- **Interfaz_Usuario**: Conjunto de componentes UI de la PWA que presentan las funcionalidades al usuario final
- **Base_Datos**: Instancia PostgreSQL que persiste usuarios, transcripciones, ediciones, búsquedas y permisos

## Requisitos

### Requisito 1: Implementación Real del API Gateway

**Historia de Usuario:** Como desarrollador, quiero que el API Gateway tenga endpoints REST reales con autenticación y routing, para que los clientes puedan comunicarse de forma segura con los microservicios.

#### Criterios de Aceptación

1. THE API_Gateway SHALL exponer endpoints REST para todas las operaciones del sistema: transcripciones (CRUD), usuarios, búsqueda, exportación, calendario y sincronización
2. WHEN una petición llega al API_Gateway, THE API_Gateway SHALL validar el token JWT del header Authorization antes de enrutar la petición al microservicio correspondiente
3. IF un token JWT es inválido o ha expirado, THEN THE API_Gateway SHALL responder con código HTTP 401 y un mensaje de error descriptivo
4. THE API_Gateway SHALL aplicar rate limiting de 100 peticiones por minuto por usuario autenticado
5. IF un usuario excede el límite de peticiones, THEN THE API_Gateway SHALL responder con código HTTP 429 y un header Retry-After indicando los segundos de espera
6. THE API_Gateway SHALL validar el cuerpo de cada petición contra un esquema definido antes de enrutarla al microservicio destino
7. IF el cuerpo de una petición no cumple el esquema esperado, THEN THE API_Gateway SHALL responder con código HTTP 400 y los campos con errores de validación
8. THE API_Gateway SHALL configurar CORS para permitir peticiones únicamente desde los orígenes autorizados definidos en variables de entorno

### Requisito 2: Implementación Real del Motor STT en la Nube

**Historia de Usuario:** Como usuario, quiero que el servicio de transcripción en la nube use el modelo Whisper real, para obtener transcripciones de alta precisión cuando mis grabaciones se sincronizan.

#### Criterios de Aceptación

1. WHEN el Motor_STT_Nube recibe un archivo de audio, THE Motor_STT_Nube SHALL transcribirlo usando el modelo Whisper y retornar segmentos con timestamps, texto y nivel de confianza
2. THE Motor_STT_Nube SHALL soportar transcripción de audio en español e inglés
3. THE Motor_STT_Nube SHALL aceptar archivos de audio en formatos WAV, WebM y OGG
4. IF el Motor_STT_Nube recibe un archivo de audio corrupto o en formato no soportado, THEN THE Motor_STT_Nube SHALL responder con código HTTP 400 y un mensaje indicando el problema
5. WHEN el Motor_STT_Nube procesa un archivo de audio, THE Motor_STT_Nube SHALL retornar la transcripción en un formato JSON compatible con la interfaz RawTranscription del cliente

### Requisito 3: Implementación Real del Servicio NLP

**Historia de Usuario:** Como usuario, quiero que los resúmenes, accionables y actas formales se generen con un modelo de lenguaje real, para obtener resultados de calidad profesional.

#### Criterios de Aceptación

1. WHEN el Servicio_NLP recibe una transcripción diarizada, THE Servicio_NLP SHALL generar un resumen de temas principales usando un modelo de lenguaje (GPT-4 o equivalente)
2. WHEN el Servicio_NLP recibe una transcripción diarizada, THE Servicio_NLP SHALL extraer accionables con asignación a hablantes usando el modelo de lenguaje
3. WHEN el Servicio_NLP recibe una solicitud de acta formal, THE Servicio_NLP SHALL generar un documento estructurado con asistentes, temas, decisiones y accionables
4. THE Servicio_NLP SHALL generar todas las respuestas en el mismo idioma de la transcripción fuente
5. IF el modelo de lenguaje no está disponible o retorna un error, THEN THE Servicio_NLP SHALL responder con código HTTP 503 y un mensaje indicando la indisponibilidad temporal
6. THE Servicio_NLP SHALL retornar respuestas en formato JSON compatible con las interfaces MeetingSummary, ActionItem y FormalMinutes del cliente

### Requisito 4: Implementación Real del Servicio de Búsqueda con PostgreSQL

**Historia de Usuario:** Como usuario, quiero que la búsqueda full-text funcione sobre una base de datos real, para encontrar contenido en mis transcripciones de forma rápida y precisa.

#### Criterios de Aceptación

1. THE Servicio_Busqueda SHALL implementar búsqueda full-text usando índices tsvector de PostgreSQL sobre los segmentos de transcripción
2. WHEN el Servicio_Busqueda recibe una consulta de búsqueda, THE Servicio_Busqueda SHALL retornar resultados ordenados por relevancia con el fragmento coincidente, contexto, hablante y fecha de la reunión
3. THE Servicio_Busqueda SHALL soportar filtros por rango de fechas, hablante e idioma en las consultas
4. THE Servicio_Busqueda SHALL restringir los resultados de búsqueda a transcripciones accesibles por el usuario que realiza la consulta (propias o compartidas)
5. THE Servicio_Busqueda SHALL soportar búsqueda en español e inglés usando las configuraciones de diccionario correspondientes de PostgreSQL

### Requisito 5: Implementación Real del Servicio de Calendario

**Historia de Usuario:** Como usuario, quiero que la integración con mi calendario funcione con OAuth real, para que el sistema pueda leer mis eventos y crear recordatorios.

#### Criterios de Aceptación

1. THE Servicio_Calendario SHALL implementar flujo OAuth 2.0 completo para Google Calendar y Microsoft Teams Calendar
2. WHEN un usuario conecta su cuenta de calendario, THE Servicio_Calendario SHALL almacenar los tokens de acceso y refresh de forma segura
3. WHEN un token de acceso expira, THE Servicio_Calendario SHALL renovarlo automáticamente usando el refresh token
4. IF la renovación del token falla, THEN THE Servicio_Calendario SHALL notificar al usuario que debe re-autenticarse
5. WHEN el Servicio_Calendario consulta eventos próximos, THE Servicio_Calendario SHALL retornar eventos en formato compatible con la interfaz CalendarEvent del cliente
6. WHEN el usuario solicita crear un recordatorio para un accionable, THE Servicio_Calendario SHALL crear el evento en el calendario del proveedor seleccionado por el usuario

### Requisito 6: Persistencia en PostgreSQL

**Historia de Usuario:** Como desarrollador, quiero que los servicios que actualmente usan almacenamiento en memoria migren a PostgreSQL, para garantizar persistencia de datos entre reinicios y escalabilidad.

#### Criterios de Aceptación

1. THE Base_Datos SHALL almacenar usuarios, transcripciones, segmentos, hablantes, accionables, actas formales, registros de edición, permisos de compartición y eventos de calendario
2. THE Base_Datos SHALL definir migraciones versionadas para crear y actualizar el esquema de tablas
3. WHEN un servicio se inicia, THE Base_Datos SHALL ejecutar las migraciones pendientes antes de aceptar peticiones
4. THE Base_Datos SHALL definir índices para las columnas utilizadas en búsquedas frecuentes: userId en transcripciones, transcriptionId en segmentos, y índices tsvector para búsqueda full-text
5. THE Base_Datos SHALL implementar foreign keys y constraints para garantizar integridad referencial entre tablas

### Requisito 7: Interfaz de Usuario Completa

**Historia de Usuario:** Como usuario, quiero una interfaz completa y funcional para todas las pantallas de la aplicación, para poder usar todas las funcionalidades del sistema.

#### Criterios de Aceptación

1. THE Interfaz_Usuario SHALL implementar un dashboard con lista de transcripciones del usuario, ordenadas por fecha, con título, duración y estado de sincronización
2. THE Interfaz_Usuario SHALL implementar una pantalla de grabación con indicador visual de audio activo, temporizador, transcripción en tiempo real y controles de pausa y detención
3. THE Interfaz_Usuario SHALL implementar una vista de transcripción que muestre segmentos con marcas de hablante diferenciadas por color, timestamps y texto editable
4. THE Interfaz_Usuario SHALL implementar un panel de búsqueda con campo de texto, filtros por fecha, hablante e idioma, y lista de resultados con contexto
5. THE Interfaz_Usuario SHALL implementar un panel de exportación que permita seleccionar formato (VTT, TXT, Markdown) y descargar el archivo
6. THE Interfaz_Usuario SHALL implementar una vista de actas formales con las secciones de asistentes, temas, decisiones y accionables, con opción de edición antes de finalizar
7. THE Interfaz_Usuario SHALL implementar una vista de historial de ediciones que muestre quién editó, cuándo y qué cambió en cada segmento
8. THE Interfaz_Usuario SHALL ser responsive y funcional en desktop, tablet y dispositivos móviles

### Requisito 8: Service Worker Completo

**Historia de Usuario:** Como usuario, quiero que la aplicación funcione offline de forma robusta, con sincronización en background cuando recupere conexión.

#### Criterios de Aceptación

1. THE Service_Worker SHALL implementar estrategia cache-first para assets estáticos (HTML, CSS, JavaScript, imágenes) con actualización en background
2. THE Service_Worker SHALL implementar estrategia network-first para peticiones a la API, con fallback a cache cuando no hay conexión
3. WHEN el dispositivo no tiene conexión a internet, THE Service_Worker SHALL servir una página de fallback offline para rutas no cacheadas
4. THE Service_Worker SHALL implementar background sync para encolar y reintentar peticiones de sincronización cuando el dispositivo recupere conectividad
5. WHEN una nueva versión del Service_Worker está disponible, THE Service_Worker SHALL notificar al usuario y ofrecer actualizar la aplicación

### Requisito 9: Seguridad de la Aplicación

**Historia de Usuario:** Como administrador, quiero que la aplicación tenga medidas de seguridad robustas, para proteger los datos sensibles de las reuniones de la organización.

#### Criterios de Aceptación

1. THE API_Gateway SHALL implementar autenticación JWT con tokens de acceso de corta duración (15 minutos) y refresh tokens de larga duración (7 días)
2. THE API_Gateway SHALL almacenar contraseñas usando bcrypt con un cost factor mínimo de 12
3. THE API_Gateway SHALL validar y sanitizar todos los inputs de usuario para prevenir inyección SQL y XSS
4. THE API_Gateway SHALL servir todas las respuestas con headers de seguridad: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options y Strict-Transport-Security
5. THE API_Gateway SHALL registrar todos los intentos de autenticación fallidos con la dirección IP y timestamp para auditoría
6. WHEN un refresh token es utilizado, THE API_Gateway SHALL invalidar el refresh token anterior y emitir uno nuevo (rotación de tokens)

### Requisito 10: Monitoreo y Observabilidad

**Historia de Usuario:** Como desarrollador/operador, quiero tener visibilidad sobre el estado y rendimiento de todos los servicios, para detectar y resolver problemas rápidamente.

#### Criterios de Aceptación

1. THE Sistema_Monitoreo SHALL implementar logging estructurado en formato JSON en todos los servicios, con campos: timestamp, nivel (info, warn, error), servicio, requestId y mensaje
2. WHEN un error no manejado ocurre en cualquier servicio, THE Sistema_Monitoreo SHALL capturar el error con stack trace, contexto de la petición y metadata del servicio
3. THE Sistema_Monitoreo SHALL exponer métricas de rendimiento en cada servicio: latencia de peticiones (p50, p95, p99), tasa de errores y uso de recursos
4. THE Sistema_Monitoreo SHALL exponer un endpoint /metrics en cada servicio compatible con el formato de Prometheus
5. WHEN la tasa de errores de un servicio supera el 5% en una ventana de 5 minutos, THE Sistema_Monitoreo SHALL generar una alerta

### Requisito 11: Pipeline de CI/CD

**Historia de Usuario:** Como desarrollador, quiero un pipeline automatizado de build, test y deploy, para entregar cambios a producción de forma rápida y segura.

#### Criterios de Aceptación

1. THE Pipeline_CICD SHALL ejecutar todos los tests unitarios y de propiedades en cada push a cualquier rama del repositorio
2. THE Pipeline_CICD SHALL ejecutar el build de todos los servicios Docker y verificar que las imágenes se construyen sin errores
3. WHEN todos los tests pasan y el build es exitoso en la rama principal, THE Pipeline_CICD SHALL generar imágenes Docker tagueadas con el hash del commit y publicarlas en un registro de contenedores
4. THE Pipeline_CICD SHALL ejecutar un análisis de linting y verificación de tipos TypeScript como paso previo a los tests
5. IF algún paso del pipeline falla, THEN THE Pipeline_CICD SHALL notificar al equipo con el detalle del fallo y detener el despliegue
6. THE Pipeline_CICD SHALL definir un workflow de deploy a producción que requiera aprobación manual antes de ejecutarse
