import shelljs from 'shelljs';
import { watch } from 'chokidar';
import ansiColors from 'ansi-colors';

const { exit, exec } = shelljs;
const { bgGreen, bgRed, bgYellow } = ansiColors;

const EXIT_UNCAUGHT_FATAL_EXCEPTION = 1;
const EXIT_SUCCESS = 0;
const args = process.argv.slice(2);
const commandIndex = args.indexOf('-c');
let files;
let command;

function resultCallback(code) {
  if (code === EXIT_SUCCESS) {
    console.log(bgGreen.black('[watchChanges] Done'));

    return;
  }

  console.error(`\n${bgRed.white('[watchChanges] resultCallback. Code error: ')}`, code);
}

function onWatchError(err) {
  console.error(`${bgRed.white('[watchChanges]')} onWatchError, error`, code);
}

function onSIGINT() {
  console.log(`\n${bgGreen.black('[watchChanges]')} Exiting`);
  exit(EXIT_SUCCESS);
}

if (commandIndex === -1) {
  console.log(`${bgYellow.black('[watchChanges]')} Command to execute was not provided`);
  exit(EXIT_UNCAUGHT_FATAL_EXCEPTION);
} else {
  files = args.slice(0, commandIndex);
  command = args.slice(commandIndex + 1).join(' ');
}

const watcher = watch(files, {
  awaitWriteFinish: true,
  ignoreInitial: true,
  persistent: true,
  recursive: true
});

console.log(`${bgGreen.black('[watchChanges]')} Start`, files);

watcher.on('change', (path) => {
  console.log(`[watchChanges] Files changed: ${path}`);
  exec(command, resultCallback);
});

watcher.on('error', onWatchError);
process.on('SIGINT', onSIGINT);
