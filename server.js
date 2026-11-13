require("dotenv").config();

const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Lecturer, Student, Course, Enrollment, AttendanceSession, AttendanceRecord } = require("./models");

const app = express();
const port = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: "50kb" }));

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}
function validId(id) { return mongoose.isValidObjectId(id); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const authenticate = asyncRoute(async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return sendError(res, 401, "Sign in to continue.");
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET); }
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
function requireFields(body, fields) {
  return fields.every((field) => typeof body[field] === "string" && body[field].trim());
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}
function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
}

app.get("/api/health", (req, res) => res.json({ success: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

// Initial administrator setup is one-time, requires a Render secret, and is disabled after the first account exists.
app.post("/api/auth/setup", asyncRoute(async (req, res) => {
  const bootstrapKey = process.env.BOOTSTRAP_ADMIN_KEY;
  if (!bootstrapKey || !req.get("x-bootstrap-key") || !safeEqual(req.get("x-bootstrap-key"), bootstrapKey)) {
    return sendError(res, 403, "Initial administrator setup is disabled or the setup key is incorrect.");
  }
  if (await User.exists({})) return sendError(res, 409, "Setup is already complete. Sign in instead.");
  const { name, email, password } = req.body;
  if (!requireFields(req.body, ["name", "email", "password"]) || password.length < 12) {
    return sendError(res, 400, "Name, email, and a password of at least 12 characters are required.");
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
  res.status(201).json({ success: true, user: publicUser(user), token: issueToken(user) });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") return sendError(res, 400, "Email and password are required.");
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendError(res, 401, "Invalid email or password.");
  }
  res.json({ success: true, user: publicUser(user), token: issueToken(user) });
}));
app.get("/api/auth/me", authenticate, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

// Admin-managed accounts. Public sign-up is intentionally not exposed.
app.post("/api/users", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { name, email, password, role = "lecturer" } = req.body;
  if (!requireFields(req.body, ["name", "email", "password"]) || password.length < 12 || !["admin", "lecturer"].includes(role)) {
    return sendError(res, 400, "Provide name, email, a password of at least 12 characters, and a valid role.");
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role });
  res.status(201).json({ success: true, data: publicUser(user) });
}));
app.get("/api/users", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const users = await User.find().select("name email role active createdAt").sort({ name: 1 }).lean();
  res.json({ success: true, data: users });
}));

app.get("/api/dashboard", authenticate, asyncRoute(async (req, res) => {
  const [lecturers, students, courses, activeUsers, inactiveUsers, today] = await Promise.all([
    Lecturer.countDocuments(), Student.countDocuments({ active: true }), Course.countDocuments({ active: true }),
    User.countDocuments({ active: true }), User.countDocuments({ active: false }),
    AttendanceSession.countDocuments({ sessionDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)), $lt: new Date(new Date().setHours(24, 0, 0, 0)) } })
  ]);
  res.json({ success: true, data: { lecturers, students, courses, activeUsers, inactiveUsers, attendanceSessionsToday: today } });
}));

// Lecturer records
app.get("/api/lecturers", authenticate, asyncRoute(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const filter = search ? { $or: ["lecturerId", "fullName", "email", "department"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  res.json({ success: true, data: await Lecturer.find(filter).sort({ createdAt: -1 }).lean() });
}));
app.post("/api/lecturers", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["lecturerId", "fullName", "email", "department"])) return sendError(res, 400, "Lecturer ID, name, email, and department are required.");
  const lecturer = await Lecturer.create(req.body);
  res.status(201).json({ success: true, data: lecturer });
}));
app.put("/api/lecturers/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid lecturer ID.");
  const fields = ["lecturerId", "fullName", "email", "department", "status"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const lecturer = await Lecturer.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!lecturer) return sendError(res, 404, "Lecturer not found.");
  res.json({ success: true, data: lecturer });
}));
app.delete("/api/lecturers/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid lecturer ID.");
  const deleted = await Lecturer.findByIdAndDelete(req.params.id);
  if (!deleted) return sendError(res, 404, "Lecturer not found.");
  res.json({ success: true, message: "Lecturer deleted." });
}));

// Student records
app.get("/api/students", authenticate, asyncRoute(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const filter = search ? { $or: ["studentId", "fullName", "email", "department"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  res.json({ success: true, data: await Student.find(filter).sort({ createdAt: -1 }).lean() });
}));
app.post("/api/students", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["studentId", "fullName"])) return sendError(res, 400, "Student ID and full name are required.");
  const student = await Student.create({ studentId: req.body.studentId, fullName: req.body.fullName, email: req.body.email, department: req.body.department });
  res.status(201).json({ success: true, data: student });
}));
app.put("/api/students/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid student ID.");
  const fields = ["studentId", "fullName", "email", "department", "active"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const student = await Student.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!student) return sendError(res, 404, "Student not found.");
  res.json({ success: true, data: student });
}));
app.delete("/api/students/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid student ID.");
  const deleted = await Student.findByIdAndDelete(req.params.id);
  if (!deleted) return sendError(res, 404, "Student not found.");
  await Enrollment.deleteMany({ student: deleted._id });
  res.json({ success: true, message: "Student deleted." });
}));

// Courses and course enrollment
app.get("/api/courses", authenticate, asyncRoute(async (req, res) => {
  const courses = await Course.find().sort({ courseCode: 1 }).lean();
  res.json({ success: true, data: courses });
}));
app.post("/api/courses", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!requireFields(req.body, ["courseCode", "title"])) return sendError(res, 400, "Course code and title are required.");
  const course = await Course.create({ courseCode: req.body.courseCode, title: req.body.title, description: req.body.description, createdBy: req.user._id });
  res.status(201).json({ success: true, data: course });
}));
app.put("/api/courses/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const fields = ["courseCode", "title", "description", "active"];
  const updates = Object.fromEntries(fields.filter((key) => Object.hasOwn(req.body, key)).map((key) => [key, req.body[key]]));
  const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!course) return sendError(res, 404, "Course not found.");
  res.json({ success: true, data: course });
}));
app.delete("/api/courses/:id", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const deleted = await Course.findByIdAndDelete(req.params.id);
  if (!deleted) return sendError(res, 404, "Course not found.");
  await Enrollment.deleteMany({ course: deleted._id });
  res.json({ success: true, message: "Course and its enrollments deleted." });
}));
app.post("/api/courses/:id/enroll", authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const { studentIds } = req.body;
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.some((id) => !validId(id))) return sendError(res, 400, "Provide a non-empty array of valid student MongoDB IDs.");
  const course = await Course.findById(req.params.id);
  if (!course) return sendError(res, 404, "Course not found.");
  const students = await Student.find({ _id: { $in: studentIds }, active: true }).select("_id");
  if (students.length !== new Set(studentIds).size) return sendError(res, 400, "One or more students do not exist, are inactive, or were duplicated.");
  const result = await Enrollment.insertMany(students.map((student) => ({ course: course._id, student: student._id })), { ordered: false }).catch((error) => {
    if (error.code === 11000 || error.writeErrors) return { insertedCount: error.insertedCount || 0 };
    throw error;
  });
  res.status(201).json({ success: true, enrolled: result.insertedCount });
}));
app.get("/api/courses/:id/students", authenticate, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid course ID.");
  const data = await Enrollment.find({ course: req.params.id }).populate("student", "studentId fullName email department active").lean();
  res.json({ success: true, data: data.map((item) => item.student) });
}));

// Attendance sessions and marks
app.post("/api/attendance/sessions", authenticate, asyncRoute(async (req, res) => {
  const { courseId, title = "Class attendance", sessionDate } = req.body;
  if (!validId(courseId)) return sendError(res, 400, "A valid courseId is required.");
  const date = sessionDate ? new Date(sessionDate) : new Date();
  if (Number.isNaN(date.getTime())) return sendError(res, 400, "sessionDate must be a valid date.");
  const course = await Course.findOne({ _id: courseId, active: true });
  if (!course) return sendError(res, 404, "Active course not found.");
  const session = await AttendanceSession.create({ course: course._id, title, sessionDate: date, createdBy: req.user._id });
  res.status(201).json({ success: true, data: session });
}));
app.get("/api/attendance/sessions", authenticate, asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.courseId) {
    if (!validId(req.query.courseId)) return sendError(res, 400, "Invalid courseId.");
    filter.course = req.query.courseId;
  }
  const sessions = await AttendanceSession.find(filter).populate("course", "courseCode title").sort({ sessionDate: -1 }).limit(200).lean();
  res.json({ success: true, data: sessions });
}));
app.post("/api/attendance/sessions/:id/records", authenticate, asyncRoute(async (req, res) => {
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
  await AttendanceRecord.bulkWrite(records.map((record) => ({
    updateOne: {
      filter: { session: session._id, student: record.studentId },
      update: { $set: { status: record.status, note: typeof record.note === "string" ? record.note.trim().slice(0, 500) : "" } },
      upsert: true
    }
  })));
  const saved = await AttendanceRecord.find({ session: session._id }).populate("student", "studentId fullName").sort({ "student.studentId": 1 }).lean();
  res.json({ success: true, data: saved });
}));
app.get("/api/attendance/sessions/:id/records", authenticate, asyncRoute(async (req, res) => {
  if (!validId(req.params.id)) return sendError(res, 400, "Invalid session ID.");
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) return sendError(res, 404, "Attendance session not found.");
  const records = await AttendanceRecord.find({ session: session._id }).populate("student", "studentId fullName").sort({ "student.studentId": 1 }).lean();
  res.json({ success: true, data: records });
}));
app.get("/api/attendance/report", authenticate, asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.courseId) {
    if (!validId(req.query.courseId)) return sendError(res, 400, "Invalid courseId.");
    const sessions = await AttendanceSession.find({ course: req.query.courseId }).select("_id").lean();
    filter.session = { $in: sessions.map((item) => item._id) };
  }
  const records = await AttendanceRecord.find(filter).populate({ path: "session", populate: { path: "course", select: "courseCode title" } }).populate("student", "studentId fullName").sort({ createdAt: -1 }).limit(2000).lean();
  res.json({ success: true, data: records });
}));

app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use((req, res) => sendError(res, 404, "Route not found."));
app.use((error, req, res, next) => {
  if (error.code === 11000) return sendError(res, 409, "A record with that unique ID or email already exists.");
  if (error.name === "ValidationError" || error.name === "CastError") return sendError(res, 400, error.message);
  console.error(error);
  res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

async function start() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}
start().catch((error) => {
  console.error("Could not start server:", error.message);
  process.exit(1);
});
