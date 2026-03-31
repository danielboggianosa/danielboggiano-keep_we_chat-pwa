# Tareas de Implementación — Google OAuth Login

## Tarea 1: Migración de base de datos
- [ ] 1.1 Crear archivo `services/api-gateway/migrations/013_add_google_oauth.sql` con: ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE; ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL; DROP y recrear constraint chk_auth_events_event_type incluyendo 'google_login'
- [ ] 1.2 Verificar que la migración se ejecuta correctamente revisando el archivo `migrate.ts` existente

## Tarea 2: Instalar dependencia google-auth-library en API Gateway
- [ ] 2.1 Agregar `google-auth-library` al `package.json` de `services/api-gateway/` y ejecutar install
- [ ] 2.2 Agregar variable `GOOGLE_OAUTH_REDIRECT_URI` al `.env` y `.env.example`

## Tarea 3: Implementar endpoint POST /api/auth/google en el backend
- [ ] 3.1 Crear instancia de `OAuth2Client` de `google-auth-library` en `services/api-gateway/src/routes/auth.ts` usando las variables de entorno `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
- [ ] 3.2 Implementar handler `POST /google` en el router de auth: recibir `code`, intercambiar por tokens con `oauthClient.getToken()`, verificar ID token con `oauthClient.verifyIdToken()`, extraer claims (sub, email, name)
- [ ] 3.3 Implementar lógica de búsqueda/creación/vinculación de usuario: buscar por email, si no existe crear con google_id y password_hash=null, si existe sin google_id vincular, si existe con google_id hacer login directo
- [ ] 3.4 Emitir access token y refresh token usando las funciones existentes `generateAccessToken` y `generateRefreshToken`, almacenar refresh token hash en DB
- [ ] 3.5 Registrar evento de auditoría: `google_login` en éxito, `login_failed` en fallo, con IP del cliente
- [ ] 3.6 Responder con la misma estructura que login/register: `{ user, accessToken, refreshToken }` con código 201 para nuevo usuario y 200 para existente
- [ ] 3.7 Manejar errores: code ausente → 400, intercambio/verificación fallida → 401, cuenta desactivada → 401 con mensaje específico

## Tarea 4: Agregar ruta OAuth a PUBLIC_PATHS del middleware JWT
- [ ] 4.1 Agregar `'/api/auth/google'` al array `PUBLIC_PATHS` en `services/api-gateway/src/middleware/jwt-auth.ts`

## Tarea 5: Agregar función apiGoogleLogin al API Client del frontend
- [ ] 5.1 Agregar función `apiGoogleLogin(code: string): Promise<AuthResponse>` en `src/ui/api-client.ts` que haga POST a `/api/auth/google`, llame a `setTokens()` y `notifyAuth(true)`

## Tarea 6: Integrar flujo OAuth en Auth Screen
- [ ] 6.1 Agregar botón "Iniciar sesión con Google" en `src/ui/auth-screen.ts`, visible en ambos modos (login y register)
- [ ] 6.2 Implementar función `startGoogleOAuth()`: generar state aleatorio con `crypto.randomUUID()`, guardarlo en `sessionStorage`, construir URL de autorización de Google con parámetros requeridos (client_id, redirect_uri, response_type=code, scope=openid email profile, state), y redirigir
- [ ] 6.3 Implementar detección de callback OAuth al cargar la pantalla: si URL contiene `code` y `state`, validar state contra sessionStorage, llamar a `apiGoogleLogin(code)`, limpiar URL y sessionStorage
- [ ] 6.4 Manejar error de state mismatch: mostrar mensaje de error en la UI y cancelar el flujo

## Tarea 7: Tests basados en propiedades
- [ ] 7.1 Escribir test de propiedad 1: Construcción correcta de URL OAuth — generar client_ids y redirect_uris aleatorios, verificar que la URL contiene todos los parámetros requeridos `// Feature: google-oauth-login, Property 1: Construcción correcta de la URL de autorización OAuth`
- [ ] 7.2 Escribir test de propiedad 2: Validación de state — generar pares de state aleatorios, verificar que el code se envía solo cuando coinciden `// Feature: google-oauth-login, Property 2: Persistencia y validación del parámetro state`
- [ ] 7.3 Escribir test de propiedad 5: Creación de usuario OAuth — generar perfiles Google aleatorios, verificar que el usuario creado tiene los campos correctos (google_id, null password_hash, role=user, is_active=true) `// Feature: google-oauth-login, Property 5: Creación correcta de usuario OAuth nuevo`
- [ ] 7.4 Escribir test de propiedad 9: Rechazo de cuenta desactivada — generar usuarios desactivados aleatorios, verificar respuesta 401 con mensaje correcto `// Feature: google-oauth-login, Property 9: Rechazo de cuenta desactivada`
- [ ] 7.5 Escribir test de propiedad 14: Código HTTP correcto — generar escenarios de nuevo usuario vs existente, verificar 201 vs 200 `// Feature: google-oauth-login, Property 14: Código HTTP correcto según tipo de operación`
- [ ] 7.6 Escribir test de propiedad 13: Estructura de respuesta — generar usuarios aleatorios, verificar que la respuesta contiene user (id, email, name, role), accessToken y refreshToken `// Feature: google-oauth-login, Property 13: Estructura de respuesta consistente con login tradicional`

## Tarea 8: Tests unitarios
- [ ] 8.1 Escribir tests unitarios para el endpoint POST /api/auth/google con mocks de google-auth-library: caso nuevo usuario (201), usuario existente con google_id (200), vinculación de cuenta (200 + google_id actualizado), code ausente (400), code inválido (401), cuenta desactivada (401)
- [ ] 8.2 Escribir tests unitarios para el flujo OAuth del frontend: botón visible en ambos modos, URL de autorización correcta, callback con state válido, callback con state inválido
