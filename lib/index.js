const github = require('@actions/github');
const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;

const { createBranch, clone, push } = require('./git');
const { getReposList, createPr } = require('./api-calls');
const { getListModifiedFiles, copyChangedFiles } = require('./utils');

const eventPayload = require(process.env.GITHUB_EVENT_PATH);

async function run() {
  if (process.env.GITHUB_EVENT_NAME !== 'push') return core.setFailed('This GitHub Action works only when triggered by "push" webhook.');

  const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });
  const committerUsername = core.getInput('committer_username');
  const committerEmail = core.getInput('committer_email');
  const commitMessage = core.getInput('commit_message');

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const octokit = github.getOctokit(gitHubKey);
  //TODO for now this action is hardcoded to always get commit id of the first commit on the list
  const commitId = eventPayload.commits[0].id;
  const ignoredRepositories = [repo];

  try {
    core.info(`Getting list of modified workflow files from ${commitId} located in ${owner}/${repo}.`);
    const modifiedFiles = await getListModifiedFiles(octokit, commitId, owner, repo);

    if (!modifiedFiles.length) 
      return core.info('No changes to workflows were detected.');

    core.info(`Getting list of repositories owned by ${owner} that will get updates.`);
    const reposList = await getReposList(octokit, owner);

    for (const {url, name, id, defaultBranchRef: { name: defaultBranch }} of reposList) {
      if (ignoredRepositories.includes(name)) return;

      core.startGroup(`Started updating ${name} repo`);
      const dir = path.join(process.cwd(), './clones', name);
      await mkdir(dir, {recursive: true});

      const branchName = `bot/update-global-workflow-${commitId}`;
      const git = simpleGit({baseDir: dir});

      core.info(`Clonning ${name}.`);
      await clone(url, dir, git);
      core.info(`Creating branch ${branchName}.`);
      await createBranch(branchName, git);
      core.info('Copying files...');
      await copyChangedFiles(modifiedFiles, dir);
      core.info('Pushing changes to remote');
      await push(gitHubKey, url, branchName, commitMessage, committerUsername, committerEmail, git);

      const pullRequestUrl = await createPr(octokit, branchName, id, commitMessage, defaultBranch);
      core.endGroup();
      core.info(`Workflow finished with success and PR for ${name} is created -> ${pullRequestUrl}`);
    }
  } catch (error) {
    core.setFailed(`Action failed because of${ error}`);
  }
}

run();
