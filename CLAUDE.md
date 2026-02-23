# Space Run — Project Documentation

## Overview

A 3D space shooter built with Three.js. The player pilots the experimental fighter *Horizon* through a
20-level campaign (Operation Deep Horizon) battling alien enemies and bosses across four story acts,
ending with a victory screen at level 20.

**Live repo**: https://github.com/kgram1989/space-run

---

## File Structure

```
C:\Users\grkas\Game\
├── index.html          # HTML structure, HUD, overlays, CDN scripts
├── style.css           # Glassmorphism UI, HUD, animations, mobile overrides
├── game.js             # All game logic (~4300 lines, single file)
├── database.rules.json # Firebase Realtime Database security rules
└── CLAUDE.md           # This file
```

---

## Tech Stack

| Library | Version | How loaded |
|---------|---------|-----------|
| Three.js | 0.160.0 | CDN |
| Firebase (compat) | 10.x | CDN (app + database) |
| html2canvas | 1.4.1 | CDN — screenshot for share |

No build step. All vanilla JS.

---

## Architecture

### `gameState` + `bindStateAlias`

All mutable game state lives in `gameState` (defined ~line 78), grouped into sub-objects:
- `gameState.runtime` — gameRunning, score, lives, difficulty, etc.
- `gameState.progression` — currentLevel, bossActive, levelTransitioning, etc.
- `gameState.entities` — boss, portal, bullets, enemies, pickups, etc.
- `gameState.timers` — levelTransitionTimeout, bossPortalTimeout, portalAnimationId

`bindStateAlias(name, target, key)` (~line 152) creates a global variable that reads/writes
`target[key]`. This means code like `currentLevel++` actually updates `gameState.progression.currentLevel`.

**Rule**: Any new timeout/interval/animationFrame that must survive restart must be tracked in
`gameState.timers` and cleared in `endGame()`.

### Shared Geometry / Object Pooling

Enemy bullets use `SHARED_GEO.enemyBullet` and `SHARED_MAT.enemyBullet` — a single geometry and
material instance shared across all enemy bullet meshes.

**Critical rule**: NEVER call `disposeMesh()` or `scene.remove()` directly on pooled/shared-geometry
meshes. To "destroy" an enemy bullet, set `bullet.mesh.visible = false` to return it to the pool.
Calling `disposeMesh()` on shared geometry permanently destroys it for all future bullets.

Player bullets also use shared geometry — on boss hit, use `scene.remove(bullet.mesh)` only, no dispose.

`disposeMesh()` is only safe on meshes with **unique** geometry (enemies, boss, pickups, particles).

---

## Game Systems

### Player

```
player.x / y / z     — position (y fixed at -5)
player.velocityX      — horizontal momentum
player.shieldStrength — 0–3 (integer, replaces old boolean shield)
player.shieldMax      — 3
player.weaponType     — 'default' | 'spread'
player.invulnerable   — bool, set after taking damage
player.invulnerableTimer — frame countdown
```

Shield functions: `damageShield()`, `breakShield()`, `restoreShield()`, `updateShieldVisuals()`,
`updateShieldHUD()`. Shield has 3 hit points shown as cyan pips in the HUD.

### Enemy Types

| Type | Name | Color | HP | Notes |
|------|------|-------|-----|-------|
| 0 | Alien Destroyer | Magenta `#ff00ff` | 1 | Octahedron with orbiting armor |
| 1 | Interceptor | Electric blue `#00aaff` | 1 | Dash attacks toward player X |
| 2 | Battlecruiser | Gunmetal `#556677` + gold | 2 | Requires 2 hits |

Spawned uniformly at random (33% each). Speed scales with `sqrt(currentLevel - 1) * scalingFactor`.

### Boss ("The Core") — Multi-Phase

- Dark red octahedron with rotating reactor layers, 8 cannons, hex wireframe shield
- Appears after `enemiesRequiredForBoss` kills (`10 + currentLevel * 2`)
- Health: `Math.min(15 + currentLevel * 5, 60)` × difficulty multiplier (capped at 60 base)
- After defeat: drops weapon pickup (+2.5 x offset) and optionally extra-life pickup (-2.5 x offset)
- `defeatBoss()` → `bossPortalTimeout` → `createPortal()` / `animatePortalEntry()` / `triggerVictory()`

**Multi-Phase System** — Boss has 3 phases triggered at health thresholds:

| Phase | HP Range | Speed | Fire Rate | Burst | Attack Pattern |
|-------|----------|-------|-----------|-------|----------------|
| 1 | 100%–60% | 1× base | 1× base | 2 shots | Standard (single or 3-spread) |
| 2 | 60%–30% | 1.5× base | 0.8× base | 3 shots | Always 3-bullet spread |
| 3 | 30%–0% | 2× base | 0.6× base | 4 shots | 5-bullet wide spread |

Phase transitions: `BOSS_PHASE_THRESHOLDS = [0.6, 0.3]`

- `checkBossPhaseTransition()` checks health ratio after each hit
- `triggerBossPhaseTransition(newPhase)` applies stat changes, visual effects, brief invulnerability
- Boss is invulnerable for `BOSS_PHASE_TRANSITION_FRAMES` (90 frames ≈ 1.5s) during transition
- Enemy bullets are cleared during transition to give the player a breather
- Visual changes per phase: shield color shifts (red→orange→bright red), armor glows hotter,
  animation speeds increase, emissive intensity rises
- Health bar changes color per phase (red→orange→pulsing red) with phase markers at 60% and 30%
- `#bossPhaseLabel` shows current phase with phase-specific styling

### Level System

20 levels across 4 acts defined in `GAME_NARRATIVE.levels` (~line 317):

| Act | Levels | Theme |
|-----|--------|-------|
| 1 — Departure | 1–5 | Dark blue bg, white stars |
| 2 — The Revelation | 6–10 | Dark blue bg, white stars |
| 3 — The Truth | 11–15 | Dark blue bg, white stars |
| 4 — The Gate | 16–18 same, 19 orange-red, 20 dark red |

Each level entry: `{ id, systemName, description, theme: { background: { color }, starColor } }`

`loadLevelTheme(n)` sets scene background, fog color, and updates star material colors via
`starField.layers` (returned by `createStars()`).

**Victory**: After level 20 boss, `triggerVictory()` shows a closing `showMessageBox()` then calls
`endGame()` with the `#gameOverTitle` text changed to "MISSION COMPLETE". The restart handler resets
it back to "GAME OVER".

### Weapons

- **BLASTERS** (default) — single yellow bolt per wing, unlimited
- **SPREAD SHOT** — green spread pattern, ammo-limited (shown in HUD)

Weapon drops from boss (guaranteed) and enemy kills (random). Ammo tracked in `weaponAmmo.spread`.

### Audio

Web Audio API with a shared `masterGain` node. `ensureAudioContext()` is **synchronous** — it calls
`audioContext.resume().then(...)` fire-and-forget. Do NOT make it async or await it; all sound
functions call it synchronously before creating oscillators.

Mute state stored in `localStorage('spaceRunMuted')`. `applyMuteState()` sets `masterGain.gain`.

### High Score System

**Primary**: Firebase Realtime Database (top 5 global, stored at `/highscores`)
**Fallback**: localStorage key `spaceShooterHighScores`

`checkHighScore(score)` → `isTopScore(score)` (async, checks Firebase) → shows `#nameEntry` form
in-game if new high score. `submitHighScore(name, score)` writes to Firebase and localStorage.

---

## HUD Structure

```
.hud-top
  .hud-left
    .hud-item.hud-lives      — ❤ lives count
    .hud-item.hud-shield     — 3x .shield-pip (cyan dots, active/inactive)
    .hud-item.hud-score      — score
    .hud-item.hud-level      — Lv.N
    #weaponHUD.weapon-hud    — weapon name (always here via syncWeaponHudPlacement)
  .hud-right
    #pauseBtn
    #muteBtn
```

`syncWeaponHudPlacement()` always places `#weaponHUD` inside `.hud-left` after `.hud-level`
(the old desktop/mobile conditional was removed — it's always inline).

---

## Share / Screenshot

`shareLatestScore()` → `captureShareImage()` → `navigator.share({ files: [screenshot] })`

`captureShareImage()` uses `html2canvas` on a **clone** of `#gameOver` placed in a full-screen
fixed overlay (`z-index: 99999`) for correct origin measurement. Key iOS workarounds:
- Clone gets `backdrop-filter: none` (renders black on iOS Safari otherwise)
- Clone's `h2.className = ''` removes the gradient CSS rule; plain `color: #ff4400` used instead
- `scale: 1` on iOS (detected via userAgent + `maxTouchPoints`), `devicePixelRatio` on desktop
- Clone is removed in `finally` block

---

## Mobile

- **Landscape only** on mobile
- Touch controls: left/right move buttons + fire button (tap-to-fire, hold supported)
- `stopTouchFire` exposed globally and called at start of `endGame()` to prevent interval leak
- Level message box repositioned on landscape (`max-height: 500px`): `top: 58% !important`,
  smaller fonts to clear HUD at top
- `isMobile` flag: `'ontouchstart' in window || navigator.maxTouchPoints > 0`

---

## Timer / Cleanup Rules

Every timeout/interval/animationFrame must be tracked and cleared in `endGame()`:

```
gameState.timers.levelTransitionTimeout  — level transition delay
gameState.timers.bossPortalTimeout       — portal spawn after boss death
gameState.timers.portalAnimationId       — portal entry animation rAF
gameState.runtime.animationId            — main game loop rAF
stopTouchFire()                          — touch fire interval
```

`endGame()` clears all of the above at the top of the function.

---

## Critical Rules (don't get these wrong)

1. **Never `disposeMesh()` on shared/pooled geometry** — enemy bullets use `SHARED_GEO`; set
   `mesh.visible = false` to pool them instead.
2. **Never use `navigator.platform`** — deprecated; use `navigator.userAgent` + `maxTouchPoints`.
3. **`ensureAudioContext()` is synchronous** — don't await it, don't make sound functions async
   just to call it.
4. **All new timers go in `gameState.timers`** and must be cleared in `endGame()`.
5. **Shield is an integer `shieldStrength` (0–3)**, not a boolean. Check `> 0`, not truthiness.
6. **`GAME_NARRATIVE.levels` is 0-indexed** — level N data is at index `N - 1`.
7. **Boss health is capped at 60** (`Math.min(15 + currentLevel * 5, 60)`).
