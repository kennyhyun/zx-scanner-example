import * as React from "react";
import Box from "@mui/material/Box";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import { QrImage } from "./image";

export const MasonryImageList = ({
  items = [],
  onRendered = () => {},
  canvasMap = new Map(),
  resultMap = new Map()
}) => {
  onRendered();
  const setCanvas = url => canvas => canvasMap.set(canvas, url);
  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <ImageList
        variant="masonry"
        cols={3}
        gap={8}
        sx={{ overflowY: "hidden" }}
      >
        {items.map(({ url, title }) => (
          <ImageListItem key={url} sx={{ overflow: "hidden" }}>
            <QrImage
              {...{ url }}
              setCanvas={setCanvas(url)}
              result={resultMap.get(url)}
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
};
