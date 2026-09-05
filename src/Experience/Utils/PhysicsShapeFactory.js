import * as CANNON from 'cannon-es'
import * as THREE from 'three'

export function createBoxShapeFromModel(model, scaleFactor = 0.6) {
    const bbox = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    bbox.getSize(size)

    // Limitar tamaño máximo del collider para evitar clamped depth en cannon-es
    const maxSize = 80
    const halfX = Math.min((size.x / 2) * scaleFactor, maxSize)
    const halfY = Math.min((size.y / 2) * scaleFactor, maxSize)
    const halfZ = Math.min((size.z / 2) * scaleFactor, maxSize)

    return new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ))
}

// bodyCenter: THREE.Vector3 — posición donde se colocará el CANNON.Body.
// Los vértices se guardan en espacio local (mundo − bodyCenter) para que
// Cannon-ES aplique correctamente la posición del body sin doble offset.
export function createTrimeshShapeFromModel(model, bodyCenter) {
    const mergedPositions = []
    const mergedIndices = []
    let vertexOffset = 0

    model.updateMatrixWorld(true)

    const cx = bodyCenter ? bodyCenter.x : 0
    const cy = bodyCenter ? bodyCenter.y : 0
    const cz = bodyCenter ? bodyCenter.z : 0

    model.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const geometry = child.geometry.clone().toNonIndexed()
            const position = geometry.attributes.position
            if (!position) return

            const vertexCount = position.count
            for (let i = 0; i < vertexCount; i++) {
                const vertex = new THREE.Vector3().fromBufferAttribute(position, i)
                vertex.applyMatrix4(child.matrixWorld)
                mergedPositions.push(vertex.x - cx, vertex.y - cy, vertex.z - cz)
            }

            for (let i = 0; i < vertexCount / 3; i++) {
                mergedIndices.push(
                    vertexOffset + i * 3,
                    vertexOffset + i * 3 + 1,
                    vertexOffset + i * 3 + 2
                )
            }
            vertexOffset += vertexCount
        }
    })

    if (mergedPositions.length === 0) {
        console.warn('❌ No se pudo construir un Trimesh: modelo sin vértices')
        return null
    }

    const vertices = new Float32Array(mergedPositions)
    const indices = mergedIndices.length > 65535
        ? new Uint32Array(mergedIndices)
        : new Uint16Array(mergedIndices)

    return new CANNON.Trimesh(vertices, indices)
}



