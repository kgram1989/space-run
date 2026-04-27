import { gameState, player, isMobile, difficultySettings, ENEMY_TYPE_POINTS, disposeMesh } from '../state.js';
import { scene } from '../rendering/scene.js';
import { createExplosion } from '../rendering/effects.js';
import { playEnemyShootSound } from '../systems/audio.js';
import { updateScore, updateLives, createScorePopup, triggerDamageFlash } from '../systems/hud.js';
import { createEnemyBullet } from './bullet.js';
import { spawnPickup, spawnExtraLifePickup } from './pickup.js';
import { damageShield } from './player.js';

export function createEnemy(type) {
    let mesh;
    const { difficulty } = gameState.runtime;
    const settings = difficultySettings[difficulty];
    const currentLevel = gameState.progression.currentLevel;
    const levelMultiplier = 1 + Math.sqrt(currentLevel - 1) * settings.scalingFactor;

    if (type === 0) {
        const group = new THREE.Group();

        const innerGeo = new THREE.SphereGeometry(0.7, 16, 16);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.userData.isPulse = true;
        group.add(inner);

        const coreGeo = new THREE.OctahedronGeometry(1.2, 2);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.8,
            metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.6
        });
        group.add(new THREE.Mesh(coreGeo, coreMat));

        const glowGeo = new THREE.SphereGeometry(1.5, 12, 12);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.08 });
        const coreGlow = new THREE.Mesh(glowGeo, glowMat);
        coreGlow.userData.isPulse = true;
        group.add(coreGlow);

        const ringGeo = new THREE.TorusGeometry(1.5, 0.12, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.6 });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.rotation.x = Math.PI / 2;
        ring1.userData.isRing = true;
        ring1.userData.rotationSpeed = 0.03;
        group.add(ring1);

        const ringInnerGeo = new THREE.TorusGeometry(1.5, 0.06, 8, 32);
        const ringInnerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
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

        const spikeGeo = new THREE.ConeGeometry(0.08, 0.6, 8);
        const spikeMat = new THREE.MeshStandardMaterial({
            color: 0xcc00cc, emissive: 0xff00ff, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.2
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

        const plateMat = new THREE.MeshStandardMaterial({
            color: 0x440044, emissive: 0xff00ff, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.3
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
        const group = new THREE.Group();

        const bodyGeo = new THREE.ConeGeometry(0.8, 2.5, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const cockpitGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const cockpitMat = new THREE.MeshStandardMaterial({
            color: 0x44ccff, emissive: 0x22aaff, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.7, metalness: 0.9, roughness: 0.1
        });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.scale.set(0.8, 0.5, 1.0);
        cockpit.position.set(0, 0.2, -1.0);
        group.add(cockpit);

        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x0066cc, emissive: 0x00aaff, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.3
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

        const finGeo = new THREE.BoxGeometry(0.06, 0.5, 0.4);
        const fin = new THREE.Mesh(finGeo, wingMat);
        fin.position.set(0, 0.3, 1.0);
        group.add(fin);

        const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12);
        const nozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333333, emissive: 0x00aaff, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.2
        });
        const engineGlowGeo = new THREE.SphereGeometry(0.18, 12, 12);
        const engineGlowMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.9 });
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

        const haloGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const haloMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.1 });
        [{ x: -0.6 }, { x: 0.6 }].forEach(pos => {
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(pos.x, 0, 1.3);
            halo.userData.isPulse = true;
            group.add(halo);
        });

        group.scale.set(0.8, 0.8, 0.8);
        group.userData.enginePositions = [{ x: -0.6, y: 0, z: 1.3 }, { x: 0.6, y: 0, z: 1.3 }];
        mesh = group;

    } else {
        const group = new THREE.Group();

        const hullGeo = new THREE.CylinderGeometry(2.2, 2.5, 0.8, 24);
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x556677, emissive: 0x334455, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.2
        });
        group.add(new THREE.Mesh(hullGeo, hullMat));

        const panelGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.3, 24);
        const panelMat = new THREE.MeshStandardMaterial({
            color: 0x445566, emissive: 0x334455, emissiveIntensity: 0.2, metalness: 0.9, roughness: 0.3
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.y = 0.4;
        group.add(panel);

        const domeGeo = new THREE.SphereGeometry(1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
            color: 0xffcc33, emissive: 0xffcc33, emissiveIntensity: 0.8,
            metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.7
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = -0.4;
        group.add(dome);

        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, -1.1, 0);
        group.add(antenna);
        const antTipGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const antTipMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.9 });
        const antTip = new THREE.Mesh(antTipGeo, antTipMat);
        antTip.position.set(0, -1.4, 0);
        antTip.userData.isPulse = true;
        group.add(antTip);

        const mountGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.2, 12);
        const mountMat = new THREE.MeshStandardMaterial({
            color: 0x333333, emissive: 0xffcc33, emissiveIntensity: 0.4, metalness: 0.9
        });
        const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
        const tipGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
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

        const reactorGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.25, 24);
        const reactorMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.9 });
        const reactor = new THREE.Mesh(reactorGeo, reactorMat);
        reactor.position.y = -0.3;
        reactor.userData.isPulse = true;
        group.add(reactor);

        const rGlowGeo = new THREE.SphereGeometry(1.2, 12, 12);
        const rGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.1 });
        const rGlow = new THREE.Mesh(rGlowGeo, rGlowMat);
        rGlow.position.y = -0.3;
        rGlow.userData.isPulse = true;
        group.add(rGlow);

        const engNozzleGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 10);
        const engNozzleMat = new THREE.MeshStandardMaterial({
            color: 0x333333, emissive: 0xffcc33, emissiveIntensity: 0.5, metalness: 0.9
        });
        const engGlowGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const engGlowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
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
            { x: -0.6, y: 0, z: 1.5 }, { x: 0, y: 0, z: 1.5 }, { x: 0.6, y: 0, z: 1.5 }
        ];
        mesh = group;
    }

    const baseSpeed = settings.enemySpeed.min + Math.random() * (settings.enemySpeed.max - settings.enemySpeed.min);

    const enemy = {
        mesh,
        speed: baseSpeed * levelMultiplier,
        type,
        hp: type === 2 ? 2 : 1,
        lateralSpeed: (Math.random() - 0.5) * 0.25 * levelMultiplier,
        lateralDirection: Math.random() < 0.5 ? -1 : 1,
        waveOffset: Math.random() * Math.PI * 2,
        waveAmplitude: 0.5 + Math.random() * 1.0,
        fireTimer: Math.floor(Math.random() * 2000) + 1000,
        fireInterval: settings.enemyFireInterval.min +
            Math.floor(Math.random() * (settings.enemyFireInterval.max - settings.enemyFireInterval.min)),
        dashCooldown: type === 1 ? (90 + Math.floor(Math.random() * 120)) : 0,
        dashing: false,
        dashDuration: 0,
        dashTargetX: 0
    };

    const x = (Math.random() - 0.5) * 30;
    const y = -5 + (Math.random() - 0.5) * 4;
    enemy.mesh.position.set(x, y, 70);
    enemy.mesh.castShadow = !isMobile;
    enemy.mesh.receiveShadow = !isMobile;

    const light = new THREE.PointLight(
        type === 0 ? 0xff00ff : type === 1 ? 0x00aaff : 0xffcc33, 3, 15
    );
    enemy.mesh.add(light);
    gameState.entities.enemyLights.push(light);

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
    gameState.entities.enemies.push(enemy);
}

export function animateEnemyParts(enemy) {
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

export function updateEnemies(dt) {
    const enemies = gameState.entities.enemies;
    const currentLevel = gameState.progression.currentLevel;
    const { difficulty } = gameState.runtime;
    const settings = difficultySettings[difficulty];

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        if (enemy.dying) {
            enemy.deathTimer--;
            enemy.mesh.rotation.x += enemy.deathSpin.x;
            enemy.mesh.rotation.y += enemy.deathSpin.y;
            enemy.mesh.rotation.z += enemy.deathSpin.z;
            enemy.mesh.position.z -= enemy.speed * 0.5;
            enemy.mesh.position.x += enemy.deathSpin.x * 2;
            enemy.mesh.position.y += enemy.deathSpin.y * 2;
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

        if (enemy.isBossMinion) {
            enemy.mesh.position.x += enemy.minionVelocityX;
            enemy.mesh.position.z += enemy.minionVelocityZ;
            enemy.mesh.rotation.y += 0.05;
            enemy.mesh.rotation.z += 0.03;
            if (enemy.mesh.position.z < -15) {
                disposeMesh(enemy.mesh);
                scene.remove(enemy.mesh);
                enemies.splice(i, 1);
            }
            continue;
        }

        enemy.mesh.position.z -= enemy.speed;

        enemy.waveOffset += 0.05;
        const waveX = Math.sin(enemy.waveOffset) * enemy.waveAmplitude;
        enemy.mesh.position.x += waveX * enemy.lateralSpeed;

        if (enemy.mesh.position.x > 30) {
            enemy.mesh.position.x = 30;
            enemy.waveOffset = Math.PI;
        }
        if (enemy.mesh.position.x < -30) {
            enemy.mesh.position.x = -30;
            enemy.waveOffset = 0;
        }

        if (enemy.type !== 1) enemy.mesh.rotation.y += 0.02;
        enemy.mesh.rotation.z = Math.sin(enemy.waveOffset) * 0.1;

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

        animateEnemyParts(enemy);

        if (enemy.mesh.position.z > player.z && enemy.mesh.position.z < 65) {
            enemy.fireTimer -= dt;

            if (enemy.fireTimer <= 250 && enemy.fireTimer > 0) {
                const chargeProgress = 1 - (enemy.fireTimer / 250);
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
                }
            }

            if (enemy.fireTimer <= 0) {
                const spd = 0.4 + (currentLevel - 1) * 0.02;
                if (enemy.type === 2) {
                    [-18, 0, 18].forEach(xOffset => {
                        createEnemyBullet(
                            enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z,
                            player.x + xOffset, player.y, player.z, spd * 0.85
                        );
                    });
                } else {
                    createEnemyBullet(
                        enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z,
                        player.x, player.y, player.z, spd
                    );
                }
                playEnemyShootSound();
                enemy.fireTimer = enemy.fireInterval;
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
            gameState.runtime.lives--;
            updateLives();
            triggerDamageFlash();
        }
    }
}
