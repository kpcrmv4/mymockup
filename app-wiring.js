/*
 * Shared control wiring for all three UI styles.
 * Requires matching element IDs in the markup:
 *   #canvas #devices #swatches #urlGroup #url
 *   #pad #padVal #rad #radVal #sh #shVal
 *   #file #uploadCta #drop #dlBtn #copyBtn
 * Optional data-default-device / data-default-bg on <body>.
 */
(function () {
  'use strict';
  var body = document.body;
  var defDevice = body.dataset.defaultDevice || 'browser';
  var defBg = body.dataset.defaultBg || 'violet';

  var engine = new MockupEngine(document.getElementById('canvas'));
  engine.setOptions({ device: defDevice, background: defBg });
  window.engine = engine;

  // ---- Devices ----
  var devWrap = document.getElementById('devices');
  MockupEngine.DEVICES.forEach(function (d) {
    var el = document.createElement('div');
    el.className = 'chip' + (d.id === defDevice ? ' on' : '');
    el.textContent = d.label; el.dataset.id = d.id;
    el.onclick = function () {
      devWrap.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
      el.classList.add('on');
      engine.setOptions({ device: d.id });
      var ug = document.getElementById('urlGroup');
      if (ug) ug.style.display = d.id === 'browser' ? '' : 'none';
    };
    devWrap.appendChild(el);
  });

  // ---- Backgrounds ----
  var swWrap = document.getElementById('swatches');
  Object.keys(MockupEngine.BACKGROUNDS).forEach(function (key) {
    var bg = MockupEngine.BACKGROUNDS[key];
    var el = document.createElement('div');
    el.className = 'sw' + (key === defBg ? ' on' : '') + (bg.type === 'transparent' ? ' transparent' : '');
    el.title = bg.label;
    if (bg.type === 'solid') el.style.background = bg.color;
    else if (bg.type === 'gradient') el.style.background = 'linear-gradient(135deg,' + bg.stops.join(',') + ')';
    el.onclick = function () {
      swWrap.querySelectorAll('.sw').forEach(function (c) { c.classList.remove('on'); });
      el.classList.add('on');
      engine.setOptions({ background: key });
    };
    swWrap.appendChild(el);
  });

  // ---- Sliders ----
  bindSlider('pad', 'padVal', function (v) { engine.setOptions({ padding: +v }); return v; });
  bindSlider('rad', 'radVal', function (v) { engine.setOptions({ radius: +v }); return v; });
  bindSlider('sh', 'shVal', function (v) { engine.setOptions({ shadow: v / 100 }); return v + '%'; });
  function bindSlider(id, valId, fn) {
    var el = document.getElementById(id), out = document.getElementById(valId);
    if (!el) return;
    el.oninput = function () { if (out) out.textContent = fn(el.value); };
  }
  var urlEl = document.getElementById('url');
  if (urlEl) urlEl.oninput = function () { engine.setOptions({ browserUrl: this.value }); };

  // ---- Upload ----
  var fileInput = document.getElementById('file');
  var cta = document.getElementById('uploadCta');
  if (cta) cta.onclick = function () { fileInput.click(); };
  if (fileInput) fileInput.onchange = function () { if (this.files[0]) engine.setImage(this.files[0]); };

  // ---- Drag & drop ----
  var drop = document.getElementById('drop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(function (e) {
      document.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('show'); });
    });
    document.addEventListener('dragleave', function (ev) {
      if (ev.relatedTarget === null) drop.classList.remove('show');
    });
    document.addEventListener('drop', function (ev) {
      ev.preventDefault(); drop.classList.remove('show');
      var f = ev.dataTransfer.files[0];
      if (f && f.type.indexOf('image/') === 0) engine.setImage(f);
    });
  }

  // ---- Paste ----
  document.addEventListener('paste', function (ev) {
    var items = ev.clipboardData.items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) { engine.setImage(items[i].getAsFile()); break; }
    }
  });

  // ---- Export ----
  var dl = document.getElementById('dlBtn');
  if (dl) dl.onclick = function () { engine.download('mockup.png'); };
  var copy = document.getElementById('copyBtn');
  if (copy) copy.onclick = function () {
    var btn = this;
    engine.copyToClipboard().then(
      function () { flash(btn, '✓ Copied'); },
      function () { flash(btn, '✕ Unsupported'); }
    );
  };
  function flash(btn, txt) {
    var o = btn.textContent; btn.textContent = txt;
    setTimeout(function () { btn.textContent = o; }, 1200);
  }
})();

/* ---------------------------------------------------------------------------
 * Extended controls: output presets, 3D tilt, watermark, QR code,
 * custom background, and batch. Injected into #extra so each style's
 * existing CSS classes (.chip, .slider, .btn, h3, inputs) style them.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';
  var engine = window.engine;
  var host = document.getElementById('extra');
  if (!engine || !host) return;
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.gap = '22px';

  function section(title) {
    var d = document.createElement('div'); d.className = 'group';
    var h = document.createElement('h3'); h.textContent = title; d.appendChild(h);
    host.appendChild(d); return d;
  }
  function chipRow(parent) {
    var g = document.createElement('div'); g.className = 'devices'; parent.appendChild(g); return g;
  }
  function chip(text) { var c = document.createElement('div'); c.className = 'chip'; c.textContent = text; return c; }
  function slider(parent, label, min, max, val, onInput, fmt) {
    var wrap = document.createElement('div'); wrap.className = 'slider';
    var lab = document.createElement('label'); lab.className = 'row';
    var l = document.createElement('span'); l.textContent = label;
    var v = document.createElement('span'); v.textContent = fmt ? fmt(val) : val;
    lab.appendChild(l); lab.appendChild(v);
    var inp = document.createElement('input'); inp.type = 'range';
    inp.min = min; inp.max = max; inp.value = val;
    inp.oninput = function () { v.textContent = fmt ? fmt(inp.value) : inp.value; onInput(inp.value); };
    wrap.appendChild(lab); wrap.appendChild(inp); parent.appendChild(wrap); return inp;
  }
  function textInput(parent, placeholder, val, onInput) {
    var i = document.createElement('input'); i.type = 'text';
    i.placeholder = placeholder || ''; if (val) i.value = val;
    i.style.marginTop = '4px';
    i.oninput = function () { onInput(i.value); };
    parent.appendChild(i); return i;
  }
  function button(parent, text, cls) {
    var b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : '');
    b.textContent = text; b.style.width = '100%'; b.style.justifyContent = 'center';
    b.style.marginTop = '8px'; parent.appendChild(b); return b;
  }
  // exclusive-select chip group; returns {onSelect}
  function selectGroup(g, items, initialId, onPick) {
    items.forEach(function (it) {
      var c = chip(it.label); c.dataset.id = it.id;
      if (it.id === initialId) c.classList.add('on');
      c.onclick = function () {
        g.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on'); onPick(it.id);
      };
      g.appendChild(c);
    });
  }

  var POS = [
    { id: 'tl', label: '↖' }, { id: 'tr', label: '↗' },
    { id: 'bl', label: '↙' }, { id: 'br', label: '↘' }, { id: 'center', label: '●' }
  ];

  // ---- Output size preset ----
  var secP = section('Output size');
  var gP = chipRow(secP);
  selectGroup(gP, MockupEngine.PRESETS.map(function (p) { return { id: p.id, label: p.label }; }), 'auto',
    function (id) {
      var p = MockupEngine.PRESETS.filter(function (x) { return x.id === id; })[0];
      engine.setOptions({ preset: (p && p.w) ? { w: p.w, h: p.h } : null });
    });

  // ---- 3D tilt ----
  var secT = section('3D tilt');
  slider(secT, 'Angle', -35, 35, 0, function (v) { engine.setOptions({ tilt: +v }); }, function (v) { return v + '°'; });

  // ---- Custom background ----
  var secB = section('Custom background');
  var cbWrap = document.createElement('div');
  cbWrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  var c1 = colorInput('#7c5cff'), c2 = colorInput('#22d3ee');
  var angleVal = 135;
  cbWrap.appendChild(c1); cbWrap.appendChild(c2);
  secB.appendChild(cbWrap);
  function colorInput(def) {
    var i = document.createElement('input'); i.type = 'color'; i.value = def;
    i.style.cssText = 'width:38px;height:34px;border:none;border-radius:8px;cursor:pointer;background:none;padding:0';
    i.oninput = applyGrad; return i;
  }
  slider(secB, 'Gradient angle', 0, 360, angleVal, function (v) { angleVal = +v; applyGrad(); }, function (v) { return v + '°'; });
  function applyGrad() {
    engine.setOptions({ background: { type: 'gradient', stops: [c1.value, c2.value], angle: angleVal } });
  }
  button(secB, '🖼️ Upload background image', '').onclick = function () {
    var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
    f.onchange = function () {
      if (!f.files[0]) return;
      var img = new Image();
      img.onload = function () { engine.setOptions({ background: { type: 'image', img: img } }); };
      img.src = URL.createObjectURL(f.files[0]);
    };
    f.click();
  };

  // ---- Watermark ----
  var secW = section('Watermark');
  var wm = { text: '', position: 'br', opacity: 0.6, size: 0.03 };
  textInput(secW, 'ข้อความลายน้ำ เช่น @yourname', '', function (v) { wm.text = v; push(); });
  var gW = chipRow(secW); gW.style.marginTop = '8px';
  selectGroup(gW, POS, 'br', function (id) { wm.position = id; push(); });
  slider(secW, 'Opacity', 0, 100, 60, function (v) { wm.opacity = v / 100; push(); }, function (v) { return v + '%'; });
  slider(secW, 'Size', 2, 8, 3, function (v) { wm.size = v / 100; push(); }, function (v) { return v; });
  function push() { engine.setOptions({ watermark: wm.text ? Object.assign({}, wm) : null }); }

  // ---- QR code ----
  var secQ = section('QR code จากลิงก์');
  var qr = { data: '', position: 'br', size: 0.16, frame: true };
  textInput(secQ, 'วางลิงก์ เช่น https://...', '', function (v) { qr.data = v.trim(); pushQR(); });
  var gQ = chipRow(secQ); gQ.style.marginTop = '8px';
  selectGroup(gQ, POS, 'br', function (id) { qr.position = id; pushQR(); });
  slider(secQ, 'Size', 8, 40, 16, function (v) { qr.size = v / 100; pushQR(); }, function (v) { return v + '%'; });
  var gF = chipRow(secQ); gF.style.marginTop = '8px';
  var frameChip = chip('▢ กรอบขาว'); frameChip.classList.add('on');
  frameChip.onclick = function () { qr.frame = !qr.frame; frameChip.classList.toggle('on', qr.frame); pushQR(); };
  gF.appendChild(frameChip);
  function pushQR() { engine.setOptions({ qr: qr.data ? Object.assign({}, qr) : null }); }

  // ---- Batch ----
  var secBa = section('Batch หลายรูป');
  var strip = document.createElement('div');
  strip.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px';
  secBa.appendChild(strip);
  var batch = [];
  var addBtn = button(secBa, '➕ เพิ่มรูป (เลือกได้หลายไฟล์)', '');
  addBtn.onclick = function () {
    var f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = true;
    f.onchange = function () {
      Array.prototype.forEach.call(f.files, function (file) {
        var img = new Image();
        img.onload = function () { batch.push(img); addThumb(img); if (batch.length === 1) engine.setImage(img); };
        img.src = URL.createObjectURL(file);
      });
    };
    f.click();
  };
  function addThumb(img) {
    var t = document.createElement('div');
    t.style.cssText = 'width:44px;height:44px;border-radius:8px;background-size:cover;background-position:center;cursor:pointer;border:2px solid rgba(128,128,128,.4)';
    t.style.backgroundImage = 'url(' + img.src + ')';
    t.title = 'คลิกเพื่อแก้ไขรูปนี้';
    t.onclick = function () {
      strip.querySelectorAll('div').forEach(function (x) { x.style.borderColor = 'rgba(128,128,128,.4)'; });
      t.style.borderColor = '#7c5cff'; engine.setImage(img);
    };
    strip.appendChild(t);
  }
  var dlAll = button(secBa, '⬇ Download ทั้งหมด', 'primary');
  dlAll.onclick = function () {
    if (!batch.length) { engine.download('mockup.png'); return; }
    var i = 0;
    (function next() {
      if (i >= batch.length) { engine.render(); return; }
      engine.setImage(batch[i], function () {
        setTimeout(function () { engine.download('mockup-' + (i + 1) + '.png'); i++; next(); }, 250);
      });
    })();
  };
})();
