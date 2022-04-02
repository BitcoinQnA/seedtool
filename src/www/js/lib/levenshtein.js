// Levenshtein Library
// https://github.com/gf3/Levenshtein

// This is free and unencumbered software released into the public domain.

// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.

// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

// For more information, please refer to <http://unlicense.org/>

(function (root, factory) {
  if (
    typeof define == 'function' &&
    typeof define.amd == 'object' &&
    define.amd
  ) {
    define(function () {
      return factory(root);
    });
  } else if (typeof module == 'object' && module && module.exports) {
    module.exports = factory(root);
  } else {
    root.Levenshtein = factory(root);
  }
})(this, function (root) {
  function forEach(array, fn) {
    var i, length;
    i = -1;
    length = array.length;
    while (++i < length) fn(array[i], i, array);
  }

  function map(array, fn) {
    var result;
    result = Array(array.length);
    forEach(array, function (val, i, array) {
      result[i] = fn(val, i, array);
    });
    return result;
  }

  function reduce(array, fn, accumulator) {
    forEach(array, function (val, i, array) {
      accumulator = fn(val, i, array);
    });
    return accumulator;
  }

  // Levenshtein distance
  function Levenshtein(str_m, str_n) {
    var previous, current, matrix;
    // Constructor
    matrix = this._matrix = [];

    // Sanity checks
    if (str_m == str_n) return (this.distance = 0);
    else if (str_m == '') return (this.distance = str_n.length);
    else if (str_n == '') return (this.distance = str_m.length);
    else {
      // Danger Will Robinson
      previous = [0];
      forEach(str_m, function (v, i) {
        i++, (previous[i] = i);
      });

      matrix[0] = previous;
      forEach(str_n, function (n_val, n_idx) {
        current = [++n_idx];
        forEach(str_m, function (m_val, m_idx) {
          m_idx++;
          if (str_m.charAt(m_idx - 1) == str_n.charAt(n_idx - 1))
            current[m_idx] = previous[m_idx - 1];
          else
            current[m_idx] = Math.min(
              previous[m_idx] + 1, // Deletion
              current[m_idx - 1] + 1, // Insertion
              previous[m_idx - 1] + 1 // Subtraction
            );
        });
        previous = current;
        matrix[matrix.length] = previous;
      });

      return (this.distance = current[current.length - 1]);
    }
  }

  Levenshtein.prototype.toString = Levenshtein.prototype.inspect =
    function inspect(no_print) {
      var matrix, max, buff, sep, rows;
      matrix = this.getMatrix();
      max = reduce(
        matrix,
        function (m, o) {
          return Math.max(m, reduce(o, Math.max, 0));
        },
        0
      );
      buff = Array((max + '').length).join(' ');

      sep = [];
      while (sep.length < ((matrix[0] && matrix[0].length) || 0))
        sep[sep.length] = Array(buff.length + 1).join('-');
      sep = sep.join('-+') + '-';

      rows = map(matrix, function (row) {
        var cells;
        cells = map(row, function (cell) {
          return (buff + cell).slice(-buff.length);
        });
        return cells.join(' |') + ' ';
      });

      return rows.join('\n' + sep + '\n');
    };

  Levenshtein.prototype.getMatrix = function () {
    return this._matrix.slice();
  };

  Levenshtein.prototype.valueOf = function () {
    return this.distance;
  };

  return Levenshtein;
});
