import { gameState } from '../state.js';

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

export function applyMuteState() {
    const isMuted = gameState.audio.isMuted;
    const gainValue = isMuted ? 0 : 1;
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.value = gainValue;
    masterGain.gain.setValueAtTime(gainValue, audioContext.currentTime);
    if (isMuted && gameState.audio.masterOutputConnected) {
        masterGain.disconnect();
        gameState.audio.masterOutputConnected = false;
    } else if (!isMuted && !gameState.audio.masterOutputConnected) {
        masterGain.connect(audioContext.destination);
        gameState.audio.masterOutputConnected = true;
    }
}

export function toggleMute() {
    gameState.audio.isMuted = !gameState.audio.isMuted;
    applyMuteState();
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.textContent = gameState.audio.isMuted ? '\u{1F507}' : '\u{1F50A}';
        muteBtn.blur();
    }
}

export function ensureAudioContext() {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => applyMuteState()).catch(e => {
            console.warn('Failed to resume audio context:', e);
        });
    }
    applyMuteState();
}

export function playShootSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

export function playExplosionSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
    oscillator.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

export function playHitSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.value = 300;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
}

export function playGameOverSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
    oscillator.type = 'triangle';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

export function playBossHitSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.value = 150;
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

export function playBossPhaseSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    const gain2 = audioContext.createGain();
    osc1.connect(gain1); gain1.connect(masterGain);
    osc2.connect(gain2); gain2.connect(masterGain);
    osc1.frequency.setValueAtTime(60, audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.6);
    osc1.type = 'sawtooth';
    gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
    osc2.frequency.setValueAtTime(200, audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.4);
    osc2.type = 'square';
    gain2.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    osc1.start(audioContext.currentTime); osc1.stop(audioContext.currentTime + 0.6);
    osc2.start(audioContext.currentTime); osc2.stop(audioContext.currentTime + 0.4);
}

export function playLevelCompleteSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

export function playPortalSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const duration = 2.5;
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bass.connect(bassGain); bassGain.connect(masterGain);
    bass.frequency.setValueAtTime(50, audioContext.currentTime);
    bass.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + duration);
    bass.type = 'sine';
    bassGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    const sweep = audioContext.createOscillator();
    const sweepGain = audioContext.createGain();
    sweep.connect(sweepGain); sweepGain.connect(masterGain);
    sweep.frequency.setValueAtTime(200, audioContext.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + duration);
    sweep.type = 'sawtooth';
    sweepGain.gain.setValueAtTime(0.15, audioContext.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    const warble = audioContext.createOscillator();
    const warbleGain = audioContext.createGain();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.connect(lfoGain); lfoGain.connect(warble.frequency);
    warble.connect(warbleGain); warbleGain.connect(masterGain);
    lfo.frequency.value = 6; lfoGain.gain.value = 100;
    warble.frequency.value = 800; warble.type = 'triangle';
    warbleGain.gain.setValueAtTime(0.1, audioContext.currentTime);
    warbleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    bass.start(audioContext.currentTime); bass.stop(audioContext.currentTime + duration);
    sweep.start(audioContext.currentTime); sweep.stop(audioContext.currentTime + duration);
    warble.start(audioContext.currentTime); warble.stop(audioContext.currentTime + duration);
    lfo.start(audioContext.currentTime); lfo.stop(audioContext.currentTime + duration);
}

export function playShieldBreakSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    oscillator.connect(filter); filter.connect(gainNode); gainNode.connect(masterGain);
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
    filter.Q.value = 2;
    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

export function playShieldHitSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.18, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc.connect(gainNode); gainNode.connect(masterGain);
    osc.start(); osc.stop(audioContext.currentTime + 0.15);
}

export function playEnemyShootSound() {
    if (gameState.audio.isMuted) return;
    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode); gainNode.connect(masterGain);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.08);
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.06, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
}
