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
const searchBox = $(`<div id="commonBar" class="container common-bar mb-5">
  <div class="row mb-3">

    <div class="col-md-12">
      <div class="d-flex align-items-center">
        <label for="searchTestSuites" class="me-2">Search</label>
        <input type="search" id="searchTestSuites" value="" class="form-control flex-grow-1">
      </div>
    </div>

  </div>

  <details>
    <summary>Test suites</summary>

    <section class="common-panel__section">

      <search>
          <table class="table caption-top">
            <caption class="visually-hidden">Test Suites</caption>
            <thead>
              <tr>
                <th>Title</th>
                <th>Rule ID</th>
                <th>Standard</th>
                <th>Version</th>
                <th>Level</th>
                <th>Success Criteria</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
      </search>

    </section>

  </details>
</div>`);

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
      <td><a href="${new URL(relativePath, baseHrefTo).href}">${ruleTitle}</a></td>
      <td><code>${testDetails.ruleId}</code></td>
      <td>${testDetails.standard}</td>
      <td>${testDetails.standardVersion}</td>
      <td>${testDetails.standardLevel}</td>
      <td>${testDetails.standardSuccessCriteria}</td>
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
    const existingSearchBox = $('#commonBar');

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
