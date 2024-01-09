---
title: InnoDB 锁
order: 3
author: Thechc
category: mysql
tag:
  - mysql,InnoDB,锁
star: true
---

MySQL 中的锁按锁的维度分为 row-level（行级锁）和 table-level（表级锁），表级锁有：表锁、元数据锁（MDL）、意向锁、AUTO-INC 锁。行级锁有：Record Lock、间隙锁、Next-Key Lock、插入意向锁。

## 表级锁

### 表锁

表锁实现方式：

```sql
-- 读锁，该表可以读，不能ddl 和 dml 中增删改，只能读取表数据 
lock tables commodity read;
-- 写锁，该表既不能读，也不能写 
lock tables commodity write;
lock tables commodity read, `order` write;
```
表锁除了会限制别的线程的读写外，也会限制本线程接下来的读写操作。

也就是说如果本线程对表加了「读锁」，那么本线程接下来如果要对学生表执行写操作的语句，是会被阻塞的，当然其他线程对表进行写操作时也会被阻塞，直到锁被释放。

要释放表锁，可以使用下面这条命令，会释放当前会话的所有表锁：

```sql
unlock tables
```

也可以在客户端断开的时候自动释放。在还没有出现更细粒度的锁的时候，表锁是最常用的处理并发的方式。

而对于 InnoDB 这种支持行锁的引擎，一般不使用 lock tables 命令来控制并发，毕竟锁住整个表的影响面还是太大。

### MDL 锁

MDL 即**（metadata lock)** 也叫元数据锁，MDL 锁无需显示加锁，在访问一个表的时候会被自动加锁。

MDL 的作用是，保证读写的正确性。当用户对表执行 CRUD 操作时，防止其他线程对这个表结构做了变更。

当有线程在执行 select 语句（ 加 MDL 读锁）的期间，如果有其他线程要更改该表的结构（ 申请 MDL 写锁），那么将会被阻塞，直到执行完 select 语句（ 释放 MDL 读锁）。

### 意向锁

MySQL 即支持表锁也支持行锁，如果已经有一个事务 A 对某一行添加了行锁，另外一个事务 B 要对表加表锁的时候就要扫描表中的每一行，看看当前表中是否被锁，如果被锁则加锁失败。

如果**在加行独占锁的时候同时对表级别加一个意向独占锁**，这个表级别独占锁不和行锁冲突，只和表锁冲突。也就是当有事务 B 对表加锁的时候，提示当前已经有事务A 对表加了意向锁，事务 B 对表加锁失败，这样事务 B 就不用扫描表是否被加行锁。这就是意向锁。目的就是提示当前表是否已加锁。

意向锁是数据库自动加在表级别的锁，无需自己调用。意向锁也分为意向共享锁（intention shared lock，IS）和意向独占锁（intention exclusive lock，IX）。

```sql
// 数据库对某行加共享锁前，先在表上加意向共享锁，然后对行记录加共享锁
select ... lock in share mode;
// 数据库对某行加独占锁前，先在表上加意向独占锁，然后对行记录加独占锁
select ... for update;
```

当发生意向锁的时候，使用 SHOW ENGINE INNODB STATUS 查看 数据库引擎日志会显示：

```bash
TABLE LOCK table `test`.`t` trx id 10080 lock mode IX
```

### AUTO-INC 锁

在使用自增主键的时候需要对主键字段设置 AUTO_INCREMENT。对表插入一行数据，会对表加一个 AUTO-INC 锁来保证主键有序自增。等 insert 语句执行完再释放锁，最后提交事务。
```bash
插入数据 ⇢ 创建事务 ⇢ 加 AUTO-INC 锁 ⇢ 获取主键值 ⇢ 执行语句 ⇢ 释放 AUTO-INC 锁 ⇢ 提交事务
```

但是在一个事务执行插入时，其他事务没拿到「AUTO-INC」锁是被阻塞的。如果只插入一条数据，性能影响不大，但是如果是大批量数据插入，「AUTO-INC」锁持有执行时间长，就会导致其他事务长时间阻塞。

在 MySQL 5.1.22 版本开始，InnoDB 存储引擎提供了一种**轻量级的锁**来实现自增。在插入数据时先拿到「AUTO-INC」锁，在拿到自增的值就会释放锁。无需等待语句执行完。

通过提前释放了「AUTO-INC」锁可以减少其他事务的阻塞时间。

```bash
插入数据 ⇢ 创建事务 ⇢ 加 AUTO-INC 锁 ⇢ 获取主键值 ⇢ 释放 AUTO-INC 锁 ⇢ 执行语句 ⇢ 提交事务
```

> InnoDB 存储引擎提供了个 innodb_autoinc_lock_mode 的系统变量，是用来控制选择用 AUTO-INC 锁，还是轻量级的锁。
>
> - 当 innodb_autoinc_lock_mode = 0，就采用 AUTO-INC 锁，语句执行结束后才释放锁；
> - 当 innodb_autoinc_lock_mode = 2，就采用轻量级锁，申请自增主键后就释放锁，并不需要等语句执行后才释放。
> - 当 innodb_autoinc_lock_mode = 1：
>   - 普通 insert 语句，自增锁在申请之后就马上释放；
>   - 类似 insert … select 这样的批量插入数据的语句，自增锁还是要等语句结束后才被释放；
>
> 当 innodb_autoinc_lock_mode = 2 是性能最高的方式，但是当搭配 binlog 的日志格式是 statement 一起使用的时候，在「主从复制的场景」中会发生**数据不一致的问题**。
>
> **当 innodb_autoinc_lock_mode = 2 时，并且 binlog_format = row，既能提升并发性，又不会出现数据一致性问题**。

## 行级锁

行级锁有两种模式：共享锁（shared lock，S）和独占锁（exclusive lock，X）。锁的兼容情况为：

|          | 共享锁 S | 独占锁 X |
| :------: | :------: | :------: |
| 共享锁 S |   兼容   |   冲突   |
| 独占锁X  |   冲突   |   冲突   |

### Record Locks

Record Lock 称为记录锁，锁住的是一条记录。而且记录锁是有 S 锁和 X 锁之分的。

```sql
// 对 id = 10 的记录加独占锁 X
SELECT * FROM t WHERE id = 10 FOR UPDATE;
// 对 id = 10 的记录加共享锁 S
SELECT * FROM t WHERE id = 10 lock in share mode;
```

当有 Record Lock 的时候，使用 SHOW ENGINE INNODB STATUS 查看 数据库引擎日志会显示：

```bash
RECORD LOCKS space id 58 page no 3 n bits 72 index `PRIMARY` of table `test`.`t`
// 这边对行加独占锁 X 但不是间隙锁
trx id 10078 lock_mode X locks rec but not gap
Record lock, heap no 2 PHYSICAL RECORD: n_fields 3; compact format; info bits 0
 0: len 4; hex 8000000a; asc     ;;
 1: len 6; hex 00000000274f; asc     'O;;
 2: len 7; hex b60000019d0110; asc        ;;
```

### Gap Locks

Gap Lock 称为间隙锁，锁定一个范围，但不包括记录本身。只存在于可重复读隔离级别，目的是为了解决可重复读隔离级别下幻读的现象。

例如`SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;` 这句 sql 对 c1 为 10 到 20 的区间加了间隙锁，所以如果有一条 sql 要插入 c1 为 15 的数据将被阻塞。

### Next-Key Locks

Next-Key Lock 称为临键锁，是 Record Lock + Gap Lock 的组合，锁定一个范围，并且锁定记录本身。对于行的查询，都是采用该方法，主要目的是解决幻读的问题。

比如表中有4条数据：

| id   | name | age  |
| ---- | ---- | ---- |
| 5    | tom  | 5    |
| 10   | bob  | 10   |
| 15   | cat  | 15   |
| 20   | dog  | 20   |

如果我们执行语句`SELECT * FROM t FOR UPDATE` 这时候会产生 4 个 Next-Key Lock 分别为：(-∞,5]、(5,10]、(10,20]、(20, +∞]，在 Next-Key Lock 锁定的区间，如果有其他独占锁事务要新增修改数据会被阻塞。

当有 Next-Key Lock 的时候，使用 SHOW ENGINE INNODB STATUS 查看 数据库引擎日志会显示：

```bash
RECORD LOCKS space id 58 page no 3 n bits 72 index `PRIMARY` of table `test`.`t`
trx id 10080 lock_mode X
Record lock, heap no 1 PHYSICAL RECORD: n_fields 1; compact format; info bits 0
 0: len 8; hex 73757072656d756d; asc supremum;;

Record lock, heap no 2 PHYSICAL RECORD: n_fields 3; compact format; info bits 0
 0: len 4; hex 8000000a; asc     ;;
 1: len 6; hex 00000000274f; asc     'O;;
 2: len 7; hex b60000019d0110; asc        ;;
```

### Insert Intention Locks

Insert Intention Locks 是插入意向锁。它是一种间隙锁，由 INSERT 操作在行插入之前设置。插入意向锁名字虽然有意向锁，但是它并**不是意向锁，它是一种特殊的间隙锁，属于行级别锁，并且只用于并发插入**。

一个事务在插入一条记录的时候，需要判断插入位置是否已被其他事务加了间隙锁（next-key lock 也包含间隙锁）。如果有的话，插入操作就会发生**阻塞**，直到拥有间隙锁的那个事务提交为止（释放间隙锁的时刻），在此期间会生成一个**插入意向锁**，表明有事务想在某个区间插入新记录，但是现在处于等待状态。

当有 Insert Intention Locks 的时候，使用 SHOW ENGINE INNODB STATUS 查看 数据库引擎日志会显示：

```bash
RECORD LOCKS space id 31 page no 3 n bits 72 index `PRIMARY` of table `test`.`child`
trx id 8731 lock_mode X locks gap before rec insert intention waiting
Record lock, heap no 3 PHYSICAL RECORD: n_fields 3; compact format; info bits 0
 0: len 4; hex 80000066; asc    f;;
 1: len 6; hex 000000002215; asc     " ;;
 2: len 7; hex 9000000172011c; asc     r  ;;...
```



## 如何避免死锁

**1.设置事务等待锁的超时时间**

当一个事务的等待时间超过该值后，就对这个事务进行回滚，并释放锁。另一个事务就可以继续执行。

在 InnoDB 中，参数 `innodb_lock_wait_timeout` 是用来设置超时时间的，默认值时 50 秒。

**2.开启主动死锁检测**

主动死锁检测在发现死锁后，主动回滚死锁链条中的某一个事务，让其他事务得以继续执行。

在 InnoDB 中，参数 `innodb_deadlock_detect` 设置为 on开启死锁检测。



## 参考

https://www.cnblogs.com/keme/p/11065025.htm