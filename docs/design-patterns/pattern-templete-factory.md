---
title: 模板模式优化多平台商品下载
order: 1
author: Thechc
category: Pattern
tag:
  - 设计模式,模版,策略
star: true
---

## 问题

在项目中有这样一个业务，为了增加自己平台的商品丰富度，需要从 1688平台拉取商品数据，并保存到自己的平台中。

```java
//  伪代码实现
public void download1688Commodity() {
    // 1. 从1688平台下载商品
    query1688Commodity();
    // 2. 将1688平台商品转换为自己平台的商品数据
    transform1688Commodity();
    // 3. 保存商品数据
    save1688Commodity();
    // 4. 发送关注商品请求
    send1688FollowCommodityRequest();
}
```

在后续的业务中又引入了OMS平台商品，于是对代码进行修改。

```java
public void downloadThirdPartyCommodity(String platform) {
  if (platform.equals("ALIBABA")) {
    // 1. 从1688平台下载商品
    query1688Commodity();
    // 2. 将1688平台商品转换为自己平台的商品数据
    transform1688Commodity();
    // 3. 保存商品数据
    save1688Commodity();
    // 4. 发送关注商品请求
    send1688FollowCommodityRequest();
  } else if (platform.equals("OMS")) {
    // 1. 从Oms平台下载商品
    queryOmsCommodity();
    // 2. 将Oms平台商品转换为自己平台的商品数据
    transformOmsCommodity();
    // 3. 保存Oms商品数据
    saveOmsCommodity();
  }
}
```

虽然将需求实现了，但是如果后续又要加入抖音、小红书等其他平台的商品，这样写代码就会很臃肿。

![](http://image.augsix.com/materials/other/%E5%8F%88%E4%B8%8D%E6%98%AF%E4%B8%8D%E8%83%BD%E7%94%A8.jpeg)

## 优化方案

可以发现从第三方下载商品到平台的流程大致分为四步：

1. 请求第三方商品数据
2. 将第三方商品数据转换为自己平台的商品数据
3. 保存商品数据到数据库
4. 保存完后的操作（1688平台需要请求关注商品接口，来获得后续商品的修改信息进行同步）

其中第 1、2、4 为不同的业务逻辑、所以可以通过模版方法模式，各个平台执行自己的保存逻辑。另外再代码中很多` if ··· else可以通过策略模式来优化。

## 实现

首先每个策略都有一个对应一种策略类型，策略类型可以用枚举来表示。

```java
package com.chc.patterns.enums;

/**
 * @Author: thechc
 */
public enum  ThirdPartyPlatformEnum {

  /**
   * 平台
   */
  OMS(1, "oms"),
  ALIBABA(2, "1688"),
  XIAO_HONG_SHU(3, "小红书"),
  DOU_YIN(4, "抖音"),
  KUAI_SHOU(5, "快手");


  private Integer code;
  private String desc;

  ThirdPartyPlatformEnum(Integer code, String desc) {
    this.code = code;
    this.desc = desc;
  }

  public Integer getCode() {
    return this.code;
  }

  public String getDesc() {
    return desc;
  }


  public static ThirdPartyPlatformEnum getByCode(Integer code) {
    for (ThirdPartyPlatformEnum item : values()) {
      if (item.getCode().equals(code)) {
        return item;
      }
    }
    return null;
  }

  public static ThirdPartyPlatformEnum getByDesc(String desc) {
    for (ThirdPartyPlatformEnum item : values()) {
      if (item.getDesc().equals(desc)) {
        return item;
      }
    }
    return null;
  }
}
```

并且每个策略都有一个下载保存商品的方法。可以定义一个接口来作为下载保存商品入口。下载第三方商品时每个平台的请求参上不一样，可以定一个初始化上下文方法来传递对应的参数。

```java
package com.chc.patterns.service;

import com.chc.patterns.dto.DownloadCommodityContext;
import com.chc.patterns.enums.ThirdPartyPlatformEnum;

/**
 * 公共的下载接口
 * @Author: thechc
 */
public interface DownloadCommodityService {

  /**
   * 初始化下载商品的上下文
   * @param context
   */
  void init(DownloadCommodityContext context);

  /**
   * 类型
   *
   * @return 类型
   */
  ThirdPartyPlatformEnum accept();

  /**
   * 公共下载商品方法
   */
  void downloadCommodity();
}
```

```java
package com.chc.patterns.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * @Author: thechc
 */
@Data
@Builder
public class DownloadCommodityContext {

  /**
   * 假设为oms参数对象
   */
  private String omsParam;
  /**
   * 假设为小红书参数对象
   */
  private String xhsParam;
  /**
   * 假设为抖音参数对象
   */
  private String dyParam;
  /**
   * 假设为1688参数对象
   */
  private String alibabaParam;

  /**
   * 存放降保存平台商品的数据
   */
  private List<Object> commodities;

  /**
   * 存放三方平台商品的数据
   */
  private List<Object> thirdPartyCommodities;
}

```

接口定义后就可以让每个策略来实现的了，但是我们可以看到每个都有下载商品、转换商品、保存商品以及后续操作，虽然里面的业务逻辑不同但是流程是一样的所以这边可以用模版方法模式来定义流程。利用 Java 抽象类的特性，定义一个抽象的商品下载保存父类。

```java
package com.chc.patterns.service;

import com.chc.patterns.dto.DownloadCommodityContext;
import lombok.extern.java.Log;

import java.util.List;

/**
 * 下载模版
 *
 * @Author: thechc
 */
@Log
public abstract class AbstractDownLoadCommodityService implements DownloadCommodityService {

  protected DownloadCommodityContext context;

  @Override
  public void init(DownloadCommodityContext context) {
    this.context = context;
  }

  /**
   * 在抽象类中实现下载流程
   */
  @Override
  public void downloadCommodity() {

    // 1. 从第三方平台下载商品
    List<Object> thirdPartyCommodityList = queryCommodity();
    context.setThirdPartyCommodities(thirdPartyCommodityList);
    // 2. 将第三方平台商品转换为自己平台的商品数据
    List<Object> commodityList = transformCommodity();
    context.setCommodities(commodityList);
    // 3. 保存商品数据
    saveThirdPartyCommodity();
    // 4. 保存完后各个平台的梳理
    afterSave();
  }

  /**
   * 下载商品信息
   *
   * @return
   */
  protected abstract List<Object> queryCommodity();

  /**
   * 将第三方商品传唤为平台商品
   *
   * @return
   */
  protected abstract List<Object> transformCommodity();

  /**
   * 保存第三方商品数据（若保存逻辑差异很大、也可以将此方法抽离到对应的子类中实现）
   */
  public void saveThirdPartyCommodity() {
    log.info("抽象类中保存商品、sku、图片、分类、单位");
  }

  /**
   * 商品保存后的操作
   *
   * @return
   */
  protected abstract void afterSave();
}

```

接下去创建具体的策略实现类继承抽象类并重写对应的抽象方法，实现各个平台的业务逻辑。

```java
// 1688 商品下载实现类
package com.chc.patterns.service.impl;

import com.chc.patterns.enums.ThirdPartyPlatformEnum;
import com.chc.patterns.service.AbstractDownLoadCommodityService;
import lombok.extern.java.Log;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @Author: thechc
 */
@Service
@Log
public class AlibabaDownloadCommodityService extends AbstractDownLoadCommodityService {
  @Override
  protected List<Object> queryCommodity() {
    log.info("获取1688请求参数：" + context.getAlibabaParam());
    log.info("下载1688商品");

    return null;
  }

  @Override
  protected List<Object> transformCommodity() {
    log.info("转换1688商品为平台商品数据");
    return null;
  }

  @Override
  protected void afterSave() {
    log.info("保存商品后发消息到1688关注已保存的商品");
  }

  @Override
  public ThirdPartyPlatformEnum accept() {
    return ThirdPartyPlatformEnum.ALIBABA;
  }
}

```

```java
// oms 商品下载实现类
package com.chc.patterns.service.impl;

import com.chc.patterns.enums.ThirdPartyPlatformEnum;
import com.chc.patterns.service.AbstractDownLoadCommodityService;
import lombok.extern.java.Log;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @Author: thechc
 */
@Service
@Log
public class OmsDownLoadCommodityService extends AbstractDownLoadCommodityService {
  @Override
  protected List<Object> queryCommodity() {
    log.info("获取oms请求参数：" + context.getAlibabaParam());
    log.info("下载oms商品");
    return null;
  }

  @Override
  protected List<Object> transformCommodity() {
    log.info("转换oms商品为平台商品数据");
    return null;
  }

  @Override
  protected void afterSave() {
  }

  @Override
  public ThirdPartyPlatformEnum accept() {
    return ThirdPartyPlatformEnum.OMS;
  }
}
```

这样每个策略是有了各自的下载逻辑，接下来解决`if···else`的问题，我们可以定义一个工厂，工厂存放所有的策略，通过策略类型类获取到对应的策略。

```java
package com.chc.patterns.factory;

import com.chc.patterns.enums.ThirdPartyPlatformEnum;
import com.chc.patterns.service.DownloadCommodityService;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 下载 service 工厂，通过 ApplicationContextAware 在项目初始化的时候创建工厂
 * @Author: thechc
 */
@Component
@Lazy
public class ThirdPartyDownloadServiceFactory implements ApplicationContextAware {

  private static final Map<ThirdPartyPlatformEnum, DownloadCommodityService> DOWNLOAD_SERVICE_FACTORY_MAP = new HashMap<>(8);

  public DownloadCommodityService getService(ThirdPartyPlatformEnum thirdPartyPlatformEnum) {
    return DOWNLOAD_SERVICE_FACTORY_MAP.get(thirdPartyPlatformEnum);
  }

  @Override
  public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
    applicationContext.getBeansOfType(DownloadCommodityService.class)
        .values()
        .forEach(service -> DOWNLOAD_SERVICE_FACTORY_MAP.put(service.accept(), service));
  }
}

```

## 测试

```java
package com.chc.patterns.controller;

import com.chc.patterns.dto.DownloadCommodityContext;
import com.chc.patterns.enums.ThirdPartyPlatformEnum;
import com.chc.patterns.factory.ThirdPartyDownloadServiceFactory;
import com.chc.patterns.service.DownloadCommodityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;

/**
 * @Author: thechc
 */
@RestController
public class ThirdPartyCommodityController {

  @Autowired
  private ThirdPartyDownloadServiceFactory thirdPartyDownloadServiceFactory;

  @GetMapping("download-commodity/1688")
  public String download1688Commodity() {

    // 1.参数构建
    DownloadCommodityContext downloadCommodityContext = DownloadCommodityContext.builder()
        .commodities(new ArrayList<>())
        .alibabaParam("1688的请求参数")
        .build();
    // 开始下载第三方商品并保存
    DownloadCommodityService service = thirdPartyDownloadServiceFactory.getService(ThirdPartyPlatformEnum.ALIBABA);
    service.init(downloadCommodityContext);
    service.downloadCommodity();

    return "download 1688 success";
  }


  @GetMapping("download-commodity/oms")
  public String downloadCommodity() {

    // 1.参数构建
    DownloadCommodityContext downloadCommodityContext = DownloadCommodityContext.builder()
        .commodities(new ArrayList<>())
        .alibabaParam("oms的请求参数")
        .build();
    // 开始下载第三方商品并保存
    DownloadCommodityService service = thirdPartyDownloadServiceFactory.getService(ThirdPartyPlatformEnum.OMS);
    service.init(downloadCommodityContext);
    service.downloadCommodity();

    return "download oms success";
  }
}

```

启动项目

请求下载1688商品，控制台打印

```bash
INFO 36056 --- [nio-9527-exec-1] .c.p.s.i.AlibabaDownloadCommodityService : 获取1688请求参数：1688的请求参数
INFO 36056 --- [nio-9527-exec-1] .c.p.s.i.AlibabaDownloadCommodityService : 下载1688商品
INFO 36056 --- [nio-9527-exec-1] .c.p.s.i.AlibabaDownloadCommodityService : 转换1688商品为平台商品数据
INFO 36056 --- [nio-9527-exec-1] c.c.p.s.AbstractDownLoadCommodityService : 抽象类中保存商品、sku、图片、分类、单位
INFO 36056 --- [nio-9527-exec-1] .c.p.s.i.AlibabaDownloadCommodityService : 保存商品后发消息到1688关注已保存的商品
```

请求下载oms商品，控制台打印

```bash
INFO 36056 --- [nio-9527-exec-3] c.c.p.s.i.OmsDownLoadCommodityService    : 获取oms请求参数：oms的请求参数
INFO 36056 --- [nio-9527-exec-3] c.c.p.s.i.OmsDownLoadCommodityService    : 下载oms商品
INFO 36056 --- [nio-9527-exec-3] c.c.p.s.i.OmsDownLoadCommodityService    : 转换oms商品为平台商品数据
INFO 36056 --- [nio-9527-exec-3] c.c.p.s.AbstractDownLoadCommodityService : 抽象类中保存商品、sku、图片、分类、单位
```

