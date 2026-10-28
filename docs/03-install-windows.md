# 🪟 03 - คู่มือการติดตั้งสำหรับ Windows

คู่มือการติดตั้งและตั้งค่า **Antigravity Discord Bridge** แบบละเอียดสำหรับระบบปฏิบัติการ **Windows 10 / 11**

---

## 📋 สิ่งที่ต้องมีก่อนติดตั้ง (Prerequisites)

บนเครื่อง Windows ของคุณต้องติดตั้งโปรแกรมพื้นฐาน 3 ตัวนี้:

1. **Node.js (v18 ขึ้นไป)**: ดาวน์โหลดจาก [nodejs.org](https://nodejs.org/)
2. **Git for Windows (มาพร้อม Git Bash และ `curl`)**: ดาวน์โหลดจาก [git-scm.com](https://git-scm.com/download/win)
3. **Python 3**: ดาวน์โหลดจาก [python.org](https://www.python.org/downloads/) *(ตอนติดตั้งให้ติ๊ก ✅ **Add python.exe to PATH** ด้วย)*

ทดสอบใน **PowerShell** หรือ **Command Prompt (CMD)**:
```powershell
node -v
git --version
python --version
```

---

## ขั้นตอนที่ 1: ติดตั้งแพ็กเกจของโปรเจกต์

เปิด **PowerShell** แล้วเข้าไปที่โฟลเดอร์ของโปรเจกต์ เช่น `C:\Projects\antigravity-discord-bridge`:

```powershell
cd C:\Projects\antigravity-discord-bridge
npm install
```

---

## ขั้นตอนที่ 2: ตั้งค่าไฟล์ `.env`

คัดลอกไฟล์ `.env.example` เป็น `.env` ในโฟลเดอร์โปรเจกต์ แล้วใส่ค่าที่ได้จาก [ขั้นตอนที่ 01](01-discord-bot-setup.md) พร้อมระบุโฟลเดอร์รวมโปรเจกต์ใน `PROJECTS_DIR`:

```powershell
Copy-Item .env.example .env
```

แก้ไขไฟล์ `.env`:
```env
DISCORD_BOT_TOKEN=ใส่_TOKEN_ของคุณที่นี่
DISCORD_CHANNEL_ID=ใส่_CHANNEL_ID_ของคุณที่นี่
PORT=4321

# โฟลเดอร์หลักที่เก็บโปรเจกต์ทั้งหมดบนเครื่อง Windows (รองรับทั้ง C:\... และ ~/...)
PROJECTS_DIR=C:\Projects
```

---

## ขั้นตอนที่ 3: ปรับตั้งค่าสำหรับ Windows

### 3.1 ปรับ `python3` ในสคริปต์ (กรณี Windows รู้จักเฉพาะคำสั่ง `python`)
บน Windows บางเครื่อง คำสั่ง Python จะชื่อ `python` แทนที่จะเป็น `python3`
คุณสามารถเปิด **Git Bash** ในโฟลเดอร์โปรเจกต์ แล้วรันคำสั่งนี้เพื่อแปลง `python3` เป็น `python` ในไฟล์ `bin/` หรือสร้าง Alias ได้ง่ายๆ:

```bash
sed -i 's/python3/python/g' bin/ask-agent bin/report-agent
```

### 3.2 ปรับ Path ของ `agy` ใน `bridge.mjs`
เปิดไฟล์ `bridge.mjs` บริเวณฟังก์ชัน `runAgyTask` (บรรทัดที่ `385-392`) แล้วแก้ไขการเรียกใช้ `agy` CLI ให้เหมาะกับเครื่อง Windows ของคุณ:

```javascript
const agyBin = 'agy.cmd'; // หรือใส่ Full Path ของ agy บนเครื่องคุณ
const child = spawn(agyBin, ['--dangerously-skip-permissions', '-p', prompt], {
    cwd: targetCwd,
    shell: true, // สำคัญสำหรับ Windows เพื่อให้รัน .cmd / .bat ได้
    env: process.env
});
```
*(หมายเหตุ: โฟลเดอร์รวมโปรเจกต์จะถูกสแกนอัตโนมัติจากค่า `PROJECTS_DIR` ในไฟล์ `.env`)*

---

## ขั้นตอนที่ 4: สร้างไฟล์ `.cmd` Wrapper ให้เรียก `ask-agent` และ `report-agent` ได้จากทั้ง PowerShell, CMD และ Git Bash

เนื่องจากไฟล์ใน `bin/` เป็น Bash Script เพื่อให้ Windows เรียกใช้คำสั่ง `ask-agent` และ `report-agent` ได้จากทุก Terminal ให้สร้างไฟล์ `.cmd` คู่กันไว้ในโฟลเดอร์ `bin/`:

### 4.1 สร้างไฟล์ `bin\ask-agent.cmd`
สร้างไฟล์ `bin\ask-agent.cmd` แล้ววางโค้ดนี้:
```bat
@echo off
"C:\Program Files\Git\bin\bash.exe" "%~dp0ask-agent" %*
```

### 4.2 สร้างไฟล์ `bin\report-agent.cmd`
สร้างไฟล์ `bin\report-agent.cmd` แล้ววางโค้ดนี้:
```bat
@echo off
"C:\Program Files\Git\bin\bash.exe" "%~dp0report-agent" %*
```

### 4.3 เพิ่มโฟลเดอร์ `bin` เข้าสู่ Windows PATH
1. กดปุ่ม `Win + S` พิมพ์ **Environment Variables** แล้วเลือก **Edit the system environment variables**
2. คลิกปุ่ม **Environment Variables...**
3. ในช่อง **User variables** ด้านบน เลือกตัวแปร **Path** แล้วกด **Edit...**
4. กด **New** แล้ววาง Path เต็มของโฟลเดอร์ `bin` เช่น:
   ```text
   C:\Projects\antigravity-discord-bridge\bin
   ```
5. กด **OK** ทุกหน้าต่าง แล้ว **ปิดและเปิด PowerShell / Antigravity IDE ใหม่**

ทดสอบพิมพ์ใน PowerShell หรือ Git Bash:
```powershell
ask-agent --help
```

---

## ขั้นตอนที่ 5: เริ่มต้นรันเซิร์ฟเวอร์และทดสอบระบบ

### 5.1 รันเซิร์ฟเวอร์ใน PowerShell
```powershell
node bridge.mjs
```

### 5.2 เปิด PowerShell หรือ Git Bash อีกหน้าต่างเพื่อทดสอบ
```powershell
# ทดสอบส่งรายงานเข้า Discord
report-agent completed "ติดตั้งบน Windows สำเร็จเรียบร้อย!" "README.md"

# ทดสอบส่งคำถามแบบปุ่มกด
ask-agent "ทดสอบระบบบน Windows ใช้งานได้ไหม?" "buttons" "yes:ใช้งานได้:Success,no:มีปัญหา:Danger"
```

---

## ขั้นตอนที่ 6: การรันเป็น Background Service บน Windows (ด้วย PM2)

หากต้องการให้ Bridge ทำงานเบื้องหลังตลอดโดยไม่ต้องเปิดหน้าต่าง PowerShell ทิ้งไว้:

```powershell
# 1. ติดตั้ง PM2 และตัวช่วย Startup สำหรับ Windows
npm install -g pm2 pm2-windows-startup

# 2. สั่งรัน bridge.mjs
pm2 start bridge.mjs --name "discord-bridge"

# 3. ตั้งให้ทำงานอัตโนมัติเมื่อเปิดเครื่อง Windows
pm2-startup install
pm2 save
```

---

## ⏭️ ขั้นตอนถัดไป

ไปต่อที่การตั้งค่า Rules เพื่อให้ Antigravity ส่งคำถามและรายงานผลอัตโนมัติ:
- ⚙️ **[04 - การตั้งค่า Rules ให้ Antigravity ทำงานอัตโนมัติ](04-antigravity-rules.md)**
