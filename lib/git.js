const core = require('@actions/core');
const { getAuthanticatedUrl } = require('./utils');

module.exports = {createBranch, clone, push, areFilesChanged, getBranches};

async function createBranch(branchName, git) {
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(token, remote, dir, git) {
  await git.clone(getAuthanticatedUrl(token, remote), dir, {'--depth': 1});
}

async function getBranches(git) {
  return await git.branchLocal();
}

async function push(token, url, branchName, message, committerUsername, committerEmail, git) {
  if (core.isDebug()) require('debug').enable('simple-git');

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
  