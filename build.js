#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync } = require("fs")
const { spawnSync } = require('child_process')

function findAll(regexPattern, sourceString) {
    let output = []
    let match
    // make sure the pattern has the global flag
    let regexPatternWithGlobal = RegExp(regexPattern,"g"+regexPattern.flags)
    while (match = regexPatternWithGlobal.exec(sourceString)) {
        // get rid of the string copy
        delete match.input
        // store the match data
        output.push(match)
    } 
    return output
}

function run(...args) {
    let [ command, ...commandArgs ] = args
    let commandResult = spawnSync(command, commandArgs)
    return {
        // remove all the ANSI escape codes (colors)
        stdout: commandResult.stdout.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ""),
        stderr: commandResult.stderr.toString().replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ""),
        exitCode: commandResult.status,
    }
}

function allCommitsInCwd() {
    let stringOfCommitHashes = run("git", "log", '--format="%H"').stdout
    let listOfCommitHashes = stringOfCommitHashes.split("\n")
    let cleanListOfCommitHashes = listOfCommitHashes.map(each=>each.replace(/\"/g, "")).filter(each=>each.length)
    writeFileSync("./commit-hashes.json", JSON.stringify(cleanListOfCommitHashes, 0, 4))
    // remove the redundant quotes, remove empty strings
    return cleanListOfCommitHashes
}

function getAllPackagesIn(hash) {
    let output
    if (hash == null) {
        // --attr-path is the unqie name for nix-env install
        output = run('nix-env', "-aq", "--attr-path", "--available").stdout
    } else {
        // nix-env -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/${COMMIT_HASH}.tar.gz -aq --attr-path --available
        // TODO: get name and metadata of package using --description --meta --json
        // right now (on a particular package, not sure which) those options cause an error on mac
        output = run('nix-env', "-I", `nixpkgs=https://github.com/NixOS/nixpkgs/archive/${hash}.tar.gz`, "-aq", "--attr-path", "--available").stdout
    }
    // extract the names and versions
    let packages = findAll(/nixpkgs\.(\S+)\s+(.+)/, output)
    packages = packages.map(each=>({ evalName: each[1], version: each[2] }))

    // reformat them by name
    let versionIndex = {}
    for (let each of packages) {
        versionIndex[each.evalName] || (versionIndex[each.evalName] = {})
        versionIndex[each.evalName][each.version] || (versionIndex[each.evalName][each.version] = {})
        versionIndex[each.evalName][each.version].hash = hash
    }
    return versionIndex
}


let commits = allCommitsInCwd()

let packages = {}
let index = 0
for (let each of commits.reverse()) {
    index++
    console.log(`on commit ${index} of ${commits.length}`)
    packages = {...packages, ...getAllPackagesIn(each)}
    writeFileSync("./packages.json", JSON.stringify(packages,0,4))
}