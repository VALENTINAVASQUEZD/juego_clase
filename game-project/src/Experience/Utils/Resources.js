import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
    constructor(sources) {
        super()

        this.sources = sources
        this.items = {}
        this.toLoad = this.sources.length
        this.loaded = 0

        this.setLoaders()
        this.startLoading()
    }

    setLoaders() {
        this.loaders = {}
        this.loaders.gltfLoader = new GLTFLoader()
        this.loaders.textureLoader = new THREE.TextureLoader()
        this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader()
    }

    // Método centralizado para marcar un recurso como procesado (cargado o ignorado)
    _sourceProcessed(source, file = null) {
        if (file !== null) {
            this.items[source.name] = file
        }

        this.loaded++

        const percent = Math.floor((this.loaded / this.toLoad) * 100)
        window.dispatchEvent(new CustomEvent('resource-progress', { detail: percent }))

        if (this.loaded === this.toLoad) {
            window.dispatchEvent(new CustomEvent('resource-complete'))
            this.trigger('ready')
        }
    }

    startLoading() {
        for (const source of this.sources) {

            if (source.type === 'gltfModel') {
                this.loaders.gltfLoader.load(
                    source.path,
                    (file) => {
                        this._sourceProcessed(source, file)
                    },
                    undefined,
                    (_error) => {
                        // Ignorar silenciosamente: el archivo no existe en el servidor.
                        // ToyCarLoader ya maneja el caso de recursos faltantes con su propio warning.
                        this._sourceProcessed(source, null)
                    }
                )
            } else if (source.type === 'texture') {
                this.loaders.textureLoader.load(
                    source.path,
                    (file) => {
                        this._sourceProcessed(source, file)
                    },
                    undefined,
                    (_error) => {
                        console.warn(`⚠️ Textura no encontrada, se omite: ${source.name} (${source.path})`)
                        this._sourceProcessed(source, null)
                    }
                )
            } else if (source.type === 'cubeTexture') {
                this.loaders.cubeTextureLoader.load(
                    source.path,
                    (file) => {
                        this._sourceProcessed(source, file)
                    },
                    undefined,
                    (_error) => {
                        console.warn(`⚠️ CubeTexture no encontrada, se omite: ${source.name}`)
                        this._sourceProcessed(source, null)
                    }
                )
            }
        }
    }

    // Mantener compatibilidad con cualquier código que llame sourceLoaded directamente
    sourceLoaded(source, file) {
        this._sourceProcessed(source, file)
    }
}