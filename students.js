// =====================================
// SMART EDUCATION AI - STUDENT MANAGEMENT
// =====================================

const API_URL = "";

async function loadStudents() {
    const container = document.getElementById("studentsContainer") || document.getElementById("studentsList");
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/api/students`);
        const students = await response.json().catch(() => ([]));

        if (!response.ok) {
            container.innerHTML = "<p style='color: #ef4444; padding: 20px;'>Unable to load registered students.</p>";
            return;
        }

        if (!students || students.length === 0) {
            container.innerHTML = "<p style='color: #64748b; padding: 20px; text-align: center;'>No students registered yet.</p>";
            return;
        }

        container.innerHTML = "";

        students.forEach(student => {
            const card = document.createElement("div");
            card.className = "student-card";
            card.style.cssText = "background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);";

            card.innerHTML = `
                <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 18px;">👤 ${student.name}</h3>
                <p style="margin: 4px 0; color: #475569;"><strong>Email:</strong> ${student.email}</p>
                <p style="margin: 4px 0; color: #475569;"><strong>Course:</strong> ${student.course || "B.Tech"}</p>
                <p style="margin: 4px 0; color: #475569;"><strong>College:</strong> ${student.college || "PPSU"}</p>
                <p style="margin: 4px 0; color: #475569;"><strong>Semester:</strong> ${student.semester || "3rd"}</p>
                <button onclick="deleteStudent('${student.id}')" style="margin-top: 12px; background: #fee2e2; color: #b91c1c; border: 0; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    🗑️ Delete Student
                </button>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        console.error("Load Students Error:", error);
        container.innerHTML = "<p style='color: #ef4444; padding: 20px;'>Connection error while loading students.</p>";
    }
}

async function deleteStudent(id) {
    if (!confirm("Are you sure you want to delete this student account?")) return;

    try {
        const response = await fetch(`${API_URL}/api/students/${id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert(data.error || "Failed to delete student.");
            return;
        }

        alert("Student account deleted.");
        loadStudents();
    } catch (error) {
        console.error("Delete Student Error:", error);
        alert("Server error deleting student.");
    }
}

window.deleteStudent = deleteStudent;

document.addEventListener("DOMContentLoaded", loadStudents);