// Per-arc boss visual and stat configuration
export const ACT_BOSS_CONFIG = {
    1: {
        name: 'VANGUARD',
        coreColor: 0x003388, coreEmissive: 0x001166,
        shieldColor: 0x002266, shieldEmissive: 0x001144,
        wireColor: 0x2255aa,
        weaponColor: 0x000a22, weaponEmissive: 0x002266,
        lanceEmissive: 0x001166, lanceTipColor: 0x66aaff,
        reactorOuter: 0x0055cc, reactorInner: 0xaaddff, reactorRing: 0x003388,
        glowColor: 0x001144,
        armorColor: 0x000a22, armorEmissive: 0x001144,
        auraBase: 0x0066ff, auraP2: 0x0099ff, auraP3: 0x00ccff,
        veinBase: 0x0044cc, veinP2: 0x0066ee, veinP3: 0x0099ff,
        lightBase: 0x000088, lightSide: 0x000066,
        lightP2Base: 0x0033aa, lightP3Base: 0x0055cc,
        lightP2Side: 0x002288, lightP3Side: 0x0033aa,
        afterimageBase: 0x001166, afterimageP2: 0x002288, afterimageP3: 0x003399,
        flashP2: 0x3388ff, flashP3: 0x0066ff,
        scale: 1.8, baseSpeed: 0.08, fireIntervalMult: 1.1
    },
    2: {
        name: 'RAVAGER',
        coreColor: 0x006622, coreEmissive: 0x003311,
        shieldColor: 0x004422, shieldEmissive: 0x002211,
        wireColor: 0x226644,
        weaponColor: 0x001100, weaponEmissive: 0x003322,
        lanceEmissive: 0x002211, lanceTipColor: 0x44ee77,
        reactorOuter: 0x008833, reactorInner: 0xaaffcc, reactorRing: 0x005522,
        glowColor: 0x002211,
        armorColor: 0x001100, armorEmissive: 0x002211,
        auraBase: 0x00cc44, auraP2: 0x00ee66, auraP3: 0x00ff99,
        veinBase: 0x00aa33, veinP2: 0x00cc44, veinP3: 0x00ee66,
        lightBase: 0x004400, lightSide: 0x002200,
        lightP2Base: 0x006600, lightP3Base: 0x009900,
        lightP2Side: 0x004400, lightP3Side: 0x006600,
        afterimageBase: 0x003300, afterimageP2: 0x005500, afterimageP3: 0x007700,
        flashP2: 0x33cc66, flashP3: 0x00ff44,
        scale: 1.9, baseSpeed: 0.10, fireIntervalMult: 1.0
    },
    3: {
        name: 'OVERLORD',
        coreColor: 0x440088, coreEmissive: 0x220044,
        shieldColor: 0x330066, shieldEmissive: 0x110033,
        wireColor: 0x554499,
        weaponColor: 0x0a0022, weaponEmissive: 0x220044,
        lanceEmissive: 0x110033, lanceTipColor: 0xbb66ff,
        reactorOuter: 0x5500aa, reactorInner: 0xddaaff, reactorRing: 0x330077,
        glowColor: 0x110022,
        armorColor: 0x0a0022, armorEmissive: 0x110033,
        auraBase: 0x7700ff, auraP2: 0xaa00ff, auraP3: 0xcc44ff,
        veinBase: 0x5500cc, veinP2: 0x7700dd, veinP3: 0xaa00ff,
        lightBase: 0x220044, lightSide: 0x110033,
        lightP2Base: 0x440088, lightP3Base: 0x6600bb,
        lightP2Side: 0x220055, lightP3Side: 0x330077,
        afterimageBase: 0x220044, afterimageP2: 0x440066, afterimageP3: 0x660099,
        flashP2: 0xaa44ff, flashP3: 0x8800ff,
        scale: 2.0, baseSpeed: 0.12, fireIntervalMult: 0.9
    },
    4: {
        name: 'THE CORE',
        coreColor: 0x8b0000, coreEmissive: 0x660000,
        shieldColor: 0x660000, shieldEmissive: 0x550000,
        wireColor: 0x992222,
        weaponColor: 0x1a0000, weaponEmissive: 0x880000,
        lanceEmissive: 0x770000, lanceTipColor: 0xcc6600,
        reactorOuter: 0xcc4400, reactorInner: 0xffccaa, reactorRing: 0x993300,
        glowColor: 0x660000,
        armorColor: 0x220000, armorEmissive: 0x550000,
        auraBase: 0xff4400, auraP2: 0xff6600, auraP3: 0xffaa00,
        veinBase: 0xff3300, veinP2: 0xff4400, veinP3: 0xff6600,
        lightBase: 0x880000, lightSide: 0x660000,
        lightP2Base: 0xcc4400, lightP3Base: 0xff4400,
        lightP2Side: 0xcc5500, lightP3Side: 0xff6600,
        afterimageBase: 0x880000, afterimageP2: 0xcc4400, afterimageP3: 0xff2200,
        flashP2: 0xff8800, flashP3: 0xff0000,
        scale: 2.0, baseSpeed: 0.15, fireIntervalMult: 0.85
    }
};

export const LEVEL_BOSS_NAMES = {
     1: 'THE PROBE',           2: 'THE GUNSHIP',         3: 'THE CARRIER',
     4: 'THE INTERCEPTOR CMD', 5: 'THE FLAGSHIP',        6: 'THE HARVESTER',
     7: 'THE STALKER',         8: 'THE TURRET GOD',      9: 'THE SPLIT',
    10: 'THE HIVE QUEEN',     11: 'THE LEVIATHAN',      12: 'THE PHANTOM',
    13: 'THE BERSERKER',      14: 'THE ARCHITECT',      15: 'THE MIND',
    16: 'THE WARDEN',         17: 'THE TITAN',          18: 'THE HARBINGER',
    19: 'THE EMISSARY',       20: 'THE GATE'
};

export const LEVEL_BOSS_STATS = {
     1: { baseSpeedMult: 2.2, fireIntervalMult: 2.0, scale: 1.5 },
     2: { baseSpeedMult: 0.9, fireIntervalMult: 1.0, scale: 1.8 },
     3: { baseSpeedMult: 0.5, fireIntervalMult: 999,  scale: 1.4 },
     4: { baseSpeedMult: 1.4, fireIntervalMult: 0.9, scale: 1.8 },
     5: { baseSpeedMult: 0.7, fireIntervalMult: 0.9, scale: 1.5 },
     6: { baseSpeedMult: 0.0, fireIntervalMult: 1.0, scale: 1.9 },
     7: { baseSpeedMult: 1.0, fireIntervalMult: 1.1, scale: 1.8 },
     8: { baseSpeedMult: 0.0, fireIntervalMult: 999,  scale: 1.4 },
     9: { baseSpeedMult: 0.9, fireIntervalMult: 1.0, scale: 1.9 },
    10: { baseSpeedMult: 0.0, fireIntervalMult: 0.9, scale: 1.4 },
    11: { baseSpeedMult: 0.7, fireIntervalMult: 1.1, scale: 1.8 },
    12: { baseSpeedMult: 1.0, fireIntervalMult: 1.0, scale: 2.0 },
    13: { baseSpeedMult: 0.3, fireIntervalMult: 2.0, scale: 2.0 },
    14: { baseSpeedMult: 0.0, fireIntervalMult: 0.9, scale: 2.0 },
    15: { baseSpeedMult: 0.3, fireIntervalMult: 0.8, scale: 1.6 },
    16: { baseSpeedMult: 0.3, fireIntervalMult: 0.9, scale: 1.8 },
    17: { baseSpeedMult: 0.0, fireIntervalMult: 999,  scale: 1.1 },
    18: { baseSpeedMult: 0.0, fireIntervalMult: 999,  scale: 1.2 },
    19: { baseSpeedMult: 0.0, fireIntervalMult: 999,  scale: 1.8 },
    20: { baseSpeedMult: 0.3, fireIntervalMult: 1.0, scale: 1.1 }
};

export function getAct(level) { return Math.ceil(level / 5); }
export function getActLevel(level) { return ((level - 1) % 5) + 1; }
export function isActFinale(level) { return [5, 10, 15, 20].indexOf(level) !== -1; }
export function getMinionCount(level) {
    const al = getActLevel(level);
    if (al < 3) return 0;
    return al;
}
export function getEscapeMinionCount(level) {
    return getAct(level) + 1;
}

export function getBossCustomState(level) {
    switch (level) {
        case 1:  return { trackingBullets: [] };
        case 2:  return { mines: [], mineDropTimer: 0 };
        case 3:  return { hangarTimer: 0 };
        case 4:  return { dashCooldown: 90, dashing: false, dashTimer: 0, dashVelX: 0, dashVelZ: 0 };
        case 5:  return { emitterHp: [3, 3], emittersDestroyed: 0, broadsideMode: false, broadsideCooldown: 0, p2Entered: false };
        case 6:  return { circleAngle: 0, beamTimer: 120 };
        case 7:  return { cloakState: 'visible', cloakTimer: 200, cloakFade: 0 };
        case 8:  return { satFireTimers: Array.from({length:8},(_,i)=>i*15), satAlive: Array(8).fill(true), satRespawned: false };
        case 9:  return { split: false, halfB: null, halfBAngle: 0, halfBHp: 0 };
        case 10: return { circleAngle: 0, eggs: [], eggTimer: 300 };
        case 11: return { posHistory: [], segmentMeshes: [], segmentsInit: false };
        case 12: return { teleportTimer: 100, teleporting: false, mirrorMesh: null, mirrorTimer: 200 };
        case 13: return { rageTier: 0 };
        case 14: return { barriers: [], barrierTimer: 220 };
        case 15: return { ghostMesh: null, ghostPositions: [], ghostTimer: 0, shieldTimer: 0 };
        case 16: return { flankerAngle: 0 };
        case 17: return { cannonTimers: Array(12).fill(0), discAngle: 0 };
        case 18: return { waveTimer: 0, faceOpen: false };
        case 19: return { chargeLevel: 0, overloadTimer: 0, t: 0 };
        case 20: return { gravityWells: [], ringWaves: [], beamActive: false, beamX: -20, beamDir: 1, beamTimer: 0 };
        default: return {};
    }
}

// ─── Mesh Builders ───────────────────────────────────────────────────────────

function buildBossL1(group, cfg) {
    const discGeo = new THREE.TorusGeometry(3, 0.4, 8, 24);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xccccdd, emissive: 0x556677, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.1 });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = Math.PI / 2;
    disc.userData.isRing = true; disc.userData.rotationSpeed = 0.015;
    group.add(disc);
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 6, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, emissive: 0x334455, emissiveIntensity: 0.4, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const arm = new THREE.Mesh(armGeo, armMat.clone());
        arm.rotation.z = Math.PI / 2; arm.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3);
        group.add(arm);
        const tipGeo = new THREE.SphereGeometry(0.2, 6, 6);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00cccc, emissiveIntensity: 1.5 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5);
        tip.userData.isPulse = true; group.add(tip);
    }
    const coreGeo = new THREE.SphereGeometry(1.0, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc, emissive: 0x334455, emissiveIntensity: 0.5, metalness: 1.0, roughness: 0.0 });
    group.add(new THREE.Mesh(coreGeo, coreMat));
}

function buildBossL2(group, cfg) {
    const hullGeo = new THREE.BoxGeometry(6, 1.5, 3);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x112233, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 });
    group.add(new THREE.Mesh(hullGeo, hullMat));
    const strutGeo = new THREE.CylinderGeometry(0.13, 0.13, 5, 6);
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x334455, emissive: 0x112233, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3 });
    [[5,0,0,Math.PI/2,0],[-5,0,0,Math.PI/2,0],[0,0,4,0,0],[0,0,-4,0,0]].forEach(([x,y,z,rz]) => {
        const s = new THREE.Mesh(strutGeo, strutMat.clone());
        s.position.set(x,y,z); s.rotation.z = rz; group.add(s);
    });
    const thrustGeo = new THREE.SphereGeometry(0.6, 8, 8);
    for (let i = -1; i <= 1; i += 2) {
        const t = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 });
        const m = new THREE.Mesh(thrustGeo, t);
        m.position.set(i * 1.4, 0, -2.5); m.userData.isPulse = true; group.add(m);
    }
}

function buildBossL3(group, cfg) {
    const hullGeo = new THREE.BoxGeometry(12, 2, 5);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x445566, emissive: 0x223344, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3 });
    group.add(new THREE.Mesh(hullGeo, hullMat));
    [-4, 0, 4].forEach((x, i) => {
        const bayGeo = new THREE.BoxGeometry(2.5, 0.5, 3.5);
        const bayMat = new THREE.MeshStandardMaterial({ color: 0x004466, emissive: 0x0088aa, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.position.set(x, -1.3, 0); bay.userData.isHangar = true; bay.userData.hangarIndex = i;
        group.add(bay);
    });
    const bridgeGeo = new THREE.BoxGeometry(2.5, 1.5, 2);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x556677, emissive: 0x334455, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(0, 1.75, -1); group.add(bridge);
}

function buildBossL4(group, cfg) {
    const bodyGeo = new THREE.ConeGeometry(2.5, 9, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x002244, emissive: 0x003366, emissiveIntensity: 0.5, metalness: 1.0, roughness: 0.05 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = -Math.PI / 2; body.userData.isBossShield = true; group.add(body);
    const wingGeo = new THREE.CylinderGeometry(0.1, 0.6, 5, 6);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x002244, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.1 });
    [[3.5, 0, 2.5, 0.5], [-3.5, 0, 2.5, -0.5]].forEach(([x,y,z,rz]) => {
        const w = new THREE.Mesh(wingGeo, wingMat.clone());
        w.position.set(x,y,z); w.rotation.z = rz; group.add(w);
    });
    const engGeo = new THREE.SphereGeometry(0.7, 8, 8);
    for (let i = -1; i <= 1; i += 2) {
        const m = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0066ff, emissiveIntensity: 2.0, transparent: true, opacity: 0.85 });
        const e = new THREE.Mesh(engGeo, m);
        e.position.set(i * 1.2, 0, 3.5); e.userData.isPulse = true; group.add(e);
    }
}

function buildBossL5(group, cfg) {
    [[14,1.5,-0.8],[10,1.2,0],[6,1.0,0.8]].forEach(([w,h,y]) => {
        const geo = new THREE.BoxGeometry(w, h, 5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x112244, emissive: 0x112244, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.1 });
        const m = new THREE.Mesh(geo, mat); m.position.y = y; group.add(m);
    });
    const turrGeo = new THREE.CylinderGeometry(0.6, 0.8, 1.5, 8);
    const turrMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, emissive: 0x886600, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.1 });
    [-5, 0, 5].forEach((tx) => {
        for (let side = -1; side <= 1; side += 2) {
            const t = new THREE.Mesh(turrGeo, turrMat.clone());
            t.position.set(tx, 1.5, side * 3); t.userData.isBossCannon = true; group.add(t);
        }
    });
    const emitterGeo = new THREE.SphereGeometry(0.9, 12, 12);
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0055ff, emissiveIntensity: 1.5 });
    for (let i = -1; i <= 1; i += 2) {
        const em = new THREE.Mesh(emitterGeo, emitterMat.clone());
        em.position.set(i * 8, 0.5, 0); em.userData.isShieldEmitter = true;
        em.userData.emitterIndex = i > 0 ? 1 : 0; em.userData.isPulse = true; group.add(em);
    }
}

function buildBossL6(group, cfg) {
    const coreGeo = new THREE.IcosahedronGeometry(3, 1);
    const coreMat = new THREE.MeshStandardMaterial({ color: cfg.coreColor, emissive: cfg.coreEmissive, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.4 });
    group.add(new THREE.Mesh(coreGeo, coreMat));
    const pulseGeo = new THREE.SphereGeometry(1.5, 12, 12);
    const pulseMat = new THREE.MeshStandardMaterial({ color: cfg.reactorInner, emissive: cfg.reactorInner, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat); pulse.userData.isPulse = true; group.add(pulse);
    const armGeo = new THREE.CylinderGeometry(0.15, 0.5, 6, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: cfg.weaponColor, emissive: cfg.weaponEmissive, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.5 });
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const arm = new THREE.Mesh(armGeo, armMat.clone());
        arm.position.set(Math.cos(a) * 4, -1, Math.sin(a) * 4);
        arm.rotation.z = Math.cos(a) * 0.5; arm.rotation.x = Math.sin(a) * 0.5; group.add(arm);
    }
}

function buildBossL7(group, cfg) {
    const bodyGeo = new THREE.IcosahedronGeometry(3, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x110011, emissiveIntensity: 0.15, metalness: 1.0, roughness: 0.0, transparent: true, opacity: 1.0 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.userData.isBossShield = true; group.add(body);
    const wireGeo = new THREE.IcosahedronGeometry(3.1, 0);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x222244, wireframe: true, transparent: true, opacity: 0.4 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.userData.isBossShield = true; group.add(wire);
    const eyeGeo = new THREE.SphereGeometry(0.7, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.userData.isPulse = true; group.add(eye);
}

function buildBossL8(group, cfg) {
    const coreGeo = new THREE.IcosahedronGeometry(4, 2);
    const coreMat = new THREE.MeshStandardMaterial({ color: cfg.coreColor, emissive: cfg.coreEmissive, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.1 });
    group.add(new THREE.Mesh(coreGeo, coreMat));
    const ringGeo = new THREE.TorusGeometry(2, 0.2, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: cfg.reactorRing, emissive: cfg.reactorRing, emissiveIntensity: 1.0 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData.isRing = true; ring.userData.rotationSpeed = 0.025; group.add(ring);
    const satGeo = new THREE.SphereGeometry(0.6, 8, 8);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2; const h = Math.sin(i * 0.8) * 2;
        const satMat = new THREE.MeshStandardMaterial({ color: 0xcc2200, emissive: 0xff0000, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 });
        const sat = new THREE.Mesh(satGeo, satMat);
        sat.position.set(Math.cos(a) * 8, h, Math.sin(a) * 8);
        sat.userData.isBossSatellite = true; sat.userData.satIndex = i;
        sat.userData.orbitAngle = a; sat.userData.orbitHeight = h; group.add(sat);
    }
}

function buildBossL9(group, cfg) {
    const coreGeo = new THREE.OctahedronGeometry(4.5, 0);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x330055, emissive: 0x220033, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 });
    group.add(new THREE.Mesh(coreGeo, coreMat));
    const innerGeo = new THREE.SphereGeometry(2, 16, 16);
    const innerMat = new THREE.MeshStandardMaterial({ color: cfg.reactorInner, emissive: cfg.reactorInner, emissiveIntensity: 1.0, transparent: true, opacity: 0.6 });
    const inner = new THREE.Mesh(innerGeo, innerMat); inner.userData.isPulse = true; group.add(inner);
    const crackGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.5, 4);
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x9900ff, transparent: true, opacity: 0.4 });
    for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(crackGeo, crackMat.clone());
        c.rotation.z = (i / 6) * Math.PI; c.rotation.x = (i / 6) * Math.PI * 0.5; group.add(c);
    }
}

function buildBossL10(group, cfg) {
    const bodyGeo = new THREE.SphereGeometry(5, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc8800, emissive: 0x885500, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.2, 0.9, 1.1); body.userData.isBossShield = true; group.add(body);
    const reactGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const reactMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.0, transparent: true, opacity: 0.5 });
    const react = new THREE.Mesh(reactGeo, reactMat); react.userData.isPulse = true; group.add(react);
    const podGeo = new THREE.SphereGeometry(0.5, 8, 8);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const podMat = new THREE.MeshStandardMaterial({ color: 0xaacc00, emissive: 0x667700, emissiveIntensity: 0.7 });
        const pod = new THREE.Mesh(podGeo, podMat);
        pod.position.set(Math.cos(a) * 7, Math.sin(i * 0.7) * 2, Math.sin(a) * 7);
        pod.userData.isBossAura = true; pod.userData.orbitAngle = a; pod.userData.orbitRadius = 7;
        pod.userData.orbitSpeed = 0.008; pod.userData.orbitTilt = Math.sin(i * 0.7) * 0.3;
        pod.userData.phaseOffset = i * 0.5; group.add(pod);
    }
}

function buildBossL11(group, cfg) {
    const headGeo = new THREE.SphereGeometry(3, 20, 20);
    const headMat = new THREE.MeshStandardMaterial({ color: cfg.coreColor, emissive: cfg.coreEmissive, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat); head.userData.isBossShield = true; group.add(head);
    const crestGeo = new THREE.ConeGeometry(0.5, 2, 4);
    const crestMat = new THREE.MeshStandardMaterial({ color: cfg.reactorRing, emissive: cfg.reactorRing, emissiveIntensity: 1.0 });
    [-1.5, 0, 1.5].forEach(x => {
        const c = new THREE.Mesh(crestGeo, crestMat.clone()); c.position.set(x, 3.2, 0); group.add(c);
    });
    const eyeGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 2.0 });
    [-1.2, 1.2].forEach(ex => {
        const e = new THREE.Mesh(eyeGeo, eyeMat.clone()); e.position.set(ex, 0.5, -2.5); e.userData.isPulse = true; group.add(e);
    });
}

function buildBossL12(group, cfg) {
    [[3,1.5,0.25],[1.5,2.5,0.3],[0,3,0.3],[-1.5,2.5,0.25],[-3,1.5,0.2],[-4.5,0.8,0.15]].forEach(([y,r,tube], i) => {
        const rGeo = new THREE.TorusGeometry(r, tube, 6, 12);
        const rMat = new THREE.MeshStandardMaterial({ color: 0xeeeeff, emissive: 0x9999cc, emissiveIntensity: 0.5, transparent: true, opacity: 0.65, metalness: 0.1, roughness: 0.9 });
        const ring = new THREE.Mesh(rGeo, rMat);
        ring.position.y = y; ring.rotation.x = 0.1 * i;
        ring.userData.isRing = true; ring.userData.rotationSpeed = i % 2 === 0 ? 0.015 : -0.012;
        ring.userData.isBossShield = true; group.add(ring);
    });
}

function buildBossL13(group, cfg) {
    const coreGeo = new THREE.IcosahedronGeometry(3, 0);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0x222222, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.1 });
    const core = new THREE.Mesh(coreGeo, coreMat); core.userData.isBossShield = true; group.add(core);
    const spikeGeo = new THREE.ConeGeometry(0.4, 2.5, 5);
    [[3.5,0,0],[-3.5,0,0],[0,3.5,0],[0,-3.5,0],[2.5,2.5,0],[-2.5,2.5,0],[2.5,-2.5,0],[0,0,3.5]].forEach(pos => {
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x111111, emissiveIntensity: 0.2, metalness: 0.95, roughness: 0.05 });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(...pos); spike.lookAt(0, 0, 0); spike.rotateX(Math.PI); group.add(spike);
    });
}

function buildBossL14(group, cfg) {
    const coreGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x006688, emissive: 0x003344, emissiveIntensity: 0.5, metalness: 0.95, roughness: 0.05 });
    group.add(new THREE.Mesh(coreGeo, coreMat));
    const wireGeo = new THREE.BoxGeometry(4.3, 4.3, 4.3);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.25 });
    group.add(new THREE.Mesh(wireGeo, wireMat));
    [[0,0.02],[Math.PI/2,-0.015]].forEach(([rx, rs]) => {
        const rGeo = new THREE.TorusGeometry(3.5, 0.12, 8, 32);
        const rMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 1.2 });
        const r = new THREE.Mesh(rGeo, rMat);
        r.rotation.x = rx; r.userData.isRing = true; r.userData.rotationSpeed = rs; group.add(r);
    });
}

function buildBossL15(group, cfg) {
    const coreGeo = new THREE.SphereGeometry(4, 64, 64);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2, metalness: 0.0, roughness: 0.0 });
    const core = new THREE.Mesh(coreGeo, coreMat); core.userData.isBossShield = true; group.add(core);
    const debrisGeos = [new THREE.OctahedronGeometry(0.5,0), new THREE.BoxGeometry(0.6,0.6,0.6), new THREE.IcosahedronGeometry(0.5,0)];
    for (let i = 0; i < 12; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaff, emissive: 0x5555cc, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.5 });
        const d = new THREE.Mesh(debrisGeos[i % 3], mat); const a = (i / 12) * Math.PI * 2; const tilt = (i % 3) * 0.4;
        d.position.set(Math.cos(a) * 7, Math.sin(tilt) * 2.5, Math.sin(a) * 7);
        d.userData.isBossAura = true; d.userData.orbitAngle = a; d.userData.orbitRadius = 7;
        d.userData.orbitSpeed = 0.005 + (i % 3) * 0.002; d.userData.orbitTilt = tilt; d.userData.phaseOffset = i * 0.4;
        group.add(d);
    }
}

function buildBossL16(group, cfg) {
    const monolithGeo = new THREE.BoxGeometry(2, 10, 2);
    const monolithMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x441100, emissiveIntensity: 0.4, metalness: 1.0, roughness: 0.0 });
    group.add(new THREE.Mesh(monolithGeo, monolithMat));
    const runeGeo = new THREE.BoxGeometry(1.8, 0.08, 0.1);
    const runeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.5 });
    for (let i = -3; i <= 3; i++) {
        const r = new THREE.Mesh(runeGeo, runeMat.clone()); r.position.set(0, i * 1.4, -1.05); r.userData.isPulse = true; group.add(r);
    }
    const flankerGeo = new THREE.BoxGeometry(1.5, 6, 1.5);
    const flankerMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x330000, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.1 });
    for (let i = -1; i <= 1; i += 2) {
        const f = new THREE.Mesh(flankerGeo, flankerMat.clone());
        f.position.set(i * 6, 0, 0); f.userData.isWardanShield = true;
        f.userData.orbitAngle = i > 0 ? 0 : Math.PI; f.userData.orbitRadius = 6; group.add(f);
    }
}

function buildBossL17(group, cfg) {
    const discGeo = new THREE.CylinderGeometry(12, 12, 1.5, 36);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xaa4400, emissive: 0x772200, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
    group.add(new THREE.Mesh(discGeo, discMat));
    const reactGeo = new THREE.CylinderGeometry(2, 2, 2.5, 16);
    const reactMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1.0 });
    const react = new THREE.Mesh(reactGeo, reactMat); react.userData.isPulse = true; group.add(react);
    const cannonGeo = new THREE.CylinderGeometry(0.6, 0.8, 2.5, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0xcc3300, emissive: 0x880000, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.1 });
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const c = new THREE.Mesh(cannonGeo, cannonMat.clone());
        c.position.set(Math.cos(a) * 9, 2, Math.sin(a) * 9);
        c.userData.isBossCannon = true; c.userData.cannonIndex = i; c.userData.orbitAngle = a; group.add(c);
    }
}

function buildBossL18(group, cfg) {
    const torusGeo = new THREE.TorusGeometry(8, 1.5, 12, 48);
    const torusMat = new THREE.MeshStandardMaterial({ color: 0x330055, emissive: 0x220033, emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.userData.isRing = true; torus.userData.rotationSpeed = 0.004; group.add(torus);
    const voidGeo = new THREE.SphereGeometry(5, 24, 24);
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x220033, transparent: true, opacity: 0.4 });
    const voidS = new THREE.Mesh(voidGeo, voidMat); voidS.userData.isPulse = true; group.add(voidS);
    const rodGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 6);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x9900cc, emissive: 0x660099, emissiveIntensity: 1.0 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rod = new THREE.Mesh(rodGeo, rodMat.clone());
        rod.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7); rod.rotation.z = Math.PI / 2;
        rod.userData.isBossAura = true; rod.userData.orbitAngle = a; rod.userData.orbitRadius = 7;
        rod.userData.orbitSpeed = 0.003; rod.userData.orbitTilt = 0; rod.userData.phaseOffset = i * 0.3;
        group.add(rod);
    }
}

function buildBossL19(group, cfg) {
    const torsoGeo = new THREE.OctahedronGeometry(2.2, 0);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, emissive: 0xaa7700, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.1 });
    group.add(new THREE.Mesh(torsoGeo, torsoMat));
    const headGeo = new THREE.IcosahedronGeometry(1.2, 0);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xeebb00, emissive: 0xcc8800, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 });
    const head = new THREE.Mesh(headGeo, headMat); head.position.y = 3.5; head.userData.isPulse = true; group.add(head);
    const armGeo = new THREE.ConeGeometry(0.4, 5.5, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, emissive: 0x886600, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 });
    for (let i = -1; i <= 1; i += 2) {
        const arm = new THREE.Mesh(armGeo, armMat.clone()); arm.position.set(i * 4, 0, 0); arm.rotation.z = i * 0.6; group.add(arm);
    }
    const chargeGeo = new THREE.TorusGeometry(2.8, 0.15, 8, 24);
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.0 });
    const chargeRing = new THREE.Mesh(chargeGeo, chargeMat);
    chargeRing.userData.isChargeRing = true; group.add(chargeRing);
}

function buildBossL20(group, cfg) {
    const torusGeo = new THREE.TorusGeometry(10, 2, 16, 48);
    const torusMat = new THREE.MeshStandardMaterial({ color: cfg.coreColor, emissive: cfg.coreEmissive, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.1 });
    const torus = new THREE.Mesh(torusGeo, torusMat); torus.userData.isRing = true; torus.userData.rotationSpeed = 0.008; group.add(torus);
    const voidGeo = new THREE.SphereGeometry(5, 32, 32);
    const voidMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x440000, emissiveIntensity: 0.5, transparent: true, opacity: 0.85, metalness: 0.0, roughness: 1.0 });
    const voidS = new THREE.Mesh(voidGeo, voidMat); voidS.userData.isBossShield = true; voidS.userData.isPulse = true; group.add(voidS);
    const outerGeo = new THREE.TorusGeometry(12.5, 0.4, 8, 48);
    const outerMat = new THREE.MeshStandardMaterial({ color: cfg.reactorRing, emissive: cfg.reactorRing, emissiveIntensity: 0.8 });
    const outer = new THREE.Mesh(outerGeo, outerMat); outer.userData.isRing = true; outer.userData.rotationSpeed = -0.005; group.add(outer);
    const spikeGeo = new THREE.ConeGeometry(0.6, 3, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: cfg.weaponColor, emissive: cfg.weaponEmissive, emissiveIntensity: 0.8, metalness: 0.95, roughness: 0.05 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, spikeMat.clone());
        spike.position.set(Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0);
        spike.lookAt(0, 0, 0); spike.rotateX(Math.PI / 2);
        spike.userData.isBossAura = true; spike.userData.orbitAngle = a; spike.userData.orbitRadius = 12.5;
        spike.userData.orbitSpeed = 0.004; spike.userData.orbitTilt = 0; spike.userData.phaseOffset = i * 0.3;
        group.add(spike);
    }
}

export function buildBossMesh(level, group, cfg) {
    const builders = {
         1: buildBossL1,   2: buildBossL2,   3: buildBossL3,   4: buildBossL4,   5: buildBossL5,
         6: buildBossL6,   7: buildBossL7,   8: buildBossL8,   9: buildBossL9,  10: buildBossL10,
        11: buildBossL11, 12: buildBossL12, 13: buildBossL13, 14: buildBossL14, 15: buildBossL15,
        16: buildBossL16, 17: buildBossL17, 18: buildBossL18, 19: buildBossL19, 20: buildBossL20
    };
    (builders[level] || buildBossL1)(group, cfg);
}
