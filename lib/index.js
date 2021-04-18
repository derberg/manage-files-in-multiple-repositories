const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;
const { retry } = require('@octokit/plugin-retry');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');

const { createBranch, clone, push, areFilesChanged } = require('./git');
const { getReposList, createPr } = require('./api-calls');
const { getListOfFilesToReplicate, copyChangedFiles, parseCommaList, getBranchName } = require('./utils');

const triggerEventName = process.env.GITHUB_EVENT_NAME;
const eventPayload = require(process.env.GITHUB_EVENT_PATH);

async function run() {
  if (triggerEventName !== 'push' && triggerEventName !== 'workflow_dispatch') return core.setFailed('This GitHub Action works only when triggered by "push" or "workflow_dispatch" webhooks.');
  
  core.debug('DEBUG: full payload of the event that triggered the action:');
  core.debug(JSON.stringify(eventPayload, null, 2));

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

    /*
     * Getting list of repos that should be ignored
     */
    const ignoredRepositories = reposToIgnore ? parseCommaList(reposToIgnore) : [];
    //by default repo where workflow runs should always be ignored
    ignoredRepositories.push(repo);

    /*
     * Getting list of files that must be replicated in other repos by this action
     */
    //TODO for now this action is hardcoded to always get commit id of the first commit on the list
    //Id of commit can be taken only from push event, not workflow_dispatch
    const commitId = triggerEventName === 'push' ? eventPayload.commits[0].id : '';

    core.startGroup('Getting list of workflow files that need to be replicated in other repositories');
    const filesToReplicate = await getListOfFilesToReplicate(myOctokit, commitId, owner, repo, filesToIgnore, triggerEventName);

    if (!filesToReplicate.length) 
      return core.info('No changes to workflows were detected.');
    
    core.info(`Files that need replication are: ${filesToReplicate}.`);
    core.endGroup();

    core.startGroup(`Getting list of repositories owned by ${owner} that will get updates. The following repos will be later ignored: ${ignoredRepositories}`);
    const reposList = await getReposList(myOctokit, owner);
    core.debug(`DEBUG: list of repositories for ${owner} that this action will iterate over:`);
    core.debug(JSON.stringify(reposList, null, 2));
    core.endGroup();

    for (const repo of reposList) {
      //start only if repo not on list of ignored
      //repo also must be initialized repo because only then it has default branch (defaultBranchRef) defined and PR can actually be created
      if (!ignoredRepositories.includes(repo.name) && repo.defaultBranchRef) {        
        core.startGroup(`Started updating ${repo.name} repo`);
        const dir = path.join(process.cwd(), './clones', repo.name);
        await mkdir(dir, {recursive: true});

        const branchName = getBranchName(commitId);
        const git = simpleGit({baseDir: dir});

        core.info(`Clonning ${repo.name}.`);
        await clone(repo.url, dir, git);
        core.info(`Creating branch ${branchName}.`);
        await createBranch(branchName, git);
        core.info('Copying files...');
        await copyChangedFiles(filesToReplicate, dir);
        //pushing and creating PR only if there are changes detected locally
        if (areFilesChanged(git)) {
          core.info('Pushing changes to remote');
          await push(gitHubKey, repo.url, branchName, commitMessage, committerUsername, committerEmail, git);
          const pullRequestUrl = await createPr(myOctokit, branchName, repo.id, commitMessage, repo.defaultBranchRef.name);
          core.endGroup();

          if (pullRequestUrl) {
            core.info(`Workflow finished with success and PR for ${repo.name} is created -> ${pullRequestUrl}`);
          } else {
            core.info(`Unable to create a PR because of timeouts. Create PR manually from the branch ${  branchName} that was already created in the upstream`);
          }
        } else {
          core.info('Workflow finished with success and no PR was created as no changes were detected');
        }
      }
    }
  } catch (error) {
    core.setFailed(`Action failed because of: ${ error}`);
  }
}

run();
