// @ts-check
const path = require('path');
const { getImportsForFile } = require('./tsHelper');
const glob = require('glob');
const config = require('./config');
const fs = require('fs');

const omit = [
    '.spec.ts',
    '.spec.tsx',
    '.module.scss'
]

/**
 * @param {string} srcRoot
 * @param {{ includeTests: boolean }} [options]
 * @return {Promise<string[]>}
 */
const forEachFileInSrc = (srcRoot, options) => {
    return new Promise((resolve, reject) => {
        glob(`${srcRoot}/**/*.ts?(x)`, (err, files) => {
            if (err) {
                return reject(err);
            }

            return resolve(files.filter(file =>
                !file.endsWith('.d.ts')
                && (options && options.includeTests ? true : !omit.some(o => file.endsWith(o)))));
        })
    });
};
module.exports.forEachFileInSrc = forEachFileInSrc;

/**
 * @param {string} vscodeRoot
 * @param {(file: string) => void} forEach
 * @param {string[]} nodeModules
 * @param {{ includeTests: boolean }} [options]
 */
module.exports.forStrictNullCheckEligibleFiles = async (vscodeRoot, forEach, nodeModules, options) => {
    const srcRoot = path.join(vscodeRoot, 'src');
    const pagesRoot = path.join(vscodeRoot, 'pages');

    const tsconfig = await loadTsConfig(path.join(srcRoot, config.targetTsconfig));
    const checkedFiles = await getCheckedFiles(tsconfig, srcRoot);

    const imports = new Map();
    const getMemoizedImportsForFile = (file, srcRoot) => {
        if (imports.has(file)) {
            return imports.get(file);
        }
        const importList = getImportsForFile(file, srcRoot, nodeModules);
        imports.set(file, importList);
        return importList;
    }

    const files = [
        ...(await forEachFileInSrc(pagesRoot, options)),
        ...(await forEachFileInSrc(srcRoot, options))
    ].filter(f => !f.includes('.stories.tsx'));

    return files
        .filter(file => !checkedFiles.has(file))
        .filter(file => !config.skippedFiles.has(path.relative(srcRoot, file)))
        .filter(file => {
            const allProjImports = getMemoizedImportsForFile(file, srcRoot);

            const nonCheckedImports = allProjImports
                .filter(x => x !== file)
                .filter(imp => {
                    if (checkedFiles.has(imp)) {
                        return false;
                    }
                    // Don't treat cycles as blocking
                    const impImports = getMemoizedImportsForFile(imp, srcRoot);
                    return impImports.filter(x => x !== file).filter(x => !checkedFiles.has(x)).length !== 0;
                });

            const isEdge = nonCheckedImports.length === 0;
            if (isEdge) {
                forEach(file);
            }
            return isEdge;
        });
}

async function getCheckedFiles(tsconfig, srcRoot) {
    const set = new Set(tsconfig.files.map(include => path.join(srcRoot, include)));
    const includes = tsconfig.include.map(include => {
        return new Promise((resolve, reject) => {
            glob(path.join(srcRoot, include), (err, files) => {
                if (err) {
                    return reject(err);
                }

                for (const file of files) {
                    set.add(file);
                }
                resolve();
            })
        });
    });
    await Promise.all(includes);
    return set;
}

// Strip out comments from tsconfig.json file
function loadTsConfig(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err)
            } else {
                const file = data.toString()
                const noComments = file.replace(/\w*\/\/[^\n]*/g, '')
                resolve(JSON.parse(noComments))
            }
        })
    })
}
