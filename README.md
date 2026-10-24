# ActionGuard Dashboard

**A web dashboard for scanning GitHub repositories for risky GitHub
Actions workflow usage.**

ActionGuard Dashboard provides a visual interface for reviewing scan
results from the ActionGuard scanner. It is built with a React + Vite
frontend and a Java Spring Boot backend that invokes the Python scanner
against a repository.

> **Project status:** Prototype / development. Run it locally and
> validate findings before relying on results for security decisions.

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#overview)
-   [Features](#features)
-   [How It Works](#how-it-works)
-   [Technology Stack](#technology-stack)
-   [Project Structure](#project-structure)
-   [Prerequisites](#prerequisites)
-   [Getting Started](#getting-started)
-   [Configuration](#configuration)
-   [Scan Output](#scan-output)
-   [Security Notes](#security-notes)
-   [Limitations](#limitations)
-   [Roadmap](#roadmap)
-   [Contributing](#contributing)
-   [License](#license)

## Overview

GitHub Actions workflows can use third-party actions to automate build,
test, and deployment tasks. Referencing an action without pinning it to
a full commit SHA can make a workflow less reproducible and may increase
supply-chain risk. An action that is known to be compromised is an even
more serious concern.

ActionGuard Dashboard gives users a convenient way to submit a GitHub
repository URL and inspect findings returned by the ActionGuard scanner,
including the workflow file, line, action, severity, status, and
explanatory message where available.

## Features

-   **Repository scanning:** Submit a GitHub repository URL through the
    dashboard.
-   **Workflow-focused analysis:** Review findings related to `uses:`
    references in GitHub Actions workflow files.
-   **Severity-aware results:** Display findings classified by the
    scanner, such as `INFO`, `MEDIUM`, `HIGH`, and `CRITICAL`.
-   **Finding details:** Inspect the workflow path, line number, action
    reference, status, and message when provided by the scanner.
-   **Compromised-action checks:** The scanner uses a local
    `known_compromised.json` reference file to identify listed
    compromised actions.
-   **JSON-based integration:** The Python scanner emits a structured
    JSON report for the backend and frontend to consume.

The exact findings and classifications depend on the scanner version and
its reference data.

## How It Works

1.  A user submits a GitHub repository URL in the React dashboard.
2.  The Spring Boot backend validates the URL and creates a temporary
    shallow clone of the repository.
3.  The backend invokes the Python ActionGuard CLI against the cloned
    repository.
4.  The scanner inspects GitHub Actions workflow files and produces a
    JSON report.
5.  The backend returns the report and the dashboard displays the
    summary and findings.
6.  The backend removes the temporary clone after processing.

**High-level architecture**

``` text
User
 │
 ▼
React + Vite Dashboard
 │  HTTP request
 ▼
Spring Boot Backend
 │
 ├── Validate GitHub repository URL
 ├── Clone repository to a temporary directory
 └── Run Python ActionGuard CLI
             │
             ▼
     Workflow Scanner
             │
             ├── Inspect workflow `uses:` references
             ├── Check reference data
             └── Produce JSON findings
             │
             ▼
Spring Boot returns scan report
             │
             ▼
Dashboard displays results
```

## Technology Stack

  Layer               Technology
  ------------------- ------------------------------
  Frontend            React, Vite, JavaScript, CSS
  Backend             Java, Spring Boot, Maven
  Scanner             Python
  Repository access   Git
  Report format       JSON

## Project Structure

``` text
action-guard-dashboard/
├── backend/
│   ├── src/
│   │   └── main/
│   │       ├── java/              # Spring Boot application and scan API
│   │       └── resources/
│   ├── pom.xml
│   └── mvnw / mvnw.cmd
├── frontend/
│   ├── src/                       # React UI and styles
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

The Python scanner is maintained in a separate repository. The backend
is currently configured to locate that scanner on the developer's
machine; see [Configuration](#configuration).

## Prerequisites

Install the following before running the project:

-   **Git**
-   **Python 3.13** (or the version supported by your scanner)
-   **Java JDK** compatible with the Spring Boot version in
    `backend/pom.xml`
-   **Node.js and npm**
-   Internet access to clone the repository being scanned

You will also need a local checkout of the ActionGuard Python scanner,
including its `actionguard` Python package and CLI.

## Getting Started

Run the frontend and backend in separate terminals.

### 1. Start the backend

Open a terminal in the project root, then:

``` powershell
cd backend
.\mvnw.cmd spring-boot:run
```

The current local configuration uses **port `8081`**. Keep this terminal
running.

If the Maven wrapper cannot run, verify that Java is installed and that
`JAVA_HOME` is configured correctly.

### 2. Start the frontend

Open a second terminal:

``` powershell
cd frontend
npm install
npm run dev
```

Vite prints the local development URL in the terminal. In the current
setup, it is:

``` text
http://localhost:5173
```

Open that URL in your browser.

### 3. Run a scan

1.  Start both the backend and frontend.
2.  Enter a public GitHub repository URL supported by the dashboard.
3.  Submit the scan.
4.  Review the scan summary and individual findings.

A scan may take some time because the backend clones the target
repository and runs the Python scanner.

## Configuration

### Scanner location and Python executable

The backend currently uses local Windows paths in `ScanController.java`
for:

-   The directory containing the Python scanner repository.
-   The Python executable used to launch the scanner.

These paths must exist on the machine running the backend. If you clone
this dashboard elsewhere, update the corresponding configuration in
`ScanController.java` before running scans.

For a more portable setup, move these values into environment variables
or Spring configuration and document the scanner checkout as a separate
dependency.

### Ports

The current local setup uses:

-   Frontend (Vite): `5173`
-   Backend (Spring Boot): `8081`

If either port changes, make sure the frontend's API configuration and
the backend configuration remain consistent.

### Scanner reference data

The scanner repository contains `known_compromised.json`, a local
reference list used by the scanner. Updating that data should be done
through the scanner project's own review and testing process.

## Scan Output

The scanner's JSON report includes a root path, a summary, and a list of
findings. Individual findings may include fields such as:

  Field        Meaning
  ------------ ----------------------------------------------------
  `file`       Workflow file containing the reference
  `line`       Line number reported by the scanner
  `action`     GitHub Action reference being examined
  `status`     Scanner classification, such as pinned or unpinned
  `severity`   Severity assigned by the scanner
  `message`    Explanation of the finding

The available fields depend on the scanner output. A finding is a signal
for review, not proof on its own that a repository is exploitable or
safe.

## GitHub Actions CI

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`. It runs when code is pushed to `main` or `master`, and when a pull request targets either branch.

The workflow currently:
- Installs Node.js and runs `npm ci` plus `npm run build` for the frontend.
- Installs Java and runs the backend Maven test phase.

The workflow checks that the frontend builds and that backend tests pass. It does **not** scan the submitted target repository, and it does not replace a dedicated security review. If your project uses a different Java version or branch name, update the workflow to match your configuration.

## Security Notes

-   Only scan repositories you are authorized to assess.
-   Treat findings as security guidance that requires review; do not
    interpret a clean report as a guarantee that a repository is secure.
-   The backend clones submitted repositories and executes the scanner
    locally. Keep the scanner invocation constrained to the intended
    CLI, and do not execute scripts from the scanned repository.
-   Use temporary directories with appropriate permissions and ensure
    they are cleaned up after a scan.
-   Avoid logging access tokens, credentials, or other secrets.
-   Before deploying this prototype for shared or public use, add
    appropriate request limits, timeouts, cleanup safeguards, URL/host
    validation, error handling, and operational monitoring.
-   The current scanner and backend configuration is intended for local
    development, not as a hardened multi-user production service.

## Limitations

-   The scanner currently focuses on GitHub Actions workflow references
    and the checks implemented in the separate Python scanner.
-   Results depend on the scanner's rules and `known_compromised.json`
    data.
-   The backend currently relies on machine-specific local paths to the
    scanner and Python executable.
-   Persistent scan history and a database are not currently part of the
    described setup.
-   The dashboard should be tested with representative repositories
    before being used in a production security workflow.

## Roadmap

Potential next steps:

-   [ ] Move local scanner and Python paths into environment-based
    configuration.
-   [ ] Improve backend error reporting for clone failures, scanner
    failures, and invalid JSON.
-   [ ] Add request timeouts, resource limits, and more robust
    temporary-directory cleanup.
-   [ ] Add scan history and persistence if the project requires it.
-   [ ] Add automated frontend and backend tests for the main scan flow.
-   [ ] Add screenshots or a short demo GIF to illustrate the dashboard.
-   [ ] Add deployment instructions once a deployment target is
    selected.

## Contributing

Contributions and suggestions are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Make a focused change.
4.  Run the available checks and test the scan flow locally.
5.  Open a pull request describing the change and how it was tested.

For scanner rule changes, update and test the separate scanner project
rather than duplicating scanner logic in the dashboard.


