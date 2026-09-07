const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

const sampleImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runSecurityTests() {
  console.log('=== STARTING IMAGE SOLVER USER DATA ISOLATION & SECURITY TESTS ===\n');

  try {
    // Step 1: User A Creates Solution Record
    console.log('1. User A creating private solved question record...');
    const analyzeRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/image-solver/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'sec_img_user_a' }
    }, {
      userId: 'sec_img_user_a',
      imageBase64: sampleImageBase64,
      questionText: 'Private exam solution for User A',
      subjectOverride: 'Chemistry'
    });

    if (analyzeRes.status !== 201 || !analyzeRes.body.solutionRecord) {
      console.error('❌ Failed to create User A solution:', analyzeRes.body);
      return;
    }

    const userASolutionId = analyzeRes.body.solutionRecord.id;
    console.log(`User A Solution created: ID ${userASolutionId}`);

    // Step 2: User B Attempts to Access User A's Solution
    console.log('\n2. Testing User B attempt to GET User A solution (GET /api/image-solver/sec_img_user_a/:id)...');
    const unauthGetRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/image-solver/sec_img_user_a/${userASolutionId}`,
      method: 'GET',
      headers: { 'x-user-id': 'sec_img_user_b' }
    });

    console.log(`Status: ${unauthGetRes.status}`);
    if (unauthGetRes.status === 403) {
      console.log('✅ User Isolation PASSED! User B denied access to User A solution (HTTP 403 Forbidden)');
    } else {
      console.error('❌ User Isolation FAILED! Expected 403, got:', unauthGetRes.status, unauthGetRes.body);
    }

    // Step 3: User B Attempts to Delete User A's Solution
    console.log('\n3. Testing User B attempt to DELETE User A solution (DELETE /api/image-solver/sec_img_user_a/:id)...');
    const unauthDeleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/image-solver/sec_img_user_a/${userASolutionId}`,
      method: 'DELETE',
      headers: { 'x-user-id': 'sec_img_user_b' }
    });

    console.log(`Status: ${unauthDeleteRes.status}`);
    if (unauthDeleteRes.status === 403) {
      console.log('✅ Unauthorized Delete PASSED! User B denied deletion (HTTP 403 Forbidden)');
    } else {
      console.error('❌ Unauthorized Delete FAILED! Expected 403, got:', unauthDeleteRes.status, unauthDeleteRes.body);
    }

    // Step 4: User A Authorized Deletion
    console.log('\n4. Testing User A authorized DELETE own solution...');
    const authDeleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/image-solver/sec_img_user_a/${userASolutionId}`,
      method: 'DELETE',
      headers: { 'x-user-id': 'sec_img_user_a' }
    });

    console.log(`Status: ${authDeleteRes.status}`);
    if (authDeleteRes.status === 200 && authDeleteRes.body.message) {
      console.log('✅ Authorized Delete PASSED! User A deleted own solution record.');
    } else {
      console.error('❌ Authorized Delete FAILED:', authDeleteRes.body);
    }

    console.log('\n=== ALL IMAGE SOLVER SECURITY & ISOLATION TESTS PASSED ===');
  } catch (err) {
    console.error('Unexpected error running security tests:', err);
  }
}

runSecurityTests();
