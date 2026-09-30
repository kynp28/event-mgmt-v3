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
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - สมัครสำเร็จ ได้ token และ profile ถูกสร้าง
  - ป้องกันการสมัครอีเมลซ้ำ (ข้อมูลไม่รั่วไหล)
  - Validation failures ผ่าน Zod
  - แก้ไขข้อมูล profile สำเร็จและปฏิเสธหากไม่มีสิทธิ์
- **Test เดิมที่ต้องยังผ่าน:** test-auth.test.ts
- **Web:** หน้า `/auth/register` (โหมดผู้ค้า), หน้า `/vendor/profile` (ฟอร์มแก้ไขข้อมูล)
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกครั้ง)

## B. หน้าสาธารณะสำหรับผู้เข้าชม
- **Schema:** ไม่มี
- **Endpoints:**
  - ใช้ Endpoint เดิม `GET /api/events/:id/booths` ขยายให้รองรับ Public (ดึง Token ถ้ามี แต่ถ้าไม่มีก็ยังดึงข้อมูลได้) หากเป็น Public คืนค่า DTO ที่มีแค่ `storeName`, `productType` สำหรับบูธที่ `CONFIRMED` ซ่อนข้อมูลชื่อ-อีเมลจริง
  - `GET /api/events` (Public): คืนค่ารายการอีเวนต์ที่สถานะไม่ใช่ `DRAFT`
  - `GET /api/events/:id` (Public): ดูรายละเอียดงานและผังพื้นที่ หากเป็น `DRAFT` คืน 404
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มี (Read-only)
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี (ขยายของเดิม)
- **Tests ที่จะเขียนเพิ่ม:**
  - เข้าถึงงาน `DRAFT` ได้ 404
  - ข้อมูลบูธที่ `CONFIRMED` ต้องมีชื่อร้าน/สินค้า แต่ห้ามมีอีเมล/ชื่อจริง
- **Test เดิมที่ต้องยังผ่าน:** test ของ Endpoint `/api/events` เดิมทั้งหมด (สิทธิ์ของ organizer ต้องทำงานได้เหมือนเดิม)
- **Web:** ใช้หน้า `/events` (รายการงาน) และ `/events/[id]` (รายละเอียด+ผัง) ที่มีอยู่แล้วสำหรับผู้เข้าชมทั่วไป
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ซ่อนข้อมูลส่วนตัว)

## C. ประเภทบูธและค่าธรรมเนียมเพิ่ม
- **Schema:**
  - สร้างโมเดล `BoothType` (`id`, `eventId`, `name`, `physicalWidth` (Decimal 8,2), `physicalLength` (Decimal 8,2), `price` (Decimal 12,2))
  - `Booth` เพิ่มฟิลด์ `boothTypeId` โดยใช้ `Booth.price` เป็นแหล่งความจริงตอนจอง (คัดลอกมาจาก BoothType ตอนสร้าง) ผู้จัดสามารถแก้ `Booth.price` รายบูธได้
  - สร้างโมเดล `EventFee` (`id`, `eventId`, `name`, `amount` (Decimal 12,2), `type` [enum `PER_BOOKING`, `PER_BOOTH`])
  - เพิ่มฟิลด์ `feesSnapshot` (Json) ในโมเดล `Booking`
- **Endpoints:**
  - `POST/PUT /api/organizer/events/:eventId/fees` และ `POST/PUT /api/organizer/events/:eventId/booth-types` (Organizer): จัดการค่าธรรมเนียมและประเภทบูธ
  - `POST /api/vendor/bookings` (Vendor): คำนวณ `totalAmount` โดยแยกตามประเภท `EventFee.type`
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ป้องกันการเปลี่ยนราคาระหว่างจองโดยโหลดราคาจาก `tx.booth` และ `tx.eventFee` ภายใน `$transaction` เดียวกันตอนคำนวณยอด
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ตรรกะการคำนวณราคาแบบเก่าที่บวกเฉพาะค่าบูธ
- **Tests ที่จะเขียนเพิ่ม:**
  - การจองคำนวณ totalAmount ได้ถูกต้อง (บูธ + ค่าธรรมเนียม)
  - การเปลี่ยนราคา EventFee หรือ BoothType ในภายหลัง ไม่กระทบ `totalAmount` ของ Booking เก่า
- **Test เดิมที่ต้องยังผ่าน:** test คำนวณราคาเดิมต้องผ่าน (ปรับเล็กน้อยให้ตรง schema ใหม่)
- **Web:** ฟอร์มสร้างงานเพิ่มส่วนการจัดการค่าธรรมเนียม/ประเภทบูธ, หน้าชำระเงิน/รายละเอียดการจองของผู้ค้าต้องแสดง Breakdown
- **Quality Requirements Coverage:** รองรับข้อ 4 อย่างเคร่งครัด (ยอดเงินคำนวณฝั่งเซิร์ฟเวอร์เท่านั้น)

## D. ยอมรับสัญญาเช่า
- **Schema:**
  - เพิ่มฟิลด์ `termsAndConditions` (Text) ใน `Event`
  - เพิ่มฟิลด์ `termsAcceptedAt` (DateTime), `termsHash` (String) และ `termsSnapshot` (Text) ใน `Booking`
- **Endpoints:**
  - `PATCH /api/organizer/events/:id/status` (Organizer): การจะเปลี่ยนสถานะเป็น PUBLISHED ต้องมี `termsAndConditions` ไม่ว่าง (คู่กับเงื่อนไขต้องมีบูธ)
  - `GET /api/events/:id` : เซิร์ฟเวอร์คำนวณและส่ง `termsHash` กลับไปด้วย
  - `POST /api/vendor/bookings` (Vendor): รับ `termsHash` จาก Client เปรียบเทียบกับ Hash ปัจจุบันของอีเวนต์ หากไม่ตรงให้ตอบ 409 หากตรง บันทึกเวลา/Hash/ข้อความเต็ม ลงใน Booking
- **การเปลี่ยนสถานะ:**
  - เงื่อนไข `DRAFT` -> `PUBLISHED` เข้มงวดขึ้น
- **Concurrency & Prevention:** ตรวจ Hash ภายใน Transaction ป้องกันผู้จัดแก้สัญญาตรงกับจังหวะที่ผู้ค้ากดจอง
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - Publish ไม่ได้ถ้าไม่มี Terms
  - จองโดยส่ง `termsHash` ผิด ต้องถูก Reject 409
  - จองบูธสำเร็จ ต้องบันทึกเวลา, Hash และ Snapshot ได้ถูกต้อง
- **Test เดิมที่ต้องยังผ่าน:** test การจองเดิมทั้งหมด
- **Web:** ฟอร์มสร้างงานเพิ่มช่องกรอกเงื่อนไข/สัญญา, Modal การจองรับ Hash แล้วส่งกลับ
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## E. ผู้ค้าสำรอง (Waitlist)
- **Schema:**
  - เพิ่มค่า `WAITLIST_HOLD` ใน enum `BoothStatus`
  - สร้างโมเดล `Waitlist` (`id`, `eventId`, `boothId`, `vendorId`, `status`, `expiresAt`, `createdAt`)
  - `WaitlistStatus` enum: `PENDING`, `OFFERED`, `ACCEPTED`, `REJECTED`, `EXPIRED`
  - เพิ่มคอลัมน์ `activeKey` (String? @unique) ใน Waitlist เพื่อบังคับ Partial Unique (ค่า = `boothId:vendorId` ขณะ PENDING/OFFERED, = `NULL` เมื่อหลุดคิว)
- **Endpoints:**
  - `POST /api/vendor/waitlist` (Vendor): เข้าคิวสำหรับบูธที่สถานะเป็น `BOOKED`, `PAYMENT_PENDING` หรือ `WAITLIST_HOLD` (ไม่มีการตรวจโควตาในขั้นตอนนี้)
  - `POST /api/vendor/waitlist/:id/accept` (Vendor): กดยอมรับสิทธิ์เมื่อเป็น `OFFERED` (ตรวจโควตา รับ `termsHash` สร้าง Booking)
  - Job หมดเวลา 30 นาที สำหรับคิว (ต่อยอด Release Job เดิม)
- **การเปลี่ยนสถานะ:**
  - `Waitlist`: `PENDING` -> `OFFERED` (โดยระบบ เมื่อบูธว่างลง ให้เวลาตัดสินใจ 30 นาที)
  - `Waitlist`: `OFFERED` -> `ACCEPTED` / `REJECTED` / `EXPIRED`
  - การ Accept ต้องเป็น Atomic Update: `Waitlist` OFFERED->ACCEPTED (where vendorId ตรง และ expiresAt > now) + `Booth` WAITLIST_HOLD->PAYMENT_PENDING + สร้าง Booking Hold 10 นาที
- **Concurrency & Prevention:**
  - ลงคิวซ้ำไม่ได้: จัดการโดย `activeKey` @unique
  - **ฟังก์ชันปล่อยบูธกลาง (Central Booth Release Function):** ทุกเหตุการณ์ (booking หมดเวลา 10 นาที, สลิปตก 2 รอบ, คิวหมดเวลา 30 นาที) ต้องเรียกฟังก์ชันกลางตัวเดียวกัน ภายใน `$transaction` ฟังก์ชันนี้จะเช็กคิว หากมีคิวจะเปลี่ยน Waitlist เป็น `OFFERED` (expires 30 นาที) และ Booth เป็น `WAITLIST_HOLD` ทันที หากไม่มีคิว Booth กลับเป็น `AVAILABLE`
  - แกนการจองระหว่าง Accept Waitlist กับ Create Booking ปกติ ต้องถูก Refactor ให้ใช้แกนร่วมกัน (Shared logic) ห้ามคัดลอกโค้ด
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** Release Job เก่าจะถูกขยายความสามารถ
- **Tests ที่จะเขียนเพิ่ม:**
  - ปลดบูธพร้อมกันหลายทาง ต้องเข้า Central Function และคิวแรกได้ OFFERED 
  - เข้าคิวซ้ำบูธเดิมพร้อมกัน ต้องสำเร็จ 1 (409 นอกนั้น)
  - Offer หมดเวลา Job รันแล้วส่งต่อคิวถัดไปสำเร็จ
  - Accept หลังหมดเวลาถูกปฏิเสธ
  - Accept ชนกับ Job หมดเวลา ต้องจัดการอย่างปลอดภัย
- **Test เดิมที่ต้องยังผ่าน:** concurrency booking-hold
- **Web:** ปุ่ม "Join Waitlist", Dashboard แสดงคิว
- **Quality Requirements Coverage:** รองรับข้อ 1 (Concurrency ปลอดภัยสูงสุด)

## F. สถานะอีเวนต์ 4 ค่า
- **Schema:**
  - เพิ่ม `ENDED` เข้าไปใน `EventStatus` enum ของ `schema.prisma`
- **Endpoints:**
  - `PATCH /api/organizer/events/:id/status` (Organizer): อัปเดตสถานะงาน (ตารางสถานะที่อนุญาต: DRAFT<->PUBLISHED<->CLOSED->ENDED)
  - `DELETE /api/organizer/events/:id` (Organizer): อนุญาตเฉพาะ `DRAFT` และไม่มีบูธ/โซนผูกอยู่ (จัดการ onDelete Restrict)
- **การเปลี่ยนสถานะ:** 
  - หากเปลี่ยนเป็น `CLOSED` หรือ `ENDED`: คิว Waitlist ที่ `PENDING`/`OFFERED` ทั้งหมดจะถูกยกเลิก (`EXPIRED`), บูธที่ `WAITLIST_HOLD` จะกลับเป็น `AVAILABLE` ทันที แต่ Booking ที่ค้างชำระอยู่ (PAYMENT_PENDING, PENDING_VERIFICATION) จะยังสามารถดำเนินการชำระและยืนยันได้ตามปกติ
- **Concurrency & Prevention:**
  - ห้ามใช้วิธีอ่าน `event.status` แล้วค่อยตรวจสอบ ให้เปลี่ยน `createBooking` เป็นการล็อก Event ด้วย `FOR SHARE` ภายใน `$transaction`
  - `changeEventStatus` ต้องใช้ `updateMany` (where `id` และ `status` เดิม) แล้วตรวจสอบ `count`
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** API ลบอีเวนต์เดิมที่ไม่ได้จัดการ Restrict
- **Tests ที่จะเขียนเพิ่ม:**
  - พยายามสร้าง Booking ขณะที่งานเปลี่ยนเป็น `CLOSED` พอดี (Race Condition test `FOR SHARE` vs `updateMany`)
  - ลบงาน DRAFT ที่มี Zone/Booth ต้องจัดการลบตารางลูกได้สมบูรณ์ใน Transaction เดียว
  - ลบงานไม่ได้ถ้ามี Booking ผูกอยู่
- **Test เดิมที่ต้องยังผ่าน:** test-state-transitions
- **Web:** UI จัดการงานปรับสถานะได้ 4 ค่า
- **Quality Requirements Coverage:** ข้อ 5
