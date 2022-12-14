import { Helmet } from "react-helmet";

const { PUBLIC_URL } = process.env;

// ZXing: global object from the zxing.js
// zXingContext: global context for the library
// Module : for the xzing.js library configuration

if (typeof window !== "undefined") {
  window.ZXing = null;
  const decodeCallback = (ptr, len, resultIndex, resultCount) => {
    const { resolveDecode, quiet } = window.zXingContext;
    var result = new Uint8Array(window.ZXing.HEAPU8.buffer, ptr, len);
    const code = String.fromCharCode.apply(null, result);
    if (!quiet) console.log({ code, ptr, len, resultIndex, resultCount });
    if (resolveDecode) resolveDecode({ code });
  };
  window.zXingContext = {
    decodePtr: 0,
    decodeCallback,
  };
  window.Module = {
    locateFile: () => `${PUBLIC_URL}/zxing.wasm`,
    onRuntimeInitialized: function() {
      const zxing = window.Module;
      window.zXingContext.zxing = zxing;
      window.zXingContext.decodePtr = zxing.addFunction(decodeCallback, "viii");
    },
  };
}

export const ZXing = () => (
  <Helmet>
    <script src={`${PUBLIC_URL}/zxing.js`} type="text/javascript" />
  </Helmet>
);
