---
title: IOC容器启动概览
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---

<a name="L7uCa"></a>
# 第二篇：IOC容器启动概览
<a name="atwwh"></a>
## 一、前言
一般我们使用`Spring`的时候，一般都是使用`AnnotationConfigApplicationContext`注解方式或`ClassPathXmlApplicationContext`来创建`IOC`容器的（本次主要以注解的方式来分析`Spring`源码）。
```java
// 注解方式
AnnotationConfigApplicationContext applicationContext = new AnnotationConfigApplicationContext(AppConfig.class);
// xml配置文件方式
ClassPathXmlApplicationContext xmlApplicationContext = new ClassPathXmlApplicationContext("applicationContext.xml");

```
<a name="YDdzp"></a>
## 二、IOC启动过程
```java
// AnnotationConfigApplicationContext.class
public class AnnotationConfigApplicationContext extends GenericApplicationContext implements AnnotationConfigRegistry {
    
	public AnnotationConfigApplicationContext(Class<?>... componentClasses) {
         // 调用自身无参构造，主要注册后置处理器
		this();
         // 扫描注册配置类bean
		register(componentClasses);
         // 刷新容器
		refresh();
	}    
}
```
`AnnotationConfigApplicationContext(xxx)`就3行代码，主要功能分别是

1. 注册常用注解后置处理器
2. 注册配置类bean
3. 刷新容器
<a name="z63Hy"></a>
## 三、注册后置处理器
```java
// AnnotationConfigApplicationContext.class
public AnnotationConfigApplicationContext() {
     // 记录特定阶段或动作的指标 无需注意
    StartupStep createAnnotatedBeanDefReader = this.getApplicationStartup().start("spring.context.annotated-bean-reader.create");
     // 注册Spring内部一些处理器的BeanDefinition注册，主要是spring注解的后置处理器
     // 比如@Configuration、@Autowired、 @Required、事件监听器等后置处理器
    this.reader = new AnnotatedBeanDefinitionReader(this);
    createAnnotatedBeanDefReader.end();
     // 创建BeanDefinition扫描器，用来扫描@Component并转换成BeanDefinition
    this.scanner = new ClassPathBeanDefinitionScanner(this);
    
     // AnnotatedBeanDefinitionReader是基于配置类的注解注册BeanDefinition
     // 例如：new AnnotationConfigApplicationContext(MyConfig.class);
    
     // ClassPathBeanDefinitionScanner是基于包路径扫描BeanDefinition
     // 例如：new AnnotationConfigApplicationContext("xxx.xxx.xxx");
        
}
```
<a name="dDpmj"></a>
### AnnotatedBeanDefinitionReader
`AnnotatedBeanDefinitionReader`的作用是注册`Spring`配置注解后置处理器,将这些后置处理器注册成`BeanDefinition`
```java
// AnnotatedBeanDefinitionReader.class
public AnnotatedBeanDefinitionReader(BeanDefinitionRegistry registry, Environment environment) {
    Assert.notNull(registry, "BeanDefinitionRegistry must not be null");
    Assert.notNull(environment, "Environment must not be null");
    this.registry = registry;
    this.conditionEvaluator = new ConditionEvaluator(registry, environment, null);
    // 注册后置处理器
    AnnotationConfigUtils.registerAnnotationConfigProcessors(this.registry);
}

public static Set<BeanDefinitionHolder> registerAnnotationConfigProcessors(
        BeanDefinitionRegistry registry, @Nullable Object source) {

    DefaultListableBeanFactory beanFactory = unwrapDefaultListableBeanFactory(registry);
    if (beanFactory != null) {
        if (!(beanFactory.getDependencyComparator() instanceof AnnotationAwareOrderComparator)) {
            beanFactory.setDependencyComparator(AnnotationAwareOrderComparator.INSTANCE);
        }
        if (!(beanFactory.getAutowireCandidateResolver() instanceof ContextAnnotationAutowireCandidateResolver)) {
            beanFactory.setAutowireCandidateResolver(new ContextAnnotationAutowireCandidateResolver());
        }
    }

    Set<BeanDefinitionHolder> beanDefs = new LinkedHashSet<>(8);

    if (!registry.containsBeanDefinition(CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition(ConfigurationClassPostProcessor.class);
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, CONFIGURATION_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(AUTOWIRED_ANNOTATION_PROCESSOR_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition(AutowiredAnnotationBeanPostProcessor.class);
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, AUTOWIRED_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    // Check for JSR-250 support, and if present add the CommonAnnotationBeanPostProcessor.
    if (jsr250Present && !registry.containsBeanDefinition(COMMON_ANNOTATION_PROCESSOR_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition(CommonAnnotationBeanPostProcessor.class);
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, COMMON_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    // Check for JPA support, and if present add the PersistenceAnnotationBeanPostProcessor.
    if (jpaPresent && !registry.containsBeanDefinition(PERSISTENCE_ANNOTATION_PROCESSOR_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition();
        try {
            def.setBeanClass(ClassUtils.forName(PERSISTENCE_ANNOTATION_PROCESSOR_CLASS_NAME,
                    AnnotationConfigUtils.class.getClassLoader()));
        }
        catch (ClassNotFoundException ex) {
            throw new IllegalStateException(
                    "Cannot load optional framework class: " + PERSISTENCE_ANNOTATION_PROCESSOR_CLASS_NAME, ex);
        }
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, PERSISTENCE_ANNOTATION_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(EVENT_LISTENER_PROCESSOR_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition(EventListenerMethodProcessor.class);
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, EVENT_LISTENER_PROCESSOR_BEAN_NAME));
    }

    if (!registry.containsBeanDefinition(EVENT_LISTENER_FACTORY_BEAN_NAME)) {
        RootBeanDefinition def = new RootBeanDefinition(DefaultEventListenerFactory.class);
        def.setSource(source);
        beanDefs.add(registerPostProcessor(registry, def, EVENT_LISTENER_FACTORY_BEAN_NAME));
    }

    return beanDefs;
}
```
上面注册的后置处理器会处理响应的注解，比如：

- `ConfigurationClassPostProcessor`处理`@Configuration`、`@Component`、`@ComponentScan`、`@Import`、`@ImportResource`或者`@Bean`注解的
- `AutowiredAnnotationBeanPostProcessor`处理`@Autowired`、`@Value`、`@Inject`
- `CommonAnnotationBeanPostProcessor`处理`@PostConstruct`、`@PreDestroy`、`@Resource`、`@WebServiceRef`、`@EJB`
- `PersistenceAnnotationBeanPostProcessor`处理`@PersistenceUnit`、`@PersistenceContext`
- `EventListenerMethodProcessor`和`@DefaultEventListenerFactory`处理`@EventListener`
<a name="xumpf"></a>
### ClassPathBeanDefinitionScanner
`ClassPathBeanDefinitionScanner`用于扫描指定包下带`@component`注解的类，包括`@Repository`、`@Service`、`@Controller`。将这些类注册成`BeanDefinition`
<a name="t9lFl"></a>
## 四、注册配置类bean
```java
// AnnotationConfigApplicationContext.class
public void  register(Class<?>... componentClasses) {
    Assert.notEmpty(componentClasses, "At least one component class must be specified");
    StartupStep registerComponentClass = this.getApplicationStartup().start("spring.context.component-classes.register")
            .tag("classes", () -> Arrays.toString(componentClasses));
    // 注册配置类bean
    this.reader.register(componentClasses);
    registerComponentClass.end();
}
```
这一步还是将自己定义配置类注册成`BeanDefinition`,在后面由`ConfigurationClassPostProcessor`来处理
<a name="X0CYX"></a>
## 五、刷新容器
![第二篇refresh流程%202[1].png](https://cdn.nlark.com/yuque/0/2023/png/8423455/1676864181794-f567f2dd-4a32-4b12-9581-98662eb7aae8.png#averageHue=%2399be84&clientId=u90f307a2-f8d5-4&from=ui&id=u5a5c3141&originHeight=711&originWidth=798&originalType=binary&ratio=1&rotation=0&showTitle=false&size=430258&status=done&style=shadow&taskId=ub4b0541b-d7ca-48e6-92b6-678932c2a7b&title=)<br />在做完容器的前期必须的条件加载之后就开始初始化容器了，也就是调用容器的刷新方法。
```java
public void refresh() throws BeansException, IllegalStateException {
    synchronized (this.startupShutdownMonitor) {
        StartupStep contextRefresh = this.applicationStartup.start("spring.context.refresh");

        // Prepare this context for refreshing.
        // 容器创建前准备
        // 1、是设置容器的激活状态，
        // 2、初始化PropertySource，
        // 3、校验必须的Property
        // 4、初始化earlyApplicationListeners；
        prepareRefresh();

        // Tell the subclass to refresh the internal bean factory.
        // beanFactory实例化，这里子类AbstractRefreshableApplicationContext会把xml文件里面的bean对象的信息加载成BeanDefinition
        // 并且把BeanDefinition放入beanDefinitionMap中
        // 注意：当前阶段bean对象还没有实例化
        ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

        // Prepare the bean factory for use in this context.
        // 对beanFactory做一些配置
        // 为beanFactory创建类加载器、必要的Processor、上下文环境等
        prepareBeanFactory(beanFactory);

        try {
            // Allows post-processing of the bean factory in context subclasses.
            // 留给子类实现的接口，提供beanFactory容器实例化后，初始化化前扩展功能
            // web类型的上下文会注册一些web相关的bean
            postProcessBeanFactory(beanFactory);

            StartupStep beanPostProcess = this.applicationStartup.start("spring.context.beans.post-process");

            // Invoke factory processors registered as beans in the context.
            //实例化并调用所有注册的beanFactory后置处理器（实现接口BeanFactoryPostProcessor的bean）。
            //在beanFactory标准初始化之后执行  例如：PropertyPlaceholderConfigurer(处理占位符)
            invokeBeanFactoryPostProcessors(beanFactory);

            // Register bean processors that intercept bean creation.
            // 实例化和注册beanFactory中扩展了BeanPostProcessor的bean。
            // 例如：
            // AutowiredAnnotationBeanPostProcessor(处理被@Autowired注解修饰的bean并注入)
            // RequiredAnnotationBeanPostProcessor(处理被@Required注解修饰的方法)
            // CommonAnnotationBeanPostProcessor(处理@PreDestroy、@PostConstruct、@Resource等多个注解的作用)等。
            registerBeanPostProcessors(beanFactory);
            beanPostProcess.end();

            // Initialize message source for this context.
            // 初始化国际化工具类MessageSource
            initMessageSource();

            // Initialize event multicaster for this context.
            // 初始化事件派发器
            initApplicationEventMulticaster();

            // Initialize other special beans in specific context subclasses.
            // 模板方法，在容器刷新的时候可以自定义逻辑（子类自己去实现逻辑），如springBoot创建Tomcat，Jetty等WEB服务器
            onRefresh();

            // Check for listener beans and register them.
            // 注册监听器(就是注册实现了ApplicationListener接口的监听器bean，这些监听器是注册到ApplicationEventMulticaster中的)，
            registerListeners();

            // Instantiate all remaining (non-lazy-init) singletons.
            // 实例化所有剩余的（非懒加载）单例Bean。（也就是我们自己定义的那些Bean们）
            // 比如invokeBeanFactoryPostProcessors方法中根据各种注解解析出来的类，在这个时候都会被初始化  扫描的 @Bean之类的
            // 实例化的过程各种BeanPostProcessor开始起作用~~~~~~~~~~~~~~
            finishBeanFactoryInitialization(beanFactory);

            // Last step: publish corresponding event.
            // refresh做完之后需要做的其他事情
            // 清除上下文资源缓存（如扫描中的ASM元数据）
            // 初始化上下文的生命周期处理器，并刷新（找出Spring容器中实现了Lifecycle接口的bean并执行start()方法）。
            // 发布ContextRefreshedEvent事件告知对应的ApplicationListener进行响应的操作
            finishRefresh();
        }

        catch (BeansException ex) {
            if (logger.isWarnEnabled()) {
                logger.warn("Exception encountered during context initialization - " +
                        "cancelling refresh attempt: " + ex);
            }

            // Destroy already created singletons to avoid dangling resources.
            // 如果刷新失败那么就会将已经创建好的单例Bean销毁掉
            destroyBeans();

            // Reset 'active' flag.
            // 重置context的活动状态 告知是失败的
            cancelRefresh(ex);

            // Propagate exception to caller.
            throw ex;
        }

        finally {
            // Reset common introspection caches in Spring's core, since we
            // might not ever need metadata for singleton beans anymore...
            // 失败与否，都会重置Spring内核的缓存。因为可能不再需要metadata给单例Bean了
            resetCommonCaches();
            contextRefresh.end();
        }
    }
}
```
