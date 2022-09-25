import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import React from "react";
import { scanCanvas } from "../controller/scan";

const hasGetUserMedia = () => {
  if (typeof window === "undefined") return false;
  const { navigator = {} } = window;
  if (navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  return !!(
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia
  );
};

const context = { cameras: [] };

const toggleCamera = ({ video, zoom }) => {
  const { cameras, current } = context;
  if (!video.srcObject || !current) {
    console.log("video is not initialised, try later");
    return;
  }
  const { deviceId } = current;
  const idx = cameras.findIndex(i => i.deviceId === deviceId);
  if (idx < 0) {
    console.error("current camera is invalid");
    return;
  }
  const newIndex = (idx + 1) % cameras.length;
  context.current = context.cameras[newIndex];
  openStream({
    cameraInfo: context.current,
    getUserMedia: context.getUserMedia,
    video,
    zoom,
  }).catch(e => console.error(e.message));
};

const handleMediaStream = async (stream, { video, zoom }) => {
  try {
    console.log("Camera is loaded", stream);
    video.srcObject = stream;
    const [track] = stream.getVideoTracks();
    const settings = track.getSettings();
    console.log("Camera settings", settings);
    console.log("Camera capa", track.getCapabilities());
    const { width, height } = settings;
    Object.assign(video, { width: (video.height * width) / height });
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

const openStream = async ({ cameraInfo = {}, getUserMedia, video, zoom }) => {
  const constraints = {
    video: {
      zoom: !!zoom,
      ...(cameraInfo.deviceId
        ? { deviceId: { exact: cameraInfo.deviceId } }
        : {}),
    },
    audio: false,
  };
  try {
    const stream = await getUserMedia(constraints);
    return handleMediaStream(stream, { video, zoom });
  } catch (e) {
    console.log(e.message);
    if (e.message.includes("Permission denied")) {
      throw e;
    }
    const stream = await new Promise((res, rej) => {
      getUserMedia(constraints, res, rej);
    });
    return handleMediaStream(stream, { video, zoom });
  }
};

const connectCamera = async (video, { zoom = 0 } = {}) => {
  if (!hasGetUserMedia()) return;
  const { navigator } = window;
  let getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
  if (getUserMedia) getUserMedia = getUserMedia.bind(navigator);

  if (navigator.mediaDevices) {
    ({ getUserMedia } = navigator.mediaDevices);
    getUserMedia = getUserMedia.bind(navigator.mediaDevices);
    context.getUserMedia = getUserMedia;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(i => i.kind === "videoinput");
    context.cameras = cameras;
    console.log("cameras:", cameras);
    context.current = context.cameras[0];
  }

  return openStream({
    cameraInfo: context.current,
    getUserMedia,
    video,
    zoom,
  });
};

const capture = async (video, canvas) => {
  if (!video) return;
  if (!canvas) return;
  const { width, height } = video;
  Object.assign(canvas, { width, height });
  const ctx = canvas.getContext("2d");
  ctx.filter = "contrast(120%) grayscale(100%)";
  ctx.drawImage(video, 0, 0, width, height);
};

export const QrVideo = ({
  url = "",
  title = "",
  width = 320,
  height = 240,
  scanningIntervalMs = 100,
  setCanvas = () => {},
  result = { code: "", error: 0 },
  zoom = 0.6,
}) => {
  const scrollRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const { current: context } = React.useRef({ scanned: [], counter: 0 });
  const [scanned, setScanned] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState("");
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
    const timer = setTimeout(async () => {
      await connectCamera(video, { zoom }).catch(e => {
        console.error(e.message);
        if (e.message.includes("Permission denied")) {
          setErrorMessage(e.message);
        }
      });
      scanningLoop();
    }, 100);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasGetUserMedia() || errorMessage) {
    return (
      <Typography sx={{ color: "alert" }} component={"span"}>
        <pre>{errorMessage}</pre>
        Camera is not supported in your browser. Please check{" "}
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
        <video
          ref={videoRef}
          {...{ width, height }}
          autoPlay
          onClick={() => toggleCamera({ video: videoRef.current, zoom })}
        ></video>
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
