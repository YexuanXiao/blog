---
title: HTML5播放器
date: "2020-08-03 08:25:00"
tags: [Windows,UWP,docs]
category: blog
---
Flash已经寿终正寝，HTML 5才是时代潮流。

<!-- more -->

DIYgod开发的DPlayer作为一个轻量级HTML 5播放器是不二的选择。

项目地址：https://github.com/MoePlayer/DPlayer

DPlayer配合HLS.js还可以做到播放m3u8。

只需要引入https://cdn.jsdelivr.net/npm/hls.js@0.14.7/dist/hls.min.js

https://cdn.jsdelivr.net/npm/dplayer@1.26.0/dist/DPlayer.min.js

设置一个id为dplayer的元素，并初始化播放器，即可播放m3u8(ts)。

```javascript

const dp = new DPlayer({
    container: document.getElementById('dplayer'),
    video: {
        url: 'index.m3u8',
        type: 'hls',
    },
    pluginOptions: {
        hls: {
            // hls config
        },
    },
});
console.log(dp.plugins.hls); 

```

使用ffmpeg可以方便的将视频分割成ts流：

```powershell

ffmpeg -i input.file -start_number snumber -f hls -hls_list_size 0 -threads tnumber -hls_time seconds index.m3u8

```

- snumber: 起始编号
- tnumber: 线程数
- seconds: 每一个ts包含的视频时间
- 0: 索引全部片段，请勿修改

使用m3u8优点:每段ts都是独立的视频，分段加载节省流量；保证DTS和PTS同步，防止拖动进度条时卡顿。
