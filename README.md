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

## Despliegue

Tres servicios: **MongoDB Atlas** (base), **Render** (backend) y **Vercel** (frontend).

1. **MongoDB Atlas** — crear un cluster gratis, un usuario de base de datos y en
   *Network Access* permitir `0.0.0.0/0`. Copiar la cadena `mongodb+srv://...`.
2. **Poblar la base** (una sola vez, desde tu máquina):
   ```powershell
   cd backend
   $env:MONGODB_URI = "mongodb+srv://USUARIO:CLAVE@cluster.mongodb.net/multimedia_db"
   npm run seed:all
   ```
3. **Render** — *New → Blueprint* sobre este repo (usa [`render.yaml`](render.yaml)).
   Pide `MONGODB_URI` (la de Atlas) y `CORS_ORIGINS` (el dominio de Vercel; se puede
   completar después del paso 4). Anotar la URL, p. ej. `https://juego3d-backend.onrender.com`.
4. **Vercel** — *Add New → Project* sobre este repo (Vite se detecta solo). En
   *Environment Variables* definir `VITE_API_URL = https://juego3d-backend.onrender.com/api`
   y desplegar. Luego volver a Render y poner el dominio de Vercel en `CORS_ORIGINS`.

> El plan gratis de Render duerme el servicio tras inactividad: la primera petición
> tarda ~50 s y el login mostrará "servidor offline" hasta que despierte. Abrí
> `/api/health` un minuto antes de presentar.

### Peso de los modelos (`public/models/world 2` … `world 5`)

Los `.glb` de los niveles 2–5 están **comprimidos** (de 375 MB a ~70 MB; `dist` pasó
de ~531 MB a ~211 MB). Con [`@gltf-transform`](https://gltf-transform.dev/) se aplicó,
a cada archivo: `dedup` → texturas a **WebP** (calidad 80, máx. 2048 px) →
`quantize` → `reorder` → `meshopt` (nivel *medium*). La geometría no se simplifica:
la desviación máxima de la caja envolvente frente al original fue de 0,0033 %.

`src/Experience/Utils/Resources.js` registra `MeshoptDecoder` en el `GLTFLoader`; **es
necesario** para leer estos archivos. Los modelos nuevos que se exporten de Blender
deben pasar por el mismo proceso (o seguirán funcionando, solo que más pesados).
Los originales sin comprimir están en el historial de git (commit anterior al de la compresión).

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

### Historia y voz narradora

Eres **Alba**, la guardiana más joven de la Ciudadela Aurora. Los mutantes robaron los
cuatro Núcleos Madre y los esparcieron por cuatro mundos; cada nivel es un capítulo
(todo el texto vive en [`src/story.js`](src/story.js)).

**Aurora**, el espíritu de la Ciudadela, te guía con una voz narradora
([`src/Experience/Utils/Narrator.js`](src/Experience/Utils/Narrator.js)). No narra todo el
rato: habla en momentos clave (prólogo, inicio de cada capítulo, primer fragmento, mitad,
último fragmento, portal listo, la primera vez que te ven, Game Over y final) y sus
consejos enseñan la mecánica de la IA ("rompe su línea de visión… deja de correr: así
dejarán de oírte").

- Son **grabaciones con voz neuronal** (`es-MX-DaliaNeural`) guardadas como mp3 en
  [`public/audio/narration/`](public/audio/narration) (15 frases, ~650 KB). Suenan igual en
  cualquier navegador y no dependen de internet al jugar. Si una grabación no cargara,
  el juego usa la voz del navegador como respaldo.
- Cada frase sale también como **subtítulo**.
- Se silencia con el botón 🎙️ del menú ⚙️ (los subtítulos siguen); el ajuste se guarda en
  `localStorage`.
- Tiene prioridades (normal / alta / crítica) y una pausa entre frases para no saturar.

**Regenerar o cambiar las frases.** El texto vive en `NARRATION` (`src/story.js`) y los mp3 se
generan a partir de él con [`scripts/generate-narration.py`](scripts/generate-narration.py)
(usa el paquete `edge-tts` y necesita internet solo en ese momento; solo regenera lo que cambió):

```bash
python -m venv .tts-venv
.tts-venv/Scripts/python -m pip install edge-tts
.tts-venv/Scripts/python scripts/generate-narration.py
```

Para cambiar la voz, edita `VOICE` en el script (lista: `python -m edge_tts --list-voices`).

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

Login y registro comparten un layout minimalista ([`AuthLayout.jsx`](src/components/AuthLayout.jsx)):
marca arriba a la izquierda, titular serif centrado y una tarjeta redondeada con el
formulario. Tiene **tema claro y oscuro** con un botón arriba a la derecha
([`ThemeToggle.jsx`](src/components/ThemeToggle.jsx)):

- Los colores son variables CSS `--auth-*` en [`Auth.css`](src/components/Auth.css);
  el tema claro se activa con `<html data-theme="light">`.
- [`src/theme.js`](src/theme.js) decide el tema inicial: el elegido por la persona
  (guardado en `localStorage`) y, si no hay, el del sistema (`prefers-color-scheme`).
  Se aplica antes de renderizar React para evitar parpadeo.
- Los `input` sobrescriben `:-webkit-autofill` para que el autocompletado respete el tema.
- El tema solo afecta a estas pantallas; el HUD del juego no cambia.

---

## IA de enemigos (Yuka)

Los enemigos usan **IA de agentes para videojuegos**, implementada sobre la
librería **Yuka**. Cada mutante decide por sí solo, pero además **se comunican
entre ellos** y la IA se puede *ver* mientras se juega.

| Archivo | Papel |
|---|---|
| [`Enemy.js`](src/Experience/World/Enemy.js) | Agente individual: sentidos, máquina de estados, movimiento y animación |
| [`enemyArchetypes.js`](src/Experience/World/enemyArchetypes.js) | Cinco "personalidades" y qué mutantes aparecen en cada nivel |
| [`EnemyDirector.js`](src/Experience/World/EnemyDirector.js) | Lo que comparten: ruido del jugador, alarmas, memoria de grupo y flanqueo |

### Qué se ve en el juego

- **Tecla `I`** (o el botón 🧠 del menú): abre el panel *IA de los mutantes* con el
  estado de cada enemigo, su distancia, su velocidad y un registro de eventos
  ("Cazador dio la alarma: 2 aliados acuden", "Acechador intenta cortarte el paso").
- Sobre cada enemigo flota su **tipo** y un icono de lo que piensa:
  ❓ investiga · ❗ te persigue · 🎯 te rodea · 🔍 te busca.
- Con el panel abierto se dibuja en el suelo el **cono de visión** de cada uno
  (azul = tranquilo, ámbar = alerta, rojo = persiguiendo).
- Un indicador de **Ruido** en el HUD muestra cuánto se te oye.
- Cuando un enemigo da la alarma aparece un **anillo rojo** que se expande por el suelo.

### Modelo híbrido: Yuka decide, cannon-es mueve

Yuka calcula **qué hacer y hacia dónde ir**; el movimiento real lo ejecuta el cuerpo
físico de cannon-es, así que el enemigo choca de verdad con el escenario.

```
   sentidos (vista + oído)        EnemyDirector (ruido, alarmas, roles)
              │                              │
              ▼                              ▼
   YUKA.StateMachine ──► YUKA.Vehicle + steering behaviors
                         │  (produce una "velocidad deseada")
                         ▼
         se aplica como FUERZA al CANNON.Body del enemigo
                         │
                         ▼
         cannon-es resuelve colisiones con edificios y jugador
```

### 1. Sentidos

- **Vista:** un enemigo solo te ve si estás **dentro de su cono** (campo de visión
  y alcance propios de cada tipo) **y** un *raycast* no choca antes con un edificio.
  Por la espalda no te ve, salvo que estés muy cerca (zona de proximidad).
- **Oído:** depende del **ruido que haces**. Quieto ≈ 8 m, caminando ≈ 22 m,
  corriendo con Shift o saltando ≈ 70 m. Cada tipo oye mejor o peor
  (el Bruto oye ×1.6). Si te oye sin verte, va a **investigar** el lugar del ruido.
- La percepción se calcula cada 120 ms, no cada frame (rendimiento).

### 2. Cerebro: máquina de estados (`YUKA.StateMachine`)

```
            ┌────────(oye ruido)────────┐
            ▼                           │
PATROL ──▶ INVESTIGATE ──(te ve)──▶ CHASE ◀──▶ FLANK
  ▲            │                       │   (rodea al jugador)
  │            ▼                  (te pierde)
  └──(4 s)── SEARCH ◀──────────────────┘
```

| Estado | Conducta de Yuka | Comportamiento |
|--------|------------------|----------------|
| **PATROL** | `WanderBehavior` + `ArriveBehavior` | Deambula cerca de su zona (el Guardián custodia un fragmento) |
| **INVESTIGATE** | `ArriveBehavior` | Va al punto donde oyó el ruido o donde un aliado dio la alarma |
| **CHASE** | `PursuitBehavior` | Te persigue **prediciendo** hacia dónde vas, no hacia donde estás |
| **FLANK** | `ArriveBehavior` | Se adelanta por un lateral para cortarte el paso |
| **SEARCH** | `ArriveBehavior` | Va a tu última posición conocida y mira alrededor antes de rendirse |

Además todos usan `ObstacleAvoidanceBehavior` (esquivan edificios) y se separan
entre sí para no amontonarse.

### 3. Interacción entre enemigos (`EnemyDirector`)

1. **Alarma:** los tipos "gritones" (Cazador, Guardián) avisan a los aliados a menos
   de 90 m, que acuden a investigar.
2. **Memoria compartida:** si un aliado te ve, los demás saben dónde estás durante
   2,5 s aunque no te vean.
3. **Flanqueo:** si varios te persiguen, el más cercano va de frente y los demás
   se reparten a izquierda y derecha para cortarte la huida.
4. **Ruido del jugador:** el director lo calcula y es el que "oyen" todos.

### 4. Cinco personalidades (`enemyArchetypes.js`)

Cada modelo 3D tiene un tipo propio, con su velocidad, campo de visión, oído y ritmo
de paso:

| Tipo | Modelo | Rasgo |
|---|---|---|
| **Cazador** | Fast Run | Muy rápido, da la alarma |
| **Bruto** | Mutant Walking | Lento pero oye muy bien |
| **Acechador** | Walk | Te rodea (flanquea) |
| **Errante** | Walking | Patrulla un área amplia, campo de visión ancho |
| **Guardián** | Wheelbarrow Walk | Custodia un fragmento y da la alarma |

La animación está **sincronizada con la velocidad real**: el `timeScale` del clip se
calcula como `velocidad medida / velocidad de paso del tipo`, así los pies no
patinan (un mutante lento ya no "corre" sin avanzar).

### 5. Esquive de obstáculos

`YUKA.ObstacleAvoidanceBehavior` con una lista de obstáculos que se **reconstruye
cada 500 ms** a partir de los cuerpos físicos estáticos del mundo (se descartan el
piso gigante y los cuerpos dinámicos).

### Diseño defensivo

- **`delta` acotado a 0.1 s** — si la pestaña estuvo en 2.º plano, al volver no
  llega un `delta` gigante que dispare la simulación.
- **`try/catch` alrededor de Yuka** — si algo fallara, cae a persecución directa
  en línea recta.
- **Sin fugas al reintentar:** `remove()` desregistra al enemigo del director y libera
  sus sprites y su cono; la geometría del modelo se comparte y no se libera.

### Cómo se probó

Con el juego en marcha se colocó al jugador y a los enemigos desde la consola y se
comprobó cada comportamiento:

- **Vista:** de frente a 60 m → CHASE; por la espalda a 60 m en silencio → PATROL;
  por la espalda a 8 m → CHASE (proximidad).
- **Oído:** andar a 30 m no despierta al enemigo; andar a 22 m o correr a 60 m →
  PATROL → INVESTIGATE → CHASE.
- **Alarma:** el Cazador que te ve avisa y el Bruto aliado pasa a CHASE.
- **Flanqueo:** con tres perseguidores, uno va de frente y los otros dos rodean por
  lados opuestos.
- **Animación:** `timeScale` ≈ velocidad medida / velocidad de paso (p. ej. 4,7 m/s
  con paso 3,6 → ×1,3).
- **Game Over y reintentar:** se limpian enemigos, sprites y director sin errores.

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
| **UI login/registro** | Layout común, tema claro/oscuro con variables CSS, fix de `:-webkit-autofill`. | `src/components/Auth.css`, `AuthLayout.jsx`, `src/theme.js` |
| **Backend** | Express + MongoDB + JWT, contenedores con Docker Compose. Fallback offline con puerta trasera. | [`backend/`](backend/) |

---

## Notas conocidas

- El bloque `wallrocks_lev2` del nivel 2 (`public/data/toy_car_blocks_nivel2.json`)
  apunta a un `.glb` que no existe en el repo: ese bloque no se dibuja y la consola
  avisa "Modelo no encontrado". El nivel funciona igual.
- El nivel 1 está fuera del juego: sus modelos no están y el juego arranca en el nivel 2.
- Los 5 modelos de enemigos (`public/models/enemigos/*.fbx`, ~88 MB) siguen sin
  comprimir: son FBX y `gltf-transform` solo trabaja con glTF.
- El bucle de `requestAnimationFrame` se pausa cuando la pestaña pierde el foco; al
  volver, el `delta` acotado evita comportamientos raros en la física y la IA.
