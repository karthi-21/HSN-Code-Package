'use strict';
const excelToJson = require('convert-excel-to-json');

/**
 * Parses hsn-code-list.xlsx and returns as json object
 * @returns array of[ objects{ code: 00000, description: 'description of the code allocated for.' }] i.e. [{...}, {...}, ...]
 */
function getAllHsn() {
    const hsnCodes = excelToJson({
        sourceFile: 'code_list.xlsx',
        header:{
            rows: 3
        },
        columnToKey: {
            B: 'code',
            C: 'description'
        }
    });
    return hsnCodes.Sheet1;
};

/**
 * Finds all code that matches the dscription.
 * 
 * @param {*search_text} txt: string
 * @returns Returns array of hsn code objects matches the search_txt
 */
function getCodeByTxt(txt) {
    const hsnList = getAllHsn();
    const matchedList = hsnList.filter(item => (item.description.toLowerCase()).includes(txt.toLowerCase()));
    return matchedList;
};

/**
 * Finds all descriptions that matches the code.
 * 
 * @param {*search_code} code: string
 * @returns Returns array of hsn code objects matches the search_code
 */
 function getDesByCode(code) {
    const hsnList = getAllHsn();
    const matchedList = hsnList.filter(item => (item.code.toString()).includes(code.toString()));
    return matchedList;
};

module.exports = getAllHsn | getCodeByTxt | getDesByCode;