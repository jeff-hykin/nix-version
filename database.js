const { run, Timeout, Env, Cwd, Stdin, Stdout, Stderr, Out, Overwrite, AppendTo, zipInto, mergeInto, returnAsString, } = await import(`https://deno.land/x/quickr@0.3.24/main/run.js`)
const { FileSystem } = await import(`https://deno.land/x/quickr@0.3.24/main/file_system.js`)
const { Console, yellow } = await import(`https://deno.land/x/quickr@0.3.24/main/console.js`)

import { MeiliSearch } from "https://cdn.skypack.dev/meilisearch"
import { hashJsonPrimitive } from "./tools.js"

const client = new MeiliSearch({ host: 'http://127.0.0.1:7700' })


function addToDatabase(packageObject) {
    const id = hashJsonPrimitive(packageObject.frozen)
    // dont need to wait on this
    return client.index('packages').updateDocuments([
        {
            ...allPackages[packageName][hashValue],
            id: hashValue,
        }
    ])
}

const allPackageJsonPaths = await FileSystem.recursivelyListPathsIn(`scan/packages`)
for (const eachPath of allPackageJsonPaths) {
    if (eachPath.slice(-4) !== '.json') {
        continue
    }
    const jsonString = await FileSystem.read(eachPath)
    if (jsonString) {
        const value = JSON.parse(jsonString)
        if (value && value.frozen instanceof Object) {
            addToDatabase(value)
        }
    }
}