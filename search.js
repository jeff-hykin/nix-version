#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync, writeFile } = require("fs")
const process = require("process")
const { dynamicSort } = require("good-js")

const {
    savePackagesTo,
    getAllPackagesIn,
    shellNameFromIndex,
    enumeratePackageShellName,
    commitHashForIndex,
    allCommitsInCwd,
    run,
    findAll,
    pathFor,
} = require('./tools')

// find the versions for a package, and find their corrisponding commit
function retrive({ packageName, pathToIndexFolder }) {
    let versions = JSON.parse(readFileSync(path.join(pathToIndexFolder, pathFor.packages, packageName+".json")))
    let output = ""
    for (const [eachVersionName, eachValue] of Object.entries(versions)) {
        let sources = eachValue.sources.map(
            each=>({hashIndex: each.h, shellNameIndex: each.sn, envName: each.en})
        ).sort(dynamicSort("hashIndex"))
        let [ firstSource, lastSource ] = [ sources[0], sources[sources.length-1] ]
        output += `${eachVersionName}:\n    ${firstSource.hashIndex}, ${shellNameFromIndex(firstSource.shellNameIndex)}\n    ${lastSource.hashIndex}, ${shellNameFromIndex(lastSource.shellNameIndex)}\n`
    }
    return output
}

console.log(retrive({ packageName: process.argv[2], pathToIndexFolder: __dirname }))