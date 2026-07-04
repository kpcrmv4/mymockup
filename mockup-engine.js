/*
 * Mockup Engine — client-side device-frame renderer (compositing model).
 * Pure Canvas 2D. Optional QR support via global `qrcode` (qrcode.js).
 *
 * Pipeline: build frame layer (device + screenshot) -> optional 3D tilt ->
 *           compose onto output canvas (background, shadow, watermark, QR).
 */
(function (global) {
  'use strict';

  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var BACKGROUNDS = {
    transparent: { type: 'transparent', label: 'Transparent' },
    white:       { type: 'solid', color: '#ffffff', label: 'White' },
    light:       { type: 'solid', color: '#f4f4f5', label: 'Light gray' },
    dark:        { type: 'solid', color: '#111114', label: 'Dark' },
    sunset:      { type: 'gradient', stops: ['#ff9a9e', '#fad0c4', '#fecfef'], angle: 135, label: 'Sunset' },
    ocean:       { type: 'gradient', stops: ['#2193b0', '#6dd5ed'], angle: 135, label: 'Ocean' },
    violet:      { type: 'gradient', stops: ['#667eea', '#764ba2'], angle: 135, label: 'Violet' },
    mint:        { type: 'gradient', stops: ['#43e97b', '#38f9d7'], angle: 135, label: 'Mint' },
    peach:       { type: 'gradient', stops: ['#ffecd2', '#fcb69f'], angle: 135, label: 'Peach' },
    midnight:    { type: 'gradient', stops: ['#0f2027', '#203a43', '#2c5364'], angle: 135, label: 'Midnight' },
    candy:       { type: 'gradient', stops: ['#a18cd1', '#fbc2eb'], angle: 135, label: 'Candy' },
    fire:        { type: 'gradient', stops: ['#f83600', '#f9d423'], angle: 135, label: 'Fire' },
    aurora:      { type: 'gradient', stops: ['#00c6ff', '#7f00ff', '#ff006e'], angle: 120, label: 'Aurora' },
    forest:      { type: 'gradient', stops: ['#134e5e', '#71b280'], angle: 135, label: 'Forest' },
    slate:       { type: 'gradient', stops: ['#232526', '#414345'], angle: 135, label: 'Slate' },
    coral:       { type: 'gradient', stops: ['#ff512f', '#f09819'], angle: 135, label: 'Coral' }
  };

  var DEVICES = [
    { id: 'none',    label: 'No frame' },
    { id: 'browser', label: 'Browser' },
    { id: 'iphone',  label: 'iPhone' },
    { id: 'android', label: 'Android' },
    { id: 'ipad',    label: 'iPad' },
    { id: 'macbook', label: 'MacBook' }
  ];

  // Social / output size presets (null = auto-fit around the frame)
  var PRESETS = [
    { id: 'auto',    label: 'Auto' },
    { id: 'og',      label: 'OG 1200×630', w: 1200, h: 630 },
    { id: 'x',       label: 'X 16:9',      w: 1600, h: 900 },
    { id: 'ig',      label: 'IG 1:1',      w: 1080, h: 1080 },
    { id: 'igstory', label: 'IG Story',    w: 1080, h: 1920 },
    { id: 'ph',      label: 'ProductHunt', w: 1270, h: 760 },
    { id: 'square',  label: 'Square 2K',   w: 2000, h: 2000 }
  ];

  var CORNERS = ['tl', 'tr', 'bl', 'br', 'center'];

  function MockupEngine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;
    this._qrCache = null;
    this.opts = {
      device: 'browser',
      background: 'violet',
      padding: 90,
      radius: 20,
      shadow: 0.35,
      tilt: 0,                 // -35..35 degrees (Y-axis 3D rotation)
      browserUrl: 'yoursite.com',
      preset: null,            // {w,h} or null
      maxScreen: 1500,
      watermark: null,         // {text, position, opacity, color, size}
      qr: null                 // {data, position, size, fg, bg, frame}
    };
  }

  MockupEngine.prototype.setImage = function (src, cb) {
    var self = this;
    if (src instanceof Image) { this.image = src; if (cb) cb(); this.render(); return; }
    var url = (src instanceof Blob) ? URL.createObjectURL(src) : src;
    var img = new Image();
    img.onload = function () {
      self.image = img; if (cb) cb(); self.render();
      if (src instanceof Blob) URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  MockupEngine.prototype.setOptions = function (patch) {
    for (var k in patch) if (patch.hasOwnProperty(k)) this.opts[k] = patch[k];
    if (patch.qr && patch.qr.data !== undefined) this._qrCache = null;
    this.render();
  };

  // ---------- background ----------
  MockupEngine.prototype._resolveBg = function () {
    var bg = this.opts.background;
    if (typeof bg === 'string') return BACKGROUNDS[bg] || BACKGROUNDS.white;
    return bg;
  };

  MockupEngine.prototype._paintBackground = function (ctx, w, h) {
    var bg = this._resolveBg();
    if (!bg || bg.type === 'transparent') return;
    if (bg.type === 'solid') { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, w, h); return; }
    if (bg.type === 'image' && bg.img) {
      var iw = bg.img.naturalWidth, ih = bg.img.naturalHeight;
      var sc = Math.max(w / iw, h / ih);
      ctx.drawImage(bg.img, (w - iw * sc) / 2, (h - ih * sc) / 2, iw * sc, ih * sc);
      return;
    }
    // gradient
    var ang = (bg.angle || 135) * Math.PI / 180;
    var cx = w / 2, cy = h / 2;
    var len = Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang));
    var dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    var g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    var stops = bg.stops;
    for (var i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };

  // ---------- screen sizing ----------
  MockupEngine.prototype._screenSize = function () {
    var img = this.image;
    var w = img ? img.naturalWidth : 1200;
    var h = img ? img.naturalHeight : 750;
    var max = this.opts.maxScreen, longest = Math.max(w, h);
    if (longest > max) { var s = max / longest; w = Math.round(w * s); h = Math.round(h * s); }
    return { w: w, h: h };
  };

  MockupEngine.prototype._drawScreen = function (ctx, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    if (this.image) {
      var iw = this.image.naturalWidth, ih = this.image.naturalHeight;
      var scale = Math.max(w / iw, h / ih), dw = iw * scale, dh = ih * scale;
      ctx.drawImage(this.image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#9ca3af'; ctx.font = (Math.round(h / 12)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Upload an image', x + w / 2, y + h / 2);
    }
    ctx.restore();
  };

  // Shadow is applied at compose time (on the whole frame layer), so frame
  // renderers draw the body flat.
  MockupEngine.prototype._applyShadow = function () {};
  MockupEngine.prototype._clearShadow = function () {};

  // ---------- frame renderers (draw flat at ox,oy on the given ctx) ----------
  MockupEngine.prototype._frameNone = function (ctx, ox, oy, s) {
    var r = this.opts.radius;
    roundRect(ctx, ox, oy, s.w, s.h, r); ctx.fillStyle = '#000'; ctx.fill();
    this._drawScreen(ctx, ox, oy, s.w, s.h, r);
    return { w: s.w, h: s.h };
  };

  MockupEngine.prototype._framePhone = function (ctx, ox, oy, s, kind) {
    var bezel = Math.max(10, Math.round(s.w * 0.030));
    var outerR = Math.round(bezel * 3.2) + this.opts.radius;
    var fw = s.w + bezel * 2, fh = s.h + bezel * 2;
    roundRect(ctx, ox, oy, fw, fh, outerR);
    ctx.fillStyle = kind === 'android' ? '#0b0b0d' : '#1c1c1e'; ctx.fill();
    roundRect(ctx, ox + 1.5, oy + 1.5, fw - 3, fh - 3, outerR - 1.5);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.stroke();
    var sx = ox + bezel, sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    if (kind === 'android') {
      var cr = Math.max(5, bezel * 0.45);
      ctx.beginPath(); ctx.arc(sx + s.w / 2, sy + bezel * 0.9, cr, 0, Math.PI * 2);
      ctx.fillStyle = '#000'; ctx.fill();
    } else {
      var iw = Math.round(s.w * 0.32), ih = Math.round(bezel * 1.15);
      roundRect(ctx, sx + (s.w - iw) / 2, sy + bezel * 0.55, iw, ih, ih / 2);
      ctx.fillStyle = '#000'; ctx.fill();
    }
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._frameTablet = function (ctx, ox, oy, s) {
    var bezel = Math.max(14, Math.round(Math.min(s.w, s.h) * 0.035));
    var outerR = Math.round(bezel * 1.6) + this.opts.radius;
    var fw = s.w + bezel * 2, fh = s.h + bezel * 2;
    roundRect(ctx, ox, oy, fw, fh, outerR); ctx.fillStyle = '#161618'; ctx.fill();
    var sx = ox + bezel, sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    var cr = Math.max(3, bezel * 0.18);
    ctx.beginPath(); ctx.arc(ox + fw / 2, oy + bezel / 2, cr, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a2e'; ctx.fill();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._frameMacbook = function (ctx, ox, oy, s) {
    var bezel = Math.max(10, Math.round(s.w * 0.018));
    var topBar = bezel, screenR = Math.min(this.opts.radius, 14);
    var lidW = s.w + bezel * 2, lidH = s.h + bezel * 2 + topBar;
    var baseH = Math.round(lidW * 0.020), baseOverW = Math.round(lidW * 0.065);
    var fw = lidW + baseOverW * 2, fh = lidH + baseH + Math.round(lidW * 0.012);
    var lidX = ox + baseOverW, lidY = oy;
    roundRect(ctx, lidX, lidY, lidW, lidH, 26); ctx.fillStyle = '#141416'; ctx.fill();
    var sx = lidX + bezel, sy = lidY + bezel + topBar;
    this._drawScreen(ctx, sx, sy, s.w, s.h, screenR);
    ctx.beginPath(); ctx.arc(lidX + lidW / 2, lidY + topBar * 0.55, Math.max(2, bezel * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b30'; ctx.fill();
    var baseY = lidY + lidH;
    var baseGrad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
    baseGrad.addColorStop(0, '#c8ccd2'); baseGrad.addColorStop(1, '#9aa0a8');
    roundRect(ctx, ox, baseY, fw, baseH, 6); ctx.fillStyle = baseGrad; ctx.fill();
    var nW = Math.round(fw * 0.16), nH = baseH * 0.55;
    roundRect(ctx, ox + (fw - nW) / 2, baseY, nW, nH, nH); ctx.fillStyle = '#8b9098'; ctx.fill();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._frameBrowser = function (ctx, ox, oy, s) {
    var chrome = Math.max(34, Math.round(s.w * 0.045));
    var pad = Math.round(chrome * 0.28), r = this.opts.radius;
    var fw = s.w, fh = s.h + chrome;
    roundRect(ctx, ox, oy, fw, fh, r); ctx.fillStyle = '#f1f1f3'; ctx.fill();
    ctx.save();
    roundRect(ctx, ox, oy, fw, chrome + r, r); ctx.clip();
    ctx.fillStyle = '#e9e9ec'; ctx.fillRect(ox, oy, fw, chrome);
    ctx.restore();
    var dr = Math.max(4, chrome * 0.12), cy = oy + chrome / 2;
    var colors = ['#ff5f57', '#febc2e', '#28c840'];
    for (var i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(ox + pad + dr + i * (dr * 2.6), cy, dr, 0, Math.PI * 2);
      ctx.fillStyle = colors[i]; ctx.fill();
    }
    var pillX = ox + pad * 2 + dr * 8, pillW = fw - (pillX - ox) - pad * 1.5, pillH = chrome * 0.56;
    roundRect(ctx, pillX, cy - pillH / 2, pillW, pillH, pillH / 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = '#8a8a90'; ctx.font = Math.round(pillH * 0.5) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('🔒 ' + (this.opts.browserUrl || 'yoursite.com'), pillX + pillH * 0.5, cy + 1);
    var sy = oy + chrome;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ox, sy); ctx.lineTo(ox + s.w, sy);
    ctx.lineTo(ox + s.w, sy + s.h - r);
    ctx.arcTo(ox + s.w, sy + s.h, ox + s.w - r, sy + s.h, r);
    ctx.lineTo(ox + r, sy + s.h);
    ctx.arcTo(ox, sy + s.h, ox, sy + s.h - r, r);
    ctx.closePath(); ctx.clip();
    if (this.image) {
      var iw = this.image.naturalWidth, ih = this.image.naturalHeight;
      var scale = Math.max(s.w / iw, s.h / ih);
      ctx.drawImage(this.image, ox + (s.w - iw * scale) / 2, sy + (s.h - ih * scale) / 2, iw * scale, ih * scale);
    } else { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(ox, sy, s.w, s.h); }
    ctx.restore();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._measure = function (dev, s) {
    switch (dev) {
      case 'none': return { w: s.w, h: s.h };
      case 'iphone': case 'android': {
        var b = Math.max(10, Math.round(s.w * 0.030)); return { w: s.w + b * 2, h: s.h + b * 2 };
      }
      case 'ipad': {
        var b2 = Math.max(14, Math.round(Math.min(s.w, s.h) * 0.035)); return { w: s.w + b2 * 2, h: s.h + b2 * 2 };
      }
      case 'macbook': {
        var bz = Math.max(10, Math.round(s.w * 0.018));
        var lidW = s.w + bz * 2, lidH = s.h + bz * 2 + bz, baseH = Math.round(lidW * 0.020), over = Math.round(lidW * 0.065);
        return { w: lidW + over * 2, h: lidH + baseH + Math.round(lidW * 0.012) };
      }
      case 'browser': default: {
        var c = Math.max(34, Math.round(s.w * 0.045)); return { w: s.w, h: s.h + c };
      }
    }
  };

  // Build the device+screenshot onto its own transparent canvas.
  MockupEngine.prototype._buildFrameLayer = function (dev, s, m) {
    var lc = document.createElement('canvas'); lc.width = m.w; lc.height = m.h;
    var lctx = lc.getContext('2d');
    switch (dev) {
      case 'none':    this._frameNone(lctx, 0, 0, s); break;
      case 'iphone':  this._framePhone(lctx, 0, 0, s, 'iphone'); break;
      case 'android': this._framePhone(lctx, 0, 0, s, 'android'); break;
      case 'ipad':    this._frameTablet(lctx, 0, 0, s); break;
      case 'macbook': this._frameMacbook(lctx, 0, 0, s); break;
      default:        this._frameBrowser(lctx, 0, 0, s);
    }
    return lc;
  };

  // Pseudo-3D Y-axis rotation via per-column perspective projection.
  MockupEngine.prototype._tiltLayer = function (src, deg) {
    var a = deg * Math.PI / 180, W = src.width, H = src.height;
    var f = Math.max(W, H) * 2.4;
    var cols = [], minX = Infinity, maxX = -Infinity, maxHalf = 0;
    for (var sx = 0; sx <= W; sx++) {
      var u = sx - W / 2, z = u * Math.sin(a), sc = f / (f + z);
      var px = u * Math.cos(a) * sc;
      cols.push({ sx: sx, px: px, s: sc });
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      var half = (H / 2) * sc; if (half > maxHalf) maxHalf = half;
    }
    var outW = Math.ceil(maxX - minX) + 2, outH = Math.ceil(2 * maxHalf) + 2;
    var dc = document.createElement('canvas'); dc.width = outW; dc.height = outH;
    var dctx = dc.getContext('2d');
    var cx = -minX + 1, cy = outH / 2;
    // draw far side first for cleaner overlap
    var order = cols.slice(0, cols.length - 1);
    if (deg > 0) order.reverse();
    for (var i = 0; i < order.length; i++) {
      var idx = cols.indexOf(order[i]);
      var c0 = cols[idx], c1 = cols[idx + 1];
      var dx0 = cx + c0.px, dx1 = cx + c1.px;
      var dwid = Math.max(1, Math.abs(dx1 - dx0) + 0.7);
      var dh = H * c0.s, dy = cy - dh / 2;
      dctx.drawImage(src, c0.sx, 0, 1, H, Math.min(dx0, dx1), dy, dwid, dh);
    }
    return dc;
  };

  // ---------- QR ----------
  MockupEngine.prototype._getQR = function (data) {
    if (this._qrCache && this._qrCache.data === data) return this._qrCache.canvas;
    if (typeof global.qrcode !== 'function') return null;
    try {
      var q = global.qrcode(0, 'M'); q.addData(data); q.make();
      var n = q.getModuleCount();
      var qc = document.createElement('canvas'); qc.width = n; qc.height = n;
      var qx = qc.getContext('2d');
      qx.fillStyle = '#fff'; qx.fillRect(0, 0, n, n);
      qx.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) qx.fillRect(c, r, 1, 1);
      this._qrCache = { data: data, canvas: qc };
      return qc;
    } catch (e) { return null; }
  };

  function cornerPos(pos, boxW, boxH, W, H, margin) {
    switch (pos) {
      case 'tl': return { x: margin, y: margin };
      case 'tr': return { x: W - boxW - margin, y: margin };
      case 'bl': return { x: margin, y: H - boxH - margin };
      case 'center': return { x: (W - boxW) / 2, y: (H - boxH) / 2 };
      case 'br': default: return { x: W - boxW - margin, y: H - boxH - margin };
    }
  }

  MockupEngine.prototype._drawQR = function (ctx, W, H) {
    var qr = this.opts.qr;
    if (!qr || !qr.data) return;
    var src = this._getQR(qr.data);
    if (!src) return;
    var size = Math.round(Math.min(W, H) * (qr.size || 0.16));
    var margin = Math.round(Math.min(W, H) * 0.03);
    var framePad = qr.frame ? Math.round(size * 0.12) : 0;
    var boxW = size + framePad * 2, boxH = size + framePad * 2;
    var p = cornerPos(qr.position || 'br', boxW, boxH, W, H, margin);
    if (qr.frame) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.04;
      roundRect(ctx, p.x, p.y, boxW, boxH, framePad * 0.9);
      ctx.fillStyle = qr.bg || '#ffffff'; ctx.fill();
      ctx.restore();
    }
    var prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, p.x + framePad, p.y + framePad, size, size);
    ctx.imageSmoothingEnabled = prev;
    // recolor foreground if requested (multiply) — keep simple: only default black
  };

  // ---------- watermark ----------
  MockupEngine.prototype._drawWatermark = function (ctx, W, H) {
    var wm = this.opts.watermark;
    if (!wm || !wm.text) return;
    var size = Math.max(11, Math.round(Math.min(W, H) * (wm.size || 0.03)));
    var margin = Math.round(Math.min(W, H) * 0.035);
    ctx.save();
    ctx.font = '600 ' + size + 'px -apple-system, "Segoe UI", sans-serif';
    ctx.globalAlpha = wm.opacity != null ? wm.opacity : 0.6;
    ctx.fillStyle = wm.color || '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = 1;
    var pos = wm.position || 'br';
    var tw = ctx.measureText(wm.text).width;
    var x, y;
    ctx.textBaseline = 'alphabetic';
    if (pos === 'tl') { ctx.textAlign = 'left'; x = margin; y = margin + size; }
    else if (pos === 'tr') { ctx.textAlign = 'right'; x = W - margin; y = margin + size; }
    else if (pos === 'bl') { ctx.textAlign = 'left'; x = margin; y = H - margin; }
    else if (pos === 'center') { ctx.textAlign = 'center'; x = W / 2; y = H / 2; }
    else { ctx.textAlign = 'right'; x = W - margin; y = H - margin; }
    ctx.fillText(wm.text, x, y);
    ctx.restore();
    return tw;
  };

  // ---------- compose ----------
  MockupEngine.prototype.render = function () {
    var ctx = this.ctx, s = this._screenSize(), dev = this.opts.device;
    var m = this._measure(dev, s);
    var layer = this._buildFrameLayer(dev, s, m);
    if (this.opts.tilt) layer = this._tiltLayer(layer, this.opts.tilt);

    var preset = this.opts.preset, pad = this.opts.padding;
    var outW, outH;
    if (preset) { outW = preset.w; outH = preset.h; }
    else { outW = Math.round(layer.width + pad * 2); outH = Math.round(layer.height + pad * 2); }

    this.canvas.width = outW; this.canvas.height = outH;
    ctx.clearRect(0, 0, outW, outH);
    this._paintBackground(ctx, outW, outH);

    var availW = Math.max(1, outW - pad * 2), availH = Math.max(1, outH - pad * 2);
    var scale = preset ? Math.min(availW / layer.width, availH / layer.height) : 1;
    var dw = layer.width * scale, dh = layer.height * scale;
    var dx = (outW - dw) / 2, dy = (outH - dh) / 2;

    var sh = this.opts.shadow;
    if (sh > 0) {
      var ref = Math.min(dw, dh);
      ctx.shadowColor = 'rgba(0,0,0,' + (0.55 * sh).toFixed(3) + ')';
      ctx.shadowBlur = ref * 0.10 * sh + 12;
      ctx.shadowOffsetY = ref * 0.05 * sh + 8;
    }
    ctx.drawImage(layer, dx, dy, dw, dh);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    this._drawWatermark(ctx, outW, outH);
    this._drawQR(ctx, outW, outH);
  };

  // ---------- output ----------
  MockupEngine.prototype.toDataURL = function (type) { return this.canvas.toDataURL(type || 'image/png'); };

  MockupEngine.prototype.download = function (filename) {
    var a = document.createElement('a');
    a.download = filename || 'mockup.png';
    a.href = this.toDataURL('image/png');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  MockupEngine.prototype.copyToClipboard = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.canvas.toBlob || !navigator.clipboard || !global.ClipboardItem) {
        reject(new Error('Clipboard image not supported')); return;
      }
      self.canvas.toBlob(function (blob) {
        navigator.clipboard.write([new global.ClipboardItem({ 'image/png': blob })]).then(resolve, reject);
      }, 'image/png');
    });
  };

  MockupEngine.BACKGROUNDS = BACKGROUNDS;
  MockupEngine.DEVICES = DEVICES;
  MockupEngine.PRESETS = PRESETS;
  MockupEngine.CORNERS = CORNERS;

  global.MockupEngine = MockupEngine;
})(window);
