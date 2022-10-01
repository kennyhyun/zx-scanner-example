import debounce from "lodash.debounce";
import React from "react";
import { MasonryImageList } from "./list";
import { ZXing } from "./zxing2";
import { scanCanvas } from "../controller/scan";
import QrCamera from "../components/camera";

const { PUBLIC_URL } = process.env;
const items = Array(18)
  .fill()
  .map((_, i) => ({ url: `${PUBLIC_URL}/img_${i}.jfif` }));
const canvasMap = new Map();
const result = new Map();

let scanned = false;
const debounceTimeMs = 1000;
let retryCount = 0;
const tryScan = debounce(async cbExecuted => {
  if (typeof window === "undefined" || scanned) return;
  const {
    zXingContext: { zxing },
  } = window;
  if (!zxing) {
    retryCount += 1;
    if (retryCount > 5) {
      console.error("Could not find ZXing");
      return;
    }
    console.error(
      "Retring scan after",
      (debounceTimeMs * retryCount) / 1000,
      "ms"
    );
    await new Promise(res => setTimeout(res, debounceTimeMs * retryCount));
    tryScan(cbExecuted);
    return;
  }
  cbExecuted(1);
  scanned = true;
  const message = `Scanned ${canvasMap.size} canvases`;
  console.time(message);
  await [...canvasMap.keys()].reduce(async (p, canvas) => {
    await p;
    const resp = await scanCanvas(canvas).catch(e =>
      e?.message ? { error: e.message } : e
    );
    const url = canvasMap.get(canvas);
    result.set(url, resp);
  }, Promise.resolve());
  console.timeEnd(message);
  cbExecuted(2);
}, debounceTimeMs);

export const ImageScanner = () => {
  const [step, setStep] = React.useState(0);
  return (
    <>
      <ZXing />
      {(() => {
        switch (step) {
          case 0:
            return `Waiting for ${items.length} images loaded...`;
          case 1:
            return "Scannng...";
          default:
            return `Scanned ${items.length} images`;
        }
      })()}
      {step > 1 && <QrCamera zoom={0.4} />}
      <MasonryImageList
        items={items}
        onRendered={() => tryScan(s => setStep(s))}
        canvasMap={canvasMap}
        resultMap={result}
      />
    </>
  );
};

export default ImageScanner;
