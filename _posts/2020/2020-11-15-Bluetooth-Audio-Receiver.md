---
title: 把你的Windows 10电脑变成蓝牙音箱
date: "2020-11-14 22:37:00"
tags: [Windows]
category: blog
---
众所周知，Windows 10的蓝牙和Android比就是一个残废，例如不能自动检测是否有文件传入，连接繁琐，操作麻烦等等，但是今天闲来无事逛Microsoft商店突然发现了一个软件实现了我这几年一直想要的功能：Bluetooth Audio Receiver

<!-- more -->

![20201114220100](//static.nykz.org/blog/images/2020-11-15/20201114220100.avif "candark")

![Screenshot\_20201114-215502\_Settings](//static.nykz.org/blog/images/2020-11-15/Screenshot__20201114-215502__Settings.avif "candark")

这款软件非常简洁，只需要在双方连接蓝牙后，选择蓝牙设备，点击开始链接，此时手机上就可以将Windows 10电脑当作蓝牙音频输入设备，实现在手机上选歌，电脑上播放。

以往想要在手机上控制电脑音乐播放只能使用Windows Media Player的DLNA，或者如foobar 2000这种支持远程控制的第三方音乐软件，或者是使用Samsung Dex/Flow等投屏方式。

前两种缺点很明显：DLNA需要手机上的播放软件支持，并且由于DLNA实际上是采用了缓存整个音频文件的方式，并且连接不稳定，所以经常播放遇到错误；而fb2k需要额外设置，并且手机上的控制器并不是很好看。

Samsung Dex/Flow本质上是用来投屏的，所以并不能说很适合。

我目前手机上用的本地播放器是Stellio Player，这个播放器非常好看，支持中文明暗主题，操作上也非常符合我的习惯，但是不支持DLNA。

这个Bluetooth Audio Receiver则彻底解决了这个问题，只需要简单的几步就可以实现非常好的效果，对我来说堪称神软。

由于Windows 10在2004版才支持A2DP Sink，即蓝牙音频输入，所以这款软件只支持在2004及更高设备上使用，目前支持SBC 44.1khz和16bit播放，虽然规格低了一点，不过够用了，并且由于是通过系统API进行播放，所以CPU和内存占用极低（完全无感，不到1% 的CPU占用和10 MB的内存占用）。
