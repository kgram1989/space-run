import {
    gameState, player, isMobile, difficultySettings, disposeMesh,
    SHARED_GEO, BOSS_PHASE_THRESHOLDS, BOSS_PHASE_TRANSITION_MS,
    BOSS_MINION_TIMER_INTERVAL, BOSS_ESCAPE_THRESHOLD, PORTAL_SPAWN_DELAY
} from '../state.js';
import { scene } from '../rendering/scene.js';
import { playExplosionSound, playLevelCompleteSound, playBossPhaseSound, playBossHitSound, playEnemyShootSound } from '../systems/audio.js';
import { updateScore, updateLives, createScorePopup } from '../systems/hud.js';
import { createExplosion } from '../rendering/effects.js';
import { createEnemyBullet } from './bullet.js';
import { spawnPickup, spawnExtraLifePickup } from './pickup.js';
import { damagePlayer } from './player.js';
import {
    ACT_BOSS_CONFIG, getAct, getActLevel, isActFinale, getMinionCount, getEscapeMinionCount,
    LEVEL_BOSS_NAMES, LEVEL_BOSS_STATS, getBossCustomState, buildBossMesh
} from '../data/bossConfigs.js';
import { createPortal, animatePortalEntry } from '../systems/progression.js';
import { triggerVictory } from '../systems/progression.js';

export function createBoss() {
    const currentLevel = gameState.progression.currentLevel;
    const { difficulty } = gameState.runtime;
    const act = getAct(currentLevel);
    const cfg = ACT_BOSS_CONFIG[act] || ACT_BOSS_CONFIG[4];
    const group = new THREE.Group();
    const levelStats = LEVEL_BOSS_STATS[currentLevel] || { scale: cfg.scale, baseSpeedMult: 1.0, fireIntervalMult: 1.0 };
    buildBossMesh(currentLevel, group, cfg);
    group.scale.set(levelStats.scale, levelStats.scale, levelStats.scale);

    const baseHealth = Math.min(15 + (currentLevel * 5), 60);
    const difficultyMultiplier = difficultySettings[difficulty].bossHealthMultiplier;
    const bossHealth = Math.round(baseHealth * difficultyMultiplier);

    const bossSettings = difficultySettings[difficulty];
    const actBaseSpeed = cfg.baseSpeed * levelStats.baseSpeedMult;
    const actFireInterval = Math.round(bossSettings.bossFireInterval * cfg.fireIntervalMult * levelStats.fireIntervalMult);
    const actBurstPause = Math.round(bossSettings.bossBurstPauseMs * cfg.fireIntervalMult);

    const boss = {
        mesh: group,
        health: bossHealth,
        maxHealth: bossHealth,
        speed: actBaseSpeed,
        direction: 1,
        fireTimer: 1000,
        fireInterval: actFireInterval,
        burstShotsPerCycle: bossSettings.bossBurstShots,
        burstShotsRemaining: bossSettings.bossBurstShots,
        burstPauseMs: actBurstPause,
        bulletSpeedMultiplier: bossSettings.bossBulletSpeedMultiplier,
        phase: 1,
        phaseTransitioning: false,
        phaseTransitionTimer: 0,
        baseFireInterval: actFireInterval,
        baseBurstPauseMs: actBurstPause,
        baseSpeed: actBaseSpeed,
        afterimages: [],
        afterimageTimer: 0,
        exhaustParticles: [],
        armorDamageApplied: false,
        escaping: false,
        escapeTimer: 0,
        canEscape: false,
        minionSpawnTimer: 0,
        minionSpawnInterval: BOSS_MINION_TIMER_INTERVAL,
        canSpawnMinions: getActLevel(currentLevel) >= 3,
        isFinale: isActFinale(currentLevel),
        level: currentLevel,
        custom: getBossCustomState(currentLevel),
        actColors: cfg
    };

    boss.cached = {
        shields: [], armor: [], rings: [], pulses: [], emissiveChildren: [],
        aura: [], veins: [], cannons: [], lanceTips: []
    };
    boss.mesh.traverse((child) => {
        if (child.userData.isBossShield) boss.cached.shields.push(child);
        if (child.userData.isBossArmor) boss.cached.armor.push(child);
        if (child.userData.isRing) boss.cached.rings.push(child);
        if (child.userData.isPulse) boss.cached.pulses.push(child);
        if (child.userData.isBossAura) boss.cached.aura.push(child);
        if (child.userData.isBossVein) boss.cached.veins.push(child);
        if (child.material && child.material.emissive) boss.cached.emissiveChildren.push(child);
    });

    boss.mesh.position.set(0, -5, 70);
    boss.mesh.castShadow = !isMobile;

    const light = new THREE.PointLight(cfg.lightBase, 4, 25);
    boss.mesh.add(light);
    const light2 = new THREE.PointLight(cfg.lightSide, 2, 18);
    light2.position.set(3, 0, 0);
    boss.mesh.add(light2);
    const light3 = new THREE.PointLight(cfg.lightSide, 2, 18);
    light3.position.set(-3, 0, 0);
    boss.mesh.add(light3);
    boss.cached.dynamicLights = [light, light2, light3];

    scene.add(boss.mesh);
    gameState.entities.boss = boss;
    gameState.progression.bossActive = true;

    const bossHealthBar = document.getElementById('bossHealthBar');
    if (bossHealthBar) bossHealthBar.classList.remove('hidden');
    updateBossHealthBar();
    updateBossPhaseLabel();
    updateBossHealthBarColor();
}

export function updateBossHealthBar() {
    const boss = gameState.entities.boss;
    const bossHealthFill = document.getElementById('bossHealthFill');
    if (boss && bossHealthFill) {
        bossHealthFill.style.width = (boss.health / boss.maxHealth) * 100 + '%';
    }
}

export function updateBossPhaseLabel() {
    const label = document.getElementById('bossPhaseLabel');
    const boss = gameState.entities.boss;
    if (!label || !boss) return;
    const bossName = (boss.level && LEVEL_BOSS_NAMES[boss.level]) ? LEVEL_BOSS_NAMES[boss.level] : (boss.actColors ? boss.actColors.name : 'THE CORE');
    label.textContent = `${bossName} \u2014 PHASE ${boss.phase}`;
    label.className = 'boss-phase-label';
    if (boss.phase === 2) label.classList.add('phase-2');
    else if (boss.phase === 3) label.classList.add('phase-3');
}

export function updateBossHealthBarColor() {
    const boss = gameState.entities.boss;
    const bossHealthFill = document.getElementById('bossHealthFill');
    if (!boss || !bossHealthFill) return;
    bossHealthFill.className = 'health-bar-fill';
    if (boss.phase === 2) bossHealthFill.classList.add('phase-2');
    else if (boss.phase === 3) bossHealthFill.classList.add('phase-3');
}

export function defaultBossAttack(b, dt) {
    const currentLevel = gameState.progression.currentLevel;
    const { difficulty } = gameState.runtime;
    b.fireTimer -= dt;
    if (b.fireTimer > 0) return;
    const bossPos = b.mesh.position;
    const multiShotSpeed = (0.5 + (currentLevel - 1) * 0.03) * b.bulletSpeedMultiplier;
    const singleShotSpeed = 0.45 * b.bulletSpeedMultiplier;

    if (b.phase === 3) {
        for (let s = -2; s <= 2; s++) {
            createEnemyBullet(bossPos.x, bossPos.y, bossPos.z, player.x + s * 5, player.y, player.z, multiShotSpeed * 1.1);
        }
    } else if (b.phase === 2 || difficultySettings[difficulty].bossMultiShot) {
        for (let s = -1; s <= 1; s++) {
            createEnemyBullet(bossPos.x, bossPos.y, bossPos.z, player.x + s * 8, player.y, player.z, multiShotSpeed);
        }
    } else {
        createEnemyBullet(bossPos.x, bossPos.y, bossPos.z, player.x, player.y, player.z, singleShotSpeed);
    }
    playEnemyShootSound();

    const muzzleCount = Math.min(b.phase + 1, 4);
    const particles = gameState.entities.particles;
    for (let m = 0; m < muzzleCount; m++) {
        const mAngle = (m * 2 / 8) * Math.PI * 2;
        const muzzleMat = new THREE.MeshBasicMaterial({
            color: b.phase === 3 ? 0xffaa00 : b.phase === 2 ? 0xff6600 : 0xff3300,
            transparent: true, opacity: 0.9
        });
        const muzzleMesh = new THREE.Mesh(SHARED_GEO.bossMuzzleFlash, muzzleMat);
        muzzleMesh.position.set(
            bossPos.x + Math.cos(mAngle + b.mesh.rotation.y) * 7,
            bossPos.y + Math.sin(mAngle + b.mesh.rotation.y) * 7,
            bossPos.z
        );
        scene.add(muzzleMesh);
        particles.push({ mesh: muzzleMesh, velocity: new THREE.Vector3(0, 0, 0), life: 5, isFlash: true });
    }

    if (b.burstShotsRemaining > 1) {
        b.burstShotsRemaining--;
        b.fireTimer = b.fireInterval;
    } else {
        b.burstShotsRemaining = b.burstShotsPerCycle;
        b.fireTimer = b.burstPauseMs;
    }
}

export function updateBossAttack(b, dt) {
    switch (b.level) {
        case 3: return;
        case 2: {
            const facing = Math.abs(b.mesh.rotation.y % (Math.PI * 2)) < 0.5 ||
                           Math.abs((b.mesh.rotation.y % (Math.PI * 2)) - Math.PI * 2) < 0.5;
            if (!facing) { b.fireTimer = Math.max(b.fireTimer - dt, 0); return; }
            defaultBossAttack(b, dt); return;
        }
        case 13:
            if (b.custom.rageTier >= 3) return;
            defaultBossAttack(b); return;
        case 17:
        case 18: return;
        case 19: {
            const c19 = b.custom;
            if (c19.overloadTimer > 0) {
                c19.overloadTimer = 0;
                const bp = b.mesh.position;
                for (let d = 0; d < 12; d++) {
                    const a = (d / 12) * Math.PI * 2;
                    createEnemyBullet(bp.x, bp.y, bp.z, bp.x + Math.cos(a) * 10, bp.y, bp.z + Math.sin(a) * 10, 0.45);
                }
                playEnemyShootSound();
            }
            return;
        }
        default: defaultBossAttack(b, dt);
    }
}

export function updateBossCustomMechanics(b) {
    const c = b.custom;
    const bossPos = b.mesh.position;
    const bullets = gameState.entities.bullets;
    const enemies = gameState.entities.enemies;

    switch (b.level) {
        case 1: {
            for (let i = c.trackingBullets.length - 1; i >= 0; i--) {
                const tb = c.trackingBullets[i];
                if (!tb.mesh.visible) { c.trackingBullets.splice(i, 1); continue; }
                const dx = player.x - tb.mesh.position.x;
                const dz = player.z - tb.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                tb.velocity.x += (dx / dist) * 0.012;
                tb.velocity.z += (dz / dist) * 0.012;
                const spd = Math.sqrt(tb.velocity.x * tb.velocity.x + tb.velocity.z * tb.velocity.z);
                if (spd > 0.55) { tb.velocity.x *= 0.55 / spd; tb.velocity.z *= 0.55 / spd; }
            }
            b.fireTimer--;
            if (b.fireTimer <= 0) {
                b.fireTimer = b.fireInterval;
                createEnemyBullet(bossPos.x, bossPos.y, bossPos.z, player.x, player.y, player.z, 0.3);
                const enemyBullets = gameState.entities.enemyBullets;
                if (enemyBullets.length > 0) {
                    c.trackingBullets.push(enemyBullets[enemyBullets.length - 1]);
                    playEnemyShootSound();
                }
            }
            break;
        }
        case 2: {
            c.mineDropTimer++;
            if (c.mineDropTimer >= 240) {
                c.mineDropTimer = 0;
                const mineGeo = new THREE.SphereGeometry(0.55, 8, 8);
                const mineMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.2 });
                const mineMesh = new THREE.Mesh(mineGeo, mineMat);
                mineMesh.position.set(bossPos.x, bossPos.y - 1, bossPos.z);
                scene.add(mineMesh);
                c.mines.push({ mesh: mineMesh, life: 600 });
            }
            for (let i = c.mines.length - 1; i >= 0; i--) {
                const m = c.mines[i];
                m.life--;
                if (m.life <= 0) { scene.remove(m.mesh); disposeMesh(m.mesh); c.mines.splice(i, 1); continue; }
                const p = Math.sin(Date.now() * 0.006) * 0.2 + 0.8;
                m.mesh.scale.setScalar(p);
                const dx = player.x - m.mesh.position.x, dz = player.z - m.mesh.position.z;
                if (dx * dx + dz * dz < 9) {
                    scene.remove(m.mesh); disposeMesh(m.mesh); c.mines.splice(i, 1);
                    damagePlayer();
                }
            }
            break;
        }
        case 3: {
            c.hangarTimer++;
            if (c.hangarTimer >= 180) {
                c.hangarTimer = 0;
                spawnBossMinionWave(3, 'arc');
                b.mesh.traverse(child => {
                    if (child.userData.isHangar) {
                        child.material.emissiveIntensity = 2.5;
                        setTimeout(() => { if (child.material) child.material.emissiveIntensity = 0.9; }, 300);
                    }
                });
            }
            break;
        }
        case 4: {
            if (c.dashing) {
                c.dashTimer--;
                b.mesh.position.x += c.dashVelX;
                b.mesh.position.z += c.dashVelZ;
                const dx = player.x - bossPos.x, dz = player.z - bossPos.z;
                if (Math.sqrt(dx*dx + dz*dz) < 3.5) { damagePlayer(); c.dashing = false; }
                if (c.dashTimer <= 0) { c.dashing = false; b.speed = b.baseSpeed; }
            } else {
                c.dashCooldown--;
                if (c.dashCooldown <= 0) {
                    c.dashCooldown = 120 + Math.floor(Math.random() * 60);
                    c.dashing = true; c.dashTimer = 25;
                    const dx = player.x - bossPos.x; const dz = player.z - bossPos.z;
                    const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                    c.dashVelX = (dx / dist) * 1.2; c.dashVelZ = (dz / dist) * 1.2;
                }
            }
            break;
        }
        case 5: {
            if (b.phase >= 2 && !c.p2Entered) {
                c.p2Entered = true;
                b.mesh.traverse(child => {
                    if (child.userData.emitterSide !== undefined) {
                        const idx = child.userData.emitterSide;
                        if (!c.emitterMeshes) c.emitterMeshes = [null, null];
                        c.emitterMeshes[idx] = child;
                    }
                });
            }
            if (b.phase === 3 && c.emittersDestroyed >= 2) {
                c.broadsideCooldown--;
                if (c.broadsideCooldown <= 0) {
                    c.broadsideCooldown = 300;
                    const z = bossPos.z;
                    for (let i = -4; i <= 4; i++) {
                        if (i === -1 || i === 0) continue;
                        createEnemyBullet(bossPos.x + i * 4.5, bossPos.y, z, player.x + i * 4.5, player.y, player.z, 0.5);
                    }
                    playEnemyShootSound();
                }
            }
            break;
        }
        case 6: {
            c.circleAngle += 0.008;
            b.mesh.position.x = Math.cos(c.circleAngle) * 18;
            b.mesh.position.z = 50 + Math.sin(c.circleAngle * 0.7) * 12;
            const beamDx = Math.abs(player.x - bossPos.x);
            if (beamDx < 8) player.velocityX += (bossPos.x - player.x) * 0.004;
            break;
        }
        case 7: {
            c.cloakTimer--;
            if (c.cloakState === 'visible' && c.cloakTimer <= 0) {
                c.cloakState = 'fading'; c.cloakTimer = 30; c.cloakFade = 0;
            } else if (c.cloakState === 'fading') {
                c.cloakFade++;
                const t = c.cloakFade / 30;
                b.mesh.traverse(child => {
                    if (child.material && child.material.transparent) child.material.opacity = (1 - t) * (child.userData.isBossShield ? 0.9 : 0.4) + t * 0.05;
                });
                if (c.cloakFade >= 30) { c.cloakState = 'cloaked'; c.cloakTimer = 60; b.speed = b.baseSpeed * 2; }
            } else if (c.cloakState === 'cloaked') {
                if (c.cloakTimer % 30 === 0) b.direction *= -1;
                c.cloakTimer--;
                if (c.cloakTimer <= 0) { c.cloakState = 'appearing'; c.cloakTimer = 30; c.cloakFade = 0; b.speed = b.baseSpeed; }
            } else if (c.cloakState === 'appearing') {
                c.cloakFade++;
                const t = c.cloakFade / 30;
                b.mesh.traverse(child => {
                    if (child.material && child.material.transparent) child.material.opacity = t * (child.userData.isBossShield ? 0.9 : 0.4) + (1-t) * 0.05;
                });
                if (c.cloakFade >= 30) {
                    c.cloakState = 'visible'; c.cloakTimer = 180 + Math.floor(Math.random() * 80);
                    for (let s = -2; s <= 2; s++) {
                        createEnemyBullet(bossPos.x, bossPos.y, bossPos.z, player.x + s * 4, player.y, player.z, 0.45);
                    }
                    playEnemyShootSound();
                }
            }
            break;
        }
        case 8: {
            b.mesh.position.x = 0;
            b.mesh.position.z = Math.max(b.mesh.position.z, 45);
            b.mesh.traverse(child => {
                if (!child.userData.isBossSatellite) return;
                const idx = child.userData.satIndex;
                if (!c.satAlive[idx]) return;
                child.userData.orbitAngle += 0.012;
                const a = child.userData.orbitAngle; const h = child.userData.orbitHeight;
                child.position.set(Math.cos(a) * 8, h, Math.sin(a) * 8);
                c.satFireTimers[idx]--;
                if (c.satFireTimers[idx] <= 0) {
                    c.satFireTimers[idx] = 90 + idx * 5;
                    const wp = new THREE.Vector3(); child.getWorldPosition(wp);
                    createEnemyBullet(wp.x, wp.y, wp.z, player.x, player.y, player.z, 0.38);
                    playEnemyShootSound();
                }
            });
            if (b.phase === 3 && !c.satRespawned) {
                c.satRespawned = true;
                c.satAlive.fill(true);
                b.mesh.traverse(child => { if (child.userData.isBossSatellite) child.visible = true; });
            }
            break;
        }
        case 9: {
            if (!c.split && b.health <= b.maxHealth * 0.5) {
                c.split = true;
                const halfGeo = new THREE.OctahedronGeometry(2.5, 0);
                const halfMat = new THREE.MeshStandardMaterial({ color: 0x550088, emissive: 0x330055, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2 });
                const halfMesh = new THREE.Mesh(halfGeo, halfMat);
                halfMesh.position.set(bossPos.x + 6, bossPos.y, bossPos.z);
                scene.add(halfMesh);
                c.halfB = { mesh: halfMesh, hp: Math.floor(b.health / 2), maxHp: Math.floor(b.maxHealth / 2), fireTimer: 750, dir: 1, angle: 0 };
                b.health = Math.floor(b.health / 2);
                updateBossHealthBar();
            }
            if (c.split && c.halfB && c.halfB.hp > 0) {
                c.halfBAngle += 0.02;
                const r = 8;
                c.halfB.mesh.position.x = bossPos.x + Math.cos(c.halfBAngle) * r;
                c.halfB.mesh.position.z = bossPos.z + Math.sin(c.halfBAngle) * r * 0.5;
                c.halfB.mesh.rotation.y += 0.03;
                c.halfB.fireTimer -= dt;
                if (c.halfB.fireTimer <= 0) {
                    c.halfB.fireTimer = c.halfBHp > 0 ? 833 : 500;
                    const hp = c.halfB.mesh.position;
                    createEnemyBullet(hp.x, hp.y, hp.z, player.x, player.y, player.z, 0.38);
                    playEnemyShootSound();
                }
                for (let i = bullets.length - 1; i >= 0; i--) {
                    const pb = bullets[i];
                    const dx = pb.mesh.position.x - c.halfB.mesh.position.x;
                    const dy = pb.mesh.position.y - c.halfB.mesh.position.y;
                    const dz = pb.mesh.position.z - c.halfB.mesh.position.z;
                    if (dx*dx + dy*dy + dz*dz < 9) {
                        c.halfB.hp -= pb.damage || 1;
                        scene.remove(pb.mesh);
                        bullets.splice(i, 1);
                        if (c.halfB.hp <= 0) {
                            scene.remove(c.halfB.mesh); disposeMesh(c.halfB.mesh);
                            c.halfB.hp = 0;
                            b.speed = b.baseSpeed * 2.5;
                            b.fireInterval = Math.max(Math.floor(b.fireInterval * 0.5), 167);
                        }
                        break;
                    }
                }
            }
            break;
        }
        case 10: {
            c.circleAngle += 0.006;
            b.mesh.position.x = Math.cos(c.circleAngle) * 16;
            b.mesh.position.z = 50 + Math.sin(c.circleAngle * 0.5) * 10;
            c.eggTimer--;
            if (c.eggTimer <= 0 && b.phase >= 2) {
                c.eggTimer = 280;
                for (let i = 0; i < 4; i++) {
                    const ex = (Math.random() - 0.5) * 40;
                    const eggGeo = new THREE.SphereGeometry(0.6, 8, 8);
                    const eggMat = new THREE.MeshStandardMaterial({ color: 0x88bb00, emissive: 0x446600, emissiveIntensity: 0.9 });
                    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
                    eggMesh.position.set(ex, -5, player.z - 5);
                    scene.add(eggMesh);
                    c.eggs.push({ mesh: eggMesh, life: 180 });
                }
            }
            for (let i = c.eggs.length - 1; i >= 0; i--) {
                const egg = c.eggs[i];
                egg.life--;
                if (egg.life <= 0) {
                    for (let s = 0; s < 6; s++) {
                        const a = (s / 6) * Math.PI * 2;
                        createEnemyBullet(egg.mesh.position.x, egg.mesh.position.y, egg.mesh.position.z,
                            egg.mesh.position.x + Math.cos(a) * 10, egg.mesh.position.y, egg.mesh.position.z + Math.sin(a) * 10, 0.3);
                    }
                    playEnemyShootSound();
                    scene.remove(egg.mesh); disposeMesh(egg.mesh); c.eggs.splice(i, 1);
                    continue;
                }
                for (let j = bullets.length - 1; j >= 0; j--) {
                    const pb = bullets[j];
                    const dx = pb.mesh.position.x - egg.mesh.position.x;
                    const dz = pb.mesh.position.z - egg.mesh.position.z;
                    if (dx*dx + dz*dz < 4) {
                        scene.remove(egg.mesh); disposeMesh(egg.mesh); c.eggs.splice(i, 1);
                        scene.remove(pb.mesh); bullets.splice(j, 1);
                        gameState.runtime.score += 50; updateScore();
                        break;
                    }
                }
            }
            break;
        }
        case 11: {
            if (!c.segmentsInit) {
                c.segmentsInit = true;
                const sizes = [2.5, 2.1, 1.8, 1.5, 1.2, 0.95, 0.75];
                for (let i = 0; i < sizes.length; i++) {
                    const sg = new THREE.SphereGeometry(sizes[i], 12, 12);
                    const sm = new THREE.MeshStandardMaterial({ color: 0x335544, emissive: 0x113322, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 });
                    const seg = new THREE.Mesh(sg, sm);
                    seg.position.set(bossPos.x, bossPos.y, bossPos.z + (i + 1) * 3);
                    scene.add(seg); c.segmentMeshes.push(seg);
                }
            }
            c.posHistory.unshift({ x: bossPos.x, y: bossPos.y, z: bossPos.z });
            if (c.posHistory.length > 80) c.posHistory.pop();
            for (let i = 0; i < c.segmentMeshes.length; i++) {
                const histIdx = Math.min((i + 1) * 10, c.posHistory.length - 1);
                if (histIdx < c.posHistory.length) {
                    const hp = c.posHistory[histIdx];
                    c.segmentMeshes[i].position.set(hp.x, hp.y, hp.z);
                }
                const dx = player.x - c.segmentMeshes[i].position.x;
                const dz = player.z - c.segmentMeshes[i].position.z;
                if (dx*dx + dz*dz < 6.25) damagePlayer();
            }
            break;
        }
        case 12: {
            c.teleportTimer--;
            if (c.teleportTimer <= 0 && !c.teleporting) {
                c.teleporting = true;
                b.mesh.visible = false;
                const newX = (Math.random() - 0.5) * 40;
                const bossRef = gameState.entities.boss;
                setTimeout(() => {
                    if (bossRef) { bossRef.mesh.position.x = newX; bossRef.mesh.visible = true; }
                    c.teleporting = false; c.teleportTimer = 150 + Math.floor(Math.random() * 100);
                }, 300);
            }
            c.mirrorTimer--;
            if (c.mirrorTimer <= 0) {
                c.mirrorTimer = 220 + Math.floor(Math.random() * 80);
                if (c.mirrorMesh) { scene.remove(c.mirrorMesh); disposeMesh(c.mirrorMesh); }
                const mGeo = new THREE.IcosahedronGeometry(3, 0);
                const mMat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, emissive: 0x9999cc, emissiveIntensity: 0.3, transparent: true, opacity: 0.35 });
                c.mirrorMesh = new THREE.Mesh(mGeo, mMat);
                c.mirrorMesh.position.set(-bossPos.x, bossPos.y, bossPos.z);
                scene.add(c.mirrorMesh);
            }
            if (c.mirrorMesh) {
                c.mirrorMesh.position.x = -bossPos.x;
                c.mirrorMesh.position.z = bossPos.z;
                c.mirrorMesh.rotation.y += 0.02;
            }
            break;
        }
        case 13: {
            const hpRatio = b.health / b.maxHealth;
            const thresholds = [0.75, 0.5, 0.25];
            for (let t = 0; t < thresholds.length; t++) {
                if (hpRatio <= thresholds[t] && c.rageTier <= t) {
                    c.rageTier = t + 1;
                    const speedMults = [0.5, 0.9, 1.8];
                    b.speed = b.baseSpeed * speedMults[t];
                    const fireRateMults = [0.85, 0.7, 0.5];
                    b.fireInterval = Math.max(Math.floor(b.baseFireInterval * fireRateMults[t]), 10);
                    const colors2 = [0xcc6600, 0xff4400, 0xff0000];
                    b.mesh.traverse(child => {
                        if (child.material && child.userData.isBossShield) child.material.color.setHex(colors2[t]);
                    });
                }
            }
            if (c.rageTier >= 3) {
                b.fireTimer--;
                if (b.fireTimer <= 0) {
                    b.fireTimer = b.fireInterval;
                    for (let d = 0; d < 8; d++) {
                        const a = (d / 8) * Math.PI * 2;
                        createEnemyBullet(bossPos.x, bossPos.y, bossPos.z,
                            bossPos.x + Math.cos(a) * 10, bossPos.y, bossPos.z + Math.sin(a) * 10, 0.4);
                    }
                    playEnemyShootSound();
                }
                return;
            }
            break;
        }
        case 14: {
            b.mesh.position.x = 0;
            b.mesh.position.z = Math.max(b.mesh.position.z, 48);
            c.barrierTimer--;
            if (c.barrierTimer <= 0) {
                c.barrierTimer = 260;
                const gapX = (Math.random() - 0.5) * 28;
                const barGeo = new THREE.BoxGeometry(8, 1.5, 0.6);
                const barMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x0088cc, emissiveIntensity: 0.8, transparent: true, opacity: 0.75 });
                const barL = new THREE.Mesh(barGeo, barMat.clone());
                const barR = new THREE.Mesh(barGeo, barMat.clone());
                barL.position.set(gapX - 7, -5, player.z - 3);
                barR.position.set(gapX + 7, -5, player.z - 3);
                scene.add(barL); scene.add(barR);
                c.barriers.push({ meshL: barL, meshR: barR, life: 150, gapX });
            }
            for (let i = c.barriers.length - 1; i >= 0; i--) {
                const bar = c.barriers[i];
                bar.life--;
                if (bar.life <= 0) {
                    scene.remove(bar.meshL); disposeMesh(bar.meshL);
                    scene.remove(bar.meshR); disposeMesh(bar.meshR);
                    c.barriers.splice(i, 1); continue;
                }
                const t = 1 - bar.life / 150;
                const slideOff = 20 * (1 - t);
                bar.meshL.position.x = bar.gapX - 4 - slideOff;
                bar.meshR.position.x = bar.gapX + 4 + slideOff;
                const px = player.x;
                const lRight = bar.meshL.position.x + 4;
                const rLeft  = bar.meshR.position.x - 4;
                const pz = player.z;
                const barZ = bar.meshL.position.z;
                if (Math.abs(pz - barZ) < 1.5 && (px < lRight || px > rLeft)) damagePlayer();
            }
            break;
        }
        case 15: {
            c.ghostPositions.push({ x: player.x, y: player.y, z: player.z });
            if (c.ghostPositions.length > 60) {
                const gp = c.ghostPositions.shift();
                if (!c.ghostMesh) {
                    const gg = new THREE.ConeGeometry(1.2, 4, 6);
                    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaaaff, emissiveIntensity: 0.8, transparent: true, opacity: 0.35 });
                    c.ghostMesh = new THREE.Mesh(gg, gm); scene.add(c.ghostMesh);
                }
                c.ghostMesh.position.set(gp.x, gp.y, gp.z);
                c.ghostTimer++;
                if (c.ghostTimer >= 60) {
                    c.ghostTimer = 0;
                    createEnemyBullet(gp.x, gp.y, gp.z, player.x, player.y, player.z, 0.35);
                    playEnemyShootSound();
                }
            }
            if (c.shieldTimer > 0) {
                c.shieldTimer--;
                b.mesh.traverse(child => {
                    if (child.userData.isBossShield) child.material.opacity = 0.6 + Math.sin(Date.now() * 0.02) * 0.2;
                });
            }
            break;
        }
        case 16: {
            c.flankerAngle += 0.012;
            b.mesh.traverse(child => {
                if (!child.userData.isWardanShield) return;
                const baseAngle = child.userData.orbitAngle;
                const a = baseAngle + c.flankerAngle;
                child.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 1.5);
            });
            break;
        }
        case 17: {
            c.discAngle += 0.005;
            b.mesh.rotation.y = c.discAngle;
            b.mesh.traverse(child => {
                if (!child.userData.isBossCannon) return;
                const idx = child.userData.cannonIndex;
                c.cannonTimers[idx]--;
                if (c.cannonTimers[idx] > 0) return;
                const wp = new THREE.Vector3(); child.getWorldPosition(wp);
                const dx = player.x - wp.x; const dz = player.z - wp.z;
                const angle = Math.atan2(dx, dz);
                const cannonWorldAngle = child.userData.orbitAngle + c.discAngle;
                const angleDiff = Math.abs(((angle - cannonWorldAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                if (angleDiff < 0.35) {
                    c.cannonTimers[idx] = 300;
                    createEnemyBullet(wp.x, wp.y, wp.z, player.x, player.y, player.z, 0.45);
                    playEnemyShootSound();
                }
            });
            break;
        }
        case 18: {
            const ry = ((b.mesh.rotation.y % Math.PI) + Math.PI) % Math.PI;
            c.faceOpen = ry < 0.22 || ry > Math.PI - 0.22;
            c.waveTimer++;
            if (c.waveTimer >= 150) {
                c.waveTimer = 0;
                spawnBossMinionWave(2, 'arc');
            }
            break;
        }
        case 19: {
            c.t += 0.012;
            b.mesh.position.x = Math.sin(c.t) * 20;
            b.mesh.position.z = 50 + Math.sin(c.t * 2) * 12;
            b.mesh.traverse(child => {
                if (child.userData.isChargeRing) {
                    child.material.opacity = Math.min(c.chargeLevel / 12, 1.0) * 0.8;
                }
            });
            if (c.chargeLevel >= 12) {
                c.chargeLevel = 0;
                c.overloadTimer = 1;
            }
            break;
        }
        case 20: {
            for (let i = c.gravityWells.length - 1; i >= 0; i--) {
                const gw = c.gravityWells[i];
                gw.life--;
                gw.mesh.position.x += gw.vx; gw.mesh.position.z += gw.vz;
                const pScale = 1 + Math.sin(Date.now() * 0.01) * 0.15;
                gw.mesh.scale.setScalar(pScale);
                if (gw.life <= 0) { scene.remove(gw.mesh); disposeMesh(gw.mesh); c.gravityWells.splice(i, 1); continue; }
                for (let j = bullets.length - 1; j >= 0; j--) {
                    const pb = bullets[j];
                    const dx = gw.mesh.position.x - pb.mesh.position.x;
                    const dz = gw.mesh.position.z - pb.mesh.position.z;
                    const d2 = dx*dx + dz*dz;
                    if (d2 < 49) {
                        if (d2 < 4) { scene.remove(pb.mesh); bullets.splice(j, 1); }
                        else {
                            pb.velocity = pb.velocity || new THREE.Vector3(0, 0, -0.5);
                            pb.velocity.x += dx * 0.015; pb.velocity.z += dz * 0.015;
                        }
                    }
                }
            }
            if (b.phase <= 2) {
                if (!c._gwTimer) c._gwTimer = 0;
                c._gwTimer++;
                if (c._gwTimer >= 200) {
                    c._gwTimer = 0;
                    for (let w = 0; w < 2; w++) {
                        const gwGeo = new THREE.SphereGeometry(1.2, 12, 12);
                        const gwMat = new THREE.MeshStandardMaterial({ color: 0x220033, emissive: 0x440055, emissiveIntensity: 0.8, transparent: true, opacity: 0.6 });
                        const gwMesh = new THREE.Mesh(gwGeo, gwMat);
                        gwMesh.position.set((Math.random() - 0.5) * 30, -5, player.z + (Math.random() - 0.5) * 10);
                        scene.add(gwMesh);
                        c.gravityWells.push({ mesh: gwMesh, life: 300, vx: (Math.random()-0.5)*0.05, vz: 0.04 });
                    }
                }
            }
            if (b.phase >= 2) {
                if (!c._ringTimer) c._ringTimer = 0;
                c._ringTimer++;
                if (c._ringTimer >= 180) {
                    c._ringTimer = 0;
                    const rwGeo = new THREE.TorusGeometry(0.5, 0.2, 8, 24);
                    const rwMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.75 });
                    const rwMesh = new THREE.Mesh(rwGeo, rwMat);
                    rwMesh.position.copy(bossPos); rwMesh.rotation.x = Math.PI / 2; scene.add(rwMesh);
                    c.ringWaves.push({ mesh: rwMesh, r: 0.5, life: 90 });
                }
            }
            for (let i = c.ringWaves.length - 1; i >= 0; i--) {
                const rw = c.ringWaves[i];
                rw.life--; rw.r += 0.45;
                rw.mesh.scale.setScalar(rw.r);
                rw.mesh.material.opacity = (rw.life / 90) * 0.75;
                if (rw.life <= 0) { scene.remove(rw.mesh); disposeMesh(rw.mesh); c.ringWaves.splice(i, 1); continue; }
                const dx = player.x - rw.mesh.position.x; const dz = player.z - rw.mesh.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (Math.abs(dist - rw.r) < 2.5) damagePlayer();
            }
            if (b.phase === 3) {
                if (!c.beamActive) {
                    if (!c._beamCooldown) c._beamCooldown = 0;
                    c._beamCooldown--;
                    if (c._beamCooldown <= 0) {
                        c._beamCooldown = 300;
                        c.beamActive = true; c.beamX = -22; c.beamDir = 1; c.beamTimer = 200;
                        if (scene.fog) { scene.fog._savedDensity = scene.fog.density; scene.fog.density = 0.025; }
                        c._beamMesh = new THREE.Mesh(
                            new THREE.BoxGeometry(3, 30, 0.8),
                            new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.6 })
                        );
                        scene.add(c._beamMesh);
                    }
                } else {
                    c.beamTimer--;
                    c.beamX += c.beamDir * 0.22;
                    if (c.beamX > 22 || c.beamX < -22) c.beamDir *= -1;
                    if (c._beamMesh) c._beamMesh.position.set(c.beamX, -5, player.z - 1);
                    if (Math.abs(player.x - c.beamX) < 2) damagePlayer();
                    if (c.beamTimer <= 0) {
                        c.beamActive = false;
                        if (c._beamMesh) { scene.remove(c._beamMesh); disposeMesh(c._beamMesh); c._beamMesh = null; }
                        if (scene.fog && scene.fog._savedDensity !== undefined) { scene.fog.density = scene.fog._savedDensity; }
                    }
                }
            }
            break;
        }
        default: break;
    }
}

export function updateBoss(dt) {
    const boss = gameState.entities.boss;
    if (!boss) return;
    const currentLevel = gameState.progression.currentLevel;

    if (boss.escaping) {
        boss.escapeTimer -= dt;
        boss.mesh.position.z += 0.8;
        boss.mesh.rotation.y += 0.05;
        const c = boss.cached;
        for (let i = 0; i < c.shields.length; i++) {
            c.shields[i].material.opacity = Math.max(0, c.shields[i].material.opacity - 0.01);
        }
        const scale = boss.mesh.scale.x * 0.995;
        boss.mesh.scale.set(scale, scale, scale);
        animateBossParts();
        if (boss.escapeTimer <= 0 || boss.mesh.position.z > 100) {
            finishBossEscape();
        }
        return;
    }

    if (boss.phaseTransitioning) {
        boss.phaseTransitionTimer -= dt;
        const pulseAlpha = Math.sin(boss.phaseTransitionTimer * 0.018) * 0.5 + 0.5;
        const c = boss.cached;
        for (let i = 0; i < c.shields.length; i++) {
            c.shields[i].material.opacity = 0.2 + pulseAlpha * 0.4;
        }
        if (boss.phaseTransitionTimer <= 0) {
            boss.phaseTransitioning = false;
            for (let i = 0; i < c.shields.length; i++) c.shields[i].material.opacity = 0.12;
        }
        boss.mesh.position.x += boss.speed * boss.direction * 0.3;
        if (boss.mesh.position.x > 25 || boss.mesh.position.x < -25) boss.direction *= -1;
        boss.mesh.rotation.y += 0.02;
        animateBossParts();
        return;
    }

    boss.mesh.position.x += boss.speed * boss.direction;
    if (boss.mesh.position.x > 25 || boss.mesh.position.x < -25) boss.direction *= -1;
    boss.mesh.position.z -= 0.04;

    const rotSpeed = 0.01 * boss.phase;
    boss.mesh.rotation.y += rotSpeed;
    boss.mesh.rotation.z = Math.sin(Date.now() * 0.001) * (0.1 * boss.phase);

    animateBossParts();

    if (boss.isFinale && boss.canSpawnMinions) {
        boss.minionSpawnTimer += dt;
        const interval = (boss.health / boss.maxHealth < 0.25)
            ? Math.round(boss.minionSpawnInterval * 0.8)
            : boss.minionSpawnInterval;
        if (boss.minionSpawnTimer >= interval && countActiveMinions() < 8) {
            boss.minionSpawnTimer = 0;
            const count = getMinionCount(currentLevel);
            spawnBossMinionWave(count, 'arc');
        }
    }

    updateBossCustomMechanics(boss);
    updateBossAttack(boss, dt);

    if (boss.mesh.position.z < -10) {
        gameState.runtime.lives = 0;
        updateLives();
    }
}

export function triggerBossPhaseTransition(newPhase) {
    const boss = gameState.entities.boss;
    if (!boss || boss.phaseTransitioning) return;

    boss.phase = newPhase;
    boss.phaseTransitioning = true;
    boss.phaseTransitionTimer = BOSS_PHASE_TRANSITION_MS;

    playBossPhaseSound();

    const enemyBullets = gameState.entities.enemyBullets;
    enemyBullets.forEach(b => { b.mesh.visible = false; });
    gameState.entities.enemyBullets = [];

    if (newPhase === 2) {
        boss.speed = boss.baseSpeed * 1.5;
        boss.fireInterval = Math.round(boss.baseFireInterval * 0.8);
        boss.burstShotsPerCycle = 3;
        boss.burstPauseMs = Math.round(boss.baseBurstPauseMs * 0.8);
    } else if (newPhase === 3) {
        boss.speed = boss.baseSpeed * 2.0;
        boss.fireInterval = Math.round(boss.baseFireInterval * 0.6);
        boss.burstShotsPerCycle = 4;
        boss.burstPauseMs = Math.round(boss.baseBurstPauseMs * 0.6);
    }

    boss.burstShotsRemaining = boss.burstShotsPerCycle;
    boss.fireTimer = 1000;

    const phaseColors = boss.actColors || ACT_BOSS_CONFIG[4];
    const flashColor = newPhase === 2 ? phaseColors.flashP2 : phaseColors.flashP3;
    const particles = gameState.entities.particles;

    const flashMaterial = new THREE.MeshBasicMaterial({ color: flashColor, transparent: true, opacity: 0.75 });
    const flashMesh = new THREE.Mesh(SHARED_GEO.bossFlash, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 12, isFlash: true });

    const ringMaterial = new THREE.MeshBasicMaterial({
        color: newPhase === 2 ? phaseColors.auraP2 : phaseColors.auraP3,
        transparent: true, opacity: 0.6
    });
    const ringMesh = new THREE.Mesh(SHARED_GEO.bossRing, ringMaterial);
    ringMesh.position.copy(boss.mesh.position);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({ mesh: ringMesh, velocity: new THREE.Vector3(0, 0, 0), life: 18, isShockwave: true, expandRate: 0.2 });

    const burstCount = newPhase === 3 ? 12 : 8;
    for (let i = 0; i < burstCount; i++) {
        const angle = (i / burstCount) * Math.PI * 2;
        const bMat = new THREE.MeshBasicMaterial({
            color: newPhase === 2 ? phaseColors.auraP2 : phaseColors.auraP3,
            transparent: true, opacity: 0.6
        });
        const bMesh = new THREE.Mesh(SHARED_GEO.bossParticle, bMat);
        bMesh.position.copy(boss.mesh.position);
        scene.add(bMesh);
        const speed = 0.25 + Math.random() * 0.2;
        particles.push({
            mesh: bMesh,
            velocity: new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.5) * speed * 0.3, Math.sin(angle) * speed),
            life: 18
        });
    }

    if (boss.canSpawnMinions) {
        const count = getMinionCount(currentLevel);
        if (count > 0) {
            const actLevel = getActLevel(currentLevel);
            if (newPhase === 2 && actLevel >= 3) spawnBossMinionWave(count, 'arc');
            else if (newPhase === 3 && actLevel >= 4) spawnBossMinionWave(count, 'arc');
        }
    }

    updateBossPhaseLabel();
    updateBossHealthBarColor();
}

export function checkBossPhaseTransition() {
    const boss = gameState.entities.boss;
    if (!boss || boss.phaseTransitioning) return;
    const healthRatio = boss.health / boss.maxHealth;
    if (boss.phase === 1 && healthRatio <= BOSS_PHASE_THRESHOLDS[0]) triggerBossPhaseTransition(2);
    else if (boss.phase === 2 && healthRatio <= BOSS_PHASE_THRESHOLDS[1]) triggerBossPhaseTransition(3);
}

export function checkBossCollision() {
    const boss = gameState.entities.boss;
    if (!boss) return;
    const bullets = gameState.entities.bullets;
    const currentLevel = gameState.progression.currentLevel;

    if (boss.phaseTransitioning) {
        const distance = player.mesh.position.distanceTo(boss.mesh.position);
        if (distance < 6 && !player.invulnerable) {
            gameState.runtime.lives = 0;
            updateLives();
        }
        return;
    }

    const bossPos = boss.mesh.position;

    for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = bullets[bIndex];
        const bulletPos = bullet.mesh.position;

        if (boss.level === 8) {
            let satHit = false;
            boss.mesh.traverse(child => {
                if (satHit || !child.userData.isBossSatellite) return;
                const idx = child.userData.satIndex;
                if (!boss.custom.satAlive[idx]) return;
                const wp = new THREE.Vector3();
                child.getWorldPosition(wp);
                const sdx = bulletPos.x - wp.x, sdy = bulletPos.y - wp.y, sdz = bulletPos.z - wp.z;
                if (sdx*sdx + sdy*sdy + sdz*sdz < 2.5) {
                    satHit = true;
                    boss.custom.satAlive[idx] = false;
                    child.visible = false;
                    scene.remove(bullet.mesh);
                    bullets.splice(bIndex, 1);
                    playBossHitSound();
                    gameState.runtime.score += 25; updateScore();
                }
            });
            if (satHit) continue;
        }

        if (boss.level === 5 && boss.phase >= 2) {
            let emHit = false;
            boss.mesh.traverse(child => {
                if (emHit || child.userData.emitterSide === undefined) return;
                const idx = child.userData.emitterSide;
                if (boss.custom.emitterHp[idx] <= 0) return;
                const wp = new THREE.Vector3();
                child.getWorldPosition(wp);
                const edx = bulletPos.x - wp.x, edy = bulletPos.y - wp.y, edz = bulletPos.z - wp.z;
                if (edx*edx + edy*edy + edz*edz < 3.5) {
                    emHit = true;
                    boss.custom.emitterHp[idx]--;
                    playBossHitSound();
                    if (boss.custom.emitterHp[idx] <= 0) {
                        boss.custom.emittersDestroyed++;
                        child.visible = false;
                    } else {
                        child.material.emissiveIntensity = boss.custom.emitterHp[idx] * 0.4 + 0.2;
                    }
                    if (!bullet.piercing) { scene.remove(bullet.mesh); bullets.splice(bIndex, 1); }
                }
            });
            if (emHit) continue;
        }

        const distance = bulletPos.distanceTo(bossPos);
        if (distance < 4.5) {
            playBossHitSound();
            if (!bullet.piercing) {
                scene.remove(bullet.mesh);
                bullets.splice(bIndex, 1);
            }

            if (boss.level === 18 && !boss.custom.faceOpen) continue;
            if (boss.level === 16) {
                const va = ((boss.custom.flankerAngle || 0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                if (!(va > Math.PI * 0.6 && va < Math.PI * 1.4)) continue;
            }
            if (boss.level === 19) {
                boss.custom.chargeLevel++;
                if (boss.custom.chargeLevel % 3 === 0 && boss.custom.chargeLevel < 12) {
                    const bp = boss.mesh.position;
                    for (let s = -2; s <= 2; s++) {
                        createEnemyBullet(bp.x, bp.y, bp.z, player.x + s * 4.5, player.y, player.z, 0.42);
                    }
                    playEnemyShootSound();
                }
                continue;
            }

            boss.health -= (bullet.damage || 1);
            updateBossHealthBar();

            const bossFlashParts = boss.cached.emissiveChildren;
            for (let fi = 0; fi < bossFlashParts.length; fi++) {
                const mat = bossFlashParts[fi].material;
                const originalIntensity = mat.emissiveIntensity;
                mat.emissiveIntensity = 2;
                setTimeout(() => { if (mat) mat.emissiveIntensity = originalIntensity; }, 100);
            }

            const shields = boss.cached.shields;
            for (let si = 0; si < shields.length; si++) {
                const shieldMat = shields[si].material;
                const origColor = shieldMat.color.getHex();
                const origOpacity = shieldMat.opacity;
                shieldMat.color.setHex(0xffffff);
                shieldMat.opacity = 0.5;
                setTimeout(() => {
                    if (shieldMat) { shieldMat.color.setHex(origColor); shieldMat.opacity = origOpacity; }
                }, 80);
            }

            if (!isMobile) {
                const impactMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
                const impactMesh = new THREE.Mesh(SHARED_GEO.bossMuzzleFlash, impactMat);
                impactMesh.position.copy(bulletPos);
                scene.add(impactMesh);
                gameState.entities.particles.push({ mesh: impactMesh, velocity: new THREE.Vector3(0, 0, 0), life: 6, isFlash: true });
            }

            if (boss.health <= 0) {
                if (boss.canEscape) { escapeBoss(); break; }
                else { defeatBoss(); break; }
            }

            if (boss.canEscape && !boss.escaping && (boss.health / boss.maxHealth) <= BOSS_ESCAPE_THRESHOLD) {
                escapeBoss(); break;
            }

            checkBossPhaseTransition();
            if (boss && boss.phaseTransitioning) break;
        }
    }

    if (!gameState.entities.boss) return;

    const distance = player.mesh.position.distanceTo(bossPos);
    if (distance < 6 && !player.invulnerable) {
        gameState.runtime.lives = 0;
        updateLives();
    }
}

export function cleanupBossCustom(b) {
    if (!b || !b.custom) return;
    const c = b.custom;
    const rm = (mesh) => { if (mesh) { scene.remove(mesh); disposeMesh(mesh); } };
    if (c.mines) { c.mines.forEach(m => rm(m.mesh)); c.mines = []; }
    if (c.halfB && c.halfB.mesh) { rm(c.halfB.mesh); c.halfB = null; }
    if (c.eggs) { c.eggs.forEach(e => rm(e.mesh)); c.eggs = []; }
    if (c.segmentMeshes) { c.segmentMeshes.forEach(s => rm(s)); c.segmentMeshes = []; }
    if (c.mirrorMesh) { rm(c.mirrorMesh); c.mirrorMesh = null; }
    if (c.barriers) { c.barriers.forEach(bar => { rm(bar.meshL); rm(bar.meshR); }); c.barriers = []; }
    if (c.ghostMesh) { rm(c.ghostMesh); c.ghostMesh = null; }
    if (c.gravityWells) { c.gravityWells.forEach(gw => rm(gw.mesh)); c.gravityWells = []; }
    if (c.ringWaves) { c.ringWaves.forEach(rw => rm(rw.mesh)); c.ringWaves = []; }
    if (c._beamMesh) { rm(c._beamMesh); c._beamMesh = null; }
    if (scene.fog && scene.fog._savedDensity !== undefined) {
        scene.fog.density = scene.fog._savedDensity;
        delete scene.fog._savedDensity;
    }
}

export function defeatBoss() {
    const boss = gameState.entities.boss;
    if (!boss) return;
    const currentLevel = gameState.progression.currentLevel;
    const { difficulty } = gameState.runtime;
    cleanupBossCustom(boss);

    if (boss.afterimages) {
        for (let i = boss.afterimages.length - 1; i >= 0; i--) {
            boss.afterimages[i].mesh.material.dispose();
            scene.remove(boss.afterimages[i].mesh);
        }
        boss.afterimages = [];
    }
    if (boss.exhaustParticles) {
        for (let i = boss.exhaustParticles.length - 1; i >= 0; i--) {
            boss.exhaustParticles[i].mesh.material.dispose();
            scene.remove(boss.exhaustParticles[i].mesh);
        }
        boss.exhaustParticles = [];
    }

    playExplosionSound();
    playLevelCompleteSound();

    const particles = gameState.entities.particles;
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const flashMesh = new THREE.Mesh(SHARED_GEO.bossFlash, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 10, isFlash: true });

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.7 });
    const ringMesh = new THREE.Mesh(SHARED_GEO.bossRing, ringMaterial);
    ringMesh.position.copy(boss.mesh.position);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({ mesh: ringMesh, velocity: new THREE.Vector3(0, 0, 0), life: 15, isShockwave: true, expandRate: 0.25 });

    const deathParticleCount = isMobile ? 25 : 40;
    for (let i = 0; i < deathParticleCount; i++) {
        const color = Math.random() > 0.4 ? 0xff0000 : 0xffff00;
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const particleMesh = new THREE.Mesh(SHARED_GEO.bossParticle, material);
        particleMesh.position.copy(boss.mesh.position);
        const speed = 0.2 + Math.random() * 0.4;
        scene.add(particleMesh);
        particles.push({
            mesh: particleMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed),
            life: 25 + Math.floor(Math.random() * 10)
        });
    }

    spawnPickup(player.x + 2.5, player.y, player.z + 15, true);

    boss.mesh.traverse((child) => { if (child.isLight && child.dispose) child.dispose(); });
    const bossDeathPos = boss.mesh.position.clone();
    disposeMesh(boss.mesh);
    scene.remove(boss.mesh);
    gameState.entities.boss = null;
    gameState.progression.bossActive = false;
    gameState.progression.levelTransitioning = true;

    const bullets = gameState.entities.bullets;
    bullets.forEach(b => { scene.remove(b.mesh); });
    gameState.entities.bullets = [];
    const enemyBullets = gameState.entities.enemyBullets;
    enemyBullets.forEach(b => { b.mesh.visible = false; });
    gameState.entities.enemyBullets = [];

    const enemies = gameState.entities.enemies;
    if (currentLevel === 3) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            disposeMesh(enemies[i].mesh);
            scene.remove(enemies[i].mesh);
        }
        gameState.entities.enemies = [];
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].isBossMinion) {
            disposeMesh(enemies[i].mesh);
            scene.remove(enemies[i].mesh);
            enemies.splice(i, 1);
        }
    }

    const bossHealthBar = document.getElementById('bossHealthBar');
    const bossHealthFill = document.getElementById('bossHealthFill');
    if (bossHealthBar) bossHealthBar.classList.add('hidden');
    if (bossHealthFill) bossHealthFill.className = 'health-bar-fill';

    const baseBonus = 500 + ((currentLevel - 1) * 250);
    const bonusMultiplier = difficultySettings[difficulty].bossBonusMultiplier;
    const levelBonus = Math.round(baseBonus * bonusMultiplier);
    gameState.runtime.score += levelBonus;
    updateScore();
    createScorePopup(bossDeathPos.x, bossDeathPos.y, bossDeathPos.z, levelBonus);

    gameState.runtime.targetsHit += 3;
    if (gameState.runtime.targetsHit >= 10 && gameState.runtime.lives < 3) {
        spawnExtraLifePickup(player.x - 2.5, player.y, player.z + 15);
        gameState.runtime.targetsHit = 0;
    }

    gameState.timers.bossPortalTimeout = setTimeout(() => {
        gameState.timers.bossPortalTimeout = null;
        if (!gameState.runtime.gameRunning) return;
        if (currentLevel >= 20) { triggerVictory(); return; }
        createPortal();
        animatePortalEntry();
    }, PORTAL_SPAWN_DELAY);
}

export function createMinionEnemy(x, y, z, vx, vz) {
    const currentLevel = gameState.progression.currentLevel;
    const act = getAct(currentLevel);
    const colors = [0xcc4444, 0x44cc66, 0x8888cc, 0x884466];
    const color = colors[(act - 1) % colors.length];

    const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3, transparent: true, opacity: 1.0
    });
    const minionGeo = new THREE.OctahedronGeometry(0.6, 1);
    const mesh = new THREE.Mesh(minionGeo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(1.2, 1.2, 1.2);

    const light = new THREE.PointLight(color, 2, 10);
    mesh.add(light);
    gameState.entities.enemyLights.push(light);
    scene.add(mesh);

    const minionHP = act >= 4 ? 2 : 1;
    const enemy = {
        mesh,
        speed: 0.3 + act * 0.05,
        type: 0,
        hp: minionHP,
        lateralSpeed: vx,
        lateralDirection: 1,
        waveOffset: 0,
        waveAmplitude: 0,
        fireTimer: act >= 3 ? (60 + Math.floor(Math.random() * 60)) : 99999,
        fireInterval: 99999,
        dashCooldown: 0,
        dashing: false,
        dashDuration: 0,
        dashTargetX: 0,
        isBossMinion: true,
        minionVelocityX: vx,
        minionVelocityZ: vz,
        cached: { rings: [], pulses: [], wings: [], weapons: [], spikes: [], armorPlates: [], turretTips: [], allMaterials: [{ material: mat }] }
    };

    gameState.entities.enemies.push(enemy);
    return enemy;
}

export function spawnBossMinionWave(count, pattern) {
    const boss = gameState.entities.boss;
    if (!boss) return;
    const bossPos = boss.mesh.position;

    if (pattern === 'arc') {
        const arcSpread = Math.PI * (count / 6);
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
            const angle = t * arcSpread;
            const spawnX = bossPos.x + Math.sin(angle) * 8;
            const spawnZ = bossPos.z - 3;
            const vx = Math.sin(angle) * 0.08;
            const vz = -0.15 - Math.random() * 0.05;
            createMinionEnemy(spawnX, bossPos.y, spawnZ, vx, vz);
        }
    } else if (pattern === 'distraction') {
        const midZ = (bossPos.z + player.z) / 2;
        const spread = 20;
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
            const spawnX = t * spread;
            const vz = -0.2 - Math.random() * 0.05;
            createMinionEnemy(spawnX, bossPos.y, midZ, 0, vz);
        }
    }
}

export function countActiveMinions() {
    const enemies = gameState.entities.enemies;
    let count = 0;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].isBossMinion && !enemies[i].dying) count++;
    }
    return count;
}

export function escapeBoss() {
    const boss = gameState.entities.boss;
    if (!boss) return;
    const currentLevel = gameState.progression.currentLevel;
    const { difficulty } = gameState.runtime;

    if (boss.afterimages) {
        boss.afterimages.forEach(ai => { ai.mesh.material.dispose(); scene.remove(ai.mesh); });
        boss.afterimages = [];
    }
    if (boss.exhaustParticles) {
        boss.exhaustParticles.forEach(ep => { ep.mesh.material.dispose(); scene.remove(ep.mesh); });
        boss.exhaustParticles = [];
    }

    playLevelCompleteSound();

    const particles = gameState.entities.particles;
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.5 });
    const flashMesh = new THREE.Mesh(SHARED_GEO.bossFlash, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 8, isFlash: true });

    const actLevel = getActLevel(currentLevel);
    if (actLevel >= 3 && countActiveMinions() === 0) {
        const count = getEscapeMinionCount(currentLevel);
        spawnBossMinionWave(count, 'distraction');
    }

    boss.escaping = true;
    boss.escapeTimer = 2000;
    boss.health = 1;
    boss.fireTimer = 99999;

    const enemyBullets = gameState.entities.enemyBullets;
    enemyBullets.forEach(b => { b.mesh.visible = false; });
    gameState.entities.enemyBullets = [];

    const baseBonus = 500 + ((currentLevel - 1) * 250);
    const bonusMultiplier = difficultySettings[difficulty].bossBonusMultiplier;
    const levelBonus = Math.round(baseBonus * bonusMultiplier * 0.6);
    gameState.runtime.score += levelBonus;
    updateScore();
    createScorePopup(boss.mesh.position.x, boss.mesh.position.y, boss.mesh.position.z, levelBonus);
}

export function finishBossEscape() {
    const boss = gameState.entities.boss;
    if (!boss) return;
    cleanupBossCustom(boss);

    const particles = gameState.entities.particles;
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const flashMesh = new THREE.Mesh(SHARED_GEO.bossFlash, flashMaterial);
    flashMesh.position.copy(boss.mesh.position);
    scene.add(flashMesh);
    particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 8, isFlash: true });

    boss.mesh.traverse((child) => { if (child.isLight && child.dispose) child.dispose(); });
    disposeMesh(boss.mesh);
    scene.remove(boss.mesh);
    gameState.entities.boss = null;
    gameState.progression.bossActive = false;
    gameState.progression.levelTransitioning = true;

    const bullets = gameState.entities.bullets;
    bullets.forEach(b => { scene.remove(b.mesh); });
    gameState.entities.bullets = [];
    const enemyBullets = gameState.entities.enemyBullets;
    enemyBullets.forEach(b => { b.mesh.visible = false; });
    gameState.entities.enemyBullets = [];

    const enemies = gameState.entities.enemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].isBossMinion) {
            disposeMesh(enemies[i].mesh);
            scene.remove(enemies[i].mesh);
            enemies.splice(i, 1);
        }
    }

    const bossHealthBar = document.getElementById('bossHealthBar');
    const bossHealthFill = document.getElementById('bossHealthFill');
    if (bossHealthBar) bossHealthBar.classList.add('hidden');
    if (bossHealthFill) bossHealthFill.className = 'health-bar-fill';

    spawnPickup(player.x + 2.5, player.y, player.z + 15, true);

    gameState.timers.bossPortalTimeout = setTimeout(() => {
        gameState.timers.bossPortalTimeout = null;
        if (!gameState.runtime.gameRunning) return;
        createPortal();
        animatePortalEntry();
    }, PORTAL_SPAWN_DELAY);
}

export function animateBossParts() {
    const boss = gameState.entities.boss;
    if (!boss || !boss.mesh) return;
    const c = boss.cached;
    const now = Date.now();
    const phase = boss.phase;
    const colors = boss.actColors || ACT_BOSS_CONFIG[4];

    const shieldRotMult = phase === 3 ? 3 : phase === 2 ? 2 : 1;
    const armorSpeedMult = phase === 3 ? 2.5 : phase === 2 ? 1.6 : 1;
    const pulseFreqMult = phase === 3 ? 3 : phase === 2 ? 2 : 1;
    const ringSpeedMult = phase === 3 ? 3 : phase === 2 ? 2 : 1;

    if (!boss.phaseTransitioning) {
        for (let i = 0; i < c.shields.length; i++) {
            c.shields[i].rotation.y += 0.005 * shieldRotMult;
            c.shields[i].rotation.x += 0.003 * shieldRotMult;
            const baseOpacity = phase === 3 ? 0.25 : phase === 2 ? 0.18 : 0.12;
            const pulseRange = phase === 3 ? 0.1 : phase === 2 ? 0.07 : 0.05;
            c.shields[i].material.opacity = baseOpacity + Math.sin(now * 0.002 * shieldRotMult) * pulseRange;
            if (phase === 3) c.shields[i].material.color.setHex(colors.auraP3);
            else if (phase === 2) c.shields[i].material.color.setHex(colors.auraP2);
        }
    }

    for (let i = 0; i < c.armor.length; i++) {
        const a = c.armor[i];
        a.userData.orbitAngle += a.userData.orbitSpeed * armorSpeedMult;
        a.position.x = Math.cos(a.userData.orbitAngle) * 2.8;
        a.position.z = Math.sin(a.userData.orbitAngle) * 2.8;
        a.rotation.y = a.userData.orbitAngle;
        if (phase === 3 && a.material.emissive) {
            a.material.emissiveIntensity = 0.6 + Math.sin(now * 0.01) * 0.2;
            a.material.emissive.setHex(colors.auraP3);
        } else if (phase === 2 && a.material.emissive) {
            a.material.emissiveIntensity = 0.4;
            a.material.emissive.setHex(colors.auraP2);
        }
    }

    for (let i = 0; i < c.rings.length; i++) {
        c.rings[i].rotation.z += c.rings[i].userData.rotationSpeed * ringSpeedMult;
    }

    for (let i = 0; i < c.pulses.length; i++) {
        const pulseScale = Math.sin(now * 0.006 * pulseFreqMult) * (0.12 * phase) + 1;
        c.pulses[i].scale.set(pulseScale, pulseScale, pulseScale);
    }

    if (phase >= 2) {
        for (let i = 0; i < c.emissiveChildren.length; i++) {
            const mat = c.emissiveChildren[i].material;
            if (mat.emissive) {
                const intensity = phase === 3 ? 1.2 + Math.sin(now * 0.008) * 0.4 : 0.9;
                mat.emissiveIntensity = intensity;
            }
        }
    }

    const auraSpeedMult = phase === 3 ? 2.5 : phase === 2 ? 1.7 : 1;
    for (let i = 0; i < c.aura.length; i++) {
        const a = c.aura[i];
        a.userData.orbitAngle += a.userData.orbitSpeed * auraSpeedMult;
        const r = a.userData.orbitRadius;
        const tilt = a.userData.orbitTilt;
        const angle = a.userData.orbitAngle;
        a.position.x = Math.cos(angle) * r;
        a.position.y = Math.sin(angle) * Math.sin(tilt) * r * 0.5;
        a.position.z = Math.sin(angle) * r;
        const opacityPulse = Math.sin(now * 0.008 + a.userData.phaseOffset) * 0.3 + 0.5;
        a.material.opacity = opacityPulse * (phase === 3 ? 1.0 : phase === 2 ? 0.8 : 0.6);
        if (phase === 3) a.material.color.setHex(colors.auraP3);
        else if (phase === 2) a.material.color.setHex(colors.auraP2);
        else a.material.color.setHex(colors.auraBase);
        const s = 0.8 + Math.sin(now * 0.01 + a.userData.phaseOffset) * 0.4;
        a.scale.set(s, s, s);
    }

    for (let i = 0; i < c.veins.length; i++) {
        const v = c.veins[i];
        const veinPulse = Math.sin(now * 0.005 * pulseFreqMult + v.userData.pulseOffset);
        const baseOp = phase === 3 ? 0.6 : phase === 2 ? 0.45 : 0.3;
        v.material.opacity = baseOp + veinPulse * 0.2;
        if (phase === 3) v.material.color.setHex(colors.veinP3);
        else if (phase === 2) v.material.color.setHex(colors.veinP2);
        else v.material.color.setHex(colors.veinBase);
        v.rotation.z += 0.002 * ringSpeedMult;
    }

    if (boss.cached.dynamicLights) {
        const lights = boss.cached.dynamicLights;
        const lightPulse = Math.sin(now * 0.004) * 0.3 + 0.7;
        if (phase === 3) {
            lights[0].color.setHex(colors.lightP3Base); lights[0].intensity = 6 * lightPulse; lights[0].distance = 35;
            lights[1].color.setHex(colors.lightP3Side); lights[1].intensity = 4 * lightPulse;
            lights[2].color.setHex(colors.lightP3Side); lights[2].intensity = 4 * lightPulse;
        } else if (phase === 2) {
            lights[0].color.setHex(colors.lightP2Base); lights[0].intensity = 5 * lightPulse; lights[0].distance = 30;
            lights[1].color.setHex(colors.lightP2Side); lights[1].intensity = 3 * lightPulse;
            lights[2].color.setHex(colors.lightP2Side); lights[2].intensity = 3 * lightPulse;
        } else {
            lights[0].intensity = 4 * lightPulse;
            lights[1].intensity = 2 * lightPulse;
            lights[2].intensity = 2 * lightPulse;
        }
    }

    boss.afterimageTimer++;
    const afterimageInterval = phase === 3 ? 2 : phase === 2 ? 4 : 6;
    if (boss.afterimageTimer >= afterimageInterval && !isMobile) {
        boss.afterimageTimer = 0;
        const afterMat = new THREE.MeshBasicMaterial({
            color: phase === 3 ? colors.afterimageP3 : phase === 2 ? colors.afterimageP2 : colors.afterimageBase,
            transparent: true,
            opacity: phase === 3 ? 0.25 : 0.15,
            wireframe: true
        });
        const afterMesh = new THREE.Mesh(SHARED_GEO.bossAfterimage, afterMat);
        afterMesh.position.copy(boss.mesh.position);
        afterMesh.rotation.copy(boss.mesh.rotation);
        afterMesh.scale.copy(boss.mesh.scale);
        scene.add(afterMesh);
        boss.afterimages.push({ mesh: afterMesh, life: phase === 3 ? 12 : 8 });
    }
    for (let i = boss.afterimages.length - 1; i >= 0; i--) {
        const ai = boss.afterimages[i];
        ai.life--;
        ai.mesh.material.opacity *= 0.85;
        ai.mesh.scale.multiplyScalar(1.01);
        if (ai.life <= 0) {
            ai.mesh.material.dispose();
            scene.remove(ai.mesh);
            boss.afterimages.splice(i, 1);
        }
    }

    if (!isMobile || boss.exhaustParticles.length < 8) {
        const exhaustCount = phase === 3 ? 3 : phase === 2 ? 2 : 1;
        for (let e = 0; e < exhaustCount; e++) {
            const exMat = new THREE.MeshBasicMaterial({
                color: phase === 3 ? 0xffcc00 : phase === 2 ? 0xff8800 : 0xff3300,
                transparent: true, opacity: 0.7
            });
            const exMesh = new THREE.Mesh(SHARED_GEO.bossExhaustParticle, exMat);
            exMesh.position.set(
                boss.mesh.position.x + (Math.random() - 0.5) * 6,
                boss.mesh.position.y + (Math.random() - 0.5) * 2,
                boss.mesh.position.z + 2 + Math.random() * 2
            );
            scene.add(exMesh);
            boss.exhaustParticles.push({
                mesh: exMesh,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.05, -0.02 - Math.random() * 0.03, 0.1 + Math.random() * 0.15),
                life: 20 + Math.floor(Math.random() * 15)
            });
        }
    }
    for (let i = boss.exhaustParticles.length - 1; i >= 0; i--) {
        const ep = boss.exhaustParticles[i];
        ep.mesh.position.add(ep.velocity);
        ep.life--;
        ep.mesh.material.opacity = (ep.life / 35) * 0.7;
        ep.mesh.scale.multiplyScalar(0.96);
        if (ep.life <= 0) {
            ep.mesh.material.dispose();
            scene.remove(ep.mesh);
            boss.exhaustParticles.splice(i, 1);
        }
    }

    const healthRatio = boss.health / boss.maxHealth;
    if (healthRatio < 0.8) {
        for (let i = 0; i < c.armor.length; i++) {
            const a = c.armor[i];
            if (a.material.emissive) {
                const damageLevel = 1 - healthRatio;
                const displacement = 2.8 + damageLevel * 1.2;
                a.position.x = Math.cos(a.userData.orbitAngle) * displacement;
                a.position.z = Math.sin(a.userData.orbitAngle) * displacement;
                if (phase === 1) {
                    const darkR = Math.max(0x10, 0x22 - Math.floor(damageLevel * 0x20));
                    a.material.color.setRGB(darkR / 255, 0, 0);
                    a.material.emissiveIntensity = Math.max(0.05, 0.25 - damageLevel * 0.3);
                }
                if (phase >= 2) a.position.y = Math.sin(now * 0.02 + i) * damageLevel * 0.3;
            }
        }
    }
}
