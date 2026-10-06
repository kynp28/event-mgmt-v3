import { ApiError } from "./api-client";

const fieldErrorMap: Record<string, string> = {
  "Invalid email address": "รูปแบบอีเมลไม่ถูกต้อง",
  "Password must be at least 8 characters": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  "Password exceeds maximum length of 72 bytes": "รหัสผ่านยาวเกินไป (สูงสุด 72 ไบต์ ตัวอักษรไทยนับตัวละ 3 ไบต์)",
  "Store name is required": "กรุณากรอกชื่อร้านค้า",
  "Product type is required": "กรุณากรอกประเภทสินค้า",
  "Store name cannot exceed 100 characters": "ชื่อร้านค้าต้องไม่เกิน 100 ตัวอักษร",
  "Product type cannot exceed 100 characters": "ประเภทสินค้าต้องไม่เกิน 100 ตัวอักษร",
};

export function translateFieldError(message: string): string {
  return fieldErrorMap[message] || "ข้อมูลไม่ถูกต้อง";
}

export function translateApiError(err: unknown, context: "register" | "profile"): string {
  if (err instanceof ApiError) {
    if (context === "register") {
      if (err.status === 409) return "ไม่สามารถสมัครด้วยข้อมูลนี้ได้ กรุณาตรวจสอบข้อมูล หรือเข้าสู่ระบบหากมีบัญชีอยู่แล้ว";
      if (err.status === 429) return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
      if (err.status === 400) return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่";
    } else if (context === "profile") {
      if (err.status === 403) return "หน้านี้สำหรับบัญชีผู้ค้าเท่านั้น";
      if (err.status === 400) return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่";
    }
  }
  
  return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง";
}
