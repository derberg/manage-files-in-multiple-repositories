const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;
const { retry } = require('@octokit/plugin-retry');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');

const { createBranch, clone, push } = require('./git');
const { getReposList, createPr } = require('./api-calls');
const { getListModifiedFiles, copyChangedFiles, parseCommaList } = require('./utils');

const eventPayload = require(process.env.GITHUB_EVENT_PATH);

async function run() {
  if (process.env.GITHUB_EVENT_NAME !== 'push') return core.setFailed('This GitHub Action works only when triggered by "push" webhook.');

  try {
    const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });
    const filesToIgnore = core.getInput('files_to_ignore', { required: true });
    const committerUsername = core.getInput('committer_username');
    const committerEmail = core.getInput('committer_email');
    const commitMessage = core.getInput('commit_message');
    const reposToIgnore = core.getInput('repos_to_ignore');

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const octokit = GitHub.plugin(retry);
    const myOctokit = new octokit(getOctokitOptions(gitHubKey));

    //TODO for now this action is hardcoded to always get commit id of the first commit on the list
    core.debug('DEBUG: full payload of the event that triggered the action:');
    core.debug(JSON.stringify(eventPayload, null, 2));
    const commitId = eventPayload.commits[0].id;
    const ignoredRepositories = reposToIgnore ? parseCommaList(reposToIgnore) : [];
    //by default repo where workflow runs should always be ignored
    ignoredRepositories.push(repo);

    core.startGroup(`Getting list of modified workflow files from ${commitId} located in ${owner}/${repo}.`);
    const modifiedFiles = await getListModifiedFiles(myOctokit, commitId, owner, repo, filesToIgnore);

    if (!modifiedFiles.length) 
      return core.info('No changes to workflows were detected.');
    
    core.info(`Modified files that need replication are: ${modifiedFiles}.`);
    core.endGroup();
    core.info(`Getting list of repositories owned by ${owner} that will get updates. The following repos will be later ignored: ${ignoredRepositories}`);
    const reposList = await getReposList(myOctokit, owner);
    core.debug(`DEBUG: list of repositories for ${owner} that this action will iterate over:`);
    core.debug(JSON.stringify(reposList, null, 2));

    for (const repo of reposList) {
      if (!ignoredRepositories.includes(repo.name)) {
        core.startGroup(`Started updating ${repo.name} repo`);
        const dir = path.join(process.cwd(), './clones', repo.name);
        await mkdir(dir, {recursive: true});

        const branchName = `bot/update-global-workflow-${commitId}`;
        const git = simpleGit({baseDir: dir});

        core.info(`Clonning ${repo.name}.`);
        await clone(repo.url, dir, git);
        core.info(`Creating branch ${branchName}.`);
        await createBranch(branchName, git);
        core.info('Copying files...');
        await copyChangedFiles(modifiedFiles, dir);
        core.info('Pushing changes to remote');
        await push(gitHubKey, repo.url, branchName, commitMessage, committerUsername, committerEmail, git);
        const pullRequestUrl = await createPr(myOctokit, branchName, repo.id, commitMessage, repo.defaultBranchRef.name);
        core.endGroup();

        if (pullRequestUrl) {
          core.info(`Workflow finished with success and PR for ${repo.name} is created -> ${pullRequestUrl}`);
        } else {
          core.info(`Unable to create a PR because of timeouts. Create PR manually from the branch ${  branchName} that was already created in the upstream`);
        }
      }
    }
  } catch (error) {
    core.setFailed(`Action failed because of: ${ error}`);
  }
}

run();
