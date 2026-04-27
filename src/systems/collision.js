import { gameState, player, difficultySettings, ENEMY_TYPE_POINTS, disposeMesh } from '../state.js';
import { scene } from '../rendering/scene.js';
import { createExplosion } from '../rendering/effects.js';
import { updateScore, updateLives, createScorePopup, triggerDamageFlash } from '../systems/hud.js';
import { damageShield } from '../entities/player.js';
import { spawnPickup, spawnExtraLifePickup } from '../entities/pickup.js';

class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    _key(x, z) {
        return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
    }

    insert(obj, x, z) {
        const key = this._key(x, z);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(obj);
    }

    query(x, z, rangeX, rangeZ) {
        const results = [];
        const x0 = Math.floor((x - rangeX) / this.cellSize);
        const x1 = Math.floor((x + rangeX) / this.cellSize);
        const z0 = Math.floor((z - rangeZ) / this.cellSize);
        const z1 = Math.floor((z + rangeZ) / this.cellSize);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cz = z0; cz <= z1; cz++) {
                const key = `${cx},${cz}`;
                const cell = this.cells.get(key);
                if (cell) for (const obj of cell) results.push(obj);
            }
        }
        return results;
    }

    clear() {
        this.cells.clear();
    }
}

const grid = new SpatialGrid(8);

export function checkCollisions() {
    const { enemies, bullets, particles } = gameState.entities;
    const { difficulty } = gameState.runtime;
    const currentLevel = gameState.progression.currentLevel;
    const settings = difficultySettings[difficulty];

    grid.clear();
    for (let i = 0; i < enemies.length; i++) {
        if (!enemies[i].dying) {
            grid.insert(enemies[i], enemies[i].mesh.position.x, enemies[i].mesh.position.z);
        }
    }

    for (let bIndex = bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = bullets[bIndex];
        const bulletPos = bullet.mesh.position;

        const nearby = grid.query(bulletPos.x, bulletPos.z, 5, 5);
        let bulletRemoved = false;

        for (let ni = nearby.length - 1; ni >= 0; ni--) {
            const enemy = nearby[ni];
            if (enemy.dying) continue;
            const enemyPos = enemy.mesh.position;

            const zDiff = Math.abs(bulletPos.z - enemyPos.z);
            if (zDiff > 3) continue;

            const dx = Math.abs(bulletPos.x - enemyPos.x);
            const dy = Math.abs(bulletPos.y - enemyPos.y);
            const yTolerance = 2.5;
            const xHitRadius = enemy.type === 2 ? 2.0 : 1.5;

            if (dy < yTolerance && dx < xHitRadius) {
                if (!bullet.piercing) {
                    scene.remove(bullet.mesh);
                    bullets.splice(bIndex, 1);
                    bulletRemoved = true;
                }

                enemy.hp--;

                const flashParts = enemy.cached.allMaterials;
                for (let fi = 0; fi < flashParts.length; fi++) {
                    const mat = flashParts[fi].material;
                    if (mat && mat.emissive) {
                        const orig = mat.emissiveIntensity;
                        mat.emissiveIntensity = 2.0;
                        setTimeout(() => { if (mat) mat.emissiveIntensity = orig; }, 100);
                    }
                }

                if (enemy.hp > 0) {
                    if (!bullet.piercing) break;
                    continue;
                }

                createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
                enemy.dying = true;
                enemy.deathTimer = 20;
                enemy.deathSpin = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3
                );

                const pointMult = enemy.isBossMinion ? 0.25 : 1;
                const addedPoints = Math.round(
                    settings.enemyPoints * (ENEMY_TYPE_POINTS[enemy.type] || 1) * currentLevel * pointMult
                );
                gameState.runtime.score += addedPoints;
                updateScore();
                createScorePopup(enemyPos.x, enemyPos.y, enemyPos.z, addedPoints);

                if (!enemy.isBossMinion) gameState.progression.enemiesDefeatedThisLevel++;

                gameState.runtime.targetsHit++;
                if (gameState.runtime.targetsHit >= 10 && gameState.runtime.lives < 3) {
                    spawnExtraLifePickup(enemyPos.x, enemyPos.y, enemyPos.z);
                    gameState.runtime.targetsHit = 0;
                } else if (Math.random() < 0.15) {
                    spawnPickup(enemyPos.x, enemyPos.y, enemyPos.z);
                }

                if (!bullet.piercing) break;
            }

            if (bulletRemoved) break;
        }
    }

    const playerPos = player.mesh.position;
    for (let index = enemies.length - 1; index >= 0; index--) {
        const enemy = enemies[index];
        if (enemy.dying) continue;
        const enemyPos = enemy.mesh.position;
        const distance = playerPos.distanceTo(enemyPos);

        if (distance < 2.5 && !player.invulnerable) {
            createExplosion(enemyPos.x, enemyPos.y, enemyPos.z);
            disposeMesh(enemy.mesh);
            scene.remove(enemy.mesh);
            enemies.splice(index, 1);

            if (player.shieldStrength > 0) {
                damageShield();
            } else {
                gameState.runtime.lives--;
                updateLives();
                triggerDamageFlash();
            }
            break;
        }
    }
}

export function checkEnemyBulletCollisions() {
    if (player.invulnerable || !player.mesh) return;

    const playerPos = player.mesh.position;
    const enemyBullets = gameState.entities.enemyBullets;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        const distance = playerPos.distanceTo(bullet.mesh.position);

        if (distance < 2.5) {
            bullet.mesh.visible = false;
            enemyBullets.splice(i, 1);

            if (player.shieldStrength > 0) {
                damageShield();
            } else {
                gameState.runtime.lives--;
                updateLives();
                triggerDamageFlash();
            }
            break;
        }
    }
}
