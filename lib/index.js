const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;
const { retry } = require('@octokit/plugin-retry');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');

const { createBranch, clone, push, areFilesChanged, getBranches } = require('./git');
const { getReposList, createPr } = require('./api-calls');
const { getListOfFilesToReplicate, copyChangedFiles, getListOfReposToIgnore, getBranchName, isInitialized } = require('./utils');

const triggerEventName = process.env.GITHUB_EVENT_NAME;
const eventPayload = require(process.env.GITHUB_EVENT_PATH);

/* eslint-disable sonarjs/cognitive-complexity */
async function run() {
  if (triggerEventName !== 'push' && triggerEventName !== 'workflow_dispatch') return core.setFailed('This GitHub Action works only when triggered by "push" or "workflow_dispatch" webhooks.');
  
  core.debug('DEBUG: full payload of the event that triggered the action:');
  core.debug(JSON.stringify(eventPayload, null, 2));

  try {
    /*
     * 0. Setting up necessary variables and getting input specified by workflow user
    */ 
    const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });
    const filesToIgnore = core.getInput('files_to_ignore', { required: true });
    const committerUsername = core.getInput('committer_username');
    const committerEmail = core.getInput('committer_email');
    const commitMessage = core.getInput('commit_message');

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const octokit = GitHub.plugin(retry);
    const myOctokit = new octokit(getOctokitOptions(gitHubKey, {
      // Topics are currently only available using mercy-preview.
      previews: ['mercy-preview'],
    }));

    //Id of commit can be taken only from push event, not workflow_dispatch
    //TODO for now this action is hardcoded to always get commit id of the first commit on the list
    const commitId = triggerEventName === 'push' ? eventPayload.commits[0].id : '';
    const branchName = getBranchName(commitId);

    /*
     * 1. Getting list of files that must be replicated in other repos by this action
     */    
    const filesToReplicate = await getListOfFilesToReplicate(myOctokit, commitId, owner, repo, filesToIgnore, triggerEventName);
    //if no files need replication, we just need to stop the workflow from further execution
    if (!filesToReplicate.length) 
      return;

    /*
     * 2. Getting list of all repos owned by the owner/org
     */
    const reposList = await getReposList(myOctokit, owner);
    
    /*
     * 3. Getting list of repos that should be ignored
     */
    const ignoredRepositories = getListOfReposToIgnore(repo, reposList, {
      reposToIgnore: core.getInput('repos_to_ignore'),
      topicsToInclude: core.getInput('topics_to_include'),
      excludePrivate: (core.getInput('exclude_private') === 'true'),
    });

    /*
     * 4. Replication of files in selected repos starts one by one
     */
    for (const repo of reposList) {
      try {
        //start only if repo not on list of ignored
        if (!ignoredRepositories.includes(repo.name)) {        
          core.startGroup(`Started updating ${repo.name} repo`);

          /*
         * 4a. Creating folder where repo will be cloned and initializing git client
         */
          const dir = path.join(process.cwd(), './clones', repo.name);
          await mkdir(dir, {recursive: true});
          const git = simpleGit({baseDir: dir});

          /*
         * 4b. Cloning and verification of the repo before replication
         */
          await clone(gitHubKey, repo.url, dir, git); 
          if (!isInitialized(await getBranches(git), repo.defaultBranch)) {
            core.info('Repo not initialized, skipping it.');
            continue;
          }

          /*
         * 4c. Creating new branch in cloned repo
         */
          await createBranch(branchName, git);

          /*
         * 4d. Replicating files
         */         
          await copyChangedFiles(filesToReplicate, dir);
        
          //pushing and creating PR only if there are changes detected locally
          if (await areFilesChanged(git)) {
          /*
           * 4e. Pushing files to custom branch
           */  
            await push(gitHubKey, repo.url, branchName, commitMessage, committerUsername, committerEmail, git);
          
            /*
           * 4f. Opening a PR
           */  
            const pullRequestUrl = await createPr(myOctokit, branchName, repo.id, commitMessage, repo.defaultBranch);
          
            core.endGroup();

            if (pullRequestUrl) {
              core.info(`Workflow finished with success and PR for ${repo.name} is created -> ${pullRequestUrl}`);
            } else {
              core.info(`Unable to create a PR because of timeouts. Create PR manually from the branch ${  branchName} that was already created in the upstream`);
            }
          } else {
            core.endGroup();
            core.info('Finished with success. No PR was created as no changes were detected');
          }
        }
      } catch (error) {
        core.endGroup();
        core.warning(`Failed replicating files for this repo: ${error}`);
        continue;
      }
    }
  } catch (error) {
    core.setFailed(`Action failed because of: ${error}`);
  }
}

run();
