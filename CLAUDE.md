# Space Shooter 3D - Project Documentation

## Project Overview

A modern 3D space shooter game built with Three.js featuring a grey metallic fighter ship battling against three types of alien enemies. The game includes difficulty levels, high score tracking, and smooth physics-based movement.

## File Structure

```
C:\Users\grkas\Game\
├── index.html       # Main HTML structure with game UI
├── style.css        # Glassmorphism styling and animations
├── game.js          # Core game logic with Three.js (main file)
└── CLAUDE.md        # This documentation file
```

## Technology Stack

- **Three.js v0.160.0** - 3D graphics library via CDN
- **Vanilla JavaScript** - No additional frameworks
- **CSS3** - Modern glassmorphism effects with backdrop-filter
- **LocalStorage** - Persistent high score tracking

## Game Architecture

### Camera Setup
- **Perspective**: 60° FOV, positioned at (0, 12, -18) looking at (0, -3, 25)
- **Style**: 45-degree chase camera angle, "flying through space" perspective
- **Result**: Modern space shooter aesthetic with clear depth perception

### Player Ship
- **Design**: Grey metallic fighter with wings, cockpit, and engine thrusters
- **Position**: Fixed Y position at -5 (center)
- **Movement**: Horizontal only (left/right) with acceleration-based physics
- **Physics**:
  - Acceleration: 0.03 units/frame
  - Max speed: 0.4 units/frame
  - Friction: 0.92 (decay multiplier)
- **Weapons**: Fires 3 bullets simultaneously (center, left wing, right wing)
- **Scale**: 1.0x (compact and precise)

### Enemy Types

**1. Alien Destroyer (Type 0)**
- Design: Octahedron core with energy rings
- Color: Magenta (0xff00ff)
- Scale: 0.6x

**2. Interceptor (Type 1)**
- Design: Angular diamond with side wings
- Color: Green (0x00ff00)
- Scale: 0.6x

**3. Battlecruiser (Type 2)**
- Design: Heavy disk with energy dome and weapons
- Color: Orange (0xff6600)
- Scale: 0.5x
- Hit radius: 2.0 (larger due to size)

All enemies have:
- Point lights for glow effects
- Lateral movement (side-to-side)
- Forward movement toward player
- Y-axis rotation for visual effect

### Difficulty Settings

| Difficulty | Enemy Speed | Spawn Interval | Points |
|------------|-------------|----------------|--------|
| Easy       | 0.1 - 0.2   | 2000ms        | 10     |
| Medium     | 0.2 - 0.35  | 1400ms        | 15     |
| Hard       | 0.35 - 0.55 | 900ms         | 25     |

### Game Mechanics

**Lives System**:
- Start with 3 lives
- Lose life when enemy reaches player or collides with ship
- Gain 1 life per 10 targets hit (max 3 lives)

**Scoring**:
- Points awarded based on difficulty setting
- Top 5 high scores saved to LocalStorage
- High score displayed during gameplay

**Controls**:
- ← → Arrow keys: Move left/right
- Space: Shoot bullets
- ESC: Exit to menu (keeps high score eligibility)

**Collision Detection**:
- Distance-based with separate X/Y tolerances
- Z-axis proximity check (< 3 units)
- Y tolerance: 2.5 units (forgiving vertical alignment)
- X radius: 1.5 units (1.8 for Type 2)

### Visual Effects

**Lighting**:
- Ambient light (0x404060, intensity 0.5)
- Directional light (0xffffff, intensity 0.8) at (10, 20, 30)
- Point lights on each enemy (type-specific colors)

**Particles**:
- 25 particles per explosion
- Yellow (0xffff00) and orange (0xff6600) colors
- Physics-based trajectories with decay
- 35-frame lifetime

**Star Field**:
- 300 point stars with varying depths
- Animated forward movement for speed effect
- Continuous loop (reset at z = -20)

**Materials**:
- MeshStandardMaterial for ships (metalness, roughness)
- Emissive properties for glowing effects
- Transparent materials for cockpit and effects

## Development Guidelines

### Code Organization

**Player Movement** (movePlayer function):
- Acceleration-based physics for smooth control
- Boundary checking at x = ±35
- Horizontal movement only (Y fixed at -5)

**Bullet System** (shootBullet function):
- 3 bullets per shot from defined positions
- Speed: 1.2 units/frame forward
- Auto-removed when z > 80

**Enemy Spawning** (createEnemy function):
- Random X position: ±15 from center
- Y position: -5 ± 2 (around player height)
- Z spawn: 70 (far distance)
- Lateral movement with boundary reversal

**Game Loop**:
- 60 FPS target with requestAnimationFrame
- Update order: player → bullets → enemies → particles → stars
- Collision check after all updates
- Enemy spawn based on difficulty timer

### Performance Considerations

**Optimizations**:
- Backward iteration for safe array splicing
- Object removal from scene before array splice
- Particle pooling (max ~25 per explosion)
- Star field uses BufferGeometry for efficiency

**Targets**:
- 60 FPS on mid-range hardware
- < 50 draw calls per frame
- < 3 second initial load

### Common Modifications

**Adjusting Difficulty**:
- Modify `difficultySettings` object (lines 39-55)
- Change spawn intervals, enemy speeds, or points

**Enemy Behavior**:
- `lateralSpeed` in createEnemy (line 493): Controls side-to-side movement
- `enemy.speed` range (line 490): Controls forward speed

**Player Movement Feel**:
- `acceleration` (line 67): How quickly ship speeds up
- `maxSpeed` (line 66): Top speed limit
- `friction` (line 68): How quickly ship slows down

**Collision Sensitivity**:
- `yTolerance` (line 603): Vertical hit detection range
- `xHitRadius` (line 604): Horizontal hit detection range
- `zDiff` threshold (line 596): Z-axis proximity check

**Visual Tweaks**:
- Ship scale: `group.scale.set()` in createPlayer (line 171)
- Enemy scale: `group.scale.set()` in each enemy type (lines 374, 425, 484)
- Camera position: `camera.position.set()` (line 21)

## Known Constraints

1. **No Vertical Movement**: Player stays at fixed Y position for gameplay simplicity
2. **Single-file Architecture**: All game logic in one file for maintainability
3. **Fixed Spawn Distance**: Enemies always spawn at z = 70
4. **Three Bullet Pattern**: Center + wings configuration is hardcoded
5. **Top 5 Scores Only**: LocalStorage limits to 5 high score entries

## High Score System

**Storage Format**:
```javascript
{
  name: string,      // Player name (max 20 chars)
  score: number,     // Final score
  difficulty: string, // 'easy', 'medium', or 'hard'
  date: string       // Locale date string
}
```

**LocalStorage Key**: `'spaceShooterHighScores'`

**Functions**:
- `loadHighScores()`: Retrieves saved scores
- `addHighScore(name, score, difficulty)`: Adds and sorts new score
- `isTopScore(score)`: Checks if score qualifies for top 5
- `displayHighScores(scores)`: Renders scores to game over screen

## Design Decisions

**Why Fixed Y Position?**
- Previous vertical movement system was confusing
- Simplified targeting and gameplay flow
- Removed unnecessary complexity

**Why Acceleration Physics?**
- Provides precise control for targeting
- Feels more realistic and satisfying
- Prevents "ice skating" or overly twitchy movement

**Why Distance-Based Collision?**
- Bounding box collision failed with scaled Three.js groups
- More reliable and tunable
- Allows for forgiving hit detection (better gameplay)

**Why Three Bullets?**
- Visual feedback (looks more impressive)
- Slightly easier to hit moving targets
- Maintains challenge (not overpowered)

**Why Three Enemy Types?**
- Visual variety without overwhelming complexity
- Different sizes provide natural difficulty variation
- Each has distinct silhouette for quick recognition

## Future Enhancement Ideas

- Power-ups (rapid fire, shields, spread shot)
- Boss battles at score milestones
- Different bullet types or special weapons
- Progressive difficulty (speed increases over time)
- Sound effects and background music
- Particle engine trails on player ship
- Screen shake on explosions
- Combo multiplier system
- Achievement system

## Troubleshooting

**Collision Not Working?**
- Check Y tolerance and X radius values
- Verify enemy scaling hasn't changed
- Ensure backward iteration in collision loops

**Performance Issues?**
- Check particle count (explosions × 25 particles)
- Verify enemies/bullets are being removed properly
- Monitor draw calls in browser DevTools

**Movement Feels Wrong?**
- Adjust acceleration, maxSpeed, or friction values
- Check boundary limits (currently ±35)
- Verify velocityX sign in position update

**Enemies Not Spawning?**
- Check spawn interval timing
- Verify difficulty setting is valid
- Ensure game loop is running

## Contact & Contribution

This is a single-player web game project. All game logic is self-contained in three files for easy modification and learning.
