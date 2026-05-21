let _currentLang = 'en';
let _urlMap = {};
let _nextId = 0;
let _firstSel = null;
let _activeNodeId = null;

export function getCurrentLang() { return _currentLang; }
export function setCurrentLang(lang) { _currentLang = lang; }

export function getUrlMap() { return _urlMap; }
export function setUrlMap(map) { _urlMap = map; }

export function getNextId() { return _nextId; }
export function incrementNextId() { return _nextId++; }
export function setNextId(val) { _nextId = val; }

export function getFirstSel() { return _firstSel; }
export function setFirstSel(val) { _firstSel = val; }

export function getActiveNodeId() { return _activeNodeId; }
export function setActiveNodeId(val) { _activeNodeId = val; }

export function resetState() {
    _urlMap = {};
    _nextId = 0;
    _firstSel = null;
    _activeNodeId = null;
}