import { Router } from "express";
import { adminRoutes } from "./admin.routes";
import { blogRoutes } from "./blog.routes";
import { contactRoutes } from "./contact.routes";
import { eventRoutes } from "./event.routes";
import { givingRoutes } from "./giving.routes";
import { mediaRoutes } from "./media.routes";
import { mpesaRoutes } from "./mpesa.routes";
import { newsletterRoutes } from "./newsletter.routes";

export const apiRouter = Router();

apiRouter.use("/admin", adminRoutes);
apiRouter.use("/blog", blogRoutes);
apiRouter.use("/contact", contactRoutes);
apiRouter.use("/events", eventRoutes);
apiRouter.use("/giving", givingRoutes);
apiRouter.use("/media", mediaRoutes);
apiRouter.use("/mpesa", mpesaRoutes);
apiRouter.use("/newsletter", newsletterRoutes);
