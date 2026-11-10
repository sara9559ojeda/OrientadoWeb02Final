import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Cámara de seguimiento (tercera persona): distancia horizontal, altura y punto al que mira
export const FOLLOW_DISTANCE = 22
export const FOLLOW_HEIGHT = 13
export const FOLLOW_TARGET_HEIGHT = 3

export default class Camera {
    constructor(experience) {
        this.experience = experience
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        this.setInstance()
        this.setControls()
    }

    setInstance() {
        // Aumentar far plane para ver edificios más lejanos
        this.instance = new THREE.PerspectiveCamera(35, this.sizes.width / this.sizes.height, 0.1, 1000)
        // Posición inicial cerca del origen donde están los edificios normalizados
        this.instance.position.set(5, 5, 5)
        this.scene.add(this.instance)
    }

    setControls() {
        this.controls = new OrbitControls(this.instance, this.canvas)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05
        // Permitir rotación y zoom con el mouse
        this.controls.enableRotate = true
        this.controls.enableZoom = true
        this.controls.enablePan = true
        // Límites de rotación vertical
        this.controls.minPolarAngle = 0
        this.controls.maxPolarAngle = Math.PI
        // Distancia mínima y máxima
        // Los personajes miden ~6 m: con menos de 10 m de distancia ocupan toda la pantalla
        this.controls.minDistance = 10
        this.controls.maxDistance = 120
        // Target inicial cerca del origen donde están los edificios
        this.controls.target.set(0, 2, 0)
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        // Solo actualizar OrbitControls si están habilitados
        if (this.controls && this.controls.enabled) {
            // Hacer que OrbitControls siga al personaje principal
            this.updateTargetToFollowCharacter()
            this.controls.update()
        }
    }
    
    /**
     * Coloca la cámara detrás del personaje, lejos y algo elevada, al empezar la partida.
     * Luego el jugador puede acercar/alejar con la rueda y orbitar con el ratón.
     */
    placeBehindCharacter(distance = FOLLOW_DISTANCE, height = FOLLOW_HEIGHT) {
        const robot = this.experience.world?.robot
        if (!robot || !robot.body) {
            this._pendingPlacement = { distance, height } // el personaje aún no cargó: se aplica luego
            return
        }
        this._pendingPlacement = null
        const p = robot.body.position
        const dir = new THREE.Vector3(0, 0, 1)
        if (robot.group) dir.applyEuler(robot.group.rotation).normalize()
        this.controls.target.set(p.x, FOLLOW_TARGET_HEIGHT, p.z)
        this.instance.position.set(p.x - dir.x * distance, height, p.z - dir.z * distance)
        this.controls.update()
    }

    updateTargetToFollowCharacter() {
        // Obtener referencia al robot desde la experiencia
        const robot = this.experience.world?.robot
        if (!robot || !robot.body) return

        if (this._pendingPlacement) {
            const { distance, height } = this._pendingPlacement
            this.placeBehindCharacter(distance, height)
        }

        // Obtener la posición del robot
        const robotPosition = robot.body.position
        const targetHeight = FOLLOW_TARGET_HEIGHT // a la altura del pecho del personaje (~6 m de alto)
        
        // Actualizar el target de OrbitControls para que siga al robot
        // Usar lerp para un seguimiento suave pero responsivo
        const targetPosition = new THREE.Vector3(robotPosition.x, targetHeight, robotPosition.z)
        const previousTarget = this.controls.target.clone()
        this.controls.target.lerp(targetPosition, 0.15) // Factor de suavizado (más responsivo que 0.1)
        
        // Si el robot se está moviendo, hacer el seguimiento más rápido
        const robotSpeed = robot.body.velocity.length()
        if (robotSpeed > 0.5) {
            // Cuando se mueve, seguir más rápido
            this.controls.target.lerp(targetPosition, 0.25)
        }

        // La cámara acompaña al personaje: se desplaza lo mismo que el target, así conserva la
        // distancia y el ángulo elegidos (orbitar y hacer zoom siguen funcionando).
        this.instance.position.add(this.controls.target.clone().sub(previousTarget))
    }
}