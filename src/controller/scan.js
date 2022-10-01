const bufferLength = ({ width, height }) => {
  const lineLength = width << 2;
  return lineLength * height;
};

const newScanCanvas = async canvas => {
  const { zXingContext: context } = window;
  const { zxing, format, quiet } = context;
  if (!zxing) throw new Error("zxing is not initialised");

  const { width, height } = canvas;
  const length = bufferLength({ width, height });
  if (!context.pixmap) {
    if (!quiet) console.log("-- malloc", length);
    context.pixmap = {
      ptr: zxing._malloc(length),
      length: width * height,
    };
  } else if (context.pixmap.length < length) {
    const { pixmap } = context;
    if (!quiet) console.log("-- free", pixmap.length, pixmap.ptr);
    zxing._free(pixmap.ptr);
    if (!quiet) console.log("-- malloc", length);
    Object.assign(pixmap, {
      ptr: zxing._malloc(length),
      length,
    });
  }
  const { pixmap } = context;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  var { data: rgba } = ctx.getImageData(0, 0, width, height);
  zxing.HEAPU8.set(rgba, pixmap.ptr);
  if (!quiet) console.time("scanCode");
  // ReadResult readBarcodeFromPixmap(int bufferPtr, int imgWidth, int imgHeight, bool tryHarder, std::string format)
  var result = zxing.readBarcodeFromPixmap(
    pixmap.ptr,
    width,
    height,
    true,
    format
  );
  // zxing._free(buffer);
  if (!quiet) console.timeEnd("scanCode");
  if (!quiet)
    console.log(
      "Ran readBarcodeFromPixmap",
      { buffer: pixmap.ptr, width, height, harder: true, format },
      result
    );
  // throw new Error();
  if (!result.text) {
    throw new Error(`Decode error(-2)`);
  }
  return { ...result, code: result.text, error: result.text ? 0 : -2 };
};

export const scanCanvas = async canvas => {
  const {
    zXingContext: { decodePtr, zxing: ZXing },
  } = window;
  if (!ZXing.addFunction) {
    return newScanCanvas(canvas);
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  var { data: rgba } = context.getImageData(0, 0, width, height);
  // console.log("--- scanCanvas", canvas);
  if (!ZXing) throw new Error("ZXing is not initialised");
  // console.log("--- image data", typeof rgba);
  // console.log("---> ZXing.HEAPU8", typeof ZXing.HEAPU8);
  const imagePtr = ZXing._resize(width, height);
  for (var i = 0, j = 0; i < rgba.length; i += 4, j++) {
    ZXing.HEAPU8[imagePtr + j] = rgba[i];
  }
  // console.timeEnd("decode barcode");
  let rejectDecode;
  const promise = new Promise((res, rej) => {
    rejectDecode = rej;
    Object.assign(window.zXingContext, {
      resolveDecode: res,
      rejectDecode: rej,
    });
  });
  const err = ZXing._decode_any(decodePtr);
  if (err) {
    // console.log("error code", err);
    rejectDecode(new Error(`Decode error(${err})`));
  }
  return promise;
};
