import fs from 'node:fs';
import path from 'node:path';
import * as pathPosix from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import glob from 'glob-all';
import * as cheerio from 'cheerio';
import prettier from 'prettier';

function fileExistsAndHasSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size > 0;
  } catch (err) {
    return false;
  }
}

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

const projectGitHubId = 'auditor-tests';
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
const nav = $('<nav aria-label="Tests" id="testsNavigation" class="tests-navigation"><details><summary>Tests</summary></details></nav>');
const ul = $('<ul></ul>');
const details = nav.find('details');

details.append(ul);

for (const file of files) {
  if (fileExistsAndHasSize(file) === false) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(content);
  const relativePath = `/${projectGitHubId}/${pathPosix.relative(path.join(rootDir, '../'), file)}`;

  const title = $('title').text() || path.basename(file);
  const li = $('<li></li>');
  const a = $(`<a href="${relativePath}">${title}</a>`);

  li.append(a);
  ul.append(li);
}

for (const file of files) {
  if (fileExistsAndHasSize(file) === false) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(content);
  const existingNav = $('#testsNavigation');

  if (existingNav.length > 0) {
    existingNav.replaceWith(nav.clone());
  } else {
    const newHeader = $('<header></header>');

    newHeader.append(nav.clone());

    const body = $('body');

    if (body.length > 0) {
      body.prepend(newHeader);
    } else {
      console.log('[build/createNavListOfAllRules.js] No <body> tag found in file:', file);
    }
  }

  const existingAppScript = $('#appScript');

  if (existingAppScript.length === 0) {
    const appJs = $(`<script id="appScript" src="/${projectGitHubId}/${pathPosix.relative(path.join(rootDir, '../'), 'tests/assets/scripts/app.js')}"></script>`);
    const head = $('head');

    head.append(appJs);
  }

  const formattedHTML = await formatHTML($.html());

  fs.writeFileSync(file, formattedHTML);
}
