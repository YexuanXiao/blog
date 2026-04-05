---
title: C++/WinRT中的异步
date: "2025-12-21 11:21:00"
update: "2026-04-05 20:17"
tags: [C++, docs, Windows]
category: blog
---

该文章是对微软的C++/WinRT文档的补充，微软的文档比较全面的介绍了C++/WinRT中异步的基本概念和用法，但它在一些问题上仍然模糊不清。
在看这篇文章之前，应该先看[Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency)以及[Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2)，最好还可以看看我的C++协程教程。

<!-- more -->

### COM初始化

COM的线程分为STA和MTA两种，每个STA线程都关联到一个STA上下文，所有MTA线程共享一个MTA上下文。如果当前进程中有MTA线程，那么任何未明确初始化的线程是隐式的MTA线程。如果隐式MTA线程依赖的真MTA线程被反注册了，除非提前调用 `CoIncrementMTAUsage`，否则隐式MTA线程的COM对象会变成非法的。

C++/WinRT提供了 `winrt::init_apartment` 和 `winrt::uninit_apartment` 用于初始化和反初始化COM，但需要注意，它没有包装成RAII风格的类，因此请确保 `winrt::uninit_apartment` 调用时，没有COM对象还未完成释放。

线程可以重复使用相同上下文类型初始化，并且要有对应数量的反初始化。使用不同上下文类型重复初始化是错误的。在最后一个反初始化执行后，COM回到未初始化状态。一般来说，Win32线程池里的线程需要一致的使用MTA。

除了UWP的主线程外，所有线程都没有初始化COM，因此没有STA和MTA上下文可以使用。

一般来说，自己手动创建的线程既可以是STA也可以是MTA的，但Win32线程池的上下文应该使用MTA。

### 协程是积极启动的

C++/WinRT协程是积极启动的协程，这代表只要协程被调用，即使不使用 `co_await` 运算符获得它的结果，它也已经开始执行了。

在整个文章中，“C++/WinRT协程”指的都是返回 `IAsyncAction`，`IAsyncActionWithProgress`，`IAsyncOperation`,`IAsyncOperationWithProgress` 或者 `winrt::fire_and_forget` 的函数，其他时候“协程”泛指C++协程。

如果一个C++/WinRT协程的协程体是同步的，例如只有 `co_return` 语句，而没有其他 `co_await` 语句，那么调用该协程前后不会改变线程。

```cpp
// 使用co_await等待该协程不会改变线程
IAsyncAction foo()
{
    co_return;
}
```

积极启动的设计来源于WinRT本身，使得外部调用者可以使用取消代替等待（同步）来结束一个异步任务。

```cpp
auto task = AsyncTask();
// other sync or async code
if (canceled) {
	task.Cancel();
} else {
	co_await task;
}
```

也可以把 `task` 存起来。

### 切换线程的几种情况

任何 `co_await` 都潜在切换线程（即使不是C++/WinRT协程），这是 `co_await` 的原理导致的，但WinRT大部分标记为异步的函数不会导致切换线程，一个原因是它们可能内部是同步的，第二个原因是它们可以保存调用时的上下文，并在随后恢复，稍后会介绍这部分的细节。

C++/WinRT中会导致切换线程的情况包括：

1. 等待一段时间，例如 `co_await 1s`
2. 将任务转移到背景线程执行，例如 `co_await winrt::resume_background()`
3. 指定任务队列执行，例如 `co_await wil::resume_foreground(DispatcherQueue())`
4. 指定上下文执行，例如 `co_await context`，其中 `context` 是 `winrt::apartment_context`
5. 等待第三方 Awaiter
6. 等待子协程的结果，且子协程存在以上调用。注意第三方协程返回值可以使得协程启动时积极切换线程，不需要协程体内有以上调用

在执行以上表达式后，该协程会切换到另一个线程上执行。

在WinRT中，继承 `DependencyObject`（例如 `UIElement`）的类提供了让任务在指定线程运行的能力。传统WinRT（UWP）使用成员函数 `Dispatcher` 获得用于调度的Dispatcher对象，使用WindowsAppSDK的API时，应使用成员函数 `DispatcherQueue` 获得它。

注意，应该使用 `wil::resume_foreground` 而不是 `winrt::resume_foreground`，因为后者在失败时返回 `bool`，容易遗漏造成错误。

`winrt::apartment_context` 是C++/WinRT自己的功能，它在初始化时捕获当前COM的上下文。

### C++/WinRT 中的 COM 上下文

在WinRT中，UI线程和其他以STA初始化COM的线程是STA线程。UI类以及其他STA类必须在创建它的线程中执行它的成员函数。MTA类可以自由的在任何线程创建和执行，但必须手动确保没有竞争。

Dispatcher代表关联到该STA线程的一个消息队列。

`co_await wil::resume_foreground(DispatcherQueue())` 的作用是把当前协程放进该单线程消息队列中执行，当 `co_await` 返回后，线程就是该消息队列使用的线程。

`winrt::apartment_context` 当 `co_await context;` 返回时，如果 `context` 是STA上下文，那么协程会回到该上下文执行。如果 `context` 是MTA上下文，那么协程可以在任意后台线程（Win32线程池）中执行。

注意，`winrt::apartment_context` 存在一定局限：

| 调用者 | 目标 | 执行方式              |
|:------|:-----|:---------------------|
| MTA   | MTA  | 直接执行（共享上下文） |
| MTA   | STA  | 阻塞调用者执行        |
| STA0  | STA1 | 阻塞调用者执行        |
| STA0  | STA0 | 直接执行（相同上下文） |
| STA   | MTA  | 提交到线程池执行       |

需要同步到UI线程时，应该优先使用Dispatcher，因为它不会阻塞调用者（对应情况2和情况3）。

C++/WinRT协程会在调用的时候捕获当前上下文，然后在返回时尝试恢复它。因此，在UI线程中等待一个C++/WinRT协程，可以保证返回时一定还在UI线程。

### 编写异步委托

关于 C++/WinRT 委托的基本概念可以看C++/WinRT的[文档](https://learn.microsoft.com/zh-cn/windows/uwp/cpp-and-winrt-apis/handle-events)。

[C++/WinRT 中的强引用和弱引用](https://learn.microsoft.com/zh-cn/windows/uwp/cpp-and-winrt-apis/weak-references) 介绍了如何编写同步和异步委托，尤其是讲述了如何保持 `this` 有效。在它之前，我需要重新强调一下，在C++/WinRT中，你编写的这些成员函数的 `this` 指向实现类的而不是投影类的，因此`this`直接指向COM对象，而不是指向某种com_ptr。

传递 `winrt::auto_revoke` 时返回的Revoker实际上储存了一个弱引用，因此储存Revoker到 `this` 不会产生环。

在C++/WinRT中创建委托的方式有很多种，C++/WinRT允许lambda, 函数指针和对象指针作为委托，使用对象指针时，还需要额外传递一个对象。该模式非常经典，但当委托是协程时，有额外的问题需要注意。

由于委托通常不通过返回值传递结果（有极少数例外），并且委托通常不需要暴露在IDL中作为公开接口，因此异步委托实际上可以返回 `winrt::fire_and_forget` 而不是 `IAsyncAction`。但需要注意，`winrt::fire_and_forget` 在协程体抛出异常后会终止程序，如果你不想要这个行为，可以自己编写一个：

```cpp
struct fire_and_forget {
    struct promise_type {
        fire_and_forget get_return_object() const noexcept { return {}; }
        std::suspend_never initial_suspend() const noexcept { return {}; }
        std::suspend_never final_suspend() const noexcept { return {}; }
        void return_void() const noexcept {}
        void unhandled_exception() const noexcept {}
    };
};
```

在编写协程委托时，如果参数需要在发生线程切换后使用，那么就需要传递值而不是引用。在我的协程教程中讲过，协程的状态（协程帧）包括参数列表，因此参数列表中的对象在整个协程可见的生存期内都有效。如果某个参数不在函数体内使用，那么也可以写成引用。

```cpp
winrt::fire_and_forget foo(XXClass const&, XXEventArgs args) {
	co_await winrt::resume_background();
	(void)args.Index(); // 由于上一句发生了线程切换，因此args需要传递值而不是引用。
}
```

如果 `args` 是MTA的，还需要注意需要在合适的线程调用成员函数。

以下内容考虑的都是 `obj.Event({this, Handler})` 和 `obj.Event([this] {})` 的 `this` 指向 `obj` 的情况。在这些情况中，由于委托（回调函数）被储存在 `this` 中，因此捕获只需要捕获 `this` 指针，`{this, Member}` 的形式也只需要 `this` 传递指针。

在使用成员函数协程作为委托时，需要保证 `this` 指向的COM对象在异步执行时仍然存活。无论 `this` 是STA还是MTA，都需要手动保证这一点，因为一旦一个协程被送入线程池，就很难确定它到底多晚才被执行，并且没有任何同步机制能保证对象销毁时没有任何正在执行的异步委托。一般来说这可以在协程体内，第一次切换线程之前使用 `get_strong` 成员函数获得一个强引用来手动保证。

```cpp
winrt::fire_and_forget Class::Handler(auto sender, auto args) {
	auto strong = get_strong();
	co_await ...;
}
...
this->Event({this, &Class::Handler});
```

C++/WinRT还支持使用lambda作为委托，但这种方法有些危险。

lambda实际上是个对象，该对象在注册委托时被储存给目标对象。当目标对象被释放时，它储存的所有委托会被销毁，lambda捕获的对象也会被销毁。因此，对于协程lambda，所有捕获也需要重新被复制到函数体内，以保证在委托销毁后，协程仍然能够访问这些对象。这些复制也必须发生在第一次切换线程之前。

lambda捕获时不能使用 `strong = get_strong()` 捕获，这会使得 `this` 持有自己的强引用导致内存泄漏。该问题的解决方法是值捕获 `this` 指针，并在函数体内使用 `get_strong` 获得自己的强引用。

```cpp
this->Event([this, var](auto sender, auto args) -> winrt::fire_and_forget {
	auto strong = this->get_strong();
	auto var_local = var;
	co_await ...;
});
```

C++23引入了一个新特性推导this可以避免捕获对象需要手动复制的问题，但是仍然需要手动复制 `this` 以避免循环引用导致内存泄漏。当前，C++/WinRT支持推导this存在问题，需要等待[我的PR](https://github.com/microsoft/cppwinrt/pull/1553)合并。

```cpp
this->Event([this, var](auto this, auto sender, auto args) -> winrt::fire_and_forget {
	auto strong = this->get_strong();
	co_await ...;
});
```

如果 `this` 不指向 `obj`，那么必须要保证 `this` 比 `obj` 活得更久。C++/WinRT支持使用 `{this->get_strong(), Member}` 和 `{this->get_weak(), Member}` 的形式，以及在协程lambda捕获中以弱引用/强引用捕获 `this` 的方式做到这一点，同时要注意避免产生环。

如果 `Event` 是静态函数，那么遵守异步代码的一般规则，也就是所有捕获都需要捕获值而不是指针（类似于使用 `std::thread`）。同时，丢弃返回值会导致委托被泄漏，此时必须手动或者使用 `winrt::auto_revoke` 返回的Revoker自动反注册委托。当前 C++/WinRT 未对此类函数添加 `[[nodiscard]]` 属性，需要等待[我的PR](https://github.com/microsoft/cppwinrt/pull/1559)被合并。

### 正确处理线程亲和性

调用会更改线程的代码后，应该在合适的线程修改/读取和其他线程共享的数据。

例如，每隔1秒更新一次UI中的计数，在 `co_await` 后必须将线程切换回UI线程后更新内容：

```cpp
auto&& canceled = co_await winrt::get_cancellation_token();
co_await wil::resume_foreground(text.DispatcherQueue());
for (unsigned x = 0u; !canceled(); ++x) {
	text.Text(to_hstring(x));
    using namespace std::literals;
	co_await 1s;
    // 切换回UI线程
	co_await wil::resume_foreground(text.DispatcherQueue());
}
```

当使用事件处理函数时，产生事件的线程即是事件处理函数被执行的线程。通常来说，应该确保所有事件都是由一个线程发出的。否则，请确保所有读取和修改操作都得到正确同步。

有些任务是在确定的线程执行的，例如UI对象的事件回调函数一定在UI线程被调用。有些任务在自己的线程执行并且自发的产生事件，例如 `MediaPlayer` 和其关联的对象，或者一些监听系统状态的类。通常来说，它们的成员函数是线程安全的，但它们产生的事件的回调可以在任何线程被执行，此时必须同步到UI线程或者指定线程来完成后续逻辑。

<div class="ref-label">致谢</div>

感谢[GeeLaw](https://geelaw.blog/)提供的有关COM初始化的细致的解释，以及[蓝火火](https://github.com/cnbluefire)分享的经验以及测试，以及[HO-COOH](https://github.com/HO-COOH)让我重新想起来了委托的返回值可以使用 `winrt::fire_and_forget`。

<div class="ref-label">参考</div>
<div class="ref-list">
<a href="https://github.com/microsoft/cppwinrt">
C++/WinRT
</a>
<a href="https://devblogs.microsoft.com/oldnewthing/20230124-00/?p=107746">
Inside C++/WinRT: Apartment switching: The basic idea
</a>
<a href="https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2">
Advanced concurrency and asynchrony with C++/WinRT
</a>
<a href="https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/agile-objects">
Agile objects in C++/WinRT
</a>
<a href="https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/weak-references">
Strong and weak references in C++/WinRT
</a>
</div>


