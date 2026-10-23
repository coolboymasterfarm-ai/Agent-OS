---
name: "Fix Build Script Error"
description: "This skill covers the steps to fix the build script error when updating TokenForge."
category: "Development"
state: "active"
created_by: "background-review"
source_run_id: "4dcb43b1-3bb7-4a90-9a8a-637c424fd634_skill_review"
pinned: false
platforms: ["Windows"]
---

## Setup
Ensure you have the latest version of the build script.

1. Identify the error: Check the log file for the detailed error message. 2. Update the build script: Modify build.ps1 to throw an error if the copy operation fails. 3. Verify the changes: Run the build script again to ensure the error is fixed. 4. Kill the side instance: Stop any running instances of TokenForge to allow the build script to complete successfully.
