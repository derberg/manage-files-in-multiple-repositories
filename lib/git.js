const core = require('@actions/core');
const { getAuthanticatedUrl } = require('./utils');

module.exports = {createBranch, clone, push, areFilesChanged, getBranchesLocal, checkoutBranch};

async function checkoutBranch(branchName, git) {
  core.info(`Checking out branch ${branchName}.`);
  return await git
    .checkout(`${branchName}`);
}

async function createBranch(branchName, git) {
  core.info(`Creating branch ${branchName}.`);
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(token, remote, dir, git) {
  core.info(`Cloning ${remote}.`);
  await git.clone(getAuthanticatedUrl(token, remote), dir, {'--depth': 1});

  if (core.isDebug()) require('debug').enable('simple-git');
  core.info('Fetching all.');
  await git.fetch({'--all': null});
}

async function getBranchesLocal(git) {
  return await git.branchLocal();
}

async function push(token, url, branchName, message, committerUsername, committerEmail, git) {
  if (core.isDebug()) require('debug').enable('simple-git');
  core.info('Pushing changes to remote');
  
  await git.addConfig('user.name', committerUsername);
  await git.addConfig('user.email', committerEmail);
  await git.commit(message);
  await git.addRemote('auth', getAuthanticatedUrl(token, url));
  await git.push(['-u', 'auth', branchName]);
}

async function areFilesChanged(git) {
  await git.add('./*');
  const status = await git.status();
  core.debug('DEBUG: List of differences spotted in the repository');
  core.debug(JSON.stringify(status, null, 2));

  return status.files.length > 0;
}
  