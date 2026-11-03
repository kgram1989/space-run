// Art style switch: 'neon' (original look) or 'toon' (cel-shaded).
//
// Toon mode is applied at runtime instead of rewriting every material in the
// game: each MeshStandardMaterial is swapped for a MeshToonMaterial with a
// 3-band ramp, opaque parts get an inverted-hull outline, and a fixed sky/key
// light, softer bloom and a brighter palette are switched on. The original
// material is kept on mesh.userData.neonMaterial so toggling back is exact.
//
// New objects are styled as they are added to the scene (scene.add is wrapped).
// Children added to objects ALREADY in the scene must call styleObject(child).

import { scene, bloomPass, applyTheme } from './scene.js';

const STORAGE_KEY = 'spaceRunArtStyle';
const TOON_BLOOM = { strength: 0.25, threshold: 0.9 };
const OUTLINE_SCALE = 1.08;
const OUTLINE_MIN_RADIUS = 0.25;   // skip outlines on tiny parts (panels, antennae)
const OUTLINE_MIN_OPACITY = 0.6;   // hide outlines while a part fades (death, cloak)

let toon = false;
let neonBloom = null;

// 3-step light ramp → hard cartoon shading bands
const gradientMap = (() => {
    const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
})();

const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x0b0820, side: THREE.BackSide });
outlineMaterial.userData.shared = true; // never disposed by disposeMesh()

// The game has no global light (neon relies on emissive + bloom); toon shading
// needs a key light to produce bands. Hidden lights are excluded from rendering.
const toonLights = new THREE.Group();
toonLights.add(new THREE.HemisphereLight(0x9fb8ff, 0x3a2050, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(-6, 14, -10);
toonLights.add(keyLight);
toonLights.visible = false;

const toonCache = new WeakMap(); // neon material -> toon material (keeps sharing intact)
const outlines = new Set();      // outline meshes currently live in toon mode

function toonColor(m) {
    const hsl = {};
    const emissiveHsl = {};
    m.color.getHSL(hsl);
    m.emissive.getHSL(emissiveHsl);
    // Dark hulls that read through their glow (engines, reactors) take the glow colour
    const useEmissive = m.emissiveIntensity > 0.9 || (hsl.l < 0.15 && emissiveHsl.l > 0.1);
    const base = useEmissive ? m.emissive : m.color;
    base.getHSL(hsl);
    if (hsl.s < 0.1) {
        // neutral greys → clean light grey/white cartoon panels
        return new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(0.8, Math.max(0.55, hsl.l + 0.3)));
    }
    return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.1), Math.min(0.62, Math.max(0.42, hsl.l + 0.25)));
}

function makeToonMaterial(m) {
    let t = toonCache.get(m);
    if (t) return t;
    t = new THREE.MeshToonMaterial({
        color: toonColor(m),
        gradientMap,
        emissive: m.emissive.clone().multiplyScalar(0.35),
        emissiveIntensity: Math.min(m.emissiveIntensity, 1),
        transparent: m.transparent,
        opacity: m.opacity,
        side: m.side,
        wireframe: m.wireframe,
        depthWrite: m.depthWrite
    });
    toonCache.set(m, t);
    return t;
}

function isOpaque(m) {
    return !m.wireframe && (!m.transparent || m.opacity >= 0.95);
}

function addOutline(mesh) {
    const g = mesh.geometry;
    if (!g || mesh.userData.outline) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere || g.boundingSphere.radius < OUTLINE_MIN_RADIUS) return;
    const ol = new THREE.Mesh(g, outlineMaterial);
    ol.scale.setScalar(OUTLINE_SCALE);
    ol.userData.isOutline = true; // geometry belongs to the parent — disposeMesh skips it
    ol.raycast = () => {};
    mesh.add(ol);
    mesh.userData.outline = ol;
}

// Carry runtime-animated state across a material swap
function syncState(from, to) {
    to.opacity = from.opacity;
    to.transparent = from.transparent;
}

function meshToToon(o) {
    const ud = o.userData;
    const cur = o.material;
    if (ud.toonMaterial && cur === ud.neonMaterial) {
        syncState(cur, ud.toonMaterial);
        o.material = ud.toonMaterial;
    } else if (cur && cur.isMeshStandardMaterial) {
        ud.neonMaterial = cur;
        ud.toonMaterial = makeToonMaterial(cur);
        o.material = ud.toonMaterial;
        if (isOpaque(cur)) addOutline(o);
    }
    if (ud.outline) outlines.add(ud.outline);
}

function meshToNeon(o) {
    const ud = o.userData;
    if (ud.neonMaterial && o.material === ud.toonMaterial) {
        syncState(o.material, ud.neonMaterial);
        o.material = ud.neonMaterial;
    }
    if (ud.outline) {
        ud.outline.visible = false;
        outlines.delete(ud.outline);
    }
}

function collectMeshes(root) {
    const meshes = [];
    root.traverse(o => { if (o.isMesh && !o.userData.isOutline) meshes.push(o); });
    return meshes;
}

// Apply the active style to an object tree (safe to call repeatedly).
export function styleObject(root) {
    if (!root) return;
    collectMeshes(root).forEach(toon ? meshToToon : meshToNeon);
}

function isInScene(obj) {
    let p = obj;
    while (p.parent) p = p.parent;
    return p === scene;
}

// Per frame: drop outlines of removed objects, hide outlines of fading parts.
export function updateToonOutlines() {
    if (!toon) return;
    for (const ol of outlines) {
        const parent = ol.parent;
        if (!parent || !isInScene(parent)) { outlines.delete(ol); continue; }
        const m = parent.material;
        ol.visible = !m.transparent || m.opacity >= OUTLINE_MIN_OPACITY;
    }
}

export function isToon() { return toon; }

export function setArtStyle(style) {
    toon = style === 'toon';
    scene.userData.toon = toon;
    try { localStorage.setItem(STORAGE_KEY, toon ? 'toon' : 'neon'); } catch (_) { /* storage unavailable */ }

    collectMeshes(scene).forEach(toon ? meshToToon : meshToNeon);
    toonLights.visible = toon;
    const bloom = toon ? TOON_BLOOM : neonBloom;
    bloomPass.strength = bloom.strength;
    bloomPass.threshold = bloom.threshold;
    applyTheme();
    updateToonOutlines();

    const btn = document.getElementById('styleBtn');
    if (btn) {
        btn.setAttribute('aria-pressed', String(toon));
        btn.title = toon ? 'Switch to neon style (T)' : 'Switch to toon style (T)';
    }
}

export function toggleArtStyle() {
    setArtStyle(toon ? 'neon' : 'toon');
}

export function initArtStyle() {
    neonBloom = { strength: bloomPass.strength, threshold: bloomPass.threshold };

    const baseAdd = scene.add.bind(scene);
    baseAdd(toonLights);
    scene.add = function (...objects) {
        baseAdd(...objects);
        if (toon) objects.forEach(styleObject);
        return this;
    };

    const btn = document.getElementById('styleBtn');
    if (btn) {
        btn.addEventListener('click', () => { toggleArtStyle(); btn.blur(); });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 't' && e.key !== 'T') return;
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return; // typing a high-score name
        toggleArtStyle();
    });

    let saved = 'neon';
    try { saved = localStorage.getItem(STORAGE_KEY) || 'neon'; } catch (_) { /* storage unavailable */ }
    setArtStyle(saved);
}
