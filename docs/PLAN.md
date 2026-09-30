# แผนการพัฒนาฟีเจอร์ระดับ ★ (Tier 1)

## Global Lock Order
เพื่อป้องกัน Deadlock ทุก Transaction ต้องเรียงลำดับการ Lock ข้อมูลดังนี้:
1. `User` (ถ้ามีการ Lock User)
2. `Event` (ด้วย `FOR SHARE` หรือ `FOR UPDATE`)
3. `Booth` (เรียงลำดับตาม ID แบบ Ascending `ORDER BY id ASC`)
4. `Waitlist`
5. `Booking`
หากมี Transaction ใดไม่สามารถทำตามลำดับนี้ได้ ต้องมีกลไกป้องกัน (เช่น การ Retry เมื่อเกิด `P2034` แบบที่ใช้อยู่ใน Booking)

## S0. การจัดการความปลอดภัย Endpoint เดิม
- **ช่องโหว่:** ปัจจุบัน `POST /api/jobs/release-expired-bookings` ไม่มีกลไกป้องกันใดๆ (จากการตรวจสอบมีเพียง `apps/api/test-step5.js` ที่ใช้ทดสอบผ่าน HTTP เท่านั้น ส่วน Cron job เรียก Service โดยตรง)
- **แผนงาน:** ป้องกัน Endpoint นี้ด้วยการตรวจสอบ Secret Header โดยเปรียบเทียบแบบ Constant Time กับตัวแปร Environment ก่อนดำเนินการต่อ

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
- **Test เดิมที่ต้องยังผ่าน:** `auth.test.ts`
- **Web:** หน้า `/auth/register` (โหมดผู้ค้า), หน้า `/vendor/profile` (ฟอร์มแก้ไขข้อมูล)
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## B. หน้าสาธารณะสำหรับผู้เข้าชม
- **Schema:** ไม่มี
- **Endpoints:**
  - ใช้ Endpoint เดิม `GET /api/events/:id/booths` ขยายให้รองรับ Public (Anonymous) หากเป็น Authenticated (Vendor/Organizer) คืนฟิลด์เดิมครบถ้วน หากเป็น Anonymous คืนค่า DTO ที่มีแค่ `storeName`, `productType` สำหรับบูธที่ `CONFIRMED` ซ่อนข้อมูลชื่อ-อีเมลจริง
  - `GET /api/events` (Public): คืนค่ารายการอีเวนต์ทุกสถานะยกเว้น `DRAFT`
  - `GET /api/events/:id` (Public): ดูรายละเอียดงานและผังพื้นที่ หากเป็น `DRAFT` คืน 404
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มี (Read-only)
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี (ขยายของเดิม)
- **Tests ที่จะเขียนเพิ่ม:**
  - เข้าถึงงาน `DRAFT` ได้ 404
  - ข้อมูลบูธที่ `CONFIRMED` ต้องมีชื่อร้าน/สินค้า แต่ห้ามมีอีเมล/ชื่อจริง ในโหมด Public
- **Test เดิมที่ต้องยังผ่าน:** `node apps/api/test-endpoint-rules.js` (ต้องยังทำงานได้เหมือนเดิมสำหรับ Organizer และ Vendor)
- **Web:** หน้า UI ต้องไม่แสดงปุ่ม "จอง" สำหรับอีเวนต์ที่เป็น `CLOSED` หรือ `ENDED`
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5 (ซ่อนข้อมูลส่วนตัว)

## C. ประเภทบูธและค่าธรรมเนียมเพิ่ม
- **Schema:**
  - สร้างโมเดล `BoothType` (`id`, `eventId`, `name`, `physicalWidth` (Decimal 8,2), `physicalLength` (Decimal 8,2), `price` (Decimal 12,2))
  - `Booth` เพิ่มฟิลด์ `boothTypeId` โดยใช้ `Booth.price` เป็นแหล่งความจริงตอนจอง ผู้จัดสามารถแก้ `Booth.price` รายบูธได้
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
- **Test เดิมที่ต้องยังผ่าน:** (BLOCKED: requires owner decision - เนื่องจากการเพิ่มค่าธรรมเนียม/BoothType อาจต้องปรับแก้ Test คำนวณราคาเดิม ซึ่งขัดกับกฎห้ามแก้ Test เดิม)
- **Web:** ฟอร์มสร้างงานเพิ่มส่วนการจัดการค่าธรรมเนียม/ประเภทบูธ, หน้าชำระเงิน/รายละเอียดการจองของผู้ค้าต้องแสดง Breakdown
- **Quality Requirements Coverage:** รองรับข้อ 4 อย่างเคร่งครัด

## D. ยอมรับสัญญาเช่า
- **Schema:**
  - เพิ่มฟิลด์ `termsAndConditions` (Text) ใน `Event`
  - เพิ่มฟิลด์ `termsAcceptedAt` (DateTime), `termsHash` (String) และ `termsSnapshot` (Text) ใน `Booking`
- **Endpoints:**
  - `PATCH /api/organizer/events/:id/status` (Organizer): การเปลี่ยนสถานะเป็น PUBLISHED ต้องมี `termsAndConditions` ไม่ว่าง 
  - `GET /api/events/:id` : เซิร์ฟเวอร์ส่ง `termsHash` กลับไปด้วย
  - `POST /api/vendor/bookings` (Vendor): ภายใน `createBooking` ให้อ่าน Event ด้วย `SELECT ... FOR SHARE` ครั้งเดียว และใช้ล็อกนั้นในการตรวจสอบ `termsHash` จาก Client ว่าตรงกับข้อมูลปัจจุบันหรือไม่ หากตรงกันจึงบันทึกข้อมูล
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** `SELECT ... FOR SHARE` ร่วมกับการตรวจสอบ Event status
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - Publish ไม่ได้ถ้าไม่มี Terms
  - จองโดยส่ง `termsHash` ผิด ต้องถูก Reject 409
  - จองบูธสำเร็จ ต้องบันทึกเวลา, Hash และ Snapshot ได้ถูกต้อง
- **Test เดิมที่ต้องยังผ่าน:** `booking-hold.test.ts` (BLOCKED: requires owner decision - การบังคับส่ง termsHash จะทำให้การสร้าง Booking ใน Test เดิมพัง)
- **Web:** ฟอร์มสร้างงานเพิ่มช่องกรอกเงื่อนไข/สัญญา, Modal การจองรับ Hash แล้วส่งกลับ
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## E. ผู้ค้าสำรอง (Waitlist)
- **Schema:**
  - เพิ่มค่า `WAITLIST_HOLD` ใน enum `BoothStatus`
  - สร้างโมเดล `Waitlist` (`id`, `eventId`, `boothId`, `vendorId`, `status`, `expiresAt`, `createdAt`) (สถานะ: `PENDING`, `OFFERED`, `ACCEPTED`, `REJECTED`, `EXPIRED`)
  - เพิ่มคอลัมน์ `activeKey` (String? @unique) เพื่อบังคับ Partial Unique (ค่า = `boothId:vendorId` ขณะ PENDING/OFFERED, = `NULL` เมื่อหลุดคิว)
  - กำหนด `onDelete`: Waitlist to Event = `Restrict`, User = `Restrict`, Booth = `Cascade`
- **Endpoints:**
  - `POST /api/vendor/waitlist` (Vendor): เข้าคิวสำหรับบูธที่สถานะเป็น `BOOKED`, `PAYMENT_PENDING` หรือ `WAITLIST_HOLD` (ไม่อนุญาตให้เข้าคิวบูธที่ตัวเองถือ Booking ไว้แล้ว)
  - `DELETE /api/vendor/waitlist/:id` (Vendor): ออกจากคิวขณะ `PENDING`
  - `POST /api/vendor/waitlist/:id/accept` (Vendor): กดยอมรับสิทธิ์เมื่อเป็น `OFFERED`
  - `POST /api/vendor/waitlist/:id/decline` (Vendor): ปฏิเสธเมื่อเป็น `OFFERED` 
- **การเปลี่ยนสถานะ:**
  - `Waitlist`: `PENDING` -> `OFFERED` (โดยระบบ เมื่อบูธว่างลง ให้เวลาตัดสินใจ 30 นาที)
  - `Waitlist`: `OFFERED` -> `ACCEPTED` / `REJECTED` / `EXPIRED`
  - การ Accept ต้องเป็น Atomic Update: `Waitlist` OFFERED->ACCEPTED (where vendorId ตรง และ expiresAt > now) + `Booth` WAITLIST_HOLD->PAYMENT_PENDING + สร้าง Booking Hold 10 นาที
- **Concurrency & Prevention:**
  - การจัดคิว: คิวเรียงแบบ FIFO ด้วย `createdAt` และใช้ `id` เป็นตัวตัดสินกรณีที่เวลาเท่ากัน
  - การให้สิทธิ์ (Offer): เมื่อมีการให้สิทธิ์ ฟังก์ชันกลางต้องทำการตรวจโควตา หากผู้ค้าในคิวมีจำนวนบูธเกินโควตาแล้ว ให้ข้ามคิวนี้ (ตั้งสถานะ `REJECTED` พร้อมเหตุผล) และข้ามไปยังคิวถัดไป การตรวจโควตาจะถูกเช็กอีกครั้งในตอน Accept
  - **ฟังก์ชันปล่อยบูธกลาง (Central Booth Release Function):** ทุกเหตุการณ์ (booking หมดเวลา, สลิปตก 2 รอบ, คิวหมดเวลา, การกดยกเลิก/decline) ต้องเรียกฟังก์ชันกลางตัวเดียวกัน ภายใน `$transaction` ฟังก์ชันต้องทำ `updateMany` สำหรับ `Booth` โดยระบุสถานะต้นทางที่ชัดเจนและเช็ก count จากนั้นทำ `updateMany` สำหรับ `Waitlist` เป็น `OFFERED` พร้อมเช็ก count หากเงื่อนไข count ล้มเหลวต้อง Rollback/Abort Transaction 
  - หากบูธถูกปรับเป็น `DISABLED` หรือลบทิ้ง รายการ Waitlist ที่ค้างอยู่จะถูกยกเลิก (`EXPIRED`) โดยอัตโนมัติ 
  - แกนการจองระหว่าง Accept Waitlist กับ Create Booking ปกติ ต้องถูก Refactor ให้ใช้แกนร่วมกัน (Shared logic)
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ลบโค้ด Inlined release ใน `services/booking.service.ts` (บรรทัด 97-100) และ `services/payment.service.ts` (บรรทัด 125-128)
- **Tests ที่จะเขียนเพิ่ม:**
  - ปลดบูธพร้อมกันหลายทาง ต้องเข้า Central Function และคิวแรกได้ OFFERED
  - เข้าคิวซ้ำบูธเดิมพร้อมกัน ต้องสำเร็จ 1 (409 นอกนั้น)
  - Offer หมดเวลา Job รันแล้วส่งต่อคิวถัดไปสำเร็จ
  - Accept หลังหมดเวลาถูกปฏิเสธ และ Accept ชนกับ Job หมดเวลา ต้องจัดการอย่างปลอดภัย
- **Test เดิมที่ต้องยังผ่าน:** `booking-hold.test.ts`
- **Web:** ปุ่ม "Join Waitlist", Dashboard แสดงคิว
- **Quality Requirements Coverage:** รองรับข้อ 1

## F. สถานะอีเวนต์ 4 ค่า
- **Schema:**
  - เพิ่ม `ENDED` เข้าไปใน `EventStatus` enum ของ `schema.prisma`
- **Endpoints:**
  - `PATCH /api/organizer/events/:id/status` (Organizer): อัปเดตสถานะงาน
  - `DELETE /api/organizer/events/:id` (Organizer): ลบอีเวนต์ (Endpoint ใหม่)
- **ตารางการเปลี่ยนสถานะที่อนุญาต (Transition Rules Matrix):**
  | จากสถานะ | ไปสถานะ | อนุญาตหรือไม่ | เงื่อนไขเพิ่มเติม (Preconditions) |
  | --- | --- | --- | --- |
  | DRAFT | PUBLISHED | Yes | ต้องมี T&C ไม่ว่างเปล่า และต้องมีการสร้าง Booth ไว้แล้ว |
  | PUBLISHED | DRAFT | Yes | ต้องไม่มีข้อมูล Booking หรือ Waitlist ผูกอยู่กับอีเวนต์นี้ |
  | PUBLISHED | CLOSED | Yes | - |
  | CLOSED | PUBLISHED | Yes | - |
  | CLOSED | ENDED | Yes | - |
  | ENDED | (ใดๆ) | No | สถานะสิ้นสุด (Terminal) ห้ามเปลี่ยนกลับ |
- **การเปลี่ยนสถานะ:** 
  - หากเปลี่ยนเป็น `CLOSED` หรือ `ENDED`: คิว Waitlist ที่ `PENDING`/`OFFERED` ทั้งหมดจะถูกยกเลิก (`EXPIRED`), บูธที่ `WAITLIST_HOLD` จะกลับเป็น `AVAILABLE` ทันที แต่ Booking ที่ค้างชำระอยู่ จะยังสามารถดำเนินการชำระและยืนยันได้ตามปกติ
- **Concurrency & Prevention:**
  - ใน `createBooking` ต้องอ่าน Event ด้วย `SELECT ... FOR SHARE` ภายใน `$transaction` เพื่อเช็กว่าสถานะต้องไม่ใช่ `CLOSED` หรือ `ENDED` หรือ `DRAFT` 
  - `changeEventStatus` ต้องใช้ `updateMany` (where `id` และ `status` เดิม) แล้วตรวจสอบ `count`
  - การลบอีเวนต์ ต้องเป็น `$transaction` เดียวที่ลบ `Booth`, `Zone`, `BoothType`, `EventFee` ก่อน (เนื่องจาก onDelete Restrict) และเช็กก่อนว่าจำนวน Booking ทั้งหมดเท่ากับ 0
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** การตั้งสถานะอีเวนต์แบบไม่มีกฎบังคับ ปัจจุบัน Endpoint `changeEventStatus` เป็นอิสระ และสร้างใหม่ Endpoint ลบอีเวนต์
- **Tests ที่จะเขียนเพิ่ม:**
  - พยายามสร้าง Booking ขณะที่งานเปลี่ยนเป็น `CLOSED` พอดี (Race Condition test `FOR SHARE` vs `updateMany`)
  - ลบงาน DRAFT ที่มี Zone/Booth ต้องจัดการลบตารางลูกได้สมบูรณ์ใน Transaction เดียว
  - ลบงานไม่ได้ถ้ามี Booking ผูกอยู่
- **Test เดิมที่ต้องยังผ่าน:** `state-transitions.test.ts` และ `node apps/api/test-transitions.js`
- **Quality Requirements Coverage:** ข้อ 5
