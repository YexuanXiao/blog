---
title: Asynchronous with C++/WinRT
date: "2025-12-21 11:21:00"
tags: [C++, docs, Windows]
category: blog
---

This article serves as a supplement to Microsoft's C++/WinRT documentation. This article serves as a supplement to Microsoft's C++/WinRT documentation. Microsoft's docs provide a solid overview of asynchronous concepts and usage; however, they are ambiguous on several key points.

Before diving into this article, you should first read [Concurrency and asynchronous operations with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency) and [Advanced concurrency and asynchrony with C++/WinRT](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/concurrency-2). It's also helpful to have gone through my C++ coroutines tutorial (Chinese).

<!-- more -->

### C++/WinRT Coroutines Are Eagerly Started

C++/WinRT coroutines are **eagerly started**. This means the coroutine begins execution as soon as it's called, even if you don't use the `co_await` operator to retrieve its result.

Throughout this article, "C++/WinRT coroutine" specifically refers to functions that return `IAsyncAction`, `IAsyncActionWithProgress`, `IAsyncOperation`, or `IAsyncOperationWithProgress`. In other contexts, "coroutine" refers to C++ coroutines in general.

If a C++/WinRT coroutine's body is synchronous (e.g., contains only a `co_return` statement with no other `co_await` statements), then calling it will not cause a thread switch.

```cpp
// Awaiting this coroutine with co_await will not switch threads.
IAsyncAction foo()
{
    co_return;
}
```

This eager-start design originates from WinRT itself. It allows an external caller to cancel an async task instead of waiting (synchronously) for it to finish.

```cpp
auto task = AsyncTask();
// ... other sync or async code ...
if (canceled) {
    task.Cancel();
} else {
    co_await task;
}
```

You can also store the `task` for later use.

### When a Thread Switch Can Occur

Any `co_await` expression has the *potential* to switch threads (this isn't unique to C++/WinRT coroutines; it's inherent to how `co_await` works). However, most WinRT functions marked as asynchronous won't actually cause a thread switch. One reason is they might be internally synchronous. Another is they can capture the caller's context and resume on it later—more details on this shortly.

In C++/WinRT, common scenarios that **do** cause a thread switch include:

1.  Awaiting a duration, e.g., `co_await 1s`
2.  Switching execution to a background thread, e.g., `co_await winrt::resume_background()`
3.  Specifying a task queue (DispatcherQueue), e.g., `co_await wil::resume_foreground(DispatcherQueue())`
4.  Specifying a context for execution, e.g., `co_await context` where `context` is a `winrt::apartment_context`
5.  Resuming after a C++/WinRT coroutine returns (explained in detail later)

...and others.

After executing any of the above expressions, the coroutine continues on a different thread.

In WinRT, classes that inherit from `DependencyObject` (such as `UIElement`) provide the ability to run tasks on a specific thread. Traditional WinRT (UWP) uses member function `Dispatcher` to obtain a Dispatcher object for scheduling. When using APIs from the Windows App SDK, you should use the member function `DispatcherQueue` to obtain it.

**Note:** Prefer `wil::resume_foreground` over `winrt::resume_foreground`. The latter returns a `bool` on failure, which is easy to overlook and can lead to errors.

`winrt::apartment_context` is a C++/WinRT-specific feature that captures the current COM context upon initialization.

### STA, MTA, and COM Contexts

COM threads are categorized as either STA or MTA. Each STA thread is associated with its own STA context, while all MTA threads share a single MTA context.

In WinRT, UI threads and threads you create yourself are STA threads. UI classes and other STA classes must have their member functions executed on the thread that created them. MTA classes can be created and executed on any thread, but you must manually ensure there are no race conditions.

A Dispatcher represents a message queue associated with its STA thread.

`co_await wil::resume_foreground(DispatcherQueue())` schedules the current coroutine to run on that single-threaded message queue. After the `co_await` completes, execution continues on the thread used by that queue.

When `co_await context;` resumes, if `context` is an STA context, the coroutine resumes execution within that specific context. If `context` is an MTA context, the coroutine may resume on any background thread (from the Win32 thread pool).

**Important Limitation of `winrt::apartment_context`:**

| Caller | Target | Execution Behavior                           |
| :----- | :----- | :-------------------------------------------- |
| MTA    | MTA    | Direct execution (shared context)             |
| MTA    | STA    | **Blocks the caller**                         |
| STA0   | STA1   | **Blocks the caller**                         |
| STA0   | STA0   | Direct execution (same context)               |
| STA    | MTA    | Scheduled to thread pool                      |

When you need to synchronize back to the UI thread, **prioritize using the Dispatcher**, as it does **not** block the caller (addressing cases 2 and 3 in the table).

A C++/WinRT coroutine captures the current context when called and attempts to resume on it when returning. So, if you await a C++/WinRT coroutine from a UI thread, you are guaranteed to still be on the UI thread when it returns.

### Handling Thread Affinity Correctly

In C++/WinRT async programming, you primarily need to focus on two things: **Safely modifying/reading shared data** after calling code that may change threads; **Determining the current and target threads** within event handlers.

For example, to update a UI counter every second, you must switch back to the UI thread *after* the `co_await` before modifying the UI content:

```cpp
auto&& canceled = co_await winrt::get_cancellation_token();
co_await wil::resume_foreground(text.DispatcherQueue());
for (unsigned x = 0u; !canceled(); ++x) {
	text.Text(to_hstring(x));
    using namespace std::literals;
	co_await 1s;
    // switch back to UI thread
	co_await wil::resume_foreground(text.DispatcherQueue());
}
```

When working with event handlers, the thread that raises the event is the thread on which the handler executes. Generally, you should ensure all events are raised from a single thread. If not, you must guarantee all read and write operations are properly synchronized.

Some tasks run on their own threads and raise events spontaneously, such as `MediaPlayer` and its associated objects. Typically, their member functions are thread-safe, but the callbacks for events they raise can execute on any thread. In these cases, you must synchronize back to the UI thread or a specified thread to complete your logic.

### COM Initialization  

Apart from the main thread in UWP, all threads are not initialized with COM, meaning there is no STA or MTA context available for use.

C++/WinRT provides `winrt::init_apartment` and `winrt::uninit_apartment` for initializing and uninitializing COM. However, note that these are not wrapped as RAII-style classes, so ensure that when `winrt::uninit_apartment` is called, no COM objects remain unreleased.  

A thread can be initialized multiple times with the same context type, and there must be a corresponding number of uninitializations. Re-initializing with a different context type is an error. After the last uninitialization is performed, COM returns to an uninitialized state. Generally, threads in the Win32 thread pool need to consistently use MTA.

<div class="ref-label">Acknowledgements</div>

Thanks to [GeeLaw](https://github.com/GeeLaw) for the detailed explanation on COM initialization, and to [cnbluefire](https://github.com/cnbluefire) for sharing the experience and tests.

<div class="ref-label">References</div>
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
</div>
