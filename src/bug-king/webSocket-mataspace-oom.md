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

![](https://image.augsix.com/materials/bug/elk-oomlog-cteate.png) 


![](https://image.augsix.com/materials/bug/java.lang.OutOfMemoryError-GC-overhead-limit-exceeded.png) 


![](https://image.augsix.com/materials/bug/metaspace-oom-dump.png) 


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
    SESSIONS.add(session);
    log.info("SESSIONS容量：{}", SESSIONS.size());
    if (WEB_SOCKET_MAP.containsKey(this.userToken)) {
      WEB_SOCKET_MAP.remove(this.userToken);
      WEB_SOCKET_MAP.put(this.userToken, this);
    } else {
      WEB_SOCKET_MAP.put(this.userToken, this);
      addOnlineCount();
    }
    log.info("[连接ID:{}] 建立连接, 当前连接数:{}", this.userToken, getOnlineCount());
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