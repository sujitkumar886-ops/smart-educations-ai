// =====================================
// SMART EDUCATION AI - MY PROFILE
// =====================================

const API_URL = "";

function getCurrentUser() {
    const userStr = localStorage.getItem("currentUser") || 
                    localStorage.getItem("smart_edu_user") || 
                    localStorage.getItem("student");
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

async function loadProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        alert("Please login first to view your profile.");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/profile/${currentUser.id}`);
        const data = await response.json().catch(() => ({}));

        const user = response.ok ? data : currentUser;

        const setElem = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text || "N/A";
        };

        setElem("profileName", user.name);
        setElem("profileEmail", user.email);
        setElem("profileCourse", user.course || "B.Tech");
        setElem("profileCollege", user.college || "PPSU");
        setElem("profileSemester", user.semester || "3rd");

        // Keep local copy synced
        localStorage.setItem("currentUser", JSON.stringify(user));
    } catch (error) {
        console.error("Profile Error:", error);
        // Fallback display local data
        const setElem = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text || "N/A";
        };
        setElem("profileName", currentUser.name);
        setElem("profileEmail", currentUser.email);
        setElem("profileCourse", currentUser.course || "B.Tech");
        setElem("profileCollege", currentUser.college || "PPSU");
        setElem("profileSemester", currentUser.semester || "3rd");
    }
}

async function editProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return;

    const newName = prompt("Enter your Name:", currentUser.name || "");
    if (newName === null) return;

    const newCourse = prompt("Enter your Course:", currentUser.course || "B.Tech");
    if (newCourse === null) return;

    const newCollege = prompt("Enter your College:", currentUser.college || "PPSU");
    if (newCollege === null) return;

    const newSemester = prompt("Enter your Semester:", currentUser.semester || "3rd");
    if (newSemester === null) return;

    const payload = {
        name: newName.trim() || currentUser.name,
        course: newCourse.trim() || currentUser.course,
        college: newCollege.trim() || currentUser.college,
        semester: newSemester.trim() || currentUser.semester
    };

    try {
        const response = await fetch(`${API_URL}/api/profile/${currentUser.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            alert(data.error || "Profile update failed.");
            return;
        }

        localStorage.setItem("currentUser", JSON.stringify(data.student));
        alert("Profile updated successfully! 🎉");
        loadProfile();
    } catch (error) {
        console.error("Edit Profile Error:", error);
        alert("Failed to connect to server for profile update.");
    }
}

window.editProfile = editProfile;

document.addEventListener("DOMContentLoaded", loadProfile);