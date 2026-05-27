import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBoxShapeFromModel, createTrimeshShapeFromModel } from '../Experience/Utils/PhysicsShapeFactory.js';
import Prize from '../Experience/World/Prize.js';

export default class ToyCarLoader {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.physics = this.experience.physics;
        this.prizes = [];

        // GLTFLoader propio para carga dinámica de modelos de niveles superiores
        this._gltfLoader = new GLTFLoader();
        // Cache de modelos cargados dinámicamente (evita recargar en reintentos)
        this._dynamicCache = {};
    }

    // ─── Carga dinámica de un modelo GLB por nombre ──────────────────────────
    // Primero busca en resources (nivel 1 precargado), luego en cache dinámico,
    // finalmente lo descarga del servidor si no existe en ningún lado.
    _loadModelAsync(name, path) {
        // 1) Ya está en resources (precargado al inicio)
        if (this.resources.items[name]) {
            return Promise.resolve(this.resources.items[name]);
        }

        // 2) Ya fue cargado dinámicamente antes
        if (this._dynamicCache[name]) {
            return Promise.resolve(this._dynamicCache[name]);
        }

        // 3) Cargarlo desde el servidor
        return new Promise((resolve) => {
            this._gltfLoader.load(
                path,
                (gltf) => {
                    this._dynamicCache[name] = gltf;
                    resolve(gltf);
                },
                undefined,
                (_err) => {
                    // Modelo no encontrado — omitir silenciosamente
                    resolve(null);
                }
            );
        });
    }


    // Actividad 6: genera una textura de canvas vistosa para cada cartel según nivel y índice
    _makeBillboardTexture(level, index) {
        const W = 512, H = 512
        const canvas = document.createElement('canvas')
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext('2d')

        // Paletas y temas por nivel
        const themes = [
            { bg: '#0a0a2e', accent: '#00e5ff', text: '#ffffff', emoji: '🚀', title: 'NIVEL 1', sub: 'ESPACIO PROFUNDO' },
            { bg: '#1a0a00', accent: '#ff6600', text: '#ffdd00', emoji: '🔥', title: 'NIVEL 2', sub: 'ZONA DE PELIGRO' },
            { bg: '#001a0a', accent: '#00ff88', text: '#ffffff', emoji: '⚡', title: 'NIVEL 3', sub: 'ENERGIA EXTREMA' },
            { bg: '#1a001a', accent: '#ff00ff', text: '#ffffff', emoji: '💎', title: 'NIVEL 4', sub: 'DIMENSION OCULTA' },
            { bg: '#1a1a00', accent: '#ffff00', text: '#ffffff', emoji: '🏆', title: 'NIVEL 5', sub: 'JEFE FINAL' },
        ]

        const altSubs = [
            ['CUIDADO ENEMIGO', '¡RECOGE MONEDAS!'],
            ['¡NO TE ATRAPEN!', 'CORRE MAS RAPIDO'],
            ['ZONA RESTRINGIDA', '¡PELIGRO MAXIMO!'],
            ['RECUERDA SALTAR', 'EVITA AL ENEMIGO'],
            ['¡ULTIMO NIVEL!',  'DA TODO DE TI'],
        ]

        const t = themes[Math.min(level - 1, themes.length - 1)]
        const subText = index === 0 ? t.sub : (altSubs[Math.min(level - 1, altSubs.length - 1)][1] || t.sub)

        // Fondo
        ctx.fillStyle = t.bg
        ctx.fillRect(0, 0, W, H)

        // Borde brillante
        ctx.strokeStyle = t.accent
        ctx.lineWidth = 14
        ctx.strokeRect(10, 10, W - 20, H - 20)

        // Borde interior
        ctx.strokeStyle = t.text
        ctx.lineWidth = 3
        ctx.strokeRect(24, 24, W - 48, H - 48)

        // Banda superior degradada
        const grad = ctx.createLinearGradient(0, 0, W, 0)
        grad.addColorStop(0, t.accent + '44')
        grad.addColorStop(0.5, t.accent + 'aa')
        grad.addColorStop(1, t.accent + '44')
        ctx.fillStyle = grad
        ctx.fillRect(24, 24, W - 48, 120)

        // Emoji grande
        ctx.font = 'bold 100px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(t.emoji, W / 2, 84)

        // Título principal
        ctx.font = 'bold 72px Arial Black, Arial'
        ctx.fillStyle = t.accent
        ctx.shadowColor = t.accent
        ctx.shadowBlur = 20
        ctx.fillText(t.title, W / 2, 200)
        ctx.shadowBlur = 0

        // Línea divisoria
        ctx.strokeStyle = t.accent
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(60, 255); ctx.lineTo(W - 60, 255)
        ctx.stroke()

        // Subtítulo
        ctx.font = 'bold 38px Arial'
        ctx.fillStyle = t.text
        ctx.fillText(subText, W / 2, 320)

        // Puntos decorativos
        for (let i = 0; i < 5; i++) {
            ctx.beginPath()
            ctx.arc(80 + i * 90, 410, 14, 0, Math.PI * 2)
            ctx.fillStyle = i < (level) ? t.accent : t.accent + '33'
            ctx.fill()
        }

        // Texto inferior
        ctx.font = '28px Arial'
        ctx.fillStyle = t.accent + 'cc'
        ctx.fillText('● AVENTURA ESPACIAL ●', W / 2, 470)

        const texture = new THREE.CanvasTexture(canvas)
        return texture
    }

    _applyTextureToMeshes(root, imagePath, matcher, options = {}) {
        const matchedMeshes = [];
        root.traverse((child) => {
            if (child.isMesh && (!matcher || matcher(child))) {
                matchedMeshes.push(child);
            }
        });

        if (matchedMeshes.length === 0) return;

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            imagePath,
            (texture) => {
                if ('colorSpace' in texture) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    texture.encoding = THREE.sRGBEncoding;
                }
                texture.flipY = false;
                const wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
                const wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
                texture.wrapS = wrapS;
                texture.wrapT = wrapT;
                const maxAniso = this.experience?.renderer?.instance?.capabilities?.getMaxAnisotropy?.();
                if (typeof maxAniso === 'number' && maxAniso > 0) {
                    texture.anisotropy = maxAniso;
                }
                const center = options.center || { x: 0.5, y: 0.5 };
                texture.center.set(center.x, center.y);
                if (typeof options.rotation === 'number') {
                    texture.rotation = options.rotation;
                }
                if (options.repeat) {
                    texture.repeat.set(options.repeat.x || 1, options.repeat.y || 1);
                }
                if (options.mirrorX) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.repeat.x = -Math.abs(texture.repeat.x || 1);
                    texture.offset.x = 1;
                }
                if (options.mirrorY) {
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.y = -Math.abs(texture.repeat.y || 1);
                    texture.offset.y = 1;
                }
                if (options.offset) {
                    texture.offset.set(
                        options.offset.x ?? texture.offset.x,
                        options.offset.y ?? texture.offset.y
                    );
                }
                texture.needsUpdate = true;

                matchedMeshes.forEach((child) => {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => { mat.map = texture; mat.needsUpdate = true; });
                    } else if (child.material) {
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    } else {
                        child.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
                    }
                });
            },
            undefined,
            (err) => { console.error('❌ Error cargando textura', imagePath, err); }
        );
    }

    async loadFromAPI() {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            let blocks = [];

            try {
                const apiUrl = import.meta.env.VITE_API_URL + '/api/blocks';
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error('Conexión fallida');
                blocks = await res.json();
                console.log('Datos cargados desde la API:', blocks.length);
            } catch (apiError) {
                console.warn('No se pudo conectar con la API. Cargando desde archivo local...');
                const localRes = await fetch('/data/toy_car_blocks.json');
                const allBlocks = await localRes.json();
                blocks = allBlocks.filter(b => b.level === 1);
                console.log(`Datos cargados desde archivo local (nivel 1): ${blocks.length}`);
            }

            await this._processBlocksAsync(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques o lista Trimesh:', err);
        }
    }

    async loadFromURL(apiUrl) {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error('Conexión fallida al cargar bloques de nivel.');

            const blocks = await res.json();
            console.log(`📦 Bloques cargados (${blocks.length}) desde ${apiUrl}`);

            await this._processBlocksAsync(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques desde URL:', err);
        }
    }

    // ─── Versión asíncrona que carga modelos dinámicamente si no están precargados
    async _processBlocksAsync(blocks, precisePhysicsModels) {
        for (const block of blocks) {
            if (!block.name) {
                console.warn('Bloque sin nombre:', block);
                continue;
            }

            const resourceKey = block.name;

            // Ruta estándar del modelo
            const modelPath = `/models/toycar/${block.name}.glb`;

            // Cargar el modelo (desde resources precargados o dinámicamente)
            const glb = await this._loadModelAsync(resourceKey, modelPath);

            if (!glb) {
                // No existe el archivo — omitir silenciosamente
                continue;
            }

            this._placeBlock(block, glb, precisePhysicsModels);
        }
    }

    // Mantener compatibilidad con código que llama _processBlocks directamente (sync)
    // Para nivel 1 los modelos siempre están en resources, así que funciona igual.
    _processBlocks(blocks, precisePhysicsModels) {
        blocks.forEach(block => {
            if (!block.name) {
                console.warn('Bloque sin nombre:', block);
                return;
            }

            const resourceKey = block.name;
            const glb = this.resources.items[resourceKey] || this._dynamicCache[resourceKey];

            if (!glb) {
                console.warn(`Modelo no encontrado en caché: ${resourceKey}`);
                return;
            }

            this._placeBlock(block, glb, precisePhysicsModels);
        });
    }

    // ─── Lógica común de colocación de un bloque en escena ───────────────────
    _placeBlock(block, glb, precisePhysicsModels) {
        const model = glb.scene.clone();
        model.userData.levelObject = true;

        // Eliminar cámaras y luces embebidas
        model.traverse((child) => {
            if (child.isCamera || child.isLight) {
                child.parent.remove(child);
            }
        });

        // Actividad 6: carteles vistosos — 2 por nivel con textura canvas única
        // Solo aplicar a modelos que sean carteles (cylinder.001*), no a árboles
        const isCartel = block.name.toLowerCase().includes('cylinder')
        const currentLevel = this.experience?.world?.levelManager?.currentLevel ?? 1
        let cylinderCount = 0
        model.traverse((child) => {
            if (isCartel && child.isMesh && (child.name === 'Cylinder001' || child.name.toLowerCase().includes('cylinder'))) {
                const texture = this._makeBillboardTexture(currentLevel, cylinderCount % 2)
                texture.flipY = false
                if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace
                child.material = new THREE.MeshBasicMaterial({ map: texture })
                child.material.needsUpdate = true
                cylinderCount++
            }
        })

        // Modelos baked
        if (block.name.includes('baked')) {
            const bakedTexture = new THREE.TextureLoader().load('/textures/baked.jpg');
            bakedTexture.flipY = false;
            if ('colorSpace' in bakedTexture) {
                bakedTexture.colorSpace = THREE.SRGBColorSpace;
            } else {
                bakedTexture.encoding = THREE.sRGBEncoding;
            }

            model.traverse(child => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({ map: bakedTexture });
                    child.material.needsUpdate = true;

                    if (child.name.toLowerCase().includes('portal')) {
                        this.experience.time.on('tick', () => {
                            child.rotation.y += 0.01;
                        });
                    }
                }
            });
        }

        // Premio (moneda)
        if (block.name.startsWith('coin')) {
            const prize = new Prize({
                model,
                position: new THREE.Vector3(block.x, block.y, block.z),
                scene: this.scene,
                role: block.role || "default"
            });
            prize.model.userData.levelObject = true;
            this.prizes.push(prize);
            return;
        }

        this.scene.add(model);

        // Físicas
        let shape;
        let position = new THREE.Vector3();

        if (precisePhysicsModels.includes(block.name)) {
            shape = createTrimeshShapeFromModel(model);
            if (!shape) {
                console.warn(`No se pudo crear Trimesh para ${block.name}`);
                return;
            }
            position.set(0, 0, 0);
        } else {
            shape = createBoxShapeFromModel(model, 0.9);
            const bbox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bbox.getCenter(center);
            bbox.getSize(size);
            center.y -= size.y / 2;
            position.copy(center);
        }

        const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: this.physics.obstacleMaterial
        });

        body.userData = { levelObject: true };
        model.userData.physicsBody = body;
        body.userData.linkedModel = model;
        this.physics.world.addBody(body);
    }
}