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
          collapsible: true,
          icon: "concurrent",
          children: [
            "jmm",
            {
              text: "JUC",
              icon: "aqs",
              collapsible: true,
              prefix: "JUC/",
              children: [
                "AQS"
              ],
            },
          ],
        },
        {
          text: "JVM",
          prefix: "JVM/",
          icon: "jvm",
          collapsible: true,
          children: [
            "jvm-memory-structure",
            "jvm-garbage-collection",
            "jvm-class-loud",
            "jvm-memory-modle"
          ],
        }
      ]
    },
    {
      text: "开发框架",
      icon: "frame",
      prefix: "framework/",
      collapsible: true,
      children: [
        {
          text: "spring",
          prefix: "spring/",
          collapsible: true,
          icon: "leaf",
          children: [
            "source-code-1-spring-intro",
            "source-code-2-ioc-start-intro",
            "source-code-3-ioc-instantiate",
            "source-code-4-ioc-initialization-beanfactory",
            "source-code-5-register-bean-post-processors",
            "source-code-6-finishBeanFactoryInitialization",
            "source-code-7-singleton-bean-create"
          ],
        },
      ]
    },
    {
      text: "分布式",
      icon: "weifuwu",
      prefix: "distributed-system/",
      collapsible: true,
      children: [
        {
          text: "注册中心",
          prefix: "registration-center/",
          icon: "register",
          children: [
            "eureka-source-code",
          ],
        },
        {
          text: "API网关",
          prefix: "gateway/",
          icon: "register",
          children: [
            "eureka-source-code",
          ],
        },
      ]
    },
  ],
});
