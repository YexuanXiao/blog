---
title: 开源1 - 操作系统历史
date: "2021-06-06 16:38:00"
tags: [opensource]
category: blog
---
如果要说出计算机软件领域伟大的思想，那么开源肯定在其中占据重要的一席之地，本篇是讲述开源的第一篇，从操作系统历史讲述开源。

<!-- more -->

## 操作系统历史

### Multics计划

在早期计算机中，实际上不存在现代意义的**操作系统**（Operation System），在计算机上只有有限的程序和有限的功能，每个公司推出的计算机各不相同，在某一个品牌的计算机上的软件不能用在其他计算机上，并且可移植性很差。

1964年，麻省理工，通用电气和 **AT\&T**的贝尔实验室，共同发起了一个Multics计划。Multics目的是开发设计一个可以运行各类复杂，大型，多任务的程序并且可靠的操作系统，这也是**现代操作系统理念的雏形**。

### Unix的诞生

由于Multics进展缓慢，贝尔实验室退出计划。在贝尔实验室任职，加州大学伯克利分校毕业的的工程师Ken Thompson和Dennis Ritchie在此基础上继续开发，在1970年使用B语言开发出了第一版Unix系统。1971年两人共同**发明了C语言**，并在1973年用C语言重写了Unix。C语言代码简洁可移植性高，为Unix的发展提供了动力。

### BSD的诞生

由于第一版Unix的作者是在贝尔实验室任职期间开发的Unix，目的也是给AT\&T开发，所以这时的Unix属于AT\&T。为了摆脱AT\&T的版权控制，加州大学伯克利分校在1974年开发了基于Unix的操作系统 **BSD**（Berkeley Software Distribution），包括Unix的部分和一些新的软件。之后BSD着手去除原始Unix的代码。BSD的主要负责人是Bill Joy，他在1988年发布了BSD License，将去除原始Unix代码的BSD正式开源。

### GNU的诞生

虽然BSD通过重写Unix避免了直接的版权问题，但是AT\&T仍认为自己持有BSD的一部分版权，为了减少纠纷，伯克利分校规定，BSD只能免费提供给持有AT\&T许可的公司，这大大阻碍了BSD的发展。

实际上，由于反垄断法，**最早AT\&T并不能出售Unix以赚取收入**。

1983年，Richard Stallman发布了**GNU计划以及GNU宣言**，宣布开发一个完全独立，和Unix没有任何版权关系但是目标是兼容Unix的操作系统。GNU即GNU’s Not Unix的递归简写。同时第一版 **GNU Public License**协议诞生。

### Linux的诞生

1991年，Linus Torvalds在芬兰赫尔辛基大学上学时，对操作系统很好奇。他对MINIX只允许在教育上使用很不满（在当时MINIX不允许被用作任何商业使用），于是他便开始写他自己的操作系统内核，这就是后来的Linux。Linus Torvalds最早在MINIX上开发Linux，为MINIX写的软件也可以在Linux内核上使用。后来使用GNU软件代替MINIX的软件，因为使用从GNU来的源代码可以自由使用，这对Linux的发展有益。**为了让Linux可以在商业上使用，Linus Torvalds决定更改他会限制商业免费使用的原来的协议，以GPL协议来代替**。Linux实际上不是GNU计划的一部分。

在当时，Richard Stallman仅完成了部分操作系统的软件的开发的工作，包括GNU自己的C语言编译器GCC，调试器GDB，IDE Emacs，唯独没有自己的完善的操作系统内核，GNU自己的内核GNU Hurd直到1991年都不能使用。

由于1984年AT\&T被肢解，导致之前的反垄断承诺失效，**AT\&T得以重新进入计算机市场**。虽然Unix并不赚钱，但是AT\&T依旧起诉了使用BSD的商业公司，而这场官司等到1992年才“解决”，因此BSD错过了发展的最佳时机，被Linux代替。

### 其他操作系统

微软早期曾经购买AT\&T的Unix授权后开发商业OEM操作系统Xenix OS卖给计算机生产商。微软中期为IBM公司的计算机开发MS-DOS商业操作系统。后来微软独立开发并出售Windows软件，Windows并不是模仿Unix或者由Unix衍生而来的操作系统。

苹果电脑内置的 "mac" 操作系统衍生自BSD。

Unix较为知名的模仿和衍生者时间线如下：

![Unix Timeline](https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Unix_timeline.en.svg/1579px-Unix_timeline.en.svg.png "candark")

### 总结

早期操作系统大部分捆绑计算机销售，或者需要购买商业许可。BSD和GNU的出现使得计算机软件领域产生新的概念，即**免费，自由和开源**，关于这三点的内容将在专门的一节介绍。

参考：维基百科相关词条
