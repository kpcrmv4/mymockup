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
