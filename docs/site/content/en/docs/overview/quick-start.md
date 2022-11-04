---
title: "Quick Start"
description: "One page summary of how to start WhatsApp HTTP API."
lead: "One page summary of how to start WhatsApp HTTP API."
date: 2020-11-16T13:59:39+01:00
lastmod: 2020-11-16T13:59:39+01:00
draft: false
images: []
menu:
  docs:
    parent: "overview"
weight: 110
toc: true
---

## Requirements

Only thing that you must have - installed docker. Please follow the original
instruction <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener">how to install docker -></a>.


{{< details "Why Docker?" >}}
Docker makes it easy to ship all-in-one solution with the runtime and dependencies. You don't have to worry about language-specific libraries or chrome installation.

Also Docker makes installation and update processes so simple, just one command!
{{< /details >}}

## Send your first message
Let's go over steps that allow you to send your first text message via WhatsApp HTTP API!

### 1. Download image
Assuming you have installed [Docker](https://docs.docker.com/get-docker/), let's download the image

#### Core
For ![](/images/versions/core.png) version the command is
```bash
docker pull devlikeapro/whatsapp-http-api
```

#### Plus
For ![](/images/versions/core.png) version, we use login to get the image before:
```bash
docker login -u devlikeapro -p {PASSWORD}
docker pull devlikeapro/whatsapp-http-api-plus
docker logout
```
Read more about how to get `PASSWORD` for [Plus Version →]({{< relref "plus-version" >}})

{{< alert icon="ℹ" text="Use **whatsapp-http-api-plus** image name in all commands" />}}
