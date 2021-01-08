const { copy } = require('fs-extra');
const path = require('path');
const core = require('@actions/core');

const { getCommitFiles } = require('./api-calls');

module.exports = { getListModifiedFiles, copyChangedFiles, parseCommaList };

/**
 * @param  {Object} octokit GitHub API client instance
 * @param  {Object} eventPayload https://developer.github.com/webhooks/event-payloads/#push
 * @param  {String} owner org or user name
 * @param  {String} repo repo name
 * @param  {String} filesToIgnore comma-separated list of files that should be ignored
 * 
 * @returns {Array<String>} list of filepaths of modified files
 */
async function getListModifiedFiles(octokit, commitId, owner, repo, filesToIgnore) {
  const commitFiles = await getCommitFiles(octokit, commitId, owner, repo);
  core.debug(`DEBUG: list of commits for ${commitId} that is used to check if there was any file located in .github/workflows modified`,  JSON.stringify(commitFiles, null, 2));

  const changedFiles = [];
  const ignoreFilesList = filesToIgnore ? parseCommaList(filesToIgnore) : [];
  
  core.info(`List of files that should be ignored: ${ignoreFilesList}`);

  for (const { filename } of commitFiles) {
    const onlyFileName = filename.split('/').slice(-1)[0];
    const isFileIgnored = !!ignoreFilesList.map(file => file === onlyFileName).filter(Boolean).length;
    //TODO for now this action is hardcoded to only monitor changes in this directory because it is supposed to support global workflows and no other files
    //This can be changed if there is a well described use case
    const isWorkflowFile = filename.includes('.github/workflows');
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