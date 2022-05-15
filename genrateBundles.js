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

let commits = allCommitsInCwd()

let packages = {}
let counter = 0
let index = -1
let bundles = []
// create bundles cause its too much RAM to do them all at once
const bundleSize = 100
let bundle = []
let ranges = []
let range = [0, null]
for (let each of commits.reverse()) {
    counter++
    index++
    if (counter != bundleSize) {
        continue
    } else {
        range[1] = index+1
        ranges.push([...range])
        console.debug(`range is:`,range)
    }
    counter = 0
    bundles.push(bundle) 
    bundle = []
    range = [index+1]
}
range[1] = index
ranges.push(range)
writeFileSync("ranges.json", JSON.stringify(ranges))
// console.debug(`bundles.length is:`,bundles.length)
// ;;(async ()=>{
//     let result = {}
//     for (let eachBundle of bundles) {
//         console.debug(`eachBundle.length is:`,eachBundle.length)
//         // start all the commands
//         let promises = eachBundle.map((eachHash,index)=>new Promise(async (resolve, reject)=>{
//             let { stdout, stderr } = await exec('find . -type f | wc -l', { shell: true });
//             stdout = stdout.toString()
//             console.log(`on commit ${index} of ${commits.length}`)
//             setTimeout(() => {
//                 resolve(getAllPackagesIn(eachHash))
//                 console.log(`finished commit ${index}`)
//             }, 0)
//         }))
//         // wait them in order
//         for (let each of promises) {
//             result = {...result, ...(await each)}
//         }
//         writeFileSync("./packages.json", JSON.stringify(result,0,4))
//     }
// })()