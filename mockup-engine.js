/*
 * Mockup Engine — client-side device-frame renderer.
 * Pure Canvas 2D, no dependencies. Shared by all UI styles.
 *
 * Usage:
 *   const engine = new MockupEngine(canvasEl);
 *   engine.setImage(fileOrImage);
 *   engine.setOptions({ device:'iphone', background:{...}, padding:80, radius:24, shadow:0.3 });
 *   engine.render();
 *   engine.download('mockup.png');
 */
(function (global) {
  'use strict';

  // Rounded-rect path helper (fallback for older canvas impls)
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
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

  // Built-in background presets (id -> paint spec)
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
    fire:        { type: 'gradient', stops: ['#f83600', '#f9d423'], angle: 135, label: 'Fire' }
  };

  var DEVICES = [
    { id: 'none',    label: 'No frame' },
    { id: 'browser', label: 'Browser' },
    { id: 'iphone',  label: 'iPhone' },
    { id: 'android', label: 'Android' },
    { id: 'ipad',    label: 'iPad' },
    { id: 'macbook', label: 'MacBook' }
  ];

  function MockupEngine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;          // HTMLImageElement
    this.opts = {
      device: 'browser',
      background: 'violet',      // key of BACKGROUNDS, or {type,color/stops}
      padding: 90,               // px around the frame
      radius: 20,                // screen corner radius
      shadow: 0.35,              // 0..1 shadow strength
      browserUrl: 'yoursite.com',
      maxScreen: 1500            // cap longest screen edge (output quality/perf)
    };
  }

  MockupEngine.prototype.setImage = function (src, cb) {
    var self = this;
    if (src instanceof Image) {
      this.image = src;
      if (cb) cb();
      this.render();
      return;
    }
    var url = (src instanceof Blob) ? URL.createObjectURL(src) : src;
    var img = new Image();
    img.onload = function () {
      self.image = img;
      if (cb) cb();
      self.render();
      if (src instanceof Blob) URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  MockupEngine.prototype.setOptions = function (patch) {
    for (var k in patch) if (patch.hasOwnProperty(k)) this.opts[k] = patch[k];
    this.render();
  };

  MockupEngine.prototype._resolveBg = function () {
    var bg = this.opts.background;
    if (typeof bg === 'string') return BACKGROUNDS[bg] || BACKGROUNDS.white;
    return bg;
  };

  MockupEngine.prototype._paintBackground = function (ctx, w, h) {
    var bg = this._resolveBg();
    if (!bg || bg.type === 'transparent') return; // leave canvas clear
    if (bg.type === 'solid') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
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
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  // Compute scaled screen dimensions from the source image
  MockupEngine.prototype._screenSize = function () {
    var img = this.image;
    var w = img ? img.naturalWidth : 1200;
    var h = img ? img.naturalHeight : 750;
    var max = this.opts.maxScreen;
    var longest = Math.max(w, h);
    if (longest > max) { var s = max / longest; w = Math.round(w * s); h = Math.round(h * s); }
    return { w: w, h: h };
  };

  // Clip to a rounded rect and draw the screenshot to cover
  MockupEngine.prototype._drawScreen = function (ctx, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    if (this.image) {
      // cover-fit
      var iw = this.image.naturalWidth, ih = this.image.naturalHeight;
      var scale = Math.max(w / iw, h / ih);
      var dw = iw * scale, dh = ih * scale;
      ctx.drawImage(this.image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#9ca3af';
      ctx.font = (Math.round(h / 12)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Upload an image', x + w / 2, y + h / 2);
    }
    ctx.restore();
  };

  MockupEngine.prototype._applyShadow = function (ctx, ref) {
    var s = this.opts.shadow;
    if (s <= 0) return;
    ctx.shadowColor = 'rgba(0,0,0,' + (0.55 * s).toFixed(3) + ')';
    ctx.shadowBlur = ref * 0.10 * s + 10;
    ctx.shadowOffsetY = ref * 0.045 * s + 6;
  };
  MockupEngine.prototype._clearShadow = function (ctx) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowOffsetX = 0;
  };

  // ---- Frame renderers. Each returns {frameW, frameH} and draws at (ox,oy) ----

  MockupEngine.prototype._frameNone = function (ctx, ox, oy, s) {
    var r = this.opts.radius;
    this._applyShadow(ctx, s.w);
    roundRect(ctx, ox, oy, s.w, s.h, r); ctx.fillStyle = '#000'; ctx.fill();
    this._clearShadow(ctx);
    this._drawScreen(ctx, ox, oy, s.w, s.h, r);
    return { w: s.w, h: s.h };
  };

  MockupEngine.prototype._framePhone = function (ctx, ox, oy, s, kind) {
    var bezel = Math.max(10, Math.round(s.w * 0.030));
    var outerR = Math.round(bezel * 3.2) + this.opts.radius;
    var fw = s.w + bezel * 2, fh = s.h + bezel * 2;
    // body
    this._applyShadow(ctx, fw);
    roundRect(ctx, ox, oy, fw, fh, outerR);
    ctx.fillStyle = kind === 'android' ? '#0b0b0d' : '#1c1c1e';
    ctx.fill();
    this._clearShadow(ctx);
    // subtle rim
    roundRect(ctx, ox + 1.5, oy + 1.5, fw - 3, fh - 3, outerR - 1.5);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.stroke();
    // screen
    var sx = ox + bezel, sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    // camera / island
    if (kind === 'android') {
      var cr = Math.max(5, bezel * 0.45);
      ctx.beginPath();
      ctx.arc(sx + s.w / 2, sy + bezel * 0.9, cr, 0, Math.PI * 2);
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
    this._applyShadow(ctx, fw);
    roundRect(ctx, ox, oy, fw, fh, outerR);
    ctx.fillStyle = '#161618'; ctx.fill();
    this._clearShadow(ctx);
    var sx = ox + bezel, sy = oy + bezel;
    this._drawScreen(ctx, sx, sy, s.w, s.h, this.opts.radius);
    // front camera dot
    var cr = Math.max(3, bezel * 0.18);
    ctx.beginPath(); ctx.arc(ox + fw / 2, oy + bezel / 2, cr, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a2e'; ctx.fill();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._frameMacbook = function (ctx, ox, oy, s) {
    var bezel = Math.max(10, Math.round(s.w * 0.018));
    var topBar = bezel;                          // camera strip
    var screenR = Math.min(this.opts.radius, 14);
    var lidW = s.w + bezel * 2;
    var lidH = s.h + bezel * 2 + topBar;
    var baseH = Math.round(lidW * 0.020);
    var baseOverW = Math.round(lidW * 0.065);
    var fw = lidW + baseOverW * 2;
    var fh = lidH + baseH + Math.round(lidW * 0.012);
    var lidX = ox + baseOverW, lidY = oy;
    // lid
    this._applyShadow(ctx, fw);
    roundRect(ctx, lidX, lidY, lidW, lidH, 26);
    ctx.fillStyle = '#141416'; ctx.fill();
    this._clearShadow(ctx);
    // screen
    var sx = lidX + bezel, sy = lidY + bezel + topBar;
    this._drawScreen(ctx, sx, sy, s.w, s.h, screenR);
    // camera
    ctx.beginPath(); ctx.arc(lidX + lidW / 2, lidY + topBar * 0.55, Math.max(2, bezel * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b30'; ctx.fill();
    // base
    var baseY = lidY + lidH;
    var baseGrad = ctx.createLinearGradient(0, baseY, 0, baseY + baseH);
    baseGrad.addColorStop(0, '#c8ccd2'); baseGrad.addColorStop(1, '#9aa0a8');
    roundRect(ctx, ox, baseY, fw, baseH, 6); ctx.fillStyle = baseGrad; ctx.fill();
    // notch (opening)
    var nW = Math.round(fw * 0.16), nH = baseH * 0.55;
    roundRect(ctx, ox + (fw - nW) / 2, baseY, nW, nH, nH);
    ctx.fillStyle = '#8b9098'; ctx.fill();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype._frameBrowser = function (ctx, ox, oy, s) {
    var chrome = Math.max(34, Math.round(s.w * 0.045));
    var pad = Math.round(chrome * 0.28);
    var r = this.opts.radius;
    var fw = s.w, fh = s.h + chrome;
    // window body (chrome + shadow)
    this._applyShadow(ctx, fw);
    roundRect(ctx, ox, oy, fw, fh, r);
    ctx.fillStyle = '#f1f1f3'; ctx.fill();
    this._clearShadow(ctx);
    // chrome top rounded, screenshot below
    ctx.save();
    roundRect(ctx, ox, oy, fw, chrome + r, r); // top portion
    ctx.clip();
    ctx.fillStyle = '#e9e9ec'; ctx.fillRect(ox, oy, fw, chrome);
    ctx.restore();
    // traffic lights
    var dr = Math.max(4, chrome * 0.12);
    var cy = oy + chrome / 2;
    var colors = ['#ff5f57', '#febc2e', '#28c840'];
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(ox + pad + dr + i * (dr * 2.6), cy, dr, 0, Math.PI * 2);
      ctx.fillStyle = colors[i]; ctx.fill();
    }
    // url pill
    var pillX = ox + pad * 2 + dr * 8;
    var pillW = fw - (pillX - ox) - pad * 1.5;
    var pillH = chrome * 0.56;
    roundRect(ctx, pillX, cy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = '#8a8a90';
    ctx.font = Math.round(pillH * 0.5) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var url = this.opts.browserUrl || 'yoursite.com';
    ctx.fillText('🔒 ' + url, pillX + pillH * 0.5, cy + 1);
    // screenshot (bottom corners rounded)
    var sy = oy + chrome;
    ctx.save();
    roundRect(ctx, ox, sy, s.w, s.h, 0); // straight top edge under chrome
    // but round the bottom corners:
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
      var iw = this.image.naturalWidth, ih = this.image.naturalHeight;
      var scale = Math.max(s.w / iw, s.h / ih);
      ctx.drawImage(this.image, ox + (s.w - iw * scale) / 2, sy + (s.h - ih * scale) / 2, iw * scale, ih * scale);
    } else {
      ctx.fillStyle = '#e5e7eb'; ctx.fillRect(ox, sy, s.w, s.h);
    }
    ctx.restore();
    return { w: fw, h: fh };
  };

  MockupEngine.prototype.render = function () {
    var ctx = this.ctx, s = this._screenSize(), pad = this.opts.padding;
    // First pass with a scratch to measure frame size (frames are deterministic
    // from screen size, so we compute directly).
    var frameW, frameH;
    var dev = this.opts.device;
    // measure by drawing to an offscreen-ish approach: we know sizes analytically,
    // but simplest is to render into a temp canvas sized generously then crop.
    // Instead, compute frame footprint per device:
    var m = this._measure(dev, s);
    frameW = m.w; frameH = m.h;

    var W = Math.round(frameW + pad * 2);
    var H = Math.round(frameH + pad * 2);
    this.canvas.width = W;
    this.canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    this._paintBackground(ctx, W, H);

    var ox = pad + (frameW - m.w) / 2;
    var oy = pad + (frameH - m.h) / 2;

    switch (dev) {
      case 'none':    this._frameNone(ctx, ox, oy, s); break;
      case 'iphone':  this._framePhone(ctx, ox, oy, s, 'iphone'); break;
      case 'android': this._framePhone(ctx, ox, oy, s, 'android'); break;
      case 'ipad':    this._frameTablet(ctx, ox, oy, s); break;
      case 'macbook': this._frameMacbook(ctx, ox, oy, s); break;
      case 'browser': this._frameBrowser(ctx, ox, oy, s); break;
      default:        this._frameBrowser(ctx, ox, oy, s);
    }
  };

  // Analytical footprint of each frame (mirrors the draw math)
  MockupEngine.prototype._measure = function (dev, s) {
    switch (dev) {
      case 'none': return { w: s.w, h: s.h };
      case 'iphone':
      case 'android': {
        var b = Math.max(10, Math.round(s.w * 0.030));
        return { w: s.w + b * 2, h: s.h + b * 2 };
      }
      case 'ipad': {
        var b2 = Math.max(14, Math.round(Math.min(s.w, s.h) * 0.035));
        return { w: s.w + b2 * 2, h: s.h + b2 * 2 };
      }
      case 'macbook': {
        var bz = Math.max(10, Math.round(s.w * 0.018));
        var lidW = s.w + bz * 2, lidH = s.h + bz * 2 + bz;
        var baseH = Math.round(lidW * 0.020);
        var over = Math.round(lidW * 0.065);
        return { w: lidW + over * 2, h: lidH + baseH + Math.round(lidW * 0.012) };
      }
      case 'browser': {
        var chrome = Math.max(34, Math.round(s.w * 0.045));
        return { w: s.w, h: s.h + chrome };
      }
      default: {
        var c = Math.max(34, Math.round(s.w * 0.045));
        return { w: s.w, h: s.h + c };
      }
    }
  };

  MockupEngine.prototype.toDataURL = function (type) {
    return this.canvas.toDataURL(type || 'image/png');
  };

  MockupEngine.prototype.download = function (filename) {
    var a = document.createElement('a');
    a.download = filename || 'mockup.png';
    a.href = this.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  MockupEngine.prototype.copyToClipboard = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.canvas.toBlob || !navigator.clipboard || !global.ClipboardItem) {
        reject(new Error('Clipboard image not supported'));
        return;
      }
      self.canvas.toBlob(function (blob) {
        navigator.clipboard.write([new global.ClipboardItem({ 'image/png': blob })])
          .then(resolve, reject);
      }, 'image/png');
    });
  };

  MockupEngine.BACKGROUNDS = BACKGROUNDS;
  MockupEngine.DEVICES = DEVICES;

  global.MockupEngine = MockupEngine;
})(window);
