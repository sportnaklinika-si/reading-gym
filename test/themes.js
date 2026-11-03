/* Test tool only: the other colour looks Jan compared, shown on the real app with example data.
   index.html#demo&theme=B (or C, D) loads this file; it overrides the theme block on :root and pulls the fonts from Google Fonts.
   Look A (Washi) won and is the theme block in index.html itself, so no theme in the hash means A. The app never loads this file. */
(function () {
  const pick = (location.hash.match(/&theme=([A-Z])/) || [])[1];
  const THEMES = {
    B: { // Jutro: dawn gradient, soft white panels, violet; Plus Jakarta Sans
      fonts: 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800',
      vars: {
        bg: '#FBFAF9', 'bg-paint': 'linear-gradient(180deg, #FBEFE8 0, #F6F2FA 520px, #FBFAF9 1100px)', surface: '#FFFFFF', surface2: '#E6E3EE', line: '#E6E3EE', fg: '#2B2A36', muted: '#7A788C', faint: '#7A788C',
        accent: '#6667B2', 'accent-soft': 'rgba(102,103,178,.12)', 'on-accent': '#FFFFFF',
        good: '#3B7F63', 'good-soft': 'rgba(59,127,99,.13)', 'on-good': '#FFFFFF', mark: '#B8566B', 'mark-soft': 'rgba(184,86,107,.12)', under: '#A7A6CF', danger: '#B8566B',
        'tier-1': '#D3A27F', 'tier-2': '#B5B7CC', 'tier-3': '#D9B46A', lock: '#E1DEEA', 'lock-bg': '#F1EFF5',
        'panel-bg': 'rgba(255,255,255,.7)', 'panel-r': '24px', 'panel-pt': '18px', 'panel-px': '18px', 'panel-pb': '18px', 'panel-rule': 'none', 'sec-pt': '6px', space: '16px',
        'bar-bg': 'rgba(251,250,249,.9)', 'toast-bg': '#2B2A36', 'toast-fg': '#FBFAF9', 'party-bg': '#F6F2FA', shadow: '0 12px 30px -20px rgba(70,60,120,.35)',
        font: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif', display: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif', 'display-w': '700',
        'r-sm': '12px', 'r-md': '16px', 'r-lg': '24px',
        'il-wall': '#F7EEEE', 'il-wall-shade': '#EEE2E2', 'il-floor': '#EADDD5', 'il-floor-shade': '#DDCDC3', 'il-rug': '#DCD6EC', 'il-rug-2': '#C8C0E0',
        'il-chair': '#9C9BD0', 'il-chair-shade': '#8786BF', 'il-cushion': '#F0B8A0', 'il-beanbag': '#B8A6DE', 'il-curtain': '#E6A6A0', 'il-window': '#8E9AD0', 'il-window-frame': '#FFFFFF', 'il-moon': '#FFF3D6',
        'il-cloth-1': '#F2C46E', 'il-cloth-2': '#8EA6E0', 'il-cloth-2b': '#FFFFFF', 'il-cloth-3': '#7DB59E', 'il-cloth-3d': '#66A088', 'il-cloth-4': '#E08E7A', 'il-cloth-4d': '#C9776A', 'il-cloth-7': '#A08ACB',
        'il-book': '#E07A6E', 'il-book-2': '#7C8FD6', 'il-book-3': '#7DB59E', 'il-book-4': '#F0C27A', 'il-plant': '#7DB59E', 'il-plant-dark': '#5E9A82', 'il-pot': '#E8A58A',
        'il-wood': '#D9B79A', 'il-wood-dark': '#B08C70', 'il-lamp': '#F7C873', 'il-light': 'rgba(255,220,170,.30)', 'il-beam': 'rgba(255,236,210,.45)',
      },
    },
    C: { // Tihota: night mode, warm amber; the room is dim with lamp light; IBM Plex Sans + IBM Plex Serif
      scheme: 'dark',
      fonts: 'family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@500;600',
      vars: {
        bg: '#141517', surface: '#1C1D20', surface2: '#2B2C30', line: '#26272B', fg: '#E7E3DA', muted: '#8D8A83', faint: '#8D8A83',
        accent: '#E3B06C', 'accent-soft': 'rgba(227,176,108,.13)', 'on-accent': '#141517',
        good: '#8CC79C', 'good-soft': 'rgba(140,199,156,.14)', 'on-good': '#141517', mark: '#E0907A', 'mark-soft': 'rgba(224,144,122,.14)', under: '#8C93B8', danger: '#E0907A',
        'tier-1': '#A07A5C', 'tier-2': '#8E949C', 'tier-3': '#C9A35E', lock: '#2B2C30', 'lock-bg': '#1C1D20',
        'bar-bg': 'rgba(20,21,23,.92)', scrim: 'rgba(0,0,0,.55)', 'toast-bg': '#E7E3DA', 'toast-fg': '#141517', 'party-bg': '#141517',
        shadow: '0 10px 30px -18px rgba(0,0,0,.8)', 'shadow-up': '0 -20px 50px -24px rgba(0,0,0,.8)',
        font: '"IBM Plex Sans", -apple-system, "Segoe UI", sans-serif', display: '"IBM Plex Serif", Georgia, serif', 'display-w': '600', num: '"IBM Plex Serif", Georgia, serif', 'num-w': '600',
        'r-sm': '8px', 'r-md': '12px', 'r-lg': '16px',
        'il-wall': '#26272C', 'il-wall-shade': '#1F2024', 'il-floor': '#2D2B28', 'il-floor-shade': '#252320', 'il-rug': '#35363C', 'il-rug-2': '#3F4148',
        'il-skin': '#D7AA84', 'il-skin-shade': '#B48763', 'il-blush': '#C9786A', 'il-lip': '#9A5444', 'il-ink': '#18161A', 'il-hair': '#3A281F', 'il-hair-grey': '#8C867E', 'il-hair-white': '#D9D4CB',
        'il-cloth-1': '#C9A04A', 'il-cloth-2': '#4F6E9E', 'il-cloth-2b': '#CFC9BC', 'il-cloth-3': '#3D6E60', 'il-cloth-3d': '#2F5A4E', 'il-cloth-4': '#A55A44', 'il-cloth-4d': '#8A4A38',
        'il-cloth-5': '#A9B0B8', 'il-cloth-6': '#3E4658', 'il-cloth-7': '#6E567E', 'il-pants': '#2E3A4E', 'il-pants-kid': '#5F7AA0', 'il-shoe': '#121214',
        'il-book': '#B54A3F', 'il-book-2': '#3F5F8E', 'il-book-3': '#46745A', 'il-book-4': '#B98C3C', 'il-star': '#E3B06C', 'il-paper': '#D9D3C6', 'il-paper-line': '#A39C8E',
        'il-wood': '#5C4836', 'il-wood-dark': '#3E3026', 'il-chair': '#3E4C46', 'il-chair-shade': '#34413C', 'il-cushion': '#A6773E', 'il-beanbag': '#4F4A78', 'il-blanket': '#8F8068', 'il-box': '#7D6447',
        'il-window': '#141B2E', 'il-window-frame': '#3A3B41', 'il-moon': '#E8D9AE', 'il-curtain': '#5E3F33', 'il-plant': '#4A7A50', 'il-plant-dark': '#36603C', 'il-pot': '#7E5038',
        'il-cat': '#C9853F', 'il-cat-shade': '#A56A2E', 'il-cat-light': '#D9C8B0', 'il-cat-old': '#A39C92', 'il-nose': '#B86A6A',
        'il-lamp': '#F0C278', 'il-light': 'rgba(240,194,120,.22)', 'il-beam': 'rgba(240,194,120,.12)', 'il-glow': 'rgba(240,194,120,.30)',
      },
    },
    D: { // Žad: white, jade teal, light grey panels; Sora + DM Mono for numbers
      fonts: 'family=Sora:wght@400;500;600;700&family=DM+Mono:wght@400;500',
      vars: {
        bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#E8EBEE', line: '#E8EBEE', fg: '#1F2328', muted: '#6B7178', faint: '#6B7178',
        accent: '#2E8C7E', 'accent-soft': 'rgba(46,140,126,.10)', 'on-accent': '#FFFFFF',
        good: '#3A8F55', 'good-soft': 'rgba(58,143,85,.12)', 'on-good': '#FFFFFF', mark: '#C8553F', 'mark-soft': 'rgba(200,85,63,.10)', under: '#8C97A3', danger: '#C8553F',
        'tier-1': '#B98A63', 'tier-2': '#A6AEB9', 'tier-3': '#C7A04A', lock: '#E2E6E9', 'lock-bg': '#F5F7F8',
        'panel-bg': '#F5F7F8', 'panel-r': '10px', 'panel-pt': '16px', 'panel-px': '16px', 'panel-pb': '16px', 'panel-rule': 'none', 'sec-pt': '4px', space: '14px',
        'bar-bg': 'rgba(255,255,255,.92)', 'toast-bg': '#1F2328', 'toast-fg': '#FFFFFF', 'party-bg': '#FFFFFF',
        font: '"Sora", -apple-system, "Segoe UI", sans-serif', display: '"Sora", -apple-system, "Segoe UI", sans-serif', 'display-w': '600', num: '"DM Mono", ui-monospace, monospace', 'num-w': '500',
        'r-sm': '8px', 'r-md': '10px', 'r-lg': '14px',
        'il-wall': '#EEF3F2', 'il-wall-shade': '#E1E8E7', 'il-floor': '#DCE4E1', 'il-floor-shade': '#CCD7D3', 'il-rug': '#CFE3DE', 'il-rug-2': '#B5D3CC',
        'il-chair': '#6E9AA0', 'il-chair-shade': '#5E878D', 'il-cushion': '#F0C27A', 'il-beanbag': '#8FA9C9', 'il-curtain': '#2E8C7E', 'il-window': '#2F4B63', 'il-window-frame': '#FFFFFF',
        'il-cloth-3': '#2E8C7E', 'il-cloth-3d': '#257367', 'il-plant': '#4C9A78', 'il-plant-dark': '#357A5C', 'il-wood': '#C2A68C', 'il-wood-dark': '#7C6650',
      },
    },
  };
  const t = THEMES[pick];
  if (!t) return;
  const root = document.documentElement;
  if (t.fonts) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + t.fonts + '&display=swap'; document.head.append(l); }
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty('--' + k, v);
  if (t.scheme) root.style.colorScheme = t.scheme;
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t.vars.bg;
})();
