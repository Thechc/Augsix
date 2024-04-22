---
title: 类加载
order: 3
author: Thechc
category: Java
tag:
  - JVM
star: true
---

>只要比你光头就能比你强:hear_no_evil:

##  前言

Java文件被编译器编译成Class文件后，虚拟机就要把Class文件内容加载成虚拟机的内存中才能运行程序，那么类的加载又是一个怎样的过程？

##  类在虚拟机的生命周期

类从被虚拟机加载到卸载会经历七个阶段：加载、验证、准备、解析、初始化、使用、卸载。其中验证、准备、解析三个部分称为连接。

![](http://image.augsix.com/materials/jvm/jvm-%E7%B1%BB%E5%8A%A0%E8%BD%BD-%E7%B1%BB%E5%8A%A0%E8%BD%BD%E8%BF%87%E7%A8%8B.png)

类的加载过程必须按照加载、验证、准备、初始化、卸载的顺序进行、而解析可以在初始化之后再执行。

* 加载：
  ​	通过类全限定名获取类的二进制流
  ​	将这个字节流所代表的静态存储结构转化为方法区的运行时数据结构
  ​	在内存中生成一个代表这个类的java.lang.Class对象，

* 验证：
  ​	确保Class文件的字节流中包含的信息符合《Java虚 拟机规范》的全部约束要求，保证这些信息  被当作代    码运行后不会危害虚拟机自身的安全。

* 准备：
  ​	为类中定义的变量（即静态变量，被static修饰的变量）分配内存并设置类变量初始值

* 解析：
  ​	Java虚拟机将常量池内的符号引用替换为直接引用的过程

* 初始化：
  ​	开始执行类中编写的Java程序代码，将主导权移交给应用程 序

* 使用

* 卸载


##  类加载器

在类加载的过程中需要用过类的全限定名来获得这个类的二进制流，完成这个操作的代码被称为类加载器。每个类加载器拥有自己的类名称空间，对于任意一个类，都必须由加载它的类加载器和这个类本身一起共同确立其在Java虚拟机中的唯一性。

也就是说比较两个类是否“相 等”，只有在这两个类是由同一个类加载器加载的前提下才有意义，否则，即使这两个类来源于同一个Class文件，被同一个Java虚拟机加载，只要加载它们的类加载器不同，那这两个类就必定不相等。

```java
public class MyClassloader {
  public static void main(String[] args) throws Exception {
    ClassLoader myLoader = new ClassLoader() {
      @Override
      public Class<?> loadClass(String name) throws ClassNotFoundException {
        try {
          String fileName = name.substring(name.lastIndexOf(".") + 1) + ".class";
          InputStream is = getClass().getResourceAsStream(fileName);
          if (is == null) {
            return super.loadClass(name);
          }
          byte[] b = new byte[is.available()];
          is.read(b);
          return defineClass(name, b, 0, b.length);
        } catch (IOException e) {
          throw new ClassNotFoundException(name);
        }
      }
    };
    Object obj = myLoader.loadClass("test1.MyClassloader").newInstance();
    System.out.println(obj.getClass());
    System.out.println(obj instanceof MyClassloader);
  }
}
/**
 * 我们定义一个自己的类加载器去加载 MyClassloader 但是发现在比较时结果时false
 * 这是因为这里的比较是拿 应用程序类加载器加载的 MyClassloader 与我们自定义的类加载器做对比
 * 虽然是同一个Class文件，但是他们并不是同一个类
 * 结果
 * class test1.MyClassloader
 * false
 */
```

那么有几种类加载器呢？
Java一直保 持着三层类加载器
* 启动类加载器（Bootstrap Class Loader）：负责加载 <JAVA_HOME>\lib目录的Class
* 扩展类加载器（Extension Class Loader）：负责加载<JAVA_HOME>\lib\ext目录中Class
* 应用程序类加载器（Application Class Loader）：复制加载用户类路径下的的Class

## 双亲委派模型
各种类加载器之间的层次关系被称为类加载器的“双亲委派模型（Parents Delegation Model）,双亲委派模型要求除了顶层的启动类加载器外，其余的类加载器都应有自己的父类加载器

![](http://image.augsix.com/materials/jvm/jvm-%E5%8F%8C%E4%BA%B2%E5%A7%94%E6%B4%BE%E6%A8%A1%E5%9E%8B.png)

双亲委派模型的工作过程是：如果一个类加载器收到了类加载的请求，它首先不会自己去尝试加载这个类，而是把这个请求委派给父类加载器去完成，只有当父加载器反馈自己无法完成这个加载请求时，子加载器才会尝试自己去完成加载。 