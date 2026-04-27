import { gameState, baseCameraPosition, baseCameraLookAt, SHARED_GEO, disposeMesh, easeInOutQuad, lerp, player } from '../state.js';
import { scene, camera, engineParticlePool, enemyEngineParticlePool } from './scene.js';
import { playExplosionSound } from '../systems/audio.js';

export function shakeCamera(intensity = 0.5) {
    gameState.effects.cameraShake.intensity = intensity;
}

export function updateCameraShake() {
    const { cameraShake, cinematicCamera } = gameState.effects;
    if (cinematicCamera.active) {
        updateCinematicCamera();
        return;
    }
    if (cameraShake.intensity > 0.01) {
        cameraShake.offsetX = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.offsetY = (Math.random() - 0.5) * cameraShake.intensity;
        cameraShake.offsetZ = (Math.random() - 0.5) * cameraShake.intensity * 0.5;
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
        cameraShake.intensity *= cameraShake.decay;
    } else {
        if (cameraShake.intensity > 0) {
            camera.position.set(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z);
            camera.lookAt(baseCameraLookAt.x, baseCameraLookAt.y, baseCameraLookAt.z);
            cameraShake.intensity = 0;
        }
    }
}

export function startCinematicCamera(type, target) {
    const cc = gameState.effects.cinematicCamera;
    cc.active = true;
    cc.type = type;
    cc.progress = 0;
    cc.startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    if (type === 'boss_defeat') {
        cc.duration = 90;
        cc.lookAtTarget = { x: target.x, y: target.y, z: target.z };
    } else if (type === 'portal_zoom') {
        cc.duration = 60;
        cc.targetPos = { x: 0, y: -2, z: 40 };
        cc.lookAtTarget = { x: 0, y: -5, z: 50 };
    }
}

export function updateCinematicCamera() {
    const cc = gameState.effects.cinematicCamera;
    if (!cc.active) return;
    cc.progress++;
    const t = cc.progress / cc.duration;
    const eased = easeInOutQuad(t);
    if (cc.type === 'boss_defeat') {
        const angle = t * Math.PI * 0.5;
        const radius = 25;
        const height = 10 + Math.sin(t * Math.PI) * 5;
        camera.position.set(
            cc.lookAtTarget.x + Math.cos(angle) * radius,
            cc.lookAtTarget.y + height,
            cc.lookAtTarget.z - Math.sin(angle) * radius
        );
        camera.lookAt(cc.lookAtTarget.x, cc.lookAtTarget.y, cc.lookAtTarget.z);
    } else if (cc.type === 'portal_zoom') {
        camera.position.set(
            lerp(cc.startPos.x, cc.targetPos.x, eased),
            lerp(cc.startPos.y, cc.targetPos.y, eased),
            lerp(cc.startPos.z, cc.targetPos.z, eased)
        );
        camera.lookAt(cc.lookAtTarget.x, cc.lookAtTarget.y, cc.lookAtTarget.z);
    }
    if (cc.progress >= cc.duration) {
        cc.active = false;
        camera.position.set(baseCameraPosition.x, baseCameraPosition.y, baseCameraPosition.z);
        camera.lookAt(baseCameraLookAt.x, baseCameraLookAt.y, baseCameraLookAt.z);
    }
}

export function createExplosion(x, y, z) {
    playExplosionSound();
    shakeCamera(0.15);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.9 });
    const flashMesh = new THREE.Mesh(SHARED_GEO.explosionFlash, flashMaterial);
    flashMesh.position.set(x, y, z);
    scene.add(flashMesh);
    gameState.entities.particles.push({ mesh: flashMesh, velocity: new THREE.Vector3(0, 0, 0), life: 7, isFlash: true });

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.7 });
    const ringMesh = new THREE.Mesh(SHARED_GEO.explosionRing, ringMaterial);
    ringMesh.position.set(x, y, z);
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
    gameState.entities.particles.push({ mesh: ringMesh, velocity: new THREE.Vector3(0, 0, 0), life: 12, isShockwave: true, expandRate: 0.3 });

    for (let i = 0; i < 20; i++) {
        const material = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff6600 : 0xffff00 });
        const particleMesh = new THREE.Mesh(SHARED_GEO.explosionParticle, material);
        particleMesh.position.set(x, y, z);
        const speed = 0.2 + Math.random() * 0.4;
        scene.add(particleMesh);
        gameState.entities.particles.push({
            mesh: particleMesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed),
            life: 20
        });
    }
}

export function updateParticles() {
    const particles = gameState.entities.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle.isFlash) {
            particle.life--;
            particle.mesh.material.opacity = particle.life / 8;
            particle.mesh.scale.multiplyScalar(1.2);
            if (particle.life <= 0) { disposeMesh(particle.mesh); scene.remove(particle.mesh); particles.splice(i, 1); }
            continue;
        }
        if (particle.isShockwave) {
            particle.life--;
            particle.mesh.scale.multiplyScalar(1 + particle.expandRate);
            particle.mesh.material.opacity = particle.life / 15;
            if (particle.life <= 0) { disposeMesh(particle.mesh); scene.remove(particle.mesh); particles.splice(i, 1); }
            continue;
        }
        particle.mesh.position.add(particle.velocity);
        particle.life--;
        particle.mesh.material.opacity = particle.life / 35;
        particle.mesh.material.transparent = true;
        particle.mesh.scale.multiplyScalar(0.97);
        if (particle.life <= 0) { disposeMesh(particle.mesh); scene.remove(particle.mesh); particles.splice(i, 1); }
    }
}

export function createEngineParticles() {
    if (!player.mesh || !gameRunning || gamePaused || portalAnimating) return;
    const enginePositions = [
        { x: -1.2, y: 0, z: -3 },
        { x: 1.2,  y: 0, z: -3 }
    ];
    enginePositions.forEach(offset => {
        const poolItem = engineParticlePool.find(p => !p.inUse);
        if (!poolItem) return;
        poolItem.inUse = true;
        poolItem.mesh.visible = true;
        poolItem.mesh.material.opacity = 0.8;
        poolItem.mesh.material.color.setHex(Math.random() > 0.3 ? 0xff6600 : 0xffaa00);
        poolItem.mesh.scale.set(1, 1, 1);
        poolItem.mesh.position.set(player.x + offset.x, player.y + offset.y, player.z + offset.z);
        gameState.entities.engineParticles.push({
            mesh: poolItem.mesh,
            poolItem,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, -0.4),
            life: 12
        });
    });
}

export function updateEngineParticles() {
    const engineParticles = gameState.entities.engineParticles;
    for (let i = engineParticles.length - 1; i >= 0; i--) {
        const particle = engineParticles[i];
        particle.mesh.position.add(particle.velocity);
        particle.life--;
        particle.mesh.material.opacity = particle.life / 12;
        particle.mesh.scale.multiplyScalar(0.95);
        if (particle.life <= 0) {
            particle.mesh.visible = false;
            if (particle.poolItem) particle.poolItem.inUse = false;
            else { disposeMesh(particle.mesh); scene.remove(particle.mesh); }
            engineParticles.splice(i, 1);
        }
    }
}

export function createEnemyEngineParticles() {
    const colors = { 0: [0xff00ff, 0xff66ff], 1: [0x00aaff, 0x66ccff], 2: [0xffcc33, 0xffdd66] };
    const enemies = gameState.entities.enemies;
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy.dying) continue;
        const positions = enemy.mesh.userData.enginePositions;
        if (!positions) continue;
        const typeColors = colors[enemy.type] || colors[0];
        const scale = enemy.type === 2 ? 0.7 : 0.8;
        positions.forEach(offset => {
            const poolItem = enemyEngineParticlePool.find(p => !p.inUse);
            if (!poolItem) return;
            const color = Math.random() > 0.4 ? typeColors[0] : typeColors[1];
            poolItem.inUse = true;
            poolItem.mesh.visible = true;
            poolItem.mesh.material.opacity = 0.7;
            poolItem.mesh.material.color.setHex(color);
            poolItem.mesh.scale.set(scale, scale, scale);
            const worldPos = new THREE.Vector3(offset.x * scale, offset.y * scale, offset.z * scale);
            worldPos.applyQuaternion(enemy.mesh.quaternion);
            worldPos.add(enemy.mesh.position);
            poolItem.mesh.position.copy(worldPos);
            gameState.entities.enemyEngineParticles.push({
                mesh: poolItem.mesh,
                poolItem,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, 0.25),
                life: 10
            });
        });
    }
}

export function updateEnemyEngineParticles() {
    const enemyEngineParticles = gameState.entities.enemyEngineParticles;
    for (let i = enemyEngineParticles.length - 1; i >= 0; i--) {
        const p = enemyEngineParticles[i];
        p.mesh.position.add(p.velocity);
        p.life--;
        p.mesh.material.opacity = (p.life / 10) * 0.7;
        p.mesh.scale.multiplyScalar(0.93);
        if (p.life <= 0) {
            p.mesh.visible = false;
            if (p.poolItem) p.poolItem.inUse = false;
            else { disposeMesh(p.mesh); scene.remove(p.mesh); }
            enemyEngineParticles.splice(i, 1);
        }
    }
}
