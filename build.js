#!/usr/bin/env node
const path = require("path")
const { existsSync, writeFileSync, readFileSync, writeFile } = require("fs")
const { spawnSync, execSync } = require('child_process')
const {
    savePackagesTo,
    getAllPackagesIn,
    enumeratePackageShellName,
    allCommitsInCwd,
    run,
    findAll,
    pathFor,
} = require("./tools")

process.chdir(process.argv[2])
let commits = allCommitsInCwd()
let [start, end] = [ (process.argv[3]||0)-0, (process.argv[4]||commits.length)-0]
commits = commits.slice(start, end)

// took 45h 31m 40s to run this though 24392 commits
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