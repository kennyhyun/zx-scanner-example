import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import React from "react";
import { scanCanvas } from "../controller/scan";

const hasGetUserMedia = () => {
  if (typeof window === "undefined") return false;
  const { navigator = {} } = window;
  return !!(
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
  );
};

const connectCamera = async (video, { zoom = 0 } = {}) => {
  if (!hasGetUserMedia()) return;
  const { navigator } = window;
  const getUserMediaFunc =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

  const handleMediaStream = async stream => {
    try {
      console.log("Camera is loaded", stream);
      video.srcObject = stream;
      const [track] = stream.getVideoTracks();
      const settings = track.getSettings();
      console.log("Camera settings", settings);
      console.log("Camera capa", track.getCapabilities());
      if (zoom && "zoom" in settings) {
        const {
          zoom: { max: maxZoom, min: minZoom, step: zoomStep },
        } = track.getCapabilities();
        const getZoomValue = num => {
          const zoomValue = minZoom + num * zoomStep;
          return Math.min(zoomValue, maxZoom);
        };
        const steps = (maxZoom - minZoom) / zoomStep;
        const step = parseInt(steps * zoom, 10);
        console.log(
          `Setting zoom value(${step}) out of ${steps}`,
          getZoomValue(step)
        );
        track.applyConstraints({ advanced: [{ zoom: getZoomValue(step) }] });
      }
    } catch (e) {
      console.error("Error with handling video:", e);
    }
  };

  const constraints = {
    video: { zoom: !!zoom },
    audio: false,
  };
  try {
    const localMediaStream = await navigator[getUserMediaFunc.name](
      constraints
    );
    return handleMediaStream(localMediaStream);
  } catch (e) {
    console.log(e.message);
    const stream = await new Promise((res, rej) => {
      navigator[getUserMediaFunc.name](constraints, res, rej);
    });
    return handleMediaStream(stream);
  }
};

const capture = async (video, canvas) => {
  if (!video) return;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.filter = "contrast(120%) grayscale(100%)";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
};

export const QrVideo = ({
  url = "",
  title = "",
  width = 320,
  height = 240,
  scanningIntervalMs = 100,
  setCanvas = () => {},
  result = { code: "", error: 0 },
}) => {
  const scrollRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const { current: context } = React.useRef({ scanned: [], counter: 0 });
  const [scanned, setScanned] = React.useState(0);
  const scrollTo = () => {
    const { current: node } = scrollRef;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  };

  React.useEffect(() => {
    const { current: video } = videoRef;
    let stop = false;
    const scanningLoop = async () => {
      if (typeof window !== "undefined") {
        if (window.zXingContext) window.zXingContext.quiet = true;
      }
      await new Promise(res => setTimeout(res, scanningIntervalMs));
      await capture(videoRef.current, canvasRef.current);
      const { code } = await scanCanvas(canvasRef.current).catch(e => ({}));
      if (code) {
        console.log("scanned", code);
        if (!context.scanned.includes(code)) {
          context.scanned.push(code);
        }
        context.counter += 2;
        setScanned(context.counter - 1);
        setScanned(context.counter);
        scrollTo();
      }
      if (!stop) scanningLoop();
      else console.log("stopping the loop");
    };
    const timer = setTimeout(() => {
      connectCamera(video, { zoom: 0.3 }).catch(console.error);
      scanningLoop();
    }, 100);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!hasGetUserMedia()) {
    return (
      <Typography sx={{ color: "alert" }}>
        getUserMedia() is not supported in your browser. Please check{" "}
        <pre>HTTPS=true</pre> {"if you are using debug server."}
      </Typography>
    );
  }

  const colors = ["#21002d", "#e3c9ff", "#720048", "#0082ff"];
  const textStyle = {
    overflowWrap: "anywhere",
  };
  const codeStyle = {
    ...textStyle,
    color: "green",
    textShadow: "1px 1px 2px black, 0 0 0.2em white",
  };
  return (
    <>
      <Box sx={{ width, height }}>
        <video ref={videoRef} {...{ width, height }} autoPlay></video>
      </Box>
      <Box sx={{ height, display: "flex" }}>
        <canvas ref={canvasRef} {...{ width, height }}></canvas>
        <Fade in={!(scanned % 2)}>
          <Box
            sx={{
              width,
              height,
              overflowY: "auto",
              border: "4px solid",
              borderColor: colors[(scanned / 2) % 4],
            }}
            ref={scrollRef}
          >
            {context.scanned.map(str => (
              <Typography sx={codeStyle} key={str}>
                {str}
              </Typography>
            ))}
            <Typography sx={codeStyle}>
              {`${context.scanned.length} code was scanned`}
              <br />
              <br />
            </Typography>
          </Box>
        </Fade>
      </Box>
    </>
  );
};

export default QrVideo;
