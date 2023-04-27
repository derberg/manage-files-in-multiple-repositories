const core = require('@actions/core');
const { getAuthanticatedUrl } = require('./utils');
const REMOTE = 'auth';

module.exports = {createBranch, clone, push, areFilesChanged, getBranchesLocal, checkoutBranch};

async function checkoutBranch(branchName, git) {
  core.info(`Checking out branch ${branchName}.`);
  await git.fetch(REMOTE, branchName);
  await git.checkout(`${branchName}`);
}

async function createBranch(branchName, git) {
  core.info(`Creating branch ${branchName}.`);
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(token, remote, dir, git) {
  core.info(`Cloning ${remote}`);
  const remoteWithToken = getAuthanticatedUrl(token, remote);
  await git.clone(remoteWithToken, dir, {'--depth': 1});
  await git.addRemote(REMOTE, remoteWithToken);
}

async function getBranchesLocal(git) {
  return await git.branchLocal();
}

async function push(branchName, message, committerUsername, committerEmail, git) {
  if (core.isDebug()) require('debug').enable('simple-git');
  core.info('Pushing changes to remote');
  await git.addConfig('user.name', committerUsername);
  await git.addConfig('user.email', committerEmail);
  await git.commit(message);
  try {
    await git.push(['-u', REMOTE, branchName]);
  } catch (error) {
    core.info('Not able to push:', error);
    try {
      await git.pull([REMOTE, branchName]);
    } catch (error) {
      core.info('Not able to pull:', error);
      await git.merge(['-X', 'ours', branchName]);
      core.debug('DEBUG: Git status after merge');
      core.debug(JSON.stringify(await git.status(), null, 2));
      await git.add('./*');
      await git.commit(message);
      await git.push(['-u', REMOTE, branchName]);
    }
  }
}

async function areFilesChanged(git) {
  await git.add('./*');
  const status = await git.status();
  core.debug('DEBUG: List of differences spotted in the repository');
  core.debug(JSON.stringify(status, null, 2));

  return status.files.length > 0;
}
  
