import { Router } from "express";
import { blogRoutes } from "./blog.routes";
import { contactRoutes } from "./contact.routes";
import { givingRoutes } from "./giving.routes";
import { mpesaRoutes } from "./mpesa.routes";
import { newsletterRoutes } from "./newsletter.routes";

export const apiRouter = Router();

apiRouter.use("/blog", blogRoutes);
apiRouter.use("/contact", contactRoutes);
apiRouter.use("/giving", givingRoutes);
apiRouter.use("/mpesa", mpesaRoutes);
apiRouter.use("/newsletter", newsletterRoutes);
