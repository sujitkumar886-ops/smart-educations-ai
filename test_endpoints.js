const http = require('http');

const routes = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/ai-tutor.html',
  '/pdf-study.html',
  '/image-solver.html',
  '/notes.html',
  '/quiz.html',
  '/study-planner.html',
  '/profile.html',
  '/performance.html',
  '/leaderboard.html',
  '/login.html',
  '/register.html',
  '/style.css',
  '/auth.js',
  '/theme.js',
  '/ai-tutor.js',
  '/pdf-study.js',
  '/image-solver.js',
  '/notes.js',
  '/quiz.js'
];

function testRoute(route) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${route}`, (res) => {
      resolve({ route, status: res.statusCode });
    }).on('error', (err) => {
      resolve({ route, status: 'ERROR', error: err.message });
    });
  });
}

async function testAll() {
  console.log('=== TESTING ALL SMART EDU AI APPLICATION ROUTES ===\n');
  let passed = 0;
  let failed = 0;

  for (const route of routes) {
    const result = await testRoute(route);
    if (result.status === 200) {
      console.log(`✅ HTTP 200 OK - ${result.route}`);
      passed++;
    } else {
      console.error(`❌ HTTP ${result.status} - ${result.route}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed === 0) {
    console.log('🎉 ALL ACTIVE APPLICATION ROUTES ARE SERVING 200 OK PERFECTLY!');
  } else {
    process.exit(1);
  }
}

testAll();
