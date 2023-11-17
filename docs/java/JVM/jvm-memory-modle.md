---
title: java内存模型
order: 3
author: Thechc
category: Java
tag:
  - JVM
star: true
---

>只要比你光头就能比你强:hear_no_evil:

## 前言

《Java虚拟机规范》中曾试图定义一种“Java内存模型”（Java Memory Model，JMM）来屏蔽各种硬件和操作系统的内存访问差异，以实现让Java程序在各种平台下都能达到一致的内存访问效果。

##  内存访问差异

一个命令的运行需要从主内存拿出运行数据，经过cpu处理后再写回主内存。这个过程的io是无法避免的。但是cpu与主内存的运算速度差了好几个量级。cpu运行完后只能像个呆逼一样等待主内存写完数据。

为了解决这个问题现代计算机在cpu与主内存间加入了一层运行速度与cpu接近的高速缓存，cpu运行完后把结果给到高速缓存就可以执行下一次任务了。

到了cpu发展到多核心的时候，每个核心都有自己的高速缓存。这就又出现了一个问题：每个高速缓存共享一个主内存。那么出现缓存不一致的时候，该以哪一个高速缓存的数据为准呢？为了解决一致性问题，需要cpu遵循缓存一致性协议(有MSI、MESI（Illinois Protocol）、MOSI、Synapse、Firefly及Dragon Protocol等)。在读写时必须按照协议进行。

为了充分利用cpu性能，处理器会对输入代码进行乱序执行（Out-Of-Order Execution）优化，也就是指令重排。

![](http://image.augsix.com/materials/jvm/jmm-%E4%B8%BB%E5%AD%98%E3%80%81%E9%AB%98%E9%80%9F%E7%BC%93%E5%AD%98%E3%80%81%E5%A4%84%E7%90%86%E5%99%A8%E5%85%B3%E7%B3%BB.png)

## 缓存一致性协议 MESI

### MESI其实是缓存行的四种状态：

​	M	：Modify(修改)，当前CPU修改数据，和主内存数据不一致，其他CPU数据失效

​	E	：Exclusive(独占)，只有当前 CPU 有数据，其他 CPU 没有该数据，当前 CPU 数据与主内存数据一致。

​	S	：Shared(共享)，多个CPU共享数据，数据与主内存一致。

​	I	：Invalid(失效)，当前CPU数据失效。

### MESI 工作原理

1. `CPU-A` 从主内存读取到数据`data` 并读取到缓存中，然后讲`data` 状态标记为`E独占` 并通过总线嗅探机制对`data` 状态进行监听。

   <img src="http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE1.png" style="zoom:70%;" />
2. 这时`CPU-B`也读取了`data`，总线嗅探机制会将`CPU-A`和`CPU-B`的`data`标记为`S共享`。

   <img src="http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE2.png" style="zoom:70%;" />

3. `CPU-A`对`data`进行修改，`CPU-A`中的`data`标记为`M修改`，而`CPU-B`的`data`会被通知将状态标记为I失效。

   <img src="http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE3.png" style="zoom:75%;" />

4. `CPU-A`将`data`写会主内存并标记为E独享。

   <img src="http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE4.png" style="zoom:75%;" />

5. 同时`CPU-B`被总线嗅探机制通知`data`被修改，重新去主内存读取`data`，然后`CPU-A`和`CPU-B`的`data`标记再次标记为`S共享` 。

   <img src="http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE2.png" style="zoom:75%;" />



##  内存屏障

前面说到cpu为了调高效率会对指令乱序执行，我们称为指令重排。为了保证某一些指令必须有序执行，CPU的设计者提出内存屏障(Memory Barrier)来保证代码的有序性。



```bash
void foo(void)
{
 a = 1;
 smp_mb();
 b = 1;
}
```

内存屏障(`smp_mb();`)其实也是一条CPU指令，位于其他两条指令之间，作用与告诉CPU在内存屏障两边的语句不能乱序执行。即上面`b=1;` 不能在`a=1;`之前执行。







## Java内存模型




·lock（锁定）：作用于主内存的变量，它把一个变量标识为一条线程独占的状态。 

·unlock（解锁）：作用于主内存的变量，它把一个处于锁定状态的变量释放出来，释放后的变量 

才可以被其他线程锁定。 

·read（读取）：作用于主内存的变量，它把一个变量的值从主内存传输到线程的工作内存中，以 

便随后的load动作使用。 

·load（载入）：作用于工作内存的变量，它把read操作从主内存中得到的变量值放入工作内存的 

变量副本中。 

·use（使用）：作用于工作内存的变量，它把工作内存中一个变量的值传递给执行引擎，每当虚 

拟机遇到一个需要使用变量的值的字节码指令时将会执行这个操作。 

·assign（赋值）：作用于工作内存的变量，它把一个从执行引擎接收的值赋给工作内存的变量， 

每当虚拟机遇到一个给变量赋值的字节码指令时执行这个操作。 

·store（存储）：作用于工作内存的变量，它把工作内存中一个变量的值传送到主内存中，以便随 

后的write操作使用。 

·write（写入）：作用于主内存的变量，它把store操作从工作内存中得到的变量的值放入主内存的 

变量中。



## volatile









https://www.cnblogs.com/xmzJava/p/11417943.html

https://segmentfault.com/a/1190000022497646