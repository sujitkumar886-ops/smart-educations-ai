// =====================================
// SMART EDUCATION AI - THEME & LANGUAGE ENGINE
// =====================================

function initThemeAndLanguage() {
    const savedTheme = localStorage.getItem("themePreference") || "dark";
    applyTheme(savedTheme);

    const savedLang = localStorage.getItem("languagePreference") || "English";
    applyLanguage(savedLang);
}

function applyTheme(theme) {
    if (theme === "light") {
        document.body.classList.add("light-theme");
    } else {
        document.body.classList.remove("light-theme");
    }
    localStorage.setItem("themePreference", theme);

    const themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) {
        themeBtn.innerText = theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode";
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem("themePreference") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
}

function applyLanguage(lang) {
    localStorage.setItem("languagePreference", lang);
    const langSelect = document.getElementById("languageSelect");
    if (langSelect) langSelect.value = lang;
}

window.toggleTheme = toggleTheme;
window.applyLanguage = applyLanguage;

document.addEventListener("DOMContentLoaded", initThemeAndLanguage);
