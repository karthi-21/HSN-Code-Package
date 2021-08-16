# HSN Code Package

HSN code stands for “Harmonized System of Nomenclature”. This system has been introduced for the systematic classification of goods all over the world. HSN code is a 6-digit uniform code that classifies 5000+ products and is accepted worldwide. It was developed by the World Customs Organization (WCO) and it came into effect from 1988 [(more...)](https://cleartax.in/s/gst-hsn-lookup) 

This package contains an HSN code list and has three methods to get results.

## Installation

Use the package manager [npm](https://www.npmjs.com/package/hsn-code-package) to install hsn-code-package.

```bash
npm i hsn-code-package
```

## Usage
Can be used

```javascript
# returns objects array contains all codes with description
getAllHsn()

# returns array of hsn code objects matches the search_txt
getCodeByTxt('search_txt')

# returns array of hsn code objects matches the search_code
getDesByCode(search_code)
```

### About Contribution
Hasn't made this package public yet, so as soon I made this package a stable one with all future I got I will make it open source, before that, if anyone needs any extra features or any corrections please leave me a mail.