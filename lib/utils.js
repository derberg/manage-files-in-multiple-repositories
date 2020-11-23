module.exports = {createBranch, clone, push};

async function createBranch(branchName, git) {
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(remote, dir, git) {
  return await git
    .clone(remote, dir, {'--depth': 1});
}

async function push(token, owner, url, branchName, message, git) {
  const authanticatedUrl = (token, url, owner) => {
    const arr = url.split('//');
    return `https://${owner}:${token}@${arr[arr.length - 1]}`;
  };

  return await git
    .add('./*')
    .commit(message)
    .addRemote('auth', authanticatedUrl(token, url, owner))
    .push(['-u', 'auth', branchName]);
}
  