// Converts HEX color (#RRGGBB) to Tailwind HSL string "H S% L%"
export function hexToTailwindHsl(hex: string): string {
    hex = hex.replace(/^#/, '');

    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;

    let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

    if (delta == 0) h = 0;
    else if (cmax == r) h = ((g - b) / delta) % 6;
    else if (cmax == g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    l = (cmax + cmin) / 2;

    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}

// Converts Tailwind HSL string "H S% L%" to HEX string "#RRGGBB"
export function tailwindHslToHex(hslStr: string): string {
    if (!hslStr) return "#000000";
    const parts = hslStr.split(' ').map(p => parseFloat(p.replace('%', '')));
    let h = parts[0] || 0;
    let s = parts[1] || 0;
    let l = parts[2] || 0;

    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c/2,
        r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    let rHex = r.toString(16).length == 1 ? "0" + r.toString(16) : r.toString(16);
    let gHex = g.toString(16).length == 1 ? "0" + g.toString(16) : g.toString(16);
    let bHex = b.toString(16).length == 1 ? "0" + b.toString(16) : b.toString(16);

    return "#" + rHex + gHex + bHex;
}
