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
              prefix: "juc/",
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
      text: "微服务",
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
      ]
    },
    {
      text: "MySQL",
      icon: "MySQL",
      prefix: "MySQL/",
      collapsible: true,
      children: [
          "innodb-locking",
          "index-invalid"
      ]
    },
    {
      text: "设计模式",
      icon: "laravel",
      prefix: "design-patterns/",
      collapsible: true,
      children: [
          "pattern-templete-factory"
      ]
    },
    {
      text: "Bug King",
      icon: "bug",
      prefix: "bug-king/",
      collapsible: true,
      children: [
          "mysql-insert-batch-deadlock",
          "webSocket-mataspace-oom"
      ]
    },
  ],
});
