const { getPushFiles } = require('./api-calls');

describe('getPushFiles', () => {
  it('should compare the complete push range', async () => {
    const files = [
      { filename: 'CODE_OF_CONDUCT.md', status: 'modified' },
      { filename: 'SECURITY.md', status: 'modified' }
    ];
    const octokit = {
      repos: {
        compareCommits: jest.fn().mockResolvedValue({ data: { files } })
      }
    };

    const receivedFiles = await getPushFiles(octokit, 'before-sha', 'after-sha', 'owner', 'repo');

    expect(octokit.repos.compareCommits).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      base: 'before-sha',
      head: 'after-sha'
    });
    expect(receivedFiles).toEqual(files);
  });

  it('should inspect the head commit when a branch is created', async () => {
    const files = [{ filename: 'CODE_OF_CONDUCT.md', status: 'added' }];
    const octokit = {
      repos: {
        getCommit: jest.fn().mockResolvedValue({ data: { files } })
      }
    };

    const receivedFiles = await getPushFiles(octokit, '0000000000000000000000000000000000000000', 'after-sha', 'owner', 'repo');

    expect(octokit.repos.getCommit).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'after-sha'
    });
    expect(receivedFiles).toEqual(files);
  });
});
