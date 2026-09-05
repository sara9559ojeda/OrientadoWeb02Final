# Juego 3D Web — Multinivel con IA de enemigos

Juego 3D de navegador: recorrés cada nivel recogiendo monedas y esquivando enemigos
con inteligencia artificial hasta llegar al portal que te lleva al siguiente nivel.

Proyecto académico de **Programación Web / Multimedia**. Integra frontend 3D,
backend REST con base de datos, IA de agentes para los enemigos y varias
optimizaciones de rendimiento del hilo principal.

---

## Stack tecnológico

### Frontend
| Área | Tecnología |
|------|-----------|
| Render 3D | [Three.js](https://threejs.org/) |
| Física | [cannon-es](https://pmndrs.github.io/cannon-es/) |
| IA de enemigos | [Yuka](https://mugen87.github.io/yuka/) |
| UI de login / HUD | React 19 |
| Animación de menús | GSAP |
| Audio | Howler |
| Multijugador (sockets) | socket.io-client |
| Build / dev server | Vite 6 |

### Backend
| Área | Tecnología |
|------|-----------|
| Servidor | Express.js |
| Base de datos | MongoDB + Mongoose |
| Autenticación | JWT + bcrypt |
| Infraestructura | Docker Compose |

El backend está en [`backend/`](backend/).

---

## Cómo ejecutar

### 1. Backend + base de datos (con Docker)

```bash
cd backend
docker compose up -d --build                     # levanta MongoDB + API
docker compose exec backend npm run seed:all     # carga niveles y bloques
```

Verificar:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/levels
```

### 2. Frontend

Desde la raíz del repo, en otra terminal:

```bash
npm install
npm run dev
```

Abre **http://localhost:5173**. Apunta por defecto a `http://localhost:3000/api`.

### Sin Docker / sin backend

El juego funciona igual en **modo offline**: en la pantalla de login usá
`admin@admin.com` / `secret`. El backend queda "no disponible" y se genera un token
local. Los niveles y monedas usan valores por defecto.

---

## Autenticación

- **Con backend:** registrás una cuenta desde el botón *Registrarse* (email +
  contraseña de 6+ caracteres) → recibís un **JWT real** firmado con `JWT_SECRET`.
- **Sin backend:** puerta trasera `admin@admin.com` / `secret` (solo funciona
  cuando el backend NO responde; genera un token local codificado en base64).
- **El token vive solo en memoria** ([`src/services/authService.js`](src/services/authService.js)):
  no se escribe en `localStorage`. Al **refrescar la página** el módulo se reinicia,
  el token se pierde y volvés a la pantalla de login. Al arrancar también se borra
  cualquier `auth_token` viejo que hubiera quedado guardado.
- La sesión la mantiene [`AuthContext`](src/context/AuthContext.jsx) (React), que
  valida el token al inicio y cada 5 minutos.

Ver [`README_AUTH.md`](README_AUTH.md) para el detalle del flujo.

---

## El juego

### Objetivo

En cada nivel: recoger todas las monedas sin que te atrape un enemigo. Al
completarlas aparece un **portal**; caminá hasta él para pasar al siguiente nivel.

### Niveles

El juego arranca directamente en el **segundo nivel** (`initializeWorld()` llama a
`startLevel2(true)` al terminar de montar la escena). El primer nivel quedó fuera
del flujo porque sus modelos 3D no están en el repo; el código sigue ahí pero
desconectado. Progresión: **2 → 3 → 4 → 5 → pantalla final**.

| # interno | Nombre en la interfaz | Ambiente | Enemigos |
|-----------|----------------------|----------|----------|
| 2 | **Murallas Antiguas** | Medieval, día | 3 |
| 3 | **La Noche Encantada** | Nocturno / fantasía | 5 |
| 4 | **Bosque de Ajedrez** | Bosque / campo | 7 |
| 5 | **Cumbre Helada** | Nieve | 10 |

Los nombres están centralizados en la constante `LEVEL_NAMES` de
[`src/Experience/World/World.js`](src/Experience/World/World.js) — se cambian ahí y
se actualizan en todo el HUD, botones y carteles de transición. Reiniciar tras un
*game over* recarga la página y arranca limpio en el nivel 2.

### Controles

| Tecla | Acción |
|-------|--------|
| Flechas ← ↑ → ↓ | Mover |
| Shift | Correr |
| Espacio | Saltar |
| Botón "3ra Persona" / "Vista Global" | Cambiar cámara |

En móvil hay un joystick en pantalla ([`src/controls/MobileControls.js`](src/controls/MobileControls.js)).

### Interfaz de login / registro

Login y registro comparten el **mismo tema** (oscuro/púrpura, fuentes Rajdhani +
Orbitron). Cada CSS está **aislado** bajo su contenedor (`.login-container` /
`.register-container`) para que no se pisen las clases comunes. Los `input`
incluyen un override de `:-webkit-autofill` para que el autocompletado de Chrome
no rompa el tema oscuro.

---

## IA de enemigos (Yuka)

Los enemigos usan **IA de agentes para videojuegos**, implementada sobre la
librería **Yuka** — [`src/Experience/World/Enemy.js`](src/Experience/World/Enemy.js).

### Modelo híbrido: Yuka decide, cannon-es mueve

El punto clave del diseño: Yuka calcula **qué hacer y hacia dónde ir**, pero el
movimiento real lo ejecuta el cuerpo físico de cannon-es.

```
                 percepción (raycast)
                        │
                        ▼
  YUKA.StateMachine ──► YUKA.Vehicle + steering behaviors
                        │  (produce una "velocidad deseada")
                        ▼
        se aplica como FUERZA al CANNON.Body del enemigo
                        │
                        ▼
        cannon-es resuelve colisiones con edificios y jugador
```

Así el enemigo choca de verdad con el escenario (no lo atraviesa), y a la vez
tiene comportamiento de alto nivel. Cada frame:

1. Se sincroniza `vehicle.position` desde el cuerpo físico.
2. Se actualiza la percepción (con *throttle* de 120 ms).
3. `stateMachine.update()` + `vehicle.update(dt)` → Yuka calcula `vehicle.velocity`.
4. Esa velocidad se convierte en `body.applyForce(...)`, con tope de velocidad.
5. Se rota el modelo y se sincroniza la parte visual.

### 1. Cerebro: máquina de estados (`YUKA.StateMachine`)

```
PATROL ──(te ve)──▶ CHASE ──(te pierde)──▶ SEARCH ──(4 s)──▶ PATROL
                      ▲                        │
                      └──────(te vuelve a ver)─┘
```

| Estado | Conducta de Yuka | Comportamiento |
|--------|------------------|----------------|
| **PatrolState** | `WanderBehavior` + `ArriveBehavior` (correa al spawn) | Deambula alrededor de donde apareció |
| **ChaseState** | `ArriveBehavior` (deceleración 1 = agresivo) | Va hacia tu posición actual |
| **SearchState** | `ArriveBehavior` hacia la última posición conocida | Busca ~4 s y vuelve a patrullar |

### 2. Sentidos: percepción

- **Vista:** un *raycast* en el mundo físico (`world.raycastClosest`) del enemigo
  hacia el jugador. Si choca con un edificio (cuerpo con `mass === 0`) antes de
  llegar → no te ve. Alcance: 300 unidades.
- **Oído:** a menos de 14 unidades te detecta aunque haya un muro en medio.
- Los rayos se lanzan cada 120 ms, no cada frame (rendimiento).

### 3. Esquive de obstáculos

`YUKA.ObstacleAvoidanceBehavior` con una lista de obstáculos que se **reconstruye
cada 500 ms** a partir de los cuerpos físicos estáticos del mundo (se descartan el
piso gigante y los cuerpos dinámicos). Yuka proyecta una caja de detección
proporcional a la velocidad y desvía al enemigo alrededor de los edificios.

### Configuración

Todo lo ajustable está en el objeto `this.ai` del constructor:

```js
this.ai = {
  detectionRange: 300,     // rango de visión (con línea de vista)
  hearingRange: 14,        // rango de "oído" (atraviesa muros)
  loseSightGrace: 4000,    // ms buscando tras perder de vista (ms)
  patrolRadius: 16,        // radio de patrulla alrededor del spawn
  perceptionMs: 120,       // cada cuánto se lanza el raycast de visión
  obstacleRefreshMs: 500,  // cada cuánto se recalcula la lista de obstáculos
}
```

Se puede sobrescribir por enemigo pasando `{ speed, ai: {...} }` como 4.º
argumento del constructor.

### Diseño defensivo

- **`delta` acotado a 0.1 s** — si la pestaña estuvo en 2.º plano, al volver no
  llega un `delta` gigante que dispare la simulación.
- **`try/catch` alrededor de Yuka** — si algo fallara, cae a persecución directa
  en línea recta.
- **API pública intacta** (`constructor`, `setTarget`, `checkCollisionWithTarget`,
  `remove`) → `World.js` no necesitó ningún cambio para adoptar Yuka.

### Cómo se probó

El bucle `requestAnimationFrame` se congela cuando la pestaña no está en foco, así
que la IA se validó con un **banco de pruebas manual**: se pausa el tiempo, se
fija `time.delta`, y se llama a `enemy.update()` + `world.step()` en bucle. Se
verificó:

- Transiciones PATROL → CHASE → SEARCH → PATROL con los tiempos esperados.
- Línea de visión bloqueada por un muro de prueba.
- Esquive de un obstáculo hasta alcanzar al objetivo (sin quedar trabado, sin `NaN`).

---

## Rendimiento del hilo principal: Event Loop y Web Workers

El navegador ejecuta JavaScript, actualiza el DOM, atiende clics y pinta la
interfaz **en un solo hilo** (*Main Thread*). Si una tarea de JS tarda mucho, todo
lo demás se congela. La métrica de Google que mide esto es el **INP** (*Interaction
to Next Paint*).

### Web Workers — evaluado, **no adoptado**

Un *Web Worker* ejecuta JS en un hilo aparte. Suena ideal para la física o la IA,
pero **no encaja en este juego**:

| Trabajo pesado | ¿Worker? | Motivo |
|---|---|---|
| **Física** (`world.step()` cada frame) | ❌ | `body.position` se lee de forma **sincrónica** en ~6 archivos (World, Enemy, Robot, cámara, colisiones de monedas). Moverlo a un worker obliga a reescribir todos esos accesos con mensajes asíncronos o `SharedArrayBuffer`. Refactor enorme y de alto riesgo. |
| **Renderizado** (Three.js / WebGL) | ❌ | El contexto WebGL vive en el hilo principal. |
| **IA de enemigos** (Yuka) | ⚠️ | Necesita la posición del jugador y el mundo físico cada frame → mismo problema de sincronización. Además 5 enemigos no son cuello de botella. |
| **Extracción de geometría de colisión** (`createTrimeshShapeFromModel`) | ✅ (en teoría) | Es puro cálculo de vértices y su salida son `Float32Array` (transferibles). Es el único candidato real, pero casi no se ejecuta porque los `.glb` no cargan. |

La regla "**un Worker no puede acceder al DOM**" es justo lo que lo descarta: los
objetos pesados del juego (mallas de Three, cuerpos de cannon) son objetos del
hilo principal y no cruzan la frontera del worker sin serializarse.

### Event Loop: carga por lotes (*chunked processing*) — **adoptado**

En vez de un worker, se ataca el mismo objetivo (no bloquear el hilo principal
durante la carga) usando el **Event Loop**. La carga de cada nivel procesa 100+
bloques (edificios, monedas); hacerlo de golpe congela la interfaz.

[`src/loaders/ToyCarLoader.js`](src/loaders/ToyCarLoader.js) lo procesa por lotes:

```js
async _processInChunks(items, fn, chunkSize = 12) {
  for (let i = 0; i < items.length; i++) {
    fn(items[i], i)
    if ((i + 1) % chunkSize === 0) await this._yieldToEventLoop()
  }
}

_yieldToEventLoop() {
  // encola la continuación como una TASK nueva → el Event Loop puede
  // pintar y atender clics/teclas antes de seguir
  return new Promise(resolve => setTimeout(resolve, 0))
}
```

- `setTimeout(0)` encola la continuación en la **Task Queue**. Entre task y task,
  el Event Loop pinta y atiende eventos.
- Se usa una **Task**, no una **Microtask** (`Promise.then` / `queueMicrotask`): las
  microtasks se vacían *antes* del siguiente pintado, así que no cederían el hilo.
- Aplicado en `loadFromAPI()` (bloques del backend) y `loadBuildingsByLevel()`
  (monedas + edificios de cada nivel).

El *game loop* (`Experience.update`) ya usaba bien el Event Loop vía
`requestAnimationFrame` — no hizo falta tocarlo.

### Cómo medirlo

```js
// Pegar en la consola (F12) ANTES de cargar/cambiar de nivel
const obs = new PerformanceObserver(l =>
  l.getEntries().forEach(e => console.log(`⚠️ Long task: ${Math.round(e.duration)} ms`)));
obs.observe({ type: 'longtask', buffered: true });
```

Una *long task* es cualquier bloqueo del hilo principal ≥ 50 ms. También se ve en
**DevTools → Performance**: con los lotes, la carga aparece como varios bloques
cortos con huecos (los `await`), en vez de un único bloque macizo.

> Nota: como los modelos `.glb` no están en el repo, hoy la carga es liviana y
> puede no generar *long tasks* medibles. El patrón queda montado y se nota cuando
> los modelos reales cargan (60+ clones de edificios + física por nivel).

---

## Arquitectura del frontend

Patrón **"Experience"** (un singleton que orquesta todo):

```
src/
├── main.jsx                    Punto de entrada React
├── App.jsx                     Login / Register (React) → monta el juego
├── Experience/
│   ├── Experience.js           Orquestador: loop, cámara, render, física
│   ├── Camera.js  Renderer.js
│   ├── Utils/
│   │   ├── Time.js             delta / elapsed por frame
│   │   ├── Resources.js        carga de modelos (GLTF / FBX)
│   │   ├── Physics.js          mundo cannon-es + materiales de contacto
│   │   ├── PhysicsShapeFactory.js  colliders box / trimesh desde un modelo
│   │   ├── Raycaster.js  KeyboardControls.js  Sizes.js ...
│   └── World/
│       ├── World.js            Niveles, monedas, portal, HUD, spawn de enemigos, LEVEL_NAMES
│       ├── Robot.js            Personaje del jugador
│       ├── Enemy.js            IA de enemigos (Yuka)
│       ├── ThirdPersonCamera.js
│       ├── Portal.js  Coins.js  Prize.js  Floor.js  Environment.js
├── loaders/ToyCarLoader.js     Carga de escenario desde JSON / API (por lotes)
├── services/                   authService (token en memoria), levelsService, scoresService
├── context/AuthContext.jsx     Estado de sesión (React)
├── controls/                   MobileControls, CircularMenu
└── config/api.js               URL base y endpoints del backend
```

**Bucle de juego:** `Experience.update(delta)` corre con `requestAnimationFrame` y
en cada frame hace: cámara → `world.update()` (jugador, enemigos, monedas, portal)
→ `renderer.update()` → `physics.update()`.

**Orden física ↔ IA:** `world.update()` (y por lo tanto `enemy.update()`) corre
**antes** de `physics.update()`. El enemigo lee la posición post-colisión del
frame anterior, decide con Yuka, y escribe la fuerza; después el `world.step()`
la integra.

---

## Endpoints del backend

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Registro | |
| POST | `/api/auth/login` | Login (devuelve JWT) | |
| GET  | `/api/auth/me` | Perfil | ✅ |
| GET  | `/api/levels` | Todos los niveles | |
| GET  | `/api/levels/:id/coins-count` | Monedas de un nivel | |
| GET  | `/api/blocks` | Bloques del escenario | |
| POST | `/api/scores` | Guardar puntuación | ✅ |
| GET  | `/api/scores` | Ranking global | |

Más detalle en [`backend/README.md`](backend/README.md) y
[`backend/INICIALIZACION_BD.md`](backend/INICIALIZACION_BD.md).

---

## Scripts

### Frontend
```bash
npm run dev       # servidor de desarrollo (localhost:5173)
npm run build     # build de producción a dist/
npm run preview   # previsualizar el build
npm run lint      # ESLint
```

### Backend
```bash
npm run dev              # servidor con --watch
npm run seed:all         # cargar niveles + bloques en MongoDB
docker compose up -d     # MongoDB + API en contenedores
```

---

## Resumen técnico

| Tema | Decisión | Dónde |
|------|----------|-------|
| **IA de enemigos** | Yuka (`StateMachine` + `ArriveBehavior` + `WanderBehavior` + `ObstacleAvoidanceBehavior`). Modelo híbrido: Yuka calcula la velocidad deseada, se aplica como fuerza a cannon-es para conservar las colisiones reales. | [`Enemy.js`](src/Experience/World/Enemy.js) |
| **Percepción** | Raycast en el mundo físico (`world.raycastClosest`) para línea de visión + rango de "oído". Throttle de 120 ms. | [`Enemy.js`](src/Experience/World/Enemy.js) |
| **Web Workers** | Evaluados y **descartados**: física y render están acoplados sincrónicamente al hilo principal; mover cannon-es a un worker sería un refactor de alto riesgo. | — |
| **Event Loop** | Carga de niveles **por lotes** (`_processInChunks` + `_yieldToEventLoop` con `setTimeout(0)`) para no bloquear el hilo principal ni empeorar el INP. | [`ToyCarLoader.js`](src/loaders/ToyCarLoader.js) |
| **Game loop** | `requestAnimationFrame` vía `Experience.update`. `delta` acotado a 0.1 s. | [`Experience.js`](src/Experience/Experience.js) |
| **Nivel 1** | Fuera del flujo (modelos ausentes). El juego arranca en el nivel 2. | [`World.js`](src/Experience/World/World.js) |
| **Nombres de nivel** | Constante `LEVEL_NAMES` centralizada; se refleja en HUD, botones y carteles. | [`World.js`](src/Experience/World/World.js) |
| **Sesión** | Token **solo en memoria**; refrescar la página cierra la sesión. | [`authService.js`](src/services/authService.js) |
| **UI login/registro** | Tema unificado, CSS aislado por contenedor, fix de `:-webkit-autofill`. | `src/components/Login.css`, `Register.css` |
| **Backend** | Express + MongoDB + JWT, contenedores con Docker Compose. Fallback offline con puerta trasera. | [`backend/`](backend/) |

---

## Notas conocidas

- Muchos modelos `.glb` de edificios no están incluidos en el repo → los niveles se
  ven con el piso y los personajes pero sin edificios. El juego funciona igual.
- El bucle de `requestAnimationFrame` se pausa cuando la pestaña pierde el foco; al
  volver, el `delta` acotado evita comportamientos raros en la física y la IA.
