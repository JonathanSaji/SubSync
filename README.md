# Git Feature Branch Workflow

> **Rule #1:** Never commit directly to `main`. Always create a feature branch first.

---

## Why Use Feature Branches?

- Keeps `main` stable and deployable at all times
- Lets multiple people work on different features simultaneously
- Makes code reviews easier via pull requests
- Easy to discard a bad idea without affecting the rest of the codebase

---

## How to Create a Feature Branch

### 1. Make sure you're on `main` and up to date

```bash
git checkout main
git pull origin main
```

### 2. Create and switch to a new feature branch

```bash
git checkout -b feature/your-feature-name
```

Or using the newer syntax:

```bash
git switch -c feature/your-feature-name
```

### 3. Do your work and commit to the branch

```bash
# Make your changes, then:
git add .
git commit -m "feat: describe what you did"
```

### 4. Push your branch to remote

```bash
git push origin feature/your-feature-name
```

### 5. Open a Pull Request (PR)

Go to GitHub/GitLab and open a PR from your feature branch into `main`. Get it reviewed, then merge.

### 6. Clean up after merging

```bash
# Switch back to main
git checkout main
git pull origin main

# Delete the local branch
git branch -d feature/your-feature-name

# Delete the remote branch
git push origin --delete feature/your-feature-name
```

---

## Branch Naming Conventions

| Type       | Example                        |
|------------|--------------------------------|
| Feature    | `feature/user-authentication`  |
| Bug fix    | `fix/login-crash`              |
| Hotfix     | `hotfix/payment-null-error`    |
| Chore      | `chore/update-dependencies`    |
| Release    | `release/v1.2.0`               |

---

## Quick Reference Cheat Sheet

```bash
# Create branch
git checkout -b feature/my-feature

# Check which branch you're on
git branch

# Switch between branches
git checkout branch-name

# See all branches (local + remote)
git branch -a

# Merge main into your branch (to stay up to date)
git merge main
```

---

## Good Commit Message Format

```
type: short description (50 chars max)

Optional longer explanation if needed.
```

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`

**Examples:**
- `feat: add login with Google OAuth`
- `fix: resolve null pointer on checkout`
- `docs: update README with setup instructions`
