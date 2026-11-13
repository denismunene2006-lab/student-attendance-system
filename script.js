const API_URL = "/api";
const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const appRoot = document.getElementById("app");
let token = sessionStorage.getItem("attendanceToken");
const $ = (id) => document.getElementById(id);

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const result = await response.json();
  if (response.status === 401) signOut();
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}
function signOut() {
  token = null;
  sessionStorage.removeItem("attendanceToken");
  appRoot.hidden = true;
  loginPanel.hidden = false;
}
function message(id, text, isError = false) {
  const element = $(id);
  element.textContent = text;
  element.setAttribute("role", isError ? "alert" : "status");
}
function cell(row, text) {
  const td = document.createElement("td");
  td.textContent = text || "—";
  row.appendChild(td);
  return td;
}
function actionButton(label, action, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (danger) button.classList.add("danger");
  button.addEventListener("click", action);
  return button;
}
function addActions(row, edit, remove) {
  const td = document.createElement("td");
  td.append(actionButton("Edit", edit), document.createTextNode(" "), actionButton("Delete", remove, true));
  row.appendChild(td);
}
function requestError(id, error) { message(id, error.message, true); }

async function loadDashboard() {
  const { data } = await apiRequest("/dashboard");
  $("totalLecturers").textContent = data.lecturers;
  $("totalStudents").textContent = data.students;
  $("totalCourses").textContent = data.courses;
  $("sessionsToday").textContent = data.attendanceSessionsToday;
}
async function loadLecturers(search = "") {
  const { data } = await apiRequest(`/lecturers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const body = $("lecturerRows");
  body.replaceChildren();
  for (const item of data) {
    const row = document.createElement("tr");
    cell(row, item.lecturerId); cell(row, item.fullName); cell(row, item.email); cell(row, item.department);
    addActions(row, async () => {
      const fullName = prompt("Full name", item.fullName); if (fullName === null) return;
      const email = prompt("Email", item.email); if (email === null) return;
      const department = prompt("Department", item.department); if (department === null) return;
      try { await apiRequest(`/lecturers/${item._id}`, { method: "PUT", body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), department: department.trim() }) }); await loadLecturers($("searchLecturer").value.trim()); message("lecturerFeedback", "Lecturer updated."); }
      catch (error) { requestError("lecturerFeedback", error); }
    }, async () => {
      if (!confirm(`Delete lecturer ${item.fullName}?`)) return;
      try { await apiRequest(`/lecturers/${item._id}`, { method: "DELETE" }); await loadLecturers($("searchLecturer").value.trim()); await loadDashboard(); message("lecturerFeedback", "Lecturer deleted."); }
      catch (error) { requestError("lecturerFeedback", error); }
    });
    body.appendChild(row);
  }
}
async function loadStudents(search = "") {
  const { data } = await apiRequest(`/students${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const body = $("studentRows");
  body.replaceChildren();
  for (const item of data) {
    const row = document.createElement("tr");
    cell(row, item.studentId); cell(row, item.fullName); cell(row, item.email); cell(row, item.department); cell(row, item.active ? "Active" : "Inactive");
    addActions(row, async () => {
      const fullName = prompt("Full name", item.fullName); if (fullName === null) return;
      const email = prompt("Email (leave empty for none)", item.email || ""); if (email === null) return;
      const department = prompt("Department", item.department || ""); if (department === null) return;
      const active = confirm("Keep this student active? Choose Cancel to mark inactive.");
      try { await apiRequest(`/students/${item._id}`, { method: "PUT", body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), department: department.trim(), active }) }); await loadStudents($("searchStudent").value.trim()); await loadDashboard(); message("studentFeedback", "Student updated."); }
      catch (error) { requestError("studentFeedback", error); }
    }, async () => {
      if (!confirm(`Permanently delete student ${item.fullName}? Enrollment history links will be removed.`)) return;
      try { await apiRequest(`/students/${item._id}`, { method: "DELETE" }); await loadStudents($("searchStudent").value.trim()); await loadEnrollmentOptions(); await loadDashboard(); message("studentFeedback", "Student deleted."); }
      catch (error) { requestError("studentFeedback", error); }
    });
    body.appendChild(row);
  }
}
async function loadCourses() {
  const { data } = await apiRequest("/courses");
  const body = $("courseRows");
  body.replaceChildren();
  const select = $("enrollmentCourse");
  select.replaceChildren(new Option("Choose a course", ""));
  for (const item of data) {
    const row = document.createElement("tr");
    cell(row, item.courseCode); cell(row, item.title); cell(row, item.description); cell(row, item.active ? "Active" : "Inactive");
    addActions(row, async () => {
      const title = prompt("Course title", item.title); if (title === null) return;
      const description = prompt("Description", item.description || ""); if (description === null) return;
      const active = confirm("Keep this course active? Choose Cancel to mark inactive.");
      try { await apiRequest(`/courses/${item._id}`, { method: "PUT", body: JSON.stringify({ title: title.trim(), description: description.trim(), active }) }); await loadCourses(); await loadDashboard(); message("courseFeedback", "Course updated."); }
      catch (error) { requestError("courseFeedback", error); }
    }, async () => {
      if (!confirm(`Permanently delete course ${item.courseCode}? Enrollments will be removed.`)) return;
      try { await apiRequest(`/courses/${item._id}`, { method: "DELETE" }); await loadCourses(); await loadDashboard(); message("courseFeedback", "Course deleted."); }
      catch (error) { requestError("courseFeedback", error); }
    });
    body.appendChild(row);
    if (item.active) select.add(new Option(`${item.courseCode} — ${item.title}`, item._id));
  }
}
async function loadEnrollmentOptions() {
  const { data } = await apiRequest("/students");
  const select = $("enrollmentStudents");
  select.replaceChildren();
  for (const student of data.filter((entry) => entry.active)) select.add(new Option(`${student.studentId} — ${student.fullName}`, student._id));
}
async function loadApp() {
  try {
    const { user } = await apiRequest("/auth/me");
    if (user.role !== "admin") throw new Error("This dashboard is for administrator accounts.");
    loginPanel.hidden = true;
    appRoot.hidden = false;
    await Promise.all([loadDashboard(), loadLecturers(), loadStudents(), loadCourses(), loadEnrollmentOptions()]);
  } catch (error) { signOut(); message("loginFeedback", error.message, true); }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }) });
    token = result.token;
    sessionStorage.setItem("attendanceToken", token);
    loginForm.reset();
    await loadApp();
  } catch (error) { message("loginFeedback", error.message, true); }
});
document.getElementById("logoutButton").addEventListener("click", signOut);

$("lecturerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await apiRequest("/lecturers", { method: "POST", body: JSON.stringify({ lecturerId: $("lecturerID").value.trim(), fullName: $("lecturerName").value.trim(), email: $("lecturerEmail").value.trim(), department: $("lecturerDepartment").value.trim() }) });
    event.target.reset(); await loadLecturers($("searchLecturer").value.trim()); await loadDashboard(); message("lecturerFeedback", "Lecturer added.");
  } catch (error) { requestError("lecturerFeedback", error); }
});
$("studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("studentEmail").value.trim();
  try {
    await apiRequest("/students", { method: "POST", body: JSON.stringify({ studentId: $("studentID").value.trim(), fullName: $("studentName").value.trim(), ...(email ? { email } : {}), department: $("studentDepartment").value.trim() }) });
    event.target.reset(); await loadStudents($("searchStudent").value.trim()); await loadEnrollmentOptions(); await loadDashboard(); message("studentFeedback", "Student added.");
  } catch (error) { requestError("studentFeedback", error); }
});
$("courseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await apiRequest("/courses", { method: "POST", body: JSON.stringify({ courseCode: $("courseCode").value.trim(), title: $("courseTitle").value.trim(), description: $("courseDescription").value.trim() }) });
    event.target.reset(); await loadCourses(); await loadDashboard(); message("courseFeedback", "Course added.");
  } catch (error) { requestError("courseFeedback", error); }
});
$("enrollmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentIds = Array.from($("enrollmentStudents").selectedOptions, (option) => option.value);
  try {
    const result = await apiRequest(`/courses/${encodeURIComponent($("enrollmentCourse").value)}/enroll`, { method: "POST", body: JSON.stringify({ studentIds }) });
    message("enrollmentFeedback", `Enrollment request completed. ${result.enrolled} new enrollment(s) added; existing enrollments may be skipped.`);
  } catch (error) { requestError("enrollmentFeedback", error); }
});
let lecturerTimer;
$("searchLecturer").addEventListener("input", () => { clearTimeout(lecturerTimer); lecturerTimer = setTimeout(() => loadLecturers($("searchLecturer").value.trim()).catch((error) => requestError("lecturerFeedback", error)), 250); });
let studentTimer;
$("searchStudent").addEventListener("input", () => { clearTimeout(studentTimer); studentTimer = setTimeout(() => loadStudents($("searchStudent").value.trim()).catch((error) => requestError("studentFeedback", error)), 250); });
if (token) loadApp();
