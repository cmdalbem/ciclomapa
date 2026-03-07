// Mulberry32 seeded PRNG — fast, deterministic, 32-bit
export function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createRng(seed) {
    const next = mulberry32(seed);
    return {
        next,
        range: (min, max) => min + next() * (max - min),
        int: (min, max) => Math.floor(min + next() * (max - min)),
        pick: (arr) => arr[Math.floor(next() * arr.length)],
        chance: (p) => next() < p,
    };
}

// --- Colors ---

export const COLORS = {
    bg: '#131313',
    street: '#202123',
    ciclovia: '#386641',
    cicloviaLight: '#B9FAB7',
    ciclofaixa: '#A7C957',
    baixaVelocidade: '#4FA0AD',
    poiShops: '#2A7BF4',
    poiRental: '#E56119',
    poiParking: '#2F904A',
};

export const INFRA_COLORS = [COLORS.ciclovia, COLORS.ciclofaixa];
export const INFRA_COLORS_LIGHT = [COLORS.cicloviaLight, COLORS.ciclofaixa];
export const POI_COLORS = [COLORS.poiShops, COLORS.poiRental, COLORS.poiParking];

// --- Shape clipping ---

function clipCircle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
}

function clipRoundedRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
}

// Attempt at a squircle (superellipse) via multiple bezier segments
function clipSquircle(ctx, cx, cy, r) {
    const k = 0.92; // controls "squareness"
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.bezierCurveTo(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r);
    ctx.bezierCurveTo(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy);
    ctx.bezierCurveTo(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r);
    ctx.bezierCurveTo(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy);
    ctx.closePath();
    ctx.clip();
}

export function applyClip(ctx, size, shape, padding) {
    const pad = size * padding;
    const inner = size - pad * 2;
    ctx.beginPath();
    switch (shape) {
        case 'circle':
            clipCircle(ctx, size / 2, size / 2, inner / 2);
            break;
        case 'rounded-square':
            clipRoundedRect(ctx, pad, pad, inner, inner, inner * 0.18);
            break;
        case 'squircle':
            clipSquircle(ctx, size / 2, size / 2, inner / 2);
            break;
        case 'square':
        default:
            clipRoundedRect(ctx, pad, pad, inner, inner, 0);
            break;
    }
}

// Draw the shape outline (for visual boundary)
export function drawShapeBackground(ctx, size, shape, padding) {
    const pad = size * padding;
    const inner = size - pad * 2;
    ctx.save();
    applyClip(ctx, size, shape, padding);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
}

// --- Street generation ---
// Core idea: generate a grid of intersection NODES, then connect adjacent
// nodes with STRAIGHT edges. The organic feel comes from node displacement
// creating varied intersection angles — not from curved lines.
// A segment is simply { x1, y1, x2, y2 }.

// Create a 2D array of nodes with a base grid layout, then displace them.
// `deformation` controls how far nodes shift from their regular grid positions:
//   0 = perfect rectangular grid (all 90° intersections)
//   1 = heavily warped (streets meet at many different angles)
function makeGridNodes(rng, rows, cols, pad, area, deformation, irregularity) {
    const nodes = [];
    const cellW = area / cols;
    const cellH = area / rows;
    const maxShift = Math.min(cellW, cellH) * deformation * 0.45;

    for (let r = 0; r <= rows; r++) {
        nodes[r] = [];
        for (let c = 0; c <= cols; c++) {
            const baseX = pad + cellW * c;
            const baseY = pad + cellH * r;
            // Edge nodes shift less to keep the grid filling the canvas
            const isEdge = r === 0 || r === rows || c === 0 || c === cols;
            const scale = isEdge ? 0.25 : 1.0;
            // Irregularity adds independent per-node jitter on top of deformation
            const jitter = Math.min(cellW, cellH) * irregularity * 0.15;
            nodes[r][c] = {
                x: baseX + rng.range(-maxShift, maxShift) * scale + rng.range(-jitter, jitter),
                y: baseY + rng.range(-maxShift, maxShift) * scale + rng.range(-jitter, jitter),
            };
        }
    }
    return nodes;
}

// Collect all streets (continuous polylines) from a node grid.
// Each horizontal row and each vertical column becomes one street.
function streetsFromGrid(nodes, rows, cols) {
    const streets = [];
    // Horizontal streets
    for (let r = 0; r <= rows; r++) {
        const segs = [];
        for (let c = 0; c < cols; c++) {
            segs.push({ x1: nodes[r][c].x, y1: nodes[r][c].y,
                         x2: nodes[r][c + 1].x, y2: nodes[r][c + 1].y });
        }
        streets.push(segs);
    }
    // Vertical streets
    for (let c = 0; c <= cols; c++) {
        const segs = [];
        for (let r = 0; r < rows; r++) {
            segs.push({ x1: nodes[r][c].x, y1: nodes[r][c].y,
                         x2: nodes[r + 1][c].x, y2: nodes[r + 1][c].y });
        }
        streets.push(segs);
    }
    return streets;
}

function collectIntersections(nodes, rows, cols) {
    const pts = [];
    for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= cols; c++)
            pts.push(nodes[r][c]);
    return pts;
}

// --- Grid pattern ---
function buildGridNetwork(rng, params, size, padding) {
    const pad = size * padding;
    const area = size - pad * 2;
    const dim = Math.max(2, Math.round((params.streetCount - 2) / 2));
    const nodes = makeGridNodes(rng, dim, dim, pad, area, params.curviness, params.irregularity);
    return {
        streets: streetsFromGrid(nodes, dim, dim),
        intersections: collectIntersections(nodes, dim, dim),
    };
}

// --- Organic pattern ---
// Overlays two grids at different angles with heavy deformation and
// random edge drops, creating a realistic non-rectangular network.
function buildOrganicNetwork(rng, params, size, padding) {
    const pad = size * padding;
    const area = size - pad * 2;
    const center = size / 2;
    const dim = Math.max(3, Math.round((params.streetCount - 2) / 2));

    // Primary grid: slightly rotated, heavily deformed
    const angle1 = rng.range(-0.25, 0.25);
    const grid1 = makeRotatedGrid(rng, dim, dim, pad, area, center,
        params.curviness, params.irregularity, angle1);

    // Secondary grid: different angle, sparser, overlapping
    const dim2 = Math.max(2, dim - 1);
    const angle2 = angle1 + rng.range(0.3, 0.8) * (rng.chance(0.5) ? 1 : -1);
    const grid2 = makeRotatedGrid(rng, dim2, dim2, pad, area, center,
        params.curviness * 0.8, params.irregularity, angle2);

    // Collect streets with random edge drops
    const dropChance = 0.15 * params.irregularity;
    const streets1 = streetsFromGridWithDrops(rng, grid1, dim, dim, dropChance);
    const streets2 = streetsFromGridWithDrops(rng, grid2, dim2, dim2, dropChance * 1.5);

    const intersections = [
        ...collectIntersections(grid1, dim, dim),
        ...collectIntersections(grid2, dim2, dim2),
    ];

    return { streets: [...streets1, ...streets2], intersections };
}

function makeRotatedGrid(rng, rows, cols, pad, area, center, deformation, irregularity, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const margin = area * 0.25;
    const fullW = area + margin * 2;
    const fullH = area + margin * 2;
    const cellW = fullW / cols;
    const cellH = fullH / rows;
    const maxShift = Math.min(cellW, cellH) * deformation * 0.45;
    const jitter = Math.min(cellW, cellH) * irregularity * 0.2;

    const nodes = [];
    for (let r = 0; r <= rows; r++) {
        nodes[r] = [];
        for (let c = 0; c <= cols; c++) {
            let px = -margin + cellW * c + rng.range(-maxShift, maxShift) + rng.range(-jitter, jitter);
            let py = -margin + cellH * r + rng.range(-maxShift, maxShift) + rng.range(-jitter, jitter);
            // Rotate around the area center
            const rx = cos * (px - area / 2) - sin * (py - area / 2) + center;
            const ry = sin * (px - area / 2) + cos * (py - area / 2) + center;
            nodes[r][c] = { x: rx, y: ry };
        }
    }
    return nodes;
}

function streetsFromGridWithDrops(rng, nodes, rows, cols, dropChance) {
    const streets = [];
    for (let r = 0; r <= rows; r++) {
        let segs = [];
        for (let c = 0; c < cols; c++) {
            if (rng.chance(dropChance)) {
                if (segs.length) { streets.push(segs); segs = []; }
                continue;
            }
            segs.push({ x1: nodes[r][c].x, y1: nodes[r][c].y,
                         x2: nodes[r][c + 1].x, y2: nodes[r][c + 1].y });
        }
        if (segs.length) streets.push(segs);
    }
    for (let c = 0; c <= cols; c++) {
        let segs = [];
        for (let r = 0; r < rows; r++) {
            if (rng.chance(dropChance)) {
                if (segs.length) { streets.push(segs); segs = []; }
                continue;
            }
            segs.push({ x1: nodes[r][c].x, y1: nodes[r][c].y,
                         x2: nodes[r + 1][c].x, y2: nodes[r + 1][c].y });
        }
        if (segs.length) streets.push(segs);
    }
    return streets;
}

// --- Radial pattern ---
function buildRadialNetwork(rng, params, size, padding) {
    const pad = size * padding;
    const area = size - pad * 2;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = area / 2;
    const deform = params.curviness;

    const ringCount = Math.max(2, Math.round(params.streetCount * 0.35));
    const spokeCount = Math.max(4, params.streetCount - ringCount);

    const centerNode = { x: cx, y: cy };
    const allIntersections = [centerNode];
    const ringNodes = [];

    for (let ri = 0; ri < ringCount; ri++) {
        const baseR = maxR * ((ri + 1) / (ringCount + 0.5));
        ringNodes[ri] = [];
        for (let si = 0; si < spokeCount; si++) {
            const baseAngle = (Math.PI * 2 * si) / spokeCount;
            const angleShift = rng.range(-0.2, 0.2) * deform;
            const rShift = rng.range(-maxR * 0.06, maxR * 0.06) * deform;
            const jitter = maxR * 0.02 * params.irregularity;
            const a = baseAngle + angleShift;
            const r = baseR + rShift + rng.range(-jitter, jitter);
            const node = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
            ringNodes[ri][si] = node;
            allIntersections.push(node);
        }
    }

    const streets = [];

    // Spokes
    for (let si = 0; si < spokeCount; si++) {
        const segs = [];
        segs.push({ x1: cx, y1: cy, x2: ringNodes[0][si].x, y2: ringNodes[0][si].y });
        for (let ri = 0; ri < ringCount - 1; ri++) {
            const a = ringNodes[ri][si];
            const b = ringNodes[ri + 1][si];
            segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
        streets.push(segs);
    }

    // Rings
    for (let ri = 0; ri < ringCount; ri++) {
        const segs = [];
        for (let si = 0; si < spokeCount; si++) {
            const a = ringNodes[ri][si];
            const b = ringNodes[ri][(si + 1) % spokeCount];
            segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
        streets.push(segs);
    }

    return { streets, intersections: allIntersections };
}

export function generateNetwork(rng, params, size, padding) {
    switch (params.pattern) {
        case 'organic':
            return buildOrganicNetwork(rng, params, size, padding);
        case 'radial':
            return buildRadialNetwork(rng, params, size, padding);
        case 'grid':
        default:
            return buildGridNetwork(rng, params, size, padding);
    }
}

// --- Drawing helpers ---

function drawPath(ctx, segments) {
    if (!segments.length) return;
    ctx.beginPath();
    ctx.moveTo(segments[0].x1, segments[0].y1);
    for (const seg of segments) {
        ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
}

// --- Main logo draw function ---

export function drawLogo(canvas, params, seed) {
    const size = params.logoSize;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background + clip
    ctx.save();
    applyClip(ctx, size, params.shape, params.padding);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, size, size);

    const rng = createRng(seed);

    // Generate a connected street network
    const { streets, intersections } = generateNetwork(rng, params, size, params.padding);

    // Draw all streets
    ctx.lineCap = params.lineCap;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.street;
    ctx.lineWidth = params.streetWidth;
    for (const path of streets) {
        drawPath(ctx, path);
    }

    // Pick infrastructure streets (whole connected paths)
    const infraCount = Math.min(params.infraDensity, streets.length);
    const infraIndices = [];
    const available = streets.map((_, i) => i);
    for (let i = 0; i < infraCount; i++) {
        const pick = rng.int(0, available.length);
        infraIndices.push(available.splice(pick, 1)[0]);
    }

    const cicloviaWeight = params.cicloviaWeight;
    const useLightColors = params.useLightColors !== undefined ? params.useLightColors : true;
    const infraColorSet = useLightColors ? INFRA_COLORS_LIGHT : INFRA_COLORS;

    const infraRng = createRng(seed + 9999);
    const infraMeta = infraIndices.map(idx => {
        const isCiclovia = infraRng.chance(cicloviaWeight);
        const dashed = params.showDashed && !isCiclovia && infraRng.chance(0.5);
        return { idx, isCiclovia, dashed };
    });

    // Border pass
    const borderWidth = params.infraLineWidth + params.infraBorder * 2;
    ctx.strokeStyle = COLORS.bg;
    ctx.setLineDash([]);
    ctx.lineWidth = borderWidth;
    for (const { idx } of infraMeta) {
        drawPath(ctx, streets[idx]);
    }

    // Infrastructure fill pass
    for (const { idx, isCiclovia, dashed } of infraMeta) {
        ctx.strokeStyle = isCiclovia ? infraColorSet[0] : infraColorSet[1];
        ctx.lineWidth = params.infraLineWidth;

        if (dashed) {
            const dashLen = params.infraLineWidth * 2;
            ctx.setLineDash([dashLen, dashLen]);
        } else {
            ctx.setLineDash([]);
        }
        drawPath(ctx, streets[idx]);
    }

    ctx.setLineDash([]);

    // POIs — placed at actual intersection nodes
    if (params.poiCount > 0 && params.poiTypes.length > 0) {
        const poiColors = params.poiTypes.map(t => {
            if (t === 'shops') return COLORS.poiShops;
            if (t === 'rental') return COLORS.poiRental;
            return COLORS.poiParking;
        });

        const count = Math.min(params.poiCount, intersections.length);
        const usedIndices = [];
        const avail = intersections.map((_, i) => i);
        for (let i = 0; i < count; i++) {
            const pick = rng.int(0, avail.length);
            usedIndices.push(avail.splice(pick, 1)[0]);
        }

        for (const ni of usedIndices) {
            const node = intersections[ni];
            ctx.fillStyle = rng.pick(poiColors);
            ctx.beginPath();
            ctx.arc(node.x, node.y, params.poiSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

// --- Export helpers ---

export function canvasToPngBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export function downloadCanvas(canvas, filename = 'logo.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

export function downloadMatrixAsPng(canvases, cols, gap, filename = 'logo-matrix.png') {
    if (!canvases.length) return;
    const first = canvases[0];
    const cellW = first.width / (window.devicePixelRatio || 1);
    const cellH = first.height / (window.devicePixelRatio || 1);
    const rows = Math.ceil(canvases.length / cols);
    const dpr = window.devicePixelRatio || 1;

    const totalW = cols * cellW + (cols - 1) * gap;
    const totalH = rows * cellH + (rows - 1) * gap;

    const out = document.createElement('canvas');
    out.width = totalW * dpr;
    out.height = totalH * dpr;
    const ctx = out.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, totalW, totalH);

    canvases.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (cellW + gap);
        const y = row * (cellH + gap);
        ctx.drawImage(c, 0, 0, c.width, c.height, x, y, cellW, cellH);
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = out.toDataURL('image/png');
    link.click();
}

// Default params
export const DEFAULT_PARAMS = {
    pattern: 'organic',
    streetCount: 12,
    curviness: 0.5,
    streetWidth: 2,
    irregularity: 0.3,

    infraDensity: 3,
    cicloviaWeight: 0.6,
    infraLineWidth: 3,
    infraBorder: 2,
    showDashed: true,
    useLightColors: true,

    poiCount: 5,
    poiSize: 4,
    poiTypes: ['shops', 'rental', 'parking'],

    shape: 'squircle',
    logoSize: 200,
    padding: 0.08,
    lineCap: 'round',

    gridCols: 5,
    gridRows: 4,
    masterSeed: 42,
    variationSpread: 0.5,
};
