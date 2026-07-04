# 🖼️ Mockup Generator

เว็บสำหรับอัพโหลด (หรือวาง `⌘V`) รูปแคปหน้าจอ → ใส่กรอบอุปกรณ์สวยๆ → ดาวน์โหลด PNG ได้ทันที
ทำงานฝั่งเบราว์เซอร์ 100% — รูปของผู้ใช้ไม่ถูกอัพโหลดขึ้นเซิร์ฟเวอร์เลย

## เริ่มใช้งาน

เปิดไฟล์ `index.html` ในเบราว์เซอร์ได้เลย (ไม่ต้องติดตั้งอะไร) แล้วเลือก 1 ใน 3 สไตล์

หากจะเสิร์ฟผ่าน local server:

```bash
npx serve .
# หรือ
python3 -m http.server 8000
```

## 3 สไตล์ให้ลองเล่น

| ไฟล์ | สไตล์ | คำอธิบาย |
|------|-------|----------|
| `style-1-clean.html` | **Clean** | ขาวสะอาด มินิมอล สไตล์ Apple |
| `style-2-dark.html` | **Dark Glass** | โหมดมืด glassmorphism นีออนม่วง-ฟ้า |
| `style-3-playful.html` | **Bold / Playful** | neo-brutalist สีจัด กรอบหนา เงาแข็ง |

ทั้งสามใช้เอนจินเดียวกัน (`mockup-engine.js`) และ wiring เดียวกัน (`app-wiring.js`)

## ฟีเจอร์

- 📤 อัพโหลด: คลิก / ลากวาง / วางจาก clipboard (`⌘V` / `Ctrl+V`)
- 📱 กรอบอุปกรณ์: Browser · iPhone · Android · iPad · MacBook · No-frame
- 🎨 พื้นหลัง: โปร่งใส / สีทึบ / gradient สำเร็จรูป 8 แบบ
- 🎚️ ปรับ padding, corner radius, shadow
- 🌐 แก้ URL bar ของกรอบ Browser ได้
- ⬇️ ดาวน์โหลด PNG หรือ 📋 คัดลอกไป clipboard

## โครงสร้างไฟล์

```
index.html            หน้าเลือกสไตล์ (landing)
style-1-clean.html    UI สไตล์ Clean
style-2-dark.html     UI สไตล์ Dark Glass
style-3-playful.html  UI สไตล์ Bold
mockup-engine.js      เอนจินวาดกรอบ + export (Canvas 2D, ไม่มี dependency)
app-wiring.js         wiring คอนโทรลที่ใช้ร่วมกันทั้ง 3 สไตล์
```

## Tech stack

- **Canvas 2D API** — วาดกรอบอุปกรณ์และ export เป็น PNG ฝั่ง client
- **Vanilla JS + HTML/CSS** — ไม่มี build step, ไม่มี dependency, เปิดไฟล์ใช้ได้เลย

### แผนต่อยอด (ถ้าอยากขยับเป็น production)

- ห่อด้วย **Next.js + TypeScript + Tailwind + shadcn/ui** เพื่อ routing/SEO/component สำเร็จรูป
- deploy บน **Vercel** (static ก็พอ เพราะประมวลผลฝั่ง client)
- เพิ่ม: preset ขนาด social (X / IG / Product Hunt), batch mode, กรอบเพิ่มเติม, 3D tilt
