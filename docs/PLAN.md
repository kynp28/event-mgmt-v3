# แผนการพัฒนาฟีเจอร์ระดับ ★ (Tier 1)

## Global Lock Order
เพื่อป้องกัน Deadlock ทุก Transaction ต้องเรียงลำดับการ Lock ข้อมูลดังนี้:
1. `User`
2. `Event` (ด้วย `FOR SHARE` หรือ `FOR UPDATE`)
3. `Booth` (เรียงลำดับตาม ID แบบ Ascending `ORDER BY id ASC`)
4. `Waitlist`
5. `Booking`
6. `Payment`
7. `Ticket`

หากมี Transaction ใดไม่สามารถทำตามลำดับนี้ได้ ต้องมีกลไกป้องกัน หรือทำการแก้ไขลำดับ

**ตารางลำดับการ Lock ของแต่ละ Transaction (Actual Lock Sequence):**
| Transaction | ลำดับปัจจุบัน / ลำดับที่วางแผน | ตามกฎ? | การแก้ไข (Fix) / เหตุผล |
| --- | --- | --- | --- |
| `createBooking` | `User` (FOR UPDATE) -> `Event` (FOR SHARE) -> `Booth` (updateMany/FOR UPDATE) -> `Booking` (create) | Yes | - |
| `waitlist accept` | `User` (FOR UPDATE) -> `Event` (FOR SHARE) -> `Waitlist` (updateMany) -> `Booth` (updateMany) -> `Booking` (create) | No | แก้ไข: อัปเดต `Booth` (WAITLIST_HOLD->PAYMENT_PENDING) ก่อน แล้วจึงอัปเดต `Waitlist` (OFFERED->ACCEPTED) |
| Central release function | `Booth` (updateMany) -> `Waitlist` (updateMany) | Yes | - |
| `releaseExpiredBookings` (Job) | `Booking` (update) -> `Booth` (updateMany) -> `Waitlist` (ผ่าน Central) | No | แก้ไข: `Booth` -> `Waitlist` -> `Booking` (update) เพื่อให้ถูกลำดับ |
| offer-expiry job | `Waitlist` (update) -> `Booth` (ผ่าน Central) | No | แก้ไข: `Booth` (ผ่าน Central) -> `Waitlist` |
| `verifyPayment approve` | `Payment` -> `Booking` -> `Booth` -> `Ticket` | No | แก้ไข: `Booth` -> `Booking` -> `Payment` -> `Ticket` |
| `verifyPayment reject` | `Payment` -> `Booking` -> `Booth` -> `Waitlist` (ผ่าน Central) | No | แก้ไข: `Booth` -> `Waitlist` (ผ่าน Central) -> `Booking` -> `Payment` |
| `uploadSlip` | `Booking` (updateMany) -> `Payment` (create) | Yes | `Payment` อยู่หลัง `Booking` ตาม Global Order |
| `changeEventStatus` | `Event` (updateMany) | Yes | - |
| `deleteEvent` | `Booth` (delete) -> `Event` (delete) | No | แก้ไข: ล็อก `Event` (`FOR UPDATE`) จากนั้นลบลูก (`Booth`, `Waitlist` ฯลฯ) แล้วจึงลบ `Event` |
| `decline` / `leave` (Waitlist) | `Waitlist` (update) -> `Booth` (ผ่าน Central) | No | แก้ไข: `Booth` (ผ่าน Central) -> `Waitlist` (update) |

## S0. การจัดการความปลอดภัย Endpoint เดิม
- **ช่องโหว่:** ปัจจุบัน `POST /api/jobs/release-expired-bookings` ไม่มีกลไกป้องกันใดๆ (มีเพียง `apps/api/test-step5.js` ที่ทดสอบผ่าน HTTP ส่วน Cron job เรียกผ่าน Service โดยตรง)
- **แผนงาน:** Endpoint นี้จะอ่าน Secret จากตัวแปร Environment (ตั้งชื่อว่า `JOBS_SECRET`) นำมาเทียบกับ Request Header แบบ Constant Time หากไม่มีการตั้งค่า `JOBS_SECRET` หรือไม่ตรง จะตอบ 404
- **ข้อยกเว้นที่ได้รับอนุญาต:** อนุญาตให้เพิ่มโค้ด 1 บรรทัดใน `apps/api/test-step5.js` เพื่อแนบ Header ให้การทดสอบทำงานต่อได้

## A. สมัครสมาชิกผู้ค้า (Vendor Register)
- **Schema:**
  - สร้างโมเดล `VendorProfile` (`id`, `userId` @unique, `storeName`, `productType`, `createdAt`, `updatedAt`) เชื่อมกับ `User`
- **Endpoints:**
  - `POST /api/auth/register/vendor` (Public): สร้าง User (Role=VENDOR เสมอ) และ VendorProfile ทำการ Hash password และมี Rate limit
  - `PUT /api/vendor/profile` (Vendor): แก้ไขข้อมูล `storeName`, `productType`
  - `GET /api/vendor/profile` (Vendor): ดูข้อมูล Profile ของตัวเอง
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** อีเมลซ้ำป้องกันด้วย `@unique` ในตาราง `User` หากเกิด P2002 ให้คืนค่าแจ้งเตือนแบบไม่เจาะจง
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี
- **Tests ที่จะเขียนเพิ่ม:**
  - สมัครสำเร็จ ได้ token และ profile ถูกสร้าง
  - ป้องกันการสมัครอีเมลซ้ำ (ข้อมูลไม่รั่วไหล)
  - Validation failures ผ่าน Zod
  - แก้ไขข้อมูล profile สำเร็จและปฏิเสธหากไม่มีสิทธิ์
- **Test เดิมที่ต้องยังผ่าน:** `node apps/api/test-auth.js`
- **Web:** หน้า `/auth/register` (โหมดผู้ค้า), หน้า `/vendor/profile` (ฟอร์มแก้ไขข้อมูล)
- **Quality Requirements Coverage:** ครอบคลุมข้อ 5

## B. หน้าสาธารณะสำหรับผู้เข้าชม
- **Schema:** ไม่มี
- **Endpoints:**
  - ใช้ Endpoint เดิม `GET /api/events/:id/booths` ขยายให้รองรับ Public (Anonymous) หากเป็น Authenticated (Vendor/Organizer) จะคืนฟิลด์เดิมครบถ้วน หากเป็น Anonymous คืนค่า DTO ที่มีแค่ `storeName`, `productType` สำหรับบูธที่ `CONFIRMED` ซ่อนข้อมูลชื่อ-อีเมลจริง
  - `GET /api/events` (Public): คืนค่ารายการอีเวนต์ทุกสถานะยกเว้น `DRAFT`
  - `GET /api/events/:id` (Public): ดูรายละเอียดงานและผังพื้นที่ หากเป็น `DRAFT` คืน 404
- **การเปลี่ยนสถานะ:** ไม่มี
- **Concurrency & Prevention:** ไม่มี (Read-only)
- **ระบบเดิมที่ถูกแทนที่/ต้องลบ:** ไม่มี (ขยายของเดิม)
- **Tests ที่จะเขียนเพิ่ม:**
  - เข้าถึงงาน `DRAFT` ได้ 404
  - ข้อมูลบูธที่ `CONFIRMED` ต้องมีชื่อร้าน/สินค้า แต่ห้ามมีอีเมล/ชื่อจริง ในโหมด Public
- **Test เดิมที่ต้องยังผ่าน:** `node apps/api/test-endpoint-rules.js` (ต้องยังทำงานได้เหมือนเดิม)
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
    - Background jobs (expiry, offer expiry): หาก update count เป็น 0 แสดงว่า Process อื่นจัดการไปแล้ว ถือว่าสำเร็จแบบ Idempotent ให้ Skip และทำงานต่อได้เลย
    - User-facing paths (accept, decline, verifyPayment reject): หาก count เป็น 0 ให้คืนค่า 409
    - Abort Transaction ทันทีเฉพาะเมื่อเจอข้อมูลที่อยู่ในสถานะเป็นไปไม่ได้ (Broken Invariants) เท่านั้น
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
  | PUBLISHED | CLOSED | Yes | [Existing] - |
  | CLOSED | PUBLISHED | Yes | [Existing] - |
  | CLOSED | ENDED | Yes | [Existing] - |
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
  - `state-transitions.test.ts` (ข้อมูล Seed เดิมใน `tests/helpers.ts` สร้าง Event เป็น `PUBLISHED` อยู่แล้วจึงไม่กระทบกฎใหม่ที่ว่าต้องสร้าง Booking ตอนเป็น `PUBLISHED` เท่านั้น)
  - `node apps/api/test-transitions.js`
- **Quality Requirements Coverage:** ข้อ 5
