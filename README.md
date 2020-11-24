# Global Workflows Support
GitHub Action that introduces support for global workflows. Global actions are the ones that you update in just one repo and then they are automatically updated in other repositories in your organization or user account.



## Why I Created It?

It seems like GitHub is [not going](https://github.community/t/plans-to-support-global-workflows-in-github-repository/17899) to support global workflows anytime soon. This is why I decided to create this action as I was just super tired editing the same workflow files in over 30 repositories manually. Actually, to be honest, I never did it, I never did it manually and could not imagine I do it.

Maybe GitHub will support global workflows some day. I take it into account and suggest you to put global workflows in repository called `.github` because once GitHub starts supporting global workflows, they will for sure have to be located there. Read more about `.github` repository [here](https://docs.github.com/en/free-pro-team@latest/github/building-a-strong-community/creating-a-default-community-health-file).


## Configuration

## Examples

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