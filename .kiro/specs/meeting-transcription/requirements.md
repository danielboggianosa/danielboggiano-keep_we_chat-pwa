# Documento de Requisitos: Sistema de Transcripción de Reuniones

## Introducción

Sistema de transcripción de reuniones diseñado para organizaciones que necesitan capturar, transcribir y gestionar conversaciones tanto en reuniones físicas como virtuales. El sistema funciona como aplicación web (compatible con todos los dispositivos), permite identificación de hablantes, genera resúmenes y accionables, y sincroniza transcripciones locales con la nube. Soporta español e inglés.

## Glosario

- **Sistema_Transcripcion**: Aplicación web principal que gestiona la grabación, transcripción y almacenamiento de reuniones
- **Motor_STT_Local**: Componente de speech-to-text que funciona offline en el dispositivo del usuario
- **Motor_STT_Nube**: Componente de speech-to-text en la nube con mayor precisión para re-procesamiento
- **Diarizador**: Componente que identifica y separa hablantes distintos dentro de un mismo canal de audio
- **Transcripcion**: Documento de texto resultante de convertir audio a texto, con marcas de hablante y timestamps
- **Accionable**: Tarea o compromiso identificado durante la reunión, asignado a un hablante específico
- **Acta_Formal**: Documento estructurado que resume la reunión con asistentes, temas tratados, decisiones y accionables
- **Usuario**: Miembro de la organización con acceso al sistema
- **Administrador**: Usuario con permisos para otorgar acceso a la aplicación
- **Reunion_Fisica**: Reunión presencial donde el audio se captura mediante el micrófono del dispositivo
- **Reunion_Virtual**: Reunión por videoconferencia (Zoom, Teams, Google Meet) con captura directa o ambiental
- **Log_Edicion**: Registro que almacena quién editó la transcripción y cuándo

## Requisitos

### Requisito 1: Grabación de Audio

**Historia de Usuario:** Como usuario, quiero grabar el audio de mis reuniones desde cualquier dispositivo, para tener un registro completo de lo que se dijo.

#### Criterios de Aceptación

1. WHEN el usuario inicia una grabación, THE Sistema_Transcripcion SHALL capturar audio desde el micrófono del dispositivo (laptop o celular) y almacenarlo localmente
2. WHILE una grabación está en curso, THE Sistema_Transcripcion SHALL continuar capturando audio incluso si la pantalla del dispositivo está bloqueada
3. WHILE una grabación está en curso, THE Sistema_Transcripcion SHALL mostrar un indicador visual de que la grabación está activa
4. THE Sistema_Transcripcion SHALL soportar grabaciones de reuniones sin límite de duración establecido
5. WHEN el usuario detiene la grabación, THE Sistema_Transcripcion SHALL guardar el archivo de audio localmente antes de cualquier procesamiento

### Requisito 2: Transcripción Local y Sincronización con la Nube

**Historia de Usuario:** Como usuario, quiero que mis reuniones se transcriban localmente y luego se sincronicen con la nube, para poder usar el sistema sin depender de conexión a internet.

#### Criterios de Aceptación

1. WHEN una grabación finaliza, THE Motor_STT_Local SHALL transcribir el audio a texto en el dispositivo del usuario sin requerir conexión a internet
2. THE Motor_STT_Local SHALL soportar transcripción en español e inglés
3. WHEN el dispositivo recupera conexión a internet, THE Sistema_Transcripcion SHALL sincronizar la transcripción y el audio con la nube
4. WHEN una transcripción se sincroniza con la nube, THE Motor_STT_Nube SHALL re-procesar el audio para generar una transcripción de mayor precisión
5. WHEN el Motor_STT_Nube genera una transcripción mejorada, THE Sistema_Transcripcion SHALL reemplazar la transcripción local con la versión mejorada

### Requisito 3: Identificación de Hablantes (Diarización)

**Historia de Usuario:** Como usuario, quiero que el sistema distinga quién dijo qué en la reunión, para poder atribuir comentarios y compromisos a cada participante.

#### Criterios de Aceptación

1. THE Diarizador SHALL identificar y etiquetar hablantes distintos dentro de un mismo canal de audio como "Hablante 1", "Hablante 2", etc.
2. WHEN un hablante se identifica verbalmente por primera vez (ej: "Hola, soy María"), THE Diarizador SHALL asociar ese nombre al hablante correspondiente para el resto de la transcripción
3. THE Diarizador SHALL mantener la consistencia de identificación de hablantes durante toda la duración de una reunión
4. WHEN el Diarizador no puede distinguir entre dos hablantes con certeza, THE Sistema_Transcripcion SHALL marcar el segmento como "Hablante no identificado"

### Requisito 4: Captura de Reuniones Virtuales

**Historia de Usuario:** Como usuario, quiero capturar audio de reuniones virtuales de forma directa o ambiental, para transcribir tanto reuniones donde tengo acceso de integración como aquellas donde no.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL ofrecer integración directa con Zoom, Microsoft Teams y Google Meet para captura de audio
2. WHEN el usuario no tiene permisos para integración directa, THE Sistema_Transcripcion SHALL permitir captura de audio ambiental mediante el micrófono del dispositivo
3. WHEN el usuario inicia una grabación, THE Sistema_Transcripcion SHALL permitir al usuario elegir entre captura directa (integración) o captura ambiental
4. WHEN se utiliza integración directa, THE Sistema_Transcripcion SHALL capturar los canales de audio de cada participante por separado cuando la plataforma lo permita

### Requisito 5: Resúmenes Automáticos y Accionables

**Historia de Usuario:** Como usuario, quiero obtener un resumen de la reunión y una lista de tareas asignadas, para saber rápidamente qué se discutió y qué debo hacer.

#### Criterios de Aceptación

1. WHEN una transcripción está completa, THE Sistema_Transcripcion SHALL generar un resumen automático de los temas principales discutidos
2. WHEN una transcripción está completa, THE Sistema_Transcripcion SHALL extraer accionables (tareas y compromisos) del contenido de la reunión
3. THE Sistema_Transcripcion SHALL asignar cada accionable al hablante que lo asumió o al que le fue asignado durante la reunión
4. WHEN un accionable es extraído, THE Sistema_Transcripcion SHALL permitir al usuario agregar un recordatorio en Google Calendar, Microsoft Teams Calendar u otro calendario según elección del usuario
5. IF el Sistema_Transcripcion no puede determinar a qué hablante corresponde un accionable, THEN THE Sistema_Transcripcion SHALL marcar el accionable como "Sin asignar" para revisión manual

### Requisito 6: Generación de Actas Formales

**Historia de Usuario:** Como usuario, quiero generar actas formales de las reuniones, para tener documentación oficial de lo discutido y acordado.

#### Criterios de Aceptación

1. WHEN el usuario solicita un acta formal, THE Sistema_Transcripcion SHALL generar un documento estructurado con: asistentes (hablantes identificados), temas tratados, decisiones tomadas y accionables
2. THE Sistema_Transcripcion SHALL generar el acta formal en el mismo idioma detectado en la transcripción
3. WHEN el acta formal es generada, THE Sistema_Transcripcion SHALL permitir al usuario revisar y editar el acta antes de finalizarla

### Requisito 7: Búsqueda en Transcripciones

**Historia de Usuario:** Como usuario, quiero buscar dentro de mis transcripciones, para encontrar rápidamente lo que se dijo en reuniones pasadas.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL permitir búsqueda de texto completo dentro de todas las transcripciones accesibles por el usuario
2. WHEN el usuario realiza una búsqueda, THE Sistema_Transcripcion SHALL mostrar los resultados con el contexto del fragmento encontrado, el hablante y la fecha de la reunión
3. THE Sistema_Transcripcion SHALL permitir filtrar búsquedas por rango de fechas, hablante e idioma

### Requisito 8: Edición de Transcripciones con Historial

**Historia de Usuario:** Como usuario, quiero poder editar las transcripciones para corregir errores, manteniendo un registro de quién hizo cada cambio.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL permitir al usuario editar el texto de cualquier transcripción que le pertenezca o que haya sido compartida con permisos de edición
2. WHEN un usuario edita una transcripción, THE Log_Edicion SHALL registrar el identificador del usuario que realizó la edición y la fecha y hora del cambio
3. THE Sistema_Transcripcion SHALL mostrar el historial de ediciones de cada transcripción a los usuarios con acceso a la misma

### Requisito 9: Gestión de Usuarios y Control de Acceso

**Historia de Usuario:** Como administrador, quiero gestionar quién tiene acceso a la aplicación, para controlar el uso dentro de la organización.

#### Criterios de Aceptación

1. THE Administrador SHALL poder otorgar y revocar acceso a la aplicación a usuarios de la organización
2. THE Sistema_Transcripcion SHALL asociar cada transcripción al usuario que la creó
3. THE Sistema_Transcripcion SHALL restringir la visualización de transcripciones únicamente al usuario creador, a menos que este las comparta explícitamente
4. WHEN un usuario comparte una transcripción, THE Sistema_Transcripcion SHALL permitir elegir entre permisos de solo lectura o lectura y edición

### Requisito 10: Exportación de Transcripciones

**Historia de Usuario:** Como usuario, quiero exportar mis transcripciones en formatos ligeros y procesables, para poder compartirlas externamente o procesarlas con otras herramientas de IA.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL permitir exportar transcripciones en formato VTT, TXT y Markdown
2. WHEN el usuario exporta una transcripción, THE Sistema_Transcripcion SHALL incluir las marcas de hablante y timestamps en el archivo exportado
3. THE Sistema_Transcripcion SHALL generar archivos de exportación que preserven la estructura de la transcripción original (hablantes, tiempos, texto)
4. FOR ALL transcripciones exportadas en formato VTT, al importar el archivo VTT de vuelta, THE Sistema_Transcripcion SHALL producir una transcripción equivalente a la original (propiedad round-trip)

### Requisito 11: Integración con Calendario para Auto-inicio

**Historia de Usuario:** Como usuario, quiero que el sistema se conecte a mi calendario y auto-inicie grabaciones cuando tengo reuniones programadas, para no olvidar grabar.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL permitir al usuario conectar su cuenta de Google Calendar, Microsoft Teams Calendar u otro servicio de calendario compatible
2. WHEN una reunión programada en el calendario del usuario está por comenzar, THE Sistema_Transcripcion SHALL notificar al usuario y ofrecer iniciar la grabación automáticamente
3. WHEN el usuario acepta el auto-inicio, THE Sistema_Transcripcion SHALL iniciar la grabación en el modo apropiado (integración directa si está disponible, o captura ambiental)
4. THE Sistema_Transcripcion SHALL asociar la transcripción resultante con el evento del calendario correspondiente (título de la reunión, participantes invitados)

### Requisito 12: Compatibilidad Multi-dispositivo

**Historia de Usuario:** Como usuario, quiero acceder al sistema desde cualquier dispositivo con navegador web, para tener flexibilidad en cómo y dónde uso la herramienta.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL funcionar como aplicación web responsive compatible con navegadores modernos en desktop, tablet y móvil
2. THE Sistema_Transcripcion SHALL soportar instalación como Progressive Web App (PWA) para permitir funcionalidad con pantalla bloqueada y acceso offline
3. WHEN un usuario accede desde un dispositivo diferente, THE Sistema_Transcripcion SHALL sincronizar todas las transcripciones y configuraciones del usuario

### Requisito 13: Dockerización del Sistema

**Historia de Usuario:** Como desarrollador/operador, quiero que todos los componentes del sistema estén correctamente dockerizados, para facilitar el despliegue, la portabilidad y la consistencia entre entornos.

#### Criterios de Aceptación

1. THE Sistema_Transcripcion SHALL proveer un Dockerfile para cada servicio del sistema (API Gateway, Motor_STT_Nube, NLPService, SearchService, CalendarService)
2. THE Sistema_Transcripcion SHALL proveer un archivo docker-compose.yml que orqueste todos los servicios, incluyendo la base de datos PostgreSQL y el almacenamiento de objetos
3. WHEN un desarrollador ejecuta `docker-compose up`, THE Sistema_Transcripcion SHALL levantar todos los servicios necesarios para un entorno de desarrollo funcional
4. THE Sistema_Transcripcion SHALL utilizar variables de entorno para toda configuración sensible (credenciales, API keys, URLs de servicios externos) sin valores hardcodeados en las imágenes
5. THE Sistema_Transcripcion SHALL incluir health checks en cada contenedor para verificar que el servicio está operativo
6. THE Sistema_Transcripcion SHALL proveer imágenes Docker optimizadas con multi-stage builds para minimizar el tamaño de las imágenes de producción