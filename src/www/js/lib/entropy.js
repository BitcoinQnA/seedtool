/**
 * The MIT License (MIT)
 * Copyright (c) 2022 SuperPhatArrow
 * Based on Ian Coleman's bip39 tool
 * Copyright (c) 2014-2016 Ian Coleman
 * https://github.com/iancoleman/bip39/blob/master/src/js/entropy.js
 */
/* cSpell:disable */
/*
 * Detects entropy from a string.
 *
 * Formats include:
 * binary [0-1]
 * base 6 [0-5]
 * dice 6 [1-6]
 * decimal [0-9]
 * hexadecimal [0-9A-F]
 * card [A2-9TJQK][CDHS]
 *
 * Automatically uses lowest entropy to avoid issues such as interpretting 0101
 * as hexadecimal which would be 16 bits when really it's only 4 bits of binary
 * entropy.
 */

/**
 * For the question of biased vs unbiased entropy...
 * Go make a stong cup of coffee and read:
 * https://github.com/iancoleman/bip39/issues/435
 */

/**
 * Details about the base of the input entropy
 * @typedef {Object} BaseObject
 * @property {number[]} ints - An array of integers
 * @property {string[]} events - An array of each character input by user
 * @property {string} str - The name of the base detected or user decided
 * @property {number} asInt - The number of the base, ie binary=2 hex=16
 * @property {number} bitsPerEvent - The number of bits per event
 * @property {number} unbiasedBitsPerEvent - The unbiased number of bits per event
 */

/**
 * The object returned containing entropy info
 * @typedef {Object} EntropyObject
 * @property {string} binaryStr - The entropy in a binary string
 * @property {string} cleanStr - The entropy string normalized for display
 * @property {string} cleanHtml - The cleanStr formatted for HTML
 * @property {BaseObject} base - Details about the base of the input entropy
 */

// class EntropyOld {
//   static eventBits = {
//     binary: {
//       0: '0',
//       1: '1',
//     },

//     // log2(6) = 2.58496 bits per roll, with bias
//     // 4 rolls give 2 bits each
//     // 2 rolls give 1 bit each
//     // Average (4*2 + 2*1) / 6 = 1.66 bits per roll without bias
//     'base 6': {
//       0: '00',
//       1: '01',
//       2: '10',
//       3: '11',
//       4: '0',
//       5: '1',
//     },

//     // log2(6) = 2.58496 bits per roll, with bias
//     // 4 rolls give 2 bits each
//     // 2 rolls give 1 bit each
//     // Average (4*2 + 2*1) / 6 = 1.66 bits per roll without bias
//     dice: {
//       1: '00', // equivalent to 0 in base 6
//       2: '01',
//       3: '10',
//       4: '11',
//       5: '0',
//       6: '1',
//     },

//     // log2(10) = 3.321928 bits per digit, with bias
//     // 8 digits give 3 bits each
//     // 2 digits give 1 bit each
//     // Average (8*3 + 2*1) / 10 = 2.6 bits per digit without bias
//     'base 10': {
//       0: '000',
//       1: '001',
//       2: '010',
//       3: '011',
//       4: '100',
//       5: '101',
//       6: '110',
//       7: '111',
//       8: '0',
//       9: '1',
//     },

//     hexadecimal: {
//       0: '0000',
//       1: '0001',
//       2: '0010',
//       3: '0011',
//       4: '0100',
//       5: '0101',
//       6: '0110',
//       7: '0111',
//       8: '1000',
//       9: '1001',
//       a: '1010',
//       b: '1011',
//       c: '1100',
//       d: '1101',
//       e: '1110',
//       f: '1111',
//     },

//     // log2(52) = 5.7004 bits per card, with bias
//     // 32 cards give 5 bits each
//     // 16 cards give 4 bits each
//     // 4 cards give 2 bits each
//     // Average (32*5 + 16*4 + 4*2) / 52 = 4.46 bits per card without bias
//     card: {
//       ac: '00000',
//       '2c': '00001',
//       '3c': '00010',
//       '4c': '00011',
//       '5c': '00100',
//       '6c': '00101',
//       '7c': '00110',
//       '8c': '00111',
//       '9c': '01000',
//       tc: '01001',
//       jc: '01010',
//       qc: '01011',
//       kc: '01100',
//       ad: '01101',
//       '2d': '01110',
//       '3d': '01111',
//       '4d': '10000',
//       '5d': '10001',
//       '6d': '10010',
//       '7d': '10011',
//       '8d': '10100',
//       '9d': '10101',
//       td: '10110',
//       jd: '10111',
//       qd: '11000',
//       kd: '11001',
//       ah: '11010',
//       '2h': '11011',
//       '3h': '11100',
//       '4h': '11101',
//       '5h': '11110',
//       '6h': '11111',
//       '7h': '0000',
//       '8h': '0001',
//       '9h': '0010',
//       th: '0011',
//       jh: '0100',
//       qh: '0101',
//       kh: '0110',
//       as: '0111',
//       '2s': '1000',
//       '3s': '1001',
//       '4s': '1010',
//       '5s': '1011',
//       '6s': '1100',
//       '7s': '1101',
//       '8s': '1110',
//       '9s': '1111',
//       ts: '00',
//       js: '01',
//       qs: '10',
//       ks: '11',
//     },
//   };
//   /**
//    * matchers returns an array of the matched events for each type of entropy.
//    * eg
//    * matchers.binary("010") returns ["0", "1", "0"]
//    * matchers.binary("a10") returns ["1", "0"]
//    * matchers.hex("a10") returns ["a", "1", "0"]
//    */
//   static matchers = {
//     binary: (str) => str.match(/[0-1]/gi) || [],
//     base6: (str) => str.match(/[0-5]/gi) || [],
//     dice: (str) => str.match(/[1-6]/gi) || [],
//     base10: (str) => str.match(/[0-9]/gi) || [],
//     hex: (str) => str.match(/[0-9A-F]/gi) || [],
//     card: (str) => str.match(/([A2-9TJQK][CDHS])/gi) || [],
//   };

//   constructor() {}

//   /**
//    * Private Static function to trim and normalize using NFKD any user input
//    * @param {String} str String to normalize
//    * @returns {String} Normalized String
//    */
//   static #normalize(str) {
//     return str.trim().normalize('NFKD');
//   }

//   /**
//    * getBase returns the base info
//    * @param {string} entropyStr Normalised raw entropy
//    * @param {string=} baseStr Type of radix
//    * @returns {BaseObject}
//    */
//   static #getBase(entropyStr, baseStr) {
//     // Need to get the lowest base for the supplied entropy.
//     // This prevents interpreting, say, dice rolls as hexadecimal.
//     const binaryMatches = this.matchers.binary(entropyStr);
//     const hexMatches = this.matchers.hex(entropyStr);
//     const autodetect = baseStr === undefined;
//     let str = '',
//       ints = [],
//       events = [],
//       asInt = 0,
//       unbiasedBitsPerEvent = 0;
//     // Find the lowest base that can be used, whilst ignoring any irrelevant chars
//     // Check for binary
//     if (
//       (binaryMatches.length == hexMatches.length &&
//         hexMatches.length > 0 &&
//         autodetect) ||
//       baseStr === 'binary'
//     ) {
//       return {
//         ints: binaryMatches.map((n) => parseInt(n, 2)),
//         events: binaryMatches,
//         asInt: 2,
//         bitsPerEvent: Math.log2(2),
//         unbiasedBitsPerEvent: 1,
//         str: 'binary',
//       };
//     }
//     // check for cards
//     const cardMatches = this.matchers.card(entropyStr);
//     if (
//       (cardMatches.length >= hexMatches.length / 2 && autodetect) ||
//       baseStr === 'card'
//     ) {
//       const cardList = Object.keys(this.eventBits.card);
//       return {
//         ints: cardMatches.map((c) => cardList.indexOf(c.toLowerCase())),
//         events: cardMatches,
//         asInt: 52,
//         bitsPerEvent: Math.log2(52),
//         unbiasedBitsPerEvent: (32 * 5 + 16 * 4 + 4 * 2) / 52, // see cardBits
//         str: 'card',
//       };
//     }
//     // Check for dice
//     const diceMatches = this.matchers.dice(entropyStr);
//     if (
//       (diceMatches.length == hexMatches.length &&
//         hexMatches.length > 0 &&
//         autodetect) ||
//       baseStr === 'dice'
//     ) {
//       return {
//         ints: diceMatches.map((n) => parseInt(n)),
//         events: diceMatches,
//         asInt: 6,
//         bitsPerEvent: Math.log2(6),
//         unbiasedBitsPerEvent: (4 * 2 + 2 * 1) / 6, // see diceBits
//         str: 'dice',
//       };
//     }
//     // check for base 6
//     const base6Matches = this.matchers.base6(entropyStr);
//     if (
//       (base6Matches.length == hexMatches.length &&
//         hexMatches.length > 0 &&
//         autodetect) ||
//       baseStr === 'base 6'
//     ) {
//       return {
//         ints: base6Matches.map((n) => parseInt(n)),
//         events: base6Matches,
//         asInt: 6,
//         bitsPerEvent: Math.log2(6),
//         unbiasedBitsPerEvent: (4 * 2 + 2 * 1) / 6, // see diceBits
//         str: 'base 6',
//       };
//     }
//     // check for base 10
//     const base10Matches = this.matchers.base10(entropyStr);
//     if (
//       (base10Matches.length == hexMatches.length &&
//         hexMatches.length > 0 &&
//         autodetect) ||
//       baseStr === 'base 10'
//     ) {
//       return {
//         ints: base10Matches.map((n) => parseInt(n)),
//         events: base10Matches,
//         asInt: 10,
//         bitsPerEvent: Math.log2(10),
//         unbiasedBitsPerEvent: (8 * 3 + 2 * 1) / 10, // see b10Bits
//         str: 'base 10',
//       };
//     }
//     // fallback is hex
//     return {
//       ints: hexMatches.map((n) => parseInt(n, 16)),
//       events: hexMatches,
//       asInt: 16,
//       bitsPerEvent: Math.log2(16),
//       unbiasedBitsPerEvent: 4,
//       str: 'hexadecimal',
//     };
//   }

//   /**
//    *
//    * @param {String} rawEntropyStr Actual entropy submitted by the user
//    * @param {String=} baseStr 'binary' | 'card' | 'dice' | 'base 6' | 'base 10' | 'hexadecimal'
//    * @returns {EntropyObject}
//    */
//   static fromString(rawEntropyStr, baseStr) {
//     // normalize the arguments
//     rawEntropyStr = this.#normalize(rawEntropyStr);
//     // Find type of entropy being used (binary, hex, dice etc)
//     const base = this.#getBase(rawEntropyStr, baseStr);
//     // Detect empty entropy
//     if (base.events.length == 0) {
//       return {
//         binaryStr: '',
//         cleanStr: '',
//         cleanHtml: '',
//         base,
//       };
//     }
//     // convert entropy events to binary
//     const binaryStr = base.events
//       .map((e) => this.eventBits[base.str][e.toLowerCase()])
//       .join('');
//     // Supply a 'filtered' entropy string for display purposes
//     let cleanStr = base.events.join('');
//     let cleanHtml = base.events.join('');
//     // make cards pretty
//     if (base.asInt == 52) {
//       cleanStr = base.events.join(' ').toUpperCase();
//       cleanStr = cleanStr.replace(/C/g, '\u2663');
//       cleanStr = cleanStr.replace(/D/g, '\u2666');
//       cleanStr = cleanStr.replace(/H/g, '\u2665');
//       cleanStr = cleanStr.replace(/S/g, '\u2660');
//       cleanHtml = base.events.join(' ').toUpperCase();
//       cleanHtml = cleanHtml.replace(
//         /C/g,
//         "<span class='card-suit club'>\u2663</span>"
//       );
//       cleanHtml = cleanHtml.replace(
//         /D/g,
//         "<span class='card-suit diamond'>\u2666</span>"
//       );
//       cleanHtml = cleanHtml.replace(
//         /H/g,
//         "<span class='card-suit heart'>\u2665</span>"
//       );
//       cleanHtml = cleanHtml.replace(
//         /S/g,
//         "<span class='card-suit spade'>\u2660</span>"
//       );
//     }
//     return {
//       binaryStr,
//       cleanStr,
//       cleanHtml,
//       base,
//     };
//   }
// }

window.Entropy = (()=>({
  eventBits: {
    binary: {
      0: '0',
      1: '1',
    },

    // log2(6) = 2.58496 bits per roll, with bias
    // 4 rolls give 2 bits each
    // 2 rolls give 1 bit each
    // Average (4*2 + 2*1) / 6 = 1.66 bits per roll without bias
    'base 6': {
      0: '00',
      1: '01',
      2: '10',
      3: '11',
      4: '0',
      5: '1',
    },

    // log2(6) = 2.58496 bits per roll, with bias
    // 4 rolls give 2 bits each
    // 2 rolls give 1 bit each
    // Average (4*2 + 2*1) / 6 = 1.66 bits per roll without bias
    dice: {
      1: '00', // equivalent to 0 in base 6
      2: '01',
      3: '10',
      4: '11',
      5: '0',
      6: '1',
    },

    // log2(10) = 3.321928 bits per digit, with bias
    // 8 digits give 3 bits each
    // 2 digits give 1 bit each
    // Average (8*3 + 2*1) / 10 = 2.6 bits per digit without bias
    'base 10': {
      0: '000',
      1: '001',
      2: '010',
      3: '011',
      4: '100',
      5: '101',
      6: '110',
      7: '111',
      8: '0',
      9: '1',
    },

    hexadecimal: {
      0: '0000',
      1: '0001',
      2: '0010',
      3: '0011',
      4: '0100',
      5: '0101',
      6: '0110',
      7: '0111',
      8: '1000',
      9: '1001',
      a: '1010',
      b: '1011',
      c: '1100',
      d: '1101',
      e: '1110',
      f: '1111',
    },

    // log2(52) = 5.7004 bits per card, with bias
    // 32 cards give 5 bits each
    // 16 cards give 4 bits each
    // 4 cards give 2 bits each
    // Average (32*5 + 16*4 + 4*2) / 52 = 4.46 bits per card without bias
    card: {
      ac: '00000',
      '2c': '00001',
      '3c': '00010',
      '4c': '00011',
      '5c': '00100',
      '6c': '00101',
      '7c': '00110',
      '8c': '00111',
      '9c': '01000',
      tc: '01001',
      jc: '01010',
      qc: '01011',
      kc: '01100',
      ad: '01101',
      '2d': '01110',
      '3d': '01111',
      '4d': '10000',
      '5d': '10001',
      '6d': '10010',
      '7d': '10011',
      '8d': '10100',
      '9d': '10101',
      td: '10110',
      jd: '10111',
      qd: '11000',
      kd: '11001',
      ah: '11010',
      '2h': '11011',
      '3h': '11100',
      '4h': '11101',
      '5h': '11110',
      '6h': '11111',
      '7h': '0000',
      '8h': '0001',
      '9h': '0010',
      th: '0011',
      jh: '0100',
      qh: '0101',
      kh: '0110',
      as: '0111',
      '2s': '1000',
      '3s': '1001',
      '4s': '1010',
      '5s': '1011',
      '6s': '1100',
      '7s': '1101',
      '8s': '1110',
      '9s': '1111',
      ts: '00',
      js: '01',
      qs: '10',
      ks: '11',
    },
  },
  matchers: {
    binary: (str) => str.match(/[0-1]/gi) || [],
    base6: (str) => str.match(/[0-5]/gi) || [],
    dice: (str) => str.match(/[1-6]/gi) || [],
    base10: (str) => str.match(/[0-9]/gi) || [],
    hex: (str) => str.match(/[0-9A-F]/gi) || [],
    card: (str) => str.match(/([A2-9TJQK][CDHS])/gi) || [],
  },
  normalize: (str) => str.trim().normalize('NFKD'),
  getBase(entropyStr, baseStr) {
    // Need to get the lowest base for the supplied entropy.
    // This prevents interpreting, say, dice rolls as hexadecimal.
    const binaryMatches = this.matchers.binary(entropyStr);
    const hexMatches = this.matchers.hex(entropyStr);
    const autodetect = baseStr === undefined;
    // Find the lowest base that can be used, whilst ignoring any irrelevant chars
    // Check for binary
    if (
      (binaryMatches.length == hexMatches.length &&
        hexMatches.length > 0 &&
        autodetect) ||
      baseStr === 'binary'
    ) {
      return {
        ints: binaryMatches.map((n) => parseInt(n, 2)),
        events: binaryMatches,
        asInt: 2,
        bitsPerEvent: Math.log2(2),
        unbiasedBitsPerEvent: 1,
        str: 'binary',
      };
    }
    // check for cards
    const cardMatches = this.matchers.card(entropyStr);
    if (
      (cardMatches.length >= hexMatches.length / 2 && autodetect) ||
      baseStr === 'card'
    ) {
      const cardList = Object.keys(this.eventBits.card);
      return {
        ints: cardMatches.map((c) => cardList.indexOf(c.toLowerCase())),
        events: cardMatches,
        asInt: 52,
        bitsPerEvent: Math.log2(52),
        unbiasedBitsPerEvent: (32 * 5 + 16 * 4 + 4 * 2) / 52, // see cardBits
        str: 'card',
      };
    }
    // Check for dice
    const diceMatches = this.matchers.dice(entropyStr);
    if (
      (diceMatches.length == hexMatches.length &&
        hexMatches.length > 0 &&
        autodetect) ||
      baseStr === 'dice'
    ) {
      return {
        ints: diceMatches.map((n) => parseInt(n)),
        events: diceMatches,
        asInt: 6,
        bitsPerEvent: Math.log2(6),
        unbiasedBitsPerEvent: (4 * 2 + 2 * 1) / 6, // see diceBits
        str: 'dice',
      };
    }
    // check for base 6
    const base6Matches = this.matchers.base6(entropyStr);
    if (
      (base6Matches.length == hexMatches.length &&
        hexMatches.length > 0 &&
        autodetect) ||
      baseStr === 'base 6'
    ) {
      return {
        ints: base6Matches.map((n) => parseInt(n)),
        events: base6Matches,
        asInt: 6,
        bitsPerEvent: Math.log2(6),
        unbiasedBitsPerEvent: (4 * 2 + 2 * 1) / 6, // see diceBits
        str: 'base 6',
      };
    }
    // check for base 10
    const base10Matches = this.matchers.base10(entropyStr);
    if (
      (base10Matches.length == hexMatches.length &&
        hexMatches.length > 0 &&
        autodetect) ||
      baseStr === 'base 10'
    ) {
      return {
        ints: base10Matches.map((n) => parseInt(n)),
        events: base10Matches,
        asInt: 10,
        bitsPerEvent: Math.log2(10),
        unbiasedBitsPerEvent: (8 * 3 + 2 * 1) / 10, // see b10Bits
        str: 'base 10',
      };
    }
    // fallback is hex
    return {
      ints: hexMatches.map((n) => parseInt(n, 16)),
      events: hexMatches,
      asInt: 16,
      bitsPerEvent: Math.log2(16),
      unbiasedBitsPerEvent: 4,
      str: 'hexadecimal',
    };
  },
  fromString(rawEntropyStr, baseStr) {
    // normalize the arguments
    rawEntropyStr = this.normalize(rawEntropyStr);
    // Find type of entropy being used (binary, hex, dice etc)
    const base = this.getBase(rawEntropyStr, baseStr);
    // Detect empty entropy
    if (base.events.length == 0) {
      return {
        binaryStr: '',
        cleanStr: '',
        cleanHtml: '',
        base,
      };
    }
    // convert entropy events to binary
    const binaryStr = base.events
      .map((e) => this.eventBits[base.str][e.toLowerCase()])
      .join('');
    // Supply a 'filtered' entropy string for display purposes
    let cleanStr = base.events.join('');
    let cleanHtml = base.events.join('');
    // make cards pretty
    if (base.asInt == 52) {
      cleanStr = base.events.join(' ').toUpperCase();
      cleanStr = cleanStr.replace(/C/g, '\u2663');
      cleanStr = cleanStr.replace(/D/g, '\u2666');
      cleanStr = cleanStr.replace(/H/g, '\u2665');
      cleanStr = cleanStr.replace(/S/g, '\u2660');
      cleanHtml = base.events.join(' ').toUpperCase();
      cleanHtml = cleanHtml.replace(
        /C/g,
        "<span class='card-suit club'>\u2663</span>"
      );
      cleanHtml = cleanHtml.replace(
        /D/g,
        "<span class='card-suit diamond'>\u2666</span>"
      );
      cleanHtml = cleanHtml.replace(
        /H/g,
        "<span class='card-suit heart'>\u2665</span>"
      );
      cleanHtml = cleanHtml.replace(
        /S/g,
        "<span class='card-suit spade'>\u2660</span>"
      );
    }
    return {
      binaryStr,
      cleanStr,
      cleanHtml,
      base,
    };
  }
}))();
/* cSpell:enable */