const express = require("express");
const cors = require("cors");
require("dotenv").config();

console.log("1. Loading routes...");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const talesRoutes = require("./routes/tales");
const notificationsRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
console.log("2. Routes loaded.");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:8000' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log(`Incoming: ${req.method} ${req.url}`);
  next();
});

console.log("3. Mounting routes...");
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/tales", talesRoutes);
app.use("/api/notifications", notificationsRoutes);  // ← new line
app.use("/api/admin", adminRoutes);
app.get("/", (req, res) => {
  res.send("API is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
