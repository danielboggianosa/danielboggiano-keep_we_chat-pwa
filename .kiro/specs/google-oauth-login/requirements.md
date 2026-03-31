# Documento de Requisitos — Google OAuth Login

## Introducción

Esta funcionalidad permite a los usuarios de KeepWeChat registrarse e iniciar sesión utilizando su cuenta de Google mediante OAuth 2.0 / OpenID Connect. El flujo de Google OAuth coexiste con el sistema actual de autenticación por email/contraseña, ofreciendo una alternativa más rápida y sin necesidad de gestionar credenciales adicionales. Cuando un usuario se autentica con Google, el sistema obtiene su perfil (email, nombre) y lo vincula a una cuenta local, emitiendo los mismos tokens JWT (access + refresh) que el flujo tradicional.

## Glosario

- **API_Gateway**: Servicio backend en Node.js/Express que gestiona la autenticación, autorización y enrutamiento de la API REST.
- **Auth_Screen**: Pantalla de autenticación del frontend (PWA) donde el usuario elige entre login con email/contraseña o con Google.
- **OAuth_Handler**: Componente del API_Gateway responsable de procesar el flujo OAuth 2.0 con Google (intercambio de código, verificación de tokens).
- **Google_Identity_Provider**: Servicio externo de Google que emite tokens de identidad (ID tokens) mediante OpenID Connect.
- **Cuenta_Vinculada**: Registro en la tabla `users` que tiene asociado un `google_id`, indicando que el usuario se autenticó al menos una vez con Google.
- **ID_Token**: Token JWT emitido por Google_Identity_Provider que contiene claims verificados del usuario (email, nombre, sub).
- **Authorization_Code**: Código temporal emitido por Google_Identity_Provider tras el consentimiento del usuario, intercambiable por tokens.

## Requisitos

### Requisito 1: Inicio del flujo OAuth desde el frontend

**Historia de usuario:** Como usuario de KeepWeChat, quiero poder hacer clic en un botón "Iniciar sesión con Google" en la pantalla de autenticación, para poder autenticarme sin crear una contraseña.

#### Criterios de aceptación

1. THE Auth_Screen SHALL mostrar un botón "Iniciar sesión con Google" visible tanto en el modo de login como en el modo de registro.
2. WHEN el usuario hace clic en el botón "Iniciar sesión con Google", THE Auth_Screen SHALL redirigir al usuario a la URL de autorización de Google_Identity_Provider con los parámetros `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile` y un parámetro `state` generado aleatoriamente.
3. THE Auth_Screen SHALL almacenar el valor de `state` en `sessionStorage` antes de la redirección para validarlo al retorno.

### Requisito 2: Callback y procesamiento del código de autorización

**Historia de usuario:** Como usuario de KeepWeChat, quiero que al volver de Google mi sesión se inicie automáticamente, para no tener que realizar pasos adicionales.

#### Criterios de aceptación

1. WHEN el navegador recibe la redirección de Google_Identity_Provider con un `code` y un `state` válidos, THE Auth_Screen SHALL enviar el `code` al endpoint `POST /api/auth/google` del API_Gateway.
2. WHEN el API_Gateway recibe el `code`, THE OAuth_Handler SHALL intercambiar el Authorization_Code por un ID_Token con Google_Identity_Provider utilizando el `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` configurados.
3. THE OAuth_Handler SHALL verificar la firma y los claims del ID_Token (issuer, audience, expiración) antes de confiar en los datos del usuario.
4. IF el intercambio del Authorization_Code falla o el ID_Token es inválido, THEN THE OAuth_Handler SHALL responder con un código HTTP 401 y un mensaje de error descriptivo.

### Requisito 3: Registro automático de nuevos usuarios OAuth

**Historia de usuario:** Como nuevo usuario, quiero que al autenticarme con Google por primera vez se cree mi cuenta automáticamente, para no tener que registrarme por separado.

#### Criterios de aceptación

1. WHEN el OAuth_Handler recibe un ID_Token válido y no existe un usuario con el email del token en la tabla `users`, THE OAuth_Handler SHALL crear un nuevo registro en `users` con el email, nombre del perfil de Google, un `google_id` correspondiente al claim `sub`, y `password_hash` nulo.
2. WHEN se crea un nuevo usuario mediante Google OAuth, THE OAuth_Handler SHALL asignar el rol `user` y el estado `is_active = true` al nuevo registro.
3. THE OAuth_Handler SHALL emitir un access token JWT (15 minutos) y un refresh token (7 días) con el mismo formato y mecanismo que el flujo de email/contraseña.

### Requisito 4: Login de usuarios existentes mediante Google OAuth

**Historia de usuario:** Como usuario existente, quiero poder iniciar sesión con Google si mi cuenta ya está vinculada, para acceder rápidamente sin contraseña.

#### Criterios de aceptación

1. WHEN el OAuth_Handler recibe un ID_Token válido y existe un usuario con el mismo email en la tabla `users` que ya tiene un `google_id` asociado, THE OAuth_Handler SHALL emitir tokens JWT (access + refresh) para ese usuario.
2. WHEN el OAuth_Handler recibe un ID_Token válido y existe un usuario con el mismo email pero sin `google_id` (cuenta creada por email/contraseña), THE OAuth_Handler SHALL vincular la cuenta existente asignando el `google_id` del claim `sub` y emitir tokens JWT.
3. IF el usuario encontrado por email tiene `is_active = false`, THEN THE OAuth_Handler SHALL responder con código HTTP 401 y el mensaje "La cuenta está desactivada".

### Requisito 5: Migración de base de datos

**Historia de usuario:** Como desarrollador, quiero que la tabla `users` soporte el campo `google_id` y que `password_hash` sea opcional, para almacenar usuarios que se autentican exclusivamente con Google.

#### Criterios de aceptación

1. THE API_Gateway SHALL ejecutar una migración que agregue la columna `google_id VARCHAR(255) UNIQUE` a la tabla `users`, permitiendo valores nulos.
2. THE API_Gateway SHALL ejecutar una migración que modifique la columna `password_hash` de la tabla `users` para permitir valores nulos.
3. THE API_Gateway SHALL agregar el valor `google_login` a la restricción `chk_auth_events_event_type` de la tabla `auth_events`.

### Requisito 6: Auditoría de eventos OAuth

**Historia de usuario:** Como administrador, quiero que los inicios de sesión con Google queden registrados en la tabla de auditoría, para tener trazabilidad completa de la autenticación.

#### Criterios de aceptación

1. WHEN un usuario inicia sesión exitosamente mediante Google OAuth, THE OAuth_Handler SHALL registrar un evento de tipo `google_login` en la tabla `auth_events` con el `user_id` y la dirección IP del cliente.
2. IF el flujo de Google OAuth falla (código inválido, token inválido, cuenta desactivada), THEN THE OAuth_Handler SHALL registrar un evento de tipo `login_failed` en la tabla `auth_events` con la dirección IP del cliente.

### Requisito 7: Seguridad del flujo OAuth

**Historia de usuario:** Como usuario, quiero que el flujo de autenticación con Google sea seguro contra ataques comunes, para proteger mi cuenta.

#### Criterios de aceptación

1. THE Auth_Screen SHALL validar que el parámetro `state` recibido en el callback coincida con el valor almacenado en `sessionStorage` antes de enviar el `code` al API_Gateway.
2. IF el parámetro `state` no coincide o está ausente, THEN THE Auth_Screen SHALL mostrar un mensaje de error y cancelar el flujo de autenticación.
3. THE OAuth_Handler SHALL intercambiar el Authorization_Code por tokens exclusivamente mediante una petición server-side (backend) a Google_Identity_Provider, sin exponer el `GOOGLE_CLIENT_SECRET` al frontend.
4. THE API_Gateway SHALL incluir la ruta `POST /api/auth/google` en la lista de rutas públicas del middleware JWT para permitir acceso sin token.
5. THE OAuth_Handler SHALL aceptar cada Authorization_Code una única vez, delegando la validación de uso único a Google_Identity_Provider.

### Requisito 8: Integración con el sistema de tokens existente

**Historia de usuario:** Como usuario autenticado con Google, quiero que mi sesión funcione exactamente igual que una sesión por email/contraseña, para tener una experiencia consistente.

#### Criterios de aceptación

1. THE OAuth_Handler SHALL generar access tokens y refresh tokens utilizando las mismas funciones (`generateAccessToken`, `generateRefreshToken`) y los mismos tiempos de expiración que el flujo de email/contraseña.
2. WHEN un usuario autenticado con Google realiza un refresh de token, THE API_Gateway SHALL procesar la solicitud con el mismo endpoint `POST /api/auth/refresh` y la misma lógica de rotación de tokens.
3. WHEN un usuario autenticado con Google cierra sesión, THE API_Gateway SHALL procesar la solicitud con el mismo endpoint `POST /api/auth/logout` e invalidar el refresh token.

### Requisito 9: Respuesta del endpoint OAuth

**Historia de usuario:** Como desarrollador del frontend, quiero que el endpoint de Google OAuth devuelva la misma estructura de respuesta que el login tradicional, para reutilizar la lógica existente del cliente.

#### Criterios de aceptación

1. WHEN la autenticación con Google es exitosa, THE OAuth_Handler SHALL responder con un objeto JSON que contenga `user` (con `id`, `email`, `name`, `role`), `accessToken` y `refreshToken`, con la misma estructura que `POST /api/auth/login`.
2. WHEN la autenticación con Google resulta en la creación de un nuevo usuario, THE OAuth_Handler SHALL responder con código HTTP 201.
3. WHEN la autenticación con Google resulta en el login de un usuario existente, THE OAuth_Handler SHALL responder con código HTTP 200.
