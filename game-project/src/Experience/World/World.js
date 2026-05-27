import * as THREE from 'three'
import Environment from './Environment.js'
import Fox from './Fox.js'
import Robot from './Robot.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import Floor from './Floor.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'
import Sound from './Sound.js'
import AmbientSound from './AmbientSound.js'
import MobileControls from '../../controls/MobileControls.js'
import LevelManager from './LevelManager.js';
import BlockPrefab from './BlockPrefab.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Enemy from './Enemy.js'

// ✅ Headers necesarios para que ngrok no bloquee las peticiones
const FETCH_HEADERS = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
}

export default class World {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.blockPrefab = new BlockPrefab(this.experience)
        this.resources = this.experience.resources
        this.levelManager = new LevelManager(this.experience);
        this.finalPrizeActivated = false
        this.gameStarted = false
        this.enemies = []
        this.points = 0

        this.coinSound = new Sound('/sounds/coin.ogg')
        this.ambientSound = new AmbientSound('/sounds/ambiente.mp3')
        this.winner = new Sound('/sounds/winner.mp3')
        this.portalSound = new Sound('/sounds/portal.mp3')
        this.loseSound = new Sound('/sounds/lose.ogg')

        this.allowPrizePickup = false
        this.hasMoved = false

        setTimeout(() => {
            this.allowPrizePickup = true
        }, 2000)

        this.resources.on('ready', async () => {
            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)

            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()

            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)

            this.enemyTemplate = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            )
            const enemiesCountEnv = parseInt(import.meta.env.VITE_ENEMIES_COUNT || '3', 10)
            const enemiesCount = Number.isFinite(enemiesCountEnv) && enemiesCountEnv > 0 ? enemiesCountEnv : 3
            this.spawnEnemies(enemiesCount, 5.0)

            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })

            if (!this.experience.physics || !this.experience.physics.world) {
                console.error("🚫 Sistema de físicas no está inicializado al cargar el mundo.");
                return;
            }

            this._checkVRMode()

            this.experience.renderer.instance.xr.addEventListener('sessionstart', () => {
                this._checkVRMode()
            })
        })
    }

    spawnEnemies(count = 3, initialDelay = 5.0) {
        if (!this.robot?.body?.position) return
        const playerPos = this.robot.body.position
        const minRadius = 10
        const maxRadius = 18

        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = minRadius + Math.random() * (maxRadius - minRadius)
            const x = playerPos.x + Math.cos(angle) * radius
            const z = playerPos.z + Math.sin(angle) * radius
            const y = 1.5

            const enemy = new Enemy({
                scene: this.scene,
                physicsWorld: this.experience.physics.world,
                playerRef: this.robot,
                model: this.enemyTemplate,
                position: new THREE.Vector3(x, y, z),
                experience: this.experience
            })

            // initialDelay = tiempo base antes de que el enemigo empiece a perseguir
            // cada enemigo adicional tarda 0.5s más que el anterior
            enemy.delayActivation = initialDelay + i * 0.5
            this.enemies.push(enemy)
        }
    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    update(delta) {
        this.fox?.update()
        this.robot?.update()
        this.blockPrefab?.update()

        if (this.gameStarted) {
            this.enemies?.forEach(e => e.update(delta))

            const distToClosest = this.enemies?.reduce((min, e) => {
                if (!e?.body?.position || !this.robot?.body?.position) return min
                const d = e.body.position.distanceTo(this.robot.body.position)
                return Math.min(min, d)
            }, Infinity) ?? Infinity

            if (distToClosest < 1.0 && !this.defeatTriggered) {
                this.defeatTriggered = true

                if (window.userInteracted && this.loseSound) {
                    this.loseSound.play()
                }

                const firstEnemy = this.enemies?.[0]
                const enemyMesh = firstEnemy?.model || firstEnemy?.group
                if (enemyMesh) {
                    enemyMesh.scale.set(1.3, 1.3, 1.3)
                    setTimeout(() => { enemyMesh.scale.set(1, 1, 1) }, 500)
                }

                this.experience.modal.show({
                    icon: '💀',
                    message: '¡El enemigo te atrapó!\n¿Quieres intentarlo otra vez?',
                    buttons: [
                        {
                            text: '🔁 Reintentar',
                            onClick: () => this.experience.resetGameToFirstLevel()
                        },
                        {
                            text: '❌ Salir',
                            onClick: () => this.experience.resetGame()
                        }
                    ]
                })

                return
            }
        }

        if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
            this.thirdPersonCamera.update()
        }

        this.loader?.prizes?.forEach(p => p.update(delta))

        if (!this.allowPrizePickup || !this.loader || !this.robot || !this.robot.body) return

        let pos = null

        if (this.experience.renderer.instance.xr.isPresenting) {
            pos = this.experience.camera.instance.position
        } else if (this.robot?.body?.position) {
            pos = this.robot.body.position
        } else {
            return
        }

        const speed = this.robot?.body?.velocity?.length?.() || 0
        const moved = speed > 0.5

        this.loader.prizes.forEach((prize) => {
            if (!prize.pivot) return

            const dist = prize.pivot.position.distanceTo(pos)
            if (dist < 1.2 && moved && !prize.collected) {
                prize.collect()
                prize.collected = true

                if (prize.role === "default") {
                    this.points = (this.points || 0) + 1
                    this.robot.points = this.points

                    const pointsTarget = this.levelManager.getCurrentLevelTargetPoints()
                    console.log(`🎯 Monedas recolectadas: ${this.points} / ${pointsTarget}`)

                    if (!this.finalPrizeActivated && this.points === pointsTarget) {
                        const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                        if (finalCoin && !finalCoin.collected && finalCoin.pivot) {
                            finalCoin.pivot.visible = true
                            if (finalCoin.model) finalCoin.model.visible = true
                            this.finalPrizeActivated = true

                            new FinalPrizeParticles({
                                scene: this.scene,
                                targetPosition: finalCoin.pivot.position,
                                sourcePosition: this.robot.body.position,
                                experience: this.experience
                            })

                            this._spawnDiscoRays(finalCoin.pivot.position)

                            if (window.userInteracted) this.portalSound.play()
                            console.log("🪙 Coin final activado correctamente.")
                        }
                    }
                }

                if (prize.role === "finalPrize") {
                    console.log(`🏁 Moneda final recogida. Nivel: ${this.levelManager.currentLevel} / ${this.levelManager.totalLevels}`)

                    if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                        console.log(`➡️ Avanzando al nivel ${this.levelManager.currentLevel + 1}`)
                        this.levelManager.nextLevel()
                        this.points = 0
                        this.robot.points = 0
                        this.finalPrizeActivated = false
                    } else {
                        console.log(`🎉 Último nivel completado. Fin del juego.`)
                        const elapsed = this.experience.tracker.stop()
                        this.experience.tracker.saveTime(elapsed)
                        this.experience.tracker.showEndGameModal(elapsed)

                        this.experience.obstacleWavesDisabled = true
                        clearTimeout(this.experience.obstacleWaveTimeout)
                        this.experience.raycaster?.removeAllObstacles()

                        if (window.userInteracted) this.winner.play()
                    }
                }

                if (this.experience.raycaster?.removeRandomObstacles) {
                    const reduction = 0.2 + Math.random() * 0.1
                    this.experience.raycaster.removeRandomObstacles(reduction)
                }

                if (window.userInteracted) this.coinSound.play()
                this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`)
            }
        })

        // Activar finalPrize automáticamente si todas las monedas default fueron recolectadas
        if (!this.finalPrizeActivated && this.loader?.prizes) {
            const totalDefault = this.loader.prizes.filter(p => p.role === 'default').length
            const collectedDefault = this.loader.prizes.filter(p => p.role === 'default' && p.collected).length

            if (totalDefault > 0 && collectedDefault === totalDefault) {
                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                if (finalCoin && !finalCoin.collected && finalCoin.pivot) {
                    finalCoin.pivot.visible = true
                    if (finalCoin.model) finalCoin.model.visible = true
                    this.finalPrizeActivated = true

                    new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: finalCoin.pivot.position,
                        sourcePosition: this.experience.vrDolly?.position ?? this.experience.camera.instance.position,
                        experience: this.experience
                    })

                    this._spawnDiscoRays(finalCoin.pivot.position)

                    if (window.userInteracted) this.portalSound.play()
                    console.log("🪙 FinalPrize activado automáticamente.")
                }
            }
        }

        // Rotar faro
        if (this.discoRaysGroup) {
            this.discoRaysGroup.rotation.y += delta * 0.5
        }

        // Optimización física por distancia
        const playerPos = this.experience.renderer.instance.xr.isPresenting
            ? this.experience.camera.instance.position
            : this.robot?.body?.position

        if (playerPos) {
            this.scene.traverse((obj) => {
                if (obj.userData?.levelObject && obj.userData.physicsBody) {
                    const dist = obj.position.distanceTo(playerPos)
                    const shouldEnable = dist < 40 && obj.visible
                    const body = obj.userData.physicsBody
                    if (shouldEnable && !body.enabled) {
                        body.enabled = true
                    } else if (!shouldEnable && body.enabled) {
                        body.enabled = false
                    }
                }
            })
        }
    }

    _spawnDiscoRays(position) {
        if (this.discoRaysGroup) {
            this.discoRaysGroup.children.forEach(obj => {
                if (obj.geometry) obj.geometry.dispose()
                if (obj.material) obj.material.dispose()
            })
            this.scene.remove(this.discoRaysGroup)
            this.discoRaysGroup = null
        }

        this.discoRaysGroup = new THREE.Group()
        this.scene.add(this.discoRaysGroup)

        const rayMaterial = new THREE.MeshBasicMaterial({
            color: 0xaa00ff,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        })

        const rayCount = 4
        for (let i = 0; i < rayCount; i++) {
            const cone = new THREE.ConeGeometry(0.2, 4, 6, 1, true)
            const ray = new THREE.Mesh(cone, rayMaterial)
            ray.position.set(0, 2, 0)
            ray.rotation.x = Math.PI / 2
            ray.rotation.z = (i * Math.PI * 2) / rayCount

            const spot = new THREE.SpotLight(0xaa00ff, 2, 12, Math.PI / 7, 0.2, 0.5)
            spot.castShadow = false
            spot.shadow.mapSize.set(1, 1)
            spot.position.copy(ray.position)
            spot.target.position.set(
                Math.cos(ray.rotation.z) * 10,
                2,
                Math.sin(ray.rotation.z) * 10
            )

            this.discoRaysGroup.add(ray)
            this.discoRaysGroup.add(spot)
            this.discoRaysGroup.add(spot.target)
        }

        this.discoRaysGroup.position.copy(position)
    }

    async loadLevel(level) {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const apiUrl = `${backendUrl}/api/blocks?level=${level}`;

            let blocks = [];

            try {
                // ✅ Header ngrok para evitar bloqueo del tunnel browser warning
                const res = await fetch(apiUrl, { headers: FETCH_HEADERS });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    const preview = (await res.text()).slice(0, 120);
                    throw new Error(`Respuesta no-JSON: ${preview}`);
                }

                blocks = await res.json();
                console.log(`📦 Nivel ${level} desde API: ${blocks.length} bloques`);

            } catch (error) {
                console.warn(`⚠️ Backend no disponible para nivel ${level}. Usando JSON local...`);

                const publicPath = (p) => {
                    const base = import.meta.env.BASE_URL || '/';
                    return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
                };

                try {
                    const localUrl = publicPath(`data/toy_car_blocks${level}.json`);
                    const localRes = await fetch(localUrl);
                    if (!localRes.ok) throw new Error(`No existe ${localUrl}`);
                    blocks = await localRes.json();
                    console.log(`📂 ${blocks.length} bloques desde JSON local nivel ${level}`);
                } catch {
                    const fallbackUrl = publicPath('data/toy_car_blocks.json');
                    const fallbackRes = await fetch(fallbackUrl);
                    if (!fallbackRes.ok) throw new Error(`Sin datos para nivel ${level}`);
                    const allBlocks = await fallbackRes.json();
                    blocks = allBlocks.filter(b => b.level === level);
                    console.log(`📂 ${blocks.length} bloques del fallback genérico para nivel ${level}`);
                }
            }

            if (!blocks || blocks.length === 0) {
                console.warn(`⚠️ Sin bloques para nivel ${level}`)
                return
            }

            // Resetear estado
            this.points = 0;
            this.robot.points = 0;
            this.finalPrizeActivated = false;
            this.defeatTriggered = false;
            this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`);
            // Actualizar nivel en el HUD — Actividad 3
            this.experience.menu.setLevel?.(level, this.levelManager.totalLevels);

            // Modelos de física precisa
            const publicPath = (p) => {
                const base = import.meta.env.BASE_URL || '/';
                return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
            };
            const preciseUrl = publicPath('config/precisePhysicsModels.json');
            const preciseRes = await fetch(preciseUrl);
            if (!preciseRes.ok) throw new Error(`No se pudo cargar ${preciseUrl}`);
            const preciseModels = await preciseRes.json();

            console.log(`🗺️ Procesando ${blocks.length} bloques para nivel ${level}`)
            // Usar versión async para descargar modelos no precargados bajo demanda
            await this.loader._processBlocksAsync(blocks, preciseModels);

            this.loader.prizes.forEach(p => {
                if (p.pivot) p.pivot.visible = (p.role !== 'finalPrize');
                p.collected = false;
            });

            this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
            console.log(`🎯 Monedas en nivel ${level}: ${this.totalDefaultCoins}`);

            // Spawn point
            const spawnBlock = blocks.find(b => b.role === 'spawn');
            const spawnPoint = spawnBlock
                ? { x: spawnBlock.x, y: spawnBlock.y, z: spawnBlock.z }
                : { x: 0, y: 1.5, z: 0 };

            this.resetRobotPosition(spawnPoint);
            console.log(`✅ Nivel ${level} listo. Spawn:`, spawnPoint);

            this.allowPrizePickup = false
            setTimeout(() => { this.allowPrizePickup = true }, 2000)

            // Re-spawnear enemigos con 5s de delay para dar tiempo al jugador de orientarse
            const enemiesCountEnv = parseInt(import.meta.env.VITE_ENEMIES_COUNT || '3', 10)
            const enemiesCount = Number.isFinite(enemiesCountEnv) && enemiesCountEnv > 0 ? enemiesCountEnv : 3
            setTimeout(() => {
                this.spawnEnemies(enemiesCount, 5.0)
                console.log(`👾 Enemigos spawneados en nivel ${level} con 5s de delay inicial`)
            }, 1200) // esperar a que el robot esté reposicionado antes de spawnear

        } catch (error) {
            console.error('❌ Error cargando nivel:', error);
        }
    }

    clearCurrentScene() {
        if (!this.experience || !this.scene || !this.experience.physics || !this.experience.physics.world) {
            console.warn('⚠️ No se puede limpiar: sistema de físicas no disponible.');
            return;
        }

        let visualObjectsRemoved = 0;
        let physicsBodiesRemoved = 0;

        const childrenToRemove = [];
        this.scene.children.forEach((child) => {
            if (child.userData && child.userData.levelObject) {
                childrenToRemove.push(child);
            }
        });

        childrenToRemove.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.scene.remove(child);
            if (child.userData.physicsBody) {
                this.experience.physics.world.removeBody(child.userData.physicsBody);
            }
            visualObjectsRemoved++;
        });

        if (this.experience.physics && this.experience.physics.world && Array.isArray(this.experience.physics.bodies)) {
            const survivingBodies = [];
            this.experience.physics.bodies.forEach((body) => {
                if (body.userData && body.userData.levelObject) {
                    this.experience.physics.world.removeBody(body);
                    physicsBodiesRemoved++;
                } else {
                    survivingBodies.push(body);
                }
            });
            this.experience.physics.bodies = survivingBodies;
        }

        console.log(`🧹 Escena limpiada. Objetos eliminados: ${visualObjectsRemoved}, Cuerpos físicos: ${physicsBodiesRemoved}`);
        console.log(`🎯 Objetos restantes en escena: ${this.scene.children.length}`);

        if (this.loader && this.loader.prizes.length > 0) {
            this.loader.prizes.forEach(prize => {
                if (prize.pivot) {
                    this.scene.remove(prize.pivot);
                    prize.pivot.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    })
                }
            });
            this.loader.prizes = [];
            console.log('🎯 Premios eliminados.');
        }

        this.finalPrizeActivated = false;

        if (this.discoRaysGroup) {
            this.discoRaysGroup.children.forEach(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
            this.scene.remove(this.discoRaysGroup);
            this.discoRaysGroup = null;
        }
    }

    resetRobotPosition(spawn = { x: 0, y: 1.5, z: 0 }) {
        if (!this.robot) return

        // Usar revive() para manejar el caso en que el robot haya muerto (body=null)
        if (typeof this.robot.revive === 'function') {
            this.robot.revive(spawn)
        } else if (this.robot.body) {
            this.robot.body.position.set(spawn.x, spawn.y, spawn.z)
            this.robot.body.velocity.set(0, 0, 0)
            this.robot.body.angularVelocity.set(0, 0, 0)
            this.robot.body.quaternion.setFromEuler(0, 0, 0)
            this.robot.group.position.set(spawn.x, spawn.y, spawn.z)
            this.robot.group.rotation.set(0, 0, 0)
        }
    }

    async _processLocalBlocks(blocks) {
        const preciseRes = await fetch('/config/precisePhysicsModels.json');
        const preciseModels = await preciseRes.json();
        this.loader._processBlocks(blocks, preciseModels);

        this.loader.prizes.forEach(p => {
            if (p.pivot) p.pivot.visible = (p.role !== 'finalPrize');
            p.collected = false;
        });

        this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
    }

    _checkVRMode() {
        const isVR = this.experience.renderer.instance.xr.isPresenting

        if (isVR) {
            if (this.robot?.group) this.robot.group.visible = false
            if (this.enemy) this.enemy.delayActivation = 10.0
            this.experience.camera.instance.position.set(5, 1.6, 5)
            this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
        } else {
            if (this.robot?.group) this.robot.group.visible = true
        }
    }
}