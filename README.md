# Agent-OS

This repository is set up to document and automate the StarNet local AI agent stack from the public source repo and its GitHub release assets.

## StarNet source repository

- Repo: https://github.com/androoAGI/starnet
- Releases: https://github.com/androoAGI/starnet/releases
- Latest release homepage: https://github.com/androoAGI/starnet-releases/releases/latest

## Quick install for a Chromebook / browser workflow

Use the following commands in a terminal on your machine to clone the StarNet repo and download the latest release assets, including any Windows EXE binaries that are published in GitHub Releases:

```bash
git clone https://github.com/androoAGI/starnet.git
cd starnet
mkdir -p ../starnet-release-assets

# Download latest GitHub release assets (including .exe, .dmg, .AppImage, etc.)
curl -fsSL https://api.github.com/repos/androoAGI/starnet/releases/latest \
  | python3 -c 'import sys, json; data=json.load(sys.stdin); \
assets = data.get("assets", []); \
for a in assets: print(a["browser_download_url"])' \
  | while IFS= read -r url; do
      [ -n "$url" ] && curl -L --fail --output "../starnet-release-assets/$(basename "$url")" "$url"
    done

ls -l ../starnet-release-assets
```

This keeps the source repo and the bundled release binaries together in a local folder for easy access.

## Notes

- The source code lives in the `starnet` repository.
- Executables are typically published under GitHub Releases rather than committed directly into the main repo tree.
- This repository here does not contain the StarNet binary itself; it contains an automation workflow and reference information for downloading it.

## Recommended PR title

`Add StarNet source and release automation guidance`

## Recommended PR description

This change adds guidance for retrieving the StarNet source repo and the latest GitHub release assets, including executable binaries distributed through the project’s Releases page.
