const { copy } = require('fs-extra');
const { readdir } = require('fs').promises;
const path = require('path');
const core = require('@actions/core');
const { getCommitFiles } = require('./api-calls');

module.exports = { copyChangedFiles, parseCommaList, getBranchName, getListOfFilesToReplicate, getAuthanticatedUrl, isInit };

/**
 * @param  {Object} octokit GitHub API client instance
 * @param  {Object} commitId Id of the commit to check for files changes
 * @param  {String} owner org or user name
 * @param  {String} repo repo name
 * @param  {String} filesToIgnore comma-separated list of files that should be ignored
 * @param  {String} triggerEventName name of the event that triggered the workflow
 * 
 * @returns {Array<String>} list of filepaths of modified files
 */
async function getListOfFilesToReplicate(octokit, commitId, owner, repo, filesToIgnore, triggerEventName) {
  let filesToCheckForReplication;
  const defaultWorkflowsDir = '.github/workflows';

  if (triggerEventName === 'push') {
    const commitFiles = await getCommitFiles(octokit, commitId, owner, repo);
    filesToCheckForReplication = commitFiles.map((el) => el.filename);
    core.debug(`DEBUG: list of commited files for commit ${commitId} that is used to check if there was any file located in .github/workflows modified: ${filesToCheckForReplication}`);
  }

  if (triggerEventName === 'workflow_dispatch') {
    const workflowDirPath = path.join(process.cwd(), defaultWorkflowsDir);
    const workflowDirFilesList = await readdir(workflowDirPath);
    filesToCheckForReplication = workflowDirFilesList.map(filename => path.join(defaultWorkflowsDir, filename));
    core.debug(`DEBUG: list of files from ${workflowDirPath} directory is ${filesToCheckForReplication}`);
  }

  const changedFiles = [];
  const ignoreFilesList = filesToIgnore ? parseCommaList(filesToIgnore) : [];
  
  core.info(`List of files that should be ignored: ${ignoreFilesList}`);

  for (const filename of filesToCheckForReplication) {
    const onlyFileName = filename.split('/').slice(-1)[0];
    const isFileIgnored = !!ignoreFilesList.map(file => file === onlyFileName).filter(Boolean).length;
    //TODO for now this action is hardcoded to only monitor changes from .github/workflows directory because it is supposed to support global workflows and no other files
    const isWorkflowFile = filename.includes(defaultWorkflowsDir);
    core.info(`Checking if ${filename} is located in workflows directory (${isWorkflowFile}) and if ${onlyFileName} should be ignored (${isFileIgnored})`);

    if (isWorkflowFile && !isFileIgnored) {
      changedFiles.push(filename);
    }
  }

  return changedFiles;
}

/**
 * @param  {Array} filesList list of files that need to be copied
 * @param  {String} destination where file should be copied
 */
async function copyChangedFiles(filesList, destination) {
  await Promise.all(filesList.map(async filepath => {
    return await copy(path.join(process.cwd(), filepath), path.join(destination, filepath));
  }));
}

/**
 * @param  {String} list names of values that can be separated by comma
 * @returns  {Array<String>} input names not separated by string but as separate array items
 */
function parseCommaList(list) {
  return list.split(',').map(i => i.trim().replace(/['"]+/g, ''));
}

/**
 * Create a branch name. 
 * If commitId is not provided then it means action was not triggered by push and name must have some generated number and indicate manual run
 * 
 * @param  {String} commitId id of commit that should be added to branch name for better debugging of changes
 * @returns  {String}
 */
function getBranchName(commitId) {
  return commitId ? `bot/update-global-workflow-${commitId}` : `bot/manual-update-global-workflow-${Math.random().toString(36).substring(7)}`;
}

/**
 * Creates a url with authentication token in it
 * 
 * @param  {String} token access token to GitHub
 * @param  {String} url repo URL
 * @returns  {String}
 */
function getAuthanticatedUrl(token, url) {
  const arr = url.split('//');
  return `https://${token}@${arr[arr.length - 1]}.git`;
};

/**
 * Checking if repo is initialized cause if it isn't we need to ignore it
 * 
 * @param  {Array<Object>} branches list of all local branches with detail info about them
 * @param  {String} defaultBranch name of default branch that is always set even if repo not initialized
 * @returns  {Boolean}
 */
function isInit(branches, defaultBranch) {
  core.debug(`DEBUG: list of local branches: ${branches.branches}`);
  return !!branches.branches[defaultBranch];
}