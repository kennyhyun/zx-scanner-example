export const drawRect = ({
  position: { bottomLeft, bottomRight, topLeft, topRight },
  canvas,
}) => {
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.stroke();
};
