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
  const reposListQuery = `
    query getReposList($owner: String!){
        user(login: $owner) {
            repositories(first: 100) {
                nodes {
                    ... on Repository {
                        name
                        url
                        id
                        defaultBranchRef {
                            name
                        }
                    }
                }
            }
        }
        organization(login: $owner) {
            repositories(first: 100) {
                nodes {
                    ... on Repository {
                        name
                        url
                        id
                        defaultBranchRef {
                            name
                        }
                    }
                }
            }
        }
    }  
  `;

  const reposListVariables = {
    owner
  };
  
  /*
    Handling it in such a strange way to always return from catch as I could not find
    a better way of getting repos list either from users or organizations
  */
  try {
    await octokit.graphql(reposListQuery, reposListVariables);
  } catch (error) {
    const org = error.data.user;
    const user = error.data.organization;
    core.debug('DEBUG: Full response from graphql with list of repositories for org or user. There will always be an error for one node, user or organization, because we are always asking for both. Look into code to understan why', JSON.stringify(error.data, null, 2));

    return org ? org.repositories.nodes : user.repositories.nodes;
  }
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
      //if error is different than rate limit/timeout related we can already stop by changing counter to 0
      if (error.message !== 'was submitted too quickly') retries = 0;
      //we throw error not only because of above but also when counter goes to 0 when all retires are done
      if (retries = 0) throw new Error(`unable to submit PR: ${  error}`);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}