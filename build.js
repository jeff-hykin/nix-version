#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync, writeFile } = require("fs")
const { spawnSync } = require('child_process')

// may need to increase the amount of memory available
// export NODE_OPTIONS="--max-old-space-size=20480" #increase to 20gb

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
    let cleanListOfCommitHashes = listOfCommitHashes.map(each=>each.replace(/\"/g, "")).filter(each=>each.length).reverse()
    writeFile("./commits.json", JSON.stringify(cleanListOfCommitHashes, 0, 4))
    // remove the redundant quotes, remove empty strings
    return cleanListOfCommitHashes
}

function getAllPackagesIn(hash, existingPackageInfo={}, hashIndex) {
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

    // reformat them by name
    for (let [ _, name, version ] of packages) {
        // create package if it doesn't exist
        if (!(existingPackageInfo[name] instanceof Object)) {
            existingPackageInfo[name] = {}
        }
        // add version if it didn't exist before
        if (!(existingPackageInfo[name][version] instanceof Object)) {
            existingPackageInfo[name][version] = {}
        }
        // add hash sources
        if (!(existingPackageInfo[name][version].commits instanceof Array)) {
            existingPackageInfo[name][version].commits = []
        }
        // add this commit
        existingPackageInfo[name][version].commits.push(hashIndex)
    }
    return existingPackageInfo
}

function savePackagesTo(packages, folderLocation) {
    const path = require("path")
    let packageNumber = 0
    let totalNumber = Object.keys(packages).length
    for (const [eachPackageName, eachValue] of Object.entries(packages)) {
        packageNumber++
        
        let filePath = path.join(folderLocation, eachPackageName+".json")
        if (packageNumber % 1000 == 0) {
            console.log(`saving package ${packageNumber}/${totalNumber} to ${filePath}`)
        }
        writeFile(filePath, JSON.stringify(eachValue))
    }
}

let commits = allCommitsInCwd()
let [start, end] = [ (process.argv[2]||0)-0, (process.argv[3]||commits.length)-0]
commits = commits.slice(start, end)

// took 1d 21h 31m 40s to run this though 24392 commits
let packages = {}
for (const [index, eachCommit] of Object.entries(commits)) {
    console.log(`on commit ${(index+1)+start}/${commits.length+start}`)
    packages = getAllPackagesIn(eachCommit, packages, index)
    // every 100 commits (starting after the 5th commit), write to disk encase there is an error
    if ((index-5) % 100 == 0) {
        savePackagesTo(`./packages.json`)
    }
}