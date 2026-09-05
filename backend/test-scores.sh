#!/bin/bash

# Script para probar los endpoints de puntuaciones
# Uso: ./test-scores.sh

API_URL="http://localhost:3000/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Probando endpoints de puntuaciones...${NC}\n"

# 1. Verificar health
echo -e "${YELLOW}1. Verificando health del servidor...${NC}"
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH"
echo ""

# 2. Registrar un usuario de prueba (si no existe)
echo -e "${YELLOW}2. Registrando usuario de prueba...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123",
    "name": "Usuario Test"
  }')

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token' 2>/dev/null)

# Si el registro falla (usuario ya existe), intentar login
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Usuario ya existe, intentando login...${NC}"
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@test.com",
      "password": "test123"
    }')
  
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ No se pudo obtener token. Verifica que el backend esté corriendo.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Token obtenido: ${TOKEN:0:20}...${NC}\n"

# 3. Guardar una puntuación
echo -e "${YELLOW}3. Guardando puntuación de prueba...${NC}"
SAVE_SCORE_RESPONSE=$(curl -s -X POST "$API_URL/scores" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "totalPoints": 150,
    "pointsByLevel": {
      "level1": 50,
      "level2": 60,
      "level3": 40
    },
    "gameTime": 1200.5
  }')

echo "$SAVE_SCORE_RESPONSE" | jq '.' 2>/dev/null || echo "$SAVE_SCORE_RESPONSE"
echo ""

# 4. Obtener ranking global
echo -e "${YELLOW}4. Obteniendo ranking global (top 5)...${NC}"
RANKING_RESPONSE=$(curl -s "$API_URL/scores?limit=5")
echo "$RANKING_RESPONSE" | jq '.' 2>/dev/null || echo "$RANKING_RESPONSE"
echo ""

# 5. Obtener puntuaciones del usuario actual
echo -e "${YELLOW}5. Obteniendo puntuaciones del usuario actual...${NC}"
MY_SCORES_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/scores/me")
echo "$MY_SCORES_RESPONSE" | jq '.' 2>/dev/null || echo "$MY_SCORES_RESPONSE"
echo ""

# 6. Obtener mejor puntuación del usuario
echo -e "${YELLOW}6. Obteniendo mejor puntuación del usuario...${NC}"
BEST_SCORE_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/scores/best")
echo "$BEST_SCORE_RESPONSE" | jq '.' 2>/dev/null || echo "$BEST_SCORE_RESPONSE"
echo ""

echo -e "${GREEN}✅ Pruebas completadas!${NC}"

