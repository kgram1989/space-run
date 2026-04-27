import { latestGameSummary } from '../state.js';

const shareScoreBtn = document.getElementById('shareScoreBtn');
const shareStatusElement = document.getElementById('shareStatus');

export function setShareStatus(message) {
    if (!shareStatusElement) return;
    shareStatusElement.textContent = message;
    if (message) shareStatusElement.classList.remove('hidden');
    else shareStatusElement.classList.add('hidden');
}

export function sanitizeShareName(value) {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().substring(0, 20);
}

export function maybeCaptureShareName() {
    if (latestGameSummary.shareNamePrompted) return;
    latestGameSummary.shareNamePrompted = true;
    const savedName = sanitizeShareName(localStorage.getItem('spaceRunShareName') || '');
    if (!latestGameSummary.playerName && savedName) latestGameSummary.playerName = savedName;
}

export function buildShareText() {
    const name = sanitizeShareName(latestGameSummary.playerName);
    const actorText = name ? `${name} scored` : 'I scored';
    const runText = `${actorText} ${latestGameSummary.score} in Space Run (${latestGameSummary.difficulty.toUpperCase()} L${latestGameSummary.level}).`;
    return { title: 'Space Run', text: runText, combinedText: `${runText} #SpaceRun` };
}

export async function captureShareImage() {
    try {
        if (typeof html2canvas !== 'function') return null;
        const el = document.getElementById('gameOver');
        if (!el) return null;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;pointer-events:none;';
        const clone = el.cloneNode(true);
        const cloneWidth = el.getBoundingClientRect().width || el.offsetWidth || 320;
        clone.style.cssText = ['position:absolute','top:0','left:0','transform:none',
            'backdrop-filter:none','-webkit-backdrop-filter:none','background:rgb(25,5,5)',
            `width:${cloneWidth}px`,'box-sizing:border-box','max-height:none','overflow:visible'].join(';');
        const h2 = clone.querySelector('h2');
        if (h2) {
            h2.className = '';
            h2.style.cssText = ['display:block','background:none','-webkit-text-fill-color:#ff4400',
                'color:#ff4400','font-size:2em','font-weight:900','letter-spacing:4px',
                'margin-bottom:20px','text-align:center'].join(';');
        }
        clone.querySelector('.game-over-actions')?.remove();
        clone.querySelector('#nameEntry')?.remove();
        clone.querySelector('#shareStatus')?.remove();
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        let file = null;
        try {
            const canvas = await html2canvas(clone, {
                backgroundColor: '#190505',
                scale: isIOS ? 1 : (window.devicePixelRatio || 2),
                logging: false, useCORS: true, allowTaint: true
            });
            file = await new Promise(resolve => {
                canvas.toBlob(blob => {
                    if (!blob) { resolve(null); return; }
                    resolve(new File([blob], `space-run-${Date.now()}.png`, { type: 'image/png' }));
                }, 'image/png');
            });
        } finally {
            document.body.removeChild(wrapper);
        }
        return file;
    } catch (e) {
        return null;
    }
}

export async function shareLatestScore() {
    maybeCaptureShareName();
    const payload = buildShareText();
    if (shareScoreBtn) shareScoreBtn.disabled = true;
    setShareStatus('Sharing...');
    try {
        if (navigator.share) {
            const screenshot = await captureShareImage();
            const canShareFile = screenshot && navigator.canShare && navigator.canShare({ files: [screenshot] });
            if (canShareFile) {
                await navigator.share({ title: payload.title, text: payload.text, files: [screenshot] });
                setShareStatus('Shared score with screenshot.');
            } else {
                await navigator.share({ title: payload.title, text: payload.text });
                setShareStatus('Shared score.');
            }
        } else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(payload.combinedText);
            setShareStatus('Score copied to clipboard.');
        } else {
            window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(payload.combinedText), '_blank', 'noopener,noreferrer');
            setShareStatus('Opened share link.');
        }
    } catch (e) {
        if (e && e.name === 'AbortError') { setShareStatus(''); return; }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(payload.combinedText);
                setShareStatus('Score copied to clipboard.');
            } else {
                window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(payload.combinedText), '_blank', 'noopener,noreferrer');
                setShareStatus('Opened share link.');
            }
        } catch (_) {
            setShareStatus('Unable to share automatically.');
        }
    } finally {
        if (shareScoreBtn) shareScoreBtn.disabled = false;
    }
}

if (shareScoreBtn) shareScoreBtn.addEventListener('click', shareLatestScore);
