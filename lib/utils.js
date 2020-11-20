module.exports = {createBranch, clone, push};

async function createBranch(branchName, git) {
  return await git
    .checkout(`-b${branchName}`);
}

async function clone(remote, dir, git) {
  return await git
    .clone(remote, dir, {'--depth': 1});
}

async function push(token, url, branchName, message, git) {
  const authanticatedUrl = (token, url) => {
    const arr = url.split('//');
    return `https://lukasz-lab:${token}@${arr[arr.length - 1]}`;
  };

  //https://github.com/lukasz-lab/chewie-sample-data
  //https://lukasz-lab:token@github.com/lukasz-lab/chewie-sample-data
  return await git
    .add('./*')
    .commit(message)
    .addRemote('auth', authanticatedUrl(token, url))
    .push(['-u', 'auth', branchName]);
}
  