// @ts-check
const path = require('path');
const glob = require('glob');
const { forStrictNullCheckEligibleFiles, forEachFileInSrc } = require('./src/getStrictNullCheckEligibleFiles');
const { getImportsForFile } = require('./src/tsHelper');

const vscodeRoot = path.join(process.cwd(), process.argv[2]);
const srcRoot = path.join(vscodeRoot, 'src');
const pagesRoot = path.join(vscodeRoot, 'pages');

let sort = true;
let filter;
let printDependedOnCount = true;
let includeTests = false;

if (false) { // Generate test files listing
    sort = false;
    filter = (x => x.endsWith('.spec.ts') || x.endsWith('.spec.tsx'))
    printDependedOnCount = false;
    includeTests = true;
}

const nodeModules = [
    ...Object.keys(require(path.join(vscodeRoot, 'package.json')).dependencies),
    ...Object.keys(require(path.join(vscodeRoot, 'package.json')).devDependencies)
]

forStrictNullCheckEligibleFiles(vscodeRoot, () => { }, nodeModules).then(async eligibleFiles => {
    const eligibleSet = new Set(eligibleFiles);

    const dependedOnCount = new Map(eligibleFiles.map(file => [file, 0]));

    const files = [
        ...await forEachFileInSrc(srcRoot),
        ...await forEachFileInSrc(pagesRoot)
    ]

    for (const file of files) {
        if (eligibleSet.has(file)) {
            // Already added
            continue;
        }

        const imports = getImportsForFile(file, srcRoot, nodeModules)
        for (const imp of imports) {
            if (dependedOnCount.has(imp)) {
                dependedOnCount.set(imp, dependedOnCount.get(imp) + 1);
            }
        }
    }

    let out = Array.from(dependedOnCount.entries());
    if (filter) {
        out = out.filter(x => filter(x[0]))
    }
    if (sort) {
        out = out.sort((a, b) => b[1] - a[1]);
    }
    for (const pair of out) {
        console.log(toFormattedFilePath(pair[0]) + (printDependedOnCount ? ` — Depended on by **${pair[1]}** files` : ''));
    }
});


function toFormattedFilePath(file) {
    // return `"./${path.relative(srcRoot, file)}",`;
    return `- [ ] \`"./${path.relative(srcRoot, file)}"\``;
}
