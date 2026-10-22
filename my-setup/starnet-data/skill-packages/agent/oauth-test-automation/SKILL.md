---
name: "oauth-test-automation"
description: "Automated test harness for TokenForge's popup OAuth implementation. Runs headless Chromium via Playwright, exercises the full OAuth authorization code flow against a running TokenForge dev server and provider (mock or real), and asserts credential persistence. Designed for CI int"
category: "testing"
state: "active"
created_by: "background-review"
source_run_id: "22c1ec1e-6eb2-4695-a180-2de9ce7804fc_skill_review"
pinned: false
platforms: ["node", "ci", "local"]
---

## Setup
Node 18+, Playwright. Run `npm install && npm run install:browsers` in skill directory. TokenForge dev server and mock/real provider must be running before test execution.

## OAuth Test Automation for TokenForge

### Purpose
Verify TokenForge's popup OAuth flow works end-to-end: signin page → provider popup → authorization → callback → token exchange → credential stored.

### Prerequisites
- TokenForge dev server running (default `http://127.0.0.1:4100`)
- Provider reachable:
  - **Mock**: `mock-oauth-provider.js` on port 3100 (from workshop/3fcb5729-e3f6-4337-8f9f-38900c2f85f7/)
  - **OpenAI**: Real OAuth app configured in TokenForge
  - **Gemini**: Real OAuth app configured in TokenForge
- Node 18+, Playwright + Chromium installed (`npm run install:browsers`)

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OAUTH_PROVIDER` | Yes | `mock` | `mock` \| `openai` \| `gemini` |
| `OAUTH_BASE_URL` | No | `http://127.0.0.1:4100` | TokenForge dev server origin |
| `OAUTH_CLIENT_ID` | For real providers | `tokenforge_dev` | Client ID registered with provider |
| `OAUTH_HEADLESS` | No | `true` | `true` \| `false` (headed for debugging) |

### Test Flow
1. **Launch** Chromium (headless by default)
2. **Navigate** to `${OAUTH_BASE_URL}/signin`
3. **Find & click** the "Connect" button for the target provider
4. **Wait for popup** (new page) to load provider's authorization page
5. **Handle consent**:
   - Mock: click "Allow" button
   - Real: fill credentials, submit (manual or automated per provider)
6. **Wait for callback** — popup closes, main page receives auth code
7. **Verify token exchange** — poll TokenForge `/api/auth/status` or check localStorage
8. **Assert** credential exists for provider ID
9. **Emit** JSON result to `test-result.json` and exit 0 on success, non-zero on failure

### Running Locally
```bash
cd workshop/22c1ec1e-6eb2-4695-a180-2de9ce7804fc
npm install && npm run install:browsers

# Terminal 1: TokenForge dev server
cd /path/to/tokenforge && npm run dev   # port 4100

# Terminal 2: Mock provider (for mock tests)
cd workshop/3fcb5729-e3f6-4337-8f9f-38900c2f85f7 && node mock-oauth-provider.js  # port 3100

# Terminal 3: Run test
OAUTH_PROVIDER=mock OAUTH_BASE_URL=http://127.0.0.1:4100 node test-runner.js
```

### CI Integration
```yaml
- name: Install Playwright
  run: npm ci && npx playwright install chromium --with-deps
- name: Start TokenForge
  run: npm run dev &
- name: Start mock provider
  run: node mock-oauth-provider.js &
- name: Run OAuth tests
  env:
    OAUTH_PROVIDER: mock
    OAUTH_BASE_URL: http://127.0.0.1:4100
  run: node test-runner.js
```

### Artifacts
- `test-result.json` — `{ success: boolean, provider: string, credential: object|null, error: string|null, durationMs: number }`
- Console logs with timestamps for debugging

### Extending for New Providers
1. Add provider config to `PROVIDER_CONFIGS` in `test-runner.js`
2. Implement `handleConsent(page, provider)` for that provider's UI
3. Add provider to `package.json` scripts
4. Test locally, then add to CI matrix

### Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Popup never opens | Selector mismatch | Update `CONNECT_BUTTON_SELECTORS[provider]` |
| Popup opens but hangs | Consent handler missing | Implement `handleConsent` for provider |
| Callback not received | Port/origin mismatch | Verify `OAUTH_BASE_URL` and provider redirect URI |
| Token not stored | TokenForge exchange failed | Check TokenForge logs, verify client secret |
| `ECONNREFUSED` | Server not running | Start TokenForge / mock provider first |

### Related Skills
- `popup-oauth` (withheld) — covers TokenForge popup OAuth implementation patterns
- `security-audit` — can review OAuth flow for PKCE, state, nonce, token storage
