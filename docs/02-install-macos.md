# 🍎 02 - คู่มือการติดตั้งสำหรับ macOS

คู่มือการติดตั้งและตั้งค่า **Antigravity Discord Bridge** แบบละเอียดทุกขั้นตอนสำหรับระบบปฏิบัติการ **macOS**

---

## 📋 สิ่งที่ต้องมีก่อนติดตั้ง (Prerequisites)

ตรวจสอบว่าเครื่อง Mac ของคุณมีโปรแกรมเหล่านี้ติดตั้งไว้แล้ว โดยเปิดแอป **Terminal** แล้วรัน:

```bash
node -v      # แนะนำ Node.js v18 ขึ้นไป
python3 -V   # มีมาให้ใน macOS หรือผ่าน Xcode Command Line Tools
curl -V      # มีมาให้ใน macOS
```

> 💡 หากยังไม่มี Node.js สามารถติดตั้งผ่าน Homebrew ได้ด้วยคำสั่ง `brew install node`

---

## ขั้นตอนที่ 1: ดาวน์โหลดโปรเจกต์และติดตั้ง Dependencies

เปิด Terminal แล้วรันคำสั่งต่อไปนี้:

```bash
# 1. เข้าไปยังโฟลเดอร์เก็บโปรเจกต์ของคุณ
cd ~/Documents/project/antigravity-discord-bridge

# 2. ติดตั้งแพ็กเกจที่จำเป็น (discord.js, express, dotenv)
npm install
```

---

## ขั้นตอนที่ 2: ตั้งค่าไฟล์ `.env`

คัดลอกไฟล์ `.env.example` เป็น `.env` แล้วใส่ค่าที่ได้จาก [ขั้นตอนที่ 01](01-discord-bot-setup.md) รวมถึงตั้งค่า `PROJECTS_DIR` เพื่อให้บอทสแกนหาโปรเจกต์ทั้งหมดในเครื่องให้อัตโนมัติ:

```bash
cp .env.example .env
```

จากนั้นแก้ไขไฟล์ `.env`:
```env
DISCORD_BOT_TOKEN=ใส่_TOKEN_ของคุณที่นี่
DISCORD_CHANNEL_ID=ใส่_CHANNEL_ID_ของคุณที่นี่
PORT=4321

# โฟลเดอร์หลักที่เก็บโปรเจกต์ทั้งหมด (ระบบจะสแกนหาโฟลเดอร์ย่อยไปใส่ใน /projects และ Auto-complete ให้อัตโนมัติ)
PROJECTS_DIR=~/Documents/project
```

---

## ขั้นตอนที่ 3: ตรวจสอบ Path ของ `agy` ใน `bridge.mjs`

หากคุณต้องการสั่งงาน AI ผ่านแชท Discord ด้วยคำสั่ง `/ai`, `!ai` หรือการกด Reply ให้ตรวจสอบว่ามีคำสั่ง `agy` อยู่ที่ใด:

```bash
which agy
```

- ปกติจะอยู่ที่ `/Users/<ชื่อผู้ใช้>/.local/bin/agy`
- เปิดไฟล์ `bridge.mjs` บริเวณฟังก์ชัน `runAgyTask` (บรรทัดที่ `385`) แล้วตรวจสอบว่าตรงกับชื่อ User ของเครื่องคุณหรือไม่:
  ```javascript
  const agyBin = '/Users/ชื่อผู้ใช้ของคุณ/.local/bin/agy';
  ```
- *(หมายเหตุ: สำหรับโฟลเดอร์รวมโปรเจกต์ ไม่ต้องแก้ในโค้ดแล้ว สามารถกำหนดผ่าน `PROJECTS_DIR` ในไฟล์ `.env` ได้เลย)*

---

## ขั้นตอนที่ 4: ติดตั้ง CLI (`ask-agent` และ `report-agent`) ให้เรียกได้จากทุกที่

เพื่อให้ Antigravity Agent สามารถเรียกคำสั่ง `ask-agent` และ `report-agent` ได้จากทุกโฟลเดอร์โปรเจกต์ ให้ทำตามขั้นตอนนี้:

```bash
# 1. สร้างโฟลเดอร์ ~/.local/bin (หากยังไม่มี)
mkdir -p ~/.local/bin

# 2. ให้สิทธิ์การรัน (Executable Permission) แก่ไฟล์สคริปต์
chmod +x bin/ask-agent bin/report-agent

# 3. คัดลอกหรือสร้าง Symlink ไปยัง ~/.local/bin
ln -sf "$(pwd)/bin/ask-agent" ~/.local/bin/ask-agent
ln -sf "$(pwd)/bin/report-agent" ~/.local/bin/report-agent
```

ตรวจสอบว่า `~/.local/bin` อยู่ใน `PATH` ของ Zsh แล้วหรือยัง:

```bash
# เพิ่ม ~/.local/bin เข้า ~/.zshrc (หากยังไม่มี)
grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.zshrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# ทดสอบเรียกดูตำแหน่งคำสั่ง
which ask-agent report-agent
```

---

## ขั้นตอนที่ 5: เริ่มต้นรันเซิร์ฟเวอร์และทดสอบระบบ

### 5.1 รันแบบปกติใน Terminal
```bash
node bridge.mjs
```
หากสำเร็จจะแสดงข้อความ:
```text
🚀 Bridge พร้อมทำงานแบบครบวงจรที่ http://localhost:4321
🤖 Discord Bridge ครบวงจร พร้อมทำงาน: YourBotName#1234
```

### 5.2 เปิด Terminal อีกหน้าต่างเพื่อทดสอบส่งข้อความเข้า Discord
```bash
# ทดสอบส่งรายงาน
report-agent completed "ติดตั้งบน macOS สำเร็จแล้ว!" "README.md"

# ทดสอบส่งคำถามแบบปุ่มกด (ลองกดปุ่มใน Discord ดูว่าจะส่งค่ากลับมาที่ Terminal หรือไม่)
ask-agent "ระบบบน macOS ทำงานปกติไหม?" "buttons" "ok:ใช้งานได้ดีมาก:Success,retry:ขอเช็กอีกครั้ง:Secondary"
```

---

## ขั้นตอนที่ 6: การตั้งให้รันเบื้องหลังอัตโนมัติ (Background Service ด้วย PM2)

หากไม่ต้องการเปิดหน้าต่าง Terminal ทิ้งไว้ตลอดเวลา แนะนำให้ใช้ `pm2`:

```bash
# 1. ติดตั้ง PM2 แบบ Global
npm install -g pm2

# 2. สั่งรัน bridge.mjs ในชื่อ "discord-bridge"
pm2 start bridge.mjs --name "discord-bridge"

# 3. บันทึกสถานะและตั้งให้เปิดอัตโนมัติเมื่อเปิดเครื่อง Mac
pm2 save
pm2 startup
```

คำสั่งจัดการ PM2 ที่ใช้บ่อย:
- ดูสถานะ: `pm2 status`
- ดู Log การทำงาน: `pm2 logs discord-bridge`
- รีสตาร์ทบอท: `pm2 restart discord-bridge`

---

## ⏭️ ขั้นตอนถัดไป

ไปต่อที่การตั้งค่า Rules เพื่อให้ Antigravity ส่งคำถามและรายงานผลอัตโนมัติ:
- ⚙️ **[04 - การตั้งค่า Rules ให้ Antigravity ทำงานอัตโนมัติ](04-antigravity-rules.md)**
