import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/Augsix/",

  lang: "en-US",
  title: "AugSix",
  // description: "A blog demo for vuepress-theme-hope",

  theme: theme({
    hostname: "https://thechc.github.io/Augsix/",
  }),

  // Enable it with pwa
  // shouldPrefetch: false,
});
