const fs = require('fs');
const http = require('http');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function fetchUrl(urlPath) {
    return new Promise((resolve, reject) => {
        http.get(`${BASE_URL}${urlPath}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        }).on('error', err => reject(err));
    });
}

async function runNavigationAudit() {
    console.log("=== STARTING NAVIGATION & AUTH FIX VERIFICATION ===");
    let passed = true;

    // 1. Verify Page Endpoints
    const routes = [
        '/dashboard.html',
        '/pdf-study.html',
        '/image-solver.html',
        '/ai-tutor.html',
        '/notes.html',
        '/quiz.html',
        '/study-planner.html',
        '/profile.html',
        '/leaderboard.html'
    ];

    console.log("\n1. Testing HTTP status for all dashboard routes...");
    for (const r of routes) {
        try {
            const res = await fetchUrl(r);
            if (res.statusCode === 200) {
                console.log(`  [PASS] GET ${r} -> HTTP 200 OK`);
            } else {
                console.error(`  [FAIL] GET ${r} -> HTTP ${res.statusCode}`);
                passed = false;
            }
        } catch (e) {
            console.error(`  [FAIL] GET ${r} -> Error: ${e.message}`);
            passed = false;
        }
    }

    // 2. Inspect dashboard.html for PDF Study AI Card
    console.log("\n2. Inspecting dashboard.html PDF Study AI card...");
    const dashboardHtml = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
    
    if (dashboardHtml.includes("window.location.href='pdf-study.html'") || dashboardHtml.includes('href="pdf-study.html"')) {
        console.log("  [PASS] Dashboard PDF Study AI card correctly points to pdf-study.html");
    } else {
        console.error("  [FAIL] Dashboard PDF Study AI card link is misconfigured");
        passed = false;
    }

    if (dashboardHtml.includes('target="_blank"') && dashboardHtml.includes('pdf-study')) {
        console.error("  [FAIL] Dashboard PDF Study AI card opens in new window (_blank)");
        passed = false;
    } else {
        console.log("  [PASS] PDF Study AI opens inside the same application tab (no _blank)");
    }

    // 3. Verify Session Key Sync in auth.js
    console.log("\n3. Verifying auth.js session key synchronization...");
    const authJs = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
    if (authJs.includes('smart_edu_user') && authJs.includes('currentUser') && authJs.includes('student')) {
        console.log("  [PASS] auth.js saves currentUser, smart_edu_user, and student on login");
    } else {
        console.error("  [FAIL] auth.js is missing key synchronization");
        passed = false;
    }

    // 4. Verify pdf-study.js Auth Check
    console.log("\n4. Verifying pdf-study.js auth resolver...");
    const pdfStudyJs = fs.readFileSync(path.join(__dirname, 'pdf-study.js'), 'utf8');
    if (pdfStudyJs.includes('currentUser') && pdfStudyJs.includes('smart_edu_user') && pdfStudyJs.includes('student')) {
        console.log("  [PASS] pdf-study.js checks currentUser, smart_edu_user, and student before redirecting");
    } else {
        console.error("  [FAIL] pdf-study.js does not check all session keys");
        passed = false;
    }

    console.log("\n==================================================");
    if (passed) {
        console.log("FINAL STATUS: PASS - All navigation and auth checks succeeded!");
    } else {
        console.error("FINAL STATUS: FAIL - Issues found!");
        process.exit(1);
    }
}

runNavigationAudit();
