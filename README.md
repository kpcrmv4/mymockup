# 🖼️ MockMeup

เว็บสำหรับอัพโหลด (หรือวาง `⌘V`) รูปแคปหน้าจอ → ใส่กรอบอุปกรณ์สวยๆ → ดาวน์โหลด PNG ได้ทันที
ทำงานฝั่งเบราว์เซอร์ 100% — รูปของผู้ใช้ไม่ถูกอัพโหลดขึ้นเซิร์ฟเวอร์เลย

สร้างด้วย **Next.js (App Router) + TypeScript** พร้อม deploy บน **Vercel** ได้ทันที

## เริ่มพัฒนา

```bash
npm install
npm run dev        # เปิด http://localhost:3000
```

Build production:

```bash
npm run build && npm start
```

## Deploy บน Vercel

1. push โค้ดขึ้น GitHub
2. ไป [vercel.com/new](https://vercel.com/new) แล้ว import repo นี้
3. Vercel ตรวจเจอ Next.js อัตโนมัติ — กด **Deploy** ได้เลย (ไม่ต้องตั้งค่าอะไรเพิ่ม)

ทั้งเว็บประมวลผลฝั่ง client จึงเป็น static/edge-friendly ล้วนๆ

## ฟีเจอร์

- 🌗 **สลับโหมดมืด/สว่าง** — ดีไซน์หลักเป็น dark glass สลับเป็น light ได้ (จำค่าไว้ใน localStorage)
- 📤 อัพโหลด: คลิก / ลากวาง / วางจาก clipboard (`⌘V` / `Ctrl+V`)
- 📱 กรอบอุปกรณ์: Browser · iPhone · Android · iPad · MacBook · No-frame
- 🎨 พื้นหลัง: โปร่งใส / สีทึบ / gradient สำเร็จรูป + custom gradient (เลือกสีเอง) + อัพโหลดรูปพื้นหลัง
- 🎚️ ปรับ padding, corner radius, shadow
- 🔄 **3D tilt** — เอียงกรอบเป็นมุม 3D (perspective)
- 📐 **Output presets** — Auto / OG 1200×630 / X 16:9 / IG 1:1 / IG Story / Product Hunt / Square 2K
- 💧 **Watermark** — ใส่ข้อความลายน้ำ เลือกตำแหน่ง/ความจาง/ขนาด
- 🔗 **QR code จากลิงก์** — วางลิงก์แล้วสร้าง QR อัตโนมัติ (สแกนได้จริง, offline)
- 🖼️ **Batch** — อัพโหลดหลายรูป ใช้ค่ากรอบเดียวกัน แล้วดาวน์โหลดรวดเดียว
- 📱 **Responsive** — บนมือถือ preview ขึ้นบน คอนโทรลเลื่อนอ่านด้านล่าง
- ⬇️ ดาวน์โหลด PNG หรือ 📋 คัดลอกไป clipboard

## โครงสร้างโปรเจกต์

```
app/
  layout.tsx          root layout + theme init (กัน flash ตอนโหลด)
  page.tsx            หน้าเดียว render <MockupStudio/>
  globals.css         ธีม (dark เป็นค่าเริ่มต้น + light ผ่าน [data-theme])
components/
  MockupStudio.tsx    UI + wiring คอนโทรลทั้งหมด (client component)
  ThemeToggle.tsx     ปุ่มสลับมืด/สว่าง
lib/
  mockup-engine.ts    เอนจินวาดกรอบ + tilt + watermark + QR + export (Canvas 2D)
  qrcode.js           ไลบรารีสร้าง QR แบบ offline (MIT, Kazuhiko Arase)
public/
  logo.png            โลโก้ MockMeup
```

## Tech stack

- **Next.js 15 + React 19 + TypeScript** — App Router, static-prerendered
- **Canvas 2D API** — วาดกรอบอุปกรณ์และ export เป็น PNG ฝั่ง client
- **Plain CSS + CSS variables** — ธีมมืด/สว่างและ responsive โดยไม่พึ่ง UI framework

> เอนจินวาดภาพทั้งหมดทำงานฝั่ง browser เท่านั้น — ไม่มี API/เซิร์ฟเวอร์รับรูป
