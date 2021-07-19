// @ts-check
const path = require('path');
const ts = require('typescript');
const fs = require('fs');

/**
 *
 * @param {string} file
 * @param {string} srcRoot
 * @param {string[]} nodeModules
 * @returns
 */
module.exports.getImportsForFile = function getImportsForFile(file, srcRoot, nodeModules) {
    const fileInfo = ts.preProcessFile(fs.readFileSync(file).toString());

    return fileInfo.importedFiles
        .map(importedFile => importedFile.fileName.replace(/^@mfj\/src/, srcRoot))
        .map(fileName => fileName === '.' ? path.dirname(file) : fileName)
        .filter(fileName => !/\.s?css$/.test(fileName)) // remove css imports
        .filter(fileName => !/\.svg$/.test(fileName)) // remove SVG imports
        .filter(fileName => !fileName.startsWith('@mfj/') && !fileName.startsWith('homepage-data/') && !fileName.startsWith('styled-jsx'))
        .filter(x => /\//.test(x) && !nodeModules.some(m => x.startsWith(m))) // remove node modules (the import must contain '/', and not start with the name of a module, like lodash)
        .map(fileName => {
            if (/(^\.\/)|(^\.\.\/)/.test(fileName)) {
                return path.join(path.dirname(file), fileName);
            }
            return fileName;
        }).map(fileName => {
            const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '.d.ts', '/index.ts', '/index.d.ts', '/index.tsx']
            for (const extension of extensions) {
                const file = fileName + extension
                if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
                    return file
                }
            }
            throw new Error(`Unresolved import ${fileName} in ${file}`);
        });
};
