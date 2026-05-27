import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Sound from './Sound.js'

export default class Robot {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.physics = this.experience.physics
        this.keyboard = this.experience.keyboard
        this.debug = this.experience.debug
        this.points = 0

        this.setModel()
        this.setSounds()
        this.setPhysics()
        this.setAnimation()
    }

    setModel() {
        this.model = this.resources.items.robotModel.scene
        this.model.scale.set(0.3, 0.3, 0.3)
        this.model.position.set(0, -0.1, 0)

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })

        // Log de animaciones disponibles para diagnóstico
        const anims = this.resources.items.robotModel.animations
        console.log('🎭 Animaciones del astronaut:', anims.map(a => a.name))
    }

    setPhysics() {
        const shape = new CANNON.Sphere(0.4)
        this.body = new CANNON.Body({
            mass: 2,
            shape,
            position: new CANNON.Vec3(0, 1.2, 0),
            linearDamping: 0.05,
            angularDamping: 0.9
        })
        this.body.angularFactor.set(0, 1, 0)
        this.body.velocity.setZero()
        this.body.angularVelocity.setZero()
        this.body.sleep()
        this.body.material = this.physics.robotMaterial

        // Detectar contacto con el suelo para habilitar salto
        this.isOnGround = false
        this._jumpCooldown = 0
        this.body.addEventListener('collide', (e) => {
            const contact = e.contact
            // La normal apunta hacia arriba si colisionamos con algo debajo
            const normalY = contact.ni ? contact.ni.y : 0
            if (Math.abs(normalY) > 0.5) {
                this.isOnGround = true
            }
        })

        this.physics.world.addBody(this.body)
        setTimeout(() => { this.body.wakeUp() }, 100)
    }

    setSounds() {
        this.walkSound = new Sound('/sounds/robot/walking.mp3', { loop: true, volume: 0.5 })
        this.jumpSound = new Sound('/sounds/robot/jump.mp3', { volume: 0.8 })
    }

    // Busca una animación por palabras clave, devuelve la primera que coincida
    _findAnim(keywords) {
        const anims = this.resources.items.robotModel.animations
        for (const kw of keywords) {
            const found = anims.find(a => a.name.toLowerCase().includes(kw.toLowerCase()))
            if (found) return found
        }
        // Fallback: primera animación disponible
        return anims[0] || null
    }

    setAnimation() {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)
        this.animation.actions = {}

        // Detección automática de animaciones por nombre
        // Busca variantes comunes: 'idle', 'stand', 'rest' etc.
        const idleClip    = this._findAnim(['idle', 'stand', 'rest', 'default'])
        const walkClip    = this._findAnim(['walk', 'run', 'move'])
        const jumpClip    = this._findAnim(['jump', 'leap', 'fly'])
        const deathClip   = this._findAnim(['death', 'die', 'dead', 'fall'])
        const danceClip   = this._findAnim(['dance', 'celebrate', 'victory'])

        // Usar idle como fallback para animaciones no encontradas
        const fallback = idleClip

        this.animation.actions.idle    = idleClip  ? this.animation.mixer.clipAction(idleClip)  : null
        this.animation.actions.walking = walkClip  ? this.animation.mixer.clipAction(walkClip)  : null
        this.animation.actions.jump    = jumpClip  ? this.animation.mixer.clipAction(jumpClip)  : null
        this.animation.actions.death   = deathClip ? this.animation.mixer.clipAction(deathClip) : null
        this.animation.actions.dance   = danceClip ? this.animation.mixer.clipAction(danceClip) : null

        // Si alguna acción no existe, apuntarla al idle como fallback
        for (const key of ['idle', 'walking', 'jump', 'death', 'dance']) {
            if (!this.animation.actions[key] && fallback) {
                this.animation.actions[key] = this.animation.mixer.clipAction(fallback)
            }
        }

        // Configurar salto como LoopOnce
        if (this.animation.actions.jump) {
            this.animation.actions.jump.setLoop(THREE.LoopOnce)
            this.animation.actions.jump.clampWhenFinished = true
        }

        // Iniciar con idle
        this.animation.actions.current = this.animation.actions.idle
        if (this.animation.actions.current) {
            this.animation.actions.current.play()
        }

        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            if (!newAction || newAction === oldAction) return

            newAction.reset()
            newAction.play()
            if (oldAction) newAction.crossFadeFrom(oldAction, 0.3)
            this.animation.actions.current = newAction

            if (name === 'walking') {
                this.walkSound.play()
            } else {
                this.walkSound.stop()
            }

            if (name === 'jump') {
                this.jumpSound.play()
            }
        }
    }

    update() {
        if (this.animation.actions.current === this.animation.actions.death) return

        const delta = this.time.delta * 0.001
        this.animation.mixer.update(delta)

        const keys = this.keyboard.getState()
        const isSprinting = keys.shift
        const moveForce = isSprinting ? 220 : 120
        const maxSpeed = isSprinting ? 25 : 15
        const turnSpeed = 2.5
        let isMoving = false

        this.body.velocity.x = Math.max(Math.min(this.body.velocity.x, maxSpeed), -maxSpeed)
        this.body.velocity.z = Math.max(Math.min(this.body.velocity.z, maxSpeed), -maxSpeed)

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)

        // isOnGround se activa por evento collide (ver setPhysics), se apaga al saltar
        // _jumpCooldown evita saltos en bucle
        if (this._jumpCooldown > 0) {
            this._jumpCooldown -= delta
            this.isOnGround = false
        }

        if (keys.space && this.isOnGround && !(this._jumpCooldown > 0)) {
            this.isOnGround = false
            this._jumpCooldown = 0.5  // medio segundo antes de poder volver a saltar
            this.body.applyImpulse(new CANNON.Vec3(forward.x * 0.5, 3, forward.z * 0.5))
            this.animation.play('jump')
            return
        }

        if (this.body.position.y > 10) {
            console.warn('🚨 Robot fuera del escenario. Reubicando...')
            this.body.position.set(0, 1.2, 0)
            this.body.velocity.set(0, 0, 0)
        }

        if (keys.up) {
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(fwd.x * moveForce, 0, fwd.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        if (keys.down) {
            const bwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(bwd.x * moveForce, 0, bwd.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        if (keys.left) {
            this.group.rotation.y += turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
        if (keys.right) {
            this.group.rotation.y -= turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }

        if (isMoving) {
            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }
        } else {
            if (this.animation.actions.current !== this.animation.actions.idle) {
                this.animation.play('idle')
            }
        }

        this.group.position.copy(this.body.position)
    }

    moveInDirection(dir, speed) {
        if (!window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) return

        const mobile = window.experience?.mobileControls
        if (mobile?.intensity > 0) {
            const dir2D = mobile.directionVector
            const dir3D = new THREE.Vector3(dir2D.x, 0, dir2D.y).normalize()
            const adjustedSpeed = 250 * mobile.intensity
            const force = new CANNON.Vec3(dir3D.x * adjustedSpeed, 0, dir3D.z * adjustedSpeed)
            this.body.applyForce(force, this.body.position)

            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }

            const angle = Math.atan2(dir3D.x, dir3D.z)
            this.group.rotation.y = angle
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
    }


    revive(spawn = { x: 0, y: 1.5, z: 0 }) {
        // Si el cuerpo fue destruido por die(), recrearlo
        if (!this.body) {
            const shape = new CANNON.Sphere(0.4)
            this.body = new CANNON.Body({
                mass: 2,
                shape,
                position: new CANNON.Vec3(spawn.x, spawn.y, spawn.z),
                linearDamping: 0.05,
                angularDamping: 0.9
            })
            this.body.angularFactor.set(0, 1, 0)
            this.body.velocity.setZero()
            this.body.angularVelocity.setZero()
            this.body.material = this.physics.robotMaterial
            this.physics.world.addBody(this.body)
            console.log('♻️ Cuerpo físico del robot recreado')
        }

        // Restaurar posición y velocidades
        this.body.position.set(spawn.x, spawn.y, spawn.z)
        this.body.velocity.set(0, 0, 0)
        this.body.angularVelocity.set(0, 0, 0)
        this.body.quaternion.setFromEuler(0, 0, 0)
        this.body.wakeUp()

        // Restaurar detección de suelo
        this.isOnGround = false
        this._jumpCooldown = 0
        this.body.addEventListener('collide', (e) => {
            const contact = e.contact
            const normalY = contact.ni ? contact.ni.y : 0
            if (Math.abs(normalY) > 0.5) {
                this.isOnGround = true
            }
        })

        // Restaurar visual
        this.group.position.set(spawn.x, spawn.y, spawn.z)
        this.group.rotation.set(0, 0, 0)

        // Restaurar animación a idle
        if (this.animation?.actions?.idle && this.animation?.actions?.current !== this.animation?.actions?.idle) {
            if (this.animation.actions.current) this.animation.actions.current.fadeOut(0.2)
            this.animation.actions.idle.reset().fadeIn(0.2).play()
            this.animation.actions.current = this.animation.actions.idle
        }

        console.log('✅ Robot revivido en', spawn)
    }

    die() {
        if (this.animation.actions.current !== this.animation.actions.death) {
            if (this.animation.actions.current) {
                this.animation.actions.current.fadeOut(0.2)
            }
            if (this.animation.actions.death) {
                this.animation.actions.death.reset().fadeIn(0.2).play()
                this.animation.actions.current = this.animation.actions.death
            }

            this.walkSound.stop()

            if (this.physics.world.bodies.includes(this.body)) {
                this.physics.world.removeBody(this.body)
            }
            this.body = null

            this.group.position.y -= 0.5
            this.group.rotation.x = -Math.PI / 2

            console.log('💀 Astronaut ha muerto')
        }
    }
}