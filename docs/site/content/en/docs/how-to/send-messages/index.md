---
title : "Send messages"
description: "Send messages"
lead: ""
date: 2020-10-06T08:48:45+00:00
lastmod: 2020-10-06T08:48:45+00:00
draft: false
images: []
weight: 200
---

## Fields
There are common fields that you can find in almost all requests:
- `session` - a session name from which account you're sending the message. We use `default` in the examples.
  - Core ![](/images/versions/core.png) version supports only `default` session.
  - Plus ![](/images/versions/plus.png) allows you to run multiple sessions inside one container to save your memory and CPU resources!
Read more about [multiple sessions →]({{< relref "/docs/how-to/session" >}})

- `chatId` - it's a phone number or Group identifier where you're sending the message.
  - **Phone numbers** accounts use international phone number without + at the start and add `@c.us` at the end.
    For phone number `12132132131` the `chatId` is  `12132132131@c.us`.
  - **Groups** use random number with `@g.us` at the end.

## Send text ![](/images/versions/core.png) ![](/images/versions/plus.png)
## Reply on message ![](/images/versions/core.png) ![](/images/versions/plus.png)
### Attach files ![](/images/versions/plus-soon.png)
WAHA does not support reply with files (images, voice, etc). If you're interested in it - please create an issue in GitHub.
## Send image ![](/images/versions/plus.png)
## Send voice ![](/images/versions/plus.png)
## Send file ![](/images/versions/plus.png)

