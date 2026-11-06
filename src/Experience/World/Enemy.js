import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as YUKA from 'yuka'
import { archetypeFor } from './enemyArchetypes.js'

// ─────────────────────────────────────────────────────────────────────────
// IA con Yuka: máquina de estados + conductas de dirección (steering)
//
//   PATROL ──ve──────────────▶ CHASE ◀──────────────┐
//     │  ▲                      │  │ (aliados)       │ ve de nuevo
//     │  │                      │  ▼                 │
//     │  └── SEARCH ◀─pierde────┘ FLANK ──cerca──────┘
//     │          ▲
//     └─oye/alarma▶ INVESTIGATE ──llega──▶ SEARCH
//
// - Percepción: VISTA en un cono frente al enemigo (con raycast contra los edificios),
//   OÍDO según el ruido del jugador (correr se oye mucho más lejos que caminar) y
//   conocimiento compartido por el EnemyDirector.
// - Movimiento: Yuka calcula la velocidad deseada con ArriveBehavior, PursuitBehavior
//   (predice hacia dónde irás), WanderBehavior y ObstacleAvoidanceBehavior; esa intención
//   se aplica como fuerza a cannon-es, así los edificios siguen chocando de verdad.
// - Animación: la velocidad del clip sigue a la velocidad real del cuerpo (sin patinar).
// ─────────────────────────────────────────────────────────────────────────

export const STATE_LABELS = {
    PATROL: 'Patrullando',
    INVESTIGATE: 'Investigando',
    CHASE: 'Persiguiendo',
    FLANK: 'Flanqueando',
    SEARCH: 'Buscando',
}

const STATE_ICON = {
    PATROL: null,
    INVESTIGATE: '❓',
    CHASE: '❗',
    FLANK: '🎯',
    SEARCH: '🔍',
}

const STATE_COLOR = {
    PATROL: 0x8ab4ff,
    INVESTIGATE: 0xf2b765,
    SEARCH: 0xf2b765,
    CHASE: 0xff6b6b,
    FLANK: 0xff6b6b,
}

// ── Utilidades ────────────────────────────────────────────────────────────
const angleDiff = (a, b) => {
    let d = b - a
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return d
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Texturas de iconos compartidas entre enemigos (una por emoji)
const iconTextureCache = new Map()
function iconTexture(emoji) {
    if (iconTextureCache.has(emoji)) return iconTextureCache.get(emoji)
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, 64, 70)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    iconTextureCache.set(emoji, tex)
    return tex
}

function labelTexture(text) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.font = '600 30px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.strokeText(text, 128, 34)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
}

// ── Estados ───────────────────────────────────────────────────────────────
class PatrolState extends YUKA.State {
    enter(enemy) {
        enemy.onStateChange('PATROL', enemy.arch.patrol)
        enemy.wander.active = true
        enemy.arrive.active = false
    }
    execute(enemy) {
        if (enemy.sees) { enemy.stateMachine.changeTo('CHASE'); return }
        if (enemy.heardPos) { enemy.beginInvestigate(enemy.heardPos); return }

        // Correa: si se aleja de su zona de patrulla, vuelve hacia el centro
        const dist = enemy.vehicle.position.distanceTo(enemy.patrolCenter)
        if (dist > enemy.arch.patrolRadius) {
            enemy.arrive.target.copy(enemy.patrolCenter)
            enemy.arrive.active = true
        } else {
            enemy.arrive.active = false
        }
    }
    exit(enemy) {
        enemy.wander.active = false
        enemy.arrive.active = false
    }
}

class InvestigateState extends YUKA.State {
    enter(enemy) {
        enemy.onStateChange('INVESTIGATE', enemy.arch.investigate)
        enemy.arrive.active = true
        enemy.arrive.deceleration = 2
        enemy.arrive.target.copy(enemy.investigatePos)
        enemy.investigateUntil = enemy.now() + 9000
    }
    execute(enemy) {
        if (enemy.sees) { enemy.stateMachine.changeTo('CHASE'); return }

        // Si oye un ruido nuevo y lejano del destino actual, cambia de destino
        if (enemy.heardPos && enemy.heardPos.distanceTo(enemy.investigatePos) > 10) {
            enemy.investigatePos.copy(enemy.heardPos)
            enemy.arrive.target.copy(enemy.investigatePos)
        }

        const reached = enemy.vehicle.position.distanceTo(enemy.investigatePos) < 4
        if (reached || enemy.now() > enemy.investigateUntil) {
            enemy.lastKnownPos.copy(enemy.investigatePos)
            enemy.stateMachine.changeTo('SEARCH')
        }
    }
    exit(enemy) {
        enemy.arrive.active = false
    }
}

class ChaseState extends YUKA.State {
    enter(enemy) {
        enemy.onStateChange('CHASE', enemy.arch.chase)
        enemy.pursuit.active = true
        enemy.arrive.active = false
        enemy.lostSightAt = null
        enemy.announceChase()
    }
    execute(enemy) {
        if (enemy.tracksTarget()) {
            const p = enemy.readTargetPosition()
            enemy.lastKnownPos.copy(p)

            // Si hay aliados persiguiendo, este puede ser asignado a flanquear
            if (enemy.flankSide !== 0 && enemy.now() > enemy.flankCooldownUntil
                && enemy.distanceToTarget() > 40) {
                enemy.stateMachine.changeTo('FLANK')
            }
        } else {
            enemy.stateMachine.changeTo('SEARCH')
        }
    }
    exit(enemy) {
        enemy.pursuit.active = false
    }
}

class FlankState extends YUKA.State {
    enter(enemy) {
        enemy.onStateChange('FLANK', enemy.arch.flank)
        enemy.arrive.active = true
        enemy.arrive.deceleration = 1
        enemy.pursuit.active = false
    }
    execute(enemy) {
        if (!enemy.tracksTarget()) { enemy.stateMachine.changeTo('SEARCH'); return }

        // Punto de intercepción: delante del jugador y desplazado hacia un lado
        const p = enemy.director.playerProxy
        const vx = p.velocity.x, vz = p.velocity.z
        const sp = Math.hypot(vx, vz)
        let fx, fz
        if (sp > 1) { fx = vx / sp; fz = vz / sp } else {
            const ep = enemy.body.position
            fx = p.position.x - ep.x; fz = p.position.z - ep.z
            const l = Math.hypot(fx, fz) || 1
            fx /= l; fz /= l
        }
        const lead = 20 + sp * 1.2
        const side = 28 * enemy.flankSide
        enemy.arrive.target.set(
            p.position.x + fx * lead + -fz * side,
            p.position.y,
            p.position.z + fz * lead + fx * side,
        )
        enemy.lastKnownPos.copy(p.position)

        if (enemy.distanceToTarget() < 26 || enemy.flankSide === 0) {
            enemy.flankCooldownUntil = enemy.now() + 5000
            enemy.stateMachine.changeTo('CHASE')
        }
    }
    exit(enemy) {
        enemy.arrive.active = false
        enemy.arrive.deceleration = 3
    }
}

class SearchState extends YUKA.State {
    enter(enemy) {
        enemy.onStateChange('SEARCH', enemy.arch.investigate)
        enemy.arrive.active = true
        enemy.arrive.deceleration = 2
        enemy.arrive.target.copy(enemy.lastKnownPos)
        enemy.searchPhase = 'go'
        enemy.searchUntil = enemy.now() + 5000
    }
    execute(enemy) {
        if (enemy.sees) { enemy.stateMachine.changeTo('CHASE'); return }
        if (enemy.heardPos) { enemy.beginInvestigate(enemy.heardPos); return }

        const now = enemy.now()
        if (enemy.searchPhase === 'go') {
            const reached = enemy.vehicle.position.distanceTo(enemy.lastKnownPos) < 3
            if (reached || now > enemy.searchUntil) {
                // Llegó: se queda mirando a su alrededor un rato
                enemy.searchPhase = 'look'
                enemy.arrive.active = false
                enemy.lookBase = enemy.facing
                enemy.lookStart = now
                enemy.searchUntil = now + 3200
            }
        } else if (now > enemy.searchUntil) {
            enemy.stateMachine.changeTo('PATROL')
        }
    }
    exit(enemy) {
        enemy.arrive.active = false
        enemy.lookBase = null
    }
}

export default class Enemy {
    constructor(experience, modelResource, position, options = {}) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.physics = this.experience.physics
        this.modelResource = modelResource
        this.target = null // El personaje principal (robot)
        this.director = null // lo asigna EnemyDirector.register

        this.modelName = options.modelName || null
        this.arch = { ...archetypeFor(this.modelName), ...(options.archetype || {}) }
        this.label = this.arch.label
        this.id = options.id ?? Math.floor(Math.random() * 1e6)

        // Configuración técnica de la IA (se puede sobrescribir desde World.js)
        this.ai = {
            perceptionMs: 120,      // cada cuánto se lanza el rayo de visión
            obstacleRefreshMs: 500, // cada cuánto se recalcula la lista de obstáculos
            ...(options.ai || {}),
        }

        // Posiciones auxiliares (tipo Yuka para usarlas con las conductas)
        this.spawnPos = new YUKA.Vector3(position.x, position.y || 1, position.z)
        const c = options.patrolCenter || position
        this.patrolCenter = new YUKA.Vector3(c.x, c.y || 1, c.z)
        this.lastKnownPos = new YUKA.Vector3()
        this.investigatePos = new YUKA.Vector3()
        this._tmpVec = new YUKA.Vector3()

        // Percepción
        this._nextPerceptionAt = 0
        this._nextObstacleAt = 0
        this.sees = false
        this.heardPos = null
        this._heardVec = new YUKA.Vector3()
        this.lostSightAt = null
        this._rayResult = new CANNON.RaycastResult()
        this._rayFrom = new CANNON.Vec3()
        this._rayTo = new CANNON.Vec3()

        // Estado de comportamiento
        this.stateName = 'PATROL'
        this.currentSpeed = this.arch.patrol
        this.flankSide = 0
        this.flankCooldownUntil = 0
        this.shoutCooldownUntil = 0
        this.searchPhase = 'go'
        this.searchUntil = 0
        this.investigateUntil = 0
        this.lookBase = null
        this.lookStart = 0
        this.facing = Math.random() * Math.PI * 2
        this._animScale = 0.3
        this._measuredSpeed = 0

        this.setModel()
        this.setPhysics(position)
        this.setAnimation()
        this.setAI()
        this.setIndicators()
    }

    setModel() {
        // Copia propia del modelo: si dos enemigos usan el mismo recurso, no se lo quitan entre sí
        this.model = cloneSkinned(this.modelResource)
        this.model.scale.set(0.03, 0.03, 0.03)
        this.model.position.set(0, -0.4, 0)

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true
                child.frustumCulled = false // las mallas con huesos se recortaban mal al moverse
            }
        })
    }

    setPhysics(position) {
        const shape = new CANNON.Sphere(0.4)

        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y || 1, position.z),
            linearDamping: 0.1,
            angularDamping: 0.9,
        })

        this.body.angularFactor.set(0, 1, 0)
        this.body.velocity.setZero()
        this.body.angularVelocity.setZero()
        this.body.sleep()
        this.body.material = this.physics.obstacleMaterial

        this.physics.world.addBody(this.body)

        setTimeout(() => {
            this.body.wakeUp()
        }, 100)
    }

    setAnimation() {
        this.animation = { mixer: new THREE.AnimationMixer(this.model), actions: {} }

        // Los FBX de Mixamo traen un clip de esqueleto ("mixamo.com") y a veces un clip
        // vacío o parcial ("Take 001"). Usamos el que más pistas de huesos tiene.
        const clips = (this.modelResource?.animations || []).filter((a) => a.tracks && a.tracks.length > 0)
        if (clips.length === 0) {
            console.warn('⚠️ No se encontraron animaciones en el modelo de enemigo')
            return
        }
        const main = clips.reduce((best, c) => (c.tracks.length > best.tracks.length ? c : best), clips[0])

        const action = this.animation.mixer.clipAction(main)
        action.setLoop(THREE.LoopRepeat)
        action.setEffectiveWeight(1)
        action.setEffectiveTimeScale(this._animScale)
        action.time = Math.random() * main.duration // que no caminen todos sincronizados
        action.play()
        this.animation.actions.walking = action
        this.animation.clipDuration = main.duration
    }

    // ── Configuración de la IA de Yuka ───────────────────────────────────
    setAI() {
        this.vehicle = new YUKA.Vehicle()
        this.vehicle.position.copy(this.spawnPos)
        this.vehicle.mass = 1
        this.vehicle.boundingRadius = 0.4
        this.vehicle.updateOrientation = true // necesario para que el esquive proyecte bien
        this.setSpeed(this.arch.patrol)

        // Conductas de dirección
        this.arrive = new YUKA.ArriveBehavior(new YUKA.Vector3(), 3, 0.5)
        this.arrive.active = false

        this.pursuit = new YUKA.PursuitBehavior(null, 1.2)
        this.pursuit.active = false

        this.wander = new YUKA.WanderBehavior()
        this.wander.radius = 2
        this.wander.distance = 10
        this.wander.jitter = 6
        this.wander.active = false

        this.obstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior([])
        this.obstacleAvoidance.brakingWeight = 0.5
        this.obstacleAvoidance.dBoxMinLength = 4

        // El esquive primero, luego el destino, luego el deambular
        this.vehicle.steering.add(this.obstacleAvoidance)
        this.vehicle.steering.add(this.pursuit)
        this.vehicle.steering.add(this.arrive)
        this.vehicle.steering.add(this.wander)

        this._refreshObstacles()

        this.stateMachine = new YUKA.StateMachine(this)
        this.stateMachine.add('PATROL', new PatrolState())
        this.stateMachine.add('INVESTIGATE', new InvestigateState())
        this.stateMachine.add('CHASE', new ChaseState())
        this.stateMachine.add('FLANK', new FlankState())
        this.stateMachine.add('SEARCH', new SearchState())
        this.stateMachine.changeTo('PATROL')
    }

    setTarget(target) {
        this.target = target
    }

    setSpeed(v) {
        this.currentSpeed = v
        if (this.vehicle) {
            this.vehicle.maxSpeed = v
            this.vehicle.maxForce = v * 8
        }
    }

    // ── Indicadores sobre la cabeza (icono de estado + nombre del tipo) ───
    setIndicators() {
        const mat = new THREE.SpriteMaterial({ map: null, transparent: true, depthTest: false, depthWrite: false })
        this.iconSprite = new THREE.Sprite(mat)
        this.iconSprite.scale.set(3.2, 3.2, 1)
        this.iconSprite.position.set(0, 8.4, 0)
        this.iconSprite.renderOrder = 999
        this.iconSprite.visible = false

        const lmat = new THREE.SpriteMaterial({
            map: labelTexture(this.label), transparent: true, depthTest: false, depthWrite: false,
        })
        this.labelSprite = new THREE.Sprite(lmat)
        this.labelSprite.scale.set(5, 1.25, 1)
        this.labelSprite.position.set(0, 6.9, 0)
        this.labelSprite.renderOrder = 999

        this.group.add(this.iconSprite, this.labelSprite)
        this._applyStateVisuals()
    }

    _applyStateVisuals() {
        if (!this.iconSprite) return // el estado inicial se fija antes de crear los indicadores
        const icon = STATE_ICON[this.stateName]
        if (icon) {
            this.iconSprite.material.map = iconTexture(icon)
            this.iconSprite.material.needsUpdate = true
            this.iconSprite.visible = true
        } else {
            this.iconSprite.visible = false
        }
        if (this.cone) {
            const hex = STATE_COLOR[this.stateName] ?? 0x8ab4ff
            this.cone.material.color.setHex(hex)
            this.coneEdge?.material.color.setHex(hex)
        }
    }

    /** Cono de visión en el suelo (modo "Ver IA"). */
    setDebugVisible(on) {
        if (on && !this.cone) {
            const half = THREE.MathUtils.degToRad(this.arch.fov / 2)
            const radius = Math.min(this.arch.sight, 90)
            const steps = 20
            const verts = [0, 0, 0]
            for (let i = 0; i <= steps; i++) {
                const a = -half + (2 * half * i) / steps
                verts.push(Math.sin(a) * radius, 0, Math.cos(a) * radius)
            }
            const idx = []
            for (let i = 1; i <= steps; i++) idx.push(0, i, i + 1)
            const geo = new THREE.BufferGeometry()
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
            geo.setIndex(idx)
            const m = new THREE.MeshBasicMaterial({
                color: STATE_COLOR[this.stateName], transparent: true, opacity: 0.32,
                depthWrite: false, side: THREE.DoubleSide,
            })
            this.cone = new THREE.Mesh(geo, m)
            // Contorno del abanico: se lee bien aunque el suelo sea claro
            const edgeGeo = new THREE.BufferGeometry()
            edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
            this.coneEdge = new THREE.LineLoop(edgeGeo, new THREE.LineBasicMaterial({
                color: STATE_COLOR[this.stateName], transparent: true, opacity: 0.95, depthWrite: false,
            }))
            this.coneEdge.renderOrder = 997
            this.cone.add(this.coneEdge)
            // El grupo del modelo cuelga ~0.4 m sobre el suelo: -0.2 deja el cono a ras de suelo (visible, sin atravesarlo)
            this.cone.position.set(0, -0.2, 0)
            this.cone.renderOrder = 997
            this.group.add(this.cone)
        }
        if (this.cone) this.cone.visible = on
    }

    // ── Eventos de la IA ───────────────────────────────────────────────
    onStateChange(name, speed) {
        this.stateName = name
        this.setSpeed(speed)
        this._applyStateVisuals()
    }

    /** Un enemigo que acaba de ver al jugador avisa al resto (con enfriamiento). */
    announceChase() {
        const now = this.now()
        if (this.arch.shouts && this.director && now > this.shoutCooldownUntil) {
            this.shoutCooldownUntil = now + 9000
            this.director.shout(this, this.readTargetPosition())
        }
    }

    /** Aviso de un aliado: va a investigar el lugar. Devuelve true si lo atendió. */
    receiveAlert(pos) {
        if (this.stateName === 'CHASE' || this.stateName === 'FLANK') return false
        this.beginInvestigate(pos)
        return true
    }

    beginInvestigate(pos) {
        this.investigatePos.set(pos.x, pos.y, pos.z)
        if (this.stateName === 'INVESTIGATE') {
            this.arrive.target.copy(this.investigatePos)
            this.investigateUntil = this.now() + 9000
        } else {
            this.stateMachine.changeTo('INVESTIGATE')
        }
    }

    // ── Utilidades que usan los estados ─────────────────────────────────
    now() {
        return (this.time && this.time.elapsed != null) ? this.time.elapsed : performance.now()
    }

    /** ¿Lo veo yo, o algún aliado lo vio hace poco? */
    tracksTarget() {
        if (this.sees || this.director?.groupKnowsPlayer()) {
            this.lostSightAt = null
            return true
        }
        // Margen de medio segundo para no soltar la persecución por un parpadeo del raycast
        if (this.lostSightAt === null) this.lostSightAt = this.now()
        return this.now() - this.lostSightAt < 500
    }

    readTargetPosition() {
        const p = this.target.body.position
        return this._tmpVec.set(p.x, p.y, p.z)
    }

    distanceToTarget() {
        const p = this.target.body.position
        const e = this.body.position
        return Math.hypot(p.x - e.x, p.z - e.z)
    }

    /** Reconstruye la lista de obstáculos (edificios) para el esquive de Yuka. */
    _refreshObstacles() {
        const obstacles = []
        const bodies = this.physics.world.bodies
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i]
            if (b === this.body || b.mass !== 0) continue // sólo cuerpos estáticos (edificios)
            const shape = b.shapes[0]
            let radius = 1
            if (shape) {
                if (shape.halfExtents) {
                    radius = Math.hypot(shape.halfExtents.x, shape.halfExtents.z)
                } else if (typeof shape.radius === 'number') {
                    radius = shape.radius
                }
            }
            if (radius <= 0 || radius > 60) continue // descartar el piso gigante
            const entity = new YUKA.GameEntity()
            entity.position.set(b.position.x, b.position.y, b.position.z)
            entity.boundingRadius = radius
            obstacles.push(entity)
        }
        this.obstacleAvoidance.obstacles = obstacles
    }

    // ── Percepción ──────────────────────────────────────────────────────
    _rayHitsObstacle(from, to) {
        try {
            this._rayFrom.set(from.x, from.y, from.z)
            this._rayTo.set(to.x, to.y, to.z)
            this._rayResult.reset()
            this.physics.world.raycastClosest(
                this._rayFrom,
                this._rayTo,
                { skipBackfaces: true, collisionFilterMask: -1 },
                this._rayResult,
            )
            if (this._rayResult.hasHit) {
                const b = this._rayResult.body
                const targetBody = this.target && this.target.body
                if (b && b !== this.body && b !== targetBody && b.mass === 0) {
                    return { blocked: true, distance: this._rayResult.distance }
                }
            }
        } catch {
            // Si el raycast no está disponible, asumimos que no hay muro
        }
        return { blocked: false, distance: Infinity }
    }

    _hasLineOfSight(targetPos) {
        const px = this.body.position.x
        const py = this.body.position.y + 0.5
        const pz = this.body.position.z
        const tx = targetPos.x
        const ty = targetPos.y + 0.5
        const tz = targetPos.z

        const dx = tx - px, dy = ty - py, dz = tz - pz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < 0.001) return true

        const inv = 1 / dist
        const from = { x: px + dx * inv * 0.7, y: py + dy * inv * 0.7, z: pz + dz * inv * 0.7 }
        const hit = this._rayHitsObstacle(from, { x: tx, y: ty, z: tz })
        return !hit.blocked || hit.distance >= dist - 1.0
    }

    /** Vista (cono + línea de visión) y oído (ruido del jugador según la distancia). */
    _updatePerception() {
        const tp = this.target.body.position
        const ep = this.body.position
        const dx = tp.x - ep.x
        const dz = tp.z - ep.z
        const dist = Math.hypot(dx, dz)

        // Vista
        let sees = false
        if (dist <= this.arch.proximity) {
            sees = true // lo nota por cercanía, aunque esté a su espalda
        } else if (dist <= this.arch.sight) {
            const toTarget = Math.atan2(dx, dz)
            const off = Math.abs(angleDiff(this.facing, toTarget))
            if (off <= THREE.MathUtils.degToRad(this.arch.fov / 2)) {
                sees = this._hasLineOfSight(tp)
            }
        }
        this.sees = sees
        if (sees && this.director) this.director.reportSighting(tp, this)

        // Oído: el ruido del jugador llega más lejos si corre o salta
        const noiseRadius = (this.director?.noise?.radius ?? 8) * this.arch.hearing
        if (!sees && dist <= noiseRadius) {
            this._heardVec.set(tp.x, tp.y, tp.z)
            this.heardPos = this._heardVec
        } else {
            this.heardPos = null
        }
    }

    // ── Animación: el clip sigue a la velocidad real del cuerpo ──────────
    _updateAnimation(dt) {
        const action = this.animation.actions.walking
        if (!action) return

        const vx = this.body.velocity.x
        const vz = this.body.velocity.z
        const speed = Math.hypot(vx, vz)
        this._measuredSpeed += (speed - this._measuredSpeed) * Math.min(1, dt * 10)

        // 1× = el clip avanza tanto como strideSpeed; más o menos velocidad lo acelera o lo frena.
        // Parado se deja un balanceo muy lento en vez de congelar la pose.
        const moving = this._measuredSpeed > 0.6
        const target = moving ? clamp(this._measuredSpeed / this.arch.strideSpeed, 0.4, 1.6) : 0.1
        this._animScale += (target - this._animScale) * Math.min(1, dt * 6)
        action.setEffectiveTimeScale(this._animScale)
    }

    update() {
        // delta en segundos, acotado: si la pestaña estuvo en 2º plano no explota
        const dt = Math.min(((this.time && this.time.delta) || 16) * 0.001, 0.1)

        if (this.animation && this.animation.mixer) {
            this.animation.mixer.update(dt)
        }

        if (!this.target || !this.target.body || !this.vehicle) {
            this.group.position.copy(this.body.position)
            return
        }

        const nowMs = this.now()

        // La persecución usa al jugador como "evasor" (Yuka predice hacia dónde irá)
        if (this.director && this.pursuit.evader !== this.director.playerProxy) {
            this.pursuit.evader = this.director.playerProxy
        }

        // 1) Sincronizar la posición real (física) hacia el vehículo de Yuka
        this.vehicle.position.set(this.body.position.x, this.body.position.y, this.body.position.z)

        // 2) Percepción (con throttle)
        if (nowMs >= this._nextPerceptionAt) {
            this._nextPerceptionAt = nowMs + this.ai.perceptionMs
            this._updatePerception()
        }

        // 3) Refrescar obstáculos cada tanto (los edificios cambian por nivel)
        if (nowMs >= this._nextObstacleAt) {
            this._nextObstacleAt = nowMs + this.ai.obstacleRefreshMs
            this._refreshObstacles()
        }

        // 4) IA de Yuka: máquina de estados + cálculo de la velocidad deseada
        let desiredX = 0
        let desiredZ = 0
        try {
            this.stateMachine.update()
            this.vehicle.update(dt)
            desiredX = this.vehicle.velocity.x
            desiredZ = this.vehicle.velocity.z
        } catch {
            // Fallback: si Yuka fallara, perseguir en línea recta
            const p = this.target.body.position
            desiredX = p.x - this.body.position.x
            desiredZ = p.z - this.body.position.z
        }

        // 4b) Separación: los enemigos no se amontonan entre sí
        if (this.director) {
            const ep = this.body.position
            for (const other of this.director.enemies) {
                if (other === this) continue
                const ox = ep.x - other.body.position.x
                const oz = ep.z - other.body.position.z
                const d = Math.hypot(ox, oz)
                if (d > 0.01 && d < 8) {
                    const push = (8 - d) / 8
                    desiredX += (ox / d) * push * this.currentSpeed * 0.8
                    desiredZ += (oz / d) * push * this.currentSpeed * 0.8
                }
            }
        }

        // 5) Pasar la intención de Yuka a fuerzas de cannon-es (respeta colisiones)
        const desiredSpeed = Math.hypot(desiredX, desiredZ)
        let targetFacing = this.facing
        if (desiredSpeed > 0.05) {
            const nx = desiredX / desiredSpeed
            const nz = desiredZ / desiredSpeed
            const cappedSpeed = Math.min(desiredSpeed, this.currentSpeed)
            const throttle = Math.min(cappedSpeed / this.currentSpeed, 1) // arrive frena cerca del objetivo
            const force = this.currentSpeed * 12 * throttle

            if (this.body.sleepState !== 0) this.body.wakeUp()
            this.body.applyForce(
                new CANNON.Vec3(nx * force, 0, nz * force),
                this.body.position,
            )

            // Tope de velocidad horizontal
            const cs = Math.hypot(this.body.velocity.x, this.body.velocity.z)
            const cap = Math.max(cappedSpeed, this.currentSpeed * 0.35)
            if (cs > cap) {
                const s = cap / cs
                this.body.velocity.x *= s
                this.body.velocity.z *= s
            }

            if (desiredSpeed > 0.8) targetFacing = Math.atan2(nx, nz)
        } else {
            this.body.velocity.x *= 0.9
            this.body.velocity.z *= 0.9
        }

        // Mirar a su alrededor al buscar
        if (this.lookBase !== null) {
            targetFacing = this.lookBase + Math.sin(((nowMs - this.lookStart) / 1000) * 2.4) * 1.2
        }

        // Girar con suavidad (máx. ~7 rad/s) en lugar de teletransportar el ángulo
        const maxTurn = 7 * dt
        this.facing += clamp(angleDiff(this.facing, targetFacing), -maxTurn, maxTurn)
        this.group.rotation.y = this.facing
        this.body.quaternion.setFromEuler(0, this.facing, 0)

        this._updateAnimation(dt)

        // 6) Sincronizar la parte visual con la física
        this.group.position.copy(this.body.position)
    }

    checkCollisionWithTarget() {
        if (!this.target || !this.target.body) return false

        const enemyPos = this.body.position
        const targetPos = this.target.body.position

        const dx = targetPos.x - enemyPos.x
        const dy = targetPos.y - enemyPos.y
        const dz = targetPos.z - enemyPos.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        const collisionRadius = 0.4 + 0.4
        const collisionDistance = collisionRadius * 1.5

        return distance < collisionDistance
    }

    remove() {
        this.director?.unregister(this)

        if (this.group && this.group.parent) {
            this.scene.remove(this.group)
        }

        if (this.body && this.physics.world) {
            this.physics.world.removeBody(this.body)
        }

        // Limpiar la IA de Yuka
        if (this.vehicle && this.vehicle.steering) {
            this.vehicle.steering.clear()
        }
        this.stateMachine = null
        this.vehicle = null

        if (this.animation && this.animation.mixer) {
            this.animation.mixer.stopAllAction()
            this.animation.mixer.uncacheRoot(this.model)
        }

        // Los indicadores son propios de este enemigo (las texturas de iconos se comparten)
        this.iconSprite?.material.dispose()
        this.labelSprite?.material.map?.dispose()
        this.labelSprite?.material.dispose()
        if (this.cone) {
            this.cone.geometry.dispose()
            this.cone.material.dispose()
        }
        if (this.coneEdge) {
            this.coneEdge.geometry.dispose()
            this.coneEdge.material.dispose()
        }
        // La geometría y los materiales del modelo se comparten con el recurso original: no se liberan.
    }
}
