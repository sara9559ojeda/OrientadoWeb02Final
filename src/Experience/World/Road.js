import * as THREE from 'three'

export default class Road {
    constructor(experience, buildingPositions = []) {
        this.experience = experience
        this.scene = experience.scene
        this.buildingPositions = buildingPositions
        
        this.setGeometry()
        this.createCheckeredTexture()
        this.setMaterial()
        this.setMesh()
    }

    setGeometry() {
        // Calcular el área que cubren los edificios para hacer la vía más grande
        if (this.buildingPositions.length > 0) {
            const xs = this.buildingPositions.map(p => p.x)
            const zs = this.buildingPositions.map(p => p.z)
            
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minZ = Math.min(...zs)
            const maxZ = Math.max(...zs)
            
            // Extender un poco más allá de los edificios
            const padding = 50
            this.width = Math.max(200, (maxX - minX) + padding * 2)
            this.depth = Math.max(200, (maxZ - minZ) + padding * 2)
            this.centerX = (minX + maxX) / 2
            this.centerZ = (minZ + maxZ) / 2
        } else {
            // Valores por defecto si no hay edificios
            this.width = 200
            this.depth = 200
            this.centerX = 0
            this.centerZ = 0
        }
        
        this.geometry = new THREE.PlaneGeometry(this.width, this.depth)
    }

    createCheckeredTexture() {
        // Crear textura de cuadritos programáticamente
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const context = canvas.getContext('2d')
        
        const tileSize = 32 // Tamaño de cada cuadrito
        const lightGray = '#808080' // Gris claro
        const darkGray = '#606060' // Gris oscuro
        
        // Dibujar patrón de cuadritos
        for (let y = 0; y < canvas.height; y += tileSize) {
            for (let x = 0; x < canvas.width; x += tileSize) {
                const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0
                context.fillStyle = isEven ? lightGray : darkGray
                context.fillRect(x, y, tileSize, tileSize)
            }
        }
        
        this.texture = new THREE.CanvasTexture(canvas)
        this.texture.wrapS = THREE.RepeatWrapping
        this.texture.wrapT = THREE.RepeatWrapping
        this.texture.repeat.set(this.width / 10, this.depth / 10) // Repetir el patrón
        this.texture.colorSpace = THREE.SRGBColorSpace
    }

    setMaterial() {
        this.material = new THREE.MeshStandardMaterial({
            map: this.texture,
            roughness: 0.8,
            metalness: 0.1
        })
    }

    setMesh() {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        // Rotar 90 grados en X para que esté horizontal
        this.mesh.rotation.x = -Math.PI / 2
        // Posicionar en Y = 0.02 (ligeramente por encima del suelo en Y = 0 para evitar z-fighting)
        // El suelo tiene su superficie superior en Y = 0, así que la vía debe estar justo encima
        this.mesh.position.set(this.centerX, 0.02, this.centerZ)
        this.mesh.receiveShadow = true
        this.mesh.castShadow = false // La vía no debe proyectar sombras
        this.scene.add(this.mesh)
    }
}

