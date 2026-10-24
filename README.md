# ActionGuard Dashboard
 
A web dashboard that scans GitHub repositories for risky GitHub Actions usage, built as a DevOps course project and delivered through a full CI/CD pipeline covering all **7 C's of DevOps**.
 
> Inspired by the March 2025 `tj-actions/changed-files` supply-chain attack (CVE-2025-30066), where a trusted GitHub Action was compromised and its version tag was moved to malicious code. Workflows that referenced the action by tag silently started running it.
 
---
 
## Table of Contents
 
1. [Overview](#overview)
2. [Background: the problem we are addressing](#background-the-problem-we-are-addressing)
3. [Features](#features)
4. [How it works](#how-it-works)
5. [Tech stack](#tech-stack)
6. [Related repositories](#related-repositories)
7. [Project structure](#project-structure)
8. [Getting started](#getting-started)
9. [Configuration](#configuration)
10. [Scan output](#scan-output)
11. [DevOps implementation: the 7 C's](#devops-implementation-the-7-cs)
12. [CI/CD pipeline (Jenkins)](#cicd-pipeline-jenkins)
13. [Security notes](#security-notes)
14. [Limitations](#limitations)
15. [Roadmap](#roadmap)
16. [Team](#team)
---
 
## Overview
 
GitHub Actions workflows often use third-party actions to build, test and deploy code. If a workflow references an action by a mutable **tag** (for example `@v1`) instead of a full 40-character **commit SHA**, whoever controls that tag can change the code the workflow runs without the workflow file changing at all. If the action is also on a known-compromised list, the risk is much higher.
 
ActionGuard Dashboard lets a user paste a GitHub repository URL and see, in one place, every `uses:` reference in that repository's workflows, whether it is pinned, and how risky it is.
 
The project is made of three repositories:
 
| Repository | Role |
|---|---|
| **actionguard** | The scanner (Python CLI). Reads workflow files and produces a JSON report |
| **actionguard-demo** | The test subject. A fake trusted action, a vulnerable workflow (tag reference) and a fixed workflow (SHA reference), plus scripts that recreate the tag-move attack safely with fake secrets |
| **actionguard-dashboard** (this repo) | Spring Boot backend + React frontend that runs the scanner and displays results |
 
---
 
## Background: the problem we are addressing
 
A GitHub Action is reusable code that a workflow calls with `uses: owner/repo@ref`. The `ref` can be:
 
- a **tag or branch** (`@v1`, `@main`): can be moved to point at different code later
- a **commit SHA** (`@a1b2c3...`, 40 characters): always the same exact code
In the real incident, an attacker moved the tags of a popular action to a malicious commit. Every workflow using those tags ran the malicious code inside its CI runner, where it could read environment variables and secrets. The `actionguard-demo` repository recreates this mechanism safely using a fake action and fake secrets, and shows that pinning to a SHA blocks it.
 
This dashboard is the detection side: it finds the risky references before an attacker can use them.
 
---
 
## Features
 
- **Repository scanning**: submit a GitHub repository URL from the dashboard
- **Workflow analysis**: finds every `uses:` reference in `.github/workflows/`
- **Pinning check**: flags references that are not pinned to a full commit SHA
- **Compromised-action check**: compares references against a known-compromised list (`known_compromised.json`), including `tj-actions/changed-files`
- **Severity levels**: INFO, MEDIUM, HIGH, CRITICAL
- **Finding details**: workflow file, line number, action reference, status and an explanation
- **Automated delivery**: every push is built, tested, security-scanned, containerised and deployed by Jenkins
- **Built-in monitoring and feedback**: health endpoint, uptime dashboard and failure notifications
---
 
## How it works
 
1. The user submits a GitHub repository URL in the React dashboard.
2. The Spring Boot backend validates the URL and makes a temporary shallow clone.
3. The backend runs the Python ActionGuard CLI against the clone.
4. The scanner inspects the workflow files and writes a JSON report.
5. The backend returns the report to the dashboard.
6. The backend deletes the temporary clone.
```
User
 │
 ▼
React + Vite dashboard
 │  HTTP
 ▼
Spring Boot backend
 ├── validate GitHub URL
 ├── shallow-clone repo to a temp directory
 └── run Python ActionGuard CLI
          │
          ▼
   Workflow scanner
    ├── parse `uses:` references
    ├── check pinned vs unpinned
    ├── check known_compromised.json
    └── output JSON report
          │
          ▼
Backend returns report ──► Dashboard shows summary + findings
```
 
---
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Java, Spring Boot, Maven |
| Scanner | Python (separate repository) |
| Version control | Git, GitHub |
| CI/CD | Jenkins |
| Testing | JUnit, MockMvc |
| Security scanning | Trivy |
| Containers | Docker, docker-compose |
| Monitoring | Spring Boot Actuator, Uptime Kuma |
| Feedback | Jenkins notifications, GitHub Issues |
 
---
 
## Related repositories
 
- **actionguard**: the Python scanner this dashboard calls
- **actionguard-demo**: vulnerable vs fixed workflows and the attack replay scripts, used as the scanner's reference test case (the vulnerable workflow should be flagged, the fixed one should pass)
---
 
## Project structure
 
```
actionguard-dashboard/
├── backend/
│   ├── src/main/java/          # Spring Boot app and scan API
│   ├── src/main/resources/
│   ├── src/test/java/          # JUnit and MockMvc tests
│   ├── pom.xml
│   └── Dockerfile
├── frontend/
│   ├── src/                    # React UI
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── monitoring/                 # Uptime Kuma setup notes/config
├── docker-compose.yml
├── Jenkinsfile
├── .github/workflows/ci.yml    # lightweight CI check on pull requests
└── README.md
```
 
---
 
## Getting started
 
### Prerequisites
 
- Git
- Java JDK (version matching `backend/pom.xml`)
- Node.js and npm
- Python 3 and a local checkout of the **actionguard** scanner
- Docker and docker-compose (for the containerised setup)
### Option 1: run locally
 
**Backend**
 
```bash
cd backend
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
```
 
Runs on port `8081`.
 
**Frontend**
 
```bash
cd frontend
npm install
npm run dev
```
 
Open `http://localhost:5173`.
 
### Option 2: run with Docker
 
```bash
docker-compose up -d --build
```
 
| Service | URL |
|---|---|
| Dashboard | `http://localhost:5173` |
| Backend API | `http://localhost:8081` |
| Health check | `http://localhost:8081/actuator/health` |
| Uptime Kuma | `http://localhost:3001` |
 
### Run a scan
 
1. Open the dashboard.
2. Enter a public GitHub repository URL.
3. Submit and review the summary and findings.
Scans take a little while because the repository is cloned and scanned on demand.
 
---
 
## Configuration
 
Machine-specific values are read from environment variables so the same code runs locally, in Docker and under Jenkins.
 
| Variable | Purpose |
|---|---|
| `SCANNER_DIR` | Path to the ActionGuard scanner checkout |
| `PYTHON_EXECUTABLE` | Python executable used to launch the scanner |
| `SERVER_PORT` | Backend port (default `8081`) |
 
Secrets (Docker Hub credentials, notification webhooks) are never stored in the repository. They live in the Jenkins credentials store.
 
---
 
## Scan output
 
The scanner returns JSON with a root path, a summary and a list of findings.
 
```json
{
  "root": "cloned-repo",
  "summary": { "total": 2, "high": 1, "critical": 0, "pinned": 1 },
  "findings": [
    {
      "file": ".github/workflows/vulnerable-demo.yml",
      "line": 14,
      "action": "./fake-action@v1",
      "status": "unpinned",
      "severity": "HIGH",
      "message": "Action is referenced by a mutable tag instead of a full commit SHA."
    }
  ]
}
```
 
| Field | Meaning |
|---|---|
| `file` | Workflow file containing the reference |
| `line` | Line number of the reference |
| `action` | The action reference being examined |
| `status` | Scanner classification (for example `pinned`, `unpinned`) |
| `severity` | INFO, MEDIUM, HIGH or CRITICAL |
| `message` | Explanation of the finding |
 
A finding is a signal to review, not proof that a repository is exploitable. A clean report is not a guarantee of safety.
 
---
 
## DevOps implementation: the 7 C's
 
All seven are applied to this repository.
 
| C | Tools | How it is implemented |
|---|---|---|
| **Continuous Development** | Git, GitHub | Feature branches, pull requests into `main`, small commits with meaningful messages |
| **Continuous Integration** | Jenkins, Maven, npm | A GitHub webhook triggers Jenkins on every push. Jenkins checks out the code and builds the backend and frontend |
| **Continuous Testing** | JUnit, MockMvc, Trivy | Unit tests, API tests, and Trivy scans of the source tree and the Docker image. The build fails on HIGH or CRITICAL findings |
| **Continuous Deployment** | Docker, docker-compose, Jenkins | Jenkins builds the Docker images and deploys with docker-compose automatically after tests pass |
| **Continuous Monitoring** | Spring Boot Actuator, Uptime Kuma | Actuator exposes health and metrics. Uptime Kuma checks the health endpoint and shows uptime history |
| **Continuous Feedback** | Jenkins notifications, GitHub Issues | Failed builds send an alert. Bugs and suggestions are tracked as GitHub Issues |
| **Continuous Operations** | Docker | Restart policy for crash recovery, versioned image tags per build, and rollback to a previous tag |
 
### 1. Continuous Development
Work happens on feature branches and is merged through pull requests. Commits are small and descriptive so the Git history documents how the project was built.
 
### 2. Continuous Integration
Jenkins is connected to GitHub with a webhook. Each push starts the pipeline, which builds the Spring Boot backend with Maven and the React frontend with npm. A broken build stops the pipeline immediately.
 
### 3. Continuous Testing
- **JUnit** covers backend logic such as URL validation and report parsing.
- **MockMvc** tests the REST endpoints without starting a full server.
- **Trivy** scans for known vulnerabilities in two places: project dependencies (`trivy fs`) and the built Docker image (`trivy image`). The pipeline fails on HIGH or CRITICAL results. This matters for a supply-chain security project because it checks our own supply chain too.
### 4. Continuous Deployment
After tests and scans pass, Jenkins builds the images and runs `docker-compose up -d`. Nobody deploys by hand.
 
### 5. Continuous Monitoring
- **Spring Boot Actuator** exposes `/actuator/health` and `/actuator/metrics`.
- **Uptime Kuma** (runs as a container) pings the health endpoint on a schedule and shows a status page with uptime history.
### 6. Continuous Feedback
- Jenkins sends a notification when a build fails, using the `post { failure { ... } }` block of the Jenkinsfile.
- GitHub Issues track bugs and improvement ideas, and issues are closed by commits that reference them.
### 7. Continuous Operations
- `restart: always` in docker-compose brings containers back after a crash.
- Images are tagged with the Jenkins build number (for example `actionguard-backend:42`), not only `latest`.
- **Rollback:** if a deployment misbehaves, redeploy the previous tagged image.
---
 
## CI/CD pipeline (Jenkins)
 
Pipeline stages, in order:
 
```
Checkout
   ↓
Build (Maven + npm)
   ↓
Unit and API tests (JUnit, MockMvc)
   ↓
Trivy filesystem scan
   ↓
Docker build (tagged with build number)
   ↓
Trivy image scan
   ↓
Deploy (docker-compose)
   ↓
Post: notify on failure
```
 
Credentials such as the Docker Hub login and notification webhook are stored in the Jenkins credentials store and read with `withCredentials`. They are never hardcoded.
 
The repository also has a small GitHub Actions workflow (`.github/workflows/ci.yml`) that builds the frontend and runs backend tests on pull requests as a quick check. Third-party actions in it are pinned to full commit SHAs, following the practice this project exists to promote.
 
---
 
## Security notes
 
- Only scan repositories you are authorised to assess.
- The backend clones submitted repositories and runs the scanner locally. The scanner never executes scripts from the scanned repository.
- Temporary directories are deleted after each scan.
- Tokens, credentials and secrets are not logged and not committed.
- The demo repository uses only fake secrets and repositories owned by the team.
- This is a prototype. Before any shared or public deployment, add request limits, timeouts, stricter URL validation and operational hardening.
---
 
## Limitations
 
- The scanner focuses on `uses:` references in GitHub Actions workflows and the rules implemented in the separate Python scanner.
- Results depend on those rules and on `known_compromised.json`.
- Scans run on demand, and scan history is not persisted yet.
- Test on representative repositories before using results for security decisions.
---
 
## Roadmap
 
- [ ] Persist scan history in a database
- [ ] Attack replay screen (normal, compromised, detected, fixed) fed by captured data from `actionguard-demo`
- [ ] Prometheus and Grafana dashboards on top of Actuator metrics
- [ ] Better error reporting for clone failures and scanner failures
