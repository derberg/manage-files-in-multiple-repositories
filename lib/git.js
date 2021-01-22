const core = require('@actions/core');

module.exports = {createBranch, clone, push};

async function createBranch(branchName, git) {
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(remote, dir, git) {
  return await git
    .clone(remote, dir, {'--depth': 1});
}

async function push(token, url, branchName, message, committerUsername, committerEmail, git) {
  const authanticatedUrl = (token, url, user) => {
    const arr = url.split('//');
    return `https://${user}:${token}@${arr[arr.length - 1]}`;
  };

  if (core.isDebug()) require('debug').enable('simple-git');

  return await git
    .add('./*')
    .addConfig('user.name', committerUsername)
    .addConfig('user.email', committerEmail)
    .commit(message)
    .addRemote('auth', authanticatedUrl(token, url, committerUsername))
    .push(['-u', 'auth', branchName]);
}
  