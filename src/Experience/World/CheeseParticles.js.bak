import * as THREE from 'three'

export default class CheeseParticles {
    constructor(scene, targetPosition) {
        this.scene = scene
        this.targetPosition = targetPosition
        this.particles = null
        
        this.create()
    }

    create() {
        const particleCount = 300 // Muchas más partículas para efecto más vistoso
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)
        const sizes = new Float32Array(particleCount)
        
        // Colores vibrantes: amarillo dorado, naranja, amarillo brillante
        const color1 = new THREE.Color(0xffd700) // Dorado
        const color2 = new THREE.Color(0xffa500) // Naranja
        const color3 = new THREE.Color(0xffff00) // Amarillo brillante
        const color4 = new THREE.Color(0xffeb3b) // Amarillo limón
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            
            // Posiciones iniciales aleatorias alrededor del target (más dispersas)
            const radius = 3 + Math.random() * 5
            const theta = Math.random() * Math.PI * 2
            const phi = Math.random() * Math.PI
            
            positions[i3] = this.targetPosition.x + radius * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = this.targetPosition.y + 1 + radius * Math.sin(phi) * Math.sin(theta)
            positions[i3 + 2] = this.targetPosition.z + radius * Math.cos(phi)
            
            // Colores aleatorios entre los colores vibrantes
            const colorChoice = Math.random()
            let color
            if (colorChoice < 0.25) {
                color = color1
            } else if (colorChoice < 0.5) {
                color = color2
            } else if (colorChoice < 0.75) {
                color = color3
            } else {
                color = color4
            }
            
            colors[i3] = color.r
            colors[i3 + 1] = color.g
            colors[i3 + 2] = color.b
            
            // Tamaños variados para más efecto visual
            sizes[i] = 1.5 + Math.random() * 2.0 // Partículas más grandes y variadas
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
        
        // Material mejorado con tamaño variable
        const material = new THREE.PointsMaterial({
            size: 2.5, // Tamaño base más grande
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending, // Mezcla aditiva para brillo
            sizeAttenuation: true,
            depthWrite: false // Mejor rendimiento con blending
        })
        
        // Usar shader personalizado para tamaños variables (opcional, pero mejora el efecto)
        // Por ahora usamos el material estándar que ya es bastante bueno
        
        this.particles = new THREE.Points(geometry, material)
        this.scene.add(this.particles)
    }

    update(robotPosition) {
        if (!this.particles || !this.targetPosition) return
        
        const positions = this.particles.geometry.attributes.position.array
        const particleCount = positions.length / 3
        
        // Convertir robotPosition a Vector3 si es necesario
        const robotPos = robotPosition instanceof THREE.Vector3 
            ? robotPosition 
            : new THREE.Vector3(robotPosition.x, robotPosition.y, robotPosition.z)
        
        // Calcular dirección desde el robot hacia el queso (una sola vez)
        const directionToCheese = new THREE.Vector3()
            .subVectors(this.targetPosition, robotPos)
            .normalize()
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            
            // Mover partículas desde el robot hacia el queso (creando un efecto de guía más dinámico)
            const currentPos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2])
            
            // Velocidad variable para efecto más orgánico
            const baseSpeed = 0.15 + Math.random() * 0.1
            const verticalDrift = Math.sin(Date.now() * 0.001 + i) * 0.02 // Movimiento ondulatorio
            
            // Mover partículas en la dirección del queso con variación
            positions[i3] += directionToCheese.x * baseSpeed + (Math.random() - 0.5) * 0.05
            positions[i3 + 1] += directionToCheese.y * baseSpeed * 0.3 + verticalDrift + 0.02
            positions[i3 + 2] += directionToCheese.z * baseSpeed + (Math.random() - 0.5) * 0.05
            
            // Si la partícula está muy lejos del queso o muy cerca, resetearla cerca del robot
            const distToTarget = currentPos.distanceTo(this.targetPosition)
            const distToRobot = currentPos.distanceTo(robotPos)
            
            if (distToTarget < 2 || distToRobot > 200) {
                // Resetear partícula cerca del robot, en dirección al queso con variación
                const offsetDistance = 8 + Math.random() * 10
                const offset = directionToCheese.clone().multiplyScalar(offsetDistance)
                
                // Agregar variación perpendicular para efecto más natural
                const perpendicular = new THREE.Vector3(-directionToCheese.z, 0, directionToCheese.x)
                const sideOffset = (Math.random() - 0.5) * 5
                perpendicular.multiplyScalar(sideOffset)
                
                positions[i3] = robotPos.x + offset.x + perpendicular.x
                positions[i3 + 1] = robotPos.y + 1.5 + Math.random() * 3
                positions[i3 + 2] = robotPos.z + offset.z + perpendicular.z
            }
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true
    }

    setTarget(newTargetPosition) {
        this.targetPosition = newTargetPosition
    }

    remove() {
        if (this.particles) {
            this.scene.remove(this.particles)
            this.particles.geometry.dispose()
            this.particles.material.dispose()
        }
    }
}

