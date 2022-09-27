import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

const drawRect = ({
  position: { bottomLeft, bottomRight, topLeft, topRight },
  canvas,
}) => {
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.stroke();
};

export const QrImage = ({
  url = "",
  title = "",
  setCanvas = () => {},
  result = { code: "", error: 0, position: null },
}) => {
  const canvasRef = React.useRef(null);
  const [showCanvas, setCanvasVisibility] = React.useState(false);
  const toggleCanvas = () => setCanvasVisibility(!showCanvas);
  const copyCanvas = e => {
    const { current: canvas } = canvasRef;
    const image = e.target;
    const { width, height } = image;
    Object.assign(canvas, { width, height });
    setCanvas(canvas);
    const ctx = canvas.getContext("2d");
    // ctx.filter = "brightness(100%) grayscale(100%)";
    ctx.drawImage(image, 0, 0);
  };
  if (result.position)
    drawRect({ canvas: canvasRef.current, position: result.position });
  const textStyle = {
    overflowWrap: "anywhere",
  };
  const codeStyle = {
    ...textStyle,
    color: "green",
    textShadow: "1px 1px 2px black, 0 0 0.2em white",
  };
  const errorStyle = {
    ...textStyle,
    color: "red",
    textShadow: "1px 1px 2px black, 0 0 0.2em white",
  };
  return (
    <>
      <Box
        onClick={toggleCanvas}
        sx={{
          position: "relative",
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid gray",
        }}
      >
        <canvas
          style={{ display: showCanvas ? "flex" : "none" }}
          ref={canvasRef}
        ></canvas>
        <img onLoad={copyCanvas} src={url} alt={title} loading="lazy" />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 10,
            bottom: 0,
          }}
        >
          <Typography sx={codeStyle}>{result.code}</Typography>
          <Typography sx={errorStyle}>{result.error || ""}</Typography>
        </Box>
      </Box>
    </>
  );
};
