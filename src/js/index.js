import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Colors } from './colors.js'
import * as CANNON from 'cannon-es'
import { WALLS } from './walls.js'
import { Pathfinding, PathfindingHelper } from 'three-pathfinding'
const SPOTLIGHT_HELPER_TOGGLE = false
const WALL_HELPER = false
const AXES_HELPER = false
const NUM_GHOST = 4
const SHOW_DUMMY = false
const SHOW_NAVMESH = true
const GHOST_COLORS = [
  0x841818,
  0x173b0f,
  0x2a2ff5,
  0x3897f5
]

const GHOST_INITIAL_POS = [
  [2, 0, -17],
  [-2, 0, -17],
  [2, 0, -14],
  [-2, 0, -14],
]

const pathfinding = new Pathfinding();
const pathfindinghelper = new PathfindingHelper();

let scene
let camera
let renderer
let pacmanShape
let pacmanBody
let mixer
let gltfAnimations
let keysPressed = []
let speed = 0.05
let speedG = 0.035
let clock = new THREE.Clock()
let oldElapsedTime = 0
let world
let worldMap
let pacman
let ghosts = []
let ghostsBody = []

let controls
let wallsBody = []
//navigation
const ZONE = 'level1'
let navMesh
let groupID
let navpath = []
for(let i = 0; i < NUM_GHOST; i++) navpath.push([])
let pacmanDummy
let dummy = []


const squareSize = 1/2

const spotLights = []
const allActions = []

createScene()
createAmbientLigth()
createSpotLight(0, 50, 0)
createSpotLight(60, 50, 60)
createSpotLight(-60, 50, -60)
createSpotLight(60, 50, -60)
createSpotLight(-60, 50, 60)
loadWorld()
loadWalls()
loadPacman()
for(let i = 0; i < NUM_GHOST; i++) {
  loadGhost(i)
}
loadNavMesh()
loadSky()
animate()
checkInputs()
setInterval(moveGhost, 500)


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createScene() {
  scene = new THREE.Scene()
  world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)
  const canvas = document.querySelector('.webgl')
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  // renderer.outputEncoding = true
  document.body.appendChild(renderer.domElement)

  if(AXES_HELPER) {
    const axesHelper = new THREE.AxesHelper(20)
    scene.add(axesHelper)
  }

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  )
  camera.position.set(10, 10, 10)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minPolarAngle = -Math.PI / 3;
  controls.maxPolarAngle = Math.PI / 3; // Defina o �ngulo vertical desejado
  controls.minAzimuthAngle = -Infinity; // Permita rota��o completa em horizontal
  controls.maxAzimuthAngle = Infinity;  // Permita rota��o completa em horizontal
  controls.enablePan = false;
  controls.minDistance = 8
  controls.maxDistance = 800
  controls.update();
}

function createAmbientLigth() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)
}

function createSpotLight(x, y, z, color = 0xffffff) {
  const spotLight = new THREE.SpotLight(color, 0.7)
  spotLight.position.set(x, y, z)
  spotLight.angle = Math.PI / 6
  spotLight.penumbra = 0.5
  spotLight.decay = 1
  spotLight.distance = 100
  spotLight.castShadow = true
  spotLight.shadow.mapSize.width = 1024
  spotLight.shadow.mapSize.height = 1024
  spotLight.shadow.camera.near = 1
  spotLight.shadow.camera.far = 60
  scene.add(spotLight)
  scene.add(spotLight.target)
  spotLights.push(spotLight)
  if(SPOTLIGHT_HELPER_TOGGLE) {
    const spotLightHelper = new THREE.SpotLightHelper( spotLight );
    scene.add( spotLightHelper );
  }
}

function loadSky () {
  let map = new THREE.TextureLoader().load('../../assets/sky.jpg')
  let skyGeometry = new THREE.SphereGeometry(1000)
  let skyMaterial = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide })
  let sky = new THREE.Mesh(skyGeometry, skyMaterial)
  sky.rotation.x = Math.PI * 3/4
  sky.rotation.z =  Math.PI
  scene.add(sky)
}

function loadWorld() {
  const loader = new GLTFLoader()
  loader.load('../../assets/world2/Sketchfab_Scene.gltf', (gltf) => {
    //gltfAnimations = gltf.animations
    worldMap = gltf.scene
    worldMap.scale.set(10, 10, 10)
    worldMap.traverse((child) => {
      child.frustumCulled = false
      if (child.isMesh) {
        child.castShadow = true
      }
    })
    // worldMap.receiveShadow = true
    scene.add(worldMap)

    const planeGeometry = new THREE.BoxGeometry(40, 50, 0.1)
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    
    const plane = new THREE.Mesh( planeGeometry, planeMaterial )
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    plane.position.x = 0
    plane.position.y = 0
    plane.position.z = 0
    scene.add( plane )
    const planeShape = new CANNON.Box(new CANNON.Vec3(20, 25, 0.1))
    const planeBody = new CANNON.Body({
      mass: 0,
    })
    
    planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
    planeBody.position.x = 0
    planeBody.position.z = 0
    planeBody.position.y = -0.2

    planeBody.addShape(planeShape)
    world.addBody(planeBody)
  })
}

function loadNavMesh() {
  scene.add(pathfindinghelper)
  const loader = new GLTFLoader()
  loader.load('../../assets/navMesh/navMesh.gltf', (gltf) => {
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        navMesh = node
        navMesh.scale.set(1.2, 1.2, 1.2)
        navMesh.position.y = 1.5
        navMesh.position.z = 0.8
        const zone = Pathfinding.createZone(navMesh.geometry)
        pathfinding.setZoneData(ZONE, zone)
        if(SHOW_NAVMESH) {
          scene.add(navMesh)
        }
      }
    })
  })
}

function loadWalls () {
  for(const wall of WALLS) {
    if(WALL_HELPER) {
      const planeGeometry = new THREE.BoxGeometry(wall.height*squareSize*2, wall.width*squareSize*2, wall.length*squareSize*2)
      const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide })
      const plane = new THREE.Mesh( planeGeometry, planeMaterial )
      plane.rotation.x = -Math.PI / 2
      plane.receiveShadow = true
      plane.position.x = wall.x * squareSize
      plane.position.y = wall.y * squareSize
      plane.position.z = wall.z * squareSize
      scene.add( plane )
    }

    const planeShape = new CANNON.Box(new CANNON.Vec3(wall.height*squareSize, wall.width*squareSize, wall.length*squareSize))
    const planeBody = new CANNON.Body({
      mass: 0,
    })
    
    planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
    planeBody.position.x = wall.x * squareSize
    planeBody.position.z = wall.z * squareSize
    planeBody.position.y = wall.y * squareSize
    
    planeBody.addShape(planeShape)
    world.addBody(planeBody)
    wallsBody.push(planeBody)
  }
}

function startAnimation() {
  mixer = new THREE.AnimationMixer(pacman)
  gltfAnimations.forEach(a => {
    allActions.push(mixer.clipAction(a))
  })

  allActions[0].play()
}

function createDummy(x, y, z) {
  let d
  const planeGeometry = new THREE.BoxGeometry(2, 100, 2)
  const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  d = new THREE.Mesh( planeGeometry, planeMaterial )
  d.position.x = x
  d.position.y = y
  d.position.z = z
  if(SHOW_DUMMY) {
    scene.add(d)
  }
  return d
}


function loadPacman () {
  const loader = new GLTFLoader()
  loader.load('../../assets/pacman/scene.gltf', (gltf) => {
    gltfAnimations = gltf.animations
    pacman = gltf.scene
    pacman.scale.set(0.01, 0.01, 0.01)
    pacman.traverse((child) => {
      child.frustumCulled = false
      if (child.isMesh) {
        child.castShadow = true
      }
    })
    startAnimation()
    scene.add(pacman)

    pacmanShape = new CANNON.Sphere(1)
    pacmanBody = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(0, 0.1, 0),
      shape: pacmanShape,
    })

    world.addBody(pacmanBody)

    spotLights[0].target = pacman
  })
  pacmanDummy = createDummy(0, 0, 0)
}

function loadGhost (i) {
  const loader = new GLTFLoader()
  let ghost
  loader.load('../../assets/ghost/scene.gltf', (gltf) => {
    ghost = gltf.scene
    ghost.scale.set(0.05, 0.05, 0.05)
    ghost.traverse((child) => {
      child.frustumCulled = false
      if (child.isMesh) {
        child.castShadow = true
      }
    })
    ghost.position.set(0, 0.1, -6.5)
    scene.add(ghost)

    const ghostShape = new CANNON.Sphere(1)
    const ghostBody = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(0, 0.1, -6.5),
      shape: ghostShape,
    })

    world.addBody(ghostBody)
    ghostsBody.push(ghostBody)
    ghosts.push(ghost)
  })
  dummy.push(createDummy(GHOST_INITIAL_POS[i][0], GHOST_INITIAL_POS[i][1], GHOST_INITIAL_POS[i][2]))
}

function moveGhost () {
  let i = 0;
  for(const d of dummy) {
    groupID = pathfinding.getGroup(ZONE, d.position)
    const closestTargetNode = pathfinding.getClosestNode( d.position, ZONE, groupID )
    const pacGroupdId = pathfinding.getGroup(ZONE, pacmanDummy.position)
    const closestPacman = pathfinding.getClosestNode( pacmanDummy.position, ZONE, pacGroupdId )
    if(closestTargetNode && closestPacman) {
      navpath[i] = pathfinding.findPath(closestTargetNode.centroid, closestPacman.centroid, ZONE, groupID)
    } else {
      if(navpath[i].length < 5) navpath[i] = []
    }
    i++
  }
}

function checkInputs() {
  setInterval(() => {
    for (const key of keysPressed) {
      switch (key.toLowerCase()) {
        case 'w':
          pacman.rotation.y = Math.PI
          break
        case 's':
          pacman.rotation.y = 2*Math.PI
          break
        case 'a':
          pacman.rotation.y = -Math.PI / 2
          break
        case 'd':
          pacman.rotation.y = Math.PI /2
          break
      }
    }
  }, 1)
}
window.addEventListener('keydown', (event) => {
  if (!keysPressed.includes(event.key.toLowerCase())) {
    keysPressed.push(event.key.toLowerCase())
  }
})

window.addEventListener('keyup', (event) => {
  keysPressed = keysPressed.filter((key) => key != event.key.toLowerCase())
})

function animate() {
  requestAnimationFrame(animate)
  if (mixer) mixer.update(0.006)
  
  let ElapsedTime = clock.getElapsedTime();
  let deltaTime = ElapsedTime - oldElapsedTime;
  oldElapsedTime = deltaTime;

  if (world) world.step(1 / 60, deltaTime, 3);

  if(navpath && navpath.length > 0){
    for(let i = 0; i < NUM_GHOST; i++) {
      const nav = navpath[i]
      if(!nav || nav.length === 0) continue
      let targetPosition = nav[ 0 ]
      const distance = targetPosition.clone().sub( dummy[i].position );
      
      if (distance.lengthSq() > 0.05 * 0.05) {
        distance.normalize();
        dummy[i].position.add( distance.multiplyScalar( deltaTime * speedG * 0.1 ) );
      } else {
        navpath.shift();
      }
    }    
  }
  
  if(ghostsBody.length > 0 && ghosts.length > 0){
    for(let i = 0; i < NUM_GHOST; i++) {
      ghostsBody[i].position.copy({ x: dummy[i].position.x, y: dummy[i].position.y, z: dummy[i].position.z })
      ghosts[i].position.copy({ x: ghostsBody[i].position.x, y: ghostsBody[i].position.y, z: ghostsBody[i].position.z })
    }
  }

  if (pacman && worldMap && pacmanBody) {
    pacmanBody.position.x += speed * Math.sin(pacman.rotation.y)
    pacmanBody.position.z += speed * Math.cos(pacman.rotation.y)
    if (pacmanBody) {
      pacman.position.copy({ x: pacmanBody.position.x, y: pacmanBody.position.y, z: pacmanBody.position.z })
      pacmanDummy.position.copy({ x: pacmanBody.position.x, y: 0, z: pacmanBody.position.z })
    }

    if(pacman.position.x >= 17) {
      pacmanBody.position.x = -16
    } else if(pacman.position.x <= -17) {
      pacmanBody.position.x = 16
    } 
  }
  
  renderer.render(scene, camera)
}
