import { Helmet } from "react-helmet";

const { PUBLIC_URL } = process.env;

// ZXing: global object from the zxing.js
// zXingContext: global context for the library
// Module : for the emscripten library configuration

if (typeof window !== "undefined") {
  window.zXingContext = { format: "QRCode", pixmap: null };

  const wasmLocation = `${PUBLIC_URL}/zxing_reader.wasm`;
  const zxingConfig = {
    locateFile: (file, scriptPath) =>
      console.log("locateFile:", scriptPath, file) || wasmLocation,
    print: null,
    printErr: null,
    arguments: null,
    thisProgram: null,
    quit: null,
    wasmBinary: null,
    noExitRuntime: null,
  };

  let cnt = 0;
  const waitForZXing = async () => {
    const { ZXing } = window;
    if (!ZXing) {
      console.log("Waiting for ZXing", 10 * cnt);
      await new Promise(res => setTimeout(res, 10 * cnt));
      cnt += 1;
      waitForZXing();
      return;
    }
    console.log("Found ZXing", ZXing);
    window.zXingContext.zxing = await ZXing(zxingConfig).catch(e => {
      console.error(e.message);
    });
    window.ZXing = window.zXingContext.zxing;
    console.log(window.ZXing);
  };
  waitForZXing();
}

export const ZXing = () => (
  <Helmet>
    <script src={`${PUBLIC_URL}/zxing_reader.js`} type="text/javascript" />
  </Helmet>
);
