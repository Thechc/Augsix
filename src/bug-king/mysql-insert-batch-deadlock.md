---
title: MySQL-生产环境批量插入死锁
order: 3
author: Thechc
category: 
  - mysql
tag:
  - 死锁
  - BUG
star: true
---

## 线上 MySQL 告警

某天钉钉消息推送 MySQL 线上环境报错信息，在批量插入商品图片的时候报错。信息如下：

![](http://image.augsix.com/materials/mysql/mysql-deadlock-batchInsert.jpg) 

> 从异常信息上可以看出是数据库发生了死锁：
>
> com.mysql.cj.jdbc.exceptions.MySQLTransactionRollbackException: Deadlock found when trying to get lock; try restarting transaction。

## 异常场景

**业务逻辑：**

这块的业务是从第三方平台拉取当天修改的商品信息，在自己的平台上找到对应的商品进行修改。

**代码逻辑：**

1. 因为第三方提供的是修改商品的分页数据接口。所以在逻辑上会先尝试一次小数据分页请求，拿到修改商品的总数量。
2. 多线程请求接口获取修改的商品，每个线程中获取 100 条商品。
3. 在每个线程中的 100 商品，通过商品 id 在线程中另外请求接口获得对应的 图片、sku、价格等详情数据。
4. 对于商品图片的更新，采用的是先删除已存在的数据在插入。

## 死锁日志

```bash
------------------------
LATEST DETECTED DEADLOCK
------------------------
2023-11-20 14:00:29 0x7faca7418700
*** (1) TRANSACTION:

TRANSACTION 1622664, ACTIVE 25 sec inserting

mysql tables in use 1, locked 1
LOCK WAIT 194 lock struct(s), heap size 41168, 3776 row lock(s), undo log entries 665
MySQL thread id 3028602, OS thread handle 140379486066432, query id 136517526 10.180.208.118 m2b_app update

/* Mapper Position => com.xxx.website.micro.service.m2b.admin.bizz.product.dao.mapper.CommodityImageMapper.insertBatch */ 
insert into commodity_image (commodity_id,`name`,`type`, url , sort,creator_id, create_time, modifier_id, modify_time )
        values         
            (45071, '032217', 1, 'http://img2.xxx.com/M00/32/F4/rB8BW2LSUtqAQPWLAAL1ZsD0YHQ598.jpg', 1,
            null, '2018-10-31 01:22:04.0',null,null
            )
         , 
            (48059, '038372', 1, 'https://img-openroad.xxx.com/image/e23af208-efdb-42a3-bd87-f1b73a502136.jpg', 1,
            null, '2018-10-31 07:52:32.0',null,null
            )
         , 
            (46579, '041174', 1, 'http://img2.xxx.com/M00/08/78/wKgABVxqgMqAIPopAABf3wytHrA111.jpg', 1,
            null, '2018-10-31 01:22:14.0',null,null
            )
         , 
            (46579, '041174', 1, 'http://img2.xxx.com/M00/0

*** (1) WAITING FOR THIS LOCK TO BE GRANTED:

RECORD LOCKS space id 37 page no 690 n bits 1096 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622664 lock_mode X locks gap before rec insert intention waiting
Record lock, heap no 590 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee3e; asc    >;;

*** (2) TRANSACTION:

TRANSACTION 1622679, ACTIVE 2 sec inserting

mysql tables in use 1, locked 1

295 lock struct(s), heap size 57552, 909 row lock(s), undo log entries 589
MySQL thread id 3028607, OS thread handle 140379517191936, query id 136518020 10.180.208.118 m2b_app update

/* Mapper Position => com.xxx.website.micro.service.m2b.admin.bizz.product.dao.mapper.CommodityImageMapper.insertBatch */ 
insert into commodity_image (commodity_id,`name`,`type`, url , sort,creator_id, create_time, modifier_id, modify_time )
        values
            (124461, '443990', 1, 'http://img4.xxx.com/M00/08/1B/wKgABVxqdK-AWv5gAABkwv3j3Xo071.jpg', 1,
            null, '2018-10-31 01:22:08.0',null,null
            )
         , 
            (124461, '0', 2, 'http://img4.xxx.com/M00/08/1B/wKgABVxqdK-AWv5gAABkwv3j3Xo071.jpg', 0,
            null, '2018-10-31 01:22:08.0',null,null
            )

*** (2) HOLDS THE LOCK(S):

RECORD LOCKS space id 37 page no 690 n bits 1096 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622679 lock_mode X
Record lock, heap no 590 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee3e; asc    >;;



Record lock, heap no 773 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee3f; asc    ?;;

Record lock, heap no 774 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee40; asc    @;;

Record lock, heap no 775 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee41; asc    A;;

Record lock, heap no 776 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee42; asc    B;;

*** (2) WAITING FOR THIS LOCK TO BE GRANTED:

RECORD LOCKS space id 37 page no 2619 n bits 1176 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622679 lock_mode X insert intention waiting

Record lock, heap no 1 PHYSICAL RECORD: n_fields 1; compact format; info bits 0

 0: len 8; hex 73757072656d756d; asc supremum;;

*** WE ROLL BACK TRANSACTION (1)

```

### 事务一信息

**1.事务信息：**

```bash
*** (1) TRANSACTION:

TRANSACTION 1622664, ACTIVE 25 sec inserting

mysql tables in use 1, locked 1
LOCK WAIT 194 lock struct(s), heap size 41168, 3776 row lock(s), undo log entries 665
MySQL thread id 3028602, OS thread handle 140379486066432, query id 136517526 10.180.208.118 m2b_app update

/* Mapper Position => com.xxx.website.micro.service.m2b.admin.bizz.product.dao.mapper.CommodityImageMapper.insertBatch */ 
insert into commodity_image (commodity_id,`name`,`type`, url , sort,creator_id, create_time, modifier_id, modify_time )
        values         
            (45071, '032217', 1, 'http://img2.xxx.com/M00/32/F4/rB8BW2LSUtqAQPWLAAL1ZsD0YHQ598.jpg', 1,
            null, '2018-10-31 01:22:04.0',null,null
            )
         , 
            (48059, '038372', 1, 'https://img-openroad.xxx.com/image/e23af208-efdb-42a3-bd87-f1b73a502136.jpg', 1,
            null, '2018-10-31 07:52:32.0',null,null
            )
         , 
            (46579, '041174', 1, 'http://img2.xxx.com/M00/08/78/wKgABVxqgMqAIPopAABf3wytHrA111.jpg', 1,
            null, '2018-10-31 01:22:14.0',null,null
            )
         , 
            (46579, '041174', 1, 'http://img2.xxx.com/M00/0
```

该段为事务一的信息， 1622664 为事务一的 id，并且存活了 25 秒。

**2.等待的锁：**

```bash
*** (1) WAITING FOR THIS LOCK TO BE GRANTED:

RECORD LOCKS space id 37 page no 690 n bits 1096 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622664 lock_mode X locks gap before rec insert intention waiting
Record lock, heap no 590 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee3e; asc    >;;
```

该段表示当前事务正在等待某个锁资源。

`RECORD LOCKS space id 37 page no 690 n bits 1096 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622664 lock_mode X locks gap before rec insert intention waiting`

这是对等待的锁资源的详细描述。在这个例子中，锁定的资源是`m2b`数据库中的`commodity_image`表的`idx_commodity_id`索引。该事务以"X"（Exclusive，独占）模式请求了这个锁，它在等待其他事务释放在待插入记录之前的间隙锁（gap lock）。这种锁的意图是在插入新记录之前保护记录间的间隙，以防止其他事务插入相同的记录。

### 事务二信息

**1.事务信息：**

```bash
*** (2) TRANSACTION:

TRANSACTION 1622679, ACTIVE 2 sec inserting

mysql tables in use 1, locked 1

295 lock struct(s), heap size 57552, 909 row lock(s), undo log entries 589
MySQL thread id 3028607, OS thread handle 140379517191936, query id 136518020 10.180.208.118 m2b_app update

/* Mapper Position => com.xxx.website.micro.service.m2b.admin.bizz.product.dao.mapper.CommodityImageMapper.insertBatch */ 
insert into commodity_image (commodity_id,`name`,`type`, url , sort,creator_id, create_time, modifier_id, modify_time )
        values
            (124461, '443990', 1, 'http://img4.xxx.com/M00/08/1B/wKgABVxqdK-AWv5gAABkwv3j3Xo071.jpg', 1,
            null, '2018-10-31 01:22:08.0',null,null
            )
         , 
            (124461, '0', 2, 'http://img4.xxx.com/M00/08/1B/wKgABVxqdK-AWv5gAABkwv3j3Xo071.jpg', 0,
            null, '2018-10-31 01:22:08.0',null,null
            )

```

该段为事务二的信息， 1622679为事务一的 id，存活了 2 秒。

**2.持有的锁**

```ba
*** (2) HOLDS THE LOCK(S):

RECORD LOCKS space id 37 page no 690 n bits 1096 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622679 lock_mode X
Record lock, heap no 590 PHYSICAL RECORD: n_fields 2; compact format; info bits 32

 0: len 4; hex 80005730; asc   W0;;
 1: len 4; hex 83d5ee3e; asc    >;;

```

该段表示事务二已经成功获取并持有了某个锁资源，事务持有了`m2b`数据库中的`commodity_image`表的`idx_commodity_id`索引的锁。锁的模式为"X"（Exclusive，独占）模式。并且使用Next-Key Lock来保护索引范围的一致性。这与事务一种等待锁的表述信息一致。

- 如果 lock_mode为 `X`，说明是 next-key 锁；
- 如果 lock_mode为 `X, BUT_NOT_GAP`，说明是记录锁；
- 如果 lock_mode为 `X, GAP`，说明是间隙锁；

**3.等待的锁**

```ba
*** (2) WAITING FOR THIS LOCK TO BE GRANTED:

RECORD LOCKS space id 37 page no 2619 n bits 1176 index  idx_commodity_id of table `m2b`.`commodity_image` trx id 1622679 lock_mode X insert intention waiting

Record lock, heap no 1 PHYSICAL RECORD: n_fields 1; compact format; info bits 0

 0: len 8; hex 73757072656d756d; asc supremum;;
```

该段为事务二等待的锁资源。锁定的资源是`m2b`数据库中的`commodity_image`表的`idx_commodity_id`索引。该事务以"X"（Exclusive，独占）模式并且插入意向锁（insert intention）的方式获得了这个锁。它在等待其他事务释放或授予该索引上的锁资源，以便进行插入操作。也就是事务一持有的锁。

## 异常分析

在`Innodb`引擎中，Insert 正常情况下是不加锁的，它是靠聚簇索引记录自带的 trx_id 隐藏列来作为**隐式锁**来保护记录的。

当事务需要加锁的时，如果这个锁不可能发生冲突，InnoDB会跳过加锁环节，这种机制称为隐式锁。

但是如果插入数据前记录已经被加了间隙锁，这时候隐式锁就无效，隐式锁变为显式锁。

在上面的死锁日志中，事务二持有 **Next-Key 锁**，Next-Key 锁由间隙锁和记录锁组成，假设最后一条记录的 id (在本场景中是 commodity_id 索引键)为 10，那么事务二持有 [10,+∞) 的锁，然后从事务二等待的锁`lock_mode X`，可以判断事务一应该也是也是持有的 **Next-Key 锁** (两个间隙锁是不冲突的，间隙锁作用域阻止锁定区间有数据插入)。然后两个事务对自己锁得区间插入数据，插入的时候发现区间被其他事务也加了间隙锁，这时候事务会先加上**插入意向锁（ *Insert intention*）**，加上插入意向锁之后事务开始等待。

![](http://image.augsix.com/materials/mysql/mysql-mydeadlock.png)

这就是两个事务的**插入意向锁**在等待对方的 **Next-Key 锁**释放导致的死锁。

## 解决方法

既然产生的原因是因为批量插入导致的死锁，可以将插入的粒度减小。将查询到要修改的数据加入到消息队列中，一个一个消费去更新商品数据就不会了。






---



当 MySQL 发生死锁的时候，如何查看死锁日志？

## 自动打印死锁日志

MySQL 系统内部提供一个 `innodb_print_all_deadlocks` 参数，该参数默认是关闭的，开启后可以将死锁信息自动记录到 MySQL 的错误日志中。 

```bash
# 查看参数是否开启
mysql> show variables like 'innodb_print_all_deadlocks';
+----------------------------+-------+
| Variable_name              | Value |
+----------------------------+-------+
| innodb_print_all_deadlocks | OFF   |
+----------------------------+-------+

# 开启innodb_print_all_deadlocks,此参数是全局参数，可以动态调整。记得要加入到配置文件中
mysql> set global innodb_print_all_deadlocks = 1;
Query OK, 0 rows affected (0.00 sec)

mysql> show variables like 'innodb_print_all_deadlocks';
+----------------------------+-------+
| Variable_name              | Value |
+----------------------------+-------+
| innodb_print_all_deadlocks | ON    |
+----------------------------+-------+
```

建议将 `innodb_print_all_deadlocks` 参数设置为 1 ，这样每次发生死锁后，系统会自动将死锁信息输出到错误日志中。

## 手动打印死锁日志

还有一种就是使用 `show engine innodb status` 命令查看死锁日志，其中 LATEST DETECTED DEADLOCK 部分显示的最近一次的死锁信息。打印的日志如下：