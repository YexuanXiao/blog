---
title: 减小WSL镜像文件占用
date: "2021-04-23 23:47:00"
tags: [Windows,VHD,diskpart,docs,WSL]
category: blog
---
WSL的Linux发行版都是储存在vhdx中的，而删除vhdx中的文件实际上不会减小vhdx的体积，需要手动释放。

<!-- more -->

1. Linux发行版的镜像文件默认安装在 `"%USERPROFILE%\AppData\Local\Packages\"` ，可通过Explorer访问这个目录。

2. 搜索vhdx，其中ext4.vhdx就是想要的文件。

3. 把ext4.vhdx剪贴到C盘根目录，这样方便操作。

4. PowerShell依次如下代码：

   ```powershell
   
   wsl --shutdown
   diskpart
   # open window Diskpart
   select vdisk file="C:\ext4.vhdx"
   attach vdisk readonly
   compact vdisk
   detach vdisk
   exit
   
   ```
