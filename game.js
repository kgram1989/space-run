// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyARY6XkSmmu8DsTgKwDHqoWrOXlwd3pvB4",
  authDomain: "space-run-6c91e.firebaseapp.com",
  databaseURL: "https://space-run-6c91e-default-rtdb.firebaseio.com",
  projectId: "space-run-6c91e",
  storageBucket: "space-run-6c91e.firebasestorage.app",
  messagingSenderId: "676180652992",
  appId: "1:676180652992:web:ab390e1b520ccd13da4e25",
  measurementId: "G-1N0H66MFK6"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Three.js Setup
const canvas = document.getElementById('gameCanvas');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const highScoreElement = document.getElementById('highScore');
const levelElement = document.getElementById('level');
const bossHealthBar = document.getElementById('bossHealthBar');
const bossHealthFill = document.getElementById('bossHealthFill');
const gameOverScreen = document.getElementById('gameOver');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const finalScoreElement = document.getElementById('finalScore');
const gameDifficultyElement = document.getElementById('gameDifficulty');
const restartBtn = document.getElementById('restartBtn');
const shareScoreBtn = document.getElementById('shareScoreBtn');
const shareStatusElement = document.getElementById('shareStatus');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const touchControlsEl = document.getElementById('touchControls');
const weaponHudEl = document.getElementById('weaponHUD');
const hudLeftEl = document.querySelector('.hud-left');
const weaponHudDesktopParent = weaponHudEl ? weaponHudEl.parentNode : null;
const weaponHudDesktopNextSibling = weaponHudEl ? weaponHudEl.nextSibling : null;

// Three.js Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);
scene.fog = new THREE.Fog(0x000011, 50, 200);

// Camera Setup - 45 degree angle, flying through space perspective
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, -18);
camera.lookAt(0, -3, 25);

// Renderer Setup
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Post-processing setup - Bloom effect for glow
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomRes = isMobile
    ? new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2))
    : new THREE.Vector2(window.innerWidth, window.innerHeight);
const bloomPass = new THREE.UnrealBloomPass(
    bloomRes,
    isMobile ? 0.4 : 0.6,  // strength (reduced on mobile)
    0.4,  // radius
    0.85  // threshold
);
composer.addPass(bloomPass);

// Centralized mutable runtime state (single-file architecture cleanup).
const gameState = {
    runtime: {
        gameRunning: false,
        gamePaused: false,
        animationId: null,
        difficulty: 'medium',
        score: 0,
        lives: 3,
        targetsHit: 0
    },
    progression: {
        currentLevel: 1,
        enemiesDefeatedThisLevel: 0,
        enemiesRequiredForBoss: 10,
        bossActive: false,
        levelTransitioning: false
    },
    entities: {
        boss: null,
        portal: null,
        portalAnimating: false,
        pickups: [],
        bullets: [],
        enemies: [],
        particles: [],
        enemyLights: [],
        engineParticles: [],
        enemyBullets: [],
        enemyEngineParticles: []
    },
    weapon: {
        lastShotTime: 0,
        lastDropType: null,
        weaponAmmo: { spread: 0 }
    },
    timers: {
        portalAnimationId: null,
        levelTransitionTimeout: null,
        bossPortalTimeout: null,
        enemyEngineParticleCounter: 0,
        lastEnemySpawn: 0,
        engineParticleCounter: 0
    },
    input: {
        tiltAmount: 0,
        keys: {},
        tiltEnabled: false,
        tiltCalibrated: false,
        tiltBaseValue: 0
    },
    audio: {
        isMuted: false,
        masterOutputConnected: true
    },
    effects: {
        cameraShake: {
            intensity: 0,
            decay: 0.9,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0
        },
        cinematicCamera: {
            active: false,
            type: null,  // 'boss_defeat' or 'portal_zoom'
            progress: 0,
            duration: 0,
            startPos: { x: 0, y: 0, z: 0 },
            targetPos: { x: 0, y: 0, z: 0 },
            lookAtTarget: { x: 0, y: 0, z: 0 }
        }
    }
};

function bindStateAlias(name, target, key) {
    Object.defineProperty(globalThis, name, {
        get() {
            return target[key];
        },
        set(value) {
            target[key] = value;
        },
        configurable: true
    });
}

bindStateAlias('gameRunning', gameState.runtime, 'gameRunning');
bindStateAlias('gamePaused', gameState.runtime, 'gamePaused');
bindStateAlias('score', gameState.runtime, 'score');
bindStateAlias('lives', gameState.runtime, 'lives');
bindStateAlias('animationId', gameState.runtime, 'animationId');
bindStateAlias('difficulty', gameState.runtime, 'difficulty');
bindStateAlias('targetsHit', gameState.runtime, 'targetsHit');
bindStateAlias('currentLevel', gameState.progression, 'currentLevel');
bindStateAlias('enemiesDefeatedThisLevel', gameState.progression, 'enemiesDefeatedThisLevel');
bindStateAlias('enemiesRequiredForBoss', gameState.progression, 'enemiesRequiredForBoss');
bindStateAlias('bossActive', gameState.progression, 'bossActive');
bindStateAlias('levelTransitioning', gameState.progression, 'levelTransitioning');
bindStateAlias('boss', gameState.entities, 'boss');
bindStateAlias('portal', gameState.entities, 'portal');
bindStateAlias('portalAnimating', gameState.entities, 'portalAnimating');
bindStateAlias('pickups', gameState.entities, 'pickups');
bindStateAlias('bullets', gameState.entities, 'bullets');
bindStateAlias('enemies', gameState.entities, 'enemies');
bindStateAlias('particles', gameState.entities, 'particles');
bindStateAlias('enemyLights', gameState.entities, 'enemyLights');
bindStateAlias('engineParticles', gameState.entities, 'engineParticles');
bindStateAlias('enemyBullets', gameState.entities, 'enemyBullets');
bindStateAlias('enemyEngineParticles', gameState.entities, 'enemyEngineParticles');
bindStateAlias('lastShotTime', gameState.weapon, 'lastShotTime');
bindStateAlias('lastDropType', gameState.weapon, 'lastDropType');
bindStateAlias('weaponAmmo', gameState.weapon, 'weaponAmmo');
bindStateAlias('portalAnimationId', gameState.timers, 'portalAnimationId');
bindStateAlias('levelTransitionTimeout', gameState.timers, 'levelTransitionTimeout');
bindStateAlias('bossPortalTimeout', gameState.timers, 'bossPortalTimeout');
bindStateAlias('enemyEngineParticleCounter', gameState.timers, 'enemyEngineParticleCounter');
bindStateAlias('lastEnemySpawn', gameState.timers, 'lastEnemySpawn');
bindStateAlias('engineParticleCounter', gameState.timers, 'engineParticleCounter');
bindStateAlias('tiltAmount', gameState.input, 'tiltAmount');
bindStateAlias('tiltEnabled', gameState.input, 'tiltEnabled');
bindStateAlias('tiltCalibrated', gameState.input, 'tiltCalibrated');
bindStateAlias('tiltBaseValue', gameState.input, 'tiltBaseValue');
bindStateAlias('isMuted', gameState.audio, 'isMuted');
bindStateAlias('masterOutputConnected', gameState.audio, 'masterOutputConnected');
bindStateAlias('cameraShake', gameState.effects, 'cameraShake');
bindStateAlias('cinematicCamera', gameState.effects, 'cinematicCamera');

let latestGameSummary = {
    score: 0,
    difficulty: 'medium',
    level: 1,
    highScore: 0,
    playerName: '',
    shareNamePrompted: false
};

// Camera shake system
const baseCameraPosition = { x: 0, y: 12, z: -18 };
const baseCameraLookAt = { x: 0, y: -3, z: 25 };

// Constants for timing and spacing
const PORTAL_SPAWN_DELAY = 1500; // ms after boss defeat
const LEVEL_MESSAGE_DURATION = 2500; // ms
const LEVEL_MESSAGE_FADE_TIME = 500; // ms
const LEVEL_MESSAGE_TOTAL_TIME = 3000; // LEVEL_MESSAGE_DURATION + LEVEL_MESSAGE_FADE_TIME

// Dispose helper — recursively free geometry + material GPU resources
function disposeMesh(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
    }
    if (obj.children) {
        // Copy array since dispose may modify children
        [...obj.children].forEach(child => disposeMesh(child));
    }
}

// Easing Functions
function easeOutQuad(t) {
    return t * (2 - t);  // Smooth deceleration
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;  // Smooth acceleration and deceleration
}

function lerp(start, end, alpha) {
    return start + (end - start) * alpha;  // Linear interpolation
}

// Points multiplier per enemy type (applied on top of difficulty base points)
// Destroyer x1, Interceptor x1.5 (faster/harder to hit), Battlecruiser x2 (2 hits required)
const ENEMY_TYPE_POINTS = [1, 1.5, 2];

// Difficulty settings
const difficultySettings = {
    easy: {
        enemySpeed: { min: 0.08, max: 0.16 },
        spawnInterval: 2000,
        enemyPoints: 10,
        bossHealthMultiplier: 0.7,
        bossBonusMultiplier: 0.8,
        minSpawnInterval: 1200,
        scalingFactor: 0.20,  // Controls growth rate (slower for easy)
        enemyFireInterval: { min: 180, max: 300 },  // frames between enemy shots
        bossFireInterval: 60,
        bossMultiShot: false,
        bossBulletSpeedMultiplier: 1.0,
        bossBurstShots: 2,
        bossBurstPauseFrames: 24
    },
    medium: {
        enemySpeed: { min: 0.16, max: 0.28 },
        spawnInterval: 1400,
        enemyPoints: 15,
        bossHealthMultiplier: 1.0,
        bossBonusMultiplier: 1.0,
        minSpawnInterval: 800,
        scalingFactor: 0.25,  // Medium growth rate
        enemyFireInterval: { min: 120, max: 240 },
        bossFireInterval: 40,
        bossMultiShot: true,
        bossBulletSpeedMultiplier: 1.0,
        bossBurstShots: 2,
        bossBurstPauseFrames: 36
    },
    hard: {
        enemySpeed: { min: 0.28, max: 0.44 },
        spawnInterval: 900,
        enemyPoints: 25,
        bossHealthMultiplier: 1.3,
        bossBonusMultiplier: 1.5,
        minSpawnInterval: 700,
        scalingFactor: 0.28,  // Faster growth but diminishing
        enemyFireInterval: { min: 60, max: 150 },
        bossFireInterval: 32, // Reduced pressure from 25 -> 32
        bossMultiShot: true,
        bossBulletSpeedMultiplier: 0.88,
        bossBurstShots: 2,
        bossBurstPauseFrames: 72
    }
};

// Story & Level Theme Data
const GAME_NARRATIVE = {
    mission: {
        title: "OPERATION DEEP HORIZON",
        briefing: `Year 2247. You've been selected to pilot the experimental fighter "Horizon" on a classified deep-space mission to the Andromeda Sector.

Your cargo: [CLASSIFIED]
Your destination: [REDACTED]
Your orders: Reach the destination. Survive.

Intel suggests heavy resistance across multiple star systems. Good luck, pilot.`
    },

    levels: [
        // Act 1 — Departure
        {
            id: 1,
            systemName: "Sol Boundary",
            description: "Departing Earth's solar system. Enemy scouts detected.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 2,
            systemName: "Proxima Drift",
            description: "First jump complete. Navigating asteroid debris field.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 3,
            systemName: "Crimson Expanse",
            description: "Hostile territory. Red giant star system.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 4,
            systemName: "Void Sector",
            description: "Deep space. Long-range sensors compromised.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 5,
            systemName: "Alpha Centauri Rim",
            description: "Jump beacon locked. Intel: enemy reinforcements inbound.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        // Act 2 — The Revelation
        {
            id: 6,
            systemName: "Barnard's Crossing",
            description: "Command transmission delayed 4 hours. Proceed on last orders.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 7,
            systemName: "Wolf Nebula",
            description: "Intercepted signal: \"The Seed must not reach the Gate.\"",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 8,
            systemName: "Luyten's Debris",
            description: "Wreckage detected — hull markings: Earth registry HZ-01.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 9,
            systemName: "Tau Threshold",
            description: "Cargo resonance spike. Enemy patterns shifting. Stay sharp.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 10,
            systemName: "Kepler Station",
            description: "Command admits: cargo is a resonance device. Nature: classified.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        // Act 3 — The Truth
        {
            id: 11,
            systemName: "Groombridge Rift",
            description: "Alien faction broadcasts peace signal. Command: ignore it.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 12,
            systemName: "Serpens Crossing",
            description: "Decrypted order: destination is not a research base.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 13,
            systemName: "Veil Nebula",
            description: "The cargo pulses. Your shield reacts differently. What is this?",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 14,
            systemName: "Cygnus Dark",
            description: "Command confirmed: destination is a weapons platform, not a base.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 15,
            systemName: "NGC Fringe",
            description: "Final pre-gate transmission: \"Deliver the cargo. No questions.\"",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        // Act 4 — The Gate
        {
            id: 16,
            systemName: "Andromeda Fringe",
            description: "Alien armada on intercept course. All systems at maximum.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 17,
            systemName: "Gate Approach Alpha",
            description: "Command goes dark. You're on your own now.",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 18,
            systemName: "Gate Approach Beta",
            description: "Alien leader: \"That weapon will destroy your world. Turn back.\"",
            theme: { background: { color: 0x000011 }, starColor: 0xffffff }
        },
        {
            id: 19,
            systemName: "Core Defense Ring",
            description: "Last line of defense. The gate is visible. No turning back.",
            theme: { background: { color: 0x110500 }, starColor: 0xff6633 }
        },
        {
            id: 20,
            systemName: "Andromeda Gate",
            description: "Final approach. The mission ends here. Make it count.",
            theme: { background: { color: 0x1a0000 }, starColor: 0xff2200 }
        }
    ]
};

// Player
const player = {
    x: 0,
    y: -5,  // Fixed center position
    z: 0,
    width: 3,
    height: 4,
    speed: 0.5,
    maxSpeed: 0.4,  // Reduced for better precision
    acceleration: 0.03,  // Slower acceleration for smoother control
    friction: 0.92,  // Higher friction for faster stopping
    velocityX: 0,
    mesh: null,
    wings: null,  // Reference to wings for animation
    leftEngine: null,  // Reference to left engine glow
    rightEngine: null,  // Reference to right engine glow
    shieldStrength: 3,
    shieldMax: 3,
    shieldMesh: null,
    invulnerable: false,
    invulnerableTimer: 0,
    weaponType: 'default'
};

// Weapon definitions
const WEAPONS = {
    default: {
        name: 'BLASTERS',
        symbol: '\u2759\u2759\u2759',
        fireInterval: 150,
        bulletSpeed: 1.2,
        damage: 1,
        piercing: false,
        color: 0xffff00,
        emissiveColor: 0xffff00
    },
    spread: {
        name: 'SPREAD SHOT',
        symbol: '\u2747',
        fireInterval: 210,
        bulletSpeed: 1.0,
        damage: 1,
        piercing: false,
        color: 0x00ff66,
        emissiveColor: 0x00ff66
    }
};

const PICKUP_TYPES = ['spread', 'shield'];
const PICKUP_COLORS = {
    spread: 0x00ff66,
    shield: 0x00aaff,
    extraLife: 0xff66cc
};
const PICKUP_SYMBOLS = {
    spread: '\u2747',
    shield: '\ud83d\udee1',
    extraLife: '\u2665'
};

// Shared geometries — created once, reused to reduce GPU allocations
const SHARED_GEO = {
    bulletDefault: new THREE.CylinderGeometry(0.2, 0.2, 1.5, 6),
    bulletSpread: new THREE.CylinderGeometry(0.18, 0.18, 1.0, 6),
    engineParticle: new THREE.SphereGeometry(0.15, 6, 6),
    enemyEngineParticle: new THREE.SphereGeometry(0.1, 6, 6),
    explosionFlash: new THREE.SphereGeometry(1.2, 12, 12),
    explosionRing: new THREE.TorusGeometry(0.4, 0.07, 8, 16),
    explosionParticle: new THREE.SphereGeometry(0.12, 6, 6),
    bossFlash: new THREE.SphereGeometry(2, 16, 16),
    bossRing: new THREE.TorusGeometry(0.6, 0.1, 8, 16),
    bossParticle: new THREE.SphereGeometry(0.2, 6, 6),
    enemyBullet: (() => { const g = new THREE.SphereGeometry(0.25, 8, 8); g.scale(1, 1, 2); return g; })(),
    enemyBulletGlow: new THREE.SphereGeometry(0.15, 6, 6),
};

// Shared materials — created once to avoid per-frame GPU allocations
const SHARED_MAT = {
    bulletDefault: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    bulletSpread: new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
    enemyBullet: new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.9 }),
    enemyBulletGlow: new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 }),
};

// Enemy bullet pool — pre-allocated meshes toggled visible/hidden instead of create/destroy each shot
const enemyBulletPool = [];
(function() {
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

// Engine particle pools — pre-allocated with individual material instances for per-particle opacity
const ENGINE_POOL_COLORS = [0xff6600, 0xff6600, 0xff6600, 0xffaa00, 0xffaa00];
const ENEMY_ENGINE_POOL_COLORS = [0xff00ff, 0xff66ff, 0x00aaff, 0x66ccff, 0xffcc33, 0xffdd66];
const engineParticlePool = [];
const enemyEngineParticlePool = [];
(function() {
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

// Create Player Mesh - Modern Fighter Design
function createPlayer() {
    const group = new THREE.Group();

    // Main body - sleek fuselage (grey metallic)
    const bodyGeometry = new THREE.CylinderGeometry(0.6, 0.8, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        emissive: 0x444444,
        emissiveIntensity: 0.3,
        metalness: 0.9,
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Nose cone (darker grey)
    const noseGeometry = new THREE.ConeGeometry(0.6, 1.8, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        emissive: 0x333333,
        emissiveIntensity: 0.3,
        metalness: 0.9,
        roughness: 0.15
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 2.5;
    group.add(nose);

    // Wings (light grey)
    const wingGeometry = new THREE.BoxGeometry(5, 0.2, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        emissive: 0x555555,
        emissiveIntensity: 0.2,
        metalness: 0.8,
        roughness: 0.3
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.z = -0.5;
    group.add(wings);

    // Cockpit (blue tint for glass)
    const cockpitGeometry = new THREE.SphereGeometry(0.7, 12, 12);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        emissive: 0x2244aa,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7,
        metalness: 0.9,
        roughness: 0.1
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.scale.set(0.8, 0.7, 0.9);
    cockpit.position.z = 0.7;
    cockpit.position.y = 0.5;
    group.add(cockpit);

    // Engine thrusters (2)
    const engineGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1, 6);
    const engineMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        emissive: 0xff4400,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.3
    });

    const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    leftEngine.rotation.x = Math.PI / 2;
    leftEngine.position.set(-1.2, 0, -2);
    group.add(leftEngine);

    const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    rightEngine.rotation.x = Math.PI / 2;
    rightEngine.position.set(1.2, 0, -2);
    group.add(rightEngine);

    // Engine glow particles
    const glowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.7
    });

    const leftGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    leftGlow.position.set(-1.2, 0, -2.8);
    group.add(leftGlow);

    const rightGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    rightGlow.position.set(1.2, 0, -2.8);
    group.add(rightGlow);

    // Scale the ship
    group.scale.set(1.0, 1.0, 1.0);

    player.mesh = group;
    player.wings = wings;  // Store reference for animation
    player.leftEngine = leftGlow;  // Store reference for glow animation
    player.rightEngine = rightGlow;  // Store reference for glow animation
    player.mesh.castShadow = !isMobile;
    player.mesh.receiveShadow = !isMobile;
    scene.add(player.mesh);
}

// Shield System
function createShieldMesh() {
    const shieldGroup = new THREE.Group();

    // Main shield bubble
    const shieldGeometry = new THREE.SphereGeometry(3.0, 24, 24);
    const shieldMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ccff,
        emissive: 0x0088ff,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.15,
        metalness: 0.9,
        roughness: 0.1,
        side: THREE.DoubleSide
    });
    const shieldSphere = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shieldGroup.add(shieldSphere);

    // Inner glow
    const innerGlowGeometry = new THREE.SphereGeometry(2.8, 16, 16);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.05
    });
    shieldGroup.add(new THREE.Mesh(innerGlowGeometry, innerGlowMaterial));

    // Hex wireframe overlay
    const wireGeometry = new THREE.IcosahedronGeometry(3.05, 1);
    const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.12
    });
    shieldGroup.add(new THREE.Mesh(wireGeometry, wireMaterial));

    player.shieldMesh = shieldGroup;
    player.mesh.add(shieldGroup);
}

function updateShield() {
    if (!player.shieldMesh) return;

    if (player.shieldStrength > 0) {
        // Rotate wireframe
        const wireframe = player.shieldMesh.children[2];
        if (wireframe) {
            wireframe.rotation.y += 0.005;
            wireframe.rotation.x += 0.003;
        }
        // Pulse opacity — scales with current strength
        const shieldSphere = player.shieldMesh.children[0];
        if (shieldSphere && shieldSphere.material) {
            const ratio = player.shieldStrength / player.shieldMax;
            const baseOpacity = 0.07 + ratio * 0.10;
            shieldSphere.material.opacity = Math.sin(Date.now() * 0.003) * 0.03 + baseOpacity;
        }
    }

    // Invulnerability flash
    if (player.invulnerable) {
        player.invulnerableTimer--;
        if (player.mesh) {
            player.mesh.visible = Math.floor(player.invulnerableTimer / 4) % 2 === 0;
        }
        if (player.invulnerableTimer <= 0) {
            player.invulnerable = false;
            if (player.mesh) player.mesh.visible = true;
        }
    }
}

function updateShieldVisuals() {
    if (!player.shieldMesh) return;
    const sphere = player.shieldMesh.children[0];
    const wire   = player.shieldMesh.children[2];
    const ratio  = player.shieldStrength / player.shieldMax;

    if (sphere && sphere.material) {
        sphere.material.opacity = 0.07 + ratio * 0.10;
        const hue = ratio > 0.5 ? 0x00ccff : 0xff9900;
        sphere.material.color.setHex(hue);
        sphere.material.emissive.setHex(ratio > 0.5 ? 0x0088ff : 0xff6600);
    }
    if (wire && wire.material) {
        wire.material.opacity = 0.06 + ratio * 0.08;
    }
    player.shieldMesh.visible = player.shieldStrength > 0;
}

function updateShieldHUD() {
    const pips = document.querySelectorAll('.shield-pip');
    pips.forEach((pip, i) => {
        pip.classList.toggle('active', i < player.shieldStrength);
    });
}

function damageShield() {
    player.shieldStrength--;
    updateShieldHUD();

    if (player.shieldStrength <= 0) {
        breakShield();
    } else {
        // Brief invulnerability so simultaneous enemy body + bullet can't drain 2 pips in one frame
        player.invulnerable = true;
        player.invulnerableTimer = 18;

        playShieldHitSound();
        shakeCamera(0.08);
        updateShieldVisuals();

        // Brief bright flash on the shield bubble
        if (player.shieldMesh) {
            const sphere = player.shieldMesh.children[0];
            if (sphere && sphere.material) {
                sphere.material.opacity = 0.6;
                setTimeout(() => {
                    if (sphere.material) {
                        const ratio = player.shieldStrength / player.shieldMax;
                        sphere.material.opacity = 0.07 + ratio * 0.10;
                    }
                }, 120);
            }
        }
    }
}

function breakShield() {
    player.shieldStrength = 0;
    player.invulnerable = true;
    player.invulnerableTimer = 60;

    playShieldBreakSound();
    shakeCamera(0.2);
    updateShieldVisuals();
    updateShieldHUD();

    if (player.shieldMesh) {
        player.shieldMesh.visible = false;
    }

    const px = player.x;
    const py = player.y;
    const pz = player.z;

    // Expanding ring
    const ringGeometry = new THREE.TorusGeometry(1.0, 0.08, 8, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.position.set(px, py, pz);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 15,
        isShockwave: true,
        expandRate: 0.25
    });

    // Flash sphere
    const flashGeometry = new THREE.SphereGeometry(2.0, 12, 12);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.8
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.set(px, py, pz);
    scene.add(flashMesh);
    particles.push({
        mesh: flashMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 8,
        isFlash: true
    });

    // Scatter particles
    for (let i = 0; i < 15; i++) {
        const size = 0.08 + Math.random() * 0.12;
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0x00ffff : 0x0088ff
        });
        const particleMesh = new THREE.Mesh(geometry, material);
        particleMesh.position.set(px, py, pz);
        const speed = 0.2 + Math.random() * 0.4;
        scene.add(particleMesh);
        particles.push({
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            ),
            life: 25
        });
    }
}

function restoreShield() {
    player.shieldStrength = player.shieldMax;
    updateShieldVisuals();
    updateShieldHUD();
    if (player.shieldMesh) {
        player.shieldMesh.visible = true;
    }
}

// Keys
const keys = gameState.input.keys;

// Sound System - Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

function applyMuteState() {
    const gainValue = isMuted ? 0 : 1;
    // Apply both direct value and automation for better cross-browser reliability.
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.value = gainValue;
    masterGain.gain.setValueAtTime(gainValue, audioContext.currentTime);
    // Hard mute fallback: disconnect output path while muted.
    if (isMuted && masterOutputConnected) {
        masterGain.disconnect();
        masterOutputConnected = false;
    } else if (!isMuted && !masterOutputConnected) {
        masterGain.connect(audioContext.destination);
        masterOutputConnected = true;
    }
}

function toggleMute() {
    isMuted = !isMuted;
    applyMuteState();
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';
        muteBtn.blur();
    }
}

function ensureAudioContext() {
    if (audioContext.state === 'suspended') {
        // Fire-and-forget resume — callers are synchronous so no await needed.
        // applyMuteState is called again in the callback to handle the resumed state.
        audioContext.resume().then(() => applyMuteState()).catch(e => {
            console.warn('Failed to resume audio context:', e);
        });
    }
    // Apply mute state immediately for the current frame regardless of resume result.
    applyMuteState();
}

function playShootSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.value = 800;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playExplosionSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
    oscillator.type = 'sawtooth';

    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playHitSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.value = 300;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

function playGameOverSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
    oscillator.type = 'triangle';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playBossHitSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.value = 150;
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

function playLevelCompleteSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playPortalSound() {
    if (isMuted) return;
    ensureAudioContext();
    // Create multiple oscillators for a rich portal/wormhole sound
    const duration = 2.5;

    // Low frequency rumble
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bass.connect(bassGain);
    bassGain.connect(masterGain);
    bass.frequency.setValueAtTime(50, audioContext.currentTime);
    bass.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + duration);
    bass.type = 'sine';
    bassGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    // Rising sweep
    const sweep = audioContext.createOscillator();
    const sweepGain = audioContext.createGain();
    sweep.connect(sweepGain);
    sweepGain.connect(masterGain);
    sweep.frequency.setValueAtTime(200, audioContext.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + duration);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.15, audioContext.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    // Warbling effect
    const warble = audioContext.createOscillator();
    const warbleGain = audioContext.createGain();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();

    lfo.connect(lfoGain);
    lfoGain.connect(warble.frequency);
    warble.connect(warbleGain);
    warbleGain.connect(masterGain);

    lfo.frequency.value = 6; // 6 Hz wobble
    lfoGain.gain.value = 100;
    warble.frequency.value = 800;
    warble.type = 'triangle';
    warbleGain.gain.setValueAtTime(0.1, audioContext.currentTime);
    warbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    // Start all oscillators
    bass.start(audioContext.currentTime);
    bass.stop(audioContext.currentTime + duration);
    sweep.start(audioContext.currentTime);
    sweep.stop(audioContext.currentTime + duration);
    warble.start(audioContext.currentTime);
    warble.stop(audioContext.currentTime + duration);
    lfo.start(audioContext.currentTime);
    lfo.stop(audioContext.currentTime + duration);
}

function playShieldBreakSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
    filter.Q.value = 2;

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

function playShieldHitSound() {
    if (isMuted) return;
    ensureAudioContext();
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.18, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.start();
    osc.stop(audioContext.currentTime + 0.15);
}

function playEnemyShootSound() {
    if (isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.08);
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' && gameRunning) {
        e.preventDefault();
        if (!gamePaused && !levelTransitioning) {
            shootBullet();
        }
    }

    // P key to toggle pause
    if ((e.key === 'p' || e.key === 'P') && gameRunning) {
        e.preventDefault();
        togglePause();
    }

    // ESC key to exit game (or unpause if paused)
    if (e.key === 'Escape' && gameRunning) {
        e.preventDefault();
        if (gamePaused) {
            togglePause(); // Unpause with ESC
        } else {
            endGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

restartBtn.addEventListener('click', () => {
    const titleEl = document.getElementById('gameOverTitle');
    if (titleEl) titleEl.textContent = 'GAME OVER';
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    if (shareStatusElement) {
        shareStatusElement.textContent = '';
        shareStatusElement.classList.add('hidden');
    }
});

function setShareStatus(message) {
    if (!shareStatusElement) return;
    shareStatusElement.textContent = message;
    if (message) {
        shareStatusElement.classList.remove('hidden');
    } else {
        shareStatusElement.classList.add('hidden');
    }
}

function sanitizeShareName(value) {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().substring(0, 20);
}

function maybeCaptureShareName() {
    if (latestGameSummary.shareNamePrompted) return;
    latestGameSummary.shareNamePrompted = true;

    // Use saved name from localStorage silently — no prompt()
    const savedName = sanitizeShareName(localStorage.getItem('spaceRunShareName') || '');
    if (!latestGameSummary.playerName && savedName) {
        latestGameSummary.playerName = savedName;
    }
}

function buildShareText() {
    const name = sanitizeShareName(latestGameSummary.playerName);
    const actorText = name ? `${name} scored` : 'I scored';
    const runText = `${actorText} ${latestGameSummary.score} in Space Run (${latestGameSummary.difficulty.toUpperCase()} L${latestGameSummary.level}).`;
    return {
        title: 'Space Run',
        text: runText,
        combinedText: `${runText} #SpaceRun`
    };
}

function getCurrentHighScoreValue() {
    const parsed = Number.parseInt(highScoreElement ? highScoreElement.textContent : '', 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return Math.max(0, Number(latestGameSummary.highScore) || 0, Number(latestGameSummary.score) || 0);
}

async function captureShareImage() {
    try {
        if (typeof html2canvas !== 'function') return null;
        const el = document.getElementById('gameOver');
        if (!el) return null;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

        // Clone into a full-screen fixed overlay so html2canvas can reliably
        // measure the element's position (off-screen coords skew its origin).
        // The clone mimics the game-over appearance so the brief overlay (~300ms)
        // is visually seamless. Issues avoided:
        //   1. transform:translate(-50%,-50%) — 4-quadrant tiling artifact
        //   2. backdrop-filter — renders black on iOS Safari
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;';

        const clone = el.cloneNode(true);
        clone.style.cssText = [
            'position:relative',
            'transform:none',
            'backdrop-filter:none',
            '-webkit-backdrop-filter:none',
            'background:rgb(25,5,5)',
            `width:${el.offsetWidth}px`
        ].join(';');

        // h2 CSS class sets -webkit-text-fill-color:transparent via gradient clip,
        // which html2canvas cannot render. Strip the class and use a plain colour.
        const h2 = clone.querySelector('h2');
        if (h2) {
            h2.className = '';
            h2.style.cssText = 'background:none;color:#ff4400;font-size:3.5em;font-weight:900;letter-spacing:4px;margin-bottom:20px;';
        }

        // Remove elements not wanted in screenshot
        clone.querySelector('.game-over-actions')?.remove();
        clone.querySelector('#nameEntry')?.remove();
        clone.querySelector('#shareStatus')?.remove();

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        let file = null;
        try {
            const canvas = await html2canvas(clone, {
                backgroundColor: '#190505',
                scale: isIOS ? 1 : (window.devicePixelRatio || 2),
                logging: false,
                useCORS: true,
                allowTaint: true
            });
            file = await new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    if (!blob) { resolve(null); return; }
                    resolve(new File([blob], `space-run-${Date.now()}.png`, { type: 'image/png' }));
                }, 'image/png');
            });
        } finally {
            document.body.removeChild(wrapper);
        }
        return file;
    } catch (e) {
        return null;
    }
}

async function shareLatestScore() {
    maybeCaptureShareName();
    const payload = buildShareText();

    if (shareScoreBtn) shareScoreBtn.disabled = true;
    setShareStatus('Sharing...');

    try {
        if (navigator.share) {
            const screenshot = await captureShareImage();
            const canShareFile = screenshot && navigator.canShare && navigator.canShare({ files: [screenshot] });
            if (canShareFile) {
                await navigator.share({ title: payload.title, text: payload.text, files: [screenshot] });
                setShareStatus('Shared score with screenshot.');
            } else {
                await navigator.share({ title: payload.title, text: payload.text });
                setShareStatus('Shared score.');
            }
        } else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(payload.combinedText);
            setShareStatus('Score copied to clipboard.');
        } else {
            const shareUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(payload.combinedText);
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
            setShareStatus('Opened share link.');
        }
    } catch (e) {
        if (e && e.name === 'AbortError') {
            setShareStatus('');
            return;
        }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(payload.combinedText);
                setShareStatus('Score copied to clipboard.');
            } else {
                const shareUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(payload.combinedText);
                window.open(shareUrl, '_blank', 'noopener,noreferrer');
                setShareStatus('Opened share link.');
            }
        } catch (fallbackError) {
            setShareStatus('Unable to share automatically.');
        }
    } finally {
        if (shareScoreBtn) shareScoreBtn.disabled = false;
    }
}

if (shareScoreBtn) {
    shareScoreBtn.addEventListener('click', shareLatestScore);
}

difficultyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        difficulty = e.target.dataset.difficulty;
        // Request tilt permission on iOS (must be in direct user gesture, only once)
        if (!tiltEnabled && typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => { if (state === 'granted') enableTiltControls(); })
                .catch(() => {});
        }
        // Lock orientation to landscape on mobile (more reliable than Fullscreen API)
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }

        startGame();
    });
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 30);
directionalLight.castShadow = !isMobile;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// Camera Shake System
function shakeCamera(intensity = 0.5) {
    cameraShake.intensity = intensity;
}

function updateCameraShake() {
    // Cinematic camera takes priority
    if (cinematicCamera.active) {
        updateCinematicCamera();
        return;
    }

    if (cameraShake.intensity > 0.01) {
        // Generate random shake offset
        cameraShake.offsetX = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.offsetY = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.offsetZ = (Math.random() - 0.5) * cameraShake.intensity * 0.5;

        // Apply shake to camera
        camera.position.set(
            baseCameraPosition.x + cameraShake.offsetX,
            baseCameraPosition.y + cameraShake.offsetY,
            baseCameraPosition.z + cameraShake.offsetZ
        );
        camera.lookAt(
            baseCameraLookAt.x + cameraShake.offsetX * 0.5,
            baseCameraLookAt.y + cameraShake.offsetY * 0.5,
            baseCameraLookAt.z
        );

        // Decay shake intensity
        cameraShake.intensity *= cameraShake.decay;
    } else {
        // Reset to base position when shake is minimal
        if (cameraShake.intensity > 0) {
            camera.position.set(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z);
            camera.lookAt(baseCameraLookAt.x, baseCameraLookAt.y, baseCameraLookAt.z);
            cameraShake.intensity = 0;
        }
    }
}

function startCinematicCamera(type, target) {
    cinematicCamera.active = true;
    cinematicCamera.type = type;
    cinematicCamera.progress = 0;
    cinematicCamera.startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    if (type === 'boss_defeat') {
        cinematicCamera.duration = 90;  // 1.5 seconds at 60fps
        cinematicCamera.lookAtTarget = { x: target.x, y: target.y, z: target.z };
    } else if (type === 'portal_zoom') {
        cinematicCamera.duration = 60;  // 1 second
        cinematicCamera.targetPos = { x: 0, y: -2, z: 40 };  // Closer to portal
        cinematicCamera.lookAtTarget = { x: 0, y: -5, z: 50 };
    }
}

function updateCinematicCamera() {
    if (!cinematicCamera.active) return;

    cinematicCamera.progress++;
    const t = cinematicCamera.progress / cinematicCamera.duration;
    const eased = easeInOutQuad(t);

    if (cinematicCamera.type === 'boss_defeat') {
        // Orbit around explosion point
        const angle = t * Math.PI * 0.5;  // 90 degree orbit
        const radius = 25;
        const height = 10 + Math.sin(t * Math.PI) * 5;  // Wave up and down

        camera.position.set(
            cinematicCamera.lookAtTarget.x + Math.cos(angle) * radius,
            cinematicCamera.lookAtTarget.y + height,
            cinematicCamera.lookAtTarget.z - Math.sin(angle) * radius
        );
        camera.lookAt(
            cinematicCamera.lookAtTarget.x,
            cinematicCamera.lookAtTarget.y,
            cinematicCamera.lookAtTarget.z
        );
    } else if (cinematicCamera.type === 'portal_zoom') {
        // Zoom toward portal
        camera.position.set(
            lerp(cinematicCamera.startPos.x, cinematicCamera.targetPos.x, eased),
            lerp(cinematicCamera.startPos.y, cinematicCamera.targetPos.y, eased),
            lerp(cinematicCamera.startPos.z, cinematicCamera.targetPos.z, eased)
        );
        camera.lookAt(
            cinematicCamera.lookAtTarget.x,
            cinematicCamera.lookAtTarget.y,
            cinematicCamera.lookAtTarget.z
        );
    }

    // End cinematic
    if (cinematicCamera.progress >= cinematicCamera.duration) {
        cinematicCamera.active = false;
        // Reset camera to base position
        camera.position.set(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z);
        camera.lookAt(baseCameraLookAt.x, baseCameraLookAt.y, baseCameraLookAt.z);
    }
}

// Move Player
function movePlayer() {
    // Scale player speed with level (10% per level, capped at 2x)
    const speedMultiplier = Math.min(2.0, 1 + (currentLevel - 1) * 0.1);
    const currentAccel = player.acceleration * speedMultiplier;
    const currentMaxSpeed = player.maxSpeed * speedMultiplier;

    // Horizontal movement (keyboard, touch buttons, or tilt)
    const moveLeft = keys['ArrowLeft'];
    const moveRight = keys['ArrowRight'];

    if (moveLeft) {
        player.velocityX -= currentAccel;
    }
    if (moveRight) {
        player.velocityX += currentAccel;
    }

    // Tilt: apply proportional acceleration + friction so ship reaches a
    // proportional terminal velocity instead of always maxing out
    if (tiltAmount !== 0 && !moveLeft && !moveRight) {
        player.velocityX += tiltAmount * currentAccel;
        player.velocityX *= player.friction;
    } else if (tiltAmount === 0 && !moveLeft && !moveRight) {
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.01) {
            player.velocityX = 0;
        }
    }

    if (player.velocityX > currentMaxSpeed) player.velocityX = currentMaxSpeed;
    if (player.velocityX < -currentMaxSpeed) player.velocityX = -currentMaxSpeed;

    player.x -= player.velocityX;  // Flipped to fix opposite movement

    // Compute visible x-boundary at the player's depth from the camera frustum
    const playerWorld = new THREE.Vector3(0, player.y, player.z);
    const distToPlayer = camera.position.distanceTo(playerWorld);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(vFov / 2) * distToPlayer;
    const visibleWidth = visibleHeight * camera.aspect;
    const boundary = (visibleWidth / 2) * 0.9; // 90% to keep ship fully visible

    if (player.x < -boundary) {
        player.x = -boundary;
        player.velocityX = 0;
    }
    if (player.x > boundary) {
        player.x = boundary;
        player.velocityX = 0;
    }

    if (player.mesh) {
        player.mesh.position.set(player.x, player.y, player.z);

        // Smooth eased rotation based on velocity
        const targetRotation = -player.velocityX * 0.8;  // Increased for more dramatic tilt
        player.mesh.rotation.z = lerp(player.mesh.rotation.z, targetRotation, 0.15);  // Smooth interpolation

        // Wing tilt animation - wings tilt opposite to ship rotation
        if (player.wings) {
            const wingTilt = player.velocityX * 0.3;
            player.wings.rotation.x = lerp(player.wings.rotation.x, wingTilt, 0.1);
        }

        // Engine glow intensity based on movement
        if (player.leftEngine && player.rightEngine) {
            const movementIntensity = Math.abs(player.velocityX) / player.maxSpeed;
            const baseIntensity = 0.8;
            const activeIntensity = baseIntensity + movementIntensity * 0.4;

            // Pulse slightly for life
            const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 1;

            if (player.leftEngine.material && player.leftEngine.material.emissiveIntensity !== undefined) {
                player.leftEngine.material.emissiveIntensity = activeIntensity * pulse;
            }
            if (player.rightEngine.material && player.rightEngine.material.emissiveIntensity !== undefined) {
                player.rightEngine.material.emissiveIntensity = activeIntensity * pulse;
            }

            // Scale engines slightly based on movement
            const engineScale = 1 + movementIntensity * 0.2;
            player.leftEngine.scale.set(engineScale, engineScale, engineScale);
            player.rightEngine.scale.set(engineScale, engineScale, engineScale);
        }
    }
}

// Weapon system - fire rate check
function canShoot() {
    const now = Date.now();
    const weapon = WEAPONS[player.weaponType];
    if (now - lastShotTime < weapon.fireInterval) return false;
    lastShotTime = now;
    return true;
}

function createBulletMesh(weapon, radius) {
    const geo = (radius <= 0.18) ? SHARED_GEO.bulletSpread : SHARED_GEO.bulletDefault;
    const mat = (radius <= 0.18) ? SHARED_MAT.bulletSpread : SHARED_MAT.bulletDefault;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
}

function addBullet(mesh, weapon, velocity) {
    const bullet = {
        mesh: mesh,
        speed: velocity || weapon.bulletSpeed,
        damage: weapon.damage,
        piercing: weapon.piercing
    };
    bullets.push(bullet);
    scene.add(mesh);
    return bullet;
}

// Bullet - Shoot based on current weapon type
function shootBullet() {
    if (!canShoot()) return;

    // Check ammo for non-default weapons
    if (player.weaponType !== 'default') {
        if (weaponAmmo[player.weaponType] <= 0) {
            player.weaponType = 'default';
            updateWeaponHUD();
        }
    }

    playShootSound();
    const weapon = WEAPONS[player.weaponType];

    switch (player.weaponType) {
        case 'spread':
            shootSpread(weapon);
            break;
        default:
            shootDefault(weapon);
            break;
    }

    // Consume ammo for non-default weapons
    if (player.weaponType !== 'default') {
        weaponAmmo[player.weaponType]--;
        updateWeaponHUD();
        if (weaponAmmo[player.weaponType] <= 0) {
            player.weaponType = 'default';
            updateWeaponHUD();
        }
    }
}

function shootDefault(weapon) {
    const positions = [
        { x: 0, z: 4 },
        { x: -1.8, z: 3.5 },
        { x: 1.8, z: 3.5 }
    ];
    positions.forEach(offset => {
        const mesh = createBulletMesh(weapon, 0.2);
        mesh.position.set(player.x + offset.x, player.y, player.z + offset.z);
        addBullet(mesh, weapon);
    });
}

function shootSpread(weapon) {
    const angles = [-0.15, -0.07, 0, 0.07, 0.15];
    angles.forEach(angle => {
        const mesh = createBulletMesh(weapon, 0.18);
        mesh.position.set(player.x, player.y, player.z + 4);
        const bullet = addBullet(mesh, weapon);
        bullet.velocityX = angle * weapon.bulletSpeed;
    });
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.z += bullet.speed;

        // Spread shot lateral movement
        if (bullet.velocityX) {
            bullet.mesh.position.x += bullet.velocityX;
        }


        if (bullet.mesh.position.z > 80 || Math.abs(bullet.mesh.position.x) > 50) {
            scene.remove(bullet.mesh); // shared geo+mat — no dispose needed
            bullets.splice(i, 1);
        }
    }
}

// Enemy Bullet System
function createEnemyBullet(sourceX, sourceY, sourceZ, targetX, targetY, targetZ, speed) {
    const bulletMesh = enemyBulletPool.find(m => !m.visible);
    if (!bulletMesh) return; // pool exhausted — skip this shot

    const direction = new THREE.Vector3(
        targetX - sourceX,
        targetY - sourceY,
        targetZ - sourceZ
    ).normalize();

    bulletMesh.position.set(sourceX, sourceY, sourceZ);
    bulletMesh.lookAt(targetX, targetY, targetZ);
    bulletMesh.visible = true;
    enemyBullets.push({
        mesh: bulletMesh,
        velocity: direction.multiplyScalar(speed || 0.5),
        life: 300
    });
}

function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.mesh.position.add(bullet.velocity);
        bullet.life--;

        if (bullet.life <= 0 ||
            bullet.mesh.position.z < -30 ||
            bullet.mesh.position.z > 100 ||
            Math.abs(bullet.mesh.position.x) > 50 ||
            Math.abs(bullet.mesh.position.y) > 30) {
            bullet.mesh.visible = false; // return to pool
            enemyBullets.splice(i, 1);
        }
    }
}

// Create Boss Enemy
function createBoss() {
    const group = new THREE.Group();

    // Smooth core (2 subdivisions = 128 faces)
    const coreGeo = new THREE.OctahedronGeometry(3, 2);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        emissive: 0x660000,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1
    });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    // Energy shield sphere (smoother)
    const shieldGeo = new THREE.SphereGeometry(4, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x660000,
        emissive: 0x550000,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.3,
        metalness: 0.9,
        roughness: 0.1
    });
    group.add(new THREE.Mesh(shieldGeo, shieldMat));

    // Hex wireframe shield overlay
    const bossWireGeo = new THREE.IcosahedronGeometry(4.2, 1);
    const bossWireMat = new THREE.MeshBasicMaterial({
        color: 0x992222,
        wireframe: true,
        transparent: true,
        opacity: 0.12
    });
    const bossWireframe = new THREE.Mesh(bossWireGeo, bossWireMat);
    bossWireframe.userData.isBossShield = true;
    group.add(bossWireframe);

    // Alternating weapon types: heavy cannons (even) + energy lances (odd)
    const heavyMountGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const heavyBarrelGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.0, 10);
    const heavyMat = new THREE.MeshStandardMaterial({
        color: 0x1a0000,
        emissive: 0x880000,
        emissiveIntensity: 0.5,
        metalness: 1.0
    });
    const lanceGeo = new THREE.ConeGeometry(0.2, 2.5, 8);
    const lanceMat = new THREE.MeshStandardMaterial({
        color: 0x0a0000,
        emissive: 0x770000,
        emissiveIntensity: 0.6,
        metalness: 1.0
    });
    const lanceTipGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const lanceTipMat = new THREE.MeshBasicMaterial({
        color: 0xcc6600,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        if (i % 2 === 0) {
            // Heavy cannon
            const cannon = new THREE.Group();
            cannon.add(new THREE.Mesh(heavyMountGeo, heavyMat));
            const barrel = new THREE.Mesh(heavyBarrelGeo, heavyMat);
            barrel.rotation.z = Math.PI / 2;
            barrel.position.x = 1.2;
            cannon.add(barrel);
            cannon.position.set(Math.cos(angle) * 3.5, Math.sin(angle) * 3.5, 0);
            cannon.rotation.z = angle;
            group.add(cannon);
        } else {
            // Energy lance
            const lance = new THREE.Mesh(lanceGeo, lanceMat);
            lance.position.set(Math.cos(angle) * 3.5, Math.sin(angle) * 3.5, 0);
            lance.rotation.z = angle + Math.PI / 2;
            group.add(lance);
            const tip = new THREE.Mesh(lanceTipGeo, lanceTipMat);
            tip.position.set(Math.cos(angle) * 4.5, Math.sin(angle) * 4.5, 0);
            tip.userData.isPulse = true;
            group.add(tip);
        }
    }

    // Layered reactor: outer glow + inner core + energy ring
    const reactorOuterGeo = new THREE.SphereGeometry(1.5, 24, 24);
    const reactorOuterMat = new THREE.MeshBasicMaterial({
        color: 0xcc4400,
        transparent: true,
        opacity: 0.4
    });
    const reactorOuter = new THREE.Mesh(reactorOuterGeo, reactorOuterMat);
    reactorOuter.userData.isPulse = true;
    group.add(reactorOuter);

    const reactorInnerGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const reactorInnerMat = new THREE.MeshBasicMaterial({
        color: 0xffccaa,
        transparent: true,
        opacity: 0.85
    });
    const reactorInner = new THREE.Mesh(reactorInnerGeo, reactorInnerMat);
    reactorInner.userData.isPulse = true;
    group.add(reactorInner);

    const reactorRingGeo = new THREE.TorusGeometry(1.1, 0.06, 12, 24);
    const reactorRingMat = new THREE.MeshBasicMaterial({
        color: 0x993300,
        transparent: true,
        opacity: 0.6
    });
    const reactorRing = new THREE.Mesh(reactorRingGeo, reactorRingMat);
    reactorRing.userData.isRing = true;
    reactorRing.userData.rotationSpeed = 0.04;
    group.add(reactorRing);

    // Reactor glow halo
    const bossGlowGeo = new THREE.SphereGeometry(2.0, 16, 16);
    const bossGlowMat = new THREE.MeshBasicMaterial({
        color: 0x660000,
        transparent: true,
        opacity: 0.06
    });
    group.add(new THREE.Mesh(bossGlowGeo, bossGlowMat));

    // Orbiting armor plates
    const armorGeo = new THREE.BoxGeometry(1.2, 0.15, 2.5);
    const armorMat = new THREE.MeshStandardMaterial({
        color: 0x220000,
        emissive: 0x550000,
        emissiveIntensity: 0.25,
        metalness: 0.95,
        roughness: 0.2
    });
    for (let i = 0; i < 4; i++) {
        const armor = new THREE.Mesh(armorGeo, armorMat);
        const angle = (i / 4) * Math.PI * 2;
        armor.position.set(Math.cos(angle) * 2.8, 0, Math.sin(angle) * 2.8);
        armor.rotation.y = angle;
        armor.userData.isBossArmor = true;
        armor.userData.orbitAngle = angle;
        armor.userData.orbitSpeed = 0.008;
        group.add(armor);
    }

    group.scale.set(2.0, 2.0, 2.0);

    // Scale boss health based on difficulty and level
    const baseHealth = Math.min(15 + (currentLevel * 5), 60);
    const difficultyMultiplier = difficultySettings[difficulty].bossHealthMultiplier;
    const bossHealth = Math.round(baseHealth * difficultyMultiplier);

    const bossSettings = difficultySettings[difficulty];
    boss = {
        mesh: group,
        health: bossHealth,
        maxHealth: bossHealth,
        speed: 0.1,
        direction: 1,
        fireTimer: 60,
        fireInterval: bossSettings.bossFireInterval,
        burstShotsPerCycle: bossSettings.bossBurstShots,
        burstShotsRemaining: bossSettings.bossBurstShots,
        burstPauseFrames: bossSettings.bossBurstPauseFrames,
        bulletSpeedMultiplier: bossSettings.bossBulletSpeedMultiplier
    };

    // Cache animated children references (avoids per-frame traverse)
    boss.cached = { shields: [], armor: [], rings: [], pulses: [], emissiveChildren: [] };
    boss.mesh.traverse((child) => {
        if (child.userData.isBossShield) boss.cached.shields.push(child);
        if (child.userData.isBossArmor) boss.cached.armor.push(child);
        if (child.userData.isRing) boss.cached.rings.push(child);
        if (child.userData.isPulse) boss.cached.pulses.push(child);
        if (child.material && child.material.emissive) boss.cached.emissiveChildren.push(child);
    });

    boss.mesh.position.set(0, -5, 70);
    boss.mesh.castShadow = !isMobile;

    // Add deep red point light
    const light = new THREE.PointLight(0x880000, 4, 25);
    boss.mesh.add(light);

    scene.add(boss.mesh);
    bossActive = true;

    // Show boss health bar
    bossHealthBar.classList.remove('hidden');
    updateBossHealthBar();
}

function updateBossHealthBar() {
    if (boss) {
        const healthPercent = (boss.health / boss.maxHealth) * 100;
        bossHealthFill.style.width = healthPercent + '%';
    }
}

function updateBoss() {
    if (!boss) return;

    // Move boss side to side
    boss.mesh.position.x += boss.speed * boss.direction;

    // Reverse direction at boundaries
    if (boss.mesh.position.x > 25 || boss.mesh.position.x < -25) {
        boss.direction *= -1;
    }

    // Slowly advance forward
    boss.mesh.position.z -= 0.04;

    // Rotation for intimidation
    boss.mesh.rotation.y += 0.01;
    boss.mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;

    animateBossParts();

    // Boss shooting logic
    boss.fireTimer--;
    if (boss.fireTimer <= 0) {
        const bossPos = boss.mesh.position;
        const multiShotSpeed = (0.5 + (currentLevel - 1) * 0.03) * boss.bulletSpeedMultiplier;
        const singleShotSpeed = 0.45 * boss.bulletSpeedMultiplier;
        if (difficultySettings[difficulty].bossMultiShot) {
            for (let s = -1; s <= 1; s++) {
                createEnemyBullet(
                    bossPos.x, bossPos.y, bossPos.z,
                    player.x + s * 8, player.y, player.z,
                    multiShotSpeed
                );
            }
        } else {
            createEnemyBullet(
                bossPos.x, bossPos.y, bossPos.z,
                player.x, player.y, player.z,
                singleShotSpeed
            );
        }
        playEnemyShootSound();
        if (boss.burstShotsRemaining > 1) {
            boss.burstShotsRemaining--;
            boss.fireTimer = boss.fireInterval;
        } else {
            // Give the player a brief counter-attack window between burst cycles.
            boss.burstShotsRemaining = boss.burstShotsPerCycle;
            boss.fireTimer = boss.burstPauseFrames;
        }
    }

    // Check if boss reached player (game over)
    if (boss.mesh.position.z < -10) {
        lives = 0;
        updateLives();
    }
}

function checkBossCollision() {
    if (!boss) return;

    const bossPos = boss.mesh.position;

    // Check bullet-boss collisions
    for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = bullets[bIndex];
        const bulletPos = bullet.mesh.position;

        const distance = bulletPos.distanceTo(bossPos);

        if (distance < 4.5) {  // Boss hit radius
            playBossHitSound();

            if (!bullet.piercing) {
                scene.remove(bullet.mesh); // shared geo+mat — no dispose
                bullets.splice(bIndex, 1);
            }

            boss.health -= (bullet.damage || 1);
            updateBossHealthBar();

            // Flash effect on hit
            const bossFlashParts = boss.cached.emissiveChildren;
            for (let fi = 0; fi < bossFlashParts.length; fi++) {
                const mat = bossFlashParts[fi].material;
                const originalIntensity = mat.emissiveIntensity;
                mat.emissiveIntensity = 2;
                setTimeout(() => { if (mat) mat.emissiveIntensity = originalIntensity; }, 100);
            }

            if (boss.health <= 0) {
                defeatBoss();
                break;  // Exit loop - boss is defeated, no need to check more bullets
            }
        }
    }

    // Check boss-player collision
    const playerPos = player.mesh.position;
    const distance = playerPos.distanceTo(bossPos);

    if (distance < 6 && !player.invulnerable) {
        lives = 0;
        updateLives();
    }
}

function defeatBoss() {
    if (!boss) return;

    playExplosionSound();
    playLevelCompleteSound();
    shakeCamera(0.6);  // Bigger shake for boss explosion

    // Flash effect - larger for boss
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1.0
    });
    const flashMesh = new THREE.Mesh(SHARED_GEO.bossFlash, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({
        mesh: flashMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 10,
        isFlash: true
    });

    // Shockwave ring - bigger for boss
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(SHARED_GEO.bossRing, ringMaterial);
    ringMesh.position.copy(boss.mesh.position);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 15,
        isShockwave: true,
        expandRate: 0.3
    });

    // Boss explosion - more particles, bigger, but contained
    for (let i = 0; i < 50; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.3 ? 0xff0000 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(SHARED_GEO.bossParticle, material);
        particleMesh.position.copy(boss.mesh.position);

        const speed = 0.3 + Math.random() * 0.5;
        const particle = {
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            ),
            life: 35
        };

        scene.add(particleMesh);
        particles.push(particle);
    }

    // Boss guaranteed weapon pickup — spawn near the player so it's reachable before portal
    spawnPickup(player.x + 2.5, player.y, player.z + 15, true);

    // Dispose boss lights before removing mesh
    boss.mesh.traverse((child) => {
        if (child.isLight && child.dispose) child.dispose();
    });
    const bossDeathPos = boss.mesh.position.clone();
    disposeMesh(boss.mesh);
    scene.remove(boss.mesh);
    boss = null;
    bossActive = false;
    levelTransitioning = true;  // Prevent boss spawning and shooting during transition

    // Clear all bullets from screen
    bullets.forEach(b => { scene.remove(b.mesh); }); // shared geo+mat — no dispose
    bullets = [];
    enemyBullets.forEach(b => { b.mesh.visible = false; }); // return to pool
    enemyBullets = [];
    bossHealthBar.classList.add('hidden');

    // Award bonus points based on difficulty and level (with gradual scaling)
    const baseBonus = 500 + ((currentLevel - 1) * 250);  // 500, 750, 1000, 1250, etc.
    const bonusMultiplier = difficultySettings[difficulty].bossBonusMultiplier;
    const levelBonus = Math.round(baseBonus * bonusMultiplier);
    score += levelBonus;
    updateScore();
    createScorePopup(bossDeathPos.x, bossDeathPos.y, bossDeathPos.z, levelBonus);

    // Boss counts as 3 kills toward extra life drop
    targetsHit += 3;
    if (targetsHit >= 10 && lives < 3) {
        spawnExtraLifePickup(player.x - 2.5, player.y, player.z + 15);
        targetsHit = 0;
    }

    // Create portal and animate player entering it (or trigger victory on final level)
    bossPortalTimeout = setTimeout(() => {
        bossPortalTimeout = null;
        if (!gameRunning) return;
        if (currentLevel >= 20) {
            triggerVictory();
            return;
        }
        createPortal();
        animatePortalEntry();
    }, PORTAL_SPAWN_DELAY);
}

// Create Portal/Wormhole
function createPortal() {
    playPortalSound(); // Play portal sound effect
    const portalGroup = new THREE.Group();

    // Create multiple rotating rings for wormhole effect
    for (let i = 0; i < 5; i++) {
        const ringGeometry = new THREE.TorusGeometry(6 + i * 0.5, 0.4, 16, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7 - i * 0.1,
            emissive: 0x00ffff,
            emissiveIntensity: 1
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.userData.rotationSpeed = (i + 1) * 0.02;
        portalGroup.add(ring);
    }

    // Central glow sphere
    const glowGeometry = new THREE.SphereGeometry(3, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    portalGroup.add(glow);

    // Shared geometry and materials for portal particles to prevent memory leak
    const sharedParticleGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const particleMaterialCyan = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });
    const particleMaterialBlue = new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.8
    });

    // Portal particles
    for (let i = 0; i < 30; i++) {
        const particleMesh = new THREE.Mesh(
            sharedParticleGeometry,
            Math.random() > 0.5 ? particleMaterialCyan : particleMaterialBlue
        );

        const angle = (i / 30) * Math.PI * 2;
        const radius = 4 + Math.random() * 3;
        particleMesh.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 2,
            Math.sin(angle) * radius
        );

        particleMesh.userData.angle = angle;
        particleMesh.userData.radius = radius;
        particleMesh.userData.speed = 0.02 + Math.random() * 0.02;

        portalGroup.add(particleMesh);
    }

    // Position portal ahead of player
    portalGroup.position.set(0, -5, 50);

    // Add point light for glow effect
    const portalLight = new THREE.PointLight(0x00ffff, 5, 30);
    portalGroup.add(portalLight);

    scene.add(portalGroup);
    portal = portalGroup;
}

function updatePortal() {
    if (!portal) return;

    // Rotate rings in different directions
    portal.children.forEach((child) => {
        if (child.userData.rotationSpeed) {
            child.rotation.z += child.userData.rotationSpeed;
            child.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
        }

        // Animate particles in spiral
        if (child.userData.angle !== undefined) {
            child.userData.angle += child.userData.speed;
            child.position.x = Math.cos(child.userData.angle) * child.userData.radius;
            child.position.z = Math.sin(child.userData.angle) * child.userData.radius;
        }
    });

    // Pulse the glow
    if (portal.children[5]) { // Central glow sphere
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
        portal.children[5].scale.set(scale, scale, scale);
    }
}

function animatePortalEntry() {
    if (!player.mesh || !portal) return;

    portalAnimating = true;
    const startX = player.x;
    const startY = player.y;
    const startZ = player.z;
    const targetX = portal.position.x; // 0 (center)
    const targetY = portal.position.y; // -5 (center)
    const targetZ = portal.position.z; // 50
    const duration = 2000; // 2 seconds
    const startTime = Date.now();

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in curve for acceleration
        const eased = progress * progress;

        // Move player toward portal center (animate X, Y, and Z)
        player.x = startX + (targetX - startX) * eased;
        player.y = startY + (targetY - startY) * eased;
        player.z = startZ + (targetZ - startZ) * eased;
        player.mesh.position.set(player.x, player.y, player.z);

        // Rotate player as it enters portal
        player.mesh.rotation.y += 0.05;
        player.mesh.rotation.z = Math.sin(progress * Math.PI * 2) * 0.3;

        // Scale down player as it enters
        const scale = 1 - progress * 0.5;
        player.mesh.scale.set(scale, scale, scale);

        if (progress < 1 && gameRunning) {
            portalAnimationId = requestAnimationFrame(animate);
        } else {
            // Entry complete, transition to next level
            portalAnimating = false;
            if (portal) {
                // Dispose of geometries and materials to prevent memory leak
                portal.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                scene.remove(portal);
                portal = null;
            }
            // Reset player position, scale, and rotation
            player.z = 0;
            player.y = -5;
            player.x = 0;
            player.velocityX = 0;
            player.mesh.position.set(player.x, player.y, player.z);
            player.mesh.scale.set(1, 1, 1);
            player.mesh.rotation.y = 0;
            player.mesh.rotation.z = 0;
            nextLevel();
        }
    };

    animate();
}

function nextLevel() {
    currentLevel++;
    enemiesDefeatedThisLevel = 0;
    enemiesRequiredForBoss = 10 + (currentLevel * 2);  // More enemies each level
    levelTransitioning = true;  // Keep transition active during level message
    lastEnemySpawn = 0;  // Reset spawn timer to spawn enemies immediately

    updateLevel();

    // Load new level theme
    loadLevelTheme(currentLevel);

    // Bonus life every 3 levels
    if (currentLevel % 3 === 0 && lives < 3) {
        lives++;
        updateLives();
    }

    // Show level message
    showLevelMessage(currentLevel);

    // Allow enemy spawning after level message disappears
    levelTransitionTimeout = setTimeout(() => {
        if (gameRunning) {
            levelTransitioning = false;
        }
    }, LEVEL_MESSAGE_TOTAL_TIME);
}

function showLevelMessage(levelNumber) {
    const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
    if (!levelData) {
        // Fallback for levels beyond defined data
        showMessageBox(`Level ${levelNumber}`, 'Entering unknown space...');
        return;
    }

    showMessageBox(levelData.systemName, levelData.description);
}

function showMessageBox(title, subtitle) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'level-message-box';

    // Create title element safely
    const titleDiv = document.createElement('div');
    titleDiv.className = 'level-title';
    titleDiv.textContent = title;
    messageDiv.appendChild(titleDiv);

    // Create subtitle element safely
    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = 'level-subtitle';
    subtitleDiv.textContent = subtitle;
    messageDiv.appendChild(subtitleDiv);

    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '50%';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translate(-50%, -50%)';
    messageDiv.style.zIndex = '100';
    messageDiv.style.animation = 'modalFadeIn 0.5s ease-out';

    const gameContainer = document.querySelector('.game-container');
    if (!gameContainer) {
        console.warn('Game container element not found - level message will not be displayed');
        return;
    }
    gameContainer.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'modalFadeOut 0.5s ease-out';
        setTimeout(() => messageDiv.remove(), LEVEL_MESSAGE_FADE_TIME);
    }, LEVEL_MESSAGE_DURATION);
}

// Enemies
function createEnemy(type) {
    let mesh;
    const settings = difficultySettings[difficulty];

    // Scale difficulty with level using square root for diminishing returns
    // This gives continuous growth that slows down at higher levels
    const levelMultiplier = 1 + Math.sqrt(currentLevel - 1) * settings.scalingFactor;

    if (type === 0) {
        // Alien Destroyer - Magenta octahedron with inner energy + orbiting armor
        const group = new THREE.Group();

        // Inner energy sphere (visible through transparent core)
        const innerGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.userData.isPulse = true;
        group.add(inner);

        // Main core - smooth octahedron (transparent so inner shows)
        const coreGeo = new THREE.OctahedronGeometry(1.2, 2);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.8,
            metalness: 0.7,
            roughness: 0.2,
            transparent: true,
            opacity: 0.6
        });
        group.add(new THREE.Mesh(coreGeo, coreMat));

        // Outer glow layer
        const glowGeo = new THREE.SphereGeometry(1.5, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.08
        });
        const coreGlow = new THREE.Mesh(glowGeo, glowMat);
        coreGlow.userData.isPulse = true;
        group.add(coreGlow);

        // Energy rings (higher poly)
        const ringGeo = new THREE.TorusGeometry(1.5, 0.12, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.6
        });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.rotation.x = Math.PI / 2;
        ring1.userData.isRing = true;
        ring1.userData.rotationSpeed = 0.03;
        group.add(ring1);

        // Inner glow torus inside ring
        const ringInnerGeo = new THREE.TorusGeometry(1.5, 0.06, 8, 32);
        const ringInnerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
        });
        const ringInner1 = new THREE.Mesh(ringInnerGeo, ringInnerMat);
        ringInner1.rotation.x = Math.PI / 2;
        ringInner1.userData.isRing = true;
        ringInner1.userData.rotationSpeed = 0.03;
        group.add(ringInner1);

        const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
        ring2.rotation.y = Math.PI / 2;
        ring2.userData.isRing = true;
        ring2.userData.rotationSpeed = -0.02;
        group.add(ring2);

        // Antenna spikes at cardinal directions
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.6, 8);
        const spikeMat = new THREE.MeshStandardMaterial({
            color: 0xcc00cc,
            emissive: 0xff00ff,
            emissiveIntensity: 0.4,
            metalness: 0.9,
            roughness: 0.2
        });
        const spikePositions = [
            { x: 0, y: 1.4, z: 0, rx: 0, rz: 0 },
            { x: 0, y: -1.4, z: 0, rx: Math.PI, rz: 0 },
            { x: 1.4, y: 0, z: 0, rx: 0, rz: -Math.PI / 2 },
            { x: -1.4, y: 0, z: 0, rx: 0, rz: Math.PI / 2 }
        ];
        spikePositions.forEach(sp => {
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(sp.x, sp.y, sp.z);
            spike.rotation.set(sp.rx, 0, sp.rz);
            spike.userData.isSpike = true;
            group.add(spike);
        });

        // Orbiting armor plates
        const plateMat = new THREE.MeshStandardMaterial({
            color: 0x440044,
            emissive: 0xff00ff,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.3
        });
        for (let i = 0; i < 4; i++) {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.8), plateMat);
            const angle = (i / 4) * Math.PI * 2;
            plate.position.set(Math.cos(angle) * 1.4, 0, Math.sin(angle) * 1.4);
            plate.userData.isArmorPlate = true;
            plate.userData.orbitAngle = angle;
            plate.userData.orbitSpeed = 0.015;
            group.add(plate);
        }

        group.scale.set(0.8, 0.8, 0.8);
        group.userData.enginePositions = [{ x: 0, y: 0, z: 1.0 }];
        mesh = group;
    } else if (type === 1) {
        // Interceptor - Electric Blue, sleek aerodynamic design
        const group = new THREE.Group();

        // Smooth fuselage
        const bodyGeo = new THREE.ConeGeometry(0.8, 2.5, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            emissive: 0x00aaff,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        // Cockpit sensor dome at nose
        const cockpitGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const cockpitMat = new THREE.MeshStandardMaterial({
            color: 0x44ccff,
            emissive: 0x22aaff,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.7,
            metalness: 0.9,
            roughness: 0.1
        });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.scale.set(0.8, 0.5, 1.0);
        cockpit.position.set(0, 0.2, -1.0);
        group.add(cockpit);

        // Swept-back wings
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x0066cc,
            emissive: 0x00aaff,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.3
        });
        const wingGeo = new THREE.BoxGeometry(2.0, 0.08, 0.7);
        const leftWing = new THREE.Mesh(wingGeo, wingMat);
        leftWing.position.set(-1.2, 0, 0.3);
        leftWing.rotation.y = -0.3;
        leftWing.userData.isWing = true;
        leftWing.userData.flapSpeed = 0.05;
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, wingMat);
        rightWing.position.set(1.2, 0, 0.3);
        rightWing.rotation.y = 0.3;
        rightWing.userData.isWing = true;
        rightWing.userData.flapSpeed = 0.05;
        group.add(rightWing);

        // Wing panel lines
        const panelGeo = new THREE.BoxGeometry(1.4, 0.005, 0.02);
        const panelMat = new THREE.MeshBasicMaterial({ color: 0x0088cc });
        [-0.15, 0.15].forEach(zOff => {
            const lp = new THREE.Mesh(panelGeo, panelMat);
            lp.position.set(-1.2, 0.05, 0.3 + zOff);
            lp.rotation.y = -0.3;
            group.add(lp);
            const rp = new THREE.Mesh(panelGeo, panelMat);
            rp.position.set(1.2, 0.05, 0.3 + zOff);
            rp.rotation.y = 0.3;
            group.add(rp);
        });

        // Tail fin
        const finGeo = new THREE.BoxGeometry(0.06, 0.5, 0.4);
        const fin = new THREE.Mesh(finGeo, wingMat);
        fin.position.set(0, 0.3, 1.0);
        group.add(fin);

        // Engine nozzles with inner glow
        const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12);
        const nozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0x00aaff,
            emissiveIntensity: 0.6,
            metalness: 0.9,
            roughness: 0.2
        });
        const engineGlowGeo = new THREE.SphereGeometry(0.18, 12, 12);
        const engineGlowMat = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.9
        });
        [{ x: -0.6 }, { x: 0.6 }].forEach(pos => {
            const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
            nozzle.position.set(pos.x, 0, 1.1);
            nozzle.rotation.x = Math.PI / 2;
            group.add(nozzle);
            const glow = new THREE.Mesh(engineGlowGeo, engineGlowMat);
            glow.position.set(pos.x, 0, 1.3);
            glow.userData.isPulse = true;
            group.add(glow);
        });

        // Engine halos
        const haloGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.1
        });
        [{ x: -0.6 }, { x: 0.6 }].forEach(pos => {
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(pos.x, 0, 1.3);
            halo.userData.isPulse = true;
            group.add(halo);
        });

        group.scale.set(0.8, 0.8, 0.8);
        group.userData.enginePositions = [
            { x: -0.6, y: 0, z: 1.3 },
            { x: 0.6, y: 0, z: 1.3 }
        ];
        mesh = group;
    } else {
        // Battlecruiser - Gunmetal hull with Gold accents
        const group = new THREE.Group();

        // Main hull
        const hullGeo = new THREE.CylinderGeometry(2.2, 2.5, 0.8, 24);
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x556677,
            emissive: 0x334455,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.2
        });
        group.add(new THREE.Mesh(hullGeo, hullMat));

        // Upper hull panel
        const panelGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.3, 24);
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x445566,
            emissive: 0x334455,
            emissiveIntensity: 0.2,
            metalness: 0.9,
            roughness: 0.3
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.y = 0.4;
        group.add(panel);

        // Gold energy dome
        const domeGeo = new THREE.SphereGeometry(1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
            color: 0xffcc33,
            emissive: 0xffcc33,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = -0.4;
        group.add(dome);

        // Antenna on dome
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
        const antennaMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.2
        });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, -1.1, 0);
        group.add(antenna);
        const antTipGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const antTipMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.9 });
        const antTip = new THREE.Mesh(antTipGeo, antTipMat);
        antTip.position.set(0, -1.4, 0);
        antTip.userData.isPulse = true;
        group.add(antTip);

        // Turret hardpoints (mount + barrel + tip glow)
        const mountGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.2, 12);
        const mountMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0xffcc33,
            emissiveIntensity: 0.4,
            metalness: 0.9
        });
        const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.9,
            roughness: 0.2
        });
        const tipGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const tipMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.8
        });
        for (let i = 0; i < 4; i++) {
            const turret = new THREE.Group();
            turret.add(new THREE.Mesh(mountGeo, mountMat));
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.rotation.z = Math.PI / 2;
            barrel.position.x = 0.35;
            turret.add(barrel);
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.x = 0.6;
            tip.userData.isTurretTip = true;
            turret.add(tip);

            const angle = (i / 4) * Math.PI * 2;
            turret.position.set(Math.cos(angle) * 2, -0.5, Math.sin(angle) * 2);
            turret.userData.isWeapon = true;
            turret.userData.weaponAngle = angle;
            turret.userData.rotationSpeed = 0.02;
            group.add(turret);
        }

        // Core reactor
        const reactorGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.25, 24);
        const reactorMat = new THREE.MeshBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.9
        });
        const reactor = new THREE.Mesh(reactorGeo, reactorMat);
        reactor.position.y = -0.3;
        reactor.userData.isPulse = true;
        group.add(reactor);

        // Reactor glow layer
        const rGlowGeo = new THREE.SphereGeometry(1.2, 12, 12);
        const rGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.1
        });
        const rGlow = new THREE.Mesh(rGlowGeo, rGlowMat);
        rGlow.position.y = -0.3;
        rGlow.userData.isPulse = true;
        group.add(rGlow);

        // Rear engine nozzles
        const engNozzleGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 10);
        const engNozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0xffcc33,
            emissiveIntensity: 0.5,
            metalness: 0.9
        });
        const engGlowGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const engGlowMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.9
        });
        [-0.6, 0, 0.6].forEach(xPos => {
            const nozzle = new THREE.Mesh(engNozzleGeo, engNozzleMat);
            nozzle.position.set(xPos, 0, 1.3);
            nozzle.rotation.x = Math.PI / 2;
            group.add(nozzle);
            const glow = new THREE.Mesh(engGlowGeo, engGlowMat);
            glow.position.set(xPos, 0, 1.5);
            glow.userData.isPulse = true;
            group.add(glow);
        });

        group.scale.set(0.7, 0.7, 0.7);
        group.userData.enginePositions = [
            { x: -0.6, y: 0, z: 1.5 },
            { x: 0, y: 0, z: 1.5 },
            { x: 0.6, y: 0, z: 1.5 }
        ];
        mesh = group;
    }

    const baseSpeed = settings.enemySpeed.min + Math.random() * (settings.enemySpeed.max - settings.enemySpeed.min);

    const enemy = {
        mesh: mesh,
        speed: baseSpeed * levelMultiplier,  // Faster with each level
        type: type,
        hp: type === 2 ? 2 : 1,  // Battlecruiser takes 2 hits; others die in 1
        lateralSpeed: (Math.random() - 0.5) * 0.25 * levelMultiplier,
        lateralDirection: Math.random() < 0.5 ? -1 : 1,  // Initial direction
        waveOffset: Math.random() * Math.PI * 2,  // Random starting point in wave
        waveAmplitude: 0.5 + Math.random() * 1.0,  // Wave intensity
        fireTimer: Math.floor(Math.random() * 120) + 60,
        fireInterval: settings.enemyFireInterval.min +
            Math.floor(Math.random() * (settings.enemyFireInterval.max - settings.enemyFireInterval.min)),
        // Interceptor dash — periodic burst of lateral speed toward player
        dashCooldown: type === 1 ? (90 + Math.floor(Math.random() * 120)) : 0,
        dashing: false,
        dashDuration: 0,
        dashTargetX: 0
    };

    const x = (Math.random() - 0.5) * 30;
    const y = -5 + (Math.random() - 0.5) * 4;  // Spawn around center with some variance
    enemy.mesh.position.set(x, y, 70);
    enemy.mesh.castShadow = !isMobile;
    enemy.mesh.receiveShadow = !isMobile;

    // Add point light to enemy
    const light = new THREE.PointLight(
        type === 0 ? 0xff00ff : type === 1 ? 0x00aaff : 0xffcc33,
        3,
        15
    );
    enemy.mesh.add(light);
    enemyLights.push(light);

    // Cache animated children references (avoids per-frame traverse)
    enemy.cached = { rings: [], pulses: [], wings: [], weapons: [], spikes: [], armorPlates: [], turretTips: [], allMaterials: [] };
    enemy.mesh.traverse((child) => {
        if (child.userData.isRing) enemy.cached.rings.push(child);
        if (child.userData.isPulse) enemy.cached.pulses.push(child);
        if (child.userData.isWing) enemy.cached.wings.push(child);
        if (child.userData.isWeapon) enemy.cached.weapons.push(child);
        if (child.userData.isSpike) enemy.cached.spikes.push(child);
        if (child.userData.isArmorPlate) enemy.cached.armorPlates.push(child);
        if (child.userData.isTurretTip) enemy.cached.turretTips.push(child);
        if (child.material) enemy.cached.allMaterials.push(child);
    });

    scene.add(enemy.mesh);
    enemies.push(enemy);
}

// Procedural animations for enemy parts
function animateEnemyParts(enemy) {
    const c = enemy.cached;
    for (let i = 0; i < c.rings.length; i++) {
        c.rings[i].rotation.z += c.rings[i].userData.rotationSpeed;
    }
    const now = Date.now();
    for (let i = 0; i < c.pulses.length; i++) {
        if (!c.pulses[i].userData.isCharging) {
            const pulse = Math.sin(now * 0.005) * 0.15 + 1;
            c.pulses[i].scale.set(pulse, pulse, pulse);
        }
    }
    for (let i = 0; i < c.wings.length; i++) {
        const flap = Math.sin(now * c.wings[i].userData.flapSpeed) * 0.2;
        c.wings[i].rotation.y = flap;
    }
    for (let i = 0; i < c.weapons.length; i++) {
        const w = c.weapons[i];
        w.userData.weaponAngle += w.userData.rotationSpeed;
        w.position.set(Math.cos(w.userData.weaponAngle) * 2, -0.5, Math.sin(w.userData.weaponAngle) * 2);
    }
    for (let i = 0; i < c.spikes.length; i++) {
        const bob = Math.sin(now * 0.008 + c.spikes[i].position.x * 10) * 0.03;
        c.spikes[i].position.y += bob;
    }
    for (let i = 0; i < c.armorPlates.length; i++) {
        const p = c.armorPlates[i];
        p.userData.orbitAngle += p.userData.orbitSpeed;
        p.position.x = Math.cos(p.userData.orbitAngle) * 1.4;
        p.position.z = Math.sin(p.userData.orbitAngle) * 1.4;
    }
}

function animateBossParts() {
    if (!boss || !boss.mesh) return;
    const c = boss.cached;
    const now = Date.now();
    for (let i = 0; i < c.shields.length; i++) {
        c.shields[i].rotation.y += 0.005;
        c.shields[i].rotation.x += 0.003;
        c.shields[i].material.opacity = 0.12 + Math.sin(now * 0.002) * 0.05;
    }
    for (let i = 0; i < c.armor.length; i++) {
        const a = c.armor[i];
        a.userData.orbitAngle += a.userData.orbitSpeed;
        a.position.x = Math.cos(a.userData.orbitAngle) * 2.8;
        a.position.z = Math.sin(a.userData.orbitAngle) * 2.8;
        a.rotation.y = a.userData.orbitAngle;
    }
    for (let i = 0; i < c.rings.length; i++) {
        c.rings[i].rotation.z += c.rings[i].userData.rotationSpeed;
    }
    for (let i = 0; i < c.pulses.length; i++) {
        const pulse = Math.sin(now * 0.006) * 0.12 + 1;
        c.pulses[i].scale.set(pulse, pulse, pulse);
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Handle death animation
        if (enemy.dying) {
            enemy.deathTimer--;

            // Spin out of control
            enemy.mesh.rotation.x += enemy.deathSpin.x;
            enemy.mesh.rotation.y += enemy.deathSpin.y;
            enemy.mesh.rotation.z += enemy.deathSpin.z;

            // Continue moving forward but veer off
            enemy.mesh.position.z -= enemy.speed * 0.5;
            enemy.mesh.position.x += enemy.deathSpin.x * 2;
            enemy.mesh.position.y += enemy.deathSpin.y * 2;

            // Fade out and shrink
            const mats = enemy.cached.allMaterials;
            for (let m = 0; m < mats.length; m++) {
                mats[m].material.opacity = enemy.deathTimer / 20;
                mats[m].material.transparent = true;
            }
            enemy.mesh.scale.multiplyScalar(0.97);

            if (enemy.deathTimer <= 0) {
                disposeMesh(enemy.mesh);
                scene.remove(enemy.mesh);
                enemies.splice(i, 1);
            }
            continue;
        }

        // Normal movement
        enemy.mesh.position.z -= enemy.speed;

        // Smooth sine-wave lateral movement (more organic feel)
        enemy.waveOffset += 0.05;
        const waveX = Math.sin(enemy.waveOffset) * enemy.waveAmplitude;
        enemy.mesh.position.x += waveX * enemy.lateralSpeed;

        // Lateral boundary checking
        if (enemy.mesh.position.x > 30) {
            enemy.mesh.position.x = 30;
            enemy.waveOffset = Math.PI;  // Reset wave to move back
        }
        if (enemy.mesh.position.x < -30) {
            enemy.mesh.position.x = -30;
            enemy.waveOffset = 0;  // Reset wave to move forward
        }

        // Smooth rotation for visual effect (skip Y spin for Interceptor — shuttle shape)
        if (enemy.type !== 1) {
            enemy.mesh.rotation.y += 0.02;
        }
        enemy.mesh.rotation.z = Math.sin(enemy.waveOffset) * 0.1;  // Slight roll with wave

        // Interceptor: periodic dash toward player X position
        if (enemy.type === 1) {
            enemy.dashCooldown--;
            if (enemy.dashCooldown <= 0 && !enemy.dashing) {
                enemy.dashing = true;
                enemy.dashDuration = 25;
                enemy.dashTargetX = player.x + (Math.random() - 0.5) * 8;
                enemy.dashCooldown = 90 + Math.floor(Math.random() * 120);
            }
            if (enemy.dashing) {
                const dx = enemy.dashTargetX - enemy.mesh.position.x;
                enemy.mesh.position.x += dx * 0.12;
                enemy.dashDuration--;
                if (enemy.dashDuration <= 0) enemy.dashing = false;
            }
        }

        // Animate enemy parts (rings, wings, weapons)
        animateEnemyParts(enemy);

        // Enemy shooting logic with charging VFX
        if (enemy.mesh.position.z > player.z && enemy.mesh.position.z < 65) {
            enemy.fireTimer--;

            // Weapon charging VFX (15 frames before firing)
            if (enemy.fireTimer <= 15 && enemy.fireTimer > 0) {
                const chargeProgress = 1 - (enemy.fireTimer / 15);
                const chargeParts = enemy.cached.pulses;
                const chargeTips = enemy.cached.turretTips;
                for (let ci = 0; ci < chargeParts.length; ci++) {
                    chargeParts[ci].userData.isCharging = true;
                    const chargeScale = 1 + chargeProgress * 0.25;
                    chargeParts[ci].scale.set(chargeScale, chargeScale, chargeScale);
                    if (chargeParts[ci].material && chargeParts[ci].material.emissiveIntensity !== undefined) {
                        chargeParts[ci].material.emissiveIntensity = 0.5 + chargeProgress * 0.5;
                    }
                }
                for (let ci = 0; ci < chargeTips.length; ci++) {
                    chargeTips[ci].userData.isCharging = true;
                    const chargeScale = 1 + chargeProgress * 0.25;
                    chargeTips[ci].scale.set(chargeScale, chargeScale, chargeScale);
                    if (chargeTips[ci].material && chargeTips[ci].material.emissiveIntensity !== undefined) {
                        chargeTips[ci].material.emissiveIntensity = 0.5 + chargeProgress * 0.5;
                    }
                }
            }

            if (enemy.fireTimer <= 0) {
                const spd = 0.4 + (currentLevel - 1) * 0.02;
                if (enemy.type === 2) {
                    // Battlecruiser: spread shot — 3 bullets in a fan
                    [-18, 0, 18].forEach(xOffset => {
                        createEnemyBullet(
                            enemy.mesh.position.x,
                            enemy.mesh.position.y,
                            enemy.mesh.position.z,
                            player.x + xOffset,
                            player.y,
                            player.z,
                            spd * 0.85
                        );
                    });
                } else {
                    createEnemyBullet(
                        enemy.mesh.position.x,
                        enemy.mesh.position.y,
                        enemy.mesh.position.z,
                        player.x,
                        player.y,
                        player.z,
                        spd
                    );
                }
                playEnemyShootSound();
                enemy.fireTimer = enemy.fireInterval;

                // Reset charging state
                const resetParts = enemy.cached.pulses;
                for (let ri = 0; ri < resetParts.length; ri++) resetParts[ri].userData.isCharging = false;
                const resetTips = enemy.cached.turretTips;
                for (let ri = 0; ri < resetTips.length; ri++) resetTips[ri].userData.isCharging = false;
            }
        }

        if (enemy.mesh.position.z < -20) {
            disposeMesh(enemy.mesh);
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);
            lives--;
            updateLives();
            triggerDamageFlash();
        }
    }
}

// Collision Detection - Using distance-based detection for reliability
function checkCollisions() {
    // Check bullet-enemy collisions (iterate backwards to safely remove)
    for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = bullets[bIndex];
        const bulletPos = bullet.mesh.position;

        for (let eIndex = enemies.length - 1; eIndex >= 0; eIndex--) {
            const enemy = enemies[eIndex];
            if (enemy.dying) continue;  // Skip enemies already destroyed
            const enemyPos = enemy.mesh.position;

            // Check if bullet is in same Z-plane as enemy (with tolerance)
            const zDiff = Math.abs(bulletPos.z - enemyPos.z);
            if (zDiff > 3) continue;  // Skip if bullet is too far in Z-axis

            // Check Y and X distances separately for more forgiving collision
            const dx = Math.abs(bulletPos.x - enemyPos.x);
            const dy = Math.abs(bulletPos.y - enemyPos.y);

            // Y tolerance is larger since player can't aim up/down
            const yTolerance = 2.5;
            const xHitRadius = enemy.type === 2 ? 2.0 : 1.5;

            if (dy < yTolerance && dx < xHitRadius) {
                if (!bullet.piercing) {
                    scene.remove(bullet.mesh); // shared geo+mat — no dispose
                    bullets.splice(bIndex, 1);
                }

                enemy.hp--;

                // Hit flash — always shown, even when enemy survives
                const flashParts = enemy.cached.allMaterials;
                for (let fi = 0; fi < flashParts.length; fi++) {
                    const mat = flashParts[fi].material;
                    if (mat && mat.emissive) {
                        const orig = mat.emissiveIntensity;
                        mat.emissiveIntensity = 2.0;
                        setTimeout(() => { if (mat) mat.emissiveIntensity = orig; }, 100);
                    }
                }

                if (enemy.hp > 0) {
                    // Damaged but not dead (e.g. Battlecruiser first hit)
                    if (!bullet.piercing) break;
                    continue;
                }

                // Enemy killed
                createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);

                // Start death animation instead of immediate removal
                enemy.dying = true;
                enemy.deathTimer = 20;
                enemy.deathSpin = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                );

                const addedPoints = Math.round(difficultySettings[difficulty].enemyPoints * (ENEMY_TYPE_POINTS[enemy.type] || 1) * currentLevel);
                score += addedPoints;
                updateScore();
                createScorePopup(enemyPos.x, enemyPos.y, enemyPos.z, addedPoints);

                // Track enemies defeated for boss trigger
                enemiesDefeatedThisLevel++;

                // Track kills for extra life drop
                targetsHit++;
                if (targetsHit >= 10 && lives < 3) {
                    // Force-spawn extra life pickup
                    spawnExtraLifePickup(enemyPos.x, enemyPos.y, enemyPos.z);
                    targetsHit = 0;
                } else if (Math.random() < 0.15) {
                    // Normal 15% chance to drop a pickup
                    spawnPickup(enemyPos.x, enemyPos.y, enemyPos.z);
                }

                if (!bullet.piercing) break;  // Non-piercing: move to next bullet
            }
        }
    }

    // Enemy-player collision
    const playerPos = player.mesh.position;
    for (let index = enemies.length - 1; index >= 0; index--) {
        const enemy = enemies[index];
        if (enemy.dying) continue;  // Skip dying enemies
        const enemyPos = enemy.mesh.position;
        const distance = playerPos.distanceTo(enemyPos);

        // Player collision radius
        const collisionRadius = 2.5;

        if (distance < collisionRadius && !player.invulnerable) {
            createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
            disposeMesh(enemy.mesh);
            scene.remove(enemy.mesh);
            enemies.splice(index, 1);

            if (player.shieldStrength > 0) {
                damageShield();
            } else {
                lives--;
                updateLives();
                triggerDamageFlash();
            }
            break;  // Only one collision per frame — invulnerability handles the rest
        }
    }
}

function checkEnemyBulletCollisions() {
    if (player.invulnerable || !player.mesh) return;

    const playerPos = player.mesh.position;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        const distance = playerPos.distanceTo(bullet.mesh.position);

        if (distance < 2.5) {
            bullet.mesh.visible = false; // return to pool — shared geo, no dispose
            enemyBullets.splice(i, 1);

            if (player.shieldStrength > 0) {
                damageShield();
            } else {
                lives--;
                updateLives();
                triggerDamageFlash();
            }
            break;
        }
    }
}

// Pickup System
function createPickupGroup(type) {
    const color = PICKUP_COLORS[type];
    const symbol = PICKUP_SYMBOLS[type];
    const group = new THREE.Group();

    // Symbol rendered on a plane so it can spin
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#' + color.toString(16).padStart(6, '0');
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(symbol, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const planeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(6.25, 6.25), planeMat);
    group.add(plane);

    return group;
}

function spawnPickup(x, y, z, weaponOnly) {
    // Choose pickup type — avoid repeating the last drop
    let type;
    const pool = weaponOnly
        ? ['spread']
        : PICKUP_TYPES;
    const filtered = pool.length > 1 ? pool.filter(t => t !== lastDropType) : pool;
    type = filtered[Math.floor(Math.random() * filtered.length)];
    lastDropType = type;

    const group = createPickupGroup(type);
    group.position.set(x, y, z);
    scene.add(group);

    pickups.push({
        mesh: group,
        type: type,
        life: 480,
        speed: 0.3
    });
}

function spawnExtraLifePickup(x, y, z) {
    const group = createPickupGroup('extraLife');
    group.position.set(x, y, z);
    scene.add(group);

    pickups.push({
        mesh: group,
        type: 'extraLife',
        life: 480,
        speed: 0.3
    });
}

function updatePickups() {
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];

        // Spin on Y axis
        pickup.mesh.rotation.y += 0.06;

        // Drift toward player
        const dir = new THREE.Vector3()
            .subVectors(player.mesh.position, pickup.mesh.position)
            .normalize();
        pickup.mesh.position.add(dir.multiplyScalar(pickup.speed));

        // Pulse scale
        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.15;
        pickup.mesh.scale.set(pulse, pulse, pulse);

        // Check collection
        const dist = player.mesh.position.distanceTo(pickup.mesh.position);
        if (dist < 3.0) {
            collectPickup(pickup);
            disposeMesh(pickup.mesh);
            scene.remove(pickup.mesh);
            pickups.splice(i, 1);
            continue;
        }

        // Despawn
        pickup.life--;
        if (pickup.life <= 0) {
            disposeMesh(pickup.mesh);
            scene.remove(pickup.mesh);
            pickups.splice(i, 1);
        }
    }
}

function collectPickup(pickup) {
    switch (pickup.type) {
        case 'spread':
            player.weaponType = 'spread';
            weaponAmmo.spread += 20;
            showWeaponText(WEAPONS.spread.symbol + ' +20');
            updateWeaponHUD();
            break;
        case 'extraLife':
            if (lives < 3) {
                lives++;
                updateLives();
                showWeaponText('\u2665 +1');
            }
            break;
        case 'shield':
            if (player.shieldStrength < player.shieldMax) {
                player.shieldStrength++;
                updateShieldVisuals();
                updateShieldHUD();
                showWeaponText('SHIELD +1');
            }
            break;
    }
}

function showWeaponText(text) {
    const el = document.getElementById('weaponText');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.remove('weapon-text-fade');
    void el.offsetWidth;
    el.classList.add('weapon-text-fade');
    setTimeout(() => el.classList.add('hidden'), 1500);
}

function updateWeaponHUD() {
    const el = document.getElementById('weaponHUD');
    if (!el) return;
    const w = WEAPONS[player.weaponType];
    if (player.weaponType === 'default') {
        el.textContent = w.symbol + ' \u221E';
    } else {
        el.textContent = w.symbol + ' ' + weaponAmmo[player.weaponType];
    }
}

function syncWeaponHudPlacement() {
    if (!weaponHudEl || !hudLeftEl) return;

    weaponHudEl.classList.add('weapon-hud-mobile');
    const levelHudItem = hudLeftEl.querySelector('.hud-level');
    if (levelHudItem) {
        levelHudItem.insertAdjacentElement('afterend', weaponHudEl);
    } else {
        hudLeftEl.appendChild(weaponHudEl);
    }
}

// Particles
function createExplosion(x, y, z) {
    playExplosionSound();  // Play sound effect
    shakeCamera(0.15);  // Subtle shake for regular explosions

    // Flash effect - bright sphere that fades quickly
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9
    });
    const flashMesh = new THREE.Mesh(SHARED_GEO.explosionFlash, flashMaterial);
    flashMesh.position.set(x, y, z);
    scene.add(flashMesh);
    particles.push({
        mesh: flashMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 7,
        isFlash: true
    });

    // Shockwave ring
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.7
    });
    const ringMesh = new THREE.Mesh(SHARED_GEO.explosionRing, ringMaterial);
    ringMesh.position.set(x, y, z);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({
        mesh: ringMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 12,
        isShockwave: true,
        expandRate: 0.3
    });

    // Main explosion particles - contained but visible
    for (let i = 0; i < 20; i++) {
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff6600 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(SHARED_GEO.explosionParticle, material);
        particleMesh.position.set(x, y, z);

        const speed = 0.2 + Math.random() * 0.4;
        const particle = {
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed,
                (Math.random() - 0.5) * speed
            ),
            life: 20
        };

        scene.add(particleMesh);
        particles.push(particle);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        // Handle flash effect
        if (particle.isFlash) {
            particle.life--;
            particle.mesh.material.opacity = particle.life / 8;
            particle.mesh.scale.multiplyScalar(1.2);  // Expand quickly

            if (particle.life <= 0) {
                disposeMesh(particle.mesh);
                scene.remove(particle.mesh);
                particles.splice(i, 1);
            }
            continue;
        }

        // Handle shockwave ring
        if (particle.isShockwave) {
            particle.life--;
            particle.mesh.scale.multiplyScalar(1 + particle.expandRate);  // Expand outward
            particle.mesh.material.opacity = particle.life / 15;

            if (particle.life <= 0) {
                disposeMesh(particle.mesh);
                scene.remove(particle.mesh);
                particles.splice(i, 1);
            }
            continue;
        }

        // Regular particle behavior
        particle.mesh.position.add(particle.velocity);
        particle.life--;

        particle.mesh.material.opacity = particle.life / 35;
        particle.mesh.material.transparent = true;
        particle.mesh.scale.multiplyScalar(0.97);

        if (particle.life <= 0) {
            disposeMesh(particle.mesh);
            scene.remove(particle.mesh);
            particles.splice(i, 1);
        }
    }
}

// Engine Particle Trail System
function createEngineParticles() {
    if (!player.mesh || !gameRunning || gamePaused || portalAnimating) return;

    // Create particles from both engines
    const enginePositions = [
        { x: -1.2, y: 0, z: -3 },  // Left engine
        { x: 1.2, y: 0, z: -3 }    // Right engine
    ];

    enginePositions.forEach(offset => {
        const poolItem = engineParticlePool.find(p => !p.inUse);
        if (!poolItem) return;

        poolItem.inUse = true;
        poolItem.mesh.visible = true;
        poolItem.mesh.material.opacity = 0.8;
        poolItem.mesh.material.color.setHex(Math.random() > 0.3 ? 0xff6600 : 0xffaa00);
        poolItem.mesh.scale.set(1, 1, 1);
        poolItem.mesh.position.set(
            player.x + offset.x,
            player.y + offset.y,
            player.z + offset.z
        );

        engineParticles.push({
            mesh: poolItem.mesh,
            poolItem: poolItem,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                -0.4
            ),
            life: 12
        });
    });
}

function updateEngineParticles() {
    for (let i = engineParticles.length - 1; i >= 0; i--) {
        const particle = engineParticles[i];
        particle.mesh.position.add(particle.velocity);
        particle.life--;

        // Fade out and shrink
        particle.mesh.material.opacity = particle.life / 12;
        particle.mesh.scale.multiplyScalar(0.95);

        if (particle.life <= 0) {
            particle.mesh.visible = false;
            if (particle.poolItem) particle.poolItem.inUse = false;
            else { disposeMesh(particle.mesh); scene.remove(particle.mesh); }
            engineParticles.splice(i, 1);
        }
    }
}

// Enemy Engine Trail Particles
function createEnemyEngineParticles() {
    const colors = {
        0: [0xff00ff, 0xff66ff],
        1: [0x00aaff, 0x66ccff],
        2: [0xffcc33, 0xffdd66]
    };
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.dying) continue;
        const positions = enemy.mesh.userData.enginePositions;
        if (!positions) continue;
        const typeColors = colors[enemy.type] || colors[0];
        const scale = enemy.type === 2 ? 0.7 : 0.8;

        positions.forEach(offset => {
            const poolItem = enemyEngineParticlePool.find(p => !p.inUse);
            if (!poolItem) return;

            const color = Math.random() > 0.4 ? typeColors[0] : typeColors[1];
            poolItem.inUse = true;
            poolItem.mesh.visible = true;
            poolItem.mesh.material.opacity = 0.7;
            poolItem.mesh.material.color.setHex(color);
            poolItem.mesh.scale.set(scale, scale, scale);

            const worldPos = new THREE.Vector3(
                offset.x * scale, offset.y * scale, offset.z * scale
            );
            worldPos.applyQuaternion(enemy.mesh.quaternion);
            worldPos.add(enemy.mesh.position);
            poolItem.mesh.position.copy(worldPos);

            enemyEngineParticles.push({
                mesh: poolItem.mesh,
                poolItem: poolItem,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.06,
                    (Math.random() - 0.5) * 0.06,
                    0.25
                ),
                life: 10
            });
        });
    }
}

function updateEnemyEngineParticles() {
    for (let i = enemyEngineParticles.length - 1; i >= 0; i--) {
        const p = enemyEngineParticles[i];
        p.mesh.position.add(p.velocity);
        p.life--;
        p.mesh.material.opacity = (p.life / 10) * 0.7;
        p.mesh.scale.multiplyScalar(0.93);
        if (p.life <= 0) {
            p.mesh.visible = false;
            if (p.poolItem) p.poolItem.inUse = false;
            else { disposeMesh(p.mesh); scene.remove(p.mesh); }
            enemyEngineParticles.splice(i, 1);
        }
    }
}

// Stars — multi-layer with twinkling
function createStars() {
    const layers = [];
    const configs = [
        { count: 400, size: 0.08, opacity: 0.6, twinkle: false },  // Tiny background
        { count: 200, size: 0.15, opacity: 0.8, twinkle: true },   // Medium twinkling
        { count: 50,  size: 0.20, opacity: 0.9, twinkle: true },   // Brighter stars
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

const starField = createStars();

// Apply level theme (background color and star color)
function loadLevelTheme(levelNumber) {
    const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
    const theme = levelData ? levelData.theme : GAME_NARRATIVE.levels[GAME_NARRATIVE.levels.length - 1].theme;
    scene.background = new THREE.Color(theme.background.color);
    scene.fog.color = new THREE.Color(theme.background.color);

    // Update star field color
    if (starField && starField.layers) {
        const c = new THREE.Color(theme.starColor);
        starField.layers.forEach(layer => layer.mat.color.set(c));
    }
}

// Lane indicators removed - better options below

// High Score System — Firebase with localStorage fallback
function loadLocalHighScores() {
    const saved = localStorage.getItem('spaceShooterHighScores');
    return saved ? JSON.parse(saved) : [];
}

async function loadHighScores() {
    try {
        const snapshot = await db.ref('highScores').once('value');
        if (!snapshot.exists()) {
            return loadLocalHighScores();
        }
        const scores = [];
        snapshot.forEach(child => {
            scores.push(child.val());
        });
        scores.sort((a, b) => b.score - a.score);
        scores.splice(5);
        localStorage.setItem('spaceShooterHighScores', JSON.stringify(scores));
        return scores;
    } catch (e) {
        console.warn('Firebase read failed, using localStorage:', e.message);
        return loadLocalHighScores();
    }
}

async function getHighScore() {
    const highScores = await loadHighScores();
    return highScores.length > 0 ? highScores[0].score : 0;
}

async function updateHighScoreDisplay() {
    const highScore = await getHighScore();
    if (highScoreElement) {
        highScoreElement.textContent = highScore;
    }
}

function initializeBriefingScreen() {
    const briefingDiv = document.querySelector('.briefing-text');
    if (!briefingDiv) {
        console.warn('Briefing text element not found - mission briefing will not be displayed');
        return;
    }

    // Parse briefing text and create paragraphs safely
    const lines = GAME_NARRATIVE.mission.briefing.split('\n').filter(line => line.trim());

    // Clear existing content
    briefingDiv.innerHTML = '';

    // Create paragraph elements safely
    lines.forEach(line => {
        const p = document.createElement('p');
        if (line.includes('[CLASSIFIED]') || line.includes('[REDACTED]')) {
            p.className = 'classified';
        }
        p.textContent = line;
        briefingDiv.appendChild(p);
    });
}

async function isTopScore(score) {
    const highScores = await loadHighScores();
    return highScores.length < 5 || score > highScores[highScores.length - 1].score;
}

let lastScoreSubmitTime = 0;

async function addHighScore(name, score, difficulty) {
    // Rate limiting — prevent rapid repeat submissions
    const now = Date.now();
    if (now - lastScoreSubmitTime < 5000) return;
    lastScoreSubmitTime = now;

    // Sanitize inputs before writing to Firebase
    const safeName = String(name).trim().slice(0, 20) || 'Anonymous';
    const safeScore = (typeof score === 'number' && isFinite(score) && score >= 0) ? Math.floor(score) : 0;
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
    const entry = { name: safeName, score: safeScore, difficulty: safeDifficulty, date: new Date().toLocaleDateString() };

    // Always save to localStorage first so scores are never lost
    const localScores = loadLocalHighScores();
    localScores.push(entry);
    localScores.sort((a, b) => b.score - a.score);
    localScores.splice(5);
    localStorage.setItem('spaceShooterHighScores', JSON.stringify(localScores));

    // Then try to sync to Firebase
    try {
        await db.ref('highScores').push(entry);
        // Prune: keep only the top 5 by removing lowest scores
        const allSnapshot = await db.ref('highScores').once('value');
        const allEntries = [];
        allSnapshot.forEach(child => {
            allEntries.push({ key: child.key, score: child.val().score });
        });
        if (allEntries.length > 5) {
            allEntries.sort((a, b) => a.score - b.score);
            const toRemove = allEntries.slice(0, allEntries.length - 5);
            const updates = {};
            toRemove.forEach(e => { updates[e.key] = null; });
            await db.ref('highScores').update(updates);
        }
    } catch (e) {
        console.warn('Firebase write failed, scores saved locally:', e.message);
    }

    const result = await loadHighScores();
    await updateHighScoreDisplay();
    return result;
}

// Update UI
function updateScore() {
    scoreElement.textContent = score;
}

function createScorePopup(worldX, worldY, worldZ, points) {
    const container = document.getElementById('scorePopupContainer');
    if (!container) return;
    // Project 3D world position to 2D screen coordinates
    const vec = new THREE.Vector3(worldX, worldY, worldZ);
    vec.project(camera);
    const sx = (vec.x + 1) / 2 * window.innerWidth;
    const sy = (-vec.y + 1) / 2 * window.innerHeight;
    if (sx < 0 || sx > window.innerWidth || sy < 0 || sy > window.innerHeight) return;
    const el = document.createElement('div');
    el.className = 'score-popup';
    el.textContent = '+' + points;
    el.style.left = sx + 'px';
    el.style.top = sy + 'px';
    container.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

function triggerDamageFlash() {
    const flash = document.getElementById('damageFlash');
    if (!flash) return;
    flash.classList.remove('active');
    void flash.offsetWidth; // force reflow to restart animation
    flash.classList.add('active');
}

function updateLevel() {
    levelElement.textContent = currentLevel;
}

function updateLives() {
    livesElement.textContent = lives;
    if (lives <= 0) {
        endGame();
    } else {
        playHitSound();
        restoreShield();
        if (!player.invulnerable) {
            player.invulnerable = true;
            player.invulnerableTimer = 90;
        }
    }
}


// Pause Game
function togglePause() {
    if (!gameRunning) return;
    const pauseScreen = document.getElementById('pauseScreen');
    gamePaused = !gamePaused;

    if (gamePaused) {
        pauseScreen.classList.remove('hidden');
        if (touchControlsEl) touchControlsEl.style.pointerEvents = 'none';
    } else {
        pauseScreen.classList.add('hidden');
        if (touchControlsEl) touchControlsEl.style.pointerEvents = 'auto';
    }
}

// Mission Complete — Victory
function triggerVictory() {
    gameRunning = false;
    cancelAnimationFrame(animationId);

    showMessageBox(
        'ANDROMEDA GATE',
        'The Horizon arrives. Cargo delivered. You never learned what you were carrying — and some orders are better left unquestioned. Mission complete, pilot.'
    );

    setTimeout(() => {
        const titleEl = document.getElementById('gameOverTitle');
        if (titleEl) titleEl.textContent = 'MISSION COMPLETE';
        endGame();
    }, LEVEL_MESSAGE_TOTAL_TIME * 1.5);
}

// Game Over
async function endGame() {
    gameRunning = false;

    // Release touch fire button if held when game ends
    if (stopTouchFire) stopTouchFire();

    // Cancel any ongoing animations and timers
    if (portalAnimationId) {
        cancelAnimationFrame(portalAnimationId);
        portalAnimationId = null;
    }
    if (levelTransitionTimeout) {
        clearTimeout(levelTransitionTimeout);
        levelTransitionTimeout = null;
    }
    if (bossPortalTimeout) {
        clearTimeout(bossPortalTimeout);
        bossPortalTimeout = null;
    }

    // Clean up enemy bullets, pickups, and engine particles
    enemyBullets.forEach(b => { b.mesh.visible = false; }); // return to pool
    enemyBullets = [];
    pickups.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    pickups = [];
    enemyEngineParticles.forEach(p => {
        p.mesh.visible = false;
        if (p.poolItem) p.poolItem.inUse = false;
    });
    enemyEngineParticles = [];

    if (touchControlsEl) touchControlsEl.style.pointerEvents = 'none';
    playGameOverSound();  // Play game over sound

    finalScoreElement.textContent = score;
    gameDifficultyElement.textContent = difficulty.toUpperCase();
    const gameOverLevelEl = document.getElementById('gameOverLevel');
    if (gameOverLevelEl) gameOverLevelEl.textContent = currentLevel;
    latestGameSummary = {
        score,
        difficulty,
        level: currentLevel,
        highScore: getCurrentHighScoreValue(),
        playerName: sanitizeShareName(localStorage.getItem('spaceRunShareName') || ''),
        shareNamePrompted: false
    };
    if (shareScoreBtn) shareScoreBtn.disabled = false;
    setShareStatus('');

    // Show game over screen before asking for name
    gameOverScreen.classList.remove('hidden');
    cancelAnimationFrame(animationId);

    // In-game name entry (replaces browser prompt)
    if (await isTopScore(score)) {
        const nameEntry = document.getElementById('nameEntry');
        const nameInput = document.getElementById('playerNameInput');
        const submitBtn = document.getElementById('submitNameBtn');

        const savedName = sanitizeShareName(localStorage.getItem('spaceRunShareName') || '');
        nameInput.value = savedName;
        nameEntry.classList.remove('hidden');
        setTimeout(() => nameInput.focus(), 50);

        await new Promise(resolve => {
            async function doSubmit() {
                const name = (nameInput.value.trim() || 'Anonymous').substring(0, 20);
                latestGameSummary.playerName = sanitizeShareName(name);
                latestGameSummary.shareNamePrompted = true;
                if (latestGameSummary.playerName) {
                    localStorage.setItem('spaceRunShareName', latestGameSummary.playerName);
                }
                const highScores = await addHighScore(name, score, difficulty);
                displayHighScores(highScores);
                nameEntry.classList.add('hidden');
                resolve();
            }
            submitBtn.addEventListener('click', doSubmit, { once: true });
            nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); }, { once: true });
        });
    } else {
        displayHighScores(await loadHighScores());
    }

    await updateHighScoreDisplay();
    latestGameSummary.highScore = Math.max(getCurrentHighScoreValue(), score);
}

function displayHighScores(scores) {
    const container = document.getElementById('highScores');
    if (!container) return;
    container.innerHTML = '';

    if (scores.length === 0) {
        const p = document.createElement('p');
        p.className = 'hs-empty';
        p.textContent = 'No high scores yet';
        container.appendChild(p);
        return;
    }

    const title = document.createElement('h3');
    title.className = 'hs-title';
    title.textContent = 'TOP 5 SCORES';
    container.appendChild(title);

    scores.forEach((entry, index) => {
        const medal = index === 0 ? '\uD83E\uDD47' : index === 1 ? '\uD83E\uDD48' : index === 2 ? '\uD83E\uDD49' : '\uD83C\uDFC5';
        const div = document.createElement('div');
        div.className = 'hs-entry';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'hs-name';
        nameSpan.textContent = medal + ' ' + entry.name;
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'hs-score';
        scoreSpan.textContent = entry.score + ' (' + entry.difficulty + ')';
        div.appendChild(nameSpan);
        div.appendChild(scoreSpan);
        container.appendChild(div);
    });
}

// Start Game
function startGame() {
    // Clean up previous game — dispose GPU resources
    bullets.forEach(b => { scene.remove(b.mesh); }); // shared geo+mat — no dispose
    enemies.forEach(e => { disposeMesh(e.mesh); scene.remove(e.mesh); });
    particles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    engineParticles.forEach(p => {
        p.mesh.visible = false;
        if (p.poolItem) p.poolItem.inUse = false;
        else { disposeMesh(p.mesh); scene.remove(p.mesh); }
    });
    bullets = [];
    enemies = [];
    particles = [];
    engineParticles = [];
    enemyBullets.forEach(b => { b.mesh.visible = false; }); // return to pool
    enemyBullets = [];
    enemyEngineParticles.forEach(p => {
        p.mesh.visible = false;
        if (p.poolItem) p.poolItem.inUse = false;
    });
    enemyEngineParticles = [];
    enemyLights.forEach(l => { if (l.dispose) l.dispose(); });
    enemyLights = [];
    pickups.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    pickups = [];

    // Clean up portal if exists
    if (portal) {
        disposeMesh(portal);
        scene.remove(portal);
        portal = null;
    }
    portalAnimating = false;
    gamePaused = false;

    // Clear all key states to prevent stuck movement
    Object.keys(keys).forEach(key => keys[key] = false);
    tiltAmount = 0;
    tiltCalibrated = false; // recalibrate tilt for new game

    gameRunning = true;
    if (touchControlsEl) touchControlsEl.style.pointerEvents = 'auto';
    score = 0;
    lives = 3;
    targetsHit = 0;
    currentLevel = 1;
    enemiesDefeatedThisLevel = 0;
    enemiesRequiredForBoss = 10;
    bossActive = false;
    boss = null;
    levelTransitioning = true;  // Start with transition active during level message
    lastEnemySpawn = 0;  // Reset spawn timer
    lastShotTime = 0;
    lastDropType = null;
    weaponAmmo = { spread: 0 };
    bossHealthBar.classList.add('hidden');

    // Load level 1 theme
    loadLevelTheme(1);

    player.x = 0;
    player.y = -5;
    player.z = 0;
    player.velocityX = 0;
    player.weaponType = 'default';

    if (!player.mesh) {
        createPlayer();
    }
    player.mesh.position.set(player.x, player.y, player.z);
    player.mesh.visible = true;

    // Make sure ship is rotated to face forward (nose pointing toward positive Z)
    player.mesh.rotation.y = 0;

    // Initialize shield
    player.shieldStrength = player.shieldMax;
    player.invulnerable = false;
    player.invulnerableTimer = 0;
    if (!player.shieldMesh) {
        createShieldMesh();
    }
    updateShieldVisuals();
    updateShieldHUD();

    updateScore();
    updateLives();
    updateLevel();
    updateWeaponHUD();
    updateHighScoreDisplay();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');

    showLevelMessage(1);

    // Allow enemy spawning after level message disappears
    levelTransitionTimeout = setTimeout(() => {
        if (gameRunning) {
            levelTransitioning = false;
        }
    }, LEVEL_MESSAGE_TOTAL_TIME);

    gameLoop();
}

// Game Loop

function gameLoop(timestamp = 0) {
    if (!gameRunning) return;

    // If paused, only render (don't update game state)
    if (gamePaused) {
        composer.render();
        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    // Don't update player/bullets/enemies during portal animation
    if (!portalAnimating) {
        movePlayer();
        updateBullets();
        updateEnemies();
        updateEnemyBullets();
        updateShield();
        updatePickups();

        // Create engine particles every 2 frames (30 per second at 60fps)
        engineParticleCounter++;
        if (engineParticleCounter >= 2) {
            createEngineParticles();
            engineParticleCounter = 0;
        }
        enemyEngineParticleCounter++;
        if (enemyEngineParticleCounter >= 4) {
            createEnemyEngineParticles();
            enemyEngineParticleCounter = 0;
        }
    }

    updateParticles();
    updateEngineParticles();
    updateEnemyEngineParticles();
    starField.update();
    updatePortal();
    updateCameraShake();

    if (bossActive) {
        updateBoss();
        checkBossCollision();
    } else {
        checkCollisions();

        // Check if it's time to spawn boss (but not during level transition)
        if (!levelTransitioning && enemiesDefeatedThisLevel >= enemiesRequiredForBoss && enemies.length === 0) {
            createBoss();
        } else if (!levelTransitioning && enemiesDefeatedThisLevel < enemiesRequiredForBoss) {
            // Spawn regular enemies only until threshold is reached
            const baseInterval = difficultySettings[difficulty].spawnInterval;
            const settings = difficultySettings[difficulty];
            const levelSpeedUp = Math.max(settings.minSpawnInterval, baseInterval - (currentLevel - 1) * 80);  // Slower reduction, capped

            if (timestamp - lastEnemySpawn > levelSpeedUp) {
                const type = Math.floor(Math.random() * 3);
                createEnemy(type);
                lastEnemySpawn = timestamp;
            }
        }
    }

    // Check enemy bullet collisions (runs in both boss and normal phases)
    if (!portalAnimating) {
        checkEnemyBulletCollisions();
    }

    composer.render();
    animationId = requestAnimationFrame(gameLoop);
}

// Menu animation
function menuAnimation() {
    if (gameRunning) return;

    starField.update();
    composer.render();
    requestAnimationFrame(menuAnimation);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    syncWeaponHudPlacement();
});

// Initialize high score display on page load
syncWeaponHudPlacement();
updateHighScoreDisplay();
initializeBriefingScreen();

// Touch Controls Setup (supports both touch and mouse for DevTools compatibility)
let stopTouchFire = null; // exported so endGame() can clear a held fire button
(function setupTouchControls() {
    const touchLeft = document.getElementById('touchLeft');
    const touchRight = document.getElementById('touchRight');
    const touchFire = document.getElementById('touchFire');
    if (!touchLeft) return;

    let fireInterval = null;

    function addInputListeners(element, onStart, onEnd) {
        // Touch events (mobile)
        element.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(); });
        element.addEventListener('touchend', (e) => { e.preventDefault(); onEnd(); });
        element.addEventListener('touchcancel', () => { onEnd(); });
        // Mouse events (DevTools / desktop fallback)
        element.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(); });
        element.addEventListener('mouseup', (e) => { e.preventDefault(); onEnd(); });
        element.addEventListener('mouseleave', () => { onEnd(); });
    }

    // Movement buttons
    addInputListeners(touchLeft,
        () => { keys['ArrowLeft'] = true; touchLeft.classList.add('active'); },
        () => { keys['ArrowLeft'] = false; touchLeft.classList.remove('active'); }
    );
    addInputListeners(touchRight,
        () => { keys['ArrowRight'] = true; touchRight.classList.add('active'); },
        () => { keys['ArrowRight'] = false; touchRight.classList.remove('active'); }
    );

    // Fire button — shoot on tap, auto-fire on hold
    function tryShoot() {
        if (gameRunning && !gamePaused && !levelTransitioning) {
            shootBullet();
        }
    }

    function startFire() {
        touchFire.classList.add('active');
        tryShoot();
        if (!fireInterval) fireInterval = setInterval(tryShoot, 50);
    }
    function stopFire() {
        touchFire.classList.remove('active');
        clearInterval(fireInterval);
        fireInterval = null;
    }
    stopTouchFire = stopFire;
    addInputListeners(touchFire, startFire, stopFire);
})();

// Tilt Controls — use device orientation for left/right movement on mobile
const TILT_THRESHOLD = 5;  // degrees of tilt before movement starts
const TILT_MAX = 30;       // degrees at which tilt is considered full

function getTiltValue(event) {
    // In landscape mode, beta is left/right tilt (gamma is left/right only in portrait)
    const angle = screen.orientation ? screen.orientation.angle :
                  (window.orientation || 0);

    if (angle === 90) {
        // Landscape: home button on right (CCW rotation)
        return event.beta || 0;
    } else if (angle === -90 || angle === 270) {
        // Landscape: home button on left (CW rotation)
        return -(event.beta || 0);
    }
    // Portrait fallback
    return event.gamma || 0;
}

function handleTiltOrientation(event) {
    const raw = getTiltValue(event);

    // Calibrate: first reading establishes the "neutral" position
    if (!tiltCalibrated) {
        tiltBaseValue = raw;
        tiltCalibrated = true;
        return;
    }

    if (!gameRunning || gamePaused || !tiltEnabled) return;

    // Subtract the calibrated offset so the player's natural hold = neutral
    const tilt = raw - tiltBaseValue;

    if (Math.abs(tilt) < TILT_THRESHOLD) {
        tiltAmount = 0;
        return;
    }

    // Map from threshold..max range to 0..1, with sign
    const sign = tilt > 0 ? 1 : -1;
    const magnitude = Math.min((Math.abs(tilt) - TILT_THRESHOLD) / (TILT_MAX - TILT_THRESHOLD), 1);
    tiltAmount = sign * magnitude;
}

function enableTiltControls() {
    if (tiltEnabled) return;
    tiltEnabled = true;
    tiltCalibrated = false; // recalibrate on enable
    window.addEventListener('deviceorientation', handleTiltOrientation);
}

// Android and non-permission browsers — enable tilt immediately
if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission !== 'function' &&
    'DeviceOrientationEvent' in window) {
    enableTiltControls();
}

menuAnimation();

