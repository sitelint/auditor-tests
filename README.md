# SiteLint Auditor test cases for rules

This repository contains test cases used for testing:

* SiteLint Auditor rules
* Other specific cases non-related directly to the SiteLint Auditor rules

## Prerequisites

This should work on macOS, Windows and Linux.

## Setting up environment

1. Install Node.JS from <https://nodejs.org/en/download>. This should also include NPM.
2. Create a folder and pull this repository.
3. Run command `npm install`.

At this point all npm packages should be installed.

## Run all tests through the Chrome headless browser

To run all tests at once using Chrome headless browser use the following command:

`npm run tests:run`

## Local web server

To run tests using local web server run the following commands:

1. `npm run build:localhost`
2. `npm run server:localhost`
3. Then go to the browser and use <https://localhost:3000>.

## GitHub Pages

Once the code is pushed and merged to the `main` branch then all changes are deployed using GitHub Pages. The tests areavailable under the following URL:

<https://sitelint.github.io/auditor-tests/>
