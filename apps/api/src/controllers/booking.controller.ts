import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/booking.service";
import { createBookingSchema } from "@eventcore/shared";

export async function getMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const bookings = await bookingService.getMyBookings(userId);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = createBookingSchema.parse(req.body);
    const booking = await bookingService.createBooking(userId, data);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

// Just an endpoint for triggering the job manually or via cron
export async function triggerReleaseJob(req: Request, res: Response, next: NextFunction) {
  try {
    // In production, this might verify a secret header
    const count = await bookingService.releaseExpiredBookings();
    res.json({ releasedCount: count });
  } catch (err) {
    next(err);
  }
}
