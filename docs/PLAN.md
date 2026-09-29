# แผนการพัฒนาฟีเจอร์ระดับ ★ (Tier 1)

## A. สมัครสมาชิกผู้ค้า (Vendor Register)
- **Schema:**
  - สร้างโมเดล `VendorProfile` (`id`, `userId` @unique, `storeName`, `productType`, `createdAt`, `updatedAt`) เชื่อมกับ `User`
- **Endpoints:**
  - `POST /api/auth/register/vendor` (Public): สร้าง User (Role=VENDOR เสมอ) และ VendorProfile ทำการ Hash password และมี Rate limit
  - `PUT /api/vendor/profile` (Vendor): แก้ไขข้อมูล `storeName`, `productType`
  - `GET /api/vendor/profile` (Vendor): ดูข้อมูล Profile ของตัวเอง
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** อีเมลซ้ำป้องกันด้วย `@unique` ในตาราง `User` หากเกิด P2002 ให้คืนค่าแจ้งเตือนแบบไม่เจาะจงเพื่อความปลอดภัย (เช่น "อีเมลนี้ถูกใช้งานแล้วหรือมีข้อผิดพลาด")
- **Tests:**
  - สมัครสำเร็จ ได้ token และ profile ถูกสร้าง
  - ป้องกันการสมัครอีเมลซ้ำ (ข้อมูลไม่รั่วไหล)
  - Validation failures ผ่าน Zod
  - แก้ไขข้อมูล profile สำเร็จและปฏิเสธหากไม่มีสิทธิ์
- **Web:** หน้า `/auth/register` (โหมดผู้ค้า), หน้า `/vendor/profile` (ฟอร์มแก้ไขข้อมูล)
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกครั้ง)

## B. หน้าสาธารณะสำหรับผู้เข้าชม
- **Schema:** ไม่มี
- **Endpoints:**
  - `GET /api/public/events` (Public): คืนค่ารายการอีเวนต์ที่สถานะเป็น `PUBLISHED` เท่านั้น
  - `GET /api/public/events/:id` (Public): ดูรายละเอียดงานและผังพื้นที่ หากไม่ใช่ `PUBLISHED` คืน 404
  - `GET /api/public/events/:id/booths` (Public): คืนรายการบูธ หากบูธเป็น `BOOKED` ให้ดึงข้อมูล `storeName`, `productType` จาก `VendorProfile` (ผ่าน booking) โดยซ่อนข้อมูล `name`, `email` จริงของผู้ค้า
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มี (Read-only)
- **Tests:**
  - ดึงข้อมูลงาน `PUBLISHED` สำเร็จ 
  - เข้าถึงงาน `DRAFT`, `CLOSED`, `ENDED` ได้ 404
  - ข้อมูลบูธที่ `BOOKED` ต้องมีชื่อร้าน/สินค้า แต่ห้ามมีอีเมล/ชื่อจริงของผู้ใช้
- **Web:** เพิ่มหน้า `/events` (รายการงาน) และ `/events/[id]` (รายละเอียด+ผัง) สำหรับผู้เข้าชมทั่วไป
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ซ่อนข้อมูลส่วนตัว)

## C. ประเภทบูธและค่าธรรมเนียมเพิ่ม
- **Schema:**
  - สร้างโมเดล `BoothType` (`id`, `eventId`, `name`, `width`, `length`, `price`)
  - `Booth` เพิ่มฟิลด์ `boothTypeId` โดยราคายังคงคัดลอกมาไว้ที่ `Booth.price` เป็นแหล่งอ้างอิงตอนจอง
  - สร้างโมเดล `EventFee` (`id`, `eventId`, `name`, `amount`, `type` [enum `PER_BOOKING`, `PER_BOOTH`])
  - เพิ่มฟิลด์ `feesSnapshot` (Json) ในโมเดล `Booking` เพื่อเก็บรายละเอียดค่าธรรมเนียม ณ เวลาจอง
- **Endpoints:**
  - `POST/PUT /api/events/:id/fees` และ `POST/PUT /api/events/:id/booth-types` (Organizer): จัดการค่าธรรมเนียมและประเภทบูธ
  - `POST /api/bookings` (Vendor): คำนวณ `totalAmount` โดยแยกตามประเภท `EventFee.type` (ถ้า `PER_BOOTH` คูณจำนวนบูธ, ถ้า `PER_BOOKING` บวกครั้งเดียว)
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ป้องกันการเปลี่ยนราคาระหว่างจองโดยโหลดราคาจาก `tx.booth` และ `tx.eventFee` ภายใน `$transaction` เดียวกันตอนคำนวณยอด
- **Tests:**
  - การจองคำนวณ totalAmount ได้ถูกต้อง (บูธ + ค่าธรรมเนียม)
  - การเปลี่ยนราคา EventFee ในภายหลัง ไม่กระทบ `totalAmount` ของ Booking เก่า
- **Web:** ฟอร์มสร้างงานเพิ่มส่วนการจัดการค่าธรรมเนียม, หน้าชำระเงิน/รายละเอียดการจองของผู้ค้าต้องแสดง Breakdown ของค่าธรรมเนียม
- **Quality Requirements Coverage:** รองรับข้อ 4 อย่างเคร่งครัด (ยอดเงินคำนวณฝั่งเซิร์ฟเวอร์เท่านั้น) จะมีการเขียน Test ว่าถ้าส่งราคามั่วมาจาก Client ต้องถูกเพิกเฉย

## D. ยอมรับสัญญาเช่า
- **Schema:**
  - เพิ่มฟิลด์ `termsAndConditions` (Text) ใน `Event`
  - เพิ่มฟิลด์ `termsAcceptedAt` (DateTime), `termsHash` (String) และ `termsSnapshot` (Text) ใน `Booking`
- **Endpoints:**
  - `POST /api/bookings` (Vendor): รับ `termsHash` จาก Client เปรียบเทียบกับ Hash ฝั่งเซิร์ฟเวอร์ หากไม่ตรงให้ตอบ 409 เพื่อให้อ่านเวอร์ชันล่าสุด หากตรง บันทึกเวลา/Hash/ข้อความเต็ม ลงใน Booking
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มีผลต่อ Concurrency แต่เป็นการ Audit
- **Tests:**
  - จองโดยส่ง `termsHash` ผิด หรือไม่ได้ส่ง ต้องถูก Reject 409
  - จองบูธสำเร็จ ต้องบันทึกเวลา, Hash และสำเนาข้อความ (Snapshot) ได้ถูกต้อง
- **Web:** ฟอร์มสร้างงานเพิ่มช่องกรอกเงื่อนไข/สัญญา, Modal การจองเพิ่ม Checkbox ยอมรับสัญญาพร้อมแสดงข้อความสัญญา
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ตรวจจับและบังคับใช้เงื่อนไขตามบริบท)

## E. ผู้ค้าสำรอง (Waitlist)
- **Schema:**
  - เพิ่มค่า `WAITLIST_HOLD` ใน enum `BoothStatus`
  - สร้างโมเดล `Waitlist` (`id`, `eventId`, `boothId`, `vendorId`, `status`, `expiresAt`, `createdAt`)
  - `WaitlistStatus` enum: `PENDING`, `OFFERED`, `ACCEPTED`, `REJECTED`, `EXPIRED`
- **Endpoints:**
  - `POST /api/waitlist` (Vendor): เข้าคิวสำหรับบูธที่สถานะเป็น `BOOKED` หรือ `PAYMENT_PENDING` (ไม่มีการคำนวณโควตาในขั้นตอนนี้)
  - `POST /api/waitlist/:id/accept` (Vendor): กดยอมรับสิทธิ์เมื่อสถานะคิวเป็น `OFFERED` (พร้อมส่ง `termsHash` ตรวจโควตา และสร้าง Booking ภายใน 10 นาที)
- **การเปลี่ยนสถานะ:**
  - `Waitlist`: `PENDING` -> `OFFERED` (โดยระบบ เมื่อบูธว่างลง ให้เวลาตัดสินใจ 30 นาที)
  - `Waitlist`: `OFFERED` -> `ACCEPTED` / `REJECTED` / `EXPIRED`
- **Concurrency & Prevention:**
  - ลงคิวซ้ำไม่ได้: ตั้งค่า `@unique([boothId, vendorId])` โดยที่ยังเป็น `PENDING` หรือ `OFFERED`
  - จัดสรรให้คนเดียว: **ต้องมีฟังก์ชันกลาง (Central Function) ตัวเดียวที่จัดการการปลดบูธ** (จาก hold หมดเวลา, สลิปตก 2 รอบ, คิวหมดเวลา) ภายใน Transaction จะสแกนหาคิวแรก หากมีให้ตั้ง `Waitlist` เป็น `OFFERED` (หมดอายุ 30 นาที) และตั้งค่า `Booth` เป็น `WAITLIST_HOLD` ทันที หากไม่มีคิวให้ตั้งเป็น `AVAILABLE`
- **Tests:**
  - (1) ปลดบูธพร้อมกันหลายทาง ฟังก์ชันกลางต้องทำงานถูกต้อง ได้คนในคิว 1 คน และ Booth กลายเป็น `WAITLIST_HOLD`
  - (2) การยิง API เข้าคิวซ้ำบูธเดิมพร้อมกัน ต้องสำเร็จแค่ 1 รายการ นอกนั้นได้ 409
  - (3) ถ้ารับสิทธิ์แล้ว Quota เกิน ต้องไม่ให้ผ่าน
- **Web:** ผังบูธสำหรับผู้ค้าจะเปลี่ยนปุ่มเป็น "Join Waitlist" หากบูธไม่ว่าง, หน้า Dashboard เพิ่มส่วนแสดงคิวและปุ่มกดรับสิทธิ์
- **Quality Requirements Coverage:** รองรับข้อ 1 (ป้องกัน Race condition ในการจัดสรรทรัพยากร) เพิ่ม Test ชุดใหม่เฉพาะสำหรับ Waitlist concurrency

## F. สถานะอีเวนต์ 4 ค่า
- **Schema:**
  - เพิ่ม `ENDED` เข้าไปใน `EventStatus` enum ของ `schema.prisma`
- **Endpoints:**
  - `PUT /api/events/:id/status` (Organizer): อัปเดตสถานะงาน
  - `POST /api/bookings` (Vendor): เพิ่มเงื่อนไขว่าจองได้เฉพาะตอนงานเป็น `PUBLISHED` เท่านั้น
  - `DELETE /api/events/:id` (Organizer): อนุญาตเฉพาะ `DRAFT` และต้องไม่มีบูธถูกจอง
- **การเปลี่ยนสถานะ:** 
  - `DRAFT` -> `PUBLISHED` -> `CLOSED` -> `ENDED` (ตรวจสอบ State Machine)
- **Concurrency & Prevention:** จังหวะที่มีการเปลี่ยนสถานะเป็น `CLOSED` หากมีคนกำลังส่ง Request จองเข้ามาพอดี Transaction ของการจองต้องตรวจสอบ `event.status` และพบว่าเป็น `CLOSED` จากนั้นทำ Rollback ทันที
- **Tests:**
  - พยายามสร้าง Booking ในขณะที่งานเป็น `CLOSED` หรือ `ENDED` ต้องถูกปฏิเสธ (400/409)
  - สามารถลบงาน DRAFT ที่ยังไม่มีใครจองได้สำเร็จ
  - ปฏิเสธการลบงานที่ PUBLISHED แล้ว หรือมีข้อมูลการจองผูกอยู่
- **Web:** UI จัดการงานของผู้จัดงานเพิ่มปุ่ม/Dropdown เพื่อปรับเป็นสถานะ 4 ค่า
- **Quality Requirements Coverage:** ข้อ 5 (ผู้จัดงานแก้ไขงานตัวเองได้เท่านั้น และการตรวจสอบสถานะสอดคล้อง)

---

