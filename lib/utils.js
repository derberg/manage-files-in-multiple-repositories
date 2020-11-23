const { copy } = require('fs-extra');
const path = require('path');

const { getCommitFiles } = require('./api-calls');

module.exports = { getListModifiedFiles, copyChangedFiles };

/**
 * @param  {Object} octokit GitHub API client instance
 * @param  {Object} eventPayload https://developer.github.com/webhooks/event-payloads/#push
 * @param  {String} owner org or user name
 * @param  {String} repo repo name
 * 
 * @returns {Array<String>} list of filepaths of modified files
 */
async function getListModifiedFiles(octokit, commitId, owner, repo) {
  const commitFiles = await getCommitFiles(octokit, commitId, owner, repo);
  const changedFiles = [];

  for (const { filename } of commitFiles) {
    //TODO for now this action is hardcoded to only monitor changes in this directory because it is supposed to support global workflows and no other files
    //This can be changed if there is a well described use case
    if (!filename.includes('.github/workflows')) return;

    changedFiles.push(filename);
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