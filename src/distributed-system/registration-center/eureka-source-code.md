---
title: Eureka 原理
order: 3
author: Thechc
category: 微服务
tag:
  - 微服务
star: true
---

## 前言

1. Eureka 是 Netflix 开发的服务发现框架，本身是一个基于 REST 的服务。主要用于微服务架构中的服务治理，提供服务注册与发现等功能。
2. Eureka 包含两个组件：Eureka Server 和 Eureka Client。Eureka Server 提供服务注册功能，Eureka Client 为服务提供方，将自身服务注册到 Eureka Server。
3. 在分布式领域中有个著名的CAP理论；一致性（Consistency）、可用性（Availability）、分区容错性（Partition tolerance），这三个要素在分布式系统中，最多满足两个，不可能三者兼顾。
4. Zookeeper 的设计原则是 CP，突出一致性，对每次请求的都得到一致的数据结果，但无法保证每次访问服务可用性，当遇到 Zookeeper 选举 Leader 节点失败的情况，可能导致整个服务不可用。
5. Eureka 的设计原则是 AP，突出可用性，保证每次请求都能够返回数据，不像 Zookeeper 有选举 leader的 过程，如果存在某台服务器宕机，客户端请求会自动切换到新的 Eureka节点，宕机的服务恢复后，又会重新纳入服务器集群管理中，而且 Eureka 内置服务心跳检测，确保了 Eureka 运行的健壮性。

## 服务注册

### Eureka server

> Eureka server 自动装配

Eureka Server 利用 SpringBoot 的自动装配加载 EurekaServerAutoConfiguration 配置类创建与启动。主要向 SpringBoot 注入了以下的类：

**EurekaServerConfig**：初始化EurekaServer相关配置。

**EurekaController**：服务治理少不了需要一个DashBoard来可视化监控，EurekaController基于springmvc提供DashBoard相关的功能。

**PeerAwareInstanceRegistry**：初始化集群注册表，发现注册作为主要的核心功能。

**PeerEurekaNodes**：初始化集群节点集合。

**EurekaServerContext**：基于 Eureka Server 配置注册表，集群节点集合以及服务实例初始化 Eureka Server 上下文。

**EurekaServerBootstrap**：Eureka Server 的启动类是 EurekaBootStrap， EurekaBootStrap 实现了 ServletContextListener。当容器启动的时候就调用 contextInitialized 方法。   
原生的 Eureka 是 Servlet 应用，但是spring cloud的应用是运行在内嵌的Tomcat等WEB服务器里面的，所以 Spring Cloud 对 EurekaBootStrap 重新封装成 EurekaServerBootstrap。

**加载 Jersey 容器和配置**：Jersey是一个restful风格的基于http的rpc调用框架，eureka使用它来为客户端提供远程服务。
```java
// EurekaServerAutoConfiguration.java
// jersry请求的过滤器，例如过滤 http://ip:port/eureka/*
@Bean
public FilterRegistrationBean<?> jerseyFilterRegistration(
        javax.ws.rs.core.Application eurekaJerseyApp) {
    FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<Filter>();
    bean.setFilter(new ServletContainer(eurekaJerseyApp));
    bean.setOrder(Ordered.LOWEST_PRECEDENCE);
    bean.setUrlPatterns(
            Collections.singletonList(EurekaConstants.DEFAULT_PREFIX + "/*"));

    return bean;
}
/**
jerseyApplication 方法，在容器中存放了一个jerseyApplication对象，jerseyApplication()方法里的东西和Spring源码里扫描@Component逻辑类似，
扫描@Path和@Provider标签，然后封装成beandefinition，封装到Application的set容器里。通过filter过滤器来过滤url进行映射到对象的Controller。
*/
@Bean
public javax.ws.rs.core.Application jerseyApplication(Environment environment,
        ResourceLoader resourceLoader) {
    ···
}
```
> Eureka Server 启动

Eureka Server 启动过程就是配置类中bean的注入顺序，如下图

![](http://image.augsix.com/materials/springcloud/eureka%20Server%E5%90%AF%E5%8A%A8%E6%B5%81%E7%A8%8B1.png)

> EurekaServerBootstrap | Eureka Server 启动器

SpringBoot 加载 EurekaServerInitializerConfiguration 配置类时会创建一个线程来初始化 EurekaServerBootstrap，调用 contextInitialized 方法。
```java

// EurekaServerBootstrap.java
public void contextInitialized(ServletContext context) {
    try {
        // 初始化Eureka环境
        initEurekaEnvironment();
    	// 初始化Eureka上下文
        initEurekaServerContext();

        context.setAttribute(EurekaServerContext.class.getName(), this.serverContext);
    }
    catch (Throwable e) {
        log.error("Cannot bootstrap eureka server :", e);
        throw new RuntimeException("Cannot bootstrap eureka server :", e);
    }
}
```

initEurekaEnvironment 方法用来加载 EurekaServer 环境，一般都是使用默认的。initEurekaServerContext 方法初始化 EurekaServer 上下文

```java
// EurekaServerBootstrap#initEurekaServerContext
protected void initEurekaServerContext() throws Exception {
    // 设置json与xml序列化工具
    // For backward compatibility
    JsonXStream.getInstance().registerConverter(new V1AwareInstanceInfoConverter(),
            XStream.PRIORITY_VERY_HIGH);
    XmlXStream.getInstance().registerConverter(new V1AwareInstanceInfoConverter(),
            XStream.PRIORITY_VERY_HIGH);
	// Amazon 配置信息无需注意
    if (isAws(this.applicationInfoManager.getInfo())) {
        this.awsBinder = new AwsBinderDelegate(this.eurekaServerConfig,
                this.eurekaClientConfig, this.registry, this.applicationInfoManager);
        this.awsBinder.start();
    }

    EurekaServerContextHolder.initialize(this.serverContext);

    log.info("Initialized server context");
    // 从集群节点同步注册表
    // Copy registry from neighboring eureka node
    int registryCount = this.registry.syncUp();
	// 默认每30秒发送心跳，修改eureka状态为up 
    // 同时，这里面会开启一个定时任务，用于清理 60秒没有心跳的客户端。自动下线
    this.registry.openForTraffic(this.applicationInfoManager, registryCount);
	// 注册所有监控统计信息
    // Register all monitoring statistics.
    EurekaMonitors.registerAllStats();
}
```

> jerseyApplication | Jersey 提供对外的服务接口

Jersey 服务扫描 com.netflix.eureka.resources 包下的 XXXResource 封装成一个个 RestApi 接口对外提供服务，其中 registry 便是 EurekaServer 注册表。

```java
@Produces({"application/xml", "application/json"})
public class ApplicationResource {
    // 注册表
    private final PeerAwareInstanceRegistry registry;
    // ... 其他代码
    @POST
    @Consumes({"application/json", "application/xml"})
    public Response addInstance(InstanceInfo info,
                                @HeaderParam(PeerEurekaNode.HEADER_REPLICATION) String isReplication) {
        // ... 其他代码 ...
        registry.register(info, "true".equals(isReplication));
        return Response.status(204).build();  // 204 to be backwards compatible
    }
}
```

> PeerAwareInstanceRegistry#register | 服务注册

```java
/**
 * Registers a new instance with a given duration.
 *
 * @see com.netflix.eureka.lease.LeaseManager#register(java.lang.Object, int, boolean)
 */
public void register(InstanceInfo registrant, int leaseDuration, boolean isReplication) {
    read.lock();
    try {
        Map<String, Lease<InstanceInfo>> gMap = registry.get(registrant.getAppName());
        REGISTER.increment(isReplication);
        if (gMap == null) {
            final ConcurrentHashMap<String, Lease<InstanceInfo>> gNewMap = new ConcurrentHashMap<String, Lease<InstanceInfo>>();
            gMap = registry.putIfAbsent(registrant.getAppName(), gNewMap);
            if (gMap == null) {
                gMap = gNewMap;
            }
        }
        Lease<InstanceInfo> existingLease = gMap.get(registrant.getId());
        // Retain the last dirty timestamp without overwriting it, if there is already a lease
        if (existingLease != null && (existingLease.getHolder() != null)) {
            Long existingLastDirtyTimestamp = existingLease.getHolder().getLastDirtyTimestamp();
            Long registrationLastDirtyTimestamp = registrant.getLastDirtyTimestamp();
            logger.debug("Existing lease found (existing={}, provided={}", existingLastDirtyTimestamp, registrationLastDirtyTimestamp);

            // this is a > instead of a >= because if the timestamps are equal, we still take the remote transmitted
            // InstanceInfo instead of the server local copy.
            if (existingLastDirtyTimestamp > registrationLastDirtyTimestamp) {
                logger.warn("There is an existing lease and the existing lease's dirty timestamp {} is greater" +
                        " than the one that is being registered {}", existingLastDirtyTimestamp, registrationLastDirtyTimestamp);
                logger.warn("Using the existing instanceInfo instead of the new instanceInfo as the registrant");
                registrant = existingLease.getHolder();
            }
        } else {
            // The lease does not exist and hence it is a new registration
            synchronized (lock) {
                if (this.expectedNumberOfClientsSendingRenews > 0) {
                    // Since the client wants to register it, increase the number of clients sending renews
                    this.expectedNumberOfClientsSendingRenews = this.expectedNumberOfClientsSendingRenews + 1;
                    updateRenewsPerMinThreshold();
                }
            }
            logger.debug("No previous lease information found; it is new registration");
        }
        Lease<InstanceInfo> lease = new Lease<InstanceInfo>(registrant, leaseDuration);
        if (existingLease != null) {
            lease.setServiceUpTimestamp(existingLease.getServiceUpTimestamp());
        }
        gMap.put(registrant.getId(), lease);
        recentRegisteredQueue.add(new Pair<Long, String>(
                System.currentTimeMillis(),
                registrant.getAppName() + "(" + registrant.getId() + ")"));
        // This is where the initial state transfer of overridden status happens
        if (!InstanceStatus.UNKNOWN.equals(registrant.getOverriddenStatus())) {
            logger.debug("Found overridden status {} for instance {}. Checking to see if needs to be add to the "
                            + "overrides", registrant.getOverriddenStatus(), registrant.getId());
            if (!overriddenInstanceStatusMap.containsKey(registrant.getId())) {
                logger.info("Not found overridden id {} and hence adding it", registrant.getId());
                overriddenInstanceStatusMap.put(registrant.getId(), registrant.getOverriddenStatus());
            }
        }
        InstanceStatus overriddenStatusFromMap = overriddenInstanceStatusMap.get(registrant.getId());
        if (overriddenStatusFromMap != null) {
            logger.info("Storing overridden status {} from map", overriddenStatusFromMap);
            registrant.setOverriddenStatus(overriddenStatusFromMap);
        }

        // Set the status based on the overridden status rules
        InstanceStatus overriddenInstanceStatus = getOverriddenInstanceStatus(registrant, existingLease, isReplication);
        registrant.setStatusWithoutDirty(overriddenInstanceStatus);

        // If the lease is registered with UP status, set lease service up timestamp
        if (InstanceStatus.UP.equals(registrant.getStatus())) {
            lease.serviceUp();
        }
        registrant.setActionType(ActionType.ADDED);
        // 记录实例信息，还标记了增量类型。增量类型有三种： ADDED ， MODIFIED， DELETED。
        // 分别表示实例的新增、状态变更和删除。
        // 增量服务发现时使用
        recentlyChangedQueue.add(new RecentlyChangedItem(lease));
        registrant.setLastUpdatedTimestamp();
        invalidateCache(registrant.getAppName(), registrant.getVIPAddress(), registrant.getSecureVipAddress());
        logger.info("Registered instance {}/{} with status {} (replication={})",
                registrant.getAppName(), registrant.getId(), registrant.getStatus(), isReplication);
    } finally {
        read.unlock();
    }
}
```
recentlyChangedQueue 记录实例信息，还标记了增量类型。增量类型有三种： ADDED ， MODIFIED， DELETED；增量服务发现时使用。

### Eureka Client

> Eureka Client 自动装配

SpringBoot 通过自动装配 EurekaClientAutoConfiguration 注入 EurekaClient，EurekaClient 由 CloudEurekaClient 类生成客户端对象，CloudEurekaClient 又继承自 DiscoveryClient 类。
```java
// EurekaClientAutoConfiguration.class
@Bean(destroyMethod = "shutdown")
@ConditionalOnMissingBean(value = EurekaClient.class,
        search = SearchStrategy.CURRENT)
public EurekaClient eurekaClient(ApplicationInfoManager manager,
        EurekaClientConfig config) {
    return new CloudEurekaClient(manager, config, this.optionalArgs,
            this.context);
}
```
在 DiscoveryClient 的构造方法中最终会调用 AbstractJerseyEurekaHttpClient 的 register 方法去注册服务到 Eureka Server 中。
```java
// DiscoveryClient.class
@Inject
DiscoveryClient(ApplicationInfoManager applicationInfoManager, EurekaClientConfig config, AbstractDiscoveryClientOptionalArgs args,
                Provider<BackupRegistry> backupRegistryProvider, EndpointRandomizer endpointRandomizer) {
    // ...
    if (clientConfig.shouldRegisterWithEureka() && clientConfig.shouldEnforceRegistrationAtInit()) {
        try {
            if (!register() ) {
                throw new IllegalStateException("Registration error at startup. Invalid server response.");
            }
        } catch (Throwable th) {
            logger.error("Registration error at startup: {}", th.getMessage());
            throw new IllegalStateException(th);
        }
    }
    // ...
}
// DiscoveryClient#register
boolean register() throws Throwable {
    logger.info(PREFIX + "{}: registering service...", appPathIdentifier);
    EurekaHttpResponse<Void> httpResponse;
    try {
        // 调用 AbstractJerseyEurekaHttpClient 的 register 方法
        httpResponse = eurekaTransport.registrationClient.register(instanceInfo);
    } catch (Exception e) {
        logger.warn(PREFIX + "{} - registration failed {}", appPathIdentifier, e.getMessage(), e);
        throw e;
    }
    if (logger.isInfoEnabled()) {
        logger.info(PREFIX + "{} - registration status: {}", appPathIdentifier, httpResponse.getStatusCode());
    }
    return httpResponse.getStatusCode() == Status.NO_CONTENT.getStatusCode();
}
```

> AbstractJerseyEurekaHttpClient#register | 注册服务

在 AbstractJerseyEurekaHttpClient 的 register 方法中会组装注册 Url 并以 POST 方式发送请求，请求链接为 http://localhost:8761/eureka/apps/ORDERSERVICE
```java
// AbstractJerseyEurekaHttpClient#register
@Override
public EurekaHttpResponse<Void> register(InstanceInfo info) {
    String urlPath = "apps/" + info.getAppName();
    ClientResponse response = null;
    try {
        Builder resourceBuilder = jerseyClient.resource(serviceUrl).path(urlPath).getRequestBuilder();
        addExtraHeaders(resourceBuilder);
        response = resourceBuilder
                .header("Accept-Encoding", "gzip")
                .type(MediaType.APPLICATION_JSON_TYPE)
                .accept(MediaType.APPLICATION_JSON)
                .post(ClientResponse.class, info);
        return anEurekaHttpResponse(response.getStatus()).headers(headersOf(response)).build();
    } finally {
        if (logger.isDebugEnabled()) {
            logger.debug("Jersey HTTP POST {}/{} with instance {}; statusCode={}", serviceUrl, urlPath, info.getId(),
                    response == null ? "N/A" : response.getStatus());
        }
        if (response != null) {
            response.close();
        }
    }
}
```

## 服务续租

### Eureka Server

Eureka Server 对外提供的续租接口为 Put 请求，接口位于 InstanceRegistry 的 renewLease 方法。最终会调用 AbstractInstanceRegistry 的 renew 方法。

```java
// AbstractInstanceRegistry.Java
public boolean renew(String appName, String id, boolean isReplication) {
    // 增加续约次数到监控
    RENEW.increment(isReplication);
    // 获取注册表信息
    Map<String, Lease<InstanceInfo>> gMap = registry.get(appName);
    Lease<InstanceInfo> leaseToRenew = null;
    if (gMap != null) {
        leaseToRenew = gMap.get(id);
    }
    if (leaseToRenew == null) {
        RENEW_NOT_FOUND.increment(isReplication);
        logger.warn("DS: Registry: lease doesn't exist, registering resource: {} - {}", appName, id);
        return false;
    } else {
        InstanceInfo instanceInfo = leaseToRenew.getHolder();
        if (instanceInfo != null) {
            // touchASGCache(instanceInfo.getASGName());
            InstanceStatus overriddenInstanceStatus = this.getOverriddenInstanceStatus(
                instanceInfo, leaseToRenew, isReplication);
            // 实例覆盖状态为UNKNOWN，续租失败
            if (overriddenInstanceStatus == InstanceStatus.UNKNOWN) {
                logger.info("Instance status UNKNOWN possibly due to deleted override for instance {}"
                            + "; re-register required", instanceInfo.getId());
                RENEW_NOT_FOUND.increment(isReplication);
                return false;
            }
            // 实例状态与覆盖状态不一致
            if (!instanceInfo.getStatus().equals(overriddenInstanceStatus)) {
                logger.info(
                    "The instance status {} is different from overridden instance status {} for instance {}. "
                    + "Hence setting the status to overridden status", instanceInfo.getStatus().name(),
                    overriddenInstanceStatus.name(),
                    instanceInfo.getId());
                instanceInfo.setStatusWithoutDirty(overriddenInstanceStatus);

            }
        }
        renewsLastMin.increment();
        // 续租(设置服务的最后更新时间为当前时间)
        leaseToRenew.renew();
        return true;
    }
}

// Lease.java
public void renew() {
    lastUpdateTimestamp = System.currentTimeMillis() + duration;

}
```

Eureka Server 续租的原理其实就是更新服务的最后更新的时间，这个时间就是当前时间加服务的过期时间。

lastUpdateTimestamp 属性使用 volatile 修饰。

### Eureka Client

DiscoveryClient 在初始化的时候会创建线程来执行初始化续租定时任务，
```java
// DiscoveryClient.java
@Inject
DiscoveryClient(ApplicationInfoManager applicationInfoManager, EurekaClientConfig config, AbstractDiscoveryClientOptionalArgs args,
                Provider<BackupRegistry> backupRegistryProvider, EndpointRandomizer endpointRandomizer) {
    // 创建线程
    scheduler = Executors.newScheduledThreadPool(2,
                new ThreadFactoryBuilder()
                        .setNameFormat("DiscoveryClient-%d")
                        .setDaemon(true)
                        .build());
    // ...
    // 初始化定时任务
    // finally, init the schedule tasks (e.g. cluster resolvers, heartbeat, instanceInfo replicator, fetch
    initScheduledTasks();
    
}

// DiscoveryClient#initScheduledTasks
private void initScheduledTasks() {
    // Heartbeat timer
    //
    heartbeatTask = new TimedSupervisorTask(
            "heartbeat",
            scheduler,
            heartbeatExecutor,
            renewalIntervalInSecs, // 定时任务执行时间，默认为30秒
            TimeUnit.SECONDS,
            expBackOffBound,
            new HeartbeatThread()
    scheduler.schedule(
                heartbeatTask,
                renewalIntervalInSecs, TimeUnit.SECONDS);
}

```

在 HeartbeatThread 现在中主要之下 DiscoveryClient 的 renew 方法。

```java
//DiscoveryClient.HeartbeatThread
private class HeartbeatThread implements Runnable {

    public void run() {
        if (renew()) {
            lastSuccessfulHeartbeatTimestamp = System.currentTimeMillis();
        }
    }
}
```

renew 方法中调用 AbstractJerseyEurekaHttpClient 的 sendHeartBeat 方法续租，如果续约时没有找到服务，则重新注册服务。

```java
// DiscoveryClient.renew
boolean renew() {
    EurekaHttpResponse<InstanceInfo> httpResponse;
    try {
        httpResponse = eurekaTransport.registrationClient.sendHeartBeat(instanceInfo.getAppName(), instanceInfo.getId(), instanceInfo, null);
        logger.debug(PREFIX + "{} - Heartbeat status: {}", appPathIdentifier, httpResponse.getStatusCode());
        // 续租时找不到服务
        if (httpResponse.getStatusCode() == Status.NOT_FOUND.getStatusCode()) {
            REREGISTER_COUNTER.increment();
            logger.info(PREFIX + "{} - Re-registering apps/{}", appPathIdentifier, instanceInfo.getAppName());
            long timestamp = instanceInfo.setIsDirtyWithTime();
            boolean success = register();
            if (success) {
                instanceInfo.unsetIsDirty(timestamp);
            }
            return success;
        }
        return httpResponse.getStatusCode() == Status.OK.getStatusCode();
    } catch (Throwable e) {
        logger.error(PREFIX + "{} - was unable to send heartbeat!", appPathIdentifier, e);
        return false;
    }
}


```

AbstractJerseyEurekaHttpClient 的 sendHeartBeat 组装 PUT 请求发送搭服务端，Url：http://localhost:8761/eureka/apps/{appID}/{instanceID}。

```java

// AbstractJerseyEurekaHttpClient.sendHeartBeat
@Override
public EurekaHttpResponse<InstanceInfo> sendHeartBeat(String appName, String id, InstanceInfo info, InstanceStatus overriddenStatus) {
    String urlPath = "apps/" + appName + '/' + id;
    ClientResponse response = null;
    try {
        WebResource webResource = jerseyClient.resource(serviceUrl)
                .path(urlPath)
                .queryParam("status", info.getStatus().toString())
                .queryParam("lastDirtyTimestamp", info.getLastDirtyTimestamp().toString());
        if (overriddenStatus != null) {
            webResource = webResource.queryParam("overriddenstatus", overriddenStatus.name());
        }
        Builder requestBuilder = webResource.getRequestBuilder();
        addExtraHeaders(requestBuilder);
        response = requestBuilder.put(ClientResponse.class);
        EurekaHttpResponseBuilder<InstanceInfo> eurekaResponseBuilder = anEurekaHttpResponse(response.getStatus(), InstanceInfo.class).headers(headersOf(response));
        if (response.hasEntity() &&
                !HTML.equals(response.getType().getSubtype())) { //don't try and deserialize random html errors from the server
            eurekaResponseBuilder.entity(response.getEntity(InstanceInfo.class));
        }
        return eurekaResponseBuilder.build();
    } finally {
        if (logger.isDebugEnabled()) {
            logger.debug("Jersey HTTP PUT {}/{}; statusCode={}", serviceUrl, urlPath, response == null ? "N/A" : response.getStatus());
        }
        if (response != null) {
            response.close();
        }
    }
}
```

## 服务剔除

### Eureka Server

Eureka Server 会定期清除异常或者宕机的服务，服务剔除其实是一个兜底的方案，目的就是解决非正常情况下的服务宕机或其他因素导致不能发送cancel请求的服务信息清理的策略，原理就是从注册表中将服务删除。
> 服务剔除方法入口

EurekaServerBootstrap 在 初始化上下文时先 调用了一个方法 openForTraffic。

```java
// PeerAwareInstanceRegistryImpl.java
@Override
public void openForTraffic(ApplicationInfoManager applicationInfoManager, int count) {
    // Renewals happen every 30 seconds and for a minute it should be a factor of 2.
    // 期待发送心跳的客户端数量
    this.expectedNumberOfClientsSendingRenews = count;
    // 每分钟最小续约数 实例数量*2*0.85个心跳
    updateRenewsPerMinThreshold();
    logger.info("Got {} instances from neighboring DS node", count);
    logger.info("Renew threshold is: {}", numberOfRenewsPerMinThreshold);
    this.startupTime = System.currentTimeMillis();
    if (count > 0) {
        this.peerInstancesTransferEmptyOnStartup = false;
    }
    DataCenterInfo.Name selfName = applicationInfoManager.getInfo().getDataCenterInfo().getName();
    boolean isAws = Name.Amazon == selfName;
    if (isAws && serverConfig.shouldPrimeAwsReplicaConnections()) {
        logger.info("Priming AWS connections for all replicas..");
        primeAwsReplicas(applicationInfoManager);
    }
    logger.info("Changing status to UP");
    applicationInfoManager.setInstanceStatus(InstanceStatus.UP);
    // 创建服务剔除定时任务，每60秒执行一次
    super.postInit();
}

// AbstractInstanceRegistry.java
protected void postInit() {
    renewsLastMin.start();
    if (evictionTaskRef.get() != null) {
        evictionTaskRef.get().cancel();
    }
    evictionTaskRef.set(new EvictionTask());
    // 60秒执行一次
    evictionTimer.schedule(evictionTaskRef.get(),
            serverConfig.getEvictionIntervalTimerInMs(),
            serverConfig.getEvictionIntervalTimerInMs());
}

// EvictionTask.java
class EvictionTask extends TimerTask {
    private final AtomicLong lastExecutionNanosRef = new AtomicLong(0l);
    @Override
    public void run() {
        try {
            // 计算补偿时间
            long compensationTimeMs = getCompensationTimeMs();
            logger.info("Running the evict task with compensationTime {}ms", compensationTimeMs);
            evict(compensationTimeMs);
        } catch (Throwable e) {
            logger.error("Could not run the evict task", e);
        }
    }
// ...
}
```

**补偿时间**：计算本次定时任务执行的时间戳和上次定时任务执行的时间戳，这个时间戳在默认配置的情况下，应该等于60s，因为定时任务是每60s执行一次。如果因为server的内部原因（比如gc）导致差值大于60s的话。那么就会影响剔除服务实例的准确性，所以需要计算出这个“补偿时间”。

> 服务剔除任务 

EvictionTask 是定时任务，剔除逻辑在 evict 方法里。
```java
public void evict(long additionalLeaseMs) {
    logger.debug("Running the evict task");
	// 先判断 Eureka 是否开启自我保护机制，默认自动开启。	
    if (!isLeaseExpirationEnabled()) {
        logger.debug("DS: lease expiration is currently disabled.");
        return;
    }

    // We collect first all expired items, to evict them in random order. For large eviction sets,
    // if we do not that, we might wipe out whole apps before self preservation kicks in. By randomizing it,
    // the impact should be evenly distributed across all applications.
    List<Lease<InstanceInfo>> expiredLeases = new ArrayList<>();
    for (Entry<String, Map<String, Lease<InstanceInfo>>> groupEntry : registry.entrySet()) {
        Map<String, Lease<InstanceInfo>> leaseMap = groupEntry.getValue();
        if (leaseMap != null) {
            for (Entry<String, Lease<InstanceInfo>> leaseEntry : leaseMap.entrySet()) {
                Lease<InstanceInfo> lease = leaseEntry.getValue();
                // 判断服务是否过期
                if (lease.isExpired(additionalLeaseMs) && lease.getHolder() != null) {
                    expiredLeases.add(lease);
                }
            }
        }
    }

    // To compensate for GC pauses or drifting local time, we need to use current registry size as a base for
    // triggering self-preservation. Without that we would wipe out full registry.
    int registrySize = (int) getLocalRegistrySize();
    int registrySizeThreshold = (int) (registrySize * serverConfig.getRenewalPercentThreshold());
    int evictionLimit = registrySize - registrySizeThreshold;

    int toEvict = Math.min(expiredLeases.size(), evictionLimit);
    if (toEvict > 0) {
        logger.info("Evicting {} items (expired={}, evictionLimit={})", toEvict, expiredLeases.size(), evictionLimit);

        Random random = new Random(System.currentTimeMillis());
        for (int i = 0; i < toEvict; i++) {
            // Pick a random item (Knuth shuffle algorithm)
            // 随机选中一个过期的服务删除
            int next = i + random.nextInt(expiredLeases.size() - i);
            Collections.swap(expiredLeases, i, next);
            Lease<InstanceInfo> lease = expiredLeases.get(i);

            String appName = lease.getHolder().getAppName();
            String id = lease.getHolder().getId();
            EXPIRED.increment();
            logger.warn("DS: Registry: expired lease for {}/{}", appName, id);
            // 删除注册表和缓存中的服务信息
            internalCancel(appName, id, false);
        }
    }
}
```
这个方法分为三步

1. 判断是否触发自我保护
2. 获取过期即将删除的服务
3. 剔除服务
> 判断服务是否过期

通过遍历服务调用 isExpired 判断是否过期，isExpired 方法：
```java
/**
 * Checks if the lease of a given {@link com.netflix.appinfo.InstanceInfo} has expired or not.
 *
 * Note that due to renew() doing the 'wrong" thing and setting lastUpdateTimestamp to +duration more than
 * what it should be, the expiry will actually be 2 * duration. This is a minor bug and should only affect
 * instances that ungracefully shutdown. Due to possible wide ranging impact to existing usage, this will
 * not be fixed.
 *
 * @param additionalLeaseMs any additional lease time to add to the lease evaluation in ms.
 */
public boolean isExpired(long additionalLeaseMs) {
    return (evictionTimestamp > 0 || System.currentTimeMillis() > (lastUpdateTimestamp + duration + additionalLeaseMs));
}
```
这边有个小彩蛋，根据注释描述 Eureka 官方承认了一个bug，在续约 renew 的时候将 **lastUpdateTimestamp** 赋值为 System.currentTimeMillis() + duration，duration 默认为90s，因此导致了这里过期时间判断的时候，过期时间为 System.currentTimeMillis() + duration + duration + additionalLeaseMs，也就是过期时间为 2 * 90s，所以一个服务3分钟都没有向 Eureka Server 发送续约服务才会被剔除。
这里过期时间还加上了前面传递进来的 **additionalLeaseMs 补偿时间** 也就是为了防止系统 gc 导致本未过期的服务被提前剔除。
> internalCancel | 服务剔除

```java
protected boolean internalCancel(String appName, String id, boolean isReplication) {
    read.lock();
    try {
        CANCEL.increment(isReplication);
        // 从注册表中过期服务并移除
        Map<String, Lease<InstanceInfo>> gMap = registry.get(appName);
        Lease<InstanceInfo> leaseToCancel = null;
        if (gMap != null) {
            leaseToCancel = gMap.remove(id);
        }
        recentCanceledQueue.add(new Pair<Long, String>(System.currentTimeMillis(), appName + "(" + id + ")"));
        InstanceStatus instanceStatus = overriddenInstanceStatusMap.remove(id);
        if (instanceStatus != null) {
            logger.debug("Removed instance id {} from the overridden map which has value {}", id, instanceStatus.name());
        }
        if (leaseToCancel == null) {
            CANCEL_NOT_FOUND.increment(isReplication);
            logger.warn("DS: Registry: cancel failed because Lease is not registered for: {}/{}", appName, id);
            return false;
        } else {
            leaseToCancel.cancel();
            InstanceInfo instanceInfo = leaseToCancel.getHolder();
            String vip = null;
            String svip = null;
            if (instanceInfo != null) {
                instanceInfo.setActionType(ActionType.DELETED);
                recentlyChangedQueue.add(new RecentlyChangedItem(leaseToCancel));
                instanceInfo.setLastUpdatedTimestamp();
                vip = instanceInfo.getVIPAddress();
                svip = instanceInfo.getSecureVipAddress();
            }
            // 清除缓存
            invalidateCache(appName, vip, svip);
            logger.info("Cancelled instance {}/{} (replication={})", appName, id, isReplication);
        }
    } finally {
        read.unlock();
    }

    synchronized (lock) {
        if (this.expectedNumberOfClientsSendingRenews > 0) {
            // Since the client wants to cancel it, reduce the number of clients to send renews.
            this.expectedNumberOfClientsSendingRenews = this.expectedNumberOfClientsSendingRenews - 1;
            updateRenewsPerMinThreshold();
        }
    }

    return true;
}
```
剔除方法主要有两步：

1. 将服务中注册表删除。
2. 清除缓存，防止 Eureka Client 拉取缓存时拉取到已经剔除的服务实例

## Eureka 注册表

### 注册表原理

Eureka 注册表由多个缓存组成：

1. 只读缓存：readOnlyCacheMap，底层是 ConcurrentMap，会有每隔30s主动的拉取读写缓存的服务信息。
2. 读写缓存：readWriteCacheMap，底层是 guava 的 LoadingCach，设置默认的过期时间是180s
3. 注册表：Eureka Server 服务注册信息，触发更新操作会将读写缓存中的值设置为失效状态

![](http://image.augsix.com/materials/springcloud/eureka%E6%B3%A8%E5%86%8C%E8%A1%A8.drawio.png)

注册表的拉取分为全量和增量；在初次拉取时使用的是全量（KEY 的 entityName 为 ALL_APPS），后面使用的都是增量拉取的（KEY 的 entityName 为 ALL_APPS_DELTA）。 
> 为什么使用缓存？

Eureka 为 AP 模型，使用缓存存储注册信息保证了服务的高可用性。

> 读写缓存 LoadingCache

Eureka Server 初始化 EurekaServerContext 的时候就会初始化读写缓存，用的是 guava 的 LoadingCache。

```java
// ResponseCacheImpl.class
ResponseCacheImpl(EurekaServerConfig serverConfig, ServerCodecs serverCodecs, AbstractInstanceRegistry registry) {
	··· 其它代码 ···
    long responseCacheUpdateIntervalMs = serverConfig.getResponseCacheUpdateIntervalMs();
    this.readWriteCacheMap =
            CacheBuilder.newBuilder().initialCapacity(serverConfig.getInitialCapacityOfResponseCache())  // 缓存容量1000个
                    // 缓存过期时间180s
                    // expireAfterWrite 缓存项在给定时间内没有被写访问（创建或覆盖），则回收。
        			// 如果认为缓存数据总是在固定时间后变得不可用，再次加载key，
        			// 调用CacheLoader的load方法。
                    .expireAfterWrite(serverConfig.getResponseCacheAutoExpirationInSeconds(), TimeUnit.SECONDS) 
                    .removalListener(new RemovalListener<Key, Value>() {
                        @Override
                        public void onRemoval(RemovalNotification<Key, Value> notification) {
                            Key removedKey = notification.getKey();
                            if (removedKey.hasRegions()) {
                                Key cloneWithNoRegions = removedKey.cloneWithoutRegions();
                                regionSpecificKeys.remove(cloneWithNoRegions, removedKey);
                            }
                        }
                    })
                    .build(new CacheLoader<Key, Value>() {
                        @Override
                        public Value load(Key key) throws Exception {
                            if (key.hasRegions()) {
                                Key cloneWithNoRegions = key.cloneWithoutRegions();
                                regionSpecificKeys.put(cloneWithNoRegions, key);
                            }
                            // 通过全量或增量拉取缓存
                            Value value = generatePayload(key);
                            return value;
                        }
                    });
    ... 其它代码 ···
}
// ResponseCacheImpl#generatePayload
private Value generatePayload(Key key) {
    // ··· 其他代码 ···
    String payload;
    switch (key.getEntityType()) {
        case Application:
            boolean isRemoteRegionRequested = key.hasRegions();
        	// 全量拉取
            if (ALL_APPS.equals(key.getName())) {
                if (isRemoteRegionRequested) {
                    tracer = serializeAllAppsWithRemoteRegionTimer.start();
                    payload = getPayLoad(key, registry.getApplicationsFromMultipleRegions(key.getRegions()));
                } else {
                    tracer = serializeAllAppsTimer.start();
                    payload = getPayLoad(key, registry.getApplications());
                }
            // 增量拉取
            } else if (ALL_APPS_DELTA.equals(key.getName())) {
                if (isRemoteRegionRequested) {
                    tracer = serializeDeltaAppsWithRemoteRegionTimer.start();
                    versionDeltaWithRegions.incrementAndGet();
                    versionDeltaWithRegionsLegacy.incrementAndGet();
                    payload = getPayLoad(key,
                            registry.getApplicationDeltasFromMultipleRegions(key.getRegions()));
                } else {
                    tracer = serializeDeltaAppsTimer.start();
                    versionDelta.incrementAndGet();
                    versionDeltaLegacy.incrementAndGet();
                    payload = getPayLoad(key, registry.getApplicationDeltas());
                }
            } else {
                tracer = serializeOneApptimer.start();
                payload = getPayLoad(key, registry.getApplication(key.getName()));
            }
            break;
    // ··· 其他代码 ···
    }
    return new Value(payload);
}
```
> readWriteCacheMap 全量拉取

注册表全量拉取就是遍历所有的服务信息，然后将所有服务信息转换为JSON或XML返回。

> readWriteCacheMap 增量拉取

在 Eureka Server 服务注册的接口定义了一个 recentlyChangedQueue 队列，放的是新增、变更、删除的服务，增量拉取就是通过这个队列拉取服务信息。

```java
// AbstractInstanceRegistry#getApplicationDeltas
public Applications getApplicationDeltas() {
    GET_ALL_CACHE_MISS_DELTA.increment();
    Applications apps = new Applications();
    apps.setVersion(responseCache.getVersionDelta().get());
    Map<String, Application> applicationInstancesMap = new HashMap<String, Application>();
    write.lock();
    try {
        Iterator<RecentlyChangedItem> iter = this.recentlyChangedQueue.iterator();
        logger.debug("The number of elements in the delta queue is : {}",
                this.recentlyChangedQueue.size());
        while (iter.hasNext()) {
            Lease<InstanceInfo> lease = iter.next().getLeaseInfo();
            InstanceInfo instanceInfo = lease.getHolder();
            logger.debug(
                    "The instance id {} is found with status {} and actiontype {}",
                    instanceInfo.getId(), instanceInfo.getStatus().name(), instanceInfo.getActionType().name());
            Application app = applicationInstancesMap.get(instanceInfo
                    .getAppName());
            if (app == null) {
                app = new Application(instanceInfo.getAppName());
                applicationInstancesMap.put(instanceInfo.getAppName(), app);
                apps.addApplication(app);
            }
            app.addInstance(new InstanceInfo(decorateInstanceInfo(lease)));
        }

        boolean disableTransparentFallback = serverConfig.disableTransparentFallbackToOtherRegion();

        if (!disableTransparentFallback) {
            Applications allAppsInLocalRegion = getApplications(false);

            for (RemoteRegionRegistry remoteRegistry : this.regionNameVSRemoteRegistry.values()) {
                Applications applications = remoteRegistry.getApplicationDeltas();
                for (Application application : applications.getRegisteredApplications()) {
                    Application appInLocalRegistry =
                            allAppsInLocalRegion.getRegisteredApplications(application.getName());
                    if (appInLocalRegistry == null) {
                        apps.addApplication(application);
                    }
                }
            }
        }

        Applications allApps = getApplications(!disableTransparentFallback);
        apps.setAppsHashCode(allApps.getReconcileHashCode());
        return apps;
    } finally {
        write.unlock();
    }
}
```
## 服务发现

### Eureka Server

> Eureka Server 全量服务发现接口

服务端处理请求的方法是com.netflix.eureka.resources.ApplicationsResource#getContainers，开放的请求url为GET：http://localhost:8761/eureka/apps/
最终调用的是 ResponseCacheImpl 的 getValue 方法。先从一级只读缓存取，取不到从读写缓存取。
```java
// ResponseCacheImpl#getValue
Value getValue(final Key key, boolean useReadOnlyCache) {
    Value payload = null;
    try {
        if (useReadOnlyCache) {
            // 一级缓存
            final Value currentPayload = readOnlyCacheMap.get(key);
            if (currentPayload != null) {
                payload = currentPayload;
            } else {
                // 从缓存拿并且放到一级缓存
                payload = readWriteCacheMap.get(key);
                readOnlyCacheMap.put(key, payload);
            }
        } else {
            payload = readWriteCacheMap.get(key);
        }
    } catch (Throwable t) {
        logger.error("Cannot get value for key : {}", key, t);
    }
    return payload;
}
```
> Eureka Server 增量服务发现接口

服务端处理请求的方法是com.netflix.eureka.resources.ApplicationsResource#getContainerDifferential，开放的请求url为GET：http://localhost:8761/eureka/apps/delta
跟全量拉取一样从缓存中获取增量的服务信息。

### Eureka Client

> Eureka Clinet 全量拉取服务

```java
// DiscoveryClient#fetchRegistry
private boolean fetchRegistry(boolean forceFullRegistryFetch) {
    Stopwatch tracer = FETCH_REGISTRY_TIMER.start();

    try {
        // If the delta is disabled or if it is the first time, get all
        // applications
        Applications applications = getApplications();

        if (clientConfig.shouldDisableDelta()
                || (!Strings.isNullOrEmpty(clientConfig.getRegistryRefreshSingleVipAddress()))
                || forceFullRegistryFetch
                || (applications == null)
                || (applications.getRegisteredApplications().size() == 0)
                || (applications.getVersion() == -1)) //Client application does not have latest library supporting delta
        {
            logger.info("Disable delta property : {}", clientConfig.shouldDisableDelta());
            logger.info("Single vip registry refresh property : {}", clientConfig.getRegistryRefreshSingleVipAddress());
            logger.info("Force full registry fetch : {}", forceFullRegistryFetch);
            logger.info("Application is null : {}", (applications == null));
            logger.info("Registered Applications size is zero : {}",
                    (applications.getRegisteredApplications().size() == 0));
            logger.info("Application version is -1: {}", (applications.getVersion() == -1));
            getAndStoreFullRegistry();
        } else {
            getAndUpdateDelta(applications);
        }
        applications.setAppsHashCode(applications.getReconcileHashCode());
        logTotalInstances();
    } catch (Throwable e) {
        logger.error(PREFIX + "{} - was unable to refresh its cache! status = {}", appPathIdentifier, e.getMessage(), e);
        return false;
    } finally {
        if (tracer != null) {
            tracer.stop();
        }
    }

    // Notify about cache refresh before updating the instance remote status
    onCacheRefreshed();

    // Update remote status based on refreshed data held in the cache
    updateInstanceRemoteStatus();

    // registry was fetched successfully, so return true
    return true;
}
```
> Eureka Clinet 增量拉取服务

```java
// DiscoveryClient#getAndUpdateDelta
private void getAndUpdateDelta(Applications applications) throws Throwable {
    long currentUpdateGeneration = fetchRegistryGeneration.get();

    Applications delta = null;
    EurekaHttpResponse<Applications> httpResponse = eurekaTransport.queryClient.getDelta(remoteRegionsRef.get());
    if (httpResponse.getStatusCode() == Status.OK.getStatusCode()) {
        delta = httpResponse.getEntity();
    }

    if (delta == null) {
        logger.warn("The server does not allow the delta revision to be applied because it is not safe. "
                + "Hence got the full registry.");
        getAndStoreFullRegistry();
    } else if (fetchRegistryGeneration.compareAndSet(currentUpdateGeneration, currentUpdateGeneration + 1)) {
        logger.debug("Got delta update with apps hashcode {}", delta.getAppsHashCode());
        String reconcileHashCode = "";
        if (fetchRegistryUpdateLock.tryLock()) {
            try {
                updateDelta(delta);
                reconcileHashCode = getReconcileHashCode(applications);
            } finally {
                fetchRegistryUpdateLock.unlock();
            }
        } else {
            logger.warn("Cannot acquire update lock, aborting getAndUpdateDelta");
        }
        // There is a diff in number of instances for some reason
        if (!reconcileHashCode.equals(delta.getAppsHashCode()) || clientConfig.shouldLogDeltaDiff()) {
            reconcileAndLogDifference(delta, reconcileHashCode);  // this makes a remoteCall
        }
    } else {
        logger.warn("Not updating application delta as another thread is updating it already");
        logger.debug("Ignoring delta update with apps hashcode {}, as another thread is updating it already", delta.getAppsHashCode());
    }
}
```
拉取增量注册表的逻辑分为三步：

1. 从 server 拉取的增量注册表为 null，则拉取全量注册表
2. 否则从 server 获取来的增量注册表与本地注册表合并，合并后用全部 application 信息计算出一个 hashCode
3. 将刚刚在本地计算出的 hashCode 与 server 端返回的 hashCode 作对比，不相等的话说明出错了，这时候重新拉取全量注册表

## 服务下线

### Eureka Client 

服务下线有 Eureak Client 发起下线请求，调用 DiscoveryClient 的 shutdown 方法。最终调用 DELETE 请求为：http://localhost:8761/eureka/v2/apps/appID/instanceID

```java
// DiscoveryClient#shutdown()
@PreDestroy
@Override
public synchronized void shutdown() {
    if (isShutdown.compareAndSet(false, true)) {
        logger.info("Shutting down DiscoveryClient ...");

        if (statusChangeListener != null && applicationInfoManager != null) {
            applicationInfoManager.unregisterStatusChangeListener(statusChangeListener.getId());
        }
    	// 关闭定时调度任务
        cancelScheduledTasks();

        // 如果注册到server，通知server下线
        // If APPINFO was registered
        if (applicationInfoManager != null
                && clientConfig.shouldRegisterWithEureka()
                && clientConfig.shouldUnregisterOnShutdown()) {
            applicationInfoManager.setInstanceStatus(InstanceStatus.DOWN);
            unregister();
        }

        if (eurekaTransport != null) {
            eurekaTransport.shutdown();
        }

        heartbeatStalenessMonitor.shutdown();
        registryStalenessMonitor.shutdown();

        Monitors.unregisterObject(this);

        logger.info("Completed shut down of DiscoveryClient");
    }
}
```

被关闭的定时任务包括：心跳续约，定时拉取增量注册表任务等等

```java
private void cancelScheduledTasks() {
    if (instanceInfoReplicator != null) {
        instanceInfoReplicator.stop();
    }
    if (heartbeatExecutor != null) {
        heartbeatExecutor.shutdownNow();
    }
    if (cacheRefreshExecutor != null) {
        cacheRefreshExecutor.shutdownNow();
    }
    if (scheduler != null) {
        scheduler.shutdownNow();
    }
    if (cacheRefreshTask != null) {
        cacheRefreshTask.cancel();
    }
    if (heartbeatTask != null) {
        heartbeatTask.cancel();
    }
}
```
> Eureka 优雅下线


### Eureka Server

Eureka Server 介绍到 client 调用的下线请求后，执行 InstanceResource 的 cancelLease 方法，最后调用 AbstractInstanceRegistry 的 internalCancel 方法。和服务下线的是同一个方法。

- com.netflix.eureka.resources.InstanceResource#cancelLease
   - com.netflix.eureka.registry.PeerAwareInstanceRegistryImpl#cancel
      - com.netflix.eureka.registry.AbstractInstanceRegistry#cancel
         - com.netflix.eureka.registry.AbstractInstanceRegistry#internalCancel

## 自我保护机制

Eureka Server 自我保护机制指的是：在1分钟内发现发现超过 15% 的实例下线，Eureka Server 将不再剔除服务。自我保护机制在服务剔除的时候判断是否触发。

