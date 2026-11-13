export const MISSIONS = [
    { word: '나무', meaningVi: 'Cây', syllables: [{ onset: 'ㄴ', vowel: 'ㅏ', result: '나' }, { onset: 'ㅁ', vowel: 'ㅜ', result: '무' }] },
    { word: '고기', meaningVi: 'Thịt', syllables: [{ onset: 'ㄱ', vowel: 'ㅗ', result: '고' }, { onset: 'ㄱ', vowel: 'ㅣ', result: '기' }] },
    { word: '바다', meaningVi: 'Biển', syllables: [{ onset: 'ㅂ', vowel: 'ㅏ', result: '바' }, { onset: 'ㄷ', vowel: 'ㅏ', result: '다' }] },
    { word: '아이', meaningVi: 'Em bé', syllables: [{ onset: 'ㅇ', vowel: 'ㅏ', result: '아' }, { onset: 'ㅇ', vowel: 'ㅣ', result: '이' }] }
];
export const MISSION_LOG_KEY = 'hangul_snap_mission_logs';
export function appendMissionLog(log, storage) {
    try {
        const s = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
        if (!s)
            return false;
        const old = s.getItem(MISSION_LOG_KEY);
        let parsed = [];
        try {
            parsed = old ? JSON.parse(old) : [];
        }
        catch {
            parsed = [];
        }
        const items = Array.isArray(parsed) ? parsed.slice(-99) : [];
        items.push(log);
        s.setItem(MISSION_LOG_KEY, JSON.stringify(items));
        return true;
    }
    catch {
        return false;
    }
}
export function missionBreakdown(m) {
    return m.syllables.map(s => ({ formula: s.onset + ' + ' + s.vowel + ' → ' + s.result, position: ['ㅗ', 'ㅜ', 'ㅡ'].includes(s.vowel) ? 'below' : 'right' }));
}
