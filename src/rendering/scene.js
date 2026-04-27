import { isMobile, SHARED_GEO, SHARED_MAT } from '../state.js';
import { GAME_NARRATIVE } from '../data/levels.js';

export const canvas = document.getElementById('gameCanvas');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);
scene.fog = new THREE.Fog(0x000011, 50, 200);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, -18);
camera.lookAt(0, -3, 25);

export const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomRes = isMobile
    ? new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2))
    : new THREE.Vector2(window.innerWidth, window.innerHeight);
export const bloomPass = new THREE.UnrealBloomPass(
    bloomRes,
    isMobile ? 0.4 : 0.6,
    0.4,
    0.85
);
composer.addPass(bloomPass);

// Enemy bullet pool — 50 pre-allocated meshes toggled visible/hidden
export const enemyBulletPool = [];
(function initEnemyBulletPool() {
    for (let i = 0; i < 50; i++) {
        const mesh = new THREE.Mesh(SHARED_GEO.enemyBullet, SHARED_MAT.enemyBullet);
        const glow = new THREE.Mesh(SHARED_GEO.enemyBulletGlow, SHARED_MAT.enemyBulletGlow);
        glow.position.z = -0.4;
        mesh.add(glow);
        mesh.visible = false;
        mesh.pooled = true;
        scene.add(mesh);
        enemyBulletPool.push(mesh);
    }
})();

// Engine particle pools
const ENGINE_POOL_COLORS = [0xff6600, 0xff6600, 0xff6600, 0xffaa00, 0xffaa00];
const ENEMY_ENGINE_POOL_COLORS = [0xff00ff, 0xff66ff, 0x00aaff, 0x66ccff, 0xffcc33, 0xffdd66];

export const engineParticlePool = [];
export const enemyEngineParticlePool = [];
(function initEnginePools() {
    for (let i = 0; i < 30; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: ENGINE_POOL_COLORS[i % ENGINE_POOL_COLORS.length],
            transparent: true, opacity: 0.8
        });
        const mesh = new THREE.Mesh(SHARED_GEO.engineParticle, mat);
        mesh.visible = false;
        mesh.pooled = true;
        scene.add(mesh);
        engineParticlePool.push({ mesh, inUse: false });
    }
    for (let i = 0; i < 80; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: ENEMY_ENGINE_POOL_COLORS[i % ENEMY_ENGINE_POOL_COLORS.length],
            transparent: true, opacity: 0.7
        });
        const mesh = new THREE.Mesh(SHARED_GEO.enemyEngineParticle, mat);
        mesh.visible = false;
        mesh.pooled = true;
        scene.add(mesh);
        enemyEngineParticlePool.push({ mesh, inUse: false });
    }
})();

// Star field
function createStars() {
    const layers = [];
    const configs = [
        { count: 400, size: 0.08, opacity: 0.6, twinkle: false },
        { count: 200, size: 0.15, opacity: 0.8, twinkle: true },
        { count: 50,  size: 0.20, opacity: 0.9, twinkle: true },
    ];

    configs.forEach(cfg => {
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: cfg.size,
            transparent: true,
            opacity: cfg.opacity,
            sizeAttenuation: true
        });
        const verts = [];
        for (let i = 0; i < cfg.count; i++) {
            verts.push(
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 60,
                Math.random() * 100 - 20
            );
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const points = new THREE.Points(geo, mat);
        scene.add(points);
        layers.push({ geo, mat, twinkle: cfg.twinkle, baseOpacity: cfg.opacity });
    });

    let frame = 0;
    function animateStars() {
        frame++;
        layers.forEach(layer => {
            const positions = layer.geo.attributes.position.array;
            for (let i = 2; i < positions.length; i += 3) {
                positions[i] -= 0.3;
                if (positions[i] < -20) {
                    positions[i] = 80;
                    positions[i - 2] = (Math.random() - 0.5) * 100;
                    positions[i - 1] = (Math.random() - 0.5) * 60;
                }
            }
            layer.geo.attributes.position.needsUpdate = true;
            if (layer.twinkle) {
                layer.mat.opacity = layer.baseOpacity + Math.sin(frame * 0.05) * 0.15;
            }
        });
    }

    return { update: animateStars, layers };
}

export const starField = createStars();

export function loadLevelTheme(levelNumber) {
    const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
    const theme = levelData ? levelData.theme : GAME_NARRATIVE.levels[GAME_NARRATIVE.levels.length - 1].theme;
    scene.background = new THREE.Color(theme.background.color);
    scene.fog.color = new THREE.Color(theme.background.color);
    if (starField && starField.layers) {
        const c = new THREE.Color(theme.starColor);
        starField.layers.forEach(layer => layer.mat.color.set(c));
    }
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
