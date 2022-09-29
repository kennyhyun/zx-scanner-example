import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Typography from "@mui/material/Typography";
import React from "react";
import { omit } from "ramda";
import { scanCanvas } from "../controller/scan";
import {
  context as cameraContext,
  hasCamera,
  toggleCamera,
  connectCameraToVideo,
} from "../controller/camera";
import { drawRect } from "../controller/canvas";

const CameraInfo = ({ info = {}, sx }) => {
  const { settings, capability } = info;
  const { deviceId = "" } = settings || {};
  if (!deviceId) return <></>;
  const deviceInfo =
    cameraContext.cameras.find(i => i.deviceId === deviceId) || {};
  return (
    <Box sx={sx}>
      <Typography>{deviceInfo.label}</Typography>
      {JSON.stringify(omit(["deviceId", "groupId"], settings), null, 2)
        .split("\n")
        .map((line, i) => (
          <Typography variant="caption" component="div" key={`${i} ${line}`}>
            {line.substring(2, line.length).replace(/,$/, "")}
          </Typography>
        ))}
      <Typography sx={{ mt: 2 }}>Capabilities</Typography>
      {JSON.stringify(omit(["deviceId", "groupId"], capability), null, 2)
        .split("\n")
        .map((line, i) => (
          <Typography variant="caption" component="div" key={`${i} ${line}`}>
            {line.substring(2, line.length).replace(/,$/, "")}
          </Typography>
        ))}
    </Box>
  );
};

const capture = async (video, canvas) => {
  if (!video) return;
  if (!canvas) return;
  const { width, height } = video;
  Object.assign(canvas, { width, height });
  const ctx = canvas.getContext("2d");
  // ctx.filter = "contrast(120%) grayscale(100%)";
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
  const [cameraInfo, setCameraInfo] = React.useState({});
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
      const { code, position } = await scanCanvas(canvasRef.current).catch(
        e => ({})
      );
      if (position) drawRect({ canvas: canvasRef.current, position });

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
      const info = await connectCameraToVideo(video, { zoom }).catch(e => {
        console.error(e.message);
        if (e.message.includes("Permission denied")) {
          setErrorMessage(e.message);
        }
      });
      scanningLoop();
      setCameraInfo(info || {});
    }, 100);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasCamera() || errorMessage) {
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
      <Box sx={{ height, display: "flex" }}>
        <video
          ref={videoRef}
          {...{ width, height }}
          autoPlay
          onClick={async () => {
            const info = await toggleCamera({
              video: videoRef.current,
              zoom,
            }).catch(e => {
              console.error(e.message);
              return {};
            });
            setCameraInfo(info);
          }}
        ></video>
        <CameraInfo
          info={cameraInfo}
          sx={{ width, height, overflow: "auto" }}
        />
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
