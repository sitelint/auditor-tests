const puppeteer = require('puppeteer');
const fs = require('node:fs');
const childProcess = require('node:child_process');
const path = require('node:path');
const http2 = require('node:http2');
const url = require('node:url');
const glob = require('glob-all');

/**
 * @param {import("http").ServerResponse<import("http").IncomingMessage> & { req: import("http").IncomingMessage; }} res
 * @param {fs.PathOrFileDescriptor} htmlFilePath
 */
function serveHtml(res, htmlFilePath) {
  if (fileExistsAndHasSize(htmlFilePath) === false) {
    res.writeHead(404);
    res.end('File not found');
    return;
  }

  fs.readFile(htmlFilePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading HTML file');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
}

const createSelfSignedCertificate = () => {
  return new Promise((resolve, reject) => {
    childProcess.exec(
      'openssl req -x509 -newkey rsa:2048 -nodes -keyout key.key -out cert.crt -days 365 -subj "/C=US/ST=State/L=Locality/O=Organization/CN=localhost"',
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      }
    );
  });
};

const removeSelfSignedCertificate = () => {
  try {
    fs.unlinkSync('key.key');
    fs.unlinkSync('cert.crt');
    console.log('Self-signed SSL certificate and key removed');
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        'Error removing self-signed SSL certificate and key:',
        error.message
      );
    } else {
      console.error(
        'Error removing self-signed SSL certificate and key:',
        JSON.stringify(error)
      );
    }
  }
};

function fileExistsAndHasSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size > 0;
  } catch (err) {
    return false;
  }
}

const createServer = async () => {
  await createSelfSignedCertificate();

  const options = {
    key: fs.readFileSync('key.key'),
    cert: fs.readFileSync('cert.crt'),
    allowHTTP1: true
  };

  const server = http2.createSecureServer(options, (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const filePath = path.join(__dirname, parsedUrl.pathname.replace(/\/$/, ''));

    if (fs.existsSync(filePath)) {
      if (fs.lstatSync(filePath).isDirectory()) {
        const indexFilePath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexFilePath)) {
          serveHtml(res, indexFilePath);
        } else {
          res.writeHead(404);
          res.end('Index file not found');
        }
      } else {
        const fileExtension = path.extname(filePath);
        let contentType = 'text/plain';

        switch (fileExtension) {
          case '.html':
            contentType = 'text/html';
            break;
          case '.css':
            contentType = 'text/css';
            break;
          case '.js':
            contentType = 'application/javascript';
            break;
          case '.png':
          case '.jpg':
          case '.jpeg':
          case '.gif':
            contentType = `image/${fileExtension.substring(1)}`;
            break;
          default:
            contentType = 'application/octet-stream';
            break;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error loading file');
          } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
          }
        });
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(3000, () => {
    console.log('Server listening on port 3000 with HTTP/2 support');
  });

  return server;
};

(async () => {
  try {
    const server = await createServer();

    const launchOptions = {
      args: ['--ignore-certificate-errors', '--accept-insecure-certs'],
      headless: false,
    };
    const browser = await puppeteer.launch(launchOptions);

    let page;
    const pages = await browser.pages();

    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await browser.newPage();
    }

    const goToOptions = {
      waitUntil: ['networkidle0'],
    };

    const files = glob.sync([
      `${path.resolve(__dirname)}/**/*.e2e.html`,
      `${path.resolve(__dirname)}/*.e2e.html`,
    ]);

    for (const file of files) {
      if (fileExistsAndHasSize(file) === false) {
        continue;
      }

      const relativeFilePath = path.relative(path.join(__dirname, 'tests'), file);

      await page.goto(
        `https://localhost:3000/${relativeFilePath.replace(/\\/g, '/')}`,
        goToOptions
      );

      await page.addScriptTag({ path: './auditor/auditor.bundle.js' });

      const result = await page.evaluate(() => {
        const auditorOptions = {
          includeElementReference: false,
        };

        return auditor
          .config(auditorOptions)
          .run()
          .then((results) => {
            return { success: true, results };
          })
          .catch((err) => {
            return { success: false, error: err.message };
          });
      });

      if (result.success) {
        const failedRules = new Set();

        for (const [ruleId, rule] of Object.entries(result.results.rules)) {
          if (rule.results.length > 0) {
            delete rule.disabilitiesImpacted;
            delete rule.recommendedActions;
            delete rule.resources;
            delete rule.standardMetaData;
            delete rule.status;
            delete rule.title;
            delete rule.totalElementsEvaluated;

            failedRules.add(rule);
          }
        }

        if (failedRules.size > 0) {
          console.table(Array.from(failedRules));
        }

        console.log('Audit completed.');
      } else {
        console.error('Audit error:', result.error);
        console.log('Audit completed with an error.');
      }
    }

   await browser.close();

    server.close(() => {
      removeSelfSignedCertificate();
      console.log('Exiting Node.js process');
      process.exit(0);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('An error occurred:', error.message);
    } else {
      console.error('An error occurred:', JSON.stringify(error));
    }

    removeSelfSignedCertificate();

    process.exit(1);
  }
})();
