export const context = { cameras: [] };

const handleMediaStream = async (stream, { video, zoom }) => {
  console.log("Camera is loaded", stream);
  video.srcObject = stream;
  const [track] = stream.getVideoTracks();
  if (!context.track) context.track = track;
  const settings = track.getSettings() || {};
  const capability = track.getCapabilities();
  const { width = 1, height = 1 } = settings;
  const newWidth = (video.height * width) / height;
  Object.assign(video, { width: Math.max(100, newWidth) });
  if (zoom && "zoom" in settings) {
    const {
      zoom: { max: maxZoom, min: minZoom, step: zoomStep },
    } = capability;
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
    return { settings: track.getSettings(), capability, track };
  }
  return { settings, capability, track };
};

const openStream = async ({ cameraInfo = {}, getUserMedia, video, zoom }) => {
  const constraints = {
    video: {
      facingMode: "environment",
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

export const toggleCamera = async ({ video, zoom }) => {
  try {
    const { cameras, current } = context;
    if (!video.srcObject || !current) {
      console.log("video is not initialised, try later");
      return {};
    }
    const { deviceId } = current;
    const idx = cameras.findIndex(i => i.deviceId === deviceId);
    if (idx < 0) {
      console.error("current camera is invalid");
      return {};
    }
    const newIndex = (idx + 1) % cameras.length;
    const newCamera = context.cameras[newIndex] || context.cameras[0];
    if (newCamera !== context.current) {
      context.track?.stop();
      const resp = await openStream({
        cameraInfo: context.current,
        getUserMedia: context.getUserMedia,
        video,
        zoom,
      }).catch(e => {
        console.error("error toggle camera:", e.message);
        return {};
      });
      if (!resp.settings) return context.cameraContext || {};
      context.track = resp.track;
      context.current = newCamera;
      context.cameraContext = resp;
      return resp;
    }
  } catch (e) {
    console.error(e.message);
  }
  return {};
};

export const hasCamera = () => {
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

export const connectCameraToVideo = async (video, { zoom = 0 } = {}) => {
  if (!hasCamera()) return;
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
    const devices = await navigator.mediaDevices.enumerateDevices().catch(e => {
      console.warn("error enumerating devices", e.message);
      return [];
    });
    const cameras = devices.filter(i => i.kind === "videoinput");
    context.cameras = cameras;
    console.log("cameras:", cameras);
    context.current = context.cameras.slice(-1)[0];
  }

  return openStream({
    cameraInfo: context.current,
    getUserMedia,
    video,
    zoom,
  });
};
