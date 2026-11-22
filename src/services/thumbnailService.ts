export type ThumbnailAspect = '16:9' | '9:16';

export type ThumbnailThemeId = 'gold' | 'horror' | 'neon' | 'pastel';

export interface ThumbnailRenderOptions {
  aspect: ThumbnailAspect;
  theme: ThumbnailThemeId;
  title: string;
  badgeText: string;
  channelTag: string;
  backgroundUrl?: string | null;
  logoUrl?: string | null;
}

export const THUMBNAIL_THEMES: Array<{
  id: ThumbnailThemeId;
  label: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  gradStart: string;
  gradEnd: string;
  glow: string;
}> = [
  {
    id: 'gold',
    label: 'সিনেম্যাটিক গোল্ড',
    accent: '#fbbf24',
    badgeBg: '#f59e0b',
    badgeText: '#090d16',
    gradStart: '#0b1020',
    gradEnd: '#1e1b2e',
    glow: 'rgba(245, 158, 11, 0.35)',
  },
  {
    id: 'horror',
    label: 'হরর ব্লাড রেড',
    accent: '#f43f5e',
    badgeBg: '#e11d48',
    badgeText: '#ffffff',
    gradStart: '#12060b',
    gradEnd: '#2b0913',
    glow: 'rgba(244, 63, 94, 0.42)',
  },
  {
    id: 'neon',
    label: 'নিয়ন সাইবার',
    accent: '#22d3ee',
    badgeBg: '#06b6d4',
    badgeText: '#04121b',
    gradStart: '#06111c',
    gradEnd: '#1a0b2e',
    glow: 'rgba(34, 211, 238, 0.38)',
  },
  {
    id: 'pastel',
    label: 'কিউট প্যাস্টেল',
    accent: '#f472b6',
    badgeBg: '#ec4899',
    badgeText: '#ffffff',
    gradStart: '#221336',
    gradEnd: '#3b1c4a',
    glow: 'rgba(244, 114, 182, 0.42)',
  },
];

async function loadImageSafe(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width <= maxW) {
      cur = cand;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders a crisp, high-resolution YouTube (1280x720) or Reels (1080x1920) thumbnail onto the given canvas.
 */
export async function renderThumbnailToCanvas(
  canvas: HTMLCanvasElement,
  options: ThumbnailRenderOptions
): Promise<void> {
  const isPortrait = options.aspect === '9:16';
  const width = isPortrait ? 1080 : 1280;
  const height = isPortrait ? 1920 : 720;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = THUMBNAIL_THEMES.find((t) => t.id === options.theme) || THUMBNAIL_THEMES[0];
  const [bgImg, logoImg] = await Promise.all([
    loadImageSafe(options.backgroundUrl),
    loadImageSafe(options.logoUrl),
  ]);

  // 1. Background image or gradient
  if (bgImg) {
    const imgRatio = bgImg.width / Math.max(1, bgImg.height);
    const canvasRatio = width / height;
    let dw = width;
    let dh = height;
    if (imgRatio > canvasRatio) {
      dw = dh * imgRatio;
    } else {
      dh = dw / imgRatio;
    }
    ctx.drawImage(bgImg, (width - dw) / 2, (height - dh) / 2, dw, dh);
  } else {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, theme.gradStart);
    bg.addColorStop(1, theme.gradEnd);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Dramatic studio lighting & readability vignette
  const rad = ctx.createRadialGradient(width * 0.5, height * 0.35, 30, width * 0.5, height * 0.45, width * 0.72);
  rad.addColorStop(0, theme.glow);
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, width, height);

  const vig = ctx.createLinearGradient(0, 0, 0, height);
  vig.addColorStop(0, 'rgba(4, 7, 15, 0.55)');
  vig.addColorStop(0.45, 'rgba(4, 7, 15, 0.25)');
  vig.addColorStop(1, 'rgba(4, 7, 15, 0.90)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Subtle inner frame accent border
  ctx.save();
  ctx.strokeStyle = theme.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = isPortrait ? 10 : 8;
  roundRect(ctx, 26, 26, width - 52, height - 52, 28);
  ctx.stroke();
  ctx.restore();

  // 3. Optional top badge
  const badge = options.badgeText.trim();
  if (badge) {
    const badgeFont = isPortrait ? 44 : 34;
    ctx.save();
    ctx.font = `800 ${badgeFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
    const bw = ctx.measureText(badge).width + 64;
    const bh = badgeFont + 32;
    const bx = (width - bw) / 2;
    const by = isPortrait ? height * 0.16 : height * 0.13;
    ctx.fillStyle = theme.badgeBg;
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.fillStyle = theme.badgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, width / 2, by + bh / 2 + 2);
    ctx.restore();
  }

  // 4. Giant Bold Viral Title
  const cleanTitle = options.title.trim() || 'আপনার ভিডিওর শিরোনাম লিখুন';
  const titleFont = isPortrait ? 94 : 84;
  ctx.save();
  ctx.font = `800 ${titleFont}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapLines(ctx, cleanTitle, width * 0.84, isPortrait ? 4 : 3);
  const lineH = titleFont * 1.22;
  const totalTextH = lines.length * lineH;
  const startY = (isPortrait ? height * 0.62 : height * 0.58) - totalTextH / 2 + lineH / 2;

  ctx.shadowColor = 'rgba(0,0,0,0.88)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.lineWidth = isPortrait ? 16 : 14;
  ctx.strokeStyle = 'rgba(6, 9, 18, 0.94)';

  lines.forEach((line, idx) => {
    const ly = startY + idx * lineH;
    ctx.strokeText(line, width / 2, ly);
    // Highlight last line in theme accent color for viral YouTube thumbnail punch!
    ctx.fillStyle = idx === lines.length - 1 && lines.length > 1 ? theme.accent : '#ffffff';
    ctx.fillText(line, width / 2, ly);
  });
  ctx.restore();

  // 5. Channel Logo & Tag at bottom corner
  const tag = options.channelTag.trim();
  if (logoImg || tag) {
    ctx.save();
    const pad = isPortrait ? 64 : 52;
    let xCursor = pad;
    const baseY = height - pad - 24;

    if (logoImg) {
      const logoSize = isPortrait ? 78 : 64;
      ctx.save();
      roundRect(ctx, xCursor, baseY - logoSize / 2, logoSize, logoSize, 14);
      ctx.clip();
      ctx.drawImage(logoImg, xCursor, baseY - logoSize / 2, logoSize, logoSize);
      ctx.restore();
      xCursor += logoSize + 18;
    }

    if (tag) {
      ctx.font = `700 ${isPortrait ? 38 : 30}px "Hind Siliguri", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText(tag, xCursor, baseY);
    }
    ctx.restore();
  }
}
