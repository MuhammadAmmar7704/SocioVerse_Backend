import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
// Hardcoded credentials for existing user
const TEST_EMAIL = 'anas11@email.com';
const TEST_PASS = 'anas11';

export let options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  //–– AUTH: login with predefined credentials ––//
  let loginRes = http.post(`${BASE_URL}/api/auth/login`, 
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASS
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );

  // Check login success
  if (!check(loginRes, { 'login 200': r => r.status === 200 })) {
    console.error(`Login failed: ${loginRes.body}`);
    return;
  }

  // Extract token - ensure your backend actually returns token in JSON body
  const token = loginRes.json('token');
  if (!token) {
    console.error('No token found in login response:', loginRes.body);
    return;
  }

  const authHeaders = { 
    headers: { 
      Authorization: `Bearer ${token}`, 
      'Content-Type': 'application/json' 
    } 
  };

  //–– Test protected endpoints ––//
  const requests = {
    'GET /auth/all': http.get(`${BASE_URL}/api/auth/all`, authHeaders),
    'GET contests': http.get(`${BASE_URL}/api/contest/2`, authHeaders),
    'GET events': http.get(`${BASE_URL}/api/event/getallevent`, authHeaders),
    'GET societies': http.get(`${BASE_URL}/api/society/getallsociety`, authHeaders),
    'GET universities': http.get(`${BASE_URL}/api/university/getalluniversity`, authHeaders),
  };

  // Verify all responses
  check(requests['GET /auth/all'], { 'GET /auth/all 200': r => r.status === 200 });
  check(requests['GET contests'], { 'GET contests 200': r => r.status === 200 });
  check(requests['GET events'], { 'GET events 200': r => r.status === 200 });
  check(requests['GET societies'], { 'GET societies 200': r => r.status === 200 });
  check(requests['GET universities'], { 'GET universities 200': r => r.status === 200 });

  sleep(1);
}
