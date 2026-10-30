import { Config } from "@remotion/cli/config";

// Render with the locally installed Chromium/Brave instead of downloading Chrome Headless Shell.
// Override with REMOTION_BROWSER_EXECUTABLE if the browser moves.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER_EXECUTABLE ??
    "/opt/pw-browsers/chromium",
);
Config.setChromeMode("chrome-for-testing");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setConcurrency(4);
Config.setOverwriteOutput(true);
