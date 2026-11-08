
import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import MobileControls from '../../controls/MobileControls.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import { getCoinsCountByLevel } from '../../services/levelsService.js'
import { getRanking, saveScore } from '../../services/scoresService.js'
import { chapterFor, EPILOGUE, GAME_OVER, OBJECTIVES, PROLOGUE } from '../../story.js'
import AmbientSound from './AmbientSound.js'
import Coins, { COIN_HEIGHT } from './Coins.js'
import CoinsParticles from './CoinsParticles.js'
import Enemy, { STATE_LABELS } from './Enemy.js'
import { archetypeFor, LEVEL_ROSTER } from './enemyArchetypes.js'
import EnemyDirector, { NOISE_LEVELS } from './EnemyDirector.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Fox from './Fox.js'
import Portal from './Portal.js'
import Robot from './Robot.js'
import Sound from './Sound.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'

// Nombres creativos de los niveles (solo para mostrar en la interfaz)
const LEVEL_NAMES = {
    1: 'El Campamento',
    2: 'Murallas Antiguas',
    3: 'La Noche Encantada',
    4: 'Bosque de Ajedrez',
    5: 'Cumbre Helada',
}
const levelName = (n) => LEVEL_NAMES[n] || `Nivel ${n}`

export default class World {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        // Sonidos
        this.coinSound = new Sound('/sounds/coin.ogg')
        this.ambientSound = new AmbientSound('/sounds/ambiente.mp3')
        this.winner = new Sound('/sounds/winner.mp3')

        this.allowPrizePickup = false
        this.hasMoved = false

        // Sistema de monedas
        this.coins = []
        this.maxCoins = 10
        this.coinsCollected = 0
        this.coinsModel = null
        this.coinsParticles = null
        this.portal = null
        this.spawnPosition = new THREE.Vector3(0, 0, 0) // Posición inicial del spawn

        // Sistema de coins del JSON (PASO 4)
        this.jsonCoinsCollected = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } // Coins del JSON recolectados por nivel
        this.jsonCoinsTotal = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } // Total de coins del JSON por nivel
        this.finalPrizeCollected = { 1: false, 2: false, 3: false, 4: false, 5: false } // Estado del finalPrize por nivel

        // Sistema de niveles
        this.currentLevel = 1
        this.level2Buildings = [] // Array para guardar los edificios del nivel 2
        this.level3Buildings = [] // Array para guardar los edificios del nivel 3
        this.level4Buildings = [] // Array para guardar los edificios del nivel 4
        this.level5Buildings = [] // Array para guardar los edificios del nivel 5
        this.level4Physics = [] // 
        this.level5Physics = [] //

        // Sistema de puntos
        this.points = 0 // Puntos del nivel actual
        this.totalPoints = 0 // Puntos totales acumulados entre todos los niveles
        this.pointsByLevel = { 1: 0, 2: 0, 3: 0 } // 📊 PASO 6: Puntos por nivel para desglose

        // Sistema de enemigos
        this.enemies = [] // Array para guardar los enemigos
        this.director = new EnemyDirector(experience) // sentidos compartidos y coordinación de la IA
        this.director.onEvent = (text, tone) => this.ui?.aiEvent(text, tone)
        this.director.onNoiseChange = (level) => this.ui?.setNoise(level)
        this._onKeyAI = (e) => {
            if (e.code === 'KeyI' && !['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) this.toggleAIPanel()
        }
        window.addEventListener('keydown', this._onKeyAI)
        this.enemyModels = [] // Array con los recursos de modelos de enemigos disponibles
        this.gameOver = false // Flag para controlar si el juego ha terminado
        this.roundActive = false // true cuando el jugador pulsó "Comenzar misión" del capítulo
        this.graceUntil = 0 // los enemigos no atrapan antes de este instante (performance.now)

        // Luz ambiental del atardecer (nivel 1)
        this.sunsetAmbient = null

        // Permitimos recoger premios tras 2s
        setTimeout(() => {
            this.allowPrizePickup = true
            console.log('✅ Ahora se pueden recoger premios')
        }, 2000)

        // Función para inicializar el mundo cuando los recursos estén listos
        const initializeWorld = async () => {
            // 1️⃣ Mundo base
            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)
            this.setLevel1Atmosphere()

            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()

            // 2️⃣ Personajes
            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)

            // Guardar posición inicial del spawn (donde aparece el robot)
            if (this.robot && this.robot.body) {
                this.spawnPosition.set(
                    this.robot.body.position.x,
                    this.robot.body.position.y,
                    this.robot.body.position.z
                )
            }

            // Inicializar sistema de monedas fijas
            await this.loadMaxCoinsFromBackend(this.currentLevel)
            this.countJsonCoinsByLevel()
            setTimeout(() => this.activateFixedCoins(), 1000)

            // Crear contador de monedas en el HUD
            this.createCoinsCounter()

            // Inicializar HUD de puntos totales
            this.updatePointsHUD()

            // 👾 Inicializar sistema de enemigos
            this.initializeEnemies()

            //Registrando experiencia VR con el robot
            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            // 3️⃣ Cámara
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            // 4️⃣ Controles móviles (tras crear robot)
            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })

            // 🚫 El nivel 1 quedó fuera del juego (sus modelos no están disponibles):
            // el juego arranca directamente en el nivel 2.
            await this.startLevel2()
        }

        // Verificar si los recursos ya están cargados
        if (this.resources.loaded === this.resources.toLoad && this.resources.toLoad > 0) {
            console.log('✅ Recursos ya cargados, inicializando mundo inmediatamente');
            initializeWorld();
        } else {
            this.resources.on('ready', initializeWorld);
        }
    }


    activateFixedCoins() {
        // Limpiar monedas de niveles anteriores que quedaron en escena
        if (this.loader?.prizes) {
            const oldPrizes = this.loader.prizes.filter(p => p.level !== this.currentLevel)
            oldPrizes.forEach(prize => {
                prize.collect()
                const idx = this.loader.prizes.indexOf(prize)
                if (idx !== -1) this.loader.prizes.splice(idx, 1)
            })
        }

        const allPrizes = this.loader?.prizes ?? []
        const levelPrizes = allPrizes.filter(
            p => p.role === 'default' && (p.level === this.currentLevel || !p.level)
        )

        // Sin monedas fijas en este nivel
        if (levelPrizes.length === 0) {
            if (this.maxCoins === 0) {
                // El backend también indica 0 monedas → abrir portal directamente
                this.coinsCollected = 0
                this.updateCoinsCounter()
                console.log('⚠️ Sin monedas en este nivel, abriendo portal...')
                this.clearEnemies()
                this.checkPortalConditions()
            } else {
                // El backend indica monedas dinámicas → no abrir portal aún
                console.log(`🪙 Sin monedas fijas, hay ${this.maxCoins} monedas dinámicas por recolectar`)
                this.updateCoinsCounter()
            }
            return
        }

        // Mezclar aleatoriamente
        for (let i = levelPrizes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[levelPrizes[i], levelPrizes[j]] = [levelPrizes[j], levelPrizes[i]]
        }

        const toShow = Math.min(this.maxCoins, levelPrizes.length)

        // Ocultar las que superen el límite del backend
        levelPrizes.slice(toShow).forEach(prize => {
            prize.collect()
            const idx = this.loader.prizes.indexOf(prize)
            if (idx !== -1) this.loader.prizes.splice(idx, 1)
        })

        this.maxCoins = toShow
        this.updateCoinsCounter()
        console.log(`🪙 Monedas fijas activadas: ${toShow} de ${levelPrizes.length} disponibles`)
    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    update(delta) {
        // Si el juego ha terminado, no actualizar nada
        if (this.gameOver) {
            return
        }

        // Actualiza personajes y cámara.
        // Hasta que el jugador pulsa "Comenzar misión" el robot no responde al teclado.
        this.fox?.update()
        if (this.roundActive) this.robot?.update()

        if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
            this.thirdPersonCamera.update()
        }

        // Gira premios
        this.loader?.prizes?.forEach(p => p.update(delta))

        // Actualiza monedas
        this.coins?.forEach(c => c.update(delta))

        // Actualizar enemigos
        if (this.roundActive && this.robot) this.director.update(this.robot)
        if (this.roundActive && this.enemies && this.enemies.length > 0 && this.robot) {
            const canCatch = performance.now() >= this.graceUntil
            this.enemies.forEach(enemy => {
                if (enemy) {
                    enemy.setTarget(this.robot)
                    enemy.update()

                    // Verificar colisión con el jugador (con margen de gracia al empezar)
                    if (canCatch && enemy.checkCollisionWithTarget()) {
                        this.onEnemyCollision()
                    }
                }
            })
        }

        // Brújula hacia el siguiente objetivo y panel de IA
        this.updateCompass()
        this.refreshAIPanel()

        // Actualizar partículas de la moneda
        if (this.coinsParticles && this.robot && this.coins.length > 0) {
            const robotPos = this.robot.body.position
            this.coinsParticles.update(robotPos)
        }

        // Actualizar portal y verificar interacción
        if (this.portal && this.portal.isActive) {
            this.portal.update(delta)

            // Verificar si el jugador está cerca del portal
            if (this.robot && this.robot.body) {
                const robotPos = this.robot.body.position
                const portalPos = this.portal.group.position
                const distance = robotPos.distanceTo(portalPos)

                // Si el jugador está a menos de 3 metros del portal, transportar
                if (distance < 3) {
                    this.enterPortal()
                }
            }
        }

        // Lógica de recogida
        if (!this.roundActive || !this.allowPrizePickup || !this.loader || !this.robot) return

        const pos = this.robot.body.position
        const speed = this.robot.body.velocity.length()
        const moved = speed > 0.5

        this.loader.prizes.forEach((prize, idx) => {
            if (prize.collected || !prize.pivot) return

            // Distancia sobre el suelo: el fragmento flota alto y el cuerpo físico está bajo
            const dist = Math.hypot(prize.pivot.position.x - pos.x, prize.pivot.position.z - pos.z)
            if (dist < 3.5 && moved) {
                // 📊 PASO 4: Rastrear coin del JSON recolectado
                const coinLevel = prize.level || this.currentLevel
                const coinRole = prize.role || 'default'

                if (coinRole === 'finalPrize') {
                    this.finalPrizeCollected[coinLevel] = true
                }

                prize.collect()
                this.loader.prizes.splice(idx, 1)

                this.points = (this.points || 0) + 1
                this.totalPoints = (this.totalPoints || 0) + 1
                this.robot.points = this.points

                if (coinRole === 'default') {
                    this.coinsCollected++
                    this.jsonCoinsCollected[coinLevel] = (this.jsonCoinsCollected[coinLevel] || 0) + 1
                    this.updateCoinsCounter()
                    this.showCoinNotification()
                    console.log(`🪙 Moneda fija recogida: ${this.coinsCollected}/${this.maxCoins} (JSON: ${this.jsonCoinsCollected[coinLevel]}/${this.jsonCoinsTotal[coinLevel]})`)
                    if (this.coinsCollected >= this.maxCoins) {
                        this.clearEnemies()
                        this.checkPortalConditions()
                    }
                }

                if (this.experience.raycaster?.removeRandomObstacles) {
                    const reduction = 0.2 + Math.random() * 0.1
                    this.experience.raycaster.removeRandomObstacles(reduction)
                }

                this.coinSound.play()
                this.updatePointsHUD()
            }
        })

        // 🧀 Lógica de recogida de monedas
        if (this.allowPrizePickup && this.robot && this.coins) {
            const robotPos = this.robot.body.position
            const speed = this.robot.body.velocity.length()
            const moved = speed > 0.5

            this.coins.forEach((coin, idx) => {
                if (coin.collected || !coin.pivot) return

                // Distancia en el suelo: la moneda flota alto y el cuerpo físico está bajo,
                // así que la altura no cuenta para recogerla.
                const dist = Math.hypot(coin.pivot.position.x - robotPos.x, coin.pivot.position.z - robotPos.z)
                if (dist < 3.5 && moved) {
                    coin.collect()
                    this.coins.splice(idx, 1)
                    this.coinsCollected++

                    this.points = (this.points || 0) + 1
                    this.totalPoints = (this.totalPoints || 0) + 1
                    this.robot.points = this.points

                    this.updatePointsHUD()
                    this.updateCoinsCounter()

                    if (this.coinsParticles) {
                        this.coinsParticles.remove()
                        this.coinsParticles = null
                    }

                    this.showCoinNotification()
                    console.log(`🪙 Moneda recogida. Total: ${this.coinsCollected}/${this.maxCoins}`)

                    if (this.coinsCollected >= this.maxCoins) {
                        this.clearEnemies()
                        console.log('👾 Enemigos eliminados - nivel completado')
                        this.checkPortalConditions()
                    } else {
                        setTimeout(() => {
                            this.generateCoins()
                        }, 500)
                    }
                }
            })
        }

    }

    /**
     * Valida si una posición está libre de colisiones con objetos GLB del escenario
     */
    isPositionValid(position, radius = 2.0, excludeObjects = []) {
        const testBox = new THREE.Box3()
        const testSize = new THREE.Vector3(radius * 2, radius * 2, radius * 2)
        testBox.setFromCenterAndSize(position, testSize)

        const excludeSet = new Set()
        excludeObjects.forEach(obj => {
            if (obj) excludeSet.add(obj)
            if (obj?.pivot) excludeSet.add(obj.pivot)
            if (obj?.group) excludeSet.add(obj.group)
            if (obj?.model) excludeSet.add(obj.model)
        })

        if (this.robot?.group) excludeSet.add(this.robot.group)
        if (this.robot?.model) excludeSet.add(this.robot.model)
        if (this.fox?.model) excludeSet.add(this.fox.model)
        if (this.floor?.mesh) excludeSet.add(this.floor.mesh)
        if (this.road?.mesh) excludeSet.add(this.road.mesh)
        if (this.portal?.group) excludeSet.add(this.portal.group)

        this.coins.forEach(coin => {
            if (coin.pivot) excludeSet.add(coin.pivot)
        })

        this.enemies.forEach(enemy => {
            if (enemy?.group) excludeSet.add(enemy.group)
            if (enemy?.model) excludeSet.add(enemy.model)
        })

        const sceneObjects = []

        if (this.currentLevel === 1) {
            this.scene.traverse((child) => {
                if (child instanceof THREE.Mesh &&
                    !excludeSet.has(child) &&
                    !excludeSet.has(child.parent) &&
                    child !== this.floor?.mesh &&
                    child !== this.road?.mesh) {
                    let isOtherLevel = false
                    if (this.level2Buildings && this.level2Buildings.length > 0) {
                        this.level2Buildings.forEach(building => {
                            building.traverse((buildingChild) => {
                                if (buildingChild === child || buildingChild === child.parent) {
                                    isOtherLevel = true
                                }
                            })
                        })
                    }
                    if (this.level3Buildings && this.level3Buildings.length > 0) {
                        this.level3Buildings.forEach(building => {
                            building.traverse((buildingChild) => {
                                if (buildingChild === child || buildingChild === child.parent) {
                                    isOtherLevel = true
                                }
                            })
                        })
                    }
                    if (!isOtherLevel) {
                        sceneObjects.push(child)
                    }
                }
            })
        } else if (this.currentLevel === 2) {
            if (this.level2Buildings && this.level2Buildings.length > 0) {
                this.level2Buildings.forEach(building => {
                    building.traverse((child) => {
                        if (child instanceof THREE.Mesh && !excludeSet.has(child) && !excludeSet.has(child.parent)) {
                            sceneObjects.push(child)
                        }
                    })
                })
            }
        } else if (this.currentLevel === 3) {
            if (this.level3Buildings && this.level3Buildings.length > 0) {
                this.level3Buildings.forEach(building => {
                    building.traverse((child) => {
                        if (child instanceof THREE.Mesh && !excludeSet.has(child) && !excludeSet.has(child.parent)) {
                            sceneObjects.push(child)
                        }
                    })
                })
            }
        }

        for (const obj of sceneObjects) {
            if (!obj.geometry) continue

            const objBox = new THREE.Box3()
            objBox.setFromObject(obj)

            if (obj.parent && obj.parent !== this.scene) {
                obj.parent.updateMatrixWorld(true)
                const worldBox = new THREE.Box3()
                obj.parent.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.geometry) {
                        const childBox = new THREE.Box3().setFromObject(child)
                        worldBox.union(childBox)
                    }
                })
                if (!worldBox.isEmpty()) {
                    objBox.copy(worldBox)
                }
            }

            if (testBox.intersectsBox(objBox)) {
                return false
            }
        }

        const raycaster = new THREE.Raycaster()
        const fromAbove = new THREE.Vector3(position.x, position.y + 50, position.z)
        const direction = new THREE.Vector3(0, -1, 0)
        raycaster.set(fromAbove, direction)

        const intersects = raycaster.intersectObjects(sceneObjects, true)
        if (intersects.length > 0) {
            for (const intersect of intersects) {
                if (intersect.point.y > position.y + 0.5) {
                    return false
                }
            }
        }

        return true
    }

    generateCoins() {
        if (!this.coinsModel || !this.robot || this.coins.length >= this.maxCoins) {
            return
        }

        const robotPos = this.robot.body.position
        let attempts = 0
        const maxAttempts = 100

        while (attempts < maxAttempts) {
            const angle = Math.random() * Math.PI * 2
            const distance = 80 + Math.random() * 20
            const x = robotPos.x + Math.cos(angle) * distance
            const z = robotPos.z + Math.sin(angle) * distance
            const y = COIN_HEIGHT // a la altura del pecho del personaje

            const coinsPosition = new THREE.Vector3(x, y, z)

            if (!this.isPositionValid(coinsPosition, 1.5, this.coins)) {
                attempts++
                continue
            }

            let tooClose = false
            for (const existingCoin of this.coins) {
                if (existingCoin.pivot) {
                    const dist = coinsPosition.distanceTo(existingCoin.pivot.position)
                    if (dist < 1.5) {
                        tooClose = true
                        break
                    }
                }
            }

            if (tooClose) {
                attempts++
                continue
            }

            const coin = new Coins({
                model: this.coinsModel.scene,
                position: coinsPosition,
                scene: this.scene
            })
            this.coins.push(coin)

            if (this.coinsParticles) {
                this.coinsParticles.remove()
            }
            this.coinsParticles = new CoinsParticles(this.scene, coinsPosition)

            console.log(`🪙 Moneda generada en: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`)
            return
        }
    }

    // ── Interfaz (HUD) ───────────────────────────────────────────────────────
    // Todo el dibujo vive en src/ui/GameUI.js; aquí solo se le pasa el estado del juego.
    get ui() {
        return this.experience.ui
    }

    createCoinsCounter() {
        this.updateLevelIndicator()
        this.updateCoinsCounter()
        this.updatePointsHUD()
        this.ui.setObjective(OBJECTIVES.collect)
        this.ui.setNoise(NOISE_LEVELS.quiet)
    }

    /** Libera listeners y efectos al destruir la experiencia (reiniciar o cerrar sesión). */
    dispose() {
        window.removeEventListener('keydown', this._onKeyAI)
        this.clearEnemies()
    }

    skipToNextLevel() {
        if (this.currentLevel === 1) this.startLevel2()
        else if (this.currentLevel === 2) this.startLevel3()
        else if (this.currentLevel === 3) this.startLevel4()
        else if (this.currentLevel === 4) this.startLevel5()
    }

    updateSkipButtonVisibility() {
        if (this.currentLevel >= 1 && this.currentLevel <= 4) {
            this.ui?.setSkip(`Atajo: saltar a ${levelName(this.currentLevel + 1)}`, () => this.skipToNextLevel())
        } else {
            this.ui?.setSkip(null)
        }
    }

    updateLevelIndicator() {
        const chapter = chapterFor(this.currentLevel)
        this.ui?.setChapter(chapter.kicker, levelName(this.currentLevel))
    }

    updateCoinsCounter() {
        this.ui?.setCoins(this.coinsCollected, this.maxCoins)
        this.updateSkipButtonVisibility()
    }

    updatePointsHUD() {
        this.ui?.setPoints(this.totalPoints)
    }

    async loadMaxCoinsFromBackend(level) {
        try {
            const coinsCount = await getCoinsCountByLevel(level)
            this.maxCoins = coinsCount
            console.log(`📊 maxCoins desde backend para nivel ${level}: ${coinsCount}`)
            this.updateCoinsCounter()
        } catch (error) {
            console.warn(`⚠️ Error al cargar maxCoins desde backend para nivel ${level}:`, error)
            this.maxCoins = 10
        }
    }

    showCoinNotification() {
        this.ui?.toast({
            icon: '🪙',
            text: `Fragmento de núcleo recuperado (${this.coinsCollected}/${this.maxCoins})`,
            tone: 'success',
            duration: 1600,
        })
    }

    // ── Capítulos y arranque de ronda ────────────────────────────────────────
    // Cuando un nivel termina de cargar se pide aquí empezar la ronda: se muestra la
    // historia del capítulo y los enemigos no aparecen hasta que el jugador pulsa "Comenzar".
    scheduleEnemies(delayMs = 1000) {
        this.pendingEnemyDelay = delayMs
        this.beginChapter(this.currentLevel)
    }

    beginChapter(level) {
        this.roundActive = false
        this.ui.setObjective(OBJECTIVES.collect)
        this.ui.setCompass(null)

        const chapter = chapterFor(level)
        const start = () => this.startRound()

        // Reintento tras un Game Over: sin tarjeta, directo a la acción
        if (this.skipChapterCard) {
            this.skipChapterCard = false
            start()
            return
        }

        const showChapter = () => this.ui.card({
            kicker: chapter.kicker,
            title: chapter.title,
            text: chapter.text,
            controls: !this.experience.gameStarted, // la guía de controles solo la primera vez
            actions: [{ label: 'Comenzar misión', onClick: start }],
        })

        if (!this.experience.gameStarted) {
            this.ui.card({
                kicker: PROLOGUE.kicker,
                title: PROLOGUE.title,
                paragraphs: PROLOGUE.paragraphs,
                actions: [{ label: 'Continuar', onClick: showChapter }],
            })
        } else {
            showChapter()
        }
    }

    startRound() {
        this.roundActive = true
        this.graceUntil = performance.now() + 4000 // margen de seguridad al empezar
        this.experience.startGame()
        this.ui.toast({ icon: '🎯', text: 'Recupera los fragmentos y cuidado con los mutantes', tone: 'info', duration: 3000 })
        setTimeout(() => this.generateEnemies(), this.pendingEnemyDelay ?? 1000)
    }

    // Brújula: apunta al fragmento más cercano o, cuando el núcleo está completo, al portal
    updateCompass() {
        const now = performance.now()
        if (now - (this._lastCompass || 0) < 90) return
        this._lastCompass = now

        const robot = this.robot?.body?.position
        const cam = this.experience.camera?.instance
        if (!robot || !cam || !this.roundActive) {
            this.ui.setCompass(null)
            return
        }

        let target = null
        let kind = 'coin'

        if (this.portal && this.portal.isActive && this.portal.group) {
            target = this.portal.group.position
            kind = 'portal'
        } else {
            let best = Infinity
            const consider = (pivot) => {
                const p = pivot?.position
                if (!p) return
                const d = (p.x - robot.x) ** 2 + (p.z - robot.z) ** 2
                if (d < best) { best = d; target = p }
            }
            this.loader?.prizes?.forEach((prize) => { if (!prize.collected) consider(prize.pivot) })
            this.coins?.forEach((coin) => { if (!coin.collected) consider(coin.pivot) })
        }

        if (!target) {
            this.ui.setCompass(null)
            return
        }

        cam.getWorldDirection(this._camDir || (this._camDir = new THREE.Vector3()))
        const fx = this._camDir.x
        const fz = this._camDir.z
        const dx = target.x - robot.x
        const dz = target.z - robot.z
        const forward = dx * fx + dz * fz
        const right = dx * -fz + dz * fx
        this.ui.setCompass({ angle: Math.atan2(right, forward), distance: Math.hypot(dx, dz), kind })
    }

    setLevel1Atmosphere() {
        // ── Cielo de atardecer casi oscuro ───────────────────────────────────
        this.scene.background = new THREE.Color('#1a0800')     // naranja-negro
        this.scene.fog = new THREE.FogExp2('#2d1200', 0.002)   // niebla rojiza tenue

        // Luz solar baja y naranja-fuego (como el sol hundiéndose)
        if (this.environment && this.environment.sunLight) {
            this.environment.sunLight.color.set('#ff5500')
            this.environment.sunLight.intensity = 1.2
            this.environment.sunLight.position.set(15, 1, -8)
        }

        // Quitar luz nocturna si venía del nivel 3
        if (this.nightAmbient) {
            this.scene.remove(this.nightAmbient)
            this.nightAmbient = null
        }

        // Luz ambiental rojiza muy tenue para que se vea algo pero dé miedo
        if (!this.sunsetAmbient) {
            this.sunsetAmbient = new THREE.AmbientLight('#1a0800', 2.5)
            this.scene.add(this.sunsetAmbient)
        }
    }

    async startLevel2() {
        console.log('🚀 Iniciando nivel 2...')
        this.currentLevel = 2

        // Restaurar cielo de día
        this.scene.background = new THREE.Color('#87ceeb')
        this.scene.fog = null
        if (this.environment && this.environment.sunLight) {
            this.environment.sunLight.color.set('#ffffff')
            this.environment.sunLight.intensity = 4
            this.environment.sunLight.position.set(3.5, 2, -1.25)
        }
        if (this.nightAmbient) {
            this.scene.remove(this.nightAmbient)
            this.nightAmbient = null
        }
        if (this.sunsetAmbient) {
            this.scene.remove(this.sunsetAmbient)
            this.sunsetAmbient = null
        }

        if (this.floor && this.floor.updateTextureForLevel) {
            this.floor.updateTextureForLevel(2)
        }

        this.updateLevelIndicator()
        await this.loadMaxCoinsFromBackend(2)
        this.countJsonCoinsByLevel()

        this.coinsCollected = 0
        this.pointsByLevel[1] = this.points
        this.points = 0

        this.jsonCoinsCollected[2] = 0
        this.finalPrizeCollected[2] = false

        this.updateSkipButtonVisibility()


        if (this.road && this.road.mesh) {
            this.scene.remove(this.road.mesh)
            this.road = null
        }

        if (this.loader && this.loader.clearLevel1Buildings) {
            this.loader.clearLevel1Buildings()
        }


        if (this.cheeseParticles) {
            this.cheeseParticles.remove()
            this.cheeseParticles = null
        }

        this.coins.forEach(coin => {
            if (coin.pivot) coin.collect()
        })
        this.coins = []
        this.coinsCollected = 0
        this.updateCoinsCounter()

        this.clearEnemies()

        if (this.portal && this.portal.group) {
            this.scene.remove(this.portal.group)
            this.portal = null
        }

        if (this.robot && this.robot.body) {
            this.robot.body.position.set(0, 1, 0)
            this.robot.body.velocity.set(0, 0, 0)
            this.spawnPosition.set(0, 0, 0)
        }

        await this.loader.loadBuildingsByLevel(2)

        this.scheduleEnemies(1500)
        setTimeout(() => this.activateFixedCoins(), 2000)
    }

    generateLevel2Buildings() {
        console.log('🏗️ Iniciando generación de edificios del nivel 2...')
        const world2Models = [
            'ancient_building', 'desert_stone_house', 'fantasy_house',
            'old_castle', 'old_castle_1', 'old_house', 'old_house_1', 'stone_building'
        ]

        const availableModels = []
        world2Models.forEach(modelName => {
            if (this.resources.items[modelName]) availableModels.push(modelName)
        })

        if (availableModels.length === 0) return

        const modelsToGenerate = []
        availableModels.forEach(modelName => {
            for (let i = 0; i < 15; i++) modelsToGenerate.push(modelName)
        })

        for (let i = modelsToGenerate.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [modelsToGenerate[i], modelsToGenerate[j]] = [modelsToGenerate[j], modelsToGenerate[i]]
        }

        const robotPos = this.robot?.body?.position || new THREE.Vector3(0, 0, 0)
        const maxRadius = 500, minRadius = 15, minSeparation = 0.5
        const existingBuildings = []

        modelsToGenerate.forEach((modelName) => {
            const model = this.resources.items[modelName]
            if (!model || !model.scene) return

            try {
                const originalBbox = new THREE.Box3().setFromObject(model.scene)
                let modelScale = 1.0, estimatedRadius = 2.0

                if (!originalBbox.isEmpty()) {
                    const originalSize = new THREE.Vector3()
                    originalBbox.getSize(originalSize)
                    const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z)

                    if (maxDimension > 1000) modelScale = 2.0
                    else if (maxDimension > 500) modelScale = 3.0
                    else if (maxDimension > 200) modelScale = 5.0
                    else if (maxDimension > 100) modelScale = 8.0
                    else if (maxDimension > 50) modelScale = 12.0
                    else if (maxDimension > 20) modelScale = 20.0
                    else modelScale = 40.0

                    estimatedRadius = Math.max(originalSize.x, originalSize.z) * modelScale / 2
                    estimatedRadius = Math.max(estimatedRadius, 1.0)
                }

                let positionFound = false, x = 0, z = 0, attempts = 0

                while (!positionFound && attempts < 150) {
                    attempts++
                    const angle = Math.random() * Math.PI * 2
                    const distance = minRadius + Math.random() * (maxRadius - minRadius)
                    x = robotPos.x + Math.cos(angle) * distance
                    z = robotPos.z + Math.sin(angle) * distance

                    let tooClose = false
                    for (const existing of existingBuildings) {
                        const dist = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(z - existing.z, 2))
                        if (dist < estimatedRadius + existing.radius + minSeparation) {
                            tooClose = true; break
                        }
                    }
                    if (!tooClose) {
                        positionFound = true
                        existingBuildings.push({ x, z, radius: estimatedRadius })
                    }
                }

                if (!positionFound) {
                    existingBuildings.push({ x, z, radius: estimatedRadius })
                }

                const buildingModel = model.scene.clone()
                buildingModel.scale.set(modelScale, modelScale, modelScale)
                buildingModel.updateMatrixWorld(true)

                const bbox = new THREE.Box3().setFromObject(buildingModel)
                let y = 0
                const localCenter = new THREE.Vector3()

                if (!bbox.isEmpty()) {
                    bbox.getCenter(localCenter)
                    const size = new THREE.Vector3()
                    bbox.getSize(size)
                    y = -bbox.min.y

                    if (size.x > 0 && size.y > 0 && size.z > 0) {
                        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2 * 0.95, size.y / 2 * 0.95, size.z / 2 * 0.95))
                        const body = new CANNON.Body({
                            mass: 0,
                            type: CANNON.Body.KINEMATIC,
                            shape: shape,
                            position: new CANNON.Vec3(x + localCenter.x, y + localCenter.y, z + localCenter.z),
                            material: this.experience.physics.obstacleMaterial
                        })

                        body.fixedRotation = true
                        body.updateMassProperties()
                        body.collisionFilterGroup = 1
                        body.collisionFilterMask = -1
                        body.isTrigger = false
                        body.allowSleep = false

                        this.experience.physics.world.addBody(body)
                        // 👻 SOLUCIÓN PARA LIMPIEZA DE FANTASMAS FÍSICOS
                        if (!this.level2Physics) this.level2Physics = []
                        this.level2Physics.push(body)
                    }
                }

                buildingModel.position.set(x, y, z)
                buildingModel.rotation.y = Math.random() * Math.PI * 2
                buildingModel.visible = true

                buildingModel.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.visible = true
                        child.castShadow = true
                        child.receiveShadow = true
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach((mat) => {
                                    if (mat) {
                                        mat.visible = true
                                        if (mat.opacity === 0) { mat.opacity = 1.0; mat.transparent = false }
                                    }
                                })
                            } else {
                                child.material.visible = true
                                if (child.material.opacity === 0) { child.material.opacity = 1.0; child.material.transparent = false }
                            }
                        }
                    }
                })

                this.scene.add(buildingModel)
                this.level2Buildings.push(buildingModel)

            } catch (error) { }
        })
    }

    async startLevel3() {
        console.log('🚀 Iniciando nivel 3...')
        this.currentLevel = 3

        if (this.floor && this.floor.updateTextureForLevel) {
            this.floor.updateTextureForLevel(3)
        }

        this.updateLevelIndicator()
        await this.loadMaxCoinsFromBackend(3)
        this.countJsonCoinsByLevel()

        this.coinsCollected = 0
        this.pointsByLevel[2] = this.points
        this.points = 0

        this.jsonCoinsCollected[3] = 0
        this.finalPrizeCollected[3] = false

        this.updateSkipButtonVisibility()

        // Remover edificios del nivel 2
        if (this.loader && this.loader.clearBuildingsByLevel) {
            this.loader.clearBuildingsByLevel(2)
        }
        if (this.level2Buildings && this.level2Buildings.length > 0) {
            this.level2Buildings.forEach(building => {
                if (building && building.parent) this.scene.remove(building)
            })
            this.level2Buildings = []
        }
        if (this.level2Physics && this.level2Physics.length > 0) {
            this.level2Physics.forEach(body => this.experience.physics.world.removeBody(body))
            this.level2Physics = []
        }

        if (this.cheeseParticles) {
            this.cheeseParticles.remove()
            this.cheeseParticles = null
        }

        this.coins.forEach(coin => { if (coin.pivot) coin.collect() })
        this.coins = []
        this.coinsCollected = 0
        this.updateCoinsCounter()

        this.clearEnemies()

        if (this.portal && this.portal.group) {
            this.scene.remove(this.portal.group)
            this.portal = null
        }

        if (this.robot && this.robot.body) {
            this.robot.body.position.set(0, 1, 0)
            this.robot.body.velocity.set(0, 0, 0)
            this.spawnPosition.set(0, 0, 0)
        }

        // Cielo nocturno
        this.scene.background = new THREE.Color('#0b0c2a')
        this.scene.fog = new THREE.FogExp2('#0b0c2a', 0.006)
        if (this.environment && this.environment.sunLight) {
            this.environment.sunLight.color.set('#334477')
            this.environment.sunLight.intensity = 1.0
        }
        if (!this.nightAmbient) {
            this.nightAmbient = new THREE.AmbientLight('#1a2050', 1.2)
            this.scene.add(this.nightAmbient)
        }

        await this.loader.loadBuildingsByLevel(3)
        this.activateFixedCoins()
        this.scheduleEnemies(1500)
    }

    generateLevel3Buildings() {
        console.log('🏗️ Iniciando generación de edificios del nivel 3...')

        const world3Models = [
            'windmill', 'market_stand', 'mine', 'watch_tower',
            'bell_tower', 'barracks', 'house_1', 'house'
        ]

        const availableModels = []
        world3Models.forEach(modelName => {
            if (this.resources.items[modelName]) availableModels.push(modelName)
        })

        if (availableModels.length === 0) return

        const modelsToGenerate = []
        availableModels.forEach(modelName => {
            for (let i = 0; i < 15; i++) modelsToGenerate.push(modelName)
        })

        for (let i = modelsToGenerate.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [modelsToGenerate[i], modelsToGenerate[j]] = [modelsToGenerate[j], modelsToGenerate[i]]
        }

        const robotPos = this.robot?.body?.position || new THREE.Vector3(0, 0, 0)
        const maxRadius = 500, minRadius = 15, minSeparation = 5.0
        const existingBuildings = []

        modelsToGenerate.forEach((modelName) => {
            const model = this.resources.items[modelName]
            if (!model || !model.scene) return

            try {
                const originalBbox = new THREE.Box3().setFromObject(model.scene)
                let modelScale = 1.0, estimatedRadius = 2.0

                if (!originalBbox.isEmpty()) {
                    const originalSize = new THREE.Vector3()
                    originalBbox.getSize(originalSize)
                    const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z)

                    if (maxDimension > 1000) modelScale = 2.0
                    else if (maxDimension > 500) modelScale = 2.5
                    else if (maxDimension > 200) modelScale = 3.5
                    else if (maxDimension > 100) modelScale = 5.0
                    else if (maxDimension > 50) modelScale = 7.0
                    else if (maxDimension > 20) modelScale = 15.0
                    else modelScale = 24.0

                    estimatedRadius = Math.max(originalSize.x, originalSize.z) * modelScale / 2
                    estimatedRadius = Math.max(estimatedRadius, 0.5)
                }

                let positionFound = false, x = 0, z = 0, attempts = 0
                while (!positionFound && attempts < 150) {
                    attempts++
                    const angle = Math.random() * Math.PI * 2
                    const distance = minRadius + Math.random() * (maxRadius - minRadius)
                    x = robotPos.x + Math.cos(angle) * distance
                    z = robotPos.z + Math.sin(angle) * distance

                    let tooClose = false
                    for (const existing of existingBuildings) {
                        const dist = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(z - existing.z, 2))
                        if (dist < estimatedRadius + existing.radius + minSeparation) {
                            tooClose = true; break
                        }
                    }
                    if (!tooClose) {
                        positionFound = true
                        existingBuildings.push({ x, z, radius: estimatedRadius })
                    }
                }

                if (!positionFound) {
                    existingBuildings.push({ x, z, radius: estimatedRadius })
                }

                const buildingModel = model.scene.clone()
                buildingModel.scale.set(modelScale, modelScale, modelScale)
                buildingModel.updateMatrixWorld(true)

                const bbox = new THREE.Box3().setFromObject(buildingModel)
                let y = 0
                const localCenter = new THREE.Vector3()

                if (!bbox.isEmpty()) {
                    bbox.getCenter(localCenter)
                    const size = new THREE.Vector3()
                    bbox.getSize(size)
                    y = -bbox.min.y

                    if (size.x > 0 && size.y > 0 && size.z > 0) {
                        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2 * 0.95, size.y / 2 * 0.95, size.z / 2 * 0.95))
                        const body = new CANNON.Body({
                            mass: 0,
                            type: CANNON.Body.KINEMATIC,
                            shape: shape,
                            position: new CANNON.Vec3(x + localCenter.x, y + localCenter.y, z + localCenter.z),
                            material: this.experience.physics.obstacleMaterial
                        })

                        body.fixedRotation = true
                        body.updateMassProperties()
                        body.collisionFilterGroup = 1
                        body.collisionFilterMask = -1

                        this.experience.physics.world.addBody(body)

                        if (!this.level3Physics) this.level3Physics = []
                        this.level3Physics.push(body)
                    }
                }

                buildingModel.position.set(x, y, z)
                buildingModel.rotation.y = Math.random() * Math.PI * 2
                buildingModel.visible = true

                this.scene.add(buildingModel)
                this.level3Buildings.push(buildingModel)
            } catch (error) { }
        })
    }

    countJsonCoinsByLevel() {
        if (!this.loader) return

        for (let level = 1; level <= 5; level++) {
            const coinsDefault = this.loader.getCoinsCountByLevel(level, 'default')
            const coinsFinalPrize = this.loader.getCoinsCountByLevel(level, 'finalPrize')

            this.jsonCoinsTotal[level] = coinsDefault
            this.jsonCoinsCollected[level] = 0
            this.finalPrizeCollected[level] = false
        }
    }

    checkPortalConditions() {
        const level = this.currentLevel
        const allDefaultCoinsCollected = this.jsonCoinsCollected[level] >= this.jsonCoinsTotal[level]
        const finalPrizeExists = this.loader.getCoinsCountByLevel(level, 'finalPrize') > 0
        const finalPrizeCollected = !finalPrizeExists || this.finalPrizeCollected[level]
        const allCoinsCollected = this.coinsCollected >= this.maxCoins

        if (allDefaultCoinsCollected && finalPrizeCollected && allCoinsCollected) {
            this.onAllCoinsCollected()
        }
    }

    onAllCoinsCollected() {
        const level = this.currentLevel
        const allDefaultCoinsCollected = this.jsonCoinsCollected[level] >= this.jsonCoinsTotal[level]
        const finalPrizeExists = this.loader.getCoinsCountByLevel(level, 'finalPrize') > 0
        const finalPrizeCollected = !finalPrizeExists || this.finalPrizeCollected[level]

        if (!allDefaultCoinsCollected || !finalPrizeCollected || this.portal) return

        this.ui.setObjective(OBJECTIVES.portal, true)
        this.ui.toast({
            icon: '⚡',
            text: this.currentLevel >= 5 ? 'Último núcleo completo. ¡El portal ha aparecido!' : `Núcleo completo. Se abrió un portal hacia ${levelName(this.currentLevel + 1)}`,
            tone: 'success',
            duration: 4500,
        })

        if (!this.robot || !this.robot.body) return

        const robotPos = this.robot.body.position
        const portalDistance = 50

        let portalPosition = null
        let attempts = 0

        while (attempts < 100 && !portalPosition) {
            const angle = Math.random() * Math.PI * 2
            const candidatePosition = new THREE.Vector3(
                robotPos.x + Math.cos(angle) * portalDistance, 0,
                robotPos.z + Math.sin(angle) * portalDistance
            )

            if (this.isPositionValid(candidatePosition, 3.0, [])) {
                portalPosition = candidatePosition
                break
            }
            attempts++
        }

        if (!portalPosition) {
            const defaultAngle = Math.random() * Math.PI * 2
            portalPosition = new THREE.Vector3(
                robotPos.x + Math.cos(defaultAngle) * portalDistance, 0,
                robotPos.z + Math.sin(defaultAngle) * portalDistance
            )
        }

        try {
            this.portal = new Portal({ position: portalPosition, scene: this.scene, resources: this.resources })
            this.portal.activate()
        } catch (error) { }
    }

    enterPortal() {
        if (!this.portal || !this.portal.isActive) return

        this.portal.isActive = false
        this.roundActive = false
        this.ui.setCompass(null)
        this.ui.toast({
            icon: this.currentLevel >= 5 ? '🏆' : '🌀',
            text: this.currentLevel >= 5 ? 'Cruzando el último portal…' : `Cruzando el portal hacia ${levelName(this.currentLevel + 1)}…`,
            tone: 'success',
            duration: 1500,
        })
        setTimeout(() => {
            if (this.currentLevel === 1) this.startLevel2()
            else if (this.currentLevel === 2) this.startLevel3()
            else if (this.currentLevel === 3) this.startLevel4()
            else if (this.currentLevel === 4) this.startLevel5()
            else if (this.currentLevel === 5) {
                this.pointsByLevel[5] = this.points
                this.showFinalScreen()
            }
        }, 1500)
    }

    initializeEnemies() {
        const enemyModelNames = [
            'enemyFastRun', 'enemyMutantWalking', 'enemyWalk', 'enemyWalking', 'enemyWheelbarrowWalk'
        ]

        // Guardamos el nombre del recurso: de él depende el arquetipo (comportamiento y marcha)
        this.enemyModels = []
        enemyModelNames.forEach(modelName => {
            const model = this.resources.items[modelName]
            if (model) this.enemyModels.push({ name: modelName, model })
        })

        // Los enemigos aparecen cuando el jugador pulsa "Comenzar misión" (scheduleEnemies)
    }

    generateEnemies() {
        if (!this.robot || !this.robot.body || this.enemyModels.length === 0) return

        this.clearEnemies()
        const roster = LEVEL_ROSTER[this.currentLevel] || LEVEL_ROSTER[3]
        const numberOfEnemies = this.currentLevel === 2 ? 3 : 5

        const robotPos = this.robot.body.position
        const spawnDistance = 100

        // Los guardianes patrullan alrededor de un fragmento de núcleo lejano
        const fragments = (this.loader?.prizes || [])
            .filter(p => p.pivot && !p.collected)
            .map(p => p.pivot.position)
            .filter(p => Math.hypot(p.x - robotPos.x, p.z - robotPos.z) > 40)
        let guardIndex = Math.floor(Math.random() * Math.max(fragments.length, 1))

        for (let i = 0; i < numberOfEnemies; i++) {
            const name = roster[i % roster.length]
            const entry = this.enemyModels.find(m => m.name === name) || this.enemyModels[i % this.enemyModels.length]
            const arch = archetypeFor(entry.name)

            let x, z, patrolCenter
            if (arch.guardsFragment && fragments.length > 0) {
                const f = fragments[guardIndex++ % fragments.length]
                x = f.x + 8
                z = f.z + 8
                patrolCenter = { x: f.x, y: 1, z: f.z }
            } else {
                const angle = Math.random() * Math.PI * 2
                x = robotPos.x + Math.cos(angle) * spawnDistance
                z = robotPos.z + Math.sin(angle) * spawnDistance
            }

            try {
                const enemy = new Enemy(this.experience, entry.model, { x, y: 1, z }, {
                    modelName: entry.name, id: i, patrolCenter,
                })
                enemy.setTarget(this.robot)
                this.director.register(enemy)
                enemy.setDebugVisible(this.director.debug)
                this.enemies.push(enemy)
            } catch (error) {
                console.warn('No se pudo crear un enemigo:', error)
            }
        }

        const names = this.enemies.map(e => e.label).join(', ')
        this.ui?.aiEvent(`Patrullan ${this.enemies.length} mutantes: ${names}`, 'info')
    }

    toggleAIPanel() {
        const on = !this.ui.aiPanelVisible
        this.ui.setAIPanelVisible(on)
        this.director.setDebug(on)
        this.refreshAIPanel(true)
    }

    refreshAIPanel(force = false) {
        if (!this.ui?.aiPanelVisible) return
        const now = performance.now()
        if (!force && now - (this._lastAIPanel || 0) < 250) return
        this._lastAIPanel = now
        const rows = this.director.snapshot().map(r => ({ ...r, stateLabel: STATE_LABELS[r.state] || r.state }))
        this.ui.updateAIPanel(rows)
    }

    clearEnemies() {
        this.enemies.forEach(enemy => {
            if (enemy) enemy.remove()
        })
        this.enemies = []
        this.director?.clear()
    }

    onEnemyCollision() {
        if (this.gameOver) return

        this.gameOver = true
        if (this.robot && this.robot.body) {
            this.robot.body.velocity.set(0, 0, 0)
            this.robot.body.angularVelocity.set(0, 0, 0)
        }

        this.roundActive = false
        this.ui.setCompass(null)
        this.ui.card({
            kicker: 'Game over',
            title: GAME_OVER.title,
            text: GAME_OVER.text,
            variant: 'danger',
            actions: [
                { label: `Reintentar: ${levelName(this.currentLevel)}`, onClick: () => this.repeatCurrentLevel() },
                { label: 'Volver al inicio', variant: 'ghost', onClick: () => this.restartGame() },
            ],
        })
    }

    async repeatCurrentLevel() {
        const level = this.currentLevel

        this.gameOver = false
        this.skipChapterCard = true // el jugador ya eligió reintentar: sin tarjeta de capítulo
        this.clearEnemies()

        // Limpiar monedas dinámicas
        this.coins.forEach(coin => { if (coin.pivot) coin.collect() })
        this.coins = []
        if (this.coinsParticles) { this.coinsParticles.remove(); this.coinsParticles = null }

        // Limpiar portal
        if (this.portal && this.portal.group) { this.scene.remove(this.portal.group); this.portal = null }

        // Limpiar monedas fijas del nivel actual del loader
        if (this.loader && this.loader.prizes) {
            const toRemove = this.loader.prizes.filter(p =>
                p.level === level || (level === 1 && !p.level)
            )
            toRemove.forEach(prize => {
                prize.collect()
                const idx = this.loader.prizes.indexOf(prize)
                if (idx !== -1) this.loader.prizes.splice(idx, 1)
            })
        }

        // Resetear contadores del nivel
        this.coinsCollected = 0
        this.points = 0
        this.jsonCoinsCollected[level] = 0
        this.finalPrizeCollected[level] = false
        this.updateCoinsCounter()

        // Resetear posición del robot
        if (this.robot && this.robot.body) {
            this.robot.body.position.set(0, 1, 0)
            this.robot.body.velocity.set(0, 0, 0)
            this.robot.body.angularVelocity.set(0, 0, 0)
            this.spawnPosition.set(0, 0, 0)
        }

        if (level === 1) {
            // Nivel 1: los edificios ya están en escena desde el inicio
            this.setLevel1Atmosphere()
            await this.loadMaxCoinsFromBackend(1)
            setTimeout(() => this.activateFixedCoins(), 500)
        } else {
            // Niveles 2-5: limpiar y recargar edificios del nivel actual
            const levelKey = `level${level}Buildings`
            const physicsKey = `level${level}Physics`

            if (this.loader && this.loader.clearBuildingsByLevel) {
                this.loader.clearBuildingsByLevel(level)
            }
            if (this[levelKey] && this[levelKey].length > 0) {
                this[levelKey].forEach(b => { if (b && b.parent) this.scene.remove(b) })
                this[levelKey] = []
            }
            if (this[physicsKey] && this[physicsKey].length > 0) {
                this[physicsKey].forEach(body => this.experience.physics.world.removeBody(body))
                this[physicsKey] = []
            }

            await this.loadMaxCoinsFromBackend(level)
            await this.loader.loadBuildingsByLevel(level)
            setTimeout(() => this.activateFixedCoins(), 500)
        }

        this.scheduleEnemies(1000)
    }

    restartGame() {
        // El nivel 1 está fuera del juego: reiniciar = recargar y arrancar limpio en el nivel 2
        window.location.reload()
    }

    async showFinalScreen() {
        this.gameOver = true
        try {
            if (this.ambientSound && this.ambientSound.isPlaying) {
                if (this.ambientSound.isPlaying && this.ambientSound.source) {
                    this.ambientSound.source.stop()
                    this.ambientSound.isPlaying = false
                }
            }
        } catch (error) { }

        try { if (this.winner) this.winner.play() } catch (error) { }

        let scoreSaved = false
        try {
            const savedScore = await saveScore(this.totalPoints, this.pointsByLevel, null)
            if (savedScore) scoreSaved = true
        } catch (error) { }

        let ranking = []
        try { ranking = await getRanking(5) } catch (error) { }

        const stats = [2, 3, 4, 5].map((n) => [levelName(n), `${this.pointsByLevel[n] || 0} pts`])
        stats.push(['Puntos totales', `${this.totalPoints} pts`])
        ranking.forEach((score, index) => {
            const userName = score.user?.email || score.user?.name || 'Anónimo'
            stats.push([`Ranking #${index + 1} · ${userName}`, `${score.totalPoints} pts`])
        })

        this.ui.setCompass(null)
        this.ui.card({
            kicker: EPILOGUE.kicker,
            title: EPILOGUE.title,
            text: scoreSaved ? `${EPILOGUE.text}\n\nTu puntuación quedó guardada en el servidor.` : EPILOGUE.text,
            variant: 'success',
            stats,
            actions: [
                { label: 'Jugar de nuevo', onClick: () => this.restartGame() },
            ],
        })
    }

    async startLevel4() {
        console.log('🚀 Iniciando nivel 4...')
        this.currentLevel = 4

        // Quitar noche y niebla del nivel 3
        this.scene.fog = null
        this.scene.background = new THREE.Color('#87ceeb')
        if (this.environment && this.environment.sunLight) {
            this.environment.sunLight.color.set('#ffffff')
            this.environment.sunLight.intensity = 4
        }
        if (this.nightAmbient) {
            this.scene.remove(this.nightAmbient)
            this.nightAmbient = null
        }

        if (this.floor && this.floor.updateTextureForLevel) {
            this.floor.updateTextureForLevel(4)
        }

        this.updateLevelIndicator()
        await this.loadMaxCoinsFromBackend(4)
        this.countJsonCoinsByLevel()
        this.coinsCollected = 0
        this.pointsByLevel[3] = this.points
        this.points = 0
        this.updateSkipButtonVisibility()
        this.showTeleportNotification(4)

        // Remover edificios del nivel 3
        if (this.loader && this.loader.clearBuildingsByLevel) {
            this.loader.clearBuildingsByLevel(3)
        }
        if (this.level3Buildings && this.level3Buildings.length > 0) {
            this.level3Buildings.forEach(building => {
                if (building && building.parent) this.scene.remove(building)
            })
            this.level3Buildings = []
        }
        if (this.level3Physics && this.level3Physics.length > 0) {
            this.level3Physics.forEach(body => this.experience.physics.world.removeBody(body))
            this.level3Physics = []
        }

        this.clearExistingProps()

        if (this.robot && this.robot.body) {
            this.robot.body.position.set(0, 1, 0)
            this.robot.body.velocity.set(0, 0, 0)
        }

        await this.loader.loadBuildingsByLevel(4)
        this.activateFixedCoins()
        this.scheduleEnemies(1500)
    }

    async startLevel5() {
        console.log('🚀 Iniciando nivel 5...')
        this.currentLevel = 5

        if (this.floor && this.floor.updateTextureForLevel) {
            this.floor.updateTextureForLevel(5)
        }

        this.updateLevelIndicator()
        await this.loadMaxCoinsFromBackend(5)
        this.countJsonCoinsByLevel()
        this.coinsCollected = 0
        this.pointsByLevel[4] = this.points
        this.points = 0
        this.updateSkipButtonVisibility()
        this.showTeleportNotification(5)

        // Limpiar edificios del nivel 4
        if (this.loader && this.loader.clearBuildingsByLevel) {
            this.loader.clearBuildingsByLevel(4)
        }
        if (this.level4Buildings && this.level4Buildings.length > 0) {
            this.level4Buildings.forEach(building => {
                if (building && building.parent) this.scene.remove(building)
            })
            this.level4Buildings = []
        }
        if (this.level4Physics && this.level4Physics.length > 0) {
            this.level4Physics.forEach(body => this.experience.physics.world.removeBody(body))
            this.level4Physics = []
        }

        this.clearExistingProps()

        if (this.robot && this.robot.body) {
            this.robot.body.position.set(0, 1, 0) // 
            this.robot.body.velocity.set(0, 0, 0)
        }

        await this.loader.loadBuildingsByLevel(5)
        this.activateFixedCoins()
        this.scheduleEnemies(1500)
    }

    showTeleportNotification(level) {
        this.ui?.toast({ icon: '🌀', text: `Rumbo a ${levelName(level)}…`, tone: 'info', duration: 2500 })
    }

    clearExistingProps() {
        if (this.coinsParticles) {
            this.coinsParticles.remove()
            this.coinsParticles = null
        }
        if (this.coins) {
            this.coins.forEach(c => c.collect())
            this.coins = []
        }
        if (this.portal && this.portal.group) {
            this.scene.remove(this.portal.group)
            this.portal = null
        }
        this.clearEnemies()
        this.scheduleEnemies(1500)
        setTimeout(() => this.generateCoins(), 2000)
    }

    generateDynamicLevel(level, modelName, customScale = 1.0) {
        const model = this.resources.items[modelName]
        if (model && model.scene) {
            const worldModel = model.scene.clone()
            worldModel.position.set(0, 0, 0)


            worldModel.scale.set(customScale, 1.0, customScale)
            worldModel.updateMatrixWorld(true)

            const physicsBodies = []

            const groundShape = new CANNON.Box(new CANNON.Vec3(500, 0.5, 500))
            const groundBody = new CANNON.Body({
                mass: 0,
                type: CANNON.Body.STATIC,
                position: new CANNON.Vec3(0, -0.5, 0),
                material: this.experience.physics.obstacleMaterial
            })
            this.experience.physics.world.addBody(groundBody)
            physicsBodies.push(groundBody)


            this.scene.add(worldModel)

            if (level === 4) {
                this.level4Buildings = [worldModel]
                this.level4Physics = physicsBodies
            }
            if (level === 5) {
                this.level5Buildings = [worldModel]
                this.level5Physics = physicsBodies
            }

            console.log(`✅ Nivel ${level} cargado con piso gigante invisible para evitar caídas al vacío.`)
        }
    }

    addTreesToLevel4() {
        console.log('🌲 Iniciando generación procedural de árboles del nivel 4...')
        const modelName = 'arbol_4'
        const model = this.resources.items[modelName]

        if (!model || !model.scene) return

        // ==========================================
        // 🎛️ PANEL DE CONTROL DEFINITIVO (NIVEL 4)
        // ==========================================
        const baseScale = 55.0
        const minSeparation = 25.0
        const minRadius = 25
        const maxRadius = 150
        const numberOfTrees = 60
        // ==========================================

        const robotPos = this.robot?.body?.position || new THREE.Vector3(0, 0, 0)
        const existingTrees = []

        for (let i = 0; i < numberOfTrees; i++) {
            try {
                const modelScale = baseScale * (0.8 + Math.random() * 0.4)
                let positionFound = false, x = 0, z = 0, attempts = 0

                while (!positionFound && attempts < 150) {
                    attempts++
                    const angle = Math.random() * Math.PI * 2
                    const distance = minRadius + Math.random() * (maxRadius - minRadius)
                    x = robotPos.x + Math.cos(angle) * distance
                    z = robotPos.z + Math.sin(angle) * distance

                    let tooClose = false
                    for (const existing of existingTrees) {
                        const dist = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(z - existing.z, 2))
                        if (dist < minSeparation) {
                            tooClose = true; break
                        }
                    }
                    if (!tooClose) positionFound = true
                }

                if (positionFound) {
                    existingTrees.push({ x, z })

                    const treeModel = model.scene.clone()
                    treeModel.scale.set(modelScale, modelScale, modelScale)
                    treeModel.updateMatrixWorld(true)

                    const bbox = new THREE.Box3().setFromObject(treeModel)
                    let y = 0
                    const localCenter = new THREE.Vector3()

                    if (!bbox.isEmpty()) {
                        bbox.getCenter(localCenter)
                        const size = new THREE.Vector3()
                        bbox.getSize(size)
                        y = -bbox.min.y // Ajusta la base al suelo


                    }

                    treeModel.position.set(x, y, z)
                    treeModel.rotation.y = Math.random() * Math.PI * 2

                    treeModel.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true; child.receiveShadow = true
                            if (child.material) {
                                child.material.needsUpdate = true
                                child.material.depthWrite = true
                                child.material.alphaTest = 0.5
                                if (child.material.transparent && child.material.opacity === 0) {
                                    child.material.opacity = 1; child.material.transparent = false
                                }
                            }
                        }
                    })

                    this.scene.add(treeModel)
                    this.level4Buildings.push(treeModel)
                }
            } catch (error) { }
        }
    }

    addTreesToLevel5() {
        console.log('🌴 Iniciando generación procedural de árboles del nivel 5...')
        const modelName = 'arbol_mundo5'
        const model = this.resources.items[modelName]

        if (!model || !model.scene) return

        // ==========================================
        // 🎛️ PANEL DE CONTROL DEFINITIVO (NIVEL 5)
        // ==========================================
        const baseScale = 45.0
        const minSeparation = 35.0
        const minRadius = 25
        const maxRadius = 150
        const numberOfTrees = 60
        // ==========================================

        const robotPos = this.robot?.body?.position || new THREE.Vector3(0, 0, 0)
        const existingTrees = []

        for (let i = 0; i < numberOfTrees; i++) {
            try {
                const modelScale = baseScale * (0.8 + Math.random() * 0.4)

                let positionFound = false, x = 0, z = 0, attempts = 0

                while (!positionFound && attempts < 150) {
                    attempts++
                    const angle = Math.random() * Math.PI * 2
                    const distance = minRadius + Math.random() * (maxRadius - minRadius)
                    x = robotPos.x + Math.cos(angle) * distance
                    z = robotPos.z + Math.sin(angle) * distance

                    let tooClose = false
                    for (const existing of existingTrees) {
                        const dist = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(z - existing.z, 2))
                        if (dist < minSeparation) {
                            tooClose = true; break
                        }
                    }
                    if (!tooClose) positionFound = true
                }

                if (positionFound) {
                    existingTrees.push({ x, z })

                    const treeModel = model.scene.clone()
                    treeModel.scale.set(modelScale, modelScale, modelScale)
                    treeModel.updateMatrixWorld(true)

                    const bbox = new THREE.Box3().setFromObject(treeModel)
                    let y = 0
                    const localCenter = new THREE.Vector3()

                    if (!bbox.isEmpty()) {
                        bbox.getCenter(localCenter)
                        const size = new THREE.Vector3()
                        bbox.getSize(size)
                        y = -bbox.min.y


                    }

                    treeModel.position.set(x, y, z)
                    treeModel.rotation.y = Math.random() * Math.PI * 2

                    treeModel.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true; child.receiveShadow = true
                            if (child.material) {
                                child.material.needsUpdate = true
                                child.material.depthWrite = true
                                child.material.alphaTest = 0.5
                                if (child.material.transparent && child.material.opacity === 0) {
                                    child.material.opacity = 1; child.material.transparent = false
                                }
                            }
                        }
                    })

                    this.scene.add(treeModel)
                    this.level5Buildings.push(treeModel)
                }
            } catch (error) { }
        }
    }
}