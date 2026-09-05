# 🧪 Pruebas de Endpoints de Puntuaciones

## ✅ Resultados de Pruebas del Backend

Todos los endpoints están funcionando correctamente:

1. ✅ **Health Check**: `/api/health` - OK
2. ✅ **Registro/Login**: `/api/auth/register` y `/api/auth/login` - OK
3. ✅ **Guardar Puntuación**: `POST /api/scores` - OK
4. ✅ **Ranking Global**: `GET /api/scores` - OK
5. ✅ **Puntuaciones del Usuario**: `GET /api/scores/me` - OK
6. ✅ **Mejor Puntuación**: `GET /api/scores/best` - OK

## 📋 Comandos para Probar Manualmente

### 1. Obtener Token (Login)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123"
  }'
```

### 2. Guardar Puntuación
```bash
TOKEN="tu_token_aqui"

curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "totalPoints": 200,
    "pointsByLevel": {
      "level1": 70,
      "level2": 80,
      "level3": 50
    },
    "gameTime": 1500.5
  }'
```

### 3. Obtener Ranking
```bash
curl http://localhost:3000/api/scores?limit=10
```

### 4. Obtener Mis Puntuaciones
```bash
TOKEN="tu_token_aqui"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scores/me
```

### 5. Obtener Mi Mejor Puntuación
```bash
TOKEN="tu_token_aqui"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scores/best
```

## 🎮 Pruebas desde el Frontend

### Pasos para Probar:

1. **Asegúrate de estar autenticado:**
   - Inicia sesión en el juego con un usuario válido
   - Verifica que el token se guarde en localStorage

2. **Completa el juego:**
   - Juega hasta completar el nivel 3
   - Al completar, la puntuación se guardará automáticamente

3. **Verifica en la consola del navegador:**
   - Deberías ver: `✅ Puntuación guardada en el backend`
   - Si hay error: `⚠️ No se pudo guardar la puntuación en el backend`

4. **Verifica en la pantalla final:**
   - Debería mostrar el ranking (top 5)
   - Debería mostrar confirmación si se guardó

### Verificar en la Base de Datos:

```bash
# Conectar a MongoDB
docker exec -it backend-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin multimedia_db

# Ver puntuaciones guardadas
db.gamescores.find().pretty()

# Ver puntuaciones de un usuario específico
db.gamescores.find({ "user": ObjectId("691519c59997bae9484acab7") }).pretty()
```

## 🔍 Debugging

Si hay problemas:

1. **Verificar que el backend esté corriendo:**
   ```bash
   docker ps | grep backend
   ```

2. **Ver logs del backend:**
   ```bash
   docker logs backend-express --tail 50
   ```

3. **Verificar token en localStorage:**
   - Abre DevTools → Application → Local Storage
   - Busca `auth_token`

4. **Probar endpoint manualmente:**
   - Usa el script `test-scores.sh` o los comandos curl arriba

