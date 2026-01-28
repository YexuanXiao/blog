---
title: C/C++地址原理以及指针再探
date: "2021-04-07 13:10:00"
tags: [C++,C,docs]
category: blog
---
众所周知，程序是加载到内存中执行的，而内存中的一切都有唯一的地址，即内存中的一切数据都可以用指针访问。本文目前主要介绍指针的两种特殊用法：对指针取地址以及函数指针，并简单讲述CPU，**内存，地址和指针**之间的关系。

<!-- more -->

## 内存和地址

实际上，现代的32位CPU或者64位CPU中的32，64并不是一个概念十分明确的词。

对于早期的一些8位，16位CPU来说，8，16指的是通用寄存器大小，数据总线宽度等等。

网上有些人说字长是指汇编语言中每一条指令的最大操作数，实际上这也不是根本，因为操作数需要保存到寄存器。

到了现代，x86以及x64，x86\_64等CPU平台，寄存器并不都是一个大小，使用时按需选择合适大小的寄存器，指令的最大操作数也不一样。

C语言中，32位程序中的指针（地址）是一个32位的二进制数，而64位程序中地址是一个64位二进制数。

这是因为，CPU中用来用来存储CPU要读取指令的地址的EIP寄存器的容量是32位或者64位（注意，起决定性作用的还是EIP寄存器）。

**32位地址所能表示的内存空间最高是4GB**。

而在现代操作系统中，大部分软件中通过指针得到的地址实际上不是真正在物理内存上的地址，只有操作系统内核和驱动可以直接操作物理内存。

对于C语言的程序来说，地址的大小一般由编译器决定，或者让编译器决定，否则移植过程中会出现问题。

## 指针两种特殊用法

### 修改指针的地址

由于传递指针实际上是传递指针中储存的地址，因此，函数单纯调用指针是不能修改指针指向的地址的，并且如果该指针是一个野指针，还会发生严重的内存错误。

有两种手段可以通过函数修改指针指向的地址：

#### 使用返回值修改指针的地址

这种方法是一种很好理解的方法，最常见的就是malloc函数，malloc函数正是返回一个地址，然后就可以把返回的地址赋给指针。

示例：

```cpp
#include <stdlib.h>

int main (void) {
    int *b = (int *)malloc(sizeof(int));
}
```

当然也可以自定义一个返回地址的函数：

```cpp
#include <malloc.h>

void *add (size_t);

int main (void) {
    int *b = (int *)add(sizeof(int));
}

void *add (size_t n) {
    return malloc(n);
}
```

**size\_t是一个和平台相关的类型，在32位下可储存32位 二进制数，在64位 下可储存64位二进制数**。

add函数只是对malloc函数的一个封装，malloc函数接受一个最大不超过**指针最大大小**的参数，即malloc分配小于可使用内存的大小的内存。

malloc的返回值是一个 **void**\* 类型的指针，也就是一个地址。

add函数在使用上和malloc函数保持一致。

#### 使用指向指针的指针修改指针指向的地址

这种方式其实稍微具有迷惑性，不过理解后你会发现它很简单。但是某些情况下确实不利于阅读，容易造成误解。

先看一段简单的代码：

```cpp
int change (int **,int *);

int main (void) {
    int a;
    int *b;
    b = &a; // 对a取地址得到a的地址存入b
    change(&b,&a);//传入a和b的地址
}

void change (int **c,int *d) {
    *c = d; // 把c中储存指针储存的地址改成d
}
```

正如change的声明所述，c是一个指向指针的指针，也就是二级指针，\*c是对c的解引用，也是一个指针。

```cpp
void change (int **,int *);

int main (void) {
    int a;
    int *b;
    b = &a; // 对a取地址得到a的地址存入b
    change(b,&a);//传入a和b的地址//注意这行和上面的代码有什么区别
}
void change (int **c,int *d) {
    *c = d; // 把c中储存指针储存的地址改成d
}
```

如果直接把b传给change，由于在main函数中b只经过声明，没有赋值（初始化），所以在执行change函数之前，b是一个野指针，野指针的内容无法控制，代表着实际调用是这样的 `change(没人知道是啥，&a)`，此时程序是错误的。

这种方式的迷惑之处在于当你使用了typedef时：

```cpp
typedef int INT;
typedef int* INT_p;

void change (INT_p *,INT *);

int main (void) {
    INT a;
    INT_p b;
    change(&b,&a);
}
void change (INT_p *c,INT_p d) {
    *c = d;
}
```

你会发现，这样的代码十分难懂，最过分的事情还在下面：

- `typedef int* INT_p`
- `typedef int *INT_p`
- `typedef INT *INT_p`

和

- `void change (INT_p *c,INT_p d)`
- `void change (INT_p *c,INT_p d)`
- `void change (int** c,INT_p d)`
- `void change (int** c,INT_p d)`

这些段落都是等价的！

### 函数指针

#### 一般函数指针

看下面的代码（GCC通过，VS 2019通过）：

```cpp
#include <stdio.h>

int test(int a);

int main(void){
    int (*fp)(int a); // 声明指针fp
    fp = test;
    printf("%d",fp(2));
}
int test(int a){
    return a;
}
```

函数指针和函数声明的区别是把函数名加星号括起来。

函数的调用实际上也是通过地址，所以函数指针使用的时候不需要解引用，即 `fp(2)` 和 `(*fp)(2)` 等价。
