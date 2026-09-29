import { Request, Response, NextFunction } from "express";
import * as ticketService from "../services/ticket.service";
import { checkInSchema } from "@eventcore/shared";

export async function getMyTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.params.bookingId;
    const vendorId = req.user!.id;
    const ticketInfo = await ticketService.getMyTicket(bookingId, vendorId);
    res.json(ticketInfo);
  } catch (err) {
    next(err);
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    const organizerId = req.user!.id;
    // We don't strictly need eventId from path to find the ticket, 
    // but the route is /organizer/events/:id/checkin
    // The service handles event ownership verification.
    
    const parsed = checkInSchema.parse(req.body);
    const result = await ticketService.checkIn(parsed.token, organizerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
