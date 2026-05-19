import express from "express";
import {
  login,
  register,
  profile,
} from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.get("/profile", authenticate, profile);

export default router;
