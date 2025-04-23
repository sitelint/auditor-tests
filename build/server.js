import * as fs from 'node:fs';
import * as path from 'node:path';
import { createSecureServer } from 'node:http2';
import { exec } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(import.meta.url);
let server;

const fileExistsAndHasSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size > 0;
  } catch (err) {
    return false;
  }
};

const createSelfSignedCertificate = () => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync('cert.crt') && fs.existsSync('key.key')) {
      try {
        exec('openssl x509 -in cert.crt -checkend 0', (error, stdout, stderr) => {
          if (error) {
            console.log('[build/server] Certificate is invalid or expired, creating a new one...');
            exec('mkcert -key-file key.key -cert-file cert.crt localhost 127.0.0.1', (error) => {
              if (error) {
                reject(error);
              } else {
                resolve(true);
              }
            });
          } else {
            console.log('[build/server] Certificate already exists and is valid, skipping creation...');
            resolve(true);
          }
        });
      } catch (error) {
        console.error('[build/server] Error checking certificate files:', error);
      }
    } else {
      exec('mkcert -key-file key.key -cert-file cert.crt localhost', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    }
  });
};

const onServerShutDown = () => {
  console.log('[build/server] Server shutting down...');

  server.close((err) => {
    if (err) {
      console.error('[build/server] Error closing server:', err);
    }

    console.log('[build/server] Server closed');
    process.exit(0);
  });

  globalThis.setTimeout(() => {
    console.log('[build/server] Forcing process exit...');
    process.exit(0);
  }, 250);
};

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

const createServer = async () => {
  await createSelfSignedCertificate();

  const options = {
    key: fs.readFileSync('key.key', 'utf8'),
    cert: fs.readFileSync('cert.crt', 'utf8'),
    allowHTTP1: true
  };

  const server = createSecureServer(options, (req, res) => {
    const serverAddress = server.address();
    const parsedUrl = new URL(req.url, `https://localhost:${serverAddress.port}`);
    const filePath = path.join(__dirname, '../../tests', parsedUrl.pathname.replace(/\/$/, ''));

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

  return server;
};

try {
  server = await createServer();

  server.listen(3000, () => {
    console.log('Server listening on port 3000 with HTTP/2 support');
  });

  process.on('SIGINT', onServerShutDown);
  process.on('SIGTERM', onServerShutDown);
} catch (error) {
  if (error instanceof Error) {
    console.error('[build/server] An error occurred:', error.message);
  } else {
    console.error('[build/server] An error occurred:', JSON.stringify(error));
  }

  removeSelfSignedCertificate();

  process.exit(1);
}
