const github = require('@actions/github');
const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;
const { copy } = require('fs-extra');

const { createBranch, clone, push } = require('./utils');
const { getReposList, createPr, getCommit } = require('./api-calls');

const eventPayload = require(process.env.GITHUB_EVENT_PATH || '../test/fake-event.json');

async function run() {
  const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const octokit = github.getOctokit(gitHubKey);
  const commitId = eventPayload.commits[0].id;
  const ignoredRepositories = [repo];

  const commitFiles = await getCommit(octokit, commitId, owner, repo);
  const changedFilename = commitFiles[0].filename;

  if (!changedFilename.includes('.github/workflows')) return;

  const reposList = await getReposList(octokit, owner);

  for (const {url, name, id} of reposList) {
    if (ignoredRepositories.includes(name)) return;

    const dir = path.join(process.cwd(), './clones', name);
    await mkdir(dir, {recursive: true});
    
    const branchName = `bot/update-global-workflow-${commitId}`;
    const git = simpleGit({baseDir: dir});

    await clone(url, dir, git);
    await createBranch(branchName, git);
    await copy(path.join(process.cwd(),changedFilename), path.join(dir,changedFilename));
    await push(gitHubKey, owner, url, branchName, 'Update global workflows', git);

    const pullRequestUrl = await createPr(octokit, branchName, id);

    console.log(`Entire workflow works like a charm, PR for ${name} is created -> ${pullRequestUrl}`);
  }
}

run();
