// Centralized game state and shared constants.
// All mutable runtime data lives here; other modules import what they need.

export const firebaseConfig = {
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
export const db = firebase.database();

export const gameState = {
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
        enemyEngineAccum: 0,
        engineParticleAccum: 0,
        lastEnemySpawn: 0,
        lastTimestamp: 0
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
            type: null,
            progress: 0,
            duration: 0,
            startPos: { x: 0, y: 0, z: 0 },
            targetPos: { x: 0, y: 0, z: 0 },
            lookAtTarget: { x: 0, y: 0, z: 0 }
        }
    }
};

export function bindStateAlias(name, target, key) {
    Object.defineProperty(globalThis, name, {
        get() { return target[key]; },
        set(value) { target[key] = value; },
        configurable: true
    });
}

// Set up global aliases so existing code like `currentLevel++` still works.
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
bindStateAlias('lastEnemySpawn', gameState.timers, 'lastEnemySpawn');
bindStateAlias('tiltAmount', gameState.input, 'tiltAmount');
bindStateAlias('tiltEnabled', gameState.input, 'tiltEnabled');
bindStateAlias('tiltCalibrated', gameState.input, 'tiltCalibrated');
bindStateAlias('tiltBaseValue', gameState.input, 'tiltBaseValue');
bindStateAlias('isMuted', gameState.audio, 'isMuted');
bindStateAlias('masterOutputConnected', gameState.audio, 'masterOutputConnected');
bindStateAlias('cameraShake', gameState.effects, 'cameraShake');
bindStateAlias('cinematicCamera', gameState.effects, 'cinematicCamera');

// `keys` is a direct reference to the input map (not aliased — imported directly)
export const keys = gameState.input.keys;

export let latestGameSummary = {
    score: 0,
    difficulty: 'medium',
    level: 1,
    highScore: 0,
    playerName: '',
    shareNamePrompted: false
};

// Timing / level constants
export const PORTAL_SPAWN_DELAY = 1500;
export const BOSS_PHASE_THRESHOLDS = [0.6, 0.3];
export const BOSS_PHASE_TRANSITION_FRAMES = 90;
export const LEVEL_MESSAGE_DURATION = 2500;
export const LEVEL_MESSAGE_FADE_TIME = 500;
export const LEVEL_MESSAGE_TOTAL_TIME = 3000;

// Boss escape & minion system
export const BOSS_ESCAPE_THRESHOLD = 0.15;
export const BOSS_MINION_TIMER_INTERVAL = 600;
export const ACT_FINALE_LEVELS = [5, 10, 15, 20];

export const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Difficulty settings
export const difficultySettings = {
    easy: {
        enemySpeed: { min: 0.08, max: 0.16 },
        spawnInterval: 2000,
        enemyPoints: 10,
        bossHealthMultiplier: 0.7,
        bossBonusMultiplier: 0.8,
        minSpawnInterval: 1200,
        scalingFactor: 0.20,
        enemyFireInterval: { min: 180, max: 300 },
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
        scalingFactor: 0.25,
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
        scalingFactor: 0.28,
        enemyFireInterval: { min: 60, max: 150 },
        bossFireInterval: 32,
        bossMultiShot: true,
        bossBulletSpeedMultiplier: 0.88,
        bossBurstShots: 2,
        bossBurstPauseFrames: 72
    }
};

export const ENEMY_TYPE_POINTS = [1, 1.5, 2];

export const WEAPONS = {
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

export const PICKUP_TYPES = ['spread', 'shield'];
export const PICKUP_COLORS = {
    spread: 0x00ff66,
    shield: 0x00aaff,
    extraLife: 0xff66cc
};
export const PICKUP_SYMBOLS = {
    spread: '\u2747',
    shield: '\ud83d\udee1',
    extraLife: '\u2665'
};

// Shared geometry — created once, reused across all instances
export const SHARED_GEO = {
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
    bossAuraParticle: new THREE.SphereGeometry(0.08, 6, 6),
    bossEnergyVein: new THREE.TorusGeometry(2.2, 0.04, 8, 32),
    bossMuzzleFlash: new THREE.SphereGeometry(0.4, 8, 8),
    bossAfterimage: new THREE.SphereGeometry(3, 16, 16),
    bossExhaustParticle: new THREE.SphereGeometry(0.06, 4, 4),
    minionBody: new THREE.OctahedronGeometry(0.6, 1),
};

export const SHARED_MAT = {
    bulletDefault: new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    bulletSpread: new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
    enemyBullet: new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.9 }),
    enemyBulletGlow: new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 }),
};

// Player singleton
export const player = {
    x: 0,
    y: -5,
    z: 0,
    width: 3,
    height: 4,
    speed: 0.5,
    maxSpeed: 0.4,
    acceleration: 0.03,
    friction: 0.92,
    velocityX: 0,
    mesh: null,
    wings: null,
    leftEngine: null,
    rightEngine: null,
    shieldStrength: 3,
    shieldMax: 3,
    shieldMesh: null,
    invulnerable: false,
    invulnerableTimer: 0,
    weaponType: 'default'
};

// Camera base positions
export const baseCameraPosition = { x: 0, y: 12, z: -18 };
export const baseCameraLookAt = { x: 0, y: -3, z: 25 };

// Utility functions used everywhere
export function disposeMesh(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
    }
    if (obj.children) {
        [...obj.children].forEach(child => disposeMesh(child));
    }
}

export function easeOutQuad(t) { return t * (2 - t); }
export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
export function lerp(start, end, alpha) { return start + (end - start) * alpha; }
