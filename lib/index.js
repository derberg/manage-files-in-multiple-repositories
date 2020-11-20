const github = require('@actions/github');
const core = require('@actions/core');
const simpleGit = require('simple-git');
const {createBranch, clone, push} = require('./utils');
const path = require('path');
const { mkdir } = require('fs').promises;
const { copy } = require('fs-extra');

const eventPayload = require(process.env.GITHUB_EVENT_PATH || '../test/fake-event.json');

async function run() {
  const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });

  const octokit = github.getOctokit(gitHubKey);
  const commitId = eventPayload.commits[0].id;

  const {data: {files}} = await octokit.repos.getCommit({
    owner: 'lukasz-lab',
    repo: '.github',
    ref: commitId
  });

  const changedFilename = files[0].filename;

  if (!changedFilename.includes('.github/workflows')) return;

  const reposListQuery = `
  query {
    user(login: "lukasz-lab") {
      repositories(first: 100) {
        nodes {
          ... on Repository {
            url
            name
            id
          }
        }
      }
    }
  }
  `;

  const { user: { repositories: { nodes: reposList } } } = await octokit.graphql(reposListQuery);

  for (const {url, name, id} of reposList) {
    const dir = path.join(process.cwd(), './clones', name);
    await mkdir(dir, {recursive: true});
    const branchName = `bot/update-global-workflow-${commitId}`;
    const git = simpleGit({baseDir: dir});
    await clone(url, dir, git);
    await createBranch(branchName, git);
    await copy(path.join(process.cwd(),changedFilename), path.join(dir,changedFilename));
    await push(gitHubKey, url, branchName, 'Update global workflows', git);

    const createPrMutation =
    `mutation createPr($branchName: String!, $id: String!) {
      createPullRequest(input: {
        baseRefName: "master",
        headRefName: $branchName,
        title: "Update global workflows",
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
      id
    };
    const { createPullRequest: { pullRequest: { url: pullRequestUrl } } } = await octokit.graphql(createPrMutation, newPrVariables);

    console.log(`Entire workflow works like a charm, PR for ${name} is created -> ${pullRequestUrl}`);
  }
}

run();
