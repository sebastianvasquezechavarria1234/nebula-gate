import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 20, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 12, 15);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 2, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 15, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x00ffff, 2, 50);
pointLight.position.set(0, 4, 0);
scene.add(pointLight);

const floorGeometry = new THREE.PlaneGeometry(40, 40);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x111122,
    metalness: 0.8,
    roughness: 0.2,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5;
floor.receiveShadow = true;
scene.add(floor);

const ceilingGeometry = new THREE.PlaneGeometry(40, 40);
const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0x111122,
    metalness: 0.8,
    roughness: 0.2,
    side: THREE.DoubleSide,
});
const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 5;
ceiling.receiveShadow = true;
scene.add(ceiling);

const columnGeometry = new THREE.CylinderGeometry(0.3, 0.3, 5, 16);
const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0x444466,
    metalness: 0.7,
    roughness: 0.3,
});

const columns = [];
const gridSize = 10;
const spacing = 3;

for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
        const column = new THREE.Mesh(columnGeometry, columnMaterial);
        column.position.set(
            (x - gridSize / 2 + 0.5) * spacing,
            2,
            (z - gridSize / 2 + 0.5) * spacing
        );
        column.castShadow = true;
        column.receiveShadow = true;
        scene.add(column);
        columns.push(column);
    }
}

const geometry = new THREE.TorusKnotGeometry(1, 0.3, 128, 32);
const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x004444,
    metalness: 0.9,
    roughness: 0.1,
});
const torusKnot = new THREE.Mesh(geometry, material);
torusKnot.position.y = 4;
torusKnot.castShadow = true;
scene.add(torusKnot);

const wireGeometry = new THREE.TorusKnotGeometry(1.05, 0.32, 128, 32);
const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
});
const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
wireframe.position.y = 4;
scene.add(wireframe);

function animate() {
    requestAnimationFrame(animate);

    torusKnot.rotation.x += 0.005;
    torusKnot.rotation.y += 0.008;

    wireframe.rotation.x -= 0.003;
    wireframe.rotation.y -= 0.006;

    controls.update();

    const minY = 0.5;
    const maxY = 4.5;
    if (camera.position.y < minY) camera.position.y = minY;
    if (camera.position.y > maxY) camera.position.y = maxY;

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
