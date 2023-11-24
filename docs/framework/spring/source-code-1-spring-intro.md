---
title: IOC容器简介
order: 3
author: Thechc
category: Java
tag:
  - spring
star: true
---

## 前言

阅读Spring源码前需要使用Gradle构建Spring项目，并且在阅读前我们先来了解一下Spring几个重要的核心类与接口。

## 一、BeanFactory体系

### 1.1、BeanFactory接口

#### BeanFactory
`BeanFactory`是`Spring`对容器最基本的规范与定义，它定义了获取`bean`对象的`getBean()`方法及一些`bean`对象的定义。

所以可以说`BeanFactory`是`IOC`容器的祖宗。

![](http://image.augsix.com/materials/springFramework/base/core/BeanFactory.png#id=wcsVf&originHeight=460&originWidth=400&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

`BeanFactory`有一些直接子接口，例如:

`ListableBeanFactory`和`HierarchicalBeanFactory`、`AutowireCapableBeanFactory`等。

多级继承的子接口，例如：`ConfigurableBeanFactory` 、`ConfigurableListableBeanFactory`等都是对`BeanFactory`的扩展。

![](http://image.augsix.com/materials/springFramework/base/core/BeanFactory1.png#id=SThzC&originHeight=196&originWidth=768&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)
#### HierarchicalBeanFactory
`HierarchicalBeanFactory`扩展了容器的分层关系
```java
public interface HierarchicalBeanFactory extends BeanFactory {

	/**
	 * 返回此工厂的父工厂
	 * Return the parent bean factory, or {@code null} if there is none.
	 */
	@Nullable
	BeanFactory getParentBeanFactory();

	/**
	 * 此工厂是否包含bean对象（与BeanFactory#containsBean不同，仅判断当前工厂是否存在）
	 * Return whether the local bean factory contains a bean of the given name,
	 * ignoring beans defined in ancestor contexts.
	 * <p>This is an alternative to {@code containsBean}, ignoring a bean
	 * of the given name from an ancestor bean factory.
	 * @param name the name of the bean to query
	 * @return whether a bean with the given name is defined in the local factory
	 * @see BeanFactory#containsBean
	 */
	boolean containsLocalBean(String name);

}
```
#### ListableBeanFactory
`ListableBeanFactory`扩展了容器的便利枚举功能，它提供了批量获取`bean`的方法，不同于之前的`BeanFactory#getBean()`只能一个一个获取。
```java
public interface ListableBeanFactory extends BeanFactory {

	/**
	 * 当前工厂是否包含bean(不支持分层)
	 */
	boolean containsBeanDefinition(String beanName);

	/**
	 * 获取当前工厂BeanDefinition数量(不支持分层)
	 */
	int getBeanDefinitionCount();

	/**
	 * 返回所有Bean的BeanName组成的String数组
	 */
	String[] getBeanDefinitionNames();

    /**
	 * 一些通过各种方式批量获取bean的方法
	 */
	String[] getBeanNamesForType(ResolvableType type);
	String[] getBeanNamesForType(ResolvableType type, boolean includeNonSingletons, boolean allowEagerInit);
	String[] getBeanNamesForType(@Nullable Class<?> type);
	String[] getBeanNamesForType(@Nullable Class<?> type, boolean includeNonSingletons, boolean allowEagerInit);
	<T> Map<String, T> getBeansOfType(@Nullable Class<T> type) throws BeansException;
	<T> Map<String, T> getBeansOfType(@Nullable Class<T> type, boolean includeNonSingletons, boolean allowEagerInit)
			throws BeansException;
	String[] getBeanNamesForAnnotation(Class<? extends Annotation> annotationType);
	Map<String, Object> getBeansWithAnnotation(Class<? extends Annotation> annotationType) throws BeansException;
	@Nullable
	<A extends Annotation> A findAnnotationOnBean(String beanName, Class<A> annotationType)
			throws NoSuchBeanDefinitionException;
	@Nullable
	<A extends Annotation> A findAnnotationOnBean(
			String beanName, Class<A> annotationType, boolean allowFactoryBeanInit)
			throws NoSuchBeanDefinitionException;

}
```
#### AutowireCapableBeanFactory
`AutowireCapableBeanFactory`扩展的是自动注入的功能，提供给第三方非`Spring`管理的类或框架使用已经在Spring管理的Bean。正常情况下与`ListableBeanFactory`或`BeanFactory`共同使用。而在开发中一般创建`ApplicationContextHelper`工具类实现`ApplicationContextAware`接口注入`ApplicationContext` 的方式获取`Spring`容器的`bean`。
```java
public class MyConfig {
    // 在spring中注入PersonService
	@Bean
	public PersonService personService(){
		return new PersonService();
	}
}

public class Person {

	private String name;
	private Integer age;

	// 这边PersonService并没有加入@autowire注解  Person类也有没被Spring管理
	private PersonService personService;

	public Person() {
	}
	// getset方法
}

public class ContextTest {

	@Test
	public void AutowireCapableBeanFactoryTest() {
		ApplicationContext applicationContext = new AnnotationConfigApplicationContext(MyConfig.class);
		AutowireCapableBeanFactory autowireCapableBeanFactory = applicationContext.getAutowireCapableBeanFactory();

		Person person = (Person) autowireCapableBeanFactory.createBean(Person.class, AutowireCapableBeanFactory.AUTOWIRE_BY_TYPE, false);
		// 这边PersonService().eat()打印出 eat air!!!!!!!  说明PersonService是注入成功的
		person.getPersonService().eat();
		//下面打印会报错，原因是Spring找不到Person，因为Person并不是Spring管理的
		System.out.println(applicationContext.getBean(Person.class));
	}
}
```
![](http://image.augsix.com/materials/springFramework/base/core/AutowireCapableBeanFactoryTest.jpg#id=d2FZS&originHeight=86&originWidth=970&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

#### ConfigurableBeanFactory
`ConfigurableBeanFactory` 接口是对`HierarchicalBeanFactory`的扩展并且继承了`SingletonBeanRegistry`。所以它具有容器分层和单例注册表的特性。在此基础上他还添加了类加载器、`BeanPostProcessor`、作用域、管理`bean`的能力。
```java
public interface ConfigurableBeanFactory extends HierarchicalBeanFactory, SingletonBeanRegistry {
    // 其他代码
}
```
> `SingletonBeanRegistry`是单例注册表的接口，其中他的实现类`DefaultSingletonBeanRegistry`代码中通过三级缓存解决循环依赖的问题
> 

#### ConfigurableListableBeanFactory
`ConfigurableListableBeanFactory`直接间接继承了上述的接口，所以它几乎集成了一个IOC容器需要具备的功能。
```java
public interface ConfigurableListableBeanFactory
		extends ListableBeanFactory, AutowireCapableBeanFactory, ConfigurableBeanFactory {
    // 其他代码
}
```
### 1.2、扩展接口与类
#### AliasRegistry&&SimpleAliasRegistry
`AliasRegistry`提供了`bean`对象别名管理的接口方法
```java
public interface AliasRegistry {

	/**
	 * 注册一个别名
	 */
	void registerAlias(String name, String alias);

	/**
	 * 移除已注册的别名
	 */
	void removeAlias(String alias);

	/**
	 * 判断别名是否存在
	 */
	boolean isAlias(String name);

	/**
	 * 返回指定名称的所有别名
	 */
	String[] getAliases(String name);

}
```
`SimpleAliasRegistry`是AliasRegistry的实现类。对别名的注册销毁管理做具体实现
```java
public class SimpleAliasRegistry implements AliasRegistry {
    ···
    @Override
	public void registerAlias(String name, String alias) {
		Assert.hasText(name, "'name' must not be empty");
		Assert.hasText(alias, "'alias' must not be empty");
		synchronized (this.aliasMap) {
			if (alias.equals(name)) {
				this.aliasMap.remove(alias);
				if (logger.isDebugEnabled()) {
					logger.debug("Alias definition '" + alias + "' ignored since it points to same name");
				}
			}
			else {
				String registeredName = this.aliasMap.get(alias);
				if (registeredName != null) {
                      // 如果别名已存在，无需注册，结束执行。
					if (registeredName.equals(name)) {
						// An existing alias - no need to re-register
						return;
					}
                      // 别名是否可以被覆盖
					if (!allowAliasOverriding()) {
						throw new IllegalStateException("Cannot define alias '" + alias + "' for name '" +
								name + "': It is already registered for name '" + registeredName + "'.");
					}
					if (logger.isDebugEnabled()) {
						logger.debug("Overriding alias '" + alias + "' definition for registered name '" +
								registeredName + "' with new target name '" + name + "'");
					}
				}
                  //递归检查别名
				checkForAliasCircle(name, alias);
                  // 注册
				this.aliasMap.put(alias, name);
				if (logger.isTraceEnabled()) {
					logger.trace("Alias definition '" + alias + "' registered for name '" + name + "'");
				}
			}
		}
	} 
    ···
}
```
#### BeanDefinitionRegistry&&BeanDefinition
`BeanDefinitionRegistry`是提供`BeanDefinition`（Spring中bean的定义）的注册管理接口。

`BeanDefinitionRegistry`还继承了`AliasRegistry`所以也有别名的管理功能。

```java
public interface BeanDefinitionRegistry extends AliasRegistry {
	// 注册一个BeanDefinition
	void registerBeanDefinition(String beanName, BeanDefinition beanDefinition)
			throws BeanDefinitionStoreException;
    // 删除BeanDefinition
	void removeBeanDefinition(String beanName) throws NoSuchBeanDefinitionException;
	// 通过名称获取BeanDefinition
	BeanDefinition getBeanDefinition(String beanName) throws NoSuchBeanDefinitionException;
	// 是否包含BeanDefinition
	boolean containsBeanDefinition(String beanName);
	// 获得所有BeanDefinition的名称
	String[] getBeanDefinitionNames();
	// BeanDefinition的数量
	int getBeanDefinitionCount();
	// BeanName是否被占用
	boolean isBeanNameInUse(String beanName);
}
```
`BeanDefinition`是`bean`对象的定义。包含了bean对象的属性值、方法、对象作用域等信息，可以理解为一个人的身份证，上面有一个人的姓名、性别、出生地等信息。
#### SingletonBeanRegistry
`SingletonBeanRegistry`也是`Spring`中很重要的一个接口。提供了单例注册管理的接口。
```java
public interface SingletonBeanRegistry {
   	// 注册单例
	void registerSingleton(String beanName, Object singletonObject);
   	// 获取一个单例对象
	@Nullable
	Object getSingleton(String beanName);
   	// 是否包含单例对象
	boolean containsSingleton(String beanName);
   	// 获取所有单例的名称
	String[] getSingletonNames();
   	// 获取单例对象的个数
	int getSingletonCount();
	···
}
```
#### DefaultSingletonBeanRegistry
`DefaultSingletonBeanRegistry`实现了`SingletonBeanRegistry`并且继承自`SimpleAliasRegistry`，所以`DefaultSingletonBeanRegistry`提供了注册获取单例的实现与别名的管理。
在`DefaultSingletonBeanRegistry`中使用的三级缓存的概念来获取`bean`对象
```java
public class DefaultSingletonBeanRegistry extends SimpleAliasRegistry implements SingletonBeanRegistry {
    ···
    /**  */
	private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

	/**  */
	private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);

	/**  */
	private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);    
    ···
    @Nullable
	protected Object getSingleton(String beanName, boolean allowEarlyReference) {
		// Quick check for existing instance without full singleton lock
		Object singletonObject = this.singletonObjects.get(beanName);
		if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
			singletonObject = this.earlySingletonObjects.get(beanName);
			if (singletonObject == null && allowEarlyReference) {
				synchronized (this.singletonObjects) {
					// Consistent creation of early reference within full singleton lock
					singletonObject = this.singletonObjects.get(beanName);
					if (singletonObject == null) {
						singletonObject = this.earlySingletonObjects.get(beanName);
						if (singletonObject == null) {
							ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
							if (singletonFactory != null) {
								singletonObject = singletonFactory.getObject();
								this.earlySingletonObjects.put(beanName, singletonObject);
								this.singletonFactories.remove(beanName);
							}
						}
					}
				}
			}
		}
		return singletonObject;
	}    
    ···
}
```
#### DisposableBean

`DisposableBean`提供了在销毁Ioc容器的时候释放资源。

### 1.3、DefaultListableBeanFactory

`DefaultListableBeanFactory`是对上面所述接口的实现类，是一个成熟的`BeanFactory`。

并且定义了`beanDefinitionMap` 存储bean对象。是`Spring`的`BeanFactory`的默认实现类。

![](http://image.augsix.com/materials/springFramework/base/core/DefaultListableBeanFactory.png#id=ltRkN&originHeight=711&originWidth=1382&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

## 二、ApplicationContext体系

如果把`BeanFactory`体系比喻成心脏，那么`ApplicationContext`体系就能理解为一个完整的人。

`ApplicationContext`体系在`BeanFactory`体系的概念上封装了更贴近实际应用场景的功能。

### 2.1、ApplicationContext接口

#### ApplicationContext

`ApplicationContext`它继承了`BeanFactory`、`ResourceLoader`等接口，但是在`BeanFactory`体系那么多接口中，只继承了`ListableBeanFactory`和`HierarchicalBeanFactory`接口

![](http://image.augsix.com/materials/springFramework/base/core/ApplicationContext.png#id=WhjgM&originHeight=309&originWidth=1396&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

#### MessageSource

`MessageSource`用于支持信息的国际化和包含参数的信息的替换。

#### EnvironmentCapable

`EnvironmentCapable`用于获取spring 容器环境信息，以及配置文件信息。

#### ApplicationEventPublisher

`ApplicationEventPublisher`提供时间发布功能。

#### ResourceLoader

`Spring`提供资源的根接口。在`Spring Ioc`中，资源被`Resource`引用，获得`Resource`对象，说明获得了资源的访问。`Resource`提供资源的抽象，具体资源可是从`URL`，`classpath`,`file`等地方获得。

#### ResourcePatternResolver

`ResourcePatternResolver`是对`ResourceLoader`的扩展，其支持模式匹配的资源。如：`classpath*:`表示匹配路径下所有的资源。

#### Lifecycle

Lifecycle是声明周期的管理接口，提供周期开始、周期结束、是否在存活周期中的判定方法。

#### ConfigurableApplicationContext

`ConfigurableApplicationContext`可配置的应用上下文

#### AbstractApplicationContext

`AbstractApplicationContext`是`Spring`所有容器类的父类，并且重写了`ConfigurableApplicationContext`接口的`refresh()`方法，`refresh()`就是容器创建过程中很重要的一个方法。

![](http://image.augsix.com/materials/springFramework/base/core/AbstractApplicationContext.png#id=AQcxY&originHeight=721&originWidth=3182&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

如图`AbstractApplicationContext`的子类主要分为两类，一类是`Refreshbale`类型，一类是`Generic`类型。

### 2.2、Refreshbale类型

#### AbstractRefreshableApplicationContext

`AbstractRefreshableApplicationContext`提供多线程同时刷新容器支持，每次刷新都会产生一个内部`BeanFactory(DefaultListableBeanFactory)`。另外，子类要实现`loadBeanDefinitions`方法来正确加载Bean定义。

#### 2.2.1、AbstractRefreshableConfigApplicationContext

`AbstractRefreshableConfigApplicationContext`提供了`configLocations`对资源进行定位，具体操作都是子类中。

#### 2.2.2、AbstractRefreshableWebApplicationContext

`AbstractRefreshableWebApplicationContext`是一个抽象类，继承`AbstractRefreshableConfigApplicationContext`，内置了`ServletContext`所以具有`Web`的特性

##### 2.2.2.1、AnnotationConfigWebApplicationContext

`AnnotationConfigWebApplicationContext`继承自`AbstractRefreshableWebApplicationContext`，并且实现了`AnnotationConfigRegistry`接口，在重写的方法`loadBeanDefinitions()`中实现通过配置的方式来扫描注册`Bean`。

```java
// 使用方式：
ApplicationContext applicationContext = new AnnotationConfigApplicationContext(MyConfig.class);
```
##### 2.2.2.2、GroovyWebApplicationContext

`GroovyWebApplicationContext`支持`Groovy`语法的web容器，用于支持`groovy bean`配置文件。

#### 2.2.3、AbstractXmlApplicationContext

`AbstractXmlApplicationContext`是一个抽象类，继承了`AbstractRefreshableConfigApplicationContext接口`。主要实现了loadBeanDefinitions对资源进行加载，内部使用`XmlBeanDefinitionReader`加载器。

##### 2.2.3.1、FileSystemXmlApplicationContext

`FileSystemXmlApplicationContext`通过加载文件路径初始化容器。

```java
// 使用方式
ApplicationContext applicationContext = new FileSystemXmlApplicationContext("D:/xxx/applicationContext.xml");
```

##### 2.2.3.2、ClassPathXmlApplicationContext

`ClassPathXmlApplicationContext`通过加载类路径下的配置文件初始化容器
```java
// 使用方式
ApplicationContext context = new ClassPathXmlApplicationContext("applicationContext.xml");
```

### 2.3、Generic类型

#### 2.3.1、GenericApplicationContext

`GenericApplicationContext`内置了一个`DefaultListableBeanFactory`作为工厂实现。

并且实现了`BeanDefinitionRegistry`接口。并且`GenericApplicationContext`只能刷新容器一次。

```java
@Override
protected final void refreshBeanFactory() throws IllegalStateException {
    // 使用CAS方式，如果重新刷新将抛出异常
    if (!this.refreshed.compareAndSet(false, true)) {
        throw new IllegalStateException(
            "GenericApplicationContext does not support multiple refresh attempts: just call 'refresh' once");
    }
    this.beanFactory.setSerializationId(getId());
}
```
