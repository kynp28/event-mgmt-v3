# แผนการพัฒนาฟีเจอร์ระดับ ★ (Tier 1)

## Global Lock Order

**หลักการพื้นฐาน (Core Principle):**
1. **Gate-First:** Conditional-update gates ต้องทำงานเป็นอันดับแรก หาก Gate คืนค่า count เป็น 0 (ล้มเหลว) ให้ Throw และ Rollback ทั้ง Transaction ทันที
2. **Global Order:** Row locks (`SELECT ... FOR UPDATE` หรือ `FOR SHARE`) และการแก้ไขข้อมูลต้องเป็นไปตามลำดับนี้: `User` -> `Event` -> `Booth` (เรียงตาม `id` ASC) -> `Waitlist` -> `Booking` -> `Payment` -> `Ticket`. หมายเหตุ: Global order อธิบายถึงลำดับการ Lock ข้อมูล ขณะที่ลำดับการลบข้อมูล (Deletion order) จะต้องเป็นไปตาม Data dependencies (ลบตารางลูกก่อนตารางแม่เสมอ)
3. **Gate Wins:** หากหลักการ Gate-First ขัดแย้งกับ Global Order ให้ **Gate เป็นฝ่ายชนะ (Gate Wins)** เสมอ
4. **Retry Mechanism:** ทุก Transaction ที่ลำดับเบี่ยงเบนจาก Global Order (เนื่องจาก Gate Wins) ต้องมีกลไก Catch Deadlock/Serialization errors (Prisma `P2034`, MySQL `1213`) และทำการ **Retry อย่างจำกัดจำนวนครั้ง (เช่น 3 ครั้ง)** และแต่ละ Transaction เหล่านี้ต้องมีการเขียน Concurrency Test ระบุในแผน

**ตารางลำดับการ Lock และอัปเดตของแต่ละ Transaction:**
| Transaction | ลำดับการ Lock/Update (Actual Sequence) | ตาม Global Order? | เหตุผลการเบี่ยงเบน / วิธีการแก้ไข |
| --- | --- | --- | --- |
| `createBooking` | `User` (FOR UPDATE) -> `Event` (FOR SHARE) -> `Booth` (gate/updateMany) -> `Booking` (create) | Yes | เป็นไปตามลำดับ |
| `waitlist accept` | `User` (FOR UPDATE) -> `Event` (FOR SHARE) -> `Waitlist` (gate/updateMany) -> `Booth` (updateMany) -> `Booking` (create) | No | Gate (`Waitlist`) ต้องมาก่อนเพื่อกัน ABA; ละเมิด Global Order; ต้องมีกลไก Retry + Concurrency test |
| Central release function | `Booth` (updateMany) -> `Waitlist` (updateMany) | Yes | เป็นไปตามลำดับ |
| `releaseExpiredBookings` (Job) | `Booking` (gate/update) -> `Booth` (updateMany) -> `Waitlist` (updateMany) | No | Gate (`Booking`) ต้องมาก่อนเพื่อยกเลิกการปล่อยบูธหากเพิ่งจ่ายเงินสำเร็จ; ต้องมี Retry + Concurrency test |
| offer-expiry job | `Waitlist` (gate/update) -> `Booth` (updateMany) -> `Waitlist` (next offer) | No | Gate (`Waitlist`) ต้องมาก่อน; ต้องมี Retry + Concurrency test |
| `verifyPayment approve` | `Payment` (gate/update) -> `Booking` -> `Booth` -> `Ticket` | No | Gate (`Payment`) ต้องมาก่อน; ต้องมี Retry + Concurrency test |
| `verifyPayment reject` | `Payment` (gate/update) -> `Booking` -> `Booth` -> `Waitlist` (Central) | No | Gate (`Payment`) ต้องมาก่อน; ต้องมี Retry + Concurrency test |
| `uploadSlip` | `Booking` (gate/updateMany) -> `Payment` (create) | Yes | เป็นไปตามลำดับ |
| `changeEventStatus` | `Event` (gate/updateMany) | Yes | เป็นไปตามลำดับ |
| `deleteEvent` | `Event` (FOR UPDATE) -> `Waitlist` ฯลฯ -> `Booth` (delete) -> `Event` (delete) | Yes | ล็อก `Event` เป็นลำดับแรก การลบตารางลูกทำตามลำดับ Data Dependency (ลบ Waitlist ก่อน Booth) |
| `decline` / `leave` (Waitlist) | `Waitlist` (gate/update) -> `Booth` (updateMany) -> `Waitlist` (next offer) | No | Gate (`Waitlist`) ต้องมาก่อน; ต้องมี Retry + Concurrency test |

## Definition of Done (เกณฑ์ความสำเร็จ)
ข้อกำหนดเหล่านี้บังคับใช้กับทุก Feature ที่จะพัฒนา:
1. **Vitest Suite Fully Green:** Test ทั้งหมดใน Vitest ต้องผ่าน 100%
2. **Legacy Scripts Pass:** Legacy Scripts ทั้งหมดที่เคยเป็น PASS ใน `docs/BASELINE.md` จะต้องยังคงทำงานผ่านภายใต้ Baseline Protocol (reset, migrate deploy, seed, start API, run script, stop API)
3. **No Type Errors:** คำสั่ง `pnpm --filter api exec tsc --noEmit` ต้องทำงานสำเร็จโดยไม่มี Error
4. **Seed Compatibility:** ทุก Column ที่สร้างใหม่จะต้อง อนุญาตให้เป็น Nullable หรือต้องมี Default Value เพื่อให้ Seed Script ดั้งเดิมยังสามารถทำงานได้ตามปกติ
5. **Dependency-Safe Teardown:** ฟังก์ชัน `clearDb` ใน `tests/helpers.ts` ต้องถูกปรับแก้เพิ่มลำดับการลบข้อมูลของตารางใหม่ตาม Dependency Order ที่ถูกต้อง (ลบตารางที่อ้างอิง User, Event, Booth ออกให้หมดก่อน)

## Rollback Semantics (กฏการยกเลิก Transaction)
Any transaction that performs several conditional updates must **throw and roll back everything** if any gate update or dependent update returns count 0. 
สำหรับ Background jobs ที่ประมวลผลทีละรายการต่อหนึ่ง Transaction จะต้องใช้วิธี **catch the sentinel error, roll back that item's transaction, and continue with the next item**. คำว่า "Skip" จะไม่หมายถึงการ commit การเปลี่ยนแปลงเพียงบางส่วนโดยเด็ดขาด 
**ตัวอย่าง (Expiry Job):** หาก Job ทำการปล่อยบูธ (Booth release) ไปก่อนหน้า แล้วต่อมาการเช็ก Booking gate คืนค่า count 0 (เช่น Vendor เพิ่งอัปโหลดสลิปสำเร็จในขณะนั้น) ตัว Transaction จะต้องถูก Rollback เพื่อยกเลิกการปล่อยบูธที่ทำไปแล้วด้วย

## ABA Note & Gate Order Deviation
- **Waitlist Accept:** สถานะบูธ `WAITLIST_HOLD` ไม่สามารถระบุได้ว่า Offer ใดเป็นผู้ถือครองสิทธิ์ ดังนั้นการทำ Conditional update บนแถว `Waitlist` (โดยใช้ vendor, OFFERED, expiresAt ในอนาคต) จึงเป็นตัวตัดสิน (Arbiter/Gate) หากการปรับปรุง Gate นี้ล้มเหลว (เช่นหมดเวลาหรือยอมรับไปแล้ว) จะต้อง **Roll back** การกระทำทั้งหมด รวมถึงการปรับสถานะบูธ นี่เป็นเหตุผลที่การเรียงลำดับเป็น `Waitlist` -> `Booth` แทนที่จะเป็นไปตาม Global Order

## S0. การจัดการความปลอดภัย Endpoint เดิม
- **ช่องโหว่:** ปัจจุบัน `POST /api/jobs/release-expired-bookings` ไม่มีกลไกป้องกันใดๆ (มีเพียง `apps/api/test-step5.js` ที่ทดสอบผ่าน HTTP ส่วน Cron job เรียกผ่าน Service โดยตรง)
- **แผนงาน:** Endpoint นี้จะอ่าน Secret จากตัวแปร Environment (ตั้งชื่อว่า `JOBS_SECRET`) นำมาเทียบกับ Request Header แบบ Constant Time หากไม่มีการตั้งค่า `JOBS_SECRET` หรือไม่ตรง จะตอบ 404
- **ข้อยกเว้นที่ได้รับอนุญาต:** อนุญาตให้เพิ่มโค้ด 1 บรรทัดใน `apps/api/test-step5.js` เพื่อแนบ Header ให้การทดสอบทำงานต่อได้

## A. สมัครสมาชิกผู้ค้า (Vendor Register)
- **Schema:**
  - สร้างโมเดล `VendorProfile` (`id`, `userId` @unique, `storeName`, `productType`, `createdAt`, `updatedAt`) เชื่อมกับ `User` โดยให้คอลัมน์ `storeName` และ `productType` เป็น `VarChar(100)` (ผ่าน 2 migrations)
- **Endpoints:**
  - `POST /api/auth/register/vendor` (Public): สร้าง User (Role=VENDOR เสมอ) ด้วย atomic nested create พร้อมกับ VendorProfile, Hash รหัสผ่านด้วย bcrypt, ตรวจสอบรหัสผ่านขั้นต่ำ 8 ตัวอักษรและสูงสุด 72 UTF-8 bytes หากสมัครด้วยอีเมลที่ซ้ำจะตอบ 409 CONFLICT ด้วยข้อความแบบ generic กำหนด Rate limit การสมัครไว้ที่ 10/hour/IP ผ่าน named constant และ response ข้อมูลผู้ใช้งานที่ส่งกลับจะต้องไม่มีรหัสผ่าน (password hash)
  - `GET /api/vendor/profile` (Vendor): ดูข้อมูล Profile ของตัวเอง (หากไม่มีข้อมูลจะตอบ 404 พร้อมรหัส `VENDOR_PROFILE_NOT_FOUND`)
  - `PUT /api/vendor/profile` (Vendor): แก้ไขข้อมูล `storeName` และ `productType` (บังคับส่งทั้ง 2 ค่าแบบ strict body) โดยทำงานแบบ Upsert (ลอง create ก่อน หากเกิด P2002/P2034 จะวนลูป retry เป็น update แทน สูงสุด 3 ครั้ง) สำเร็จจะได้ 201 สำหรับการสร้างใหม่ หรือ 200 สำหรับการอัปเดต
- **ฟังก์ชันภายใน:**
  - ฟังก์ชัน `createApp(options)` ถูกแก้ไขให้รับพารามิเตอร์จำกัด Rate limit แบบ override ได้สำหรับ login/register
  - Vendor ในข้อมูล Seed เดิมจะถูกเจตนาปล่อยให้ไม่มี `VendorProfile`
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ป้องกัน Upsert Race condition ผ่านการทำ Retry loop ที่ไม่ให้ P2002/P2034 หลุดไปหาผู้ใช้
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - ทดสอบทั้งหมด 35 tests โดยมีไฟล์ `vendor-register.test.ts` (14 tests) ซึ่งครอบคลุม Rate Limiting, Access Control, Unknown keys, Lifecycle, Upsert Concurrency 20 parallel และ Password Limits และไฟล์ `auth-login-dto.test.ts` (5 tests) เพื่อป้องกัน Password Leaks
- **Test เดิมที่ต้องยังผ่าน:** `node apps/api/test-auth.js`
- **Web:** สร้างหน้า `/auth/register` และ `/vendor/profile` (โหมดผู้ค้า) พร้อมคลาส `ApiError` และ `thai-errors` helper สำหรับแปลข้อความผิดพลาด, เพิ่มลิงก์บนหน้า login และ vendor dashboard. เว็บได้รับการตรวจสอบด้วย lint (ไฟล์ที่สร้าง/แก้ไขใน A2 มี 0 problems; ยังคงมี 3 problems เดิมใน login/page.tsx และ vendor/page.tsx), tsc และ build สำเร็จ การทำงานบนเบราว์เซอร์ถูกทดสอบด้วยตนเองโดยเจ้าของโปรเจกต์เพียงกรณีการสมัครสมาชิกสำเร็จ 1 ครั้ง ส่วนรายการทดสอบ manual อื่นๆ ระบุเป็น NOT TESTED
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## B. หน้าสาธารณะสำหรับผู้เข้าชม
- **Schema:** ไม่มี
- **Endpoints:**
  - ใช้ Endpoint เดิม `GET /api/events/:id/booths` ขยายให้รองรับ Public (Anonymous) หากเป็น Authenticated (Vendor/Organizer) จะคืนฟิลด์เดิมครบถ้วน หากเป็น Anonymous คืนค่า DTO ที่มีแค่ `storeName`, `productType` สำหรับบูธที่ `CONFIRMED` ซ่อนข้อมูลชื่อ-อีเมลจริง *(หมายเหตุ: Public booth DTO ต้องรองรับกรณีที่ผู้ค้าอาจยังไม่มี VendorProfile โดยยอมให้ storeName และ productType มีค่าเป็น null ได้ และฝั่ง UI จะต้องแสดงป้ายกำกับกลางแทนที่จะพัง)*
  - `GET /api/events` (Public): คืนค่ารายการอีเวนต์ทุกสถานะยกเว้น `DRAFT`
  - `GET /api/events/:id` (Public): ดูรายละเอียดงานและผังพื้นที่ หากเป็น `DRAFT` คืน 404
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มี (Read-only)
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี (ขยายของเดิม)
- **Tests ที่จะเขียนเพิ่ม:**
  - เข้าถึงงาน `DRAFT` ได้ 404
  - ข้อมูลบูธที่ `CONFIRMED` ต้องมีชื่อร้าน/สินค้า แต่ห้ามมีอีเมล/ชื่อจริง ในโหมด Public
- **Test เดิมที่ต้องยังผ่าน:**
  - เขียน Characterization Tests ใน Vitest ที่บันทึกพฤติกรรมปัจจุบันของ `GET /api/events/:id/booths` (ฟิลด์ทั้งหมดที่จะคืนค่าให้ Vendor/Organizer, คืน 401 ให้ Anonymous, DRAFT ซ่อนสำหรับ Vendors) และต้องรันผ่านบนโค้ดชุดเดิมก่อนที่จะเริ่มแก้โค้ดเส้นทางนี้
  - (หมายเหตุ: ลบ `test-endpoint-rules.js` ออกจากรายการเนื่องจาก NOT RUNNABLE จากปัญหา Hard-coded CUID)
- **Web:** หน้า UI ต้องไม่แสดงปุ่ม "จอง" สำหรับอีเวนต์ที่เป็น `CLOSED` หรือ `ENDED`
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## C. ประเภทบูธและค่าธรรมเนียมเพิ่ม
- **Schema:**
  - สร้างโมเดล `BoothType` (`id`, `eventId`, `name`, `physicalWidth` (Decimal 8,2), `physicalLength` (Decimal 8,2), `price` (Decimal 12,2))
  - `Booth` เพิ่มฟิลด์ `boothTypeId` โดยใช้ `Booth.price` เป็นแหล่งความจริงตอนจอง ผู้จัดสามารถแก้ `Booth.price` รายบูธได้
  - สร้างโมเดล `EventFee` (`id`, `eventId`, `name`, `amount` (Decimal 12,2), `type` [enum `PER_BOOKING`, `PER_BOOTH`])
  - เพิ่มฟิลด์ `feesSnapshot` (Json) ในโมเดล `Booking`
- **Endpoints:**
  - `POST/PUT /api/organizer/events/:eventId/fees` และ `POST/PUT /api/organizer/events/:eventId/booth-types` (Organizer): จัดการค่าธรรมเนียมและประเภทบูธ
  - `POST /api/vendor/bookings` (Vendor): คำนวณ `totalAmount`
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ป้องกันการเปลี่ยนราคาระหว่างจองโดยโหลดราคาจาก `tx.booth` และ `tx.eventFee` ภายใน `$transaction` เดียวกัน
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ตรรกะการคำนวณราคาแบบเก่า
- **Tests ที่จะเขียนเพิ่ม:**
  - การจองคำนวณ totalAmount ได้ถูกต้อง (บูธ + ค่าธรรมเนียม)
  - การเปลี่ยนราคา EventFee หรือ BoothType ในภายหลัง ไม่กระทบ `totalAmount` ของ Booking เก่า
- **Test เดิมที่ต้องยังผ่าน:** ไม่มี Test ใน Vitest ที่ตั้งชื่อเป็น Pricing Test โดยเฉพาะ การออกแบบเป็นแบบ **Backward-compatible:** ถ้าง่วนต์ใดไม่มีแถวใน EventFee ยอดรวมจะเท่ากับผลรวมของ Booth.price ตามเดิม 100% ทำให้ Test เก่าผ่านทั้งหมด
- **Web:** ฟอร์มสร้างงานเพิ่มส่วนการจัดการค่าธรรมเนียม/ประเภทบูธ, หน้าชำระเงินต้องแสดง Breakdown
- **Quality Requirements Coverage:** รองรับข้อ 4 อย่างเคร่งครัด

## D. ยอมรับสัญญาเช่า
- **Schema:**
  - เพิ่มฟิลด์ `termsAndConditions` (Text) ใน `Event`
  - เพิ่มฟิลด์ `termsAcceptedAt` (DateTime), `termsHash` (String) และ `termsSnapshot` (Text) ใน `Booking`
- **Endpoints:**
  - `PATCH /api/organizer/events/:id/status` (Organizer): การเปลี่ยนสถานะเป็น PUBLISHED จะปฏิเสธหาก `termsAndConditions` เป็นค่าว่างเปล่า (ดังนั้นงานที่ PUBLISHED แล้วจะมีเงื่อนไขเสมอในระบบจริง)
  - `GET /api/events/:id` : เซิร์ฟเวอร์ส่ง `termsHash` กลับไปด้วย
  - `POST /api/vendor/bookings` (Vendor): ภายใน `createBooking` ให้อ่าน Event ด้วย `SELECT ... FOR SHARE` ครั้งเดียว
    - หาก Event มีเงื่อนไขการเช่าที่ไม่ว่างเปล่า จำเป็นต้องส่ง `termsHash` หากไม่มีหรือส่งมาผิด ให้ตอบ 409
    - หาก Event ไม่มีเงื่อนไข (กรณีทดสอบหรือฐานข้อมูลเก่า) ข้อมูลการยอมรับจะไม่ถูกบันทึก (ฟิลด์ terms ทั้งหลายเป็น null) และไม่ต้องส่ง Hash
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** `SELECT ... FOR SHARE` ร่วมกับการตรวจสอบ Event status และ termsHash
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - Publish ไม่ได้ถ้าไม่มี Terms
  - จองโดยส่ง `termsHash` ผิด ต้องถูก Reject 409 (เมื่อมี Terms)
  - จองสำเร็จบันทึก Hash ถูกต้อง (เมื่อมี Terms)
  - จองสำเร็จโดยฟิลด์ terms เป็น null (เมื่อไม่มี Terms)
- **Test เดิมที่ต้องยังผ่าน:** `booking-hold.test.ts` และการจองเดิมทั้งหมด เนื่องจากจะทำเงื่อนไขตกเข้ากรณีที่ "ไม่มีเงื่อนไข (null)" ทำให้ทำงานผ่านได้โดยไม่ต้องแก้ Test เดิม
- **Web:** ฟอร์มสร้างงานเพิ่มช่องกรอกเงื่อนไข/สัญญา, Modal การจองรับ Hash แล้วส่งกลับ
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## E. ผู้ค้าสำรอง (Waitlist)
- **Schema:**
  - เพิ่มค่า `WAITLIST_HOLD` ใน enum `BoothStatus`
  - สร้างโมเดล `Waitlist` (`id`, `eventId`, `boothId`, `vendorId`, `status`, `expiresAt`, `createdAt`, `reason` (String?)) (สถานะ: `PENDING`, `OFFERED`, `ACCEPTED`, `REJECTED`, `EXPIRED`)
  - เพิ่มคอลัมน์ `activeKey` (String? @unique) เพื่อบังคับ Partial Unique (ค่า = `boothId:vendorId` ขณะ PENDING/OFFERED, = `NULL` เมื่อหลุดคิว)
  - กำหนด `onDelete`: Waitlist to Event = `Restrict`, User = `Restrict`, **Booth = `Restrict`**
- **Endpoints:**
  - `POST /api/vendor/waitlist` (Vendor): เข้าคิวสำหรับบูธที่สถานะเป็น `BOOKED`, `PAYMENT_PENDING` หรือ `WAITLIST_HOLD`
  - `DELETE /api/vendor/waitlist/:id` (Vendor): ออกจากคิวขณะ `PENDING`
  - `POST /api/vendor/waitlist/:id/accept` (Vendor): กดยอมรับสิทธิ์เมื่อเป็น `OFFERED`
  - `POST /api/vendor/waitlist/:id/decline` (Vendor): ปฏิเสธเมื่อเป็น `OFFERED` 
- **การเปลี่ยนสถานะ:**
  - `Waitlist`: `PENDING` -> `OFFERED` (โดยระบบ เมื่อบูธว่างลง ให้เวลาตัดสินใจ 30 นาที)
  - `Waitlist`: `OFFERED` -> `ACCEPTED` / `REJECTED` / `EXPIRED`
- **Concurrency & Prevention:**
  - คิวเรียงแบบ FIFO ด้วย `createdAt` และใช้ `id` เป็นตัวตัดสินกรณีที่เวลาเท่ากัน
  - การให้สิทธิ์ (Offer): ฟังก์ชันกลางต้องทำการตรวจโควตา หากผู้ค้าเกินโควตา ให้ข้ามคิว (ตั้งสถานะ `REJECTED` พร้อมบันทึก `reason`)
  - **ฟังก์ชันปล่อยบูธกลาง (Central Booth Release Function):** ทำ `updateMany` สำหรับ `Booth` จากนั้นทำ `updateMany` สำหรับ `Waitlist`
    - Background jobs (expiry, offer expiry): ประมวลผลทีละรายการ หาก Gate คืนค่า 0 ให้ throw และ Roll back transaction ของรายการนั้น แล้ว continue ทำรายการถัดไป
    - User-facing paths: หาก Gate หรือ Dependent คืนค่า count 0 ให้ throw ยกเลิกและคืนค่า 409
    - (ดูอธิบายอย่างละเอียดในหมวด Rollback Semantics ด้านบน)
  - หากบูธถูกปรับเป็น `DISABLED` หรือลบทิ้ง เนื่องจาก FK เป็น Restrict จึงต้องตั้งค่า `Waitlist` ที่ผูกอยู่ให้เป็น `EXPIRED` พร้อมบันทึก `reason` ภายใน Transaction เดียวกันก่อนลบบูธ
  - Refactor แกนการจองให้ใช้ Logic ร่วมกันระหว่าง Accept และ Create Booking
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ลบโค้ด Inlined release ใน `services/booking.service.ts` และ `services/payment.service.ts`
- **Tests ที่จะเขียนเพิ่ม:**
  - ปลดบูธพร้อมกันหลายทาง ต้องเข้า Central Function และคิวแรกได้ OFFERED
  - เข้าคิวซ้ำบูธเดิมพร้อมกัน ต้องสำเร็จ 1 (409 นอกนั้น)
  - Offer หมดเวลา Job รันแล้วส่งต่อคิวถัดไปสำเร็จ
  - Accept หลังหมดเวลาถูกปฏิเสธ และ Accept ชนกับ Job หมดเวลา ต้องจัดการอย่างปลอดภัย
- **Test เดิมที่ต้องยังผ่าน:** 
  - `booking-hold.test.ts`
  - `state-transitions.test.ts` (เนื่องจาก Path การตกของสลิปใบที่ 2 ถูกเปลี่ยน)
  - `payment-flow.test.ts` (เช่นเดียวกัน)
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
  | DRAFT | PUBLISHED | Yes | [New] ต้องมี T&C ไม่ว่างเปล่า และต้องมีการสร้าง Booth ไว้แล้ว |
  | PUBLISHED | DRAFT | Yes | [New] ต้องไม่มีข้อมูล Booking หรือ Waitlist ผูกอยู่กับอีเวนต์นี้ |
  | PUBLISHED | CLOSED | Yes | [New] - |
  | CLOSED | PUBLISHED | Yes | [New] - |
  | CLOSED | ENDED | Yes | [New] - |
  | ENDED | (ใดๆ) | No | [New] สถานะสิ้นสุด (Terminal) ห้ามเปลี่ยนกลับ |

**หมายเหตุ:** ทุกการเปลี่ยนสถานะที่ไม่ได้ระบุอยู่ในตารางนี้ คือ **ไม่อนุญาต (Not Allowed)**

- **การเปลี่ยนสถานะ:** 
  - หากเปลี่ยนเป็น `CLOSED` หรือ `ENDED`: คิว Waitlist ที่ `PENDING`/`OFFERED` ทั้งหมดจะถูกยกเลิก (`EXPIRED`), บูธที่ `WAITLIST_HOLD` จะกลับเป็น `AVAILABLE` ทันที แต่ Booking ที่ค้างชำระอยู่ จะยังสามารถดำเนินการชำระและยืนยันได้ตามปกติ
- **Concurrency & Prevention:**
  - ใน `createBooking` ต้องอ่าน Event ด้วย `SELECT ... FOR SHARE` ภายใน `$transaction` เพื่อเช็กว่าสถานะต้องเป็น `PUBLISHED` เท่านั้น
  - `changeEventStatus` ต้องใช้ `updateMany` (where `id` และ `status` เดิม) แล้วตรวจสอบ `count`
  - การลบอีเวนต์ ต้องล็อกด้วย `FOR UPDATE` ลบข้อมูลลูกทั้งหมดและตรวจสอบว่ายอด Booking = 0
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** Endpoint `changeEventStatus` จะถูกเพิ่มกฎการ Transition ทั้งหมดลงไป และสร้างใหม่ Endpoint ลบอีเวนต์
- **Tests ที่จะเขียนเพิ่ม:**
  - พยายามสร้าง Booking ขณะที่งานเปลี่ยนเป็น `CLOSED` พอดี (Race Condition test `FOR SHARE` vs `updateMany`)
  - ลบงาน DRAFT ที่มี Zone/Booth ต้องจัดการลบตารางลูกได้สมบูรณ์ใน Transaction เดียว
  - ลบงานไม่ได้ถ้ามี Booking ผูกอยู่
- **Test เดิมที่ต้องยังผ่าน:** 
  - `state-transitions.test.ts` (ข้อมูล Seed เดิมใน `apps/api/tests/helpers.ts:48` สร้าง Event เป็น `PUBLISHED` อยู่แล้วจึงไม่กระทบกฎใหม่ที่ว่าต้องสร้าง Booking ตอนเป็น `PUBLISHED` เท่านั้น)
  - หมายเหตุ: ปัจจุบันไม่มี Test เดิมที่ครอบคลุมถึง Event Status Transitions (`test-transitions.js` เดิมเป็นการทดสอบ Organizer Approval ไม่ใช่ Event Status)
- **Quality Requirements Coverage:** ข้อ 5

## Backlog (ยังไม่อยู่ใน Scope ของ A1)
- **Web Localization:** หน้าเดิมยังเป็นภาษาอังกฤษ และ metadata/title ยังคงเป็น "Create Next App" รวมถึง <html lang="en">
- **API Validation:** API รองรับช่องว่างล้วน (whitespace-only) สำหรับ storeName และ productType (min(1) โดยไม่มี trim) ตอนนี้เว็บมีการ trim ฝั่ง client แล้ว แต่ API ยังไม่ได้ป้องกัน
- **Web Tests:** ยังไม่มี Web test framework สำหรับการทดสอบอัตโนมัติ
- **Auth:** [DONE] แก้ไข Endpoint `POST /api/auth/login` โดยสร้าง 4-field DTO เพื่อป้องกันการหลุดของ `password` hash (จากการ Audit พบว่า login เป็นเพียง Endpoint เดียวที่คืนค่าแถว User เต็มๆ ส่วน Endpoint อื่นใช้ `select` คืนค่าเฉพาะฟิลด์ที่ปลอดภัยเท่านั้น)
