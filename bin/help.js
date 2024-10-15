'use strict'

const { gray, white } = require('picocolors')
const pkg = require('../package.json')

module.exports = white(`
  ${pkg.description}

  Usage
    ${gray('$')} git-authors-cli ${gray('[options]')}

  Options
    ${gray('--')}cwd ${gray('Specify the path for running the command (defaults to process.cwd())')}
    ${gray('--')}ignore-pattern ${gray(
  'Skip authors if their name or email match pattern (allow multiple)'
)}
    ${gray('--')}print ${gray(
  'Show information from the terminal, also `print=verbose` to show more information. (defaults to true)'
)}
    ${gray('--')}save ${gray(
  'Write contributors into package.json if it exists (defaults to true)'
)}

  Examples
    ${gray('$')} git-authors-cli ${gray('# Get contributors for the current path project.')}
    ${gray('$')} git-authors-cli ~/Projects/metascraper ${gray(
  '# Get contributors for a specific path project.'
)}
    ${gray('$')} git-authors-cli --ignore-pattern noreply.github.com ${gray(
  '# Ignore github public surrogate emails.'
)}`)
