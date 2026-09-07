const fs = require('fs');
const http = require('http');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', err => reject(err));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runPinSecurityAudit() {
    console.log("==================================================");
    console.log("🔑 STARTING ADMIN PIN VERIFICATION SECURITY AUDIT");
    console.log("==================================================\n");

    let allPassed = true;

    // 1. ENV & GITIGNORE AUDIT
    console.log("1. Inspecting .env & .gitignore security configuration...");
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');

    if (envContent.includes('ADMIN_PIN=')) {
        console.log("  [PASS] ADMIN_PIN is defined in .env file");
    } else {
        console.error("  [FAIL] ADMIN_PIN missing from .env");
        allPassed = false;
    }

    if (gitignoreContent.includes('.env')) {
        console.log("  [PASS] .env is included in .gitignore");
    } else {
        console.error("  [FAIL] .env missing from .gitignore");
        allPassed = false;
    }

    // 2. EMPTY PIN REJECTION TEST
    console.log("\n2. Testing Empty PIN Rejection...");
    const emptyPinRes = await makeRequest('POST', '/api/admin/verify-pin', { pin: "" });
    if (emptyPinRes.status === 400 && emptyPinRes.body?.error) {
        console.log(`  [PASS] Empty PIN request -> HTTP 400 Bad Request ("${emptyPinRes.body.error}")`);
    } else {
        console.error(`  [FAIL] Empty PIN request -> HTTP ${emptyPinRes.status}`);
        allPassed = false;
    }

    // 3. INVALID PIN REJECTION TEST
    console.log("\n3. Testing Invalid PIN Rejection...");
    const invalidPinRes = await makeRequest('POST', '/api/admin/verify-pin', { pin: "999999" });
    if (invalidPinRes.status === 401 && invalidPinRes.body?.error === "Invalid Admin PIN.") {
        console.log(`  [PASS] Invalid PIN request -> HTTP 401 Unauthorized ("Invalid Admin PIN.")`);
        
        // Verify PIN is not leaked in response
        const bodyStr = JSON.stringify(invalidPinRes.body);
        if (!bodyStr.includes("8864")) {
            console.log("  [PASS] Server response does not reveal correct PIN or secrets");
        } else {
            console.error("  [FAIL] Server response leaked the PIN!");
            allPassed = false;
        }
    } else {
        console.error(`  [FAIL] Invalid PIN request -> HTTP ${invalidPinRes.status}`);
        allPassed = false;
    }

    // 4. VALID ADMIN PIN VERIFICATION TEST
    console.log("\n4. Testing Valid Admin PIN Verification...");
    const validPinRes = await makeRequest('POST', '/api/admin/verify-pin', { pin: "8864" });
    if (validPinRes.status === 200 && validPinRes.body?.student?.role === "admin") {
        console.log(`  [PASS] Valid PIN verified -> HTTP 200 OK (User: ${validPinRes.body.student.name}, Role: ${validPinRes.body.student.role})`);

        if (validPinRes.body.student.password) {
            console.error("  [FAIL] User password exposed in API response!");
            allPassed = false;
        } else {
            console.log("  [PASS] Sensitive fields (password) excluded from API response");
        }
    } else {
        console.error(`  [FAIL] Valid PIN verification failed: HTTP ${validPinRes.status}`, validPinRes.body);
        allPassed = false;
    }

    const adminUserId = validPinRes.body?.student?.id;

    // 5. SESSION AUTHORIZATION VERIFICATION
    console.log("\n5. Verifying Admin Session Authorization on Admin APIs...");
    const adminStatsRes = await makeRequest('GET', '/api/admin/stats', null, { 'x-user-id': String(adminUserId) });
    if (adminStatsRes.status === 200) {
        console.log(`  [PASS] Verified Admin session caller access to GET /api/admin/stats -> HTTP 200 OK`);
    } else {
        console.error(`  [FAIL] Admin session caller failed stats check: HTTP ${adminStatsRes.status}`);
        allPassed = false;
    }

    // 6. STUDENT BYPASS ATTEMPT TEST
    console.log("\n6. Testing Student Bypass Prevention...");
    const studentRes = await makeRequest('GET', '/api/admin/stats', null, { 'x-user-id': 'non_admin_student_id' });
    if (studentRes.status === 401 || studentRes.status === 403) {
        console.log(`  [PASS] Student attempt to bypass PIN/auth -> HTTP ${studentRes.status} Access Denied`);
    } else {
        console.error(`  [FAIL] Student bypass attempt -> HTTP ${studentRes.status} (Expected 401/403)`);
        allPassed = false;
    }

    console.log("\n==================================================");
    if (allPassed) {
        console.log("FINAL RESULT: PASS — All Admin PIN Security Checks Succeeded!");
    } else {
        console.error("FINAL RESULT: FAIL — Security audit failed!");
        process.exit(1);
    }
}

runPinSecurityAudit();
