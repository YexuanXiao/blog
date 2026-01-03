---
title: C++ std::reference_wrapper和std::ref
date: "2021-10-29 19:28:00"
tags: [C++, docs]
category: blog
---
std::reference\_wrapper是C++11开始添加的一个类模板，作用是将引用包装为一般对象，使之可以当作普通对象来储存和传递，std::ref是通过std::reference\_wrapper实现的辅助函数，用于自动构建std::reference\_wrapper临时对象。

<!-- more -->

之前的文章[C++ std::move](/blog/2021/09/23/Cpp-std-move/)提到过函数模板std::remove\_reference用于去除参数的引用，而[std::ref](https://zh.cppreference.com/w/cpp/utility/functional/ref)则刚好与其相反。

std::thread构造函数的第二个参数就是经过了std::remove\_reference的处理，因为std::thread通常期望将传入的参数复制一份传递给Callables，而引用在语义上不是一个真正的对象（在实现上，引用是可与其指向的对象进行区分的），仅仅作为原始对象的别名。

所以，如果希望将一个引用传递给std::thread，那么就必须使用[std::reference_wrapper](https://zh.cppreference.com/w/cpp/utility/functional/reference_wrapper)构建一个可传递的引用，为了简便书写，可直接使用std::ref函数，std::ref会将左值和左值引用统一为左值引用，然后将其装入std::reference\_wrapper，其使用方法和std::move类似。
