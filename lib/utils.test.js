const { filterOutMissingBranches, filterOutFiles, getFilteredFilesList, getFileName } = require('./utils');

describe('getFileName', () => {
  it('should filter out only filename with extension', async () => {
    const filePath = './github/workflows/another_file.yml';

    const expectedFileName = 'another_file.yml';

    const receivedFileName = getFileName(filePath);

    expect(receivedFileName).toEqual(expectedFileName);
  });
})

describe('getFilteredFilesList', () => {
  it('should filter out ignored files and include only given pattern', async () => {
    const ignoredPatterns = './github/workflows/another_file.yml';
    const includePatterns = './github/workflows';
    const allFiles = [
      './github/workflows/main.yml',
      './github/workflows/next.yml',
      './github/workflows/another_file.yml',
      'some_other_file.md'
    ];

    const expectedAfterFiltering = [
      './github/workflows/main.yml',
      './github/workflows/next.yml'
    ];

    const afterFiltering = getFilteredFilesList(allFiles, ignoredPatterns, includePatterns);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });

  it('should filter out and return empty array', async () => {
    const ignoredPatterns = './github/workflows';
    const includePatterns = './github/workflows';
    const allFiles = [
      './github/workflows/main.yml',
      './github/workflows/next.yml',
      './github/workflows/another_file.yml',
    ];

    const expectedAfterFiltering = [];

    const afterFiltering = getFilteredFilesList(allFiles, ignoredPatterns, includePatterns);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });

})

describe('filterOutFiles', () => {
  it('should filter out ignored files', async () => {
    const ignoredFiles = '/test/path1/main.yml,/test/path2/next.yml';
    const allFiles = [
      '/test/path1/main.yml',
      '/test/path2/next.yml',
      '/test/path3/another.yml',
    ];

    const expectedAfterFiltering = [
      '/test/path3/another.yml'
    ];

    const afterFiltering = filterOutFiles(allFiles, ignoredFiles, true);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });

  it('should filter out ignored files and return empty array', async () => {
    const ignoredFiles = '/test/path1/main.yml,/test/path2/next.yml';
    const allFiles = [
      '/test/path1/main.yml',
      '/test/path2/next.yml',
    ];

    const expectedAfterFiltering = [];

    const afterFiltering = filterOutFiles(allFiles, ignoredFiles, true);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });

  it('should filter out files that do not match given pattern', async () => {
    const patterns = '.github/workflows';
    const allFiles = [
      '/test/path1/main.yml',
      '/test/path2/next.yml',
      '/test/path3/another.yml',
      '.github/workflows/test/path3/another.yml'
    ];

    const expectedAfterFiltering = ['.github/workflows/test/path3/another.yml'];

    const afterFiltering = filterOutFiles(allFiles, patterns, false);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });

  it('should filter out files that do not match given pattern and return empty array', async () => {
    const patterns = '.github/workflows';
    const allFiles = [
      '/test/path1/main.yml',
      '/test/path2/next.yml',
      '/test/path3/another.yml'
    ];

    const expectedAfterFiltering = [];

    const afterFiltering = filterOutFiles(allFiles, patterns, false);
    
    expect(afterFiltering).toEqual(expectedAfterFiltering);
  });
});

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
      },
      {
        name: 'not-main-branch'
      },
      {
        name: 'main-not-i-am'
      },
      {
        name: 'i-am-not-main'
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