import * as THREE from 'three';
import isMobileDevice from '../Utils/Device.js'; // Asegúrate de que exista esta función

export default class ThirdPersonCamera {
    constructor(experience, target) {
        this.experience = experience
        this.camera = experience.camera.instance
        this.target = target

        const isMobile = isMobileDevice()

        // Distancia y altura adaptada - Aumentada para mejor campo de visión
        this.offset = isMobile
            ? new THREE.Vector3(0, 5.0, -8)  // móvil: más alto y atrás
            : new THREE.Vector3(0, 4.5, -7)  // Desktop: más alto para ver partículas

        // Fijar altura para evitar sacudidas - Aumentada
        this.fixedY = isMobile ? 5.0 : 4.5
    }

    update() {
        if (!this.target) return

        // Si OrbitControls está activo (usuario moviendo mouse), 
        // el seguimiento del target se hace en Camera.js
        // Aquí solo retornamos para no interferir con OrbitControls
        const orbitControls = this.experience.camera?.controls
        if (orbitControls && orbitControls.enabled) {
            // El target se actualiza en Camera.js para seguir al robot
            return
        }

        const basePosition = this.target.position.clone()

        // Dirección del robot
        const direction = new THREE.Vector3(0, 0, 1).applyEuler(this.target.rotation).normalize()

        // Fijar cámara a una altura constante (no sigue saltos ni choques verticales)
        const cameraPosition = new THREE.Vector3(
            basePosition.x + direction.x * this.offset.z,
            this.fixedY,
            basePosition.z + direction.z * this.offset.z
        )

        this.camera.position.lerp(cameraPosition, 0.15)

        // Mirar hacia adelante en la dirección del robot, no hacia el suelo
        // Calcular un punto de mira que esté adelante del robot, no directamente sobre él
        const lookAtDistance = 20 // Distancia hacia adelante donde queremos que mire la cámara
        const lookAt = new THREE.Vector3(
            basePosition.x + direction.x * lookAtDistance,
            basePosition.y + 1.5, // Altura del punto de mira (a la altura del robot)
            basePosition.z + direction.z * lookAtDistance
        )
        this.camera.lookAt(lookAt)
    }
}
