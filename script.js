const searchInput = document.getElementById("searchLecturer");

const rows = document.querySelectorAll("#lecturers table tr");

searchInput.addEventListener("input", function() {

    const searchValue = searchInput.value.toLowerCase();

    for (let i = 1; i < rows.length; i++) {

        const lecturerDetails = rows[i].textContent.toLowerCase();

        if (lecturerDetails.includes(searchValue)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
});
const lecturerForm = document.getElementById("lecturerForm");

lecturerForm.addEventListener("submit", function(event) {

    event.preventDefault();
const lecturerID = document.getElementById("lecturerID").value;
const fullName = document.getElementById("fullName").value;
const email = document.getElementById("email").value;
const department = document.getElementById("department").value;
const table = document.querySelector("#lecturers table");
const newRow = table.insertRow();
newRow.insertCell(0).textContent = lecturerID;
newRow.insertCell(1).textContent = fullName;
newRow.insertCell(2).textContent = email;
newRow.insertCell(3).textContent = department;
newRow.insertCell(4).textContent = "Edit | Delete";
lecturerForm.reset();


});