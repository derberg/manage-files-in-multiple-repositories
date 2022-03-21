const { filterOutMissingBranches } = require('./utils');

describe('filterOutMissingBranches', () => {
  it('should filter out missing branches', async () => {
    const defaultBranch = 'main';
    const branchesRequested = 'main,next,next-major';
    const branchesExisting = [
      {
        name: 'main'
      },
      {
        name: 'next'
      }
    ];

    const expectedBranchesAfterFiltering = [
      {
        name: 'main'
      },
      {
        name: 'next'
      }
    ];

    const branchesAfterFiltering = filterOutMissingBranches(branchesRequested, branchesExisting, defaultBranch);
    
    expect(branchesAfterFiltering).toEqual(expectedBranchesAfterFiltering);
  });

  it('should include branches by regex', async () => {
    const defaultBranch = 'main';
    const branchesRequested = 'main,next,.*-release';
    const branchesExisting = [
      {
        name: 'june-2022-release'
      },
      {
        name: 'july-2022-release'
      },
      {
        name: 'release'
      }
    ];

    const expectedBranchesAfterFiltering = [
      {
        name: 'june-2022-release'
      },
      {
        name: 'july-2022-release'
      }
    ];

    const branchesAfterFiltering = filterOutMissingBranches(branchesRequested, branchesExisting, defaultBranch);
    
    expect(branchesAfterFiltering).toEqual(expectedBranchesAfterFiltering);
  });

  it('should filter return empty array if no branches exist', async () => {
    const defaultBranch = 'main';
    const branchesRequested = 'next-major';
    const branchesExisting = [
      {
        name: 'next'
      }
    ];

    const expectedBranchesAfterFiltering = [];

    const branchesAfterFiltering = filterOutMissingBranches(branchesRequested, branchesExisting, defaultBranch);
    
    expect(branchesAfterFiltering).toEqual(expectedBranchesAfterFiltering);
  });

  it('should return default branch if others not requested', async () => {
    let branchesRequested;
    const defaultBranch = 'main';
    const branchesExisting = [
      {
        name: 'main'
      },
      {
        name: 'next'
      }
    ];

    const expectedBranchesAfterFiltering = [
      {
        name: 'main'
      }
    ];

    const branchesAfterFiltering = filterOutMissingBranches(branchesRequested, branchesExisting, defaultBranch);
    
    expect(branchesAfterFiltering).toEqual(expectedBranchesAfterFiltering);
  });
});