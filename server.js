const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Lecturer, Student, Course, Enrollment, AttendanceSession, AttendanceRecord } = require("./models");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: "50kb" }));
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: "draft-8", legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
app.use("/api", apiLimiter);

function sendError(res, status, message) { return res.status(status).json({ success: false, message }); }
function validId(id) { return mongoose.isValidObjectId(id); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }
const authenticate = asyncRoute(async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return sendError(res, 401, "Sign in to continue.");
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }); }
  catch { return sendError(res, 401, "Your session is invalid or expired. Sign in again."); }
  const user = await User.findById(claims.sub);
  if (!user || !user.active) return sendError(res, 401, "This account is unavailable. Sign in again.");
  req.user = user;
  next();
});
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return sendError(res, 403, "Administrator access is required.");
  next();
}
function requireFields(body, fields) { return fields.every((field) => typeof body[field] === "string" && body[field].trim()); }
function publicUser(user) { return { id: user._id, name: user.name, email: user.email, role: user.role }; }
function issueToken(user) { return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "8h", issuer: "student-attendance-system", audience: "student-attendance-system" }); }

app.get("/api/health", (req, res) => res.json({ success: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.post("/api/auth/setup", authLimiter, asyncRoute(async (req, res) => {
  const bootstrapKey = process.env.BOOTSTRAP_ADMIN_KEY;
  if (!bootstrapKey || !req.get("x-bootstrap-key") || !safeEqual(req.get("x-bootstrap-key"), bootstrapKey)) return sendError(res, 403, "Initial administrator setup is disabled or the setup key is incorrect.");
  if (await User.exists({})) return sendError(res, 409, "Setup is already complete. Sign in instead.");
  const { name, email, password } = req.body;
  if (!requireFields(req.body, ["name", "email", "password"]) || password.length < 12) return sendError(res, 400, "Name, email, and a password of at least 12 characters are required.");
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
  res.status(201).json({ success: true, user: publicUser(user), token: issueToken(user) });
}));
app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") return sendError(res, 400, "Email and password are required.");
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return sendError(res, 401, "Invalid email or password.");
  res.json({ success: true, user: publicUser(user), token: issueToken(user) });
}));
app.get("/api/auth/me", authenticate, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

app.post("/api/users", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { name, email, password, role = "lecturer" } = req.body;
  if (!requireFields(req.body, ["name", "email", "password"]) || password.length < 12 || !["admin", "lecturer"].includes(role)) return sendError(res, 400, "Provide name, email, a password of at least 12 characters, and a valid role.");
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role });
  res.status(201).json({ success: true, data: publicUser(user) });
}));
app.get("/api/users", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  res.json({ success: true, data: await User.find().select("name email role active createdAt").sort({ name: 1 }).lean() });
}));

// This dashboard and current data API are intentionally admin-only until course/lecturer assignment is implemented.
app.get("/api/dashboard", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [lecturers, students, courses, activeUsers, inactiveUsers, today] = await Promise.all([
    Lecturer.countDocuments(), Student.countDocuments({ active: true }), Course.countDocuments({ active: true }),
    User.countDocuments({ active: true }), User.countDocuments({ active: false }),
    AttendanceSession.countDocuments({ sessionDate: { $gte: start, $lt: end } })
  ]);
  res.json({ success: true, data: { lecturers, students, courses, activeUsers, inactiveUsers, attendanceSessionsToday: today } });
}));

app.get("/api/lecturers", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const filter = search ? { $or: ["lecturerId", "fullName", "email", "department"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  res.json({ success: true, data: await Lecturer.find(filter).sort({ createdAt: -1 }).limit(500).lean() });
}));
app.post("/api/lecturers", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["lecturerId", "fullName", "email", "department"])) return sendError(res, 400, "Lecturer ID, name, email, and department are required.");
  res.status(201).json({ success: true, data: await Lecturer.create(req.body) });
}));
app.put("/api/lecturers/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid lecturer ID.");
  const fields = ["lecturerId", "fullName", "email", "department", "status"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const item = await Lecturer.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, "Lecturer not found.");
  res.json({ success: true, data: item });
}));
app.delete("/api/lecturers/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid lecturer ID.");
  if (!await Lecturer.findByIdAndDelete(req.params.id)) return sendError(res, 404, "Lecturer not found.");
  res.json({ success: true, message: "Lecturer deleted." });
}));

app.get("/api/students", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const filter = search ? { $or: ["studentId", "fullName", "email", "department"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  res.json({ success: true, data: await Student.find(filter).sort({ createdAt: -1 }).limit(500).lean() });
}));
app.post("/api/students", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["studentId", "fullName"])) return sendError(res, 400, "Student ID and full name are required.");
  res.status(201).json({ success: true, data: await Student.create({ studentId: req.body.studentId, fullName: req.body.fullName, email: req.body.email, department: req.body.department }) });
}));
app.put("/api/students/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid student ID.");
  const fields = ["studentId", "fullName", "email", "department", "active"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const item = await Student.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, "Student not found.");
  res.json({ success: true, data: item });
}));
app.delete("/api/students/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid student ID.");
  const item = await Student.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, "Student not found.");
  await Enrollment.deleteMany({ student: item._id });
  res.json({ success: true, message: "Student deleted." });
}));

app.get("/api/courses", authenticate, requireAdmin, asyncRoute(async (req, res) => res.json({ success: true, data: await Course.find().sort({ courseCode: 1 }).limit(500).lean() })));
app.post("/api/courses", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["courseCode", "title"])) return sendError(res, 400, "Course code and title are required.");
  res.status(201).json({ success: true, data: await Course.create({ courseCode: req.body.courseCode, title: req.body.title, description: req.body.description, createdBy: req.user._id }) });
}));
app.put("/api/courses/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const fields = ["courseCode", "title", "description", "active"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const item = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, "Course not found.");
  res.json({ success: true, data: item });
}));
app.delete("/api/courses/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const item = await Course.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, "Course not found.");
  await Enrollment.deleteMany({ course: item._id });
  res.json({ success: true, message: "Course and enrollments deleted." });
}));
app.post("/api/courses/:id/enroll", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { studentIds } = req.body;
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > 500 || studentIds.some((id) => !validId(id))) return sendError(res, 400, "Provide 1 to 500 valid student MongoDB IDs.");
  const course = await Course.findOne({ _id: req.params.id, active: true });
  if (!course) return sendError(res, 404, "Active course not found.");
  const uniqueIds = [...new Set(studentIds)];
  if (uniqueIds.length !== studentIds.length) return sendError(res, 400, "Duplicate student IDs are not allowed.");
  const students = await Student.find({ _id: { $in: uniqueIds }, active: true }).select("_id");
  if (students.length !== uniqueIds.length) return sendError(res, 400, "One or more students do not exist or are inactive.");
  const result = await Enrollment.insertMany(students.map((student) => ({ course: course._id, student: student._id })), { ordered: false }).catch((error) => {
    if (error.code === 11000 || error.writeErrors) return { insertedCount: error.insertedCount || 0 };
    throw error;
  });
  res.status(201).json({ success: true, enrolled: result.insertedCount });
}));
app.get("/api/courses/:id/students", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const rows = await Enrollment.find({ course: req.params.id }).populate("student", "studentId fullName email department active").lean();
  res.json({ success: true, data: rows.map((row) => row.student) });
}));

app.post("/api/attendance/sessions", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { courseId, title = "Class attendance", sessionDate } = req.body;
  if (!validId(courseId)) return sendError(res, 400, "A valid courseId is required.");
  const date = sessionDate ? new Date(sessionDate) : new Date();
  if (Number.isNaN(date.getTime())) return sendError(res, 400, "sessionDate must be a valid date.");
  const course = await Course.findOne({ _id: courseId, active: true });
  if (!course) return sendError(res, 404, "Active course not found.");
  res.status(201).json({ success: true, data: await AttendanceSession.create({ course: course._id, title, sessionDate: date, createdBy: req.user._id }) });
}));
app.get("/api/attendance/sessions", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.courseId) { if (!validId(req.query.courseId)) return sendError(res, 400, "Invalid courseId."); filter.course = req.query.courseId; }
  res.json({ success: true, data: await AttendanceSession.find(filter).populate("course", "courseCode title").sort({ sessionDate: -1 }).limit(200).lean() });
}));
app.post("/api/attendance/sessions/:id/records", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid session ID.");
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0 || records.length > 500) return sendError(res, 400, "records must contain between 1 and 500 attendance entries.");
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) return sendError(res, 404, "Attendance session not found.");
  const studentIds = records.map((record) => record.studentId);
  if (studentIds.some((id) => !validId(id)) || new Set(studentIds).size !== studentIds.length) return sendError(res, 400, "Each record needs a unique valid studentId.");
  if (records.some((record) => !["present", "absent", "late", "excused"].includes(record.status))) return sendError(res, 400, "Status must be present, absent, late, or excused.");
  const enrolled = await Enrollment.find({ course: session.course, student: { $in: studentIds } }).select("student").lean();
  if (enrolled.length !== studentIds.length) return sendError(res, 400, "Every marked student must be enrolled in this session's course.");
  await AttendanceRecord.bulkWrite(records.map((record) => ({ updateOne: { filter: { session: session._id, student: record.studentId }, update: { $set: { status: record.status, note: typeof record.note === "string" ? record.note.trim().slice(0, 500) : "" } }, upsert: true } })));
  res.json({ success: true, data: await AttendanceRecord.find({ session: session._id }).populate("student", "studentId fullName").limit(500).lean() });
}));
app.get("/api/attendance/sessions/:id/records", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid session ID.");
  if (!await AttendanceSession.exists({ _id: req.params.id })) return sendError(res, 404, "Attendance session not found.");
  res.json({ success: true, data: await AttendanceRecord.find({ session: req.params.id }).populate("student", "studentId fullName").limit(500).lean() });
}));
app.get("/api/attendance/report", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.courseId) {
    if (!validId(req.query.courseId)) return sendError(res, 400, "Invalid courseId.");
    const sessions = await AttendanceSession.find({ course: req.query.courseId }).select("_id").lean();
    filter.session = { $in: sessions.map((item) => item._id) };
  }
  res.json({ success: true, data: await AttendanceRecord.find(filter).populate({ path: "session", populate: { path: "course", select: "courseCode title" } }).populate("student", "studentId fullName").sort({ createdAt: -1 }).limit(2000).lean() });
}));

app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use((req, res) => sendError(res, 404, "Route not found."));
app.use((error, req, res, next) => {
  if (error.code === 11000) return sendError(res, 409, "A record with that unique ID or email already exists.");
  if (error.name === "ValidationError" || error.name === "CastError" || error.type === "entity.too.large") return sendError(res, error.type === "entity.too.large" ? 413 : 400, error.type === "entity.too.large" ? "Request body is too large." : error.message);
  console.error(error);
  res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

async function start() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}
start().catch((error) => { console.error("Could not start server:", error.message); process.exit(1); });
