import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    {
      text: "Java 核心技术",
      icon: "java",
      prefix: "java/",
      collapsible: true,
      children: [
        {
          text: "并发编程",
          prefix: "concurrent/",
          icon: "lock",
          children: [
            "jmm",
            {
              text: "juc",
              icon: "asynchronous",
              collapsible: true,
              prefix: "juc/",
              children: [
                "AQS"
              ],
            },
          ],
        }
      ]
    },
    // {
    //   text: "DevOps",
    //   icon: "set",
    //   prefix: "DevOps/",
    //   collapsible: true,
    //   children: [
    //     {
    //       text: "Arthas",
    //       prefix: "Arthas/",
    //       icon: "16gl-A",
    //       children: [
    //         "Arthas-intro",
    //       ],
    //     }
    //   ]
    // },
  ],
});
