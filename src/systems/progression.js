import { gameState, player, disposeMesh, LEVEL_MESSAGE_DURATION, LEVEL_MESSAGE_FADE_TIME, LEVEL_MESSAGE_TOTAL_TIME } from '../state.js';
import { scene } from '../rendering/scene.js';
import { loadLevelTheme } from '../rendering/scene.js';
import { playPortalSound } from './audio.js';
import { updateLevel, updateLives } from './hud.js';
import { GAME_NARRATIVE } from '../data/levels.js';

export function createPortal() {
    playPortalSound();
    const portalGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
        const ringGeometry = new THREE.TorusGeometry(6 + i * 0.5, 0.4, 16, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff, transparent: true, opacity: 0.7 - i * 0.1
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.userData.rotationSpeed = (i + 1) * 0.02;
        portalGroup.add(ring);
    }
    const glowGeometry = new THREE.SphereGeometry(3, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.3 });
    portalGroup.add(new THREE.Mesh(glowGeometry, glowMaterial));
    const sharedParticleGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const matCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const matBlue = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 30; i++) {
        const particleMesh = new THREE.Mesh(sharedParticleGeometry, Math.random() > 0.5 ? matCyan : matBlue);
        const angle = (i / 30) * Math.PI * 2;
        const radius = 4 + Math.random() * 3;
        particleMesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 2, Math.sin(angle) * radius);
        particleMesh.userData.angle = angle;
        particleMesh.userData.radius = radius;
        particleMesh.userData.speed = 0.02 + Math.random() * 0.02;
        portalGroup.add(particleMesh);
    }
    portalGroup.position.set(0, -5, 50);
    const portalLight = new THREE.PointLight(0x00ffff, 5, 30);
    portalGroup.add(portalLight);
    scene.add(portalGroup);
    gameState.entities.portal = portalGroup;
}

export function updatePortal() {
    const portal = gameState.entities.portal;
    if (!portal) return;
    portal.children.forEach((child) => {
        if (child.userData.rotationSpeed) {
            child.rotation.z += child.userData.rotationSpeed;
            child.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
        }
        if (child.userData.angle !== undefined) {
            child.userData.angle += child.userData.speed;
            child.position.x = Math.cos(child.userData.angle) * child.userData.radius;
            child.position.z = Math.sin(child.userData.angle) * child.userData.radius;
        }
    });
    if (portal.children[5]) {
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
        portal.children[5].scale.set(scale, scale, scale);
    }
}

export function animatePortalEntry() {
    if (!player.mesh || !gameState.entities.portal) return;
    gameState.entities.portalAnimating = true;
    const portal = gameState.entities.portal;
    const startX = player.x, startY = player.y, startZ = player.z;
    const targetX = portal.position.x, targetY = portal.position.y, targetZ = portal.position.z;
    const duration = 2000;
    const startTime = Date.now();
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress * progress;
        player.x = startX + (targetX - startX) * eased;
        player.y = startY + (targetY - startY) * eased;
        player.z = startZ + (targetZ - startZ) * eased;
        player.mesh.position.set(player.x, player.y, player.z);
        player.mesh.rotation.y += 0.05;
        player.mesh.rotation.z = Math.sin(progress * Math.PI * 2) * 0.3;
        const scale = 1 - progress * 0.5;
        player.mesh.scale.set(scale, scale, scale);
        if (progress < 1 && gameState.runtime.gameRunning) {
            gameState.timers.portalAnimationId = requestAnimationFrame(animate);
        } else {
            gameState.entities.portalAnimating = false;
            if (portal) {
                portal.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
                scene.remove(portal);
                gameState.entities.portal = null;
            }
            player.z = 0; player.y = -5; player.x = 0; player.velocityX = 0;
            player.mesh.position.set(0, -5, 0);
            player.mesh.scale.set(1, 1, 1);
            player.mesh.rotation.y = 0;
            player.mesh.rotation.z = 0;
            nextLevel();
        }
    };
    animate();
}

export function nextLevel() {
    gameState.progression.currentLevel++;
    gameState.progression.enemiesDefeatedThisLevel = 0;
    gameState.progression.enemiesRequiredForBoss = 10 + (gameState.progression.currentLevel * 2);
    gameState.progression.levelTransitioning = true;
    gameState.timers.lastEnemySpawn = 0;
    updateLevel();
    loadLevelTheme(gameState.progression.currentLevel);
    if (gameState.progression.currentLevel % 3 === 0 && gameState.runtime.lives < 3) {
        gameState.runtime.lives++;
        updateLives();
    }
    showLevelMessage(gameState.progression.currentLevel);
    gameState.timers.levelTransitionTimeout = setTimeout(() => {
        if (gameState.runtime.gameRunning) gameState.progression.levelTransitioning = false;
    }, LEVEL_MESSAGE_TOTAL_TIME);
}

export function showLevelMessage(levelNumber) {
    const levelData = GAME_NARRATIVE.levels[levelNumber - 1];
    if (!levelData) {
        showMessageBox(`Level ${levelNumber}`, 'Entering unknown space...');
        return;
    }
    showMessageBox(levelData.systemName, levelData.description);
}

export function showMessageBox(title, subtitle) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'level-message-box';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'level-title';
    titleDiv.textContent = title;
    messageDiv.appendChild(titleDiv);
    const subtitleDiv = document.createElement('div');
    subtitleDiv.className = 'level-subtitle';
    subtitleDiv.textContent = subtitle;
    messageDiv.appendChild(subtitleDiv);
    messageDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100;animation:modalFadeIn 0.5s ease-out';
    const gameContainer = document.querySelector('.game-container');
    if (!gameContainer) return;
    gameContainer.appendChild(messageDiv);
    setTimeout(() => {
        messageDiv.style.animation = 'modalFadeOut 0.5s ease-out';
        setTimeout(() => messageDiv.remove(), LEVEL_MESSAGE_FADE_TIME);
    }, LEVEL_MESSAGE_DURATION);
}

export function triggerVictory() {
    gameState.runtime.gameRunning = false;
    cancelAnimationFrame(gameState.runtime.animationId);
    showMessageBox(
        'ANDROMEDA GATE',
        'The Horizon arrives. Cargo delivered. You never learned what you were carrying — and some orders are better left unquestioned. Mission complete, pilot.'
    );
    setTimeout(() => {
        const titleEl = document.getElementById('gameOverTitle');
        if (titleEl) titleEl.textContent = 'MISSION COMPLETE';
        globalThis.endGame?.();
    }, LEVEL_MESSAGE_TOTAL_TIME * 1.5);
}
