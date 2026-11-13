const names = {
    기역: [0.0, 0.8114], 니은: [0.9714, 1.9189], 디귿: [2.0789, 2.9374], 리을: [3.0974, 3.966],
    미음: [4.126, 5.0934], 비읍: [5.2534, 6.0218], 시옷: [6.1818, 7.0145], 이응: [7.1745, 8.088],
    아: [8.248, 8.8704], 어: [9.0304, 9.6927], 오: [9.8527, 10.5115], 우: [10.6715, 11.332],
    으: [11.492, 12.1629], 이: [12.3229, 12.9822],
};
const words = {
    가방: [0.0, 0.9612], 가수: [1.1212, 2.0537], 고기: [2.2137, 3.1208], 나무: [3.2808, 4.1934],
    나라: [4.3534, 5.217], 노래: [5.377, 6.2373], 다리: [6.3973, 7.2384], 도시: [7.3984, 8.3408],
    바다: [8.5008, 9.3678], 라면: [9.5278, 10.4804], 모자: [10.6404, 11.619], 마음: [11.779, 12.6241],
    비누: [12.7841, 13.7056], 사과: [13.8656, 14.8479], 시계: [15.0079, 15.9239], 우유: [16.0839, 16.9486],
    아이: [17.1086, 17.9233], 어서: [18.0833, 18.9741], 서울: [19.1341, 20.0589], 언어: [20.2189, 21.0623],
    구두: [21.2223, 22.1029], 으뜸: [22.2629, 23.2445], 그림: [23.4045, 24.2544], 기름: [24.4144, 25.2544],
};
const clips = new Map();
for (const [file, entries] of [['names', names], ['words', words]]) {
    for (const [word, [start, end]] of Object.entries(entries))
        clips.set(word, { path: `/audio/ko/${file}.mp3`, start: start, end: end });
}
clips.set('어묵', { path: selfHostedAudioPath('어묵'), start: 0, end: 0.8087 });
export function selfHostedAudioPath(text) {
    return '/audio/ko/' + encodeURIComponent(text.normalize('NFC').trim()) + '.mp3';
}
export function recordedClip(text) {
    return clips.get(text.normalize('NFC').trim()) ?? null;
}
export function recordingCount() { return clips.size; }
let activeAudio = null;
let activeTimer;
let activeSpeech = null;
function stopAudio() {
    if (activeTimer !== undefined) {
        window.clearInterval(activeTimer);
        activeTimer = undefined;
    }
    if (!activeAudio)
        return;
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
    activeAudio = null;
}
export function stopSpeech() {
    activeSpeech?.abort();
    activeSpeech = null;
    stopAudio();
    window.speechSynthesis?.cancel();
}
function playRecording(clip, signal) {
    // Invoke play directly from the learner's tap to work with mobile media policies.
    const audio = new Audio(clip.path);
    activeAudio = audio;
    audio.currentTime = clip.start;
    audio.addEventListener('ended', () => { if (activeAudio === audio)
        stopAudio(); }, { once: true });
    audio.addEventListener('error', () => { if (activeAudio === audio)
        stopAudio(); }, { once: true });
    const playing = audio.play();
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => finish(new Error('audio-timeout')), 6000);
        const onAbort = () => finish(signal.reason);
        function finish(error) {
            window.clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            if (error) {
                if (activeAudio === audio)
                    stopAudio();
                reject(error);
            }
            else
                resolve();
        }
        signal.addEventListener('abort', onAbort, { once: true });
        playing.then(() => {
            if (signal.aborted || activeAudio !== audio) {
                finish(new DOMException('Playback cancelled', 'AbortError'));
                return;
            }
            activeTimer = window.setInterval(() => { if (audio.currentTime >= clip.end)
                stopAudio(); }, 25);
            finish();
        }, finish);
    });
}
function synthSpeech(text, signal) {
    return new Promise((resolve, reject) => {
        const synth = window.speechSynthesis;
        if (!synth || !('SpeechSynthesisUtterance' in window)) {
            reject(new Error('tts-unavailable'));
            return;
        }
        const voices = synth.getVoices();
        const korean = voices.find(voice => /^ko(?:[-_]|$)/i.test(voice.lang));
        if (voices.length && !korean) {
            reject(new Error('korean-voice-unavailable'));
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = .85;
        if (korean)
            utterance.voice = korean;
        const timer = window.setTimeout(() => finish(new Error('tts-timeout')), 3000);
        const onAbort = () => finish(signal.reason);
        function finish(error) {
            window.clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            utterance.onstart = null;
            utterance.onerror = null;
            if (error) {
                synth.cancel();
                reject(error);
            }
            else
                resolve();
        }
        signal.addEventListener('abort', onAbort, { once: true });
        utterance.onstart = () => finish();
        utterance.onerror = () => finish(new Error('tts-playback-failed'));
        try {
            synth.speak(utterance);
        }
        catch (error) {
            finish(error);
        }
    });
}
const INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MEDIAL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const FINAL = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h'];
const NAMED = { 기역: 'gi-yeok', 니은: 'ni-eun', 디귿: 'di-geut', 리을: 'ri-eul', 미음: 'mi-eum', 비읍: 'bi-eup', 시옷: 'si-ot', 이응: 'i-eung' };
export function pronunciationGuide(text) {
    const value = text.normalize('NFC').trim();
    if (NAMED[value])
        return NAMED[value];
    return [...value].map(c => {
        const n = c.charCodeAt(0) - 0xac00;
        if (n < 0 || n >= 11172)
            return c;
        return (INITIAL[Math.floor(n / 588)] || '') + (MEDIAL[Math.floor((n % 588) / 28)] || '') + (FINAL[n % 28] || '');
    }).join('-');
}
export async function speakKorean(text) {
    stopSpeech();
    const controller = new AbortController();
    activeSpeech = controller;
    const clip = recordedClip(text);
    if (clip) {
        try {
            await playRecording(clip, controller.signal);
            return 'recording';
        }
        catch {
            controller.signal.throwIfAborted();
        }
    }
    await synthSpeech(text, controller.signal);
    return 'device';
}
