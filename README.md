# Global Workflows Support
GitHub Action that introduces support for global workflows. Global workflows are the ones that you update in just one repo, and then they are automatically updated in other repositories in your organization or user account.

> Action is released under **v0.2.0**, and I plan to extend it forward, add tests and release under **v1** once I get other people using it. Feel free to create an issue about it.

<!-- toc -->

- [Why I Created This Action?](#why-i-created-this-action)
- [Supported Event Triggers](#supported-event-triggers)
- [Action Flow](#action-flow)
- [Configuration](#configuration)
- [Examples](#examples)
  * [Minimum Workflow](#minimum-workflow)
  * [Advanced Workflow](#advanced-workflow)
- [Development](#development)
- [Known Limitations/Hardcodes](#known-limitationshardcodes)
- [Debug](#debug)

<!-- tocstop -->

## Why I Created This Action?

It seems like GitHub is [not going](https://github.community/t/plans-to-support-global-workflows-in-github-repository/17899) to support global workflows anytime soon. I decided to create this action as I was just super tired of manually editing the same workflow files in over 30 repositories. To be honest, I never did it; I never did it manually and could not imagine I do it :smiley:

Maybe GitHub will support global workflows someday. Take it into account and put global workflows in a repository called `.github` because once GitHub starts supporting global workflows, they will surely have to be located there. Read more about `.github` repository [here](https://docs.github.com/en/free-pro-team@latest/github/building-a-strong-community/creating-a-default-community-health-file).

## Supported Event Triggers

This action can be triggered by:
- **push** event and only files that were changed in the commit are replicated to other repositories.
- **workflow_dispatch** event and then all files from workflow directory (except of ignored ones) are replicated to other repositories. Use case for this event is when you create new repositories in your organization that need to get global workflows. Then you can manually trigger the action and all global workflows will be updated in all repositories. Below screen shots shows how manual triggering works.

  <img src="workflow_dispatch.jpg" alt="flow diagram" width="40%">

## Action Flow

 <img src="diagram.png" alt="flow diagram" width="40%"> 

## Configuration

Name | Description | Required | Default
--|------|--|--
github_token | Token to use GitHub API. It must have "repo" and "workflow" scopes so it can push to repo and edit workflows. It cannot be the default GitHub Actions token GITHUB_TOKEN. GitHub Action token's permissions are limited to the repository that contains your workflows. Provide token of the user who has the right to push to the repos that this action is supposed to update. The same token is used for pulling repositories - important to know for those that want to use this action with private repositories. | true | -
files_to_ignore | Comma-separated list of workflow files that should be ignored by this action and not updated in other repositories. You must provide here at least the name of the workflow file that uses this action. In the format `file.yml,another_file.yml`. | true | -
committer_username | The username (not display name) of the committer will be used to commit changes in the workflow file in a specific repository. In the format `web-flow`. | false | `web-flow`
committer_email | The committer's email that will be used in the commit of changes in the workflow file in a specific repository. In the format `noreply@github.com`.| false | `noreply@github.com`
commit_message | It is used as a commit message when pushing changes with global workflows. It is also used as a title of the pull request that is created by this action. | false | `Update global workflows`
repos_to_ignore | Comma-separated list of repositories that should not get updates from this action. Action already ignores the repo in which the action is triggered so you do not need to add it explicitly. In the format `repo1,repo2`. | false | -
topics_to_include | Comma-separated list of topics that should get updates from this action. Repos that do not contain one of the specified topics will get appended to the repos_to_ignore list. In the format `topic1,topic2`. | false | -
exclude_private | Boolean value on whether to exclude private repositories from this action. | false | false

## Examples

### Minimum Workflow

```yml
name: Global workflow to rule them all

on:
  push:
    branches: [ master ] #or main
  workflow_dispatch: {} #to enable manual triggering of the action

jobs:

  replicate_changes:

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: derberg/global-workflows-support@v0.6.0
        with:
          github_token: ${{ secrets.CUSTOM_TOKEN }}
          files_to_ignore: name_of_file_where_this_action_is_used.yml
```

### Advanced Workflow

1. In your `.github` repo you could have the following workflow:
    ```yml
    name: Global workflow to rule them all

    on:
      push:
          branches: [ master ] #or main

    jobs:

      replicate_changes:

          runs-on: ubuntu-latest

          steps:
            - name: Checkout repository
              uses: actions/checkout@v2
            - name: Replicating global workflow
              uses: derberg/global-workflows-support@v0.6.0
              with:
                github_token: ${{ secrets.CUSTOM_TOKEN }}
                files_to_ignore: name_of_file_where_this_action_is_used.yml
                repos_to_ignore: repo1,repo2
                topics_to_include: topic1,topic2
                exclude_private: true
                committer_username: santiago-bernabeu
                committer_email: my-email@me.com
                commit_message: "ci: update global workflows"
    ```
2. In repositories that will be updated by this workflow, you can have the following auto-merge workflow file:
    ```yml
    name: Automerge release bump PR

    on:
      pull_request:
          types:
          - labeled
          - unlabeled
          - synchronize
          - opened
          - edited
          - ready_for_review
          - reopened
          - unlocked
      pull_request_review:
          types:
          - submitted
      check_suite: 
          types:
          - completed
      status: {}
    
    jobs:

      automerge:
          runs-on: ubuntu-latest
          steps:
          - name: Automerging
            uses: pascalgn/automerge-action@v0.7.5
            #the actor that created pr
            if: github.actor == 'github-username-that-owns-token-used-in-global-workflow'
            env:
              GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
              GITHUB_LOGIN: santiago-bernabeu
              MERGE_LABELS: ""
              MERGE_METHOD: "squash"
              MERGE_COMMIT_MESSAGE: "pull-request-title"
              MERGE_RETRIES: "10"
              MERGE_RETRY_SLEEP: "10000"
    ```

## Development

```bash
# GITHUB_TOKEN provide personal GitHub token with scope to push to repos
# GITHUB_REPOSITORY provide name of org/user and the repo in which this workflow is suppose to run
# GITHUB_EVENT_PATH is a path to local file with dummy event payload for testing
# GITHUB_EVENT_NAME is the name of the event that triggers the event
GITHUB_TOKEN=token GITHUB_EVENT_NAME=push GITHUB_EVENT_PATH="../test/fake-event.json" GITHUB_REPOSITORY="lukasz-lab/.github" npm start
```

## Known Limitations/Hardcodes

* Action looks for file changes only in `.github/workflows` because it intends to support only global workflows and not any files. This is, of course something that can be changed. Please create an issue to discuss this change further.
* Action assumes that when triggered by **push** event, it has information only about one commit. It is very common for many projects and organizations to merge only of single commit or merging and squashing commits into one. If you see a need to support multiple commits on a **push** event, please open an issue and describe your use case and expected behavior.
* Action requires you to provide `files_to_ignore` as you need to remember to put there the name of the workflow file where you use this action. Yes, you need to manually provide the file's name as I [did not find](https://github.community/t/how-can-i-get-the-name-of-the-workflow-file-of-the-workflow-that-was-triggered/145216) a nice way how, in the workflow, I can access information about the name of the workflow file. The only idea I have, which is not the best and requires some additional effort, is to read `GITHUB_WORKFLOW` variable and then read the workflow files' contents to match the name. I hope you have something better.

## Debug

In case something ain't right, the action doesn't work as expected, enable debugging. Add to **Secrets** of the repository a secret called `ACTIONS_STEP_DEBUG` with value `true`. Now, once you run the action again, there will be additional logs visible that start with `DEBUG: `.