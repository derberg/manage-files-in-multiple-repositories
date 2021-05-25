const core = require('@actions/core');

module.exports = { getCommitFiles, getReposList, createPr };

async function getCommitFiles(octokit, commitId, owner, repo) {
  const { data: { files } } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: commitId
  });

  return files;
}

async function getReposList(octokit, owner) {
  let isUser;
  let response;

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
  
  return response.map((repo) => {
    return { 
      name: repo.name,
      url: repo.html_url,
      id: repo.node_id,
      defaultBranch: repo.default_branch,
      archived: repo.archived,
      topics: repo.topics,
    };
  });
}

async function createPr(octokit, branchName, id, commitMessage, defaultBranch) {
  const createPrMutation =
    `mutation createPr($branchName: String!, $id: String!, $commitMessage: String!, $defaultBranch: String!) {
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