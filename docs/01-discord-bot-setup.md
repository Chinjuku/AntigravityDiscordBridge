# 🤖 01 - การสร้างและตั้งค่า Discord Bot

คู่มือนี้อธิบายขั้นตอนการสร้าง Discord Bot และดึงค่า **`DISCORD_BOT_TOKEN`** กับ **`DISCORD_CHANNEL_ID`** เพื่อนำมาใช้งานกับระบบ Bridge (ใช้ขั้นตอนเดียวกันทั้งบน **macOS** และ **Windows**)

---

## ขั้นตอนที่ 1: สร้าง Application และ Bot

1. ไปที่เว็บไซต์ [Discord Developer Portal](https://discord.com/developers/applications) และเข้าสู่ระบบ
2. คลิกปุ่ม **New Application** (มุมขวาบน)
3. ตั้งชื่อบอท เช่น `Antigravity Bridge` แล้วกด **Create**
4. ไปที่เมนู **Bot** ทางแถบด้านซ้าย

---

## ขั้นตอนที่ 2: เปิด Privileged Gateway Intents (สำคัญมาก ⚠️)

เพื่อให้บอทสามารถอ่านข้อความที่คุณพิมพ์ตอบกลับหรือพิมพ์คำสั่ง `!ai` ได้ ต้องเปิด Intents ต่อไปนี้:

1. ในหน้าเมนู **Bot** ให้เลื่อนลงมาที่หัวข้อ **Privileged Gateway Intents**
2. เปิดสวิตช์ (Toggle On) ทั้ง 3 ตัว หรืออย่างน้อยต้องเปิด:
   - ✅ **Message Content Intent** *(จำเป็นที่สุด ถ้าไม่เปิด บอทจะไม่อ่านข้อความที่พิมพ์)*
   - ✅ **Server Members Intent**
3. กดปุ่ม **Save Changes** ด้านล่าง

---

## ขั้นตอนที่ 3: คัดลอก Bot Token (`DISCORD_BOT_TOKEN`)

1. ยังอยู่ในหน้าเมนู **Bot** เลื่อนขึ้นไปด้านบนสุดใต้ชื่อบอท
2. คลิกปุ่ม **Reset Token** (หรือ **View Token**) แล้วกดยืนยัน
3. คัดลอก Token ที่ได้เก็บไว้ (นำไปใส่ในไฟล์ `.env` ในขั้นตอนถัดไป)

> ⚠️ **ข้อควรระวัง**: ห้ามเปิดเผย Bot Token นี้ให้ผู้อื่น หรืออัปโหลดขึ้น Git สาธารณะเด็ดขาด

---

## ขั้นตอนที่ 4: เชิญบอทเข้าสู่เซิร์ฟเวอร์ (Discord Server)

1. ไปที่เมนู **OAuth2** ทางแถบด้านซ้าย
2. เลื่อนลงมาที่หัวข้อ **OAuth2 URL Generator**
3. ในกรอบ **Scopes** ให้ติ๊กเลือก:
   - ✅ `bot`
   - ✅ `applications.commands` *(จำเป็นสำหรับใช้งาน Slash Commands เช่น `/ai`, `/projects`, `/status`)*
4. ในกรอบ **Bot Permissions** ที่ปรากฏขึ้นมาด้านล่าง ให้ติ๊กเลือก:
   - ✅ `View Channels`
   - ✅ `Send Messages`
   - ✅ `Embed Links`
   - ✅ `Attach Files`
   - ✅ `Read Message History`
   - ✅ `Add Reactions`
   - ✅ `Use Slash Commands`
5. เลื่อนลงมาล่างสุด คัดลอกลิงก์จากช่อง **Generated URL** ไปเปิดในเว็บเบราว์เซอร์
6. เลือกเซิร์ฟเวอร์ Discord ของคุณ แล้วกด **Authorize**

---

## ขั้นตอนที่ 5: ดึงเลขห้องแชท (`DISCORD_CHANNEL_ID`)

1. เปิดแอป **Discord** (บนคอมพิวเตอร์หรือมือถือ)
2. ไปที่ **User Settings (ตั้งค่าผู้ใช้)** ⚙️ > **Advanced (ขั้นสูง)**
3. เปิดสวิตช์ **Developer Mode (โหมดนักพัฒนา)**
4. กลับมาที่เซิร์ฟเวอร์ของคุณ สร้างห้องแชทข้อความใหม่ (เช่น `#antigravity-ai`)
5. **คลิกขวาที่ชื่อห้องแชท** แล้วเลือก **Copy Channel ID (คัดลอก ID ช่อง)**
6. เก็บตัวเลขที่ได้ไว้ใส่ในไฟล์ `.env`

---

## ⏭️ ขั้นตอนถัดไป

เลือกคู่มือการติดตั้งตามระบบปฏิบัติการของคุณ:
- 🍎 **[02 - คู่มือการติดตั้งสำหรับ macOS](02-install-macos.md)**
- 🪟 **[03 - คู่มือการติดตั้งสำหรับ Windows](03-install-windows.md)**
