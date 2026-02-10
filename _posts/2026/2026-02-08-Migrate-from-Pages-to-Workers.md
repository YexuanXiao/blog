---
title: 从Cloudflare Pages迁移静态博客到Workers
date: "2026-02-08 04:53:00"
tags: [docs]
category: blog
---
Cloudflare去年开始就宣布不再维护Pages，推荐迁移到Workers，今年甚至已经把创建Pages的入口变成了创建Worker页面底部的一行字，因此迁移到Workers确实需要划入日程。

<!-- more -->

本文假定使用的博客框架是静态博客，并且使用Cloudflare提供的Github/Gitlab绑定。

实际上迁移方法非常简单：

1. 在仓库根目录中添加一个wrangler.json或者wrangler.toml。

2. 创建一个Workers应用，选择Github或者Gitlab，然后编辑构建命令，对于Jekyll来说是 `bundle install && bundle exec jekyll build`，对于Node.js来说是 `npm run build`，然后取消“非生产分支构建”复选框。

3. 点击部署即可将博客部署在Cloudflare Worker上。

4. 如果你先前在Wrangler配置文件中不使用Cloudflare提供的域名，此时需要在Worker设置中手动添加需要的域名。

5. 此时，可以检查博客是否正常运行，然后就可以删除过时的Pages应用。

wrangler.json的例子如下：

```json
{
    "name": "blog",
    "compatibility_date": "2026-02-08",
    "workers_dev": false,
    "preview_urls": false,
    "assets": {
        "directory": "_site",
        "not_found_handling": "404-page"
    }
}
```

其中 `name` 字段需要在后续步骤匹配Workers的项目名，注意它可以和现有的Pages项目名重名。

`compatibility_date` 字段是必须的，可以和我一样填为 `2026-02-08`。

`worker_dev` 字段决定是否开启Cloudflare提供的project.user.workers.dev域名，如果有自己的域名，设置为 `false`。

`preview_urls` 字段决定是否开启Cloudflare提供的非生产环境域名，一般不需要所以设置为 `false`。

`assets.directory` 字段用于设置静态网站构建目录，一般来说是 `_site` 或者 `dist`。

`assets.not_found_handling` 用于控制404页面，它可以被设置为 `single-page-application`、`404-page` 或者 `none`，如果设为 `none` 则使用Cloudflare提供的404页面，如果设置为 `404-page` 则会使用构建目录下的404.html。

Wrangler配置文件的文档在 [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)。