import { gameState } from '../state.js';
import { shootBullet } from '../entities/player.js';
import { togglePause } from '../systems/hud.js';

const TILT_THRESHOLD = 5;
const TILT_MAX = 30;

export let stopTouchFire = null;

export function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        gameState.input.keys[e.key] = true;

        if (e.key === ' ' && gameState.runtime.gameRunning) {
            e.preventDefault();
            if (!gameState.runtime.gamePaused && !gameState.progression.levelTransitioning) {
                shootBullet();
            }
        }

        if ((e.key === 'p' || e.key === 'P') && gameState.runtime.gameRunning) {
            e.preventDefault();
            togglePause();
        }

        if (e.key === 'Escape' && gameState.runtime.gameRunning) {
            e.preventDefault();
            if (gameState.runtime.gamePaused) {
                togglePause();
            } else {
                globalThis.endGame?.();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        gameState.input.keys[e.key] = false;
    });
}

export function initTouchControls() {
    const touchLeft = document.getElementById('touchLeft');
    const touchRight = document.getElementById('touchRight');
    const touchFire = document.getElementById('touchFire');
    if (!touchLeft) return;

    const keys = gameState.input.keys;
    let fireInterval = null;

    function addInputListeners(element, onStart, onEnd) {
        element.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(); });
        element.addEventListener('touchend', (e) => { e.preventDefault(); onEnd(); });
        element.addEventListener('touchcancel', () => { onEnd(); });
        element.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(); });
        element.addEventListener('mouseup', (e) => { e.preventDefault(); onEnd(); });
        element.addEventListener('mouseleave', () => { onEnd(); });
    }

    addInputListeners(touchLeft,
        () => { keys['ArrowLeft'] = true; touchLeft.classList.add('active'); },
        () => { keys['ArrowLeft'] = false; touchLeft.classList.remove('active'); }
    );
    addInputListeners(touchRight,
        () => { keys['ArrowRight'] = true; touchRight.classList.add('active'); },
        () => { keys['ArrowRight'] = false; touchRight.classList.remove('active'); }
    );

    function tryShoot() {
        if (gameState.runtime.gameRunning && !gameState.runtime.gamePaused && !gameState.progression.levelTransitioning) {
            shootBullet();
        }
    }

    function startFire() {
        touchFire.classList.add('active');
        tryShoot();
        if (!fireInterval) fireInterval = setInterval(tryShoot, 50);
    }
    function stopFire() {
        touchFire.classList.remove('active');
        clearInterval(fireInterval);
        fireInterval = null;
    }
    stopTouchFire = stopFire;
    addInputListeners(touchFire, startFire, stopFire);
}

function getTiltValue(event) {
    const angle = screen.orientation ? screen.orientation.angle : (window.orientation || 0);
    if (angle === 90) return event.beta || 0;
    else if (angle === -90 || angle === 270) return -(event.beta || 0);
    return event.gamma || 0;
}

function handleTiltOrientation(event) {
    const raw = getTiltValue(event);

    if (!gameState.input.tiltCalibrated) {
        gameState.input.tiltBaseValue = raw;
        gameState.input.tiltCalibrated = true;
        return;
    }

    if (!gameState.runtime.gameRunning || gameState.runtime.gamePaused || !gameState.input.tiltEnabled) return;

    const tilt = raw - gameState.input.tiltBaseValue;

    if (Math.abs(tilt) < TILT_THRESHOLD) {
        gameState.input.tiltAmount = 0;
        return;
    }

    const sign = tilt > 0 ? 1 : -1;
    const magnitude = Math.min((Math.abs(tilt) - TILT_THRESHOLD) / (TILT_MAX - TILT_THRESHOLD), 1);
    gameState.input.tiltAmount = sign * magnitude;
}

export function enableTiltControls() {
    if (gameState.input.tiltEnabled) return;
    gameState.input.tiltEnabled = true;
    gameState.input.tiltCalibrated = false;
    window.addEventListener('deviceorientation', handleTiltOrientation);
}

export function initTiltControls() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission !== 'function' &&
        'DeviceOrientationEvent' in window) {
        enableTiltControls();
    }
}
