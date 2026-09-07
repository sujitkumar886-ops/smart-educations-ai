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

// Minimal synthetic 1x1 PNG base64
const sampleImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runUploadTests() {
  console.log('=== STARTING IMAGE SOLVER UPLOAD & VALIDATION TESTS ===\n');

  try {
    // Test 1: Valid Image Upload & Question Statement
    console.log('1. Testing POST /api/image-solver/analyze (Valid Image & Statement)...');
    const validRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/image-solver/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_img_user_a' }
    }, {
      userId: 'test_img_user_a',
      imageBase64: sampleImageBase64,
      questionText: 'Calculate force when mass = 10kg and acceleration = 5m/s^2',
      language: 'English',
      subjectOverride: 'Physics'
    });

    console.log(`Status: ${validRes.status}`);
    if (validRes.status === 201 && validRes.body.solutionRecord && validRes.body.solutionRecord.id) {
      console.log(`✅ Valid Image Analysis PASSED! Created Solution ID: ${validRes.body.solutionRecord.id}`);
    } else {
      console.error('❌ Valid Image Analysis FAILED:', validRes.body);
    }

    // Test 2: Missing Image & Question Text
    console.log('\n2. Testing POST /api/image-solver/analyze (Empty image & empty text)...');
    const emptyRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/image-solver/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_img_user_a' }
    }, {
      userId: 'test_img_user_a',
      imageBase64: '',
      questionText: ''
    });

    console.log(`Status: ${emptyRes.status}`);
    if (emptyRes.status === 400) {
      console.log('✅ Empty request rejection PASSED! HTTP 400 Bad Request');
    } else {
      console.error('❌ Empty request rejection FAILED:', emptyRes.status);
    }

    // Test 3: Oversized Payload Rejection (>10MB)
    console.log('\n3. Testing POST /api/image-solver/analyze (Oversized payload)...');
    const oversizedBase64 = 'data:image/png;base64,' + 'A'.repeat(15 * 1024 * 1024);
    const oversizedRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/image-solver/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test_img_user_a' }
    }, {
      userId: 'test_img_user_a',
      imageBase64: oversizedBase64,
      questionText: 'Oversized test'
    });

    console.log(`Status: ${oversizedRes.status}`);
    if (oversizedRes.status === 400) {
      console.log('✅ Oversized payload rejection PASSED! HTTP 400 Bad Request');
    } else {
      console.error('❌ Oversized payload rejection FAILED:', oversizedRes.status);
    }

    console.log('\n=== ALL IMAGE SOLVER UPLOAD TESTS COMPLETED ===');
  } catch (err) {
    console.error('Unexpected error running upload tests:', err);
  }
}

runUploadTests();
