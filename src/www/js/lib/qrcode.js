//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Amended by SuperPhatArrow from
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

window.QRCode = (function () {
  class QRCode {
    /**
     * qrcode
     * @param typeNumber 1 to 40 (0 for autodetect)
     * @param errorCorrectionLevel 'L','M','Q','H'
     */
    constructor(typeNumber = 0, errorCorrectionLevel = 'L') {
      this.typeNumber = typeNumber;
      this.errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
      this._dataCache = null;
      this._dataList = [];
      this._modules = null;
      this._moduleCount = 0;
    }

    addData(data = '') {
      this._dataList.push(this.#qr8BitByte(data));
      this._dataCache = null;
    }

    make() {
      if (this.typeNumber < 1) {
        let _typeNumber = 1;

        for (; _typeNumber < 40; _typeNumber++) {
          const rsBlocks = QRRSBlock.getRSBlocks(
            _typeNumber,
            this.errorCorrectionLevel
          );
          const buffer = this.#qrBitBuffer();

          this._dataList.forEach((data) => {
            buffer.put(data.getMode(), 4);
            buffer.put(
              data.getLength(),
              QRUtil.getLengthInBits(data.getMode(), _typeNumber)
            );
            data.write(buffer);
          });

          let totalDataCount = 0;
          rsBlocks.forEach((block) => (totalDataCount += block.dataCount));

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        this.typeNumber = _typeNumber;
      }

      this.#makeImpl(false, this.#getBestMaskPattern());
    }

    createSvgTag(opts = {}) {
      let cellSize = opts.cellSize || 5,
        margin = opts.margin || cellSize * 4;

      const size = this.getModuleCount() * cellSize + margin * 2;
      let c,
        mc,
        r,
        mr,
        qrSvg = '',
        rect;

      rect = `l${cellSize},0 0,${cellSize} -${cellSize},0 0,-${cellSize}z `;

      qrSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg"${
        !opts.scalable ? ` width="${size}" height="${size}"` : ``
      } viewBox="0 0 ${size} ${size}"  preserveAspectRatio="xMinYMin meet">
      <rect width="100%" height="100%" fill="${
        opts.background || '#fff'
      }" cx="0" cy="0"/><path d="`;

      for (r = 0; r < this.getModuleCount(); r++) {
        mr = r * cellSize + margin;
        for (c = 0; c < this.getModuleCount(); c++) {
          if (this.isDark(r, c)) {
            mc = c * cellSize + margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/></svg>';

      return qrSvg;
    }

    isDark(row, col) {
      if (
        row < 0 ||
        this._moduleCount <= row ||
        col < 0 ||
        this._moduleCount <= col
      ) {
        throw row + ',' + col;
      }
      return this._modules[row][col];
    }

    getModuleCount() {
      return this._moduleCount;
    }

    #getBestMaskPattern() {
      let minLostPoint = 0;
      let pattern = 0;

      for (let i = 0; i < 8; i++) {
        this.#makeImpl(true, i);

        const lostPoint = QRUtil.getLostPoint(this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    }

    #makeImpl(test, maskPattern) {
      this._moduleCount = this.typeNumber * 4 + 17;
      this._modules = (function (moduleCount) {
        const modules = new Array(moduleCount);
        for (let row = 0; row < moduleCount; row++) {
          modules[row] = new Array(moduleCount);
          for (let col = 0; col < moduleCount; col++) {
            modules[row][col] = null;
          }
        }
        return modules;
      })(this._moduleCount);

      this.#setupPositionProbePattern(0, 0);
      this.#setupPositionProbePattern(this._moduleCount - 7, 0);
      this.#setupPositionProbePattern(0, this._moduleCount - 7);
      this.#setupPositionAdjustPattern();
      this.#setupTimingPattern();
      this.#setupTypeInfo(test, maskPattern);

      if (this.typeNumber >= 7) {
        this.#setupTypeNumber(test);
      }

      if (this._dataCache == null) {
        this._dataCache = this.#createData(
          this.typeNumber,
          this.errorCorrectionLevel,
          this._dataList
        );
      }

      this.#mapData(this._dataCache, maskPattern);
    }

    #mapData(data, maskPattern) {
      let inc = -1;
      let row = this._moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (let col = this._moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;

        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this._modules[row][col - c] == null) {
              let dark = false;

              if (byteIndex < data.length) {
                dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              }

              const mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              this._modules[row][col - c] = dark;
              bitIndex--;

              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || this._moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }

    #setupTypeNumber(test) {
      const bits = QRUtil.getBCHTypeNumber(this.typeNumber);

      for (let i = 0; i < 18; i++) {
        const mod = !test && ((bits >> i) & 1) == 1;
        this._modules[Math.floor(i / 3)][(i % 3) + _moduleCount - 8 - 3] = mod;
      }

      for (let i = 0; i < 18; i++) {
        const mod = !test && ((bits >> i) & 1) == 1;
        this._modules[(i % 3) + this._moduleCount - 8 - 3][Math.floor(i / 3)] =
          mod;
      }
    }

    #setupTimingPattern() {
      for (let r = 8; r < this._moduleCount - 8; r++) {
        if (this._modules[r][6] != null) {
          continue;
        }
        this._modules[r][6] = r % 2 == 0;
      }

      for (let c = 8; c < this._moduleCount - 8; c++) {
        if (this._modules[6][c] != null) {
          continue;
        }
        this._modules[6][c] = c % 2 == 0;
      }
    }

    #setupTypeInfo(test, maskPattern) {
      const data = (this.errorCorrectionLevel << 3) | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits >> i) & 1) == 1;

        if (i < 6) {
          this._modules[i][8] = mod;
        } else if (i < 8) {
          this._modules[i + 1][8] = mod;
        } else {
          this._modules[this._moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (let i = 0; i < 15; i++) {
        const mod = !test && ((bits >> i) & 1) == 1;

        if (i < 8) {
          this._modules[8][this._moduleCount - i - 1] = mod;
        } else if (i < 9) {
          this._modules[8][15 - i - 1 + 1] = mod;
        } else {
          this._modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      this._modules[this._moduleCount - 8][8] = !test;
    }

    #setupPositionAdjustPattern() {
      const pos = QRUtil.getPatternPosition(this.typeNumber);

      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];

          if (this._modules[row][col] != null) {
            continue;
          }

          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (
                r == -2 ||
                r == 2 ||
                c == -2 ||
                c == 2 ||
                (r == 0 && c == 0)
              ) {
                this._modules[row + r][col + c] = true;
              } else {
                this._modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }

    #setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this._moduleCount <= row + r) continue;

        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this._moduleCount <= col + c) continue;

          if (
            (0 <= r && r <= 6 && (c == 0 || c == 6)) ||
            (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)
          ) {
            this._modules[row + r][col + c] = true;
          } else {
            this._modules[row + r][col + c] = false;
          }
        }
      }
    }

    #stringToBytes(s = '') {
      if (s.startsWith('[')) {
        try {
          const u8 = new Uint8Array(JSON.parse(s));
          return u8;
        } catch (error) {
          throw new Error(error);
        }
      }
      const bytes = [];
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }

    #qr8BitByte(data) {
      const _bytes = this.#stringToBytes(data);
      return {
        getMode: () => 1 << 2,
        getLength: () => _bytes.length,
        write: (buffer) => {
          for (let i = 0; i < _bytes.length; i++) {
            buffer.put(_bytes[i], 8);
          }
        },
      };
    }

    #createData(typeNumber, errorCorrectionLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      const buffer = this.#qrBitBuffer();

      dataList.forEach((data) => {
        buffer.put(data.getMode(), 4);
        buffer.put(
          data.getLength(),
          QRUtil.getLengthInBits(data.getMode(), typeNumber)
        );
        data.write(buffer);
      });

      // calc num max data.
      let totalDataCount = 0;
      rsBlocks.forEach((block) => (totalDataCount += block.dataCount));

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw (
          'code length overflow. (' +
          buffer.getLengthInBits() +
          '>' +
          totalDataCount * 8 +
          ')'
        );
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 !== 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(0xec, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(0x11, 8);
      }

      return createBytes(buffer, rsBlocks);
    }

    #qrBitBuffer() {
      const _buffer = [];
      let _length = 0;

      const _this = {};

      _this.getBuffer = function () {
        return _buffer;
      };

      _this.getAt = function (index) {
        let bufIndex = Math.floor(index / 8);
        return ((_buffer[bufIndex] >>> (7 - (index % 8))) & 1) == 1;
      };

      _this.put = function (num, length) {
        for (let i = 0; i < length; i++) {
          _this.putBit(((num >>> (length - i - 1)) & 1) == 1);
        }
      };

      _this.getLengthInBits = function () {
        return _length;
      };

      _this.putBit = function (bit) {
        const bufIndex = Math.floor(_length / 8);
        if (_buffer.length <= bufIndex) {
          _buffer.push(0);
        }

        if (bit) {
          _buffer[bufIndex] |= 0x80 >>> _length % 8;
        }

        _length++;
      };

      return _this;
    }
  }

  const QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2,
  };

  const QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7,
  };

  const QRRSBlock = (function () {
    const RS_BLOCK_TABLE = [
      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16],
    ];

    const qrRSBlock = (totalCount, dataCount) => {
      return { totalCount, dataCount };
    };

    const _this = {};

    const getRsBlockTable = function (typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return undefined;
      }
    };

    _this.getRSBlocks = function (typeNumber, errorCorrectionLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock === 'undefined') {
        throw `bad rs block @ typeNumber:${typeNumber}/errorCorrectionLevel:${errorCorrectionLevel}`;
      }

      const length = rsBlock.length / 3;

      const list = [];

      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];

        for (let j = 0; j < count; j++) {
          list.push(qrRSBlock(totalCount, dataCount));
        }
      }

      return list;
    };

    return _this;
  })();

  const QRUtil = (function () {
    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170],
    ];
    const G15 =
      (1 << 10) |
      (1 << 8) |
      (1 << 5) |
      (1 << 4) |
      (1 << 2) |
      (1 << 1) |
      (1 << 0);
    const G18 =
      (1 << 12) |
      (1 << 11) |
      (1 << 10) |
      (1 << 9) |
      (1 << 8) |
      (1 << 5) |
      (1 << 2) |
      (1 << 0);
    const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    const _this = {};

    const getBCHDigit = function (data) {
      let digit = 0;
      while (data != 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function (data) {
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
      }
      return ((data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function (data) {
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function (typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function (maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return function (i, j) {
            return (i + j) % 2 == 0;
          };
        case QRMaskPattern.PATTERN001:
          return function (i, j) {
            return i % 2 == 0;
          };
        case QRMaskPattern.PATTERN010:
          return function (i, j) {
            return j % 3 == 0;
          };
        case QRMaskPattern.PATTERN011:
          return function (i, j) {
            return (i + j) % 3 == 0;
          };
        case QRMaskPattern.PATTERN100:
          return function (i, j) {
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN101:
          return function (i, j) {
            return ((i * j) % 2) + ((i * j) % 3) == 0;
          };
        case QRMaskPattern.PATTERN110:
          return function (i, j) {
            return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN111:
          return function (i, j) {
            return (((i * j) % 3) + ((i + j) % 2)) % 2 == 0;
          };

        default:
          throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function (errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    };

    _this.getLengthInBits = function (mode, type) {
      if (1 <= type && type < 10) {
        // 1 - 9
        return 8;
      } else if (type < 41) {
        // 10 - 40
        return 16;
      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function (qrcode) {
      const moduleCount = qrcode.getModuleCount();

      let lostPoint = 0;

      // LEVEL1

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrcode.isDark(row, col);

          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c)) {
                sameCount++;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }

      // LEVEL2

      for (let row = 0; row < moduleCount - 1; row++) {
        for (let col = 0; col < moduleCount - 1; col++) {
          let count = 0;
          if (qrcode.isDark(row, col)) count++;
          if (qrcode.isDark(row + 1, col)) count++;
          if (qrcode.isDark(row, col + 1)) count++;
          if (qrcode.isDark(row + 1, col + 1)) count++;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount - 6; col++) {
          if (
            qrcode.isDark(row, col) &&
            !qrcode.isDark(row, col + 1) &&
            qrcode.isDark(row, col + 2) &&
            qrcode.isDark(row, col + 3) &&
            qrcode.isDark(row, col + 4) &&
            !qrcode.isDark(row, col + 5) &&
            qrcode.isDark(row, col + 6)
          ) {
            lostPoint += 40;
          }
        }
      }

      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount - 6; row++) {
          if (
            qrcode.isDark(row, col) &&
            !qrcode.isDark(row + 1, col) &&
            qrcode.isDark(row + 2, col) &&
            qrcode.isDark(row + 3, col) &&
            qrcode.isDark(row + 4, col) &&
            !qrcode.isDark(row + 5, col) &&
            qrcode.isDark(row + 6, col)
          ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      let darkCount = 0;

      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount; row++) {
          if (qrcode.isDark(row, col)) {
            darkCount++;
          }
        }
      }

      const ratio =
        Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  })();

  const QRMath = (function () {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);

    // initialize tables
    for (let i = 0; i < 8; i++) {
      EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i++) {
      EXP_TABLE[i] =
        EXP_TABLE[i - 4] ^
        EXP_TABLE[i - 5] ^
        EXP_TABLE[i - 6] ^
        EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) {
      LOG_TABLE[EXP_TABLE[i]] = i;
    }

    const _this = {};

    _this.glog = function (n) {
      if (n < 1) {
        throw `glog(${n})`;
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function (n) {
      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  })();

  const qrPolynomial = (num, shift) => {
    if (typeof num.length == 'undefined') {
      throw `${num.length}/${shift}`;
    }

    const _num = (function () {
      let offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset++;
      }
      const _num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) {
        _num[i] = num[i + offset];
      }
      return _num;
    })();

    const _this = {};

    _this.getAt = function (index) {
      return _num[index];
    };

    _this.getLength = function () {
      return _num.length;
    };

    _this.multiply = function (e) {
      const num = new Array(_this.getLength() + e.getLength() - 1);

      for (let i = 0; i < _this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(
            QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j))
          );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function (e) {
      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));

      const num = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i++) {
        num[i] = _this.getAt(i);
      }

      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  const createBytes = function (buffer, rsBlocks) {
    let offset = 0,
      maxDcCount = 0,
      maxEcCount = 0;

    const dcData = new Array(rsBlocks.length);
    const ecData = new Array(rsBlocks.length);

    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;

      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);

      dcData[r] = new Array(dcCount);

      for (let i = 0; i < dcData[r].length; i++) {
        dcData[r][i] = 0xff & buffer.getBuffer()[i + offset];
      }
      offset += dcCount;

      const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      const rawPoly = qrPolynomial(dcData[r], rsPoly.getLength() - 1);

      const modPoly = rawPoly.mod(rsPoly);
      ecData[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecData[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecData[r].length;
        ecData[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
      }
    }

    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) {
      totalCodeCount += rsBlocks[i].totalCount;
    }

    const data = new Array(totalCodeCount);
    let index = 0;

    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcData[r].length) {
          data[index] = dcData[r][i];
          index++;
        }
      }
    }

    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecData[r].length) {
          data[index] = ecData[r][i];
          index++;
        }
      }
    }

    return data;
  };

  return QRCode;
})();
