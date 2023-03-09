const { copy, remove } = require('fs-extra');
const { readdir, stat } = require('fs').promises;
const path = require('path');
const core = require('@actions/core');
const { getCommitFiles, getBranchesRemote } = require('./api-calls');

module.exports = { copyChangedFiles, parseCommaList, getListOfReposToIgnore, getBranchName, getListOfFilesToReplicate, getAuthanticatedUrl, isInitialized, getBranchesList, filterOutMissingBranches, filterOutFiles, getFilteredFilesList, getFileName, removeFiles };

/**
 * @param  {Object} octokit GitHub API client instance
 * @param  {Object} commitId Id of the commit to check for files changes
 * @param  {String} owner org or user name
 * @param  {String} repo repo name
 * @param  {String} patternsToIgnore comma-separated list of file paths or directories that should be ignored
 * @param  {String} patternsToInclude comma-separated list of file paths or directories that should be replicated
 * @param  {String} triggerEventName name of the event that triggered the workflow
 * 
 * @returns {Array<String>} list of filepaths of modified files
 */
async function getListOfFilesToReplicate(octokit, commitId, owner, repo, patternsToIgnore, patternsToInclude, triggerEventName) {
  let filesToCheckForReplication;

  core.startGroup('Getting list of workflow files that need to be replicated in other repositories');

  if (triggerEventName === 'push') {
    const commitFiles = await getCommitFiles(octokit, commitId, owner, repo);
    filesToCheckForReplication = commitFiles.map((el) => el.filename);
    core.debug(`DEBUG: list of files modified in commit ${commitId}: ${filesToCheckForReplication}`);
  }

  if (triggerEventName === 'workflow_dispatch') {
    const root = process.cwd();
    filesToCheckForReplication = (await getFilesListRecursively(root)).map(filepath => path.relative(root, filepath));
    core.debug(`DEBUG: list of files from the repo is ${filesToCheckForReplication}`);
  }

  const filesForReplication = getFilteredFilesList(filesToCheckForReplication, patternsToIgnore, patternsToInclude);

  if (!filesForReplication.length) {
    core.info('No changes were detected.');
  } else {
    core.info(`Files that need replication are: ${filesForReplication}.`);
  }

  core.endGroup();

  return filesForReplication;
}

/**
 * Get a list of all files recursively in file path
 * 
 * @param {String} filepath 
 * 
 * @returns {Array<String>} list of filepaths in path directory
 */
async function getFilesListRecursively(filepath) {
  const paths = await readdir(filepath);

  const fullpaths = paths.map(async filename => {
    const fullpath = path.join(filepath, filename);
    const stats = await stat(fullpath);

    if (stats.isFile()) {
      return fullpath;
    } else if (stats.isDirectory()) {
      return (await getFilesListRecursively(fullpath)).flat();
    }
  });

  return (await Promise.all(fullpaths)).flat();
}

/**
 * Get a list of files to replicate
 * 
 * @param  {Array} filesToCheckForReplication list of all paths that are suppose to be replicated
 * @param  {String} filesToIgnore Comma-separated list of file paths or directories to ignore
 * @param  {String} patternsToInclude Comma-separated list of file paths or directories to include
 *
* @returns  {Array}
 */
function getFilteredFilesList(filesToCheckForReplication, filesToIgnore, patternsToInclude) {
  const filesWithoutIgnored = filterOutFiles(filesToCheckForReplication, filesToIgnore, true);
  return filterOutFiles(filesWithoutIgnored, patternsToInclude, false);
}

/**
 * Get list of files that should be replicated because they are supposed to be ignored, or because they should not be ignored
 * 
 * @param  {Array} filesToFilter list of all paths that are suppose to be replicated
 * @param  {String} patterns Comma-separated list of file paths or directories
 * @param  {Boolean} ignore true means files that matching patters should be filtered out, false means that only matching patterns should stay
 *
* @returns  {Array}
 */
function filterOutFiles(filesToFilter, patterns, ignore) {
  const filteredList = [];
  const includePatternsList = patterns ? parseCommaList(patterns) : [];

  for (const filename of filesToFilter) {
    const isMatching = !!includePatternsList.map(pattern => {
      return filename.includes(pattern);
    }).filter(Boolean).length;

    if (!ignore && isMatching) filteredList.push(filename);
    if (ignore && !isMatching) filteredList.push(filename);
  }

  return filteredList;
}

/**
 * Assemble a list of repositories that should be ignored.
 * 
 * @param  {String} repo The current repository.
 * @param  {Array} reposList All the repositories.
 * @param  {String} inputs.reposToIgnore A comma separated list of repositories to ignore.
 * @param  {String} inputs.topicsToInclude A comma separated list of topics to include.
 * @param  {Boolean} inputs.excludePrivate Exclude private repositories.
 * @param  {Boolean} inputs.excludeForked Exclude forked repositories.
 * 
 * @returns  {Array}
 */
function getListOfReposToIgnore(repo, reposList, inputs) {
  const {
    reposToIgnore,
    topicsToInclude,
    excludePrivate,
    excludeForked,
  } = inputs;

  core.startGroup('Getting list of repos to be ignored');

  //manually ignored repositories.
  const ignoredRepositories = reposToIgnore ? parseCommaList(reposToIgnore) : [];

  // Exclude archived repositories by default. The action will fail otherwise.
  const EXCLUDE_ARCHIVED = true;
  if (EXCLUDE_ARCHIVED === true) {
    ignoredRepositories.push(...archivedRepositories(reposList));
  }

  //by default repo where workflow runs should always be ignored.
  ignoredRepositories.push(repo);

  // if topics_to_ignore is set, get ignored repositories by topics.
  if (topicsToInclude.length) {
    ignoredRepositories.push(...ignoredByTopics(topicsToInclude, reposList));
  }

  // Exclude private repositories.
  if (excludePrivate === true) {
    ignoredRepositories.push(...privateRepositories(reposList));
  }

  // Exclude forked repositories
  if (excludeForked === true) {
    ignoredRepositories.push(...forkedRepositories(reposList));
  }

  if (!ignoredRepositories.length) {
    core.info('No repositories will be ignored.');
  } else {
    core.info(`Repositories that will be ignored: ${ignoredRepositories}.`);
  }

  core.endGroup();

  return ignoredRepositories;
}

/**
 * @param  {Array} filesList list of files that need to be copied
 * @param  {String} root root destination in the repo, always ./
 * @param  {String} destination in case files need to be copied to soom custom location in repo
 */
async function copyChangedFiles(filesList, root, destination) {
  core.info('Copying files');
  core.debug(`DEBUG: Copying files to root ${root} and destination ${destination} - if provided (${!!destination}). Where process.cwd() is ${process.cwd()}`);

  await Promise.all(filesList.map(async filePath => {
    return destination
      ? await copy(path.join(process.cwd(), filePath), path.join(root, destination, getFileName(filePath)))
      : await copy(path.join(process.cwd(), filePath), path.join(root, filePath));
  }));
}

/**
 * @param  {String} patternsToRemove comma-separated list of patterns that specify where and what should be removed
 * @param  {String} root root of cloned repo
 */
async function removeFiles(patternsToRemove, root, patternsToIgnore) {
  core.info('Removing files');
  core.debug(`DEBUG: Removing files from root ${root} Where process.cwd() is ${process.cwd()}`);

  const filesToCheckForRemoval = (await getFilesListRecursively(root)).map(filepath => path.relative(root, filepath));
  const filesForRemoval = getFilteredFilesList(filesToCheckForRemoval, patternsToIgnore, patternsToRemove);

  core.debug(`DEBUG: Provided patterns ${patternsToRemove} relate to the following files ${filesForRemoval}`);

  await Promise.all(filesForRemoval.map(async filePath => {
    return await remove(path.join(root, filePath));
  }));
}

/**
 * @param  {String} filePath full filepath to the file
 * @returns  {String} filename with extension
 */
function getFileName(filePath) {
  return filePath.split('/').slice(-1)[0];
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
 * @param  {String} branchName name of the branch that new branch will be cut from
* @returns  {String}
 */
function getBranchName(commitId, branchName) {
  return commitId ? `bot/update-global-workflow-${branchName}-${commitId}` : `bot/manual-update-global-workflow-${branchName}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Get list of branches that this action should operate on
 * @param  {Object} octokit GitHub API client instance
 * @param  {String} owner org or user name
 * @param  {String} repo repo name
 * @param  {String} branchesString comma-separated list of branches
 * @param  {String} defaultBranch name of the repo default branch
 * @returns  {String}
 */
async function getBranchesList(octokit, owner, repo, branchesString, defaultBranch) {
  core.info('Getting list of branches the action should operate on');
  const branchesFromRemote = await getBranchesRemote(octokit, owner, repo);

  //we need to match if all branches that user wants this action to support are on the server and can actually be supported
  //branches not available an remote will not be included
  const filteredBranches = filterOutMissingBranches(branchesString, branchesFromRemote, defaultBranch);

  core.info(`These is a final list of branches action will operate on: ${JSON.stringify(filteredBranches, null, 2)}`);

  return filteredBranches;
}

/**
 * Get array of branches without the ones that do not exist in remote
 * @param  {String} branchesRequested User requested branches
 * @param  {Array<Object>} branchesExisting Existing branches
 * @param  {String} defaultBranch Name of repo default branch
 * @returns  {Array<Object>}
 */
function filterOutMissingBranches(branchesRequested, branchesExisting, defaultBranch) {
  const branchesArray = branchesRequested
    ? parseCommaList(branchesRequested)
    : [`^${defaultBranch}$`];

  core.info(`These were requested branches: ${branchesRequested}`);
  core.info(`This is default branch: ${defaultBranch}`);

  return branchesExisting.filter(branch => {
    // return branchesArray.includes(branch.name);
    return branchesArray.some(b => {
      const regex = new RegExp(b);
      return regex.test(branch.name);
    });
  });
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
function isInitialized(branches, defaultBranch) {
  core.info('Checking if repo initialized.');
  core.debug('DEBUG: list of local branches');
  core.debug(JSON.stringify(branches.branches, null, 2));

  return !!branches.branches[defaultBranch];
}

/**
 * Getting list of topics that should be included if topics_to_include is set.
 * Further on we will get a list of repositories that do not belong to any of the specified topics.
 * 
 * @param  {String} topicsToInclude Comma separated list of topics to include.
 * @param  {Array} reposList All the repositories.
 * @returns {Array} List of all repositories to exclude.
 */
function ignoredByTopics(topicsToInclude, reposList) {
  const includedTopics = topicsToInclude ? parseCommaList(topicsToInclude) : [];

  if (!includedTopics.length) return;

  return reposList.filter(repo => {
    return includedTopics.some(topic => repo.topics.includes(topic)) === false;
  }).map(reposList => reposList.name);
}

/**
 * Returns a list of archived repositories.
 * 
 * @param  {Array} reposList All the repositories.
 * @returns {Array}
 */
function archivedRepositories(reposList) {
  return reposList.filter(repo => {
    return repo.archived === true;
  }).map(reposList => reposList.name);
}

/**
 * Returns a list of private repositories.
 * 
 * @param  {Array} reposList All the repositories.
 * @returns {Array}
 */
function privateRepositories(reposList) {
  return reposList.filter(repo => {
    return repo.private === true;
  }).map(reposList => reposList.name);
}

/**
 * Returns a list of forked repositories.
 * 
 * @param  {Array} reposList All the repositories.
 * @returns {Array}
 */
function forkedRepositories(reposList) {
  return reposList.filter(repo => {
    return repo.fork === true;
  }).map(reposList => reposList.name);
}