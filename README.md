# What is this?

Is a work in progress for keeping track of versions for nixpkgs so that everyone can easily search/install packages. 

The `build.js` is designed to be run inside of git clone of the nixpkgs repo. It iterates through all commits, building a memory of which package versions where avalible in which commits. After the build script is run, the `search.js` script can be given a package name, and then it will list out all of the versions that ever existed for that package along with the commit hash of where to get that version.