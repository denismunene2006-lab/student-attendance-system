const API_URL = "/api";
const lecturerForm = document.getElementById("lecturerForm");
const lecturerRows = document.getElementById("lecturerRows");
const searchInput = document.getElementById("searchLecturer");
const feedback = document.getElementById("lecturerFeedback");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.setAttribute("role", isError ? "alert" : "status");
}

function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

async function loadLecturers(search = "") {
  try {
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
  } catch (error) {
    showFeedback(error.message, true);
  }
}

lecturerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    lecturerId: document.getElementById("lecturerID").value.trim(),
    fullName: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    department: document.getElementById("department").value
  };

  try {
    await apiRequest("/lecturers", { method: "POST", body: JSON.stringify(payload) });
    lecturerForm.reset();
    showFeedback("Lecturer registered.");
    await loadLecturers(searchInput.value.trim());
  } catch (error) {
    showFeedback(error.message, true);
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
    await apiRequest(`/lecturers/${lecturer._id}`, {
      method: "PUT",
      body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), department: department.trim() })
    });
    showFeedback("Lecturer updated.");
    await loadLecturers(searchInput.value.trim());
  } catch (error) {
    showFeedback(error.message, true);
  }
}

async function deleteLecturer(lecturer) {
  if (!confirm(`Delete lecturer ${lecturer.fullName}?`)) return;
  try {
    await apiRequest(`/lecturers/${lecturer._id}`, { method: "DELETE" });
    showFeedback("Lecturer deleted.");
    await loadLecturers(searchInput.value.trim());
  } catch (error) {
    showFeedback(error.message, true);
  }
}

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadLecturers(searchInput.value.trim()), 200);
});

loadLecturers();
