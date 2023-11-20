---
title: IOC容器初始化-初始化Bean
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---

## 一、前言

初始化完前面的BeanFactory的属性、监听器、事件多播器等等后，接下来就是最重要的一步，初始化用户自定义的Bean。

![](http://image.augsix.com/materials/spring/%E7%AC%AC%E5%85%AD%E7%AF%87Bean%E5%88%9D%E5%A7%8B%E5%8C%96finishBeanFactoryInitialization.png)

## 二、finishBeanFactoryInitialization

```java
// AbstractApplicationContext#finishBeanFactoryInitialization()
protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory beanFactory) {
    // Initialize conversion service for this context.
    if (beanFactory.containsBean(CONVERSION_SERVICE_BEAN_NAME) &&
        beanFactory.isTypeMatch(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class)) {
    beanFactory.setConversionService(
        beanFactory.getBean(CONVERSION_SERVICE_BEAN_NAME, ConversionService.class));
    }
    
    // Register a default embedded value resolver if no BeanFactoryPostProcessor
    // (such as a PropertySourcesPlaceholderConfigurer bean) registered any before:
    // at this point, primarily for resolution in annotation attribute values.
    if (!beanFactory.hasEmbeddedValueResolver()) {
        beanFactory.addEmbeddedValueResolver(strVal -> getEnvironment().resolvePlaceholders(strVal));
    }
    
    // Initialize LoadTimeWeaverAware beans early to allow for registering their transformers early.
    String[] weaverAwareNames = beanFactory.getBeanNamesForType(LoadTimeWeaverAware.class, false, false);
    for (String weaverAwareName : weaverAwareNames) {
        getBean(weaverAwareName);
    }
    
    // Stop using the temporary ClassLoader for type matching.
    // 停止使用临时的类加载器
    beanFactory.setTempClassLoader(null);
    
    // Allow for caching all bean definition metadata, not expecting further changes.
    // 缓存（冻结）所有的 bean definition 数据，不期望以后会改变
    beanFactory.freezeConfiguration();
    
    // Instantiate all remaining (non-lazy-init) singletons.
    // 开始初始化bean(不包括懒加载bean)
    beanFactory.preInstantiateSingletons();
}
```

## 三、preInstantiateSingletons

```java
// DefaultListableBeanFactory.class
@Override
public void preInstantiateSingletons() throws BeansException {
    if (logger.isTraceEnabled()) {
        logger.trace("Pre-instantiating singletons in " + this);
    }

    // Iterate over a copy to allow for init methods which in turn register new bean definitions.
    // While this may not be part of the regular factory bootstrap, it does otherwise work fine.
    List<String> beanNames = new ArrayList<>(this.beanDefinitionNames);

    // Trigger initialization of all non-lazy singleton beans...
    for (String beanName : beanNames) {
        RootBeanDefinition bd = getMergedLocalBeanDefinition(beanName);
        // 非抽象、非懒加载的 singletons。如果配置了 'abstract = true'，那是不需要实例化的
        if (!bd.isAbstract() && bd.isSingleton() && !bd.isLazyInit()) {
            // FactoryBean 的话，在 beanName 前面加上 ‘&’ 符号。再调用 getBean
            // FactoryBean在开发中用的并不多，但是mybatis就是通过FactoryBean来注入的
            // 对于普通的 Bean，执行的是下面的else分支，调用getBean方法
            if (isFactoryBean(beanName)) {
                // FactoryBean 需要添加前缀 & ,通过 getBean(&beanName) 获取的是 FactoryBean 本身
                Object bean = getBean(FACTORY_BEAN_PREFIX + beanName);
                if (bean instanceof FactoryBean) {
                    FactoryBean<?> factory = (FactoryBean<?>) bean;
                    boolean isEagerInit;
                    if (System.getSecurityManager() != null && factory instanceof SmartFactoryBean) {
                        isEagerInit = AccessController.doPrivileged(
                                (PrivilegedAction<Boolean>) ((SmartFactoryBean<?>) factory)::isEagerInit,
                                getAccessControlContext());
                    }
                    else {
                        isEagerInit = (factory instanceof SmartFactoryBean &&
                                ((SmartFactoryBean<?>) factory).isEagerInit());
                    }
                    if (isEagerInit) {
                        getBean(beanName);
                    }
                }
            }
            else {
                getBean(beanName);
            }
        }
    }

    // Trigger post-initialization callback for all applicable beans...
    // 这边是实例化SmartInitializingSingleton类型的bean
    for (String beanName : beanNames) {
        Object singletonInstance = getSingleton(beanName);
        if (singletonInstance instanceof SmartInitializingSingleton) {
            StartupStep smartInitialize = this.getApplicationStartup().start("spring.beans.smart-initialize")
                    .tag("beanName", beanName);
            SmartInitializingSingleton smartSingleton = (SmartInitializingSingleton) singletonInstance;
            if (System.getSecurityManager() != null) {
                AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
                    smartSingleton.afterSingletonsInstantiated();
                    return null;
                }, getAccessControlContext());
            }
            else {
                smartSingleton.afterSingletonsInstantiated();
            }
            smartInitialize.end();
        }
    }
}
```

## 四、getBean

```java
// AbstractBeanFactory
public <T> T getBean(String name, @Nullable Class<T> requiredType, @Nullable Object... args)
    throws BeansException {

	return doGetBean(name, requiredType, args, false);
}
```
```java
// doGetBean
protected <T> T doGetBean(
        String name, @Nullable Class<T> requiredType, @Nullable Object[] args, boolean typeCheckOnly)
        throws BeansException {

    //通过三种形式获取beanName
    //一个是原始的beanName，一个是加了&的，一个是别名
    String beanName = transformedBeanName(name);
    Object beanInstance;

    // Eagerly check singleton cache for manually registered singletons.
    // 先从缓存中尝试获取bean,这里会涉及到解决循环依赖 bean 的问题
    Object sharedInstance = getSingleton(beanName);
    if (sharedInstance != null && args == null) {
        if (logger.isTraceEnabled()) {
            if (isSingletonCurrentlyInCreation(beanName)) {
                logger.trace("Returning eagerly cached instance of singleton bean '" + beanName +
                        "' that is not fully initialized yet - a consequence of a circular reference");
            }
            else {
                logger.trace("Returning cached instance of singleton bean '" + beanName + "'");
            }
        }
        //如果是普通bean，直接返回，如果是FactoryBean，则返回它的getObject
        beanInstance = getObjectForBeanInstance(sharedInstance, name, beanName, null);
    }

    else {
        // 缓存中没有获取到Bean，开始创建
        // Fail if we're already creating this bean instance:
        // We're assumably within a circular reference.
        // 防止bean有多个容器在创建
        if (isPrototypeCurrentlyInCreation(beanName)) {
            throw new BeanCurrentlyInCreationException(beanName);
        }

        // Check if bean definition exists in this factory.
        // 如果父容器有bean就从父容器中获取
        BeanFactory parentBeanFactory = getParentBeanFactory();
        if (parentBeanFactory != null && !containsBeanDefinition(beanName)) {
            // Not found -> check parent.
            String nameToLookup = originalBeanName(name);
            if (parentBeanFactory instanceof AbstractBeanFactory) {
                return ((AbstractBeanFactory) parentBeanFactory).doGetBean(
                        nameToLookup, requiredType, args, typeCheckOnly);
            }
            else if (args != null) {
                // Delegation to parent with explicit args.
                return (T) parentBeanFactory.getBean(nameToLookup, args);
            }
            else if (requiredType != null) {
                // No args -> delegate to standard getBean method.
                return parentBeanFactory.getBean(nameToLookup, requiredType);
            }
            else {
                return (T) parentBeanFactory.getBean(nameToLookup);
            }
        }

        // typeCheckOnly是用来判断调用getBean()是否仅仅是为了类型检查获取bean，而不是为了创建Bean
        if (!typeCheckOnly) {
            markBeanAsCreated(beanName);
        }

        StartupStep beanCreation = this.applicationStartup.start("spring.beans.instantiate")
                .tag("beanName", name);
        try {
            if (requiredType != null) {
                beanCreation.tag("beanType", requiredType::toString);
            }
            // 将父类的BeanDefinition与子类的BeanDefinition进行合并覆盖
            RootBeanDefinition mbd = getMergedLocalBeanDefinition(beanName);
            // 对合并的BeanDefinition做验证，主要看属性是否为abstract的
            checkMergedBeanDefinition(mbd, beanName, args);

            // Guarantee initialization of beans that the current bean depends on.
            // 这里很重要，因为 Bean 实例化会有属性注入等，所以这里就是要保证它依赖的那些属性先初始化
            // 这部分是处理循环依赖的核心，@DependsOn 注解可以控制 Bean 的初始化顺序
            String[] dependsOn = mbd.getDependsOn();
            if (dependsOn != null) {
                for (String dep : dependsOn) {
                    if (isDependent(beanName, dep)) {
                        throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                                "Circular depends-on relationship between '" + beanName + "' and '" + dep + "'");
                    }
                    registerDependentBean(dep, beanName);
                    try {
                        getBean(dep);
                    }
                    catch (NoSuchBeanDefinitionException ex) {
                        throw new BeanCreationException(mbd.getResourceDescription(), beanName,
                                "'" + beanName + "' depends on missing bean '" + dep + "'", ex);
                    }
                }
            }

            // Create bean instance.
            // 从这里开始，就正式着手创建这个 Bean 实例
            // 创建单例Bean
            if (mbd.isSingleton()) {
                // 尝试从缓存中加载单例 Bean，获取失败就通过 ObjectFactory 的 createBean 方法创建
                // 这个 getSingleton 方法和上面是重载方法，它支持通过 ObjectFactory 去根据 Scope 来创建对象，具体源码解析见下面
                sharedInstance = getSingleton(beanName, () -> {
                    try {
                        // 这是创建 Bean 的核心方法，非常重要
                        return createBean(beanName, mbd, args);
                    }
                    catch (BeansException ex) {
                        // Explicitly remove instance from singleton cache: It might have been put there
                        // eagerly by the creation process, to allow for circular reference resolution.
                        // Also remove any beans that received a temporary reference to the bean.
                        // 执行失败，就销毁 Bean。然后执行对应的 destroy 方法等
                        destroySingleton(beanName);
                        throw ex;
                    }
                });
                beanInstance = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
            }
            // 创建原型Bean
            else if (mbd.isPrototype()) {
                // It's a prototype -> create a new instance.
                Object prototypeInstance = null;
                try {
                    // 原型 Bean 创建的前置处理，记录当前 Bean 处于正在创建的状态
                    beforePrototypeCreation(beanName);
                    prototypeInstance = createBean(beanName, mbd, args);
                }
                finally {
                    afterPrototypeCreation(beanName);
                }
                beanInstance = getObjectForBeanInstance(prototypeInstance, name, beanName, mbd);
            }

            else {
                // 创建其他类型的Bean
                String scopeName = mbd.getScope();
                if (!StringUtils.hasLength(scopeName)) {
                    throw new IllegalStateException("No scope name defined for bean '" + beanName + "'");
                }
                Scope scope = this.scopes.get(scopeName);
                if (scope == null) {
                    throw new IllegalStateException("No Scope registered for scope name '" + scopeName + "'");
                }
                try {
                    Object scopedInstance = scope.get(beanName, () -> {
                        beforePrototypeCreation(beanName);
                        try {
                            return createBean(beanName, mbd, args);
                        }
                        finally {
                            afterPrototypeCreation(beanName);
                        }
                    });
                    beanInstance = getObjectForBeanInstance(scopedInstance, name, beanName, mbd);
                }
                catch (IllegalStateException ex) {
                    throw new ScopeNotActiveException(beanName, scopeName, ex);
                }
            }
        }
        catch (BeansException ex) {
            beanCreation.tag("exception", ex.getClass().toString());
            beanCreation.tag("message", String.valueOf(ex.getMessage()));
            cleanupAfterBeanCreationFailure(beanName);
            throw ex;
        }
        finally {
            beanCreation.end();
        }
    }
    // 检查所需的类型是否与实际bean实例的类型匹配
    return adaptBeanInstance(name, beanInstance, requiredType);
}
```

上面代码比较长，基本上步骤已经添加相应的注释，基本上可以分为三步：

1. 从缓存中获取到 Bean，创建对应的 Bean；
2. 从缓存中没有获取到 Bean，创建对应的 Bean；
3. 检查所需的类型是否与实际bean实例的类型匹配。

这就是Bean初始化的大致过程。后面再详细介绍bena的创建细节。
