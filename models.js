const mongoose = require("mongoose");

const options = { timestamps: true, versionKey: false };

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "lecturer"], default: "lecturer", required: true },
  active: { type: Boolean, default: true }
}, options);

const lecturerSchema = new mongoose.Schema({
  lecturerId: { type: String, required: true, trim: true, unique: true, maxlength: 40 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  department: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
}, options);

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, trim: true, unique: true, maxlength: 40 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  department: { type: String, trim: true, maxlength: 100 },
  active: { type: Boolean, default: true }
}, options);

const courseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, trim: true, unique: true, maxlength: 30 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, options);

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  enrolledAt: { type: Date, default: Date.now }
}, { versionKey: false });
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

const attendanceSessionSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  title: { type: String, trim: true, maxlength: 120, default: "Class attendance" },
  sessionDate: { type: Date, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, options);

const attendanceRecordSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  status: { type: String, enum: ["present", "absent", "late", "excused"], required: true },
  note: { type: String, trim: true, maxlength: 500 }
}, options);
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

module.exports = {
  User: mongoose.model("User", userSchema),
  Lecturer: mongoose.model("Lecturer", lecturerSchema),
  Student: mongoose.model("Student", studentSchema),
  Course: mongoose.model("Course", courseSchema),
  Enrollment: mongoose.model("Enrollment", enrollmentSchema),
  AttendanceSession: mongoose.model("AttendanceSession", attendanceSessionSchema),
  AttendanceRecord: mongoose.model("AttendanceRecord", attendanceRecordSchema)
};
