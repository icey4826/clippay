import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// On macOS the bundled chrome-headless-shell's helper processes crash looking for icudtl.dat, so render with
// the installed Google Chrome when there is one.
const SYSTEM_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (process.platform === "darwin" && existsSync(SYSTEM_CHROME)) {
  Config.setBrowserExecutable(SYSTEM_CHROME);
  Config.setChromeMode("chrome-for-testing");
}
