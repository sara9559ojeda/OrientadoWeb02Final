import * as CANNON from 'cannon-es'
import * as THREE from 'three'

const NUM_STEPS   = 8
const STEP_HEIGHT = 0.3   // menor que radio del jugador (0.4) para que la esfera pueda subir
const STEP_DEPTH  = 0.9
const STEP_WIDTH  = 3.5

export default class Steps {
    constructor(experience, basePosition, facingAngle) {
        this.experience = experience
        this.scene      = experience.scene
        this.physics    = experience.physics
        this.meshes     = []
        this.bodies     = []
        this._build(basePosition, facingAngle)
    }

    // facingAngle: ángulo desde eje +Z hacia la dirección de ascenso (igual que rotation.y en THREE)
    _build(base, angle) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x888888, roughness: 0.9, metalness: 0.05
        })

        const dx = Math.sin(angle)
        const dz = Math.cos(angle)

        for (let i = 0; i < NUM_STEPS; i++) {
            const totalH = (i + 1) * STEP_HEIGHT   // altura acumulada desde el suelo
            const cx     = base.x + dx * (i + 0.5) * STEP_DEPTH
            const cy     = totalH / 2
            const cz     = base.z + dz * (i + 0.5) * STEP_DEPTH

            // Visual
            const geo  = new THREE.BoxGeometry(STEP_WIDTH, totalH, STEP_DEPTH)
            const mesh = new THREE.Mesh(geo, mat)
            mesh.position.set(cx, cy, cz)
            mesh.rotation.y = angle
            mesh.castShadow    = true
            mesh.receiveShadow = true
            this.scene.add(mesh)
            this.meshes.push(mesh)

            // Física
            const body = new CANNON.Body({
                mass:     0,
                type:     CANNON.Body.STATIC,
                shape:    new CANNON.Box(new CANNON.Vec3(STEP_WIDTH / 2, totalH / 2, STEP_DEPTH / 2)),
                position: new CANNON.Vec3(cx, cy, cz),
                material: this.physics.obstacleMaterial
            })
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle)
            body.fixedRotation = false
            this.physics.world.addBody(body)
            this.bodies.push(body)
        }
    }

    destroy() {
        this.meshes.forEach(m => {
            this.scene.remove(m)
            m.geometry.dispose()
            m.material.dispose()
        })
        this.bodies.forEach(b => this.physics.world.removeBody(b))
        this.meshes = []
        this.bodies = []
    }
}
