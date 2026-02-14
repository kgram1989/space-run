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
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const touchControlsEl = document.getElementById('touchControls');

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
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

// Difficulty settings
const difficultySettings = {
    easy: {
        enemySpeed: { min: 0.1, max: 0.2 },
        spawnInterval: 2000,
        enemyPoints: 10,
        bossHealthMultiplier: 0.7,
        bossBonusMultiplier: 0.8,
        minSpawnInterval: 1200,
        scalingFactor: 0.20,  // Controls growth rate (slower for easy)
        enemyFireInterval: { min: 180, max: 300 },  // frames between enemy shots
        bossFireInterval: 60,
        bossMultiShot: false
    },
    medium: {
        enemySpeed: { min: 0.2, max: 0.35 },
        spawnInterval: 1400,
        enemyPoints: 15,
        bossHealthMultiplier: 1.0,
        bossBonusMultiplier: 1.0,
        minSpawnInterval: 800,
        scalingFactor: 0.25,  // Medium growth rate
        enemyFireInterval: { min: 120, max: 240 },
        bossFireInterval: 40,
        bossMultiShot: true
    },
    hard: {
        enemySpeed: { min: 0.35, max: 0.55 },
        spawnInterval: 900,
        enemyPoints: 25,
        bossHealthMultiplier: 1.3,
        bossBonusMultiplier: 1.5,
        minSpawnInterval: 700,
        scalingFactor: 0.28,  // Faster growth but diminishing
        enemyFireInterval: { min: 60, max: 150 },
        bossFireInterval: 25,
        bossMultiShot: true
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
                starColor: 0xffffff
            }
        },
        {
            id: 2,
            systemName: "Proxima Drift",
            description: "First jump complete. Navigating asteroid debris field.",
            theme: {
                background: { color: 0x110011 },
                starColor: 0xffffaa
            }
        },
        {
            id: 3,
            systemName: "Crimson Expanse",
            description: "Hostile territory. Red giant star system.",
            theme: {
                background: { color: 0x110000 },
                starColor: 0xffaaaa
            }
        },
        {
            id: 4,
            systemName: "Void Sector",
            description: "Deep space. Long-range sensors compromised.",
            theme: {
                background: { color: 0x000000 },
                starColor: 0xaaaaff
            }
        },
        {
            id: 5,
            systemName: "Andromeda Gate",
            description: "Final approach. Destination ahead.",
            theme: {
                background: { color: 0x001122 },
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
    rightEngine: null,  // Reference to right engine glow
    shield: true,
    shieldMesh: null,
    invulnerable: false,
    invulnerableTimer: 0
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

    if (player.shield) {
        // Rotate wireframe
        const wireframe = player.shieldMesh.children[2];
        if (wireframe) {
            wireframe.rotation.y += 0.005;
            wireframe.rotation.x += 0.003;
        }
        // Pulse opacity
        const shieldSphere = player.shieldMesh.children[0];
        if (shieldSphere && shieldSphere.material) {
            shieldSphere.material.opacity = Math.sin(Date.now() * 0.003) * 0.05 + 0.15;
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

function breakShield() {
    player.shield = false;
    player.invulnerable = true;
    player.invulnerableTimer = 60;

    playShieldBreakSound();
    shakeCamera(0.2);

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
    player.shield = true;
    if (player.shieldMesh) {
        player.shieldMesh.visible = true;
    }
}

// Arrays
let bullets = [];
let enemies = [];
let particles = [];
let enemyLights = [];
let engineParticles = [];
let enemyBullets = [];
let enemyEngineParticles = [];
let enemyEngineParticleCounter = 0;

// Keys
const keys = {};

// Sound System - Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);
let isMuted = false;
let masterOutputConnected = true;

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

async function ensureAudioContext() {
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (e) {
            console.warn('Failed to resume audio context:', e);
        }
    }
    // Always enforce mute state in case browser resumes or reconfigures audio graph.
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
        // Prevent focused HUD buttons (e.g., mute) from toggling via Space key.
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
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

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
            disposeMesh(bullet.mesh);
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
        }
    }
}

// Enemy Bullet System
function createEnemyBullet(sourceX, sourceY, sourceZ, targetX, targetY, targetZ, speed) {
    const direction = new THREE.Vector3(
        targetX - sourceX,
        targetY - sourceY,
        targetZ - sourceZ
    ).normalize();

    const geometry = new THREE.SphereGeometry(0.25, 8, 8);
    geometry.scale(1, 1, 2);
    const material = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        transparent: true,
        opacity: 0.9
    });
    const bulletMesh = new THREE.Mesh(geometry, material);
    bulletMesh.position.set(sourceX, sourceY, sourceZ);
    bulletMesh.lookAt(targetX, targetY, targetZ);

    // Glow trail
    const glowGeometry = new THREE.SphereGeometry(0.15, 6, 6);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.4;
    bulletMesh.add(glow);

    scene.add(bulletMesh);
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
            disposeMesh(bullet.mesh);
            scene.remove(bullet.mesh);
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
    const baseHealth = 15 + (currentLevel * 5);
    const difficultyMultiplier = difficultySettings[difficulty].bossHealthMultiplier;
    const bossHealth = Math.round(baseHealth * difficultyMultiplier);

    boss = {
        mesh: group,
        health: bossHealth,
        maxHealth: bossHealth,
        speed: 0.1,
        direction: 1,
        box: new THREE.Box3(),
        fireTimer: 60,
        fireInterval: difficultySettings[difficulty].bossFireInterval
    };

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
    boss.mesh.position.z -= 0.05;

    // Rotation for intimidation
    boss.mesh.rotation.y += 0.01;
    boss.mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;

    animateBossParts();

    // Boss shooting logic
    boss.fireTimer--;
    if (boss.fireTimer <= 0) {
        const bossPos = boss.mesh.position;
        if (difficultySettings[difficulty].bossMultiShot) {
            for (let s = -1; s <= 1; s++) {
                createEnemyBullet(
                    bossPos.x, bossPos.y, bossPos.z,
                    player.x + s * 8, player.y, player.z,
                    0.5 + (currentLevel - 1) * 0.03
                );
            }
        } else {
            createEnemyBullet(
                bossPos.x, bossPos.y, bossPos.z,
                player.x, player.y, player.z,
                0.45
            );
        }
        playEnemyShootSound();
        boss.fireTimer = boss.fireInterval;
    }

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
            disposeMesh(bullet.mesh);
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
                        if (child.material) child.material.emissiveIntensity = originalIntensity;
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

    disposeMesh(boss.mesh);
    scene.remove(boss.mesh);
    boss = null;
    bossActive = false;
    levelTransitioning = true;  // Prevent boss spawning and shooting during transition

    // Clear all bullets from screen
    bullets.forEach(b => { disposeMesh(b.mesh); scene.remove(b.mesh); });
    bullets = [];
    enemyBullets.forEach(b => { disposeMesh(b.mesh); scene.remove(b.mesh); });
    enemyBullets = [];
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
        box: new THREE.Box3(),
        lateralSpeed: (Math.random() - 0.5) * 0.25 * levelMultiplier,
        lateralDirection: Math.random() < 0.5 ? -1 : 1,  // Initial direction
        waveOffset: Math.random() * Math.PI * 2,  // Random starting point in wave
        waveAmplitude: 0.5 + Math.random() * 1.0,  // Wave intensity
        fireTimer: Math.floor(Math.random() * 120) + 60,
        fireInterval: settings.enemyFireInterval.min +
            Math.floor(Math.random() * (settings.enemyFireInterval.max - settings.enemyFireInterval.min))
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

    scene.add(enemy.mesh);
    enemies.push(enemy);
}

// Procedural animations for enemy parts
function animateEnemyParts(enemy) {
    enemy.mesh.traverse((child) => {
        if (child.userData.isRing) {
            child.rotation.z += child.userData.rotationSpeed;
        }
        if (child.userData.isPulse && !child.userData.isCharging) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.15 + 1;
            child.scale.set(pulse, pulse, pulse);
        }
        if (child.userData.isWing) {
            const flap = Math.sin(Date.now() * child.userData.flapSpeed) * 0.2;
            child.rotation.y = flap;
        }
        if (child.userData.isWeapon) {
            child.userData.weaponAngle += child.userData.rotationSpeed;
            child.position.set(
                Math.cos(child.userData.weaponAngle) * 2,
                -0.5,
                Math.sin(child.userData.weaponAngle) * 2
            );
        }
        if (child.userData.isSpike) {
            const bob = Math.sin(Date.now() * 0.008 + child.position.x * 10) * 0.03;
            child.position.y += bob;
        }
        if (child.userData.isArmorPlate) {
            child.userData.orbitAngle += child.userData.orbitSpeed;
            child.position.x = Math.cos(child.userData.orbitAngle) * 1.4;
            child.position.z = Math.sin(child.userData.orbitAngle) * 1.4;
        }
    });
}

function animateBossParts() {
    if (!boss || !boss.mesh) return;
    boss.mesh.traverse((child) => {
        if (child.userData.isBossShield) {
            child.rotation.y += 0.005;
            child.rotation.x += 0.003;
            child.material.opacity = 0.12 + Math.sin(Date.now() * 0.002) * 0.05;
        }
        if (child.userData.isBossArmor) {
            child.userData.orbitAngle += child.userData.orbitSpeed;
            child.position.x = Math.cos(child.userData.orbitAngle) * 2.8;
            child.position.z = Math.sin(child.userData.orbitAngle) * 2.8;
            child.rotation.y = child.userData.orbitAngle;
        }
        if (child.userData.isRing) {
            child.rotation.z += child.userData.rotationSpeed;
        }
        if (child.userData.isPulse) {
            const pulse = Math.sin(Date.now() * 0.006) * 0.12 + 1;
            child.scale.set(pulse, pulse, pulse);
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

        // Animate enemy parts (rings, wings, weapons)
        animateEnemyParts(enemy);

        // Enemy shooting logic with charging VFX
        if (enemy.mesh.position.z > player.z && enemy.mesh.position.z < 65) {
            enemy.fireTimer--;

            // Weapon charging VFX (15 frames before firing)
            if (enemy.fireTimer <= 15 && enemy.fireTimer > 0) {
                const chargeProgress = 1 - (enemy.fireTimer / 15);
                enemy.mesh.traverse((child) => {
                    if (child.userData.isPulse || child.userData.isTurretTip) {
                        child.userData.isCharging = true;
                        const chargeScale = 1 + chargeProgress * 0.25;
                        child.scale.set(chargeScale, chargeScale, chargeScale);
                        if (child.material && child.material.emissiveIntensity !== undefined) {
                            child.material.emissiveIntensity = 0.5 + chargeProgress * 0.5;
                        }
                    }
                });
            }

            if (enemy.fireTimer <= 0) {
                createEnemyBullet(
                    enemy.mesh.position.x,
                    enemy.mesh.position.y,
                    enemy.mesh.position.z,
                    player.x,
                    player.y,
                    player.z,
                    0.4 + (currentLevel - 1) * 0.02
                );
                playEnemyShootSound();
                enemy.fireTimer = enemy.fireInterval;

                // Reset charging state
                enemy.mesh.traverse((child) => {
                    if (child.userData.isCharging) {
                        child.userData.isCharging = false;
                    }
                });
            }
        }

        enemy.box.setFromObject(enemy.mesh);

        if (enemy.mesh.position.z < -20) {
            disposeMesh(enemy.mesh);
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
                disposeMesh(bullet.mesh);
                scene.remove(bullet.mesh);
                bullets.splice(bIndex, 1);

                // Start death animation instead of immediate removal
                enemy.dying = true;
                enemy.deathTimer = 20;
                enemy.deathSpin = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                );

                // Hit flash
                enemy.mesh.traverse((child) => {
                    if (child.material && child.material.emissive) {
                        const orig = child.material.emissiveIntensity;
                        child.material.emissiveIntensity = 2.0;
                        setTimeout(() => {
                            if (child.material) child.material.emissiveIntensity = orig;
                        }, 100);
                    }
                });

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

        if (distance < collisionRadius && !player.invulnerable) {
            createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
            disposeMesh(enemy.mesh);
            scene.remove(enemy.mesh);
            enemies.splice(index, 1);

            if (player.shield) {
                breakShield();
            } else {
                lives--;
                updateLives();
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
            disposeMesh(bullet.mesh);
            scene.remove(bullet.mesh);
            enemyBullets.splice(i, 1);

            if (player.shield) {
                breakShield();
            } else {
                lives--;
                updateLives();
            }
            break;
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
            disposeMesh(particle.mesh);
            scene.remove(particle.mesh);
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
            const geo = new THREE.SphereGeometry(0.1, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.4 ? typeColors[0] : typeColors[1],
                transparent: true,
                opacity: 0.7
            });
            const p = new THREE.Mesh(geo, mat);
            const worldPos = new THREE.Vector3(
                offset.x * scale, offset.y * scale, offset.z * scale
            );
            worldPos.applyQuaternion(enemy.mesh.quaternion);
            worldPos.add(enemy.mesh.position);
            p.position.copy(worldPos);
            scene.add(p);
            enemyEngineParticles.push({
                mesh: p,
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
            disposeMesh(p.mesh);
            scene.remove(p.mesh);
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

    return { update: animateStars };
}

const starField = createStars();

// Apply level theme (background color)
function loadLevelTheme(levelNumber) {
    const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
    const theme = levelData ? levelData.theme : GAME_NARRATIVE.levels[GAME_NARRATIVE.levels.length - 1].theme;
    scene.background = new THREE.Color(theme.background.color);
    scene.fog.color = new THREE.Color(theme.background.color);
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

async function addHighScore(name, score, difficulty) {
    const entry = { name, score, difficulty, date: new Date().toLocaleDateString() };

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

// Game Over
async function endGame() {
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

    // Clean up enemy bullets and engine particles
    enemyBullets.forEach(b => { disposeMesh(b.mesh); scene.remove(b.mesh); });
    enemyBullets = [];
    enemyEngineParticles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    enemyEngineParticles = [];

    if (touchControlsEl) touchControlsEl.style.pointerEvents = 'none';
    playGameOverSound();  // Play game over sound

    finalScoreElement.textContent = score;
    gameDifficultyElement.textContent = difficulty.toUpperCase();

    // Check for high score
    if (await isTopScore(score)) {
        const playerName = prompt('TOP 5 SCORE! Enter your name:', 'Player');
        if (playerName) {
            const highScores = await addHighScore(playerName.substring(0, 20), score, difficulty);
            displayHighScores(highScores);
        } else {
            displayHighScores(await loadHighScores());
        }
    } else {
        displayHighScores(await loadHighScores());
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
    // Clean up previous game — dispose GPU resources
    bullets.forEach(b => { disposeMesh(b.mesh); scene.remove(b.mesh); });
    enemies.forEach(e => { disposeMesh(e.mesh); scene.remove(e.mesh); });
    particles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    engineParticles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    bullets = [];
    enemies = [];
    particles = [];
    engineParticles = [];
    enemyBullets.forEach(b => { disposeMesh(b.mesh); scene.remove(b.mesh); });
    enemyBullets = [];
    enemyEngineParticles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    enemyEngineParticles = [];
    enemyLights.forEach(l => { if (l.dispose) l.dispose(); });
    enemyLights = [];

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
    bossHealthBar.classList.add('hidden');

    // Load level 1 theme
    loadLevelTheme(1);

    player.x = 0;
    player.y = -5;
    player.z = 0;
    player.velocityX = 0;

    if (!player.mesh) {
        createPlayer();
    }
    player.mesh.position.set(player.x, player.y, player.z);
    player.mesh.visible = true;

    // Make sure ship is rotated to face forward (nose pointing toward positive Z)
    player.mesh.rotation.y = 0;

    // Initialize shield
    player.shield = true;
    player.invulnerable = false;
    player.invulnerableTimer = 0;
    if (!player.shieldMesh) {
        createShieldMesh();
    } else {
        player.shieldMesh.visible = true;
    }

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
        updateEnemyBullets();
        updateShield();

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

