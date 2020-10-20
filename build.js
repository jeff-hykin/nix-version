#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync, writeFile } = require("fs")
const { spawnSync, execSync } = require('child_process')

let pathFor = module.exports.pathFor = {
    packages: './packages',
    commits: './commits.json',
    nixShellNames: './nixShellPackageNames.json',
}

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
    writeFile(pathFor.commits, JSON.stringify(cleanListOfCommitHashes, 0, 4), {}, _=>0)
    // remove the redundant quotes, remove empty strings
    return cleanListOfCommitHashes
}

// load from file if possible
try { enumeratedShellNames = JSON.parse(readFileSync(pathFor.nixShellNames).toString()) } catch (error) { enumeratedShellNames = [] }
function enumeratePackageShellName(packageName) {
    let index = enumeratedShellNames.indexOf(packageName)
    if (index >= 0) {
        return index
    } else {
        enumeratedShellNames.push(packageName)
        // save changes
        writeFileSync(pathFor.nixShellNames, JSON.stringify(enumeratedShellNames))
        return enumeratedShellNames.length-1
    }
}


function getAllPackagesIn(hash, existingPackageInfo={}, hashIndex) {
    // get all the data from all the versions for that hash
    // The reason I'm using forEach is so that the garbage collector can easily/quickly free up the 
    // large amount of memory used by this file
    
    // the commentted-out line below fails, I think because of limitations with node.js
    //     let result = run('nix-env', "--query", "-f", `https://github.com/NixOS/nixpkgs-channels/archive/${hash}.tar.gz`, "--available", "--json").stdout
    // so instead we go with a jank shell-specific solution
    execSync(`nix-env --query -f 'https://github.com/NixOS/nixpkgs-channels/archive/${hash}.tar.gz' --available --json > ${__dirname}/.nosync.temp.json`)
    console.log(`now trying to parse`)
    Object.entries(
        JSON.parse(
            readFileSync("./.nosync.temp.json")
        )
    ).forEach(([ eachNixShellName, eachValue ]) => {
        
        // extract the desired data
        eachNixShellName = eachNixShellName.replace(/^nixpkgs\./, "")
        eachNixEnvName   = eachValue.name
        packageName      = eachValue.pname
        packageVersion   = eachValue.version
        
        slimmedDownValue[packageName] = {...slimmedDownValue[packageName]}
        slimmedDownValue[packageName][packageVersion] = {...slimmedDownValue[packageName][packageVersion]}
        slimmedDownValue[packageName][packageVersion].sources = [
            ...slimmedDownValue[packageName][packageVersion].sources,
            // which commit, what nix-env name, what nix-shell name
            { h: hashIndex, sn: enumeratePackageShellName(eachNixShellName), en: eachNixEnvName },
        ]
    })
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
        writeFile(filePath, JSON.stringify(eachValue),{},_=>0)
    }
}

process.chdir(process.argv[2])
let commits = allCommitsInCwd()
let [start, end] = [ (process.argv[3]||0)-0, (process.argv[4]||commits.length)-0]
commits = commits.slice(start, end)

// took 1d 21h 31m 40s to run this though 24392 commits
let packages = {}
for (let [index, eachCommit] of Object.entries(commits)) {
    index = index-0
    console.log(`on commit ${(index+1)+start}/${commits.length+start}`)
    packages = getAllPackagesIn(eachCommit, packages, index)
    // every 100 commits (starting after the 5th commit), write to disk encase there is an error
    if ((index-5) % 100 == 0) {
        savePackagesTo(packages, pathFor.packages)
    }
}