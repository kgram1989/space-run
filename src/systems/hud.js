import { gameState, player, WEAPONS, db, latestGameSummary } from '../state.js';
import { camera } from '../rendering/scene.js';
import { GAME_NARRATIVE } from '../data/levels.js';

const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const highScoreElement = document.getElementById('highScore');
const levelElement = document.getElementById('level');
const weaponHudEl = document.getElementById('weaponHUD');
const hudLeftEl = document.querySelector('.hud-left');

export function updateScore() {
    scoreElement.textContent = gameState.runtime.score;
}

export function updateLevel() {
    levelElement.textContent = gameState.progression.currentLevel;
}

export function updateLives() {
    const { runtime } = gameState;
    livesElement.textContent = runtime.lives;
    if (runtime.lives <= 0) {
        // endGame is set on globalThis by main.js at startup
        globalThis.endGame?.();
    } else {
        // dynamic imports to avoid circular deps
        import('../systems/audio.js').then(m => m.playHitSound());
        import('../entities/player.js').then(m => m.restoreShield());
        if (!player.invulnerable) {
            player.invulnerable = true;
            player.invulnerableTimer = 90;
        }
    }
}

export function updateWeaponHUD() {
    const el = document.getElementById('weaponHUD');
    if (!el) return;
    const w = WEAPONS[player.weaponType];
    if (player.weaponType === 'default') {
        el.textContent = w.symbol + ' \u221E';
    } else {
        el.textContent = w.symbol + ' ' + gameState.weapon.weaponAmmo[player.weaponType];
    }
}

export function updateShieldHUD() {
    const pips = document.querySelectorAll('.shield-pip');
    pips.forEach((pip, i) => {
        pip.classList.toggle('active', i < player.shieldStrength);
    });
}

export function syncWeaponHudPlacement() {
    if (!weaponHudEl || !hudLeftEl) return;
    weaponHudEl.classList.add('weapon-hud-mobile');
    const levelHudItem = hudLeftEl.querySelector('.hud-level');
    if (levelHudItem) {
        levelHudItem.insertAdjacentElement('afterend', weaponHudEl);
    } else {
        hudLeftEl.appendChild(weaponHudEl);
    }
}

export function showWeaponText(text) {
    const el = document.getElementById('weaponText');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.remove('weapon-text-fade');
    void el.offsetWidth;
    el.classList.add('weapon-text-fade');
    setTimeout(() => el.classList.add('hidden'), 1500);
}

export function createScorePopup(worldX, worldY, worldZ, points) {
    const container = document.getElementById('scorePopupContainer');
    if (!container) return;
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

export function triggerDamageFlash() {
    const flash = document.getElementById('damageFlash');
    if (!flash) return;
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
}

export function togglePause() {
    if (!gameState.runtime.gameRunning) return;
    const pauseScreen = document.getElementById('pauseScreen');
    const touchControlsEl = document.getElementById('touchControls');
    gameState.runtime.gamePaused = !gameState.runtime.gamePaused;
    if (gameState.runtime.gamePaused) {
        pauseScreen.classList.remove('hidden');
        if (touchControlsEl) touchControlsEl.style.pointerEvents = 'none';
    } else {
        pauseScreen.classList.add('hidden');
        if (touchControlsEl) touchControlsEl.style.pointerEvents = 'auto';
    }
}

export function displayHighScores(scores) {
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

export function getCurrentHighScoreValue() {
    const parsed = Number.parseInt(highScoreElement ? highScoreElement.textContent : '', 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return Math.max(0, Number(latestGameSummary.highScore) || 0, Number(latestGameSummary.score) || 0);
}

export function loadLocalHighScores() {
    const saved = localStorage.getItem('spaceShooterHighScores');
    return saved ? JSON.parse(saved) : [];
}

export async function loadHighScores() {
    try {
        const snapshot = await db.ref('highScores').once('value');
        if (!snapshot.exists()) return loadLocalHighScores();
        const scores = [];
        snapshot.forEach(child => { scores.push(child.val()); });
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

export async function updateHighScoreDisplay() {
    const highScore = await getHighScore();
    if (highScoreElement) highScoreElement.textContent = highScore;
}

export async function isTopScore(score) {
    const highScores = await loadHighScores();
    return highScores.length < 5 || score > highScores[highScores.length - 1].score;
}

let lastScoreSubmitTime = 0;

export async function addHighScore(name, score, difficulty) {
    const now = Date.now();
    if (now - lastScoreSubmitTime < 5000) return;
    lastScoreSubmitTime = now;
    const safeName = String(name).trim().slice(0, 20) || 'Anonymous';
    const safeScore = (typeof score === 'number' && isFinite(score) && score >= 0) ? Math.floor(score) : 0;
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
    const entry = { name: safeName, score: safeScore, difficulty: safeDifficulty, date: new Date().toLocaleDateString() };
    const localScores = loadLocalHighScores();
    localScores.push(entry);
    localScores.sort((a, b) => b.score - a.score);
    localScores.splice(5);
    localStorage.setItem('spaceShooterHighScores', JSON.stringify(localScores));
    try {
        await db.ref('highScores').push(entry);
        const allSnapshot = await db.ref('highScores').once('value');
        const allEntries = [];
        allSnapshot.forEach(child => { allEntries.push({ key: child.key, score: child.val().score }); });
        if (allEntries.length > 5) {
            allEntries.sort((a, b) => a.score - b.score);
            const updates = {};
            allEntries.slice(0, allEntries.length - 5).forEach(e => { updates[e.key] = null; });
            await db.ref('highScores').update(updates);
        }
    } catch (e) {
        console.warn('Firebase write failed, scores saved locally:', e.message);
    }
    const result = await loadHighScores();
    await updateHighScoreDisplay();
    return result;
}

export function initializeBriefingScreen() {
    const briefingDiv = document.querySelector('.briefing-text');
    if (!briefingDiv) return;
    const lines = GAME_NARRATIVE.mission.briefing.split('\n').filter(line => line.trim());
    briefingDiv.innerHTML = '';
    lines.forEach(line => {
        const p = document.createElement('p');
        if (line.includes('[CLASSIFIED]') || line.includes('[REDACTED]')) p.className = 'classified';
        p.textContent = line;
        briefingDiv.appendChild(p);
    });
}
