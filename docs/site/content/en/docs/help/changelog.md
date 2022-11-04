---
title: "Changelog"
description: "Changelog"
lead: "Changelog"
date: 2020-10-06T08:49:31+00:00
lastmod: 2020-10-06T08:49:31+00:00
draft: false
images: []
menu:
  docs:
    parent: "help"
weight: 600
toc: true
---

## 2022.11

### Webhooks settings [core] [plus]

Instead of setting each webhook via environment variables - we use two environments variables:

- `WHATSAPP_HOOK_URL` - to set a URL
- `WHATSAPP_HOOK_EVENTS` - to set events that are sent to the URL

| Previous                                                                                                             | Current                                                                                            |
|----------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| <pre>WHATSAPP_HOOK_ONMESSAGE=https://httpbin.org/post <br>WHATSAPP_HOOK_ONANYMESSAGE=https://httpbin.org/post </pre> | <pre>WHATSAPP_HOOK_URL=https://httpbin.org/post <br>WHATSAPP_HOOK_EVENTS=message,message.any</pre> |

### Webhooks payload [core] [plus]

The data for webhooks are wrapped inside a new `WAWebhook` object with `event` and `payload` fields to help you identify
which handler you should call based on `event`.

```json
{
  "event": "message.any",
  "payload": {
  }
}
```
