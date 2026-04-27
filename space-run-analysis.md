# Space Run — Comprehensive Code Review & Improvement Suggestions

## Overview

Space Run is a 3D space shooter built with Three.js (r128), featuring difficulty scaling, boss fights, level progression with portal transitions, Firebase-backed leaderboards, mobile tilt controls, and procedural audio via Web Audio API. It's a single-file JavaScript game (~2,300 lines) with solid foundations. Below is a thorough analysis organized by category.

---

## 1. Architecture & Code Organization

### Current State
Everything lives in a single `game.js` file with no modules, no class hierarchy, and heavy reliance on global mutable state. While this works for a small game, it creates problems as the game grows.

### Suggestions

**Split into modules.** Even without a bundler, ES modules (`<script type="module">`) work in all modern browsers. A reasonable structure:

```
src/
  main.js          – entry point, game loop
  player.js        – player creation, movement, shield
  enemies.js       – enemy types, AI, spawning
  boss.js          – boss creation, behavior, defeat
  bullets.js       – player + enemy bullet systems
  particles.js     – explosions, engine trails, effects
  audio.js         – all sound functions
  ui.js            – HUD updates, screens, level messages
  levels.js        – GAME_NARRATIVE, theme loading, portal
  input.js         – keyboard, touch, tilt handlers
  highscores.js    – Firebase + localStorage logic
  constants.js     – difficulty settings, timing constants
```

**Introduce a state object instead of scattered globals.** Currently there are ~30+ top-level `let` variables (`gameRunning`, `gamePaused`, `score`, `lives`, `currentLevel`, `bossActive`, `levelTransitioning`, `portalAnimating`, etc.). Group these into a single `gameState` object so functions receive/modify a clear data structure rather than reaching into the global scope.

**Use classes for entity types.** `Player`, `Enemy`, `Boss`, `Bullet` classes would encapsulate their own mesh creation, update logic, and disposal. This eliminates the pattern of creating plain objects with `mesh`, `speed`, `box`, etc. scattered across factory functions.

---

## 2. Performance

### Memory & GPU Resources

**Geometry/material reuse is inconsistent.** Every bullet, particle, and engine trail creates a brand new `SphereGeometry` and `MeshBasicMaterial`. At 60fps with 3 bullets per shot, engine particles every 2 frames, and enemy engine particles every 4 frames, this generates hundreds of short-lived GPU allocations per second.

*Fix:* Create shared geometries and materials once at startup and reuse them. The portal already does this partially (`sharedParticleGeometry`), but the pattern should be applied everywhere:

```js
// Create once
const BULLET_GEO = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 6);
const BULLET_MAT = new THREE.MeshBasicMaterial({ color: 0xffff00 });

// Reuse per bullet
const bulletMesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT);
```

**Object pooling for bullets and particles.** Instead of `new THREE.Mesh()` + `scene.add()` + `dispose()` + `scene.remove()` every frame, maintain pools of inactive meshes. Reset position and visibility when recycling. This alone can dramatically reduce GC pressure and GPU churn.

**`setFromObject()` is expensive.** Called every frame for every enemy (`enemy.box.setFromObject(enemy.mesh)`) and every bullet. For groups with many children, this traverses the entire hierarchy. Use simpler distance-based checks (which you already do in some places) consistently, or compute bounding spheres once and offset by position.

**`traverse()` called every frame per enemy.** `animateEnemyParts()` and the charging VFX logic both call `enemy.mesh.traverse()` each frame. With 10+ enemies on screen, that's hundreds of recursive tree walks per frame. Instead, cache references to animated children at creation time (like you do with `player.wings`, `player.leftEngine`).

### Rendering

**Bloom resolution on mobile could be lower.** You already halve it, but on low-end devices, reducing to quarter resolution or disabling bloom entirely (via a settings toggle) would help.

**Shadow maps are enabled on desktop but never configured for the scene bounds.** The directional light shadow camera should be configured with explicit `left/right/top/bottom/near/far` to avoid wasted shadow map resolution.

**Point lights per enemy.** Each enemy adds a `PointLight` with a range of 15. With 10+ enemies, that's 10+ dynamic point lights. Most renderers struggle above ~4-5 dynamic lights. Consider using emissive materials only (which you already have) and removing per-enemy point lights, or limiting to the nearest 3-4 enemies.

---

## 3. Gameplay & Game Design

### Difficulty & Progression

**Scaling is well-designed** with the `sqrt(currentLevel)` multiplier providing diminishing returns. The three-tier difficulty system with distinct parameters is good.

**Enemy variety doesn't affect gameplay.** All three enemy types (Destroyer, Interceptor, Battlecruiser) behave identically — they move forward with a sine wave, shoot at the player, and differ only visually. Give each type distinct behavior:
- *Destroyer:* Current sine-wave movement (keep as baseline)
- *Interceptor:* Fast, erratic movement, dashes toward the player then pulls back. Fires rapid bursts.
- *Battlecruiser:* Slow, tanky (takes 2-3 hits), fires spread shots or homing missiles.

**Player movement is 1D only (left/right).** This limits tactical options. Consider adding limited vertical movement or a dash/dodge mechanic (double-tap to dash, brief invulnerability). Even subtle forward/back movement to weave between bullets would add depth.

**Shooting is simple but satisfying.** The triple-bullet spread is a nice touch. Consider adding:
- Weapon upgrades (wider spread, faster fire rate, homing missiles) as pickups
- A charge shot mechanic (hold space for a powerful blast)
- Ammo/heat system to add resource management

**Shield mechanic is underutilized.** Currently it's a single-hit buffer that restores on each life loss. Consider making shields a pickup that enemies occasionally drop, or having shields regenerate slowly over time.

**No collectibles or power-ups.** Drops from defeated enemies (health, shield, weapon upgrades, score multipliers) would significantly increase engagement and replayability.

### Boss Fights

**Boss movement is simple (left-right bounce).** Consider phases:
- Phase 1 (100-60% HP): Current side-to-side movement
- Phase 2 (60-30% HP): Adds dive attacks, spawns minions
- Phase 3 (30-0% HP): Enrage — faster movement, more bullets, new attack patterns

**Boss design varies insufficiently between levels.** The same boss model is reused with only stat changes. Each level could introduce a visually and mechanically distinct boss.

### Level Design

**Five levels is good, but the narrative structure could be deeper.** The system names and descriptions are engaging. Consider:
- Environmental hazards (asteroid fields that the player must dodge, nebulae that limit visibility)
- Mid-level events (distress signals, ambushes, reinforcements)
- Post-game endless mode with procedurally increasing difficulty after Level 5

---

## 4. Audio

### Current State
The procedural Web Audio API approach is excellent for a zero-dependency game. Sounds are distinct and appropriately mapped.

### Suggestions

**Add a background music loop.** Even a simple procedural ambient track (layered oscillators with slow LFO modulation) would massively improve atmosphere. The portal sound shows you can build complex layered audio — apply the same approach for ambient music.

**Spatial audio.** Enemy shots and explosions could use `PannerNode` to give left/right positioning based on where they occur on screen. This adds valuable gameplay feedback.

**Sound variety.** Currently each event has exactly one sound. Add slight randomization — vary the frequency by ±10-20% each time, or have 2-3 variants for explosions/hits. This prevents auditory fatigue.

**Volume balancing.** The enemy shoot sound (`gainNode.gain.setValueAtTime(0.06, ...)`) is very quiet relative to player shots (0.1) and explosions (0.3). Ensure all sounds are audible without being jarring.

**Audio cleanup.** Oscillators and gain nodes are created but never explicitly disconnected after stopping. While the browser garbage-collects them, calling `oscillator.disconnect()` after stop is cleaner.

---

## 5. Security

### Critical: Firebase API Key Exposure

**The Firebase config (including API key) is hardcoded in the source.** While Firebase API keys are designed to be public, the Realtime Database is likely readable/writable without authentication, meaning anyone can:
- Read all high scores
- Write arbitrary data
- Delete all scores
- Potentially exhaust your Firebase quota

**Fix:** Implement Firebase Security Rules to restrict writes:
```json
{
  "rules": {
    "highScores": {
      ".read": true,
      ".write": true,
      "$score": {
        ".validate": "newData.hasChildren(['name', 'score', 'difficulty', 'date']) && newData.child('score').isNumber() && newData.child('name').isString() && newData.child('name').val().length <= 20"
      }
    }
  }
}
```

Also consider rate-limiting writes via Cloud Functions or using Firebase App Check to prevent abuse.

### XSS in High Score Display

**`displayHighScores()` uses `.innerHTML` with `entry.name` directly interpolated.** Since names come from Firebase (which anyone can write to), this is a stored XSS vulnerability:

```js
html += `<span class="hs-name">${medal} ${entry.name}</span>`; // XSS!
```

**Fix:** Use `textContent` or sanitize the name:
```js
const nameSpan = document.createElement('span');
nameSpan.textContent = `${medal} ${entry.name}`;
```

---

## 6. Mobile & Responsiveness

### Current State
Mobile support is thoughtful — touch controls, tilt input, landscape lock, `safe-area-inset` handling, pixel ratio limiting, reduced bloom, disabled shadows. This is well above average.

### Suggestions

**Touch controls lack a fire-rate limiter.** The auto-fire interval is 150ms, but holding the fire button doesn't have the same feel as tapping. Consider a visual cooldown indicator on the fire button.

**Tilt calibration UX.** The tilt recalibrates silently on the first reading. Show a brief "Hold your device level..." prompt before the game starts so the player knows to establish a neutral position.

**No haptic feedback.** On supported devices, a brief `navigator.vibrate(50)` on hits, shield breaks, and boss defeats would enhance the tactile experience.

**The rotate overlay is CSS-only.** It shows on portrait orientation but doesn't prevent game interaction underneath. Add `pointer-events: none` on the game container or pause the game when portrait is detected.

**Performance mode toggle.** Some mobile users on low-end hardware would benefit from a "Performance" option that disables bloom, reduces particle counts, and lowers star density.

---

## 7. Visual Polish

### What Works Well
- The ship design is detailed with animated engine glows and wing tilts
- Enemy types are visually distinctive with proper color theming
- Explosions have flash + shockwave + particles (three-layer effect)
- Portal/wormhole effect is atmospheric
- Level themes with distinct background colors

### Suggestions

**Screen flash on damage.** When the player takes a hit, briefly flash the screen edges red (a full-screen transparent overlay that fades). This is standard for shooters and provides immediate visual feedback.

**Score popups.** Show floating "+15" text at the position of killed enemies. These should rise and fade. Makes scoring feel more responsive.

**Trail effects for enemy bullets.** The player's bullet trail (engine particles) is nice, but enemy bullets are plain red spheres with a small glow child. Add a short fading trail to make them more visible and threatening.

**Starfield parallax.** The three star layers all move at the same speed (z -= 0.3). Give them different speeds (0.1, 0.3, 0.5) for a parallax depth effect.

**Level transition polish.** The portal entry animation is good, but there's no visual "arrival" at the new level. Consider a brief warp-speed star streak effect when entering the portal, and a deceleration effect when arriving.

---

## 8. UX & UI

**No indication of enemy count remaining before boss.** Add a subtle progress bar or counter showing "8/10 enemies before boss." This gives the player anticipation and pacing awareness.

**The pause screen lacks a "Quit to Menu" option.** Currently ESC during gameplay triggers `endGame()` (game over), not a return to menu. Add a clean "Return to Menu" path.

**`prompt()` for high score name entry is jarring.** Replace with an in-game styled input field in the game over modal.

**The HUD doesn't show the high score during gameplay.** The `highScore` element is referenced but never displayed in the HUD layout.

**No combo system or kill streak feedback.** Rapid kills could trigger a multiplier or streak counter displayed prominently.

**Difficulty info could be more descriptive.** "Easy: Slower enemies | Medium: Normal speed | Hard: Fast & furious!" — consider adding expected enemy fire rate, boss health difference, etc.

---

## 9. Code Quality & Bugs

**Potential memory leak in level messages.** `showMessageBox()` appends a DOM element and removes it after a timeout. If the game ends during the timeout, the element may never be removed. Store a reference and clean it up in `endGame()`.

**`setTimeout` callbacks don't check `gameRunning`.** Several `setTimeout` calls (portal spawn, level transitions) run their callbacks without verifying the game hasn't ended. The `levelTransitionTimeout` is cleared in `endGame()`, which is good, but the boss defeat `setTimeout` for portal creation is not tracked:

```js
setTimeout(() => {
    createPortal();        // May run after game ends
    animatePortalEntry();
}, PORTAL_SPAWN_DELAY);
```

**Animation frame not canceled on portal animation.** `portalAnimationId` is set but only checked/canceled in `endGame()`. If the portal animation completes normally, `portalAnimationId` retains the old ID.

**`displayHighScores` uses innerHTML with user data** — XSS risk as noted in Security above.

**Star layers are never disposed.** The `createStars()` function adds geometry and points to the scene but provides no cleanup method. If `startGame()` is called multiple times, stars accumulate (though they're created only once at module load, so this is currently fine).

**`engineParticleCounter` and `enemyEngineParticleCounter` are never reset** between games. Not a bug per se, but sloppy.

---

## 10. Testing & DevOps

**No tests exist.** At minimum, add:
- Unit tests for collision detection math
- Unit tests for difficulty scaling calculations
- Integration tests for score/life logic

**No build process.** Consider:
- A simple bundler (esbuild/Vite) for module support and minification
- ESLint for code quality
- A `package.json` with scripts for dev/build/deploy

**No README.** The `CLAUDE.md` exists but there's no player-facing documentation. Add a README with screenshots, play link, controls, and development setup instructions.

**No deployment pipeline.** GitHub Pages or Netlify would give you free hosting with automatic deploys on push.

---

## Summary: Priority Improvements

| Priority | Category | Improvement |
|----------|----------|-------------|
| **Critical** | Security | Sanitize high score names (XSS fix) |
| **Critical** | Security | Add Firebase security rules |
| **High** | Performance | Object pooling for bullets/particles |
| **High** | Performance | Shared geometries/materials |
| **High** | Gameplay | Distinct enemy behaviors per type |
| **High** | Gameplay | Power-ups and collectibles |
| **Medium** | Architecture | Module-based code organization |
| **Medium** | Audio | Background music loop |
| **Medium** | UX | In-game name entry (replace `prompt()`) |
| **Medium** | Visual | Score popups and damage flash |
| **Low** | Visual | Starfield parallax layers |
| **Low** | Mobile | Haptic feedback |
| **Low** | DevOps | Build pipeline and tests |

The game has a strong foundation — the 3D rendering, multi-system gameplay (levels, bosses, portal transitions), and mobile support are all well-executed for a vanilla Three.js project. The biggest gains will come from the security fixes, performance optimizations (pooling), and gameplay variety (enemy behaviors + power-ups).
