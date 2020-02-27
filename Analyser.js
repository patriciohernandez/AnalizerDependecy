const fs = require('fs');
const os = require('os');
const fetch = require("node-fetch");
const cheerio = require('cheerio')
const chalk = require('chalk');

module.exports = class Analyser {

    constructor(pathcsv) {
        this.totalDependenciesOccurrences = {}
        this.pagesLengthInBytes = []
        this.dependenciesPerPage = []
        this.path = pathcsv;
    }

    runAnalyzer() {
        readFileCsv(this.path).then(async (csvLinesContent) => {
            const pagesResult = csvLinesContent.map(async (elem) => {
                try {
                    const line = elem.split(',');
                    const website = line[0].trim();
                    const direction = line[1].trim();
                    const page = await getPage(direction);
                    const dependenciesOfPage = getDependencies(page);
                    const lengthOfPageInBytes = getLengthOfPageInBytes(page);
                    this.pagesLengthInBytes.push({ website, lengthOfPageInBytes });
                    dependenciesOfPage.forEach(dependency => {
                        this.dependenciesPerPage.push({ website, dependency });
                        if (this.totalDependenciesOccurrences.hasOwnProperty(dependency)) {
                            this.totalDependenciesOccurrences[dependency]++;
                            return;
                        }
                        this.totalDependenciesOccurrences[dependency] = 1;
                    })
                } catch (error) {
                    console.log(chalk.bgRed(error));
                }
            });
            await Promise.all(pagesResult);
            printLength(this.pagesLengthInBytes);
            console.log(' ');
            printDependencies(this.dependenciesPerPage);
            console.log(' ');
            printFrequency(this.totalDependenciesOccurrences);
        });
    }
}

const printLength = (pagesLengthInBytes) => {
    console.log(chalk.bgGreen('Lenght:'));
    console.table(pagesLengthInBytes)
}

const printDependencies = (dependenciesPerPage) => {
    console.log(chalk.bgGreen('Dependencies:'));
    console.table(dependenciesPerPage);
}

const printFrequency = (totalDependenciesOccurrences) => {
    const totalDependenciesTable = []
    for (var [key, value] of Object.entries(totalDependenciesOccurrences)) {
        totalDependenciesTable.push({
            'dependencies': `${key.toString()}`,
            'occurrences': `${value.toString()}`
        });
    }
    console.log(chalk.bgGreen('Frequency:'));
    console.table(totalDependenciesTable);
}

const readFileCsv = async (path) => {
    try {
        return fs.readFileSync(path).toString().split(/\n/g);
    } catch (err) {
        throw `cannot be read: ${path}`;
    }
}

const getPage = async (direction) => {
    return (isLocalFile(direction)) ? await fetchLocalFile(direction) : await fetchUrlFile(direction);
}

const isLocalFile = (direction) => {
    return ((direction.charAt(0) == '~') || (direction.charAt(0) == '.'));
}

const fetchUrlFile = async (pathFile) => {
    try {
        const fetchContent = await fetch(pathFile);
        return await fetchContent.text();
    } catch (err) {
        throw `cannot be fetch: ${pathFile}`;
    }
}

const fetchLocalFile = async (pathFile) => {
    if (runingInWindows)
        pathFile = pathFile.replace('~', '.');
    try {
        return fs.readFileSync(pathFile).toString();
    } catch (err) {
        throw `cannot be read: ${pathFile}`;
    }
}

const runingInWindows = () => {
    return (os.platform() == 'win32');
}

const getDependencies = (page) => {
    const $ = cheerio.load(page)
    const dependencies = [];
    $('script').each((i, element) => {
        if (element.attribs.src != undefined) {
            dependencies.push(element.attribs.src.replace(/\?.*/, '').replace(/\r/, '').split('/').pop())
        }
    });
    return dependencies;
}

const getLengthOfPageInBytes = (page) => {
    const $ = cheerio.load(page)
    let charsetPage = {
        charset : 'utf8',
        specified  : 'No'
    };
    $('meta').each((i, element) => {
        if (element.attribs.charset != undefined) {
            charsetPage.charset = element.attribs.charset;
            charsetPage.specified  = 'Yes';
            return;
        } else if (element.attribs.content.split(';').find(p => p.match('charset')) != undefined) {
            const charsetInContent = element.attribs.content.split(';').find(p => p.match('charset')).split('=')[1];
            charsetPage.charset = charsetInContent;
            charsetPage.specified = 'Yes';
            return;
        }
    });
    return `${Buffer.byteLength(page, charsetPage.charset)} Bytes - specified charset: ${charsetPage.specified} (${charsetPage.charset})`
}

