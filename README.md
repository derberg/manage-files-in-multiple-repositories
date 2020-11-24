# Global Workflows Support
GitHub Action that introduces support for global workflows. Global workflows are the ones that you update in just one repo and then they are automatically updated in other repositories in your organization or user account.

> Action is released under **v0.0.2** and I plan to extend it forward, add tests and release under **v1** once I get other people using it. Feel free to create an issue.about it.

<!-- toc -->

- [Why I Created This Action?](#why-i-created-this-action)
- [Action Flow](#action-flow)
- [Configuration](#configuration)
- [Examples](#examples)
  * [Minimum Workflow](#minimum-workflow)
  * [Advanced Workflow](#advanced-workflow)
- [Development](#development)
- [Known Limitations/Hardcodes](#known-limitationshardcodes)

<!-- tocstop -->

## Why I Created This Action?

It seems like GitHub is [not going](https://github.community/t/plans-to-support-global-workflows-in-github-repository/17899) to support global workflows anytime soon. This is why I decided to create this action as I was just super tired editing the same workflow files in over 30 repositories manually. Actually, to be honest, I never did it, I never did it manually and could not imagine I do it.

Maybe GitHub will support global workflows some day. I take it into account and suggest you to put global workflows in repository called `.github` because once GitHub starts supporting global workflows, they will for sure have to be located there. Read more about `.github` repository [here](https://docs.github.com/en/free-pro-team@latest/github/building-a-strong-community/creating-a-default-community-health-file).

## Action Flow

 <img src="diagram.png" alt="flow diagram" width="40%"> 

## Configuration

Name | Description | Required | Default
--|------|--|--
github_token | Token to use GitHub API. It must have "repo" and "workflow" scopes so it can push to repo and edit workflows. It cannot be the default GitHub Actions token GITHUB_TOKEN. GitHub Action token's permissions are limited to the repository that contains your workflows. Provide token of the user that has rights to push to the repos that this action is suppose to update. | true | -
files_to_ignore | Comma-separated list of workflow files that should be ignored by this action and not updated in other repositories. You must provide here at least the name of the workflow file that uses this action. In the format `file.yml,another_file.yml`. | true | -
committer_username | The username (not display name) of the committer that will be used in the commit of changes in the workflow file in specific repository. In the format `web-flow`. | false | `web-flow`
committer_email | The email of the committer that will be used in the commit of changes in the workflow file in specific repository. In the format `noreply@github.com`.| false | `noreply@github.com`
commit_message | It is used as a commit message when pushing changes with global workflows. It is also used as a title of the pull request that is created by this action. | false | `Update global workflows`
repos_to_ignore | Comma-separated list of repositories that should not get updates from this action. Action already ignores the repo in which the action is triggered so you do not need to add it explicitly. In the format `repo1,repo2`. | false | -

## Examples

### Minimum Workflow

```yml
name: Global workflow to rule all other workflows

on:
  push:
    branches: [ master ]

jobs:

  replicate_changes:

    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: derberg/global-workflows-support@v0.0.2
        with:
          github_token: ${{ secrets.CUSTOM_TOKEN }}
          files_to_ignore: name_of_file_where_this_action_is_used.yml
```

### Advanced Workflow

1. In your `.github` repo you could have the following workflow:
    ```yml
    name: Global workflow to rule all other workflows

    on:
    push:
        branches: [ master ]

    jobs:

    replicate_changes:

        runs-on: ubuntu-latest

        steps:
        - name: Checkout repository
          uses: actions/checkout@v2
        - name: Replicating global workflow
          uses: derberg/global-workflows-support@v0.0.2
            with:
            github_token: ${{ secrets.CUSTOM_TOKEN }}
            files_to_ignore: name_of_file_where_this_action_is_used.yml
            repos_to_ignore: repo1,repo2
            committer_username: santiago-bernabeu
            committer_email: my-email@me.com
            commit_message: "ci: update global workflows"
    ```
2. In repositories that will be updated by this workflow you can have the following automerge workflow file:
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
        needs: [autoapprove]
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
GITHUB_TOKEN=token GITHUB_EVENT_PATH="../test/fake-event.json" GITHUB_REPOSITORY="lukasz-lab/.github" npm start
```

## Known Limitations/Hardcodes

* Action looks for file changes only in `.github/workflows` because the intention of this action is to support only global workflows and not any kind of files. This is of course something that can be changed. Please create an issue to further discuss this change.
* Action is limited to support only **push** event because only this even contains information about commits that were pushed to the repository.
* Action assumes that **push** event contains information only about one commit. It is very common for many projects and organizations to allow merging only of single commit or merging an squashing commits into one. If you really see a need to support multiple commits on a **push** event then please open an issue and describe your use case and expected behaviour.
* Action requires you to provide `files_to_ignore` as you need to remember to put there the name of the workflow file where you use this action. Yes, you need to manually provide the name of the file as I [did not find](https://github.community/t/how-can-i-get-the-name-of-the-workflow-file-of-the-workflow-that-was-triggered/145216) a nice way how, in the workflow I can access information about the name of the workflow file. The only idea I have, which is not the best and requires some additional effort, is to read `GITHUB_WORKFLOW` variable and then read contents of worflow files to match the name. I hope you have something better.