---
title: C++/WinRT中的异步
date: "2025-12-21 11:21:00"
tags: [C++, docs, Windows]
category: blog
---

该文章是对微软的C++/WinRT文档的补充，微软的文档比较全面的介绍了C++/WinRT中异步的基本概念和用法，但它在一些问题上仍然模糊不清。
在看这篇文章之前，应该先看 [Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency) 以及 [Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2)，最好还可以看看我的C++协程教程。

<!-- more -->

### 协程是积极启动的

C++/WinRT协程是积极启动的协程，这代表只要协程被调用，即使不使用 `co_await` 运算符获得它的结果，它也已经开始执行了。

在整个文章中，“C++/WinRT协程”指的都是返回 `IAsyncAction`，`IAsyncActionWithProgress`，`IAsyncOperation` 或者 `IAsyncOperationWithProgress` 的函数，其他时候“协程”泛指C++协程。

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
5. C++/WinRT协程返回（下文会详细解释）

等。

在执行以上表达式后，该协程会切换到另一个线程上执行。

在WinRT中，继承 `DependencyObject`（例如 `UIElement`）的类提供了让任务在指定线程运行的能力。传统WinRT（UWP）使用成员函数 `Dispatcher` 获得用于调度的Dispatcher对象，使用WindowsAppSDK的API时，应使用成员函数 `DispatcherQueue` 获得它。

注意，应该使用 `wil::resume_foreground` 而不是 `winrt::resume_foreground`，因为后者在失败时返回 `bool`，容易遗漏造成错误。

`winrt::apartment_context` 是C++/WinRT自己的功能，它在初始化时捕获当前COM的上下文。

### STA，MTA

COM的线程分为STA和MTA两种，每个STA线程都关联到一个STA上下文，所有MTA线程共享一个MTA上下文。

在WinRT中，UI线程和自己创建的线程是STA线程。UI类以及其他STA类必须在创建它的线程中执行它的成员函数。MTA类可以自由的在任何线程创建和执行，但必须手动确保没有竞争。

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

### 正确处理线程亲和性

C++/WinRT异步编程中需要主要关心以下两点：调用会更改线程的代码后，修改/读取和其他线程共享的数据和在事件处理函数中确定当前线程和目标线程。

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

有些任务在自己的线程执行并且自发的产生事件，例如 `MediaPlayer` 和其关联的对象。通常来说，它们的成员函数是线程安全的，但它们产生的事件的回调可以在任何线程被执行，此时必须同步到UI线程或者指定线程来完成后续逻辑。

### COM初始化

除了UWP的主线程外，所有线程都没有初始化COM，因此没有STA和MTA上下文可以使用。

C++/WinRT提供了 `winrt::init_apartment` 和 `winrt::uninit_apartment` 用于初始化和反初始化COM，但需要注意，它没有包装成RAII风格的类，因此请确保 `winrt::uninit_apartment` 调用时，没有COM对象还未完成释放。

线程可以重复使用相同上下文类型初始化，并且要有对应数量的反初始化。使用不同上下文类型重复初始化是错误的。在最后一个反初始化执行后，COM回到未初始化状态。一般来说，Win32线程池里的线程需要一致的使用MTA。

<div class="ref-label">致谢</div>

感谢 [GeeLaw](https://geelaw.blog/) 提供的有关COM初始化的细致的解释，以及[蓝火火](https://github.com/cnbluefire)分享的经验以及测试。

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
</div>


