# Setup B: GitHub CI and Release (TokenForge)

Set up GitHub Actions for TokenForge. Don't merge anything. Open one
pull request for me to review.

Repo: github.com/coolboymasterfarm-ai/tokenforge, branch main
Local copy: C:\Users\bryce\Downloads\tokenforge\TokenForge

What I want, in this order:
1. One test command. Today each file in test/ runs alone
   (node test/router.test.js) and savings.test.js sits outside test/.
   Add tools/test-all.mjs that runs every *.test.js in test/ one by one,
   prints PASS or FAIL per file, and exits 1 if any fail. Move
   savings.test.js into test/ only if it passes there.
2. .github/workflows/ci.yml: on every push and pull request, on
   windows-latest with Node 20, run the test command. A failing test
   fails the check.
3. .github/workflows/release.yml: when I push a tag like v1.2.0, build
   with build.ps1 on windows-latest, run the tests, and create a GitHub
   Release with TokenForge.exe and a SHA256 checksum file attached. The
   release notes come from that version's section of CHANGELOG.md, or the
   commits since the last tag if there isn't one.
4. Add a "Download" section to README.md that links to the latest
   release.

Rules:
- Least permissions: ci.yml gets contents: read; only release.yml gets
  contents: write. No other secrets or tokens.
- Never put an API key, my TokenForge key or anything from
  %APPDATA%\TokenForge in the repo, a workflow or a log. Tests must use
  mock providers, like test/router.test.js already does.
- Don't change src/ or the app's behavior. Build and test files only.
- If a test fails on Windows CI but passes on my PC, stop and show me
  the exact error. Don't skip or delete the test.
- Tell me if the repo is public or private, and what that means for
  who can download the .exe.

Not done until verified: CI is green on your pull request (paste the
link), and a test tag (v0.0.0-test) produced a Release whose .exe
checksum matches the file. Then delete only that test tag and release,
and tell me you did.
