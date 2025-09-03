/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["pdf-parse"], // https://gitlab.com/autokent/pdf-parse/-/issues/24#note_2312753650
};

export default config;
