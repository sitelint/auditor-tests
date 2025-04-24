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
const nav = $('<nav aria-label="Tests" id="testsNavigation" class="tests-navigation"><details><summary>Tests</summary></details></nav>');
const ol = $('<ol></ol>');
const details = nav.find('details');

details.append(ol);

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
    const title = `${testDetails.standard} - ${ruleTitle} - ${testDetails.standardVersion}`;

    const li = $('<li></li>');
    const a = $(`<a href="${new URL(relativePath, baseHrefTo).href}"><span>${title}</span> <small><code>${testDetails.ruleId}</code></small></a>`);

    li.append(a);
    ol.append(li);
  }
};

const adjustTestHTML = async (files) => {
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
