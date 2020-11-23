# global-actions-support
GitHub Action that introduces support for global actions. Global actions are the one you update in just one repo and they are automatically updated in other repositories.



## Limitations/Missing

- For now we are hardcoded to always pick first commit from event and first file from list of modified files
- For now we are hardcoded to support just users and not organizations (on graphql api level)
- `bot/update-workflow` make it better, add commit id from .github repository, the one that triggered workflow update
- make sure to always ignore the repository in which the action runs, so if action is used in .github then this repo should be ignored when replicating the change
- allow user to configure/provide a custom message for the commit
- remember to put in docs info about required token scopes, like repo and workflow
- master/main issue for PRs