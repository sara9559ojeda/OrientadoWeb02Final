import * as THREE from 'three'

export default class Portal {
    constructor({ position, scene, resources }) {
        this.scene = scene
        this.position = position
        this.resources = resources
        this.isActive = false
        this.time = 0
        
        // 📊 PASO 5: Variables para efectos de vórtice matemáticos
        this.vortexStrength = 1.0 // Intensidad del vórtice
        this.vortexSpeed = 2.0 // Velocidad de rotación del vórtice
        this.spiralTightness = 0.5 // Qué tan apretada es la espiral (0-1)
        this.particleVortexData = [] // Datos para partículas en espiral

        // Crear grupo para el portal
        this.group = new THREE.Group()
        // Asegurar que el portal esté en el suelo (Y = 0)
        this.group.position.set(position.x, 0, position.z)

        // Cargar modelo GLB del portal
        this.loadPortalModel()
        
        // Agregar efectos visuales
        this.addEffects()
        
        // Crear círculo vertical del portal (para poder entrar caminando)
        this.createVerticalPortalCircle()
        
        // Crear partículas que salen del portal
        this.createPortalParticles()

        // Inicialmente oculto
        this.group.visible = false
        this.scene.add(this.group)
    }
    
    loadPortalModel() {
        // Obtener el modelo del portal desde los recursos
        const portalGLB = this.resources?.items?.portalModel
        
        if (!portalGLB) {
            console.warn('⚠️ Modelo del portal no encontrado, usando estructura básica')
            this.createPortalStructure()
            return
        }
        
        // Clonar el modelo para evitar modificar el original
        this.portalMesh = portalGLB.scene.clone()
        
        // Configurar escala del portal (muy reducida para que sea pequeño)
        const scale = 0.005 // Escala muy reducida - ajustar según necesidad
        this.portalMesh.scale.set(scale, scale, scale)
        this.baseScale = scale // Guardar escala base
        
        // Centrar y posicionar el modelo en el suelo
        // Calcular bounding box para centrar correctamente
        const box = new THREE.Box3().setFromObject(this.portalMesh)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        // Ajustar posición para que la base esté en Y=0
        this.portalMesh.position.y = -center.y + (size.y / 2)
        this.portalMesh.position.x = -center.x
        this.portalMesh.position.z = -center.z
        
        // Aplicar rotación si es necesario (ajustar según el modelo)
        // this.portalMesh.rotation.y = Math.PI // Rotar 180° si es necesario
        
        // Habilitar sombras si el modelo las tiene
        this.portalMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
                child.receiveShadow = true
                
                // Mejorar materiales si es necesario
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat instanceof THREE.MeshStandardMaterial) {
                                mat.emissive = mat.emissive || new THREE.Color(0x00ffff)
                                mat.emissiveIntensity = mat.emissiveIntensity || 0.3
                            }
                        })
                    } else if (child.material instanceof THREE.MeshStandardMaterial) {
                        child.material.emissive = child.material.emissive || new THREE.Color(0x00ffff)
                        child.material.emissiveIntensity = child.material.emissiveIntensity || 0.3
                    }
                }
            }
        })
        
        this.group.add(this.portalMesh)
        console.log('✅ Modelo del portal cargado y configurado')
        console.log(`📏 Tamaño del portal: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`)
    }

    createPortalStructure() {
        const portalRadius = 3
        const portalHeight = 5
        
        // 1. Marco exterior del portal (anillo grande)
        const outerRingGeometry = new THREE.TorusGeometry(portalRadius, 0.4, 16, 64)
        const outerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1
        })
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial)
        outerRing.rotation.x = Math.PI / 2
        outerRing.position.y = portalHeight / 2
        this.group.add(outerRing)
        this.outerRing = outerRing

        // 2. Marco interior del portal (anillo más pequeño)
        const innerRingGeometry = new THREE.TorusGeometry(portalRadius * 0.85, 0.3, 16, 64)
        const innerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x0080ff,
            emissive: 0x0080ff,
            emissiveIntensity: 0.6,
            metalness: 0.9,
            roughness: 0.1
        })
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial)
        innerRing.rotation.x = Math.PI / 2
        innerRing.position.y = portalHeight / 2
        this.group.add(innerRing)
        this.innerRing = innerRing

        // 3. Pilares verticales del portal (4 pilares)
        const pillarHeight = portalHeight
        const pillarWidth = 0.3
        const pillarDepth = 0.3
        const pillarGeometry = new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth)
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.7,
            metalness: 0.8,
            roughness: 0.2
        })

        const pillarPositions = [
            { x: portalRadius, y: portalHeight / 2, z: 0 },
            { x: -portalRadius, y: portalHeight / 2, z: 0 },
            { x: 0, y: portalHeight / 2, z: portalRadius },
            { x: 0, y: portalHeight / 2, z: -portalRadius }
        ]

        this.pillars = []
        pillarPositions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial.clone())
            pillar.position.set(pos.x, pos.y, pos.z)
            this.group.add(pillar)
            this.pillars.push(pillar)
        })

        // 4. Plano central del portal (vórtice)
        const portalPlaneGeometry = new THREE.CircleGeometry(portalRadius * 0.8, 64)
        const portalPlaneMaterial = new THREE.MeshStandardMaterial({
            color: 0x0080ff,
            emissive: 0x0080ff,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness: 0.3
        })
        const portalPlane = new THREE.Mesh(portalPlaneGeometry, portalPlaneMaterial)
        portalPlane.rotation.x = Math.PI / 2
        portalPlane.position.y = portalHeight / 2 + 0.1
        this.group.add(portalPlane)
        this.portalPlane = portalPlane

        // 5. Base del portal (anillo en el suelo)
        const baseRingGeometry = new THREE.TorusGeometry(portalRadius + 0.5, 0.2, 16, 64)
        const baseRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.6,
            metalness: 0.7,
            roughness: 0.2
        })
        const baseRing = new THREE.Mesh(baseRingGeometry, baseRingMaterial)
        baseRing.rotation.x = Math.PI / 2
        baseRing.position.y = 0.05
        this.group.add(baseRing)
        this.baseRing = baseRing

        // 6. Partículas giratorias alrededor del portal (anillo de partículas)
        this.createOrbitingParticles()
    }

    createOrbitingParticles() {
        const particleCount = 50
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)
        
        const color1 = new THREE.Color(0x00ffff)
        const color2 = new THREE.Color(0x0080ff)
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            const angle = (i / particleCount) * Math.PI * 2
            const radius = 3.2
            const height = 2 + Math.sin(i) * 1.5
            
            positions[i3] = Math.cos(angle) * radius
            positions[i3 + 1] = height
            positions[i3 + 2] = Math.sin(angle) * radius
            
            const color = i % 2 === 0 ? color1 : color2
            colors[i3] = color.r
            colors[i3 + 1] = color.g
            colors[i3 + 2] = color.b
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        
        const material = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })
        
        this.orbitingParticles = new THREE.Points(geometry, material)
        this.group.add(this.orbitingParticles)
    }

    addEffects() {
        // Luz principal del portal (más intensa)
        const mainLight = new THREE.PointLight(0x00ffff, 8, 25)
        mainLight.position.set(0, 2.5, 0)
        this.group.add(mainLight)
        this.mainLight = mainLight

        // Luz adicional para efecto de resplandor
        const glowLight = new THREE.PointLight(0x0080ff, 5, 20)
        glowLight.position.set(0, 2, 0)
        this.group.add(glowLight)
        this.glowLight = glowLight

        // Luz direccional desde arriba
        const topLight = new THREE.SpotLight(0x00ffff, 3, 15, Math.PI / 4, 0.5)
        topLight.position.set(0, 6, 0)
        topLight.target.position.set(0, 0, 0)
        this.group.add(topLight)
        this.group.add(topLight.target)
        this.topLight = topLight

        // Anillo de brillo en el suelo
        const floorGlowGeometry = new THREE.RingGeometry(2.5, 4, 64)
        const floorGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        })
        const floorGlow = new THREE.Mesh(floorGlowGeometry, floorGlowMaterial)
        floorGlow.rotation.x = -Math.PI / 2
        floorGlow.position.y = 0.01
        this.group.add(floorGlow)
        this.floorGlow = floorGlow

        // Anillo vertical giratorio adicional
        const verticalGlowGeometry = new THREE.TorusGeometry(3.2, 0.2, 16, 64)
        const verticalGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        })
        const verticalGlow = new THREE.Mesh(verticalGlowGeometry, verticalGlowMaterial)
        verticalGlow.position.y = 2.5
        this.group.add(verticalGlow)
        this.verticalGlow = verticalGlow
    }

    createVerticalPortalCircle() {
        // Crear un círculo vertical grande para el efecto del portal
        const portalRadius = 2.5 // Radio del círculo del portal
        const portalCircleGeometry = new THREE.CircleGeometry(portalRadius, 64)
        const portalCircleMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            metalness: 0.5,
            roughness: 0.3
        })
        
        // Círculo vertical (perpendicular al suelo) - rotar 90° en X para que sea vertical
        this.portalCircle = new THREE.Mesh(portalCircleGeometry, portalCircleMaterial)
        this.portalCircle.rotation.x = Math.PI / 2 // Rotar 90° para que sea vertical
        this.portalCircle.position.y = 2.5 // Altura del centro del portal
        this.group.add(this.portalCircle)
        
        // Agregar borde brillante al círculo vertical
        const edgeGeometry = new THREE.RingGeometry(portalRadius * 0.95, portalRadius, 64)
        const edgeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        })
        this.portalEdge = new THREE.Mesh(edgeGeometry, edgeMaterial)
        this.portalEdge.rotation.x = Math.PI / 2 // Rotar 90° para que sea vertical
        this.portalEdge.position.y = 2.5
        this.group.add(this.portalEdge)
        
        console.log('✅ Círculo vertical del portal creado')
    }
    
    /**
     * 📊 PASO 5: Espiral de Arquímedes
     * r = a * θ
     * @param {number} theta - Ángulo en radianes
     * @param {number} a - Constante que controla el espaciado
     * @returns {number} - Radio
     */
    archimedeanSpiral(theta, a = 0.1) {
        return a * theta
    }
    
    /**
     * 📊 PASO 5: Espiral Logarítmica
     * r = a * e^(b * θ)
     * @param {number} theta - Ángulo en radianes
     * @param {number} a - Constante base
     * @param {number} b - Constante de crecimiento
     * @returns {number} - Radio
     */
    logarithmicSpiral(theta, a = 0.5, b = 0.15) {
        return a * Math.exp(b * theta)
    }
    
    /**
     * 📊 PASO 5: Función de distorsión usando seno/coseno
     * @param {number} x - Coordenada X
     * @param {number} z - Coordenada Z
     * @param {number} time - Tiempo
     * @param {number} frequency - Frecuencia de la distorsión
     * @param {number} amplitude - Amplitud de la distorsión
     * @returns {THREE.Vector3} - Vector de distorsión
     */
    distortionFunction(x, z, time, frequency = 2.0, amplitude = 0.3) {
        const dist = Math.sqrt(x * x + z * z)
        const angle = Math.atan2(z, x)
        
        // Distorsión radial usando seno
        const radialDistortion = Math.sin(dist * frequency + time * 2) * amplitude
        // Distorsión angular usando coseno
        const angularDistortion = Math.cos(angle * 3 + time * 1.5) * amplitude * 0.5
        
        return new THREE.Vector3(
            Math.cos(angle) * radialDistortion + Math.cos(angle + Math.PI / 2) * angularDistortion,
            0,
            Math.sin(angle) * radialDistortion + Math.sin(angle + Math.PI / 2) * angularDistortion
        )
    }
    
    createPortalParticles() {
        const particleCount = 300
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)
        const sizes = new Float32Array(particleCount)
        
        // Colores místicos (cian, azul, púrpura)
        const color1 = new THREE.Color(0x00ffff)
        const color2 = new THREE.Color(0x0080ff)
        const color3 = new THREE.Color(0x8000ff)
        
        // 📊 PASO 5: Inicializar datos de vórtice para cada partícula
        this.particleVortexData = []

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            
            // 📊 PASO 5: Inicializar partículas en espiral logarítmica
            const spiralAngle = (i / particleCount) * Math.PI * 8 // Múltiples vueltas
            const spiralRadius = this.logarithmicSpiral(spiralAngle, 0.3, 0.1)
            const height = 2.5 + Math.sin(spiralAngle * 2) * 1.0
            
            // Posición inicial en espiral
            positions[i3] = Math.cos(spiralAngle) * spiralRadius
            positions[i3 + 1] = height
            positions[i3 + 2] = Math.sin(spiralAngle) * spiralRadius
            
            // Guardar datos de vórtice para cada partícula
            this.particleVortexData.push({
                initialAngle: spiralAngle,
                initialRadius: spiralRadius,
                spiralType: Math.random() > 0.5 ? 'logarithmic' : 'archimedean', // Tipo de espiral
                speed: 0.5 + Math.random() * 0.5, // Velocidad individual
                phase: Math.random() * Math.PI * 2 // Fase aleatoria
            })
            
            // Colores aleatorios entre los tres colores místicos
            const colorChoice = Math.random()
            let color
            if (colorChoice < 0.33) {
                color = color1
            } else if (colorChoice < 0.66) {
                color = color2
            } else {
                color = color3
            }
            
            colors[i3] = color.r
            colors[i3 + 1] = color.g
            colors[i3 + 2] = color.b
            
            // Tamaños variados
            sizes[i] = 0.4 + Math.random() * 0.8
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
        
        const material = new THREE.PointsMaterial({
            size: 0.6,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })
        
        this.particles = new THREE.Points(geometry, material)
        this.particles.position.y = 0
        this.group.add(this.particles)
    }

    activate() {
        this.isActive = true
        this.group.visible = true
        console.log('🌀 Portal activado en:', this.group.position)
    }

    update(delta) {
        if (!this.isActive) return
        
        this.time += delta
        
        // Portal estático - NO rotar el grupo ni el modelo
        // this.group.rotation.y += delta * 0.2 // DESACTIVADO
        
        // Portal estático - NO rotar el modelo GLB
        // if (this.portalMesh) {
        //     this.portalMesh.rotation.y += delta * 0.15 // DESACTIVADO
        // }
        
        // 📊 PASO 5: Animar el círculo vertical del portal con distorsión matemática
        if (this.portalCircle) {
            // Pulso de opacidad
            this.portalCircle.material.opacity = 0.5 + Math.sin(this.time * 2) * 0.2
            
            // Efecto de vórtice (rotación del material, no del objeto)
            this.portalCircle.material.emissiveIntensity = 0.6 + Math.sin(this.time * 3) * 0.3
            
            // 📊 PASO 5: Aplicar distorsión al plano del portal usando funciones matemáticas
            // Optimización: Solo actualizar cada 2 frames para mejor rendimiento
            if (this.portalCircle.geometry && Math.floor(this.time * 30) % 2 === 0) {
                const vertices = this.portalCircle.geometry.attributes.position
                if (vertices && vertices.count > 0) {
                    const positions = vertices.array
                    const originalPositions = this.portalCircle.geometry.userData.originalPositions
                    
                    // Guardar posiciones originales si no existen
                    if (!originalPositions) {
                        this.portalCircle.geometry.userData.originalPositions = new Float32Array(positions)
                    } else {
                        // Aplicar distorsión basada en funciones seno/coseno
                        // Optimización: Procesar solo cada 3er vértice para mejor rendimiento
                        for (let i = 0; i < positions.length; i += 9) { // Cada 3er vértice (3 coordenadas * 3)
                            const x = originalPositions[i]
                            const z = originalPositions[i + 2]
                            
                            // Calcular distorsión
                            const distortion = this.distortionFunction(x, z, this.time, 2.0, 0.15)
                            
                            // Aplicar distorsión (solo en X y Z, mantener Y)
                            positions[i] = originalPositions[i] + distortion.x
                            positions[i + 2] = originalPositions[i + 2] + distortion.z
                            
                            // Aplicar distorsión suave a vértices adyacentes
                            if (i + 3 < positions.length) {
                                positions[i + 3] = originalPositions[i + 3] + distortion.x * 0.7
                                positions[i + 5] = originalPositions[i + 5] + distortion.z * 0.7
                            }
                            if (i + 6 < positions.length) {
                                positions[i + 6] = originalPositions[i + 6] + distortion.x * 0.5
                                positions[i + 8] = originalPositions[i + 8] + distortion.z * 0.5
                            }
                        }
                        vertices.needsUpdate = true
                    }
                }
            }
        }
        
        if (this.portalEdge) {
            // Borde brillante que pulsa
            this.portalEdge.material.opacity = 0.7 + Math.sin(this.time * 2.5) * 0.3
        }
        
        // Rotar anillos (solo si se usa la estructura básica) - DESACTIVADO para mantener portal estático
        // if (this.outerRing) {
        //     this.outerRing.rotation.z += delta * 0.3
        // }
        // if (this.innerRing) {
        //     this.innerRing.rotation.z -= delta * 0.2
        // }
        // if (this.verticalGlow) {
        //     this.verticalGlow.rotation.y += delta * 0.5
        //     this.verticalGlow.rotation.x = Math.sin(this.time) * 0.1
        // }
        
        // Rotar partículas orbitantes - DESACTIVADO para mantener portal estático
        // if (this.orbitingParticles) {
        //     this.orbitingParticles.rotation.y += delta * 0.4
        //     const positions = this.orbitingParticles.geometry.attributes.position.array
        //     const particleCount = positions.length / 3
        //     for (let i = 0; i < particleCount; i++) {
        //         const i3 = i * 3
        //         // Hacer que las partículas suban y bajen
        //         positions[i3 + 1] = 2 + Math.sin(this.time * 2 + i) * 1.5
        //     }
        //     this.orbitingParticles.geometry.attributes.position.needsUpdate = true
        // }
        
        // Hacer que el brillo del suelo pulse (sutil)
        if (this.floorGlow) {
            this.floorGlow.material.opacity = 0.5 + Math.sin(this.time * 2) * 0.2
            // NO rotar - mantener estático
            // this.floorGlow.rotation.z += delta * 0.1
        }
        
        // Hacer que el plano del portal pulse (solo pulso, sin rotación)
        if (this.portalPlane) {
            this.portalPlane.material.opacity = 0.7 + Math.sin(this.time * 3) * 0.2
            // NO rotar - mantener estático
            // this.portalPlane.rotation.z += delta * 0.3
        }
        
        // Hacer que las luces pulsen
        if (this.mainLight) {
            this.mainLight.intensity = 6 + Math.sin(this.time * 2) * 2
        }
        if (this.glowLight) {
            this.glowLight.intensity = 4 + Math.sin(this.time * 2.5) * 1.5
        }
        if (this.topLight) {
            this.topLight.intensity = 2 + Math.sin(this.time * 1.5) * 1
        }
        
        // 📊 PASO 5: Animar partículas con efectos de vórtice matemáticos
        if (this.particles && this.particleVortexData.length > 0) {
            const positions = this.particles.geometry.attributes.position.array
            const particleCount = positions.length / 3
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3
                const vortexData = this.particleVortexData[i]
                
                // Calcular nuevo ángulo con rotación acelerada hacia el centro
                const currentAngle = Math.atan2(positions[i3 + 2], positions[i3])
                const distance = Math.sqrt(positions[i3] * positions[i3] + positions[i3 + 2] * positions[i3 + 2])
                
                // Efecto de succión: aceleración hacia el centro basada en la distancia
                const suctionForce = Math.max(0, 1 - distance / 8) * this.vortexStrength
                const newAngle = currentAngle + (this.vortexSpeed * delta * vortexData.speed) + (suctionForce * delta * 0.5)
                
                // Calcular nuevo radio usando espiral (se reduce hacia el centro)
                let newRadius
                if (vortexData.spiralType === 'logarithmic') {
                    // Espiral logarítmica: se reduce exponencialmente
                    const spiralProgress = (this.time * vortexData.speed + vortexData.phase) % (Math.PI * 8)
                    newRadius = this.logarithmicSpiral(spiralProgress, 0.3, 0.1) * (1 - suctionForce * 0.5)
                } else {
                    // Espiral de Arquímedes: se reduce linealmente
                    const spiralProgress = (this.time * vortexData.speed + vortexData.phase) % (Math.PI * 8)
                    newRadius = this.archimedeanSpiral(spiralProgress, 0.1) * (1 - suctionForce * 0.5)
                }
                
                // Aplicar efecto de succión: reducir radio gradualmente
                const targetRadius = newRadius * (1 - suctionForce)
                const currentRadius = distance
                const radiusChange = (targetRadius - currentRadius) * delta * 2
                
                // Actualizar posición en espiral
                positions[i3] = Math.cos(newAngle) * (currentRadius + radiusChange)
                positions[i3 + 1] = 2.5 + Math.sin(this.time * 2 + vortexData.phase) * 1.0 + suctionForce * 0.5
                positions[i3 + 2] = Math.sin(newAngle) * (currentRadius + radiusChange)
                
                // Si la partícula está muy cerca del centro, resetearla
                const newDistance = Math.sqrt(positions[i3] * positions[i3] + positions[i3 + 2] * positions[i3 + 2])
                if (newDistance < 0.1) {
                    // Resetear a posición inicial en espiral
                    const resetAngle = vortexData.initialAngle + this.time * 0.5
                    const resetRadius = vortexData.spiralType === 'logarithmic' 
                        ? this.logarithmicSpiral(resetAngle, 0.3, 0.1)
                        : this.archimedeanSpiral(resetAngle, 0.1)
                    
                    positions[i3] = Math.cos(resetAngle) * resetRadius
                    positions[i3 + 1] = 2.5 + Math.sin(resetAngle * 2) * 1.0
                    positions[i3 + 2] = Math.sin(resetAngle) * resetRadius
                }
            }
            
            this.particles.geometry.attributes.position.needsUpdate = true
        }
    }
}
