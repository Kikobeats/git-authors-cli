#!/usr/bin/env node
'use strict'

const emailRegex = require('email-regex')
const existsFile = require('exists-file')
const jsonFuture = require('json-future')
const colors = require('picocolors')
const execa = require('execa')
const path = require('path')

const rootPkg = require('../package.json')

require('update-notifier')({ pkg: rootPkg }).notify()

const TTY = process.platform === 'win32' ? 'CON' : '/dev/tty'

const BOT_NAMES = ['ImgBotApp', 'greenkeeper', 'noreply', '\\bbot\\b', 'Travis CI']

const REGEX_BOT_NAMES = new RegExp(BOT_NAMES.join('|'), 'i')

const isString = value => typeof value === 'string'

const REGEX_EMAIL_VARIATIONS = /[.+]/g

const normalizeEmail = email => email.toLowerCase().replace(REGEX_EMAIL_VARIATIONS, '')

const isSameEmail = (email1 = '', email2 = '') => normalizeEmail(email1) === normalizeEmail(email2)

const processError = err => {
  console.log('err', err)
  console.log(colors.red(err.message || err))
  process.exit(1)
}

const cli = require('meow')({
  pkg: rootPkg,
  help: require('./help'),
  flags: {
    cwd: {
      type: 'string',
      default: process.cwd()
    },
    print: {
      type: 'boolean',
      default: true
    },
    save: {
      type: 'boolean',
      default: true
    },
    ignorePattern: {
      type: 'string',
      isMultiple: true,
    }
  }
})

const loadPkg = path => {
  try {
    return jsonFuture.loadAsync(path)
  } catch (err) {
    return null
  }
}

const getMaxIndent = (contributors, propName) => {
  const sorted = contributors.sort((c1, c2) => c2[propName] - c1[propName])
  const first = sorted[0][propName]
  return String(first).length
}

const indent = (maxIndentation, prop = '') => {
  const indentSize = maxIndentation - String(prop).length
  return Array.from({ length: indentSize }, () => ' ').join('')
}

const renderContributors = (contributors, maxIndent) => {
  console.log()
  contributors.forEach(({ author, commits, name, email }) => {
    const prettyAuthor = colors.gray(author.replace(name, colors.white(name)))
    const prettyCommits = colors.white(`${indent(maxIndent, commits)}${commits}`)
    console.log(`  ${prettyCommits}  ${prettyAuthor}`)
  })
}

const gitLogExtractor = /^\s*(\d*)\s*((.*)<(.*)>)$/gim
const extractContributors = stdout => {
  const result = []
  let item
  while ((item = gitLogExtractor.exec(stdout))) {
    if (item[1] && item[2] && item[3] && item[4]) {
      result.push({
        author: item[2].trim(),
        commits: Number(item[1].trim()),
        email: item[4].trim(),
        name: item[3].trim()
      })
    }
  }
  return result
}

const getContributors = async () => {
  if (!(await existsFile('.git'))) {
    return processError({
      message: 'Ops, not git directory detected!'
    })
  }

  const { print, cwd, save, ignorePattern } = cli.flags
  const pkgPath = path.join(cwd, 'package.json')
  const cmd = `git shortlog -sne < ${TTY}`
  const { stdout, stderr } = await execa.command(cmd, { cwd, shell: true })

  if (stderr) return processError(stderr)

  const { author: pkgAuthor = {} } = require(pkgPath)
  const ignorePatternReg = (ignorePattern.length === 0) ? undefined : new RegExp(`(${ignorePattern.join('|')})`,'i');

  const contributors = extractContributors(stdout)
    .reduce((acc, contributor) => {
      const index = acc.findIndex(({ email }) => isSameEmail(email, contributor.email))
      const isPresent = index !== -1
      if (!isPresent) return acc.concat(contributor)
      acc[index].commits += contributor.commits
      return acc
    }, [])
    .reduce((acc, contributor) => {
      const index = acc.findIndex(({ name }) => name === contributor.name)
      const isPresent = index !== -1
      if (!isPresent) return acc.concat(contributor)
      acc[index].commits += contributor.commits
      return acc
    }, [])
    .filter(({ name }) => !REGEX_BOT_NAMES.test(name))
    .filter(({ email }) =>
      isString(pkgAuthor)
        ? !new RegExp(pkgAuthor, 'i').test(email)
        : !isSameEmail(pkgAuthor.email, email)
    )
    .filter(({ email }) => emailRegex().test(email))
    .filter(({ author }) => !(ignorePatternReg && ignorePatternReg.test(author)))
    .sort((c1, c2) => c2.commits - c1.commits)

  const maxIndent = contributors.length ? getMaxIndent(contributors, 'commits') : ''

  if (contributors.length) {
    if (print) renderContributors(contributors, maxIndent)
    const pkg = await loadPkg(pkgPath)

    if (pkg && save) {
      const newContributors = contributors.map(({ author }) => author)
      const newPkg = { ...pkg, contributors: newContributors }
      await jsonFuture.saveAsync(pkgPath, newPkg)
      if (print) {
        console.log(
          `\n${indent(maxIndent)} ${colors.gray(`Added into ${colors.white('package.json')} ✨`)}`
        )
      }
    }
  }
}

getContributors().catch(processError)
