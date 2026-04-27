import { gameState, player, difficultySettings, latestGameSummary, disposeMesh, LEVEL_MESSAGE_TOTAL_TIME } from './state.js';
import { scene, camera, renderer, composer, starField } from './rendering/scene.js';
import { loadLevelTheme } from './rendering/scene.js';
import {
    updateCameraShake,
    updateParticles, updateEngineParticles, updateEnemyEngineParticles,
    createEngineParticles, createEnemyEngineParticles
} from './rendering/effects.js';
import { playGameOverSound, toggleMute } from './systems/audio.js';
import {
    updateScore, updateLives, updateLevel, updateWeaponHUD,
    updateShieldHUD, triggerDamageFlash, togglePause,
    syncWeaponHudPlacement, displayHighScores, updateHighScoreDisplay,
    isTopScore, addHighScore, loadHighScores, getCurrentHighScoreValue,
    initializeBriefingScreen
} from './systems/hud.js';
import { setShareStatus } from './systems/share.js';
import { showLevelMessage, updatePortal } from './systems/progression.js';
import { createPlayer, createShieldMesh, updateShield, updateShieldVisuals, movePlayer, updateBullets, shootBullet } from './entities/player.js';
import { updateEnemyBullets } from './entities/bullet.js';
import { updateEnemies, createEnemy } from './entities/enemy.js';
import { updatePickups } from './entities/pickup.js';
import { updateBoss, checkBossCollision, createBoss, cleanupBossCustom } from './entities/boss.js';
import { checkCollisions, checkEnemyBulletCollisions } from './systems/collision.js';
import { sanitizeShareName } from './systems/share.js';
import { initKeyboard, initTouchControls, initTiltControls, stopTouchFire } from './core/input.js';

// Engine particle delta-time interval: ~33ms = 30 particles/sec at 60fps
const ENGINE_PARTICLE_INTERVAL_MS = 33;
const ENEMY_PARTICLE_INTERVAL_MS = 67;

export async function endGame() {
    gameState.runtime.gameRunning = false;

    if (stopTouchFire) stopTouchFire();

    if (gameState.timers.portalAnimationId) {
        cancelAnimationFrame(gameState.timers.portalAnimationId);
        gameState.timers.portalAnimationId = null;
    }
    if (gameState.timers.levelTransitionTimeout) {
        clearTimeout(gameState.timers.levelTransitionTimeout);
        gameState.timers.levelTransitionTimeout = null;
    }
    if (gameState.timers.bossPortalTimeout) {
        clearTimeout(gameState.timers.bossPortalTimeout);
        gameState.timers.bossPortalTimeout = null;
    }

    const eb = gameState.entities.enemyBullets;
    eb.forEach(b => { b.mesh.visible = false; });
    gameState.entities.enemyBullets = [];

    const pickups = gameState.entities.pickups;
    pickups.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    gameState.entities.pickups = [];

    const eep = gameState.entities.enemyEngineParticles;
    eep.forEach(p => { p.mesh.visible = false; if (p.poolItem) p.poolItem.inUse = false; });
    gameState.entities.enemyEngineParticles = [];

    const boss = gameState.entities.boss;
    if (boss) {
        cleanupBossCustom(boss);
        if (boss.afterimages) {
            boss.afterimages.forEach(ai => { ai.mesh.material.dispose(); scene.remove(ai.mesh); });
            boss.afterimages = [];
        }
        if (boss.exhaustParticles) {
            boss.exhaustParticles.forEach(ep => { ep.mesh.material.dispose(); scene.remove(ep.mesh); });
            boss.exhaustParticles = [];
        }
        boss.escaping = false;
    }

    const touchControlsEl = document.getElementById('touchControls');
    if (touchControlsEl) touchControlsEl.style.pointerEvents = 'none';
    playGameOverSound();

    const { score, difficulty } = gameState.runtime;
    const currentLevel = gameState.progression.currentLevel;

    const finalScoreElement = document.getElementById('finalScore');
    const gameDifficultyElement = document.getElementById('gameDifficulty');
    if (finalScoreElement) finalScoreElement.textContent = score;
    if (gameDifficultyElement) gameDifficultyElement.textContent = difficulty.toUpperCase();
    const gameOverLevelEl = document.getElementById('gameOverLevel');
    if (gameOverLevelEl) gameOverLevelEl.textContent = currentLevel;
    const continueLevelSpan = document.getElementById('continueLevel');
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn && continueLevelSpan) {
        continueLevelSpan.textContent = currentLevel;
        continueBtn.classList.toggle('hidden', currentLevel <= 1);
    }

    latestGameSummary.score = score;
    latestGameSummary.difficulty = difficulty;
    latestGameSummary.level = currentLevel;
    latestGameSummary.highScore = getCurrentHighScoreValue();
    latestGameSummary.playerName = sanitizeShareName(localStorage.getItem('spaceRunShareName') || '');
    latestGameSummary.shareNamePrompted = false;

    const shareScoreBtn = document.getElementById('shareScoreBtn');
    if (shareScoreBtn) shareScoreBtn.disabled = false;
    setShareStatus('');

    const gameOverScreen = document.getElementById('gameOver');
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    cancelAnimationFrame(gameState.runtime.animationId);

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
                if (latestGameSummary.playerName) localStorage.setItem('spaceRunShareName', latestGameSummary.playerName);
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

export function startGame(fromLevel = 1) {
    const entities = gameState.entities;
    const timers = gameState.timers;

    entities.bullets.forEach(b => { scene.remove(b.mesh); });
    entities.enemies.forEach(e => { disposeMesh(e.mesh); scene.remove(e.mesh); });
    entities.particles.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    entities.engineParticles.forEach(p => {
        p.mesh.visible = false;
        if (p.poolItem) p.poolItem.inUse = false;
        else { disposeMesh(p.mesh); scene.remove(p.mesh); }
    });
    entities.bullets = [];
    entities.enemies = [];
    entities.particles = [];
    entities.engineParticles = [];
    entities.enemyBullets.forEach(b => { b.mesh.visible = false; });
    entities.enemyBullets = [];
    entities.enemyEngineParticles.forEach(p => {
        p.mesh.visible = false;
        if (p.poolItem) p.poolItem.inUse = false;
    });
    entities.enemyEngineParticles = [];
    entities.enemyLights.forEach(l => { if (l.dispose) l.dispose(); });
    entities.enemyLights = [];
    entities.pickups.forEach(p => { disposeMesh(p.mesh); scene.remove(p.mesh); });
    entities.pickups = [];

    const portal = entities.portal;
    if (portal) {
        disposeMesh(portal);
        scene.remove(portal);
        entities.portal = null;
    }
    entities.portalAnimating = false;
    gameState.runtime.gamePaused = false;

    Object.keys(gameState.input.keys).forEach(key => gameState.input.keys[key] = false);
    gameState.input.tiltAmount = 0;
    gameState.input.tiltCalibrated = false;

    gameState.runtime.gameRunning = true;
    const touchControlsEl = document.getElementById('touchControls');
    if (touchControlsEl) touchControlsEl.style.pointerEvents = 'auto';

    gameState.runtime.score = 0;
    gameState.runtime.lives = 3;
    gameState.runtime.targetsHit = 0;
    gameState.weapon.lastDropType = null;
    gameState.progression.currentLevel = fromLevel;
    gameState.progression.enemiesDefeatedThisLevel = 0;
    gameState.progression.enemiesRequiredForBoss = 10 + fromLevel * 2;
    gameState.progression.bossActive = false;
    entities.boss = null;
    gameState.progression.levelTransitioning = true;
    timers.lastEnemySpawn = 0;
    gameState.weapon.lastShotTime = 0;
    gameState.weapon.weaponAmmo = { spread: 0 };

    const bossHealthBar = document.getElementById('bossHealthBar');
    const bossHealthFill = document.getElementById('bossHealthFill');
    if (bossHealthBar) bossHealthBar.classList.add('hidden');
    if (bossHealthFill) bossHealthFill.className = 'health-bar-fill';

    loadLevelTheme(fromLevel);

    player.x = 0; player.y = -5; player.z = 0;
    player.velocityX = 0;
    player.weaponType = 'default';

    if (!player.mesh) createPlayer();
    player.mesh.position.set(player.x, player.y, player.z);
    player.mesh.visible = true;
    player.mesh.rotation.y = 0;

    player.shieldStrength = player.shieldMax;
    player.invulnerable = false;
    player.invulnerableTimer = 0;
    if (!player.shieldMesh) createShieldMesh();
    updateShieldVisuals();
    updateShieldHUD();

    updateScore();
    updateLives();
    updateLevel();
    updateWeaponHUD();
    updateHighScoreDisplay();

    document.getElementById('startScreen')?.classList.add('hidden');
    document.getElementById('gameOver')?.classList.add('hidden');
    document.getElementById('pauseScreen')?.classList.add('hidden');

    showLevelMessage(fromLevel);

    timers.levelTransitionTimeout = setTimeout(() => {
        if (gameState.runtime.gameRunning) gameState.progression.levelTransitioning = false;
    }, LEVEL_MESSAGE_TOTAL_TIME);

    // Reset delta-time accumulators
    timers.lastTimestamp = 0;
    timers.engineParticleAccum = 0;
    timers.enemyEngineAccum = 0;

    gameLoop();
}

function gameLoop(timestamp = 0) {
    if (!gameState.runtime.gameRunning) return;

    if (gameState.runtime.gamePaused) {
        composer.render();
        gameState.runtime.animationId = requestAnimationFrame(gameLoop);
        return;
    }

    const timers = gameState.timers;

    // Delta time in ms
    const dt = timers.lastTimestamp ? Math.min(timestamp - timers.lastTimestamp, 50) : 16;
    timers.lastTimestamp = timestamp;

    if (!gameState.entities.portalAnimating) {
        movePlayer();
        updateBullets();
        updateEnemies();
        updateEnemyBullets();
        updateShield();
        updatePickups();

        timers.engineParticleAccum += dt;
        if (timers.engineParticleAccum >= ENGINE_PARTICLE_INTERVAL_MS) {
            createEngineParticles();
            timers.engineParticleAccum = 0;
        }
        timers.enemyEngineAccum += dt;
        if (timers.enemyEngineAccum >= ENEMY_PARTICLE_INTERVAL_MS) {
            createEnemyEngineParticles();
            timers.enemyEngineAccum = 0;
        }
    }

    updateParticles();
    updateEngineParticles();
    updateEnemyEngineParticles();
    starField.update();
    updatePortal();
    updateCameraShake();

    const { bossActive } = gameState.progression;
    if (bossActive) {
        updateBoss();
        checkBossCollision();
        checkCollisions();
    } else {
        checkCollisions();

        const { levelTransitioning, currentLevel, enemiesDefeatedThisLevel, enemiesRequiredForBoss } = gameState.progression;
        if (!levelTransitioning && enemiesDefeatedThisLevel >= enemiesRequiredForBoss && gameState.entities.enemies.length === 0) {
            createBoss();
        } else if (!levelTransitioning && enemiesDefeatedThisLevel < enemiesRequiredForBoss) {
            const { difficulty } = gameState.runtime;
            const settings = difficultySettings[difficulty];
            const baseInterval = settings.spawnInterval;
            const levelSpeedUp = Math.max(settings.minSpawnInterval, baseInterval - (currentLevel - 1) * 80);

            if (timestamp - timers.lastEnemySpawn > levelSpeedUp) {
                const type = Math.floor(Math.random() * 3);
                createEnemy(type);
                timers.lastEnemySpawn = timestamp;
            }
        }
    }

    if (!gameState.entities.portalAnimating) {
        checkEnemyBulletCollisions();
    }

    composer.render();
    gameState.runtime.animationId = requestAnimationFrame(gameLoop);
}

function menuAnimation() {
    if (gameState.runtime.gameRunning) return;
    starField.update();
    composer.render();
    requestAnimationFrame(menuAnimation);
}

// ── Initialization ──────────────────────────────────────────────────────────

globalThis.endGame = endGame;
globalThis.togglePause = togglePause;
globalThis.toggleMute = toggleMute;

initKeyboard();
initTouchControls();
initTiltControls();

syncWeaponHudPlacement();
updateHighScoreDisplay();
initializeBriefingScreen();

// Difficulty buttons start the game
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        gameState.runtime.difficulty = btn.dataset.difficulty || 'medium';
        startGame(1);
    });
});

const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        const titleEl = document.getElementById('gameOverTitle');
        if (titleEl) titleEl.textContent = 'GAME OVER';
        document.getElementById('gameOver')?.classList.add('hidden');
        document.getElementById('startScreen')?.classList.remove('hidden');
        const shareStatusElement = document.getElementById('shareStatus');
        if (shareStatusElement) shareStatusElement.textContent = '';
    });
}

const continueBtn = document.getElementById('continueBtn');
if (continueBtn) {
    continueBtn.addEventListener('click', () => {
        const titleEl = document.getElementById('gameOverTitle');
        if (titleEl) titleEl.textContent = 'GAME OVER';
        document.getElementById('gameOver')?.classList.add('hidden');
        startGame(gameState.progression.currentLevel);
    });
}

menuAnimation();
