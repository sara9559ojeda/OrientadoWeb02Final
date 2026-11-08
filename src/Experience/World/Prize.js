import * as THREE from 'three'

// Los datos de nivel colocan los fragmentos a ras de suelo con alturas dispares (y entre
// -2.3 y 0). El personaje mide ~6 m (pies en y=0.5), así que todos flotan a una misma altura
// absoluta a la altura del pecho, no de las rodillas.
export const PRIZE_HEIGHT = 4
const PRIZE_BOB = 0.25 // amplitud del balanceo vertical

export default class Prize {
    constructor({ model, position, scene }) {
        this.scene = scene
        this.collected = false

        // 📌 Crear el pivot (grupo contenedor)
        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)
        this.baseY = PRIZE_HEIGHT
        this.pivot.position.y = this.baseY
        this.pivot.scale.set(8, 8, 8)
        // ✅ Clonar el modelo completo
        this.model = model.clone()
this.model.scale.set(8, 8, 8)
        // 🧠 Buscar el primer hijo con geometría
        const visual = this.model.children[0] || this.model

        // 🛠️ Resetear la posición del visual para que herede la del pivot
        visual.position.set(0, 0, 0)
        visual.rotation.set(0, 0, 0)
        visual.scale.set(1, 1, 1)

        // Agregar el visual al pivot
        this.pivot.add(visual)

        // ➕ Agregar el pivot (no el modelo) a la escena
        this.scene.add(this.pivot)

        // 🪪 Debug
        console.log(`🎯 Premio en: (${position.x}, ${position.y}, ${position.z})`)
    }

    update(delta) {
        if (this.collected) return
        this.pivot.rotation.y += delta * 1.5
        // Flota suavemente (cada fragmento con su propia fase)
        this.pivot.position.y = this.baseY + Math.sin(Date.now() * 0.002 + this.pivot.position.x) * PRIZE_BOB
    }

    collect() {
        this.collected = true
        this.scene.remove(this.pivot)
    }
}
