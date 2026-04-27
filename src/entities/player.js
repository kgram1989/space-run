import { gameState, player, isMobile, WEAPONS, SHARED_GEO, SHARED_MAT, disposeMesh, lerp } from '../state.js';
import { scene, camera } from '../rendering/scene.js';
import { shakeCamera } from '../rendering/effects.js';
import { playShootSound, playShieldHitSound, playShieldBreakSound } from '../systems/audio.js';
import { updateWeaponHUD, updateShieldHUD, triggerDamageFlash } from '../systems/hud.js';

export function createPlayer() {
    const group = new THREE.Group();

    const bodyGeometry = new THREE.CylinderGeometry(0.6, 0.8, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, emissive: 0x444444, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const noseGeometry = new THREE.ConeGeometry(0.6, 1.8, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666, emissive: 0x333333, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.15
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 2.5;
    group.add(nose);

    const wingGeometry = new THREE.BoxGeometry(5, 0.2, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, emissive: 0x555555, emissiveIntensity: 0.2, metalness: 0.8, roughness: 0.3
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.z = -0.5;
    group.add(wings);

    const cockpitGeometry = new THREE.SphereGeometry(0.7, 12, 12);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff, emissive: 0x2244aa, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.7, metalness: 0.9, roughness: 0.1
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.scale.set(0.8, 0.7, 0.9);
    cockpit.position.z = 0.7;
    cockpit.position.y = 0.5;
    group.add(cockpit);

    const engineGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1, 6);
    const engineMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, emissive: 0xff4400, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3
    });

    const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    leftEngine.rotation.x = Math.PI / 2;
    leftEngine.position.set(-1.2, 0, -2);
    group.add(leftEngine);

    const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    rightEngine.rotation.x = Math.PI / 2;
    rightEngine.position.set(1.2, 0, -2);
    group.add(rightEngine);

    const glowGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.7 });

    const leftGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    leftGlow.position.set(-1.2, 0, -2.8);
    group.add(leftGlow);

    const rightGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    rightGlow.position.set(1.2, 0, -2.8);
    group.add(rightGlow);

    group.scale.set(1.0, 1.0, 1.0);

    player.mesh = group;
    player.wings = wings;
    player.leftEngine = leftGlow;
    player.rightEngine = rightGlow;
    player.mesh.castShadow = !isMobile;
    player.mesh.receiveShadow = !isMobile;
    scene.add(player.mesh);
}

export function createShieldMesh() {
    const shieldGroup = new THREE.Group();

    const shieldGeometry = new THREE.SphereGeometry(3.0, 24, 24);
    const shieldMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ccff, emissive: 0x0088ff, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.15, metalness: 0.9, roughness: 0.1, side: THREE.DoubleSide
    });
    shieldGroup.add(new THREE.Mesh(shieldGeometry, shieldMaterial));

    const innerGlowGeometry = new THREE.SphereGeometry(2.8, 16, 16);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.05 });
    shieldGroup.add(new THREE.Mesh(innerGlowGeometry, innerGlowMaterial));

    const wireGeometry = new THREE.IcosahedronGeometry(3.05, 1);
    const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.12 });
    shieldGroup.add(new THREE.Mesh(wireGeometry, wireMaterial));

    player.shieldMesh = shieldGroup;
    player.mesh.add(shieldGroup);
}

export function updateShield() {
    if (!player.shieldMesh) return;

    if (player.shieldStrength > 0) {
        const wireframe = player.shieldMesh.children[2];
        if (wireframe) {
            wireframe.rotation.y += 0.005;
            wireframe.rotation.x += 0.003;
        }
        const shieldSphere = player.shieldMesh.children[0];
        if (shieldSphere && shieldSphere.material) {
            const ratio = player.shieldStrength / player.shieldMax;
            const baseOpacity = 0.07 + ratio * 0.10;
            shieldSphere.material.opacity = Math.sin(Date.now() * 0.003) * 0.03 + baseOpacity;
        }
    }

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

export function updateShieldVisuals() {
    if (!player.shieldMesh) return;
    const sphere = player.shieldMesh.children[0];
    const wire   = player.shieldMesh.children[2];
    const ratio  = player.shieldStrength / player.shieldMax;

    if (sphere && sphere.material) {
        sphere.material.opacity = 0.07 + ratio * 0.10;
        sphere.material.color.setHex(ratio > 0.5 ? 0x00ccff : 0xff9900);
        sphere.material.emissive.setHex(ratio > 0.5 ? 0x0088ff : 0xff6600);
    }
    if (wire && wire.material) {
        wire.material.opacity = 0.06 + ratio * 0.08;
    }
    player.shieldMesh.visible = player.shieldStrength > 0;
}

export function restoreShield() {
    player.shieldStrength = player.shieldMax;
    updateShieldVisuals();
    updateShieldHUD();
    if (player.shieldMesh) player.shieldMesh.visible = true;
}

export function damagePlayer() {
    if (player.invulnerable) return;
    if (player.shieldStrength > 0) {
        damageShield();
    } else {
        gameState.runtime.lives--;
        import('../systems/hud.js').then(m => m.updateLives());
        triggerDamageFlash();
    }
}

export function damageShield() {
    player.shieldStrength--;
    updateShieldHUD();

    if (player.shieldStrength <= 0) {
        breakShield();
    } else {
        player.invulnerable = true;
        player.invulnerableTimer = 18;

        playShieldHitSound();
        shakeCamera(0.08);
        updateShieldVisuals();

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

export function breakShield() {
    player.shieldStrength = 0;
    player.invulnerable = true;
    player.invulnerableTimer = 60;

    playShieldBreakSound();
    shakeCamera(0.2);
    updateShieldVisuals();
    updateShieldHUD();

    if (player.shieldMesh) player.shieldMesh.visible = false;

    const px = player.x, py = player.y, pz = player.z;
    const particles = gameState.entities.particles;

    const ringGeometry = new THREE.TorusGeometry(1.0, 0.08, 8, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.position.set(px, py, pz);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    particles.push({ mesh: ringMesh, velocity: new THREE.Vector3(0, 0, 0), life: 15, isShockwave: true, expandRate: 0.25 });

    const flashGeometry = new THREE.SphereGeometry(2.0, 12, 12);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.8 });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.set(px, py, pz);
    scene.add(flashMesh);
    particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 8, isFlash: true });

    for (let i = 0; i < 15; i++) {
        const size = 0.08 + Math.random() * 0.12;
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        const material = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x00ffff : 0x0088ff });
        const particleMesh = new THREE.Mesh(geometry, material);
        particleMesh.position.set(px, py, pz);
        const speed = 0.2 + Math.random() * 0.4;
        scene.add(particleMesh);
        particles.push({
            mesh: particleMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed),
            life: 25
        });
    }
}

export function movePlayer() {
    const speedMultiplier = Math.min(2.0, 1 + (gameState.progression.currentLevel - 1) * 0.1);
    const currentAccel = player.acceleration * speedMultiplier;
    const currentMaxSpeed = player.maxSpeed * speedMultiplier;

    const keys = gameState.input.keys;
    const moveLeft = keys['ArrowLeft'];
    const moveRight = keys['ArrowRight'];
    const tiltAmount = gameState.input.tiltAmount;

    if (moveLeft) player.velocityX -= currentAccel;
    if (moveRight) player.velocityX += currentAccel;

    if (tiltAmount !== 0 && !moveLeft && !moveRight) {
        player.velocityX += tiltAmount * currentAccel;
        player.velocityX *= player.friction;
    } else if (tiltAmount === 0 && !moveLeft && !moveRight) {
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.01) player.velocityX = 0;
    }

    if (player.velocityX > currentMaxSpeed) player.velocityX = currentMaxSpeed;
    if (player.velocityX < -currentMaxSpeed) player.velocityX = -currentMaxSpeed;

    player.x -= player.velocityX;

    const playerWorld = new THREE.Vector3(0, player.y, player.z);
    const distToPlayer = camera.position.distanceTo(playerWorld);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(vFov / 2) * distToPlayer;
    const visibleWidth = visibleHeight * camera.aspect;
    const boundary = (visibleWidth / 2) * 0.9;

    if (player.x < -boundary) { player.x = -boundary; player.velocityX = 0; }
    if (player.x > boundary) { player.x = boundary; player.velocityX = 0; }

    if (player.mesh) {
        player.mesh.position.set(player.x, player.y, player.z);

        const targetRotation = -player.velocityX * 0.8;
        player.mesh.rotation.z = lerp(player.mesh.rotation.z, targetRotation, 0.15);

        if (player.wings) {
            const wingTilt = player.velocityX * 0.3;
            player.wings.rotation.x = lerp(player.wings.rotation.x, wingTilt, 0.1);
        }

        if (player.leftEngine && player.rightEngine) {
            const movementIntensity = Math.abs(player.velocityX) / player.maxSpeed;
            const baseIntensity = 0.8;
            const activeIntensity = baseIntensity + movementIntensity * 0.4;
            const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 1;

            if (player.leftEngine.material && player.leftEngine.material.emissiveIntensity !== undefined) {
                player.leftEngine.material.emissiveIntensity = activeIntensity * pulse;
            }
            if (player.rightEngine.material && player.rightEngine.material.emissiveIntensity !== undefined) {
                player.rightEngine.material.emissiveIntensity = activeIntensity * pulse;
            }

            const engineScale = 1 + movementIntensity * 0.2;
            player.leftEngine.scale.set(engineScale, engineScale, engineScale);
            player.rightEngine.scale.set(engineScale, engineScale, engineScale);
        }
    }
}

export function canShoot() {
    const now = Date.now();
    const weapon = WEAPONS[player.weaponType];
    if (now - gameState.weapon.lastShotTime < weapon.fireInterval) return false;
    gameState.weapon.lastShotTime = now;
    return true;
}

export function createBulletMesh(weapon, radius) {
    const geo = (radius <= 0.18) ? SHARED_GEO.bulletSpread : SHARED_GEO.bulletDefault;
    const mat = (radius <= 0.18) ? SHARED_MAT.bulletSpread : SHARED_MAT.bulletDefault;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
}

export function addBullet(mesh, weapon, velocity) {
    const bullet = {
        mesh,
        speed: velocity || weapon.bulletSpeed,
        damage: weapon.damage,
        piercing: weapon.piercing
    };
    gameState.entities.bullets.push(bullet);
    scene.add(mesh);
    return bullet;
}

export function shootBullet() {
    if (!canShoot()) return;

    if (player.weaponType !== 'default') {
        if (gameState.weapon.weaponAmmo[player.weaponType] <= 0) {
            player.weaponType = 'default';
            updateWeaponHUD();
        }
    }

    playShootSound();
    const weapon = WEAPONS[player.weaponType];

    if (player.weaponType === 'spread') {
        shootSpread(weapon);
    } else {
        shootDefault(weapon);
    }

    if (player.weaponType !== 'default') {
        gameState.weapon.weaponAmmo[player.weaponType]--;
        updateWeaponHUD();
        if (gameState.weapon.weaponAmmo[player.weaponType] <= 0) {
            player.weaponType = 'default';
            updateWeaponHUD();
        }
    }
}

export function shootDefault(weapon) {
    const positions = [{ x: 0, z: 4 }, { x: -1.8, z: 3.5 }, { x: 1.8, z: 3.5 }];
    positions.forEach(offset => {
        const mesh = createBulletMesh(weapon, 0.2);
        mesh.position.set(player.x + offset.x, player.y, player.z + offset.z);
        addBullet(mesh, weapon);
    });
}

export function shootSpread(weapon) {
    const shots = [
        { xOff: -1.0, angle: -0.06 },
        { xOff: -0.5, angle: -0.03 },
        { xOff:  0.0, angle:  0    },
        { xOff:  0.5, angle:  0.03 },
        { xOff:  1.0, angle:  0.06 }
    ];
    shots.forEach(s => {
        const mesh = createBulletMesh(weapon, 0.18);
        mesh.position.set(player.x + s.xOff, player.y, player.z + 4);
        const bullet = addBullet(mesh, weapon);
        bullet.velocityX = s.angle * weapon.bulletSpeed;
    });
}

export function updateBullets() {
    const bullets = gameState.entities.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.z += bullet.speed;

        if (bullet.velocityX) bullet.mesh.position.x += bullet.velocityX;

        if (bullet.mesh.position.z > 80 || Math.abs(bullet.mesh.position.x) > 50) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
        }
    }
}
