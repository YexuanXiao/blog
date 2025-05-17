---
title: 为什么你不应该暂停一个线程
date: "2025-05-05 14:55:00"
tags: [C++, docs]
category: blog
---
该文章是 Raymond Chen 在 4 月 11 日发布的文章 [The case of the UI thread that hung in a kernel call](https://devblogs.microsoft.com/oldnewthing/20250411-00/?p=111066) 的中文翻译，Raymond Chen 通过这个客户例子指出了**不能暂停当前进程的线程**的原因：被暂停的线程可能正在持有锁，暂停后该锁无法释放，导致死锁而无法恢复线程。

<!-- more -->

### 在内核调用中暂停的 UI 线程案例

一位客户请求协助解决一个长期存在但发生频率较低的界面线程暂停问题，他们始终无法查明原因。根据客户描述，其 UI 线程在调用内核函数时无故陷入暂停状态。遗憾的是，由于线程栈已被换出内存，内核转储文件无法显示用户模式下的调用栈（这种现象很合理——暂停的线程不会使用栈，因此当系统内存压力增大时，该栈自然会被换出）。

0: kd\> !thread 0xffffd18b976ec080 7<br>
THREAD ffffd18b976ec080  Cid 79a0.7f18  Teb: 0000003d7ca28000<br>
Win32Thread: ffffd18b89a8f170 WAIT: (Suspended) KernelMode Non-Alertable<br>
SuspendCount 1<br>
ffffd18b976ec360  NotificationEvent<br>
Not impersonating<br>
DeviceMap                 ffffad897944d640<br>
Owning Process            ffffd18bcf9ec080       Image:         contoso.exe<br>
Attached Process          N/A            Image:         N/A<br>
Wait Start TickCount      14112735       Ticks: 1235580 (0:05:21:45.937)<br>
Context Switch Count      1442664        IdealProcessor: 2<br>
UserTime                  00:02:46.015<br>
KernelTime                00:01:11.515

nt!KiSwapContext+0x76<br>
nt!KiSwapThread+0x928<br>
nt!KiCommitThreadWait+0x370<br>
nt!KeWaitForSingleObject+0x7a4<br>
nt!KiSchedulerApc+0xec<br>
nt!KiDeliverApc+0x5f9<br>
nt!KiCheckForKernelApcDelivery+0x34<br>
nt!MiUnlockAndDereferenceVad+0x8d<br>
nt!MmProtectVirtualMemory+0x312<br>
nt!NtProtectVirtualMemory+0x1d9<br>
nt!KiSystemServiceCopyEnd+0x25 (TrapFrame @ ffff8707\`a9bef3a0)<br>
ntdll!ZwProtectVirtualMemory+0x14<br>
\[end of stack trace\]

虽然无法查看用户模式下的代码执行情况，但现有信息中存在一些异常现象。

注意该问题线程显示为“Suspended”状态，且暂停时间已超过五小时。

THREAD ffffd18b976ec080  Cid 79a0.7f18  Teb: 0000003d7ca28000<br>
Win32Thread: ffffd18b89a8f170 WAIT: (<span style="border: solid 1px currentcolor;">Suspended</span>) KernelMode Non-Alertable<br>
SuspendCount 1<br>
ffffd18b976ec360  NotificationEvent<br>
Not impersonating<br>
DeviceMap                 ffffad897944d640<br>
Owning Process            ffffd18bcf9ec080       Image:         contoso.exe<br>
Attached Process          N/A            Image:         N/A<br>
Wait Start TickCount      14112735       Ticks: 1235580 (<span style="border: solid 1px currentcolor;">0:05:21:45.937</span>)

显然，被暂停的 UI 线程必然表现为程序无响应。

由于 `SuspendThread` 这类函数主要为调试器设计，我们询问客户捕获内核转储时是否附加了调试器，得到否定答复。

那么究竟是谁暂停了线程？为何如此？

客户随后意识到他们有个看门狗线程专门监控 UI 线程响应性：该线程会定期暂停 UI 线程、捕获栈跟踪后恢复其运行。在转储文件中，他们确实观察到看门狗线程正在执行栈捕获代码。但为何栈捕获耗时五小时？

看门狗线程的调用栈如下：

ntdll!ZwWaitForAlertByThreadId(void)+0x14<br>
ntdll!RtlpAcquireSRWLockSharedContended+0x15a<br>
ntdll!RtlpxLookupFunctionTable+0x180<br>
ntdll!RtlLookupFunctionEntry+0x4d<br>
contoso!GetStackTrace+0x72<br>
contoso!GetStackTraceOfUIThread+0x127
...

可见看门狗线程试图获取 UI 线程栈时，在 `RtlLookupFunctionEntry` 函数内因等待锁而暂停。

各位猜猜锁的持有者是谁？

正是被暂停的 UI 线程本身。

UI 线程可能正在派发异常（这意味着它正在遍历栈寻找异常处理程序），但在搜索过程中被看门狗线程暂停。而后看门狗线程尝试遍历 UI 线程栈时，却因函数表被 UI 线程的栈遍历操作锁定而阻塞。

这完美印证了我们之前的讨论：永远不要暂停线程。

更准确地说，应该是“永远不要暂停本进程内的线程”。暂停本进程线程可能导致被暂停线程恰好持有其他代码所需的资源——特别是负责恢复该线程的代码所需的资源。由于线程被暂停，这些资源永远无法释放，最终导致被暂停线程与恢复线程之间形成死锁。

若需暂停线程并捕获其栈，必须通过外部进程实施操作，以避免与被暂停线程产生死锁 [^1]。

[^1]: 当然，这要求暂停线程的代码不等待跨进程资源（如信号量、互斥量或文件锁），因为这些资源可能正被目标线程持有。

额外细节：从内核栈可见 `SuspendThread` 的异步执行特征。当看门狗线程调用 `SuspendThread` 暂停 UI 线程时，UI 线程正在内核态执行内存保护修改操作。线程不会立即暂停，而是等待内核完成工作，在返回用户模式前通过 `CheckForKernelApcDelivery` 检查待处理请求，此时才执行实际暂停操作 [^2]。

[^2]: 内核不立即暂停线程的另一个重要原因：若线程持有内核锁（如页表访问同步锁），立即暂停将导致内核自身死锁！

延伸思考：“若内核检测到线程持有用户模式锁就延迟暂停，能否避免此问题？”首先，内核如何判断线程是否持有用户模式锁？用户模式锁并无可靠特征——任何内存字节都可作为自旋锁使用。其次，即便内核能检测，也不应因此阻止暂停，否则程序只需调用 `AcquireSRWLockShared(全局锁)` 且永不释放，就能使线程获得“免暂停”特权。
