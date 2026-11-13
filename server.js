require("dotenv").config();

const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
    : true
}));
app.use(express.json({ limit: "10kb" }));

const lecturerSchema = new mongoose.Schema({
  lecturerId: { type: String, required: true, trim: true, unique: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  department: { type: String, required: true, trim: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, { timestamps: true });

const Lecturer = mongoose.model("Lecturer", lecturerSchema);

function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: mongoose.connection.readyState === 1 ? "ready" : "connecting"
  });
});

app.get("/api/lecturers", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = search
      ? {
          $or: [
            { lecturerId: { $regex: escapeRegex(search), $options: "i" } },
            { fullName: { $regex: escapeRegex(search), $options: "i" } },
            { email: { $regex: escapeRegex(search), $options: "i" } },
            { department: { $regex: escapeRegex(search), $options: "i" } }
          ]
        }
      : {};
    const lecturers = await Lecturer.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: lecturers });
  } catch (error) {
    next(error);
  }
});

app.post("/api/lecturers", async (req, res, next) => {
  try {
    const lecturer = await Lecturer.create({
      lecturerId: req.body.lecturerId,
      fullName: req.body.fullName,
      email: req.body.email,
      department: req.body.department
    });
    res.status(201).json({ success: true, data: lecturer });
  } catch (error) {
    next(error);
  }
});

app.put("/api/lecturers/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid lecturer ID." });
    }

    const allowedFields = ["lecturerId", "fullName", "email", "department", "status"];
    const updates = {};
    for (const field of allowedFields) {
      if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
    }

    const lecturer = await Lecturer.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!lecturer) {
      return res.status(404).json({ success: false, message: "Lecturer not found." });
    }
    res.json({ success: true, data: lecturer });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lecturers/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid lecturer ID." });
    }
    const lecturer = await Lecturer.findByIdAndDelete(req.params.id);
    if (!lecturer) {
      return res.status(404).json({ success: false, message: "Lecturer not found." });
    }
    res.json({ success: true, message: "Lecturer deleted." });
  } catch (error) {
    next(error);
  }
});

// Serve the existing static frontend from the same Render service.
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((error, req, res, next) => {
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "That lecturer ID is already registered." });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error(error);
  res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

async function start() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required. Set it in your environment or .env file.");
  }
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(port, () => console.log(`Server listening on port ${port}`));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

start().catch((error) => {
  console.error("Could not start server:", error.message);
  process.exit(1);
});
