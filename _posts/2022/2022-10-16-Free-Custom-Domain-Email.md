---
title: 使用代发实现免费域名邮箱
date: "2022-10-16 08:59:00"
tags: [Web,docs]
category: blog
---
网上的域名邮箱教程大多数是基于第三方域名邮箱托管平台的，这些平台要不免费版受限，不然就得备案，或者付费，一年8刀到60刀不等，配置方法也比较复杂，先要注册账户，验证域名所属，然后改变DNS，然后下载专用邮件客户端或者付费开启IMAP和SMTP。本文提供一种思路免费获得永久使用的域名邮箱。

<!-- more -->

需要有Cloudflare和Microsoft账号，并把域名DNS托管到Cloudflare。

Cloudflare最近推出了电子邮件转发服务，可以把自己域名的电子邮件地址收到的邮件转发到其他邮件地址。而微软的Outlook支持别名服务，这意味着可以通过Outlook发送地址不为outlook.com的电子邮件（但是域仍然是outlook.com，收件方可以看到这一点）。所以使用Cloudflare的邮件转发 + Outlook的别名发送就可以假装成域名邮箱。

首先进入Cloudflare的控制台[主页](//dash.cloudflare.com)，点击托管的域名，打开左侧侧边栏，选择Email，然后第一次使用大概有个参与计划的设置，按照提示一步步进行即可。将custom@yourdomain的电子邮件转发到你的Outlook地址，注意，此时必须转发到已经存在的地址。

然后更改该域的DNS，增加一个名称为 @ 的TXT记录，内容为 `v=spf1 include:outlook.com ~all`，如果Cloudflare已经帮你自动生成了一个以 `v=spf1` 开头的TXT记录，就把这个记录改成上面的内容（实际上就是添加了一句 `include:outlook.com`）。注意，不要添加DMARC记录，如果Cloudflare默认生成了一个DMARC记录，需要删掉，否则会导致收件方认为你的电子邮件是虚假的（如果有可以正确添加DMARC的方式，请联系我）。

最后进入 [Microsoft账户 | 你的个人档案](//account.microsoft.com/profile)，点击编辑账户信息，添加电子邮件，地址填写Cloudflare电子邮件转发的源地址，然后按照提示验证电子邮件是你所有，这时候验证邮件就会被转发到Outlook中，进行验证即可。个人建议使用相同的电子邮件前缀。

这样别人给你的域名邮箱地址发送的邮件都会发到Outlook，如果需要回复，或者使用该邮件地址发送邮件，只需要使用Outlook客户端或者网页版，更改发件人地址即可。

更新：目前Outlook和Gmail都会定期屏蔽Cloudflare的转发服务器，原因可能是太多垃圾邮件，如果你的域名注册商是Namesilo，那么可以尝试用Namesilo自带的电子邮件转发。其他域名注册商也可能有类似服务。
