const github = require('@actions/github');
const core = require('@actions/core');
/*
const path = require('path');
const simpleGit = require('simple-git');
const {mkdir} = require('fs').promises;
const klaw = require('klaw');
const {createBranch, clone} = require('./utils');
*/
const eventPayload = require(process.env.GITHUB_EVENT_PATH || '../test/fake-event.json');

async function run() {
  const gitHubKey = process.env.GITHUB_TOKEN || core.getInput('github_token', { required: true });

  const octokit = github.getOctokit(gitHubKey);
  const commitId = eventPayload.commits[0].id;

  const {data: res} = await octokit.repos.getCommit({
    owner: 'lukasz-lab',
    repo: '.github',
    ref: commitId
  });

  console.log(res);
}

run();