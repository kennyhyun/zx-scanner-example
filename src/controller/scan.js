export const scanCanvas = async canvas => {
  const {
    ZXing,
    zXingContext: { decodePtr },
  } = window;
  const context = canvas.getContext("2d");
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
