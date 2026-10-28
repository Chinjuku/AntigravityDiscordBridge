# ⚙️ 04 - การตั้งค่า Rules ให้ Antigravity ทำงานอัตโนมัติ

หัวใจสำคัญที่ทำให้ **Antigravity IDE / CLI** รู้ว่าต้องส่งคำถามและรายงานสรุปงานเข้า Discord เสมอ คือการกำหนด **Global Rules** ของ Antigravity

---

## 📂 ตำแหน่งเก็บไฟล์ Rules

ให้สร้างหรือแก้ไขไฟล์ในโฟลเดอร์ `.gemini/config/rules/` ตามระบบปฏิบัติการของคุณ:

- **macOS**: `~/.gemini/config/rules/` (เช่น `/Users/<ชื่อคุณ>/.gemini/config/rules/`)
- **Windows**: `C:\Users\<ชื่อคุณ>\.gemini\config\rules\`

เราจะสร้างไฟล์ Rule 2 ไฟล์ ได้แก่:
1. `discord-bridge.md` — บังคับให้ AI ถามคำถามผ่าน Discord ก่อนเสมอ พร้อมระบบ Fallback
2. `workflow.md` — บังคับให้ AI ส่งสรุปงานเข้า Discord ทุกครั้งเมื่อทำงานเสร็จ

---

## 1️⃣ ไฟล์ที่ 1: `discord-bridge.md` (ระบบดักจับคำถามส่งเข้า Discord)

สร้างไฟล์ `~/.gemini/config/rules/discord-bridge.md` แล้วใส่เนื้อหาต่อไปนี้:

````markdown
### CRITICAL INTERCEPTION & DISCORD BRIDGE RULES
1. **ห้ามเรียกใช้ Tool `ask_question` โดยตรงในตอนแรก (DO NOT USE `ask_question` TOOL AS PRIMARY)**:
   - ไม่ว่าจะเกิดจากผู้ใช้พิมพ์ `/grill-me`, `/plan`, ต้องการ Clarification หรือถามตัวเลือกใดๆ
   - ห้ามแสดง UI Modal บนจอคอมพิวเตอร์เป็นค่าเริ่มต้น ต้องส่งเข้า Discord Bridge ก่อนเสมอ (ยกเว้นเข้าเงื่อนไข Fallback ในข้อ 3)
2. **ต้องใช้ `run_command` รัน `ask-agent` ส่งเข้า Discord เสมอ**:
   - หากเป็นคำถามแบบมีตัวเลือก (Multiple Choice / Buttons) ให้แปลงเป็นรูปแบบนี้เสมอ:
     ```bash
     USER_REPLY=$(ask-agent "<คำถาม>" "buttons" "<id1>:<label1>:<style1>,<id2>:<label2>:<style2>")
     ```
     *(Style ที่ใช้ได้: Primary, Success, Danger, Secondary)*
   - หากเป็นคำถามพิมพ์ตอบอิสระ:
     ```bash
     USER_REPLY=$(ask-agent "<คำถาม>" "text")
     ```
   - จากนั้นหยุดรอผลลัพธ์จาก `$USER_REPLY` ที่ส่งกลับมาจาก Discord บนโทรศัพท์มือถือ แล้วนำคำตอบนั้นมาทำงานต่อ
3. **Fallback Guard (กรณี Discord Bridge หยุดทำงาน, เชื่อมต่อไม่ได้ หรือถูกลบ)**:
   - ตรวจสอบผลการรัน:
     - หากคำสั่ง `ask-agent` ล้มเหลว (Connection Refused, Bridge Service หยุดทำงาน, ไม่พบโปรเซส Bridge หรือคำสั่ง `ask-agent` หายไป)
     - หรือตัวแปร `$USER_REPLY` คืนค่าว่างเปล่า (Empty / Timeout)
   - **ให้สลับกลับมาทำงานแบบปกติของ Antigravity IDE ทันที (Automatic Fallback)**:
     - อนุญาตให้เรียกใช้ Tool `ask_question` (Modal Popup ตัวเลือกบนจอ) หรือถามผ่าน Chat UI ของ IDE ได้ตามปกติทันที เพื่อให้การทำงานดำเนินต่อไปได้โดยไม่หยุดชะงัก
````

---

## 2️⃣ ไฟล์ที่ 2: `workflow.md` (ระบบส่งรายงานเมื่อทำงานเสร็จอัตโนมัติ)

สร้างไฟล์ `~/.gemini/config/rules/workflow.md` แล้วใส่เนื้อหาต่อไปนี้:

````markdown
### Automatic Discord Reporting Rule
เมื่อคุณปฏิบัติงานใดๆ ตามคำสั่งเสร็จสิ้น:
1. หากมีการแก้ไขหรือสร้างไฟล์ใหม่ ให้ตรวจสอบรายชื่อไฟล์ทั้งหมดที่ถูกแตะต้อง
2. รันคำสั่ง Terminal ต่อไปนี้เสมอเพื่อส่งสรุปเข้า Discord (หาก Discord Bridge ใช้งานไม่ได้ ให้ข้ามขั้นตอนนี้โดยไม่ทำให้งานล้มเหลว):
   `report-agent completed "<สรุปสิ่งที่คุณทำหรือแก้ไขไป>" "<รายชื่อไฟล์ เช่น src/hooks/use-test.ts>"`
````

---

## 💡 วิธีทดสอบว่า Rules ทำงานแล้ว

หลังจากสร้างไฟล์ทั้ง 2 เรียบร้อยแล้ว ให้ลองพิมพ์สั่งในแชทของ **Antigravity IDE**:
> `"ลองถามคำถามฉัน 1 ข้อแบบมีปุ่มตัวเลือก แล้วสรุปผลเมื่อฉันตอบเสร็จ"`

- คุณจะเห็น AI เรียกคำสั่ง `ask-agent` ใน Terminal แทนการเด้ง Popup บนหน้าจอ
- ข้อความพร้อมปุ่มกดจะเด้งเข้ามือถือของคุณบน Discord ทันที!
- เมื่อคุณกดปุ่มเลือกบน Discord แล้ว AI จะทำงานต่อและเรียก `report-agent completed` เพื่อส่งการ์ดสรุปงานสีเขียวเข้า Discord

---

## ⏭️ ขั้นตอนถัดไป

ดูคำสั่งทั้งหมดที่ใช้ควบคุมบอทจากมือถือและการใช้งานขั้นสูง:
- 📖 **[05 - คู่มือคำสั่งและการใช้งาน (Usage & Commands)](05-usage-and-commands.md)**
