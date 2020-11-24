module.exports = { getReposList, createPr, getCommitFiles };

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

    return org ? org.repositories.nodes : user.repositories.nodes;
  }
}

async function createPr(octokit, branchName, id, commitMessage) {
  const createPrMutation =
    `mutation createPr($branchName: String!, $id: String!, $commitMessage: String!) {
      createPullRequest(input: {
        baseRefName: "master",
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
    commitMessage
  };

  const { createPullRequest: { pullRequest: { url: pullRequestUrl } } } = await octokit.graphql(createPrMutation, newPrVariables);

  return pullRequestUrl;
}

async function getCommitFiles(octokit, commitId, owner, repo) {
  const { data: { files } } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: commitId
  });

  return files;
}