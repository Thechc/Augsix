---
title: Jvm内存结构
order: 3
author: Thechc
category: Java
tag:
  - JVM
star: true
---

>只要比你光头就能比你强:hear_no_evil:

## 前言

Jvm内存结构也称运行时数据区，在《Java虚拟机规范》里Jvm内存结构被分为了5大块：程序计数器、虚拟机栈、本地方法栈、堆。但是不同的虚拟机厂商对虚拟机的实现也会产生区域的不同划分。

![](http://image.augsix.com/materials/jvm/jvm-jvm%E7%BB%93%E6%9E%84.jpg)

## 程序计数器

在Jvm里线程是通过获取一条条的执行字节码命令来运行程序的，那么线程怎么去获取字节码命令呢？在线程争夺cpu资源失败挂起后，遇到cpu重新调度怎么重新唤醒自己争夺cpu资源呢？着就需要用到程序计数器，程序计数器用来记录线程的下一条要执行的字节码命令。分支、循环、跳转、异常处理、线程恢复等功能都是以来程序计数器来完成。因为每个线程要执行的字节码命令不同，所以程序计数器是线程私有的也是唯 一一个在《Java虚拟机规范》中没有规定任何OutOfMemoryError情况的区域。

## 虚拟机栈

![](http://image.augsix.com/materials/jvm/jvm-%E6%A0%88.png)

虚拟机栈和程序计数器一样也是线程私有的，每个线程在创建的时候会创建一个虚拟机栈，线程在执行每个方法的同时会创建一个栈帧，栈帧存储着方法需要的局部变量、操作数栈、动态链接、方法出口等信息。一个方法的执行过程其实就相当于虚拟机栈从进栈到出栈。

> 在《Java虚拟机规范》中，对这个内存区域规定了两类异常状况：如果线程请求的栈深度大于虚 拟机所允许的深度，将抛出StackOverflowError异常；如果Java虚拟机栈容量可以动态扩展，当栈扩 展时无法申请到足够的内存会抛出OutOfMemoryError异常。

## 本地方法栈

本地方法栈的功能和虚拟机栈的功能类似，区别在于虚拟机栈用于虚拟机执行**Java方法**，本地方法栈用于虚拟机执行**本地方法**，这里的本地方法指C语言编写的Native方法
> 《Java虚拟机规范》对本地方法栈中方法使用的语言、使用方式与数据结构并没有任何强制规 定，因此具体的虚拟机可以根据需要自由实现它，甚至有的Java虚拟机（譬如Hot-Spot虚拟机）直接 就把本地方法栈和虚拟机栈合二为一。与虚拟机栈一样，本地方法栈也会在栈深度溢出或者栈扩展失 败时分别抛出StackOverflowError和OutOfMemoryError异常。

## 方法区

方法区用于存储被虚拟机加载的类信息、常量池。

在接触方法区的时候经常能听到**永久代**这个词，永久代其实是Java8前HotSpot虚拟机设计团队选择把收集器的分代设计扩展至方法区，在其他虚拟机上没有永久代的概念。这种方法区的实现有一种问题（永久代有-XX：MaxPermSize的上限，即使不设置也有默认大小）。导致了应用很容易遇到内存溢出问题。JDK8中彻底放弃了永久代改用使用本地内存的**元空间**来实现方法区，将原本存放在永久代的字符串常量池、静态变量等转移到元空间。

> 根据《Java虚拟机规范》的规定，如果方法区无法满足新的内存分配需求时，将抛出OutOfMemoryError异常。 

上面提到方法区存储**类信息**和**运行时常量池**，类信息包含类的的版本、字 段、方法、接口等。类的信息除了上述的信息还有一项常量池表，用于存放编译期生成的各种字面量与符号引用，这部分内容将在类加载后存放到方法区的运行时常量池中。

> 逻辑分区上常量池划分在方法区，但是在JDK7后已经把常量池转移到堆，所以在物理分区上常量池又属于堆

## 堆

![](http://image.augsix.com/materials/jvm/jvm-%E5%A0%86.png)

堆是所有线程共享的区域也是虚拟机所管理的内存最大的一块区域，用于存储new出来的对象实例。堆还划分成新生代和老年代，新生代还分为Eden区和Survivor区，Survivor区又有From Survivor和To Survivor。

> Java堆既可以被实现成固定大小的，也可以是可扩展的，不过当前主流的Java虚拟机都是按照可扩展来实现的（通过参数-Xmx和-Xms设定）。如果在Java堆中没有内存完成实例分配，并且堆也无法再扩展时，Java虚拟机将会抛出OutOfMemoryError异常。 

