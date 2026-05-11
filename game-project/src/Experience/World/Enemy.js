import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.baseSpeed = 1.0
        this.speed = this.baseSpeed
        this.delayActivation = 0

        // Sonido de proximidad
        this.proximitySound = new Sound('/sounds/alert.ogg', { loop: true, volume: 0 })
        this._soundCooldown = 0
        this.proximitySound.play()

        // Usar el modelo dino si está disponible, si no usar el modelo pasado como parámetro
        const dinoResource = this.experience.resources.items.dinoModel
        if (dinoResource) {
            this.model = dinoResource.scene.clone()
            console.log('🦕 Usando modelo Dino para el enemigo')
            console.log('🎭 Animaciones del dino:', dinoResource.animations.map(a => a.name))
            this._setupDinoAnimations(dinoResource)
        } else {
            // Fallback al cubo rojo si el dino no cargó
            this.model = model.clone()
            console.warn('⚠️ Modelo dino no encontrado, usando cubo de fallback')
            this.mixer = null
        }

        this.model.scale.set(0.4, 0.4, 0.4)
        this.model.position.copy(position)
        this.scene.add(this.model)

        // Material físico
        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0.0

        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 5,
            shape,
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
            this.model.position.y = this.body.position.y
        }

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)
        this.model.userData.physicsBody = this.body

        // Colisión con robot
        this._onCollide = (event) => {
            if (event.body === this.playerRef.body) {
                if (typeof this.playerRef.die === 'function') {
                    this.playerRef.die()
                }
                if (this.proximitySound) this.proximitySound.stop()

                if (this.model.parent) {
                    new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: this.body.position,
                        sourcePosition: this.body.position,
                        experience: this.experience
                    })
                    this.destroy()
                }
            }
        }
        this.body.addEventListener('collide', this._onCollide)
    }

    // Busca una animación del dino por palabras clave
    _findDinoAnim(animations, keywords) {
        for (const kw of keywords) {
            const found = animations.find(a => a.name.toLowerCase().includes(kw.toLowerCase()))
            if (found) return found
        }
        return animations[0] || null
    }

    _setupDinoAnimations(dinoResource) {
        const anims = dinoResource.animations
        if (!anims || anims.length === 0) {
            this.mixer = null
            return
        }

        this.mixer = new THREE.AnimationMixer(this.model)

        const walkClip = this._findDinoAnim(anims, ['walk', 'run', 'move', 'chase'])
        const idleClip = this._findDinoAnim(anims, ['idle', 'stand', 'rest'])

        // Reproducir animación de caminar en loop
        const clipToPlay = walkClip || idleClip || anims[0]
        if (clipToPlay) {
            this.currentAction = this.mixer.clipAction(clipToPlay)
            this.currentAction.play()
        }
    }

    update(delta) {
        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body) return

        // Actualizar animación del dino
        if (this.mixer) {
            this.mixer.update(delta)
        }

        const targetPos = new CANNON.Vec3(
            this.playerRef.body.position.x,
            this.playerRef.body.position.y,
            this.playerRef.body.position.z
        )
        const enemyPos = this.body.position

        // Velocidad según distancia
        const distance = enemyPos.distanceTo(targetPos)
        this.speed = distance < 4 ? 2.5 : this.baseSpeed

        // Volumen del sonido según cercanía
        const maxDistance = 10
        const clampedDistance = Math.min(distance, maxDistance)
        const proximityVolume = 1 - (clampedDistance / maxDistance)
        if (this.proximitySound) {
            this.proximitySound.setVolume(proximityVolume * 0.8)
        }

        // Movimiento hacia el robot
        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            targetPos.y - enemyPos.y,
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.5) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.y = direction.y
            this.body.velocity.z = direction.z
        }

        // Sincronizar modelo visual con físicas
        this.model.position.copy(this.body.position)

        // Rotar el dino para que mire hacia el jugador
        if (distance > 0.5) {
            const angle = Math.atan2(
                targetPos.x - enemyPos.x,
                targetPos.z - enemyPos.z
            )
            this.model.rotation.y = angle
        }
    }

    destroy() {
        if (this.model) {
            this.scene.remove(this.model)
        }
        if (this.proximitySound) {
            this.proximitySound.stop()
        }
        if (this.mixer) {
            this.mixer.stopAllAction()
            this.mixer = null
        }
        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)
            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }
            this.body = null
        }
    }
}