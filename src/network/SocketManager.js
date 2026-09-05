// src/network/SocketManager.js
import { io } from 'socket.io-client'
import * as THREE from 'three'

export default class SocketManager {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.robots = {}
        this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
            autoConnect: true,
            reconnection: false
        })
        this.socket.on('connect', () => {
            console.log('🔌 Conectado a servidor:', this.socket.id)

            const initialPos = this.experience.world.robot?.body?.position || { x: 0, y: 0, z: 0 }
            this.socket.emit('new-player', { position: initialPos })
        })
        this.socket.on('spawn-player', (data) => {
            if (data.id === this.socket.id) return

            console.log('🧍 Nuevo jugador:', data.id)
            this._createRemoteRobot(data.id, data.position)
        })
        this.socket.on('players-update', (players) => {
            const total = Object.keys(players).length
            console.log('📡 Jugadores conectados:', total)

            if (this.experience.menu?.playersLabel) {
                this.experience.menu.playersLabel.innerText = `👥 Jugadores: ${total}`
            }
        })
        this.socket.on('update-player', ({ id, position, rotation }) => {
            const remote = this.robots[id]
            if (id !== this.socket.id && remote) {
                remote.model.position.set(position.x, position.y, position.z)
                remote.model.rotation.y = rotation
            }
        })

        this.socket.on('remove-player', (id) => {
            const data = this.robots[id]

            if (data) {
                if (data.model) {
                    this.scene.remove(data.model)

                    data.model.traverse(child => {
                        if (child.isMesh) {
                            child.geometry?.dispose()
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose?.())
                            } else {
                                child.material?.dispose?.()
                            }
                        }
                    })

                    data.model.userData.label?.remove()
                }

                delete this.robots[id]
            }
        })

        this.socket.on('existing-players', (others) => {
            others.forEach(data => {
                if (data.id !== this.socket.id && !this.robots[data.id]) {
                    this._createRemoteRobot(data.id, data.position, data.rotation, data.color)
                }
            })
        })
    }
        sendTransform(position, rotationY) {
            this.socket.emit('update-position', {
                position,
                rotation: rotationY
            })
        }

        _createRemoteRobot(id, position) {
            const original = this.experience.resources.items.girlModel

            if (!original || !original.animations) {
                console.warn('⚠️ girlModel no está completamente cargado')
                return
            }

            // Para modelos FBX, el modelo es directamente el objeto cargado (no tiene .scene)
            const model = original.clone()
            model.scale.set(0.01, 0.01, 0.01) // Misma escala que el personaje principal
            model.position.set(position.x, position.y - 0.5, position.z)

            const mixer = new THREE.AnimationMixer(model)
            const idleClip = original.animations.find(clip => clip.name.toLowerCase().includes('idle') || clip.name.toLowerCase().includes('walk')) || original.animations[0]
            if (idleClip) {
                const action = mixer.clipAction(idleClip)
                action.play()
            }

            this.robots[id] = {
                model,
                mixer
            }

            this.scene.add(model)

            const label = document.createElement('div')
            label.textContent = `🧍 ${id.slice(0, 4)}`
            Object.assign(label.style, {
                position: 'absolute',
                color: 'white',
                background: 'rgba(0,0,0,0.5)',
                padding: '2px 4px',
                fontSize: '12px',
                borderRadius: '4px',
                pointerEvents: 'none'
            })
            document.body.appendChild(label)

            model.userData.label = label
        }

        update(delta) {
            const robot = this.experience.world?.robot?.group
            if (robot) {
                const pos = robot.position
                const rotY = robot.rotation.y
                this.sendTransform(pos, rotY)
            }

            for (const id in this.robots) {
                const { model, mixer } = this.robots[id]
                if (mixer) mixer.update(delta)

                const label = model.userData.label
                if (label) {
                    const screenPos = model.position.clone().project(this.experience.camera.instance)
                    label.style.left = `${(screenPos.x * 0.5 + 0.5) * window.innerWidth}px`
                    label.style.top = `${(-screenPos.y * 0.5 + 0.5) * window.innerHeight}px`
                }
            }
        }
        destroy() {
            this.socket.disconnect()
            for (const id in this.robots) {
                const { model } = this.robots[id]

                if (model) {
                    this.scene.remove(model)

                    model.traverse(child => {
                        if (child.isMesh) {
                            child.geometry?.dispose()
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose?.())
                            } else {
                                child.material?.dispose?.()
                            }
                        }
                    })

                    if (model.userData.label) {
                        model.userData.label.remove()
                    }
                }
            }

            this.robots = {}
        }

    }

