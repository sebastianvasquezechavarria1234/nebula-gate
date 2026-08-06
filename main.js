import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// ==========================================
// RENDERER & SCENE SETUP
// ==========================================
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010309);
scene.fog = new THREE.FogExp2(0x010309, 0.011);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(10, 4.5, 14);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.target.set(0, 3.4, 0);
controls.minDistance = 4.0;
controls.maxDistance = 35;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minPolarAngle = Math.PI * 0.08;
controls.enablePan = false;
controls.update();

const FLOOR_Y = 0;
const CEILING_Y = 12;
const PORTAL_Y = 4.2;
const PORTAL_RADIUS = 3.6;
const ROOM_SIZE = 160;

// ==========================================
// PROCEDURAL TEXTURE ENGINE
// ==========================================
function createNoiseCanvas(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const rgb = fn(x / w, y / h, x, y);
            img.data[i] = rgb[0];
            img.data[i + 1] = rgb[1];
            img.data[i + 2] = rgb[2];
            img.data[i + 3] = rgb.length > 3 ? rgb[3] : 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return c;
}

function hash21(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
}

function smoothNoise(u, v, scale) {
    const x = u * scale;
    const y = v * scale;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = hash21(i, j);
    const n10 = hash21(i + 1, j);
    const n01 = hash21(i, j + 1);
    const n11 = hash21(i + 1, j + 1);

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
}

function fbm(u, v, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 4.0;
    for (let i = 0; i < octaves; i++) {
        val += smoothNoise(u, v, freq) * amp;
        freq *= 2.05;
        amp *= 0.5;
    }
    return val;
}

// Floor Tile Texture
const floorCanvas = createNoiseCanvas(1024, 1024, (u, v, x, y) => {
    const tileSize = 128;
    const border = (x % tileSize < 3 || y % tileSize < 3 || x % tileSize > tileSize - 4 || y % tileSize > tileSize - 4);
    const n = fbm(u * 12, v * 12, 4);
    const puddleN = fbm(u * 4 + 10, v * 4 + 10, 3);

    let baseR = 20 + n * 25;
    let baseG = 25 + n * 30;
    let baseB = 35 + n * 40;

    if (border) {
        baseR *= 0.35;
        baseG *= 0.35;
        baseB *= 0.35;
    }
    if (puddleN > 0.55) {
        baseR *= 0.5;
        baseG *= 0.55;
        baseB *= 0.6;
    }
    return [baseR, baseG, baseB];
});
const floorTex = new THREE.CanvasTexture(floorCanvas);
floorTex.wrapS = THREE.RepeatWrapping;
floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(8, 8);

// Floor Normal Map
const floorNormalCanvas = createNoiseCanvas(512, 512, (u, v) => {
    const eps = 1 / 512;
    const nL = fbm(u - eps, v, 4);
    const nR = fbm(u + eps, v, 4);
    const nD = fbm(u, v - eps, 4);
    const nU = fbm(u, v + eps, 4);

    const dx = (nL - nR) * 2.0;
    const dy = (nD - nU) * 2.0;
    const dz = 1.0;

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [
        Math.floor(((dx / len) * 0.5 + 0.5) * 255),
        Math.floor(((dy / len) * 0.5 + 0.5) * 255),
        Math.floor((dz / len) * 255)
    ];
});
const floorNormalMap = new THREE.CanvasTexture(floorNormalCanvas);
floorNormalMap.wrapS = THREE.RepeatWrapping;
floorNormalMap.wrapT = THREE.RepeatWrapping;
floorNormalMap.repeat.set(8, 8);

// Floor Roughness Map (Puddles polished, dry parts rough)
const floorRoughCanvas = createNoiseCanvas(512, 512, (u, v) => {
    const puddle = fbm(u * 4 + 10, v * 4 + 10, 3);
    const micro = fbm(u * 20, v * 20, 3);
    let val = puddle > 0.55 ? 12 + micro * 15 : 170 + micro * 45;
    return [val, val, val];
});
const floorRoughnessMap = new THREE.CanvasTexture(floorRoughCanvas);
floorRoughnessMap.wrapS = THREE.RepeatWrapping;
floorRoughnessMap.wrapT = THREE.RepeatWrapping;
floorRoughnessMap.repeat.set(8, 8);

// Metal Texture
const metalCanvas = createNoiseCanvas(512, 512, (u, v) => {
    const n = fbm(u * 8, v * 20, 4);
    const val = 35 + n * 50;
    return [val * 0.75, val * 0.85, val * 1.05];
});
const metalTex = new THREE.CanvasTexture(metalCanvas);
metalTex.wrapS = THREE.RepeatWrapping;
metalTex.wrapT = THREE.RepeatWrapping;

// ==========================================
// DYNAMIC PROCEDURAL HDR ENVIRONMENT
// ==========================================
function generateDynamicEnvMap() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x02050e);

    const l1 = new THREE.PointLight(0x00d8ff, 10, 30);
    l1.position.set(0, 6, 2);
    envScene.add(l1);

    const l2 = new THREE.PointLight(0x7700ff, 8, 40);
    l2.position.set(-10, 8, -10);
    envScene.add(l2);

    const l3 = new THREE.PointLight(0x38bdf8, 6, 30);
    l3.position.set(10, 4, 10);
    envScene.add(l3);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    const envRT = pmrem.fromScene(envScene, 0.04);
    envScene.clear();
    pmrem.dispose();
    return envRT.texture;
}
scene.environment = generateDynamicEnvMap();

// ==========================================
// LIGHTING SETUP
// ==========================================
const ambientLight = new THREE.AmbientLight(0x0a1224, 0.8);
scene.add(ambientLight);

// Key Directional Light
const mainDirLight = new THREE.DirectionalLight(0x6080b0, 1.2);
mainDirLight.position.set(16, 22, 12);
mainDirLight.castShadow = true;
mainDirLight.shadow.mapSize.width = 2048;
mainDirLight.shadow.mapSize.height = 2048;
mainDirLight.shadow.camera.near = 1;
mainDirLight.shadow.camera.far = 100;
mainDirLight.shadow.camera.left = -60;
mainDirLight.shadow.camera.right = 60;
mainDirLight.shadow.camera.top = 60;
mainDirLight.shadow.camera.bottom = -60;
mainDirLight.shadow.bias = -0.0005;
mainDirLight.shadow.normalBias = 0.03;
scene.add(mainDirLight);

// Secondary Fill Light
const fillLight = new THREE.DirectionalLight(0x223355, 0.5);
fillLight.position.set(-15, 12, -10);
scene.add(fillLight);

// Portal Point Lights
const portalCoreLight = new THREE.PointLight(0x00f0ff, 3.5, 22, 1.5);
portalCoreLight.position.set(0, PORTAL_Y, 0.2);
portalCoreLight.castShadow = true;
portalCoreLight.shadow.mapSize.width = 1024;
portalCoreLight.shadow.mapSize.height = 1024;
portalCoreLight.shadow.bias = -0.002;
scene.add(portalCoreLight);

const portalCoreLightSecondary = new THREE.PointLight(0x9900ff, 2.5, 18, 1.8);
portalCoreLightSecondary.position.set(0, PORTAL_Y, -0.5);
scene.add(portalCoreLightSecondary);

const portalFloorLight = new THREE.PointLight(0x00ffcc, 2.2, 12, 2.0);
portalFloorLight.position.set(0, FLOOR_Y + 0.4, 1.0);
scene.add(portalFloorLight);

// ==========================================
// ROOM ARCHITECTURE
// ==========================================

// Planar Mirror Reflector Floor
const reflectorFloor = new Reflector(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    {
        clipBias: 0.003,
        textureWidth: window.innerWidth * renderer.getPixelRatio() * 0.75,
        textureHeight: window.innerHeight * renderer.getPixelRatio() * 0.75,
        color: 0x151e2e,
    }
);
reflectorFloor.rotation.x = -Math.PI / 2;
reflectorFloor.position.y = FLOOR_Y;
scene.add(reflectorFloor);

// Floor Overlay with PBR Normal Map & Puddle Roughness
const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    normalMap: floorNormalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: floorRoughnessMap,
    metalness: 0.65,
    roughness: 0.3,
    transparent: true,
    opacity: 0.5,
    envMapIntensity: 2.2,
});
const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = FLOOR_Y + 0.01;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Ceiling
const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.85,
    roughness: 0.25,
    envMapIntensity: 1.2,
});
const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), ceilingMat);
ceilingMesh.rotation.x = Math.PI / 2;
ceilingMesh.position.y = CEILING_Y;
scene.add(ceilingMesh);

// Columns
const columnGroup = new THREE.Group();
scene.add(columnGroup);

const columnMat = new THREE.MeshStandardMaterial({
    map: metalTex,
    color: 0x242c3d,
    metalness: 0.9,
    roughness: 0.18,
    envMapIntensity: 2.5,
});

const columnEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0x001122,
    emissive: 0x00d8ff,
    emissiveIntensity: 2.0,
    metalness: 0.9,
    roughness: 0.1,
});

const columnPositions = [
    [-12, -12], [12, -12], [-12, 12], [12, 12],
    [-20, -4], [20, -4], [-20, 16], [20, 16],
    [-6, -20], [6, -20]
];

columnPositions.forEach(([x, z]) => {
    const colHeight = CEILING_Y - FLOOR_Y;
    const colGeom = new THREE.CylinderGeometry(0.48, 0.58, colHeight, 32);
    const col = new THREE.Mesh(colGeom, columnMat);
    col.position.set(x, colHeight / 2, z);
    col.castShadow = true;
    col.receiveShadow = true;
    columnGroup.add(col);

    // Base Pedestal
    const baseGeom = new THREE.CylinderGeometry(0.8, 0.95, 0.6, 32);
    const base = new THREE.Mesh(baseGeom, columnMat);
    base.position.set(x, FLOOR_Y + 0.3, z);
    base.castShadow = true;
    columnGroup.add(base);

    // Top Capital
    const capGeom = new THREE.CylinderGeometry(0.95, 0.8, 0.6, 32);
    const cap = new THREE.Mesh(capGeom, columnMat);
    cap.position.set(x, CEILING_Y - 0.3, z);
    cap.castShadow = true;
    columnGroup.add(cap);

    // Emissive Rings
    for (let r = 1; r <= 3; r++) {
        const ringGeom = new THREE.TorusGeometry(0.53, 0.04, 16, 32);
        const ring = new THREE.Mesh(ringGeom, columnEmissiveMat);
        ring.position.set(x, FLOOR_Y + r * 2.8, z);
        ring.rotation.x = Math.PI / 2;
        columnGroup.add(ring);
    }
});

// Roof Beams
for (let x = -20; x <= 20; x += 10) {
    const beamGeom = new THREE.BoxGeometry(0.45, 0.65, ROOM_SIZE);
    const beam = new THREE.Mesh(beamGeom, columnMat);
    beam.position.set(x, CEILING_Y - 0.32, 0);
    beam.castShadow = true;
    scene.add(beam);
}

// ==========================================
// PHYSICAL PORTAL FRAME STRUCTURE
// ==========================================
const portalStructureGroup = new THREE.Group();
portalStructureGroup.position.set(0, PORTAL_Y, 0);
scene.add(portalStructureGroup);

// Outer Metallic Torus Frame
const outerRingGeom = new THREE.TorusGeometry(PORTAL_RADIUS + 0.45, 0.35, 32, 80);
const outerRingMat = new THREE.MeshStandardMaterial({
    map: metalTex,
    color: 0x2a3447,
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 3.5,
});
const outerRing = new THREE.Mesh(outerRingGeom, outerRingMat);
outerRing.castShadow = true;
outerRing.receiveShadow = true;
portalStructureGroup.add(outerRing);

// Rotating Inner Tech Ring
const innerTechRingGroup = new THREE.Group();
portalStructureGroup.add(innerTechRingGroup);

const innerRingGeom = new THREE.TorusGeometry(PORTAL_RADIUS + 0.1, 0.18, 24, 64);
const innerRingMat = new THREE.MeshStandardMaterial({
    color: 0x141d2c,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 2.5,
});
const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
innerTechRingGroup.add(innerRing);

// Emitter Nodes
const nodeGeom = new THREE.BoxGeometry(0.25, 0.45, 0.35);
const nodeEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00e1ff,
    emissiveIntensity: 2.5,
    metalness: 0.8,
    roughness: 0.1,
});

const NODE_COUNT = 12;
const emitterNodes = [];
for (let i = 0; i < NODE_COUNT; i++) {
    const angle = (i / NODE_COUNT) * Math.PI * 2;
    const r = PORTAL_RADIUS + 0.38;

    const nodeHolder = new THREE.Group();
    nodeHolder.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    nodeHolder.rotation.z = angle + Math.PI / 2;

    const nodeMesh = new THREE.Mesh(nodeGeom, outerRingMat);
    nodeMesh.castShadow = true;
    nodeHolder.add(nodeMesh);

    const emissiveCore = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), nodeEmissiveMat);
    emissiveCore.position.z = 0.15;
    nodeHolder.add(emissiveCore);

    innerTechRingGroup.add(nodeHolder);
    emitterNodes.push(emissiveCore);
}

// Portal Base Pedestal
const portalBaseGeom = new THREE.BoxGeometry(4.6, 0.8, 2.2);
const portalBase = new THREE.Mesh(portalBaseGeom, outerRingMat);
portalBase.position.set(0, -PORTAL_RADIUS - 0.2, 0);
portalBase.castShadow = true;
portalBase.receiveShadow = true;
portalStructureGroup.add(portalBase);

// Conduit Cables
for (let i = -1.8; i <= 1.8; i += 0.9) {
    const cableCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(i, -PORTAL_RADIUS, 0),
        new THREE.Vector3(i * 1.3, -PORTAL_RADIUS - 0.8, 0.5),
        new THREE.Vector3(i * 1.5, -PORTAL_Y + 0.3, 1.2),
        new THREE.Vector3(i * 1.8, -PORTAL_Y, 2.0)
    );
    const cableGeom = new THREE.TubeGeometry(cableCurve, 20, 0.08, 12, false);
    const cableMat = new THREE.MeshStandardMaterial({
        color: 0x0c111c,
        metalness: 0.8,
        roughness: 0.4,
    });
    const cable = new THREE.Mesh(cableGeom, cableMat);
    cable.castShadow = true;
    portalStructureGroup.add(cable);
}

// ==========================================
// EVENT HORIZON SINGULARITY SHADER (VORTEX LENS)
// ==========================================
const eventHorizonShader = {
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x00bfff) },
        uColor2: { value: new THREE.Color(0x6600ff) },
        uColor3: { value: new THREE.Color(0xd900ff) },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                               -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ;
            m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        void main() {
            vec2 st = vUv - 0.5;
            float r = length(st) * 2.0;
            float angle = atan(st.y, st.x);

            if (r > 1.0) discard;

            // Swirling fluid vortex
            float spiral = angle + (1.0 - r) * 10.0 - uTime * 1.2;
            vec2 swirlUv = vec2(cos(spiral), sin(spiral)) * r;

            float n1 = snoise(swirlUv * 3.0 + vec2(uTime * 0.3, -uTime * 0.25));
            float n2 = snoise(swirlUv * 6.0 - vec2(uTime * 0.5, uTime * 0.4));

            // Parallax Interdimensional Starfield inside portal view
            float stars = pow(clamp(snoise(st * 35.0 + vec2(uTime * 0.04)), 0.0, 1.0), 10.0) * 2.5;

            // Color gradient layering
            vec3 color = mix(uColor1, uColor2, n1 * 0.5 + 0.5);
            color = mix(color, uColor3, n2 * 0.5 + 0.5);
            color += vec3(stars);

            // Core Singularity & Rim Fresnel
            float coreGlow = pow(1.0 - r, 3.0) * 0.8;
            float rimGlow = pow(r, 3.5) * 1.8;

            color += uColor1 * coreGlow;
            color += uColor2 * rimGlow;

            float alpha = smoothstep(1.0, 0.9, r);
            gl_FragColor = vec4(color, alpha * 0.92);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
};

const eventHorizonMat = new THREE.ShaderMaterial(eventHorizonShader);
const eventHorizonMesh = new THREE.Mesh(
    new THREE.CircleGeometry(PORTAL_RADIUS, 64),
    eventHorizonMat
);
portalStructureGroup.add(eventHorizonMesh);

const eventHorizonBack = new THREE.Mesh(
    new THREE.CircleGeometry(PORTAL_RADIUS, 64),
    eventHorizonMat
);
eventHorizonBack.rotation.y = Math.PI;
portalStructureGroup.add(eventHorizonBack);

// ==========================================
// 3D PLASMA LIGHTNING ARCS
// ==========================================
const LIGHTNING_COUNT = 5;
const lightningGroup = new THREE.Group();
portalStructureGroup.add(lightningGroup);

const lightningMat = new THREE.MeshBasicMaterial({
    color: 0x88eeff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
});

const lightningBolts = [];
for (let i = 0; i < LIGHTNING_COUNT; i++) {
    const geom = new THREE.BufferGeometry();
    const bolt = new THREE.Line(geom, lightningMat);
    lightningGroup.add(bolt);
    lightningBolts.push(bolt);
}

function updateLightning(time) {
    lightningBolts.forEach((bolt, idx) => {
        if (Math.random() > 0.4) {
            bolt.visible = false;
            return;
        }
        bolt.visible = true;

        const startAngle = (idx / LIGHTNING_COUNT) * Math.PI * 2 + time * 0.8;
        const startR = PORTAL_RADIUS * 0.96;
        const startPt = new THREE.Vector3(Math.cos(startAngle) * startR, Math.sin(startAngle) * startR, (Math.random() - 0.5) * 0.2);

        const endR = Math.random() * 0.7;
        const endAngle = startAngle + (Math.random() - 0.5) * 1.5;
        const endPt = new THREE.Vector3(Math.cos(endAngle) * endR, Math.sin(endAngle) * endR, (Math.random() - 0.5) * 0.2);

        const segments = 8;
        const points = [startPt];
        for (let j = 1; j < segments; j++) {
            const t = j / segments;
            const pt = new THREE.Vector3().lerpVectors(startPt, endPt, t);
            pt.x += (Math.random() - 0.5) * 0.25;
            pt.y += (Math.random() - 0.5) * 0.25;
            pt.z += (Math.random() - 0.5) * 0.25;
            points.push(pt);
        }
        points.push(endPt);
        bolt.geometry.setFromPoints(points);
    });
}

// ==========================================
// VOLUMETRIC LIGHT CONE (GOD RAYS)
// ==========================================
const volumetricGeom = new THREE.CylinderGeometry(PORTAL_RADIUS * 0.95, PORTAL_RADIUS * 1.35, 9, 64, 1, true);
volumetricGeom.rotateX(Math.PI / 2);
volumetricGeom.translate(0, 0, 4.5);

const volumetricMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00c8ff) },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            float zFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
            float rim = 1.0 - abs(dot(normalize(vViewPosition), vNormal));
            float noise = sin(vUv.x * 35.0 + uTime * 1.8) * 0.5 + 0.5;

            float alpha = zFade * pow(rim, 2.5) * (0.08 + noise * 0.05);
            gl_FragColor = vec4(uColor, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
});

const volumetricCone = new THREE.Mesh(volumetricGeom, volumetricMat);
portalStructureGroup.add(volumetricCone);

// ==========================================
// SWIRLING PARTICLES & DUST MOTES
// ==========================================
const PARTICLE_COUNT = 4500;
const pGeometry = new THREE.BufferGeometry();
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors = new Float32Array(PARTICLE_COUNT * 3);
const pSizes = new Float32Array(PARTICLE_COUNT);
const pCustomData = new Float32Array(PARTICLE_COUNT * 4);

const pColorPalette = [
    new THREE.Color(0x00ffff),
    new THREE.Color(0x0099ff),
    new THREE.Color(0x8800ff),
    new THREE.Color(0xcc66ff),
    new THREE.Color(0xffffff),
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.3 + Math.random() * 5.0;
    const height = (Math.random() - 0.5) * 7.5;
    const speed = 0.2 + Math.random() * 1.5;

    pCustomData[i * 4] = angle;
    pCustomData[i * 4 + 1] = radius;
    pCustomData[i * 4 + 2] = height;
    pCustomData[i * 4 + 3] = speed;

    pPositions[i * 3] = Math.cos(angle) * radius;
    pPositions[i * 3 + 1] = PORTAL_Y + height;
    pPositions[i * 3 + 2] = Math.sin(angle) * radius;

    const col = pColorPalette[Math.floor(Math.random() * pColorPalette.length)];
    pColors[i * 3] = col.r;
    pColors[i * 3 + 1] = col.g;
    pColors[i * 3 + 2] = col.b;

    pSizes[i] = 0.12 + Math.random() * 0.35;
}

pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeometry.setAttribute('aColor', new THREE.BufferAttribute(pColors, 3));
pGeometry.setAttribute('aSize', new THREE.BufferAttribute(pSizes, 1));

const particleShaderMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
        attribute float aSize;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uPixelRatio;
        void main() {
            vColor = aColor;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float dist = -mvPosition.z;
            gl_PointSize = aSize * uPixelRatio * (240.0 / dist);
            gl_PointSize = clamp(gl_PointSize, 1.0, 14.0);
            vAlpha = smoothstep(32.0, 4.0, dist);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
            vec2 pt = gl_PointCoord - vec2(0.5);
            float d = length(pt);
            if (d > 0.5) discard;
            float glow = pow(1.0 - d * 2.0, 2.0);
            gl_FragColor = vec4(vColor, glow * vAlpha * 0.75);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const particlesMesh = new THREE.Points(pGeometry, particleShaderMat);
scene.add(particlesMesh);

// Dust Motes
const DUST_COUNT = 600;
const dustGeom = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * ROOM_SIZE * 0.6;
    dustPos[i * 3 + 1] = FLOOR_Y + Math.random() * CEILING_Y;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * ROOM_SIZE * 0.6;
}
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
    color: 0x77aaff,
    size: 0.07,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
});
const dustMesh = new THREE.Points(dustGeom, dustMat);
scene.add(dustMesh);

// ==========================================
// POST-PROCESSING PIPELINE
// ==========================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Calibrated Bloom (Focused thresholding so frame is crisp & clear)
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42, // strength
    0.35, // radius
    0.65  // threshold (only highlights bloom)
);
composer.addPass(bloomPass);

// Cinematic Pass: Vignette + Chromatic Aberration + Film Grain
const cinematicPassShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignetteIntensity: { value: 0.4 },
        uAberrationAmount: { value: 0.0018 },
        uGrainAmount: { value: 0.025 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uVignetteIntensity;
        uniform float uAberrationAmount;
        uniform float uGrainAmount;
        varying vec2 vUv;

        float rand(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        void main() {
            vec2 distFromCenter = vUv - vec2(0.5);
            float dist = length(distFromCenter);

            vec2 offset = distFromCenter * uAberrationAmount;
            float r = texture2D(tDiffuse, vUv + offset).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - offset).b;

            vec3 color = vec3(r, g, b);

            float vignette = smoothstep(0.35, 0.35 + 0.45, dist);
            color *= (1.0 - vignette * uVignetteIntensity);

            float grain = (rand(vUv + vec2(uTime * 0.01)) - 0.5) * uGrainAmount;
            color += grain;

            gl_FragColor = vec4(color, 1.0);
        }
    `,
};
const cinematicPass = new ShaderPass(cinematicPassShader);
composer.addPass(cinematicPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ==========================================
// ANIMATION LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // 1. Light Pulsing
    portalCoreLight.intensity = 3.5 + Math.sin(elapsed * 2.5) * 0.8 + Math.sin(elapsed * 6.0) * 0.3;
    portalCoreLightSecondary.intensity = 2.5 + Math.cos(elapsed * 2.0) * 0.6;
    portalFloorLight.intensity = 2.2 + Math.sin(elapsed * 3.5) * 0.5;

    // 2. Ring Rotation
    innerTechRingGroup.rotation.z = elapsed * 0.12;
    outerRing.rotation.z = -elapsed * 0.04;

    // 3. Shaders Update
    eventHorizonMat.uniforms.uTime.value = elapsed;
    volumetricMat.uniforms.uTime.value = elapsed;
    particleShaderMat.uniforms.uTime.value = elapsed;
    cinematicPass.material.uniforms.uTime.value = elapsed;

    // 4. Lightning Update
    updateLightning(elapsed);

    // 5. Particles Update
    const pArr = particlesMesh.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let angle = pCustomData[i * 4] + elapsed * pCustomData[i * 4 + 3] * 0.25;
        let radius = pCustomData[i * 4 + 1] + Math.sin(elapsed * 1.2 + i) * 0.12;
        let height = pCustomData[i * 4 + 2] + Math.cos(elapsed * 1.0 + i * 0.5) * 0.15;

        pArr[i * 3] = Math.cos(angle) * radius;
        pArr[i * 3 + 1] = PORTAL_Y + height;
        pArr[i * 3 + 2] = Math.sin(angle) * radius;
    }
    particlesMesh.geometry.attributes.position.needsUpdate = true;

    // 6. Dust Motion
    const dArr = dustMesh.geometry.attributes.position.array;
    for (let i = 0; i < DUST_COUNT; i++) {
        dArr[i * 3 + 1] += Math.sin(elapsed + i) * 0.002;
        if (dArr[i * 3 + 1] > CEILING_Y) dArr[i * 3 + 1] = FLOOR_Y;
    }
    dustMesh.geometry.attributes.position.needsUpdate = true;

    controls.update();
    composer.render();
}

animate();

setTimeout(() => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
}, 1000);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    reflectorFloor.getRenderTarget().setSize(
        window.innerWidth * renderer.getPixelRatio() * 0.75,
        window.innerHeight * renderer.getPixelRatio() * 0.75
    );
});
