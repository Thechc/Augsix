---
title: JMM
order: 3
author: Thechc
category: Java
tag:
  - Java并发
star: true
---

## 一、前言
Java 程序是运行在 Java 虚拟机（JVM）上的，而 JVM 又是跨语言夸平台的实现，那 JVM 是如何保证在不同的硬件生产商和不同的操作系统下，内存的访问的差异和线程安全的呢？

## 二、CPU与内存的关系
> 内存访问差异

一个命令的运行需要从主内存拿出运行数据，经过 CPU 处理后再写回主内存。这个过程的 IO 是无法避免的。但是 CPU 与主内存的运算速度差了好几个量级。CPU 运行完后只能像个呆逼一样等待主内存写完数据。

为了解决这个问题现代计算机在 CPU 与主内存间加入了一层运行速度与 CPU 接近的高速缓存，CPU 运行完后把结果给到高速缓存就可以执行下一次任务了。

到了 CPU 发展到多核心的时候，每个核心都有自己的高速缓存。这就又出现了一个问题：每个高速缓存共享一个主内存。那么出现缓存不一致的时候，该以哪一个高速缓存的数据为准呢？为了解决一致性问题，需要 CPU 遵循缓存一致性协议 (有MSI、MESI（Illinois Protocol）、MOSI、Synapse、Firefly及Dragon Protocol等)。在读写时必须按照协议进行。

为了充分利用 CPU 性能，处理器会对输入代码进行乱序执行（Out-Of-Order Execution）优化，也就是指令重排。

![jmm-主存、高速缓存、处理器关系[1].png](http://image.augsix.com/materials/jvm/jmm-%E4%B8%BB%E5%AD%98%E3%80%81%E9%AB%98%E9%80%9F%E7%BC%93%E5%AD%98%E3%80%81%E5%A4%84%E7%90%86%E5%99%A8%E5%85%B3%E7%B3%BB.png)

> 缓存一致性协议 MESI

**MESI其实是缓存行的四种状态**：

	M：Modify(修改)，当前CPU修改数据，和主内存数据不一致，其他CPU数据失效
	E：Exclusive(独占)，只有当前 CPU 有数据，其他 CPU 没有该数据，当前 CPU 数据与主内存数据一致。
	S：Shared(共享)，多个CPU共享数据，数据与主内存一致。
	I：Invalid(失效)，当前CPU数据失效。

**MESI 工作原理:**

CPU-A 从主内存读取到数据data 并读取到缓存中，然后将 data 状态标记为 E 独占，并通过总线嗅探机制对 data 状态进行监听。

![](http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE1.png =500x500)

这时 CPU-B 也读取了 data，总线嗅探机制会将 CPU-A 和 CPU-B 的 data 标记为 S 共享。

![](http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE2.png =500x500)

CPU-A 对 data 进行修改，CPU-A 中的 data 标记为M修改，而 CPU-B 的 data 会被通知将状态标记为I失效。

![](http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE3.png =500x500)

CPU-A 将 data 写会主内存并标记为E独享。

![](http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE4.png =500x500)

同时 CPU-B 被总线嗅探机制通知 data 被修改，重新去主内存读取 data，然后 CPU-A 和 CPU-B 的 data 标记再次标记为S共享。

![](http://image.augsix.com/materials/jvm/jvm-%E7%BC%93%E5%AD%98%E4%B8%80%E8%87%B4%E6%80%A7%E5%8D%8F%E8%AE%AE2.png =500x500)

**内存屏障**

前面说到 CPU 为了调高效率会对指令乱序执行，我们称为指令重排。为了保证某一些指令必须有序执行，CPU 的设计者提出内存屏障 (Memory Barrier) 来保证代码的有序性。
```
void foo(void)
{
 a = 1;
 smp_mb();
 b = 1;
}
```
内存屏障 `(smp_mb();)`  其实也是一条 CPU 指令，位于其他两条指令之间，作用与告诉 CPU 在内存屏障两边的语句不能乱序执行。即上面 b=1; 不能在 a=1; 之前执行。
## 三、JMM
JMM（Java Memory Model，JMM）就是 Java 内存模型，它是一个内存模型的概念与规范，**目的是解决多线程存在的原子性、可见性以及有序性问题**。JMM 将 CPU 与内存交互的问题、缓存一致协议、内存屏障等抽象到 JVM 层面，基于 CPU 层面提供的内存屏障指令，以及限制编译器的重排序，来解决 CPU 多级缓存、处理器优化、指令重排导致的并发问题。 开发者可以利用这些规范更方便地开发多线程程序。对于 Java 开发者说，你不需要了解底层原理，直接使用并发相关的一些关键字和类（比如 volatile、synchronized、各种 Lock）即可开发出并发安全的程序。
## 四、并发编程三大特性
> Info 原子性

一次操作或者多次操作，要么所有的操作全部都得到执行并且不会受到任何因素的干扰而中断，要么都不执行。

在 Java 中，可以借助synchronized、各种 Lock 以及各种原子类实现原子性。synchronized 和各种 Lock 可以保证任一时刻只有一个线程访问该代码块，因此可以保障原子性。各种原子类是利用 CAS (compare and swap) 操作（可能也会用到 volatile或者final关键字）来保证原子操作。
> 可见性

当一个线程对共享变量进行了修改，那么另外的线程都是立即可以看到修改后的最新值。在 Java 中，可以借助synchronized、volatile 以及各种 Lock 实现可见性。如果我们将变量声明为 volatile ，这就指示 JVM，这个变量是共享且不稳定的，每次使用它都到主存中进行读取。
> 有序性

由于指令重排序问题，代码的执行顺序未必就是编写代码时候的顺序。

指令重排可以保证串行语义一致，但是没有义务保证多线程间的语义也一致 ，所以在多线程下，指令重排序可能会导致一些问题。在 Java 中，volatile 关键字可以禁止指令进行重排序优化。

## 参考

- [https://www.cnblogs.com/xmzJava/p/11417943.html](https://www.cnblogs.com/xmzJava/p/11417943.html)
- [https://segmentfault.com/a/1190000022497646](https://segmentfault.com/a/1190000022497646)

