# Connect GitHub Sync to CGCC Cafeteria Express

## Goal
Back up the project code to a GitHub repository and enable two-way sync between Lovable and GitHub.

## Current state
The project currently only has Lovable internal storage remotes. No GitHub remote is configured yet.

## Steps

1. **Open the GitHub connect flow**
   - In the Lovable editor, tap the **Plus (+)** button in the chat input area.
   - Choose **GitHub** → **Connect project**.

2. **Authorize GitHub**
   - Authorize the Lovable GitHub App when prompted by GitHub.
   - Select the GitHub account or organization where the repository should live.

3. **Create or choose the repository**
   - Choose **Create Repository** (recommended) so Lovable creates a fresh repo with the current project code.
   - Optionally pick a repository name such as `cgcc-cafeteria-express`.

4. **Wait for the initial sync**
   - Lovable will push the current codebase to the new GitHub repository.
   - This may take a minute for a project of this size.

5. **Verify the connection**
   - Confirm the GitHub remote appears in the project.
   - Make a small test change and confirm it reflects on GitHub (optional).

## Notes
- This is **Git sync**, not the GitHub API connector. It only backs up/collaborates on code, not app data or orders.
- The database, storage files, and live orders remain on Lovable Cloud and are not migrated to GitHub.
- After connecting, future code changes in Lovable will push to GitHub, and GitHub commits will sync back to Lovable.
