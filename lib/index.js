const core = require('@actions/core');
const simpleGit = require('simple-git');
const path = require('path');
const { mkdir } = require('fs').promises;
const { retry } = require('@octokit/plugin-retry');
const { GitHub, getOctokitOptions } = require('@actions/github/lib/utils');

const { createBranch, clone, push, areFilesChanged, getBranchesLocal, checkoutBranch } = require('./git');
const { getReposList, createPr, getRepo } = require('./api-calls');
const { getListOfFilesToReplicate, copyChangedFiles, getListOfReposToIgnore, getBranchName, isInitialized, getBranchesList, removeFiles } = require('./utils');

const triggerEventName = process.env.GITHUB_EVENT_NAME;
const eventPayload = require(process.env.GITHUB_EVENT_PATH);

/* eslint-disable sonarjs/cognitive-complexity */
async function run() {
  const isPush = triggerEventName === 'push';
  if (isPush) core.info('Workflow started on push event');
  const isWorkflowDispatch = triggerEventName === 'workflow_dispatch';
  if (isWorkflowDispatch) core.info('Workflow started on workflow_dispatch event');

  if (!isPush && !isWorkflowDispatch) return core.setFailed('This GitHub Action works only when triggered by "push" or "workflow_dispatch" webhooks.');
  
  core.debug('DEBUG: full payload of the event that triggered the action:');
  core.debug(JSON.stringify(eventPayload, null, 2));

  try {
    /*
     * 0. Setting up necessary variables and getting input specified by workflow user
    */ 
    const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });
    const patternsToIgnore = core.getInput('patterns_to_ignore');
    const patternsToInclude = core.getInput('patterns_to_include');
    const patternsToRemove = core.getInput('patterns_to_remove');
    const committerUsername = core.getInput('committer_username');
    const committerEmail = core.getInput('committer_email');
    const commitMessage = core.getInput('commit_message');
    const branches = core.getInput('branches');
    const destination = core.getInput('destination');
    const customBranchName = core.getInput('bot_branch_name');
    const repoNameManual = eventPayload.inputs && eventPayload.inputs.repo_name;

    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const octokit = GitHub.plugin(retry);
    const myOctokit = new octokit(getOctokitOptions(gitHubKey, {
      // Topics are currently only available using mercy-preview.
      previews: ['mercy-preview'],
    }));

    //Id of commit can be taken only from push event, not workflow_dispatch
    //TODO for now this action is hardcoded to always get commit id of the first commit on the list
    const commitId = triggerEventName === 'push' ? eventPayload.commits[0].id : '';

    if (patternsToRemove && patternsToInclude) {
      core.setFailed('Fields patterns_to_include and patterns_to_remove are mutually exclusive. If you want to remove files from repos then do not use patterns_to_include.');
      return;
    }

    if (patternsToRemove && destination) 
      core.warning('The destination field will be ignored as it doesn\'t make sense when removal is expected and patterns_to_remove field is used');

    /*
     * 1. Getting list of files that have changes that must be replicated in other repos
     * If `patterns_to_remove` field is used then this step is ommited as there is no need to search for files to replicate as no replication takes place but removal
     */
    let filesToCheckForReplication;
    let filesToReplicate;
    let filesToRemove;
    if (!patternsToRemove) {
      filesToCheckForReplication = await getListOfFilesToReplicate(myOctokit, commitId, owner, repo, patternsToIgnore, patternsToInclude, triggerEventName);
      filesToReplicate = filesToCheckForReplication.filesForReplication;
      filesToRemove = filesToCheckForReplication.filesForRemoval;
      //if no files need replication, we just need to stop the workflow from further execution
      if (!filesToReplicate.length && !filesToRemove.length) 
        return;
    } 
    //filesForReplication
    //filesThatNeedToBeRemoved

    /*
     * 2. Getting list of all repos owned by the owner/org 
     *    or just replicating to the one provided manually
     */
    let reposList = [];
    if (isWorkflowDispatch && repoNameManual) {
      reposList.push(await getRepo(myOctokit, owner, repoNameManual));
    } else {
      reposList = await getReposList(myOctokit, owner);
    }

    /*
     * 3. Getting list of repos that should be ignored
     */
    const ignoredRepositories = getListOfReposToIgnore(repo, reposList, {
      reposToIgnore: core.getInput('repos_to_ignore'),
      topicsToInclude: core.getInput('topics_to_include'),
      excludePrivate: (core.getInput('exclude_private') === 'true'),
      excludeForked: (core.getInput('exclude_forked') === 'true'),
    });

    /*
     * 4. Management of files in selected repos starts one by one
     */
    for (const repo of reposList) {
      try {
        //start only if repo not on list of ignored
        if (!ignoredRepositories.includes(repo.name)) {        
          core.startGroup(`Started updating ${repo.name} repo`);
          const defaultBranch = repo.defaultBranch;

          /*
           * 4a. Creating folder where repo will be cloned and initializing git client
           */
          const dir = path.join(process.cwd(), './clones', `${repo.name  }-${ Math.random().toString(36).substring(7)}`);
          await mkdir(dir, {recursive: true});
          const git = simpleGit({baseDir: dir});

          /*
           * 4b. Cloning and verification of the repo before replication
           */
          await clone(gitHubKey, repo.url, dir, git); 
          if (!isInitialized(await getBranchesLocal(git), defaultBranch)) {
            core.info('Repo not initialized, skipping it.');
            continue;
          }

          /*
           * 4c. Checking what branches should this action operate on. 
           *     Should it be just default one or the ones provided by the user
           */
          const branchesToOperateOn = await getBranchesList(myOctokit, owner, repo.name, branches, defaultBranch); 
          if (!branchesToOperateOn[0].length) {
            core.info('Repo has no branches that the action could operate on');
            continue;
          }

          /*
           * 4d. Per branch operation starts
           */
          for (const branch of branchesToOperateOn[0]) {
            /*
             * 4da. Checkout branch in cloned repo
             */
            const branchName = branch.name;
            await checkoutBranch(branchName, git);

            /*
             * 4db. Creating new branch in cloned repo
             */
            const newBranchName = customBranchName || getBranchName(commitId, branchName);
            await createBranch(newBranchName, git);

            /*
             * 4dc. Files replication/update or deletion
             * it is pretty clear that if there is nothing to replicate, then there definitely is something to remove
             * it is not possible that both ifs are invoked in the same run
             */         
            if (filesToReplicate) await copyChangedFiles(filesToReplicate, dir, destination);
            if (filesToRemove) await removeFiles(filesToRemove, dir, { destination });
            if (!filesToReplicate) await removeFiles(patternsToRemove, dir, { patternsToIgnore });
                  
            //pushing and creating PR only if there are changes detected locally
            if (await areFilesChanged(git)) {
              /*
               * 4ed. Pushing files to custom branch
               */  
              await push(newBranchName, commitMessage, committerUsername, committerEmail, git);
                    
              /*
               * 4fe. Opening a PR
               */
              const wasBranchThereAlready = branchesToOperateOn[1].some(branch => branch.name === newBranchName);
              core.debug(`DEBUG: was branch ${newBranchName} there already in the repository? - ${wasBranchThereAlready}`);
              core.debug(JSON.stringify(branchesToOperateOn, null, 2));
              let pullRequestUrl;
              if (!wasBranchThereAlready) pullRequestUrl = await createPr(myOctokit, newBranchName, repo.id, commitMessage, branchName);
                    
              core.endGroup();
          
              if (pullRequestUrl && !wasBranchThereAlready) {
                core.info(`Workflow finished with success and PR for ${repo.name} is created -> ${pullRequestUrl}`);
              } else if (wasBranchThereAlready) {
                core.info(`Workflow finished without PR creation for ${repo.name}. Insted push was performed to existing ${newBranchName} branch`);
              } else {
                core.info(`Unable to create a PR because of timeouts. Create PR manually from the branch ${newBranchName} that was already created in the upstream`);
              }
            } else {
              core.endGroup();
              core.info('Finished with success. No PR was created as no changes were detected');
            }
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
