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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let gameRunning = false;
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
    mesh: null
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
    player.mesh.castShadow = true;
    player.mesh.receiveShadow = true;
    scene.add(player.mesh);
}

// Arrays
let bullets = [];
let enemies = [];
let particles = [];
let enemyLights = [];

// Keys
const keys = {};

// Sound System - Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playShootSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playExplosionSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

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
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 300;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

function playGameOverSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
    oscillator.type = 'triangle';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playBossHitSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 150;
    oscillator.type = 'sawtooth';

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

function playLevelCompleteSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' && gameRunning) {
        e.preventDefault();
        shootBullet();
    }

    // ESC key to exit game
    if (e.key === 'Escape' && gameRunning) {
        e.preventDefault();
        endGame();
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

// Move Player
function movePlayer() {
    // Horizontal movement
    if (keys['ArrowLeft']) {
        player.velocityX -= player.acceleration;
    }
    if (keys['ArrowRight']) {
        player.velocityX += player.acceleration;
    }

    if (!keys['ArrowLeft'] && !keys['ArrowRight']) {
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.01) {
            player.velocityX = 0;
        }
    }

    if (player.velocityX > player.maxSpeed) player.velocityX = player.maxSpeed;
    if (player.velocityX < -player.maxSpeed) player.velocityX = -player.maxSpeed;

    player.x -= player.velocityX;  // Flipped to fix opposite movement

    const boundary = 35;
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
        player.mesh.rotation.z = -player.velocityX * 0.5;
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

    // Massive explosion
    for (let i = 0; i < 100; i++) {
        const geometry = new THREE.SphereGeometry(0.3, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.3 ? 0xff0000 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(geometry, material);
        particleMesh.position.copy(boss.mesh.position);

        const particle = {
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0
            ),
            life: 50
        };

        scene.add(particleMesh);
        particles.push(particle);
    }

    scene.remove(boss.mesh);
    boss = null;
    bossActive = false;
    levelTransitioning = true;  // Prevent boss spawning during transition
    bossHealthBar.classList.add('hidden');

    // Award bonus points based on difficulty and level (with gradual scaling)
    const baseBonus = 500 + ((currentLevel - 1) * 250);  // 500, 750, 1000, 1250, etc.
    const bonusMultiplier = difficultySettings[difficulty].bossBonusMultiplier;
    const levelBonus = Math.round(baseBonus * bonusMultiplier);
    score += levelBonus;
    updateScore();

    // Advance to next level
    setTimeout(() => {
        nextLevel();
    }, 2000);
}

function nextLevel() {
    currentLevel++;
    enemiesDefeatedThisLevel = 0;
    enemiesRequiredForBoss = 10 + (currentLevel * 2);  // More enemies each level
    levelTransitioning = false;  // Allow boss spawning again
    lastEnemySpawn = 0;  // Reset spawn timer to spawn enemies immediately

    updateLevel();

    // Bonus life every 3 levels
    if (currentLevel % 3 === 0 && lives < 3) {
        lives++;
        updateLives();
    }

    // Show level message
    showLevelMessage(`Level ${currentLevel}`);
}

function showLevelMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.position = 'absolute';
    messageDiv.style.top = '50%';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translate(-50%, -50%)';
    messageDiv.style.fontSize = '4em';
    messageDiv.style.fontWeight = '900';
    messageDiv.style.color = '#00ffff';
    messageDiv.style.textShadow = '0 0 20px rgba(0, 255, 255, 1), 0 0 40px rgba(0, 255, 255, 0.6)';
    messageDiv.style.zIndex = '100';
    messageDiv.style.letterSpacing = '5px';
    messageDiv.textContent = message;
    messageDiv.style.animation = 'modalFadeIn 0.5s ease-out';

    document.querySelector('.game-container').appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 2000);
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
        group.add(ring1);

        const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
        ring2.rotation.y = Math.PI / 2;
        group.add(ring2);

        // Glowing core sphere
        const glowGeometry = new THREE.SphereGeometry(0.6, 12, 12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
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
        group.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.rotation.z = -Math.PI / 2;
        rightWing.position.set(1.5, 0, 0);
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
        const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        rightEngine.position.set(0.6, 0, -1);
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
        lateralDirection: Math.random() < 0.5 ? -1 : 1  // Initial direction
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

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Forward movement
        enemy.mesh.position.z -= enemy.speed;

        // Lateral (sideways) movement with direction changes at boundaries
        enemy.mesh.position.x += enemy.lateralSpeed * enemy.lateralDirection;

        // Reverse direction if hitting boundaries
        if (enemy.mesh.position.x > 30 || enemy.mesh.position.x < -30) {
            enemy.lateralDirection *= -1;
        }

        // Rotation for visual effect
        enemy.mesh.rotation.y += 0.02;
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
                scene.remove(enemy.mesh);
                bullets.splice(bIndex, 1);
                enemies.splice(eIndex, 1);
                score += difficultySettings[difficulty].enemyPoints * currentLevel;  // More points at higher levels
                updateScore();

                // Track enemies defeated for boss trigger
                enemiesDefeatedThisLevel++;

                // Life bonus: gain 1 life for every 10 targets hit (max 3)
                targetsHit++;
                if (targetsHit >= 10 && lives < 3) {
                    lives++;
                    targetsHit = 0;
                    updateLives();
                } else if (targetsHit >= 10) {
                    targetsHit = 0;  // Reset counter even if at max lives
                }

                break;  // Bullet hit something, move to next bullet
            }
        }
    }

    // Enemy-player collision
    const playerPos = player.mesh.position;
    for (let index = enemies.length - 1; index >= 0; index--) {
        const enemy = enemies[index];
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

    for (let i = 0; i < 25; i++) {
        const geometry = new THREE.SphereGeometry(0.2, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xff6600 : 0xffff00
        });
        const particleMesh = new THREE.Mesh(geometry, material);
        particleMesh.position.set(x, y, z);

        const particle = {
            mesh: particleMesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 1.0,
                (Math.random() - 0.5) * 1.0,
                (Math.random() - 0.5) * 1.0
            ),
            life: 35
        };

        scene.add(particleMesh);
        particles.push(particle);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
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

// Stars
const stars = [];
function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        transparent: true,
        opacity: 0.8
    });

    const starVertices = [];
    for (let i = 0; i < 300; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 60;
        const z = Math.random() * 100 - 20;
        starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Animate stars moving toward player (flying forward effect)
    function animateStars() {
        const positions = starGeometry.attributes.position.array;
        for (let i = 2; i < positions.length; i += 3) {
            positions[i] -= 0.3;
            if (positions[i] < -20) {
                positions[i] = 80;
                // Randomize x and y when star resets
                positions[i - 2] = (Math.random() - 0.5) * 100;
                positions[i - 1] = (Math.random() - 0.5) * 60;
            }
        }
        starGeometry.attributes.position.needsUpdate = true;
    }

    return { mesh: starField, update: animateStars };
}

const starField = createStars();

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


// Game Over
function endGame() {
    gameRunning = false;
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
        highScoresContainer.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.9em;">No high scores yet</p>';
        return;
    }

    let html = '<h3 style="font-size: 1.2em; margin-bottom: 15px; color: #00ffff;">🏆 TOP 5 SCORES</h3>';
    scores.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        html += `
            <div style="margin: 8px 0; padding: 8px; background: rgba(0,255,255,0.1); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1.1em;">${medal} ${entry.name}</span>
                <span style="color: #ffff00; font-weight: bold;">${entry.score} <span style="color: #00ffff; font-size: 0.8em;">(${entry.difficulty})</span></span>
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
    bullets = [];
    enemies = [];
    particles = [];
    enemyLights = [];

    // Clear all key states to prevent stuck movement
    Object.keys(keys).forEach(key => keys[key] = false);

    gameRunning = true;
    score = 0;
    lives = 3;
    targetsHit = 0;
    currentLevel = 1;
    enemiesDefeatedThisLevel = 0;
    enemiesRequiredForBoss = 10;
    bossActive = false;
    boss = null;
    levelTransitioning = false;
    lastEnemySpawn = 0;  // Reset spawn timer
    bossHealthBar.classList.add('hidden');

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

    showLevelMessage('Level 1 - START!');

    gameLoop();
}

// Game Loop
let lastEnemySpawn = 0;

function gameLoop(timestamp = 0) {
    if (!gameRunning) return;

    movePlayer();
    updateBullets();
    updateEnemies();
    updateParticles();
    starField.update();

    if (bossActive) {
        updateBoss();
        checkBossCollision();
    } else {
        checkCollisions();

        // Check if it's time to spawn boss (but not during level transition)
        if (!levelTransitioning && enemiesDefeatedThisLevel >= enemiesRequiredForBoss && enemies.length === 0) {
            createBoss();
        } else if (!levelTransitioning) {
            // Spawn regular enemies (but not during boss fight or level transition)
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

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(gameLoop);
}

// Menu animation
function menuAnimation() {
    if (gameRunning) return;

    starField.update();
    renderer.render(scene, camera);
    requestAnimationFrame(menuAnimation);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize high score display on page load
updateHighScoreDisplay();

menuAnimation();
