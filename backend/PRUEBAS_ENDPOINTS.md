# 🧪 Pruebas de Endpoints

## ✅ Resultados de la verificación extremo a extremo

Prueba realizada contra un **MongoDB real** (contenedor `mongo:7`, base `test_e2e_tmp` solo para la prueba) con
`NODE_ENV=production`, `JWT_SECRET` de 40+ caracteres y `MONGODB_URI` apuntando a ese contenedor.
Previamente se ejecutó `npm run seed:all` (5 niveles y 91 bloques).

| Área | Caso | Resultado |
|------|------|-----------|
| Arranque | Servidor sin Mongo disponible | `GET /api/health` → `200 {"status":"OK",…,"db":"connecting"}` |
| Arranque | Resto de `/api` sin Mongo | `503 {"success":false,"message":"Base de datos no disponible todavía…"}` |
| Arranque | Mongo arranca con el servidor ya en marcha | `db` pasa de `connecting` a `connected` (≈2 s) sin reiniciar |
| Arranque | Mongo se cae y vuelve con el servidor en marcha | `db:"connecting"` + 503 al instante; vuelve a `connected` solo (≈8 s) |
| Producción | Sin `JWT_SECRET` / secreto corto / secreto de ejemplo / sin `MONGODB_URI` | El proceso termina con `exit 1` y `❌ Configuración inválida: …` |
| Auth | `POST /api/auth/register` | `201 {message, token, user:{id,email,name}}` |
| Auth | Email duplicado (también en mayúsculas) | `400 {"message":"El usuario ya existe con este email"}` |
| Auth | Contraseña corta / email inválido / sin body | `400 {"errors":[{"msg","path",…}]}` (sin reflejar el valor enviado) |
| Auth | JSON mal formado / body > 10 kb | `400 {"message":"JSON no válido"}` / `413` |
| Auth | Inyección NoSQL (`{"$ne":null}`) en email/password | `400` (validación) |
| Auth | `POST /api/auth/login` correcto / contraseña mala / usuario inexistente | `200 {message, token, user}` / `401` / `401 "Credenciales inválidas"` |
| Auth | `GET /api/auth/me` con token / sin token / token inválido | `200 {user:{id,email,name,createdAt}}` / `401` / `401` |
| Niveles | `GET /api/levels`, `/levels/3`, `/levels/2/coins-count` | `200 {success:true,data…}` / `{coinsCount:10}` |
| Niveles | `/levels/99`, `/levels/abc` | `404` / `400` |
| Bloques | `GET /api/blocks` | `200`, array de 91 bloques con `name,x,y,z,Role,level` (mismos campos que `data/toy_car_blocks.json`) |
| Bloques | `?level=2`, `?role=finalPrize`, `/blocks/1` | `200` (11 / 3 / 69 bloques) |
| Bloques | `?level=abc` y `?role[$ne]=x` | `400` (antes: `500` y filtro NoSQL aceptado) — **corregido** |
| Scores | `POST /api/scores` sin token / negativo / texto | `401` / `400` / `400` |
| Scores | `POST /api/scores` con `gameTime: null` (lo que envía el frontend) | `201` — **corregido** (antes `400`, la puntuación nunca se guardaba) |
| Scores | `GET /api/scores`, `/scores/me`, `/scores/best` | `200 {success:true,data…}` |
| Rate limit | 100 intentos de login/registro por IP en 15 min | A partir del 101.º: `429 {"message":"Demasiados intentos…"}` con `RateLimit` y `Retry-After`; `health`/`levels` no se limitan; otra IP (`X-Forwarded-For`) no se ve afectada |
| Rate limit | 5 logins mientras `db` está `connecting` | `503` y el cupo queda intacto (`remaining=99`) — **corregido** (antes gastaban cupo) |
| CORS | Preflight desde un origen permitido | `204` con `Access-Control-Allow-Origin` |

## 📋 Comandos para Probar Manualmente

Sustituye `http://localhost:3000` por la URL de Render en producción.

### 0. Health (ver si la base de datos ya está conectada)
```bash
curl http://localhost:3000/api/health
# {"status":"OK","message":"Servidor funcionando correctamente","db":"connected"}
# db:"connecting" → el resto de /api devuelve 503 hasta que Mongo conecte
```

### 1. Registro y Login (obtener token)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test123", "name": "Test"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test123"}'
```

### 2. Perfil
```bash
TOKEN="tu_token_aqui"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me
```

### 3. Guardar Puntuación
```bash
TOKEN="tu_token_aqui"

curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "totalPoints": 200,
    "pointsByLevel": { "level1": 70, "level2": 80, "level3": 50 },
    "gameTime": null
  }'
```
`gameTime` es opcional (número ≥ 0 o `null`).

### 4. Ranking, mis puntuaciones y mejor puntuación
```bash
curl "http://localhost:3000/api/scores?limit=10"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/scores/me
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/scores/best
```

### 5. Niveles y bloques
```bash
curl http://localhost:3000/api/levels
curl http://localhost:3000/api/levels/1
curl http://localhost:3000/api/levels/1/coins-count
curl "http://localhost:3000/api/blocks?level=2"
```

### 6. Comprobar el rate limit
```bash
# Los intentos 101+ en 15 minutos devuelven 429
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" -d '{"email":"x@test.com","password":"mala1234"}'
done | sort | uniq -c
```

## 🎮 Pruebas desde el Frontend

1. **Inicia sesión** en el juego con un usuario real (el token se guarda solo en memoria; al refrescar la página hay que volver a iniciar sesión).
2. **Completa el juego**: al terminar, la puntuación se envía con `POST /api/scores`.
3. **Consola del navegador**: debe aparecer `✅ Puntuación guardada exitosamente`.
4. **Primer acceso con el backend dormido (Render free)**: el frontend espera a que `/api/health` devuelva `db: "connected"`; los `503` se traducen en el mensaje de "servidor despertando".

### Verificar en la Base de Datos

```bash
# Conectar a MongoDB (local con docker compose)
docker exec -it backend-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin multimedia_db

db.gamescores.find().pretty()
db.gamescores.find({ "user": ObjectId("<id_del_usuario>") }).pretty()
```

## 🔍 Debugging

1. **¿Backend corriendo?** `docker ps | grep backend` y `curl .../api/health`.
2. **Ver logs:** `docker logs backend-express --tail 50` (en Render: pestaña *Logs*).
3. **Todo devuelve 503:** `db` sigue en `connecting`; revisa `MONGODB_URI`, usuario/contraseña de Atlas y *Network Access* (0.0.0.0/0 para Render).
4. **El servicio no arranca en producción:** busca `❌ Configuración inválida` en los logs (falta `JWT_SECRET` o `MONGODB_URI`, o el secreto es corto/de ejemplo).
5. **429 inesperado:** el límite es por IP (100 / 15 min en login+registro); espera el tiempo indicado en `Retry-After`.
6. Script de apoyo: `test-scores.sh`.
