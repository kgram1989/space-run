import { gameState } from '../state.js';
import { scene, enemyBulletPool } from '../rendering/scene.js';

export function createEnemyBullet(sourceX, sourceY, sourceZ, targetX, targetY, targetZ, speed) {
    const bulletMesh = enemyBulletPool.find(m => !m.visible);
    if (!bulletMesh) return;

    const direction = new THREE.Vector3(
        targetX - sourceX,
        targetY - sourceY,
        targetZ - sourceZ
    ).normalize();

    bulletMesh.position.set(sourceX, sourceY, sourceZ);
    bulletMesh.lookAt(targetX, targetY, targetZ);
    bulletMesh.visible = true;
    gameState.entities.enemyBullets.push({
        mesh: bulletMesh,
        velocity: direction.multiplyScalar(speed || 0.5),
        life: 300
    });
}

export function updateEnemyBullets() {
    const enemyBullets = gameState.entities.enemyBullets;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.mesh.position.add(bullet.velocity);
        bullet.life--;

        if (bullet.life <= 0 ||
            bullet.mesh.position.z < -30 ||
            bullet.mesh.position.z > 100 ||
            Math.abs(bullet.mesh.position.x) > 50 ||
            Math.abs(bullet.mesh.position.y) > 30) {
            bullet.mesh.visible = false;
            enemyBullets.splice(i, 1);
        }
    }
}
