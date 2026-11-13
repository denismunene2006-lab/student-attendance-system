const API_URL = "/api";
const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const appRoot = document.getElementById("app");
const lecturerForm = document.getElementById("lecturerForm");
const lecturerRows = document.getElementById("lecturerRows");
const searchInput = document.getElementById("searchLecturer");
const feedback = document.getElementById("lecturerFeedback");
let token = sessionStorage.getItem("attendanceToken");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
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
function showFeedback(element, message, isError = false) {
  element.textContent = message;
  element.setAttribute("role", isError ? "alert" : "status");
}
function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

async function loadDashboard() {
  const { data } = await apiRequest("/dashboard");
  document.getElementById("totalLecturers").textContent = data.lecturers;
  document.getElementById("totalStudents").textContent = data.students;
  document.getElementById("totalCourses").textContent = data.courses;
  document.getElementById("sessionsToday").textContent = data.attendanceSessionsToday;
}
async function loadLecturers(search = "") {
  const result = await apiRequest(`/lecturers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  lecturerRows.replaceChildren();
  for (const lecturer of result.data) {
    const row = document.createElement("tr");
    addCell(row, lecturer.lecturerId);
    addCell(row, lecturer.fullName);
    addCell(row, lecturer.email);
    addCell(row, lecturer.department);
    const actions = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editLecturer(lecturer));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteLecturer(lecturer));
    actions.append(editButton, document.createTextNode(" "), deleteButton);
    row.appendChild(actions);
    lecturerRows.appendChild(row);
  }
}
async function loadApp() {
  try {
    await apiRequest("/auth/me");
    loginPanel.hidden = true;
    appRoot.hidden = false;
    await Promise.all([loadDashboard(), loadLecturers()]);
  } catch (error) {
    signOut();
    showFeedback(loginFeedback, error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { token: newToken } = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: document.getElementById("loginEmail").value.trim(), password: document.getElementById("loginPassword").value })
    });
    token = newToken;
    sessionStorage.setItem("attendanceToken", token);
    loginForm.reset();
    showFeedback(loginFeedback, "Signed in.");
    await loadApp();
  } catch (error) {
    showFeedback(loginFeedback, error.message, true);
  }
});
document.getElementById("logoutButton").addEventListener("click", signOut);

lecturerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    lecturerId: document.getElementById("lecturerID").value.trim(),
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    department: document.getElementById("department").value.trim()
  };
  try {
    await apiRequest("/lecturers", { method: "POST", body: JSON.stringify(payload) });
    lecturerForm.reset();
    showFeedback(feedback, "Lecturer registered.");
    await Promise.all([loadLecturers(searchInput.value.trim()), loadDashboard()]);
  } catch (error) {
    showFeedback(feedback, error.message, true);
  }
});
async function editLecturer(lecturer) {
  const fullName = prompt("Full name:", lecturer.fullName);
  if (fullName === null) return;
  const email = prompt("Email:", lecturer.email);
  if (email === null) return;
  const department = prompt("Department:", lecturer.department);
  if (department === null) return;
  try {
    await apiRequest(`/lecturers/${lecturer._id}`, { method: "PUT", body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), department: department.trim() }) });
    showFeedback(feedback, "Lecturer updated.");
    await loadLecturers(searchInput.value.trim());
  } catch (error) {
    showFeedback(feedback, error.message, true);
  }
}
async function deleteLecturer(lecturer) {
  if (!confirm(`Delete lecturer ${lecturer.fullName}?`)) return;
  try {
    await apiRequest(`/lecturers/${lecturer._id}`, { method: "DELETE" });
    showFeedback(feedback, "Lecturer deleted.");
    await Promise.all([loadLecturers(searchInput.value.trim()), loadDashboard()]);
  } catch (error) {
    showFeedback(feedback, error.message, true);
  }
}
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadLecturers(searchInput.value.trim()).catch((error) => showFeedback(feedback, error.message, true)), 200);
});
document.getElementById("logoutButton").addEventListener("click", signOut);
if (token) loadApp();
else loginPanel.hidden = false;
