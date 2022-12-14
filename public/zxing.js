var Module = typeof Module != 'undefined' ? Module : {};
var moduleOverrides = Object.assign({}, Module);
var arguments_ = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};
var ENVIRONMENT_IS_WEB = typeof window == 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function';
var ENVIRONMENT_IS_NODE =
  typeof process == 'object' &&
  typeof process.versions == 'object' &&
  typeof process.versions.node == 'string';
var ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (Module['ENVIRONMENT']) {
  throw new Error(
    'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)'
  );
}
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}
var read_, readAsync, readBinary, setWindowTitle;
function logExceptionOnExit(e) {
  if (e instanceof ExitStatus) return;
  let toLog = e;
  if (e && typeof e == 'object' && e.stack) {
    toLog = [e, e.stack];
  }
  err('exiting due to exception: ' + toLog);
}
if (ENVIRONMENT_IS_NODE) {
  if (
    typeof process == 'undefined' ||
    !process.release ||
    process.release.name !== 'node'
  )
    throw new Error(
      'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
    );
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }
  var fs;
  var nodePath;
  var requireNodeFS = () => {
    if (!nodePath) {
      fs = require('fs');
      nodePath = require('path');
    }
  };
  read_ = (filename, binary) => {
    requireNodeFS();
    filename = nodePath['normalize'](filename);
    return fs.readFileSync(filename, binary ? undefined : 'utf8');
  };
  readBinary = (filename) => {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };
  readAsync = (filename, onload, onerror) => {
    requireNodeFS();
    filename = nodePath['normalize'](filename);
    fs.readFile(filename, function(err, data) {
      if (err) onerror(err);
      else onload(data.buffer);
    });
  };
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }
  arguments_ = process['argv'].slice(2);
  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }
  process['on']('uncaughtException', function(ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  process['on']('unhandledRejection', function(reason) {
    throw reason;
  });
  quit_ = (status, toThrow) => {
    if (keepRuntimeAlive()) {
      process['exitCode'] = status;
      throw toThrow;
    }
    logExceptionOnExit(toThrow);
    process['exit'](status);
  };
  Module['inspect'] = function() {
    return '[Emscripten Module object]';
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if (
    (typeof process == 'object' && typeof require === 'function') ||
    typeof window == 'object' ||
    typeof importScripts == 'function'
  )
    throw new Error(
      'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
    );
  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      return read(f);
    };
  }
  readBinary = function readBinary(f) {
    let data;
    if (typeof readbuffer == 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data == 'object');
    return data;
  };
  readAsync = function readAsync(f, onload, onerror) {
    setTimeout(() => onload(readBinary(f)), 0);
  };
  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }
  if (typeof quit == 'function') {
    quit_ = (status, toThrow) => {
      logExceptionOnExit(toThrow);
      quit(status);
    };
  }
  if (typeof print != 'undefined') {
    if (typeof console == 'undefined') console = {};
    console.log = print;
    console.warn = console.error =
      typeof printErr != 'undefined' ? printErr : print;
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href;
  } else if (typeof document != 'undefined' && document.currentScript) {
    scriptDirectory = document.currentScript.src;
  }
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
    );
  } else {
    scriptDirectory = '';
  }
  if (!(typeof window == 'object' || typeof importScripts == 'function'))
    throw new Error(
      'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
    );
  {
    read_ = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    };
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = (url) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      };
    }
    readAsync = (url, onload, onerror) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
          onload(xhr.response);
          return;
        }
        onerror();
      };
      xhr.onerror = onerror;
      xhr.send(null);
    };
  }
  setWindowTitle = (title) => (document.title = title);
} else {
  throw new Error('environment detection error');
}
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);
Object.assign(Module, moduleOverrides);
moduleOverrides = null;
checkIncomingModuleAPI();
if (Module['arguments']) arguments_ = Module['arguments'];
legacyModuleProp('arguments', 'arguments_');
if (Module['thisProgram']) thisProgram = Module['thisProgram'];
legacyModuleProp('thisProgram', 'thisProgram');
if (Module['quit']) quit_ = Module['quit'];
legacyModuleProp('quit', 'quit_');
assert(
  typeof Module['memoryInitializerPrefixURL'] == 'undefined',
  'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['pthreadMainPrefixURL'] == 'undefined',
  'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['cdInitializerPrefixURL'] == 'undefined',
  'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['filePackagePrefixURL'] == 'undefined',
  'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'
);
assert(
  typeof Module['read'] == 'undefined',
  'Module.read option was removed (modify read_ in JS)'
);
assert(
  typeof Module['readAsync'] == 'undefined',
  'Module.readAsync option was removed (modify readAsync in JS)'
);
assert(
  typeof Module['readBinary'] == 'undefined',
  'Module.readBinary option was removed (modify readBinary in JS)'
);
assert(
  typeof Module['setWindowTitle'] == 'undefined',
  'Module.setWindowTitle option was removed (modify setWindowTitle in JS)'
);
assert(
  typeof Module['TOTAL_MEMORY'] == 'undefined',
  'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY'
);
legacyModuleProp('read', 'read_');
legacyModuleProp('readAsync', 'readAsync');
legacyModuleProp('readBinary', 'readBinary');
legacyModuleProp('setWindowTitle', 'setWindowTitle');
assert(
  !ENVIRONMENT_IS_SHELL,
  "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable."
);
var POINTER_SIZE = 4;
function legacyModuleProp(prop, newName) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get: function() {
        abort(
          'Module.' +
            prop +
            ' has been replaced with plain ' +
            newName +
            ' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)'
        );
      },
    });
  }
}
function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(
      '`Module.' +
        prop +
        '` was supplied but `' +
        prop +
        '` not included in INCOMING_MODULE_JS_API'
    );
  }
}
function isExportedByForceFilesystem(name) {
  return (
    name === 'FS_createPath' ||
    name === 'FS_createDataFile' ||
    name === 'FS_createPreloadedFile' ||
    name === 'FS_unlink' ||
    name === 'addRunDependency' ||
    name === 'FS_createLazyFile' ||
    name === 'FS_createDevice' ||
    name === 'removeRunDependency'
  );
}
function missingLibrarySymbol(sym) {
  if (
    typeof globalThis !== 'undefined' &&
    !Object.getOwnPropertyDescriptor(globalThis, sym)
  ) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get: function() {
        var msg =
          '`' +
          sym +
          '` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line';
        if (isExportedByForceFilesystem(sym)) {
          msg +=
            '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        warnOnce(msg);
        return undefined;
      },
    });
  }
}
function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get: function() {
        var msg =
          "'" +
          sym +
          "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)";
        if (isExportedByForceFilesystem(sym)) {
          msg +=
            '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}
var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
legacyModuleProp('wasmBinary', 'wasmBinary');
var noExitRuntime = Module['noExitRuntime'] || true;
legacyModuleProp('noExitRuntime', 'noExitRuntime');
if (typeof WebAssembly != 'object') {
  abort('no native wasm support detected');
}
var wasmMemory;
var ABORT = false;
var EXITSTATUS;
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}
var UTF8Decoder =
  typeof TextDecoder != 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = '';
  while (idx < endPtr) {
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      if ((u0 & 248) != 240)
        warnOnce(
          'Invalid UTF-8 leading byte 0x' +
            u0.toString(16) +
            ' encountered when deserializing a UTF-8 string in wasm memory to a JS string!'
        );
      u0 =
        ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
}
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}
function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u > 1114111)
        warnOnce(
          'Invalid Unicode code point 0x' +
            u.toString(16) +
            ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).'
        );
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  heap[outIdx] = 0;
  return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var c = str.charCodeAt(i);
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
}
var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK'])
  assert(
    TOTAL_STACK === Module['TOTAL_STACK'],
    'the stack size can no longer be determined at runtime'
  );
var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216;
legacyModuleProp('INITIAL_MEMORY', 'INITIAL_MEMORY');
assert(
  INITIAL_MEMORY >= TOTAL_STACK,
  'INITIAL_MEMORY should be larger than TOTAL_STACK, was ' +
    INITIAL_MEMORY +
    '! (TOTAL_STACK=' +
    TOTAL_STACK +
    ')'
);
assert(
  typeof Int32Array != 'undefined' &&
    typeof Float64Array !== 'undefined' &&
    Int32Array.prototype.subarray != undefined &&
    Int32Array.prototype.set != undefined,
  'JS engine does not provide full typed array support'
);
assert(
  !Module['wasmMemory'],
  'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally'
);
assert(
  INITIAL_MEMORY == 16777216,
  'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically'
);
var wasmTable;
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  HEAPU32[max >> 2] = 34821223;
  HEAPU32[(max + 4) >> 2] = 2310721022;
  HEAPU32[0] = 1668509029;
}
function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  var cookie1 = HEAPU32[max >> 2];
  var cookie2 = HEAPU32[(max + 4) >> 2];
  if (cookie1 != 34821223 || cookie2 != 2310721022) {
    abort(
      'Stack overflow! Stack cookie has been overwritten at 0x' +
        max.toString(16) +
        ', expected hex dwords 0x89BACDFE and 0x2135467, but received 0x' +
        cookie2.toString(16) +
        ' 0x' +
        cookie1.toString(16)
    );
  }
  if (HEAPU32[0] !== 1668509029)
    abort(
      'Runtime error: The application has corrupted its heap memory area (address zero)!'
    );
}
(function() {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 25459;
  if (h8[0] !== 115 || h8[1] !== 99)
    throw 'Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)';
})();
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
function keepRuntimeAlive() {
  return noExitRuntime;
}
function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function')
      Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  checkStackCookie();
  callRuntimeCallbacks(__ATINIT__);
}
function postRun() {
  checkStackCookie();
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function')
      Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
assert(
  Math.imul,
  'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.fround,
  'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.clz32,
  'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
assert(
  Math.trunc,
  'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill'
);
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
var runDependencyTracking = {};
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != 'undefined') {
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 1e4);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}
function abort(what) {
  {
    if (Module['onAbort']) {
      Module['onAbort'](what);
    }
  }
  what = 'Aborted(' + what + ')';
  err(what);
  ABORT = true;
  EXITSTATUS = 1;
  var e = new WebAssembly.RuntimeError(what);
  throw e;
}
var FS = {
  error: function() {
    abort(
      'Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM'
    );
  },
  init: function() {
    FS.error();
  },
  createDataFile: function() {
    FS.error();
  },
  createPreloadedFile: function() {
    FS.error();
  },
  createLazyFile: function() {
    FS.error();
  },
  open: function() {
    FS.error();
  },
  mkdev: function() {
    FS.error();
  },
  registerDevice: function() {
    FS.error();
  },
  analyzePath: function() {
    FS.error();
  },
  loadFilesFromDB: function() {
    FS.error();
  },
  ErrnoError: function ErrnoError() {
    FS.error();
  },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;
var dataURIPrefix = 'data:application/octet-stream;base64,';
function isDataURI(filename) {
  return filename.startsWith(dataURIPrefix);
}
function isFileURI(filename) {
  return filename.startsWith('file://');
}
function createExportWrapper(name, fixedasm) {
  return function() {
    var displayName = name;
    var asm = fixedasm;
    if (!fixedasm) {
      asm = Module['asm'];
    }
    assert(
      runtimeInitialized,
      'native function `' +
        displayName +
        '` called before runtime initialization'
    );
    if (!asm[name]) {
      assert(
        asm[name],
        'exported native function `' + displayName + '` not found'
      );
    }
    return asm[name].apply(null, arguments);
  };
}
var wasmBinaryFile;
wasmBinaryFile = 'zxing.wasm';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}
function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw 'both async and sync fetching of the wasm failed';
  } catch (err) {
    abort(err);
  }
}
function getBinaryPromise() {
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch == 'function' && !isFileURI(wasmBinaryFile)) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' })
        .then(function(response) {
          if (!response['ok']) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }
          return response['arrayBuffer']();
        })
        .catch(function() {
          return getBinary(wasmBinaryFile);
        });
    } else {
      if (readAsync) {
        return new Promise(function(resolve, reject) {
          readAsync(
            wasmBinaryFile,
            function(response) {
              resolve(new Uint8Array(response));
            },
            reject
          );
        });
      }
    }
  }
  return Promise.resolve().then(function() {
    return getBinary(wasmBinaryFile);
  });
}
function createWasm() {
  var info = { env: asmLibraryArg, wasi_snapshot_preview1: asmLibraryArg };
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    wasmMemory = Module['asm']['memory'];
    assert(wasmMemory, 'memory not found in wasm exports');
    updateGlobalBufferAndViews(wasmMemory.buffer);
    wasmTable = Module['asm']['__indirect_function_table'];
    assert(wasmTable, 'table not found in wasm exports');
    addOnInit(Module['asm']['__wasm_call_ctors']);
    removeRunDependency('wasm-instantiate');
  }
  addRunDependency('wasm-instantiate');
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    assert(
      Module === trueModule,
      'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
    );
    trueModule = null;
    receiveInstance(result['instance']);
  }
  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise()
      .then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      })
      .then(function(instance) {
        return instance;
      })
      .then(receiver, function(reason) {
        err('failed to asynchronously prepare wasm: ' + reason);
        if (isFileURI(wasmBinaryFile)) {
          err(
            'warning: Loading from a file URI (' +
              wasmBinaryFile +
              ') is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing'
          );
        }
        abort(reason);
      });
  }
  function instantiateAsync() {
    if (
      !wasmBinary &&
      typeof WebAssembly.instantiateStreaming == 'function' &&
      !isDataURI(wasmBinaryFile) &&
      !isFileURI(wasmBinaryFile) &&
      !ENVIRONMENT_IS_NODE &&
      typeof fetch == 'function'
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(
        function(response) {
          var result = WebAssembly.instantiateStreaming(response, info);
          return result.then(receiveInstantiationResult, function(reason) {
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
        }
      );
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch (e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }
  instantiateAsync();
  return {};
}
var tempDouble;
var tempI64;
function ExitStatus(status) {
  this.name = 'ExitStatus';
  this.message = 'Program terminated with exit(' + status + ')';
  this.status = status;
}
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    callbacks.shift()(Module);
  }
}
function demangle(func) {
  warnOnce(
    'warning: build with -sDEMANGLE_SUPPORT to link in libcxxabi demangling'
  );
  return func;
}
function demangleAll(text) {
  var regex = /\b_Z[\w\d_]+/g;
  return text.replace(regex, function(x) {
    var y = demangle(x);
    return x === y ? x : y + ' [' + x + ']';
  });
}
function jsStackTrace() {
  var error = new Error();
  if (!error.stack) {
    try {
      throw new Error();
    } catch (e) {
      error = e;
    }
    if (!error.stack) {
      return '(no stack trace available)';
    }
  }
  return error.stack.toString();
}
function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
    err(text);
  }
}
function writeArrayToMemory(array, buffer) {
  assert(
    array.length >= 0,
    'writeArrayToMemory array must have a length (should be an array or typed array)'
  );
  HEAP8.set(array, buffer);
}
function ___cxa_allocate_exception(size) {
  return _malloc(size + 24) + 24;
}
var exceptionCaught = [];
function exception_addRef(info) {
  info.add_ref();
}
var uncaughtExceptionCount = 0;
function ___cxa_begin_catch(ptr) {
  var info = new ExceptionInfo(ptr);
  if (!info.get_caught()) {
    info.set_caught(true);
    uncaughtExceptionCount--;
  }
  info.set_rethrown(false);
  exceptionCaught.push(info);
  exception_addRef(info);
  return info.get_exception_ptr();
}
function ___cxa_call_unexpected(exception) {
  err('Unexpected exception thrown, this is not properly supported - aborting');
  ABORT = true;
  throw exception;
}
var exceptionLast = 0;
function ExceptionInfo(excPtr) {
  this.excPtr = excPtr;
  this.ptr = excPtr - 24;
  this.set_type = function(type) {
    HEAPU32[(this.ptr + 4) >> 2] = type;
  };
  this.get_type = function() {
    return HEAPU32[(this.ptr + 4) >> 2];
  };
  this.set_destructor = function(destructor) {
    HEAPU32[(this.ptr + 8) >> 2] = destructor;
  };
  this.get_destructor = function() {
    return HEAPU32[(this.ptr + 8) >> 2];
  };
  this.set_refcount = function(refcount) {
    HEAP32[this.ptr >> 2] = refcount;
  };
  this.set_caught = function(caught) {
    caught = caught ? 1 : 0;
    HEAP8[(this.ptr + 12) >> 0] = caught;
  };
  this.get_caught = function() {
    return HEAP8[(this.ptr + 12) >> 0] != 0;
  };
  this.set_rethrown = function(rethrown) {
    rethrown = rethrown ? 1 : 0;
    HEAP8[(this.ptr + 13) >> 0] = rethrown;
  };
  this.get_rethrown = function() {
    return HEAP8[(this.ptr + 13) >> 0] != 0;
  };
  this.init = function(type, destructor) {
    this.set_adjusted_ptr(0);
    this.set_type(type);
    this.set_destructor(destructor);
    this.set_refcount(0);
    this.set_caught(false);
    this.set_rethrown(false);
  };
  this.add_ref = function() {
    var value = HEAP32[this.ptr >> 2];
    HEAP32[this.ptr >> 2] = value + 1;
  };
  this.release_ref = function() {
    var prev = HEAP32[this.ptr >> 2];
    HEAP32[this.ptr >> 2] = prev - 1;
    assert(prev > 0);
    return prev === 1;
  };
  this.set_adjusted_ptr = function(adjustedPtr) {
    HEAPU32[(this.ptr + 16) >> 2] = adjustedPtr;
  };
  this.get_adjusted_ptr = function() {
    return HEAPU32[(this.ptr + 16) >> 2];
  };
  this.get_exception_ptr = function() {
    var isPointer = ___cxa_is_pointer_type(this.get_type());
    if (isPointer) {
      return HEAPU32[this.excPtr >> 2];
    }
    var adjusted = this.get_adjusted_ptr();
    if (adjusted !== 0) return adjusted;
    return this.excPtr;
  };
}
function ___cxa_free_exception(ptr) {
  try {
    return _free(new ExceptionInfo(ptr).ptr);
  } catch (e) {
    err('exception during __cxa_free_exception: ' + e);
  }
}
function getWasmTableEntry(funcPtr) {
  return wasmTable.get(funcPtr);
}
function exception_decRef(info) {
  if (info.release_ref() && !info.get_rethrown()) {
    var destructor = info.get_destructor();
    if (destructor) {
      getWasmTableEntry(destructor)(info.excPtr);
    }
    ___cxa_free_exception(info.excPtr);
  }
}
function ___cxa_end_catch() {
  _setThrew(0);
  assert(exceptionCaught.length > 0);
  var info = exceptionCaught.pop();
  exception_decRef(info);
  exceptionLast = 0;
}
function ___resumeException(ptr) {
  if (!exceptionLast) {
    exceptionLast = ptr;
  }
  throw ptr;
}
function ___cxa_find_matching_catch_2() {
  var thrown = exceptionLast;
  if (!thrown) {
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    setTempRet0(0);
    return thrown;
  }
  for (var i = 0; i < arguments.length; i++) {
    var caughtType = arguments[i];
    if (caughtType === 0 || caughtType === thrownType) {
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
}
function ___cxa_find_matching_catch_3() {
  var thrown = exceptionLast;
  if (!thrown) {
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    setTempRet0(0);
    return thrown;
  }
  for (var i = 0; i < arguments.length; i++) {
    var caughtType = arguments[i];
    if (caughtType === 0 || caughtType === thrownType) {
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
}
function ___cxa_find_matching_catch_4() {
  var thrown = exceptionLast;
  if (!thrown) {
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    setTempRet0(0);
    return thrown;
  }
  for (var i = 0; i < arguments.length; i++) {
    var caughtType = arguments[i];
    if (caughtType === 0 || caughtType === thrownType) {
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
}
function ___cxa_find_matching_catch_6() {
  var thrown = exceptionLast;
  if (!thrown) {
    setTempRet0(0);
    return 0;
  }
  var info = new ExceptionInfo(thrown);
  info.set_adjusted_ptr(thrown);
  var thrownType = info.get_type();
  if (!thrownType) {
    setTempRet0(0);
    return thrown;
  }
  for (var i = 0; i < arguments.length; i++) {
    var caughtType = arguments[i];
    if (caughtType === 0 || caughtType === thrownType) {
      break;
    }
    var adjusted_ptr_addr = info.ptr + 16;
    if (___cxa_can_catch(caughtType, thrownType, adjusted_ptr_addr)) {
      setTempRet0(caughtType);
      return thrown;
    }
  }
  setTempRet0(thrownType);
  return thrown;
}
function ___cxa_rethrow() {
  var info = exceptionCaught.pop();
  if (!info) {
    abort('no exception to throw');
  }
  var ptr = info.excPtr;
  if (!info.get_rethrown()) {
    exceptionCaught.push(info);
    info.set_rethrown(true);
    info.set_caught(false);
    uncaughtExceptionCount++;
  }
  exceptionLast = ptr;
  throw ptr;
}
function ___cxa_throw(ptr, type, destructor) {
  var info = new ExceptionInfo(ptr);
  info.init(type, destructor);
  exceptionLast = ptr;
  uncaughtExceptionCount++;
  throw ptr;
}
function ___cxa_uncaught_exceptions() {
  return uncaughtExceptionCount;
}
function __embind_register_bigint(
  primitiveType,
  name,
  size,
  minRange,
  maxRange
) {}
function getShiftFromSize(size) {
  switch (size) {
    case 1:
      return 0;
    case 2:
      return 1;
    case 4:
      return 2;
    case 8:
      return 3;
    default:
      throw new TypeError('Unknown type size: ' + size);
  }
}
function embind_init_charCodes() {
  var codes = new Array(256);
  for (var i = 0; i < 256; ++i) {
    codes[i] = String.fromCharCode(i);
  }
  embind_charCodes = codes;
}
var embind_charCodes = undefined;
function readLatin1String(ptr) {
  var ret = '';
  var c = ptr;
  while (HEAPU8[c]) {
    ret += embind_charCodes[HEAPU8[c++]];
  }
  return ret;
}
var awaitingDependencies = {};
var registeredTypes = {};
var typeDependencies = {};
var char_0 = 48;
var char_9 = 57;
function makeLegalFunctionName(name) {
  if (undefined === name) {
    return '_unknown';
  }
  name = name.replace(/[^a-zA-Z0-9_]/g, '$');
  var f = name.charCodeAt(0);
  if (f >= char_0 && f <= char_9) {
    return '_' + name;
  }
  return name;
}
function createNamedFunction(name, body) {
  name = makeLegalFunctionName(name);
  return new Function(
    'body',
    'return function ' +
      name +
      '() {\n' +
      '    "use strict";' +
      '    return body.apply(this, arguments);\n' +
      '};\n'
  )(body);
}
function extendError(baseErrorType, errorName) {
  var errorClass = createNamedFunction(errorName, function(message) {
    this.name = errorName;
    this.message = message;
    var stack = new Error(message).stack;
    if (stack !== undefined) {
      this.stack =
        this.toString() + '\n' + stack.replace(/^Error(:[^\n]*)?\n/, '');
    }
  });
  errorClass.prototype = Object.create(baseErrorType.prototype);
  errorClass.prototype.constructor = errorClass;
  errorClass.prototype.toString = function() {
    if (this.message === undefined) {
      return this.name;
    } else {
      return this.name + ': ' + this.message;
    }
  };
  return errorClass;
}
var BindingError = undefined;
function throwBindingError(message) {
  throw new BindingError(message);
}
var InternalError = undefined;
function throwInternalError(message) {
  throw new InternalError(message);
}
function registerType(rawType, registeredInstance, options = {}) {
  if (!('argPackAdvance' in registeredInstance)) {
    throw new TypeError(
      'registerType registeredInstance requires argPackAdvance'
    );
  }
  var name = registeredInstance.name;
  if (!rawType) {
    throwBindingError(
      'type "' + name + '" must have a positive integer typeid pointer'
    );
  }
  if (registeredTypes.hasOwnProperty(rawType)) {
    if (options.ignoreDuplicateRegistrations) {
      return;
    } else {
      throwBindingError("Cannot register type '" + name + "' twice");
    }
  }
  registeredTypes[rawType] = registeredInstance;
  delete typeDependencies[rawType];
  if (awaitingDependencies.hasOwnProperty(rawType)) {
    var callbacks = awaitingDependencies[rawType];
    delete awaitingDependencies[rawType];
    callbacks.forEach((cb) => cb());
  }
}
function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
  var shift = getShiftFromSize(size);
  name = readLatin1String(name);
  registerType(rawType, {
    name: name,
    fromWireType: function(wt) {
      return !!wt;
    },
    toWireType: function(destructors, o) {
      return o ? trueValue : falseValue;
    },
    argPackAdvance: 8,
    readValueFromPointer: function(pointer) {
      var heap;
      if (size === 1) {
        heap = HEAP8;
      } else if (size === 2) {
        heap = HEAP16;
      } else if (size === 4) {
        heap = HEAP32;
      } else {
        throw new TypeError('Unknown boolean type size: ' + name);
      }
      return this['fromWireType'](heap[pointer >> shift]);
    },
    destructorFunction: null,
  });
}
var emval_free_list = [];
var emval_handle_array = [
  {},
  { value: undefined },
  { value: null },
  { value: true },
  { value: false },
];
function __emval_decref(handle) {
  if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
    emval_handle_array[handle] = undefined;
    emval_free_list.push(handle);
  }
}
function count_emval_handles() {
  var count = 0;
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      ++count;
    }
  }
  return count;
}
function get_first_emval() {
  for (var i = 5; i < emval_handle_array.length; ++i) {
    if (emval_handle_array[i] !== undefined) {
      return emval_handle_array[i];
    }
  }
  return null;
}
function init_emval() {
  Module['count_emval_handles'] = count_emval_handles;
  Module['get_first_emval'] = get_first_emval;
}
var Emval = {
  toValue: (handle) => {
    if (!handle) {
      throwBindingError('Cannot use deleted val. handle = ' + handle);
    }
    return emval_handle_array[handle].value;
  },
  toHandle: (value) => {
    switch (value) {
      case undefined:
        return 1;
      case null:
        return 2;
      case true:
        return 3;
      case false:
        return 4;
      default: {
        var handle = emval_free_list.length
          ? emval_free_list.pop()
          : emval_handle_array.length;
        emval_handle_array[handle] = { refcount: 1, value: value };
        return handle;
      }
    }
  },
};
function simpleReadValueFromPointer(pointer) {
  return this['fromWireType'](HEAP32[pointer >> 2]);
}
function __embind_register_emval(rawType, name) {
  name = readLatin1String(name);
  registerType(rawType, {
    name: name,
    fromWireType: function(handle) {
      var rv = Emval.toValue(handle);
      __emval_decref(handle);
      return rv;
    },
    toWireType: function(destructors, value) {
      return Emval.toHandle(value);
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: null,
  });
}
function embindRepr(v) {
  if (v === null) {
    return 'null';
  }
  var t = typeof v;
  if (t === 'object' || t === 'array' || t === 'function') {
    return v.toString();
  } else {
    return '' + v;
  }
}
function floatReadValueFromPointer(name, shift) {
  switch (shift) {
    case 2:
      return function(pointer) {
        return this['fromWireType'](HEAPF32[pointer >> 2]);
      };
    case 3:
      return function(pointer) {
        return this['fromWireType'](HEAPF64[pointer >> 3]);
      };
    default:
      throw new TypeError('Unknown float type: ' + name);
  }
}
function __embind_register_float(rawType, name, size) {
  var shift = getShiftFromSize(size);
  name = readLatin1String(name);
  registerType(rawType, {
    name: name,
    fromWireType: function(value) {
      return value;
    },
    toWireType: function(destructors, value) {
      if (typeof value != 'number' && typeof value != 'boolean') {
        throw new TypeError(
          'Cannot convert "' + embindRepr(value) + '" to ' + this.name
        );
      }
      return value;
    },
    argPackAdvance: 8,
    readValueFromPointer: floatReadValueFromPointer(name, shift),
    destructorFunction: null,
  });
}
function integerReadValueFromPointer(name, shift, signed) {
  switch (shift) {
    case 0:
      return signed
        ? function readS8FromPointer(pointer) {
            return HEAP8[pointer];
          }
        : function readU8FromPointer(pointer) {
            return HEAPU8[pointer];
          };
    case 1:
      return signed
        ? function readS16FromPointer(pointer) {
            return HEAP16[pointer >> 1];
          }
        : function readU16FromPointer(pointer) {
            return HEAPU16[pointer >> 1];
          };
    case 2:
      return signed
        ? function readS32FromPointer(pointer) {
            return HEAP32[pointer >> 2];
          }
        : function readU32FromPointer(pointer) {
            return HEAPU32[pointer >> 2];
          };
    default:
      throw new TypeError('Unknown integer type: ' + name);
  }
}
function __embind_register_integer(
  primitiveType,
  name,
  size,
  minRange,
  maxRange
) {
  name = readLatin1String(name);
  if (maxRange === -1) {
    maxRange = 4294967295;
  }
  var shift = getShiftFromSize(size);
  var fromWireType = (value) => value;
  if (minRange === 0) {
    var bitshift = 32 - 8 * size;
    fromWireType = (value) => (value << bitshift) >>> bitshift;
  }
  var isUnsignedType = name.includes('unsigned');
  var checkAssertions = (value, toTypeName) => {
    if (typeof value != 'number' && typeof value != 'boolean') {
      throw new TypeError(
        'Cannot convert "' + embindRepr(value) + '" to ' + toTypeName
      );
    }
    if (value < minRange || value > maxRange) {
      throw new TypeError(
        'Passing a number "' +
          embindRepr(value) +
          '" from JS side to C/C++ side to an argument of type "' +
          name +
          '", which is outside the valid range [' +
          minRange +
          ', ' +
          maxRange +
          ']!'
      );
    }
  };
  var toWireType;
  if (isUnsignedType) {
    toWireType = function(destructors, value) {
      checkAssertions(value, this.name);
      return value >>> 0;
    };
  } else {
    toWireType = function(destructors, value) {
      checkAssertions(value, this.name);
      return value;
    };
  }
  registerType(primitiveType, {
    name: name,
    fromWireType: fromWireType,
    toWireType: toWireType,
    argPackAdvance: 8,
    readValueFromPointer: integerReadValueFromPointer(
      name,
      shift,
      minRange !== 0
    ),
    destructorFunction: null,
  });
}
function __embind_register_memory_view(rawType, dataTypeIndex, name) {
  var typeMapping = [
    Int8Array,
    Uint8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
  ];
  var TA = typeMapping[dataTypeIndex];
  function decodeMemoryView(handle) {
    handle = handle >> 2;
    var heap = HEAPU32;
    var size = heap[handle];
    var data = heap[handle + 1];
    return new TA(buffer, data, size);
  }
  name = readLatin1String(name);
  registerType(
    rawType,
    {
      name: name,
      fromWireType: decodeMemoryView,
      argPackAdvance: 8,
      readValueFromPointer: decodeMemoryView,
    },
    { ignoreDuplicateRegistrations: true }
  );
}
function __embind_register_std_string(rawType, name) {
  name = readLatin1String(name);
  var stdStringIsUTF8 = name === 'std::string';
  registerType(rawType, {
    name: name,
    fromWireType: function(value) {
      var length = HEAPU32[value >> 2];
      var payload = value + 4;
      var str;
      if (stdStringIsUTF8) {
        var decodeStartPtr = payload;
        for (var i = 0; i <= length; ++i) {
          var currentBytePtr = payload + i;
          if (i == length || HEAPU8[currentBytePtr] == 0) {
            var maxRead = currentBytePtr - decodeStartPtr;
            var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
            if (str === undefined) {
              str = stringSegment;
            } else {
              str += String.fromCharCode(0);
              str += stringSegment;
            }
            decodeStartPtr = currentBytePtr + 1;
          }
        }
      } else {
        var a = new Array(length);
        for (var i = 0; i < length; ++i) {
          a[i] = String.fromCharCode(HEAPU8[payload + i]);
        }
        str = a.join('');
      }
      _free(value);
      return str;
    },
    toWireType: function(destructors, value) {
      if (value instanceof ArrayBuffer) {
        value = new Uint8Array(value);
      }
      var length;
      var valueIsOfTypeString = typeof value == 'string';
      if (
        !(
          valueIsOfTypeString ||
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray ||
          value instanceof Int8Array
        )
      ) {
        throwBindingError('Cannot pass non-string to std::string');
      }
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        length = lengthBytesUTF8(value);
      } else {
        length = value.length;
      }
      var base = _malloc(4 + length + 1);
      var ptr = base + 4;
      HEAPU32[base >> 2] = length;
      if (stdStringIsUTF8 && valueIsOfTypeString) {
        stringToUTF8(value, ptr, length + 1);
      } else {
        if (valueIsOfTypeString) {
          for (var i = 0; i < length; ++i) {
            var charCode = value.charCodeAt(i);
            if (charCode > 255) {
              _free(ptr);
              throwBindingError(
                'String has UTF-16 code units that do not fit in 8 bits'
              );
            }
            HEAPU8[ptr + i] = charCode;
          }
        } else {
          for (var i = 0; i < length; ++i) {
            HEAPU8[ptr + i] = value[i];
          }
        }
      }
      if (destructors !== null) {
        destructors.push(_free, base);
      }
      return base;
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function(ptr) {
      _free(ptr);
    },
  });
}
var UTF16Decoder =
  typeof TextDecoder != 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr, maxBytesToRead) {
  assert(
    ptr % 2 == 0,
    'Pointer passed to UTF16ToString must be aligned to two bytes!'
  );
  var endPtr = ptr;
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;
  if (endPtr - ptr > 32 && UTF16Decoder)
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  var str = '';
  for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
    var codeUnit = HEAP16[(ptr + i * 2) >> 1];
    if (codeUnit == 0) break;
    str += String.fromCharCode(codeUnit);
  }
  return str;
}
function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 2 == 0,
    'Pointer passed to stringToUTF16 must be aligned to two bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2;
  var startPtr = outPtr;
  var numCharsToWrite =
    maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    var codeUnit = str.charCodeAt(i);
    HEAP16[outPtr >> 1] = codeUnit;
    outPtr += 2;
  }
  HEAP16[outPtr >> 1] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF16(str) {
  return str.length * 2;
}
function UTF32ToString(ptr, maxBytesToRead) {
  assert(
    ptr % 4 == 0,
    'Pointer passed to UTF32ToString must be aligned to four bytes!'
  );
  var i = 0;
  var str = '';
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(ptr + i * 4) >> 2];
    if (utf32 == 0) break;
    ++i;
    if (utf32 >= 65536) {
      var ch = utf32 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}
function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(
    outPtr % 4 == 0,
    'Pointer passed to stringToUTF32 must be aligned to four bytes!'
  );
  assert(
    typeof maxBytesToWrite == 'number',
    'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
  );
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = (65536 + ((codeUnit & 1023) << 10)) | (trailSurrogate & 1023);
    }
    HEAP32[outPtr >> 2] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  HEAP32[outPtr >> 2] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
    len += 4;
  }
  return len;
}
function __embind_register_std_wstring(rawType, charSize, name) {
  name = readLatin1String(name);
  var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
  if (charSize === 2) {
    decodeString = UTF16ToString;
    encodeString = stringToUTF16;
    lengthBytesUTF = lengthBytesUTF16;
    getHeap = () => HEAPU16;
    shift = 1;
  } else if (charSize === 4) {
    decodeString = UTF32ToString;
    encodeString = stringToUTF32;
    lengthBytesUTF = lengthBytesUTF32;
    getHeap = () => HEAPU32;
    shift = 2;
  }
  registerType(rawType, {
    name: name,
    fromWireType: function(value) {
      var length = HEAPU32[value >> 2];
      var HEAP = getHeap();
      var str;
      var decodeStartPtr = value + 4;
      for (var i = 0; i <= length; ++i) {
        var currentBytePtr = value + 4 + i * charSize;
        if (i == length || HEAP[currentBytePtr >> shift] == 0) {
          var maxReadBytes = currentBytePtr - decodeStartPtr;
          var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
          if (str === undefined) {
            str = stringSegment;
          } else {
            str += String.fromCharCode(0);
            str += stringSegment;
          }
          decodeStartPtr = currentBytePtr + charSize;
        }
      }
      _free(value);
      return str;
    },
    toWireType: function(destructors, value) {
      if (!(typeof value == 'string')) {
        throwBindingError('Cannot pass non-string to C++ string type ' + name);
      }
      var length = lengthBytesUTF(value);
      var ptr = _malloc(4 + length + charSize);
      HEAPU32[ptr >> 2] = length >> shift;
      encodeString(value, ptr + 4, length + charSize);
      if (destructors !== null) {
        destructors.push(_free, ptr);
      }
      return ptr;
    },
    argPackAdvance: 8,
    readValueFromPointer: simpleReadValueFromPointer,
    destructorFunction: function(ptr) {
      _free(ptr);
    },
  });
}
function __embind_register_void(rawType, name) {
  name = readLatin1String(name);
  registerType(rawType, {
    isVoid: true,
    name: name,
    argPackAdvance: 0,
    fromWireType: function() {
      return undefined;
    },
    toWireType: function(destructors, o) {
      return undefined;
    },
  });
}
function _abort() {
  abort('native code called abort()');
}
function abortOnCannotGrowMemory(requestedSize) {
  abort(
    'Cannot enlarge memory arrays to size ' +
      requestedSize +
      ' bytes (OOM). Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value ' +
      HEAP8.length +
      ', (2) compile with -sALLOW_MEMORY_GROWTH which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with -sABORTING_MALLOC=0'
  );
}
function _emscripten_resize_heap(requestedSize) {
  var oldSize = HEAPU8.length;
  requestedSize = requestedSize >>> 0;
  abortOnCannotGrowMemory(requestedSize);
}
var ENV = {};
function getExecutableName() {
  return thisProgram || './this.program';
}
function getEnvStrings() {
  if (!getEnvStrings.strings) {
    var lang =
      (
        (typeof navigator == 'object' &&
          navigator.languages &&
          navigator.languages[0]) ||
        'C'
      ).replace('-', '_') + '.UTF-8';
    var env = {
      USER: 'web_user',
      LOGNAME: 'web_user',
      PATH: '/',
      PWD: '/',
      HOME: '/home/web_user',
      LANG: lang,
      _: getExecutableName(),
    };
    for (var x in ENV) {
      if (ENV[x] === undefined) delete env[x];
      else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(x + '=' + env[x]);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === (str.charCodeAt(i) & 255));
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
var SYSCALLS = {
  varargs: undefined,
  get: function() {
    assert(SYSCALLS.varargs != undefined);
    SYSCALLS.varargs += 4;
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  },
  getStr: function(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  },
};
function _environ_get(__environ, environ_buf) {
  var bufSize = 0;
  getEnvStrings().forEach(function(string, i) {
    var ptr = environ_buf + bufSize;
    HEAPU32[(__environ + i * 4) >> 2] = ptr;
    writeAsciiToMemory(string, ptr);
    bufSize += string.length + 1;
  });
  return 0;
}
function _environ_sizes_get(penviron_count, penviron_buf_size) {
  var strings = getEnvStrings();
  HEAPU32[penviron_count >> 2] = strings.length;
  var bufSize = 0;
  strings.forEach(function(string) {
    bufSize += string.length + 1;
  });
  HEAPU32[penviron_buf_size >> 2] = bufSize;
  return 0;
}
function _llvm_eh_typeid_for(type) {
  return type;
}
function __isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function __arraySum(array, index) {
  var sum = 0;
  for (var i = 0; i <= index; sum += array[i++]) {}
  return sum;
}
var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function __addDays(date, days) {
  var newDate = new Date(date.getTime());
  while (days > 0) {
    var leap = __isLeapYear(newDate.getFullYear());
    var currentMonth = newDate.getMonth();
    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[
      currentMonth
    ];
    if (days > daysInCurrentMonth - newDate.getDate()) {
      days -= daysInCurrentMonth - newDate.getDate() + 1;
      newDate.setDate(1);
      if (currentMonth < 11) {
        newDate.setMonth(currentMonth + 1);
      } else {
        newDate.setMonth(0);
        newDate.setFullYear(newDate.getFullYear() + 1);
      }
    } else {
      newDate.setDate(newDate.getDate() + days);
      return newDate;
    }
  }
  return newDate;
}
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
function _strftime(s, maxsize, format, tm) {
  var tm_zone = HEAP32[(tm + 40) >> 2];
  var date = {
    tm_sec: HEAP32[tm >> 2],
    tm_min: HEAP32[(tm + 4) >> 2],
    tm_hour: HEAP32[(tm + 8) >> 2],
    tm_mday: HEAP32[(tm + 12) >> 2],
    tm_mon: HEAP32[(tm + 16) >> 2],
    tm_year: HEAP32[(tm + 20) >> 2],
    tm_wday: HEAP32[(tm + 24) >> 2],
    tm_yday: HEAP32[(tm + 28) >> 2],
    tm_isdst: HEAP32[(tm + 32) >> 2],
    tm_gmtoff: HEAP32[(tm + 36) >> 2],
    tm_zone: tm_zone ? UTF8ToString(tm_zone) : '',
  };
  var pattern = UTF8ToString(format);
  var EXPANSION_RULES_1 = {
    '%c': '%a %b %d %H:%M:%S %Y',
    '%D': '%m/%d/%y',
    '%F': '%Y-%m-%d',
    '%h': '%b',
    '%r': '%I:%M:%S %p',
    '%R': '%H:%M',
    '%T': '%H:%M:%S',
    '%x': '%m/%d/%y',
    '%X': '%H:%M:%S',
    '%Ec': '%c',
    '%EC': '%C',
    '%Ex': '%m/%d/%y',
    '%EX': '%H:%M:%S',
    '%Ey': '%y',
    '%EY': '%Y',
    '%Od': '%d',
    '%Oe': '%e',
    '%OH': '%H',
    '%OI': '%I',
    '%Om': '%m',
    '%OM': '%M',
    '%OS': '%S',
    '%Ou': '%u',
    '%OU': '%U',
    '%OV': '%V',
    '%Ow': '%w',
    '%OW': '%W',
    '%Oy': '%y',
  };
  for (var rule in EXPANSION_RULES_1) {
    pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
  }
  var WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  var MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  function leadingSomething(value, digits, character) {
    var str = typeof value == 'number' ? value.toString() : value || '';
    while (str.length < digits) {
      str = character[0] + str;
    }
    return str;
  }
  function leadingNulls(value, digits) {
    return leadingSomething(value, digits, '0');
  }
  function compareByDay(date1, date2) {
    function sgn(value) {
      return value < 0 ? -1 : value > 0 ? 1 : 0;
    }
    var compare;
    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
        compare = sgn(date1.getDate() - date2.getDate());
      }
    }
    return compare;
  }
  function getFirstWeekStartDate(janFourth) {
    switch (janFourth.getDay()) {
      case 0:
        return new Date(janFourth.getFullYear() - 1, 11, 29);
      case 1:
        return janFourth;
      case 2:
        return new Date(janFourth.getFullYear(), 0, 3);
      case 3:
        return new Date(janFourth.getFullYear(), 0, 2);
      case 4:
        return new Date(janFourth.getFullYear(), 0, 1);
      case 5:
        return new Date(janFourth.getFullYear() - 1, 11, 31);
      case 6:
        return new Date(janFourth.getFullYear() - 1, 11, 30);
    }
  }
  function getWeekBasedYear(date) {
    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
        return thisDate.getFullYear() + 1;
      }
      return thisDate.getFullYear();
    }
    return thisDate.getFullYear() - 1;
  }
  var EXPANSION_RULES_2 = {
    '%a': function(date) {
      return WEEKDAYS[date.tm_wday].substring(0, 3);
    },
    '%A': function(date) {
      return WEEKDAYS[date.tm_wday];
    },
    '%b': function(date) {
      return MONTHS[date.tm_mon].substring(0, 3);
    },
    '%B': function(date) {
      return MONTHS[date.tm_mon];
    },
    '%C': function(date) {
      var year = date.tm_year + 1900;
      return leadingNulls((year / 100) | 0, 2);
    },
    '%d': function(date) {
      return leadingNulls(date.tm_mday, 2);
    },
    '%e': function(date) {
      return leadingSomething(date.tm_mday, 2, ' ');
    },
    '%g': function(date) {
      return getWeekBasedYear(date)
        .toString()
        .substring(2);
    },
    '%G': function(date) {
      return getWeekBasedYear(date);
    },
    '%H': function(date) {
      return leadingNulls(date.tm_hour, 2);
    },
    '%I': function(date) {
      var twelveHour = date.tm_hour;
      if (twelveHour == 0) twelveHour = 12;
      else if (twelveHour > 12) twelveHour -= 12;
      return leadingNulls(twelveHour, 2);
    },
    '%j': function(date) {
      return leadingNulls(
        date.tm_mday +
          __arraySum(
            __isLeapYear(date.tm_year + 1900)
              ? __MONTH_DAYS_LEAP
              : __MONTH_DAYS_REGULAR,
            date.tm_mon - 1
          ),
        3
      );
    },
    '%m': function(date) {
      return leadingNulls(date.tm_mon + 1, 2);
    },
    '%M': function(date) {
      return leadingNulls(date.tm_min, 2);
    },
    '%n': function() {
      return '\n';
    },
    '%p': function(date) {
      if (date.tm_hour >= 0 && date.tm_hour < 12) {
        return 'AM';
      }
      return 'PM';
    },
    '%S': function(date) {
      return leadingNulls(date.tm_sec, 2);
    },
    '%t': function() {
      return '\t';
    },
    '%u': function(date) {
      return date.tm_wday || 7;
    },
    '%U': function(date) {
      var days = date.tm_yday + 7 - date.tm_wday;
      return leadingNulls(Math.floor(days / 7), 2);
    },
    '%V': function(date) {
      var val = Math.floor((date.tm_yday + 7 - ((date.tm_wday + 6) % 7)) / 7);
      if ((date.tm_wday + 371 - date.tm_yday - 2) % 7 <= 2) {
        val++;
      }
      if (!val) {
        val = 52;
        var dec31 = (date.tm_wday + 7 - date.tm_yday - 1) % 7;
        if (
          dec31 == 4 ||
          (dec31 == 5 && __isLeapYear((date.tm_year % 400) - 1))
        ) {
          val++;
        }
      } else if (val == 53) {
        var jan1 = (date.tm_wday + 371 - date.tm_yday) % 7;
        if (jan1 != 4 && (jan1 != 3 || !__isLeapYear(date.tm_year))) val = 1;
      }
      return leadingNulls(val, 2);
    },
    '%w': function(date) {
      return date.tm_wday;
    },
    '%W': function(date) {
      var days = date.tm_yday + 7 - ((date.tm_wday + 6) % 7);
      return leadingNulls(Math.floor(days / 7), 2);
    },
    '%y': function(date) {
      return (date.tm_year + 1900).toString().substring(2);
    },
    '%Y': function(date) {
      return date.tm_year + 1900;
    },
    '%z': function(date) {
      var off = date.tm_gmtoff;
      var ahead = off >= 0;
      off = Math.abs(off) / 60;
      off = (off / 60) * 100 + (off % 60);
      return (ahead ? '+' : '-') + String('0000' + off).slice(-4);
    },
    '%Z': function(date) {
      return date.tm_zone;
    },
    '%%': function() {
      return '%';
    },
  };
  pattern = pattern.replace(/%%/g, '\0\0');
  for (var rule in EXPANSION_RULES_2) {
    if (pattern.includes(rule)) {
      pattern = pattern.replace(
        new RegExp(rule, 'g'),
        EXPANSION_RULES_2[rule](date)
      );
    }
  }
  pattern = pattern.replace(/\0\0/g, '%');
  var bytes = intArrayFromString(pattern, false);
  if (bytes.length > maxsize) {
    return 0;
  }
  writeArrayToMemory(bytes, s);
  return bytes.length - 1;
}
function _strftime_l(s, maxsize, format, tm) {
  return _strftime(s, maxsize, format, tm);
}
function uleb128Encode(n, target) {
  assert(n < 16384);
  if (n < 128) {
    target.push(n);
  } else {
    target.push(n % 128 | 128, n >> 7);
  }
}
function sigToWasmTypes(sig) {
  var typeNames = { i: 'i32', j: 'i64', f: 'f32', d: 'f64', p: 'i32' };
  var type = {
    parameters: [],
    results: sig[0] == 'v' ? [] : [typeNames[sig[0]]],
  };
  for (var i = 1; i < sig.length; ++i) {
    assert(sig[i] in typeNames, 'invalid signature char: ' + sig[i]);
    type.parameters.push(typeNames[sig[i]]);
  }
  return type;
}
function generateFuncType(sig, target) {
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = { i: 127, p: 127, j: 126, f: 125, d: 124 };
  target.push(96);
  uleb128Encode(sigParam.length, target);
  for (var i = 0; i < sigParam.length; ++i) {
    assert(sigParam[i] in typeCodes, 'invalid signature char: ' + sigParam[i]);
    target.push(typeCodes[sigParam[i]]);
  }
  if (sigRet == 'v') {
    target.push(0);
  } else {
    target.push(1, typeCodes[sigRet]);
  }
}
function convertJsFunctionToWasm(func, sig) {
  if (typeof WebAssembly.Function == 'function') {
    return new WebAssembly.Function(sigToWasmTypes(sig), func);
  }
  var typeSectionBody = [1];
  generateFuncType(sig, typeSectionBody);
  var bytes = [0, 97, 115, 109, 1, 0, 0, 0, 1];
  uleb128Encode(typeSectionBody.length, bytes);
  bytes.push.apply(bytes, typeSectionBody);
  bytes.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
  var module = new WebAssembly.Module(new Uint8Array(bytes));
  var instance = new WebAssembly.Instance(module, { e: { f: func } });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}
function updateTableMap(offset, count) {
  if (functionsInTableMap) {
    for (var i = offset; i < offset + count; i++) {
      var item = getWasmTableEntry(i);
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
}
var functionsInTableMap = undefined;
var freeTableIndexes = [];
function getEmptyTableSlot() {
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}
function setWasmTableEntry(idx, func) {
  wasmTable.set(idx, func);
}
function addFunction(func, sig) {
  assert(typeof func != 'undefined');
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    updateTableMap(0, wasmTable.length);
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }
  var ret = getEmptyTableSlot();
  try {
    setWasmTableEntry(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    assert(
      typeof sig != 'undefined',
      'Missing signature argument to addFunction: ' + func
    );
    var wrapped = convertJsFunctionToWasm(func, sig);
    setWasmTableEntry(ret, wrapped);
  }
  functionsInTableMap.set(func, ret);
  return ret;
}
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');
init_emval();
function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
}
var asmLibraryArg = {
  __cxa_allocate_exception: ___cxa_allocate_exception,
  __cxa_begin_catch: ___cxa_begin_catch,
  __cxa_call_unexpected: ___cxa_call_unexpected,
  __cxa_end_catch: ___cxa_end_catch,
  __cxa_find_matching_catch_2: ___cxa_find_matching_catch_2,
  __cxa_find_matching_catch_3: ___cxa_find_matching_catch_3,
  __cxa_find_matching_catch_4: ___cxa_find_matching_catch_4,
  __cxa_find_matching_catch_6: ___cxa_find_matching_catch_6,
  __cxa_free_exception: ___cxa_free_exception,
  __cxa_rethrow: ___cxa_rethrow,
  __cxa_throw: ___cxa_throw,
  __cxa_uncaught_exceptions: ___cxa_uncaught_exceptions,
  __resumeException: ___resumeException,
  _embind_register_bigint: __embind_register_bigint,
  _embind_register_bool: __embind_register_bool,
  _embind_register_emval: __embind_register_emval,
  _embind_register_float: __embind_register_float,
  _embind_register_integer: __embind_register_integer,
  _embind_register_memory_view: __embind_register_memory_view,
  _embind_register_std_string: __embind_register_std_string,
  _embind_register_std_wstring: __embind_register_std_wstring,
  _embind_register_void: __embind_register_void,
  abort: _abort,
  emscripten_resize_heap: _emscripten_resize_heap,
  environ_get: _environ_get,
  environ_sizes_get: _environ_sizes_get,
  invoke_diii: invoke_diii,
  invoke_fi: invoke_fi,
  invoke_fii: invoke_fii,
  invoke_fiif: invoke_fiif,
  invoke_fiii: invoke_fiii,
  invoke_fiiii: invoke_fiiii,
  invoke_i: invoke_i,
  invoke_ii: invoke_ii,
  invoke_iiff: invoke_iiff,
  invoke_iifff: invoke_iifff,
  invoke_iifffffffff: invoke_iifffffffff,
  invoke_iifffi: invoke_iifffi,
  invoke_iii: invoke_iii,
  invoke_iiii: invoke_iiii,
  invoke_iiiif: invoke_iiiif,
  invoke_iiiii: invoke_iiiii,
  invoke_iiiiif: invoke_iiiiif,
  invoke_iiiiiffffffff: invoke_iiiiiffffffff,
  invoke_iiiiii: invoke_iiiiii,
  invoke_iiiiiif: invoke_iiiiiif,
  invoke_iiiiiii: invoke_iiiiiii,
  invoke_iiiiiiifi: invoke_iiiiiiifi,
  invoke_iiiiiiii: invoke_iiiiiiii,
  invoke_iiiiiiiiiii: invoke_iiiiiiiiiii,
  invoke_iiiiiiiiiiii: invoke_iiiiiiiiiiii,
  invoke_iiiiiiiiiiiii: invoke_iiiiiiiiiiiii,
  invoke_iji: invoke_iji,
  invoke_jiiii: invoke_jiiii,
  invoke_v: invoke_v,
  invoke_vi: invoke_vi,
  invoke_viffffffff: invoke_viffffffff,
  invoke_vii: invoke_vii,
  invoke_viifff: invoke_viifff,
  invoke_viifiif: invoke_viifiif,
  invoke_viii: invoke_viii,
  invoke_viiii: invoke_viiii,
  invoke_viiiiffffffffffffffff: invoke_viiiiffffffffffffffff,
  invoke_viiiii: invoke_viiiii,
  invoke_viiiiii: invoke_viiiiii,
  invoke_viiiiiii: invoke_viiiiiii,
  invoke_viiiiiiii: invoke_viiiiiiii,
  invoke_viiiiiiiii: invoke_viiiiiiiii,
  invoke_viiiiiiiiii: invoke_viiiiiiiiii,
  invoke_viiiiiiiiiiiiiii: invoke_viiiiiiiiiiiiiii,
  llvm_eh_typeid_for: _llvm_eh_typeid_for,
  strftime_l: _strftime_l,
};
var asm = createWasm();
var ___wasm_call_ctors = (Module['___wasm_call_ctors'] = createExportWrapper(
  '__wasm_call_ctors'
));
var getTempRet0 = (Module['getTempRet0'] = createExportWrapper('getTempRet0'));
var _resize = (Module['_resize'] = createExportWrapper('resize'));
var _decode_qr = (Module['_decode_qr'] = createExportWrapper('decode_qr'));
var _decode_qr_multi = (Module['_decode_qr_multi'] = createExportWrapper(
  'decode_qr_multi'
));
var _decode_any = (Module['_decode_any'] = createExportWrapper('decode_any'));
var _decode_multi = (Module['_decode_multi'] = createExportWrapper(
  'decode_multi'
));
var _decode_codabar = (Module['_decode_codabar'] = createExportWrapper(
  'decode_codabar'
));
var _decode_code128 = (Module['_decode_code128'] = createExportWrapper(
  'decode_code128'
));
var _decode_code39 = (Module['_decode_code39'] = createExportWrapper(
  'decode_code39'
));
var _decode_code93 = (Module['_decode_code93'] = createExportWrapper(
  'decode_code93'
));
var _decode_ean13 = (Module['_decode_ean13'] = createExportWrapper(
  'decode_ean13'
));
var _decode_ean8 = (Module['_decode_ean8'] = createExportWrapper(
  'decode_ean8'
));
var _decode_itf = (Module['_decode_itf'] = createExportWrapper('decode_itf'));
var _decode_multi_one_d = (Module['_decode_multi_one_d'] = createExportWrapper(
  'decode_multi_one_d'
));
var _decode_multi_upc_ean = (Module[
  '_decode_multi_upc_ean'
] = createExportWrapper('decode_multi_upc_ean'));
var _decode_upca = (Module['_decode_upca'] = createExportWrapper(
  'decode_upca'
));
var _decode_upce = (Module['_decode_upce'] = createExportWrapper(
  'decode_upce'
));
var ___getTypeName = (Module['___getTypeName'] = createExportWrapper(
  '__getTypeName'
));
var __embind_initialize_bindings = (Module[
  '__embind_initialize_bindings'
] = createExportWrapper('_embind_initialize_bindings'));
var ___errno_location = (Module['___errno_location'] = createExportWrapper(
  '__errno_location'
));
var _fflush = (Module['_fflush'] = createExportWrapper('fflush'));
var _malloc = (Module['_malloc'] = createExportWrapper('malloc'));
var _free = (Module['_free'] = createExportWrapper('free'));
var _setThrew = (Module['_setThrew'] = createExportWrapper('setThrew'));
var setTempRet0 = (Module['setTempRet0'] = createExportWrapper('setTempRet0'));
var _emscripten_stack_init = (Module['_emscripten_stack_init'] = function() {
  return (_emscripten_stack_init = Module['_emscripten_stack_init'] =
    Module['asm']['emscripten_stack_init']).apply(null, arguments);
});
var _emscripten_stack_get_free = (Module[
  '_emscripten_stack_get_free'
] = function() {
  return (_emscripten_stack_get_free = Module['_emscripten_stack_get_free'] =
    Module['asm']['emscripten_stack_get_free']).apply(null, arguments);
});
var _emscripten_stack_get_base = (Module[
  '_emscripten_stack_get_base'
] = function() {
  return (_emscripten_stack_get_base = Module['_emscripten_stack_get_base'] =
    Module['asm']['emscripten_stack_get_base']).apply(null, arguments);
});
var _emscripten_stack_get_end = (Module[
  '_emscripten_stack_get_end'
] = function() {
  return (_emscripten_stack_get_end = Module['_emscripten_stack_get_end'] =
    Module['asm']['emscripten_stack_get_end']).apply(null, arguments);
});
var stackSave = (Module['stackSave'] = createExportWrapper('stackSave'));
var stackRestore = (Module['stackRestore'] = createExportWrapper(
  'stackRestore'
));
var stackAlloc = (Module['stackAlloc'] = createExportWrapper('stackAlloc'));
var ___cxa_can_catch = (Module['___cxa_can_catch'] = createExportWrapper(
  '__cxa_can_catch'
));
var ___cxa_is_pointer_type = (Module[
  '___cxa_is_pointer_type'
] = createExportWrapper('__cxa_is_pointer_type'));
var dynCall_iji = (Module['dynCall_iji'] = createExportWrapper('dynCall_iji'));
var dynCall_viijii = (Module['dynCall_viijii'] = createExportWrapper(
  'dynCall_viijii'
));
var dynCall_jiiii = (Module['dynCall_jiiii'] = createExportWrapper(
  'dynCall_jiiii'
));
var dynCall_iiiiij = (Module['dynCall_iiiiij'] = createExportWrapper(
  'dynCall_iiiiij'
));
var dynCall_iiiiijj = (Module['dynCall_iiiiijj'] = createExportWrapper(
  'dynCall_iiiiijj'
));
var dynCall_iiiiiijj = (Module['dynCall_iiiiiijj'] = createExportWrapper(
  'dynCall_iiiiiijj'
));
function invoke_viii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_vii(index, a1, a2) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iii(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_ii(index, a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_vi(index, a1) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_v(index) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)();
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_fiii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_fi(index, a1) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiff(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiffffffffffffffff(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11,
  a12,
  a13,
  a14,
  a15,
  a16,
  a17,
  a18,
  a19,
  a20
) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9,
      a10,
      a11,
      a12,
      a13,
      a14,
      a15,
      a16,
      a17,
      a18,
      a19,
      a20
    );
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viffffffff(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iifffffffff(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiii(index, a1, a2, a3, a4, a5, a6, a7) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_fii(index, a1, a2) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_fiif(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_i(index) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)();
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiif(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiif(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iifff(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viifff(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_fiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiif(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viifiif(index, a1, a2, a3, a4, a5, a6) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiifi(index, a1, a2, a3, a4, a5, a6, a7, a8) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iifffi(index, a1, a2, a3, a4, a5) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiffffffff(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11,
  a12
) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9,
      a10,
      a11,
      a12
    );
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiiiiiii(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11,
  a12
) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9,
      a10,
      a11,
      a12
    );
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_diii(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iiiiiiiiiiii(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11
) {
  var sp = stackSave();
  try {
    return getWasmTableEntry(index)(
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9,
      a10,
      a11
    );
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiiii(index, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_viiiiiiiiiiiiiii(
  index,
  a1,
  a2,
  a3,
  a4,
  a5,
  a6,
  a7,
  a8,
  a9,
  a10,
  a11,
  a12,
  a13,
  a14,
  a15
) {
  var sp = stackSave();
  try {
    getWasmTableEntry(index)(
      a1,
      a2,
      a3,
      a4,
      a5,
      a6,
      a7,
      a8,
      a9,
      a10,
      a11,
      a12,
      a13,
      a14,
      a15
    );
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_iji(index, a1, a2, a3) {
  var sp = stackSave();
  try {
    return dynCall_iji(index, a1, a2, a3);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
function invoke_jiiii(index, a1, a2, a3, a4) {
  var sp = stackSave();
  try {
    return dynCall_jiiii(index, a1, a2, a3, a4);
  } catch (e) {
    stackRestore(sp);
    if (e !== e + 0) throw e;
    _setThrew(1, 0);
  }
}
Module['addFunction'] = addFunction;
var unexportedRuntimeSymbols = [
  'run',
  'UTF8ArrayToString',
  'UTF8ToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'addOnPreRun',
  'addOnInit',
  'addOnPreMain',
  'addOnExit',
  'addOnPostRun',
  'addRunDependency',
  'removeRunDependency',
  'FS_createFolder',
  'FS_createPath',
  'FS_createDataFile',
  'FS_createPreloadedFile',
  'FS_createLazyFile',
  'FS_createLink',
  'FS_createDevice',
  'FS_unlink',
  'getLEB',
  'getFunctionTables',
  'alignFunctionTables',
  'registerFunctions',
  'prettyPrint',
  'getCompilerSetting',
  'print',
  'printErr',
  'callMain',
  'abort',
  'keepRuntimeAlive',
  'wasmMemory',
  'stackAlloc',
  'stackSave',
  'stackRestore',
  'getTempRet0',
  'setTempRet0',
  'writeStackCookie',
  'checkStackCookie',
  'ptrToString',
  'zeroMemory',
  'stringToNewUTF8',
  'exitJS',
  'getHeapMax',
  'abortOnCannotGrowMemory',
  'emscripten_realloc_buffer',
  'ENV',
  'ERRNO_CODES',
  'ERRNO_MESSAGES',
  'setErrNo',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'DNS',
  'getHostByName',
  'Protocols',
  'Sockets',
  'getRandomDevice',
  'warnOnce',
  'traverseStack',
  'UNWIND_CACHE',
  'convertPCtoSourceLocation',
  'readAsmConstArgsArray',
  'readAsmConstArgs',
  'mainThreadEM_ASM',
  'jstoi_q',
  'jstoi_s',
  'getExecutableName',
  'listenOnce',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'setWasmTableEntry',
  'getWasmTableEntry',
  'handleException',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'safeSetTimeout',
  'asmjsMangle',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'getCFunc',
  'ccall',
  'cwrap',
  'uleb128Encode',
  'sigToWasmTypes',
  'generateFuncType',
  'convertJsFunctionToWasm',
  'freeTableIndexes',
  'functionsInTableMap',
  'getEmptyTableSlot',
  'updateTableMap',
  'removeFunction',
  'reallyNegative',
  'unSign',
  'strLen',
  'reSign',
  'formatString',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'intArrayFromString',
  'intArrayToString',
  'AsciiToString',
  'stringToAscii',
  'UTF16Decoder',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'writeStringToMemory',
  'writeArrayToMemory',
  'writeAsciiToMemory',
  'SYSCALLS',
  'getSocketFromFD',
  'getSocketAddress',
  'JSEvents',
  'registerKeyEventCallback',
  'specialHTMLTargets',
  'maybeCStringToJsString',
  'findEventTarget',
  'findCanvasEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'battery',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'demangle',
  'demangleAll',
  'jsStackTrace',
  'stackTrace',
  'ExitStatus',
  'getEnvStrings',
  'checkWasiClock',
  'flush_NO_FILESYSTEM',
  'dlopenMissingError',
  'createDyncallWrapper',
  'setImmediateWrapped',
  'clearImmediateWrapped',
  'polyfillSetImmediate',
  'uncaughtExceptionCount',
  'exceptionLast',
  'exceptionCaught',
  'ExceptionInfo',
  'exception_addRef',
  'exception_decRef',
  'getExceptionMessageCommon',
  'incrementExceptionRefcount',
  'decrementExceptionRefcount',
  'getExceptionMessage',
  'Browser',
  'setMainLoop',
  'wget',
  'FS',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  '_setNetworkCallback',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'heapObjectForWebGLType',
  'heapAccessShiftForWebGLHeap',
  'GL',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  'writeGLArray',
  'AL',
  'SDL_unicode',
  'SDL_ttfContext',
  'SDL_audio',
  'SDL',
  'SDL_gfx',
  'GLUT',
  'EGL',
  'GLFW_Window',
  'GLFW',
  'GLEW',
  'IDBStore',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'InternalError',
  'BindingError',
  'UnboundTypeError',
  'PureVirtualError',
  'init_embind',
  'throwInternalError',
  'throwBindingError',
  'throwUnboundTypeError',
  'ensureOverloadTable',
  'exposePublicSymbol',
  'replacePublicSymbol',
  'extendError',
  'createNamedFunction',
  'embindRepr',
  'registeredInstances',
  'getBasestPointer',
  'registerInheritedInstance',
  'unregisterInheritedInstance',
  'getInheritedInstance',
  'getInheritedInstanceCount',
  'getLiveInheritedInstances',
  'registeredTypes',
  'awaitingDependencies',
  'typeDependencies',
  'registeredPointers',
  'registerType',
  'whenDependentTypesAreResolved',
  'embind_charCodes',
  'embind_init_charCodes',
  'readLatin1String',
  'getTypeName',
  'heap32VectorToArray',
  'requireRegisteredType',
  'getShiftFromSize',
  'integerReadValueFromPointer',
  'enumReadValueFromPointer',
  'floatReadValueFromPointer',
  'simpleReadValueFromPointer',
  'runDestructors',
  'new_',
  'craftInvokerFunction',
  'embind__requireFunction',
  'tupleRegistrations',
  'structRegistrations',
  'genericPointerToWireType',
  'constNoSmartPtrRawPointerToWireType',
  'nonConstNoSmartPtrRawPointerToWireType',
  'init_RegisteredPointer',
  'RegisteredPointer',
  'RegisteredPointer_getPointee',
  'RegisteredPointer_destructor',
  'RegisteredPointer_deleteObject',
  'RegisteredPointer_fromWireType',
  'runDestructor',
  'releaseClassHandle',
  'finalizationRegistry',
  'detachFinalizer_deps',
  'detachFinalizer',
  'attachFinalizer',
  'makeClassHandle',
  'init_ClassHandle',
  'ClassHandle',
  'ClassHandle_isAliasOf',
  'throwInstanceAlreadyDeleted',
  'ClassHandle_clone',
  'ClassHandle_delete',
  'deletionQueue',
  'ClassHandle_isDeleted',
  'ClassHandle_deleteLater',
  'flushPendingDeletes',
  'delayFunction',
  'setDelayFunction',
  'RegisteredClass',
  'shallowCopyInternalPointer',
  'downcastPointer',
  'upcastPointer',
  'validateThis',
  'char_0',
  'char_9',
  'makeLegalFunctionName',
  'emval_handle_array',
  'emval_free_list',
  'emval_symbols',
  'init_emval',
  'count_emval_handles',
  'get_first_emval',
  'getStringOrSymbol',
  'Emval',
  'emval_newers',
  'craftEmvalAllocator',
  'emval_get_global',
  'emval_lookupTypes',
  'emval_allocateDestructors',
  'emval_methodCallers',
  'emval_addMethodCaller',
  'emval_registeredMethods',
];
unexportedRuntimeSymbols.forEach(unexportedRuntimeSymbol);
var missingLibrarySymbols = [
  'ptrToString',
  'zeroMemory',
  'stringToNewUTF8',
  'exitJS',
  'emscripten_realloc_buffer',
  'setErrNo',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'getHostByName',
  'getRandomDevice',
  'traverseStack',
  'convertPCtoSourceLocation',
  'readAsmConstArgs',
  'mainThreadEM_ASM',
  'jstoi_q',
  'jstoi_s',
  'listenOnce',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'safeSetTimeout',
  'asmjsMangle',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'getCFunc',
  'ccall',
  'cwrap',
  'removeFunction',
  'reallyNegative',
  'unSign',
  'strLen',
  'reSign',
  'formatString',
  'intArrayToString',
  'AsciiToString',
  'stringToAscii',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'writeStringToMemory',
  'getSocketFromFD',
  'getSocketAddress',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'findCanvasEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'battery',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'checkWasiClock',
  'flush_NO_FILESYSTEM',
  'createDyncallWrapper',
  'setImmediateWrapped',
  'clearImmediateWrapped',
  'polyfillSetImmediate',
  'getExceptionMessageCommon',
  'incrementExceptionRefcount',
  'decrementExceptionRefcount',
  'getExceptionMessage',
  'setMainLoop',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'heapAccessShiftForWebGLHeap',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  'writeGLArray',
  'SDL_unicode',
  'SDL_ttfContext',
  'SDL_audio',
  'GLFW_Window',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'init_embind',
  'throwUnboundTypeError',
  'ensureOverloadTable',
  'exposePublicSymbol',
  'replacePublicSymbol',
  'getBasestPointer',
  'registerInheritedInstance',
  'unregisterInheritedInstance',
  'getInheritedInstance',
  'getInheritedInstanceCount',
  'getLiveInheritedInstances',
  'getTypeName',
  'heap32VectorToArray',
  'requireRegisteredType',
  'enumReadValueFromPointer',
  'runDestructors',
  'new_',
  'craftInvokerFunction',
  'embind__requireFunction',
  'genericPointerToWireType',
  'constNoSmartPtrRawPointerToWireType',
  'nonConstNoSmartPtrRawPointerToWireType',
  'init_RegisteredPointer',
  'RegisteredPointer',
  'RegisteredPointer_getPointee',
  'RegisteredPointer_destructor',
  'RegisteredPointer_deleteObject',
  'RegisteredPointer_fromWireType',
  'runDestructor',
  'releaseClassHandle',
  'detachFinalizer',
  'attachFinalizer',
  'makeClassHandle',
  'init_ClassHandle',
  'ClassHandle',
  'ClassHandle_isAliasOf',
  'throwInstanceAlreadyDeleted',
  'ClassHandle_clone',
  'ClassHandle_delete',
  'ClassHandle_isDeleted',
  'ClassHandle_deleteLater',
  'flushPendingDeletes',
  'setDelayFunction',
  'RegisteredClass',
  'shallowCopyInternalPointer',
  'downcastPointer',
  'upcastPointer',
  'validateThis',
  'getStringOrSymbol',
  'craftEmvalAllocator',
  'emval_get_global',
  'emval_lookupTypes',
  'emval_allocateDestructors',
  'emval_addMethodCaller',
];
missingLibrarySymbols.forEach(missingLibrarySymbol);
var calledRun;
dependenciesFulfilled = function runCaller() {
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller;
};
function stackCheckInit() {
  _emscripten_stack_init();
  writeStackCookie();
}
function run(args) {
  args = args || arguments_;
  if (runDependencies > 0) {
    return;
  }
  stackCheckInit();
  preRun();
  if (runDependencies > 0) {
    return;
  }
  function doRun() {
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;
    if (ABORT) return;
    initRuntime();
    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();
    assert(
      !Module['_main'],
      'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]'
    );
    postRun();
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function')
    Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}
run();
