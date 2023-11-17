---
title: IOC容器初始化-BeanFactory初始化
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---
## 一、前言
`IOC`容器实例化完成后就该开始初始化容器了，容器初始化分为两个阶段：

1. BeanFactory初始化

`BeanFactory`初始化指对容器进行一些环境的加载，配置填充。

2. Bean初始化

`Bean`初始化则是对`Bean`进行生成和管理，最终完成容器的初始化。
这篇就讲讲`BeanFactory`初始化

[![第四篇BeanFactory初始化.drawio[1].png](https://cdn.nlark.com/yuque/0/2023/png/8423455/1677136100173-7e1527c2-d1b3-4167-bff0-1a0706b42aec.png#averageHue=%23dddbda&clientId=udcb3dda7-8e52-4&from=ui&id=u42b1b17d&originHeight=631&originWidth=781&originalType=binary&ratio=1&rotation=0&showTitle=false&size=379094&status=done&style=none&taskId=u4d219b42-54a7-43a2-bbbb-0ee8d43ec60&title=)](http://image.augsix.com/materials/spring/%E7%AC%AC%E5%9B%9B%E7%AF%87BeanFactory%E5%88%9D%E5%A7%8B%E5%8C%96.drawio.png)
## 二、BeanFactory初始化准备-prepareBeanFactory
```java
// AbstractApplicationContext.class
protected void prepareBeanFactory(ConfigurableListableBeanFactory beanFactory) {
		// Tell the internal bean factory to use the context's class loader etc.
		// 初始化类加载器
		beanFactory.setBeanClassLoader(getClassLoader());
		// 初始化Bean的SpEL解析器
		if (!shouldIgnoreSpel) {
			beanFactory.setBeanExpressionResolver(new StandardBeanExpressionResolver(beanFactory.getBeanClassLoader()));
		}
		// 初始化属性编辑注册器
		beanFactory.addPropertyEditorRegistrar(new ResourceEditorRegistrar(this, getEnvironment()));

		// Configure the bean factory with context callbacks.
		// 初始化Spring容器Aware后置处理器
		beanFactory.addBeanPostProcessor(new ApplicationContextAwareProcessor(this));
		// 设置忽略自动装配的Bean
		// Spring 会通过其他方式来处理这些依赖。在前面的ApplicationContextAwareProcessor中通过setter注入。
		beanFactory.ignoreDependencyInterface(EnvironmentAware.class);
		beanFactory.ignoreDependencyInterface(EmbeddedValueResolverAware.class);
		beanFactory.ignoreDependencyInterface(ResourceLoaderAware.class);
		beanFactory.ignoreDependencyInterface(ApplicationEventPublisherAware.class);
		beanFactory.ignoreDependencyInterface(MessageSourceAware.class);
		beanFactory.ignoreDependencyInterface(ApplicationContextAware.class);
		beanFactory.ignoreDependencyInterface(ApplicationStartupAware.class);

		// BeanFactory interface not registered as resolvable type in a plain factory.
		// MessageSource registered (and found for autowiring) as a bean.
		// 设置已知的SpringBean
		// 我们都知道Spring容器很复杂，实现了很多接口，包含BeanFactory、ResourceLoader、ApplicationContext等接口，
		// 所以BeanFactory初始化的过程中会预先注册好这些Bean。
		beanFactory.registerResolvableDependency(BeanFactory.class, beanFactory);
		beanFactory.registerResolvableDependency(ResourceLoader.class, this);
		beanFactory.registerResolvableDependency(ApplicationEventPublisher.class, this);
		beanFactory.registerResolvableDependency(ApplicationContext.class, this);

		// Register early post-processor for detecting inner beans as ApplicationListeners.
		// 初始化ApplicationListener的检测
		beanFactory.addBeanPostProcessor(new ApplicationListenerDetector(this));

		// Detect a LoadTimeWeaver and prepare for weaving, if found.
		// LoadTimeWeaver初始化-AOP
		if (!NativeDetector.inNativeImage() && beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
			beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
			// Set a temporary ClassLoader for type matching.
			beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
		}

		// Register default environment beans.
		// 注册上下文环境相关的Bean
		if (!beanFactory.containsLocalBean(ENVIRONMENT_BEAN_NAME)) {
			beanFactory.registerSingleton(ENVIRONMENT_BEAN_NAME, getEnvironment());
		}
		if (!beanFactory.containsLocalBean(SYSTEM_PROPERTIES_BEAN_NAME)) {
			beanFactory.registerSingleton(SYSTEM_PROPERTIES_BEAN_NAME, getEnvironment().getSystemProperties());
		}
		if (!beanFactory.containsLocalBean(SYSTEM_ENVIRONMENT_BEAN_NAME)) {
			beanFactory.registerSingleton(SYSTEM_ENVIRONMENT_BEAN_NAME, getEnvironment().getSystemEnvironment());
		}
		if (!beanFactory.containsLocalBean(APPLICATION_STARTUP_BEAN_NAME)) {
			beanFactory.registerSingleton(APPLICATION_STARTUP_BEAN_NAME, getApplicationStartup());
		}
	}
```
首先要初始化BeanFactory前进行初始化准备。在prepareBeanFactory方法中为beanFactory创建类加载器、必要的Processor、上下文环境等。prepareBeanFactory方法流程如下：

1. 初始化类加载器
2. 初始化Bean的SpEL解析器
3. 初始化属性编辑注册器
4. 初始化Spring容器Aware后置处理器
5. 设置忽略自动装配的Bean
6. 设置已知的SpringBean
7. 初始化ApplicationListener的检测
8. LoadTimeWeaver初始化
9. 注册上下文环境相关的Bean
### 初始化Spring容器Aware后置处理器
`Aware`后置处理器的作用是在特定的Bean实例化完成后通知实现了`Aware`接口的类进行特殊处理。注册的Aware后置处理器有：

1. EnvironmentAware：spring上下文环境加载完后通知
2. EmbeddedValueResolverAware：解析SpEL表达式的解析器准备就绪之后通知
3. ResourceLoaderAware：资源加载器准备就绪之后通知
4. ApplicationEventPublisherAware：容器的事件管理准备就绪之后通知
5. MessageSourceAware：国际化资源准备就绪之后通知
6. ApplicationStartupAware：容器就绪之后通知
7. ApplicationContextAware：容器启动之后通知

其中最常用的是`ApplicationContextAware`。
比如:不同商家购物车的处理逻辑不同，创建获得不同的`购物车service`来处理，这时就可以在容器就绪之后将`service`放到一个`Map`通过`service类型`类获取，这样可以省略很多if判断代码。
```java
// ShoppingCartFactory.class
@Component
@Slf4j
@Lazy
public class ShoppingCartFactory implements ApplicationContextAware {
  /**
   * 购物车类型处理器map
   */
  private static final Map<ShoppingCartTypeEnum, CommonShoppingCartService> SHOPPING_SERVICE_MAP =
      new HashMap<>(GlobalConstants.Number.EIGHT);

  public CommonShoppingCartService getShoppingCartType(ShoppingCartTypeEnum shoppingCartType) {
    return Optional.ofNullable(SHOPPING_SERVICE_MAP.get(shoppingCartType))
        .orElseThrow(
            () -> {
              log.error("获取购物车service失败！找不到购物车类型处理器: " + shoppingCartType);
              return new BizzException("调用购物车服务失败！");
            }
        );
  }

  /**
   * 通过重写setApplicationContext方法将对应的CommonShoppingCartService类型的
   * service放到SHOPPING_SERVICE_MAP
   * 初始购物车类型处理器
   * @param applicationContext 应用程序上下文
   * @throws BeansException
   */
  @Override
  public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
    applicationContext.getBeansOfType(CommonShoppingCartService.class)
        .values()
        .forEach(service -> SHOPPING_SERVICE_MAP.put(service.accept(), service));
  }
}

```
## 三、BeanFactory初始化扩展-postProcessBeanFactory
`postProcessBeanFactory`是一个模板方法，由子类自行实现，实现自己的逻辑。例如web类型的容器会在重写并加入相关的后置处理器。
```java
// GenericWebApplicationContext.class
@Override
protected void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
    if (this.servletContext != null) {
        beanFactory.addBeanPostProcessor(new ServletContextAwareProcessor(this.servletContext));
        beanFactory.ignoreDependencyInterface(ServletContextAware.class);
    }
    WebApplicationContextUtils.registerWebApplicationScopes(beanFactory, this.servletContext);
    WebApplicationContextUtils.registerEnvironmentBeans(beanFactory, this.servletContext);
}
```
## 四、BeanFactory初始化-invokeBeanFactoryPostProcessors
前面都算是`BeanFactory`初始化的准备工作，`invokeBeanFactoryPostProcessors`这一步才是`BeanFactory`初始化的正式开始。这一步会执行`BeanFactory`级别的后置处理器。在进行代码分析前要先弄清楚两个处理器：`BeanFactoryPostProcessor`和`BeanDefinitionRegistryPostProcessor`。
`BeanFactoryPostProcessor`针对的是对`BeanFactory`的修改。而`BeanDefinitionRegistryPostProcessor`针对的是`BeanDefinition`的修改，要知道目前我们配置的配置类和要用到的`bean`还是`BeanDefinition`的维度。
还有一个问题`@Configuration`，`@Bean`，`@ComponentScan`，`@Import`，`@ImportResource`这些配置的注解都是什么时候执行的？
```java
// AbstractApplicationContext.class
protected void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    // 获取到当前应用程序上下文的beanFactoryPostProcessors变量的值，并且实例化调用执行所有已经注册的beanFactoryPostProcessor
    // 默认情况下，通过getBeanFactoryPostProcessors()来获取已经注册的BFPP，但是默认是空的，那么问题来了，如果你想扩展，怎么进行扩展工作？
    PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors(beanFactory, getBeanFactoryPostProcessors());

    // Detect a LoadTimeWeaver and prepare for weaving, if found in the meantime
    // (e.g. through an @Bean method registered by ConfigurationClassPostProcessor)
    if (!NativeDetector.inNativeImage() && beanFactory.getTempClassLoader() == null && beanFactory.containsBean(LOAD_TIME_WEAVER_BEAN_NAME)) {
        beanFactory.addBeanPostProcessor(new LoadTimeWeaverAwareProcessor(beanFactory));
        beanFactory.setTempClassLoader(new ContextTypeMatchClassLoader(beanFactory.getBeanClassLoader()));
    }
}
```
实际通过`PostProcessorRegistrationDelegate`处理后置处理器。
```java
// PostProcessorRegistrationDelegate.class
public static void invokeBeanFactoryPostProcessors(
			ConfigurableListableBeanFactory beanFactory, List<BeanFactoryPostProcessor> beanFactoryPostProcessors) {

		// WARNING: Although it may appear that the body of this method can be easily
		// refactored to avoid the use of multiple loops and multiple lists, the use
		// of multiple lists and multiple passes over the names of processors is
		// intentional. We must ensure that we honor the contracts for PriorityOrdered
		// and Ordered processors. Specifically, we must NOT cause processors to be
		// instantiated (via getBean() invocations) or registered in the ApplicationContext
		// in the wrong order.
		//
		// Before submitting a pull request (PR) to change this method, please review the
		// list of all declined PRs involving changes to PostProcessorRegistrationDelegate
		// to ensure that your proposal does not result in a breaking change:
		// https://github.com/spring-projects/spring-framework/issues?q=PostProcessorRegistrationDelegate+is%3Aclosed+label%3A%22status%3A+declined%22

		// Invoke BeanDefinitionRegistryPostProcessors first, if any.
		// 无论是什么情况，优先执行BeanDefinitionRegistryPostProcessors
		// 将已经执行过的BFPP存储在processedBeans中，防止重复执行
		Set<String> processedBeans = new HashSet<>();

		// 判断beanfactory是否是BeanDefinitionRegistry类型，
		// 此处是DefaultListableBeanFactory,实现了BeanDefinitionRegistry接口，所以为true
		if (beanFactory instanceof BeanDefinitionRegistry) {
			BeanDefinitionRegistry registry = (BeanDefinitionRegistry) beanFactory;

			// 此处希望大家做一个区分，两个接口是不同的，BeanDefinitionRegistryPostProcessor是BeanFactoryPostProcessor的子集
			// BeanFactoryPostProcessor主要针对的操作对象是BeanFactory
			// BeanDefinitionRegistryPostProcessor主要针对的操作对象是BeanDefinition

			// 存放BeanFactoryPostProcessor的集合
			List<BeanFactoryPostProcessor> regularPostProcessors = new ArrayList<>();
			// 存放BeanDefinitionRegistryPostProcessor的集合
			List<BeanDefinitionRegistryPostProcessor> registryProcessors = new ArrayList<>();

			// 首先处理入参中的beanFactoryPostProcessors,遍历所有的beanFactoryPostProcessors，
			// 将BeanDefinitionRegistryPostProcessor和BeanFactoryPostProcessor区分开
			for (BeanFactoryPostProcessor postProcessor : beanFactoryPostProcessors) {
				if (postProcessor instanceof BeanDefinitionRegistryPostProcessor) {
					BeanDefinitionRegistryPostProcessor registryProcessor =
							(BeanDefinitionRegistryPostProcessor) postProcessor;
					// 添加到registryProcessors，用于后续执行postProcessBeanFactory方法
					registryProcessor.postProcessBeanDefinitionRegistry(registry);
					// 添加到registryProcessors，用于后续执行postProcessBeanFactory方法
					registryProcessors.add(registryProcessor);
				}
				else {
					// 否则，只是普通的BeanFactoryPostProcessor，添加到regularPostProcessors
					// 用于后续执行postProcessBeanFactory方法
					regularPostProcessors.add(postProcessor);
				}
			}

			// Do not initialize FactoryBeans here: We need to leave all regular beans
			// uninitialized to let the bean factory post-processors apply to them!
			// Separate between BeanDefinitionRegistryPostProcessors that implement
			// PriorityOrdered, Ordered, and the rest.

			// 用于保存本次要执行的BeanDefinitionRegistryPostProcessor
			List<BeanDefinitionRegistryPostProcessor> currentRegistryProcessors = new ArrayList<>();

			// First, invoke the BeanDefinitionRegistryPostProcessors that implement PriorityOrdered.

			// 调用所有实现PriorityOrdered接口的BeanDefinitionRegistryPostProcessor实现类
			// 找到所有实现BeanDefinitionRegistryPostProcessor接口bean的beanName
			String[] postProcessorNames =
					beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
			// 遍历处理所有符合规则的postProcessorNames
			for (String ppName : postProcessorNames) {
				// 检测是否实现了PriorityOrdered接口
				if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
					// 获取名字对应的bean实例，添加到currentRegistryProcessors中
					currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
					// 将要被执行的BFPP名称添加到processedBeans，避免后续重复执行
					processedBeans.add(ppName);
				}
			}
			// 按照优先级进行排序操作
			sortPostProcessors(currentRegistryProcessors, beanFactory);
			// 添加到registryProcessors中，用于最后执行postProcessBeanFactory方法
			registryProcessors.addAll(currentRegistryProcessors);
			// 遍历currentRegistryProcessors，执行postProcessBeanDefinitionRegistry方法
			invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
			// 执行完毕之后，清空currentRegistryProcessors
			currentRegistryProcessors.clear();

			// Next, invoke the BeanDefinitionRegistryPostProcessors that implement Ordered.
			// 调用所有实现Ordered接口的BeanDefinitionRegistryPostProcessor实现类
			// 找到所有实现BeanDefinitionRegistryPostProcessor接口bean的beanName，
			// 此处需要重复查找的原因在于上面的执行过程中可能会新增其他的BeanDefinitionRegistryPostProcessor
			postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
			for (String ppName : postProcessorNames) {
				// 检测是否实现了Ordered接口，并且还未执行过
				if (!processedBeans.contains(ppName) && beanFactory.isTypeMatch(ppName, Ordered.class)) {
					// 获取名字对应的bean实例，添加到currentRegistryProcessors中
					currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
					// 将要被执行的BFPP名称添加到processedBeans，避免后续重复执行
					processedBeans.add(ppName);
				}
			}
			// 按照优先级进行排序操作
			sortPostProcessors(currentRegistryProcessors, beanFactory);
			// 添加到registryProcessors中，用于最后执行postProcessBeanFactory方法
			registryProcessors.addAll(currentRegistryProcessors);
			// 遍历currentRegistryProcessors，执行postProcessBeanDefinitionRegistry方法
			invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
			// 执行完毕之后，清空currentRegistryProcessors
			currentRegistryProcessors.clear();

			// Finally, invoke all other BeanDefinitionRegistryPostProcessors until no further ones appear.
			// 最后，调用所有剩下的BeanDefinitionRegistryPostProcessors
			boolean reiterate = true;
			while (reiterate) {
				reiterate = false;
				// 找出所有实现BeanDefinitionRegistryPostProcessor接口的类
				postProcessorNames = beanFactory.getBeanNamesForType(BeanDefinitionRegistryPostProcessor.class, true, false);
				for (String ppName : postProcessorNames) {
					// 跳过已经执行过的BeanDefinitionRegistryPostProcessor
					if (!processedBeans.contains(ppName)) {
						currentRegistryProcessors.add(beanFactory.getBean(ppName, BeanDefinitionRegistryPostProcessor.class));
						processedBeans.add(ppName);
						reiterate = true;
					}
				}
				// 按照优先级进行排序操作
				sortPostProcessors(currentRegistryProcessors, beanFactory);
				// 添加到registryProcessors中，用于最后执行postProcessBeanFactory方法
				registryProcessors.addAll(currentRegistryProcessors);
				// 遍历currentRegistryProcessors，执行postProcessBeanDefinitionRegistry方法
				invokeBeanDefinitionRegistryPostProcessors(currentRegistryProcessors, registry, beanFactory.getApplicationStartup());
				// 执行完毕之后，清空currentRegistryProcessors
				currentRegistryProcessors.clear();
			}

			// Now, invoke the postProcessBeanFactory callback of all processors handled so far.
			// 调用所有BeanDefinitionRegistryPostProcessor的postProcessBeanFactory方法
			invokeBeanFactoryPostProcessors(registryProcessors, beanFactory);
			// 最后，调用入参beanFactoryPostProcessors中的普通BeanFactoryPostProcessor的postProcessBeanFactory方法
			invokeBeanFactoryPostProcessors(regularPostProcessors, beanFactory);
		}

		else {
			// Invoke factory processors registered with the context instance.
			// 如果beanFactory不归属于BeanDefinitionRegistry类型，那么直接执行postProcessBeanFactory方法
			invokeBeanFactoryPostProcessors(beanFactoryPostProcessors, beanFactory);
		}

		// Do not initialize FactoryBeans here: We need to leave all regular beans
		// uninitialized to let the bean factory post-processors apply to them!

		// 到这里为止，入参beanFactoryPostProcessors和容器中的所有BeanDefinitionRegistryPostProcessor已经全部处理完毕，
		// 下面开始处理容器中所有的BeanFactoryPostProcessor
		// 可能会包含一些实现类，只实现了BeanFactoryPostProcessor，并没有实现BeanDefinitionRegistryPostProcessor接口

		// 找到所有实现BeanFactoryPostProcessor接口的类
		String[] postProcessorNames =
				beanFactory.getBeanNamesForType(BeanFactoryPostProcessor.class, true, false);

		// Separate between BeanFactoryPostProcessors that implement PriorityOrdered,
		// Ordered, and the rest.
		// 用于存放实现了PriorityOrdered接口的BeanFactoryPostProcessor
		List<BeanFactoryPostProcessor> priorityOrderedPostProcessors = new ArrayList<>();
		// 用于存放实现了Ordered接口的BeanFactoryPostProcessor的beanName
		List<String> orderedPostProcessorNames = new ArrayList<>();
		// 用于存放普通BeanFactoryPostProcessor的beanName
		List<String> nonOrderedPostProcessorNames = new ArrayList<>();
		for (String ppName : postProcessorNames) {
			// 跳过已经执行过的BeanFactoryPostProcessor
			if (processedBeans.contains(ppName)) {
				// skip - already processed in first phase above
			}
			// 添加实现了PriorityOrdered接口的BeanFactoryPostProcessor到priorityOrderedPostProcessors
			else if (beanFactory.isTypeMatch(ppName, PriorityOrdered.class)) {
				priorityOrderedPostProcessors.add(beanFactory.getBean(ppName, BeanFactoryPostProcessor.class));
			}
			// 添加实现了Ordered接口的BeanFactoryPostProcessor的beanName到orderedPostProcessorNames
			else if (beanFactory.isTypeMatch(ppName, Ordered.class)) {
				orderedPostProcessorNames.add(ppName);
			}
			// 添加剩下的普通BeanFactoryPostProcessor的beanName到nonOrderedPostProcessorNames
			else {
				nonOrderedPostProcessorNames.add(ppName);
			}
		}

		// First, invoke the BeanFactoryPostProcessors that implement PriorityOrdered.
		sortPostProcessors(priorityOrderedPostProcessors, beanFactory);
		// 遍历实现了PriorityOrdered接口的BeanFactoryPostProcessor，执行postProcessBeanFactory方法
		invokeBeanFactoryPostProcessors(priorityOrderedPostProcessors, beanFactory);

		// Next, invoke the BeanFactoryPostProcessors that implement Ordered.
		List<BeanFactoryPostProcessor> orderedPostProcessors = new ArrayList<>(orderedPostProcessorNames.size());
		for (String postProcessorName : orderedPostProcessorNames) {
			orderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));
		}
		sortPostProcessors(orderedPostProcessors, beanFactory);
		// 遍历实现了Ordered接口的BeanFactoryPostProcessor，执行postProcessBeanFactory方法
		invokeBeanFactoryPostProcessors(orderedPostProcessors, beanFactory);

		// Finally, invoke all other BeanFactoryPostProcessors.
		List<BeanFactoryPostProcessor> nonOrderedPostProcessors = new ArrayList<>(nonOrderedPostProcessorNames.size());
		for (String postProcessorName : nonOrderedPostProcessorNames) {
			nonOrderedPostProcessors.add(beanFactory.getBean(postProcessorName, BeanFactoryPostProcessor.class));
		}
		// 遍历普通的BeanFactoryPostProcessor，执行postProcessBeanFactory方法
		invokeBeanFactoryPostProcessors(nonOrderedPostProcessors, beanFactory);

		// Clear cached merged bean definitions since the post-processors might have
		// modified the original metadata, e.g. replacing placeholders in values...
		// 清除元数据缓存（mergeBeanDefinitions、allBeanNamesByType、singletonBeanNameByType）
		// 因为后置处理器可能已经修改了原始元数据，例如，替换值中的占位符
		beanFactory.clearMetadataCache();
	}
```
### BeanDefinition后置处理器-BeanDefinitionRegistryPostProcessors
为什么需要先处理`BeanDefinitionRegistryPostProcessors`类型的处理器呢？当前阶段`@Configuration`等配置类的注解都还是`BeanDefinition`，说明我们的配置还没有被启用。那怎么启用配置呢？
 在`refresh`之前，容器通过`AnnotatedBeanDefinitionReader`向容器中注入了一个后置处理器-`ConfigurationClassPostProcessor`。
![第四篇-ConfigurationClassPostProcessor[1].png](https://cdn.nlark.com/yuque/0/2023/png/8423455/1678181619366-f45bdbe4-5494-48de-bcf8-16f3f6e6fd2e.png#averageHue=%23333231&clientId=u738cb4b2-7f4b-4&from=ui&id=uf8fe9ceb&originHeight=402&originWidth=368&originalType=binary&ratio=1&rotation=0&showTitle=false&size=11578&status=done&style=none&taskId=u76fe5cda-c05a-4734-a89c-620d62874c0&title=)
所以`ConfigurationClassPostProcessor#postProcessBeanDefinitionRegistry`方法会被先执行。之后配置类注解会被注册成`BeanDefinition`。所以只有先处理`BeanDefinitionRegistryPostProcessors`后续的操作才能进行。
