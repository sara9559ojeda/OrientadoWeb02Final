import * as CANNON from 'cannon-es'
import * as THREE from 'three'

export default class Floor {
    constructor(experience, initialLevel = 1) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.physics = this.experience.physics
        this.currentLevel = initialLevel

        this.setGeometry()
        this.setTextures()
        this.setMaterial()
        this.setMesh()
        this.setPhysics()
    }

    setGeometry() {
        // Suelo grande y fijo que cubre todo el área
        // 2000x2000 para cubrir las posiciones extremas del nivel 5 (hasta ~800 unidades del centro)
        this.size = { width: 2000, height: 3, depth: 2000 }
        this.geometry = new THREE.BoxGeometry(
            this.size.width,
            this.size.height,
            this.size.depth
        )
    }

    setTextures() {
        this.textures = {}
        this.updateTextureForLevel(this.currentLevel)
    }

    updateTextureForLevel(level) {
        this.currentLevel = level
        
        // Seleccionar textura según el nivel
        let textureName
        // Nivel 5: suelo blanco liso sin textura
        if (level === 5) {
            if (this.material) {
                this.material.map = null
                this.material.color.set('#ffffff')
                this.material.needsUpdate = true
            }
            return
        }

        switch(level) {
            case 1:
                textureName = 'pinkTexture'
                break
            case 2:
                textureName = 'texture1'
                break
            case 3:
                textureName = 'texture3'
                break
            case 4:
                textureName = 'grassColorTexture'
                break
            default:
                textureName = 'grassColorTexture'
        }

        // Obtener la textura del recurso
        const texture = this.resources.items[textureName]

        if (!texture) {
            this.textures.color = this.resources.items.grassColorTexture || null
        } else {
            this.textures.color = texture
        }

        if (this.textures.color) {
            this.textures.color.colorSpace = THREE.SRGBColorSpace
            const repeatValues = { 1: 50, 2: 30, 3: 40, 4: 60 }
            const repeatValue = repeatValues[level] ?? 40
            this.textures.color.repeat.set(repeatValue, repeatValue)
            this.textures.color.wrapS = THREE.RepeatWrapping
            this.textures.color.wrapT = THREE.RepeatWrapping

            if (this.material) {
                this.material.map = this.textures.color
                this.material.color.set('#ffffff')
                this.material.needsUpdate = true
            }
        }

        // Mantener la textura normal (opcional, puedes cambiarla también)
        if (this.resources.items.grassNormalTexture) {
            this.textures.normal = this.resources.items.grassNormalTexture
            this.textures.normal.repeat.set(50, 50)
            this.textures.normal.wrapS = THREE.RepeatWrapping
            this.textures.normal.wrapT = THREE.RepeatWrapping
            
            if (this.material) {
                this.material.normalMap = this.textures.normal
                this.material.needsUpdate = true
            }
        }
    }

    setMaterial() {
        this.material = new THREE.MeshStandardMaterial({
            map: this.textures.color || null,
            normalMap: this.textures.normal || null,
            color: 0xffffff // Color blanco para que la textura se vea correctamente
        })
    }

    setMesh() {
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        // Posicionar el suelo para que su superficie superior esté en Y = 0
        this.mesh.position.set(0, -this.size.height / 2, 0) 
        this.mesh.receiveShadow = true
        this.scene.add(this.mesh)
    }

    setPhysics() {
        const shape = new CANNON.Box(new CANNON.Vec3(
            this.size.width / 2,
            this.size.height / 2,
            this.size.depth / 2
        ))

        this.body = new CANNON.Body({
            mass: 0, // Estático
            shape: shape,
            // La superficie superior del suelo está en Y = 0
            position: new CANNON.Vec3(0, -this.size.height / 2, 0)
        })

        this.physics.world.addBody(this.body)
    }
}
