---
title: 索引失效的场景
order: 3
author: Thechc
category: mysql
tag:
  - 索引
star: true
---

## 对索引使用左或者左右模糊匹配

当我们使用左或者左右模糊匹配的时候，也就是 like %xx 或者 like %xx% 这两种方式都会造成索引失效。

比如下面的 like 语句，执行计划中的 type=ALL 就代表了全表扫描，而没有走索引。

![img](http://image.augsix.com/materials/mysql/indexInValid-like2.png)



![img](http://image.augsix.com/materials/mysql/indexInvalid-like3.png)

如果是查询 user_name 前缀为团团的用户，那么就会走索引扫描，执行计划中的 type=range 表示走索引扫描，key=idx_user_name 看到实际走了 idx_user_name 索引。

![img](http://image.augsix.com/materials/mysql/indexInvalid-like1.png)

为什么 like 使用左或者左右模糊匹配的时候会索引失效？

**因为索引 B+ 树是按照「索引值」有序排列存储的，只能根据前缀进行比较。使用左或者左右模糊匹配的时候，无法通过索引值知道从什么地方开始检索，只能全表扫描。**

> 要注意的是索引是否可以使用和数据量有关，如果数据量太大也会索引失效。
>
> 所以如果通过 like 'xx%' 查询出来的数据很大，也有可能会导致索引失效。

## 使用函数操作索引

我们会用一些 MySQL 自带的函数来得到我们想要的结果，这时候要注意了，如果查询条件中对索引字段使用函数，就会导致索引失效。

![](http://image.augsix.com/materials/mysql/indexInvalid-fx1.png)

为什么对索引使用函数，就无法走索引了呢？

**因为索引保存的是索引字段的原始值，而不是经过函数计算后的值，自然就没办法走索引了。**

> 不过，从 MySQL 8.0 开始，索引特性增加了函数索引，即可以针对函数计算后的值建立一个索引，也就是说该索引的值是函数计算后的值，所以就可以通过扫描索引来查询数据。
>
> alter table `user` add key idx_user_name_length ((length(user_name)));
>
> 这样上面的语句就可以走索引

## 对索引进行表达式计算

当我们对索引进行表达式计算时，会导致索引失效。type=ALL 表示走索引扫描

![](http://image.augsix.com/materials/mysql/indexInvalid-calc.png)

为什么对索引进行表达式计算，就无法走索引了呢？

**因为索引保存的是索引字段的原始值，而不是表达式计算后的值，所以无法走索引，只能全表扫描**



##  对索引隐式类型转换

如果索引字段是字符串类型，但是在条件查询中，输入的参数是整型的话，这条语句会索引失效走全表扫描。

![](http://image.augsix.com/materials/mysql/idnexInvalid-transform.png)

phone 字段为 varchant 类型，但是参数为整形，执行计划中 type=ALL 

![](http://image.augsix.com/materials/mysql/indexInvalid-transform2.png)

但是如果索引字段是整型类型，输入的参数即使字符串，不会导致索引失效，还是可以走索引扫描。

为什么对索引进行隐式类型转换，就无法走索引了呢？

**MySQL 在遇到字符串和数字比较的时候，会自动把字符串转为数字，然后再进行比较**。

## 组合索引不符合最左匹配原则

联合索引要能正确使用需要遵循**最左匹配原则**，也就是按照最左优先的方式进行索引的匹配。

比如，如果创建了一个 `(a, b, c)` 联合索引，如果查询条件是以下这几种，就可以匹配上联合索引：

- where a=1；
- where a=1 and b=2 and c=3；
- where a=1 and b=2；

> 需要注意的是，因为有查询优化器，所以 a 字段在 where 子句的顺序并不重要。

但是，如果查询条件是以下这几种，因为不符合最左匹配原则，所以就无法匹配上联合索引，联合索引就会失效:

- where b=2；
- where c=3；
- where b=2 and c=3；

有一个比较特殊的查询条件：where a = 1 and c = 3 ，符合最左匹配吗？

这种其实严格意义上来说是属于索引截断，不同版本处理方式也不一样。

MySQL 5.5 的话，前面 a 会走索引，在联合索引找到主键值后，开始回表，到主键索引读取数据行，Server 层从存储引擎层获取到数据行后，然后在 Server 层再比对 c 字段的值。

从 MySQL 5.6 之后，有一个**索引下推功能**，可以在存储引擎层进行索引遍历过程中，对索引中包含的字段先做判断，直接过滤掉不满足条件的记录，再返还给 Server 层，从而减少回表次数。

为什么联合索引不遵循最左匹配原则就会失效？

**原因是，在联合索引的情况下，数据是按照索引第一列排序，第一列数据相同时才会按照第二列排序。也就是说，如果我们想使用联合索引中尽可能多的列，查询条件中的各个列必须是联合索引中从最左边开始连续的列。如果我们仅仅按照第二列搜索，肯定无法走索引。**

## WHERE 子句中的 OR

在 WHERE 子句中，如果在 OR 前的条件列是索引列，而在 OR 后的条件列不是索引列，那么索引会失效。

user 表中 id 为主键， nick_name 为普通字段。可以看到 type=ALL，主键索引失效

![](http://image.augsix.com/materials/mysql/indexInvalid-or1.png)

在 or 条件查询下，想要主键不失效可以对非索引字段创建索引，就可以解决问题。在对 nick_name 字段正价索引后，执行计划变成下面这样：

![](http://image.augsix.com/materials/mysql/indexInvalid-or2.png)



## 参考

https://xiaolincoding.com/mysql/index/index_lose.html



