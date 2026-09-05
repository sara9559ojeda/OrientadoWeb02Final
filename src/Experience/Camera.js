import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

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
        this.controls.minDistance = 2
        this.controls.maxDistance = 100
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
    
    updateTargetToFollowCharacter() {
        // Obtener referencia al robot desde la experiencia
        const robot = this.experience.world?.robot
        if (!robot || !robot.body) return
        
        // Obtener la posición del robot
        const robotPosition = robot.body.position
        const targetHeight = 1.5 // Altura del target (a la altura del robot)
        
        // Actualizar el target de OrbitControls para que siga al robot
        // Usar lerp para un seguimiento suave pero responsivo
        const targetPosition = new THREE.Vector3(robotPosition.x, targetHeight, robotPosition.z)
        this.controls.target.lerp(targetPosition, 0.15) // Factor de suavizado (más responsivo que 0.1)
        
        // Si el robot se está moviendo, hacer el seguimiento más rápido
        const robotSpeed = robot.body.velocity.length()
        if (robotSpeed > 0.5) {
            // Cuando se mueve, seguir más rápido
            this.controls.target.lerp(targetPosition, 0.25)
        }
    }
}