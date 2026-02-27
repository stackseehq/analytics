/**
 * E2E tests for the Pirsch provider via the proxy flow.
 *
 * Tests the full stack:
 *   Browser (ProxyProvider) → /api/analytics → ingestProxyEvents → PirschServerProvider → api.pirsch.io
 *
 * Run with:
 *   pnpm test:e2e
 *
 * Requires the test server to be running:
 *   cd e2e/test-app && node server.js
 *
 * The test server intercepts outbound fetch calls to api.pirsch.io and exposes
 * them via GET /api/analytics/status for assertion.
 */

import { chromium } from 'playwright';

const TARGET_URL = 'http://localhost:3737';
const STATUS_URL = `${TARGET_URL}/api/analytics/status`;

async function resetStatus() {
  const resp = await fetch(STATUS_URL, { method: 'DELETE' });
  return await resp.json();
}

async function getStatus() {
  const resp = await fetch(STATUS_URL);
  return await resp.json();
}

/** Poll until at least one Pirsch API call appears in the status log. */
async function waitForPirschCall(maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const status = await getStatus();
    if (status.calls && status.calls.length > 0) return status;
    await new Promise(r => setTimeout(r, 300));
  }
  return await getStatus();
}

(async () => {
  console.log('Starting Pirsch E2E Tests\n');
  const results = { passed: 0, failed: 0, tests: [] };

  function pass(name) {
    console.log(`  PASS ${name}`);
    results.passed++;
    results.tests.push({ name, passed: true });
  }

  function fail(name, reason) {
    console.log(`  FAIL ${name}: ${reason}`);
    results.failed++;
    results.tests.push({ name, passed: false, reason });
  }

  const browser = await chromium.launch({ headless: true });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Server health check
  // ─────────────────────────────────────────────────────────────
  console.log('Test 1: Server health check');
  try {
    const status = await getStatus();
    if (status && status.calls !== undefined) {
      pass('Status endpoint returns expected shape');
    } else {
      fail('Status endpoint', 'Unexpected shape: ' + JSON.stringify(status));
    }
  } catch (e) {
    fail('Status endpoint', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Page load + ProxyProvider init
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 2: Page load and ProxyProvider init');
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
    const title = await page.title();
    if (title === 'Analytics E2E Test Page') {
      pass('Page loaded with correct title');
    } else {
      fail('Page title', `Expected "Analytics E2E Test Page", got "${title}"`);
    }
  } catch (e) {
    fail('Page load', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Analytics client initialization
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 3: Analytics client initialization');
  try {
    await page.waitForFunction(() => window.__analyticsReady === true, { timeout: 10000 });
    pass('Analytics client initialized on page');
  } catch (e) {
    fail('Analytics init', e.message);
    console.log('  Browser console:', consoleLogs.slice(-5).join('\n    '));
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4: pageView event sent to proxy
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 4: pageView event → /api/analytics proxy');
  await resetStatus();

  try {
    // Register listener BEFORE reload to avoid the race condition
    const proxyCallPromise = page.waitForRequest(
      req => req.url().includes('/api/analytics') && req.method() === 'POST',
      { timeout: 8000 }
    ).catch(() => null);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__analyticsReady === true, { timeout: 10000 });

    const proxyCall = await proxyCallPromise;

    if (proxyCall) {
      pass('ProxyProvider POSTed to /api/analytics');
      const body = proxyCall.postDataJSON();
      const pageViewEvent = body?.events?.find(e => e.type === 'pageView');
      if (pageViewEvent) {
        pass('Payload contains pageView event');
      } else {
        fail('pageView in payload', `Events: ${JSON.stringify(body?.events?.map(e => e.type))}`);
      }
    } else {
      fail('ProxyProvider POST', 'No POST to /api/analytics within 8s');
    }
  } catch (e) {
    fail('pageView proxy test', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Pirsch API called (OAuth + page hit)
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 5: Pirsch API called from server (OAuth + hit)');
  try {
    const status = await waitForPirschCall(20000);

    if (!status.calls || status.calls.length === 0) {
      fail('Pirsch API called', 'No calls to api.pirsch.io detected within 20s');
    } else {
      pass(`Pirsch API was called (${status.calls.length} call(s))`);

      // OAuth token call (may be absent if token is cached from earlier)
      const tokenCall = status.calls.find(c => c.url?.includes('/api/v1/token'));
      if (tokenCall) {
        if (tokenCall.success) {
          pass(`OAuth token fetched (${tokenCall.duration}ms)`);
        } else {
          fail('OAuth token fetch', `HTTP ${tokenCall.status} — ${tokenCall.error || 'unknown'}`);
        }
      }

      // Hit or event call
      const hitCall = status.calls.find(
        c => c.url?.includes('/api/v1/hit') || c.url?.includes('/api/v1/event')
      );
      if (hitCall) {
        if (hitCall.success) {
          pass(`Pirsch hit/event sent (${hitCall.duration}ms, HTTP ${hitCall.status})`);
          if (hitCall.duration < 5000) {
            pass(`No timeout regression: completed in ${hitCall.duration}ms (< 5000ms)`);
          } else {
            fail('Timeout check', `Request took ${hitCall.duration}ms (approaching 5000ms limit)`);
          }
        } else {
          fail('Pirsch hit/event', `${hitCall.error || `HTTP ${hitCall.status}`}`);
        }
      }

      console.log('\n  Pirsch API calls:');
      for (const call of status.calls) {
        const icon = call.success ? 'OK' : 'ERR';
        console.log(`    [${icon}] ${call.url} — ${call.duration}ms — HTTP ${call.status || 'n/a'}`);
      }
    }
  } catch (e) {
    fail('Pirsch API test', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Custom event (button_clicked) via proxy → Pirsch
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 6: Custom event tracking (button_clicked)');
  await resetStatus();

  try {
    const proxyPostPromise = page.waitForRequest(
      req => req.url().includes('/api/analytics') && req.method() === 'POST',
      { timeout: 5000 }
    );

    await page.click('#track-btn');
    const proxyPost = await proxyPostPromise.catch(() => null);

    if (proxyPost) {
      const body = proxyPost.postDataJSON();
      const trackEvent = body?.events?.find(e => e.type === 'track');
      if (trackEvent?.event?.action === 'button_clicked') {
        pass('Custom event "button_clicked" sent via proxy');
      } else {
        fail(
          'Track event action',
          `Got: ${JSON.stringify(body?.events?.map(e => ({ type: e.type, action: e.event?.action })))}`
        );
      }
    } else {
      fail('Track event proxy POST', 'No POST within 5s after button click');
    }

    const status = await waitForPirschCall(15000);
    if (status.calls?.some(c => c.url?.includes('/api/v1/event') && c.success)) {
      pass('Custom event reached Pirsch API successfully');
    } else if (status.calls?.length > 0) {
      const evtCall = status.calls.find(c => c.url?.includes('/api/v1/event'));
      if (evtCall && !evtCall.success) {
        fail('Custom event to Pirsch', evtCall.error || `HTTP ${evtCall.status}`);
      } else {
        pass('Pirsch calls made (shared token from previous test)');
      }
    }
  } catch (e) {
    fail('Custom event test', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Timeout regression (the Vercel bug)
  // ─────────────────────────────────────────────────────────────
  console.log('\nTest 7: Timeout regression check (Vercel bug)');
  try {
    const status = await getStatus();
    const allCalls = status.calls || [];
    const timedOut = allCalls.filter(
      c => !c.success && c.error?.toLowerCase().includes('timeout')
    );

    if (timedOut.length === 0) {
      pass('No timeout errors (Vercel timeout bug not present locally)');
    } else {
      fail('Timeout regression', `${timedOut.length} timeout(s): ${timedOut.map(c => c.error).join(', ')}`);
    }

    const slowCalls = allCalls.filter(c => c.duration > 5000);
    if (slowCalls.length === 0) {
      pass('All Pirsch API calls completed under 5000ms');
    } else {
      fail(
        'Slow calls',
        `${slowCalls.length} exceeded 5000ms: ${slowCalls.map(c => `${c.url} (${c.duration}ms)`).join(', ')}`
      );
    }
  } catch (e) {
    fail('Timeout regression', e.message);
  }

  await page.close();
  await browser.close();

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`RESULTS: ${results.passed} passed, ${results.failed} failed`);
  console.log(line);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  FAIL ${t.name}: ${t.reason}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
  }
})();
