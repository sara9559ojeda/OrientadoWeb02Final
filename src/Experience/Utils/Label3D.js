import * as THREE from 'three'

export default class Label3D {
    constructor({ text = '', color = 'white', size = 3, offset = new THREE.Vector3(0, 2, 0), target = null, camera }) {
        this.text = text
        this.color = color
        this.size = size
        this.offset = offset
        this.target = target
        this.camera = camera
        this.sprite = this.createTextLabel()
        
        if (this.target) {
            this.target.add(this.sprite)
            this.sprite.position.copy(this.offset)
        }
    }

    createTextLabel() {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 256
        const ctx = canvas.getContext('2d')

        ctx.font = 'bold 64px Arial'
        ctx.fillStyle = this.color
        ctx.textAlign = 'center'
        ctx.fillText(this.text, canvas.width / 2, canvas.height / 2 + 20)

        const texture = new THREE.CanvasTexture(canvas)
        texture.minFilter = THREE.LinearFilter

        const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
        const sprite = new THREE.Sprite(material)
        sprite.scale.set(this.size, this.size / 2, 1)

        return sprite
    }

    update() {
        if (this.camera && this.sprite) {
            this.sprite.lookAt(this.camera.position)
        }
    }
}
