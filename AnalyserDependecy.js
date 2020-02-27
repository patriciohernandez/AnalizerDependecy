const Analyser = require('./Analyser');


const path = './websites.csv';

const analyser = new Analyser(path);

analyser.runAnalyzer();