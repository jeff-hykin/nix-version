#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync, writeFile } = require("fs")
const process = require("process")

const indexPath = "nix-index"
const commitPath = "commit-hashes.json"


let commitsCache = {}

function convertCommit({ commitIndex, pathToIndexFolder }) {
    let pathToCommits = path.join(pathToIndexFolder, commitPath)
    let uniqueId = `${process.cwd()},${pathToCommits}`
    if (commitsCache[uniqueId] == null) {
        commitsCache[uniqueId] = JSON.parse(readFileSync(pathToCommits)).reverse()
    }
    let commits = commitsCache[uniqueId]
    return commits[commitIndex]
}


// find the versions for a package, and find their corrisponding commit
function retrive({ packageName, pathToIndexFolder }) {
    let versions = JSON.parse(readFileSync(path.join(pathToIndexFolder, indexPath, packageName+".json")))
    let output = ""
    for (const [eachVersionName, eachValue] of Object.entries(versions)) {
        let firstCommit = convertCommit({ pathToIndexFolder, commitIndex: eachValue.commits[0] })
        let lastCommit  = convertCommit({ pathToIndexFolder, commitIndex: eachValue.commits[eachValue.commits.length-1]})
        output += `${eachVersionName}: ${firstCommit}, ${lastCommit}`
    }
    return output
}

console.log(retrive({ packageName: process.argv[2], pathToIndexFolder: process.cwd() }))