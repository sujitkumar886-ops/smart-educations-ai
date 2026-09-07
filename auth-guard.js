// ==========================================================================
// SMART EDUCATION AI - CENTRALIZED HEAD AUTHENTICATION GUARD
// ==========================================================================

(function () {
    const currentFile = window.location.pathname.split("/").pop() || "index.html";

    // Public pages accessible without login
    const publicPages = ["index.html", "login.html", "register.html", ""];
    if (publicPages.includes(currentFile.toLowerCase())) {
        // If user is on login/register and already logged in, redirect to dashboard
        if (["login.html", "register.html"].includes(currentFile.toLowerCase())) {
            const isLoggedIn = localStorage.getItem("isLoggedIn");
            const rawUser = localStorage.getItem("currentUser") || localStorage.getItem("smart_edu_user") || localStorage.getItem("student");
            if (isLoggedIn === "true" && rawUser) {
                try {
                    const u = JSON.parse(rawUser);
                    if (u && (u.id || u.email)) {
                        window.location.replace(u.role === "admin" ? "admin-dashboard.html" : u.role === "teacher" ? "teacher-dashboard.html" : "dashboard.html");
                        return;
                    }
                } catch (e) {}
            }
        }
        return;
    }

    // --- PROTECTED PAGE ACCESS CONTROL ---

    // 1. Synchronously prevent Content Flash (FOUC) until session is verified
    document.documentElement.style.display = 'none';

    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const rawUser = localStorage.getItem("currentUser") || 
                    localStorage.getItem("smart_edu_user") || 
                    localStorage.getItem("student");

    if (isLoggedIn !== "true" || !rawUser) {
        clearSessionAndRedirect(currentFile);
        return;
    }

    let user = null;
    try {
        user = JSON.parse(rawUser);
    } catch (e) {
        clearSessionAndRedirect(currentFile);
        return;
    }

    if (!user || (!user.id && !user.email)) {
        clearSessionAndRedirect(currentFile);
        return;
    }

    // Synchronize localStorage keys for cross-module reliability
    try {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("currentUser", JSON.stringify(user));
        localStorage.setItem("smart_edu_user", JSON.stringify(user));
        localStorage.setItem("student", JSON.stringify(user));
    } catch (e) {}

    // 2. Perform fast server-side session verification
    fetch("/api/auth/me", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "x-user-id": String(user.id)
        }
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (!data || !data.ok || !data.user) {
            clearSessionAndRedirect(currentFile);
            return;
        }

        // Check Admin page access restriction
        if (currentFile.toLowerCase() === "admin-dashboard.html" && (data.user.role || "student") !== "admin") {
            // Keep style.display = '' so the Access Denied UI card in admin-dashboard.html can render safely
            document.documentElement.style.display = '';
            return;
        }

        // Session verified cleanly: restore display
        document.documentElement.style.display = '';
    })
    .catch(err => {
        console.warn("Auth Guard Server Check Warning:", err.message);
        // Fallback: If network issue but client session formatted validly, allow render
        document.documentElement.style.display = '';
    });

    function clearSessionAndRedirect(targetPage) {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("currentUser");
        localStorage.removeItem("smart_edu_user");
        localStorage.removeItem("student");
        
        const redirectParam = encodeURIComponent(targetPage || "dashboard.html");
        window.location.replace(`login.html?redirect=${redirectParam}`);
    }
})();
