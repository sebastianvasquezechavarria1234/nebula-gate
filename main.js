import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.02);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(14, 7, 14);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 2.5, 0);
controls.minDistance = 4;
controls.maxDistance = 35;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minPolarAngle = Math.PI * 0.12;
controls.update();

const FLOOR_Y = -0.5;
const CEILING_Y = 5.5;
const PORTAL_Y = 2.5;
const FLOOR_CEILING_SIZE = 50;

function createNoiseTexture(w, h, r, g, b, scale) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const n = (Math.random() - 0.5) * scale;
            img.data[i] = Math.max(0, Math.min(255, r + n));
            img.data[i + 1] = Math.max(0, Math.min(255, g + n));
            img.data[i + 2] = Math.max(0, Math.min(255, b + n));
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createFloorGridTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#151530';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
    }
    ctx.strokeStyle = '#1a1a40';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
}

function createColumnTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(256, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 256; x++) {
            const i = (y * 256 + x) * 4;
            const base = 25 + Math.random() * 15;
            const vein = Math.sin(x * 0.05 + y * 0.02) * 8;
            const noise = (Math.random() - 0.5) * 10;
            const v = base + vein + noise;
            img.data[i] = v * 0.6;
            img.data[i + 1] = v * 0.6;
            img.data[i + 2] = v * 1.1;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createColumnNormalMap() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(128, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 128; x++) {
            const i = (y * 128 + x) * 4;
            const nx = Math.sin(x * 0.2) * 30 + (Math.random() - 0.5) * 20;
            const ny = Math.cos(y * 0.1) * 20 + (Math.random() - 0.5) * 15;
            img.data[i] = 128 + nx;
            img.data[i + 1] = 128 + ny;
            img.data[i + 2] = 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const ambientLight = new THREE.AmbientLight(0x0a0a20, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x6677aa, 0.6);
dirLight.position.set(8, 18, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.camera.left = -25;
dirLight.shadow.camera.right = 25;
dirLight.shadow.camera.top = 25;
dirLight.shadow.camera.bottom = -25;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const portalLight = new THREE.PointLight(0x00ffff, 10, 45, 1.2);
portalLight.position.set(0, PORTAL_Y, 0);
portalLight.castShadow = true;
portalLight.shadow.mapSize.width = 1024;
portalLight.shadow.mapSize.height = 1024;
portalLight.shadow.bias = -0.002;
scene.add(portalLight);

const portalLight2 = new THREE.PointLight(0x0066ff, 6, 35, 1.2);
portalLight2.position.set(0, PORTAL_Y, 0);
scene.add(portalLight2);

const portalLight3 = new THREE.PointLight(0x8800ff, 3, 25, 1.5);
portalLight3.position.set(0, PORTAL_Y + 1, 0);
scene.add(portalLight3);

const rimLight = new THREE.PointLight(0xff00aa, 2.5, 20, 2);
rimLight.position.set(0, CEILING_Y - 0.3, 0);
scene.add(rimLight);

const spotLight = new THREE.SpotLight(0x00ccff, 4, 30, Math.PI / 6, 0.5, 1.5);
spotLight.position.set(0, CEILING_Y - 0.1, 0);
spotLight.target.position.set(0, FLOOR_Y, 0);
spotLight.castShadow = true;
scene.add(spotLight);
scene.add(spotLight.target);

const floorTex = createFloorGridTexture();
const floorNormal = createNoiseTexture(256, 256, 128, 128, 255, 30);
const floorGeometry = new THREE.PlaneGeometry(FLOOR_CEILING_SIZE, FLOOR_CEILING_SIZE);
const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTex,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
    color: 0x0c0c1a,
    metalness: 0.85,
    roughness: 0.18,
    envMapIntensity: 1.5,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR_Y;
floor.receiveShadow = true;
scene.add(floor);

const ceilingTex = createNoiseTexture(256, 256, 10, 10, 20, 15);
const ceilingGeometry = new THREE.PlaneGeometry(FLOOR_CEILING_SIZE, FLOOR_CEILING_SIZE);
const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingTex,
    color: 0x0a0a16,
    metalness: 0.9,
    roughness: 0.2,
    side: THREE.DoubleSide,
});
const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = CEILING_Y;
ceiling.receiveShadow = true;
scene.add(ceiling);

const COLUMN_HEIGHT = CEILING_Y - FLOOR_Y;
const COLUMN_Y = (CEILING_Y + FLOOR_Y) / 2;
const colTex = createColumnTexture();
const colNormal = createColumnNormalMap();
const columnGeometry = new THREE.CylinderGeometry(0.22, 0.28, COLUMN_HEIGHT, 20, 8);
const columnMaterial = new THREE.MeshStandardMaterial({
    map: colTex,
    normalMap: colNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0x2a2a44,
    metalness: 0.9,
    roughness: 0.15,
    envMapIntensity: 2,
});

const columns = [];
const gridSize = 10;
const spacing = 3;

for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
        const col = new THREE.Mesh(columnGeometry, columnMaterial);
        col.position.set(
            (x - gridSize / 2 + 0.5) * spacing,
            COLUMN_Y,
            (z - gridSize / 2 + 0.5) * spacing
        );
        col.castShadow = true;
        col.receiveShadow = true;
        scene.add(col);
        columns.push(col);

        const baseGeom = new THREE.CylinderGeometry(0.35, 0.38, 0.2, 20);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a30,
            metalness: 0.95,
            roughness: 0.1,
        });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.set(col.position.x, FLOOR_Y + 0.1, col.position.z);
        base.castShadow = true;
        scene.add(base);

        const capGeom = new THREE.CylinderGeometry(0.38, 0.35, 0.2, 20);
        const cap = new THREE.Mesh(capGeom, baseMat);
        cap.position.set(col.position.x, CEILING_Y - 0.1, col.position.z);
        cap.castShadow = true;
        scene.add(cap);
    }
}

const portalGroup = new THREE.Group();
scene.add(portalGroup);

function createSoftParticleTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(200,255,255,0.9)');
    g.addColorStop(0.2, 'rgba(0,220,255,0.6)');
    g.addColorStop(0.45, 'rgba(0,100,255,0.2)');
    g.addColorStop(0.7, 'rgba(40,0,120,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

function createSparkTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(200,240,255,0.8)');
    g.addColorStop(0.5, 'rgba(100,180,255,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

const softTex = createSoftParticleTexture();
const sparkTex = createSparkTexture();

const PARTICLE_COUNT = 6000;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleColors = new Float32Array(PARTICLE_COUNT * 3);
const particleSizes = new Float32Array(PARTICLE_COUNT);
const particleSpeeds = new Float32Array(PARTICLE_COUNT);
const particleAngles = new Float32Array(PARTICLE_COUNT);
const particleRadii = new Float32Array(PARTICLE_COUNT);
const particleHeights = new Float32Array(PARTICLE_COUNT);

const colorPalette = [
    new THREE.Color(0x00ffff),
    new THREE.Color(0x00ccff),
    new THREE.Color(0x0088ff),
    new THREE.Color(0x3300ff),
    new THREE.Color(0xccccff),
    new THREE.Color(0x00ffbb),
    new THREE.Color(0x8844ff),
    new THREE.Color(0xffffff),
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.15 + Math.random() * 3;
    const height = (Math.random() - 0.5) * 4.2;

    particleAngles[i] = angle;
    particleRadii[i] = radius;
    particleHeights[i] = height;
    particleSpeeds[i] = 0.2 + Math.random() * 2.8;
    particleSizes[i] = 0.15 + Math.random() * 0.4;

    particlePositions[i * 3] = Math.cos(angle) * radius;
    particlePositions[i * 3 + 1] = PORTAL_Y + height;
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius;

    const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    particleColors[i * 3] = c.r;
    particleColors[i * 3 + 1] = c.g;
    particleColors[i * 3 + 2] = c.b;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

const particleMaterial = new THREE.PointsMaterial({
    map: softTex,
    size: 0.5,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
portalGroup.add(particles);

const RING_COUNT = 14;
const ringParticles = [];

for (let r = 0; r < RING_COUNT; r++) {
    const count = 350;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseRadius = 0.4 + r * 0.28;

    const ringColor = r % 3 === 0
        ? new THREE.Color(0x00ffff)
        : r % 3 === 1
            ? new THREE.Color(0x0066ff)
            : new THREE.Color(0x8800ff);

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        positions[i * 3] = Math.cos(angle) * baseRadius;
        positions[i * 3 + 1] = PORTAL_Y;
        positions[i * 3 + 2] = Math.sin(angle) * baseRadius;
        colors[i * 3] = ringColor.r;
        colors[i * 3 + 1] = ringColor.g;
        colors[i * 3 + 2] = ringColor.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        map: softTex,
        size: 0.3,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        vertexColors: true,
    });

    const ring = new THREE.Points(geom, mat);
    ring.userData = { baseRadius, speed: 0.2 + r * 0.12, offset: r * 0.4 };
    portalGroup.add(ring);
    ringParticles.push(ring);
}

const SPARK_COUNT = 1000;
const sparkGeometry = new THREE.BufferGeometry();
const sparkPositions = new Float32Array(SPARK_COUNT * 3);
const sparkColors = new Float32Array(SPARK_COUNT * 3);
const sparkVelocities = [];

const sparkColorOptions = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xaaddff),
    new THREE.Color(0x88ccff),
    new THREE.Color(0xccddff),
];

for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.4;
    sparkPositions[i * 3] = Math.cos(angle) * radius;
    sparkPositions[i * 3 + 1] = PORTAL_Y + (Math.random() - 0.5) * 0.3;
    sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;

    const sc = sparkColorOptions[Math.floor(Math.random() * sparkColorOptions.length)];
    sparkColors[i * 3] = sc.r;
    sparkColors[i * 3 + 1] = sc.g;
    sparkColors[i * 3 + 2] = sc.b;

    sparkVelocities.push({
        x: (Math.random() - 0.5) * 0.06,
        y: Math.random() * 0.12 + 0.03,
        z: (Math.random() - 0.5) * 0.06,
        life: Math.random(),
        maxLife: 0.5 + Math.random() * 1.0,
    });
}

sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));

const sparkMaterial = new THREE.PointsMaterial({
    map: sparkTex,
    size: 0.18,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
});

const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
portalGroup.add(sparks);

const GLOW_COUNT = 2000;
const glowGeometry = new THREE.BufferGeometry();
const glowPositions = new Float32Array(GLOW_COUNT * 3);
const glowColors = new Float32Array(GLOW_COUNT * 3);
const glowSpeeds = new Float32Array(GLOW_COUNT);
const glowAngles = new Float32Array(GLOW_COUNT);
const glowRadii = new Float32Array(GLOW_COUNT);
const glowHeights = new Float32Array(GLOW_COUNT);

const glowColorOptions = [
    new THREE.Color(0x001144),
    new THREE.Color(0x002266),
    new THREE.Color(0x000033),
    new THREE.Color(0x110044),
    new THREE.Color(0x003355),
];

for (let i = 0; i < GLOW_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * 3.5;
    const height = (Math.random() - 0.5) * 4.2;

    glowAngles[i] = angle;
    glowRadii[i] = radius;
    glowHeights[i] = height;
    glowSpeeds[i] = 0.15 + Math.random() * 0.6;

    glowPositions[i * 3] = Math.cos(angle) * radius;
    glowPositions[i * 3 + 1] = PORTAL_Y + height;
    glowPositions[i * 3 + 2] = Math.sin(angle) * radius;

    const gc = glowColorOptions[Math.floor(Math.random() * glowColorOptions.length)];
    glowColors[i * 3] = gc.r;
    glowColors[i * 3 + 1] = gc.g;
    glowColors[i * 3 + 2] = gc.b;
}

glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));

const glowMaterial = new THREE.PointsMaterial({
    map: softTex,
    size: 0.7,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
});

const glowParticles = new THREE.Points(glowGeometry, glowMaterial);
portalGroup.add(glowParticles);

const DUST_COUNT = 300;
const dustGeometry = new THREE.BufferGeometry();
const dustPositions = new Float32Array(DUST_COUNT * 3);
const dustSpeeds = [];

for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 40;
    dustPositions[i * 3 + 1] = FLOOR_Y + Math.random() * COLUMN_HEIGHT;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    dustSpeeds.push({
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.003,
        z: (Math.random() - 0.5) * 0.005,
    });
}

dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

const dustMaterial = new THREE.PointsMaterial({
    map: sparkTex,
    color: 0x334466,
    size: 0.08,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
});

const dust = new THREE.Points(dustGeometry, dustMaterial);
scene.add(dust);

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    portalLight.intensity = 10 + Math.sin(elapsed * 2.5) * 3 + Math.sin(elapsed * 7) * 0.5;
    portalLight2.intensity = 6 + Math.cos(elapsed * 2) * 2;
    portalLight3.intensity = 3 + Math.sin(elapsed * 3.5) * 1.5;
    rimLight.intensity = 2.5 + Math.sin(elapsed * 4) * 1;

    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particleAngles[i] += particleSpeeds[i] * 0.018;
        const breathe = Math.sin(elapsed * 1.5 + i * 0.05) * 0.15;
        const r = particleRadii[i] + breathe;
        positions[i * 3] = Math.cos(particleAngles[i]) * r;
        positions[i * 3 + 1] = PORTAL_Y + particleHeights[i] + Math.sin(elapsed * 1.2 + i * 0.08) * 0.15;
        positions[i * 3 + 2] = Math.sin(particleAngles[i]) * r;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    for (const ring of ringParticles) {
        const { baseRadius, speed, offset } = ring.userData;
        const rPositions = ring.geometry.attributes.position.array;
        const count = rPositions.length / 3;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + elapsed * speed;
            const wobble = Math.sin(elapsed * 1.8 + i * 0.4 + offset) * 0.08;
            const pulse = Math.sin(elapsed * 2.5 + offset) * 0.1;
            rPositions[i * 3] = Math.cos(angle) * (baseRadius + wobble + pulse);
            rPositions[i * 3 + 1] = PORTAL_Y + Math.sin(elapsed * 1.2 + offset) * 0.2;
            rPositions[i * 3 + 2] = Math.sin(angle) * (baseRadius + wobble + pulse);
        }
        ring.geometry.attributes.position.needsUpdate = true;
    }

    const sPositions = sparks.geometry.attributes.position.array;
    for (let i = 0; i < SPARK_COUNT; i++) {
        const v = sparkVelocities[i];
        v.life -= 0.015;
        if (v.life <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.25;
            sPositions[i * 3] = Math.cos(angle) * radius;
            sPositions[i * 3 + 1] = PORTAL_Y;
            sPositions[i * 3 + 2] = Math.sin(angle) * radius;
            v.x = (Math.random() - 0.5) * 0.06;
            v.y = Math.random() * 0.1 + 0.04;
            v.z = (Math.random() - 0.5) * 0.06;
            v.life = v.maxLife;
        } else {
            sPositions[i * 3] += v.x;
            sPositions[i * 3 + 1] += v.y;
            sPositions[i * 3 + 2] += v.z;
            v.y *= 0.995;
        }
    }
    sparks.geometry.attributes.position.needsUpdate = true;

    const gPositions = glowParticles.geometry.attributes.position.array;
    for (let i = 0; i < GLOW_COUNT; i++) {
        glowAngles[i] += glowSpeeds[i] * 0.008;
        const r = glowRadii[i] + Math.sin(elapsed * 0.6 + i * 0.2) * 0.4;
        gPositions[i * 3] = Math.cos(glowAngles[i]) * r;
        gPositions[i * 3 + 1] = PORTAL_Y + glowHeights[i] + Math.sin(elapsed * 0.4 + i * 0.15) * 0.3;
        gPositions[i * 3 + 2] = Math.sin(glowAngles[i]) * r;
    }
    glowParticles.geometry.attributes.position.needsUpdate = true;

    const dPositions = dust.geometry.attributes.position.array;
    for (let i = 0; i < DUST_COUNT; i++) {
        dPositions[i * 3] += dustSpeeds[i].x;
        dPositions[i * 3 + 1] += dustSpeeds[i].y;
        dPositions[i * 3 + 2] += dustSpeeds[i].z;
        if (Math.abs(dPositions[i * 3]) > 20) dustSpeeds[i].x *= -1;
        if (dPositions[i * 3 + 1] < FLOOR_Y + 0.5 || dPositions[i * 3 + 1] > CEILING_Y - 0.5) dustSpeeds[i].y *= -1;
        if (Math.abs(dPositions[i * 3 + 2]) > 20) dustSpeeds[i].z *= -1;
    }
    dust.geometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
