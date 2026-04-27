import { gameState, player, PICKUP_TYPES, PICKUP_COLORS, PICKUP_SYMBOLS, WEAPONS, disposeMesh } from '../state.js';
import { scene } from '../rendering/scene.js';
import { updateShieldVisuals } from './player.js';
import { updateWeaponHUD, updateShieldHUD, showWeaponText } from '../systems/hud.js';

export function createPickupGroup(type) {
    const color = PICKUP_COLORS[type];
    const symbol = PICKUP_SYMBOLS[type];
    const group = new THREE.Group();

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#' + color.toString(16).padStart(6, '0');
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(symbol, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const planeMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(6.25, 6.25), planeMat);
    group.add(plane);

    return group;
}

export function spawnPickup(x, y, z, weaponOnly) {
    const pool = weaponOnly ? ['spread'] : PICKUP_TYPES;
    const filtered = pool.length > 1 ? pool.filter(t => t !== gameState.weapon.lastDropType) : pool;
    const type = filtered[Math.floor(Math.random() * filtered.length)];
    gameState.weapon.lastDropType = type;

    const group = createPickupGroup(type);
    group.position.set(x, y, z);
    scene.add(group);
    gameState.entities.pickups.push({ mesh: group, type, life: 8000, speed: 0.3 });
}

export function spawnExtraLifePickup(x, y, z) {
    const group = createPickupGroup('extraLife');
    group.position.set(x, y, z);
    scene.add(group);
    gameState.entities.pickups.push({ mesh: group, type: 'extraLife', life: 8000, speed: 0.3 });
}

export function updatePickups(dt) {
    const pickups = gameState.entities.pickups;
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];

        pickup.mesh.rotation.y += 0.06;

        const dir = new THREE.Vector3().subVectors(player.mesh.position, pickup.mesh.position).normalize();
        pickup.mesh.position.add(dir.multiplyScalar(pickup.speed));

        const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.15;
        pickup.mesh.scale.set(pulse, pulse, pulse);

        const dist = player.mesh.position.distanceTo(pickup.mesh.position);
        if (dist < 3.0) {
            collectPickup(pickup);
            disposeMesh(pickup.mesh);
            scene.remove(pickup.mesh);
            pickups.splice(i, 1);
            continue;
        }

        pickup.life -= dt;
        if (pickup.life <= 0) {
            disposeMesh(pickup.mesh);
            scene.remove(pickup.mesh);
            pickups.splice(i, 1);
        }
    }
}

export function collectPickup(pickup) {
    switch (pickup.type) {
        case 'spread':
            player.weaponType = 'spread';
            gameState.weapon.weaponAmmo.spread += 20;
            showWeaponText(WEAPONS.spread.symbol + ' +20');
            updateWeaponHUD();
            break;
        case 'extraLife':
            if (gameState.runtime.lives < 3) {
                gameState.runtime.lives++;
                const livesEl = document.getElementById('lives');
                if (livesEl) livesEl.textContent = gameState.runtime.lives;
                showWeaponText('\u2665 +1');
            }
            break;
        case 'shield':
            if (player.shieldStrength < player.shieldMax) {
                player.shieldStrength++;
                updateShieldVisuals();
                updateShieldHUD();
                showWeaponText('SHIELD +1');
            }
            break;
    }
}
