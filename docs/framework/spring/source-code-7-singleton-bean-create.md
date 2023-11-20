---
title: IOC容器初始化-单例Bean的创建
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---

## 一、前言

在学习Bean初始化的时候有这样一段代码：

![](http://image.augsix.com/materials/spring/%E7%AC%AC%E4%B8%83%E7%AF%87%E5%8D%95%E4%BE%8BBean%E5%88%9B%E5%BB%BA%E5%85%A5%E5%8F%A3.png)

这部分展示单例Bean创建大致由三部分组成：

1. createBean
2. getSingleton
3. getObjectForBeanInstance

## 二、createBean创建Bean对象工厂

```java

@Override
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args)
        throws BeanCreationException {

    if (logger.isTraceEnabled()) {
        logger.trace("Creating instance of bean '" + beanName + "'");
    }
    RootBeanDefinition mbdToUse = mbd;

    // Make sure bean class is actually resolved at this point, and
    // clone the bean definition in case of a dynamically resolved Class
    // which cannot be stored in the shared merged bean definition.
    // 确保对应 BeanClass 完成解析(已经加载进来了 Class 对象)具体表现是进行了 ClassLoder.loadClass 或 Class.forName 完成了类加载
    // 主要根据传入的 typesToMatch 生成特定 的ClassLoader，之后还要调用 RootBeanDefinition#resolveBeanClass，
    // 根据特定的加载器或者默认加载器加载出 class 属性对应的 Class 对象
    Class<?> resolvedClass = resolveBeanClass(mbd, beanName);
    if (resolvedClass != null && !mbd.hasBeanClass() && mbd.getBeanClassName() != null) {
        mbdToUse = new RootBeanDefinition(mbd);
        mbdToUse.setBeanClass(resolvedClass);
    }

    // Prepare method overrides.
    try {
        // 这里主要是解析 <lookup-method name="getFruit" bean="bananer"/>
        // 类似这种方式的依赖注入（Spring 支持 lookup-method，replace-method 两个依赖注入的方式）
        // 它相当于调用指定类里面的指定方法进行注入，所以需要考虑到方法重载的情况，因此这个方法解析的就是这种情况
        // 项目中一般这么使用，非常的不大众，具体原理此处省略
        mbdToUse.prepareMethodOverrides();
    }
    catch (BeanDefinitionValidationException ex) {
        throw new BeanDefinitionStoreException(mbdToUse.getResourceDescription(),
                beanName, "Validation of method overrides failed", ex);
    }

    try {
        // Give BeanPostProcessors a chance to return a proxy instead of the target bean instance.
        // 从 doc 解释：给 BeanPostProcessors 一个机会来返回一个代理对象代替目标对象，什么动态代理之类的，都在这里实现的
        // 1、判断当前 Spring 容器是否注册了实现了 InstantiationAwareBeanPostProcessor 接口的后置处理器，
        // 如果有，则依次调用其中的 applyBeanPostProcessorsBeforeInstantiation 方法，中间任意一个方法返回不为 null，直接结束调用
        // 2、依次调用所有的 BeanPostProcessor#postProcessAfterInitialization 方法（如果任意一次返回不为 null，终止调用）
        // 这个方法也非常的重要
        // 容器里所有的 InstantiationAwareBeanPostProcessors 实例，都会在此处生效，进行前置处理
        // 下面有解释：BeanPostProcessor 和 InstantiationAwareBeanPostProcessor 的区别，可以分清楚它们执行的时机
        Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
        // 如果不为空，说明提前生成了实例，直接返回
        if (bean != null) {
            return bean;
        }
    }
    catch (Throwable ex) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName,
                "BeanPostProcessor before instantiation of bean failed", ex);
    }

    try {
        // 这里是重点：doCreateBean 创建 Bean
        Object beanInstance = doCreateBean(beanName, mbdToUse, args);
        if (logger.isTraceEnabled()) {
            logger.trace("Finished creating instance of bean '" + beanName + "'");
        }
        return beanInstance;
    }
    catch (BeanCreationException | ImplicitlyAppearedSingletonException ex) {
        // A previously detected exception with proper bean creation context already,
        // or illegal singleton state to be communicated up to DefaultSingletonBeanRegistry.
        throw ex;
    }
    catch (Throwable ex) {
        throw new BeanCreationException(
                mbdToUse.getResourceDescription(), beanName, "Unexpected exception during bean creation", ex);
    }
}
```

### doCreateBean

```java
protected Object doCreateBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args)
			throws BeanCreationException {

		// bean的创建：实例化 -> 初始化
		// Instantiate the bean.
		// 1.开始实例化
		// 用 BeanWrapper 来持有创建出来的 Bean 对象
		BeanWrapper instanceWrapper = null;
		// 如果是单例的话，先把缓存中的同名 Bean 清除
		if (mbd.isSingleton()) {
			instanceWrapper = this.factoryBeanInstanceCache.remove(beanName);
		}
		if (instanceWrapper == null) {
			instanceWrapper = createBeanInstance(beanName, mbd, args);
		}
		Object bean = instanceWrapper.getWrappedInstance();
		Class<?> beanType = instanceWrapper.getWrappedClass();
		if (beanType != NullBean.class) {
			mbd.resolvedTargetType = beanType;
		}
		// bean实例化完成

		// Allow post-processors to modify the merged bean definition.
		// 允许后置处理器修改合并后的beanDefinition做一些修改(扩展点,一般不会用到)
		// 此处处理 MergedBeanDefinitionPostProcessor 接口的处理器，
		// 它在 BeanPostProcessor 的基础上增加了 postProcessMergedBeanDefinition 方法，在此处就被调用了
		// 主要是处理 @PostConstruct、@Autowire、@Value、@Resource、@PreDestory 等这些注解
		synchronized (mbd.postProcessingLock) {
			if (!mbd.postProcessed) {
				try {
					applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);
				}
				catch (Throwable ex) {
					throw new BeanCreationException(mbd.getResourceDescription(), beanName,
							"Post-processing of merged bean definition failed", ex);
				}
				mbd.postProcessed = true;
			}
		}

		// Eagerly cache singletons to be able to resolve circular references
		// even when triggered by lifecycle interfaces like BeanFactoryAware.
		// 如果当前 Bean 是单例，且支持循环依赖，且当前 Bean 正在创建，通过往 singletonFactories 添加一个 objectFactory，
		// 这样后期如果有其它 Bean 依赖该 Bean，可以从 singletonFactories 获取到 Bean
		// earlySingletonExposure表示 Bean 是否需求提早暴露，用于解决循环引用问题
		// allowCircularReferences默认值为true
		boolean earlySingletonExposure = (mbd.isSingleton() && this.allowCircularReferences &&
				isSingletonCurrentlyInCreation(beanName));
		if (earlySingletonExposure) {
			if (logger.isTraceEnabled()) {
				logger.trace("Eagerly caching bean '" + beanName +
						"' to allow for resolving potential cir	cular references");
			}
			// 这里面主要是解决循环引用问题，
			// getEarlyBeanReference 可以对返回的 Bean 进行修改，这边目前除了可能会返回动态代理对象 其它的都是直接返回 Bean
			addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
		}

		// Initialize the bean instance.
		// 初始化
		Object exposedObject = bean;
		try {
			// 填充bean：非常重要的一步，给已经初始化的属性们赋值，对 Bean 进行填充，在这里面完成依赖注入的相关内容
			populateBean(beanName, mbd, instanceWrapper);
			// 完成属性依赖注入后，进一步初始化 Bean，具体进行了以下操作：
			// 若实现了 BeanNameAware、BeanClassLoaderAware、BeanFactoryAwareAware 等接口，则注入相关对象
			// 遍历后置处理器，调用实现的 postProcessBeforeInitialization 方法
			// 如果实现了 initialzingBean，调用实现的 afterPropertiesSet()
			// 如果配置了 init-mothod，调用相应的 init 方法
			// 遍历后置处理器，调用实现的 postProcessAfterInitialization 方法
			exposedObject = initializeBean(beanName, exposedObject, mbd);
		}
		catch (Throwable ex) {
			if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
				throw (BeanCreationException) ex;
			}
			else {
				throw new BeanCreationException(
						mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
			}
		}

		if (earlySingletonExposure) {
			// 如果 earlySingletonExposure 为 true，尝试从缓存获取该 Bean（一般存放在 singletonFactories 对象，
			// 通过调用 getObject 把对象存入 earlySingletonObjects），
			// 分别从 singletonObjects 和 earlySingletonObjects 获取对象，这里依然是处理循环依赖相关问题的
			Object earlySingletonReference = getSingleton(beanName, false);
			if (earlySingletonReference != null) {
				if (exposedObject == bean) {
					exposedObject = earlySingletonReference;
				}
				else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
					String[] dependentBeans = getDependentBeans(beanName);
					Set<String> actualDependentBeans = new LinkedHashSet<>(dependentBeans.length);
					for (String dependentBean : dependentBeans) {
						if (!removeSingletonIfCreatedForTypeCheckOnly(dependentBean)) {
							actualDependentBeans.add(dependentBean);
						}
					}
					if (!actualDependentBeans.isEmpty()) {
						throw new BeanCurrentlyInCreationException(beanName,
								"Bean with name '" + beanName + "' has been injected into other beans [" +
								StringUtils.collectionToCommaDelimitedString(actualDependentBeans) +
								"] in its raw version as part of a circular reference, but has eventually been " +
								"wrapped. This means that said other beans do not use the final version of the " +
								"bean. This is often the result of over-eager type matching - consider using " +
								"'getBeanNamesForType' with the 'allowEagerInit' flag turned off, for example.");
					}
				}
			}
		}

		// Register bean as disposable.
		try {
			registerDisposableBeanIfNecessary(beanName, bean, mbd);
		}
		catch (BeanDefinitionValidationException ex) {
			throw new BeanCreationException(
					mbd.getResourceDescription(), beanName, "Invalid destruction signature", ex);
		}

		return exposedObject;
	}
```

### populateBean

初始化Bean的属性
```java
protected void populateBean(String beanName, RootBeanDefinition mbd, @Nullable BeanWrapper bw) {
    if (bw == null) {
        if (mbd.hasPropertyValues()) {
            throw new BeanCreationException(
                    mbd.getResourceDescription(), beanName, "Cannot apply property values to null instance");
        }
        else {
            // Skip property population phase for null instance.
            return;
        }
    }

    // Give any InstantiationAwareBeanPostProcessors the opportunity to modify the
    // state of the bean before properties are set. This can be used, for example,
    // to support styles of field injection.
    // 给 InstantiationAwareBeanPostProcessors 最后一次机会，在属性注入前修改 Bean 的属性值
    // 具体通过调用 postProcessAfterInstantiation 方法，如果调用返回 false，表示不必继续进行依赖注入，直接返回
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
        for (InstantiationAwareBeanPostProcessor bp : getBeanPostProcessorCache().instantiationAware) {
            if (!bp.postProcessAfterInstantiation(bw.getWrappedInstance(), beanName)) {
                return;
            }
        }
    }
    // pvs 是一个 MutablePropertyValues 实例，里面实现了 PropertyValues 接口，提供属性的读写操作实现，同时可以通过调用构造函数实现深拷贝
    PropertyValues pvs = (mbd.hasPropertyValues() ? mbd.getPropertyValues() : null);

    // 根据注入类型填充属性
    int resolvedAutowireMode = mbd.getResolvedAutowireMode();
    if (resolvedAutowireMode == AUTOWIRE_BY_NAME || resolvedAutowireMode == AUTOWIRE_BY_TYPE) {
        MutablePropertyValues newPvs = new MutablePropertyValues(pvs);
        // Add property values based on autowire by name if applicable.
        if (resolvedAutowireMode == AUTOWIRE_BY_NAME) {
            autowireByName(beanName, mbd, bw, newPvs);
        }
        // Add property values based on autowire by type if applicable.
        if (resolvedAutowireMode == AUTOWIRE_BY_TYPE) {
            autowireByType(beanName, mbd, bw, newPvs);
        }
        // 结合注入后的配置，覆盖当前配置
        pvs = newPvs;
    }

    boolean hasInstAwareBpps = hasInstantiationAwareBeanPostProcessors();
    // 是否进行依赖检查，默认值就是 None，所以此处返回 false，表示不需要依赖检查(关于依赖检查的 4 种模式,建议使用 @Required 来显示控制)
    // @Required 注解作用于 Bean setter 方法上，用于检查一个 Bean 的属性的值在配置期间是否被赋予或设置(populated)
    boolean needsDepCheck = (mbd.getDependencyCheck() != AbstractBeanDefinition.DEPENDENCY_CHECK_NONE);

    PropertyDescriptor[] filteredPds = null;
    if (hasInstAwareBpps) {
        if (pvs == null) {
            pvs = mbd.getPropertyValues();
        }
        // 在这调用了 InstantiationAwareBeanPostProcessor#postProcessPropertyValues 方法，若返回 null，整个 populateBean 方法就结束了
        for (InstantiationAwareBeanPostProcessor bp : getBeanPostProcessorCache().instantiationAware) {
            PropertyValues pvsToUse = bp.postProcessProperties(pvs, bw.getWrappedInstance(), beanName);
            if (pvsToUse == null) {
                if (filteredPds == null) {
                    filteredPds = filterPropertyDescriptorsForDependencyCheck(bw, mbd.allowCaching);
                }
                // 在属性填充好后，通过后置处理器InstantiationAwareBeanPostProcessor对属性进行修改（扩展点）
                pvsToUse = bp.postProcessPropertyValues(pvs, filteredPds, bw.getWrappedInstance(), beanName);
                if (pvsToUse == null) {
                    return;
                }
            }
            pvs = pvsToUse;
        }
    }
    if (needsDepCheck) {
        if (filteredPds == null) {
            // 过滤出所有需要进行依赖检查的属性编辑器
            filteredPds = filterPropertyDescriptorsForDependencyCheck(bw, mbd.allowCaching);
        }
        checkDependencies(beanName, mbd, filteredPds, pvs);
    }

    if (pvs != null) {
        // 将 pvs 上所有的属性填充到 BeanWrapper 对应的 Bean 实例中
        // 注意：这一步完成结束后为止。我们的 Bean 依赖的 parent，还只是 RuntimeBeanReference 类型，还并不是真实的 Parent 这个 Bean
        // 在 Spring 的解析段，其它容器中是没有依赖的 Bean 的实例的，因此这个被依赖的 Bean 需要表示成 RuntimeBeanReferenc 对象，
        // 并将它放到 BeanDefinition 的 MutablePropertyValues 中。
        applyPropertyValues(beanName, mbd, bw, pvs);
    }
}
```

### initializeBean

这一步初始化Bean的一些初始化方法及BeanPostProcessor后置处理器
```java
protected Object initializeBean(String beanName, Object bean, @Nullable RootBeanDefinition mbd) {
    if (System.getSecurityManager() != null) {
        AccessController.doPrivileged((PrivilegedAction<Object>) () -> {
            invokeAwareMethods(beanName, bean);
            return null;
        }, getAccessControlContext());
    }
    else {
        invokeAwareMethods(beanName, bean);
    }

    Object wrappedBean = bean;
    if (mbd == null || !mbd.isSynthetic()) {
        wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
    }

    try {
        invokeInitMethods(beanName, wrappedBean, mbd);
    }
    catch (Throwable ex) {
        throw new BeanCreationException(
                (mbd != null ? mbd.getResourceDescription() : null),
                beanName, "Invocation of init method failed", ex);
    }
    if (mbd == null || !mbd.isSynthetic()) {
        wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
    }

    return wrappedBean;
}
```

## 三、getSingleton将对象放入缓存

```java
public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
    Assert.notNull(beanName, "Bean name must not be null");
    synchronized (this.singletonObjects) {
        Object singletonObject = this.singletonObjects.get(beanName);
        if (singletonObject == null) {
            // 如果这个 Bean 正在被销毁，就抛异常
            if (this.singletonsCurrentlyInDestruction) {
                throw new BeanCreationNotAllowedException(beanName,
                        "Singleton bean creation not allowed while singletons of this factory are in destruction " +
                        "(Do not request a bean from a BeanFactory in a destroy method implementation!)");
            }
            if (logger.isDebugEnabled()) {
                logger.debug("Creating shared instance of singleton bean '" + beanName + "'");
            }
            // 1、是否在 inCreationCheckExclusions 校验名单里
            // 2、singletonsCurrentlyInCreation 把它添加进去，证明这个 Bean 正在创建中
            beforeSingletonCreation(beanName);
            boolean newSingleton = false;
            boolean recordSuppressedExceptions = (this.suppressedExceptions == null);
            if (recordSuppressedExceptions) {
                this.suppressedExceptions = new LinkedHashSet<>();
            }
            try {
                singletonObject = singletonFactory.getObject();
                newSingleton = true;
            }
            catch (IllegalStateException ex) {
                // Has the singleton object implicitly appeared in the meantime ->
                // if yes, proceed with it since the exception indicates that state.
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    throw ex;
                }
            }
            catch (BeanCreationException ex) {
                if (recordSuppressedExceptions) {
                    for (Exception suppressedException : this.suppressedExceptions) {
                        ex.addRelatedCause(suppressedException);
                    }
                }
                throw ex;
            }
            finally {
                if (recordSuppressedExceptions) {
                    this.suppressedExceptions = null;
                }
                // 创建完成后再检查一遍。做的操作为：从正在创建缓存中移除
                afterSingletonCreation(beanName);
            }
				// 这里非常重要：若是新的 Bean，那就执行 addSingleton 这个方法
				// 将对象从二级缓存中放到一级缓存中
            if (newSingleton) {
                addSingleton(beanName, singletonObject);
            }
        }
        return singletonObject;
    }
}
```

### addSingleton

```java
protected void addSingleton(String beanName, Object singletonObject) {
    synchronized (this.singletonObjects) {
        this.singletonObjects.put(beanName, singletonObject);
        this.singletonFactories.remove(beanName);
        this.earlySingletonObjects.remove(beanName);
        this.registeredSingletons.add(beanName);
    }
}
```
将对象放到一级缓存中，并将二级、三级缓存中Bean对象删除。

![](http://image.augsix.com/materials/spring/%E7%AC%AC%E5%85%AB%E7%AF%87Bean%E5%88%9B%E5%BB%BA%E8%BF%87%E7%A8%8B.drawio.png)
