// =====================================
// SMART EDUCATION AI - AUTHENTICATION
// =====================================

const API_URL = "";

// Check if user is already logged in on login/register pages
function redirectIfLoggedIn() {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const currentUser = localStorage.getItem("currentUser");
    if (isLoggedIn === "true" && currentUser) {
        window.location.href = "dashboard.html";
    }
}

// =====================================
// REGISTER FORM
// =====================================
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    redirectIfLoggedIn();
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = (document.getElementById("registerName")?.value || "").trim();
        const email = (document.getElementById("registerEmail")?.value || "").trim();
        const password = document.getElementById("registerPassword")?.value || "";
        const course = (document.getElementById("registerCourse")?.value || "B.Tech").trim();
        const college = (document.getElementById("registerCollege")?.value || "PPSU").trim();
        const semester = (document.getElementById("registerSemester")?.value || "3rd").trim();

        if (!name || !email || !password) {
            alert("Name, email and password are required.");
            return;
        }

        if (password.length < 6) {
            alert("Password must contain at least 6 characters.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, course, college, semester })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                alert(data.error || "Registration failed.");
                return;
            }

            alert("Account created successfully! Please login to continue. 🎉");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Register Error:", error);
            alert("Unable to connect to server. Please ensure the backend server is running.");
        }
    });
}

// =====================================
// LOGIN FORM
// =====================================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    redirectIfLoggedIn();
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = (document.getElementById("loginEmail")?.value || "").trim();
        const password = document.getElementById("loginPassword")?.value || "";

        if (!email || !password) {
            alert("Email and password are required.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                alert(data.error || "Invalid email or password.");
                return;
            }

            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("currentUser", JSON.stringify(data.student));
            localStorage.setItem("smart_edu_user", JSON.stringify(data.student));
            localStorage.setItem("student", JSON.stringify(data.student));

            alert(`Welcome back, ${data.student.name}! 🎉`);
            if (data.student.role === "admin") {
                window.location.href = "admin-dashboard.html";
            } else if (data.student.role === "teacher") {
                window.location.href = "teacher-dashboard.html";
            } else {
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error("Login Error:", error);
            alert("Unable to connect to server. Please ensure the backend server is running.");
        }
    });
}

// Global user session resolver
function getAuthenticatedUser() {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const raw = localStorage.getItem("currentUser") || 
                localStorage.getItem("smart_edu_user") || 
                localStorage.getItem("student");
    
    if (!raw) return null;

    try {
        const user = JSON.parse(raw);
        if (user && (user.id || user.email)) {
            // Keep keys synchronized
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("currentUser", JSON.stringify(user));
            localStorage.setItem("smart_edu_user", JSON.stringify(user));
            localStorage.setItem("student", JSON.stringify(user));
            return user;
        }
    } catch (e) {
        console.error("Error parsing user session:", e);
    }
    return null;
}
window.getAuthenticatedUser = getAuthenticatedUser;

// Global logout function
function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("smart_edu_user");
    localStorage.removeItem("student");
    window.location.href = "login.html";
}
window.logout = logout;