const core = require('@actions/core');

module.exports = { getCommitFiles, getReposList, createPr, getRepo, getBranchesRemote };

async function getCommitFiles(octokit, commitId, owner, repo) {
  const { data: { files } } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: commitId
  });

  return files;
}

async function getBranchesRemote(octokit, owner, repo) {
  core.info('Getting list of all the branches for the repository');

  const allBranches = await octokit.paginate(
    octokit.repos.listBranches,
    {
      owner,
      repo
    },
    (response) => response.data
  );

  core.debug('DEBUG: Full response about branches');
  core.debug(JSON.stringify(allBranches, null, 2));

  const branchesList = allBranches.map((branch) => {
    return {
      name: branch.name,
    };
  });

  core.debug('DEBUG: List of all branches');
  core.debug(JSON.stringify(branchesList, null, 2));

  return branchesList;
}

async function getRepo(octokit, owner, repo) {
  core.info(`Getting details of manually selected ${repo} repository`);

  const { data } = await octokit.repos.get({
    owner,
    repo
  });

  const repoDetails = {
    name: data.name,
    url: data.html_url,
    id: data.node_id,
    defaultBranch: data.default_branch,
    private: data.private,
    fork: data.fork,
    archived: data.archived,
    topics: data.topics,
  };

  core.debug(`DEBUG: Repo ${repo} full response`);
  core.debug(JSON.stringify(data, null, 2));
  core.debug(`DEBUG: Repo ${repo} response that will be returned`);
  core.debug(JSON.stringify(repoDetails, null, 2));

  return repoDetails;
}

async function getReposList(octokit, owner) {
  let isUser;
  let response;

  core.startGroup(`Getting list of all repositories owned by ${owner}`);
  /*
  * Checking if action runs for organization or user as then to list repost there are different api calls
  */
  try {
    await octokit.orgs.get({
      org: owner,
    });

    isUser = false;
  } catch (error) {
    if (error.status === 404) {
      try {
        await octokit.users.getByUsername({
          username: owner,
        });
        isUser = true;
      } catch (error) {
        throw new Error(`Invalid user/org: ${  error}`);
      }
    } else {
      throw new Error(`Failed checking if workflow runs for org or user: ${  error}`);
    }
  }

  /*
  * Getting list of repos
  */
  if (isUser) {
    response = await octokit.paginate(octokit.repos.listForUser, {
      username: owner,
      per_page: 100
    });
  } else {
    response = await octokit.paginate(octokit.repos.listForOrg, {
      org: owner,
      per_page: 100
    });
  }

  const reposList = response.map((repo) => {
    return {
      name: repo.name,
      url: repo.html_url,
      id: repo.node_id,
      defaultBranch: repo.default_branch,
      private: repo.private,
      fork: repo.fork,
      archived: repo.archived,
      topics: repo.topics,
    };
  });

  core.debug(`DEBUG: list of repositories for ${owner}:`);
  core.debug(JSON.stringify(reposList, null, 2));
  core.endGroup();

  return reposList;
}

async function createPr(octokit, branchName, id, commitMessage, defaultBranch) {
  const createPrMutation =
    `mutation createPr($branchName: String!, $id: ID!, $commitMessage: String!, $defaultBranch: String!) {
      createPullRequest(input: {
        baseRefName: $defaultBranch,
        headRefName: $branchName,
        title: $commitMessage,
        repositoryId: $id
      }){
        pullRequest {
          url
        }
      }
    }
    `;

  const newPrVariables = {
    branchName,
    id,
    commitMessage,
    defaultBranch
  };

  let retries = 5;
  let count = 0;

  while (retries-- > 0) {
    count++;
    try {
      core.info('Waiting 5sec before PR creation');
      await sleep(5000);
      core.info(`PR creation attempt ${count}`);
      const { createPullRequest: { pullRequest: { url: pullRequestUrl } } } = await octokit.graphql(createPrMutation, newPrVariables);
      retries = 0;
      return pullRequestUrl;
    } catch (error) {
      //if error is different than rate limit/timeout related we should throw error as it is very probable that
      //next PR will also fail anyway, we should let user know early in the process by failing the action
      if (error.message !== 'was submitted too quickly') {
        throw new Error(`Unable to create a PR: ${  error}`);
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
