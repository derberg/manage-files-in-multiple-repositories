# global-actions-support
GitHub Action that introduces support for global actions. Global actions are the one you update in just one repo and they are automatically updated in other repositories.



## Limitations/Missing

- For now we are hardcoded to always pick first commit from event and first file from list of modified files
- For now we are hardcoded to support just users and not organizations (on graphql api level)
- allow user to configure/provide a custom message for the commit
- remember to put in docs info about required token scopes, like repo and workflow
- master/main issue for PRs


## Development

```bash
# GITHUB_TOKEN provide personal GitHub token with scope to push to repos
# GITHUB_REPOSITORY provide name of org/user and the repo in which this workflow is suppose to run
GITHUB_TOKEN=token GITHUB_REPOSITORY="lukasz-lab/.github" npm start
```