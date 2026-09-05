import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import * as YUKA from 'yuka'

// ─────────────────────────────────────────────────────────────────────────
// 🧠 IA con Yuka: máquina de estados + conductas de dirección (steering)
//
// - El "cerebro" (qué hacer) es una YUKA.StateMachine con 3 estados.
// - El "cómo moverse" son conductas de Yuka: ArriveBehavior (perseguir),
//   WanderBehavior (patrullar) y ObstacleAvoidanceBehavior (esquivar edificios).
// - La percepción (¿veo al jugador?) usa un raycast en el mundo físico.
// - Yuka calcula una velocidad deseada; esa intención se pasa como fuerza a
//   cannon-es, así el cuerpo físico sigue chocando de verdad con los edificios.
// ─────────────────────────────────────────────────────────────────────────

class PatrolState extends YUKA.State {
    enter(enemy) {
        enemy.wander.active = true
        enemy.arrive.active = false
    }
    execute(enemy) {
        if (enemy.perceivesTarget()) {
            enemy.stateMachine.changeTo('CHASE')
            return
        }
        // Correa: si se aleja demasiado de su punto de aparición, tira hacia él
        const distToSpawn = enemy.vehicle.position.distanceTo(enemy.spawnPos)
        if (distToSpawn > enemy.ai.patrolRadius) {
            enemy.arrive.target.copy(enemy.spawnPos)
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

class ChaseState extends YUKA.State {
    enter(enemy) {
        enemy.arrive.active = true
        enemy.arrive.deceleration = 1 // frena poco: persecución agresiva
    }
    execute(enemy) {
        if (enemy.perceivesTarget()) {
            const p = enemy.readTargetPosition()
            enemy.arrive.target.copy(p)
            enemy.lastKnownPos.copy(p)
        } else {
            enemy.searchUntil = enemy.now() + enemy.ai.loseSightGrace
            enemy.stateMachine.changeTo('SEARCH')
        }
    }
    exit(enemy) {
        enemy.arrive.active = false
        enemy.arrive.deceleration = 3
    }
}

class SearchState extends YUKA.State {
    enter(enemy) {
        enemy.arrive.active = true
        enemy.arrive.target.copy(enemy.lastKnownPos)
    }
    execute(enemy) {
        if (enemy.perceivesTarget()) {
            enemy.stateMachine.changeTo('CHASE')
            return
        }
        const reached = enemy.vehicle.position.distanceTo(enemy.lastKnownPos) < 2
        if (reached || enemy.now() > enemy.searchUntil) {
            enemy.stateMachine.changeTo('PATROL')
        }
    }
    exit(enemy) {
        enemy.arrive.active = false
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

        // Velocidad del enemigo (más lento que el jugador)
        this.speed = options.speed ?? 4

        // ── Configuración de la IA (se puede sobrescribir desde World.js) ──
        this.ai = {
            detectionRange: 300,   // ve al jugador a esta distancia SI hay línea de visión
            hearingRange: 14,      // lo "oye" aunque haya un muro (si está muy cerca)
            loseSightGrace: 4000,  // ms buscando en la última posición conocida
            patrolRadius: 16,      // radio de patrulla alrededor del spawn
            perceptionMs: 120,     // cada cuánto lanza el rayo de visión
            obstacleRefreshMs: 500,// cada cuánto recalcula la lista de obstáculos
            ...(options.ai || {}),
        }

        // Posiciones auxiliares (tipo Yuka para usarlas con las conductas)
        this.spawnPos = new YUKA.Vector3(position.x, position.y || 1, position.z)
        this.lastKnownPos = new YUKA.Vector3()
        this._tmpVec = new YUKA.Vector3()

        // Percepción
        this._nextPerceptionAt = 0
        this._nextObstacleAt = 0
        this._canSeeTarget = false
        this.searchUntil = 0
        this._rayResult = new CANNON.RaycastResult()
        this._rayFrom = new CANNON.Vec3()
        this._rayTo = new CANNON.Vec3()

        this.setModel()
        this.setPhysics(position)
        this.setAnimation()
        this.setAI()
    }

    setModel() {
        this.model = this.modelResource
        this.model.scale.set(0.03, 0.03, 0.03)
        this.model.position.set(0, -0.4, 0)

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true
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
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        this.animation.actions = {}

        let fbxAnimations = null

        if (this.modelResource?.animations && Array.isArray(this.modelResource.animations)) {
            fbxAnimations = this.modelResource.animations
        }

        if (!fbxAnimations || fbxAnimations.length === 0) {
            const allAnimations = []
            this.modelResource?.traverse?.((child) => {
                if (child.animations && child.animations.length > 0) {
                    allAnimations.push(...child.animations)
                }
            })
            if (allAnimations.length > 0) {
                fbxAnimations = allAnimations
            }
        }

        if (!fbxAnimations || fbxAnimations.length === 0) {
            console.warn('⚠️ No se encontraron animaciones en el modelo de enemigo')
            return
        }

        let walkingAnimation = null
        let idleAnimation = null

        for (let i = 0; i < fbxAnimations.length; i++) {
            const anim = fbxAnimations[i]
            const animName = anim.name ? anim.name.toLowerCase() : `animation_${i}`

            if ((animName.includes('walk') || animName.includes('walking') ||
                 animName.includes('run') || animName.includes('running') ||
                 animName.includes('move')) && !walkingAnimation) {
                walkingAnimation = anim
            }

            if ((animName.includes('idle') || animName.includes('stand') ||
                 animName.includes('rest')) && !idleAnimation) {
                idleAnimation = anim
            }
        }

        if (!walkingAnimation && fbxAnimations.length > 0) {
            for (let i = 0; i < fbxAnimations.length; i++) {
                if (fbxAnimations[i].tracks && fbxAnimations[i].tracks.length > 0) {
                    if (!walkingAnimation) {
                        walkingAnimation = fbxAnimations[i]
                    } else if (!idleAnimation) {
                        idleAnimation = fbxAnimations[i]
                    }
                }
            }
        }

        if (walkingAnimation && walkingAnimation.tracks && walkingAnimation.tracks.length > 0) {
            this.animation.actions.walking = this.animation.mixer.clipAction(walkingAnimation)
            this.animation.actions.walking.setLoop(THREE.LoopRepeat)
            this.animation.actions.walking.setEffectiveWeight(1.0)
            this.animation.actions.walking.setEffectiveTimeScale(1.0)
        }

        if (idleAnimation && idleAnimation.tracks && idleAnimation.tracks.length > 0) {
            this.animation.actions.idle = this.animation.mixer.clipAction(idleAnimation)
            this.animation.actions.idle.setLoop(THREE.LoopRepeat)
            this.animation.actions.idle.setEffectiveWeight(1.0)
            this.animation.actions.idle.setEffectiveTimeScale(1.0)
            this.animation.actions.idle.play()
        } else if (this.animation.actions.walking) {
            this.animation.actions.walking.play()
        }
    }

    // ── Configuración de la IA de Yuka ───────────────────────────────────
    setAI() {
        this.vehicle = new YUKA.Vehicle()
        this.vehicle.position.copy(this.spawnPos)
        this.vehicle.maxSpeed = this.speed
        this.vehicle.maxForce = this.speed * 8
        this.vehicle.mass = 1
        this.vehicle.boundingRadius = 0.4
        this.vehicle.updateOrientation = true // necesario para que el esquive proyecte bien

        // Conductas de dirección
        this.arrive = new YUKA.ArriveBehavior(new YUKA.Vector3(), 3, 0.5)
        this.arrive.active = false

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
        this.vehicle.steering.add(this.arrive)
        this.vehicle.steering.add(this.wander)

        this._refreshObstacles()

        // Máquina de estados: PATROL → CHASE → SEARCH → PATROL
        this.stateMachine = new YUKA.StateMachine(this)
        this.stateMachine.add('PATROL', new PatrolState())
        this.stateMachine.add('CHASE', new ChaseState())
        this.stateMachine.add('SEARCH', new SearchState())
        this.stateMachine.changeTo('PATROL')
    }

    setTarget(target) {
        this.target = target
    }

    // ── Utilidades que usan los estados ─────────────────────────────────
    now() {
        return (this.time && this.time.elapsed != null) ? this.time.elapsed : performance.now()
    }

    perceivesTarget() {
        return this._canSeeTarget
    }

    readTargetPosition() {
        const p = this.target.body.position
        return this._tmpVec.set(p.x, p.y, p.z)
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

    // ── Percepción por raycast (cannon-es) ──────────────────────────────
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

    _updatePerception() {
        const tp = this.target.body.position
        const ep = this.body.position
        const dist = Math.hypot(tp.x - ep.x, tp.z - ep.z)

        if (dist <= this.ai.hearingRange) {
            this._canSeeTarget = true
        } else if (dist <= this.ai.detectionRange) {
            this._canSeeTarget = this._hasLineOfSight(tp)
        } else {
            this._canSeeTarget = false
        }
    }

    _playWalk() {
        const a = this.animation && this.animation.actions
        if (!a || !a.walking) return
        if (!a.walking.isRunning()) {
            if (a.idle && a.idle.isRunning()) a.idle.fadeOut(0.2)
            a.walking.reset()
            a.walking.fadeIn(0.2)
            a.walking.play()
        }
    }

    _playIdle() {
        const a = this.animation && this.animation.actions
        if (!a) return
        if (a.walking && a.walking.isRunning()) {
            a.walking.fadeOut(0.2)
            a.walking.stop()
        }
        if (a.idle && !a.idle.isRunning()) {
            a.idle.reset()
            a.idle.fadeIn(0.2)
            a.idle.play()
        }
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

        // 1) Sincronizar la posición real (física) hacia el vehículo de Yuka
        this.vehicle.position.set(this.body.position.x, this.body.position.y, this.body.position.z)

        // 2) Percepción (línea de visión con raycast, con throttle)
        if (nowMs >= this._nextPerceptionAt) {
            this._nextPerceptionAt = nowMs + this.ai.perceptionMs
            this._updatePerception()
        }
        if (this._canSeeTarget) {
            const p = this.target.body.position
            this.lastKnownPos.set(p.x, p.y, p.z)
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

        // 5) Pasar la intención de Yuka a fuerzas de cannon-es (respeta colisiones)
        const desiredSpeed = Math.hypot(desiredX, desiredZ)
        if (desiredSpeed > 0.05) {
            const nx = desiredX / desiredSpeed
            const nz = desiredZ / desiredSpeed
            const throttle = Math.min(desiredSpeed / this.speed, 1) // arrive frena cerca del objetivo
            const force = this.speed * 12 * throttle

            if (this.body.sleepState !== 0) this.body.wakeUp()
            this.body.applyForce(
                new CANNON.Vec3(nx * force, 0, nz * force),
                this.body.position,
            )

            // Tope de velocidad horizontal
            const cs = Math.hypot(this.body.velocity.x, this.body.velocity.z)
            const cap = Math.max(desiredSpeed, this.speed * 0.35)
            if (cs > cap) {
                const s = cap / cs
                this.body.velocity.x *= s
                this.body.velocity.z *= s
            }

            // Rotar el modelo hacia la dirección de avance
            const angle = Math.atan2(nx, nz)
            this.group.rotation.y = angle
            this.body.quaternion.setFromEuler(0, angle, 0)

            this._playWalk()
        } else {
            this.body.velocity.x *= 0.9
            this.body.velocity.z *= 0.9
            if (Math.hypot(this.body.velocity.x, this.body.velocity.z) < 0.5) {
                this._playIdle()
            }
        }

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
        }

        if (this.model) {
            this.model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) child.geometry.dispose()
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat.map) mat.map.dispose()
                                mat.dispose()
                            })
                        } else {
                            if (child.material.map) child.material.map.dispose()
                            child.material.dispose()
                        }
                    }
                }
            })
        }
    }
}
