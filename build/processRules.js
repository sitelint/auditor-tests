import fs from 'node:fs';
import path from 'node:path';
import * as pathPosix from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import glob from 'glob-all';
import * as cheerio from 'cheerio';
import prettier from 'prettier';

/**
 * @param {string} argName
 */
function getArgumentValue(argName) {
  const args = process.argv.slice(2);
  const arg = args.find((arg) => arg.startsWith(`--${argName}=`));

  return arg ? arg.split('=')[1] : null;
}

const fileExistsAndHasSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size > 0;
  } catch (err) {
    return false;
  }
};

const formatHTML = async (html) => {
  let formattedHTML = html;

  try {
    const config = await prettier.resolveConfig();

    formattedHTML = await prettier.format(html, { ...config, parser: 'html' });
  } catch (err) {
    console.warn('[build/createNavListOfAllRules.js] Unable to format HTML using prettier', err);
  }

  return formattedHTML;
};

const baseHrefFrom = getArgumentValue('baseHrefFrom');
const baseHrefTo = getArgumentValue('baseHrefTo');
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const globPattern = [
  `${path.join(rootDir, '../tests/rules/**/*.e2e.html')}`,
  `${path.join(rootDir, '../tests/index.html')}`,
];

const files = glob.sync(globPattern);

if (files.length === 0) {
  console.log('[build/createNavListOfAllRules.js] No files found matching the glob pattern:', globPattern);
  process.exit(0);
}

const $ = cheerio.load('<html></html>');
const searchBox = $(`<dialog open id="testsListDialog" class="tests-search-box">
  <search>
    <div class="row mb-3">

      <div class="col-md-12">
        <div class="d-flex align-items-center">
          <label for="searchTestSuites" class="me-2">Search</label>
          <input type="search" id="searchTestSuites" value="" class="form-control flex-grow-1 me-5">
        </div>
      </div>

    </div>
    <form method="dialog">
      <table class="table caption-top">
        <caption class="visually-hidden">Test Suites</caption>
        <thead>
          <tr>
            <th>Standard</th>
            <th>Version</th>
            <th>Title</th>
            <th>Rule ID</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <div class="row">
        <div class="col-md-12 d-flex justify-content-end">
          <button type="submit" class="btn btn-icon btn-close-dialog" data-action="closeDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="border-radius: 3px;">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"></path>
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"></path>
            </svg>
            <span class="visually-hidden">Close Test Suites dialog</span>
          </button>
        </div>
      </div>

    </form>
  </search>

</dialog>`);

const tbody = $('<tbody></tbody>');
const table = searchBox.find('table');

table.append(tbody);

const createMenuListWithAllTests = (files) => {
  for (const file of files) {
    if (fileExistsAndHasSize(file) === false) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);
    const relativePath = `${pathPosix.relative(path.join(rootDir, '../tests'), file)}`;

    const testDetailsElement = $('script#testDetails');
    const testDetails = JSON.parse(testDetailsElement.html());

    const ruleTitle = testDetails.ruleTitle || $('title').text() || path.basename(file);
    const tr = $('<tr></tr>');

    tr.append(`
      <td>${testDetails.standard}</td>
      <td>${testDetails.standardVersion}</td>
      <td><a href="${new URL(relativePath, baseHrefTo).href}">${ruleTitle}</a></td>
      <td><code>${testDetails.ruleId}</code></td>
    `);

    tbody.append(tr);
  }
};

const adjustTestHTML = async (files) => {
  for (const file of files) {
    if (fileExistsAndHasSize(file) === false) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);
    const existingSearchBox = $('#testsListDialog');

    if (existingSearchBox.length > 0) {
      existingSearchBox.replaceWith(searchBox.clone());
    } else {
      const body = $('body');

      if (body.length > 0) {
        body.prepend(searchBox);
      } else {
        console.log('[build/createNavListOfAllRules.js] No <body> tag found in file:', file);
      }
    }

    // Add main app.js <script>

    const existingAppScript = $('#appScript');

    if (existingAppScript.length > 0) {
      existingAppScript.remove();
    }

    const assetPath = pathPosix.relative(path.join(rootDir, '../'), 'assets/scripts/app.js');
    const appJs = $(`<script id="appScript" src="${new URL(assetPath, baseHrefTo).href}"></script>`);
    const head = $('head');

    head.append(appJs);

    // Process <link> elements

    const linkElements = $('link');

    linkElements.each((index, element) => {
      const href = $(element).attr('href');

      if (href) {
        const newHref = href.replace(baseHrefFrom, baseHrefTo);
        $(element).attr('href', newHref);
      }
    });

    const formattedHTML = await formatHTML($.html());

    fs.writeFileSync(file, formattedHTML);
  }
};

createMenuListWithAllTests(files);
adjustTestHTML(files);
