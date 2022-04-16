import './style.css'
import * as THREE from 'three'
import * as dat from 'dat.gui'
import * as CANNON from 'cannon-es'
import Stats from 'three/examples/jsm/libs/stats.module'
import CannonDebugger from 'cannon-es-debugger'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// some debugs 
const stats = Stats()
document.body.appendChild(stats.dom)

// animate variables 
const clock = new THREE.Clock()

// three.js variables 
const W = 'w'
const A = 'a'
const S = 's'
const D = 'd'
const modelArr = []
const DIRECTIONS = [W, A, S, D]
let camera, scene, renderer, controls
let model, gltfAnimations, mixer, animationsMap, keysPressed
let sphere, moveX, modelBody, mainWall, cannonDebugger, characterControls, charizard
let mainVelocity = 1, pos = 'front', subVelocity = 1, sub_pos = 'left'
let wallGeometry, wallMaterial, wall, boxRedPokemon, boxsquirtel, boxcharizard, boxLapras

// raycaste optmization variables 
const raycaster = new THREE.Raycaster()
const raycaster2 = new THREE.Raycaster()
const raycaster3 = new THREE.Raycaster()
const raycaster4 = new THREE.Raycaster()

let rayOrigin = new THREE.Vector3(0, 0.2, 2)

const rayDirection = new THREE.Vector3(0, 0, -1)
const rayDirection2 = new THREE.Vector3(0, 0, 1)
const rayDirection3 = new THREE.Vector3(-1, 0, 0)
const rayDirection4 = new THREE.Vector3(1, 0, 0)

rayDirection.normalize()
rayDirection2.normalize()
rayDirection3.normalize()
rayDirection4.normalize()

// cannon.js variables 
let world, oldElapsedTime = 0
let groundMaterial, wallGroundContactMaterial
let floorShape, floorBody, sphereBody, wallBody

//function calls 
initThree()
initCannon()
animate()

// three.js function here
function initThree() {

    // Canvas
    const canvas = document.querySelector('canvas.webgl')

    // Sizes
    const sizes = {
        width: window.innerWidth,
        height: window.innerHeight
    }

    // Scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x4f4b19)

    // Base camera
    camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 1000)
    camera.position.y = 2.70
    camera.position.z = 13.20
    camera.position.x = 0.24

    // Controls
    controls = new OrbitControls(camera, canvas)
    controls.enableRotate = false
    controls.enableZoom = false

    controls.enablePan = false
    controls.maxPolarAngle = Math.PI / 2 - 0.05

    // TEXTURES
    const textureLoader = new THREE.TextureLoader()
    const earth = textureLoader.load("earth.jpg")
    const wallcolor = textureLoader.load('/kakashi.jpg')
    const mainwallColor = textureLoader.load('/wall.jpg')

    const manager = new THREE.LoadingManager()
    manager.onLoad = init

    const models = {
        pikachu: { url: '/lapras.glb' },
        squirtle: { url: '/squirtle.glb' },
        redpokemon: { url: '/redpokemon.glb' },
        tree: { url: '/tree.glb' },
        charizard: { url: '/charizard.glb' },
    }

    // dracoloader
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('draco/')

    /* All additonal code goes here */

    // gltf loading
    const gltfLoader = new GLTFLoader(manager)
    gltfLoader.setDRACOLoader(dracoLoader)
    for (const model2 of Object.values(models)) {
        gltfLoader.load(model2.url, (gltf) => {
            model2.gltf = gltf
        })
    }

    function init() {
        Object.values(models).forEach((model2) => {
            modelArr.push(model2.gltf.scene)
        })

        if (modelArr.length != 0) {

            let laprasModel = modelArr[0]
            laprasModel.scale.set(1.5, 1.6, 1.5)
            laprasModel.position.set(7, 0, 5)
            scene.add(laprasModel)

            let squirtles = modelArr[1]
            squirtles.position.set(-8, 0.3, -1)
            squirtles.scale.set(1.1, 1.1, 1.1)
            squirtles.rotation.y = 0.97
            scene.add(squirtles)

            let redpokemon = modelArr[2]
            redpokemon.scale.set(0.25, 0.25, 0.25)
            redpokemon.position.set(-0.2, 0.3, -3.7)
            scene.add(redpokemon)

            let tree = modelArr[3]
            // TREE at back 
            for (let i = -10; i < 12; i += 3) {
                let tree2 = tree.clone()
                tree2.scale.set(0.5, 0.5, 0.5)
                tree2.position.set(i, 0, -7.5)
                scene.add(tree2)
            }

            charizard = modelArr[4]
            charizard.scale.set(3, 3, 3)
            charizard.position.set(8, 0.3, -1)
            charizard.rotation.y = -1
            scene.add(charizard)
        }
    }

    /*///// character controls start here //////*/

    const pikachu = 'pikachu.glb'

    // pikachu animation names "Front Flip" "Happy Idle" "Walking"

    // loading model 
    gltfLoader.load(pikachu, (gltf) => {

        model = gltf.scene
        model.position.z = 7
        scene.add(model)

        // turing off shadows 
        model.traverse(function (object) {
            if (object.isMesh) object.castShadow = true
        })

        mixer = new THREE.AnimationMixer(model)
        gltfAnimations = gltf.animations
        mixer = new THREE.AnimationMixer(model)

        animationsMap = new Map()
        gltfAnimations.filter(
            function (a) {
                return a.name != 'TPose'
            }).forEach(
                function (a) {
                    animationsMap.set(a.name, mixer.clipAction(a))
                })

        // adding the character controls 
        characterControls = new CharacterControls(model, mixer, animationsMap, controls, camera, 'Happy Idle')
    })
    let play = ''
    const CharacterControls = (function () {
        class CharacterControls {
            constructor(model, mixer, animationsMap, orbitControl, camera, currentAction) {

                // Walk, Run, Idle
                this.animationsMap = new Map()

                // state
                this.toggleRun = true

                // temporary data
                this.walkDirection = new THREE.Vector3()
                this.rotateAngle = new THREE.Vector3(0, 1, 0)
                this.rotateQuarternion = new THREE.Quaternion()
                this.cameraTarget = new THREE.Vector3()

                // constants
                this.fadeDuration = 0.2
                this.runVelocity = 3.4
                this.walkVelocity = 3
                this.model = model
                this.mixer = mixer
                this.animationsMap = animationsMap
                this.currentAction = currentAction
                this.animationsMap.forEach(function (value, key) {
                    if (key == currentAction) {
                        value.play()
                    }
                })
                this.orbitControl = orbitControl
                this.camera = camera
                this.updateCameraTarget(0, 0)
            }

            switchRunToggle() {
                this.toggleRun = !this.toggleRun
            }

            update(delta, keysPressed) {
                let directionPressed = DIRECTIONS.some(function (key) { return keysPressed[key] == true })

                if (directionPressed && this.toggleRun) {
                    play = 'Walking'
                }
                else if (directionPressed) {
                    play = 'Front Flip'
                }
                else {
                    play = 'Happy Idle'
                }

                if (this.currentAction != play) {
                    let toPlay = this.animationsMap.get(play)
                    let current = this.animationsMap.get(this.currentAction)
                    current.fadeOut(this.fadeDuration)
                    toPlay.reset().fadeIn(this.fadeDuration).play()
                    this.currentAction = play
                }

                this.mixer.update(delta)
                if (this.currentAction == 'Walking' || this.currentAction == 'Front Flip') {

                    // calculate towards camera direction
                    let angleYCameraDirection = Math.atan2((this.camera.position.x - this.model.position.x), (this.camera.position.z - this.model.position.z))

                    // diagonal movement angle offset
                    let directionOffset = this.directionOffset(keysPressed)

                    // rotate model
                    this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset)
                    this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2)

                    // calculate direction
                    this.camera.getWorldDirection(this.walkDirection)
                    this.walkDirection.y = 0
                    this.walkDirection.normalize()
                    this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset)

                    // run/walk velocity
                    let velocity = this.currentAction == 'Walking' ? this.runVelocity : this.walkVelocity

                    // console.log(this.walkDirection.z < 0); //w 
                    let tempZ = mainVelocity
                    if (this.walkDirection.z < 0 && pos == 'front') {
                        mainVelocity = tempZ
                    } else if (this.walkDirection.z > 0 && pos == 'back') {
                        mainVelocity = tempZ
                    } else {
                        mainVelocity = 1
                    }

                    // console.log(this.walkDirection.x < 0); //a
                    let tempX = subVelocity
                    if (this.walkDirection.x < 0 && sub_pos == 'left') {
                        subVelocity = tempX
                    } else if (this.walkDirection.x > 0 && sub_pos == 'right') {
                        subVelocity = tempX
                    } else {
                        subVelocity = 1
                    }

                    // move model & camera
                    moveX = this.walkDirection.x * velocity * delta * subVelocity
                    let moveZ = this.walkDirection.z * velocity * delta * mainVelocity
                    this.model.position.x += moveX
                    this.model.position.z += moveZ
                    this.updateCameraTarget(moveX, moveZ)
                }
            }

            updateCameraTarget(moveX, moveZ) {
                // move camera
                this.camera.position.x += moveX
                this.camera.position.z += moveZ
                // update camera target
                this.cameraTarget.x = this.model.position.x
                this.cameraTarget.y = this.model.position.y + 1
                this.cameraTarget.z = this.model.position.z
                this.orbitControl.target = this.cameraTarget
            }

            directionOffset(keysPressed) {
                let directionOffset = 0 // w
                if (keysPressed[W]) {
                    if (keysPressed[A]) {
                        directionOffset = Math.PI / 4 // w+a
                    }
                    else if (keysPressed[D]) {
                        directionOffset = -Math.PI / 4 // w+d
                    }
                }
                else if (keysPressed[S]) {
                    if (keysPressed[A]) {
                        directionOffset = Math.PI / 4 + Math.PI / 2 // s+a
                    }
                    else if (keysPressed[D]) {
                        directionOffset = -Math.PI / 4 - Math.PI / 2 // s+d
                    }
                    else {
                        directionOffset = Math.PI // s
                    }
                }
                else if (keysPressed[A]) {
                    directionOffset = Math.PI / 2 // a
                }
                else if (keysPressed[D]) {
                    directionOffset = -Math.PI / 2 // d
                }
                return directionOffset
            }

        }
        return CharacterControls
    }())

    let i = 0
    // key controls 
    keysPressed = {}
    document.addEventListener('keydown', function (event) {
        if (event.shiftKey && characterControls) {
            characterControls.switchRunToggle()

            // create an AudioListener and add it to the camera
            const listener = new THREE.AudioListener();
            camera.add(listener);

            // create a global audio source
            const sound = new THREE.Audio(listener);

            // load a sound and set it as the Audio object's buffer
            const audioLoader = new THREE.AudioLoader()
            const audio = ['audio/1.mp3', 'audio/2.mp3', 'audio/3.mp3', 'audio/4.mp3', 'audio/5.mp3', 'audio/6.mp3', 'audio/7.mp3', 'audio/8.mp3', 'audio/9.mp3']

            if (audio[i] != null) {
                audioLoader.load(audio[i], function (buffer) {
                    sound.setBuffer(buffer)
                    sound.setVolume(0.5)
                    sound.play()
                })
                i++
            } else {
                i = 0
            }
        }
        else {
            keysPressed[event.key.toLowerCase()] = true
        }
    })
    document.addEventListener('keyup', function (event) {
        keysPressed[event.key.toLowerCase()] = false
    })

    /*//////// character controls start here //////*/

    //boxs for models 
    const boxRedPokemonGeom = new THREE.BoxBufferGeometry(3, 0.3, 3)
    const boxRedPokemonMat = new THREE.MeshStandardMaterial({
        color: '#ebebeb'
    })
    boxRedPokemon = new THREE.Mesh(boxRedPokemonGeom, boxRedPokemonMat)
    boxRedPokemon.position.set(0, 0.3 / 2, -3.8)
    scene.add(boxRedPokemon)

    const squirtelGeom = new THREE.BoxBufferGeometry(3, 0.3, 3)
    const squirtelMat = new THREE.MeshStandardMaterial({
        color: '#ebebeb'
    })
    boxsquirtel = new THREE.Mesh(squirtelGeom, squirtelMat)
    boxsquirtel.position.set(-8, 0.3 / 2, -1)
    boxsquirtel.rotation.y = 1
    scene.add(boxsquirtel)

    const charizardGeom = new THREE.BoxBufferGeometry(3, 0.3, 3)
    const charizardMat = new THREE.MeshStandardMaterial({
        color: '#ebebeb'
    })
    boxcharizard = new THREE.Mesh(charizardGeom, charizardMat)
    boxcharizard.position.set(8, 0.3 / 2, -1)
    boxcharizard.rotation.y = -1
    scene.add(boxcharizard)

    //some extra mesh for fun
    wallGeometry = new THREE.BoxBufferGeometry(17, 3, 0.5)
    wallMaterial = new THREE.MeshStandardMaterial({
        map: wallcolor,
        transparent: true,
        normalMap: wallcolor,
    })
    wall = new THREE.Mesh(wallGeometry, wallMaterial)
    wall.position.y = 3 / 2
    wall.position.z = -10
    wall.position.x = 4
    scene.add(wall)

    let mainWallGeometry = new THREE.BoxBufferGeometry(8, 3, 0.5)
    let mainWallMaterial = new THREE.MeshStandardMaterial({
        map: mainwallColor,
        transparent: true,
        normalMap: mainwallColor
    })
    mainWall = new THREE.Mesh(mainWallGeometry, mainWallMaterial)
    mainWall.position.y = 3 / 2
    mainWall.position.z = -10
    mainWall.position.x = -8.5
    scene.add(mainWall)

    sphere = new THREE.Mesh(
        new THREE.SphereBufferGeometry(0.5, 32, 32),
        new THREE.MeshStandardMaterial({ map: earth, roughness: 0.7 })
    )
    sphere.position.y = 1
    scene.add(sphere)

    generateFloor()

    // floor geometry 
    function generateFloor() {
        const WIDTH = 25
        const LENGTH = 30

        const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 1, 1)
        const material = new THREE.MeshStandardMaterial({
            color: '#4f4b19'
        })

        const floor = new THREE.Mesh(geometry, material)
        floor.position.z = 5
        floor.rotation.x = - Math.PI / 2
        scene.add(floor)
    }

    /* Additional code ends here */

    // Handling resize event 
    window.addEventListener('resize', () => {
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight
        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()
        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    })

    //lights 
    let hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444)
    hemiLight.position.set(0, 300, 0)
    scene.add(hemiLight)
    hemiLight.castShadow = true
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
    scene.add(ambientLight)

    let dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(75, 300, -75)
    scene.add(dirLight)

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    })
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.35
    renderer.outputEncoding = THREE.sRGBEncoding
}

// Physics here
function initCannon() {

    // initalize physics world 
    world = new CANNON.World()
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.gravity.set(0, -9.8, 0)

    groundMaterial = new CANNON.Material('goundMaterial')
    wallMaterial = new CANNON.Material('wallMaterial')

    wallGroundContactMaterial = new CANNON.ContactMaterial(groundMaterial, wallMaterial, {
        friction: 0.1,
        restitution: 0.7
    })
    world.addContactMaterial(wallGroundContactMaterial)

    // wall
    const wallShape = new CANNON.Box(new CANNON.Vec3(15 / 2, 3 / 2, 0.5 / 2))
    wallBody = new CANNON.Body({
        mass: 0,
        shape: wallShape,
        material: wallMaterial
    })
    wallBody.position.y = 3 / 2
    wallBody.position.z = -10
    world.addBody(wallBody)

    // model
    const modelShape = new CANNON.Box(new CANNON.Vec3(1 / 2, 2 / 2, 0.9 / 2))
    modelBody = new CANNON.Body({
        mass: 0,
        shape: modelShape,
        material: wallMaterial
    })
    modelBody.position.y = 2 / 2
    modelBody.position.z = 2
    world.addBody(modelBody)

    // shpere 
    const sphereShape = new CANNON.Sphere(0.5)
    sphereBody = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(1, 0.5, 4),
        shape: sphereShape,
        material: groundMaterial
    })
    world.addBody(sphereBody)

    // floor physics 
    floorShape = new CANNON.Plane()
    floorBody = new CANNON.Body()
    floorBody.material = groundMaterial
    floorBody.mass = 0
    floorBody.addShape(floorShape)
    floorBody.quaternion.setFromAxisAngle(
        new CANNON.Vec3(1, 0, 0),
        - Math.PI * 0.5
    )
    world.addBody(floorBody)

    // debugger for cannon js
    cannonDebugger = new CannonDebugger(scene, world, {
        color: 'red',
    })
}

function raychecker() {
    raycaster.set(rayOrigin, rayDirection)
    raycaster2.set(rayOrigin, rayDirection2)
    raycaster3.set(rayOrigin, rayDirection3)
    raycaster4.set(rayOrigin, rayDirection4)

    // let arrow = new THREE.ArrowHelper( rayDirection, rayOrigin, 100, Math.random() * 0xffffff )
    // scene.add( arrow )

    raycaster.far = 3
    raycaster2.far = 3
    raycaster3.far = 3
    raycaster4.far = 3

    let objectToTest = []

    objectToTest = [wall, mainWall, boxRedPokemon, boxcharizard, boxsquirtel]
    const intersects = raycaster.intersectObjects(objectToTest)
    const intersects2 = raycaster2.intersectObjects(objectToTest)
    const intersects3 = raycaster3.intersectObjects(objectToTest)
    const intersects4 = raycaster4.intersectObjects(objectToTest)


    for (const object of objectToTest) {

    }
    // checking inersect 

    for (const intersect of intersects) {
        pos = 'front'
        if (intersect.distance <= 1.1) {
            if (intersects.length >= 1) {
                mainVelocity = 0
            } else {
                mainVelocity = 1
            }
        } else {
            mainVelocity = 1
        }
    }


    for (const intersect of intersects2) {
        pos = 'back'
        if (intersect.distance <= 1.1) {
            if (intersects2.length >= 1) {
                mainVelocity = 0
            } else {
                mainVelocity = 1
            }

        } else {
            mainVelocity = 1
        }
    }


    if (intersects.length < 1 && intersects2.length < 1) {
        mainVelocity = 1
    }

    for (const intersect of intersects3) {
        sub_pos = 'left'
        if (intersect.distance <= 1.1) {
            if (intersects3.length >= 1) {
                subVelocity = 0
            } else {
                subVelocity = 1
            }

        } else {
            subVelocity = 1
        }
    }

    for (const intersect of intersects4) {
        sub_pos = 'right'
        if (intersect.distance <= 1.1) {
            if (intersects4.length >= 1) {
                subVelocity = 0
            } else {
                subVelocity = 1
            }

        } else {
            subVelocity = 1
        }
    }

    if (intersects3.length < 1 && intersects4.length < 1) {
        subVelocity = 1
    }
}

// Animation here
function animate() {
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    //  applying force
    if (model != null) {
        rayOrigin.x = model.position.x
        rayOrigin.z = model.position.z
        modelBody.position.copy(model.position)
        modelBody.position.y = 2 / 2
    }

    // checking model and mesh inresection
    raychecker()

    sphere.position.copy(sphereBody.position)
    sphere.quaternion.copy(sphereBody.quaternion)

    if (characterControls) {
        characterControls.update(deltaTime, keysPressed)
    }

    // update physics world 
    world.step(1 / 60, deltaTime, 3)

    // Update the CannonDebugger meshes
    // cannonDebugger.update()

    // Update controls
    controls.update()
    stats.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(animate)
}