import * as THREE from 'three'
import * as YUKA from 'yuka'

// ─────────────────────────────────────────────────────────────────────────
// Director de IA: lo que los enemigos comparten entre sí.
//
// Cada enemigo decide solo (máquina de estados de Yuka), pero el director les da
// "sentidos compartidos" y los hace interactuar:
//   1. RUIDO del jugador: correr hace mucho ruido, caminar poco, quieto casi nada.
//      Los enemigos lo oyen según su distancia y lo bien que oiga su tipo.
//   2. ALARMA: un enemigo que te ve y "da la alarma" avisa a los aliados cercanos,
//      que van a investigar el lugar (comunicación entre agentes).
//   3. CONOCIMIENTO COMPARTIDO: si un aliado te ve, los demás saben dónde estás
//      unos segundos aunque ellos no te vean.
//   4. COORDINACIÓN: cuando varios te persiguen, el más cercano va directo y los
//      demás te cortan el paso desde los lados (flanqueo).
// ─────────────────────────────────────────────────────────────────────────

export const NOISE_LEVELS = {
  quiet: { id: 'quiet', label: 'Silencioso', radius: 8, bars: 1 },
  steps: { id: 'steps', label: 'Pasos', radius: 22, bars: 2 },
  loud: { id: 'loud', label: 'Estruendo', radius: 70, bars: 3 },
}

const SHOUT_RADIUS = 90 // distancia hasta donde llega la alarma de un enemigo
const SIGHTING_MEMORY_MS = 2500 // cuánto recuerda el grupo un avistamiento
const JUMP_NOISE_MS = 900

export default class EnemyDirector {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.enemies = []

    // Representación del jugador para las conductas de Yuka (persecución con predicción)
    this.playerProxy = new YUKA.Vehicle()
    this.playerProxy.maxSpeed = 40

    this.noise = NOISE_LEVELS.quiet
    this._jumpUntil = 0
    this._lastSpace = false

    this.sighting = { pos: new YUKA.Vector3(), at: -1e9, by: null }
    this._nextRoleAt = 0

    this.rings = []
    this.onEvent = null // (texto, tono) => void
    this.onNoiseChange = null // (nivel) => void
    this.debug = false
  }

  now() {
    return this.experience.time?.elapsed ?? performance.now()
  }

  register(enemy) {
    enemy.director = this
    this.enemies.push(enemy)
  }

  unregister(enemy) {
    this.enemies = this.enemies.filter((e) => e !== enemy)
    enemy.director = null
  }

  clear() {
    this.enemies.forEach((e) => { e.director = null })
    this.enemies = []
    this.sighting.at = -1e9
    this.rings.forEach((r) => this._disposeRing(r))
    this.rings = []
  }

  emit(text, tone = 'info') {
    this.onEvent?.(text, tone)
  }

  // ── Ruido del jugador ──────────────────────────────────────────────
  _updateNoise(robot, now) {
    const keys = this.experience.keyboard?.getState?.() || {}
    const v = robot.body.velocity
    const speed = Math.hypot(v.x, v.z)
    const moving = speed > 1.2

    if (keys.space && !this._lastSpace) this._jumpUntil = now + JUMP_NOISE_MS
    this._lastSpace = !!keys.space

    let level = NOISE_LEVELS.quiet
    if (moving) level = NOISE_LEVELS.steps
    if ((moving && keys.shift) || now < this._jumpUntil) level = NOISE_LEVELS.loud

    if (level !== this.noise) {
      this.noise = level
      this.onNoiseChange?.(level)
    }
  }

  // ── Conocimiento compartido ────────────────────────────────────────
  reportSighting(pos, source) {
    this.sighting.pos.set(pos.x, pos.y, pos.z)
    this.sighting.at = this.now()
    this.sighting.by = source
  }

  /** ¿Algún aliado vio al jugador hace poco? */
  groupKnowsPlayer() {
    return this.now() - this.sighting.at < SIGHTING_MEMORY_MS
  }

  // ── Alarma entre enemigos ──────────────────────────────────────────
  shout(source, pos) {
    let alerted = 0
    const sp = source.body.position
    this.enemies.forEach((other) => {
      if (other === source) return
      const op = other.body.position
      const d = Math.hypot(op.x - sp.x, op.z - sp.z)
      if (d <= SHOUT_RADIUS && other.receiveAlert(pos, source)) alerted++
    })
    this._spawnRing(sp, 0xff6b6b, SHOUT_RADIUS)
    if (alerted > 0) {
      this.emit(`${source.label} dio la alarma: ${alerted} ${alerted === 1 ? 'aliado acude' : 'aliados acuden'}`, 'warn')
    } else {
      this.emit(`${source.label} te vio y gritó`, 'warn')
    }
  }

  // ── Coordinación: quién persigue de frente y quién flanquea ─────────
  _assignRoles(now) {
    if (now < this._nextRoleAt) return
    this._nextRoleAt = now + 300

    const chasers = this.enemies.filter((e) => e.stateName === 'CHASE' || e.stateName === 'FLANK')
    if (chasers.length < 2) {
      chasers.forEach((e) => { e.flankSide = 0 })
      return
    }
    const p = this.playerProxy.position
    chasers.sort((a, b) => {
      const da = Math.hypot(a.body.position.x - p.x, a.body.position.z - p.z)
      const db = Math.hypot(b.body.position.x - p.x, b.body.position.z - p.z)
      return da - db
    })
    let side = 1
    chasers.forEach((e, i) => {
      if (i === 0) {
        e.flankSide = 0 // el más cercano persigue de frente
      } else if (e.flankSide === 0) {
        e.flankSide = side
        side = -side
        if (i === 1) this.emit(`${e.label} intenta cortarte el paso`, 'info')
      }
    })
  }

  // ── Efectos visuales: anillo de alarma en el suelo ──────────────────
  _spawnRing(pos, color, radius) {
    const geo = new THREE.RingGeometry(0.92, 1, 48)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(pos.x, 0.3, pos.z)
    mesh.renderOrder = 998
    this.scene.add(mesh)
    this.rings.push({ mesh, born: this.now(), life: 1100, radius })
  }

  _disposeRing(r) {
    this.scene.remove(r.mesh)
    r.mesh.geometry.dispose()
    r.mesh.material.dispose()
  }

  _updateRings(now) {
    this.rings = this.rings.filter((r) => {
      const t = (now - r.born) / r.life
      if (t >= 1) {
        this._disposeRing(r)
        return false
      }
      const s = 4 + t * r.radius
      r.mesh.scale.set(s, 1, s)
      r.mesh.material.opacity = 0.55 * (1 - t)
      return true
    })
  }

  // ── Bucle ───────────────────────────────────────────────────────────
  update(robot) {
    const now = this.now()
    if (robot?.body) {
      const p = robot.body.position
      const v = robot.body.velocity
      this.playerProxy.position.set(p.x, p.y, p.z)
      this.playerProxy.velocity.set(v.x, 0, v.z)
      this._updateNoise(robot, now)
    }
    this._assignRoles(now)
    this._updateRings(now)
  }

  /** Datos para el panel de IA. */
  snapshot() {
    const rp = this.experience.world?.robot?.body?.position
    return this.enemies.map((e) => {
      const ep = e.body.position
      const dist = rp ? Math.hypot(rp.x - ep.x, rp.z - ep.z) : 0
      return { id: e.id, label: e.label, state: e.stateName, speed: e.currentSpeed, dist, flank: e.flankSide }
    })
  }

  setDebug(on) {
    this.debug = on
    this.enemies.forEach((e) => e.setDebugVisible(on))
  }
}
