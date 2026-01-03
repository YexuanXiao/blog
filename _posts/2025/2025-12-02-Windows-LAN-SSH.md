---
title: 配置Windows的局域网SSH访问
date: "2025-12-01 00:05:00"
tags: [Windows, docs]
category: blog
---
Windows 10 1809起，自带可选的OpenSSH服务器功能，经过简单配置即可作为SSH服务器使用。

<!-- more -->

本文教程尽可能从简，目的是提供一个最小化的配置案例，减轻后续维护难度以及避免系统配置造成的差异。

1. 打开可选功能，搜索OpenSSH，安装OpenSSH服务器功能，不需要重启

2. 生成或者复制一个用于登录的公钥，例如id\_ed25519.pub

3. 把id\_ed25519.pub作为SSH服务器的认证公钥复制为 `~\.ssh\authorized_keys`

4. 配置服务器信息，编辑 `%ProgramData%\ssh\sshd_config`，设置 `Port 233`，`PubkeyAuthentication yes`，`AuthorizedKeysFile .ssh/authorized_keys`，`PasswordAuthentication no`，其中233是SSH服务端口号，不要和Linux或者Windows的服务冲突

5. PowerShell执行 `Restart-Service sshd` 重启服务

6. PowerShell执行 `New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP-Custom-Port' -DisplayName 'OpenSSH Server (sshd) Custom Port' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 234` 开放Windows防火墙，注意端口号自行修改为第四步设置的

7. PowerShell执行 `Set-Service -Name "sshd" -StartupType Automatic` 设置sshd服务开机自启动

8. 可选，PowerShell执行 `New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell -Value "C:\Program Files\PowerShell\7\pwsh.exe" -PropertyType String -Force` 可以修改默认Shell，注意路径必须是绝对路径
