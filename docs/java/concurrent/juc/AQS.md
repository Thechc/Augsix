---
title: AQS
order: 3
author: Thechc
category: Java
tag:
  - Java并发
star: true
---

## 一、前言
在并发编程中，锁是一种常用的保证线程安全的方法，Java 提供了`Synchronized`关键字来让开发者解决并发问题，但是`Synchronized`存在以下问题：

1. **不能够响应中断**`synchronized`一旦进入阻塞状态，就无法主动被中断。
2. **不支持超时**，如果线程在一段时间之内没有获取到锁，会一直等待直至获得到锁。
3. **只支持非公平锁**，非公平锁会导致线程饥饿。

在 **`JDK 1.5`** 后的 **`java.util.concurrent`** 包中提供了 **`AQS`** (**`AbstractQueuedSynchronizer`**) 来增强 `Synchronized` 存在的问题。

`AbstractQueuedSynchronizer`是一个用来构建锁和同步器的抽象类，提供了一些通用功能的实现，因此，使用`AQS`能简单且高效地构造出应用广泛的大量的同步器，比如我们提到的`ReentrantLock`，`Semaphore`，其他的诸如`ReentrantReadWriteLock`，`SynchronousQueue`等等皆是基于`AQS`的。


## 二、AQS 原理

### CLH 锁
`AQS`类的核心数据结构是一种名为`Craig, Landin, and Hagersten locks`（下称`CLH`锁）的变体。并对`CLH`锁进行了改进。而`CLH`锁 又是对自旋锁的改进。改进了自旋锁在锁竞争激烈的情况下锁饥饿和性能较差的问题。

`CLH`锁数据结构是一个隐式的链表，所有请求获取锁的线程会排列在链表队列中，**自旋访问队列中前一个节点的状态。当一个节点释放锁时，只有它的后一个节点才可以得到锁**。`CLH`锁本身有一个队尾指针`Tail`，它是一个原子变量，指向队列最末端的`CLH`节点。每一个`CLH`节点有两个属性：所代表的线程和标识是否持有锁的状态变量。当一个线程要获取锁时，它会对`Tail`进行一个`getAndSet`的原子操作。该操作会返回`Tail`当前指向的节点，也就是当前队尾节点，然后使`Tail`指向这个线程对应的`CLH`节点，成为新的队尾节点。入队成功后，该线程会轮询上一个队尾节点的状态变量，当上一个节点释放锁后，它将得到这个锁。

`CLH`锁没有显式的维护前驱节点或后继节点的指针。因为每个等待获取锁的线程只需要轮询前驱节点的锁状态就够了，而不需要遍历整个队列。

![](http://image.augsix.com/materials/java/CLH.png)

::: info `CLH`锁作为自旋锁的改进:
1. **减小获取和释放锁开销**。`CLH`的锁状态不再是单一的原子变量，而是分散在每个节点的状态中，降低了自旋锁在竞争激烈时频繁同步的开销。在释放锁的开销也因为不需要使用`CAS`指令而降低了。
2. **公平锁**。先入队的线程会先得到锁，避免锁饥饿。
:::


`CLH`锁也有缺点：

1. **有自旋操作**，当锁持有时间长时会带来较大的`CPU`开销。
2. **基本的`CLH`锁功能单一**，不改造不能支持复杂的功能。

### AQS 对 CLH 锁的改进
> **新增节点状态 waitStatus**

AQS 本身有一个`state`字段用来记录锁的状态，`state`默认为 0，表示没有被线程锁定，`state`等于 1 表示被线程锁定，并且每次线程重复锁定一次，`state`会自增 1，也就是可冲入锁的特性。

然后`AQS`给队列中的节点新增了一个`waitStatus`表示节点在队列中当前的状态。`waitStatus`有以下值：

<img src="http://image.augsix.com/materials/java/waitStatus1.png">

`AQS`通过对`state`的判断与对每个节点的`waitStatus`的规定和改变，来扩展手动加锁、解锁、获得锁等功能
> 显式维护前驱节点和后继节点

`CLH`队列没有显式的维护前驱节点或后继节点的指针，而`AQS`通过显式维护`CLH`队列中节点的前驱节点和后继节点来减少`CPU`消耗

当有线程申请加锁的时候，`AQS`通过 **`state`** 判断当前是否被锁定，如果锁定将当前请求加锁的线程放入`CLH`队列尾部，并且线程挂起等待，而不是自旋判断前驱节点是否释放锁。

在占用线程释放锁的时候如果`waitStatus`状态为`SIGNAL(-1)`，那么会唤醒占用线程的后继节点争抢锁。这样就减少了每个节点自旋对`CPU`的消耗。
> 辅助 GC

`JVM`的垃圾回收机制使开发者无需手动释放对象。但在`AQS`中需要在释放锁时显式的设置为`null`，避免引用的残留，辅助垃圾回收。

**AQS 的核心原理图：**

![](http://image.augsix.com/materials/java/AQS-model.png)
### AQS 资源共享模式
`AQS`提供了两种资源共享模式，**独占模式（Exclusive）**，资源是独占的，一次只能一个线程获取。如ReentrantLock。**共享模式（Share**），同时可以被多个线程获取，具体的资源个数可以指定。如`Semaphore`/`CountDownLatch`。

一般情况下，子类只需要根据需求实现其中一种模式，当然也有同时实现两种模式的同步类，如`ReadWriteLock`。
### AQS架构
图片来自：[从 ReentrantLock 的实现看 AQS 的原理及应用 - 美团技术团队](https://javaguide.cn/java/concurrent/reentrantlock.html)

![](https://p1.meituan.net/travelcube/82077ccf14127a87b77cefd1ccf562d3253591.png)

如果想要使用`AQS`构建同步器，只要继承`AbstractQueuedSynchronizer`并重写`API`层的方法即可。
### AQS 加锁流程
`AQS`的加锁流程如下，以`ReentrantLock`非公平锁为例：

![](http://image.augsix.com/materials/java/ReentrantLock-lock.png)
### AQS 解锁
在`ReentrantLock`中，当前线程解锁会调用`release`方法解锁，**当`state`等于 0 时才能解锁成功**，解锁成功后当前线程会去唤醒下一个正在阻塞的后继节点争抢锁。
::: info 
所谓的非公平锁就是只要对象处于无锁状态,所有的等待线程都可以去争抢锁.非公平锁会造成锁饥饿问题.
但是在`AQS`中, 线程只要加锁失败就要进入队列等待. 通过上一个已经解锁的线程节点来唤醒当前线程争抢锁, 这并不是正在意义上的非公平锁.
所以`AQS`中线程只有在加锁过程的几次尝试获取锁才有以非公平锁的方式抢夺锁资源,否则只能进入队列中以`FIFO`的形式抢夺锁资源.虽然不算真正意义的非公平锁,但是这样也减少了锁饥饿问题.
:::



## 三、AQS 同步器
常见的`AQS`同步工具有`CyclicBarrier`、`CountDownLatch`、`Semaphore`。并发锁有`ReentrantLock`。

## 参考
[Java AQS 核心数据结构-`CLH`锁 - Qunar 技术沙龙](https://mp.weixin.qq.com/s/jEx-4XhNGOFdCo4Nou5tqg)
