import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter
{
    constructor(sources)
    {
        super()

        this.sources = sources
        this.items = {}
        this.toLoad = this.sources.length
        this.loaded = 0

        this.setLoaders()
        this.startLoading()
    }

    setLoaders()
    {
        this.loaders = {}
        this.loaders.gltfLoader = new GLTFLoader()
        this.loaders.fbxLoader = new FBXLoader()
        this.loaders.textureLoader = new THREE.TextureLoader()
        this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader()
    }

    startLoading()
    {
        for (const source of this.sources)
        {
            console.log(`⏳ Cargando recurso: ${source.name} desde ${source.path}`);
    
            if (source.type === 'gltfModel')
            {
                this.loaders.gltfLoader.load(
                    source.path,
                    (file) =>
                    {
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) =>
                    {
                        console.error(`❌ Error al cargar modelo ${source.name} desde ${source.path}`);
                        console.error(error);
                        this.sourceLoaded(source, null);
                    }
                );
            }
            else if (source.type === 'fbxModel')
            {
                this.loaders.fbxLoader.load(
                    source.path,
                    (file) =>
                    {
                        // Debug: Verificar estructura del archivo FBX cargado
                        console.log(`✅ Modelo FBX cargado: ${source.name}`, {
                            type: file?.constructor?.name,
                            hasAnimations: !!file?.animations,
                            animationsCount: file?.animations?.length || 0,
                            childrenCount: file?.children?.length || 0,
                            keys: file ? Object.keys(file) : []
                        })
                        
                        if (file?.animations && file.animations.length > 0) {
                            console.log(`✅ Animaciones encontradas en FBX (${file.animations.length}):`)
                            file.animations.forEach((anim, index) => {
                                console.log(`  ${index}: ${anim.name || 'Sin nombre'} (${anim.duration}s, ${anim.tracks?.length || 0} tracks)`)
                            })
                        } else {
                            console.warn(`⚠️ No se encontraron animaciones en el modelo FBX ${source.name}`)
                        }
                        
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) =>
                    {
                        console.error(`❌ Error al cargar modelo FBX ${source.name} desde ${source.path}`);
                        console.error(error);
                        this.sourceLoaded(source, null);
                    }
                );
            }
            else if (source.type === 'texture')
            {
                this.loaders.textureLoader.load(
                    source.path,
                    (file) =>
                    {
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) =>
                    {
                        console.error(`❌ Error al cargar textura ${source.name} desde ${source.path}`);
                        console.error(error);
                        this.sourceLoaded(source, null);
                    }
                );
            }
            else if (source.type === 'cubeTexture')
            {
                this.loaders.cubeTextureLoader.load(
                    source.path,
                    (file) =>
                    {
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) =>
                    {
                        console.error(`❌ Error al cargar cubemap ${source.name} desde ${source.path}`);
                        console.error(error);
                        this.sourceLoaded(source, null);
                    }
                );
            }
        }
    }
   

    sourceLoaded(source, file)
    {
        this.items[source.name] = file
        this.loaded++

        // Emitir evento de progreso cada vez que se carga un recurso
        this.trigger('progress', [this.loaded, this.toLoad])

        if(this.loaded === this.toLoad)
        {
            this.trigger('ready')
        }
    }
}
