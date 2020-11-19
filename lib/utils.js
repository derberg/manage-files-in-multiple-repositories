module.exports = {createBranch, clone};

async function createBranch(branchName, git) {
  return await git
    .silent(true)
    .checkout(`-b${branchName}`);
}

async function clone(remote, dir, git) {
  return await git
    .silent(true)
    .clone(remote, dir, {'--depth': 1});
}
  