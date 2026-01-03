---
title: 如何删除Windows 10/11锁屏壁纸历史记录
date: "2025-09-09 00:32:00"
tags: [Windows, docs]
category: blog
---

很多用户都想删除Windows 10/11中自己添加的壁纸的历史，网络上有关删除桌面壁纸历史的教程大部分是对的，但是删除锁屏壁纸历史的教程大部分是错的（不论中英）。

<!-- more -->

大部分教程声称锁屏壁纸存储在以下路径：

`C:\Users\Administrator\AppData\Local\Packages\​Microsoft.Windows.ContentDeliveryManager_cw5n1h2txyewy​\LocalState\Assets`

但问题在于，很多用户（包括我自己）并不使用Administrator账户，甚至根本不存在 `C:\Users\Administrator\` 用户文件夹。大部分人的第一反应应该和我一样，把Administrator改成自己的用户文件夹，但很遗憾这个文件夹应该是空的，至少我本地是空的。这个方法可能仅适用于使用Administrator账户的人。

存在该问题也“情有可原”“情有可原”，因为系统壁纸本身属于多用户共享的内容。

翻了十几个网页后我最终找到了正确的教程[How to Find and Save Custom Lock Screen Background Images in Windows 10](https://www.tenforums.com/tutorials/130598-find-save-custom-lock-screen-background-images-windows-10-a.html)，锁屏壁纸缓存的实际位置在：
`C:\ProgramData\Microsoft\Windows\SystemData\<UserSID>\ReadOnly\LockScreen_<Letter>`

注意，访问该路径需要使用安全选项卡授予当前用户权限，可以按经验或者按教程解决该问题。每个 `LockScreen_<Letter>` 文件夹下会储存同一张壁纸的不同尺寸，删除需要SYSTEM权限，可以使用Dism++ 的春哥附体解决。

其中UserSID需要通过在注册表编辑器中导航至以下路径获取：
`HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList`，可以通过 `ProfileImagePath` 子项判断哪个SID是需要的。

UserSID的例子是 `S-1-5-21-1059779012-1815233613-4056510894-1001`

比较搞笑的是，不论原壁纸是什么格式，缓存文件一律使用 `.jpg` 扩展名（即使实际上是PNG）。
