import { execSync } from 'node:child_process';
import inquirer from 'inquirer';

const getCommitMessage = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Enter a commit message:',
    }
  ]);

  return answers.message;
};

const deployToGitHub = () => {
  const message = getCommitMessage();

  execSync('git add .');
  execSync(`git commit -m "${message}"`);
  execSync('git push origin main');

  console.log('Changes deployed to GitHub');
};

deployToGitHub();
