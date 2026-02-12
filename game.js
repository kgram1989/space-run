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
const difficultyBtns = document.querySelectorAll('.difficulty-btn');

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x (iPhone can be 3x)
renderer.shadowMap.enabled = true;
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

let gameRunning = false;
let gamePaused = false;
let score = 0;
let lives = 3;
let animationId;
let difficulty = 'medium';
let targetsHit = 0;  // Track targets hit for life bonus
let currentLevel = 1;
let enemiesDefeatedThisLevel = 0;
let enemiesRequiredForBoss = 10;  // Enemies needed to trigger boss
let bossActive = false;
let boss = null;
let levelTransitioning = false;  // Prevent spawning during level transition
let portal = null;
let portalAnimating = false;
let portalAnimationId = null;
let levelTransitionTimeout = null;
let tiltAmount = 0; // -1 (full left) to +1 (full right), 0 = no tilt

// Camera shake system
let cameraShake = {
    intensity: 0,
    decay: 0.9,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0
};
const baseCameraPosition = { x: 0, y: 12, z: -18 };
const baseCameraLookAt = { x: 0, y: -3, z: 25 };

// Cinematic camera system
let cinematicCamera = {
    active: false,
    type: null,  // 'boss_defeat' or 'portal_zoom'
    progress: 0,
    duration: 0,
    startPos: { x: 0, y: 0, z: 0 },
    targetPos: { x: 0, y: 0, z: 0 },
    lookAtTarget: { x: 0, y: 0, z: 0 }
};

// Constants for timing and spacing
const PORTAL_SPAWN_DELAY = 1500; // ms after boss defeat
const LEVEL_MESSAGE_DURATION = 2500; // ms
const LEVEL_MESSAGE_FADE_TIME = 500; // ms
const LEVEL_MESSAGE_TOTAL_TIME = 3000; // LEVEL_MESSAGE_DURATION + LEVEL_MESSAGE_FADE_TIME
const PLANET_DEPTH_SPACING = 40; // units between planet instances
const PLANET_RESPAWN_MIN_DISTANCE = 100; // minimum z distance for planet respawn
const PLANET_RESPAWN_MAX_DISTANCE = 40; // additional random distance

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

// Difficulty settings
const difficultySettings = {
    easy: {
        enemySpeed: { min: 0.1, max: 0.2 },
        spawnInterval: 2000,
        enemyPoints: 10,
        bossHealthMultiplier: 0.7,
        bossBonusMultiplier: 0.8,
        minSpawnInterval: 1200,
        scalingFactor: 0.20   // Controls growth rate (slower for easy)
    },
    medium: {
        enemySpeed: { min: 0.2, max: 0.35 },
        spawnInterval: 1400,
        enemyPoints: 15,
        bossHealthMultiplier: 1.0,
        bossBonusMultiplier: 1.0,
        minSpawnInterval: 800,
        scalingFactor: 0.25   // Medium growth rate
    },
    hard: {
        enemySpeed: { min: 0.35, max: 0.55 },
        spawnInterval: 900,
        enemyPoints: 25,
        bossHealthMultiplier: 1.3,
        bossBonusMultiplier: 1.5,
        minSpawnInterval: 700,
        scalingFactor: 0.28   // Faster growth but diminishing
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
        {
            id: 1,
            systemName: "Sol Boundary",
            description: "Departing Earth's solar system. Enemy scouts detected.",
            theme: {
                background: { color: 0x000011 },
                planets: [
                    { type: 'small', color: 0x4444ff, distance: 60, size: 2 },
                    { type: 'small', color: 0x8888ff, distance: 50, size: 1.5 },
                    { type: 'large', color: 0x6666aa, distance: 70, size: 2.5 }
                ],
                nebula: null,
                starColor: 0xffffff
            }
        },
        {
            id: 2,
            systemName: "Proxima Drift",
            description: "First jump complete. Navigating asteroid debris field.",
            theme: {
                background: { color: 0x110011 },
                planets: [
                    { type: 'ringed', color: 0xffaa66, distance: 50, size: 4, ringColor: 0xccaa88 },
                    { type: 'small', color: 0xff6699, distance: 65, size: 1.8 },
                    { type: 'small', color: 0xaa44cc, distance: 55, size: 1.2 }
                ],
                nebula: { color: 0xff00ff, opacity: 0.15 },
                starColor: 0xffffaa
            }
        },
        {
            id: 3,
            systemName: "Crimson Expanse",
            description: "Hostile territory. Red giant star system.",
            theme: {
                background: { color: 0x110000 },
                planets: [
                    { type: 'large', color: 0xff6600, distance: 70, size: 3 },
                    { type: 'small', color: 0xff4400, distance: 55, size: 1.5 },
                    { type: 'small', color: 0xcc3300, distance: 62, size: 1.0 }
                ],
                nebula: { color: 0xff0000, opacity: 0.12 },
                starColor: 0xffaaaa
            }
        },
        {
            id: 4,
            systemName: "Void Sector",
            description: "Deep space. Long-range sensors compromised.",
            theme: {
                background: { color: 0x000000 },
                planets: [
                    { type: 'large', color: 0x666666, distance: 75, size: 3 },
                    { type: 'small', color: 0x444444, distance: 60, size: 1.5 },
                    { type: 'ringed', color: 0x555555, distance: 68, size: 2.5, ringColor: 0x777777 }
                ],
                nebula: null,
                starColor: 0xaaaaff
            }
        },
        {
            id: 5,
            systemName: "Andromeda Gate",
            description: "Final approach. Destination ahead.",
            theme: {
                background: { color: 0x001122 },
                planets: [
                    { type: 'ringed', color: 0x00ffaa, distance: 45, size: 5, ringColor: 0x00ccaa },
                    { type: 'large', color: 0x00ddbb, distance: 60, size: 3.5 },
                    { type: 'small', color: 0x00aaff, distance: 55, size: 2 }
                ],
                nebula: { color: 0x00ffff, opacity: 0.2 },
                starColor: 0xaaffff
            }
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
    rightEngine: null  // Reference to right engine glow
};

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
    player.mesh.castShadow = true;
    player.mesh.receiveShadow = true;
    scene.add(player.mesh);
}

// Arrays
let bullets = [];
let enemies = [];
let particles = [];
let enemyLights = [];
let engineParticles = [];

// Keys
const keys = {};

// Sound System - Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);
let isMuted = false;

function toggleMute() {
    isMuted = !isMuted;
    masterGain.gain.value = isMuted ? 0 : 1;
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '\u{1F507}' : '\u{1F50A}';
    }
}

async function ensureAudioContext() {
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (e) {
            console.warn('Failed to resume audio context:', e);
        }
    }
}

function playShootSound() {
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

// Event Listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' && gameRunning && !gamePaused && !levelTransitioning) {
        e.preventDefault();
        shootBullet();
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
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

difficultyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        difficulty = e.target.dataset.difficulty;
        // Request tilt permission on iOS (must be in direct user gesture)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
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
directionalLight.castShadow = true;
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
    // Horizontal movement (keyboard, touch buttons, or tilt)
    const moveLeft = keys['ArrowLeft'];
    const moveRight = keys['ArrowRight'];

    if (moveLeft) {
        player.velocityX -= player.acceleration;
    }
    if (moveRight) {
        player.velocityX += player.acceleration;
    }

    // Tilt: apply proportional acceleration + friction so ship reaches a
    // proportional terminal velocity instead of always maxing out
    if (tiltAmount !== 0 && !moveLeft && !moveRight) {
        player.velocityX += tiltAmount * player.acceleration;
        player.velocityX *= player.friction;
    } else if (tiltAmount === 0 && !moveLeft && !moveRight) {
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.01) {
            player.velocityX = 0;
        }
    }

    if (player.velocityX > player.maxSpeed) player.velocityX = player.maxSpeed;
    if (player.velocityX < -player.maxSpeed) player.velocityX = -player.maxSpeed;

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

// Bullet - Shoot multiple bullets from different positions
function shootBullet() {
    playShootSound();  // Play sound effect

    const bulletPositions = [
        { x: 0, z: 4 },      // Center
        { x: -1.8, z: 3.5 }, // Left wing
        { x: 1.8, z: 3.5 }   // Right wing
    ];

    bulletPositions.forEach(offset => {
        const geometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 6);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1
        });
        const bulletMesh = new THREE.Mesh(geometry, material);
        bulletMesh.rotation.x = Math.PI / 2;

        // Shoot bullets from different positions on the ship
        bulletMesh.position.set(player.x + offset.x, player.y, player.z + offset.z);

        bullets.push({
            mesh: bulletMesh,
            speed: 1.2,
            box: new THREE.Box3()
        });

        scene.add(bulletMesh);
    });
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.z += bullet.speed;
        bullet.box.setFromObject(bullet.mesh);

        if (bullet.mesh.position.z > 80) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
        }
    }
}

// Create Boss Enemy
function createBoss() {
    const group = new THREE.Group();

    // Massive core - larger octahedron
    const coreGeometry = new THREE.OctahedronGeometry(3, 0);
    const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1.0,
        metalness: 0.9,
        roughness: 0.1
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    // Energy shield
    const shieldGeometry = new THREE.SphereGeometry(4, 16, 16);
    const shieldMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.3,
        metalness: 0.9,
        roughness: 0.1
    });
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    group.add(shield);

    // Weapon arrays
    const weaponGeometry = new THREE.ConeGeometry(0.5, 2, 6);
    const weaponMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xff0000,
        emissiveIntensity: 0.8,
        metalness: 1.0
    });

    for (let i = 0; i < 8; i++) {
        const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
        const angle = (i / 8) * Math.PI * 2;
        weapon.position.set(Math.cos(angle) * 3.5, Math.sin(angle) * 3.5, 0);
        weapon.rotation.z = angle + Math.PI / 2;
        group.add(weapon);
    }

    // Reactor core glow
    const reactorGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const reactorMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9
    });
    const reactor = new THREE.Mesh(reactorGeometry, reactorMaterial);
    group.add(reactor);

    group.scale.set(1.5, 1.5, 1.5);

    // Scale boss health based on difficulty and level
    const baseHealth = 15 + (currentLevel * 5);
    const difficultyMultiplier = difficultySettings[difficulty].bossHealthMultiplier;
    const bossHealth = Math.round(baseHealth * difficultyMultiplier);

    boss = {
        mesh: group,
        health: bossHealth,
        maxHealth: bossHealth,
        speed: 0.1,
        direction: 1,
        box: new THREE.Box3()
    };

    boss.mesh.position.set(0, -5, 70);
    boss.mesh.castShadow = true;

    // Add massive red point light
    const light = new THREE.PointLight(0xff0000, 5, 25);
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
    boss.mesh.position.z -= 0.05;

    // Rotation for intimidation
    boss.mesh.rotation.y += 0.01;
    boss.mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;

    boss.box.setFromObject(boss.mesh);

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
            scene.remove(bullet.mesh);
            bullets.splice(bIndex, 1);

            boss.health--;
            updateBossHealthBar();

            // Flash effect on hit
            boss.mesh.children.forEach(child => {
                if (child.material && child.material.emissive) {
                    const originalIntensity = child.material.emissiveIntensity;
                    child.material.emissiveIntensity = 2;
                    setTimeout(() => {
                        child.material.emissiveIntensity = originalIntensity;
                    }, 100);
                }
            });

            if (boss.health <= 0) {
                defeatBoss();
                break;  // Exit loop - boss is defeated, no need to check more bullets
            }
        }
    }

    // Check boss-player collision
    const playerPos = player.mesh.position;
    const distance = playerPos.distanceTo(bossPos);

    if (distance < 6) {
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
    const flashGeometry = new THREE.SphereGeometry(2, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 1.0
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({
        mesh: flashMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 10,
        isFlash: true
    });

    // Shockwave ring - bigger for boss
    const ringGeometry = new THREE.TorusGeometry(0.6, 0.1, 8, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
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
        const size = 0.15 + Math.random() * 0.25;
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.3 ? 0xff0000 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(geometry, material);
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

    scene.remove(boss.mesh);
    boss = null;
    bossActive = false;
    levelTransitioning = true;  // Prevent boss spawning and shooting during transition

    // Clear all bullets from screen
    bullets.forEach(b => scene.remove(b.mesh));
    bullets = [];
    bossHealthBar.classList.add('hidden');

    // Award bonus points based on difficulty and level (with gradual scaling)
    const baseBonus = 500 + ((currentLevel - 1) * 250);  // 500, 750, 1000, 1250, etc.
    const bonusMultiplier = difficultySettings[difficulty].bossBonusMultiplier;
    const levelBonus = Math.round(baseBonus * bonusMultiplier);
    score += levelBonus;
    updateScore();

    // Boss counts as 3 enemies for extra life
    if (lives < 3) {
        targetsHit += 3;
        if (targetsHit >= 10) {
            lives++;
            updateLives();
            targetsHit = lives < 3 ? targetsHit - 10 : 0;
        }
    } else {
        targetsHit = 0;
    }

    // Create portal and animate player entering it
    setTimeout(() => {
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
    backgroundManager.loadLevelTheme(currentLevel);

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
        // Modern Alien Destroyer - Octahedron design
        const group = new THREE.Group();

        // Main core - glowing octahedron
        const coreGeometry = new THREE.OctahedronGeometry(1.2, 0);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.8,
            metalness: 0.7,
            roughness: 0.2
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        group.add(core);

        // Energy rings
        const ringGeometry = new THREE.TorusGeometry(1.5, 0.1, 8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.6
        });
        const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
        ring1.rotation.x = Math.PI / 2;
        ring1.userData.isRing = true;  // Mark for animation
        ring1.userData.rotationSpeed = 0.03;
        group.add(ring1);

        const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
        ring2.rotation.y = Math.PI / 2;
        ring2.userData.isRing = true;  // Mark for animation
        ring2.userData.rotationSpeed = -0.02;  // Opposite direction
        group.add(ring2);

        // Glowing core sphere
        const glowGeometry = new THREE.SphereGeometry(0.6, 12, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.userData.isPulse = true;  // Mark for pulsing animation
        group.add(glow);

        group.scale.set(0.6, 0.6, 0.6);
        mesh = group;
    } else if (type === 1) {
        // Modern Interceptor - Angular design
        const group = new THREE.Group();

        // Main body - diamond shape
        const bodyGeometry = new THREE.ConeGeometry(1.2, 2, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.7,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Wings/Fins
        const wingGeometry = new THREE.ConeGeometry(0.8, 2, 3);
        const wingMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            metalness: 0.7,
            roughness: 0.3
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.rotation.z = Math.PI / 2;
        leftWing.position.set(-1.5, 0, 0);
        leftWing.userData.isWing = true;  // Mark for flap animation
        leftWing.userData.flapSpeed = 0.05;
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.rotation.z = -Math.PI / 2;
        rightWing.position.set(1.5, 0, 0);
        rightWing.userData.isWing = true;  // Mark for flap animation
        rightWing.userData.flapSpeed = 0.05;
        group.add(rightWing);

        // Engine cores
        const engineGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.9
        });
        const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        leftEngine.position.set(-0.6, 0, -1);
        leftEngine.userData.isPulse = true;  // Mark for pulsing
        const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        rightEngine.position.set(0.6, 0, -1);
        rightEngine.userData.isPulse = true;  // Mark for pulsing
        group.add(leftEngine, rightEngine);

        group.scale.set(0.6, 0.6, 0.6);
        mesh = group;
    } else {
        // Modern Battlecruiser - Heavy design
        const group = new THREE.Group();

        // Main hull - thick disk
        const hullGeometry = new THREE.CylinderGeometry(2.2, 2.5, 0.8, 16);
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff6600,
            emissiveIntensity: 0.6,
            metalness: 0.9,
            roughness: 0.2
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        group.add(hull);

        // Energy dome
        const domeGeometry = new THREE.SphereGeometry(1.5, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        });
        const dome = new THREE.Mesh(domeGeometry, domeMaterial);
        dome.position.y = -0.4;
        group.add(dome);

        // Weapon hardpoints
        const weaponGeometry = new THREE.BoxGeometry(0.3, 0.6, 0.3);
        const weaponMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            metalness: 0.9
        });
        for (let i = 0; i < 4; i++) {
            const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
            const angle = (i / 4) * Math.PI * 2;
            weapon.position.set(Math.cos(angle) * 2, -0.5, Math.sin(angle) * 2);
            weapon.userData.isWeapon = true;  // Mark for rotation animation
            weapon.userData.weaponAngle = angle;
            weapon.userData.rotationSpeed = 0.02;
            group.add(weapon);
        }

        // Core reactor glow
        const reactorGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16);
        const reactorMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.9
        });
        const reactor = new THREE.Mesh(reactorGeometry, reactorMaterial);
        reactor.position.y = -0.3;
        reactor.userData.isPulse = true;  // Mark for pulsing
        group.add(reactor);

        group.scale.set(0.5, 0.5, 0.5);
        mesh = group;
    }

    const baseSpeed = settings.enemySpeed.min + Math.random() * (settings.enemySpeed.max - settings.enemySpeed.min);

    const enemy = {
        mesh: mesh,
        speed: baseSpeed * levelMultiplier,  // Faster with each level
        type: type,
        box: new THREE.Box3(),
        lateralSpeed: (Math.random() - 0.5) * 0.25 * levelMultiplier,
        lateralDirection: Math.random() < 0.5 ? -1 : 1,  // Initial direction
        waveOffset: Math.random() * Math.PI * 2,  // Random starting point in wave
        waveAmplitude: 0.5 + Math.random() * 1.0  // Wave intensity
    };

    const x = (Math.random() - 0.5) * 30;
    const y = -5 + (Math.random() - 0.5) * 4;  // Spawn around center with some variance
    enemy.mesh.position.set(x, y, 70);
    enemy.mesh.castShadow = true;
    enemy.mesh.receiveShadow = true;

    // Add point light to enemy
    const light = new THREE.PointLight(
        type === 0 ? 0xff00ff : type === 1 ? 0x00ff00 : 0xff6600,
        3,
        15
    );
    enemy.mesh.add(light);
    enemyLights.push(light);

    scene.add(enemy.mesh);
    enemies.push(enemy);
}

// Procedural animations for enemy parts
function animateEnemyParts(enemy) {
    enemy.mesh.traverse((child) => {
        // Rotate rings (Type 0 - Destroyer)
        if (child.userData.isRing) {
            child.rotation.z += child.userData.rotationSpeed;
        }

        // Pulse glowing parts (all types)
        if (child.userData.isPulse) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.15 + 1;
            child.scale.set(pulse, pulse, pulse);
        }

        // Flap wings (Type 1 - Interceptor)
        if (child.userData.isWing) {
            const flap = Math.sin(Date.now() * child.userData.flapSpeed) * 0.2;
            child.rotation.y = flap;
        }

        // Rotate weapon arrays (Type 2 - Battlecruiser)
        if (child.userData.isWeapon) {
            child.userData.weaponAngle += child.userData.rotationSpeed;
            child.position.set(
                Math.cos(child.userData.weaponAngle) * 2,
                -0.5,
                Math.sin(child.userData.weaponAngle) * 2
            );
        }
    });
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
            enemy.mesh.traverse((child) => {
                if (child.material) {
                    child.material.opacity = enemy.deathTimer / 20;
                    child.material.transparent = true;
                }
            });
            enemy.mesh.scale.multiplyScalar(0.97);

            if (enemy.deathTimer <= 0) {
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

        // Smooth rotation for visual effect
        enemy.mesh.rotation.y += 0.02;
        enemy.mesh.rotation.z = Math.sin(enemy.waveOffset) * 0.1;  // Slight roll with wave

        // Animate enemy parts (rings, wings, weapons)
        animateEnemyParts(enemy);

        enemy.box.setFromObject(enemy.mesh);

        if (enemy.mesh.position.z < -20) {
            scene.remove(enemy.mesh);
            enemies.splice(i, 1);
            lives--;
            updateLives();
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
                createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
                scene.remove(bullet.mesh);
                bullets.splice(bIndex, 1);

                // Start death animation instead of immediate removal
                enemy.dying = true;
                enemy.deathTimer = 20;  // Spin out over 20 frames
                enemy.deathSpin = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                );

                score += difficultySettings[difficulty].enemyPoints * currentLevel;  // More points at higher levels
                updateScore();

                // Track enemies defeated for boss trigger
                enemiesDefeatedThisLevel++;

                // Life bonus: gain 1 life for every 10 targets hit (max 3)
                if (lives < 3) {
                    targetsHit++;
                    if (targetsHit >= 10) {
                        lives++;
                        updateLives();
                        targetsHit = lives < 3 ? targetsHit - 10 : 0;
                    }
                } else {
                    targetsHit = 0;
                }

                break;  // Bullet hit something, move to next bullet
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

        if (distance < collisionRadius) {
            createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
            scene.remove(enemy.mesh);
            enemies.splice(index, 1);
            lives--;
            updateLives();
        }
    }
}

// Particles
function createExplosion(x, y, z) {
    playExplosionSound();  // Play sound effect
    shakeCamera(0.15);  // Subtle shake for regular explosions

    // Flash effect - bright sphere that fades quickly
    const flashGeometry = new THREE.SphereGeometry(1.2, 12, 12);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.set(x, y, z);
    scene.add(flashMesh);
    particles.push({
        mesh: flashMesh,
        velocity: new THREE.Vector3(0, 0, 0),
        life: 7,
        isFlash: true
    });

    // Shockwave ring
    const ringGeometry = new THREE.TorusGeometry(0.4, 0.07, 8, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.7
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
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
        const size = 0.1 + Math.random() * 0.15;
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff6600 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(geometry, material);
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
        const geometry = new THREE.SphereGeometry(0.15, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.3 ? 0xff6600 : 0xffaa00,  // Orange/yellow mix
            transparent: true,
            opacity: 0.8
        });
        const particleMesh = new THREE.Mesh(geometry, material);

        // Position at engine location (in world space)
        particleMesh.position.set(
            player.x + offset.x,
            player.y + offset.y,
            player.z + offset.z
        );

        const particle = {
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,  // Small random spread
                (Math.random() - 0.5) * 0.1,
                -0.4  // Move backward (away from ship)
            ),
            life: 12  // Short-lived (about 200ms at 60fps)
        };

        scene.add(particleMesh);
        engineParticles.push(particle);
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
            scene.remove(particle.mesh);
            engineParticles.splice(i, 1);
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
        layers.push({ geo, mat, twinkle: cfg.twinkle, baseOpacity: cfg.opacity, phase: Math.random() * Math.PI * 2 });
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
                layer.mat.opacity = layer.baseOpacity * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame * 0.08 + layer.phase)));
            }
        });
    }

    return { update: animateStars };
}

const starField = createStars();

// Background Object Manager for level-specific visuals
class BackgroundObjectManager {
    constructor(scene) {
        this.scene = scene;
        this.planets = [];
        this.nebulaGroup = null;
    }

    loadLevelTheme(levelNumber) {
        // Clear existing background objects
        this.clearObjects();

        // Get level theme data
        const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
        if (!levelData) {
            // Fallback for levels beyond defined data - reuse last theme
            const lastLevel = GAME_NARRATIVE.levels[GAME_NARRATIVE.levels.length - 1];
            if (lastLevel && lastLevel.theme) {
                this.applyTheme(lastLevel.theme);
            }
            return;
        }

        this.applyTheme(levelData.theme);
    }

    applyTheme(theme) {
        // Update scene background and fog
        this.scene.background = new THREE.Color(theme.background.color);
        this.scene.fog.color = new THREE.Color(theme.background.color);

        // Create planets if defined
        if (theme.planets && theme.planets.length > 0) {
            // Adjust instance count based on how many planet types are defined
            const planetTypeCount = theme.planets.length;
            const instancesPerPlanet = planetTypeCount === 1 ? 2 : 1; // Less instances if multiple planet types

            theme.planets.forEach(planetData => {
                this.createPlanet(planetData, instancesPerPlanet);
            });
        }

        // Create nebula if defined
        if (theme.nebula) {
            this.createNebula(theme.nebula);
        }
    }

    createPlanet(planetData, instancesPerPlanet = 2) {
        // Create specified number of instances at staggered distances
        for (let instance = 0; instance < instancesPerPlanet; instance++) {
            let planetMesh;

            if (planetData.type === 'ringed') {
                // Create planet with ring
                const group = new THREE.Group();

                // Main planet sphere
                const sphereGeometry = new THREE.SphereGeometry(planetData.size, 32, 32);
                const sphereMaterial = new THREE.MeshStandardMaterial({
                    color: planetData.color,
                    emissive: planetData.color,
                    emissiveIntensity: 0.2,
                    metalness: 0.4,
                    roughness: 0.7
                });
                const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                group.add(sphere);

                // Ring
                const ringGeometry = new THREE.TorusGeometry(planetData.size * 1.8, planetData.size * 0.3, 2, 48);
                const ringMaterial = new THREE.MeshStandardMaterial({
                    color: planetData.ringColor || 0xcccccc,
                    emissive: planetData.ringColor || 0xcccccc,
                    emissiveIntensity: 0.1,
                    metalness: 0.6,
                    roughness: 0.5,
                    transparent: true,
                    opacity: 0.7
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.rotation.x = Math.PI / 2.5; // Tilt the ring
                group.add(ring);

                planetMesh = group;
            } else {
                // Simple planet (small or large)
                const geometry = new THREE.SphereGeometry(planetData.size, 32, 32);
                const material = new THREE.MeshStandardMaterial({
                    color: planetData.color,
                    emissive: planetData.color,
                    emissiveIntensity: 0.2,
                    metalness: 0.4,
                    roughness: 0.7
                });
                planetMesh = new THREE.Mesh(geometry, material);
            }

            // Stagger distances: spread instances across depth range
            const baseDistance = planetData.distance;
            const instanceDistance = baseDistance + (instance * PLANET_DEPTH_SPACING);

            // Position planet further to the sides and higher up (out of gameplay area)
            const side = Math.random() < 0.5 ? -1 : 1; // Choose left or right side
            const randomX = side * (40 + Math.random() * 30); // Range: ±40 to ±70 (far from center)
            const randomY = -2 + Math.random() * 30; // Range: -2 to 28 (higher up, out of gameplay)
            planetMesh.position.set(randomX, randomY, instanceDistance + 20); // Extra 20 units back

            // Set render order to appear behind game objects
            planetMesh.renderOrder = -2;

            // Add to scene
            this.scene.add(planetMesh);

            // Store in planets array with parallax speed and original data for respawning
            const speed = 0.08 + Math.random() * 0.07; // Speed range: 0.08-0.15
            this.planets.push({
                mesh: planetMesh,
                speed: speed,
                rotationSpeed: (Math.random() - 0.5) * 0.01,
                templateData: planetData // Store for respawning
            });
        }
    }

    createNebula(nebulaData) {
        this.nebulaGroup = new THREE.Group();

        // Create 3 overlapping semi-transparent spheres for distant nebula effect
        for (let i = 0; i < 3; i++) {
            const size = 15 + Math.random() * 10; // Smaller sizes: 15-25
            const geometry = new THREE.SphereGeometry(size, 32, 32); // More segments for smoother look
            const material = new THREE.MeshBasicMaterial({
                color: nebulaData.color,
                transparent: true,
                opacity: 0.05 + Math.random() * 0.05, // Much lower opacity: 0.05-0.1
                side: THREE.BackSide,
                depthWrite: false,
                fog: true
            });
            const cloud = new THREE.Mesh(geometry, material);

            // Position much further back and more spread out
            cloud.position.set(
                (Math.random() - 0.5) * 80, // Wider spread: -40 to 40
                (Math.random() - 0.5) * 50, // Taller spread: -25 to 25
                100 + Math.random() * 60 // Much further back: z: 100-160
            );

            this.nebulaGroup.add(cloud);
        }

        // Set render order to appear furthest back
        this.nebulaGroup.renderOrder = -3;

        this.scene.add(this.nebulaGroup);
    }

    update() {
        // Update planets - parallax scrolling with respawning
        for (let i = this.planets.length - 1; i >= 0; i--) {
            const planet = this.planets[i];

            // Move planet forward (toward camera)
            planet.mesh.position.z -= planet.speed;

            // Apply slow rotation
            if (planet.mesh.rotation) {
                planet.mesh.rotation.y += planet.rotationSpeed;
            }

            // Respawn planet if it passes the camera (continuous loop)
            if (planet.mesh.position.z < -30) {
                // Reposition far back with new random x/y (keep in background)
                const side = Math.random() < 0.5 ? -1 : 1; // Choose left or right side
                const randomX = side * (40 + Math.random() * 30); // Range: ±40 to ±70
                const randomY = -2 + Math.random() * 30; // Range: -2 to 28 (higher up)
                const respawnDistance = PLANET_RESPAWN_MIN_DISTANCE + Math.random() * PLANET_RESPAWN_MAX_DISTANCE; // Range: 100-140 (safer distance)
                planet.mesh.position.set(randomX, randomY, respawnDistance);

                // Add variety: randomize scale (85%-115% of original)
                const scaleVariation = 0.85 + Math.random() * 0.3;
                planet.mesh.scale.set(scaleVariation, scaleVariation, scaleVariation);

                // Randomize rotation for variety
                planet.mesh.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                );
            }
        }

        // Update nebula - very slow parallax
        if (this.nebulaGroup) {
            this.nebulaGroup.position.z -= 0.02; // Very slow movement

            // Respawn nebula if it passes the camera
            if (this.nebulaGroup.position.z < -50) {
                // Reset to far distance instead of removing
                this.nebulaGroup.position.z = 120 + Math.random() * 40; // Range: 120-160

                // Randomize positions of individual clouds for variety
                this.nebulaGroup.children.forEach(cloud => {
                    cloud.position.x = (Math.random() - 0.5) * 80;
                    cloud.position.y = (Math.random() - 0.5) * 50;
                });
            }
        }
    }

    clearObjects() {
        // Remove all planets
        this.planets.forEach(planet => {
            this.scene.remove(planet.mesh);
        });
        this.planets = [];

        // Remove nebula
        if (this.nebulaGroup) {
            this.scene.remove(this.nebulaGroup);
            this.nebulaGroup = null;
        }
    }
}

// Create background manager instance
const backgroundManager = new BackgroundObjectManager(scene);

// Lane indicators removed - better options below

// High Score System
function loadHighScores() {
    const saved = localStorage.getItem('spaceShooterHighScores');
    return saved ? JSON.parse(saved) : [];
}

function saveHighScores(scores) {
    localStorage.setItem('spaceShooterHighScores', JSON.stringify(scores));
}

function getHighScore() {
    const highScores = loadHighScores();
    return highScores.length > 0 ? highScores[0].score : 0;
}

function updateHighScoreDisplay() {
    const highScore = getHighScore();
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

function isTopScore(score) {
    const highScores = loadHighScores();
    return highScores.length < 5 || score > highScores[highScores.length - 1].score;
}

function addHighScore(name, score, difficulty) {
    const highScores = loadHighScores();
    highScores.push({ name, score, difficulty, date: new Date().toLocaleDateString() });
    highScores.sort((a, b) => b.score - a.score);
    highScores.splice(5);  // Keep only top 5
    saveHighScores(highScores);
    updateHighScoreDisplay();  // Update display when scores change
    return highScores;
}

// Update UI
function updateScore() {
    scoreElement.textContent = score;
}

function updateLevel() {
    levelElement.textContent = currentLevel;
}

function updateLives() {
    livesElement.textContent = lives;
    if (lives <= 0) {
        endGame();
    } else {
        playHitSound();  // Play hit sound when losing a life
    }
}


// Pause Game
function togglePause() {
    if (!gameRunning) return;
    const pauseScreen = document.getElementById('pauseScreen');
    gamePaused = !gamePaused;

    if (gamePaused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
    }
}

// Game Over
function endGame() {
    gameRunning = false;

    // Cancel any ongoing animations and timers
    if (portalAnimationId) {
        cancelAnimationFrame(portalAnimationId);
        portalAnimationId = null;
    }
    if (levelTransitionTimeout) {
        clearTimeout(levelTransitionTimeout);
        levelTransitionTimeout = null;
    }

    playGameOverSound();  // Play game over sound

    finalScoreElement.textContent = score;
    gameDifficultyElement.textContent = difficulty.toUpperCase();

    // Check for high score
    if (isTopScore(score)) {
        const playerName = prompt('🏆 TOP 5 SCORE! Enter your name:', 'Player');
        if (playerName) {
            const highScores = addHighScore(playerName.substring(0, 20), score, difficulty);
            displayHighScores(highScores);
        }
    } else {
        displayHighScores(loadHighScores());
    }

    gameOverScreen.classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function displayHighScores(scores) {
    const highScoresContainer = document.getElementById('highScores');
    if (!highScoresContainer) return;

    if (scores.length === 0) {
        highScoresContainer.innerHTML = '<p class="hs-empty">No high scores yet</p>';
        return;
    }

    let html = '<h3 class="hs-title">TOP 5 SCORES</h3>';
    scores.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        html += `
            <div class="hs-entry">
                <span class="hs-name">${medal} ${entry.name}</span>
                <span class="hs-score">${entry.score} <span class="hs-diff">(${entry.difficulty})</span></span>
            </div>
        `;
    });
    highScoresContainer.innerHTML = html;
}

// Start Game
function startGame() {
    // Clean up previous game
    bullets.forEach(b => scene.remove(b.mesh));
    enemies.forEach(e => scene.remove(e.mesh));
    particles.forEach(p => scene.remove(p.mesh));
    engineParticles.forEach(p => scene.remove(p.mesh));
    bullets = [];
    enemies = [];
    particles = [];
    engineParticles = [];
    enemyLights = [];

    // Clean up portal if exists
    if (portal) {
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
    bossHealthBar.classList.add('hidden');

    // Load level 1 theme
    backgroundManager.loadLevelTheme(1);

    player.x = 0;
    player.y = -5;
    player.z = 0;
    player.velocityX = 0;

    if (!player.mesh) {
        createPlayer();
    }
    player.mesh.position.set(player.x, player.y, player.z);

    // Make sure ship is rotated to face forward (nose pointing toward positive Z)
    player.mesh.rotation.y = 0;

    updateScore();
    updateLives();
    updateLevel();
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
let lastEnemySpawn = 0;
let engineParticleCounter = 0;  // Throttle engine particle creation

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

        // Create engine particles every 2 frames (30 per second at 60fps)
        engineParticleCounter++;
        if (engineParticleCounter >= 2) {
            createEngineParticles();
            engineParticleCounter = 0;
        }
    }

    updateParticles();
    updateEngineParticles();
    starField.update();
    backgroundManager.update();
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
});

// Initialize high score display on page load
updateHighScoreDisplay();
initializeBriefingScreen();

// Touch Controls Setup (supports both touch and mouse for DevTools compatibility)
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
        if (!fireInterval) fireInterval = setInterval(tryShoot, 150);
    }
    function stopFire() {
        touchFire.classList.remove('active');
        clearInterval(fireInterval);
        fireInterval = null;
    }
    addInputListeners(touchFire, startFire, stopFire);
})();

// Tilt Controls — use device orientation for left/right movement on mobile
let tiltEnabled = false;
let tiltCalibrated = false;
let tiltBaseValue = 0;     // calibration: the phone's natural resting tilt
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
