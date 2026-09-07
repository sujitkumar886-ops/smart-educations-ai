const http = require('http');

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

async function runSecurityAudit() {
    console.log("==================================================");
    console.log("🛡️ STARTING COMPREHENSIVE ROLE & SECURITY AUDIT");
    console.log("==================================================\n");

    let allPassed = true;

    // 1. PUBLIC REGISTRATION ROLE ESCALATION TEST
    console.log("1. Testing Public Registration Privilege Escalation Protection...");
    const testRegEmail = `hacker_${Date.now()}@test.com`;
    const regRes = await makeRequest('POST', '/api/register', {
        name: "Hacker Attempt",
        email: testRegEmail,
        password: "password123",
        role: "admin" // Attempting role escalation
    });

    if (regRes.status === 201 && regRes.body?.student?.role !== "admin") {
        console.log(`  [PASS] Public registration with role='admin' was demoted to '${regRes.body.student.role}' (HTTP ${regRes.status})`);
    } else {
        console.error(`  [FAIL] Role escalation allowed! Registered role: ${regRes.body?.student?.role}`);
        allPassed = false;
    }

    const testStudentId = regRes.body?.student?.id;

    // 2. ADMIN LOGIN BOOTSTRAP TEST
    console.log("\n2. Testing Admin Account Login...");
    const adminLoginRes = await makeRequest('POST', '/api/login', {
        email: "admin@smartedu.ai",
        password: "AdminPassword123!"
    });

    if (adminLoginRes.status === 200 && adminLoginRes.body?.student?.role === "admin") {
        console.log(`  [PASS] Logged in as Admin user '${adminLoginRes.body.student.name}' (Role: ${adminLoginRes.body.student.role})`);
    } else {
        console.error(`  [FAIL] Admin login failed: HTTP ${adminLoginRes.status}`, adminLoginRes.body);
        allPassed = false;
    }

    const adminUserId = adminLoginRes.body?.student?.id || "admin_001";

    // 3. STUDENT ADMIN API ACCESS DENIAL TEST
    console.log("\n3. Testing Student Access Denial on Admin Endpoints...");
    const studentHeaders = { 'x-user-id': String(testStudentId) };

    const endpointsToDeny = [
        { method: 'GET', path: '/api/admin/stats' },
        { method: 'GET', path: '/api/admin/users' },
        { method: 'GET', path: `/api/admin/users/${testStudentId}` },
        { method: 'PUT', path: `/api/admin/users/${testStudentId}/role`, data: { role: 'admin' } },
        { method: 'PUT', path: `/api/admin/users/${testStudentId}/status`, data: { disabled: true } },
        { method: 'DELETE', path: `/api/admin/users/${testStudentId}` },
        { method: 'GET', path: '/api/admin/activity' }
    ];

    for (const ep of endpointsToDeny) {
        const res = await makeRequest(ep.method, ep.path, ep.data, studentHeaders);
        if (res.status === 403) {
            console.log(`  [PASS] Student ${ep.method} ${ep.path} -> HTTP 403 Forbidden`);
        } else {
            console.error(`  [FAIL] Student ${ep.method} ${ep.path} -> HTTP ${res.status} (Expected 403)`);
            allPassed = false;
        }
    }

    // 4. UNAUTHENTICATED (NO HEADER) ADMIN API DENIAL TEST
    console.log("\n4. Testing Unauthenticated (No Headers) Admin API Denial...");
    const unauthRes = await makeRequest('GET', '/api/admin/users');
    if (unauthRes.status === 401 || unauthRes.status === 403) {
        console.log(`  [PASS] Unauthenticated GET /api/admin/users -> HTTP ${unauthRes.status}`);
    } else {
        console.error(`  [FAIL] Unauthenticated GET /api/admin/users -> HTTP ${unauthRes.status} (Expected 401/403)`);
        allPassed = false;
    }

    // 5. AUTHORIZED ADMIN API ACCESS SUCCESS TEST
    console.log("\n5. Testing Authorized Admin API Access...");
    const adminHeaders = { 'x-user-id': String(adminUserId) };

    const statsRes = await makeRequest('GET', '/api/admin/stats', null, adminHeaders);
    if (statsRes.status === 200 && typeof statsRes.body.totalUsers === 'number') {
        console.log(`  [PASS] Admin GET /api/admin/stats -> HTTP 200 OK (Total Users: ${statsRes.body.totalUsers})`);
    } else {
        console.error(`  [FAIL] Admin GET /api/admin/stats -> HTTP ${statsRes.status}`);
        allPassed = false;
    }

    const usersRes = await makeRequest('GET', '/api/admin/users', null, adminHeaders);
    if (usersRes.status === 200 && Array.isArray(usersRes.body)) {
        console.log(`  [PASS] Admin GET /api/admin/users -> HTTP 200 OK (Users Count: ${usersRes.body.length})`);
    } else {
        console.error(`  [FAIL] Admin GET /api/admin/users -> HTTP ${usersRes.status}`);
        allPassed = false;
    }

    const activityRes = await makeRequest('GET', '/api/admin/activity', null, adminHeaders);
    if (activityRes.status === 200 && Array.isArray(activityRes.body)) {
        console.log(`  [PASS] Admin GET /api/admin/activity -> HTTP 200 OK (Activities Logged: ${activityRes.body.length})`);
    } else {
        console.error(`  [FAIL] Admin GET /api/admin/activity -> HTTP ${activityRes.status}`);
        allPassed = false;
    }

    // 6. ACCOUNT SUSPENSION TEST
    console.log("\n6. Testing Account Suspension & Login Blocking...");
    const suspendRes = await makeRequest('PUT', `/api/admin/users/${testStudentId}/status`, { disabled: true }, adminHeaders);
    if (suspendRes.status === 200) {
        console.log(`  [PASS] Admin suspended test student account`);

        const suspendedLoginRes = await makeRequest('POST', '/api/login', {
            email: testRegEmail,
            password: "password123"
        });

        if (suspendedLoginRes.status === 403) {
            console.log(`  [PASS] Suspended student login attempt -> HTTP 403 Forbidden`);
        } else {
            console.error(`  [FAIL] Suspended student login attempt -> HTTP ${suspendedLoginRes.status} (Expected 403)`);
            allPassed = false;
        }

        // Reactivate account
        await makeRequest('PUT', `/api/admin/users/${testStudentId}/status`, { disabled: false }, adminHeaders);
        console.log(`  [PASS] Admin reactivated test student account`);
    } else {
        console.error(`  [FAIL] Suspend user call failed: HTTP ${suspendRes.status}`);
        allPassed = false;
    }

    // 7. CLEANUP TEST ACCOUNT
    console.log("\n7. Testing Admin Account Deletion...");
    const delRes = await makeRequest('DELETE', `/api/admin/users/${testStudentId}`, null, adminHeaders);
    if (delRes.status === 200) {
        console.log(`  [PASS] Admin deleted test user account`);
    } else {
        console.error(`  [FAIL] Admin delete user failed: HTTP ${delRes.status}`);
        allPassed = false;
    }

    console.log("\n==================================================");
    if (allPassed) {
        console.log("FINAL RESULT: PASS — All Security & Role Authorization Checks Succeeded!");
    } else {
        console.error("FINAL RESULT: FAIL — Security vulnerabilities found!");
        process.exit(1);
    }
}

runSecurityAudit();
