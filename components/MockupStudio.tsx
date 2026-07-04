"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MockupEngine,
  BACKGROUNDS,
  DEVICES,
  PRESETS,
  type CornerPos,
} from "@/lib/mockup-engine";
import ThemeToggle from "./ThemeToggle";

const POS: { id: CornerPos; label: string }[] = [
  { id: "tl", label: "↖" },
  { id: "tr", label: "↗" },
  { id: "bl", label: "↙" },
  { id: "br", label: "↘" },
  { id: "center", label: "●" },
];

// ---------- small building blocks ----------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
  fmt,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="slider">
      <label className="row">
        <span>{label}</span>
        <span>{fmt ? fmt(value) : value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}

function ChipGroup<T extends string>({
  items,
  value,
  onPick,
  className = "devices",
}: {
  items: { id: T; label: string }[];
  value: T | null;
  onPick: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {items.map((it) => (
        <div
          key={it.id}
          className={"chip" + (it.id === value ? " on" : "")}
          onClick={() => onPick(it.id)}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

export default function MockupStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MockupEngine | null>(null);

  // ---- control state (drives which chip is "on") ----
  const [device, setDevice] = useState("iphone");
  const [bgKey, setBgKey] = useState<string | null>("midnight");
  const [padding, setPadding] = useState(120);
  const [radius, setRadius] = useState(28);
  const [shadow, setShadow] = useState(50); // percent
  const [browserUrl, setBrowserUrl] = useState("yoursite.com");
  const [preset, setPreset] = useState("auto");
  const [tilt, setTilt] = useState(0);

  // custom background
  const [c1, setC1] = useState("#4f46e5");
  const [c2, setC2] = useState("#22d3ee");
  const [gradAngle, setGradAngle] = useState(135);

  // watermark
  const [wmText, setWmText] = useState("");
  const [wmPos, setWmPos] = useState<CornerPos>("br");
  const [wmOpacity, setWmOpacity] = useState(60);
  const [wmSize, setWmSize] = useState(3);

  // qr
  const [qrData, setQrData] = useState("");
  const [qrPos, setQrPos] = useState<CornerPos>("br");
  const [qrSize, setQrSize] = useState(16);
  const [qrFrame, setQrFrame] = useState(true);

  // batch
  const [batch, setBatch] = useState<HTMLImageElement[]>([]);
  const [activeBatch, setActiveBatch] = useState(-1);

  const [dropShow, setDropShow] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const batchFileRef = useRef<HTMLInputElement>(null);

  const eng = () => engineRef.current;

  // ---------- init ----------
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new MockupEngine(canvasRef.current);
    engineRef.current = engine;
    engine.setOptions({
      device: "iphone",
      background: "midnight",
      padding: 120,
      radius: 28,
      shadow: 0.5,
    });
    engine.render();
  }, []);

  // ---------- global paste / drag&drop ----------
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image/") === 0) {
          const f = items[i].getAsFile();
          if (f) eng()?.setImage(f);
          break;
        }
      }
    };
    const onDragOver = (ev: DragEvent) => {
      ev.preventDefault();
      setDropShow(true);
    };
    const onDragLeave = (ev: DragEvent) => {
      if (ev.relatedTarget === null) setDropShow(false);
    };
    const onDrop = (ev: DragEvent) => {
      ev.preventDefault();
      setDropShow(false);
      const f = ev.dataTransfer?.files[0];
      if (f && f.type.indexOf("image/") === 0) eng()?.setImage(f);
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragenter", onDragOver);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragenter", onDragOver);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  // ---------- handlers ----------
  const pickDevice = (id: string) => {
    setDevice(id);
    eng()?.setOptions({ device: id });
  };

  const pickBg = (key: string) => {
    setBgKey(key);
    eng()?.setOptions({ background: key });
  };

  const applyCustomGrad = useCallback(
    (a = c1, b = c2, ang = gradAngle) => {
      setBgKey(null);
      eng()?.setOptions({ background: { type: "gradient", stops: [a, b], angle: ang } });
    },
    [c1, c2, gradAngle]
  );

  const pickPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    eng()?.setOptions({ preset: p && p.w && p.h ? { w: p.w, h: p.h } : null });
  };

  const pushWatermark = (patch?: Partial<{ text: string; pos: CornerPos; opacity: number; size: number }>) => {
    const text = patch?.text ?? wmText;
    const pos = patch?.pos ?? wmPos;
    const opacity = patch?.opacity ?? wmOpacity;
    const size = patch?.size ?? wmSize;
    eng()?.setOptions({
      watermark: text
        ? { text, position: pos, opacity: opacity / 100, size: size / 100 }
        : null,
    });
  };

  const pushQR = (patch?: Partial<{ data: string; pos: CornerPos; size: number; frame: boolean }>) => {
    const data = (patch?.data ?? qrData).trim();
    const pos = patch?.pos ?? qrPos;
    const size = patch?.size ?? qrSize;
    const frame = patch?.frame ?? qrFrame;
    eng()?.setOptions({
      qr: data ? { data, position: pos, size: size / 100, frame } : null,
    });
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) eng()?.setImage(f);
  };

  const onBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new window.Image();
    img.onload = () => {
      setBgKey(null);
      eng()?.setOptions({ background: { type: "image", img } });
    };
    img.src = URL.createObjectURL(f);
  };

  const onBatchAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const img = new window.Image();
      img.onload = () => {
        setBatch((prev) => {
          const next = [...prev, img];
          if (next.length === 1) {
            eng()?.setImage(img);
            setActiveBatch(0);
          }
          return next;
        });
      };
      img.src = URL.createObjectURL(file);
    });
    e.target.value = "";
  };

  const selectBatch = (img: HTMLImageElement, i: number) => {
    setActiveBatch(i);
    eng()?.setImage(img);
  };

  const downloadAll = () => {
    const engine = eng();
    if (!engine) return;
    if (!batch.length) {
      engine.download("mockup.png");
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= batch.length) {
        engine.render();
        return;
      }
      engine.setImage(batch[i], () => {
        setTimeout(() => {
          engine.download("mockup-" + (i + 1) + ".png");
          i++;
          next();
        }, 250);
      });
    };
    next();
  };

  const onCopy = () => {
    eng()
      ?.copyToClipboard()
      .then(
        () => flash("✓ Copied"),
        () => flash("✕ Unsupported")
      );
  };
  const flash = (txt: string) => {
    setCopyLabel(txt);
    setTimeout(() => setCopyLabel("Copy"), 1200);
  };

  return (
    <div className="app">
      {/* ---------------- sidebar ---------------- */}
      <aside className="side glass">
        <div className="brand">
          <div className="brand-logo">
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="logo-crop">
                <img src="/logo.png" alt="MockMeup" />
              </span>
            </span>
          </div>
          <ThemeToggle />
        </div>

        <div
          className="upload-cta"
          onClick={() => fileInputRef.current?.click()}
        >
          ✨ Drop / paste / click เพื่อเพิ่มรูป
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onUpload}
          />
        </div>

        <Section title="Device">
          <ChipGroup items={DEVICES} value={device} onPick={pickDevice} />
        </Section>

        <Section title="Background">
          <div className="swatches">
            {Object.keys(BACKGROUNDS).map((key) => {
              const bg = BACKGROUNDS[key];
              const style: React.CSSProperties = {};
              let cls = "sw";
              if (key === bgKey) cls += " on";
              if (bg.type === "transparent") cls += " transparent";
              else if (bg.type === "solid") style.background = bg.color;
              else if (bg.type === "gradient")
                style.background = "linear-gradient(135deg," + bg.stops.join(",") + ")";
              return (
                <div
                  key={key}
                  className={cls}
                  style={style}
                  title={bg.label}
                  onClick={() => pickBg(key)}
                />
              );
            })}
          </div>
        </Section>

        {device === "browser" && (
          <Section title="Browser URL">
            <input
              type="text"
              value={browserUrl}
              onChange={(e) => {
                setBrowserUrl(e.target.value);
                eng()?.setOptions({ browserUrl: e.target.value });
              }}
            />
          </Section>
        )}

        <Section title="Adjust">
          <Slider
            label="Padding"
            min={0}
            max={280}
            value={padding}
            onChange={(v) => {
              setPadding(v);
              eng()?.setOptions({ padding: v });
            }}
          />
          <Slider
            label="Radius"
            min={0}
            max={60}
            value={radius}
            onChange={(v) => {
              setRadius(v);
              eng()?.setOptions({ radius: v });
            }}
          />
          <Slider
            label="Shadow"
            min={0}
            max={100}
            value={shadow}
            fmt={(v) => v + "%"}
            onChange={(v) => {
              setShadow(v);
              eng()?.setOptions({ shadow: v / 100 });
            }}
          />
        </Section>

        <Section title="Output size">
          <ChipGroup
            items={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            value={preset}
            onPick={pickPreset}
          />
        </Section>

        <Section title="3D tilt">
          <Slider
            label="Angle"
            min={-35}
            max={35}
            value={tilt}
            fmt={(v) => v + "°"}
            onChange={(v) => {
              setTilt(v);
              eng()?.setOptions({ tilt: v });
            }}
          />
        </Section>

        <Section title="Custom background">
          <div className="cb-row">
            <input
              type="color"
              value={c1}
              onChange={(e) => {
                setC1(e.target.value);
                applyCustomGrad(e.target.value, c2, gradAngle);
              }}
            />
            <input
              type="color"
              value={c2}
              onChange={(e) => {
                setC2(e.target.value);
                applyCustomGrad(c1, e.target.value, gradAngle);
              }}
            />
            <span style={{ fontSize: 12, color: "var(--sub)" }}>gradient เลือกสีเอง</span>
          </div>
          <div className="field-mt">
            <Slider
              label="Gradient angle"
              min={0}
              max={360}
              value={gradAngle}
              fmt={(v) => v + "°"}
              onChange={(v) => {
                setGradAngle(v);
                applyCustomGrad(c1, c2, v);
              }}
            />
          </div>
          <button
            className="btn btn-full"
            onClick={() => bgFileRef.current?.click()}
          >
            🖼️ อัพโหลดรูปพื้นหลัง
          </button>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onBgUpload}
          />
        </Section>

        <Section title="Watermark">
          <input
            type="text"
            placeholder="ข้อความลายน้ำ เช่น @yourname"
            value={wmText}
            onChange={(e) => {
              setWmText(e.target.value);
              pushWatermark({ text: e.target.value });
            }}
          />
          <div className="field-mt">
            <ChipGroup
              items={POS}
              value={wmPos}
              onPick={(id) => {
                setWmPos(id);
                pushWatermark({ pos: id });
              }}
            />
          </div>
          <Slider
            label="Opacity"
            min={0}
            max={100}
            value={wmOpacity}
            fmt={(v) => v + "%"}
            onChange={(v) => {
              setWmOpacity(v);
              pushWatermark({ opacity: v });
            }}
          />
          <Slider
            label="Size"
            min={2}
            max={8}
            value={wmSize}
            onChange={(v) => {
              setWmSize(v);
              pushWatermark({ size: v });
            }}
          />
        </Section>

        <Section title="QR code จากลิงก์">
          <input
            type="text"
            placeholder="วางลิงก์ เช่น https://..."
            value={qrData}
            onChange={(e) => {
              setQrData(e.target.value);
              pushQR({ data: e.target.value });
            }}
          />
          <div className="field-mt">
            <ChipGroup
              items={POS}
              value={qrPos}
              onPick={(id) => {
                setQrPos(id);
                pushQR({ pos: id });
              }}
            />
          </div>
          <Slider
            label="Size"
            min={8}
            max={40}
            value={qrSize}
            fmt={(v) => v + "%"}
            onChange={(v) => {
              setQrSize(v);
              pushQR({ size: v });
            }}
          />
          <div className="field-mt cb-row">
            <div
              className={"chip" + (qrFrame ? " on" : "")}
              style={{ flex: "0 0 auto", padding: "8px 14px" }}
              onClick={() => {
                const next = !qrFrame;
                setQrFrame(next);
                pushQR({ frame: next });
              }}
            >
              ▢ กรอบขาว
            </div>
          </div>
        </Section>

        <Section title="Batch หลายรูป">
          {batch.length > 0 && (
            <div className="thumbs">
              {batch.map((img, i) => (
                <div
                  key={i}
                  className={"thumb" + (i === activeBatch ? " on" : "")}
                  style={{ backgroundImage: `url(${img.src})` }}
                  title="คลิกเพื่อแก้ไขรูปนี้"
                  onClick={() => selectBatch(img, i)}
                />
              ))}
            </div>
          )}
          <button
            className="btn btn-full"
            onClick={() => batchFileRef.current?.click()}
          >
            ➕ เพิ่มรูป (เลือกได้หลายไฟล์)
          </button>
          <input
            ref={batchFileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onBatchAdd}
          />
          <button className="btn primary btn-full" onClick={downloadAll}>
            ⬇ Download ทั้งหมด
          </button>
        </Section>
      </aside>

      {/* ---------------- stage ---------------- */}
      <main className="stage glass">
        <div className="topbar">
          <strong>Live preview</strong>
          <div className="actions">
            <button className="btn white" onClick={onCopy}>
              📋 {copyLabel}
            </button>
            <button
              className="btn primary"
              onClick={() => eng()?.download("mockup.png")}
            >
              ⬇ Download PNG
            </button>
          </div>
        </div>
        {dropShow && <div className="drop show">Drop to load ⚡</div>}
        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="preview" />
        </div>
        <div className="hint">
          100% ในเบราว์เซอร์ · ไม่มีการอัพโหลดรูปขึ้นเซิร์ฟเวอร์
        </div>
      </main>
    </div>
  );
}
