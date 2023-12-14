ldwdet scene, camera, renderer, controls;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdddddd);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.x = 300;
  camera.position.y = 100;
  camera.position.z = 250;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  let loader = new THREE.GLTFLoader();
  loader.load("scene.gltf", function(gltf) {
    let mesh = gltf.scene.children[0];
    mesh.scale.set(100,100,100);
    scene.add(gltf.scene);
  });

  controls = new THREE.OrbitControls(camera);
  controls.addEventListener("change", renderer);

  let light1 = new THREE.PointLight(0xffffff,3);
  light1.position.set(0,300,500);
  scene.add(light1);

  let light2 = new THREE.PointLight(0xffffff,3);
  light2.position.set(500,100,0);
  scene.add(light2);

  let light3 = new THREE.PointLight(0xffffff,3);
  light3.position.set(0,100,-500);
  scene.add(light3);

  let light4 = new THREE.PointLight(0xffffff,3);
  light4.position.set(-500,300,0);
  scene.add(light4);

  animate();
}
function animate() {
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
init();