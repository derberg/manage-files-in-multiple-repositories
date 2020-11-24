# global-actions-support
GitHub Action that introduces support for global actions. Global actions are the one you update in just one repo and they are automatically updated in other repositories.



## Limitations/Missing

- remember to put in docs info about required token scopes, like repo and workflow
- master/main issue for PRs
- add proper try/catch and setting failure with core package
- add clear info about GITHUB_TOKEN that if someone wants to use different than GitHub Action, then they need to make sure the other account has rights to push to repositories it is suppose to update.

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