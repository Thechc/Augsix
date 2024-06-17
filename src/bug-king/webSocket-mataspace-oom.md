---
title: webSocket使用不当导致OOM
order: 1
author: Thechc
category: JVM
tag:
  - OOM
  - BUG
star: true
---

# 
![](https://image.augsix.com/materials/emoji/3ec346757c83c91d4d7526b2cac831d1.jpeg) 

休假回来，一屁股坐在工位上，刚要拿起茶叶蛋进入美好的早餐摸鱼时间。同事说昨天出现了内存溢出报错，最终重启了服务恢复系统正常使用。

内存溢出？我激动地立即打开 ELK 查日志看看是怎么个事儿。

![](https://image.augsix.com/materials/bug/elk-oomlog-cteate.png) 

从 ELK 看到确实在快下班的时候系统生成了 dump 文件。而且可以看到是 `Java.lang .0utOfMemoryError: Metaspace` 。咋会是元空间内存溢出呢？

::: tip 
如果想要出现内存溢出时生成 dump 文件，需要在 jar 包启动命令加上两个参数:
```bash
// 设置当首次遭遇内存溢出时导出此时堆中相关信息
-XX:+HeapDumpOnOutOfMemoryError 
// 指定导出堆信息时的路径或文件名
-XX:HeapDumpPath=/tmp/heapdump.hprof 
```
:::

![](https://image.augsix.com/materials/bug/java.lang.OutOfMemoryError-GC-overhead-limit-exceeded.png) 

并且往更早的时间点查，发现冲早上的 7 点多开始就有报错 `java.lang.0utOfMemoryError:GC overhead limit exceeded`。

本来系统报错是有通过钉钉告警的。但是因为月底，钉钉通知次数用完了，所以大家都没收到报错告警。🙊

![](https://image.augsix.com/materials/emoji/d287b8829794167265b54095cf40eade.gif) 

从 ELK 日志看不出是哪里导致的内存溢出，所以需要通过 dump 文件来分析问题出在了哪里，这边使用 `IBM HeapAnalyzer` 进行分析。

通过 [IBM HeapAnalyzer](https://www.ibm.com/support/pages/ibm-heapanalyzer) 看出 `ExcelExportTaskWebSocket` 这个类占了 `96.16%` 的内存，其中有 `5W` 多个 WxSession 对象，一个 WxSession 对象 `70bytes`。

也就是大概有 3G 多的对象...

![](https://image.augsix.com/materials/bug/metaspace-oom-dump.png) 

`ExcelExportTaskWebSocket` 这个类是使用 `websocket` 用来做站内通知的，所以我推断是不是 `websocket` 未关闭导致的内存溢出。



``` java

@Slf4j
@Component
@ServerEndpoint("/app/ws/export-task/{token}")
@EqualsAndHashCode
public class ExcelExportTaskWebSocket {

  public static final String HEART_BEAT = "HEART-BEAT";

  /**
   * 在线人数
   */
  private static final AtomicInteger ONLINE_COUNT = new AtomicInteger(0);
  /**
   * 当前会话
   */
  private Session session;
  /**
   * 用户唯一标识
   */
  private String userToken;

  /**
   * concurrent包的线程安全Set，用来存放每个客户端对应的Session对象。
   */
  private static final CopyOnWriteArraySet<ExcelExportTaskWebSocket> WEB_SOCKET_SET = new CopyOnWriteArraySet<>();

  /**
   * concurrent包的线程安全set，用来存放每个客户端对应的MyWebSocket对象
   */
  private static final ConcurrentMap<String, ExcelExportTaskWebSocket> WEB_SOCKET_MAP = Maps.newConcurrentMap();

  /**
   * 为了保存在线用户信息，在方法中新建一个list存储一下【实际项目依据复杂度，可以存储到数据库或者缓存】
   */
  private static final List<Session> SESSIONS = Collections.synchronizedList(new ArrayList<>());

  /**
   * 打开连接
   *
   * @param session   session
   * @param userToken 用户token
   */
  @OnOpen
  public void onOpen(Session session, @PathParam("token") String userToken) {
    this.session = session;
    this.userToken = userToken;
    WEB_SOCKET_SET.add(this);
    SESSIONS.add(session)
    if (WEB_SOCKET_MAP.containsKey(this.userToken)) {
      WEB_SOCKET_MAP.remove(this.userToken);
      WEB_SOCKET_MAP.put(this.userToken, this);
    } else {
      WEB_SOCKET_MAP.put(this.userToken, this);
      addOnlineCount();
    }
  }

  /**
   * 关闭连接
   */
  @OnClose
  public void onClose() {
    WEB_SOCKET_SET.remove(this);
    if (WEB_SOCKET_MAP.containsKey(userToken)) {
      WEB_SOCKET_MAP.remove(userToken);
      subOnlineCount();
    }
    log.info("[连接ID:{}] 断开连接, 当前连接数:{}", userToken, getOnlineCount());
  }

  /**
   * 连接失败
   *
   * @param session session
   * @param error   错误异常
   */
  @OnError
  public void onError(Session session, Throwable error) {
    log.info("[连接ID:{}] 错误原因:{}", this.userToken, error.getMessage());
  }

  /**
   * 接收消息
   *
   * @param message 消息内容
   */
  @OnMessage
  public void onMessage(String message) {
    boolean json = JSONUtil.isJson(message);
    if (!json && HEART_BEAT.equals(message)) {
      return;
    }
    log.info("[连接ID:{}] 收到消息:{}", this.userToken, message);
  }

  /**
   * 发送消息
   *
   * @param message   消息内容
   * @param userToken 用户id
   */
  public void sendMessage(String message, String userToken) {
    ExcelExportTaskWebSocket webSocketServer = WEB_SOCKET_MAP.get(userToken);
    if (webSocketServer != null) {
      log.info("【websocket消息】推送消息,[toUser]userToken={},message={}", userToken, message);
      try {
        webSocketServer.session.getBasicRemote().sendText(message);
      } catch (Exception e) {
        log.error("[连接ID:{}] 发送消息失败, 消息:{}", this.userToken, message, e);
      }
    }
  }

  /**
   * 群发消息
   *
   * @param message 消息
   */
  public void sendMassMessage(String message) {
    try {
      for (Session currentSession : SESSIONS) {

        if (currentSession.isOpen()) {
          currentSession.getBasicRemote().sendText(message);
          log.info("[连接ID:{}] 发送消息:{}", currentSession.getRequestParameterMap().get("userId"), message);
        }
      }
    } catch (Exception e) {
      log.info("群发失败", e);
    }
  }

  /**
   * 获取当前连接数
   *
   * @return 在线任务
   */
  public static synchronized AtomicInteger getOnlineCount() {
    return ONLINE_COUNT;
  }

  /**
   * 当前连接数加一
   */
  public static synchronized void addOnlineCount() {
    ExcelExportTaskWebSocket.ONLINE_COUNT.incrementAndGet();
  }

  /**
   * 当前连接数减一
   */
  public static synchronized void subOnlineCount() {
    ExcelExportTaskWebSocket.ONLINE_COUNT.decrementAndGet();
  }

}
```

`ExcelExportTaskWebSocket` 定义了 `WEB_SOCKET_SET`、`WEB_SOCKET_MAP`、`SESSIONS` 来存放 `Session`。
其中在开启链接是会把 `Session` 放到对应的容器中,关闭连接是从对应容器删除 `Session`。乍一看并没有什么问题，`Session` 都有关闭。
```java
@OnOpen
public void onOpen(Session session, @PathParam("token") String userToken) {
  this.session = session;
  this.userToken = userToken;
  WEB_SOCKET_SET.add(this);
  SESSIONS.add(session);
  if (WEB_SOCKET_MAP.containsKey(this.userToken)) {
    WEB_SOCKET_MAP.remove(this.userToken);
    WEB_SOCKET_MAP.put(this.userToken, this);
  } else {
    WEB_SOCKET_MAP.put(this.userToken, this);
    addOnlineCount();
  }
}

@OnClose
public void onClose() {
  WEB_SOCKET_SET.remove(this);
  if (WEB_SOCKET_MAP.containsKey(userToken)) {
    WEB_SOCKET_MAP.remove(userToken);
    subOnlineCount();
  }
  log.info("[连接ID:{}] 断开连接, 当前连接数:{}", userToken, getOnlineCount());
}

```
但是 **心机之蛙一直摸你肚子**

反复查看代码发现开启连接时 `SESSIONS` 在 onOpen 是将对象放进容器，但是在 onClose 却没有去删除掉容器里的 `Session`。

这就导致放在容器里的对象都不会被删除。随着服务器长期未重启，`Session` 越来越多，占用的空间越来越大。

并且因为 `SESSIONS` 被 `static` 关键字修饰。所以对应的就是元空间溢出。

![](https://image.augsix.com/materials/emoji/ceeb653ely8h030d7zqkng207g07t4g2.gif) 
