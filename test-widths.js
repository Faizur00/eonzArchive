// Calculate minimum widths of top bar components
const backBtn = 32 + 8; // width + gap
const badge = 42 + 8;
const title = 140; // minimum readable title
const leftMin = backBtn + badge + title; // 230px

const center = 32 + 16 + 120; // btn padding + icon + chapter min (168px)

const modeSelect = 80 + 6;
const divider1 = 1 + 6;
const highlightBtn = 32 + 8 + 70; // icon + "HIGHLIGHT" + padding = ~110px
const drawBtn = 32 + 8 + 45; // icon + "DRAW" + padding = ~85px
const notesBtn = 36 + 6;
const divider2 = 1 + 6;
const settingsBtn = 32 + 6;
const fullscreenBtn = 32 + 6;
const rightDesktopFull = modeSelect + divider1 + highlightBtn + drawBtn + notesBtn + divider2 + settingsBtn + fullscreenBtn; // ~395px

console.log('leftMin:', leftMin);
console.log('centerMin:', center);
console.log('rightDesktopFull:', rightDesktopFull);
console.log('Total min desktop width:', leftMin + center + rightDesktopFull);
