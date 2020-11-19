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
  const gitHubKey = core.getInput('github_token') || process.env.GITHUB_TOKEN;

  const octokit = github.getOctokit(gitHubKey);

  console.log(JSON.stringify(eventPayload, null, 4));
}

run();