import "dotenv/config";

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not set in the environment.");
  process.exit(1);
}

import cron from "node-cron";
import * as bookingService from "./services/booking.service";
import { createApp } from "./app";

const app = createApp();

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Run every minute
cron.schedule("* * * * *", async () => {
  try {
    const released = await bookingService.releaseExpiredBookings();
    if (released > 0) {
      console.log(`[Cron] Released ${released} expired bookings.`);
    }
  } catch (err) {
    console.error("[Cron] Error releasing expired bookings:", err);
  }
});
