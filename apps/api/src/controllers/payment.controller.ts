import { Request, Response, NextFunction } from "express";
import * as paymentService from "../services/payment.service";
import { uploadSlipSchema, verifyPaymentSchema } from "@eventcore/shared";

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const organizerId = req.user!.id;
    const payments = await paymentService.getPaymentsByEvent(eventId, organizerId);
    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export async function uploadSlip(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const bookingId = req.params.bookingId;
    const data = uploadSlipSchema.parse(req.body);
    const payment = await paymentService.uploadSlip(bookingId, userId, data);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizerId = req.user!.id;
    const paymentId = req.params.paymentId;
    const data = verifyPaymentSchema.parse(req.body);
    const result = await paymentService.verifyPayment(paymentId, organizerId, data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
