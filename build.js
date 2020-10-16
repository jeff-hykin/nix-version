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
        // --description --meta --json
        // nix-env -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/${COMMIT_HASH}.tar.gz -aq --attr-path --available
        output = run('nix-env', "-I", `nixpkgs=https://github.com/NixOS/nixpkgs/archive/${hash}.tar.gz`, "-aq", "--attr-path", "--available").stdout
    }
    // extract the names and versions
    let packages = findAll(/nixpkgs\.(\S+)\s+(.+)/, output)
    packages = packages.map(each=>({ evalName: each[1], version: each[2] }))
    writeFileSync("./packages.json", JSON.stringify(packages))

    // reformat them by name
    let versionIndex = {}
    for (let each of packages) {
        versionIndex[each.evalName] || (versionIndex[each.evalName] = {})
        versionIndex[each.evalName][each.version] || (versionIndex[each.evalName][each.version] = {})
        versionIndex[each.evalName][each.version].hash = hash
    }
    writeFileSync("./version-index.json", JSON.stringify(versionIndex,0,4))
    return versionIndex
}


let commits = allCommitsInCwd()

// TODO: change this to iterate
getAllPackagesIn(commits[0])
