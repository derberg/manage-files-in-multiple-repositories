const { parseCommaList } = require('./utils');

module.exports = {ignoredByTopics, archivedRepositories};

/**
 * Getting list of topics that should be included if topics_to_include is set.
 * Further on we will get a list of repositories that do not belong to any of the specified topics.
 * 
 * @param  {Array} topicsToInclude Array of topics to inlcude.
 * @param  {Array} reposList All the repositories.
 * @returns {Array} List of all repositories to exclude.
 */
function ignoredByTopics(topicsToInclude, reposList) {
  const includedTopics = topicsToInclude ? parseCommaList(topicsToInclude) : [];

  if (!includedTopics.length) return;

  return reposList.filter(repo => {
    return includedTopics.some(topic => repo.topics.includes(topic)) === false;
  }).map(reposList => reposList.name);
}

/**
 * Getting list of archived sites to be ignored if exclude_archived is true.
 * 
 * @param  {Array} reposList All the repositories.
 * @returns {Array} List of all archived repositories.
 */
function archivedRepositories(reposList) {
  return reposList.filter(repo => {
    return repo.archived === true;
  }).map(reposList => reposList.name);
}