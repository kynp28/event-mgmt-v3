import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { login, logout, getMe } from "./controllers/auth.controller";
import { requireAuth } from "./middlewares/auth.middleware";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.WEB_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many login attempts, please try again later" } }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", loginLimiter, login);
app.post("/api/auth/logout", logout);
app.get("/api/auth/me", requireAuth, getMe);

import * as eventController from "./controllers/event.controller";
import { requireRole } from "./middlewares/auth.middleware";

// Public Event Routes
app.get("/api/events", eventController.getPublicEvents);
app.get("/api/events/:id", eventController.getPublicEventById);

// Organizer Event Routes
const isOrganizer = [requireAuth, requireRole(["ORGANIZER"])];
app.get("/api/organizer/events", isOrganizer, eventController.getMyEvents);
app.post("/api/organizer/events", isOrganizer, eventController.createEvent);
app.get("/api/organizer/events/:id", isOrganizer, eventController.getMyEventById);
app.patch("/api/organizer/events/:id", isOrganizer, eventController.updateEvent);
app.patch("/api/organizer/events/:id/status", isOrganizer, eventController.changeEventStatus);


// Central error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
