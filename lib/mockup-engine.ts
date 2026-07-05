/*
 * Mockup Engine — client-side device-frame renderer (compositing model).
 * Pure Canvas 2D. Ported to a TypeScript ES module for Next.js.
 *
 * Pipeline: build frame layer (device + screenshot) -> optional 3D tilt ->
 *           compose onto output canvas (background, shadow, watermark, QR).
 *
 * Browser-only: every DOM/Canvas reference lives inside a method, so the
 * module is safe to import in a "use client" component (never touched on SSR).
 */
import qrcode from "./qrcode";

export type CornerPos = "tl" | "tr" | "bl" | "br" | "center";

export type Background =
  | { type: "transparent"; label?: string }
  | { type: "solid"; color: string; label?: string }
  | { type: "gradient"; stops: string[]; angle?: number; label?: string }
  | { type: "image"; img: HTMLImageElement; label?: string };

export interface Watermark {
  text: string;
  position?: CornerPos;
  opacity?: number;
  color?: string;
  size?: number;
}

export interface QROpts {
  data: string;
  position?: CornerPos;
  size?: number;
  fg?: string;
  bg?: string;
  frame?: boolean;
}

export interface EngineOptions {
  device: string;
  background: string | Background;
  padding: number;
  radius: number;
  shadow: number;
  tilt: number;
  browserUrl: string;
  preset: { w: number; h: number } | null;
  maxScreen: number;
  watermark: Watermark | null;
  qr: QROpts | null;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const BACKGROUNDS: Record<string, Background> = {
  transparent: { type: "transparent", label: "Transparent" },
  white: { type: "solid", color: "#ffffff", label: "White" },
  light: { type: "solid", color: "#f4f4f5", label: "Light gray" },
  dark: { type: "solid", color: "#111114", label: "Dark" },
  sunset: { type: "gradient", stops: ["#ff9a9e", "#fad0c4", "#fecfef"], angle: 135, label: "Sunset" },
  ocean: { type: "gradient", stops: ["#2193b0", "#6dd5ed"], angle: 135, label: "Ocean" },
  violet: { type: "gradient", stops: ["#667eea", "#764ba2"], angle: 135, label: "Violet" },
  indigo: { type: "gradient", stops: ["#4f46e5", "#7c3aed"], angle: 135, label: "Indigo" },
  mint: { type: "gradient", stops: ["#43e97b", "#38f9d7"], angle: 135, label: "Mint" },
  peach: { type: "gradient", stops: ["#ffecd2", "#fcb69f"], angle: 135, label: "Peach" },
  midnight: { type: "gradient", stops: ["#0f2027", "#203a43", "#2c5364"], angle: 135, label: "Midnight" },
  candy: { type: "gradient", stops: ["#a18cd1", "#fbc2eb"], angle: 135, label: "Candy" },
  fire: { type: "gradient", stops: ["#f83600", "#f9d423"], angle: 135, label: "Fire" },
  aurora: { type: "gradient", stops: ["#00c6ff", "#7f00ff", "#ff006e"], angle: 120, label: "Aurora" },
  forest: { type: "gradient", stops: ["#134e5e", "#71b280"], angle: 135, label: "Forest" },
  slate: { type: "gradient", stops: ["#232526", "#414345"], angle: 135, label: "Slate" },
  coral: { type: "gradient", stops: ["#ff512f", "#f09819"], angle: 135, label: "Coral" },
};

export const DEVICES = [
  { id: "none", label: "No frame" },
  { id: "browser", label: "Browser" },
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "ipad", label: "iPad" },
  { id: "macbook", label: "MacBook" },
];

export const PRESETS = [
  { id: "auto", label: "Auto" },
  { id: "og", label: "OG 1200×630", w: 1200, h: 630 },
  { id: "x", label: "X 16:9", w: 1600, h: 900 },
  { id: "ig", label: "IG 1:1", w: 1080, h: 1080 },
  { id: "igstory", label: "IG Story", w: 1080, h: 1920 },
  { id: "ph", label: "ProductHunt", w: 1270, h: 760 },
  { id: "square", label: "Square 2K", w: 2000, h: 2000 },
];

export const CORNERS: CornerPos[] = ["tl", "tr", "bl", "br", "center"];

function cornerPos(
  pos: CornerPos,
  boxW: number,
  boxH: number,
  W: number,
  H: number,
  margin: number
) {
  switch (pos) {
    case "tl":
      return { x: margin, y: margin };
    case "tr":
      return { x: W - boxW - margin, y: margin };
    case "bl":
      return { x: margin, y: H - boxH - margin };
    case "center":
      return { x: (W - boxW) / 2, y: (H - boxH) / 2 };
    case "br":
    default:
      return { x: W - boxW - margin, y: H - boxH - margin };
  }
}

export class MockupEngine {
  static BACKGROUNDS = BACKGROUNDS;
  static DEVICES = DEVICES;
  static PRESETS = PRESETS;
  static CORNERS = CORNERS;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement | null = null;
  private _qrCache: { data: string; canvas: HTMLCanvasElement } | null = null;
  opts: EngineOptions;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.opts = {
      device: "browser",
      background: "violet",
      padding: 90,
      radius: 20,
      shadow: 0.35,
      tilt: 0,
      browserUrl: "yoursite.com",
      preset: null,
      maxScreen: 1500,
      watermark: null,
      qr: null,
    };
  }

  setImage(src: HTMLImageElement | Blob | string, cb?: () => void) {
    if (src instanceof HTMLImageElement) {
      this.image = src;
      if (cb) cb();
      this.render();
      return;
    }
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const img = new Image();
    img.onload = () => {
      this.image = img;
      if (cb) cb();
      this.render();
      if (src instanceof Blob) URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  setOptions(patch: Partial<EngineOptions>) {
    Object.assign(this.opts, patch);
    if (patch.qr && patch.qr.data !== undefined) this._qrCache = null;
    this.render();
  }

  // ---------- background ----------
  private _resolveBg(): Background {
    const bg = this.opts.background;
    if (typeof bg === "string") return BACKGROUNDS[bg] || BACKGROUNDS.white;
    return bg;
  }

  private _paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bg = this._resolveBg();
    if (!bg || bg.type === "transparent") return;
    if (bg.type === "solid") {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (bg.type === "image" && bg.img) {
      const iw = bg.img.naturalWidth,
        ih = bg.img.naturalHeight;
      const sc = Math.max(w / iw, h / ih);
      ctx.drawImage(bg.img, (w - iw * sc) / 2, (h - ih * sc) / 2, iw * sc, ih * sc);
      return;
    }
    if (bg.type === "gradient") {
      const ang = ((bg.angle || 135) * Math.PI) / 180;
      const cx = w / 2,
        cy = h / 2;
      const len = Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang));
      const dx = (Math.cos(ang) * len) / 2,
        dy = (Math.sin(ang) * len) / 2;
      const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      const stops = bg.stops;
      for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ---------- screen sizing ----------
  private _screenSize() {
    const img = this.image;
    let w = img ? img.naturalWidth : 1200;
    let h = img ? img.naturalHeight : 750;
    const max = this.opts.maxScreen,
      longest = Math.max(w, h);
    if (longest > max) {
      const s = max / longest;
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    return { w, h };
  }

  private _drawScreen(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    if (this.image) {
      const iw = this.image.naturalWidth,
        ih = this.image.naturalHeight;
      const scale = Math.max(w / iw, h / ih),
        dw = iw * scale,
        dh = ih * scale;
      ctx.drawImage(this.image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#9ca3af";
      ctx.font = Math.round(h / 12) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Upload an image", x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  // ---------- frame renderers (draw flat at ox,oy on the given ctx) ----------
  private _frameNone(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: { w: number; h: number }) {
    const r = this.opts.radius;
    roundRect(ctx, ox, oy, s.w, s.h, r);
    ctx.fillStyle = "#000";
    ctx.fill();
    this._drawScreen(ctx, ox, oy, s.w, s.h, r);
    return { w: s.w, h: s.h };
  }

  private _framePhone(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    s: { w: number; h: number },
    kind: string
  ) {
    const bezel = Math.max(10, Math.round(s.w * 0.03));
    const outerR = Math.round(bezel * 3.2) + this.opts.radius;
    const fw = s.w + bezel * 2,
      fh = s.h + bezel * 2;
    roundRect(ctx, ox, oy, fw, fh, outerR);
    ctx.fillStyle = kind === "android" ? "#0b0b0d" : "#1c1c1e";
    ctx.fill();
    roundRect(ctx, ox + 1.5, oy + 1.5, fw - 3, fh - 3, outerR - 1.5);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.stroke();
    const sx = ox + bezel,
      sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    if (kind === "android") {
      const cr = Math.max(5, bezel * 0.45);
      ctx.beginPath();
      ctx.arc(sx + s.w / 2, sy + bezel * 0.9, cr, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
    } else {
      const iw = Math.round(s.w * 0.32),
        ih = Math.round(bezel * 1.15);
      roundRect(ctx, sx + (s.w - iw) / 2, sy + bezel * 0.55, iw, ih, ih / 2);
      ctx.fillStyle = "#000";
      ctx.fill();
    }
    return { w: fw, h: fh };
  }

  private _frameTablet(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: { w: number; h: number }) {
    const bezel = Math.max(14, Math.round(Math.min(s.w, s.h) * 0.035));
    const outerR = Math.round(bezel * 1.6) + this.opts.radius;
    const fw = s.w + bezel * 2,
      fh = s.h + bezel * 2;
    roundRect(ctx, ox, oy, fw, fh, outerR);
    ctx.fillStyle = "#161618";
    ctx.fill();
    const sx = ox + bezel,
      sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    const cr = Math.max(3, bezel * 0.18);
    ctx.beginPath();
    ctx.arc(ox + fw / 2, oy + bezel / 2, cr, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2a2e";
    ctx.fill();
    return { w: fw, h: fh };
  }

  private _frameMacbook(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: { w: number; h: number }) {
    const bezel = Math.max(10, Math.round(s.w * 0.018));
    const topBar = bezel,
      screenR = Math.min(this.opts.radius, 14);
    const lidW = s.w + bezel * 2,
      lidH = s.h + bezel * 2 + topBar;
    const baseH = Math.round(lidW * 0.02),
      baseOverW = Math.round(lidW * 0.065);
    const fw = lidW + baseOverW * 2,
      fh = lidH + baseH + Math.round(lidW * 0.012);
    const lidX = ox + baseOverW,
      lidY = oy;
    roundRect(ctx, lidX, lidY, lidW, lidH, 26);
    ctx.fillStyle = "#141416";
    ctx.fill();
    const sx = lidX + bezel,
      sy = lidY + bezel + topBar;
    this._drawScreen(ctx, sx, sy, s.w, s.h, screenR);
    ctx.beginPath();
    ctx.arc(lidX + lidW / 2, lidY + topBar * 0.55, Math.max(2, bezel * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = "#2b2b30";
    ctx.fill();
    const baseY = lidY + lidH;
    const baseGrad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
    baseGrad.addColorStop(0, "#c8ccd2");
    baseGrad.addColorStop(1, "#9aa0a8");
    roundRect(ctx, ox, baseY, fw, baseH, 6);
    ctx.fillStyle = baseGrad;
    ctx.fill();
    const nW = Math.round(fw * 0.16),
      nH = baseH * 0.55;
    roundRect(ctx, ox + (fw - nW) / 2, baseY, nW, nH, nH);
    ctx.fillStyle = "#8b9098";
    ctx.fill();
    return { w: fw, h: fh };
  }

  private _frameBrowser(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: { w: number; h: number }) {
    const chrome = Math.max(34, Math.round(s.w * 0.045));
    const pad = Math.round(chrome * 0.28),
      r = this.opts.radius;
    const fw = s.w,
      fh = s.h + chrome;
    roundRect(ctx, ox, oy, fw, fh, r);
    ctx.fillStyle = "#f1f1f3";
    ctx.fill();
    ctx.save();
    roundRect(ctx, ox, oy, fw, chrome + r, r);
    ctx.clip();
    ctx.fillStyle = "#e9e9ec";
    ctx.fillRect(ox, oy, fw, chrome);
    ctx.restore();
    const dr = Math.max(4, chrome * 0.12),
      cy = oy + chrome / 2;
    const colors = ["#ff5f57", "#febc2e", "#28c840"];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(ox + pad + dr + i * (dr * 2.6), cy, dr, 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
    const pillX = ox + pad * 2 + dr * 8,
      pillW = fw - (pillX - ox) - pad * 1.5,
      pillH = chrome * 0.56;
    roundRect(ctx, pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = "#8a8a90";
    ctx.font = Math.round(pillH * 0.5) + 'px -apple-system, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔒 " + (this.opts.browserUrl || "yoursite.com"), pillX + pillH * 0.5, cy + 1);
    const sy = oy + chrome;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ox, sy);
    ctx.lineTo(ox + s.w, sy);
    ctx.lineTo(ox + s.w, sy + s.h - r);
    ctx.arcTo(ox + s.w, sy + s.h, ox + s.w - r, sy + s.h, r);
    ctx.lineTo(ox + r, sy + s.h);
    ctx.arcTo(ox, sy + s.h, ox, sy + s.h - r, r);
    ctx.closePath();
    ctx.clip();
    if (this.image) {
      const iw = this.image.naturalWidth,
        ih = this.image.naturalHeight;
      const scale = Math.max(s.w / iw, s.h / ih);
      ctx.drawImage(this.image, ox + (s.w - iw * scale) / 2, sy + (s.h - ih * scale) / 2, iw * scale, ih * scale);
    } else {
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(ox, sy, s.w, s.h);
    }
    ctx.restore();
    return { w: fw, h: fh };
  }

  private _measure(dev: string, s: { w: number; h: number }) {
    switch (dev) {
      case "none":
        return { w: s.w, h: s.h };
      case "iphone":
      case "android": {
        const b = Math.max(10, Math.round(s.w * 0.03));
        return { w: s.w + b * 2, h: s.h + b * 2 };
      }
      case "ipad": {
        const b2 = Math.max(14, Math.round(Math.min(s.w, s.h) * 0.035));
        return { w: s.w + b2 * 2, h: s.h + b2 * 2 };
      }
      case "macbook": {
        const bz = Math.max(10, Math.round(s.w * 0.018));
        const lidW = s.w + bz * 2,
          lidH = s.h + bz * 2 + bz,
          baseH = Math.round(lidW * 0.02),
          over = Math.round(lidW * 0.065);
        return { w: lidW + over * 2, h: lidH + baseH + Math.round(lidW * 0.012) };
      }
      case "browser":
      default: {
        const c = Math.max(34, Math.round(s.w * 0.045));
        return { w: s.w, h: s.h + c };
      }
    }
  }

  private _buildFrameLayer(dev: string, s: { w: number; h: number }, m: { w: number; h: number }) {
    const lc = document.createElement("canvas");
    lc.width = m.w;
    lc.height = m.h;
    const lctx = lc.getContext("2d") as CanvasRenderingContext2D;
    switch (dev) {
      case "none":
        this._frameNone(lctx, 0, 0, s);
        break;
      case "iphone":
        this._framePhone(lctx, 0, 0, s, "iphone");
        break;
      case "android":
        this._framePhone(lctx, 0, 0, s, "android");
        break;
      case "ipad":
        this._frameTablet(lctx, 0, 0, s);
        break;
      case "macbook":
        this._frameMacbook(lctx, 0, 0, s);
        break;
      default:
        this._frameBrowser(lctx, 0, 0, s);
    }
    return lc;
  }

  // Pseudo-3D Y-axis rotation via per-column perspective projection.
  private _tiltLayer(src: HTMLCanvasElement, deg: number) {
    const a = (deg * Math.PI) / 180,
      W = src.width,
      H = src.height;
    const f = Math.max(W, H) * 2.4;
    const cols: { sx: number; px: number; s: number }[] = [];
    let minX = Infinity,
      maxX = -Infinity,
      maxHalf = 0;
    for (let sx = 0; sx <= W; sx++) {
      const u = sx - W / 2,
        z = u * Math.sin(a),
        sc = f / (f + z);
      const px = u * Math.cos(a) * sc;
      cols.push({ sx, px, s: sc });
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      const half = (H / 2) * sc;
      if (half > maxHalf) maxHalf = half;
    }
    const outW = Math.ceil(maxX - minX) + 2,
      outH = Math.ceil(2 * maxHalf) + 2;
    const dc = document.createElement("canvas");
    dc.width = outW;
    dc.height = outH;
    const dctx = dc.getContext("2d") as CanvasRenderingContext2D;
    const cx = -minX + 1,
      cy = outH / 2;
    const order = cols.slice(0, cols.length - 1);
    if (deg > 0) order.reverse();
    for (let i = 0; i < order.length; i++) {
      const idx = cols.indexOf(order[i]);
      const c0 = cols[idx],
        c1 = cols[idx + 1];
      const dx0 = cx + c0.px,
        dx1 = cx + c1.px;
      const dwid = Math.max(1, Math.abs(dx1 - dx0) + 0.7);
      const dh = H * c0.s,
        dy = cy - dh / 2;
      dctx.drawImage(src, c0.sx, 0, 1, H, Math.min(dx0, dx1), dy, dwid, dh);
    }
    return dc;
  }

  // ---------- QR ----------
  private _getQR(data: string): HTMLCanvasElement | null {
    if (this._qrCache && this._qrCache.data === data) return this._qrCache.canvas;
    try {
      const q = qrcode(0, "M");
      q.addData(data);
      q.make();
      const n = q.getModuleCount();
      const qc = document.createElement("canvas");
      qc.width = n;
      qc.height = n;
      const qx = qc.getContext("2d") as CanvasRenderingContext2D;
      qx.fillStyle = "#fff";
      qx.fillRect(0, 0, n, n);
      qx.fillStyle = "#000";
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) if (q.isDark(r, c)) qx.fillRect(c, r, 1, 1);
      this._qrCache = { data, canvas: qc };
      return qc;
    } catch (e) {
      return null;
    }
  }

  private _drawQR(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const qr = this.opts.qr;
    if (!qr || !qr.data) return;
    const src = this._getQR(qr.data);
    if (!src) return;
    const size = Math.round(Math.min(W, H) * (qr.size || 0.16));
    const margin = Math.round(Math.min(W, H) * 0.03);
    const framePad = qr.frame ? Math.round(size * 0.12) : 0;
    const boxW = size + framePad * 2,
      boxH = size + framePad * 2;
    const p = cornerPos(qr.position || "br", boxW, boxH, W, H, margin);
    if (qr.frame) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = size * 0.12;
      ctx.shadowOffsetY = size * 0.04;
      roundRect(ctx, p.x, p.y, boxW, boxH, framePad * 0.9);
      ctx.fillStyle = qr.bg || "#ffffff";
      ctx.fill();
      ctx.restore();
    }
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, p.x + framePad, p.y + framePad, size, size);
    ctx.imageSmoothingEnabled = prev;
  }

  // ---------- watermark ----------
  private _drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const wm = this.opts.watermark;
    if (!wm || !wm.text) return;
    const size = Math.max(11, Math.round(Math.min(W, H) * (wm.size || 0.03)));
    const margin = Math.round(Math.min(W, H) * 0.035);
    ctx.save();
    ctx.font = "600 " + size + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.globalAlpha = wm.opacity != null ? wm.opacity : 0.6;
    ctx.fillStyle = wm.color || "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = 1;
    const pos = wm.position || "br";
    let x: number, y: number;
    ctx.textBaseline = "alphabetic";
    if (pos === "tl") {
      ctx.textAlign = "left";
      x = margin;
      y = margin + size;
    } else if (pos === "tr") {
      ctx.textAlign = "right";
      x = W - margin;
      y = margin + size;
    } else if (pos === "bl") {
      ctx.textAlign = "left";
      x = margin;
      y = H - margin;
    } else if (pos === "center") {
      ctx.textAlign = "center";
      x = W / 2;
      y = H / 2;
    } else {
      ctx.textAlign = "right";
      x = W - margin;
      y = H - margin;
    }
    ctx.fillText(wm.text, x, y);
    ctx.restore();
  }

  // ---------- compose ----------
  render() {
    const ctx = this.ctx,
      s = this._screenSize(),
      dev = this.opts.device;
    const m = this._measure(dev, s);
    let layer = this._buildFrameLayer(dev, s, m);
    if (this.opts.tilt) layer = this._tiltLayer(layer, this.opts.tilt);

    const preset = this.opts.preset,
      pad = this.opts.padding;
    let outW: number, outH: number;
    if (preset) {
      outW = preset.w;
      outH = preset.h;
    } else {
      outW = Math.round(layer.width + pad * 2);
      outH = Math.round(layer.height + pad * 2);
    }

    this.canvas.width = outW;
    this.canvas.height = outH;
    ctx.clearRect(0, 0, outW, outH);
    this._paintBackground(ctx, outW, outH);

    const availW = Math.max(1, outW - pad * 2),
      availH = Math.max(1, outH - pad * 2);
    const scale = preset ? Math.min(availW / layer.width, availH / layer.height) : 1;
    const dw = layer.width * scale,
      dh = layer.height * scale;
    const dx = (outW - dw) / 2,
      dy = (outH - dh) / 2;

    const sh = this.opts.shadow;
    if (sh > 0) {
      const ref = Math.min(dw, dh);
      ctx.shadowColor = "rgba(0,0,0," + (0.55 * sh).toFixed(3) + ")";
      ctx.shadowBlur = ref * 0.1 * sh + 12;
      ctx.shadowOffsetY = ref * 0.05 * sh + 8;
    }
    ctx.drawImage(layer, dx, dy, dw, dh);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    this._drawWatermark(ctx, outW, outH);
    this._drawQR(ctx, outW, outH);
  }

  // ---------- output ----------
  toDataURL(type?: string) {
    return this.canvas.toDataURL(type || "image/png");
  }

  download(filename?: string) {
    const a = document.createElement("a");
    a.download = filename || "mockup.png";
    a.href = this.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  copyToClipboard(): Promise<void> {
    return new Promise((resolve, reject) => {
      const g = window as unknown as { ClipboardItem?: typeof ClipboardItem };
      if (!this.canvas.toBlob || !navigator.clipboard || !g.ClipboardItem) {
        reject(new Error("Clipboard image not supported"));
        return;
      }
      this.canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("toBlob failed"));
          return;
        }
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blob })])
          .then(() => resolve(), reject);
      }, "image/png");
    });
  }
}
