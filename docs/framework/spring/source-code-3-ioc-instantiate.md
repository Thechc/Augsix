---
title: IOC容器实例化
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---

## 一、前言

在容器正式刷新前，需要对容器进行一些前期处理，我理解为容器的实例化阶段。

![](http://image.augsix.com/materials/spring/%E7%AC%AC%E4%B8%89%E7%AF%87refresh%E6%B5%81%E7%A8%8B-%E5%AE%B9%E5%99%A8%E5%AE%9E%E4%BE%8B%E5%8C%96.drawio.png)

## 二、容器创建前准备-prepareRefresh

Spring在初始化Spring容器前会先初始化一些配置及属性。主要做了一下4个事情：

1. 设置容器标志位，表示当前容器处于激活状态
2. 回调初始化initPropertySources方法，初始化PropertySource，用于子类实现并扩充功能
3. 校验环境中必须的参数
4. 初始化earlyApplicationListeners与earlyApplicationEvents

```java
// AbstractApplicationContext#prepareRefresh
protected void prepareRefresh() {
    // Switch to active.
    this.startupDate = System.currentTimeMillis();
    // 1、设置标志位，表示当前容器处于激活状态
    this.closed.set(false);
    this.active.set(true);

    if (logger.isDebugEnabled()) {
        if (logger.isTraceEnabled()) {
        	logger.trace("Refreshing " + this);
        }
        else {
        	logger.debug("Refreshing " + getDisplayName());
        }
    }

    // Initialize any placeholder property sources in the context environment.
    // 2、回调初始化initPropertySources方法，初始化PropertySource，用于子类实现并扩充功能
    initPropertySources();

    // Validate that all properties marked as required are resolvable:
    // see ConfigurablePropertyResolver#setRequiredProperties
    // 3、校验环境中必须的参数
    getEnvironment().validateRequiredProperties();

    // Store pre-refresh ApplicationListeners...
    // 4、初始化earlyApplicationListeners与earlyApplicationEvents
    if (this.earlyApplicationListeners == null) {
        this.earlyApplicationListeners = new LinkedHashSet<>(this.applicationListeners);
    }
    else {
        // Reset local application listeners to pre-refresh state.
        this.applicationListeners.clear();
        this.applicationListeners.addAll(this.earlyApplicationListeners);
    }

    // Allow for the collection of early ApplicationEvents,
    // to be published once the multicaster is available...
    this.earlyApplicationEvents = new LinkedHashSet<>();
}
```

### 设置标志位

```java
// 将容器关闭标志位设置为关闭
this.closed.set(false);
// 将容器开启标志位设置为开启
this.active.set(true);


// 那么设置标志位的用途是什么呢？在getBean方法中会判断当前容器的标志位状态，
// 容器处于关闭或者未刷新的时候会抛异常
@Override
public Object getBean(String name) throws BeansException {
    // getBean前校验容器当前状态
    assertBeanFactoryActive();
    return getBeanFactory().getBean(name);
}

protected void assertBeanFactoryActive() {
    if (!this.active.get()) {
        // 当前容器关闭标志位为开启的话，说明容器已经关闭，无法getBean
        if (this.closed.get()) {
            throw new IllegalStateException(getDisplayName() + " has been closed already");
        }
        // 如果开启标志位为关闭，关闭标志位为开启。 说明当前容器还没有刷新
        else {
            throw new IllegalStateException(getDisplayName() + " has not been refreshed yet");
        }
    }
}
```

### 初始化PropertySource

`initPropertySources`是留给子类实现扩展的方法，在web类型的`ApplicationContext`中都会去重写此方法。在初始化前向容器中内注入`servletContextInitParams`和`servletConfigInitParams`相关的属性。另外与`getEnvironment().validateRequiredProperties()`合用可扩展在容器启动时校验必须参数

```java
// AbstractRefreshableWebApplicationContext.class、GenericWebApplicationContext.class
@Override
protected void initPropertySources() {
    ConfigurableEnvironment env = getEnvironment();
    if (env instanceof ConfigurableWebEnvironment) {
        ((ConfigurableWebEnvironment) env).initPropertySources(this.servletContext, this.servletConfig);
    }
}

// 最终调用
public static void initServletPropertySources(MutablePropertySources sources,
                                              @Nullable ServletContext servletContext, @Nullable ServletConfig servletConfig) {

    Assert.notNull(sources, "'propertySources' must not be null");
    String name = StandardServletEnvironment.SERVLET_CONTEXT_PROPERTY_SOURCE_NAME;// servletContextInitParams
    if (servletContext != null && sources.get(name) instanceof StubPropertySource) {
        sources.replace(name, new ServletContextPropertySource(name, servletContext));
    }
    name = StandardServletEnvironment.SERVLET_CONFIG_PROPERTY_SOURCE_NAME; // servletConfigInitParams
    if (servletConfig != null && sources.get(name) instanceof StubPropertySource) {
        sources.replace(name, new ServletConfigPropertySource(name, servletConfig));
    }
}
```

### 校验必须参数

`getEnvironment().validateRequiredProperties()`用来校验当前容器是否有指定的参数

案例: [https://blog.csdn.net/luzhensmart/article/details/118187033](https://blog.csdn.net/luzhensmart/article/details/118187033)

### 初始化earlyApplicationListeners与earlyApplicationEvents

`earlyApplicationListeners`的本质还是`ApplicationListener`，那它名称中的early是什么意思呢？

`Spring`单例`Bean`的实例化是在`Refresh`阶段实例化的，那么用户自定义的一些`ApplicationListener`组件自然也是在这个阶段才初始化，但是`Spring`容器启动过程中，在`Refresh`完成之前还有很多事件：如`Spring`上下文环境准备等事件，这些事件又是`Spring`容器启动必须要监听的。所以`Spring`定义了一个`earlyApplicationListeners`集合，这个集合中的`Listener`在`factories`文件中定义好，在容器`Refresh`之前预先实例化好，然后就可以监听Spring容器启动过程中的所有事件。

## 三、获取容器-obtainFreshBeanFactory

做完前期准备后`Spring`就正式开始实例化容器了。容器会调用`refreshBeanFactory`来创建容器对象。但是这个方法有不同的容器类型自己去实现。
```java
// AbstractApplicationContext.class
ConfigurableListableBeanFactory beanFactory = obtainFreshBeanFactory();

protected ConfigurableListableBeanFactory obtainFreshBeanFactory() {
    // 刷新容器，由子类实现。
    // Refreshable类型会刷新重置容器，Generic类型的容器不会刷新容器
    refreshBeanFactory();
    return getBeanFactory();
}
```
`Spring`的容器分为`Refreshable`和`Generic`类型，而`AnnotationConfigApplicationContext`属于Generic类型的容器，它是不会去重新刷新容器的。这里利用CAS来检验容器是否改变过。
```java
// GenericApplicationContext
protected final void refreshBeanFactory() throws IllegalStateException {
    if (!this.refreshed.compareAndSet(false, true)) {
        throw new IllegalStateException(
                "GenericApplicationContext does not support multiple refresh attempts: just call 'refresh' once");
    }
    this.beanFactory.setSerializationId(getId());
}
```
再来看一下另外一种Refreshable类型的容器，最常用的就是`ClassPathXmlApplicationContext`容器。
```java
// AbstractRefreshableApplicationContext.class
protected final void refreshBeanFactory() throws BeansException {

		// 如果当前存在beanFactory清空所有的单例bean缓存依赖
		// 并将当前的beanFactory赋值为null
		if (hasBeanFactory()) {
			destroyBeans();
			closeBeanFactory();
		}
		try {
			// 重新初始化beanFactory
			DefaultListableBeanFactory beanFactory = createBeanFactory();
			beanFactory.setSerializationId(getId());

			// customizeBeanFactory 允许子类拓展接口
			//1. 是否允许覆盖同名称的不同定义的对象
			//2. 是否允许bean之间存在循环依赖
			customizeBeanFactory(beanFactory);
			// 加载beanDefinition到beanFactory
			loadBeanDefinitions(beanFactory);
			this.beanFactory = beanFactory;
		}
		catch (IOException ex) {
			throw new ApplicationContextException("I/O error parsing bean definition source for " + getDisplayName(), ex);
		}
	}
```

其中`loadBeanDefinitions()`是从xml解析配置文件中的`Bean`对象并注册成`BeanDefinition`。
> 所以Generic类型容器把Bean对象转换为BeanDefinition的时机是在refresh方法执行之前通过ClassPathBeanDefinitionScanner扫描指定包下的相关注解注册BeanDefinition。
> 而Refreshable类型容器是在refresh方式执行中时容器通过重写refreshBeanFactory方法来解析xml配置文件中的Bean，并注册成BeanDefinition。








