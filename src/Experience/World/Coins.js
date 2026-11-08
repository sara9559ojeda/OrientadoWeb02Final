import * as THREE from 'three'

// El personaje mide ~5-6 m: a 4.2 m la moneda queda a la altura del pecho/hombros
// (antes flotaba a 1.5 m, a la altura de las rodillas).
export const COIN_HEIGHT = 4.2
const COIN_BOB = 0.25 // amplitud del balanceo vertical

export default class Coins {
    constructor({ model, position, scene }) {
        this.scene = scene
        this.collected = false

        // 📌 Crear el pivot (grupo contenedor)
        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)

        // ✅ Clonar el modelo completo
        this.model = model.clone()

        // 🧠 Buscar el primer hijo con geometría
        const visual = this.model.children[0] || this.model

        // 🛠️ Resetear la posición del visual para que herede la del pivot
        visual.position.set(0, 0, 0)
        visual.rotation.set(0, 0, 0)
        visual.scale.set(6, 6, 6) // Escalar tamaño de la moneda

        // Agregar el visual al pivot
        this.pivot.add(visual)

        // ➕ Agregar el pivot (no el modelo) a la escena
        this.scene.add(this.pivot)
    }

    update(delta) {
        if (this.collected) return
        // Rotar la moneda lentamente
        this.pivot.rotation.y += delta * 2
        // Hacer que flote ligeramente
        this.pivot.position.y = COIN_HEIGHT + Math.sin(Date.now() * 0.001 + this.pivot.position.x) * COIN_BOB
    }

    collect() {
        this.collected = true
        this.scene.remove(this.pivot)
    }
}
